(function () {
 if (typeof window === 'undefined') return;

 function createPassiveLibrary(deps) {
  const {
   getNormalPassiveOptions,
   getRarePassiveOptions,
   loadDiscoveredPassives,
   escapeHtml,
  } = deps || {};

  if (typeof getNormalPassiveOptions !== 'function' || typeof getRarePassiveOptions !== 'function' || typeof loadDiscoveredPassives !== 'function' || typeof escapeHtml !== 'function') {
   throw new Error('GamePassiveLibrary dependencies are missing.');
  }

  function getPassiveLibraryRarityMeta(rarity) {
   const map = {
    normal: {
     title: 'ノーマル',
     icon: '✨',
     subtitle: '安定した強化と基礎ビルドを作るパッシブ',
     className: 'normal',
    },
    rare: {
     title: 'レア',
     icon: '💎',
     subtitle: 'ビルドを大きく変える強力な特殊パッシブ',
     className: 'rare',
    },
    epic: {
     title: 'エピック',
     icon: '✦',
     subtitle: '希少で強力な特殊パッシブ',
     className: 'epic',
    },
   };
   return map[rarity] || map.normal;
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

  function renderPassiveLibraryScreen() {
   const list = document.getElementById('passive-library-list');
   if (!list) return;

   const discoveries = loadDiscoveredPassives();
   const definitions = getAllPassiveLibraryDefinitions();
   const discoveredCount = definitions.filter(passive => (discoveries[passive.id]?.seenCount || discoveries[passive.id]?.count || 0) > 0).length;
   const selectedCount = definitions.reduce((sum, passive) => sum + (discoveries[passive.id]?.selectedCount || 0), 0);
   const totalSeenCount = definitions.reduce((sum, passive) => sum + (discoveries[passive.id]?.seenCount || discoveries[passive.id]?.count || 0), 0);

   list.innerHTML = `
    <div class="passive-library-summary-panel">
     <div class="passive-library-summary-title">パッシブ収集状況</div>
     <div class="passive-library-summary-metrics">
      <div><strong>${discoveredCount}</strong><span>/ ${definitions.length}</span><em>発見</em></div>
      <div><strong>${selectedCount}</strong><span>回</span><em>選択</em></div>
      <div><strong>${totalSeenCount}</strong><span>回</span><em>候補に出現</em></div>
     </div>
     <div class="passive-library-summary-note">パッシブ選択の候補に出ると発見、実際に選ぶと選択回数が増えます。</div>
    </div>
   `;

   const rarityOrder = ['normal', 'rare', 'epic'];

   rarityOrder.forEach(rarity => {
    const meta = getPassiveLibraryRarityMeta(rarity);
    const items = definitions.filter(passive => (passive.rarity || 'normal') === rarity);
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
     const icon = passive.icon || (rarity === 'epic' ? '✦' : rarity === 'rare' ? '💎' : '✨');

     const div = document.createElement('div');
     div.className = `passive-library-card${discovered ? '' : ' undiscovered-passive'}${rarity !== 'normal' ? ' rare-passive-library-card' : ''}`;

     div.innerHTML = discovered ? `
      <div class="passive-library-card-header">
       <div class="passive-library-icon">${escapeHtml(icon)}</div>
       <div>
        <div class="passive-library-title-row">
         <div class="passive-library-name">${escapeHtml(passive.name)}</div>
         <span class="passive-library-rarity-badge ${rarity === 'epic' ? 'epic' : rarity === 'rare' ? 'rare' : 'normal'}">${escapeHtml(meta.title)}</span>
        </div>
        <div class="passive-library-subtitle">発見済みパッシブ</div>
       </div>
      </div>
      <div class="passive-library-text">${escapeHtml(passive.text || passive.description || '')}</div>
      <div class="passive-library-stats">
       <div class="passive-library-stat selected"><span>選択回数</span><strong>${passiveSelectedCount}</strong><em>回</em></div>
       <div class="passive-library-stat"><span>候補に出現</span><strong>${seenCount}</strong><em>回</em></div>
      </div>
     ` : `
      <div class="passive-library-unknown-mark">?</div>
      <div class="passive-library-card-header">
       <div class="passive-library-icon unknown">?</div>
       <div>
        <div class="passive-library-title-row">
         <div class="passive-library-name">未発見パッシブ</div>
         <span class="passive-library-rarity-badge ${rarity === 'epic' ? 'epic' : rarity === 'rare' ? 'rare' : 'normal'}">${escapeHtml(meta.title)}</span>
        </div>
        <div class="passive-library-subtitle">パッシブ選択で発見できます</div>
       </div>
      </div>
      <div class="passive-library-text">効果は未発見です。</div>
      <div class="passive-library-stats">
       <div class="passive-library-stat"><span>選択回数</span><strong>-</strong><em>回</em></div>
       <div class="passive-library-stat"><span>候補に出現</span><strong>-</strong><em>回</em></div>
      </div>
     `;

     grid.appendChild(div);
    });

    list.appendChild(section);
   });
  }

  return {
   getPassiveLibraryRarityMeta,
   getAllPassiveLibraryDefinitions,
   renderPassiveLibraryScreen,
  };
 }

 window.GamePassiveLibrary = {
  createPassiveLibrary,
 };
}());
