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
   escapeHtml,
  } = deps || {};
  const CARD_POOL = Array.isArray(cardPool) ? cardPool : [];
  let currentCardLibraryTab = 'all';

  if (typeof loadDiscoveredCards !== 'function' || typeof playUiSelectSound !== 'function' || typeof isRareCard !== 'function' || typeof getCardRarity !== 'function' || typeof escapeHtml !== 'function') {
   throw new Error('GameCardLibrary dependencies are missing.');
  }

  function getCardLibraryTabs() {
   return [
    { id: 'all', name: 'すべて' },
    { id: 'attack', name: '攻撃' },
    { id: 'defense', name: '防御' },
    { id: 'status', name: '状態異常' },
    { id: 'support', name: '補助' },
    { id: 'rare', name: 'レア' },
   ];
  }

  function changeCardLibraryTab(tabId) {
   playUiSelectSound();

   currentCardLibraryTab = tabId;

   renderCardLibraryScreen();
  }

  function getCardLibraryCategory(card) {
   if (isRareCard(card)) return 'rare';

   if (card.type === 'attack'
    || card.type === 'gamble-attack'
    || card.type === 'double-slash'
    || card.type === 'rare-attack'
    || card.type === 'rare-double-attack'
    || card.type === 'paralyze-bonus-attack'
    || card.type === 'rare-attack-defense'
    || card.type === 'self-damage-attack'
    || card.type === 'chance-attack'
    || card.type === 'high-risk-attack'
    || card.type === 'freeze-bonus-attack'
    || card.type === 'freeze-triple-attack'
    || card.type === 'risky-self-attack'
    || card.type === 'percent-hp-attack'
    || card.type === 'revenge-attack'
    || card.type === 'finisher-attack'
    || card.type === 'burn-bonus-attack'
    || card.type === 'pierce-attack'
    || card.type === 'attack-defense') {
    return 'attack';
   }

   if (card.type === 'defense'
    || card.type === 'rare-defense'
    || card.type === 'reflect-next-attack'
    || card.type === 'endure-next-attack'
    || card.type === 'chance-defense') {
    return 'defense';
   }

   if (card.type === 'dein'
    || card.type === 'pure-paralysis'
    || card.type === 'freeze'
    || card.type === 'poison'
    || card.type === 'burn'
    || card.type === 'pure-burn'
    || card.type === 'attack-down'
    || card.type === 'defense-down'
    || card.type === 'strip-defense'
    || card.type === 'mutual-freeze'
    || card.type === 'enemy-action-delay-turns'
    || card.type === 'enemy-action-shift-delay') {
    return 'status';
   }

   return 'support';
  }

  function getCardLibraryRarity(card) {
   return getCardRarity(card);
  }

  function getCardLibraryRarityMeta(rarity) {
   const map = {
    normal: { title: 'ノーマル', icon: '⚪', subtitle: '基本的なカード', className: 'normal' },
    rare: { title: 'レア', icon: '🔷', subtitle: '強力・特殊なカード', className: 'rare' },
    epic: { title: 'エピック', icon: '🟣', subtitle: 'ビルドの軸になりやすい希少カード', className: 'epic' },
    legendary: { title: 'レジェンダリー', icon: '🌟', subtitle: 'ゲームの流れを変える最高レアカード', className: 'legendary' },
   };
   return map[rarity] || map.normal;
  }

  function renderCardLibraryScreen() {
   const tabs = document.getElementById('card-library-tabs');
   const list = document.getElementById('card-library-list');

   if (!list) return;
   if (tabs) tabs.remove();

   const discoveredCards = loadDiscoveredCards();
   const discoveredCount = CARD_POOL.filter(card => discoveredCards[card.name]).length;
   const rarityOrder = ['normal', 'rare', 'epic', 'legendary'];

   list.innerHTML = `
    <div class="enemy-library-summary card-library-summary">発見済み：${discoveredCount} / ${CARD_POOL.length}</div>
   `;

   rarityOrder.forEach(rarity => {
    const cards = CARD_POOL.filter(card => getCardLibraryRarity(card) === rarity);
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
      ? `library-card ${getCardVisualClass(card)} ${card.type || ''} ${card.type ? `${card.type}-card` : ''}${getCardRarityClass(card)}`
      : 'library-card undiscovered-card';

     if (discovered) {
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
       <div class="library-card-note">${isRareCard(card) ? 'ショップ限定' : '山札カスタマイズ可'}</div>
      `;
     } else {
      div.innerHTML = `
       <div class="card-library-unknown-mark">?</div>
       <div class="card-top">
        <div>未発見のカード</div>
        <div class="card-icon">?</div>
       </div>
       <div class="value">?</div>
       <div class="card-text">戦闘・ショップなどで見つけると情報が記録されます。</div>
       <div class="library-card-note">未発見</div>
      `;
     }

     grid.appendChild(div);
    });

    list.appendChild(section);
   });
  }

  return {
   getCardLibraryTabs,
   changeCardLibraryTab,
   getCardLibraryCategory,
   getCardLibraryRarity,
   getCardLibraryRarityMeta,
   renderCardLibraryScreen,
  };
 }

 window.GameCardLibrary = {
  createCardLibrary,
 };
}());
