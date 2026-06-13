// AbyssForge v2 - shared constants and game data.
window.ML = window.ML || {};
(() => {
  "use strict";

  const TILE = 32;
  const WORLD_W = 180;
  const WORLD_H = 300;
  const HORIZONTAL_EXPAND_COLUMNS = 96;
  const AIR = -1;
  const DAY_LENGTH = 240; // seconds for a full day/night cycle

  const Tile = {
    GRASS: 0,
    DIRT: 1,
    STONE: 2,
    COAL: 3,
    COPPER: 4,
    IRON: 5,
    CRYSTAL: 6,
    DEEP: 7,
    BEDROCK: 8,
    WOOD: 9,
    LEAVES: 10,
    TORCH: 11,
    LADDER: 12,
    PLATFORM: 13,
    GOLD: 14,
    OBSIDIAN: 15,
    LAVA: 16,
    MUSHROOM: 17,
    CHEST: 18,
    CAMPFIRE: 19,
    SIGN: 20,
    AMBER: 21,
    QUARTZ: 22,
    EMBER: 23,
    VOIDGLASS: 24
  };

  // light: glow radius in tiles for the lightmap; hazard: damage per second on contact.
  const BLOCKS = {
    [Tile.GRASS]: { name: "Grass", drop: "dirt", hardness: 0.45, tier: 1, solid: true },
    [Tile.DIRT]: { name: "Dirt", drop: "dirt", hardness: 0.35, tier: 1, solid: true },
    [Tile.STONE]: { name: "Stone", drop: "stone", hardness: 0.95, tier: 1, solid: true },
    [Tile.COAL]: { name: "Coal seam", drop: "coal", hardness: 1.05, tier: 1, solid: true },
    [Tile.COPPER]: { name: "Copper ore", drop: "copper", hardness: 1.35, tier: 2, solid: true },
    [Tile.IRON]: { name: "Iron ore", drop: "iron", hardness: 1.75, tier: 3, solid: true },
    [Tile.CRYSTAL]: { name: "Crystal ore", drop: "crystal", hardness: 2.35, tier: 4, solid: true },
    [Tile.DEEP]: { name: "Deepstone", drop: "stone", hardness: 2.0, tier: 3, solid: true },
    [Tile.BEDROCK]: { name: "Bedrock", drop: null, hardness: 999, tier: 99, solid: true },
    [Tile.WOOD]: { name: "Wood", drop: "wood", hardness: 0.5, tier: 1, solid: true },
    [Tile.LEAVES]: { name: "Leaves", drop: "wood", hardness: 0.25, tier: 1, solid: true },
    [Tile.TORCH]: { name: "Torch", drop: "torch", hardness: 0.15, tier: 1, solid: false, light: 6.4 },
    [Tile.LADDER]: { name: "Ladder", drop: "ladder", hardness: 0.2, tier: 1, solid: false },
    [Tile.PLATFORM]: { name: "Platform", drop: "platform", hardness: 0.3, tier: 1, solid: true, platform: true },
    [Tile.GOLD]: { name: "Gold ore", drop: "gold", hardness: 2.05, tier: 4, solid: true },
    [Tile.OBSIDIAN]: { name: "Obsidian", drop: "obsidian", hardness: 3.1, tier: 5, solid: true },
    [Tile.LAVA]: { name: "Lava", drop: null, hardness: 999, tier: 99, solid: false, hazard: 16, light: 3.6 },
    [Tile.MUSHROOM]: { name: "Glow cap", drop: "mushroom", hardness: 0.15, tier: 1, solid: false, light: 2.8 },
    [Tile.CHEST]: { name: "Supply chest", drop: null, loot: true, hardness: 0.6, tier: 1, solid: true },
    [Tile.CAMPFIRE]: { name: "Campfire", drop: "wood", hardness: 0.5, tier: 1, solid: false, light: 7.2, camp: true },
    [Tile.SIGN]: { name: "Road sign", drop: "wood", hardness: 0.25, tier: 1, solid: false, readable: true },
    [Tile.AMBER]: { name: "Amber knot", drop: "amber", hardness: 0.7, tier: 1, solid: true },
    [Tile.QUARTZ]: { name: "Quartz vein", drop: "quartz", hardness: 1.55, tier: 2, solid: true },
    [Tile.EMBER]: { name: "Ember shale", drop: "ember", hardness: 2.55, tier: 4, solid: true, light: 0.9 },
    [Tile.VOIDGLASS]: { name: "Voidglass seam", drop: "voidglass", hardness: 3.35, tier: 5, solid: true, light: 0.45 }
  };

  const SOLID_TILES = Object.keys(BLOCKS).map(Number).filter((id) => BLOCKS[id].solid);

  // Particle burst tints when a block breaks.
  const BLOCK_TINTS = {
    [Tile.GRASS]: 0x6f9152,
    [Tile.DIRT]: 0x8c643c,
    [Tile.STONE]: 0x8f8a7d,
    [Tile.COAL]: 0x3a3a3a,
    [Tile.COPPER]: 0xd38a54,
    [Tile.IRON]: 0xd6d5cb,
    [Tile.CRYSTAL]: 0x9efff0,
    [Tile.DEEP]: 0x5a5d64,
    [Tile.BEDROCK]: 0x444448,
    [Tile.WOOD]: 0xa26832,
    [Tile.LEAVES]: 0x6fae58,
    [Tile.TORCH]: 0xf2c35f,
    [Tile.LADDER]: 0xb37236,
    [Tile.PLATFORM]: 0x9d6734,
    [Tile.GOLD]: 0xf0c75e,
    [Tile.OBSIDIAN]: 0x4a2f73,
    [Tile.LAVA]: 0xff7a2e,
    [Tile.MUSHROOM]: 0x6fe3d2,
    [Tile.CHEST]: 0xcaa258,
    [Tile.CAMPFIRE]: 0xf0a84d,
    [Tile.SIGN]: 0xd6b16a,
    [Tile.AMBER]: 0xe1a84d,
    [Tile.QUARTZ]: 0xd8fff7,
    [Tile.EMBER]: 0xff6f35,
    [Tile.VOIDGLASS]: 0x6f63ff
  };

  // Minimap pixel colors.
  const MAP_COLORS = {
    [Tile.GRASS]: "#6f9152",
    [Tile.DIRT]: "#785331",
    [Tile.STONE]: "#777a76",
    [Tile.COAL]: "#3c3c3c",
    [Tile.COPPER]: "#c97f4d",
    [Tile.IRON]: "#cfcabb",
    [Tile.CRYSTAL]: "#7be3d4",
    [Tile.DEEP]: "#45474c",
    [Tile.BEDROCK]: "#1c1c1f",
    [Tile.WOOD]: "#74471f",
    [Tile.LEAVES]: "#456d3e",
    [Tile.TORCH]: "#f3ce62",
    [Tile.LADDER]: "#b37135",
    [Tile.PLATFORM]: "#8d5b2e",
    [Tile.GOLD]: "#f0c75e",
    [Tile.OBSIDIAN]: "#3a2752",
    [Tile.LAVA]: "#e25822",
    [Tile.MUSHROOM]: "#6fe3d2",
    [Tile.CHEST]: "#caa258",
    [Tile.CAMPFIRE]: "#f0a84d",
    [Tile.SIGN]: "#d6b16a",
    [Tile.AMBER]: "#d69445",
    [Tile.QUARTZ]: "#c9fff6",
    [Tile.EMBER]: "#db5f33",
    [Tile.VOIDGLASS]: "#5244b8"
  };

  const ITEM_META = {
    dirt: { name: "Dirt", cls: "icon-dirt", tile: Tile.DIRT, tint: 0x8c643c },
    stone: { name: "Stone", cls: "icon-stone", tile: Tile.STONE, tint: 0x8f8a7d },
    wood: { name: "Wood", cls: "icon-wood", tile: Tile.WOOD, tint: 0xa26832 },
    coal: { name: "Coal", cls: "icon-coal", tint: 0x4a4a4a },
    copper: { name: "Copper", cls: "icon-copper", tint: 0xd38a54 },
    iron: { name: "Iron", cls: "icon-iron", tint: 0xd6d5cb },
    gold: { name: "Gold", cls: "icon-gold", tint: 0xf0c75e },
    crystal: { name: "Crystal", cls: "icon-crystal", tint: 0x9efff0 },
    obsidian: { name: "Obsidian", cls: "icon-obsidian", tint: 0x6a4ba3 },
    amber: { name: "Amber", cls: "icon-amber", tint: 0xe1a84d },
    quartz: { name: "Quartz", cls: "icon-quartz", tint: 0xd8fff7 },
    ember: { name: "Ember shard", cls: "icon-ember", tint: 0xff6f35 },
    voidglass: { name: "Voidglass", cls: "icon-voidglass", tint: 0x7f73ff },
    gel: { name: "Gel", cls: "icon-gel", tint: 0x72d8ff },
    coin: { name: "Coins", cls: "icon-coin", tint: 0xf0c75e },
    silk: { name: "Silk", cls: "icon-silk", tint: 0xd8d3f0 },
    fang: { name: "Fang", cls: "icon-fang", tint: 0xe9ddc7 },
    relic: { name: "Ancient relic", cls: "icon-relic", tint: 0xa985ff },
    core: { name: "Abyss core", cls: "icon-core", tint: 0xff7a2e },
    mapScrap: { name: "Map scrap", cls: "icon-map-scrap", tint: 0xd6b16a },
    clockwork: { name: "Clockwork seed", cls: "icon-clockwork", tint: 0xf0c75e },
    mirrorShard: { name: "Mirror shard", cls: "icon-mirror-shard", tint: 0xc9fff6 },
    strangeKey: { name: "Strange key", cls: "icon-strange-key", tint: 0xb48cff },
    torch: { name: "Torch", cls: "icon-torch", tile: Tile.TORCH, tint: 0xf2c35f },
    battery: { name: "Lamp cell", cls: "icon-battery", tint: 0x7ee6c9 },
    ladder: { name: "Ladder", cls: "icon-ladder", tile: Tile.LADDER, tint: 0xb37236 },
    platform: { name: "Platform", cls: "icon-platform", tile: Tile.PLATFORM, tint: 0x9d6734 },
    charge: { name: "Charge", cls: "icon-charge", tint: 0xc24c3e },
    mushroom: { name: "Glow cap", cls: "icon-mushroom", tile: Tile.MUSHROOM, consumable: { heal: 8, energy: 22 }, tint: 0x6fe3d2 },
    kit: { name: "Field kit", cls: "icon-kit", consumable: { heal: 45, energy: 45 }, tint: 0xe8e2d2 }
  };

  const HOTBAR = ["dirt", "stone", "wood", "torch", "ladder", "platform", "charge", "mushroom", "kit"];

  // Index = pick level (1-based). Frame in the "picks" texture is level - 1.
  const PICKS = [
    null,
    { name: "Rust pick", speed: 1, tint: 0xb8b0a0 },
    { name: "Stone pick", speed: 1.35, tint: 0x9fa5a0 },
    { name: "Copper pick", speed: 1.85, tint: 0xd18956 },
    { name: "Iron pick", speed: 2.55, tint: 0xe4e0d2 },
    { name: "Crystal drill", speed: 3.45, tint: 0x92fff0 },
    { name: "Starforged drill", speed: 4.6, tint: 0xffd76a }
  ];

  const BLADES = [
    { name: "Bare grip", bonus: 0 },
    { name: "Copper edge", bonus: 1 },
    { name: "Iron edge", bonus: 2 },
    { name: "Crystal edge", bonus: 4 },
    { name: "Abyss edge", bonus: 7 }
  ];

  // Personal light radius in pixels, self glow for darkness checks, and
  // battery economy. Higher lamps are stronger but hungrier.
  const LAMPS = [
    { name: "Headlamp", radius: 120, glow: 0.18, capacity: 135, drain: 1 },
    { name: "Miner lamp", radius: 190, glow: 0.42, capacity: 165, drain: 1.32 },
    { name: "Beacon lamp", radius: 265, glow: 0.62, capacity: 210, drain: 1.85 }
  ];

  const STRATA_PROFILES = [
    {
      id: "rootline",
      name: "Rootline Drift",
      tone: "Soft routes",
      note: "Loose roots and old survey cuts make this layer forgiving, but poor in rare metal.",
      minDepth: 0,
      deepAt: 172,
      miningFatigue: 1,
      caveWorms: 0.92,
      caveSteps: 0.86,
      lavaChance: 0.012,
      lavaSpread: 0.34,
      cacheChance: 0.28,
      maxChests: 6,
      campChance: 0.16,
      maxCamps: 2,
      mushroomChance: 0.2,
      ladderChance: 0.3,
      mobCap: 18,
      eliteChance: 0.03,
      eventPace: 1.08,
      events: { oreSurge: 3, lanternDraft: 3, swarm: 1 },
      ores: [
        { tile: Tile.AMBER, minDepth: 8, chance: 0.018 },
        { tile: Tile.COAL, minDepth: 10, chance: 0.042 },
        { tile: Tile.COPPER, minDepth: 32, chance: 0.022 },
        { tile: Tile.QUARTZ, minDepth: 56, chance: 0.009 },
        { tile: Tile.IRON, minDepth: 72, chance: 0.01 }
      ]
    },
    {
      id: "ironfault",
      name: "Iron Fault",
      tone: "Metal pressure",
      note: "The rock folds into ore-rich shelves, with tremors and longer mining pulls.",
      minDepth: 72,
      deepAt: 162,
      miningFatigue: 1.08,
      caveWorms: 1.05,
      caveSteps: 0.95,
      lavaChance: 0.026,
      lavaSpread: 0.48,
      cacheChance: 0.3,
      maxChests: 7,
      campChance: 0.13,
      maxCamps: 2,
      mushroomChance: 0.16,
      ladderChance: 0.24,
      mobCap: 22,
      eliteChance: 0.05,
      eventPace: 0.92,
      events: { oreSurge: 2, tremor: 3, swarm: 2, lanternDraft: 1 },
      ores: [
        { tile: Tile.COAL, minDepth: 22, chance: 0.032 },
        { tile: Tile.COPPER, minDepth: 52, chance: 0.028 },
        { tile: Tile.IRON, minDepth: 78, chance: 0.025 },
        { tile: Tile.QUARTZ, minDepth: 86, chance: 0.016 },
        { tile: Tile.GOLD, minDepth: 118, chance: 0.009 }
      ]
    },
    {
      id: "crystalvein",
      name: "Crystal Vein",
      tone: "Signal hum",
      note: "Crystal chambers glow softly and reward detours, while bats and swarms read the noise.",
      minDepth: 138,
      deepAt: 148,
      miningFatigue: 1.12,
      caveWorms: 1.18,
      caveSteps: 1.12,
      lavaChance: 0.03,
      lavaSpread: 0.42,
      cacheChance: 0.34,
      maxChests: 8,
      campChance: 0.11,
      maxCamps: 2,
      mushroomChance: 0.27,
      ladderChance: 0.2,
      mobCap: 24,
      eliteChance: 0.07,
      eventPace: 0.86,
      events: { lanternDraft: 3, oreSurge: 2, swarm: 3, tremor: 1 },
      ores: [
        { tile: Tile.IRON, minDepth: 96, chance: 0.018 },
        { tile: Tile.GOLD, minDepth: 130, chance: 0.017 },
        { tile: Tile.CRYSTAL, minDepth: 150, chance: 0.014 },
        { tile: Tile.QUARTZ, minDepth: 150, chance: 0.012 },
        { tile: Tile.EMBER, minDepth: 176, chance: 0.008 },
        { tile: Tile.OBSIDIAN, minDepth: 210, chance: 0.006 }
      ]
    },
    {
      id: "obsidianabyss",
      name: "Obsidian Abyss",
      tone: "Severe dark",
      note: "Lava glass replaces mercy here: fewer safe camps, heavier mobs, and richer secret caches.",
      minDepth: 220,
      deepAt: 128,
      miningFatigue: 1.22,
      caveWorms: 0.98,
      caveSteps: 1.22,
      lavaChance: 0.058,
      lavaSpread: 0.62,
      cacheChance: 0.38,
      maxChests: 8,
      campChance: 0.08,
      maxCamps: 1,
      mushroomChance: 0.12,
      ladderChance: 0.15,
      mobCap: 26,
      eliteChance: 0.1,
      eventPace: 0.76,
      events: { tremor: 3, swarm: 4, oreSurge: 1, lanternDraft: 1 },
      ores: [
        { tile: Tile.GOLD, minDepth: 160, chance: 0.014 },
        { tile: Tile.CRYSTAL, minDepth: 190, chance: 0.012 },
        { tile: Tile.EMBER, minDepth: 202, chance: 0.021 },
        { tile: Tile.OBSIDIAN, minDepth: 215, chance: 0.05 },
        { tile: Tile.VOIDGLASS, minDepth: 250, chance: 0.008 }
      ]
    },
    {
      id: "voidglass",
      name: "Voidglass Shelf",
      tone: "False floor",
      note: "The mine starts repeating itself wrong: pockets stretch wide, caches are tempting, and safe light is scarce.",
      minDepth: 330,
      deepAt: 110,
      miningFatigue: 1.34,
      caveWorms: 1.32,
      caveSteps: 1.32,
      lavaChance: 0.07,
      lavaSpread: 0.7,
      cacheChance: 0.42,
      maxChests: 9,
      campChance: 0.06,
      maxCamps: 1,
      mushroomChance: 0.09,
      ladderChance: 0.12,
      mobCap: 30,
      eliteChance: 0.14,
      eventPace: 0.68,
      events: { swarm: 5, tremor: 4, oreSurge: 1, lanternDraft: 1 },
      ores: [
        { tile: Tile.CRYSTAL, minDepth: 210, chance: 0.012 },
        { tile: Tile.OBSIDIAN, minDepth: 235, chance: 0.06 },
        { tile: Tile.GOLD, minDepth: 260, chance: 0.016 },
        { tile: Tile.EMBER, minDepth: 270, chance: 0.018 },
        { tile: Tile.VOIDGLASS, minDepth: 300, chance: 0.036 }
      ]
    }
  ];

  const RECIPES = [
    { id: "torch", cat: "blocks", name: "Torch bundle", cost: { wood: 1, coal: 1 }, out: { torch: 4 }, note: "Local light for deeper tunnels" },
    { id: "amberLanterns", cat: "blocks", name: "Amber lanterns", cost: { amber: 1, coal: 1 }, out: { torch: 6 }, note: "Warm resin light that stretches early routes" },
    { id: "gelTorch", cat: "blocks", name: "Gel torches", cost: { wood: 1, gel: 2 }, out: { torch: 5 }, note: "Classic slime-gel torch recipe" },
    { id: "mushroomFlare", cat: "blocks", name: "Mushroom flares", cost: { mushroom: 1, gel: 1 }, out: { torch: 4 }, note: "Soft cyan light from cave growth" },
    { id: "ladder", cat: "blocks", name: "Ladder stack", cost: { wood: 2 }, out: { ladder: 6 }, note: "Vertical movement in shafts" },
    { id: "ironLadder", cat: "blocks", name: "Iron ladder frame", cost: { wood: 1, iron: 1 }, out: { ladder: 10 }, note: "Efficient deep-shaft ladder work" },
    { id: "silkLadder", cat: "blocks", name: "Silk ladder roll", cost: { wood: 1, silk: 2 }, out: { ladder: 12 }, note: "Boss-silk rope for long drops" },
    { id: "platform", cat: "blocks", name: "Platform pack", cost: { wood: 1 }, out: { platform: 4 }, note: "One-way bridges. Hold S to drop through" },
    { id: "stoneBridge", cat: "blocks", name: "Stone bridge pack", cost: { stone: 4 }, out: { platform: 6 }, note: "Build crossings when trees are scarce" },
    { id: "obsidianBridge", cat: "blocks", name: "Obsidian bridge kit", cost: { obsidian: 1, stone: 4 }, out: { platform: 10 }, note: "Fire-dark bridge material for deep vaults" },
    { id: "charge", cat: "blocks", name: "Blast charges", cost: { coal: 3, copper: 2, stone: 2 }, out: { charge: 2 }, note: "Clears a pocket of rock" },
    { id: "stickyCharge", cat: "blocks", name: "Sticky charges", cost: { coal: 2, copper: 1, gel: 2 }, out: { charge: 2 }, note: "Cheaper bombs after fighting slimes" },
    { id: "bombCrate", cat: "blocks", name: "Bomb crate", cost: { coal: 6, copper: 4, iron: 2 }, out: { charge: 5 }, note: "Bulk explosives for branch mining" },
    { id: "crystalBeacon", cat: "blocks", name: "Crystal beacon bundle", cost: { crystal: 1, coal: 2, wood: 1 }, out: { torch: 8 }, note: "Bright, long-running cave markers" },
    { id: "emberCharges", cat: "blocks", name: "Ember charges", cost: { ember: 1, charge: 1, coal: 2 }, out: { charge: 4 }, note: "Hot charges from lava shale" },
    { id: "coreCharge", cat: "blocks", name: "Core charges", cost: { coal: 4, obsidian: 2, core: 1 }, out: { charge: 5 }, note: "Boss-core charges for serious excavation" },

    { id: "stonePick", cat: "tools", name: "Stone pick", cost: { wood: 2, stone: 10 }, upgrade: 2, note: "Copper seams become reachable" },
    { id: "copperPick", cat: "tools", name: "Copper pick", cost: { wood: 2, stone: 15, copper: 8 }, upgrade: 3, note: "Cuts deepstone and iron" },
    { id: "ironPick", cat: "tools", name: "Iron pick", cost: { wood: 3, copper: 6, iron: 10 }, upgrade: 4, note: "Gold and crystal become reachable" },
    { id: "crystalDrill", cat: "tools", name: "Crystal drill", cost: { wood: 4, iron: 12, crystal: 8 }, upgrade: 5, note: "Obsidian becomes reachable" },
    { id: "starDrill", cat: "tools", name: "Starforged drill", cost: { iron: 8, gold: 10, obsidian: 6, crystal: 6 }, upgrade: 6, note: "Endgame mining speed" },
    { id: "copperEdge", cat: "tools", name: "Copper edge", cost: { wood: 1, copper: 6 }, blade: 1, note: "+1 attack damage" },
    { id: "ironEdge", cat: "tools", name: "Iron edge", cost: { coal: 2, iron: 8 }, blade: 2, note: "+2 attack damage" },
    { id: "crystalEdge", cat: "tools", name: "Crystal edge", cost: { gold: 4, crystal: 6 }, blade: 3, note: "+4 attack damage" },
    { id: "abyssEdge", cat: "tools", name: "Abyss edge", cost: { fang: 3, relic: 1, crystal: 5 }, blade: 4, note: "+7 attack damage from boss fangs" },
    { id: "caveBoots", cat: "tools", name: "Cave boots", cost: { wood: 3, iron: 4 }, boots: true, note: "Double jump, softer landings" },
    { id: "minerLamp", cat: "tools", name: "Miner lamp", cost: { copper: 4, coal: 6 }, lamp: 1, note: "Wider personal light, but it drains lamp cells" },
    { id: "beaconLamp", cat: "tools", name: "Beacon lamp", cost: { gold: 6, crystal: 4 }, lamp: 2, note: "Huge light cone with a hungry battery draw" },
    { id: "clockworkRegulator", cat: "tools", name: "Clockwork regulator", cost: { clockwork: 1, quartz: 3, copper: 2 }, cellEfficiency: true, note: "Lamp cells drain slower under a tuned regulator" },
    { id: "reinforcedSoles", cat: "tools", name: "Reinforced soles", cost: { iron: 4, silk: 2, gel: 2 }, fallGuard: true, note: "Cuts fall damage and hard landing shock" },
    { id: "echoPadding", cat: "tools", name: "Echo padding", cost: { silk: 2, gel: 4, mushroom: 2 }, noiseMuffle: true, note: "Softens mining, landing, and cache noise so mobs track you less through walls" },
    { id: "sprintGreaves", cat: "tools", name: "Sprint greaves", cost: { fang: 1, iron: 5, silk: 2 }, speedBoost: true, note: "Higher walk and sprint speed" },

    { id: "blastSatchel", cat: "relics", name: "Blast satchel", cost: { silk: 3, copper: 4, charge: 2 }, blastRadius: 0.65, note: "Charges carve a wider pocket" },
    { id: "heartCharm", cat: "relics", name: "Heart charm", cost: { relic: 2, mushroom: 3, gold: 3 }, maxHealth: 125, note: "Raises maximum health to 125" },
    { id: "titanHeart", cat: "relics", name: "Titan heart", cost: { core: 1, relic: 4, obsidian: 4 }, maxHealth: 150, note: "Raises maximum health to 150" },
    { id: "enduranceCharm", cat: "relics", name: "Endurance charm", cost: { relic: 1, silk: 4, iron: 6 }, maxEnergy: 130, note: "Raises maximum energy to 130" },
    { id: "forgeHarness", cat: "relics", name: "Forge harness", cost: { core: 1, fang: 2, gold: 8 }, maxEnergy: 160, note: "Raises maximum energy to 160" },
    { id: "recoveryCharm", cat: "relics", name: "Recovery charm", cost: { relic: 1, gel: 4, mushroom: 4 }, regenBoost: true, note: "Faster resting recovery when safe" },
    { id: "vaultCompass", cat: "relics", name: "Vault compass", cost: { relic: 2, copper: 6, gold: 3 }, treasureSense: true, note: "Marks unopened secret caches on the map" },
    { id: "luckyPouch", cat: "relics", name: "Lucky pouch", cost: { silk: 3, coin: 30, gold: 2 }, lootBonus: true, note: "Chests and bosses spill more coins" },
    { id: "shadowWard", cat: "relics", name: "Shadow ward", cost: { core: 1, obsidian: 4, crystal: 4 }, ward: true, note: "Softens deep darkness and boss hits" },
    { id: "recallCharm", cat: "relics", name: "Recall charm", cost: { relic: 1, crystal: 2, coin: 24 }, recallCharm: true, note: "Recall to camp costs less energy and recharges faster" },
    { id: "mirrorCache", cat: "relics", name: "Mirror cache", cost: { mirrorShard: 1, relic: 1, quartz: 2 }, out: { crystal: 2, coin: 16 }, note: "A chest shard that turns old reflections into supplies" },
    { id: "keyedRelic", cat: "relics", name: "Keyed relic case", cost: { strangeKey: 1, mapScrap: 2, coin: 12 }, out: { relic: 1, torch: 4 }, note: "A guild key opens a cache nobody logged" },
    { id: "voidglassEdge", cat: "relics", name: "Voidglass edge", cost: { voidglass: 4, obsidian: 3, crystal: 3 }, blade: 4, note: "+7 attack damage through glass-dark plating" },

    { id: "fieldKit", cat: "survival", name: "Field kit", cost: { wood: 2, coal: 2, mushroom: 1 }, out: { kit: 1 }, note: "Use from the hotbar: +45 health, +45 energy" },
    { id: "merchantKit", cat: "survival", name: "Merchant kit", cost: { coin: 12, mushroom: 1 }, out: { kit: 1 }, note: "Spend coins for a quick recovery kit" },
    { id: "merchantTorchCrate", cat: "survival", name: "Merchant torch crate", cost: { coin: 10, coal: 1 }, out: { torch: 8 }, note: "Spend coin to restock light before a deep run" },
    { id: "lampCells", cat: "survival", name: "Lamp cells", cost: { coal: 2, copper: 1 }, out: { battery: 2 }, note: "Spare batteries for personal lamps" },
    { id: "quartzCells", cat: "survival", name: "Quartz lamp cells", cost: { quartz: 1, copper: 1 }, out: { battery: 3 }, note: "Cleaner battery chemistry from quartz veins" },
    { id: "crystalCells", cat: "survival", name: "Crystal lamp cells", cost: { crystal: 1, copper: 2 }, out: { battery: 4 }, note: "High-output cells for abyss expeditions" },
    { id: "surveyorLadderPack", cat: "survival", name: "Surveyor ladder pack", cost: { coin: 12, wood: 1 }, out: { ladder: 12 }, note: "A paid shaft kit for longer descents" },
    { id: "blackPowderOrder", cat: "survival", name: "Black powder order", cost: { coin: 18, coal: 2, copper: 1 }, out: { charge: 3 }, note: "Emergency charge restock for sealed routes" },
    { id: "guildSupplyDrop", cat: "survival", name: "Guild supply drop", cost: { coin: 35, relic: 1 }, out: { kit: 2, torch: 6, ladder: 8 }, note: "Late-run resupply from the expedition guild" },
    { id: "mushroomStew", cat: "survival", name: "Mushroom stew", cost: { mushroom: 2, gel: 1 }, out: { kit: 1 }, note: "Turns cave food into a real recovery kit" },
    { id: "ironRationBox", cat: "survival", name: "Iron ration box", cost: { coin: 20, iron: 2, coal: 1 }, out: { kit: 2 }, note: "Heavy but reliable expedition supplies" },
    { id: "vaultKit", cat: "survival", name: "Vault kit", cost: { coin: 18, silk: 2, mushroom: 2 }, out: { kit: 2 }, note: "Secret-room supplies packed into two field kits" },
    { id: "bossTonic", cat: "survival", name: "Boss tonic", cost: { core: 1, fang: 1, mushroom: 2 }, out: { kit: 3 }, note: "A dangerous brew for late-game fights" },
    { id: "surveyCache", cat: "survival", name: "Survey cache", cost: { mapScrap: 2, coin: 6 }, out: { ladder: 8, torch: 4 }, note: "Old map scraps point to a practical route bundle" },
    { id: "emberRation", cat: "survival", name: "Ember ration heater", cost: { ember: 1, kit: 1 }, out: { kit: 2 }, note: "Turns one field kit into two heated emergency packs" },
    { id: "coinPress", cat: "survival", name: "Coin press", cost: { gold: 1 }, out: { coin: 14 }, note: "Press spare gold into merchant coins" },
    { id: "crystalTrade", cat: "survival", name: "Crystal trade", cost: { crystal: 1 }, out: { coin: 20 }, note: "Convert rare crystal into quick money" }
  ];

  const CHEST_SURPRISES = [
    { item: "mapScrap", minDepth: 0, chance: 0.26, secretBonus: 0.18, min: 1, max: 2, note: "torn route scraps" },
    { item: "amber", minDepth: 18, chance: 0.18, secretBonus: 0.1, min: 1, max: 2, note: "resin sealed in old crates" },
    { item: "quartz", minDepth: 62, chance: 0.14, secretBonus: 0.14, min: 1, max: 2, note: "clean lamp crystal" },
    { item: "clockwork", minDepth: 72, chance: 0.07, secretBonus: 0.18, min: 1, max: 1, note: "a ticking seed with no maker mark" },
    { item: "mirrorShard", minDepth: 110, chance: 0.08, secretBonus: 0.22, min: 1, max: 1, note: "a shard that reflects the HUD wrong" },
    { item: "ember", minDepth: 152, chance: 0.11, secretBonus: 0.15, min: 1, max: 2, note: "warm shale wrapped in cloth" },
    { item: "strangeKey", minDepth: 84, chance: 0.025, secretBonus: 0.18, min: 1, max: 1, note: "a key not listed on the cache tag" },
    { item: "voidglass", minDepth: 230, chance: 0.055, secretBonus: 0.2, min: 1, max: 2, note: "glass-dark splinters from below the map" }
  ];

  const CRAFT_CATS = [
    { id: "tools", label: "Tools" },
    { id: "blocks", label: "Blocks" },
    { id: "survival", label: "Survival" },
    { id: "relics", label: "Relics" }
  ];

  const CAMP_SERVICES = [
    { id: "rest", name: "Rest at camp", action: "Rest", kind: "rest", cost: {}, note: "Restore health, energy, lamp charge, recall cooldown, and respawn anchor." },
    { id: "torchCache", name: "Torch cache", action: "Buy", cost: { coin: 8 }, out: { torch: 6 }, note: "Cheap light for another descent." },
    { id: "cellCache", name: "Lamp cells", action: "Buy", cost: { coin: 10, coal: 1 }, out: { battery: 2 }, note: "Battery stock for long dark routes." },
    { id: "ladderCache", name: "Ladder cache", action: "Buy", cost: { coin: 10 }, out: { ladder: 10 }, note: "Fast vertical route restock." },
    { id: "medicPack", name: "Medic pack", action: "Buy", cost: { coin: 14 }, out: { kit: 1 }, note: "One field kit from the camp medic." },
    { id: "powderCache", name: "Powder cache", action: "Buy", cost: { coin: 18, coal: 1 }, out: { charge: 2 }, note: "Emergency explosives for sealed caves." },
    { id: "rerollContract", name: "New contract", action: "Reroll", kind: "rerollContract", cost: { coin: 6 }, note: "Replace the current expedition contract." }
  ];

  const ACHIEVEMENTS = [
    { id: "firstBreak", name: "First Spark", note: "Mine your first block.", stat: "mined", at: 1 },
    { id: "stoneCache", name: "Stone Stockpile", note: "Carry 40 stone.", item: "stone", at: 40 },
    { id: "amberFound", name: "Honey In Stone", note: "Find your first amber knot.", item: "amber", at: 1 },
    { id: "quartzFound", name: "Clean Signal", note: "Mine your first quartz vein.", item: "quartz", at: 1 },
    { id: "emberFound", name: "Still Warm", note: "Carry an ember shard from lava shale.", item: "ember", at: 1 },
    { id: "voidglassFound", name: "Below The Map", note: "Recover voidglass from the repeating shelf.", item: "voidglass", at: 1 },
    { id: "mapScrapFound", name: "Unfiled Route", note: "Find a map scrap in a cache.", item: "mapScrap", at: 1 },
    { id: "clockworkFound", name: "Something Ticks", note: "Find a clockwork seed where supplies should be.", item: "clockwork", at: 1 },
    { id: "mirrorShardFound", name: "Wrong Reflection", note: "Find a mirror shard that reflects the mine strangely.", item: "mirrorShard", at: 1 },
    { id: "strangeKeyFound", name: "Wrong Key", note: "Find a cache key nobody logged.", item: "strangeKey", at: 1 },
    { id: "firstCraft", name: "Workbench Hands", note: "Craft your first recipe.", stat: "crafted", at: 1 },
    { id: "craftsman", name: "Tunnel Smith", note: "Craft 8 recipes.", stat: "crafted", at: 8 },
    { id: "firstChest", name: "Cache Finder", note: "Open a chest.", stat: "chests", at: 1 },
    { id: "secretOne", name: "Hidden Door", note: "Open a secret cache.", stat: "secrets", at: 1 },
    { id: "secretFive", name: "Vault Runner", note: "Open five secret caches.", stat: "secrets", at: 5 },
    { id: "deep40", name: "Below the Roots", note: "Reach 40 m depth.", stat: "deepest", at: 40 },
    { id: "deep120", name: "Blackstone Air", note: "Reach 120 m depth.", stat: "deepest", at: 120 },
    { id: "deep220", name: "Abyss Floor", note: "Reach 220 m depth.", stat: "deepest", at: 220 },
    { id: "firstKill", name: "Cave Clearer", note: "Defeat your first mob.", stat: "enemies", at: 1 },
    { id: "hunter", name: "Depth Hunter", note: "Defeat 20 mobs.", stat: "enemies", at: 20 },
    { id: "bossOne", name: "Boss Breaker", note: "Defeat a hidden boss.", stat: "bosses", at: 1 },
    { id: "bossTwo", name: "Abyss Authority", note: "Defeat both hidden bosses.", stat: "bosses", at: 2 },
    { id: "stonePick", name: "Stone Age", note: "Craft the Stone pick.", prop: "pickLevel", at: 2 },
    { id: "starDrill", name: "Starforged", note: "Craft the Starforged drill.", prop: "pickLevel", at: 6 },
    { id: "beaconLamp", name: "Beacon Bearer", note: "Craft the Beacon lamp.", prop: "lamp", at: 2 },
    { id: "cellRegulator", name: "Measured Light", note: "Craft the Clockwork regulator.", flag: "cellEfficiency" },
    { id: "batteryStock", name: "Cells Packed", note: "Carry three spare lamp cells.", item: "battery", at: 3 },
    { id: "abyssEdge", name: "Abyss Edge", note: "Craft the Abyss edge.", prop: "blade", at: 4 },
    { id: "boots", name: "Second Step", note: "Craft Cave boots.", flag: "boots" },
    { id: "quietStep", name: "Quiet Step", note: "Craft Echo padding to make the mine hear less of you.", flag: "noiseMuffle" },
    { id: "ward", name: "Darkness Warden", note: "Craft the Shadow ward.", flag: "ward" },
    { id: "titanHeart", name: "Titan Heart", note: "Raise max health to 150.", prop: "maxHealth", at: 150 },
    { id: "forgeHarness", name: "Overcharged", note: "Raise max energy to 160.", prop: "maxEnergy", at: 160 },
    { id: "contractOne", name: "Ledger Signed", note: "Complete an expedition contract.", stat: "contracts", at: 1 },
    { id: "contractFive", name: "Guild Regular", note: "Complete five expedition contracts.", stat: "contracts", at: 5 },
    { id: "eventOne", name: "Living Mine", note: "Encounter your first cave event.", stat: "events", at: 1 },
    { id: "eventFive", name: "Faultline Veteran", note: "Encounter five cave events.", stat: "events", at: 5 },
    { id: "noiseLure", name: "The Rock Heard", note: "Make enough noise for the mine to answer with movement.", stat: "noiseLures", at: 1 },
    { id: "recallOne", name: "Back to Camp", note: "Recall safely to a campfire anchor.", stat: "recalls", at: 1 },
    { id: "recallCharm", name: "Anchor Spark", note: "Craft the Recall charm.", flag: "recallCharm" },
    { id: "campFirst", name: "Camp Ledger", note: "Use a campfire service.", stat: "campUses", at: 1 },
    { id: "campTen", name: "Quartermaster", note: "Use ten campfire services.", stat: "campUses", at: 10 },
    { id: "campAnchor", name: "Warm Anchor", note: "Set your first campfire anchor.", stat: "camps", at: 1 },
    { id: "campNetwork", name: "Wayfire Network", note: "Activate three campfire anchors.", stat: "camps", at: 3 },
    { id: "worldBelow", name: "No Bottom", note: "Split the lower bedrock seam and open another stratum.", stat: "worldExpansions", at: 1 },
    { id: "voidglass", name: "False Floor", note: "Open two abyss seams and reach the stranger repeating shelves.", stat: "worldExpansions", at: 2 },
    { id: "farHorizon", name: "Far Horizon", note: "Open a new horizontal region beyond the old map edge.", stat: "horizontalExpansions", at: 1 },
    { id: "surfaceRumor", name: "Road Past The Map", note: "Find a surface discovery beyond the starter world.", stat: "surfaceDiscoveries", at: 1 },
    { id: "deepSurveyMark", name: "The Mine Has Handwriting", note: "Find an underground point of interest.", stat: "undergroundDiscoveries", at: 1 },
    { id: "poiPilgrim", name: "Expedition Cartographer", note: "Find five world points of interest.", stat: "poiDiscoveries", at: 5 },
    { id: "firstFieldNote", name: "It Does Not Fit", note: "Decode your first hidden field note.", loreNotes: 1 },
    { id: "loreHunter", name: "Between the Contracts", note: "Decode five hidden field notes.", loreNotes: 5 },
    { id: "firstWatcher", name: "Watched From the Dark", note: "Notice the hidden observer beyond your light.", stat: "watcherSightings", at: 1 },
    { id: "watcherTrace", name: "Cold Footprint", note: "Find what the shadow leaves behind.", stat: "watcherTraces", at: 1 },
    { id: "watcherTrail", name: "The Silent Guide", note: "Survive three shadow watcher sightings.", stat: "watcherSightings", at: 3 },
    { id: "frameCrack", name: "Frame Crack", note: "See the mine react to the observer beyond the glass.", stat: "observerAnomalies", at: 1 },
    { id: "aliveAvatar", name: "Not Just Hands", note: "Let the miner reveal a thought of his own.", stat: "heroThoughts", at: 1 },
    { id: "lookedBack", name: "It Looked Back", note: "Make a cave creature notice the watcher behind you.", stat: "mobAwareness", at: 1 },
    { id: "spaceWindow", name: "Window In The Stone", note: "Witness a space-window anomaly in the mine.", stat: "spatialRifts", at: 1 },
    { id: "forgeTruth", name: "The Forge Remembered", note: "Assemble the final truth of the abyss forge.", loreGoal: "truth" }
  ];

  const CONTRACTS = [
    {
      id: "shaftOrder",
      name: "Shaft order",
      type: "mined",
      label: "Mine blocks",
      unit: "blocks",
      base: 18,
      growth: 5,
      reward: { wood: 2, torch: 2, coin: 6 },
      rewardEvery: { coin: 2, ladder: 1 }
    },
    {
      id: "depthSurvey",
      name: "Depth survey",
      type: "deepest",
      label: "Reach depth",
      unit: "m",
      absolute: true,
      base: 34,
      growth: 20,
      reward: { ladder: 4, torch: 3, coin: 8 },
      rewardEvery: { coin: 3 }
    },
    {
      id: "caveClearance",
      name: "Cave clearance",
      type: "enemies",
      label: "Defeat mobs",
      unit: "mobs",
      base: 2,
      growth: 1,
      minContracts: 1,
      reward: { gel: 3, coal: 2, coin: 10 },
      rewardEvery: { coin: 3 }
    },
    {
      id: "cacheRun",
      name: "Cache run",
      type: "chests",
      label: "Open chests",
      unit: "caches",
      base: 1,
      growth: 1,
      minContracts: 1,
      reward: { kit: 1, torch: 2, coin: 12 },
      rewardEvery: { coin: 4 }
    },
    {
      id: "forgeOrder",
      name: "Forge order",
      type: "crafted",
      label: "Craft recipes",
      unit: "recipes",
      base: 1,
      growth: 1,
      minContracts: 2,
      reward: { coal: 3, copper: 1, coin: 10 },
      rewardEvery: { coin: 4 }
    },
    {
      id: "vaultRumor",
      name: "Vault rumor",
      type: "secrets",
      label: "Open secret caches",
      unit: "vaults",
      base: 1,
      growth: 1,
      minContracts: 3,
      reward: { relic: 1, silk: 2, coin: 18 },
      rewardEvery: { coin: 6 }
    },
    {
      id: "seamSurvey",
      name: "Seam survey",
      type: "worldExpansions",
      label: "Open abyss seams",
      unit: "seams",
      base: 1,
      growth: 0,
      minContracts: 4,
      minDepth: 180,
      reward: { battery: 2, torch: 4, coin: 18 },
      rewardEvery: { coin: 6, crystal: 1 }
    }
  ];

  const CAVE_EVENTS = {
    oreSurge: {
      name: "Ore surge",
      note: "Fresh seams loosen and mined blocks can spill extra material.",
      duration: 18000,
      variants: [
        { minPhase: 1, name: "Ledger seam", note: "Ore breaks along lines that match old contract marks.", float: "LEDGER" },
        { minPhase: 3, name: "Supply memory", note: "The wall opens like it expected your tool and feeds the route with metal.", float: "REMEMBER" },
        { minPhase: 4, name: "Forge bleed", note: "The strata push useful ore toward you, as if the machine is correcting the path.", float: "FORGE" }
      ]
    },
    lanternDraft: {
      name: "Lantern draft",
      note: "Warm air feeds lamps and recovery for a short push.",
      duration: 16000,
      variants: [
        { minPhase: 1, name: "Wayfire breath", note: "Warm air rolls from old camp marks and steadies your lamp.", float: "WAYFIRE" },
        { minPhase: 2, name: "Watcher hush", note: "The dark pulls back for a moment, like something asked it to wait.", float: "HUSH" },
        { minPhase: 4, name: "Rescue draft", note: "A buried system vents clean air through the broken route.", float: "AIR" }
      ]
    },
    swarm: {
      name: "Depth swarm",
      note: "Noise in the rock wakes a pack near your tunnel.",
      duration: 22000,
      variants: [
        { minPhase: 1, name: "Listening swarm", note: "Your last hits echo too cleanly. Something followed the rhythm.", float: "LISTEN" },
        { minPhase: 2, name: "Marked tunnel", note: "Creatures do not wander here. They arrive where the mine points.", float: "MARKED" },
        { minPhase: 4, name: "Immune response", note: "The forge treats your route like damage and sends bodies to seal it.", float: "RESPONSE" }
      ]
    },
    tremor: {
      name: "Cave tremor",
      note: "The ceiling shakes loose stones into the tunnel.",
      duration: 14000,
      variants: [
        { minPhase: 1, name: "Fault reply", note: "The ceiling answers your route with timed fractures.", float: "FAULT" },
        { minPhase: 3, name: "False floor", note: "The shelf below you settles like a door deciding whether to open.", float: "SHIFT" },
        { minPhase: 4, name: "Forge pulse", note: "The whole layer beats once, and loose stone drops where you planned to stand.", float: "PULSE" }
      ]
    }
  };

  const OBSERVER_MOMENTS = {
    idle: {
      minPhase: 2,
      stat: "heroThoughts",
      action: "Listening",
      audio: "secret",
      cooldownMin: 18000,
      cooldownMax: 32000,
      pulse: 1400,
      lines: [
        { minPhase: 2, float: "HE WAITS", note: "The miner shifts his grip before your next command." },
        { minPhase: 3, float: "NOT ALONE", note: "He looks past the lantern, toward where the orders come from." },
        { minPhase: 5, float: "I HEAR YOU", note: "For one breath, the miner seems to hear the room outside the mine." }
      ]
    },
    lowLight: {
      minPhase: 2,
      stat: "heroThoughts",
      action: "Resisting",
      audio: "event",
      cooldownMin: 16000,
      cooldownMax: 30000,
      pulse: 1200,
      lines: [
        { minPhase: 2, float: "BREATHE", note: "He steadies himself without being told." },
        { minPhase: 3, float: "DONT LOOK AWAY", note: "The dark waits for your attention to slip." },
        { minPhase: 5, float: "KEEP ME HERE", note: "The body on screen fights to stay inside the light." }
      ]
    },
    pain: {
      minPhase: 3,
      stat: "heroThoughts",
      action: "Refuses",
      audio: "hurt",
      cooldownMin: 19000,
      cooldownMax: 34000,
      pulse: 900,
      lines: [
        { minPhase: 3, float: "NO", note: "He braces before the next impact lands." },
        { minPhase: 4, float: "STILL HERE", note: "The miner does not fall until you let him." },
        { minPhase: 5, float: "HOLD THE FRAME", note: "The screen shakes, but he holds himself inside it." }
      ]
    },
    mobStare: {
      minPhase: 3,
      stat: "mobAwareness",
      action: "Seen",
      audio: "event",
      cooldownMin: 15000,
      cooldownMax: 28000,
      pulse: 900,
      lines: [
        { minPhase: 3, float: "LOOKS BACK", note: "The creature stops chasing the miner and stares through him." },
        { minPhase: 4, float: "IT KNOWS", note: "It tracks the camera, not only the body." },
        { minPhase: 5, float: "WRONG TARGET", note: "For a second, the cave life hunts the watcher behind the glass." }
      ]
    },
    spatialRift: {
      minPhase: 4,
      stat: "spatialRifts",
      action: "Frame tear",
      audio: "secret",
      cooldownMin: 26000,
      cooldownMax: 46000,
      pulse: 1800,
      camera: 0.003,
      lines: [
        { minPhase: 4, float: "FRAME TEAR", note: "A rectangular wound opens in the air, like the mine found the edge of the screen." },
        { minPhase: 5, float: "SPACE WINDOW", note: "The stone shows a room that is not underground." },
        { minPhase: 6, float: "YOU ARE SEEN", note: "The window turns toward the player, not the miner." }
      ]
    }
  };

  // Enemy archetypes. "deep" variants kick in below 150 m.
  const ENEMIES = {
    mossling: { texture: "mossling", bodyW: 22, bodyH: 13, offX: 3, offY: 5, hp: 2, deepHp: 2, speed: 72, deepSpeed: 72, touch: 5, fly: false, ai: { mind: "skittish", lightFear: 0.55, courage: 0.18, patience: 0.3 } },
    crawler: { texture: "crawler", bodyW: 24, bodyH: 14, offX: 3, offY: 4, hp: 2, deepHp: 4, speed: 84, deepSpeed: 118, touch: 8, fly: false, ai: { mind: "stalker", lightFear: 0.18, courage: 0.68, patience: 0.74 } },
    bat: { texture: "bat", bodyW: 20, bodyH: 12, offX: 3, offY: 4, hp: 2, deepHp: 3, speed: 120, deepSpeed: 145, touch: 6, fly: true, ai: { mind: "harrier", lightFear: 0.32, courage: 0.58, patience: 0.52 } },
    slime: { texture: "slime", bodyW: 22, bodyH: 13, offX: 3, offY: 6, hp: 3, deepHp: 5, speed: 0, deepSpeed: 0, touch: 9, fly: false, ai: { mind: "ambusher", lightFear: 0.36, courage: 0.5, patience: 0.86 } },
    golem: { texture: "golem", bodyW: 26, bodyH: 30, offX: 3, offY: 4, hp: 10, deepHp: 13, speed: 44, deepSpeed: 52, touch: 17, fly: false, heavy: true, ai: { mind: "guardian", lightFear: 0.08, courage: 0.92, patience: 0.62 } },
    broodmother: { texture: "broodmother", bodyW: 44, bodyH: 28, offX: 6, offY: 10, hp: 30, deepHp: 38, speed: 76, deepSpeed: 92, touch: 20, fly: false, heavy: true, boss: true, ai: { mind: "brood", lightFear: 0, courage: 1, patience: 0.9 } },
    warden: { texture: "warden", bodyW: 42, bodyH: 48, offX: 7, offY: 8, hp: 52, deepHp: 64, speed: 50, deepSpeed: 66, touch: 28, fly: false, heavy: true, boss: true, ai: { mind: "warden", lightFear: 0, courage: 1, patience: 1 } }
  };

  const MOB_SPAWN_RULES = {
    mossling: {
      label: "Surface night scavenger",
      layer: "surface",
      surfaceOnly: true,
      natural: false,
      nightRaid: true,
      minDepth: -2,
      maxDepth: 2,
      biomes: ["surface"],
      openSky: true,
      note: "Only creeps over grass at night; it burrows away by dawn."
    },
    crawler: {
      label: "Root and stone tunnel crawler",
      layer: "underground",
      natural: true,
      event: true,
      summoned: true,
      minDepth: 18,
      maxDepth: 150,
      biomes: ["rootline", "stonewarrens", "fungalhollow", "ironfault"],
      ceiling: true,
      ceilingRange: 8,
      note: "Lives under roots and working mine tunnels, never under open sky."
    },
    slime: {
      label: "Wet cave slime",
      layer: "underground",
      natural: true,
      event: true,
      summoned: true,
      minDepth: 28,
      maxDepth: 175,
      biomes: ["rootline", "fungalhollow", "stonewarrens", "ironfault", "crystalvein"],
      preferredBiomes: ["fungalhollow"],
      ceiling: true,
      ceilingRange: 7,
      maxLight: 6.9,
      note: "Requires enclosed damp caves; bright camp rooms keep it away."
    },
    bat: {
      label: "Cave air hunter",
      layer: "underground",
      natural: true,
      event: true,
      minDepth: 36,
      biomes: ["stonewarrens", "fungalhollow", "ironfault", "deepstone", "crystalvein", "obsidianabyss"],
      ceiling: true,
      ceilingRange: 6,
      minAir: 3,
      note: "Spawns only in enclosed air pockets with ceiling cover, including opened abyss seams."
    },
    golem: {
      label: "Deep pressure golem",
      layer: "deep",
      natural: true,
      event: true,
      minDepth: 118,
      biomes: ["deepstone", "crystalvein", "obsidianabyss"],
      ceiling: true,
      ceilingRange: 9,
      floorWidth: 3,
      note: "Heavy deep mob, restricted to stable deep floors below the first abyss seam."
    },
    broodmother: {
      label: "Hidden vault boss",
      layer: "vault",
      boss: true,
      minDepth: 105,
      biomes: ["ironfault", "deepstone", "crystalvein"],
      note: "Only wakes in a sealed boss vault."
    },
    warden: {
      label: "Obsidian vault boss",
      layer: "vault",
      boss: true,
      minDepth: 185,
      biomes: ["obsidianabyss", "deepstone", "crystalvein"],
      note: "Only wakes in the deepest sealed vault."
    }
  };

  Object.assign(window.ML, {
    TILE,
    WORLD_W,
    WORLD_H,
    HORIZONTAL_EXPAND_COLUMNS,
    AIR,
    DAY_LENGTH,
    INTERACT_RANGE_TILES: 3.05,
    SAVE_KEY: "abyssforge.save.v7",
    MUTE_KEY: "abyssforge.muted",
    Tile,
    BLOCKS,
    SOLID_TILES,
    BLOCK_TINTS,
    MAP_COLORS,
    ITEM_META,
    HOTBAR,
    PICKS,
    BLADES,
    LAMPS,
    STRATA_PROFILES,
    RECIPES,
    CHEST_SURPRISES,
    CRAFT_CATS,
    CAMP_SERVICES,
    ACHIEVEMENTS,
    CONTRACTS,
    CAVE_EVENTS,
    OBSERVER_MOMENTS,
    ENEMIES,
    MOB_SPAWN_RULES
  });
})();
