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
      const secretCount = sim.secrets?.length || 0;
      const bossCount = sim.mobs.filter((mob) => window.ML.ENEMIES[mob.kind]?.boss).length;

      if (!stable || !support || floor === AIR || floor === Tile.PLATFORM || !BLOCKS[floor]?.solid || footY !== floorY || secretCount < 5 || bossCount < 2) {
        failures.push({ seed: actualSeed, spawn: sim.spawn, shaft: sim.shaft, floorY, floor, safe, footY, stable, support, secretCount, bossCount });
      }
    }

    return { checked: seedCount, failures };
  }, SEED_COUNT);

  const progressionCheck = await page.evaluate(() => {
    const sim = new window.ML.MinerSim();
    sim.newWorld(7919);
    const craftable = window.ML.craftableRecipes(sim);
    const platformRecipe = window.ML.RECIPES.find((recipe) => recipe.id === "platform");
    const craftResult = sim.craft(platformRecipe);
    const contractBefore = sim.contractProgress();
    if (contractBefore?.contract.absolute) {
      sim.stats[contractBefore.contract.type] = contractBefore.target;
    } else if (contractBefore) {
      sim.stats[contractBefore.contract.type] = contractBefore.contract.start + contractBefore.target;
    }
    const contractClaim = sim.claimContract();
    return {
      recipes: window.ML.RECIPES.length,
      achievements: window.ML.ACHIEVEMENTS.length,
      contracts: window.ML.CONTRACTS.length,
      caveEvents: Object.keys(window.ML.CAVE_EVENTS || {}).length,
      craftable: craftable.length,
      craftResult,
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
      floorTile: scene.sim.tileAt(scene.sim.spawn.x, scene.sim.spawnFloorY())
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
    || progressionCheck.craftable < 3
    || !progressionCheck.craftResult.ok
    || !progressionCheck.contractBefore
    || !progressionCheck.contractClaim
    || progressionCheck.crafted < 1
    || progressionCheck.completedContracts < 1
    || progressionCheck.platforms < 4;
  const failed = errors.length > 0 || seedCheck.failures.length > 0 || progressionFailed || !start.support || !start.stable || fallDelta > 1;
  const report = { seedCheck, progressionCheck, start, afterDown, fallDelta, errors };
  console.log(JSON.stringify(report, null, 2));

  if (failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
