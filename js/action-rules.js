// AbyssForge v2 - shared action, reach, and line-of-sight rules.
(() => {
  "use strict";
  const ML = window.ML;

  function tileFromWorld(x, y) {
    return { x: x / ML.TILE, y: y / ML.TILE };
  }

  function occludes(sim, x, y) {
    const tile = sim.tileAt(x, y);
    return tile !== ML.AIR && ML.BLOCKS[tile]?.solid && tile !== ML.Tile.PLATFORM;
  }

  function hasLineOfSight(sim, from, to) {
    if (!sim || !from || !to) return false;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(2, Math.ceil(distance * 5));
    const fromX = Math.floor(from.x);
    const fromY = Math.floor(from.y);
    const toX = Math.floor(to.x);
    const toY = Math.floor(to.y);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = Math.floor(from.x + (to.x - from.x) * t);
      const y = Math.floor(from.y + (to.y - from.y) * t);
      if ((x === fromX && y === fromY) || (x === toX && y === toY)) continue;
      if (occludes(sim, x, y)) return false;
    }
    return true;
  }

  function hasWorldLineOfSight(sim, ax, ay, bx, by) {
    return hasLineOfSight(sim, tileFromWorld(ax, ay), tileFromWorld(bx, by));
  }

  function targetTile(sim, player, worldX, worldY, rangeTiles = ML.INTERACT_RANGE_TILES) {
    if (!sim || !player || !Number.isFinite(worldX) || !Number.isFinite(worldY)) {
      return { ok: false, reason: "invalid" };
    }
    const x = Math.floor(worldX / ML.TILE);
    const y = Math.floor(worldY / ML.TILE);
    const cx = x * ML.TILE + ML.TILE / 2;
    const cy = y * ML.TILE + ML.TILE / 2;
    const distanceTiles = Math.hypot(cx - player.x, cy - player.y) / ML.TILE;
    const width = sim.worldWidth?.() || sim.world?.[0]?.length || ML.WORLD_W;
    const height = sim.worldHeight?.() || sim.world?.length || ML.WORLD_H;
    if (x < 0 || y < 0 || x >= width || y >= height) return { ok: false, reason: "outside", x, y };
    if (distanceTiles > rangeTiles) return { ok: false, reason: "range", x, y, distanceTiles };
    if (!hasWorldLineOfSight(sim, player.x, player.y, cx, cy)) return { ok: false, reason: "blocked", x, y, distanceTiles };
    return { ok: true, x, y, tile: sim.tileAt(x, y), distanceTiles };
  }

  function canMineTile(sim, player, target, pickLevel) {
    if (!target?.ok) return { ok: false, reason: target?.reason || "target" };
    const tile = target.tile;
    const block = ML.BLOCKS[tile];
    if (tile === ML.AIR) return { ok: false, reason: "air", target };
    if (!block) return { ok: false, reason: "unknown", target };
    if (tile === ML.Tile.LAVA) return { ok: false, reason: "lava", block, target };
    if (tile === ML.Tile.BEDROCK) return { ok: false, reason: "bedrock", block, target };
    if (block.camp) return { ok: false, reason: "camp", block, target };
    if (block.tier > pickLevel) return { ok: false, reason: "tier", block, target };
    return { ok: true, block, target };
  }

  function canAttackEnemy(sim, player, enemy, options = {}) {
    if (!enemy?.active || !player) return { ok: false, reason: "inactive" };
    const facing = options.facing || (player.flipX ? -1 : 1);
    const dx = enemy.x - player.x;
    const dyAbs = Math.abs(enemy.y - player.y);
    const distance = Math.hypot(dx, enemy.y - player.y);
    const inFacingArc = Math.sign(dx || facing) === facing && dyAbs <= 58 && distance <= 120;
    const closeBody = distance <= 66;
    const aimed = Boolean(options.aimed) && distance <= 130;
    if (!inFacingArc && !closeBody && !aimed) return { ok: false, reason: "range", distance };
    if (!hasWorldLineOfSight(sim, player.x, player.y, enemy.x, enemy.y)) return { ok: false, reason: "blocked", distance };
    return { ok: true, distance, inFacingArc, closeBody, aimed };
  }

  function canRadialAffect(sim, ax, ay, bx, by, radiusPx, lineOfSight = true) {
    const distance = Math.hypot(bx - ax, by - ay);
    if (distance > radiusPx) return { ok: false, reason: "range", distance };
    if (lineOfSight && !hasWorldLineOfSight(sim, ax, ay, bx, by)) return { ok: false, reason: "blocked", distance };
    return { ok: true, distance };
  }

  ML.ActionRules = {
    tileFromWorld,
    hasLineOfSight,
    hasWorldLineOfSight,
    targetTile,
    canMineTile,
    canAttackEnemy,
    canRadialAffect
  };
})();
