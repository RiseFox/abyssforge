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

      if (!stable || !support || !campReady || campfireCount < 1 || floor === AIR || floor === Tile.PLATFORM || !BLOCKS[floor]?.solid || footY !== floorY || secretCount < 5 || bossCount < 2) {
        failures.push({ seed: actualSeed, spawn: sim.spawn, shaft: sim.shaft, floorY, floor, safe, footY, stable, support, campReady, campfireCount, secretCount, bossCount });
      }
    }

    return { checked: seedCount, failures };
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
    return {
      recipes: window.ML.RECIPES.length,
      achievements: window.ML.ACHIEVEMENTS.length,
      contracts: window.ML.CONTRACTS.length,
      caveEvents: Object.keys(window.ML.CAVE_EVENTS || {}).length,
      biomes: Object.keys(window.ML.BIOMES || {}).length,
      biomeSystem: Boolean(window.ML.BiomeSystem?.biomeAt && window.ML.BiomeSystem?.current),
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

  await browser.close();

  const progressionFailed = progressionCheck.recipes < 34
    || progressionCheck.achievements < 24
    || progressionCheck.contracts < 5
    || progressionCheck.caveEvents < 4
    || progressionCheck.biomes < 8
    || !progressionCheck.biomeSystem
    || progressionCheck.sampleBiomeCount < 6
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
  const failed = errors.length > 0 || seedCheck.failures.length > 0 || progressionFailed || !start.support || !start.stable || start.campfires < 1 || !start.recallApi || !start.campApi || !start.nearCamp || fallDelta > 1;
  const report = { seedCheck, progressionCheck, start, afterDown, fallDelta, errors };
  console.log(JSON.stringify(report, null, 2));

  if (failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
