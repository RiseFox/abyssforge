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
    const craftable = window.ML.craftableRecipes(sim);
    const platformRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "platform");
    const craftResult = sim.craft(platformRecipe);
    const recallRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "recallCharm");
    sim.addItem("relic", 1);
    sim.addItem("crystal", 2);
    sim.addItem("coin", 24);
    const recallCraft = sim.craft(recallRecipe);
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
    window.ML.LoreSystem?.evaluate?.(sim, { biome: window.ML.BIOMES?.obsidianabyss, bossKind: "warden", watcher: true, shadowPeak: true });
    const loreIntel = window.ML.LoreSystem?.intel?.(sim) || {};
    const scene = window.ML.sceneRef;
    const biomeSamples = [];
    const biomeIds = new Set();
    const sampleBiome = (x, y) => {
      const tx = Math.max(0, Math.min(WORLD_W - 1, Math.floor(x)));
      const ty = Math.max(0, Math.min(WORLD_H - 1, Math.floor(y)));
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
    scene?.togglePack?.(true);
    const packVisible = Boolean(window.ML.ui?.packDrawer && !window.ML.ui.packDrawer.classList.contains("hidden"));
    const packChips = window.ML.ui?.packGrid?.children?.length || 0;
    const packSummary = window.ML.ui?.packSummary?.textContent || "";
    scene?.togglePack?.(false);
    const packClosed = Boolean(window.ML.ui?.packDrawer?.classList.contains("hidden"));
    return {
      recipes: window.ML.RECIPES.length,
      achievements: window.ML.ACHIEVEMENTS.length,
      contracts: window.ML.CONTRACTS.length,
      caveEvents: Object.keys(window.ML.CAVE_EVENTS || {}).length,
      biomes: Object.keys(window.ML.BIOMES || {}).length,
      biomeSystem: Boolean(window.ML.BiomeSystem?.biomeAt && window.ML.BiomeSystem?.current),
      loreNotes: Object.keys(window.ML.LORE_NOTES || {}).length,
      loreGoals: Object.keys(window.ML.HIDDEN_GOALS || {}).length,
      loreSystem,
      loreAwakened: Boolean(loreIntel.awakened),
      loreDecoded: loreIntel.noteCount || 0,
      loreGoalDone: Boolean(loreIntel.done),
      watcherTexture: Boolean(scene?.textures?.exists?.("watcher")),
      watcherTraceTexture: Boolean(scene?.textures?.exists?.("watcherTrace")),
      mobWakeTexture: Boolean(scene?.textures?.exists?.("mobWake")),
      watcherRuntime: typeof scene?.spawnWatcherSighting === "function" && typeof scene?.updateShadowPressure === "function" && typeof scene?.dismissWatcher === "function" && typeof scene?.leaveWatcherTrace === "function",
      mobWakeRuntime: typeof scene?.mobWakeInfo === "function" && typeof scene?.queueMobMaterialize === "function" && typeof scene?.updatePendingMobSpawns === "function" && typeof scene?.cancelPendingMobSpawn === "function",
      lampRuntime: typeof sim.drainLamp === "function" && typeof sim.lampOutput === "function" && typeof sim.refillLamp === "function",
      lampStart,
      lampDrainState: lampDrain?.state,
      lampAfterDrain,
      lampSwapState: lampSwap?.state,
      lampAfterSwap,
      batteryAfterSwap,
      lampEmptyState: lampEmpty?.state,
      lampEmptyOutput: lampOutputEmpty?.radius || 0,
      endlessRuntime: typeof sim.extendDepth === "function" && typeof sim.worldHeight === "function" && typeof scene?.openAbyssSeam === "function" && typeof scene?.rebuildWorldLayer === "function",
      heightBefore,
      heightAfter,
      extensionRows: extension?.rows || 0,
      extensionChests: extension?.chests || 0,
      extensionMobs: extension?.mobs || 0,
      seamOpened,
      heightAfterSecond,
      secondExtensionRows: secondExtension?.rows || 0,
      secondExtensionMobs: secondExtension?.mobs || 0,
      secondSeamOpened,
      worldExpansions: sim.stats.worldExpansions || 0,
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
      campServices: window.ML.CAMP_SERVICES.length,
      campSystem: Boolean(window.ML.CampSystem?.isNearCamp),
      craftable: craftable.length,
      craftResult,
      recallCraft,
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

  const progressionFailed = progressionCheck.recipes < 34
    || progressionCheck.achievements < 37
    || progressionCheck.contracts < 5
    || progressionCheck.caveEvents < 4
    || progressionCheck.biomes < 8
    || !progressionCheck.biomeSystem
    || progressionCheck.sampleBiomeCount < 6
    || progressionCheck.loreNotes < 13
    || progressionCheck.loreGoals < 7
    || !progressionCheck.loreSystem
    || !progressionCheck.loreAwakened
    || progressionCheck.loreDecoded < 10
    || !progressionCheck.loreGoalDone
    || !progressionCheck.watcherTexture
    || !progressionCheck.watcherTraceTexture
    || !progressionCheck.mobWakeTexture
    || !progressionCheck.watcherRuntime
    || !progressionCheck.mobWakeRuntime
    || !progressionCheck.lampRuntime
    || progressionCheck.lampStart < 0.99
    || progressionCheck.lampAfterDrain >= progressionCheck.lampStart
    || progressionCheck.lampSwapState !== "swapped"
    || progressionCheck.lampAfterSwap < 0.99
    || progressionCheck.batteryAfterSwap !== 0
    || progressionCheck.lampEmptyState !== "empty"
    || progressionCheck.lampEmptyOutput !== 0
    || !progressionCheck.endlessRuntime
    || progressionCheck.heightAfter <= progressionCheck.heightBefore
    || progressionCheck.extensionRows < 48
    || progressionCheck.extensionMobs < 1
    || !progressionCheck.seamOpened
    || progressionCheck.heightAfterSecond <= progressionCheck.heightAfter
    || progressionCheck.secondExtensionRows < 48
    || progressionCheck.secondExtensionMobs < 1
    || !progressionCheck.secondSeamOpened
    || progressionCheck.worldExpansions < 2
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
    || progressionCheck.packChips < 10
    || !progressionCheck.packSummary.includes("stacks")
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
