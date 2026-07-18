(function () {
 if (typeof window === 'undefined') return;

 function createEnemyLibrary(deps) {
  const {
   getEnemyCatalog,
   loadEncounteredEnemies,
   getEnemyBattleResultCounts,
  } = deps || {};
  let currentEnemyLibraryDepthFilter = 'all';
  let currentEnemyLibrarySearchText = '';

  if (typeof getEnemyCatalog !== 'function' || typeof loadEncounteredEnemies !== 'function' || typeof getEnemyBattleResultCounts !== 'function') {
   throw new Error('GameEnemyLibrary dependencies are missing.');
  }

  function escapeHtml(value) {
   return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
   }[char]));
  }

  function getEnemyLibraryDepthKeys(encounter) {
   const depths = encounter && typeof encounter.depths === 'object' ? encounter.depths : null;
   return depths
    ? Object.keys(depths).map(depth => Math.floor(Number(depth))).filter(depth => depth >= 1).sort((a, b) => a - b)
    : [];
  }

  function getEnemyLibraryDepthText(encounter) {
   const keys = getEnemyLibraryDepthKeys(encounter);
   if (!keys.length) return '深度1';
   return keys.map(depth => `深度${depth}`).join(' / ');
  }

  function getEnemyLibraryPassives(enemy, encounter) {
   const passives = Array.isArray(enemy?.passives) ? [...enemy.passives] : [];

   if (enemy?.id !== 'void_knight') return passives;

   const maxPhaseSeen = Math.max(1, Number(encounter?.maxPhaseSeen || (encounter?.phase2Seen ? 2 : 1) || 1));

   return passives.filter(passive => {
    if (passive === '第2形態復活' || passive === '第二形態復活') {
     return maxPhaseSeen >= 2;
    }

    return true;
   });
  }

  function getEnemyLibraryPhaseImages(enemy, encounter) {
   if (!enemy || !encounter || !Array.isArray(enemy.phaseImages)) return [];

   const maxPhaseSeen = Math.max(1, Number(encounter.maxPhaseSeen || (encounter.phase2Seen ? 2 : 1) || 1));

   return enemy.phaseImages.slice(0, Math.min(maxPhaseSeen, enemy.phaseImages.length));
  }

  const ENEMY_LIBRARY_ORDER = [
   'slime',
   'goblin',
   'bat',
   'wolf',
   'orc',
   'shaman',
   'mage',
   'rune_guardian',
   'storm_adept',
   'undead_knight',
   'powder_raider',
   'frozen_wraith',
   'abyss_poisoner',
   'ice_golem',
   'crystal_serpent',
   'stone_titan',
   'frost_worm',
   'bomb_eater',
   'blood_hound',
   'lich_skull',
   'shadow_knight',
   'abyss_reaper',
   'obsidian_warden',
   'death_reaper',
   'frost_dragon',
   'abyss_beast',
   'void_knight',
   'obsidian_overlord',
   'abyss_beast_king',
  ];

  function compareEnemyLibraryOrder(a, b) {
   const aIndex = ENEMY_LIBRARY_ORDER.indexOf(a?.id);
   const bIndex = ENEMY_LIBRARY_ORDER.indexOf(b?.id);
   const normalizedA = aIndex >= 0 ? aIndex : ENEMY_LIBRARY_ORDER.length;
   const normalizedB = bIndex >= 0 ? bIndex : ENEMY_LIBRARY_ORDER.length;

   if (normalizedA !== normalizedB) return normalizedA - normalizedB;

   return String(a?.id || '').localeCompare(String(b?.id || ''));
  }

  function getEnemyLibraryImageSrc(enemy, image) {
   if (enemy?.id === 'obsidian_overlord') return 'assets/enemies/obsidian_overlord.png';
   if (enemy?.id === 'abyss_beast_king') return 'assets/enemies/abyss_beast_king.png';
   return image?.src || enemy?.image || '';
  }

  function getEnemyLibraryDetailHtml(enemy, encounter) {
   const discovered = Boolean(encounter);
   const visiblePhaseImages = getEnemyLibraryPhaseImages(enemy, encounter);
   const libraryPassives = getEnemyLibraryPassives(enemy, encounter);
   const enemyBattleResultCounts = getEnemyBattleResultCounts(encounter);
   const discoveredImage = visiblePhaseImages[0] || { src: enemy.image, label: '' };
   const discoveredImageSrc = getEnemyLibraryImageSrc(enemy, discoveredImage);
   const imageHtml = discovered
    ? `<img src="${discoveredImageSrc}" alt="${escapeHtml(enemy.name)}" class="enemy-library-detail-image" onerror="this.style.display='none';">`
    : '<div class="enemy-library-detail-unknown">?</div>';
   const phaseGalleryHtml = discovered && visiblePhaseImages.length > 1
    ? `<div class="enemy-library-detail-phase-gallery">
      ${visiblePhaseImages.map(phase => `
       <div class="enemy-library-detail-phase">
        <div class="enemy-library-detail-phase-image-wrap">
         <img src="${getEnemyLibraryImageSrc(enemy, phase)}" alt="${escapeHtml(enemy.name)} ${escapeHtml(phase.label || '')}" class="enemy-library-detail-phase-image" onerror="this.style.display='none';">
        </div>
        <div class="enemy-library-detail-phase-label">${escapeHtml(phase.label || '')}</div>
       </div>
      `).join('')}
     </div>`
    : '';

   if (!discovered) {
    return `
     <div class="enemy-library-detail-main undiscovered">
      <div class="enemy-library-detail-visual">${imageHtml}</div>
      <div class="enemy-library-detail-body">
       <div class="enemy-library-detail-kicker">未遭遇</div>
       <h2>未遭遇の敵</h2>
       <p>戦闘で遭遇すると情報が記録されます。</p>
      </div>
     </div>
    `;
   }

   return `
    <div class="enemy-library-detail-main">
     <div class="enemy-library-detail-visual">${imageHtml}</div>
     <div class="enemy-library-detail-body">
      <div class="enemy-library-detail-kicker">${escapeHtml(enemy.levelText || '')}</div>
      <h2>${escapeHtml(enemy.name)}</h2>
      <p>${escapeHtml(enemy.description || '')}</p>
      <div class="enemy-library-detail-meta">
       <span>初遭遇 Lv${escapeHtml(encounter.firstLevel || '?')}</span>
       <span>${escapeHtml(getEnemyLibraryDepthText(encounter))}</span>
       <span>遭遇 ${escapeHtml(encounter.count || 0)}回</span>
       <span>撃破 ${escapeHtml(enemyBattleResultCounts.defeatedCount || 0)}回</span>
       <span>敗北 ${escapeHtml(enemyBattleResultCounts.defeatedByCount || 0)}回</span>
      </div>
      ${libraryPassives.length > 0
       ? `<div class="enemy-library-detail-section">
        <div class="enemy-library-detail-section-title">パッシブ</div>
        <div class="enemy-library-tags">${libraryPassives.map(passive => `<span>${escapeHtml(passive)}</span>`).join('')}</div>
       </div>`
       : ''}
      <div class="enemy-library-detail-section">
       <div class="enemy-library-detail-section-title">技</div>
       <div class="enemy-library-tags">${(enemy.skills || []).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div>
      </div>
     </div>
    </div>
    ${phaseGalleryHtml}
   `;
  }

  function openEnemyLibraryDetailModal(enemyId) {
   const modal = document.getElementById('enemy-library-detail-modal');
   const content = document.getElementById('enemy-library-detail-content');
   const enemy = getEnemyCatalog().find(item => item.id === enemyId);

   if (!modal || !content || !enemy) return;

   const encounter = loadEncounteredEnemies()[enemy.id];
   content.innerHTML = getEnemyLibraryDetailHtml(enemy, encounter);
   modal.style.display = 'flex';
  }

  function closeEnemyLibraryDetailModal(event) {
   if (event && event.target && event.currentTarget && event.target !== event.currentTarget) return;

   const modal = document.getElementById('enemy-library-detail-modal');
   if (modal) modal.style.display = 'none';
  }

  function renderFilterOptions(options, selected) {
   return options.map(option => `<option value="${escapeHtml(option.id)}"${option.id === selected ? ' selected' : ''}>${escapeHtml(option.name)}</option>`).join('');
  }

  function updateEnemyLibraryFilter(type, value) {
   if (type === 'depth') currentEnemyLibraryDepthFilter = value || 'all';
   if (type === 'search') currentEnemyLibrarySearchText = value || '';
   renderEnemyLibraryScreen();
  }

  function renderEnemyLibraryScreen() {
   const list = document.getElementById('enemy-library-list');

   if (!list) return;

   const encounters = loadEncounteredEnemies();
   const enemies = getEnemyCatalog().slice().sort(compareEnemyLibraryOrder);
   const encounterCount = enemies.filter(enemy => encounters[enemy.id]).length;
   const searchText = String(currentEnemyLibrarySearchText || '').trim().toLocaleLowerCase('ja');
   const depthOptions = [
    { id: 'all', name: 'すべて' },
    { id: '1', name: '深度1' },
    { id: '2', name: '深度2' },
    { id: '3', name: '深度3' },
   ];
   const visibleEnemies = enemies.filter(enemy => {
    const encounter = encounters[enemy.id];
    const discovered = Boolean(encounter);
    if (currentEnemyLibraryDepthFilter !== 'all') {
     const depth = Math.floor(Number(currentEnemyLibraryDepthFilter));
     const depthKeys = getEnemyLibraryDepthKeys(encounter);
     const normalizedDepthKeys = depthKeys.length ? depthKeys : [1];
     if (!discovered || !normalizedDepthKeys.includes(depth)) return false;
    }
    if (searchText) {
     if (!discovered) return false;
     return String(enemy.name || '').toLocaleLowerCase('ja').includes(searchText);
    }
    return true;
   });

   list.innerHTML = `
    <div class="enemy-library-summary">遭遇済み：${encounterCount} / ${enemies.length}</div>
    <div class="library-filter-panel enemy-library-filter-panel">
     <label>
      <span>深度</span>
      <select id="enemy-library-depth-filter">${renderFilterOptions(depthOptions, currentEnemyLibraryDepthFilter)}</select>
     </label>
     <label class="library-search-label">
      <span>敵名検索</span>
      <input id="enemy-library-name-search" type="search" value="${escapeHtml(currentEnemyLibrarySearchText)}" placeholder="敵名を入力">
     </label>
     <div class="library-filter-result">表示中：${visibleEnemies.length}体</div>
    </div>
   `;

   const depthSelect = document.getElementById('enemy-library-depth-filter');
   const searchInput = document.getElementById('enemy-library-name-search');
   if (depthSelect) depthSelect.onchange = event => updateEnemyLibraryFilter('depth', event.target.value);
   if (searchInput) {
    searchInput.oninput = event => updateEnemyLibraryFilter('search', event.target.value);
    if (currentEnemyLibrarySearchText) {
     searchInput.focus();
     const caret = String(currentEnemyLibrarySearchText).length;
     searchInput.setSelectionRange(caret, caret);
    }
   }

   visibleEnemies.forEach(enemy => {
    const encounter = encounters[enemy.id];
    const discovered = Boolean(encounter);
    const div = document.createElement('div');

    div.className = `enemy-library-card${discovered ? '' : ' undiscovered'}`;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.onclick = () => openEnemyLibraryDetailModal(enemy.id);
    div.onkeydown = event => {
     if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openEnemyLibraryDetailModal(enemy.id);
     }
    };

    const visiblePhaseImages = getEnemyLibraryPhaseImages(enemy, encounter);
    const libraryPassives = getEnemyLibraryPassives(enemy, encounter);
    const enemyBattleResultCounts = getEnemyBattleResultCounts(encounter);
    const hasPhaseSwitch = discovered && visiblePhaseImages.length > 1;
    const discoveredImage = visiblePhaseImages[0] || { src: enemy.image, label: '' };
    const discoveredImageSrc = getEnemyLibraryImageSrc(enemy, discoveredImage);
    const enemyImageHtml = discovered
     ? `<img src="${discoveredImageSrc}" alt="${enemy.name}${discoveredImage.label ? ` ${discoveredImage.label}` : ''}" class="enemy-library-image${hasPhaseSwitch ? ' enemy-library-phase-active-image' : ''}"${hasPhaseSwitch ? ` data-phase-image="${enemy.id}"` : ''} onerror="this.style.display='none';">`
     : '<div class="enemy-library-unknown">?</div>';

    const phaseButtonsHtml = hasPhaseSwitch
     ? `<div class="enemy-library-phase-buttons" data-enemy-id="${enemy.id}">
       ${visiblePhaseImages.map((phase, index) => `
        <button type="button" class="enemy-library-phase-button${index === 0 ? ' active' : ''}" data-phase-button="${enemy.id}" onclick="event.stopPropagation(); switchEnemyLibraryPhase('${enemy.id}', ${index})">${phase.label}</button>
       `).join('')}
      </div>`
     : '';

    div.innerHTML = `
     <div class="enemy-library-visual">
      <div class="enemy-library-image-wrap">
       ${enemyImageHtml}
      </div>
      ${phaseButtonsHtml}
     </div>
     <div class="enemy-library-content">
      <div class="enemy-library-title-row">
       <div class="enemy-library-name">${discovered ? escapeHtml(enemy.name) : '未遭遇の敵'}</div>
       <div class="enemy-library-level">${discovered ? escapeHtml(enemy.levelText) : '???'}</div>
      </div>
      <div class="enemy-library-description">${discovered ? escapeHtml(enemy.description) : '戦闘で遭遇すると情報が記録されます。'}</div>
      ${discovered ? `
       <div class="enemy-library-meta">初遭遇 Lv${escapeHtml(encounter.firstLevel)} / ${escapeHtml(getEnemyLibraryDepthText(encounter))} / 遭遇 ${escapeHtml(encounter.count)}回 / 撃破 ${escapeHtml(enemyBattleResultCounts.defeatedCount)}回 / 敗北 ${escapeHtml(enemyBattleResultCounts.defeatedByCount)}回</div>
       ${libraryPassives.length > 0 ? `<div class="enemy-library-passive-row">${libraryPassives.map(passive => `<span>${escapeHtml(passive)}</span>`).join('')}</div>` : ''}
       <div class="enemy-library-status">詳細を見る</div>
      ` : ''}
     </div>
    `;

    list.appendChild(div);
   });

   if (visibleEnemies.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'library-empty-message';
    empty.textContent = '条件に一致する敵はありません。';
    list.appendChild(empty);
   }
  }

  function switchEnemyLibraryPhase(enemyId, phaseIndex) {
   const enemy = getEnemyCatalog().find(item => item.id === enemyId);
   const encounter = loadEncounteredEnemies()[enemyId];
   const visiblePhaseImages = getEnemyLibraryPhaseImages(enemy, encounter);

   if (!enemy || !visiblePhaseImages[phaseIndex]) return;

   const image = document.querySelector(`[data-phase-image="${enemyId}"]`);
   if (image) {
    image.src = visiblePhaseImages[phaseIndex].src;
    image.alt = `${enemy.name} ${visiblePhaseImages[phaseIndex].label}`;
    image.style.display = '';
   }

   document.querySelectorAll(`[data-phase-button="${enemyId}"]`).forEach((button, index) => {
    button.classList.toggle('active', index === phaseIndex);
   });
  }

  return {
   getEnemyLibraryPassives,
   getEnemyLibraryPhaseImages,
   openEnemyLibraryDetailModal,
   closeEnemyLibraryDetailModal,
   renderEnemyLibraryScreen,
   switchEnemyLibraryPhase,
  };
 }

 window.GameEnemyLibrary = {
  createEnemyLibrary,
 };
}());
