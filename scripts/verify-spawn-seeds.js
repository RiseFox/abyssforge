const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const GAME_URL = process.env.MINERLAND_URL || pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;
const SEED_COUNT = Number(process.env.SPAWN_SEED_COUNT || 300);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !message.text().includes("ReadPixels")) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto(GAME_URL);
  await page.waitForSelector("canvas");

  const seedCheck = await page.evaluate((seedCount) => {
    const { TILE, AIR, Tile, BLOCKS } = window.ML;
    const failures = [];
    const ecologyFailures = [];
    const ecologyCounts = {};

    for (let seed = 1; seed <= seedCount; seed += 1) {
      const actualSeed = seed * 7919;
      const sim = new window.ML.MinerSim();
      sim.newWorld(actualSeed);
      const floorY = sim.spawnFloorY();
      const floor = sim.tileAt(sim.spawn.x, floorY);
      const safe = sim.safeSpawnPixels();
      const footY = Math.floor((safe.y + 18) / TILE);
      const stable = sim.hasStableSpawnFloor();
      const support = sim.hasPlayerSupport(safe);
      const campReady = window.ML.CampSystem.isNearCamp(sim, safe);
      const campfireCount = sim.lights.filter((light) => light.t === Tile.CAMPFIRE).length;
      const secretCount = sim.secrets?.length || 0;
      const bossCount = sim.mobs.filter((mob) => window.ML.ENEMIES[mob.kind]?.boss).length;
      let surfaceSpot = null;

      if (!stable || !support || !campReady || campfireCount < 1 || floor === AIR || floor === Tile.PLATFORM || !BLOCKS[floor]?.solid || footY !== floorY || secretCount < 5 || bossCount < 2) {
        failures.push({ seed: actualSeed, spawn: sim.spawn, shaft: sim.shaft, floorY, floor, safe, footY, stable, support, campReady, campfireCount, secretCount, bossCount });
      }

      for (const mob of sim.mobs) {
        const rule = window.ML.MOB_SPAWN_RULES[mob.kind];
        const depth = sim.mobDepthAt(mob.x, mob.y);
        const biome = sim.mobBiomeIdAt(mob.x, mob.y);
        const context = {
          boss: Boolean(mob.boss),
          secret: Boolean(mob.secretId),
          event: Boolean(mob.event),
          summoned: Boolean(mob.summoned),
          surface: Boolean(mob.surf),
          temporary: Boolean(mob.surf),
          nightRaid: Boolean(mob.surf)
        };
        const valid = sim.canSpawnMobAt(mob.kind, mob.x, mob.y, context);
        const layer = rule?.layer || "unknown";
        ecologyCounts[layer] = (ecologyCounts[layer] || 0) + 1;
        const caveOnSurface = rule && !rule.surfaceOnly && !rule.boss && (depth < rule.minDepth || biome === "surface" || sim.openSkyAt(mob.x, mob.y));
        const invalidSurfaceKind = mob.surf && mob.kind !== "mossling";
        if ((!rule || !valid || caveOnSurface || invalidSurfaceKind) && ecologyFailures.length < 20) {
          ecologyFailures.push({ seed: actualSeed, mob, layer, depth, biome, valid, caveOnSurface, invalidSurfaceKind });
        }
      }

      for (let x = 4; x < window.ML.WORLD_W - 4 && !surfaceSpot; x += 1) {
        const y = (sim.surface[x] || 24) - 1;
        if (sim.canSpawnMobAt("mossling", x, y, { surface: true, temporary: true, nightRaid: true })) surfaceSpot = { x, y };
      }
      if (!surfaceSpot) {
        ecologyFailures.push({ seed: actualSeed, reason: "no valid mossling surface spot" });
      } else {
        for (const caveKind of ["crawler", "slime", "bat", "golem"]) {
          if (sim.canSpawnMobAt(caveKind, surfaceSpot.x, surfaceSpot.y, { natural: true }) && ecologyFailures.length < 20) {
            ecologyFailures.push({ seed: actualSeed, reason: "cave mob accepted on surface", caveKind, surfaceSpot });
          }
        }
      }
    }

    return { checked: seedCount, failures, ecologyFailures, ecologyCounts };
  }, SEED_COUNT);

  const progressionCheck = await page.evaluate(() => {
    const sim = new window.ML.MinerSim();
    sim.newWorld(7919);
    const { WORLD_H, WORLD_W } = window.ML;
    const maxFlatRun = (surface) => {
      let max = 1;
      let run = 1;
      for (let i = 1; i < surface.length; i += 1) {
        if (surface[i] === surface[i - 1]) run += 1;
        else run = 1;
        max = Math.max(max, run);
      }
      return max;
    };
    const countSurfaceMarks = (sampleSim) => {
      const marks = { signs: 0, camps: 0 };
      for (let x = 0; x < sampleSim.worldWidth(); x += 1) {
        const y = (sampleSim.surface[x] || 24) - 1;
        const tile = sampleSim.tileAt(x, y);
        if (tile === window.ML.Tile.SIGN) marks.signs += 1;
        if (tile === window.ML.Tile.CAMPFIRE) marks.camps += 1;
      }
      return marks;
    };
    const terrainSeeds = [7919, 123456789, 246813, 98765, 43210, 5554501, 7777777];
    const terrainSamples = terrainSeeds.map((seed) => {
      const sample = new window.ML.MinerSim();
      sample.newWorld(seed);
      return {
        seed,
        maxFlat: maxFlatRun(sample.surface),
        surfaceMarks: countSurfaceMarks(sample)
      };
    });
    const horizonSim = new window.ML.MinerSim();
    horizonSim.newWorld(7919);
    const horizonSteps = [];
    for (let i = 0; i < 8; i += 1) {
      const direction = i % 2 === 0 ? "right" : "left";
      const result = horizonSim.extendHorizontal(direction, 96);
      horizonSteps.push({
        direction,
        surface: result?.surfaceDiscoveries || 0,
        underground: result?.undergroundDiscoveries || 0
      });
    }
    const terrainCheck = {
      starterMaxFlat: Math.max(...terrainSamples.map((entry) => entry.maxFlat)),
      starterSurfaceSigns: Math.max(...terrainSamples.map((entry) => entry.surfaceMarks.signs)),
      starterSurfaceCamps: Math.max(...terrainSamples.map((entry) => entry.surfaceMarks.camps)),
      horizonMaxFlat: maxFlatRun(horizonSim.surface),
      firstPairSurfaceDiscoveries: horizonSteps.slice(0, 2).reduce((sum, entry) => sum + entry.surface, 0),
      horizonSurfaceDiscoveries: horizonSim.surfaceDiscoveries.filter((entry) => entry.scope !== "underground").length,
      horizonUndergroundDiscoveries: horizonSim.surfaceDiscoveries.filter((entry) => entry.scope === "underground").length
    };
    const fresh = new window.ML.MinerSim();
    fresh.newWorld(7919);
    const itemCatalogSize = Object.keys(window.ML.ITEM_META || {}).length;
    const newMaterialItems = ["amber", "quartz", "ember", "voidglass", "mapScrap", "clockwork", "mirrorShard", "strangeKey"];
    const newMaterialsPresent = newMaterialItems.filter((item) => window.ML.ITEM_META[item]).length;
    const surpriseLootCount = (window.ML.CHEST_SURPRISES || []).length;
    const surpriseLootItemsValid = (window.ML.CHEST_SURPRISES || []).every((entry) => entry.item && window.ML.ITEM_META[entry.item]);
    const newRecipeIds = ["amberLanterns", "emberCharges", "clockworkRegulator", "mirrorCache", "keyedRelic", "voidglassEdge", "quartzCells", "surveyCache", "emberRation"];
    const newRecipesPresent = newRecipeIds.filter((id) => window.ML.RECIPES.some((recipe) => recipe.id === id)).length;
    const newOreTiles = [window.ML.Tile.AMBER, window.ML.Tile.QUARTZ, window.ML.Tile.EMBER, window.ML.Tile.VOIDGLASS].filter((tile) => Number.isFinite(tile));
    const newOreTilesInWorld = newOreTiles.reduce((sum, tile) => sum + fresh.world.reduce((rows, row) => rows + row.filter((cell) => cell === tile).length, 0), 0);
    const starterKnownItems = window.ML.Progression?.inventoryItems?.(fresh, { includeEmpty: true }).length || itemCatalogSize;
    const starterCraftVisible = window.ML.RECIPES.filter((recipe) => window.ML.recipeVisible(fresh, recipe)).length;
    const starterCraftReady = window.ML.craftableRecipes(fresh).length;
    const starterLockedHotbar = window.ML.HOTBAR.filter((item) => !window.ML.Progression?.isItemKnown?.(fresh, item)).length;
    const starterStoneHidden = !window.ML.Progression?.isItemKnown?.(fresh, "stone");
    const starterCoreHidden = !window.ML.Progression?.isItemKnown?.(fresh, "core");
    const copperBeforePickup = Boolean(window.ML.Progression?.isItemKnown?.(fresh, "copper"));
    fresh.addItem("copper", 1);
    const copperKnownAfterPickup = Boolean(window.ML.Progression?.isItemKnown?.(fresh, "copper"));
    const platformRecipeForFresh = window.ML.RECIPES.find((recipe) => recipe.id === "platform");
    const platformKnownBeforeCraft = Boolean(window.ML.Progression?.isItemKnown?.(fresh, "platform"));
    const platformCraftForFresh = fresh.craft(platformRecipeForFresh);
    const platformKnownAfterCraft = Boolean(window.ML.Progression?.isItemKnown?.(fresh, "platform"));
    const regulatorRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "clockworkRegulator");
    const regulatorSim = new window.ML.MinerSim();
    regulatorSim.newWorld(3117);
    regulatorSim.addItem("clockwork", 1);
    regulatorSim.addItem("quartz", 3);
    regulatorSim.addItem("copper", 2);
    const regulatorCraft = regulatorSim.craft(regulatorRecipe);
    regulatorSim.lamp = 1;
    regulatorSim.refillLamp();
    regulatorSim.drainLamp(20, 1);
    const regulatorLampAfter = regulatorSim.lampChargeRatio();
    const plainLampSim = new window.ML.MinerSim();
    plainLampSim.newWorld(3117);
    plainLampSim.lamp = 1;
    plainLampSim.refillLamp();
    plainLampSim.drainLamp(20, 1);
    const plainLampAfter = plainLampSim.lampChargeRatio();
    const craftable = window.ML.craftableRecipes(sim);
    const platformRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "platform");
    const craftResult = sim.craft(platformRecipe);
    const recallRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "recallCharm");
    sim.addItem("relic", 1);
    sim.addItem("crystal", 2);
    sim.addItem("coin", 24);
    const recallCraft = sim.craft(recallRecipe);
    const echoRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "echoPadding");
    sim.addItem("silk", 2);
    sim.addItem("gel", 4);
    sim.addItem("mushroom", 2);
    const echoCraft = sim.craft(echoRecipe);
    const campService = window.ML.CAMP_SERVICES.find((service) => service.id === "torchCache");
    const restService = window.ML.CAMP_SERVICES.find((service) => service.id === "rest");
    sim.addItem("coin", 8);
    const torchesBefore = sim.inventory.torch || 0;
    const campResult = sim.campService(campService);
    const camp = sim.secrets.find((secret) => secret.camp)?.camp || window.ML.CampSystem.surfaceCamp(sim);
    sim.health = 12;
    sim.energy = 8;
    const campPlayer = { x: camp.x * window.ML.TILE + window.ML.TILE / 2, y: (camp.y + 1) * window.ML.TILE - 17 };
    const restResult = sim.campService(restService, campPlayer);
    const activeCamp = window.ML.CampSystem.activeCamp(sim);
    const campSpawn = window.ML.CampSystem.activeCampSpawnPixels(sim);
    const campSupport = sim.hasPlayerSupport(campSpawn);
    const contractBefore = sim.contractProgress();
    if (contractBefore?.contract.absolute) {
      sim.stats[contractBefore.contract.type] = contractBefore.target;
    } else if (contractBefore) {
      sim.stats[contractBefore.contract.type] = contractBefore.contract.start + contractBefore.target;
    }
    const contractClaim = sim.claimContract();
    const loreSystem = Boolean(window.ML.LoreSystem?.evaluate && window.ML.LoreSystem?.intel);
    sim.stats.deepest = 230;
    sim.stats.secrets = 5;
    sim.stats.camps = 3;
    sim.stats.bosses = 2;
    sim.stats.watcherSightings = 3;
    sim.stats.watcherTraces = 1;
    sim.stats.shadowPeaks = 1;
    sim.pickLevel = 6;
    sim.lamp = 2;
    sim.refillLamp?.();
    const lampStart = sim.lampChargeRatio?.() || 0;
    const lampDrain = sim.drainLamp?.(18, 1.2);
    const lampAfterDrain = sim.lampChargeRatio?.() || 0;
    sim.lampCharge = 0.2;
    sim.inventory.battery = 1;
    const lampSwap = sim.drainLamp?.(1, 1.2);
    const lampAfterSwap = sim.lampChargeRatio?.() || 0;
    const batteryAfterSwap = sim.inventory.battery || 0;
    sim.lampCharge = 0;
    sim.inventory.battery = 0;
    const lampEmpty = sim.drainLamp?.(1, 1);
    const lampOutputEmpty = sim.lampOutput?.();
    sim.recallCharm = true;
    sim.ward = true;
    sim.inventory.mushroom = 5;
    sim.inventory.crystal = 1;
    sim.stats.events = 3;
    sim.stats.enemies = 10;
    sim.stats.noiseLures = 1;
    sim.stats.worldExpansions = 2;
    sim.stats.observerAnomalies = 4;
    sim.stats.heroThoughts = 1;
    sim.stats.mobAwareness = 1;
    sim.stats.spatialRifts = 1;
    window.ML.LoreSystem?.evaluate?.(sim, { biome: window.ML.BIOMES?.obsidianabyss, bossKind: "warden", watcher: true, shadowPeak: true });
    const loreIntel = window.ML.LoreSystem?.intel?.(sim) || {};
    const eventVariantCount = Object.values(window.ML.CAVE_EVENTS || {}).filter((event) => (event.variants || []).length >= 3).length;
    const enemyAiProfiles = Object.values(window.ML.ENEMIES || {}).filter((enemy) => enemy.ai?.mind).length;
    const observerMomentCount = Object.keys(window.ML.OBSERVER_MOMENTS || {}).length;
    const scene = window.ML.sceneRef;
    const sceneOriginalPlayer = scene?.player ? { x: scene.player.x, y: scene.player.y } : null;
    const lampSceneSim = scene?.sim;
    let lampStandbyCheck = null;
    let lampDarkCheck = null;
    if (scene && lampSceneSim && typeof scene.externalLightAt === "function" && typeof scene.updateLampBattery === "function") {
      const litCamp = window.ML.CampSystem.surfaceCamp(lampSceneSim);
      const litPos = litCamp ? window.ML.CampSystem.campSpawnPixels(lampSceneSim, litCamp) : lampSceneSim.safeSpawnPixels();
      lampSceneSim.lamp = 2;
      lampSceneSim.refillLamp?.();
      lampSceneSim.inventory.battery = 0;
      scene.player.setPosition(litPos.x, litPos.y);
      lampSceneSim.player = { x: litPos.x, y: litPos.y };
      scene.lampStandby = false;
      const litExternal = scene.externalLightAt(scene.player.x, scene.player.y);
      const standbyBefore = lampSceneSim.lampChargeRatio?.() || 0;
      scene.updateLampBattery(18);
      const standbyAfter = lampSceneSim.lampChargeRatio?.() || 0;
      lampStandbyCheck = { light: litExternal, before: standbyBefore, after: standbyAfter, standby: Boolean(scene.lampStandby) };

      let darkSpot = null;
      const width = lampSceneSim.worldWidth?.() || lampSceneSim.world?.[0]?.length || WORLD_W;
      const height = lampSceneSim.worldHeight?.() || lampSceneSim.world?.length || WORLD_H;
      for (let y = 64; y < height - 8 && !darkSpot; y += 1) {
        for (let x = 4; x < width - 4; x += 1) {
          if (!lampSceneSim.hasHeadClearance?.(x, y)) continue;
          const floor = lampSceneSim.tileAt(x, y);
          if (!window.ML.BLOCKS[floor]?.solid) continue;
          const px = x * window.ML.TILE + window.ML.TILE / 2;
          const py = y * window.ML.TILE - 17;
          const external = scene.externalLightAt(px, py);
          if (external < 0.28) {
            darkSpot = { x: px, y: py, external };
            break;
          }
        }
      }
      lampSceneSim.refillLamp?.();
      scene.lampStandby = false;
      if (darkSpot) {
        scene.player.setPosition(darkSpot.x, darkSpot.y);
        lampSceneSim.player = { x: darkSpot.x, y: darkSpot.y };
        const darkBefore = lampSceneSim.lampChargeRatio?.() || 0;
        scene.updateLampBattery(8);
        const darkAfter = lampSceneSim.lampChargeRatio?.() || 0;
        lampDarkCheck = { light: darkSpot.external, before: darkBefore, after: darkAfter, standby: Boolean(scene.lampStandby) };
      }
      if (sceneOriginalPlayer) {
        scene.player.setPosition(sceneOriginalPlayer.x, sceneOriginalPlayer.y);
        lampSceneSim.player = { x: sceneOriginalPlayer.x, y: sceneOriginalPlayer.y };
        scene.lampStandby = false;
        scene.updateLampBattery(0);
      }
    }
    const biomeSamples = [];
    const biomeIds = new Set();
    const sampleBiome = (x, y) => {
      const tx = Math.max(0, Math.min(WORLD_W - 1, Math.floor(x)));
      const height = sim.worldHeight?.() || sim.world?.length || WORLD_H;
      const ty = Math.max(0, Math.min(height - 1, Math.floor(y)));
      const biome = window.ML.BiomeSystem?.biomeAt?.(sim, tx, ty);
      if (!biome) return;
      biomeIds.add(biome.id);
      biomeSamples.push({ x: tx, y: ty, id: biome.id, name: biome.name });
    };
    sampleBiome(sim.spawn.x, sim.spawn.y);
    [20, 45, 85, 145, 175, 220, 248].forEach((depth, index) => {
      const x = Math.max(3, Math.min(WORLD_W - 4, 15 + index * 22));
      sampleBiome(x, (sim.surface[x] || 24) + depth);
    });
    for (const secret of sim.secrets || []) {
      sampleBiome(secret.x + Math.floor(secret.w / 2), secret.y + Math.floor(secret.h / 2));
    }
    const traceBefore = scene?.watcherTraceMarks?.length || 0;
    const trace = scene?.leaveWatcherTrace?.(scene.player.x + 280, scene.player.y, "test");
    const traceAfter = scene?.watcherTraceMarks?.length || 0;
    const watcherSpot = scene?.findWatcherSpot?.({ force: true });
    const observerBefore = scene?.sim?.stats?.observerAnomalies || 0;
    const forcedObserver = scene?.triggerObserverMoment?.("idle", { force: true, silent: true });
    const forcedMobStare = scene?.triggerObserverMoment?.("mobStare", { force: true, silent: true, enemy: scene.player });
    const forcedRift = scene?.triggerObserverMoment?.("spatialRift", { force: true, silent: true, x: scene.player.x + 96, y: scene.player.y - 80 });
    const observerAfter = scene?.sim?.stats?.observerAnomalies || 0;
    const riftCount = scene?.observerRifts?.length || 0;
    const sceneSim = scene?.sim;
    const stagedMob = sceneSim?.mobs?.find?.((mob) => !mob.boss && !scene.activeMobIds?.has?.(mob.id));
    const stagedSpot = stagedMob ? scene.findMobSpot?.(stagedMob) : null;
    const mobWakeQueued = stagedMob && stagedSpot ? scene.queueMobMaterialize?.(stagedMob, stagedSpot, { delay: 1200, reason: "test" }) : false;
    const pendingAfterQueue = scene?.pendingMobSpawns?.size || 0;
    if (mobWakeQueued) scene.cancelPendingMobSpawn?.(stagedMob.id, false);
    const pendingAfterCancel = scene?.pendingMobSpawns?.size || 0;
    const heightBefore = sim.worldHeight?.() || sim.world.length;
    const seamX = sim.shaft.x;
    const extension = sim.extendDepth?.(seamX, 64);
    const heightAfter = sim.worldHeight?.() || sim.world.length;
    const seamOpened = sim.tileAt(seamX, heightBefore - 3) !== window.ML.Tile.BEDROCK;
    const secondExtension = sim.extendDepth?.(seamX, 48);
    const heightAfterSecond = sim.worldHeight?.() || sim.world.length;
    const secondSeamOpened = sim.tileAt(seamX, heightAfter - 3) !== window.ML.Tile.BEDROCK;
    const widthBefore = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
    const eastExtension = sim.extendHorizontal?.("right", 64);
    const widthAfterEast = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
    const westExtension = sim.extendHorizontal?.("left", 64);
    const widthAfterWest = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
    const horizontalSpawnStable = sim.hasStableSpawnFloor?.();
    const horizontalCampSupport = sim.hasPlayerSupport?.(sim.safeSpawnPixels?.());
    const sceneWidthBefore = scene?.worldWidthTiles?.() || scene?.sim?.worldWidth?.() || WORLD_W;
    const sceneRightOpen = scene?.openHorizontalRegion?.("right");
    const sceneWidthAfterRight = scene?.worldWidthTiles?.() || scene?.sim?.worldWidth?.() || WORLD_W;
    const sceneLeftXBefore = scene?.player?.x || 0;
    const sceneLeftOpen = scene?.openHorizontalRegion?.("left");
    const sceneWidthAfterLeft = scene?.worldWidthTiles?.() || scene?.sim?.worldWidth?.() || WORLD_W;
    const sceneLeftShift = (scene?.player?.x || 0) - sceneLeftXBefore;
    const sceneHorizontalSupport = scene?.sim?.hasPlayerSupport?.({ x: scene.player.x, y: scene.player.y });
    const undergroundDiscovery = sim.surfaceDiscoveries?.find?.((entry) => entry.scope === "underground" && sim.tileAt(entry.x, entry.y) === window.ML.Tile.SIGN);
    const sceneSurfaceDiscovery = scene?.sim?.surfaceDiscoveries?.find?.((entry) => entry.scope !== "underground" && scene.sim.tileAt(entry.x, entry.y) === window.ML.Tile.SIGN);
    const sceneDiscovery = sceneSurfaceDiscovery
      || scene?.sim?.surfaceDiscoveries?.find?.((entry) => scene.sim.tileAt(entry.x, entry.y) === window.ML.Tile.SIGN);
    const sceneDiscoveryStatKey = sceneDiscovery?.scope === "underground" ? "undergroundDiscoveries" : "surfaceDiscoveries";
    const sceneDiscoveryBefore = scene?.sim?.stats?.[sceneDiscoveryStatKey] || 0;
    let sceneDiscoveryRead = false;
    if (sceneDiscovery) {
      const floorY = sceneDiscovery.y + 1;
      scene.player.setPosition(sceneDiscovery.x * window.ML.TILE + window.ML.TILE / 2, floorY * window.ML.TILE - 17);
      scene.sim.player = { x: scene.player.x, y: scene.player.y };
      sceneDiscoveryRead = scene.readSurfaceDiscovery?.(sceneDiscovery.x, sceneDiscovery.y) || false;
    }
    const sceneDiscoveryAfter = scene?.sim?.stats?.[sceneDiscoveryStatKey] || 0;
    const sceneDiscoveryTarget = sceneDiscovery ? scene.interactionTarget?.() : null;
    const sceneUndergroundDiscovery = scene?.sim?.surfaceDiscoveries?.find?.((entry) =>
      entry !== sceneDiscovery
      && entry.scope === "underground"
      && scene.sim.tileAt(entry.x, entry.y) === window.ML.Tile.SIGN
    ) || (sceneDiscovery?.scope === "underground" ? sceneDiscovery : null);
    const sceneUndergroundBefore = scene?.sim?.stats?.undergroundDiscoveries || 0;
    let sceneUndergroundRead = false;
    if (sceneUndergroundDiscovery) {
      const floorY = sceneUndergroundDiscovery.y + 1;
      scene.player.setPosition(sceneUndergroundDiscovery.x * window.ML.TILE + window.ML.TILE / 2, floorY * window.ML.TILE - 17);
      scene.sim.player = { x: scene.player.x, y: scene.player.y };
      sceneUndergroundRead = scene.readSurfaceDiscovery?.(sceneUndergroundDiscovery.x, sceneUndergroundDiscovery.y) || false;
    }
    const sceneUndergroundAfter = scene?.sim?.stats?.undergroundDiscoveries || 0;
    let poiAmbienceCheck = null;
    let curiosityDiscovery = scene?.sim?.surfaceDiscoveries?.find?.((entry) =>
      entry !== sceneDiscovery
      && entry !== sceneUndergroundDiscovery
      && entry.scope === "underground"
      && !entry.read
      && scene.sim.tileAt(entry.x, entry.y) === window.ML.Tile.SIGN
    );
    if (!curiosityDiscovery && scene?.openHorizontalRegion?.("right")) {
      curiosityDiscovery = scene?.sim?.surfaceDiscoveries?.find?.((entry) =>
        entry !== sceneDiscovery
        && entry !== sceneUndergroundDiscovery
        && entry.scope === "underground"
        && !entry.read
        && scene.sim.tileAt(entry.x, entry.y) === window.ML.Tile.SIGN
      );
    }
    if (scene && curiosityDiscovery) {
      const { TILE } = window.ML;
      scene.player.setPosition(curiosityDiscovery.x * TILE + TILE / 2, (curiosityDiscovery.y + 1) * TILE - 17);
      scene.sim.player = { x: scene.player.x, y: scene.player.y };
      scene.cameras.main.centerOn(scene.player.x, scene.player.y);
      scene.nextPoiSignalScanAt = 0;
      scene.updatePoiAmbience?.();
      const cfg = window.ML.ENEMIES.crawler;
      const enemy = scene.enemies.create((curiosityDiscovery.x + 1.5) * TILE, curiosityDiscovery.y * TILE + 12, cfg.texture);
      enemy.kind = "crawler";
      enemy.body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.offX, cfg.offY);
      enemy.hp = cfg.hp;
      enemy.maxHp = cfg.hp;
      enemy.speed = cfg.speed;
      enemy.touch = cfg.touch;
      enemy.boss = false;
      enemy.elite = false;
      enemy.bobSeed = 0;
      enemy.nextThinkAt = 0;
      enemy.nextPoiScanAt = 0;
      enemy.poiAnchor = null;
      enemy.intent = null;
      scene.noiseEvents = [];
      const farTileX = curiosityDiscovery.x < scene.worldWidthTiles() / 2
        ? Math.min(scene.worldWidthTiles() - 8, curiosityDiscovery.x + 34)
        : Math.max(8, curiosityDiscovery.x - 34);
      scene.player.setPosition(farTileX * TILE, (curiosityDiscovery.y + 1) * TILE - 17);
      scene.sim.player = { x: scene.player.x, y: scene.player.y };
      const intent = scene.enemyInstinct?.(enemy, (scene.time?.now || 0) + 1200);
      poiAmbienceCheck = {
        runtime: typeof scene.updatePoiAmbience === "function" && typeof scene.discoveryAnchorForEnemy === "function",
        visible: Boolean(scene.visiblePoiSignals?.some?.((entry) => entry.id === curiosityDiscovery.id)),
        poiCurious: Boolean(intent?.poiCurious),
        mode: intent?.mode || null,
        targetNear: Math.abs((intent?.targetX || 0) - (curiosityDiscovery.x * TILE + TILE / 2)) < 2
          && Math.abs((intent?.targetY || 0) - (curiosityDiscovery.y * TILE + TILE / 2)) < 2
      };
      enemy.destroy();
    }
    let combatLosCheck = null;
    if (scene?.player && scene?.enemies && scene?.sim && typeof scene.hasSightToEnemy === "function") {
      const { TILE, AIR, Tile, BLOCKS } = window.ML;
      const baseX = Math.max(10, Math.min(scene.worldWidthTiles() - 12, (scene.sim.spawn?.x || 20) + 8));
      const floorY = Math.max(30, Math.min(scene.worldHeightTiles() - 12, (scene.sim.surface?.[baseX] || 24) + 7));
      const previousPlayer = { x: scene.player.x, y: scene.player.y };
      const setTile = (x, y, tileId) => {
        scene.sim.setTile(x, y, tileId);
        if (tileId === AIR) {
          scene.layer.removeTileAt(x, y, false);
        } else {
          const tile = scene.layer.putTileAt(tileId, x, y, false);
          const block = BLOCKS[tileId];
          if (tile && block?.solid) {
            if (block.platform) tile.setCollision(false, false, true, false);
            else tile.setCollision(true);
          } else if (tile) {
            tile.setCollision(false);
          }
        }
      };
      const buildArena = (wallTile) => {
        for (let y = floorY - 5; y <= floorY; y += 1) {
          for (let x = baseX - 2; x <= baseX + 7; x += 1) {
            setTile(x, y, y === floorY ? Tile.STONE : AIR);
          }
        }
        if (wallTile !== AIR) {
          for (let y = floorY - 3; y < floorY; y += 1) setTile(baseX + 2, y, wallTile);
        }
        scene.layer.calculateFacesWithin(baseX - 3, floorY - 6, 12, 8);
      };
      buildArena(Tile.STONE);

      scene.player.setPosition((baseX + 0.5) * TILE, floorY * TILE - 17);
      scene.player.setVelocity(0, 0);
      scene.player.setFlipX(false);
      scene.sim.player = { x: scene.player.x, y: scene.player.y };
      const cfg = window.ML.ENEMIES.crawler;
      const enemy = scene.enemies.create((baseX + 4.5) * TILE, floorY * TILE - 17, cfg.texture);
      enemy.kind = "crawler";
      enemy.hp = 30;
      enemy.maxHp = 30;
      enemy.speed = cfg.speed;
      enemy.touch = cfg.touch;
      enemy.body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.offX, cfg.offY);
      const pointer = { worldX: enemy.x, worldY: enemy.y };
      const blockedPointer = scene.findEnemyAtPointer(pointer);
      const blockedTargets = scene.findAttackTargets(pointer);
      const blockedTileTarget = scene.targetTile({ worldX: (baseX + 3.5) * TILE, worldY: (floorY - 1.5) * TILE });
      const hpBeforeBlockedAttack = enemy.hp;
      scene.nextAttackAt = 0;
      const blockedAttackResult = scene.attack(pointer);
      const hpAfterBlockedAttack = enemy.hp;

      for (let y = floorY - 3; y < floorY; y += 1) setTile(baseX + 2, y, AIR);
      scene.layer.calculateFacesWithin(baseX - 3, floorY - 6, 12, 8);
      const openPointer = scene.findEnemyAtPointer(pointer);
      const openTargets = scene.findAttackTargets(pointer);
      const hpBeforeOpenAttack = enemy.hp;
      scene.nextAttackAt = 0;
      const openAttackResult = scene.attack(pointer);
      const hpAfterOpenAttack = enemy.hp;

      buildArena(Tile.BEDROCK);
      enemy.hp = 30;
      const hpBeforeBlockedBlast = enemy.hp;
      scene.explode(baseX + 1, floorY - 2, 2.45);
      const hpAfterBlockedBlast = enemy.hp;
      buildArena(AIR);
      enemy.hp = 30;
      const hpBeforeOpenBlast = enemy.hp;
      scene.explode(baseX + 1, floorY - 2, 2.45);
      const hpAfterOpenBlast = enemy.hp;

      buildArena(Tile.BEDROCK);
      scene.sim.maxHealth = Math.max(scene.sim.maxHealth || 100, 100);
      scene.sim.health = 100;
      const healthBeforeBlockedShockwave = scene.sim.health;
      scene.bossShockwave(enemy);
      const healthAfterBlockedShockwave = scene.sim.health;
      buildArena(AIR);
      scene.sim.health = 100;
      const healthBeforeOpenShockwave = scene.sim.health;
      scene.bossShockwave(enemy);
      const healthAfterOpenShockwave = scene.sim.health;

      buildArena(Tile.BEDROCK);
      enemy.memory = {};
      scene.noiseEvents = [];
      scene.sim.noiseMuffle = false;
      const noiseBefore = scene.noiseEvents.length;
      const emittedNoise = scene.emitNoise?.("testNoise", scene.player.x, scene.player.y, {
        radius: TILE * 9,
        intensity: 1.8,
        ttl: 5000
      });
      const noiseSensor = window.ML.MobSensors?.sense?.(scene, enemy, (scene.time?.now || 0) + 20);
      const noisePressure = window.ML.MobSensors?.pressure?.(scene, (scene.time?.now || 0) + 20) || 0;
      scene.noiseEvents = [];
      scene.sim.noiseMuffle = true;
      const muffledNoise = scene.emitNoise?.("testNoise", scene.player.x, scene.player.y, {
        radius: TILE * 9,
        intensity: 1.8,
        ttl: 5000
      });
      const muffledPressure = window.ML.MobSensors?.pressure?.(scene, (scene.time?.now || 0) + 20) || 0;
      scene.sim.noiseMuffle = false;
      combatLosCheck = {
        runtime: true,
        actionRulesRuntime: typeof window.ML.ActionRules?.canAttackEnemy === "function"
          && typeof window.ML.ActionRules?.targetTile === "function"
          && typeof window.ML.ActionRules?.canRadialAffect === "function",
        mobSensorsRuntime: typeof window.ML.MobSensors?.sense === "function"
          && typeof window.ML.MobSensors?.emitNoise === "function"
          && typeof window.ML.MobSensors?.pressure === "function",
        wallBlocksEnemyPointer: blockedPointer === null,
        wallAttackTargets: blockedTargets.length,
        wallAttackDamage: hpBeforeBlockedAttack - hpAfterBlockedAttack,
        wallAttackResult: Boolean(blockedAttackResult),
        wallBlocksTileTarget: blockedTileTarget === null,
        openSightEnemyPointer: openPointer === enemy,
        openSightTargets: openTargets.length,
        openSightDamage: hpBeforeOpenAttack - hpAfterOpenAttack,
        openAttackResult: Boolean(openAttackResult),
        wallBlastDamage: hpBeforeBlockedBlast - hpAfterBlockedBlast,
        openBlastDamage: hpBeforeOpenBlast - hpAfterOpenBlast,
        wallShockwaveDamage: healthBeforeBlockedShockwave - healthAfterBlockedShockwave,
        openShockwaveDamage: healthBeforeOpenShockwave - healthAfterOpenShockwave,
        noiseEventsAdded: scene.noiseEvents.length - noiseBefore,
        noiseHeardBehindWall: Boolean(noiseSensor?.heardNoise),
        noiseSeenBehindWall: Boolean(noiseSensor?.canSeePlayer),
        noiseMemoryReason: noiseSensor?.reason || null,
        noisePressure,
        emittedNoise: Boolean(emittedNoise),
        muffledNoise: Boolean(muffledNoise),
        muffledPressure
      };
      enemy.destroy();
      scene.player.setPosition(previousPlayer.x, previousPlayer.y);
      scene.player.setVelocity(0, 0);
      scene.sim.player = { x: previousPlayer.x, y: previousPlayer.y };
    }
    const stratumIds = new Set();
    const stratumSamples = [];
    [24, 96, 168, 252, 350].forEach((depth, index) => {
      const x = Math.max(3, Math.min(WORLD_W - 4, 18 + index * 29));
      const y = (sim.surface[x] || 24) + depth;
      const stratum = sim.stratumAt?.(x, y);
      if (!stratum) return;
      stratumIds.add(stratum.id);
      stratumSamples.push({ x, y, id: stratum.id, name: stratum.name, fatigue: stratum.miningFatigue });
    });
    scene?.togglePack?.(true);
    const packVisible = Boolean(window.ML.ui?.packDrawer && !window.ML.ui.packDrawer.classList.contains("hidden"));
    const packChips = window.ML.ui?.packGrid?.children?.length || 0;
    const packSummary = window.ML.ui?.packSummary?.textContent || "";
    scene?.togglePack?.(false);
    const packClosed = Boolean(window.ML.ui?.packDrawer?.classList.contains("hidden"));
    return {
      recipes: window.ML.RECIPES.length,
      progressionRuntime: typeof window.ML.Progression?.isItemKnown === "function" && typeof window.ML.Progression?.recipeVisible === "function",
      itemCatalogSize,
      newMaterialsPresent,
      surpriseLootCount,
      surpriseLootItemsValid,
      newRecipesPresent,
      newOreTiles: newOreTiles.length,
      newOreTilesInWorld,
      terrainStarterMaxFlat: terrainCheck.starterMaxFlat,
      terrainStarterSurfaceSigns: terrainCheck.starterSurfaceSigns,
      terrainStarterSurfaceCamps: terrainCheck.starterSurfaceCamps,
      terrainHorizonMaxFlat: terrainCheck.horizonMaxFlat,
      terrainFirstPairSurfaceDiscoveries: terrainCheck.firstPairSurfaceDiscoveries,
      terrainHorizonSurfaceDiscoveries: terrainCheck.horizonSurfaceDiscoveries,
      terrainHorizonUndergroundDiscoveries: terrainCheck.horizonUndergroundDiscoveries,
      starterKnownItems,
      starterCraftVisible,
      starterCraftReady,
      starterLockedHotbar,
      starterStoneHidden,
      starterCoreHidden,
      copperBeforePickup,
      copperKnownAfterPickup,
      platformKnownBeforeCraft,
      platformKnownAfterCraft,
      platformCraftForFresh,
      regulatorCraft,
      regulatorEfficiency: Boolean(regulatorSim.cellEfficiency),
      regulatorLampAfter,
      plainLampAfter,
      tileSize: window.ML.TILE,
      achievements: window.ML.ACHIEVEMENTS.length,
      contracts: window.ML.CONTRACTS.length,
      caveEvents: Object.keys(window.ML.CAVE_EVENTS || {}).length,
      eventVariantCount,
      observerMomentCount,
      biomes: Object.keys(window.ML.BIOMES || {}).length,
      strataProfiles: (window.ML.STRATA_PROFILES || []).length,
      storyPhases: (window.ML.STORY_PHASES || []).length,
      biomeSystem: Boolean(window.ML.BiomeSystem?.biomeAt && window.ML.BiomeSystem?.current),
      stratumSystem: typeof sim.stratumAt === "function" && typeof sim.stratumForDepth === "function" && typeof sim.weightedPick === "function",
      enemyAiProfiles,
      loreNotes: Object.keys(window.ML.LORE_NOTES || {}).length,
      loreGoals: Object.keys(window.ML.HIDDEN_GOALS || {}).length,
      loreSystem,
      loreAwakened: Boolean(loreIntel.awakened),
      storyPhase: loreIntel.phase?.id || null,
      storyPhaseIndex: loreIntel.phaseIndex || 0,
      loreDecoded: loreIntel.noteCount || 0,
      loreGoalDone: Boolean(loreIntel.done),
      watcherTexture: Boolean(scene?.textures?.exists?.("watcher")),
      watcherTraceTexture: Boolean(scene?.textures?.exists?.("watcherTrace")),
      mobWakeTexture: Boolean(scene?.textures?.exists?.("mobWake")),
      watcherRuntime: typeof scene?.spawnWatcherSighting === "function" && typeof scene?.updateShadowPressure === "function" && typeof scene?.dismissWatcher === "function" && typeof scene?.leaveWatcherTrace === "function",
      mobWakeRuntime: typeof scene?.mobWakeInfo === "function" && typeof scene?.queueMobMaterialize === "function" && typeof scene?.updatePendingMobSpawns === "function" && typeof scene?.cancelPendingMobSpawn === "function",
      smartMobRuntime: typeof scene?.enemyInstinct === "function",
      eventCopyRuntime: typeof scene?.eventCopyFor === "function",
      observerRuntime: typeof scene?.triggerObserverMoment === "function" && typeof scene?.spawnObserverRift === "function" && typeof scene?.isEnemyObserved === "function",
      forcedObserver: Boolean(forcedObserver),
      forcedMobStare: Boolean(forcedMobStare),
      forcedRift: Boolean(forcedRift),
      observerDelta: observerAfter - observerBefore,
      observerRifts: riftCount,
      observerAnomalies: scene?.sim?.stats?.observerAnomalies || 0,
      heroThoughts: scene?.sim?.stats?.heroThoughts || 0,
      mobAwareness: scene?.sim?.stats?.mobAwareness || 0,
      spatialRifts: scene?.sim?.stats?.spatialRifts || 0,
      lampRuntime: typeof sim.drainLamp === "function" && typeof sim.lampOutput === "function" && typeof sim.refillLamp === "function",
      lampStart,
      lampDrainState: lampDrain?.state,
      lampAfterDrain,
      lampSwapState: lampSwap?.state,
      lampAfterSwap,
      batteryAfterSwap,
      lampEmptyState: lampEmpty?.state,
      lampEmptyOutput: lampOutputEmpty?.radius || 0,
      lampStandbyRuntime: Boolean(lampStandbyCheck && lampDarkCheck),
      lampStandbyLight: lampStandbyCheck?.light || 0,
      lampStandbyBefore: lampStandbyCheck?.before || 0,
      lampStandbyAfter: lampStandbyCheck?.after || 0,
      lampStandbyState: Boolean(lampStandbyCheck?.standby),
      lampDarkLight: lampDarkCheck?.light ?? 1,
      lampDarkBefore: lampDarkCheck?.before || 0,
      lampDarkAfter: lampDarkCheck?.after || 0,
      lampDarkStandby: Boolean(lampDarkCheck?.standby),
      endlessRuntime: typeof sim.extendDepth === "function" && typeof sim.worldHeight === "function" && typeof scene?.openAbyssSeam === "function" && typeof scene?.rebuildWorldLayer === "function",
      heightBefore,
      heightAfter,
      extensionRows: extension?.rows || 0,
      extensionChests: extension?.chests || 0,
      extensionMobs: extension?.mobs || 0,
      extensionDiscoveries: extension?.discoveries || 0,
      extensionUndergroundDiscoveries: extension?.undergroundDiscoveries || 0,
      extensionStratum: extension?.stratumId || null,
      seamOpened,
      heightAfterSecond,
      secondExtensionRows: secondExtension?.rows || 0,
      secondExtensionMobs: secondExtension?.mobs || 0,
      secondExtensionDiscoveries: secondExtension?.discoveries || 0,
      secondExtensionUndergroundDiscoveries: secondExtension?.undergroundDiscoveries || 0,
      secondExtensionStratum: secondExtension?.stratumId || null,
      secondSeamOpened,
      worldExpansions: sim.stats.worldExpansions || 0,
      horizontalRuntime: typeof sim.extendHorizontal === "function" && typeof sim.worldWidth === "function" && typeof scene?.openHorizontalRegion === "function",
      widthBefore,
      widthAfterEast,
      widthAfterWest,
      eastColumns: eastExtension?.columns || 0,
      eastChests: eastExtension?.chests || 0,
      eastMobs: eastExtension?.mobs || 0,
      eastInheritedTiles: eastExtension?.inheritedTiles || 0,
      eastSurfaceStep: eastExtension?.surfaceStep ?? 99,
      eastEdgeOpenness: eastExtension?.edgeOpenness || 0,
      eastEdgeOpenings: eastExtension?.edgeOpenings || 0,
      eastEdgeCorridors: eastExtension?.edgeCorridors || 0,
      eastSurfaceDiscoveries: eastExtension?.surfaceDiscoveries || 0,
      eastUndergroundDiscoveries: eastExtension?.undergroundDiscoveries || 0,
      westColumns: westExtension?.columns || 0,
      westShiftTiles: westExtension?.shiftTiles || 0,
      westChests: westExtension?.chests || 0,
      westMobs: westExtension?.mobs || 0,
      westInheritedTiles: westExtension?.inheritedTiles || 0,
      westSurfaceStep: westExtension?.surfaceStep ?? 99,
      westEdgeOpenness: westExtension?.edgeOpenness || 0,
      westEdgeOpenings: westExtension?.edgeOpenings || 0,
      westEdgeCorridors: westExtension?.edgeCorridors || 0,
      westSurfaceDiscoveries: westExtension?.surfaceDiscoveries || 0,
      westUndergroundDiscoveries: westExtension?.undergroundDiscoveries || 0,
      surfaceDiscoveries: sim.surfaceDiscoveries?.length || 0,
      undergroundDiscoveries: sim.surfaceDiscoveries?.filter?.((entry) => entry.scope === "underground").length || 0,
      undergroundDiscoveryTile: Boolean(undergroundDiscovery && sim.tileAt(undergroundDiscovery.x, undergroundDiscovery.y) === window.ML.Tile.SIGN),
      poiApi: Boolean(window.ML.POI?.generateUndergroundLandmarks),
      horizontalExpansions: sim.stats.horizontalExpansions || 0,
      horizontalSpawnStable: Boolean(horizontalSpawnStable),
      horizontalCampSupport: Boolean(horizontalCampSupport),
      sceneWidthBefore,
      sceneRightOpen: Boolean(sceneRightOpen),
      sceneLeftOpen: Boolean(sceneLeftOpen),
      sceneWidthAfterRight,
      sceneWidthAfterLeft,
      sceneLeftShift,
      sceneHorizontalSupport: Boolean(sceneHorizontalSupport),
      sceneSurfaceDiscoveries: scene?.sim?.surfaceDiscoveries?.length || 0,
      sceneDiscoveryTile: Boolean(sceneDiscovery && scene.sim.tileAt(sceneDiscovery.x, sceneDiscovery.y) === window.ML.Tile.SIGN),
      sceneDiscoveryRead: Boolean(sceneDiscoveryRead),
      sceneDiscoveryReadState: Boolean(sceneDiscovery?.read),
      sceneDiscoveryStatDelta: sceneDiscoveryAfter - sceneDiscoveryBefore,
      sceneDiscoveryTargetKind: sceneDiscoveryTarget?.kind || null,
      sceneUndergroundDiscoveries: scene?.sim?.surfaceDiscoveries?.filter?.((entry) => entry.scope === "underground").length || 0,
      sceneUndergroundDiscoveryTile: Boolean(sceneUndergroundDiscovery && scene.sim.tileAt(sceneUndergroundDiscovery.x, sceneUndergroundDiscovery.y) === window.ML.Tile.SIGN),
      sceneUndergroundDiscoveryRead: Boolean(sceneUndergroundRead),
      sceneUndergroundDiscoveryReadState: Boolean(sceneUndergroundDiscovery?.read),
      sceneUndergroundDiscoveryStatDelta: sceneUndergroundAfter - sceneUndergroundBefore,
      poiAmbienceRuntime: Boolean(poiAmbienceCheck?.runtime),
      poiVisibleSignal: Boolean(poiAmbienceCheck?.visible),
      poiCuriousMob: Boolean(poiAmbienceCheck?.poiCurious),
      poiCuriousMode: poiAmbienceCheck?.mode || null,
      poiCuriousTarget: Boolean(poiAmbienceCheck?.targetNear),
      combatLosRuntime: Boolean(combatLosCheck?.runtime),
      actionRulesRuntime: Boolean(combatLosCheck?.actionRulesRuntime),
      mobSensorsRuntime: Boolean(combatLosCheck?.mobSensorsRuntime),
      wallBlocksEnemyPointer: Boolean(combatLosCheck?.wallBlocksEnemyPointer),
      wallAttackTargets: combatLosCheck?.wallAttackTargets ?? -1,
      wallAttackDamage: combatLosCheck?.wallAttackDamage ?? -1,
      wallAttackResult: Boolean(combatLosCheck?.wallAttackResult),
      wallBlocksTileTarget: Boolean(combatLosCheck?.wallBlocksTileTarget),
      openSightEnemyPointer: Boolean(combatLosCheck?.openSightEnemyPointer),
      openSightTargets: combatLosCheck?.openSightTargets ?? 0,
      openSightDamage: combatLosCheck?.openSightDamage ?? 0,
      openAttackResult: Boolean(combatLosCheck?.openAttackResult),
      wallBlastDamage: combatLosCheck?.wallBlastDamage ?? -1,
      openBlastDamage: combatLosCheck?.openBlastDamage ?? 0,
      wallShockwaveDamage: combatLosCheck?.wallShockwaveDamage ?? -1,
      openShockwaveDamage: combatLosCheck?.openShockwaveDamage ?? 0,
      noiseEventsAdded: combatLosCheck?.noiseEventsAdded ?? 0,
      noiseHeardBehindWall: Boolean(combatLosCheck?.noiseHeardBehindWall),
      noiseSeenBehindWall: Boolean(combatLosCheck?.noiseSeenBehindWall),
      noiseMemoryReason: combatLosCheck?.noiseMemoryReason || null,
      noisePressure: combatLosCheck?.noisePressure || 0,
      emittedNoise: Boolean(combatLosCheck?.emittedNoise),
      muffledNoise: Boolean(combatLosCheck?.muffledNoise),
      muffledPressure: combatLosCheck?.muffledPressure || 0,
      watcherTraceDelta: traceAfter - traceBefore,
      watcherTraceActive: Boolean(trace),
      watcherSpotDistance: watcherSpot ? Math.round(Math.hypot(watcherSpot.x - scene.player.x, watcherSpot.y - scene.player.y)) : 0,
      mobWakeQueued: Boolean(mobWakeQueued),
      pendingAfterQueue,
      pendingAfterCancel,
      shadowPressure: sim.shadowPressure,
      watcherSightings: sim.stats.watcherSightings,
      watcherTraces: sim.stats.watcherTraces,
      shadowPeaks: sim.stats.shadowPeaks,
      packVisible,
      packClosed,
      packChips,
      packSummary,
      sampleBiomeCount: biomeIds.size,
      biomeSamples,
      sampleStratumCount: stratumIds.size,
      stratumSamples,
      campServices: window.ML.CAMP_SERVICES.length,
      campSystem: Boolean(window.ML.CampSystem?.isNearCamp),
      craftable: craftable.length,
      craftResult,
      recallCraft,
      echoCraft,
      echoPadding: Boolean(sim.noiseMuffle),
      recallCharm: sim.recallCharm,
      campResult,
      restResult,
      activeCamp,
      campSpawn,
      campSupport,
      campAnchors: Object.keys(sim.campAnchors || {}).length,
      camps: sim.stats.camps,
      campUses: sim.stats.campUses,
      torchDelta: (sim.inventory.torch || 0) - torchesBefore,
      contractBefore,
      contractClaim,
      crafted: sim.stats.crafted,
      completedContracts: sim.stats.contracts,
      platforms: sim.inventory.platform
    };
  });

  await page.evaluate(() => {
    localStorage.removeItem(window.ML.SAVE_KEY);
    window.ML.sceneRef.sim.newWorld(123456789);
    window.ML.sceneRef.scene.restart();
  });
  await page.waitForTimeout(1000);

  const start = await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    return {
      x: scene.player.x,
      y: scene.player.y,
      support: scene.sim.hasPlayerSupport({ x: scene.player.x, y: scene.player.y }),
      stable: scene.sim.hasStableSpawnFloor(),
      floorTile: scene.sim.tileAt(scene.sim.spawn.x, scene.sim.spawnFloorY()),
      campfires: scene.sim.lights.filter((light) => light.t === window.ML.Tile.CAMPFIRE).length,
      recallApi: typeof scene.recallToCamp === "function" && typeof scene.recallCost === "function",
      campApi: typeof scene.nearCamp === "function" && typeof scene.toggleCamp === "function" && typeof scene.useCampService === "function",
      nearCamp: scene.nearCamp()
    };
  });
  await page.keyboard.down("s");
  await page.waitForTimeout(1000);
  await page.keyboard.up("s");
  const afterDown = await page.evaluate(() => ({
    x: window.ML.sceneRef.player.x,
    y: window.ML.sceneRef.player.y
  }));
  const fallDelta = Number((afterDown.y - start.y).toFixed(3));

  const interactionCheck = await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    const sim = scene.sim;
    const { TILE, Tile, AIR } = window.ML;
    const floorY = sim.spawnFloorY();
    const chestX = sim.spawn.x + 1;
    const chestY = floorY - 1;
    scene.player.setPosition(sim.spawn.x * TILE + TILE / 2, floorY * TILE - 17);
    sim.player = { x: scene.player.x, y: scene.player.y };
    if (sim.tileAt(chestX, chestY) !== AIR) {
      sim.setTile(chestX, chestY, AIR);
      scene.layer.removeTileAt(chestX, chestY, true, false);
    }
    scene.placeTileAt(Tile.CHEST, chestX, chestY);
    const beforeChests = sim.stats.chests || 0;
    const beforeCoin = sim.inventory.coin || 0;
    const target = scene.interactionTarget();
    const opened = scene.interact();
    const afterTile = sim.tileAt(chestX, chestY);
    const afterTarget = scene.interactionTarget();
    return {
      target,
      afterTarget,
      opened,
      afterTile,
      chestRemoved: afterTile === AIR,
      chestDelta: (sim.stats.chests || 0) - beforeChests,
      coinDelta: (sim.inventory.coin || 0) - beforeCoin,
      chestTargetCleared: !afterTarget || afterTarget.kind !== "chest"
    };
  });

  await browser.close();

  const progressionFailed = progressionCheck.recipes < 60
    || progressionCheck.achievements < 60
    || progressionCheck.contracts < 5
    || progressionCheck.caveEvents < 4
    || progressionCheck.eventVariantCount < 4
    || progressionCheck.observerMomentCount < 5
    || progressionCheck.biomes < 8
    || progressionCheck.strataProfiles < 5
    || progressionCheck.storyPhases < 7
    || !progressionCheck.progressionRuntime
    || progressionCheck.newMaterialsPresent < 8
    || progressionCheck.surpriseLootCount < 8
    || !progressionCheck.surpriseLootItemsValid
    || progressionCheck.newRecipesPresent < 9
    || progressionCheck.newOreTiles < 4
    || progressionCheck.newOreTilesInWorld < 12
    || progressionCheck.terrainStarterMaxFlat > 12
    || progressionCheck.terrainStarterSurfaceSigns > 0
    || progressionCheck.terrainStarterSurfaceCamps > 1
    || progressionCheck.terrainHorizonMaxFlat > 12
    || progressionCheck.terrainFirstPairSurfaceDiscoveries > 0
    || progressionCheck.terrainHorizonSurfaceDiscoveries < 1
    || progressionCheck.terrainHorizonSurfaceDiscoveries > 3
    || progressionCheck.terrainHorizonUndergroundDiscoveries < 6
    || !progressionCheck.regulatorCraft?.ok
    || !progressionCheck.regulatorEfficiency
    || progressionCheck.regulatorLampAfter <= progressionCheck.plainLampAfter
    || progressionCheck.starterKnownItems >= progressionCheck.itemCatalogSize
    || progressionCheck.starterKnownItems > 8
    || progressionCheck.starterCraftVisible >= progressionCheck.recipes
    || progressionCheck.starterCraftReady < 3
    || progressionCheck.starterLockedHotbar < 3
    || !progressionCheck.starterStoneHidden
    || !progressionCheck.starterCoreHidden
    || progressionCheck.copperBeforePickup
    || !progressionCheck.copperKnownAfterPickup
    || progressionCheck.platformKnownBeforeCraft
    || !progressionCheck.platformKnownAfterCraft
    || !progressionCheck.platformCraftForFresh?.ok
    || !progressionCheck.biomeSystem
    || !progressionCheck.stratumSystem
    || progressionCheck.enemyAiProfiles < 7
    || progressionCheck.sampleBiomeCount < 6
    || progressionCheck.sampleStratumCount < 4
    || progressionCheck.loreNotes < 19
    || progressionCheck.loreGoals < 8
    || !progressionCheck.loreSystem
    || !progressionCheck.loreAwakened
    || progressionCheck.storyPhaseIndex < 4
    || progressionCheck.loreDecoded < 10
    || !progressionCheck.loreGoalDone
    || !progressionCheck.echoCraft?.ok
    || !progressionCheck.echoPadding
    || !progressionCheck.watcherTexture
    || !progressionCheck.watcherTraceTexture
    || !progressionCheck.mobWakeTexture
    || !progressionCheck.watcherRuntime
    || !progressionCheck.mobWakeRuntime
    || !progressionCheck.smartMobRuntime
    || !progressionCheck.eventCopyRuntime
    || !progressionCheck.observerRuntime
    || !progressionCheck.forcedObserver
    || !progressionCheck.forcedMobStare
    || !progressionCheck.forcedRift
    || progressionCheck.observerDelta < 3
    || progressionCheck.observerRifts < 1
    || progressionCheck.observerAnomalies < 3
    || progressionCheck.heroThoughts < 1
    || progressionCheck.mobAwareness < 1
    || progressionCheck.spatialRifts < 1
    || !progressionCheck.lampRuntime
    || progressionCheck.lampStart < 0.99
    || progressionCheck.lampAfterDrain >= progressionCheck.lampStart
    || progressionCheck.lampSwapState !== "swapped"
    || progressionCheck.lampAfterSwap < 0.99
    || progressionCheck.batteryAfterSwap !== 0
    || progressionCheck.lampEmptyState !== "empty"
    || progressionCheck.lampEmptyOutput !== 0
    || !progressionCheck.lampStandbyRuntime
    || progressionCheck.lampStandbyLight < 0.58
    || !progressionCheck.lampStandbyState
    || progressionCheck.lampStandbyAfter < progressionCheck.lampStandbyBefore - 0.0001
    || progressionCheck.lampDarkLight > 0.32
    || progressionCheck.lampDarkStandby
    || progressionCheck.lampDarkAfter >= progressionCheck.lampDarkBefore
    || !progressionCheck.endlessRuntime
    || progressionCheck.heightAfter <= progressionCheck.heightBefore
    || progressionCheck.extensionRows < 48
    || progressionCheck.extensionMobs < 1
    || progressionCheck.extensionDiscoveries < 1
    || progressionCheck.extensionUndergroundDiscoveries < 1
    || !progressionCheck.extensionStratum
    || !progressionCheck.seamOpened
    || progressionCheck.heightAfterSecond <= progressionCheck.heightAfter
    || progressionCheck.secondExtensionRows < 48
    || progressionCheck.secondExtensionMobs < 1
    || progressionCheck.secondExtensionDiscoveries < 1
    || progressionCheck.secondExtensionUndergroundDiscoveries < 1
    || !progressionCheck.secondExtensionStratum
    || progressionCheck.secondExtensionStratum === progressionCheck.extensionStratum
    || !progressionCheck.secondSeamOpened
    || progressionCheck.worldExpansions < 2
    || !progressionCheck.horizontalRuntime
    || progressionCheck.widthAfterEast <= progressionCheck.widthBefore
    || progressionCheck.widthAfterWest <= progressionCheck.widthAfterEast
    || progressionCheck.eastColumns < 48
    || progressionCheck.westColumns < 48
    || progressionCheck.westShiftTiles < 48
    || progressionCheck.eastChests < 1
    || progressionCheck.westChests < 1
    || progressionCheck.eastMobs < 1
    || progressionCheck.westMobs < 1
    || progressionCheck.eastUndergroundDiscoveries < 1
    || progressionCheck.westUndergroundDiscoveries < 1
    || progressionCheck.surfaceDiscoveries < 2
    || progressionCheck.undergroundDiscoveries < 2
    || !progressionCheck.undergroundDiscoveryTile
    || !progressionCheck.poiApi
    || progressionCheck.eastInheritedTiles < 64
    || progressionCheck.westInheritedTiles < 64
    || progressionCheck.eastSurfaceStep > 4
    || progressionCheck.westSurfaceStep > 4
    || (progressionCheck.eastEdgeOpenings > 0 && progressionCheck.eastEdgeCorridors < 1)
    || (progressionCheck.westEdgeOpenings > 0 && progressionCheck.westEdgeCorridors < 1)
    || progressionCheck.horizontalExpansions < 2
    || !progressionCheck.horizontalSpawnStable
    || !progressionCheck.horizontalCampSupport
    || !progressionCheck.sceneRightOpen
    || !progressionCheck.sceneLeftOpen
    || progressionCheck.sceneWidthAfterRight <= progressionCheck.sceneWidthBefore
    || progressionCheck.sceneWidthAfterLeft <= progressionCheck.sceneWidthAfterRight
    || progressionCheck.sceneLeftShift < 48 * progressionCheck.tileSize
    || !progressionCheck.sceneHorizontalSupport
    || progressionCheck.sceneSurfaceDiscoveries < 2
    || !progressionCheck.sceneDiscoveryTile
    || !progressionCheck.sceneDiscoveryRead
    || !progressionCheck.sceneDiscoveryReadState
    || progressionCheck.sceneDiscoveryStatDelta < 1
    || progressionCheck.sceneDiscoveryTargetKind !== "surfaceDiscovery"
    || progressionCheck.sceneUndergroundDiscoveries < 1
    || !progressionCheck.sceneUndergroundDiscoveryTile
    || !progressionCheck.sceneUndergroundDiscoveryRead
    || !progressionCheck.sceneUndergroundDiscoveryReadState
    || progressionCheck.sceneUndergroundDiscoveryStatDelta < 1
    || !progressionCheck.poiAmbienceRuntime
    || !progressionCheck.poiVisibleSignal
    || !progressionCheck.poiCuriousMob
    || !progressionCheck.poiCuriousTarget
    || !progressionCheck.combatLosRuntime
    || !progressionCheck.actionRulesRuntime
    || !progressionCheck.mobSensorsRuntime
    || !progressionCheck.wallBlocksEnemyPointer
    || progressionCheck.wallAttackTargets !== 0
    || progressionCheck.wallAttackDamage !== 0
    || progressionCheck.wallAttackResult
    || !progressionCheck.wallBlocksTileTarget
    || !progressionCheck.openSightEnemyPointer
    || progressionCheck.openSightTargets < 1
    || progressionCheck.openSightDamage <= 0
    || !progressionCheck.openAttackResult
    || progressionCheck.wallBlastDamage !== 0
    || progressionCheck.openBlastDamage <= 0
    || progressionCheck.wallShockwaveDamage !== 0
    || progressionCheck.openShockwaveDamage <= 0
    || !progressionCheck.emittedNoise
    || progressionCheck.noiseEventsAdded < 1
    || !progressionCheck.noiseHeardBehindWall
    || progressionCheck.noiseSeenBehindWall
    || progressionCheck.noiseMemoryReason !== "noise"
    || progressionCheck.noisePressure <= 0
    || !progressionCheck.muffledNoise
    || progressionCheck.muffledPressure <= 0
    || progressionCheck.muffledPressure >= progressionCheck.noisePressure
    || !progressionCheck.watcherTraceActive
    || progressionCheck.watcherTraceDelta < 1
    || progressionCheck.watcherSpotDistance < 245
    || !progressionCheck.mobWakeQueued
    || progressionCheck.pendingAfterQueue < 1
    || progressionCheck.pendingAfterCancel !== 0
    || progressionCheck.watcherSightings < 3
    || progressionCheck.watcherTraces < 1
    || progressionCheck.shadowPeaks < 1
    || !progressionCheck.packVisible
    || !progressionCheck.packClosed
    || progressionCheck.packChips < progressionCheck.starterKnownItems
    || !progressionCheck.packSummary.includes("known stacks")
    || progressionCheck.campServices < 5
    || !progressionCheck.campSystem
    || progressionCheck.craftable < 3
    || !progressionCheck.craftResult.ok
    || !progressionCheck.recallCraft.ok
    || !progressionCheck.recallCharm
    || !progressionCheck.campResult.ok
    || !progressionCheck.restResult.ok
    || !progressionCheck.activeCamp
    || !progressionCheck.campSupport
    || progressionCheck.campAnchors < 1
    || progressionCheck.camps < 1
    || progressionCheck.campUses < 1
    || progressionCheck.torchDelta < 6
    || !progressionCheck.contractBefore
    || !progressionCheck.contractClaim
    || progressionCheck.crafted < 1
    || progressionCheck.completedContracts < 1
    || progressionCheck.platforms < 4;
  const interactionFailed = interactionCheck.target?.kind !== "chest"
    || !interactionCheck.opened
    || !interactionCheck.chestRemoved
    || interactionCheck.chestDelta !== 1
    || interactionCheck.coinDelta < 4
    || !interactionCheck.chestTargetCleared;
  const failed = errors.length > 0 || seedCheck.failures.length > 0 || seedCheck.ecologyFailures.length > 0 || progressionFailed || interactionFailed || !start.support || !start.stable || start.campfires < 1 || !start.recallApi || !start.campApi || !start.nearCamp || fallDelta > 1;
  const report = { seedCheck, progressionCheck, start, afterDown, fallDelta, interactionCheck, errors };
  console.log(JSON.stringify(report, null, 2));

  if (failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
