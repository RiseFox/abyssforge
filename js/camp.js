// AbyssForge v2 - campfire points and camp services.
(() => {
  "use strict";
  const ML = window.ML;
  const { TILE, WORLD_W, WORLD_H, Tile, BLOCKS, clamp } = ML;
  const CAMP_RADIUS_TILES = 6;

  function isCampTile(tile) {
    return tile === Tile.CAMPFIRE || Boolean(BLOCKS[tile]?.camp);
  }

  function tileFromPlayer(player) {
    return {
      x: clamp(Math.floor(player.x / TILE), 0, WORLD_W - 1),
      y: clamp(Math.floor(player.y / TILE), 0, WORLD_H - 1)
    };
  }

  function nearestCampfire(sim, player, radiusTiles = CAMP_RADIUS_TILES) {
    if (!sim?.world || !player) return null;
    const center = tileFromPlayer(player);
    let nearest = null;
    let best = Infinity;
    for (let y = Math.max(0, center.y - radiusTiles); y <= Math.min(WORLD_H - 1, center.y + radiusTiles); y += 1) {
      for (let x = Math.max(0, center.x - radiusTiles); x <= Math.min(WORLD_W - 1, center.x + radiusTiles); x += 1) {
        if (!isCampTile(sim.tileAt(x, y))) continue;
        const distance = Math.hypot(x + 0.5 - player.x / TILE, y + 0.5 - player.y / TILE);
        if (distance <= radiusTiles && distance < best) {
          best = distance;
          nearest = { x, y, distance };
        }
      }
    }
    return nearest;
  }

  function isNearCamp(sim, player, radiusTiles = CAMP_RADIUS_TILES) {
    return Boolean(nearestCampfire(sim, player, radiusTiles));
  }

  function applyService(sim, service) {
    if (!service) return { ok: false, message: "Unknown camp service." };
    if (!ML.canAfford(sim.inventory, service.cost || {})) {
      return { ok: false, message: "Need " + ML.formatCost(service.cost) + "." };
    }
    ML.spend(sim.inventory, service.cost || {});
    if (service.kind === "rest") {
      sim.health = sim.maxHealth;
      sim.energy = sim.maxEnergy;
    }
    if (service.kind === "rerollContract") {
      sim.rollContract();
    }
    if (service.out) {
      for (const [item, count] of Object.entries(service.out)) sim.addItem(item, count);
    }
    sim.stats.campUses += 1;
    return { ok: true, message: `${service.name} complete.`, service };
  }

  function serviceSummary(service) {
    if (service.kind === "rest") return "Full health, energy, and recall ready.";
    if (service.kind === "rerollContract") return "Replace the active contract.";
    return Object.entries(service.out || {})
      .map(([item, count]) => `${count} ${ML.ITEM_META[item]?.name || item}`)
      .join(", ");
  }

  Object.assign(ML, {
    CampSystem: {
      CAMP_RADIUS_TILES,
      isCampTile,
      nearestCampfire,
      isNearCamp,
      applyService,
      serviceSummary
    }
  });
})();
