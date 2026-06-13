// AbyssForge v2 - enemy sensory memory and noise reactions.
(() => {
  "use strict";
  const ML = window.ML;

  const NOISE_TTL = 6200;
  const NOISE_LIMIT = 28;

  function ensure(scene) {
    if (!Array.isArray(scene.noiseEvents)) scene.noiseEvents = [];
    if (!scene.noiseSeq) scene.noiseSeq = 1;
  }

  function prune(scene, now = scene.time?.now || 0) {
    ensure(scene);
    scene.noiseEvents = scene.noiseEvents.filter((event) => now - event.at <= (event.ttl || NOISE_TTL));
    return scene.noiseEvents;
  }

  function emitNoise(scene, kind, x, y, options = {}) {
    ensure(scene);
    const now = scene.time?.now || 0;
    const event = {
      id: scene.noiseSeq++,
      kind,
      x,
      y,
      at: now,
      radius: options.radius || ML.TILE * 7,
      intensity: options.intensity ?? 1,
      ttl: options.ttl || NOISE_TTL,
      source: options.source || "player"
    };
    scene.noiseEvents.push(event);
    while (scene.noiseEvents.length > NOISE_LIMIT) scene.noiseEvents.shift();
    if (scene.sim?.stats) scene.sim.stats.noiseEvents = (scene.sim.stats.noiseEvents || 0) + 1;
    return event;
  }

  function strongestNoise(scene, enemy, now = scene.time?.now || 0) {
    let best = null;
    for (const event of prune(scene, now)) {
      const age = now - event.at;
      const distance = Math.hypot(enemy.x - event.x, enemy.y - event.y);
      if (distance > event.radius) continue;
      const clear = ML.ActionRules.hasWorldLineOfSight(scene.sim, enemy.x, enemy.y, event.x, event.y);
      const occlusion = clear ? 1 : 0.38;
      const freshness = Math.max(0, 1 - age / (event.ttl || NOISE_TTL));
      const falloff = Math.max(0, 1 - distance / event.radius);
      const score = event.intensity * freshness * falloff * occlusion;
      if (score <= 0.06) continue;
      if (!best || score > best.score) best = { ...event, distance, score, clear };
    }
    return best;
  }

  function sightRangeFor(enemy, cfg, localLight) {
    if (cfg.boss) return 470;
    const base = cfg.fly ? 350 : cfg.heavy ? 280 : 245;
    const lightBoost = 1 + Math.max(0, localLight - 0.22) * 0.55;
    const courageBoost = 1 + ((cfg.ai?.courage || 0.5) - 0.5) * 0.22;
    return base * lightBoost * courageBoost;
  }

  function sense(scene, enemy, now = scene.time?.now || 0) {
    const cfg = ML.ENEMIES[enemy.kind] || {};
    const localLight = scene.lightLevelAt?.(enemy.x, enemy.y) ?? 0.4;
    const playerDistance = Math.hypot(scene.player.x - enemy.x, scene.player.y - enemy.y);
    const canSeePlayer = playerDistance <= sightRangeFor(enemy, cfg, localLight)
      && ML.ActionRules.hasWorldLineOfSight(scene.sim, enemy.x, enemy.y, scene.player.x, scene.player.y);
    const noise = strongestNoise(scene, enemy, now);
    enemy.memory = enemy.memory || {};

    if (canSeePlayer) {
      enemy.memory.x = scene.player.x;
      enemy.memory.y = scene.player.y;
      enemy.memory.until = now + (cfg.boss ? 2400 : 1550);
      enemy.memory.reason = "sight";
    } else if (noise) {
      enemy.memory.x = noise.x;
      enemy.memory.y = noise.y;
      enemy.memory.until = now + 2100 + Math.round(noise.score * 950);
      enemy.memory.reason = "noise";
      enemy.memory.noiseKind = noise.kind;
    }

    const hasMemory = Number.isFinite(enemy.memory.until) && now < enemy.memory.until;
    const targetX = canSeePlayer ? scene.player.x : hasMemory ? enemy.memory.x : enemy.x;
    const targetY = canSeePlayer ? scene.player.y : hasMemory ? enemy.memory.y : enemy.y;
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const targetDistance = Math.max(1, Math.hypot(dx, dy));
    return {
      cfg,
      localLight,
      playerDistance,
      canSeePlayer,
      heardNoise: Boolean(noise),
      noise,
      hasMemory,
      targetX,
      targetY,
      dx,
      dy,
      targetDistance,
      dir: Math.sign(dx) || (scene.player.x < enemy.x ? -1 : 1),
      reason: canSeePlayer ? "sight" : noise ? "noise" : hasMemory ? enemy.memory.reason || "memory" : "idle"
    };
  }

  function pressure(scene, now = scene.time?.now || 0) {
    let total = 0;
    const px = scene.player?.x || 0;
    const py = scene.player?.y || 0;
    for (const event of prune(scene, now)) {
      const age = now - event.at;
      const distance = Math.hypot(px - event.x, py - event.y);
      const freshness = Math.max(0, 1 - age / (event.ttl || NOISE_TTL));
      const proximity = Math.max(0.15, 1 - distance / Math.max(1, event.radius * 1.4));
      total += event.intensity * freshness * proximity;
    }
    return total;
  }

  ML.MobSensors = {
    emitNoise,
    prune,
    sense,
    strongestNoise,
    pressure
  };
})();
