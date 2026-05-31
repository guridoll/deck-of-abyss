(function () {
 if (typeof window === 'undefined') return;

 function createSaveSlotsView(deps) {
  const {
   saveSlotCount,
   getCurrentSaveSlot,
   getAllSaveSlotSummaries,
   loadGameDataFromSlot,
   saveCurrentGameDataToSlot,
  } = deps || {};

  if (!Number.isFinite(Number(saveSlotCount)) || typeof getCurrentSaveSlot !== 'function' || typeof getAllSaveSlotSummaries !== 'function' || typeof loadGameDataFromSlot !== 'function' || typeof saveCurrentGameDataToSlot !== 'function') {
   throw new Error('GameSaveSlotsView dependencies are missing.');
  }

  function renderSaveSlotList(mode) {
   const list = document.getElementById(mode === 'load' ? 'load-slot-list' : 'save-slot-list');
   if (!list) return;

   const summaries = getAllSaveSlotSummaries();
   list.style.display = 'grid';
   list.innerHTML = '';

   for (let slot = 1; slot <= saveSlotCount; slot++) {
    const summary = summaries[slot - 1];
    const isEmpty = !summary;
    const isCurrent = mode === 'save' && getCurrentSaveSlot() === slot;
    const card = document.createElement('div');
    card.className = `save-slot-card${isEmpty ? ' empty' : ''}${isCurrent ? ' current' : ''}`;

    const header = document.createElement('div');
    header.className = 'save-slot-header';
    header.innerHTML = `<h3>スロット${slot}</h3>${isCurrent ? '<span class="save-slot-current">現在使用中</span>' : ''}`;
    card.appendChild(header);

    if (isEmpty) {
     const empty = document.createElement('div');
     empty.className = 'save-slot-empty';
     empty.textContent = 'セーブデータなし';
     card.appendChild(empty);
    } else {
     const meta = document.createElement('div');
     meta.className = 'save-slot-meta';
     meta.textContent = `保存日時：${summary.savedAtText}`;
     card.appendChild(meta);

     const player = document.createElement('div');
     player.className = 'save-slot-meta';
     player.textContent = `プレイヤー名：${summary.playerName || '未設定'}`;
     card.appendChild(player);

     const details = document.createElement('div');
     details.className = 'save-slot-details';
     details.innerHTML = `
      <span>深度：${summary.currentDepthLabel || `深度${summary.currentDepth || 1}`}</span>
      <span>敵：${summary.enemyCount}/${summary.enemyTotal}</span>
      <span>カード：${summary.cardCount}/${summary.cardTotal}</span>
      <span>パッシブ：${summary.passiveCount}/${summary.passiveTotal}</span>
      <span>実績：${summary.achievementCount}/${summary.achievementTotal}</span>
      <span>イベント：${summary.eventCount}/${summary.eventTotal}</span>
      <span>最高クリアレベル：${summary.highestClearLevel || 0}</span>
     `;
     card.appendChild(details);
    }

    const button = document.createElement('button');
    button.className = `ui-button ${mode === 'load' ? 'ui-button-primary' : 'ui-button-secondary'}`;
    button.textContent = mode === 'load' ? 'ロード' : (isEmpty ? 'ここにセーブ' : '上書きセーブ');
    button.disabled = mode === 'load' && isEmpty;
    button.addEventListener('click', () => {
     if (mode === 'load') {
      loadGameDataFromSlot(slot);
     } else {
      saveCurrentGameDataToSlot(slot);
     }
    });
    card.appendChild(button);
    list.appendChild(card);
   }
  }

  return {
   renderSaveSlotList,
  };
 }

 window.GameSaveSlotsView = {
  createSaveSlotsView,
 };
}());
