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
  let rankingTooltipElement = null;
  let rankingTooltipTarget = null;
  let rankingTooltipListenersReady = false;
  let rankingDepthFilter = 1;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function ensureRankingTooltipElement() {
    if (rankingTooltipElement && document.body.contains(rankingTooltipElement)) return rankingTooltipElement;
    rankingTooltipElement = document.createElement('div');
    rankingTooltipElement.className = 'ranking-floating-tooltip';
    document.body.appendChild(rankingTooltipElement);
    return rankingTooltipElement;
  }

  function positionRankingTooltip(event, target) {
    if (!rankingTooltipElement) return;
    const sourceRect = target?.getBoundingClientRect?.();
    const viewportPadding = 12;
    const pointerX = event && Number.isFinite(event.clientX) ? event.clientX : (sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2);
    const pointerY = event && Number.isFinite(event.clientY) ? event.clientY : (sourceRect ? sourceRect.top : window.innerHeight / 2);
    const rect = rankingTooltipElement.getBoundingClientRect();
    let left = pointerX + 14;
    let top = pointerY + 14;

    if (left + rect.width > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, pointerX - rect.width - 14);
    }
    if (top + rect.height > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, pointerY - rect.height - 14);
    }

    rankingTooltipElement.style.left = `${left}px`;
    rankingTooltipElement.style.top = `${top}px`;
  }

  function showRankingTooltip(target, event) {
    const text = target?.getAttribute?.('data-tooltip') || '';
    if (!text) return;
    rankingTooltipTarget = target;
    const tooltip = ensureRankingTooltipElement();
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    positionRankingTooltip(event, target);
  }

  function hideRankingTooltip(target = null) {
    if (target && rankingTooltipTarget && target !== rankingTooltipTarget) return;
    rankingTooltipTarget = null;
    if (rankingTooltipElement) rankingTooltipElement.classList.remove('visible');
  }

  function setupRankingFloatingTooltips() {
    if (rankingTooltipListenersReady) return;
    rankingTooltipListenersReady = true;

    document.addEventListener('mouseover', (event) => {
      const target = event.target?.closest?.('.ranking-info-name[data-tooltip]');
      if (target) showRankingTooltip(target, event);
    });
    document.addEventListener('mousemove', (event) => {
      if (rankingTooltipTarget) positionRankingTooltip(event, rankingTooltipTarget);
    });
    document.addEventListener('mouseout', (event) => {
      const target = event.target?.closest?.('.ranking-info-name[data-tooltip]');
      if (target && !target.contains(event.relatedTarget)) hideRankingTooltip(target);
    });
    document.addEventListener('focusin', (event) => {
      const target = event.target?.closest?.('.ranking-info-name[data-tooltip]');
      if (target) showRankingTooltip(target, null);
    });
    document.addEventListener('focusout', (event) => {
      const target = event.target?.closest?.('.ranking-info-name[data-tooltip]');
      if (target) hideRankingTooltip(target);
    });
    window.addEventListener('scroll', () => hideRankingTooltip(), true);
    window.addEventListener('resize', () => hideRankingTooltip());
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

  function normalizeEvents(events) {
    if (!Array.isArray(events)) return [];
    return events.slice(0, 40).map((event) => ({
      id: String(event && event.id || ''),
      title: String(event && event.title || event && event.id || '不明なイベント').slice(0, 60),
      level: Math.max(1, Math.floor(Number(event && event.level || 1))),
      seenAt: Math.max(0, Math.floor(Number(event && event.seenAt || 0))),
      outcome: ['accepted', 'rejected'].includes(event && event.outcome) ? event.outcome : 'seen',
    }));
  }

  function normalizeDepth(value) {
    const depth = Math.floor(Number(value || 1));
    return [1, 2, 3].includes(depth) ? depth : 1;
  }

  function getDepthLabel(depth) {
    return `深度${normalizeDepth(depth)}`;
  }

  async function submitBattleResult(entry) {
    const firestore = initFirebase();
    if (!firestore || !entry) return { ok: false, reason: initError ? initError.message : 'not_initialized' };

    const reachedLevel = Math.max(1, Math.floor(Number(entry.reachedLevel || entry.level || 1)));
    const recordedAt = Number(entry.recordedAt || Date.now());
    const playerName = getPlayerName();

    const payload = {
      playerName,
      depth: normalizeDepth(entry.depth || entry.currentDepth),
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
      events: normalizeEvents(entry.events),
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

  function getDeckSummaryHtml(deck, limit = 4) {
    const entries = Object.entries(normalizeDeck(deck))
      .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0], 'ja'));
    if (!entries.length) return '山札情報なし';
    const visible = entries.slice(0, limit).map(([name, count]) => `${renderKnownCardName(name, 'ranking-card-name')}<span class="ranking-inline-count">×${Number(count)}</span>`);
    const rest = entries.length - visible.length;
    return `${visible.join('<span class="ranking-detail-separator"> / </span>')}${rest > 0 ? `<span class="ranking-detail-separator"> / </span><span>他${rest}種</span>` : ''}`;
  }

  function getPassiveSummary(passives, limit = 4) {
    const list = normalizePassives(passives);
    if (!list.length) return 'パッシブなし';
    const visible = list.slice(0, limit).map((passive) => passive.name || passive.id);
    const rest = list.length - visible.length;
    return `${visible.join(' / ')}${rest > 0 ? ` / 他${rest}個` : ''}`;
  }

  function getPassiveSummaryHtml(passives, limit = 4) {
    const list = normalizePassives(passives);
    if (!list.length) return 'パッシブなし';
    const visible = list.slice(0, limit).map((passive) => renderKnownPassiveName(passive, 'ranking-passive-name'));
    const rest = list.length - visible.length;
    return `${visible.join('<span class="ranking-detail-separator"> / </span>')}${rest > 0 ? `<span class="ranking-detail-separator"> / </span><span>他${rest}個</span>` : ''}`;
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

  function getDiscoveredRandomEventIds() {
    const data = readLocalJson('cardBattleRandomEvents', {});
    return new Set(Object.keys(data || {}).filter((id) => data[id]));
  }

  function getKnownCardName(cardName) {
    const discovered = getDiscoveredCardNames();
    const name = String(cardName || '');
    return name && discovered.has(name) ? name : '???';
  }

  function getKnownRandomEventTitle(event) {
    const discovered = getDiscoveredRandomEventIds();
    const id = String(event && event.id || '');
    if (!id || !discovered.has(id)) return '???';
    return String(event && event.title || id || '???');
  }

  function getKnownPassiveName(passive) {
    const discovered = getDiscoveredPassiveIds();
    const id = String(passive && passive.id || '');
    if (!id || !discovered.has(id)) return '???';
    return String(passive && passive.name || id || '???');
  }

  function getCardRankingRarity(cardName) {
    if (window.DeckCardMetadata && typeof window.DeckCardMetadata.getCardRarityByName === 'function') {
      return window.DeckCardMetadata.getCardRarityByName(cardName) || 'unknown';
    }
    return 'unknown';
  }

  function getCardRankingDetail(cardName) {
    if (window.DeckCardMetadata && typeof window.DeckCardMetadata.getCardDetailByName === 'function') {
      return window.DeckCardMetadata.getCardDetailByName(cardName);
    }
    return null;
  }

  function getEnemyRankingDetail(enemy) {
    const id = String(enemy && enemy.id || '');
    if (!id || !window.GameEnemies || typeof window.GameEnemies.getEnemyCatalog !== 'function') return null;
    const catalog = window.GameEnemies.getEnemyCatalog({});
    return catalog.find((item) => item.id === id) || null;
  }

  function getRandomEventRankingDetail(event) {
    const id = String(event && event.id || '');
    if (!id || !window.DeckRandomEventMetadata || typeof window.DeckRandomEventMetadata.getEventById !== 'function') return null;
    return window.DeckRandomEventMetadata.getEventById(id);
  }

  function getPassiveRankingDetail(passive) {
    const id = String(passive && passive.id || '');
    if (!id || !window.DeckPassiveMetadata || typeof window.DeckPassiveMetadata.getPassiveById !== 'function') return null;
    return window.DeckPassiveMetadata.getPassiveById(id);
  }

  function rankingTooltipHtml(label, detail, className = '') {
    const text = String(label || '???');
    if (!detail) return `<span class="${className ? `${escapeHtml(className)} ` : ''}ranking-info-name unknown">${escapeHtml(text)}</span>`;
    return `<span class="${className ? `${escapeHtml(className)} ` : ''}ranking-info-name" data-tooltip="${escapeHtml(detail)}" tabindex="0">${escapeHtml(text)}</span>`;
  }

  function getCardTooltipText(cardName) {
    const detail = getCardRankingDetail(cardName);
    if (!detail) return '';
    return [
      detail.name,
      `レアリティ：${detail.rarityLabel || '不明'}`,
      detail.text ? `効果：${detail.text}` : '',
      detail.cooldown ? `硬直：${detail.cooldown}` : '',
    ].filter(Boolean).join('\n');
  }

  function getEnemyTooltipText(enemy) {
    const detail = getEnemyRankingDetail(enemy);
    if (!detail) return '';
    return [
      detail.name,
      detail.levelText ? `出現：${detail.levelText}` : '',
      detail.description || '',
      detail.passives && detail.passives.length ? `特性：${detail.passives.join(' / ')}` : '',
      detail.skills && detail.skills.length ? `行動：${detail.skills.join(' / ')}` : '',
    ].filter(Boolean).join('\n');
  }

  function getRandomEventTooltipText(event) {
    const detail = getRandomEventRankingDetail(event);
    if (!detail) return '';
    return [
      detail.title,
      detail.description || '',
      detail.effect ? `効果：${detail.effect}` : '',
      detail.downside ? `デメリット：${detail.downside}` : '',
    ].filter(Boolean).join('\n');
  }

  function getPassiveTooltipText(passive) {
    const detail = getPassiveRankingDetail(passive);
    if (!detail) return '';
    return [
      `${detail.icon || '✨'} ${detail.name}`,
      `レアリティ：${detail.rarityLabel || '不明'}`,
      detail.text ? `効果：${detail.text}` : '',
    ].filter(Boolean).join('\n');
  }

  function renderKnownCardName(cardName, className = '') {
    const name = String(cardName || '');
    const displayName = getKnownCardName(name);
    return rankingTooltipHtml(displayName, displayName === '???' ? '' : getCardTooltipText(name), className);
  }

  function renderKnownEnemyName(enemy, className = '') {
    const displayName = getKnownEnemyName(enemy);
    return rankingTooltipHtml(displayName, displayName === '???' ? '' : getEnemyTooltipText(enemy), className);
  }

  function renderKnownRandomEventName(event, className = '') {
    const displayName = getKnownRandomEventTitle(event);
    return rankingTooltipHtml(displayName, displayName === '???' ? '' : getRandomEventTooltipText(event), className);
  }

  function renderKnownPassiveName(passive, className = '') {
    const displayName = getKnownPassiveName(passive);
    return rankingTooltipHtml(displayName, displayName === '???' ? '' : getPassiveTooltipText(passive), className);
  }

  function getCardRankingRarityMeta(rarity) {
    const map = {
      normal: { title: 'ノーマル' },
      rare: { title: 'レア' },
      epic: { title: 'エピック' },
      legendary: { title: 'レジェンダリー' },
      unknown: { title: '未分類' },
    };
    return map[rarity] || map.unknown;
  }

  function aggregatePopularCards(items, limit = 20) {
    const counts = new Map();

    items.forEach((item) => {
      const cardPlayCounts = normalizeCardPlayCounts(item.cardPlayCounts);
      Object.entries(cardPlayCounts).forEach(([cardName, count]) => {
        counts.set(cardName, (counts.get(cardName) || 0) + Number(count || 0));
      });
    });

    const cards = [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        rarity: getCardRankingRarity(name),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));

    return Number.isFinite(limit) ? cards.slice(0, limit) : cards;
  }

  function aggregatePopularCardsByRarity(items) {
    const groups = new Map();
    const rarityOrder = ['normal', 'rare', 'epic', 'legendary', 'unknown'];

    aggregatePopularCards(items, Infinity).forEach((card) => {
      const rarity = rarityOrder.includes(card.rarity) ? card.rarity : 'unknown';
      if (!groups.has(rarity)) groups.set(rarity, []);
      groups.get(rarity).push(card);
    });

    return rarityOrder
      .map((rarity) => ({
        rarity,
        meta: getCardRankingRarityMeta(rarity),
        cards: groups.has(rarity) ? groups.get(rarity).slice(0, 20) : [],
      }))
      .filter((group) => group.cards.length);
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
    const groups = aggregatePopularCardsByRarity(items);
    if (!groups.length) {
      return '<div class="ranking-empty">まだカード使用データがありません。</div>';
    }

    return groups.map((group) => `
      <div class="ranking-rarity-group ranking-rarity-${escapeHtml(group.rarity)}">
        <div class="ranking-rarity-heading">${escapeHtml(group.meta.title)}</div>
        ${group.cards.map((card, index) => `
          <div class="ranking-stat-row">
            <span class="ranking-stat-rank">${index + 1}</span>
            <strong>${renderKnownCardName(card.name, 'ranking-card-name')}</strong>
            <span>${card.count}回プレイ</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  function renderEnemyStats(items) {
    const stats = aggregateEnemyStats(items);
    if (!stats.length) {
      return '<div class="ranking-empty">まだ敵戦績データがありません。</div>';
    }

    return stats.map((enemy) => {
      return `
        <div class="ranking-stat-row enemy">
          <strong>${renderKnownEnemyName(enemy, 'ranking-enemy-name')}</strong>
          <span>この敵を倒した回数：${Number(enemy.defeated || 0)}</span>
          <span>この敵に倒された回数：${Number(enemy.defeatedPlayer || 0)}</span>
        </div>
      `;
    }).join('');
  }

  function aggregateEventStats(items) {
    const stats = new Map();

    items.forEach((item) => {
      normalizeEvents(item.events).forEach((event) => {
        const key = event.id || event.title;
        if (!key) return;
        const current = stats.get(key) || {
          id: event.id || '',
          title: event.title || event.id || '不明なイベント',
          count: 0,
          acceptedCount: 0,
          rejectedCount: 0,
        };
        current.count += 1;
        if (event.outcome === 'accepted') current.acceptedCount += 1;
        if (event.outcome === 'rejected') current.rejectedCount += 1;
        stats.set(key, current);
      });
    });

    return [...stats.values()]
      .sort((a, b) => b.count - a.count || b.acceptedCount - a.acceptedCount || String(a.title).localeCompare(String(b.title), 'ja'))
      .slice(0, 30);
  }

  function renderEventStats(items) {
    const events = aggregateEventStats(items);
    if (!events.length) {
      return '<div class="ranking-empty">まだ遭遇イベントデータがありません。</div>';
    }

    return events.map((event, index) => `
      <div class="ranking-stat-row ranking-event-row">
        <span class="ranking-stat-rank">${index + 1}</span>
        <strong>${renderKnownRandomEventName(event, 'ranking-event-name')}</strong>
        <span>${Number(event.count || 0)}回遭遇</span>
        <span>受諾回数：${Number(event.acceptedCount || 0)}回</span>
        <span>拒否回数：${Number(event.rejectedCount || 0)}回</span>
      </div>
    `).join('');
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
        <strong>${renderKnownPassiveName(passive, 'ranking-passive-name')}</strong>
        <span>${Number(passive.count || 0)}回選択</span>
      </div>
    `).join('');
  }

  function renderRankingStats(items) {
    const popularCards = document.getElementById('ranking-popular-cards');
    const popularPassives = document.getElementById('ranking-popular-passives');
    const enemyStats = document.getElementById('ranking-enemy-stats');
    const eventStats = document.getElementById('ranking-event-stats');

    if (popularCards) popularCards.innerHTML = renderPopularCards(items);
    if (popularPassives) popularPassives.innerHTML = renderPopularPassives(items);
    if (enemyStats) enemyStats.innerHTML = renderEnemyStats(items);
    if (eventStats) eventStats.innerHTML = renderEventStats(items);
  }

  function dedupeBestRuns(docs) {
    const bestByName = new Map();
    docs.forEach((doc) => {
      const data = doc.data ? doc.data() : doc;
      if (normalizeDepth(data.depth) !== rankingDepthFilter) return;
      const name = normalizePlayerName(data.playerName);
      const current = bestByName.get(name);
      if (
        !current ||
        Number(data.reachedLevel || 0) > Number(current.reachedLevel || 0) ||
        (Number(data.reachedLevel || 0) === Number(current.reachedLevel || 0) && Number(data.recordedAt || 0) > Number(current.recordedAt || 0))
      ) {
        bestByName.set(name, { id: doc.id || name, ...data, playerName: name, depth: normalizeDepth(data.depth) });
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

    const allItems = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), depth: normalizeDepth(doc.data().depth) }))
      .filter((item) => normalizeDepth(item.depth) === rankingDepthFilter);
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
      const lastEnemy = enemies.length ? renderKnownEnemyName(enemies[enemies.length - 1], 'ranking-enemy-name') : '';
      const events = normalizeEvents(item.events);
      const eventSummary = events.length
        ? events.map((event) => {
          const outcomeLabel = event.outcome === 'accepted' ? '受諾' : event.outcome === 'rejected' ? '拒否' : '遭遇';
          return `${renderKnownRandomEventName(event, 'ranking-event-name')}<span class="ranking-inline-outcome">（${outcomeLabel}）</span>`;
        }).join(' / ')
        : '遭遇イベントなし';
      const resultLabel = getResultLabel(item.result);
      return `
        <article class="ranking-item${rankClass}">
          <div class="ranking-rank">${index + 1}</div>
          <div class="ranking-main">
            <div class="ranking-topline">
              <span class="ranking-player">${escapeHtml(item.playerName)}</span>
              <span class="ranking-level">${escapeHtml(getDepthLabel(item.depth))}</span>
              <span class="ranking-level">Lv${Number(item.reachedLevel || 1)}</span>
              <span class="ranking-result">${escapeHtml(resultLabel)}</span>
            </div>
            <div class="ranking-meta">
              <span>ペット：${escapeHtml(item.petName || 'なし')}</span>
              ${lastEnemy ? `<span>最終敵：${lastEnemy}</span>` : ''}
            </div>
            <details class="ranking-detail-box">
              <summary>構成を見る</summary>
              <div class="ranking-detail">山札：${getDeckSummaryHtml(item.deck, Infinity)}</div>
              <div class="ranking-detail">パッシブ：${getPassiveSummaryHtml(item.passives, 8)}</div>
              <div class="ranking-detail">遭遇イベント：${eventSummary}</div>
            </details>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderRankingDepthFilter() {
    const actions = document.querySelector('#ranking-screen .ranking-actions');
    if (!actions || document.getElementById('ranking-depth-filter')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ranking-depth-filter';
    wrapper.className = 'ranking-depth-filter';
    wrapper.innerHTML = [1, 2, 3].map((depth) => `
      <button type="button" class="ui-button ui-button-secondary ranking-depth-button${rankingDepthFilter === depth ? ' active' : ''}" data-depth="${depth}">
        深度${depth}
      </button>
    `).join('');
    wrapper.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-depth]');
      if (!button) return;
      rankingDepthFilter = normalizeDepth(button.getAttribute('data-depth'));
      wrapper.querySelectorAll('.ranking-depth-button').forEach((item) => item.classList.toggle('active', Number(item.getAttribute('data-depth')) === rankingDepthFilter));
      refreshRankingScreen();
    });
    actions.appendChild(wrapper);
  }

  async function refreshRankingScreen() {
    renderRankingDepthFilter();
    const list = document.getElementById('ranking-list');
    const status = document.getElementById('ranking-player-status');
    const popularCards = document.getElementById('ranking-popular-cards');
    const popularPassives = document.getElementById('ranking-popular-passives');
    const enemyStats = document.getElementById('ranking-enemy-stats');
    const eventStats = document.getElementById('ranking-event-stats');

    if (list) list.innerHTML = '<div class="ranking-empty">ランキングを読み込み中...</div>';
    if (popularCards) popularCards.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';
    if (popularPassives) popularPassives.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';
    if (enemyStats) enemyStats.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';
    if (eventStats) eventStats.innerHTML = '<div class="ranking-empty">集計を読み込み中...</div>';

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
      if (eventStats) eventStats.innerHTML = '<div class="ranking-empty">集計を取得できませんでした。</div>';
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
    setupRankingFloatingTooltips();
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
