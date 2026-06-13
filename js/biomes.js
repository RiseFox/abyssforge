// AbyssForge v2 - biome intelligence: properties, lore, and runtime effects.
(() => {
  "use strict";
  const ML = window.ML;
  const { WORLD_W, WORLD_H, AIR, Tile, BLOCKS, clamp } = ML;

  const BIOMES = {
    surface: {
      id: "surface",
      name: "Surface Ruins",
      tone: "Last honest sky",
      lore: "The guild camp still hears birds above the old lift scars.",
      effects: ["Daylight recovery", "Safe camp access", "Low pressure"],
      music: "surface",
      accent: "#94b76a",
      ambientFloor: 0.08,
      regenRate: 1.08,
      energyRate: 0.8,
      darkPressure: 0,
      darkDepth: 999
    },
    rootline: {
      id: "rootline",
      name: "Rootline Burrows",
      tone: "Soft earth",
      lore: "Roots stitch the first caves together before the stone turns cold.",
      effects: ["Soft soil", "Light recovery", "Common wood routes"],
      music: "cave",
      accent: "#9f8a54",
      ambientFloor: 0.1,
      regenRate: 1.14,
      energyRate: 0.25,
      darkPressure: 0,
      darkDepth: 999
    },
    stonewarrens: {
      id: "stonewarrens",
      name: "Stone Warrens",
      tone: "Working mine",
      lore: "Old dig teams left straight scars through stubborn stone.",
      effects: ["Stable rock", "Balanced threat", "Coal seams"],
      music: "cave",
      accent: "#9b9b8e",
      ambientFloor: 0.08,
      regenRate: 1,
      energyRate: 0,
      darkPressure: 0,
      darkDepth: 999
    },
    fungalhollow: {
      id: "fungalhollow",
      name: "Fungal Hollow",
      tone: "Living light",
      lore: "Glow caps drink cave wind and answer footsteps with cyan breath.",
      effects: ["Bioluminescence", "+Recovery", "Slime trails"],
      music: "treasure",
      accent: "#65d9cb",
      ambientFloor: 0.16,
      regenRate: 1.26,
      energyRate: 0.35,
      darkPressure: 0.35,
      darkDepth: 95,
      darkThreshold: 0.16
    },
    ironfault: {
      id: "ironfault",
      name: "Iron Fault",
      tone: "Ore pressure",
      lore: "Metal veins bend here, and the walls remember every hammer strike.",
      effects: ["Metal seams", "+Ore routes", "Tremor risk"],
      music: "cave",
      accent: "#cf9461",
      ambientFloor: 0.07,
      regenRate: 0.92,
      energyRate: -0.25,
      darkPressure: 0.6,
      darkDepth: 105,
      darkThreshold: 0.2
    },
    deepstone: {
      id: "deepstone",
      name: "Deepstone Pressure",
      tone: "Heavy dark",
      lore: "The mine stops sounding hollow and starts sounding hungry.",
      effects: ["Dark pressure", "Heavy mobs", "-Recovery"],
      music: "deep",
      accent: "#6f7480",
      ambientFloor: 0.06,
      regenRate: 0.76,
      energyRate: -0.55,
      darkPressure: 1.05,
      darkDepth: 115,
      darkThreshold: 0.22
    },
    crystalvein: {
      id: "crystalvein",
      name: "Crystal Vein",
      tone: "Vault signal",
      lore: "Pale crystal hums through the rock like a buried compass needle.",
      effects: ["Crystal glow", "+Energy trickle", "Vault signal"],
      music: "treasure",
      accent: "#8ff4e7",
      ambientFloor: 0.14,
      regenRate: 1.04,
      energyRate: 0.75,
      darkPressure: 0.9,
      darkDepth: 125,
      darkThreshold: 0.2
    },
    obsidianabyss: {
      id: "obsidianabyss",
      name: "Obsidian Abyss",
      tone: "Boss country",
      lore: "Lava glass and old bones mark the border of the Warden's forge.",
      effects: ["Severe darkness", "Lava heat", "Boss territory"],
      music: "deep",
      accent: "#b06be0",
      ambientFloor: 0.045,
      regenRate: 0.6,
      energyRate: -0.95,
      darkPressure: 1.55,
      darkDepth: 90,
      darkThreshold: 0.24
    }
  };

  const ORES = new Set([Tile.COAL, Tile.COPPER, Tile.IRON, Tile.GOLD, Tile.CRYSTAL, Tile.OBSIDIAN]);
  const ROOT_TILES = new Set([Tile.DIRT, Tile.GRASS, Tile.WOOD, Tile.LEAVES]);
  const IRON_TILES = new Set([Tile.COPPER, Tile.IRON, Tile.GOLD]);
  const CRYSTAL_TILES = new Set([Tile.CRYSTAL, Tile.GOLD]);
  const ABYSS_TILES = new Set([Tile.OBSIDIAN, Tile.LAVA, Tile.BEDROCK]);

  function depthAt(sim, x, y) {
    const tx = clamp(Math.floor(x), 0, WORLD_W - 1);
    return Math.max(0, Math.floor(y) - (sim.surface?.[tx] || 24));
  }

  function scan(sim, x, y, radius = 5) {
    const cx = clamp(Math.floor(x), 0, WORLD_W - 1);
    const cy = clamp(Math.floor(y), 0, WORLD_H - 1);
    const counts = {
      ore: 0,
      roots: 0,
      mushrooms: 0,
      iron: 0,
      crystal: 0,
      abyss: 0,
      air: 0,
      solid: 0
    };

    for (let yy = cy - radius; yy <= cy + radius; yy += 1) {
      for (let xx = cx - radius; xx <= cx + radius; xx += 1) {
        if (xx < 0 || yy < 0 || xx >= WORLD_W || yy >= WORLD_H) continue;
        const tile = sim.tileAt(xx, yy);
        if (tile === AIR) {
          counts.air += 1;
          continue;
        }
        if (BLOCKS[tile]?.solid) counts.solid += 1;
        if (ORES.has(tile)) counts.ore += 1;
        if (ROOT_TILES.has(tile)) counts.roots += 1;
        if (tile === Tile.MUSHROOM) counts.mushrooms += 1;
        if (IRON_TILES.has(tile)) counts.iron += 1;
        if (CRYSTAL_TILES.has(tile)) counts.crystal += 1;
        if (ABYSS_TILES.has(tile)) counts.abyss += 1;
      }
    }

    return counts;
  }

  function chooseBiome(sim, x, y) {
    const depth = depthAt(sim, x, y);
    const counts = scan(sim, x, y, depth > 120 ? 6 : 5);

    if (depth <= 8) return BIOMES.surface;
    if (depth > 188 || counts.abyss >= 5) return BIOMES.obsidianabyss;
    if (depth > 118 && counts.crystal >= 2) return BIOMES.crystalvein;
    if (depth > 138) return BIOMES.deepstone;
    if (depth > 70 && (counts.iron >= 3 || counts.ore >= 6)) return BIOMES.ironfault;
    if (depth > 18 && counts.mushrooms >= 1) return BIOMES.fungalhollow;
    if (depth <= 38 && counts.roots >= 7) return BIOMES.rootline;
    if (depth > 68) return BIOMES.ironfault;
    if (depth > 34) return BIOMES.stonewarrens;
    return BIOMES.rootline;
  }

  function biomeAt(sim, x, y) {
    if (!sim?.world) return BIOMES.surface;
    return chooseBiome(sim, x, y);
  }

  function current(sim, player) {
    if (!player) return BIOMES.surface;
    return biomeAt(sim, Math.floor(player.x / ML.TILE), Math.floor(player.y / ML.TILE));
  }

  function effectText(biome) {
    return (biome?.effects || []).join(" · ");
  }

  function transitionText(biome) {
    if (!biome) return "";
    return `${biome.name}: ${effectText(biome)}`;
  }

  Object.assign(ML, {
    BIOMES,
    BiomeSystem: {
      biomeAt,
      current,
      depthAt,
      effectText,
      transitionText
    }
  });
})();
