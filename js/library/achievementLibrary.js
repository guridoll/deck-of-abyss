(function () {
 if (typeof window === 'undefined') return;

 function createAchievementLibrary(deps) {
  const {
   loadAchievements,
   loadAchievementStats,
   getAchievementDefinitions,
   getAchievementProgress,
   getAchievementTarget,
   formatSaveDate,
   escapeHtml,
  } = deps || {};

  if (typeof loadAchievements !== 'function' || typeof loadAchievementStats !== 'function' || typeof getAchievementDefinitions !== 'function' || typeof getAchievementProgress !== 'function' || typeof getAchievementTarget !== 'function' || typeof formatSaveDate !== 'function' || typeof escapeHtml !== 'function') {
   throw new Error('GameAchievementLibrary dependencies are missing.');
  }

  function getAchievementTierMeta(tier) {
   const map = {
    '初級': { icon: '🌱', subtitle: '序盤で自然に解除できる基本実績', className: 'beginner' },
    '中級': { icon: '🔥', subtitle: 'プレイを重ねると狙える実績', className: 'intermediate' },
    '上級': { icon: '⚔️', subtitle: 'ビルドや立ち回りが求められる実績', className: 'advanced' },
    '廃人向け': { icon: '🏁', subtitle: '長期プレイ向けの高難度実績', className: 'master' },
    '隠し': { icon: '❓', subtitle: '条件非表示の特殊実績', className: 'secret' },
   };
   return map[tier] || { icon: '🏆', subtitle: '実績カテゴリ', className: 'default' };
  }

  function renderAchievementLibraryScreen() {
   const list = document.getElementById('achievement-library-list');
   if (!list) return;

   const achievements = loadAchievements();
   const stats = loadAchievementStats();
   const definitions = getAchievementDefinitions();
   const unlockedCount = definitions.filter(definition => achievements[definition.id]).length;
   const percentAll = definitions.length ? Math.floor((unlockedCount / definitions.length) * 100) : 0;

   list.innerHTML = `
    <div class="achievement-summary-panel">
     <div class="achievement-summary-title">実績進捗</div>
     <div class="achievement-summary-metrics">
      <div><span>解除済み</span><strong>${unlockedCount} / ${definitions.length}</strong></div>
      <div><span>達成率</span><strong>${percentAll}%</strong></div>
      <div><span>累計勝利</span><strong>${stats.totalWins}</strong></div>
      <div><span>最高到達</span><strong>Lv.${stats.highestLevel}</strong></div>
      <div><span>使用カード</span><strong>${stats.totalCardsUsed}枚</strong></div>
     </div>
    </div>
   `;

   const tierOrder = ['初級', '中級', '上級', '廃人向け', '隠し'];
   const grouped = definitions.reduce((acc, definition) => {
    const tier = definition.tier || 'その他';
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(definition);
    return acc;
   }, {});

   tierOrder.concat(Object.keys(grouped).filter(tier => !tierOrder.includes(tier))).forEach(tier => {
    const tierDefinitions = grouped[tier];
    if (!tierDefinitions || !tierDefinitions.length) return;

    const meta = getAchievementTierMeta(tier);
    const tierUnlocked = tierDefinitions.filter(definition => achievements[definition.id]).length;
    const tierPercent = Math.floor((tierUnlocked / tierDefinitions.length) * 100);
    const section = document.createElement('section');
    section.className = `achievement-tier-section achievement-tier-${meta.className}`;
    section.innerHTML = `
     <div class="achievement-tier-heading">
      <div class="achievement-tier-title-wrap">
       <span class="achievement-tier-icon">${meta.icon}</span>
       <div>
        <div class="achievement-tier-title">${escapeHtml(tier)}</div>
        <div class="achievement-tier-subtitle">${escapeHtml(meta.subtitle)}</div>
       </div>
      </div>
      <div class="achievement-tier-count">
       <strong>${tierUnlocked} / ${tierDefinitions.length}</strong>
       <span>${tierPercent}%</span>
      </div>
     </div>
     <div class="achievement-tier-progress"><div style="width:${tierPercent}%"></div></div>
     <div class="achievement-tier-card-grid"></div>
    `;

    const grid = section.querySelector('.achievement-tier-card-grid');
    tierDefinitions.forEach(definition => {
     const unlocked = Boolean(achievements[definition.id]);
     const hidden = Boolean(definition.hidden && !unlocked);
     const progress = getAchievementProgress(definition, stats);
     const target = getAchievementTarget(definition);
     const percent = Math.max(0, Math.min(100, Math.floor((progress / target) * 100)));
     const unlockedAt = achievements[definition.id]?.unlockedAt
      ? formatSaveDate(achievements[definition.id].unlockedAt)
      : '';

     const card = document.createElement('div');
     card.className = `achievement-card${unlocked ? ' unlocked' : ' locked'}${hidden ? ' secret-locked' : ''}`;
     card.innerHTML = `
      <div class="achievement-card-icon">${hidden ? '???' : (unlocked ? definition.icon : '?')}</div>
      <div class="achievement-card-body">
       <div class="achievement-card-header">
        <div>
         <div class="achievement-card-title">${hidden ? '？？？' : escapeHtml(definition.name)}</div>
         <div class="achievement-card-text">${hidden ? '条件非表示の隠し実績です。' : escapeHtml(definition.description)}</div>
        </div>
        <div class="achievement-state-badge ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? '解除済み' : '未解除'}</div>
       </div>
       <div class="achievement-progress-row">
        <span>${hidden ? '進行状況：？？？' : (definition.progressText ? definition.progressText(progress) : `${progress} / ${target}`)}</span>
        ${unlockedAt ? `<em>${unlockedAt}</em>` : ''}
       </div>
       <div class="achievement-progress-bar"><div style="width:${hidden ? 0 : percent}%"></div></div>
      </div>
     `;

     grid.appendChild(card);
    });

    list.appendChild(section);
   });
  }

  return {
   getAchievementTierMeta,
   renderAchievementLibraryScreen,
  };
 }

 window.GameAchievementLibrary = {
  createAchievementLibrary,
 };
}());
