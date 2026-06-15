// AbyssForge v2 - procedural points of interest for surface and underground regions.
(() => {
  "use strict";
  const ML = window.ML;
  const { AIR, Tile, BLOCKS, clamp } = ML;

  const SURFACE_MESSAGES = [
    "The road keeps walking after the map stops. Count your campfires, not your steps.",
    "Guild survey mark: if the sky is still here, the forge has not closed the loop.",
    "Do not dig under quiet roofs. They remember names better than stone does.",
    "A watcher was seen at noon. Nobody believed the report."
  ];

  const DEEP_POIS = {
    survey: {
      label: "SURVEY MARK",
      width: 9,
      title: (ctx) => `${ctx.stratumName} survey station`,
      message: (ctx) => `A numbered station under ${ctx.stratumName}. The ledger says this tunnel was measured before it existed.`
    },
    pump: {
      label: "OLD PUMP",
      width: 11,
      title: () => "sealed pump room",
      message: (ctx) => `The pump is dry, but the rails point ${ctx.side === "left" ? "west" : ctx.side === "right" ? "east" : "down"}. Someone tried to drain the dark itself.`
    },
    shrine: {
      label: "QUIET SHRINE",
      width: 9,
      title: () => "quiet wayfire shrine",
      message: () => "Warm soot marks the stone. The campfires are not camping tools; they are locks in a much older network."
    },
    cache: {
      label: "FORGE CACHE",
      width: 8,
      title: () => "misfiled forge cache",
      message: () => "The cache tag is written in your own hand. You do not remember writing it."
    }
  };

  function widthOf(sim) {
    return Array.isArray(sim?.world?.[0]) ? sim.world[0].length : 0;
  }

  function heightOf(sim) {
    return Array.isArray(sim?.world) ? sim.world.length : 0;
  }

  function ensureDiscoveries(sim) {
    if (!Array.isArray(sim.surfaceDiscoveries)) sim.surfaceDiscoveries = [];
    return sim.surfaceDiscoveries;
  }

  function tileAt(sim, x, y) {
    if (!sim || x < 0 || y < 0 || x >= widthOf(sim) || y >= heightOf(sim)) return Tile.BEDROCK;
    return sim.world[y][x];
  }

  function setTile(sim, x, y, tile) {
    if (!sim || x < 0 || y < 0 || x >= widthOf(sim) || y >= heightOf(sim)) return false;
    sim.world[y][x] = tile;
    return true;
  }

  function solidAt(sim, x, y) {
    const tile = tileAt(sim, x, y);
    return tile !== AIR && Boolean(BLOCKS[tile]?.solid);
  }

  function hasClearance(sim, x, y, height = 4) {
    for (let yy = y - height + 1; yy <= y; yy += 1) {
      const tile = tileAt(sim, x, yy);
      if (tile !== AIR && BLOCKS[tile]?.solid) return false;
    }
    return true;
  }

  function discoveryId(sim, scope, type, x, y, rand) {
    const count = ensureDiscoveries(sim).length + 1;
    const salt = Math.abs(((x * 73856093) ^ (y * 19349663) ^ Math.floor(rand() * 99991)) | 0);
    return `${scope}-${type}-${count}-${salt}`;
  }

  function addDiscovery(sim, options) {
    const rand = options.rand || Math.random;
    const x = clamp(Math.floor(options.x), 2, Math.max(2, widthOf(sim) - 3));
    const y = clamp(Math.floor(options.y), 2, Math.max(2, heightOf(sim) - 3));
    if (!solidAt(sim, x, y + 1) || !hasClearance(sim, x, y, 3)) return null;
    setTile(sim, x, y, options.tile || Tile.SIGN);
    const discovery = {
      id: discoveryId(sim, options.scope || "surface", options.type || "sign", x, y, rand),
      scope: options.scope || "surface",
      type: options.type || "sign",
      title: options.title || "field mark",
      message: options.message || "The mark has no readable words left.",
      label: options.label || "FIELD MARK",
      x,
      y,
      depth: sim.depthAtTile?.(x, y) ?? Math.max(0, y - (sim.surface?.[x] || 24)),
      source: options.source || null,
      seen: false,
      read: false
    };
    ensureDiscoveries(sim).push(discovery);
    return discovery;
  }

  function surfaceTitle(type, side) {
    const directed = ML.WorldGenDirector?.surfaceTitle?.(type, side, null);
    if (directed) return directed;
    const sideName = side === "left" ? "western" : "eastern";
    if (type === "waypost") return `${sideName} waypost`;
    if (type === "hamlet") return `silent ${sideName} hamlet`;
    return `${sideName} road sign`;
  }

  function surfaceMessage(type, side, distance, rand, region = null) {
    const directed = ML.WorldGenDirector?.surfaceMessage?.(type, side, distance, rand, region);
    if (directed) return directed;
    const sideName = side === "left" ? "western" : "eastern";
    if (type === "waypost") {
      return `The ${sideName} waypost still has warm ash. Someone crossed ${distance} tiles from the shaft and did not return underground.`;
    }
    if (type === "hamlet") {
      return "A dead surface hamlet: roofs, a cache, and no footprints. The mine was not the only place that moved.";
    }
    return SURFACE_MESSAGES[Math.floor(rand() * SURFACE_MESSAGES.length)];
  }

  function surfaceRoughness(sim, x, radius = 5) {
    let low = Infinity;
    let high = -Infinity;
    const width = widthOf(sim);
    for (let xx = clamp(x - radius, 2, width - 3); xx <= clamp(x + radius, 2, width - 3); xx += 1) {
      const y = sim.surfaceFloorY?.(xx) ?? sim.surface?.[xx] ?? 24;
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    return Number.isFinite(low) && Number.isFinite(high) ? high - low : 99;
  }

  function placeSurfaceSign(sim, x, type, title, message, rand = Math.random, region = null) {
    x = clamp(Math.floor(x), 2, Math.max(2, widthOf(sim) - 3));
    const floorY = sim.surfaceFloorY?.(x) ?? sim.surface?.[x] ?? 24;
    const y = floorY - 1;
    if (!solidAt(sim, x, floorY) || y < 2) return null;
    for (let yy = y - 2; yy <= y; yy += 1) setTile(sim, x, yy, AIR);
    return addDiscovery(sim, {
      scope: "surface",
      type,
      title,
      message,
      label: ML.WorldGenDirector?.surfaceLabel?.(type, region) || (type === "hamlet" ? "SILENT HAMLET" : type === "waypost" ? "WAYPOST" : "ROAD MARK"),
      x,
      y,
      source: "surface",
      rand
    });
  }

  function addSurfaceDiscovery(sim, type, x, side, rand = Math.random, region = null) {
    const origin = sim.shaft?.x || sim.spawn?.x || Math.floor(widthOf(sim) / 2);
    const distance = Math.max(0, Math.abs(x - origin));
    const discovery = placeSurfaceSign(
      sim,
      x,
      type,
      ML.WorldGenDirector?.surfaceTitle?.(type, side, region) || surfaceTitle(type, side),
      surfaceMessage(type, side, distance, rand, region),
      rand,
      region
    );
    if (discovery) discovery.distance = distance;
    if (discovery && region?.id) discovery.surfaceRegion = region.id;
    return discovery;
  }

  function nearSurfaceHumanMark(sim, x, radius = 52) {
    const discoveries = ensureDiscoveries(sim).filter((entry) => entry.scope !== "underground");
    if (discoveries.some((entry) => Math.abs((entry.x || 0) - x) < radius)) return true;
    const min = clamp(x - radius, 2, Math.max(2, widthOf(sim) - 3));
    const max = clamp(x + radius, 2, Math.max(2, widthOf(sim) - 3));
    for (let xx = min; xx <= max; xx += 1) {
      const y = sim.surfaceFloorY?.(xx) ?? sim.surface?.[xx] ?? 24;
      const tile = tileAt(sim, xx, y - 1);
      if (tile === Tile.SIGN || tile === Tile.CAMPFIRE) return true;
    }
    return false;
  }

  function shouldPlaceSurfaceLandmark(sim, minX, maxX, side, rand) {
    const origin = sim.shaft?.x || sim.spawn?.x || Math.floor(widthOf(sim) / 2);
    const midpoint = Math.floor((minX + maxX) / 2);
    const distance = Math.abs(midpoint - origin);
    if (distance < 150) return false;
    if (nearSurfaceHumanMark(sim, midpoint, 78)) return false;

    const expansionIndex = sim.stats?.horizontalExpansions || 0;
    const lastSurfaceExpansion = ensureDiscoveries(sim)
      .filter((entry) => entry.scope !== "underground" && Number.isFinite(entry.expansion))
      .reduce((latest, entry) => Math.max(latest, entry.expansion), -99);
    if (expansionIndex - lastSurfaceExpansion < 3) return false;
    const cadence = distance < 420 ? 4 : distance < 760 ? 3 : 2;
    const seedPhase = Math.abs((sim.seed || 0) % cadence);
    const sidePhase = side === "left" ? 2 : 0;
    const cadenceHit = ((expansionIndex + sidePhase + seedPhase) % cadence) === 0;
    const rareChance = clamp(0.06 + distance / 3600, 0.06, 0.24);
    return cadenceHit || rand() < rareChance;
  }

  function generateSurfaceLandmarks(sim, regionStart, regionEnd, side, rand = Math.random, opts = {}) {
    ensureDiscoveries(sim);
    const width = widthOf(sim);
    const minX = clamp(regionStart + 6, 3, width - 4);
    const maxX = clamp(regionEnd - 6, 3, width - 4);
    const discoveries = [];
    const span = Math.max(1, maxX - minX);
    const plan = ML.WorldGenDirector?.surfaceLandmarkPlan?.(sim, minX, maxX, side, rand, opts) || null;
    if (ML.WorldGenDirector && !plan) return discoveries;
    if (!ML.WorldGenDirector && !shouldPlaceSurfaceLandmark(sim, minX, maxX, side, rand)) return discoveries;
    const candidates = [];
    for (let tries = 0; tries < 160; tries += 1) {
      const x = minX + Math.floor(rand() * span);
      const y = sim.surfaceFloorY?.(x) ?? sim.surface?.[x] ?? 24;
      if (y < 17 || y > 36) continue;
      if (!solidAt(sim, x, y) || !sim.hasSurfaceClearance?.(x, y, 7)) continue;
      if (Math.abs(x - (sim.shaft?.x || -9999)) < 34) continue;
      if (nearSurfaceHumanMark(sim, x, 48)) continue;
      candidates.push({ x, y, roughness: surfaceRoughness(sim, x, 6) });
    }
    if (!candidates.length) return discoveries;

    const primary = candidates[Math.floor(rand() * candidates.length)];
    const structure = plan?.structure || null;
    if (structure === "hamlet" && candidates.length > 4 && primary.roughness <= 3) {
      sim.flattenSurfaceRange?.(primary.x - 8, primary.x - 2, primary.y);
      sim.flattenSurfaceRange?.(primary.x + 2, primary.x + 8, primary.y);
      sim.buildSurfaceShelter?.(primary.x - 5, primary.y, rand);
      sim.buildSurfaceShelter?.(primary.x + 6, primary.y, rand);
      if (rand() < 0.24) setTile(sim, primary.x, primary.y - 1, Tile.CAMPFIRE);
      discoveries.push(addSurfaceDiscovery(sim, plan?.type || "hamlet", primary.x - 9, side, rand, plan?.region));
    } else if ((structure === "waypost" || structure === "cache") && primary.roughness <= 4) {
      sim.flattenSurfaceRange?.(primary.x - 2, primary.x + 3, primary.y);
      if (rand() < 0.14) setTile(sim, primary.x + 2, primary.y - 1, Tile.CAMPFIRE);
      setTile(sim, primary.x - 2, primary.y - 1, Tile.CHEST);
      sim.registerChestTag?.(primary.x - 2, primary.y - 1, { type: plan?.region?.loot || "road", surfaceRegion: plan?.region?.id || null });
      discoveries.push(addSurfaceDiscovery(sim, plan?.type || "waypost", primary.x, side, rand, plan?.region));
    } else {
      const type = plan?.type || "sign";
      discoveries.push(addSurfaceDiscovery(sim, type, primary.x, side, rand, plan?.region));
    }
    for (const discovery of discoveries) {
      if (discovery) discovery.expansion = sim.stats?.horizontalExpansions || 0;
    }
    return discoveries.filter(Boolean);
  }

  function roomFloorTile(ctx) {
    const id = ctx.stratum?.id || "";
    if (id.includes("obsidian")) return Tile.OBSIDIAN;
    if ((ctx.depth || 0) > 160) return Tile.DEEP;
    return Tile.STONE;
  }

  function carveRoom(sim, centerX, objectY, width, ctx) {
    const worldW = widthOf(sim);
    const worldH = heightOf(sim);
    const roomW = clamp(Math.floor(width), 7, 13);
    const floorY = clamp(Math.floor(objectY) + 1, 6, worldH - 6);
    const left = clamp(Math.floor(centerX) - Math.floor(roomW / 2), 3, Math.max(3, worldW - roomW - 3));
    const right = left + roomW - 1;
    const top = clamp(floorY - 5, 2, floorY - 2);
    for (let x = left; x <= right; x += 1) {
      for (let y = top; y < floorY; y += 1) setTile(sim, x, y, AIR);
      setTile(sim, x, floorY, roomFloorTile(ctx));
    }
    return { left, right, top, floorY, y: floorY - 1, center: Math.floor((left + right) / 2) };
  }

  function placeIfOpen(sim, x, y, tile) {
    if (tileAt(sim, x, y) !== AIR || !solidAt(sim, x, y + 1)) return false;
    setTile(sim, x, y, tile);
    return true;
  }

  function titleFor(type, ctx) {
    return (DEEP_POIS[type]?.title || DEEP_POIS.survey.title)(ctx);
  }

  function messageFor(type, ctx) {
    return (DEEP_POIS[type]?.message || DEEP_POIS.survey.message)(ctx);
  }

  function placeUndergroundPOI(sim, type, spot, ctx) {
    const def = DEEP_POIS[type] || DEEP_POIS.survey;
    const room = carveRoom(sim, spot.x, spot.y, def.width, ctx);
    const signX = clamp(room.left + 2, room.left + 1, room.right - 1);
    const chestX = clamp(room.right - 2, room.left + 1, room.right - 1);
    const torchX = clamp(room.center, room.left + 1, room.right - 1);

    if (type === "pump") {
      for (let y = room.top; y <= room.floorY; y += 1) {
        if (y % 2 === 0) setTile(sim, room.center, y, Tile.LADDER);
      }
      if ((ctx.rand || Math.random)() < 0.18) placeIfOpen(sim, room.right - 1, room.y, Tile.CAMPFIRE);
    } else if (type === "shrine") {
      placeIfOpen(sim, room.left + 1, room.y, Tile.MUSHROOM);
      placeIfOpen(sim, room.right - 1, room.y, Tile.MUSHROOM);
      if ((ctx.rand || Math.random)() < 0.3) placeIfOpen(sim, room.center, room.y, Tile.CAMPFIRE);
    } else {
      placeIfOpen(sim, torchX, room.y, Tile.TORCH);
    }

    if (type !== "shrine") placeIfOpen(sim, chestX, room.y, Tile.CHEST);
    if (type === "cache") placeIfOpen(sim, room.left + 1, room.y, Tile.TORCH);

    // Distinct focal tile per POI type so survey/pump/shrine/cache read
    // differently in-world instead of all being the same sign.
    const poiTile = type === "pump" ? Tile.PUMP
      : type === "shrine" ? Tile.SHRINE
        : type === "cache" ? Tile.FORGEMARK
          : Tile.SIGN;
    return addDiscovery(sim, {
      scope: "underground",
      type,
      title: titleFor(type, ctx),
      message: messageFor(type, ctx),
      label: def.label,
      x: signX,
      y: room.y,
      source: ctx.source || "depth",
      tile: poiTile,
      rand: ctx.rand || Math.random
    });
  }

  function nearExistingDiscovery(sim, x, y, radius = 13) {
    return ensureDiscoveries(sim).some((entry) => Math.hypot((entry.x || 0) - x, (entry.y || 0) - y) < radius);
  }

  function findCaveSpots(sim, opts, rand) {
    const spots = [];
    const worldW = widthOf(sim);
    const worldH = heightOf(sim);
    const xMin = clamp(opts.xMin ?? 4, 4, worldW - 8);
    const xMax = clamp(opts.xMax ?? worldW - 5, xMin + 1, worldW - 5);
    const yMax = clamp(opts.yMax ?? worldH - 8, 12, worldH - 8);
    for (let tries = 0; tries < (opts.tries || 360); tries += 1) {
      const x = xMin + Math.floor(rand() * Math.max(1, xMax - xMin + 1));
      const minForX = typeof opts.yMinForX === "function" ? opts.yMinForX(x) : opts.yMin;
      const yMin = clamp(minForX ?? 34, 8, yMax - 1);
      if (yMin >= yMax) continue;
      const y = yMin + Math.floor(rand() * Math.max(1, yMax - yMin));
      const depth = sim.depthAtTile?.(x, y) ?? Math.max(0, y - (sim.surface?.[x] || 24));
      if (depth < (opts.minDepth ?? 18)) continue;
      if (tileAt(sim, x, y) !== AIR || !solidAt(sim, x, y + 1) || !hasClearance(sim, x, y, 4)) continue;
      if (nearExistingDiscovery(sim, x, y)) continue;
      spots.push({ x, y, depth });
      if (spots.length >= (opts.maxSpots || 8)) break;
    }
    return spots;
  }

  function fallbackSpot(sim, opts, rand) {
    const worldW = widthOf(sim);
    const worldH = heightOf(sim);
    const xMin = clamp(opts.xMin ?? 4, 4, worldW - 8);
    const xMax = clamp(opts.xMax ?? worldW - 5, xMin + 1, worldW - 5);
    const yMin = clamp(opts.yMin ?? 40, 10, worldH - 12);
    const yMax = clamp(opts.yMax ?? worldH - 8, yMin + 4, worldH - 8);
    const x = clamp(opts.entryX ?? Math.floor((xMin + xMax) / 2) + Math.floor((rand() - 0.5) * 14), xMin + 2, xMax - 2);
    const y = clamp(Math.floor((yMin + yMax) / 2), yMin + 2, yMax - 2);
    return { x, y, depth: sim.depthAtTile?.(x, y) ?? y };
  }

  function pickDeepTypes(ctx) {
    const depth = ctx.depth || 0;
    const source = ctx.source || "depth";
    if (source === "horizon") return depth > 120 ? ["pump", "cache", "survey"] : ["survey", "cache"];
    if (depth > 220) return ["shrine", "pump", "cache"];
    if (depth > 120) return ["pump", "survey", "cache"];
    return ["survey", "cache"];
  }

  function generateUndergroundLandmarks(sim, opts = {}) {
    ensureDiscoveries(sim);
    const rand = opts.rand || Math.random;
    const spots = findCaveSpots(sim, opts, rand);
    if (!spots.length) spots.push(fallbackSpot(sim, opts, rand));

    const target = clamp(opts.target ?? 1, 1, 3);
    const discoveries = [];
    for (let i = 0; i < spots.length && discoveries.length < target; i += 1) {
      const spot = spots[i];
      const stratum = opts.stratum || sim.stratumAt?.(spot.x, spot.y) || sim.stratumForDepth?.(spot.depth) || null;
      const ctx = {
        rand,
        source: opts.source || "depth",
        side: opts.side || null,
        depth: spot.depth,
        stratum,
        stratumName: stratum?.name || "unknown stratum"
      };
      const types = pickDeepTypes(ctx);
      const type = types[(i + Math.floor(rand() * types.length)) % types.length];
      const discovery = placeUndergroundPOI(sim, type, spot, ctx);
      if (discovery) discoveries.push(discovery);
    }
    return discoveries;
  }

  ML.POI = {
    addDiscovery,
    placeSurfaceSign,
    addSurfaceDiscovery,
    generateSurfaceLandmarks,
    generateUndergroundLandmarks
  };
})();
