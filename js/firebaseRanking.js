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

  async function loadRanking() {
    const firestore = initFirebase();
    if (!firestore) throw initError || new Error('Firebaseに接続できません。');

    const snapshot = await firestore
      .collection(RANKING_COLLECTION)
      .orderBy('reachedLevel', 'desc')
      .orderBy('recordedAt', 'desc')
      .limit(100)
      .get();

    return dedupeBestRuns(snapshot.docs);
  }

  function renderRankingItems(items) {
    if (!items.length) {
      return '<div class="ranking-empty">まだランキングデータがありません。</div>';
    }

    return items.map((item, index) => {
      const rankClass = index < 3 ? ` top-${index + 1}` : '';
      const enemies = normalizeEnemies(item.enemies);
      const lastEnemy = enemies.length ? enemies[enemies.length - 1].name : '';
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
    if (list) list.innerHTML = '<div class="ranking-empty">ランキングを読み込み中...</div>';

    try {
      const items = await loadRanking();
      if (list) list.innerHTML = renderRankingItems(items);
      if (status) status.textContent = 'ランキングを更新しました。';
    } catch (error) {
      console.warn('ranking load failed', error);
      if (list) list.innerHTML = `<div class="ranking-empty">ランキングを取得できませんでした。${escapeHtml(error.message || '')}</div>`;
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
