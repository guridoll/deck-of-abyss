(function () {
 if (typeof window === 'undefined') return;

 function createPassiveLibrary(deps) {
  const {
   getNormalPassiveOptions,
   getRarePassiveOptions,
   loadDiscoveredPassives,
   escapeHtml,
  } = deps || {};
  let currentPassiveLibraryRarityFilter = 'all';
  let currentPassiveLibrarySearchText = '';

  if (typeof getNormalPassiveOptions !== 'function' || typeof getRarePassiveOptions !== 'function' || typeof loadDiscoveredPassives !== 'function' || typeof escapeHtml !== 'function') {
   throw new Error('GamePassiveLibrary dependencies are missing.');
  }

  function getPassiveLibraryRarityMeta(rarity) {
   const map = {
    normal: {
     title: 'ノーマル',
     icon: 'N',
     subtitle: '基本効果を持つパッシブ',
     className: 'normal',
    },
    rare: {
     title: 'レア',
     icon: 'R',
     subtitle: '強力な効果を持つパッシブ',
     className: 'rare',
    },
   };
   return map[rarity] || map.normal;
  }

  function getPassiveLibraryRarityFilters() {
   return [
    { id: 'all', name: 'すべて' },
    { id: 'normal', name: 'ノーマル' },
    { id: 'rare', name: 'レア' },
   ];
  }

  function getAllPassiveLibraryDefinitions() {
   const normalList = typeof getNormalPassiveOptions === 'function'
    ? getNormalPassiveOptions().map(passive => ({ ...passive, rarity: passive.rarity || 'normal' }))
    : [];

   const rareList = typeof getRarePassiveOptions === 'function'
    ? getRarePassiveOptions().map(passive => ({ ...passive, rarity: passive.rarity || 'rare' }))
    : [];

   const merged = [...normalList, ...rareList];
   const seen = new Set();

   return merged.filter(passive => {
    if (!passive || !passive.id || seen.has(passive.id)) return false;
    seen.add(passive.id);
    return true;
   });
  }

  function updatePassiveLibraryFilter(type, value) {
   if (type === 'rarity') currentPassiveLibraryRarityFilter = value || 'all';
   if (type === 'search') currentPassiveLibrarySearchText = value || '';
   renderPassiveLibraryScreen();
  }

  function getPassiveLibraryDetailHtml(passiveId) {
   const discoveries = loadDiscoveredPassives();
   const definitions = getAllPassiveLibraryDefinitions();
   const passive = definitions.find(item => item.id === passiveId);

   if (!passive) return '';

   const rarity = passive.rarity || 'normal';
   const meta = getPassiveLibraryRarityMeta(rarity);
   const record = discoveries[passive.id] || {};
   const discovered = (record.seenCount || record.count || 0) > 0;
   const passiveSelectedCount = record.selectedCount || 0;
   const seenCount = record.seenCount || record.count || 0;
   const icon = passive.icon || (rarity === 'rare' ? 'R' : 'N');

   if (!discovered) {
    return `
     <div class="passive-library-detail-main undiscovered">
      <div class="passive-library-detail-icon unknown">?</div>
      <div class="passive-library-detail-body">
       <div class="passive-library-detail-kicker">${escapeHtml(meta.title)}</div>
       <h2>未発見パッシブ</h2>
       <p>候補に出現すると情報が記録されます。</p>
      </div>
     </div>
    `;
   }

   return `
    <div class="passive-library-detail-main">
     <div class="passive-library-detail-icon">${escapeHtml(icon)}</div>
     <div class="passive-library-detail-body">
      <div class="passive-library-detail-kicker">${escapeHtml(meta.title)}</div>
      <h2>${escapeHtml(passive.name)}</h2>
      <p>${escapeHtml(passive.text || passive.description || '')}</p>
      <div class="passive-library-detail-stats">
       <span><strong>${passiveSelectedCount}</strong><small>選択回数</small></span>
       <span><strong>${seenCount}</strong><small>候補出現</small></span>
      </div>
     </div>
    </div>
   `;
  }

  function openPassiveLibraryDetailModal(passiveId) {
   const modal = document.getElementById('passive-library-detail-modal');
   const content = document.getElementById('passive-library-detail-content');

   if (!modal || !content) return;

   content.innerHTML = getPassiveLibraryDetailHtml(passiveId);
   modal.style.display = 'flex';
  }

  function closePassiveLibraryDetailModal(event) {
   if (event && event.target && event.currentTarget && event.target !== event.currentTarget) return;

   const modal = document.getElementById('passive-library-detail-modal');
   if (modal) modal.style.display = 'none';
  }

  function renderFilterOptions(options, selected) {
   return options.map(option => `<option value="${escapeHtml(option.id)}"${option.id === selected ? ' selected' : ''}>${escapeHtml(option.name)}</option>`).join('');
  }

  function renderPassiveLibraryScreen() {
   const list = document.getElementById('passive-library-list');
   if (!list) return;

   const discoveries = loadDiscoveredPassives();
   const definitions = getAllPassiveLibraryDefinitions();
   const discoveredCount = definitions.filter(passive => (discoveries[passive.id]?.seenCount || discoveries[passive.id]?.count || 0) > 0).length;
   const selectedCount = definitions.reduce((sum, passive) => sum + (discoveries[passive.id]?.selectedCount || 0), 0);
   const totalSeenCount = definitions.reduce((sum, passive) => sum + (discoveries[passive.id]?.seenCount || discoveries[passive.id]?.count || 0), 0);
   const searchText = String(currentPassiveLibrarySearchText || '').trim().toLocaleLowerCase('ja');
   const visibleDefinitions = definitions.filter(passive => {
    const discovered = (discoveries[passive.id]?.seenCount || discoveries[passive.id]?.count || 0) > 0;
    if (currentPassiveLibraryRarityFilter !== 'all' && (passive.rarity || 'normal') !== currentPassiveLibraryRarityFilter) return false;
    if (searchText) {
     if (!discovered) return false;
     return String(passive.name || '').toLocaleLowerCase('ja').includes(searchText);
    }
    return true;
   });

   list.innerHTML = `
    <div class="passive-library-summary-panel">
     <div class="passive-library-summary-title">パッシブ収集状況</div>
     <div class="passive-library-summary-metrics">
      <div><strong>${discoveredCount}</strong><span>/ ${definitions.length}</span><em>発見</em></div>
      <div><strong>${selectedCount}</strong><span>回</span><em>選択</em></div>
      <div><strong>${totalSeenCount}</strong><span>回</span><em>候補出現</em></div>
     </div>
     <div class="passive-library-summary-note">候補に出現すると発見済みになり、選ぶと選択回数が記録されます。</div>
    </div>
    <div class="library-filter-panel passive-library-filter-panel">
     <label>
      <span>レアリティ</span>
      <select id="passive-library-rarity-filter">${renderFilterOptions(getPassiveLibraryRarityFilters(), currentPassiveLibraryRarityFilter)}</select>
     </label>
     <label class="library-search-label">
      <span>パッシブ名検索</span>
      <input id="passive-library-name-search" type="search" value="${escapeHtml(currentPassiveLibrarySearchText)}" placeholder="パッシブ名を入力">
     </label>
     <div class="library-filter-result">表示中：${visibleDefinitions.length}件</div>
    </div>
   `;

   const raritySelect = document.getElementById('passive-library-rarity-filter');
   const searchInput = document.getElementById('passive-library-name-search');
   if (raritySelect) raritySelect.onchange = event => updatePassiveLibraryFilter('rarity', event.target.value);
   if (searchInput) {
    searchInput.oninput = event => updatePassiveLibraryFilter('search', event.target.value);
    if (currentPassiveLibrarySearchText) {
     searchInput.focus();
     const caret = String(currentPassiveLibrarySearchText).length;
     searchInput.setSelectionRange(caret, caret);
    }
   }

   const rarityOrder = ['normal', 'rare'];

   rarityOrder.forEach(rarity => {
    const meta = getPassiveLibraryRarityMeta(rarity);
    const items = visibleDefinitions.filter(passive => (passive.rarity || 'normal') === rarity);
    if (!items.length) return;

    const discoveredInRarity = items.filter(passive => (discoveries[passive.id]?.seenCount || discoveries[passive.id]?.count || 0) > 0).length;

    const section = document.createElement('div');
    section.className = `card-rarity-section passive-rarity-section passive-rarity-${meta.className}`;
    section.innerHTML = `
     <div class="achievement-tier-heading card-rarity-heading passive-rarity-heading">
      <div class="achievement-tier-title-wrap">
       <span class="achievement-tier-icon">${escapeHtml(meta.icon)}</span>
       <div>
        <div class="achievement-tier-title">${escapeHtml(meta.title)}</div>
        <div class="achievement-tier-subtitle">${escapeHtml(meta.subtitle)}</div>
       </div>
      </div>
      <div class="achievement-tier-count"><strong>${discoveredInRarity}</strong><span>/ ${items.length}</span></div>
     </div>
     <div class="passive-library-section-grid"></div>
    `;

    const grid = section.querySelector('.passive-library-section-grid');

    items.forEach(passive => {
     const record = discoveries[passive.id] || {};
     const discovered = (record.seenCount || record.count || 0) > 0;
     const passiveSelectedCount = record.selectedCount || 0;
     const seenCount = record.seenCount || record.count || 0;
     const icon = passive.icon || (rarity === 'rare' ? 'R' : 'N');

     const div = document.createElement('div');
     div.className = `passive-library-card${discovered ? '' : ' undiscovered-passive'}${rarity === 'rare' ? ' rare-passive-library-card' : ''}`;
     div.setAttribute('role', 'button');
     div.setAttribute('tabindex', '0');
     div.onclick = () => openPassiveLibraryDetailModal(passive.id);
     div.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') {
       event.preventDefault();
       openPassiveLibraryDetailModal(passive.id);
      }
     };

     div.innerHTML = discovered ? `
      <div class="passive-library-card-header">
       <div class="passive-library-icon">${escapeHtml(icon)}</div>
       <div>
        <div class="passive-library-title-row">
         <div class="passive-library-name">${escapeHtml(passive.name)}</div>
         <span class="passive-library-rarity-badge ${rarity === 'rare' ? 'rare' : 'normal'}">${escapeHtml(meta.title)}</span>
        </div>
        <div class="passive-library-subtitle">発見済みパッシブ</div>
       </div>
      </div>
      <div class="passive-library-text">${escapeHtml(passive.text || passive.description || '')}</div>
      <div class="passive-library-stats">
       <div class="passive-library-stat selected"><span>選択回数</span><strong>${passiveSelectedCount}</strong><em>回</em></div>
       <div class="passive-library-stat"><span>候補出現</span><strong>${seenCount}</strong><em>回</em></div>
      </div>
      <div class="passive-library-detail-button">詳細を見る</div>
     ` : `
      <div class="passive-library-unknown-mark">?</div>
      <div class="passive-library-card-header">
       <div class="passive-library-icon unknown">?</div>
       <div>
        <div class="passive-library-title-row">
         <div class="passive-library-name">未発見パッシブ</div>
         <span class="passive-library-rarity-badge ${rarity === 'rare' ? 'rare' : 'normal'}">${escapeHtml(meta.title)}</span>
        </div>
        <div class="passive-library-subtitle">候補に出現すると発見できます。</div>
       </div>
      </div>
      <div class="passive-library-text">効果は未発見です。</div>
      <div class="passive-library-stats">
       <div class="passive-library-stat"><span>選択回数</span><strong>-</strong><em>回</em></div>
       <div class="passive-library-stat"><span>候補出現</span><strong>-</strong><em>回</em></div>
      </div>
     `;

     grid.appendChild(div);
    });

    list.appendChild(section);
   });

   if (visibleDefinitions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'library-empty-message';
    empty.textContent = '条件に一致するパッシブはありません。';
    list.appendChild(empty);
   }
  }

  return {
   getPassiveLibraryRarityMeta,
   getAllPassiveLibraryDefinitions,
   openPassiveLibraryDetailModal,
   closePassiveLibraryDetailModal,
   renderPassiveLibraryScreen,
  };
 }

 window.GamePassiveLibrary = {
  createPassiveLibrary,
 };
}());
