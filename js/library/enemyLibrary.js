(function () {
 if (typeof window === 'undefined') return;

 function createEnemyLibrary(deps) {
  const {
   getEnemyCatalog,
   loadEncounteredEnemies,
   getEnemyBattleResultCounts,
  } = deps || {};

  if (typeof getEnemyCatalog !== 'function' || typeof loadEncounteredEnemies !== 'function' || typeof getEnemyBattleResultCounts !== 'function') {
   throw new Error('GameEnemyLibrary dependencies are missing.');
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

  function renderEnemyLibraryScreen() {
   const list = document.getElementById('enemy-library-list');

   if (!list) return;

   const encounters = loadEncounteredEnemies();
   const enemies = getEnemyCatalog();
   const encounterCount = enemies.filter(enemy => encounters[enemy.id]).length;

   list.innerHTML = `
    <div class="enemy-library-summary">発見済み：${encounterCount} / ${enemies.length}</div>
   `;

   enemies.forEach(enemy => {
    const encounter = encounters[enemy.id];
    const discovered = Boolean(encounter);
    const div = document.createElement('div');

    div.className = `enemy-library-card${discovered ? '' : ' undiscovered'}`;

    const visiblePhaseImages = getEnemyLibraryPhaseImages(enemy, encounter);
    const libraryPassives = getEnemyLibraryPassives(enemy, encounter);
    const enemyBattleResultCounts = getEnemyBattleResultCounts(encounter);
    const hasPhaseSwitch = discovered && visiblePhaseImages.length > 1;
    const discoveredImage = visiblePhaseImages[0] || { src: enemy.image, label: '' };
    const enemyImageHtml = discovered
     ? `<img src="${discoveredImage.src}" alt="${enemy.name}${discoveredImage.label ? ` ${discoveredImage.label}` : ''}" class="enemy-library-image${hasPhaseSwitch ? ' enemy-library-phase-active-image' : ''}"${hasPhaseSwitch ? ` data-phase-image="${enemy.id}"` : ''} onerror="this.style.display='none';">`
     : '<div class="enemy-library-unknown">?</div>';

    const phaseButtonsHtml = hasPhaseSwitch
     ? `<div class="enemy-library-phase-buttons" data-enemy-id="${enemy.id}">
       ${visiblePhaseImages.map((phase, index) => `
        <button type="button" class="enemy-library-phase-button${index === 0 ? ' active' : ''}" data-phase-button="${enemy.id}" onclick="switchEnemyLibraryPhase('${enemy.id}', ${index})">${phase.label}</button>
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
       <div class="enemy-library-name">${discovered ? enemy.name : '未遭遇の敵'}</div>
       <div class="enemy-library-level">${discovered ? enemy.levelText : '???'}</div>
      </div>
      <div class="enemy-library-description">${discovered ? enemy.description : '戦闘で遭遇すると情報が記録されます。'}</div>
      ${discovered ? `
       <div class="enemy-library-meta">初遭遇：Lv${encounter.firstLevel} / 遭遇回数：${encounter.count} / 倒した回数：${enemyBattleResultCounts.defeatedCount} / やられた回数：${enemyBattleResultCounts.defeatedByCount}</div>
       ${libraryPassives.length > 0
        ? `<div class="enemy-library-section"><div class="enemy-library-section-title">パッシブ</div><div class="enemy-library-tags">${libraryPassives.map(passive => `<span>${passive}</span>`).join('')}</div></div>`
        : ''}
       <div class="enemy-library-section">
        <div class="enemy-library-section-title">技</div>
        <div class="enemy-library-tags">${enemy.skills.map(skill => `<span>${skill}</span>`).join('')}</div>
       </div>
      ` : ''}
     </div>
    `;

    list.appendChild(div);
   });
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
   renderEnemyLibraryScreen,
   switchEnemyLibraryPhase,
  };
 }

 window.GameEnemyLibrary = {
  createEnemyLibrary,
 };
}());
