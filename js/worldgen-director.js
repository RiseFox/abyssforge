// AbyssForge v2 - world generation director: biome pacing, setpieces, loot, and spawn budgets.
(() => {
  "use strict";
  const ML = window.ML;
  const { AIR, Tile, BLOCKS, clamp } = ML;

  const SURFACE_REGIONS = [
    {
      id: "greenroad",
      name: "Green Road",
      tone: "quiet return path",
      minDistance: 0,
      weight: 1.55,
      landmarkCadence: 5,
      landmarkChance: 0.04,
      setpieceChance: 0.08,
      loot: "surface",
      treeScale: 1.08
    },
    {
      id: "brokenroad",
      name: "Broken Road",
      tone: "old route markers",
      minDistance: 160,
      weight: 1.1,
      landmarkCadence: 4,
      landmarkChance: 0.12,
      setpieceChance: 0.18,
      loot: "road",
      treeScale: 0.72
    },
    {
      id: "deadgrove",
      name: "Dead Grove",
      tone: "silent timber",
      minDistance: 260,
      weight: 0.95,
      landmarkCadence: 4,
      landmarkChance: 0.1,
      setpieceChance: 0.2,
      loot: "grove",
      treeScale: 0.42
    },
    {
      id: "lowland",
      name: "Sunken Lowland",
      tone: "soft ground",
      minDistance: 340,
      weight: 0.82,
      landmarkCadence: 3,
      landmarkChance: 0.1,
      setpieceChance: 0.16,
      loot: "lowland",
      treeScale: 0.86
    },
    {
      id: "oldvillage",
      name: "Unlit Village",
      tone: "abandoned surface camp",
      minDistance: 520,
      weight: 0.58,
      landmarkCadence: 3,
      landmarkChance: 0.18,
      setpieceChance: 0.26,
      loot: "village",
      treeScale: 0.65
    },
    {
      id: "watcherfield",
      name: "Watcher Field",
      tone: "wrong shadows",
      minDistance: 720,
      weight: 0.42,
      landmarkCadence: 2,
      landmarkChance: 0.16,
      setpieceChance: 0.2,
      loot: "watcher",
      treeScale: 0.38
    }
  ];

  const SURFACE_MESSAGES = {
    brokenroad: [
      "The road repeats in sections the survey team never built.",
      "Track sleepers end here, but the footprints continue."
    ],
    deadgrove: [
      "The tree rings count days that have not happened yet.",
      "No birds nest here. The leaves learned to wait."
    ],
    lowland: [
      "Soft ground took the cart first. The manifest says it arrived tomorrow.",
      "The soil holds lamp glass, boot prints, and no rain."
    ],
    oldvillage: [
      "The houses face the shaft from too far away. Someone planned this road around you.",
      "A table is set for a miner who has not found this place yet."
    ],
    watcherfield: [
      "Every shadow points at the player, not the sun.",
      "The mark is not written for the miner. It is written for whoever is watching."
    ],
    greenroad: [
      "Guild paint fades quickly here. The mine does not like exits.",
      "The grass is real enough until you count the same hill twice."
    ]
  };

  const CHEST_TABLES = {
    surface: {
      label: "Surface cache",
      base: { wood: [1, 3], torch: [2, 4], coin: [4, 8] },
      rolls: [
        { item: "mapScrap", chance: 0.34, min: 1, max: 2 },
        { item: "sealedLetter", chance: 0.12, min: 1, max: 1 },
        { item: "kit", chance: 0.22, min: 1, max: 1 },
        { item: "oldCompass", chance: 0.08, min: 1, max: 1 }
      ]
    },
    road: {
      label: "Road cache",
      base: { ladder: [3, 8], coin: [5, 12], torch: [2, 5] },
      rolls: [
        { item: "mapScrap", chance: 0.42, min: 1, max: 2 },
        { item: "oldCompass", chance: 0.16, min: 1, max: 1 },
        { item: "charge", chance: 0.18, min: 1, max: 2 }
      ]
    },
    grove: {
      label: "Grove cache",
      base: { wood: [3, 8], coal: [1, 3], coin: [3, 9] },
      rolls: [
        { item: "amber", chance: 0.34, min: 1, max: 2 },
        { item: "silk", chance: 0.16, min: 1, max: 2 },
        { item: "sealedLetter", chance: 0.1, min: 1, max: 1 }
      ]
    },
    lowland: {
      label: "Sunken crate",
      base: { mushroom: [1, 3], gel: [1, 4], coin: [3, 8] },
      rolls: [
        { item: "kit", chance: 0.22, min: 1, max: 1 },
        { item: "battery", chance: 0.24, min: 1, max: 2 },
        { item: "mirrorShard", chance: 0.08, min: 1, max: 1 }
      ]
    },
    village: {
      label: "Village lockbox",
      base: { coin: [9, 20], kit: [1, 1], torch: [2, 5] },
      rolls: [
        { item: "sealedLetter", chance: 0.34, min: 1, max: 1 },
        { item: "strangeKey", chance: 0.12, min: 1, max: 1 },
        { item: "oldCompass", chance: 0.2, min: 1, max: 1 },
        { item: "relic", chance: 0.08, min: 1, max: 1 }
      ]
    },
    watcher: {
      label: "Unmarked cache",
      base: { coin: [1, 7], mapScrap: [1, 2] },
      rolls: [
        { item: "watcherToken", chance: 0.38, min: 1, max: 1 },
        { item: "mirrorShard", chance: 0.2, min: 1, max: 1 },
        { item: "voidglass", chance: 0.08, min: 1, max: 1 },
        { item: "strangeKey", chance: 0.12, min: 1, max: 1 }
      ]
    },
    cave: {
      label: "Cave cache",
      base: { coal: [2, 4], coin: [4, 10] },
      rolls: [
        { item: "torch", chance: 0.72, min: 2, max: 4 },
        { item: "ladder", chance: 0.62, min: 2, max: 5 },
        { item: "charge", chance: 0.28, min: 1, max: 2 },
        { item: "battery", chance: 0.28, min: 1, max: 2 },
        { item: "kit", chance: 0.18, min: 1, max: 1 }
      ]
    },
    fungal: {
      label: "Fungal cache",
      base: { mushroom: [2, 5], gel: [2, 5], coin: [3, 8] },
      rolls: [
        { item: "silk", chance: 0.24, min: 1, max: 2 },
        { item: "kit", chance: 0.24, min: 1, max: 1 },
        { item: "quartz", chance: 0.1, min: 1, max: 1 }
      ]
    },
    iron: {
      label: "Fault cache",
      base: { coal: [2, 5], copper: [1, 3], coin: [5, 12] },
      rolls: [
        { item: "iron", chance: 0.36, min: 1, max: 3 },
        { item: "charge", chance: 0.3, min: 1, max: 2 },
        { item: "battery", chance: 0.24, min: 1, max: 2 },
        { item: "clockwork", chance: 0.08, min: 1, max: 1 }
      ]
    },
    crystal: {
      label: "Signal cache",
      base: { quartz: [1, 3], coin: [7, 14], battery: [1, 2] },
      rolls: [
        { item: "crystal", chance: 0.34, min: 1, max: 2 },
        { item: "mirrorShard", chance: 0.18, min: 1, max: 1 },
        { item: "relic", chance: 0.08, min: 1, max: 1 }
      ]
    },
    abyss: {
      label: "Abyss cache",
      base: { obsidian: [1, 3], ember: [1, 2], coin: [8, 18] },
      rolls: [
        { item: "voidglass", chance: 0.18, min: 1, max: 2 },
        { item: "relic", chance: 0.2, min: 1, max: 2 },
        { item: "core", chance: 0.055, min: 1, max: 1 },
        { item: "watcherToken", chance: 0.14, min: 1, max: 1 }
      ]
    },
    secret: {
      label: "Secret cache",
      base: { coin: [14, 28], relic: [1, 2], silk: [1, 3], battery: [1, 2] },
      rolls: [
        { item: "strangeKey", chance: 0.22, min: 1, max: 1 },
        { item: "mirrorShard", chance: 0.24, min: 1, max: 1 },
        { item: "clockwork", chance: 0.16, min: 1, max: 1 },
        { item: "watcherToken", chance: 0.16, min: 1, max: 1 }
      ]
    }
  };

  function hash32(value) {
    value |= 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  }

  function unit(seed, a = 0, b = 0) {
    return hash32((seed || 0) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)) / 4294967295;
  }

  function widthOf(sim) {
    return sim?.worldWidth?.() || sim?.world?.[0]?.length || ML.WORLD_W;
  }

  function heightOf(sim) {
    return sim?.worldHeight?.() || sim?.world?.length || ML.WORLD_H;
  }

  function tileAt(sim, x, y) {
    if (!sim || x < 0 || y < 0 || x >= widthOf(sim) || y >= heightOf(sim)) return Tile.BEDROCK;
    return sim.world[y][x];
  }

  function setTile(sim, x, y, tile) {
    if (!sim || x < 0 || y < 0 || x >= widthOf(sim) || y >= heightOf(sim)) return false;
    sim.world[y][x] = tile;
    if (tile === Tile.CHEST) sim.registerChestTag?.(x, y, { type: "director", surfaceRegion: surfaceRegionAt(sim, x).id });
    return true;
  }

  function solidAt(sim, x, y) {
    const tile = tileAt(sim, x, y);
    return tile !== AIR && Boolean(BLOCKS[tile]?.solid);
  }

  function openAt(sim, x, y) {
    return tileAt(sim, x, y) === AIR;
  }

  function clearAbove(sim, x, floorY, height = 5) {
    for (let y = floorY - height; y < floorY; y += 1) {
      if (!openAt(sim, x, y) && BLOCKS[tileAt(sim, x, y)]?.solid) return false;
    }
    return true;
  }

  function originX(sim) {
    return sim?.shaft?.x || sim?.spawn?.x || Math.floor(widthOf(sim) / 2);
  }

  function surfaceRegionAt(sim, x) {
    const origin = originX(sim);
    const distance = Math.abs(Math.floor(x) - origin);
    const chunk = Math.floor((Math.floor(x) - origin) / 56);
    const candidates = SURFACE_REGIONS.filter((region) => distance >= region.minDistance);
    const pool = candidates.length ? candidates : [SURFACE_REGIONS[0]];
    let total = 0;
    for (const region of pool) {
      total += region.weight * (1 + Math.min(1.4, distance / 900) * (region.minDistance > 0 ? 0.42 : -0.18));
    }
    let roll = unit(sim?.seed || 0, chunk, 17) * total;
    for (const region of pool) {
      roll -= region.weight * (1 + Math.min(1.4, distance / 900) * (region.minDistance > 0 ? 0.42 : -0.18));
      if (roll <= 0) return region;
    }
    return pool[pool.length - 1];
  }

  function surfaceRegionForRange(sim, minX, maxX) {
    const samples = [
      minX,
      Math.floor((minX + maxX) / 2),
      maxX
    ];
    const counts = {};
    for (const x of samples) {
      const region = surfaceRegionAt(sim, x);
      counts[region.id] = (counts[region.id] || 0) + 1;
    }
    const id = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return SURFACE_REGIONS.find((region) => region.id === id) || surfaceRegionAt(sim, Math.floor((minX + maxX) / 2));
  }

  function terrainBias(sim, x) {
    const region = surfaceRegionAt(sim, x);
    return {
      region,
      treeScale: region.treeScale ?? 1,
      roughness: region.id === "lowland" ? -0.15 : region.id === "brokenroad" ? 0.1 : region.id === "watcherfield" ? 0.16 : 0
    };
  }

  function lastSurfaceExpansion(sim) {
    return (sim?.surfaceDiscoveries || [])
      .filter((entry) => entry.scope !== "underground" && Number.isFinite(entry.expansion))
      .reduce((latest, entry) => Math.max(latest, entry.expansion), -99);
  }

  function surfaceLandmarkPlan(sim, minX, maxX, side, rand = Math.random) {
    const origin = originX(sim);
    const midpoint = Math.floor((minX + maxX) / 2);
    const distance = Math.abs(midpoint - origin);
    const region = surfaceRegionForRange(sim, minX, maxX);
    if (distance < 150) return null;
    const expansionIndex = sim.stats?.horizontalExpansions || 0;
    if (expansionIndex - lastSurfaceExpansion(sim) < 3) return null;
    const cadence = region.landmarkCadence || (distance < 520 ? 4 : 3);
    const phase = Math.abs((sim.seed || 0) % cadence);
    const sidePhase = side === "left" ? 2 : 0;
    const cadenceHit = ((expansionIndex + sidePhase + phase) % cadence) === 0;
    const distanceBonus = clamp(distance / 4200, 0, 0.18);
    if (!cadenceHit && rand() >= (region.landmarkChance + distanceBonus)) return null;
    const roll = rand();
    if (region.id === "oldvillage" && roll < 0.5) return { type: "hamlet", structure: "hamlet", region };
    if (region.id === "watcherfield" && roll < 0.62) return { type: "watcher", structure: "sign", region };
    if (region.id === "brokenroad" && roll < 0.46) return { type: "waypost", structure: "waypost", region };
    if (region.id === "deadgrove" && roll < 0.38) return { type: "grove", structure: "sign", region };
    if (region.id === "lowland" && roll < 0.42) return { type: "lowland", structure: "cache", region };
    return { type: "sign", structure: "sign", region };
  }

  function surfaceTitle(type, side, region) {
    const sideName = side === "left" ? "western" : "eastern";
    if (type === "watcher") return `${region?.name || "Watcher Field"} mark`;
    if (type === "grove") return `${sideName} dead grove`;
    if (type === "lowland") return `${sideName} lowland cache`;
    if (type === "hamlet") return `silent ${sideName} hamlet`;
    if (type === "waypost") return `${sideName} waypost`;
    return `${sideName} ${region?.name || "road"} sign`;
  }

  function surfaceMessage(type, side, distance, rand = Math.random, region = null) {
    if (type === "waypost") return `The ${side === "left" ? "western" : "eastern"} waypost still has warm ash. Someone crossed ${distance} tiles from the shaft and did not return underground.`;
    if (type === "hamlet") return "A dead surface hamlet: roofs, a cache, and no footprints. The mine was not the only place that moved.";
    const list = SURFACE_MESSAGES[type] || SURFACE_MESSAGES[region?.id] || SURFACE_MESSAGES.greenroad;
    return list[Math.floor(rand() * list.length)];
  }

  function surfaceLabel(type) {
    if (type === "hamlet") return "SILENT HAMLET";
    if (type === "waypost") return "WAYPOST";
    if (type === "watcher") return "WATCHER MARK";
    if (type === "grove") return "DEAD GROVE";
    if (type === "lowland") return "SUNKEN CACHE";
    return "ROAD MARK";
  }

  function findSurfaceCandidates(sim, minX, maxX, rand, max = 8) {
    const spots = [];
    for (let tries = 0; tries < 120 && spots.length < max; tries += 1) {
      const x = minX + Math.floor(rand() * Math.max(1, maxX - minX + 1));
      const y = sim.surfaceFloorY?.(x) ?? sim.surface?.[x] ?? 24;
      if (y < 17 || y > 37) continue;
      if (!solidAt(sim, x, y) || !clearAbove(sim, x, y, 5)) continue;
      if (Math.abs(x - originX(sim)) < 36) continue;
      spots.push({ x, y, region: surfaceRegionAt(sim, x) });
    }
    return spots;
  }

  function placeRoadBits(sim, spot, rand) {
    const len = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < len; i += 1) {
      const x = spot.x + i;
      const y = sim.surfaceFloorY?.(x) ?? spot.y;
      if (!solidAt(sim, x, y) || !clearAbove(sim, x, y, 3)) continue;
      setTile(sim, x, y - 1, Tile.PLATFORM);
    }
    if (rand() < 0.42) setTile(sim, spot.x - 1, spot.y - 1, Tile.WOOD);
    return { type: "road", chests: 0, camps: 0 };
  }

  function placeDeadGrove(sim, spot, rand) {
    const trunk = 2 + Math.floor(rand() * 3);
    for (let y = spot.y - trunk; y < spot.y; y += 1) setTile(sim, spot.x, y, Tile.WOOD);
    if (rand() < 0.26 && openAt(sim, spot.x + 2, spot.y - 1)) {
      setTile(sim, spot.x + 2, spot.y - 1, Tile.CHEST);
      sim.registerChestTag?.(spot.x + 2, spot.y - 1, { type: "grove", surfaceRegion: "deadgrove" });
      return { type: "deadgrove", chests: 1, camps: 0 };
    }
    return { type: "deadgrove", chests: 0, camps: 0 };
  }

  function placeLowlandCache(sim, spot, rand) {
    if (openAt(sim, spot.x, spot.y - 1)) setTile(sim, spot.x, spot.y - 1, Tile.MUSHROOM);
    if (rand() < 0.22 && openAt(sim, spot.x + 2, spot.y - 1)) {
      setTile(sim, spot.x + 2, spot.y - 1, Tile.CHEST);
      sim.registerChestTag?.(spot.x + 2, spot.y - 1, { type: "lowland", surfaceRegion: "lowland" });
      return { type: "lowland", chests: 1, camps: 0 };
    }
    return { type: "lowland", chests: 0, camps: 0 };
  }

  function placeVillageRuin(sim, spot, rand) {
    sim.flattenSurfaceRange?.(spot.x - 3, spot.x + 4, spot.y);
    sim.buildSurfaceShelter?.(spot.x, spot.y, rand);
    const chestX = spot.x + 5;
    if (rand() < 0.32 && openAt(sim, chestX, spot.y - 1)) {
      setTile(sim, chestX, spot.y - 1, Tile.CHEST);
      sim.registerChestTag?.(chestX, spot.y - 1, { type: "village", surfaceRegion: "oldvillage" });
      return { type: "village", chests: 1, camps: 0 };
    }
    return { type: "village", chests: 0, camps: 0 };
  }

  function placeWatcherTrace(sim, spot, rand) {
    const x = spot.x;
    if (openAt(sim, x, spot.y - 1)) setTile(sim, x, spot.y - 1, Tile.OBSIDIAN);
    if (openAt(sim, x + 1, spot.y - 1) && rand() < 0.5) setTile(sim, x + 1, spot.y - 1, Tile.TORCH);
    if (openAt(sim, x - 2, spot.y - 1) && rand() < 0.18) {
      setTile(sim, x - 2, spot.y - 1, Tile.CHEST);
      sim.registerChestTag?.(x - 2, spot.y - 1, { type: "watcher", surfaceRegion: "watcherfield" });
      return { type: "watcher", chests: 1, camps: 0 };
    }
    return { type: "watcher", chests: 0, camps: 0 };
  }

  function decorateSurfaceRegion(sim, regionStart, regionEnd, side, rand = Math.random) {
    const minX = clamp(regionStart + 8, 4, widthOf(sim) - 6);
    const maxX = clamp(regionEnd - 8, minX, widthOf(sim) - 6);
    const region = surfaceRegionForRange(sim, minX, maxX);
    const distance = Math.abs(Math.floor((minX + maxX) / 2) - originX(sim));
    const expansionIndex = sim.stats?.horizontalExpansions || 0;
    const chance = region.setpieceChance + clamp(distance / 4600, 0, 0.16);
    if (distance < 120 || rand() > chance) return { region: region.id, setpieces: 0, chests: 0, camps: 0 };
    if (expansionIndex > 0 && expansionIndex % 2 === 1 && rand() > 0.45) return { region: region.id, setpieces: 0, chests: 0, camps: 0 };
    const candidates = findSurfaceCandidates(sim, minX, maxX, rand, 6);
    if (!candidates.length) return { region: region.id, setpieces: 0, chests: 0, camps: 0 };
    const spot = candidates[Math.floor(rand() * candidates.length)];
    let result;
    if (region.id === "brokenroad") result = placeRoadBits(sim, spot, rand);
    else if (region.id === "deadgrove") result = placeDeadGrove(sim, spot, rand);
    else if (region.id === "lowland") result = placeLowlandCache(sim, spot, rand);
    else if (region.id === "oldvillage") result = placeVillageRuin(sim, spot, rand);
    else if (region.id === "watcherfield") result = placeWatcherTrace(sim, spot, rand);
    else result = rand() < 0.18 ? placeLowlandCache(sim, spot, rand) : placeRoadBits(sim, spot, rand);
    return {
      region: region.id,
      setpieces: 1,
      chests: result.chests || 0,
      camps: result.camps || 0,
      type: result.type
    };
  }

  function chestTag(sim, x, y) {
    return sim?.chestTags?.[`${Math.floor(x)}:${Math.floor(y)}`] || null;
  }

  function chestTableFor(sim, x, y, secret = null) {
    const depth = Math.max(0, Math.floor(y) - (sim.surface?.[Math.floor(x)] || 24));
    const tag = chestTag(sim, x, y);
    if (secret) return CHEST_TABLES.secret;
    if (tag?.type && CHEST_TABLES[tag.type]) return CHEST_TABLES[tag.type];
    if (depth <= 10) return CHEST_TABLES[surfaceRegionAt(sim, x).loot] || CHEST_TABLES.surface;
    const biome = ML.BiomeSystem?.biomeAt?.(sim, x, y);
    if (biome?.id === "fungalhollow") return CHEST_TABLES.fungal;
    if (biome?.id === "ironfault") return CHEST_TABLES.iron;
    if (biome?.id === "crystalvein") return CHEST_TABLES.crystal;
    if (biome?.id === "obsidianabyss" || biome?.id === "deepstone") return CHEST_TABLES.abyss;
    return CHEST_TABLES.cave;
  }

  function addRange(loot, item, range, rand) {
    const min = Math.max(0, range?.[0] || 0);
    const max = Math.max(min, range?.[1] || min);
    if (!item || max <= 0) return;
    loot[item] = (loot[item] || 0) + min + Math.floor(rand() * (max - min + 1));
  }

  function rollChestLoot(sim, x, y, options = {}) {
    const rand = options.rand || Math.random;
    const secret = options.secret || null;
    const depth = Math.max(0, Math.floor(y) - (sim.surface?.[Math.floor(x)] || 24));
    const table = chestTableFor(sim, x, y, secret);
    const loot = {};
    for (const [item, range] of Object.entries(table.base || {})) addRange(loot, item, range, rand);
    const rollCount = secret ? 5 : depth > 150 ? 4 : depth > 70 ? 3 : 2;
    for (const entry of table.rolls || []) {
      const depthBonus = depth > 120 ? 0.06 : depth > 70 ? 0.035 : 0;
      const chance = (entry.chance || 0) + depthBonus + (secret ? 0.12 : 0) + (sim.lootBonus ? 0.045 : 0);
      if (rand() >= chance) continue;
      addRange(loot, entry.item, [entry.min || 1, entry.max || entry.min || 1], rand);
    }
    for (let i = 0; i < rollCount; i += 1) {
      const entry = (table.rolls || [])[Math.floor(rand() * Math.max(1, (table.rolls || []).length))];
      if (!entry || rand() > 0.48) continue;
      addRange(loot, entry.item, [entry.min || 1, entry.max || entry.min || 1], rand);
    }
    for (const entry of ML.CHEST_SURPRISES || []) {
      if (depth < (entry.minDepth || 0)) continue;
      const chance = (entry.chance || 0) + (secret ? (entry.secretBonus || 0) : 0) + (sim.lootBonus ? (entry.lootBonus || 0.025) : 0);
      if (rand() >= chance) continue;
      addRange(loot, entry.item, [entry.min || 1, entry.max || entry.min || 1], rand);
    }
    if (sim.lootBonus) loot.coin = (loot.coin || 0) + 6 + Math.floor(rand() * 8);
    return { label: table.label, loot, tableId: Object.keys(CHEST_TABLES).find((key) => CHEST_TABLES[key] === table) || "cave" };
  }

  function spawnBudgetFor(sim, x, y, context = {}) {
    const depth = sim.mobDepthAt?.(x, y) ?? Math.max(0, y - (sim.surface?.[x] || 24));
    const biomeId = sim.mobBiomeIdAt?.(x, y) || "surface";
    let density = depth > 180 ? 0.054 : depth > 90 ? 0.04 : 0.026;
    if (biomeId === "fungalhollow") density *= 1.18;
    if (biomeId === "obsidianabyss" || biomeId === "deepstone") density *= 1.2;
    if (context.horizon) density *= 0.82;
    if (context.repopulate) density *= 0.72;
    const eliteChance = depth > 160 ? 0.09 : depth > 80 ? 0.048 : 0.02;
    return { density, eliteChance, biomeId, depth };
  }

  Object.assign(ML, {
    SURFACE_REGIONS,
    CHEST_TABLES,
    WorldGenDirector: {
      surfaceRegionAt,
      surfaceRegionForRange,
      terrainBias,
      surfaceLandmarkPlan,
      surfaceTitle,
      surfaceMessage,
      surfaceLabel,
      decorateSurfaceRegion,
      rollChestLoot,
      spawnBudgetFor,
      chestTableFor
    }
  });
})();
