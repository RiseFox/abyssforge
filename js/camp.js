// AbyssForge v2 - campfire points and camp services.
(() => {
  "use strict";
  const ML = window.ML;
  const { TILE, WORLD_W, WORLD_H, Tile, BLOCKS, clamp } = ML;
  const CAMP_RADIUS_TILES = 6;

  function isCampTile(tile) {
    return tile === Tile.CAMPFIRE || Boolean(BLOCKS[tile]?.camp);
  }

  function tileFromPlayer(player, sim = null) {
    const width = sim?.worldWidth?.() || sim?.world?.[0]?.length || WORLD_W;
    const height = sim?.worldHeight?.() || sim?.world?.length || WORLD_H;
    return {
      x: clamp(Math.floor(player.x / TILE), 0, width - 1),
      y: clamp(Math.floor(player.y / TILE), 0, height - 1)
    };
  }

  function nearestCampfire(sim, player, radiusTiles = CAMP_RADIUS_TILES) {
    if (!sim?.world || !player) return null;
    const center = tileFromPlayer(player, sim);
    const width = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
    const height = sim.worldHeight?.() || sim.world?.length || WORLD_H;
    let nearest = null;
    let best = Infinity;
    for (let y = Math.max(0, center.y - radiusTiles); y <= Math.min(height - 1, center.y + radiusTiles); y += 1) {
      for (let x = Math.max(0, center.x - radiusTiles); x <= Math.min(width - 1, center.x + radiusTiles); x += 1) {
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

  function campKey(camp) {
    return camp ? `${camp.x}:${camp.y}` : "";
  }

  function campExists(sim, camp) {
    if (!sim?.world || !camp) return false;
    if (!isCampTile(sim.tileAt(camp.x, camp.y))) return false;
    const floorY = camp.y + 1;
    const floor = sim.tileAt(camp.x, floorY);
    return Boolean(BLOCKS[floor]?.solid && sim.hasHeadClearance(camp.x, floorY));
  }

  function campDepth(sim, camp) {
    if (!camp) return 0;
    return Math.max(0, camp.y - (sim.surface?.[camp.x] || 24));
  }

  function campLabel(sim, camp) {
    if (!camp) return "surface";
    const depth = campDepth(sim, camp);
    return depth <= 8 ? "surface" : `${depth} m`;
  }

  function campSpawnPixels(sim, camp) {
    if (!campExists(sim, camp)) return sim.safeSpawnPixels();
    const floorY = camp.y + 1;
    return {
      x: camp.x * TILE + TILE / 2,
      y: floorY * TILE - 17
    };
  }

  function surfaceCamp(sim) {
    const safe = sim.safeSpawnPixels();
    return nearestCampfire(sim, safe, CAMP_RADIUS_TILES + 2);
  }

  function activeCamp(sim) {
    if (campExists(sim, sim.lastCamp)) return { x: sim.lastCamp.x, y: sim.lastCamp.y };
    return surfaceCamp(sim);
  }

  function activeCampSpawnPixels(sim) {
    return campSpawnPixels(sim, activeCamp(sim));
  }

  function sameCamp(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  function activateNearest(sim, player) {
    const camp = nearestCampfire(sim, player);
    if (!camp) return { ok: false, message: "No campfire nearby." };
    const key = campKey(camp);
    if (!sim.campAnchors) sim.campAnchors = {};
    const newlyActivated = !sim.campAnchors[key];
    sim.campAnchors[key] = true;
    sim.lastCamp = { x: camp.x, y: camp.y };
    if (newlyActivated && sim.stats) sim.stats.camps = (sim.stats.camps || 0) + 1;
    return { ok: true, camp: { x: camp.x, y: camp.y }, newlyActivated };
  }

  function applyService(sim, service, player = null) {
    if (!service) return { ok: false, message: "Unknown camp service." };
    if (!ML.canAfford(sim.inventory, service.cost || {})) {
      return { ok: false, message: "Need " + ML.formatCost(service.cost) + "." };
    }
    ML.spend(sim.inventory, service.cost || {});
    let anchor = null;
    if (service.kind === "rest") {
      sim.health = sim.maxHealth;
      sim.energy = sim.maxEnergy;
      sim.refillLamp?.();
      if (player) anchor = activateNearest(sim, player);
    }
    if (service.kind === "rerollContract") {
      sim.rollContract();
    }
    if (service.out) {
      for (const [item, count] of Object.entries(service.out)) sim.addItem(item, count);
    }
    sim.stats.campUses += 1;
    return { ok: true, message: `${service.name} complete.`, service, anchor };
  }

  function serviceSummary(service) {
    if (service.kind === "rest") return "Full health, energy, lamp charge, recall ready, and respawn anchor set.";
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
      campExists,
      campDepth,
      campLabel,
      campSpawnPixels,
      surfaceCamp,
      activeCamp,
      activeCampSpawnPixels,
      sameCamp,
      activateNearest,
      applyService,
      serviceSummary
    }
  });
})();
