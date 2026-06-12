// AbyssForge v2 - small shared helpers.
(() => {
  "use strict";
  const ML = window.ML;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canAfford(inv, cost) {
    return Object.entries(cost).every(([item, count]) => (inv[item] || 0) >= count);
  }

  function spend(inv, cost) {
    for (const [item, count] of Object.entries(cost)) {
      inv[item] = Math.max(0, (inv[item] || 0) - count);
    }
  }

  function formatCost(cost) {
    return Object.entries(cost)
      .map(([item, count]) => `${ML.ITEM_META[item].name} ${count}`)
      .join(", ");
  }

  // Per-ingredient breakdown for the crafting UI: "Wood 2/3" with ok flag.
  function costParts(cost, inv) {
    return Object.entries(cost).map(([item, count]) => ({
      item,
      label: `${ML.ITEM_META[item].name} ${Math.min(inv[item] || 0, count)}/${count}`,
      ok: (inv[item] || 0) >= count
    }));
  }

  Object.assign(ML, { clamp, mulberry32, canAfford, spend, formatCost, costParts });
})();
