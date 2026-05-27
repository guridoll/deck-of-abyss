(function () {
 if (typeof window === 'undefined') return;

 function createEnemyProgress(deps) {
  const {
   storageKey,
   loadDiscoveryMap,
   saveDiscoveryMap,
   getEnemyCatalog,
   getEnemyCatalogEntryByLevel,
  } = deps || {};

  if (!storageKey || typeof loadDiscoveryMap !== 'function' || typeof saveDiscoveryMap !== 'function' || typeof getEnemyCatalog !== 'function' || typeof getEnemyCatalogEntryByLevel !== 'function') {
   throw new Error('GameEnemyProgress dependencies are missing.');
  }

  function loadEncounteredEnemies() {
   return loadDiscoveryMap(storageKey);
  }

  function saveEncounteredEnemies(encounters) {
   saveDiscoveryMap(storageKey, encounters);
  }

  function getEnemyBattleResultCounts(encounter) {
   return {
    defeatedCount: Math.max(0, Number(encounter?.defeatedCount || 0) || 0),
    defeatedByCount: Math.max(0, Number(encounter?.defeatedByCount || 0) || 0),
   };
  }

  function recordEnemyEncounter(level) {
   const enemy = getEnemyCatalogEntryByLevel(level);

   if (!enemy) return;

   const encounters = loadEncounteredEnemies();
   const current = encounters[enemy.id] || {};
   const maxPhaseSeen = enemy.id === 'void_knight'
    ? Math.max(1, Number(current.maxPhaseSeen || (current.phase2Seen ? 2 : 1) || 1))
    : undefined;

   encounters[enemy.id] = {
    ...current,
    firstLevel: current.firstLevel ? Math.min(current.firstLevel, level) : level,
    latestLevel: level,
    count: (current.count || 0) + 1,
    defeatedCount: Math.max(0, Number(current.defeatedCount || 0) || 0),
    defeatedByCount: Math.max(0, Number(current.defeatedByCount || 0) || 0),
    ...(enemy.id === 'void_knight' ? { maxPhaseSeen } : {}),
   };

   saveEncounteredEnemies(encounters);
  }

  function recordEnemyBattleResult(result, level = enemyLevel) {
   const enemy = getEnemyCatalogEntryByLevel(level);

   if (!enemy) return;

   const encounters = loadEncounteredEnemies();
   const current = encounters[enemy.id] || {};
   const counts = getEnemyBattleResultCounts(current);
   const maxPhaseSeen = enemy.id === 'void_knight'
    ? Math.max(1, Number(current.maxPhaseSeen || (current.phase2Seen ? 2 : 1) || 1))
    : undefined;

   encounters[enemy.id] = {
    ...current,
    firstLevel: current.firstLevel ? Math.min(current.firstLevel, level) : level,
    latestLevel: level,
    count: current.count || 1,
    defeatedCount: result === 'win' ? counts.defeatedCount + 1 : counts.defeatedCount,
    defeatedByCount: result === 'lose' ? counts.defeatedByCount + 1 : counts.defeatedByCount,
    ...(enemy.id === 'void_knight' ? { maxPhaseSeen } : {}),
   };

   saveEncounteredEnemies(encounters);
  }

  function recordEnemyPhaseEncounter(enemyId, phaseIndex) {
   const enemy = getEnemyCatalog().find(item => item.id === enemyId);

   if (!enemy || !Array.isArray(enemy.phaseImages)) return;

   const normalizedPhaseIndex = Number(phaseIndex);
   const maxAvailablePhase = enemy.phaseImages.length;

   if (!Number.isFinite(normalizedPhaseIndex) || normalizedPhaseIndex < 1 || normalizedPhaseIndex > maxAvailablePhase) return;

   const encounters = loadEncounteredEnemies();
   const current = encounters[enemy.id] || {};

   encounters[enemy.id] = {
    ...current,
    firstLevel: current.firstLevel || 20,
    latestLevel: Math.max(Number(current.latestLevel || 20), 20),
    count: current.count || 1,
    maxPhaseSeen: Math.max(Number(current.maxPhaseSeen || 1), normalizedPhaseIndex),
   };

   saveEncounteredEnemies(encounters);
  }


  return {
   loadEncounteredEnemies,
   saveEncounteredEnemies,
   getEnemyBattleResultCounts,
   recordEnemyEncounter,
   recordEnemyBattleResult,
   recordEnemyPhaseEncounter,
  };
 }

 window.GameEnemyProgress = {
  createEnemyProgress,
 };
}());
