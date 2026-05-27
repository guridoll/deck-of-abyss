(function () {
  if (typeof window === 'undefined') return;

  const PLAYER_NAME_STORAGE_KEY = 'deckOfAbyssRankingPlayerName';
  const RANKING_COLLECTION = 'rankings';

  const firebaseConfig = {
    apiKey: "AIzaSyDy7jqfSmsOCy0I9V4Ms1IhajyPwmcegpM",
    authDomain: "deck-of-abyss.firebaseapp.com",
    projectId: "deck-of-abyss",
    storageBucket: "deck-of-abyss.firebasestorage.app",
    messagingSenderId: "395126350653",
    appId: "1:395126350653:web:db0860b2711ddfbfec5b54"
  };

  let db = null;
  let initialized = false;
  let initError = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function normalizePlayerName(name) {
    const text = String(name || '').trim().replace(/\s+/g, ' ');
    if (!text) return '名無し';
    return text.slice(0, 16);
  }

  function hasSavedPlayerName() {
    try {
      const raw = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
      return Boolean(raw && String(raw).trim());
    } catch (error) {
      return false;
    }
  }

  function getPlayerName() {
    try {
      return normalizePlayerName(localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '名無し');
    } catch (error) {
      return '名無し';
    }
  }

  function setPlayerName(name) {
    const normalized = normalizePlayerName(name);
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('player name save failed', error);
    }
    return normalized;
  }

  function initFirebase() {
    if (initialized || initError) return db;
    try {
      if (!window.firebase || !window.firebase.initializeApp || !window.firebase.firestore) {
        throw new Error('Firebase SDK が読み込まれていません。');
      }

      const apps = typeof window.firebase.apps !== 'undefined' ? window.firebase.apps : [];
      const app = apps.length ? apps[0] : window.firebase.initializeApp(firebaseConfig);
      db = window.firebase.firestore(app);
      initialized = true;
      return db;
    } catch (error) {
      initError = error;
      console.warn('Firebase initialize failed', error);
      return null;
    }
  }

  function getRunDocId(entry) {
    const runStartedAt = Number(entry && entry.runStartedAt || 0);
    const id = entry && entry.id ? String(entry.id) : '';
    const base = id || `run-${runStartedAt || Date.now()}`;
    return base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  function normalizeDeck(deck) {
    if (!deck || typeof deck !== 'object') return {};
    return Object.fromEntries(
      Object.entries(deck)
        .map(([name, count]) => [String(name), Math.max(0, Math.floor(Number(count || 0)))])
        .filter(([, count]) => count > 0)
    );
  }

  function normalizeCardPlayCounts(cardPlayCounts) {
    if (!cardPlayCounts || typeof cardPlayCounts !== 'object') return {};
    return Object.fromEntries(
      Object.entries(cardPlayCounts)
        .map(([name, count]) => [String(name), Math.max(0, Math.floor(Number(count || 0)))])
        .filter(([, count]) => count > 0)
    );
  }

  function normalizePassives(passives) {
    if (!Array.isArray(passives)) return [];
    return passives.slice(0, 80).map((passive) => ({
      id: String(passive && passive.id || ''),
      name: String(passive && passive.name || passive && passive.id || '不明なパッシブ').slice(0, 40),
    }));
  }

  function normalizeEnemies(enemies) {
    if (!Array.isArray(enemies)) return [];
    return enemies.slice(0, 40).map((enemy) => ({
      level: Math.max(1, Math.floor(Number(enemy && enemy.level || 1))),
      id: String(enemy && enemy.id || ''),
      name: String(enemy && enemy.name || enemy && enemy.id || '不明').slice(0, 40),
    }));
  }

  async function submitBattleResult(entry) {
    const firestore = initFirebase();
    if (!firestore || !entry) return { ok: false, reason: initError ? initError.message : 'not_initialized' };

    const reachedLevel = Math.max(1, Math.floor(Number(entry.reachedLevel || entry.level || 1)));
    const recordedAt = Number(entry.recordedAt || Date.now());
    const playerName = getPlayerName();

    const payload = {
      playerName,
      reachedLevel,
      result: ['win', 'lose', 'progress'].includes(entry.result) ? entry.result : 'progress',
      runStartedAt: Number(entry.runStartedAt || recordedAt),
      recordedAt,
      playTimeMs: Math.max(0, Math.floor(Number(entry.playTimeMs || 0))),
      cardsUsed: Math.max(0, Math.floor(Number(entry.cardsUsed || 0))),
      cardPlayCounts: normalizeCardPlayCounts(entry.cardPlayCounts),
      damageDealt: Math.max(0, Math.floor(Number(entry.damageDealt || 0))),
      damageTaken: Math.max(0, Math.floor(Number(entry.damageTaken || 0))),
      remainingHp: Math.max(0, Math.floor(Number(entry.remainingHp || 0))),
      petId: String(entry.petId || 'none'),
      petName: String(entry.petName || 'なし').slice(0, 40),
      deck: normalizeDeck(entry.deck),
      passives: normalizePassives(entry.passives),
      enemies: normalizeEnemies(entry.enemies),
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await firestore.collection(RANKING_COLLECTION).doc(getRunDocId(entry)).set(payload, { merge: true });
      return { ok: true };
    } catch (error) {
      console.warn('ranking submit failed', error);
      return { ok: false, reason: error.message || String(error) };
    }
  }

  function getResultLabel(result) {
    if (result === 'win') return 'クリア';
    if (result === 'lose') return '敗北';
    return '挑戦中';
  }

  function getDeckSummary(deck, limit = 4) {
    const entries = Object.entries(normalizeDeck(deck))
      .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0], 'ja'));
    if (!entries.length) return '山札情報なし';
    const visible = entries.slice(0, limit).map(([name, count]) => `${name}×${count}`);
    const rest = entries.length - visible.length;
    return `${visible.join(' / ')}${rest > 0 ? ` / 他${rest}種` : ''}`;
  }

  function getPassiveSummary(passives, limit = 4) {
    const list = normalizePassives(passives);
    if (!list.length) return 'パッシブなし';
    const visible = list.slice(0, limit).map((passive) => passive.name || passive.id);
    const rest = list.length - visible.length;
    return `${visible.join(' / ')}${rest > 0 ? ` / 他${rest}個` : ''}`;
  }

  function getEncounteredEnemyIds() {
    try {
      const raw = localStorage.getItem('cardBattleEncounteredEnemies');
      const data = raw ? JSON.parse(raw) : {};
      return new Set(Object.keys(data || {}).filter((id) => data[id]));
    } catch (error) {
      return new Set();
    }
  }

  function getKnownEnemyName(enemy) {
    const encountered = getEncounteredEnemyIds();
    const id = String(enemy && enemy.id || '');
    if (!id || !encountered.has(id)) return '???';
    return String(enemy && enemy.name || id || '???');
  }

  function readLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getDiscoveredCardNames() {
    const data = readLocalJson('cardBattleDiscoveredCards', {});
    return new Set(Object.keys(data || {}).filter((name) => data[name]));
  }

  function getDiscoveredPassiveIds() {
    const data = readLocalJson('cardBattleDiscoveredPassives', {});
    return new Set(Object.keys(data || {}).filter((id) => data[id]));
  }

  function getKnownCardName(cardName) {
    const discovered = getDiscoveredCardNames();
    const name = String(cardName || '');
    return name && discovered.has(name) ? name : '???';
  }

  function getKnownPassiveName(passive) {
    const discovered = getDiscoveredPassiveIds();
    const id = String(passive && passive.id || '');
    if (!id || !discovered.has(id)) return '???';
    return String(passive && passive.name || id || '???');
  }

  function aggregatePopularCards(items) {
    const counts = new Map();

    items.forEach((item) => {
      const cardPlayCounts = normalizeCardPlayCounts(item.cardPlayCounts);
      Object.entries(cardPlayCounts).forEach(([cardName, count]) => {
        counts.set(cardName, (counts.get(cardName) || 0) + Number(count || 0));
      });
    });

    return [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 20);
  }

  function aggregateEnemyStats(items) {
    const stats = new Map();

    items.forEach((item) => {
      const enemies = normalizeEnemies(item.enemies);
      enemies.forEach((enemy, index) => {
        const id = String(enemy.id || enemy.name || `unknown-${index}`);
        if (!stats.has(id)) {
          stats.set(id, {
            id,
            name: enemy.name || id,
            level: Number(enemy.level || 1),
            defeated: 0,
            defeatedPlayer: 0,
            total: 0,
          });
        }

        const stat = stats.get(id);
        stat.level = Math.max(Number(stat.level || 1), Number(enemy.level || 1));
        stat.total += 1;

        const isLastEnemy = index === enemies.length - 1;
        if (item.result === 'lose' && isLastEnemy) {
          stat.defeatedPlayer += 1;
        } else {
          stat.defeated += 1;
        }
      });
    });

    return [...stats.values()]
      .sort((a, b) => (b.defeatedPlayer + b.defeated) - (a.defeatedPlayer + a.defeated) || b.level - a.level)
      .slice(0, 30);
  }

  function renderPopularCards(items) {
    const cards = aggregatePopularCards(items);
    if (!cards.length) {
      return '<div class="ranking-empty">まだカード使用データがありません。</div>';
    }

    return cards.map((card, index) => `
      <div class="ranking-stat-row">
        <span class="ranking-stat-rank">${index + 1}</span>
        <strong>${escapeHtml(getKnownCardName(card.name))}</strong>
        <span>${card.count}回プレイ</span>
      </div>
    `).join('');
  }

  function renderEnemyStats(items) {
    const stats = aggregateEnemyStats(items);
    if (!stats.length) {
      return '<div class="ranking-empty">まだ敵戦績データがありません。</div>';
    }

    return stats.map((enemy) => {
      const displayName = getKnownEnemyName(enemy);
      return `
        <div class="ranking-stat-row enemy">
          <strong>${escapeHtml(displayName)}</strong>
          <span>倒された数 ${Number(enemy.defeated || 0)}</span>
          <span>やられた数 ${Number(enemy.defeatedPlayer || 0)}</span>
        </div>
      `;
    }).join('');
  }

  function aggregatePopularPassives(items) {
    const counts = new Map();

    items.forEach((item) => {
      const passives = normalizePassives(item.passives);
      passives.forEach((passive) => {
        const key = passive.id || passive.name;
        if (!key) return;

        const current = counts.get(key) || {
          id: passive.id || '',
          name: passive.name || passive.id || '???',
          count: 0,
        };
        current.count += 1;
        counts.set(key, current);
      });
    });

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), 'ja'))
      .slice(0, 10);
  }

  function renderPopularPassives(items) {
    const passives = aggregatePopularPassives(items);
    if (!passives.length) {
      return '<div class="ranking-empty">まだパッシブ選択データがありません。</div>';
    }

    return passives.map((passive, index) => `
      <div class="ranking-stat-row">
        <span class="ranking-stat-rank">${index + 1}</span>
        <strong>${escapeHtml(getKnownPassiveName(passive))}</strong>
        <span>${Number(passive.count || 0)}回選択</span>
      </div>
    `).join('');
  }

  function renderRankingStats(items) {
    const popularCards = document.getElementById('ranking-popular-cards');
    const popularPassives = document.getElementById('ranking-popular-passives');
    const enemyStats = document.getElementById('ranking-enemy-stats');

    if (popularCards) popularCards.innerHTML = renderPopularCards(items);
    if (popularPassives) popularPassives.innerHTML = renderPopularPassives(items);
    if (enemyStats) enemyStats.innerHTML = renderEnemyStats(items);
  }

  function dedupeBestRuns(docs) {
    const bestByName = new Map();
    docs.forEach((doc) => {
      const data = doc.data ? doc.data() : doc;
      const name = normalizePlayerName(data.playerName);
      const current = bestByName.get(name);
      if (
        !current ||
        Number(data.reachedLevel || 0) > Number(current.reachedLevel || 0) ||
        (Number(data.reachedLevel || 0) === Number(current.reachedLevel || 0) && Number(data.recordedAt || 0) > Number(current.recordedAt || 0))
      ) {
        bestByName.set(name, { id: doc.id || name, ...data, playerName: name });
      }
    });

    return [...bestByName.values()]
      .sort((a, b) => {
        const levelDiff = Number(b.reachedLevel || 0) - Number(a.reachedLevel || 0);
        if (levelDiff !== 0) return levelDiff;
        return Number(b.recordedAt || 0) - Number(a.recordedAt || 0);
      })
      .slice(0, 20);
  }

  async function loadRankingData() {
    const firestore = initFirebase();
    if (!firestore) throw initError || new Error('Firebaseに接続できません。');

    const snapshot = await firestore
      .collection(RANKING_COLLECTION)
      .orderBy('reachedLevel', 'desc')
      .orderBy('recordedAt', 'desc')
      .limit(200)
      .get();

    const allItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return {
      rankingItems: dedupeBestRuns(snapshot.docs),
      allItems,
    };
  }

  async function loadRanking() {
    const data = await loadRankingData();
    return data.rankingItems;
  }

  function renderRankingItems(items) {
    if (!items.length) {
      return '<div class="ranking-empty">まだランキングデータがありません。</div>';
    }

    return items.map((item, index) => {
      const rankClass = index < 3 ? ` top-${index + 1}` : '';
      const enemies = normalizeEnemies(item.enemies);
      const lastEnemy = enemies.length ? getKnownEnemyName(enemies[enemies.length - 1]) : '';
      const resultLabel = getResultLabel(item.result);
      return `
        <article class="ranking-item${rankClass}">
          <div class="ranking-rank">${index + 1}</div>
          <div class="ranking-main">
            <div class="ranking-topline">
              <span class="ranking-player">${escapeHtml(item.playerName)}</span>
              <span class="ranking-level">Lv${Number(item.reachedLevel || 1)}</span>
              <span class="ranking-result">${escapeHtml(resultLabel)}</span>
            </div>
            <div class="ranking-meta">
              <span>ペット：${escapeHtml(item.petName || 'なし')}</span>
              ${lastEnemy ? `<span>最終敵：${escapeHtml(lastEnemy)}</span>` : ''}
            </div>
            <details class="ranking-detail-box">
              <summary>構成を見る</summary>
              <div class="ranking-detail">山札：${escapeHtml(getDeckSummary(item.deck, 8))}</div>
              <div class="ranking-detail">パッシブ：${escapeHtml(getPassiveSummary(item.passives, 8))}</div>
            </details>
          </div>
        </article>
      `;
    }).join('');
  }

  async function refreshRankingScreen() {
    const list = document.getElementById('ranking-list');
    const status = document.getElementById('ranking-player-status');
    const popularCards = document.getElementById('ranking-popular-cards');
    const popularPassives = document.getElementById('ranking-popular-passives');
    const enemyStats = document.getElementById('ranking-enemy-stats');

    if (list) list.innerHTML = '<div class="ranking-empty">ランキングを読み込み中...</div>';
    if (popularCards) popularCards.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';
    if (popularPassives) popularPassives.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';
    if (enemyStats) enemyStats.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';

    try {
      const data = await loadRankingData();
      if (list) list.innerHTML = renderRankingItems(data.rankingItems);
      renderRankingStats(data.allItems);
      if (status) status.textContent = 'ランキングを更新しました。';
    } catch (error) {
      console.warn('ranking load failed', error);
      if (list) list.innerHTML = `<div class="ranking-empty">ランキングを取得できませんでした。${escapeHtml(error.message || '')}</div>`;
      if (popularCards) popularCards.innerHTML = '<div class="ranking-empty">集計を取得できませんでした。</div>';
      if (popularPassives) popularPassives.innerHTML = '<div class="ranking-empty">集計を取得できませんでした。</div>';
      if (enemyStats) enemyStats.innerHTML = '<div class="ranking-empty">集計を取得できませんでした。</div>';
      if (status) status.textContent = 'ランキング取得に失敗しました。';
    }
  }

  function saveRankingPlayerName() {
    const input = document.getElementById('ranking-player-name');
    const status = document.getElementById('ranking-player-status');
    const name = setPlayerName(input ? input.value : '');
    if (input) input.value = name;
    if (status) status.textContent = `プレイヤー名を「${name}」で保存しました。`;
  }

  function prepareRankingScreen() {
    const currentPlayer = document.getElementById('ranking-current-player');
    if (currentPlayer) {
      currentPlayer.textContent = getPlayerName();
    }

    refreshRankingScreen();
  }

  window.DeckFirebaseRanking = {
    hasSavedPlayerName,
    getPlayerName,
    setPlayerName,
    saveRankingPlayerName,
    submitBattleResult,
    refreshRankingScreen,
    prepareRankingScreen,
  };

  window.saveRankingPlayerName = saveRankingPlayerName;
  window.refreshRankingScreen = refreshRankingScreen;
}());
