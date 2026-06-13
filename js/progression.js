(() => {
  "use strict";
  const ML = window.ML;

  const STARTER_ITEMS = new Set(["wood", "coal", "torch", "battery", "ladder", "kit"]);
  const ALWAYS_VISIBLE_RECIPES = new Set(["torch", "ladder", "platform"]);

  const ITEM_RULES = {
    dirt: { stat: "mined", at: 1 },
    stone: { stat: "mined", at: 1 },
    copper: { depth: 30 },
    iron: { depth: 72 },
    gold: { depth: 118 },
    crystal: { depth: 150 },
    obsidian: { depth: 210 },
    gel: { stat: "enemies", at: 1 },
    coin: { stat: "chests", at: 1 },
    silk: { stat: "bosses", at: 1 },
    fang: { stat: "bosses", at: 1 },
    relic: { stat: "secrets", at: 1 },
    core: { stat: "bosses", at: 2 },
    platform: { recipe: "platform" },
    charge: { recipe: "charge" },
    mushroom: { depth: 38 }
  };

  const RECIPE_GATES = {
    gelTorch: { item: "gel" },
    mushroomFlare: { item: "mushroom" },
    stoneBridge: { item: "stone" },
    ironLadder: { item: "iron" },
    silkLadder: { item: "silk" },
    obsidianBridge: { item: "obsidian" },
    charge: { item: "copper" },
    stickyCharge: { item: "gel" },
    bombCrate: { item: "iron" },
    crystalBeacon: { item: "crystal" },
    coreCharge: { item: "core" },
    stonePick: { item: "stone" },
    copperPick: { item: "copper" },
    ironPick: { item: "iron" },
    crystalDrill: { item: "crystal" },
    starDrill: { item: "obsidian" },
    copperEdge: { item: "copper" },
    ironEdge: { item: "iron" },
    crystalEdge: { item: "crystal" },
    abyssEdge: { item: "fang" },
    caveBoots: { item: "iron" },
    minerLamp: { item: "copper" },
    beaconLamp: { item: "crystal" },
    reinforcedSoles: { item: "silk" },
    echoPadding: { item: "silk" },
    sprintGreaves: { item: "fang" },
    blastSatchel: { item: "silk" },
    heartCharm: { item: "relic" },
    titanHeart: { item: "core" },
    enduranceCharm: { item: "relic" },
    forgeHarness: { item: "core" },
    recoveryCharm: { item: "relic" },
    vaultCompass: { item: "relic" },
    luckyPouch: { item: "silk" },
    shadowWard: { item: "core" },
    recallCharm: { item: "relic" },
    fieldKit: { item: "mushroom" },
    merchantKit: { item: "coin" },
    merchantTorchCrate: { item: "coin" },
    lampCells: { item: "copper" },
    crystalCells: { item: "crystal" },
    surveyorLadderPack: { item: "coin" },
    blackPowderOrder: { item: "coin" },
    guildSupplyDrop: { item: "relic" },
    mushroomStew: { item: "mushroom" },
    ironRationBox: { item: "iron" },
    vaultKit: { item: "silk" },
    bossTonic: { item: "core" },
    coinPress: { item: "gold" },
    crystalTrade: { item: "crystal" }
  };

  function statAt(sim, stat, at = 1) {
    return (sim?.stats?.[stat] || 0) >= at;
  }

  function depthAt(sim, at) {
    return (sim?.stats?.deepest || 0) >= at;
  }

  function normalizeKnown(sim) {
    if (!sim) return {};
    if (!sim.knownItems || typeof sim.knownItems !== "object" || Array.isArray(sim.knownItems)) {
      sim.knownItems = {};
    }
    for (const item of STARTER_ITEMS) {
      sim.knownItems[item] = true;
    }
    for (const [item, count] of Object.entries(sim.inventory || {})) {
      if (count > 0 && ML.ITEM_META?.[item]) sim.knownItems[item] = true;
    }
    return sim.knownItems;
  }

  function rememberItem(sim, item) {
    if (!sim || !ML.ITEM_META?.[item]) return false;
    normalizeKnown(sim)[item] = true;
    return true;
  }

  function rememberItems(sim, items) {
    for (const item of items || []) rememberItem(sim, item);
  }

  function rememberRecipe(sim, recipe) {
    if (!sim || !recipe) return;
    if (recipe.out) rememberItems(sim, Object.keys(recipe.out));
    if (recipe.id === "platform") rememberItem(sim, "platform");
    if (recipe.id === "charge" || recipe.id === "stickyCharge" || recipe.id === "bombCrate" || recipe.id === "coreCharge") rememberItem(sim, "charge");
    sim.discoveredRecipes = Object.assign({}, sim.discoveredRecipes || {}, { [recipe.id]: true });
  }

  function ruleMet(sim, rule) {
    if (!rule) return false;
    if (rule.item && isItemKnown(sim, rule.item)) return true;
    if (rule.stat && statAt(sim, rule.stat, rule.at || 1)) return true;
    if (rule.depth && depthAt(sim, rule.depth)) return true;
    if (rule.recipe && (sim?.craftedRecipes?.[rule.recipe] || sim?.discoveredRecipes?.[rule.recipe])) return true;
    return false;
  }

  function isItemKnown(sim, item) {
    if (!ML.ITEM_META?.[item]) return false;
    const known = normalizeKnown(sim);
    if (known[item]) return true;
    if ((sim?.inventory?.[item] || 0) > 0) {
      known[item] = true;
      return true;
    }
    const rule = ITEM_RULES[item];
    return ruleMet(sim, rule);
  }

  function costItemsKnown(sim, recipe) {
    return Object.keys(recipe?.cost || {}).every((item) => isItemKnown(sim, item));
  }

  function canAffordKnown(sim, recipe) {
    return ML.canAfford?.(sim?.inventory || {}, recipe?.cost || {}) && costItemsKnown(sim, recipe);
  }

  function recipeVisible(sim, recipe) {
    if (!recipe) return false;
    if (ALWAYS_VISIBLE_RECIPES.has(recipe.id)) return true;
    if (sim?.craftedRecipes?.[recipe.id] || sim?.discoveredRecipes?.[recipe.id]) return true;
    if (canAffordKnown(sim, recipe)) return true;
    const gate = RECIPE_GATES[recipe.id];
    if (gate && !ruleMet(sim, gate)) return false;
    return costItemsKnown(sim, recipe);
  }

  function inventoryItems(sim, options = {}) {
    const includeEmpty = Boolean(options.includeEmpty);
    const includeHotbarEmpty = Boolean(options.includeHotbarEmpty);
    return Object.keys(ML.ITEM_META || {}).filter((item) => {
      const amount = sim?.inventory?.[item] || 0;
      if (amount > 0) return isItemKnown(sim, item);
      if (!isItemKnown(sim, item)) return false;
      return includeEmpty || (includeHotbarEmpty && ML.HOTBAR?.includes(item));
    });
  }

  function signature(sim) {
    const known = normalizeKnown(sim);
    const visibleItems = Object.keys(ML.ITEM_META || {}).filter((item) => isItemKnown(sim, item)).join(",");
    const discoveredRecipes = Object.keys(sim?.discoveredRecipes || {}).sort().join(",");
    const craftedRecipes = Object.keys(sim?.craftedRecipes || {}).sort().join(",");
    const stats = sim?.stats || {};
    return [
      visibleItems,
      discoveredRecipes,
      craftedRecipes,
      stats.mined || 0,
      stats.deepest || 0,
      stats.enemies || 0,
      stats.bosses || 0,
      stats.secrets || 0,
      stats.chests || 0,
      stats.surfaceDiscoveries || 0,
      Object.keys(known).filter((item) => known[item]).sort().join(",")
    ].join("|");
  }

  ML.Progression = {
    STARTER_ITEMS,
    ITEM_RULES,
    RECIPE_GATES,
    ensureKnownItems: normalizeKnown,
    rememberItem,
    rememberItems,
    rememberRecipe,
    isItemKnown,
    inventoryItems,
    recipeVisible,
    signature
  };
})();
