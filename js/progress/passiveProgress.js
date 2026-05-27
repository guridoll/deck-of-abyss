(function () {
 if (typeof window === 'undefined') return;

 function createPassiveProgress(deps) {
  const {
   storageKey,
   loadDiscoveryMap,
   saveDiscoveryMap,
   getPassiveOptions,
  } = deps || {};

  if (!storageKey || typeof loadDiscoveryMap !== 'function' || typeof saveDiscoveryMap !== 'function' || typeof getPassiveOptions !== 'function') {
   throw new Error('GamePassiveProgress dependencies are missing.');
  }

  function loadDiscoveredPassives() {
   return loadDiscoveryMap(storageKey);
  }

  function saveDiscoveredPassives(discovered) {
   saveDiscoveryMap(storageKey, discovered);
  }

  function recordPassiveDiscovery(passiveId) {
   if (!passiveId) return;

   const passive = getPassiveOptions().find(item => item.id === passiveId);
   if (!passive) return;

   const discovered = loadDiscoveredPassives();
   const current = discovered[passive.id] || {};

   discovered[passive.id] = {
    ...current,
    firstFoundAt: current.firstFoundAt || Date.now(),
    seenCount: current.seenCount || current.count || 0,
    selectedCount: (current.selectedCount || 0) + 1,
   };

   saveDiscoveredPassives(discovered);
  }

  function recordPassiveDiscoveries(passives) {
   if (!Array.isArray(passives)) return;

   const discovered = loadDiscoveredPassives();
   let changed = false;

   passives.forEach(passive => {
    const passiveId = typeof passive === 'string' ? passive : passive?.id;
    const exists = getPassiveOptions().find(item => item.id === passiveId);
    if (!passiveId || !exists) return;

    const current = discovered[passiveId] || {};
    discovered[passiveId] = {
     ...current,
     firstFoundAt: current.firstFoundAt || Date.now(),
     seenCount: (current.seenCount || current.count || 0) + 1,
     selectedCount: current.selectedCount || 0,
    };
    changed = true;
   });

   if (changed) saveDiscoveredPassives(discovered);
  }

  return {
   loadDiscoveredPassives,
   saveDiscoveredPassives,
   recordPassiveDiscovery,
   recordPassiveDiscoveries,
  };
 }

 window.GamePassiveProgress = {
  createPassiveProgress,
 };
}());
