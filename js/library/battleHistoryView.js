(function () {
 if (typeof window === 'undefined') return;

 function createBattleHistoryView(deps) {
  const {
   loadBattleHistory,
   getPassiveDisplayNameById,
   getDeckSummaryText,
   formatSaveDate,
   formatDuration,
   escapeHtml,
  } = deps || {};

  if (typeof loadBattleHistory !== 'function' || typeof getPassiveDisplayNameById !== 'function' || typeof getDeckSummaryText !== 'function' || typeof formatSaveDate !== 'function' || typeof formatDuration !== 'function' || typeof escapeHtml !== 'function') {
   throw new Error('GameBattleHistoryView dependencies are missing.');
  }

  function getBattleRecordResultLabel(result) {
   if (result === 'win') return 'クリア';
   if (result === 'lose') return '敗北';
   return '挑戦中';
  }

  function getBestBattleRecord(history) {
   if (!history.length) return null;
   return [...history].sort((a, b) => {
    const levelDiff = Number(b.reachedLevel || 0) - Number(a.reachedLevel || 0);
    if (levelDiff !== 0) return levelDiff;
    return Number(b.recordedAt || 0) - Number(a.recordedAt || 0);
   })[0];
  }

  function getDeckEntries(deckSnapshot) {
   return Object.entries(deckSnapshot || {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'ja'));
  }

  function renderDeckChips(deckSnapshot) {
   const entries = getDeckEntries(deckSnapshot);
   if (entries.length === 0) return '<div class="battle-history-empty-small">なし</div>';

   return `
    <div class="battle-history-chip-grid deck">
     ${entries.map(([name, count]) => `
      <div class="battle-history-chip card-chip">
       <span class="battle-history-chip-name">${escapeHtml(name)}</span>
       <strong>×${Number(count)}</strong>
      </div>
     `).join('')}
    </div>
   `;
  }

  function renderPassiveChips(passives) {
   const list = Array.isArray(passives) ? passives : [];
   if (list.length === 0) return '<div class="battle-history-empty-small">なし</div>';

   return `
    <div class="battle-history-chip-grid passive">
     ${list.map(passive => {
      const name = passive && (passive.name || getPassiveDisplayNameById(passive.id));
      return `<div class="battle-history-chip passive-chip">${escapeHtml(name || '不明なパッシブ')}</div>`;
     }).join('')}
    </div>
   `;
  }

  function renderEnemyRoute(enemies) {
   const list = Array.isArray(enemies) ? enemies : [];
   if (list.length === 0) return '<div class="battle-history-empty-small">この履歴には敵情報が保存されていません。</div>';

   return `
    <div class="battle-history-enemy-route">
     ${list.map(enemy => `
      <div class="battle-history-enemy-step">
       <span>Lv.${Number(enemy.level || 1)}</span>
       <strong>${escapeHtml(enemy.name || enemy.id || '不明')}</strong>
      </div>
     `).join('')}
    </div>
   `;
  }

  function closeBattleHistoryDetailModal() {
   const modal = document.getElementById('battle-history-detail-modal');
   if (modal) modal.remove();
   document.removeEventListener('keydown', handleDetailModalKeydown);
  }

  function handleDetailModalKeydown(event) {
   if (event.key === 'Escape') closeBattleHistoryDetailModal();
  }

  function openBattleHistoryDetailModal(item, displayIndex) {
   closeBattleHistoryDetailModal();

   const resultLabel = getBattleRecordResultLabel(item.result);
   const resultClass = item.result === 'win' ? 'win' : item.result === 'lose' ? 'lose' : 'progress';
   const recordedAt = item.recordedAt ? formatSaveDate(item.recordedAt) : '日時なし';
   const deckText = getDeckSummaryText(item.deck, 12);

   const modal = document.createElement('div');
   modal.id = 'battle-history-detail-modal';
   modal.className = 'battle-history-modal-overlay';
   modal.innerHTML = `
    <div class="battle-history-modal" role="dialog" aria-modal="true" aria-label="戦闘履歴詳細">
     <button class="battle-history-modal-close" type="button" aria-label="閉じる">×</button>
     <div class="battle-history-modal-header">
      <div>
       <div class="battle-history-modal-title">#${displayIndex} ${resultLabel} / 深度${Number(item.depth || 3)} / 最高Lv.${Number(item.reachedLevel || 1)}</div>
       <div class="battle-history-date">${escapeHtml(recordedAt)}</div>
      </div>
      <span class="battle-history-result ${resultClass}">${resultLabel}</span>
     </div>
     <div class="battle-history-metrics modal-metrics">
      <div><span>プレイ時間</span><strong>${formatDuration(item.playTimeMs)}</strong></div>
      <div><span>使用カード</span><strong>${Number(item.cardsUsed || 0)}枚</strong></div>
      <div><span>与ダメージ</span><strong>${Number(item.damageDealt || 0)}</strong></div>
      <div><span>被ダメージ</span><strong>${Number(item.damageTaken || 0)}</strong></div>
      <div><span>残りHP</span><strong>${Number(item.remainingHp || 0)}</strong></div>
      <div><span>ペット</span><strong>${escapeHtml(item.petName || 'なし')}</strong></div>
     </div>
     <div class="battle-history-detail-section">
      <div class="battle-history-section-title">山札</div>
      <div class="battle-history-detail-subtext">${escapeHtml(deckText)}</div>
      ${renderDeckChips(item.deck)}
     </div>
     <div class="battle-history-detail-section">
      <div class="battle-history-section-title">パッシブ</div>
      ${renderPassiveChips(item.passives)}
     </div>
     <div class="battle-history-detail-section">
      <div class="battle-history-section-title">戦闘した敵</div>
      ${renderEnemyRoute(item.enemies)}
     </div>
    </div>
   `;

   modal.addEventListener('click', event => {
    if (event.target === modal) closeBattleHistoryDetailModal();
   });
   modal.querySelector('.battle-history-modal-close')?.addEventListener('click', closeBattleHistoryDetailModal);
   document.addEventListener('keydown', handleDetailModalKeydown);
   document.body.appendChild(modal);
  }

  function renderBattleHistoryScreen() {
   const list = document.getElementById('battle-history-list');
   if (!list) return;

   const history = loadBattleHistory();
   const best = getBestBattleRecord(history);
   const clears = history.filter(item => item.result === 'win').length;
   const totalTimeMs = history.reduce((sum, item) => sum + Number(item.playTimeMs || 0), 0);

   if (history.length === 0) {
    list.innerHTML = `
     <div class="battle-history-summary">
      <div class="battle-history-summary-title">プレイ記録</div>
      <div class="battle-history-empty">まだプレイ記録がありません。挑戦を始めると、最高到達Lvや使用デッキがここに記録されます。</div>
     </div>
    `;
    return;
   }

   const bestPassiveText = best.passives && best.passives.length > 0
    ? best.passives.map(passive => passive.name || getPassiveDisplayNameById(passive.id)).join(' / ')
    : 'なし';
   const bestDeckText = getDeckSummaryText(best.deck, 12);
   const bestRecordedAt = best.recordedAt ? formatSaveDate(best.recordedAt) : '日時なし';

   list.innerHTML = `
    <div class="battle-history-summary battle-history-best">
     <div class="battle-history-summary-title">最高到達記録</div>
     <div class="battle-history-summary-metrics">
      <div><span>最高到達Lv</span><strong>Lv.${best.reachedLevel}</strong></div>
      <div><span>結果</span><strong>${getBattleRecordResultLabel(best.result)}</strong></div>
      <div><span>ペット</span><strong>${escapeHtml(best.petName || 'なし')}</strong></div>
      <div><span>プレイ時間</span><strong>${formatDuration(best.playTimeMs)}</strong></div>
      <div><span>記録日時</span><strong>${escapeHtml(bestRecordedAt)}</strong></div>
     </div>
     <div class="battle-history-detail-block">
      <div class="battle-history-detail-label">使用デッキ</div>
      <div class="battle-history-detail-text">${escapeHtml(bestDeckText)}</div>
     </div>
     <div class="battle-history-detail-block">
      <div class="battle-history-detail-label">選択パッシブ</div>
      <div class="battle-history-detail-text">${escapeHtml(bestPassiveText)}</div>
     </div>
    </div>
    <div class="battle-history-summary">
     <div class="battle-history-summary-title">挑戦サマリー</div>
     <div class="battle-history-summary-metrics">
      <div><span>記録数</span><strong>${history.length}回</strong></div>
      <div><span>クリア</span><strong>${clears}回</strong></div>
      <div><span>累計時間</span><strong>${formatDuration(totalTimeMs)}</strong></div>
     </div>
    </div>
   `;

   history.forEach((item, index) => {
    const displayIndex = history.length - index;
    const card = document.createElement('button');
    const resultLabel = getBattleRecordResultLabel(item.result);
    const passiveText = item.passives && item.passives.length > 0
     ? item.passives.map(passive => passive.name || getPassiveDisplayNameById(passive.id)).join(' / ')
     : 'なし';
    const deckText = getDeckSummaryText(item.deck, 6);
    const enemyText = Array.isArray(item.enemies) && item.enemies.length > 0
     ? item.enemies.slice(-3).map(enemy => `Lv.${enemy.level} ${enemy.name}`).join(' / ')
     : '敵情報なし';
    const recordedAt = item.recordedAt ? formatSaveDate(item.recordedAt) : '日時なし';
    const resultClass = item.result === 'win' ? 'win' : item.result === 'lose' ? 'lose' : 'progress';

    card.type = 'button';
    card.className = `battle-history-card ${resultClass}`;
    card.innerHTML = `
     <div class="battle-history-card-header">
      <div>
       <div class="battle-history-title">#${displayIndex} ${resultLabel} / 深度${Number(item.depth || 3)} / 最高Lv.${item.reachedLevel}</div>
       <div class="battle-history-date">${escapeHtml(recordedAt)}</div>
      </div>
      <span class="battle-history-result ${resultClass}">${resultLabel}</span>
     </div>
     <div class="battle-history-metrics">
      <div><span>プレイ時間</span><strong>${formatDuration(item.playTimeMs)}</strong></div>
      <div><span>使用カード</span><strong>${Number(item.cardsUsed || 0)}枚</strong></div>
      <div><span>与ダメージ</span><strong>${Number(item.damageDealt || 0)}</strong></div>
      <div><span>被ダメージ</span><strong>${Number(item.damageTaken || 0)}</strong></div>
      <div><span>ペット</span><strong>${escapeHtml(item.petName || 'なし')}</strong></div>
     </div>
     <div class="battle-history-detail-block">
      <div class="battle-history-detail-label">使用デッキ</div>
      <div class="battle-history-detail-text">${escapeHtml(deckText)}</div>
     </div>
     <div class="battle-history-detail-block">
      <div class="battle-history-detail-label">選択パッシブ</div>
      <div class="battle-history-detail-text">${escapeHtml(passiveText)}</div>
     </div>
     <div class="battle-history-detail-block">
      <div class="battle-history-detail-label">戦闘した敵</div>
      <div class="battle-history-detail-text">${escapeHtml(enemyText)}</div>
     </div>
     <div class="battle-history-open-hint">クリックで山札・パッシブ・敵履歴を詳しく確認</div>
    `;

    card.addEventListener('click', () => openBattleHistoryDetailModal(item, displayIndex));
    list.appendChild(card);
   });
  }

  return {
   getBattleRecordResultLabel,
   getBestBattleRecord,
   renderBattleHistoryScreen,
  };
 }

 window.GameBattleHistoryView = {
  createBattleHistoryView,
 };
}());
