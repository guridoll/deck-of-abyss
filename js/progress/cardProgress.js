(function () {
 if (typeof window === 'undefined') return;

 function createCardProgress(deps) {
  const {
   cardPool,
   basicInitialCardNames,
   storageKey,
   loadDiscoveryMap,
   saveDiscoveryMap,
   evaluateAchievements,
  } = deps || {};
  const CARD_POOL = Array.isArray(cardPool) ? cardPool : [];
  const BASIC_INITIAL_CARD_NAMES = Array.isArray(basicInitialCardNames) ? basicInitialCardNames : [];

  if (!storageKey || typeof loadDiscoveryMap !== 'function' || typeof saveDiscoveryMap !== 'function' || typeof evaluateAchievements !== 'function') {
   throw new Error('GameCardProgress dependencies are missing.');
  }

  function getInitialDiscoveredCards() {
   const now = Date.now();
   const initialDiscovered = {};

   BASIC_INITIAL_CARD_NAMES.forEach(cardName => {
    if (!CARD_POOL.some(card => card.name === cardName)) return;

    initialDiscovered[cardName] = {
     firstFoundAt: now,
     count: 0,
     initial: true,
    };
   });

   return initialDiscovered;
  }

  function loadDiscoveredCards() {
   const discovered = loadDiscoveryMap(storageKey);
   const initialDiscovered = getInitialDiscoveredCards();
   let changed = false;

   Object.entries(initialDiscovered).forEach(([cardName, value]) => {
    if (!discovered[cardName]) {
     discovered[cardName] = value;
     changed = true;
    }
   });

   if (changed) saveDiscoveryMap(storageKey, discovered);

   return discovered;
  }

  function saveDiscoveredCards(discovered) {
   saveDiscoveryMap(storageKey, discovered);
  }

  function recordCardDiscovery(cardName) {
   if (!cardName) return;

   const card = CARD_POOL.find(item => item.name === cardName);
   if (!card) return;

   const discovered = loadDiscoveredCards();
   const current = discovered[card.name] || {};

   discovered[card.name] = {
    firstFoundAt: current.firstFoundAt || Date.now(),
    count: (current.count || 0) + 1,
   };

   saveDiscoveredCards(discovered);
   evaluateAchievements();
  }

  function recordCardDiscoveries(cards) {
   if (!Array.isArray(cards)) return;

   const discovered = loadDiscoveredCards();
   let changed = false;

   cards.forEach(card => {
    const cardName = typeof card === 'string' ? card : card?.name;
    const exists = CARD_POOL.find(item => item.name === cardName);
    if (!cardName || !exists) return;

    const current = discovered[cardName] || {};
    discovered[cardName] = {
     firstFoundAt: current.firstFoundAt || Date.now(),
     count: (current.count || 0) + 1,
    };
    changed = true;
   });

   if (changed) {
    saveDiscoveredCards(discovered);
    evaluateAchievements();
   }
  }

  return {
   getInitialDiscoveredCards,
   loadDiscoveredCards,
   saveDiscoveredCards,
   recordCardDiscovery,
   recordCardDiscoveries,
  };
 }

 window.GameCardProgress = {
  createCardProgress,
 };
}());
