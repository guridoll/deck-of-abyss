(function () {
 if (typeof window === 'undefined') return;

 function createCardLibrary(deps) {
  const {
   cardPool,
   loadDiscoveredCards,
   playUiSelectSound,
   isRareCard,
   getCardRarity,
   getCardRarityBadge,
   getCardRarityClass,
   getCardVisualClass,
   getCardIcon,
   getBaseCardDisplayText,
   getCardCooldownText,
   getCardEvolutionTargetName,
   getCardByName,
   escapeHtml,
  } = deps || {};
  const CARD_POOL = Array.isArray(cardPool) ? cardPool : [];
  let currentCardLibraryRarityFilter = 'all';
  let currentCardLibraryCategoryFilter = 'all';
  let currentCardLibrarySearchText = '';

  if (typeof loadDiscoveredCards !== 'function' || typeof playUiSelectSound !== 'function' || typeof isRareCard !== 'function' || typeof getCardRarity !== 'function' || typeof escapeHtml !== 'function') {
   throw new Error('GameCardLibrary dependencies are missing.');
  }

  function getCardLibraryTabs() {
   return getCardLibraryCategoryFilters();
  }

  function getCardLibraryRarityFilters() {
   return [
    { id: 'all', name: 'すべて' },
    { id: 'normal', name: 'ノーマル' },
    { id: 'rare', name: 'レア' },
    { id: 'epic', name: 'エピック' },
    { id: 'legendary', name: 'レジェンダリー' },
   ];
  }

  function getCardLibraryCategoryFilters() {
   return [
    { id: 'all', name: 'すべて' },
    { id: 'attack', name: '攻撃' },
    { id: 'defense', name: '防御' },
    { id: 'status', name: '状態異常' },
    { id: 'support', name: '補助' },
    { id: 'paralysis', name: '麻痺系' },
    { id: 'freeze', name: '凍結系' },
    { id: 'burn', name: '火傷系' },
    { id: 'poison', name: '毒系' },
    { id: 'gamble', name: 'ギャンブル系' },
    { id: 'bomb', name: '爆弾系' },
    { id: 'selfDamage', name: '自傷系' },
    { id: 'pet', name: 'ペット系' },
    { id: 'draw', name: 'ドロー系' },
    { id: 'field', name: 'フィールド系' },
    { id: 'heal', name: '回復' },
   ];
  }

  function changeCardLibraryTab(tabId) {
   playUiSelectSound();
   currentCardLibraryCategoryFilter = tabId || 'all';
   renderCardLibraryScreen();
  }

  function updateCardLibraryFilter(type, value) {
   if (type === 'rarity') currentCardLibraryRarityFilter = value || 'all';
   if (type === 'category') currentCardLibraryCategoryFilter = value || 'all';
   if (type === 'search') currentCardLibrarySearchText = value || '';
   renderCardLibraryScreen();
  }

  function addCardLibraryCategory(categories, id) {
   if (!categories.includes(id)) categories.push(id);
  }

  function getCardLibraryCategories(card) {
   const categories = [];
   const type = String(card?.type || '');
   const nameAndText = `${card?.name || ''} ${card?.text || ''}`;

   if (!type) {
    addCardLibraryCategory(categories, 'support');
    return categories;
   }

   if (String(type).startsWith('curse-')) {
    addCardLibraryCategory(categories, 'status');
    return categories;
   }

   if (type.startsWith('bomb-')) {
    addCardLibraryCategory(categories, 'status');
    addCardLibraryCategory(categories, 'bomb');
   }

   if (type.startsWith('field-')) addCardLibraryCategory(categories, 'field');
   if (type.startsWith('pet-')) addCardLibraryCategory(categories, 'pet');
   if (type === 'heal' || type === 'rare-heal' || type === 'risky-heal' || /HP\+|回復/.test(nameAndText)) addCardLibraryCategory(categories, 'heal');
   if (type.startsWith('draw-') || type === 'reload-first-draw' || type === 'improvised-tactics' || /ドロー|手札補充/.test(nameAndText)) addCardLibraryCategory(categories, 'draw');
   if (type.includes('paralyze') || type === 'dein' || type === 'pure-paralysis' || /麻痺/.test(nameAndText)) {
    addCardLibraryCategory(categories, 'status');
    addCardLibraryCategory(categories, 'paralysis');
   }
   if (type.includes('freeze') || type === 'ice-needle' || /凍結|氷/.test(nameAndText)) {
    addCardLibraryCategory(categories, 'status');
    addCardLibraryCategory(categories, 'freeze');
   }
   if (type.includes('burn') || /火傷|焼夷|火花|火炎/.test(nameAndText)) {
    addCardLibraryCategory(categories, 'status');
    addCardLibraryCategory(categories, 'burn');
   }
   if (type === 'poison' || type.startsWith('poison-') || type === 'field-toxic-blade' || /毒/.test(nameAndText)) {
    addCardLibraryCategory(categories, 'status');
    addCardLibraryCategory(categories, 'poison');
   }
   if (type.includes('chance') || type.includes('gamble') || type === 'high-risk-attack' || /確率|MISS|賭け|一撃狙い|ラッキー/.test(nameAndText)) {
    addCardLibraryCategory(categories, 'gamble');
   }
   if (type.includes('self') || type.startsWith('blood-') || type === 'risky-heal' || type === 'percent-hp-attack' || /HP[0-9０-９]*失う|自分に|自傷|血/.test(nameAndText)) {
    addCardLibraryCategory(categories, 'selfDamage');
   }

   if (type === 'defense'
    || type === 'rare-defense'
    || type === 'reflect-next-attack'
    || type === 'endure-next-attack'
    || type === 'chance-defense'
    || type === 'parry-guard'
    || type === 'prepared-guard'
    || type === 'scaling-defense'
    || type === 'field-gravity-slash') {
    addCardLibraryCategory(categories, 'defense');
   }

   if (type === 'attack'
    || type === 'gamble-attack'
    || type === 'double-slash'
    || type === 'rare-attack'
    || type === 'rare-double-attack'
    || type === 'paralyze-bonus-attack'
    || type === 'rare-attack-defense'
    || type === 'self-damage-attack'
    || type === 'chance-attack'
    || type === 'high-risk-attack'
    || type === 'freeze-bonus-attack'
    || type === 'freeze-triple-attack'
    || type === 'risky-self-attack'
    || type === 'percent-hp-attack'
    || type === 'revenge-attack'
    || type === 'finisher-attack'
    || type === 'burn-bonus-attack'
    || type === 'pierce-attack'
    || type === 'attack-defense'
    || type === 'reload-first-draw'
    || type === 'pursuit-attack'
    || type === 'counter-blade'
    || type === 'ice-needle'
    || type === 'field-toxic-blade'
    || type === 'field-ice-follow'
    || type === 'field-fog-blade'
    || type === 'scaling-attack') {
    addCardLibraryCategory(categories, 'attack');
   }

   if (type === 'dein'
    || type === 'pure-paralysis'
    || type === 'freeze'
    || type === 'poison'
    || type === 'burn'
    || type === 'pure-burn'
    || type === 'attack-down'
    || type === 'defense-down'
    || type === 'strip-defense'
    || type === 'mutual-freeze'
    || type === 'enemy-action-delay-turns'
    || type === 'enemy-action-shift-delay'
    || type === 'field-magic-convergence'
    || type === 'field-spark-fuse') {
    addCardLibraryCategory(categories, 'status');
   }

   if (!categories.length) addCardLibraryCategory(categories, 'support');
   return categories;
  }

  function getCardLibraryCategory(card) {
   const categories = getCardLibraryCategories(card);
   const primaryOrder = ['attack', 'defense', 'status', 'support'];
   return primaryOrder.find(category => categories.includes(category)) || categories[0] || 'support';
  }

  function getCardLibraryRarity(card) {
   return getCardRarity(card);
  }

  function getCardLibraryRarityMeta(rarity) {
   const map = {
    normal: { title: 'ノーマル', icon: 'N', subtitle: '基本となるカード', className: 'normal' },
    rare: { title: 'レア', icon: 'R', subtitle: '強力な効果を持つカード', className: 'rare' },
    epic: { title: 'エピック', icon: 'E', subtitle: '戦い方を大きく変えるカード', className: 'epic' },
    legendary: { title: 'レジェンダリー', icon: 'L', subtitle: '特別な力を持つカード', className: 'legendary' },
   };
   return map[rarity] || map.normal;
  }

  function getCardLibraryCategoryLabel(card) {
   const map = {
    attack: '攻撃',
    defense: '防御',
    status: '状態異常',
    support: '補助',
    paralysis: '麻痺系',
    freeze: '凍結系',
    burn: '火傷系',
    poison: '毒系',
    gamble: 'ギャンブル系',
    bomb: '爆弾系',
    selfDamage: '自傷系',
    pet: 'ペット系',
    draw: 'ドロー系',
    field: 'フィールド系',
    heal: '回復',
   };

   return getCardLibraryCategories(card).map(category => map[category] || category).join(' / ') || '補助';
  }

  function getCardLibraryEvolutionHtml(card, discoveredCards) {
   if (typeof getCardEvolutionTargetName !== 'function' || typeof getCardByName !== 'function') return '';
   const targetName = getCardEvolutionTargetName(card?.name);
   if (!targetName) return '';

   const targetCard = getCardByName(targetName);
   if (!targetCard) return '';

   if (!discoveredCards || !discoveredCards[targetCard.name]) {
    return `
     <section class="card-library-evolution-section card-library-evolution-unknown">
      <div class="card-library-evolution-heading">進化先</div>
      <div class="card-library-evolution-unknown-text">進化先：？？？</div>
     </section>
    `;
   }

   const renderEvolutionCard = (entry, label) => {
    const rarityMeta = getCardLibraryRarityMeta(getCardLibraryRarity(entry));
    const value = entry.value === undefined || entry.value === null || entry.value === '' ? '-' : String(entry.value);
    return `
     <article class="card-library-evolution-card ${getCardVisualClass(entry)} ${entry.type || ''}${getCardRarityClass(entry)}">
      <div class="card-library-evolution-label">${escapeHtml(label)}</div>
      <div class="card-library-evolution-title">
       <span>${getCardIcon(entry.type)}</span>
       <strong>${escapeHtml(entry.name)}</strong>
      </div>
      <div class="card-library-evolution-meta">
       <span>${escapeHtml(rarityMeta.title)}</span>
       <span>${escapeHtml(getCardLibraryCategoryLabel(entry))}</span>
       <span>${escapeHtml(getCardCooldownText(entry))}</span>
      </div>
      <div class="card-library-evolution-value">${escapeHtml(value)}</div>
      <div class="card-library-evolution-effect">${escapeHtml(getBaseCardDisplayText(entry))}</div>
     </article>
    `;
   };

   return `
    <section class="card-library-evolution-section">
     <div class="card-library-evolution-heading">進化先</div>
     <div class="card-library-evolution-route">${escapeHtml(card.name)} → ${escapeHtml(targetCard.name)}</div>
     <div class="card-library-evolution-compare">
      ${renderEvolutionCard(card, '進化前')}
      <div class="card-library-evolution-arrow">→</div>
      ${renderEvolutionCard(targetCard, '進化後')}
     </div>
    </section>
   `;
  }

  function openCardLibraryDetailModal(cardName) {
   const discoveredCards = loadDiscoveredCards();
   const card = CARD_POOL.find(item => item.name === cardName);
   if (!card || !discoveredCards[card.name]) return;

   const modal = document.getElementById('card-library-detail-modal');
   const content = document.getElementById('card-library-detail-content');
   if (!modal || !content) return;

   const rarity = getCardLibraryRarity(card);
   const rarityMeta = getCardLibraryRarityMeta(rarity);
   const visualClasses = `${getCardVisualClass(card)} ${card.type || ''} ${card.type ? `${card.type}-card` : ''}${getCardRarityClass(card)}`;
   const value = card.value === undefined || card.value === null || card.value === '' ? '-' : String(card.value);

   playUiSelectSound();

   content.innerHTML = `
    <div class="library-card card-library-detail-card ${visualClasses}">
     <div class="card-shine"></div>
     ${isRareCard(card) ? `<div class="rare-badge">${getCardRarityBadge(card)}</div>` : ''}
     <div class="card-library-detail-top">
      <div>
       <div class="card-library-detail-kicker">${escapeHtml(rarityMeta.title)} / ${escapeHtml(getCardLibraryCategoryLabel(card))}</div>
       <h2>${escapeHtml(card.name)}</h2>
      </div>
      <div class="card-library-detail-icon">${getCardIcon(card.type)}</div>
     </div>
     <div class="card-library-detail-value">${escapeHtml(value)}</div>
     <div class="card-library-detail-effect">${escapeHtml(getBaseCardDisplayText(card))}</div>
     <div class="card-library-detail-meta">
      <span><small>レアリティ</small><strong>${escapeHtml(rarityMeta.title)}</strong></span>
      <span><small>種類</small><strong>${escapeHtml(getCardLibraryCategoryLabel(card))}</strong></span>
      <span><small>硬直時間</small><strong>${escapeHtml(getCardCooldownText(card))}</strong></span>
     </div>
    </div>
    ${getCardLibraryEvolutionHtml(card, discoveredCards)}
   `;

   modal.style.display = 'flex';
  }

  function closeCardLibraryDetailModal(event) {
   if (event && event.target !== event.currentTarget && event.currentTarget?.id === 'card-library-detail-modal') return;

   const modal = document.getElementById('card-library-detail-modal');
   if (modal) modal.style.display = 'none';
  }

  function renderFilterOptions(options, selected) {
   return options.map(option => `<option value="${escapeHtml(option.id)}"${option.id === selected ? ' selected' : ''}>${escapeHtml(option.name)}</option>`).join('');
  }

  function renderCardLibraryScreen() {
   const tabs = document.getElementById('card-library-tabs');
   const list = document.getElementById('card-library-list');

   if (!list) return;
   if (tabs) tabs.remove();

   const discoveredCards = loadDiscoveredCards();
   const discoveredCount = CARD_POOL.filter(card => discoveredCards[card.name]).length;
   const searchText = String(currentCardLibrarySearchText || '').trim().toLocaleLowerCase('ja');
   const visibleCards = CARD_POOL.filter(card => {
    const discovered = Boolean(discoveredCards[card.name]);
    if (currentCardLibraryRarityFilter !== 'all' && getCardLibraryRarity(card) !== currentCardLibraryRarityFilter) return false;
    if (currentCardLibraryCategoryFilter !== 'all' && !getCardLibraryCategories(card).includes(currentCardLibraryCategoryFilter)) return false;
    if (searchText) {
     if (!discovered) return false;
     return String(card.name || '').toLocaleLowerCase('ja').includes(searchText);
    }
    return true;
   });
   const rarityOrder = ['normal', 'rare', 'epic', 'legendary'];

   list.innerHTML = `
    <div class="enemy-library-summary card-library-summary">発見済み：${discoveredCount} / ${CARD_POOL.length}</div>
    <div class="library-filter-panel card-library-filter-panel">
     <label>
      <span>レアリティ</span>
      <select id="card-library-rarity-filter">${renderFilterOptions(getCardLibraryRarityFilters(), currentCardLibraryRarityFilter)}</select>
     </label>
     <label>
      <span>カード種類</span>
      <select id="card-library-category-filter">${renderFilterOptions(getCardLibraryCategoryFilters(), currentCardLibraryCategoryFilter)}</select>
     </label>
     <label class="library-search-label">
      <span>カード名検索</span>
      <input id="card-library-name-search" type="search" value="${escapeHtml(currentCardLibrarySearchText)}" placeholder="カード名を入力">
     </label>
     <div class="library-filter-result">表示中：${visibleCards.length}枚</div>
    </div>
   `;

   const raritySelect = document.getElementById('card-library-rarity-filter');
   const categorySelect = document.getElementById('card-library-category-filter');
   const searchInput = document.getElementById('card-library-name-search');
   if (raritySelect) raritySelect.onchange = event => updateCardLibraryFilter('rarity', event.target.value);
   if (categorySelect) categorySelect.onchange = event => updateCardLibraryFilter('category', event.target.value);
   if (searchInput) {
    searchInput.oninput = event => updateCardLibraryFilter('search', event.target.value);
    if (currentCardLibrarySearchText) {
     searchInput.focus();
     const caret = String(currentCardLibrarySearchText).length;
     searchInput.setSelectionRange(caret, caret);
    }
   }

   rarityOrder.forEach(rarity => {
    const cards = visibleCards.filter(card => getCardLibraryRarity(card) === rarity);
    if (!cards.length) return;

    const meta = getCardLibraryRarityMeta(rarity);
    const discoveredInRarity = cards.filter(card => discoveredCards[card.name]).length;
    const section = document.createElement('section');
    section.className = `card-rarity-section card-rarity-${meta.className}`;
    section.innerHTML = `
     <div class="achievement-tier-heading card-rarity-heading">
      <div class="achievement-tier-title-wrap">
       <span class="achievement-tier-icon">${meta.icon}</span>
       <div>
        <div class="achievement-tier-title">${escapeHtml(meta.title)}</div>
        <div class="achievement-tier-subtitle">${escapeHtml(meta.subtitle)}</div>
       </div>
      </div>
      <div class="achievement-tier-count"><strong>${discoveredInRarity}</strong><span>/ ${cards.length}</span></div>
     </div>
     <div class="card-rarity-grid"></div>
    `;

    const grid = section.querySelector('.card-rarity-grid');

    cards.forEach(card => {
     const div = document.createElement('div');
     const discovered = Boolean(discoveredCards[card.name]);

     div.className = discovered
      ? `library-card clickable-library-card ${getCardVisualClass(card)} ${card.type || ''} ${card.type ? `${card.type}-card` : ''}${getCardRarityClass(card)}`
      : 'library-card undiscovered-card';

     if (discovered) {
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `${card.name}の詳細を表示`);
      div.onclick = () => openCardLibraryDetailModal(card.name);
      div.onkeydown = event => {
       if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCardLibraryDetailModal(card.name);
       }
      };

      div.innerHTML = `
       <div class="card-shine"></div>
       ${isRareCard(card) ? `<div class="rare-badge">${getCardRarityBadge(card)}</div>` : ''}
       <div class="card-top">
        <div>${escapeHtml(card.name)}</div>
        <div class="card-icon">${getCardIcon(card.type)}</div>
       </div>
       <div class="value">${escapeHtml(String(card.value ?? ''))}</div>
       <div class="card-text">${escapeHtml(getBaseCardDisplayText(card))}</div>
       <div class="card-cooldown">${escapeHtml(getCardCooldownText(card))}</div>
       <div class="library-card-note">${escapeHtml(getCardLibraryCategoryLabel(card))}</div>
      `;
     } else {
      div.innerHTML = `
       <div class="card-library-unknown-mark">?</div>
       <div class="card-top">
        <div>未発見カード</div>
        <div class="card-icon">?</div>
       </div>
       <div class="value">?</div>
       <div class="card-text">発見すると効果が記録されます。</div>
       <div class="library-card-note">未発見</div>
      `;
     }

     grid.appendChild(div);
    });

    list.appendChild(section);
   });

   if (visibleCards.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'library-empty-message';
    empty.textContent = '条件に一致するカードはありません。';
    list.appendChild(empty);
   }
  }

  return {
   getCardLibraryTabs,
   changeCardLibraryTab,
   getCardLibraryCategory,
   getCardLibraryRarity,
   getCardLibraryRarityMeta,
   openCardLibraryDetailModal,
   closeCardLibraryDetailModal,
   renderCardLibraryScreen,
  };
 }

 window.GameCardLibrary = {
  createCardLibrary,
 };
}());
