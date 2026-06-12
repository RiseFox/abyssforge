// AbyssForge v2 - shared constants and game data.
window.ML = window.ML || {};
(() => {
  "use strict";

  const TILE = 32;
  const WORLD_W = 180;
  const WORLD_H = 300;
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
    CHEST: 18
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
    [Tile.CHEST]: { name: "Supply chest", drop: null, loot: true, hardness: 0.6, tier: 1, solid: true }
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
    [Tile.CHEST]: 0xcaa258
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
    [Tile.CHEST]: "#caa258"
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
    gel: { name: "Gel", cls: "icon-gel", tint: 0x72d8ff },
    coin: { name: "Coins", cls: "icon-coin", tint: 0xf0c75e },
    silk: { name: "Silk", cls: "icon-silk", tint: 0xd8d3f0 },
    fang: { name: "Fang", cls: "icon-fang", tint: 0xe9ddc7 },
    relic: { name: "Ancient relic", cls: "icon-relic", tint: 0xa985ff },
    core: { name: "Abyss core", cls: "icon-core", tint: 0xff7a2e },
    torch: { name: "Torch", cls: "icon-torch", tile: Tile.TORCH, tint: 0xf2c35f },
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

  // Personal light radius in pixels for the lightmap, plus a "self glow"
  // value that counts toward the darkness-hazard check.
  const LAMPS = [
    { name: "Headlamp", radius: 120, glow: 0.18 },
    { name: "Miner lamp", radius: 190, glow: 0.42 },
    { name: "Beacon lamp", radius: 265, glow: 0.62 }
  ];

  const RECIPES = [
    { id: "torch", cat: "blocks", name: "Torch bundle", cost: { wood: 1, coal: 1 }, out: { torch: 4 }, note: "Local light for deeper tunnels" },
    { id: "gelTorch", cat: "blocks", name: "Gel torches", cost: { wood: 1, gel: 2 }, out: { torch: 5 }, note: "Classic slime-gel torch recipe" },
    { id: "ladder", cat: "blocks", name: "Ladder stack", cost: { wood: 2 }, out: { ladder: 6 }, note: "Vertical movement in shafts" },
    { id: "silkLadder", cat: "blocks", name: "Silk ladder roll", cost: { wood: 1, silk: 2 }, out: { ladder: 12 }, note: "Boss-silk rope for long drops" },
    { id: "platform", cat: "blocks", name: "Platform pack", cost: { wood: 1 }, out: { platform: 4 }, note: "One-way bridges. Hold S to drop through" },
    { id: "charge", cat: "blocks", name: "Blast charges", cost: { coal: 3, copper: 2, stone: 2 }, out: { charge: 2 }, note: "Clears a pocket of rock" },
    { id: "stickyCharge", cat: "blocks", name: "Sticky charges", cost: { coal: 2, copper: 1, gel: 2 }, out: { charge: 2 }, note: "Cheaper bombs after fighting slimes" },
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
    { id: "minerLamp", cat: "tools", name: "Miner lamp", cost: { copper: 4, coal: 6 }, lamp: 1, note: "Wider personal light" },
    { id: "beaconLamp", cat: "tools", name: "Beacon lamp", cost: { gold: 6, crystal: 4 }, lamp: 2, note: "The deep dark cannot touch you" },
    { id: "blastSatchel", cat: "tools", name: "Blast satchel", cost: { silk: 3, copper: 4, charge: 2 }, blastRadius: 0.65, note: "Charges carve a wider pocket" },
    { id: "heartCharm", cat: "tools", name: "Heart charm", cost: { relic: 2, mushroom: 3, gold: 3 }, maxHealth: 125, note: "Raises maximum health to 125" },
    { id: "enduranceCharm", cat: "tools", name: "Endurance charm", cost: { relic: 1, silk: 4, iron: 6 }, maxEnergy: 130, note: "Raises maximum energy to 130" },
    { id: "shadowWard", cat: "tools", name: "Shadow ward", cost: { core: 1, obsidian: 4, crystal: 4 }, ward: true, note: "Softens deep darkness and boss hits" },

    { id: "fieldKit", cat: "survival", name: "Field kit", cost: { wood: 2, coal: 2, mushroom: 1 }, out: { kit: 1 }, note: "Use from the hotbar: +45 health, +45 energy" },
    { id: "merchantKit", cat: "survival", name: "Merchant kit", cost: { coin: 12, mushroom: 1 }, out: { kit: 1 }, note: "Spend coins for a quick recovery kit" },
    { id: "vaultKit", cat: "survival", name: "Vault kit", cost: { coin: 18, silk: 2, mushroom: 2 }, out: { kit: 2 }, note: "Secret-room supplies packed into two field kits" }
  ];

  const CRAFT_CATS = [
    { id: "tools", label: "Tools" },
    { id: "blocks", label: "Blocks" },
    { id: "survival", label: "Survival" }
  ];

  // Enemy archetypes. "deep" variants kick in below 150 m.
  const ENEMIES = {
    crawler: { texture: "crawler", bodyW: 24, bodyH: 14, offX: 3, offY: 4, hp: 2, deepHp: 4, speed: 84, deepSpeed: 118, touch: 8, fly: false },
    bat: { texture: "bat", bodyW: 20, bodyH: 12, offX: 3, offY: 4, hp: 2, deepHp: 3, speed: 120, deepSpeed: 145, touch: 6, fly: true },
    slime: { texture: "slime", bodyW: 22, bodyH: 13, offX: 3, offY: 6, hp: 3, deepHp: 5, speed: 0, deepSpeed: 0, touch: 9, fly: false },
    golem: { texture: "golem", bodyW: 26, bodyH: 30, offX: 3, offY: 4, hp: 10, deepHp: 13, speed: 44, deepSpeed: 52, touch: 17, fly: false, heavy: true },
    broodmother: { texture: "broodmother", bodyW: 44, bodyH: 28, offX: 6, offY: 10, hp: 30, deepHp: 38, speed: 76, deepSpeed: 92, touch: 20, fly: false, heavy: true, boss: true },
    warden: { texture: "warden", bodyW: 42, bodyH: 48, offX: 7, offY: 8, hp: 52, deepHp: 64, speed: 50, deepSpeed: 66, touch: 28, fly: false, heavy: true, boss: true }
  };

  Object.assign(window.ML, {
    TILE,
    WORLD_W,
    WORLD_H,
    AIR,
    DAY_LENGTH,
    INTERACT_RANGE_TILES: 3.05,
    SAVE_KEY: "abyssforge.save.v1",
    LEGACY_SAVE_KEY: "minerland.save.v2",
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
    RECIPES,
    CRAFT_CATS,
    ENEMIES
  });
})();
