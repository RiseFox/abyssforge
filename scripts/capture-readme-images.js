const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const GAME_URL = process.env.ABYSSFORGE_URL || pathToFileURL(path.join(ROOT, "index.html")).href;
const IMAGE_DIR = path.join(ROOT, "docs", "images");

const VIEWPORT = { width: 1320, height: 760 };

function imagePath(name) {
  return path.join(IMAGE_DIR, name);
}

async function waitForGame(page) {
  await page.goto(GAME_URL);
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => window.ML?.sceneRef?.player && window.ML?.renderAll);
}

async function resetWorld(page, seed) {
  await page.evaluate((worldSeed) => {
    try { localStorage.clear(); } catch { /* ignore */ }
    const scene = window.ML.sceneRef;
    scene.sim.newWorld(worldSeed);
    scene.enemies?.clear?.(true, true);
    scene.activeMobIds?.clear?.();
    scene.pendingMobSpawns?.clear?.();
    scene.watcher?.setVisible?.(false);
    scene.watcherTraceMarks?.forEach?.((mark) => mark.destroy?.());
    scene.watcherTraceMarks = [];
    scene.shadowPressure = 0;
    scene.sim.shadowPressure = 0;
    const safe = scene.sim.safeSpawnPixels();
    scene.player.setPosition(safe.x, safe.y);
    scene.player.setVelocity(0, 0);
    scene.sim.player = { x: safe.x, y: safe.y };
    scene.rebuildWorldLayer();
    scene.refreshMobActivation?.();
    window.ML.minimap.init(scene.sim);
    window.ML.toggleMinimap?.(false);
    scene.toggleCraft?.(false);
    scene.togglePack?.(false);
    scene.toggleCamp?.(false);
    scene.toggleHelp?.(false);
    scene.setPaused?.(false, { silent: true });
    window.ML.resetRenderCache?.();
    window.ML.renderAll(scene.sim, { force: true });
    scene.cameras.main.centerOn(safe.x, safe.y);
  }, seed);
  await page.waitForTimeout(450);
}

async function capture(page, name) {
  await page.evaluate(() => {
    const achievement = document.getElementById("achievementToast");
    achievement?.classList.add("hidden");
    achievement?.classList.remove("visible");
  });
  await page.screenshot({
    path: imagePath(name),
    fullPage: false
  });
}

async function stageSurfaceCamp(page) {
  await resetWorld(page, 57545016);
  await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    const safe = scene.sim.safeSpawnPixels();
    scene.player.setPosition(safe.x + 42, safe.y);
    scene.player.setVelocity(0, 0);
    scene.sim.player = { x: scene.player.x, y: scene.player.y };
    scene.sim.time = 10.2;
    scene.caveEvent = null;
    scene.setAction("Camp ready", 2400);
    window.ML.showToast("Surface camp secured. Build a route, then choose how far the mine gets to pull you.", 3200);
    window.ML.renderAll(scene.sim, { force: true });
    scene.cameras.main.centerOn(scene.player.x + 130, scene.player.y + 30);
  });
  await page.waitForTimeout(700);
  await capture(page, "abyssforge-surface-camp.png");
}

async function stageHorizon(page) {
  await resetWorld(page, 7919);
  await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    for (let i = 0; i < 10; i += 1) scene.sim.extendHorizontal("right", 96);
    scene.rebuildWorldLayer();
    scene.enemies?.clear?.(true, true);
    scene.activeMobIds?.clear?.();
    scene.refreshMobActivation?.();
    window.ML.minimap.init(scene.sim);

    const surfaceMarks = (scene.sim.surfaceDiscoveries || [])
      .filter((entry) => entry.scope !== "underground")
      .sort((a, b) => Math.abs(b.x - scene.sim.spawn.x) - Math.abs(a.x - scene.sim.spawn.x));
    const targetX = surfaceMarks[0]?.x || scene.sim.worldWidth() - 90;
    const floorY = scene.sim.surfaceFloorY(targetX);
    const px = targetX * window.ML.TILE + window.ML.TILE / 2;
    const py = floorY * window.ML.TILE - 17;
    scene.player.setPosition(px + 80, py);
    scene.player.setVelocity(0, 0);
    scene.sim.player = { x: scene.player.x, y: scene.player.y };
    scene.sim.time = 12.8;
    scene.setAction("Horizon opened", 2400);
    window.ML.toggleMinimap(true);
    window.ML.showToast("The edge is not a wall now. New surface country stitches itself to the last columns.", 3600);
    window.ML.renderAll(scene.sim, { force: true });
    scene.cameras.main.centerOn(scene.player.x - 120, scene.player.y + 40);
  });
  await page.waitForTimeout(800);
  await capture(page, "abyssforge-horizon-regions.png");
}

async function stageBiomeIntel(page) {
  await resetWorld(page, 43210);
  await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    scene.sim.extendDepth(scene.sim.shaft.x, 128);
    scene.sim.extendDepth(scene.sim.shaft.x, 128);
    scene.rebuildWorldLayer();
    scene.enemies?.clear?.(true, true);
    scene.activeMobIds?.clear?.();
    scene.refreshMobActivation?.();
    window.ML.minimap.init(scene.sim);

    const { TILE, BLOCKS } = window.ML;
    let spot = null;
    for (let y = 120; y < scene.sim.worldHeight() - 8 && !spot; y += 1) {
      for (let x = 5; x < scene.sim.worldWidth() - 5; x += 1) {
        const depth = y - (scene.sim.surface[x] || 24);
        if (depth < 90 || depth > 210) continue;
        const tile = scene.sim.tileAt(x, y);
        if (!BLOCKS[tile]?.solid || !scene.sim.hasHeadClearance(x, y)) continue;
        spot = { x, y };
        break;
      }
    }
    spot ||= { x: scene.sim.shaft.x + 8, y: Math.min(scene.sim.worldHeight() - 10, 150) };
    const px = spot.x * TILE + TILE / 2;
    const py = spot.y * TILE - 17;
    scene.player.setPosition(px, py);
    scene.player.setVelocity(0, 0);
    scene.sim.player = { x: px, y: py };
    scene.sim.lamp = 2;
    scene.sim.refillLamp?.();
    scene.sim.stats.deepest = Math.max(scene.sim.stats.deepest || 0, 150);
    scene.checkLore("biome", { silent: true, biome: scene.currentBiome() });
    scene.setAction("Biome pressure", 2400);
    window.ML.showToast(`${scene.currentBiome()?.name || "Deep biome"} changes recovery, light, mobs, and music.`, 3400);
    window.ML.renderAll(scene.sim, { force: true });
    scene.cameras.main.centerOn(px + 90, py - 10);
  });
  await page.waitForTimeout(900);
  await capture(page, "abyssforge-biome-intel.png");
}

async function stageHiddenLore(page) {
  await resetWorld(page, 98765);
  await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    scene.sim.extendDepth(scene.sim.shaft.x, 160);
    scene.sim.extendDepth(scene.sim.shaft.x, 160);
    scene.rebuildWorldLayer();
    scene.enemies?.clear?.(true, true);
    scene.activeMobIds?.clear?.();
    scene.refreshMobActivation?.();
    window.ML.minimap.init(scene.sim);

    const { TILE, BLOCKS } = window.ML;
    let spot = null;
    for (let y = 150; y < scene.sim.worldHeight() - 8 && !spot; y += 1) {
      for (let x = 6; x < scene.sim.worldWidth() - 6; x += 1) {
        const depth = y - (scene.sim.surface[x] || 24);
        if (depth < 130) continue;
        const tile = scene.sim.tileAt(x, y);
        if (!BLOCKS[tile]?.solid || !scene.sim.hasHeadClearance(x, y)) continue;
        spot = { x, y };
        break;
      }
    }
    spot ||= { x: scene.sim.shaft.x + 14, y: Math.min(scene.sim.worldHeight() - 12, 190) };
    const px = spot.x * TILE + TILE / 2;
    const py = spot.y * TILE - 17;
    scene.player.setPosition(px, py);
    scene.player.setVelocity(0, 0);
    scene.player.setFlipX(false);
    scene.sim.player = { x: px, y: py };
    scene.sim.lamp = 1;
    scene.sim.refillLamp?.();
    scene.sim.stats.deepest = 240;
    scene.sim.stats.secrets = 4;
    scene.sim.stats.camps = 2;
    scene.sim.stats.watcherSightings = 2;
    scene.sim.stats.shadowPeaks = 1;
    scene.shadowPressure = 78;
    scene.sim.shadowPressure = 78;
    scene.checkLore("shadowPeak", { shadowPeak: true, silent: true });
    scene.checkLore("watcher", { watcher: true, silent: true });
    scene.cameras.main.centerOn(px + 120, py - 20);
    const spawned = scene.spawnWatcherSighting?.({ force: true, silent: true });
    if (!spawned && scene.watcher) {
      scene.watcher.setPosition(px + 250, py - 10).setVisible(true).setAlpha(0.82);
      scene.watcherState = { homeX: px + 250, homeY: py - 10, appearedAt: scene.time.now, vanishAt: scene.time.now + 5000, side: 1, noticed: false, pulse: 0 };
    }
    scene.leaveWatcherTrace?.(px + 190, py + 10, "trail");
    scene.setAction("Something watches", 2400);
    window.ML.showToast("The field note is not written to the miner. It is written to the player.", 3600);
    window.ML.renderAll(scene.sim, { force: true });
  });
  await page.waitForTimeout(900);
  await capture(page, "abyssforge-hidden-lore.png");
}

async function stageBackpack(page) {
  await resetWorld(page, 246813);
  await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    const samples = {
      dirt: 32,
      stone: 48,
      wood: 22,
      coal: 9,
      copper: 8,
      iron: 5,
      gold: 3,
      crystal: 4,
      obsidian: 2,
      amber: 3,
      quartz: 4,
      ember: 2,
      voidglass: 1,
      mapScrap: 2,
      oldCompass: 1,
      sealedLetter: 1,
      watcherToken: 1,
      mirrorShard: 1,
      clockwork: 1,
      strangeKey: 1,
      battery: 3,
      charge: 3,
      mushroom: 5,
      kit: 2,
      coin: 37,
      torch: 12,
      ladder: 18,
      platform: 10
    };
    for (const [item, count] of Object.entries(samples)) {
      scene.sim.inventory[item] = count;
      scene.sim.knownItems[item] = true;
    }
    scene.sim.pickLevel = 4;
    scene.sim.lamp = 2;
    scene.sim.blade = 2;
    scene.sim.stats.mined = 180;
    scene.sim.stats.deepest = 128;
    scene.sim.stats.secrets = 3;
    scene.sim.stats.chests = 6;
    scene.togglePack(true);
    scene.setAction("Backpack sorted", 2400);
    window.ML.showToast("The quick belt is not the backpack. Discovery controls what the player sees first.", 3200);
    window.ML.renderAll(scene.sim, { force: true });
    scene.cameras.main.centerOn(scene.player.x + 120, scene.player.y + 10);
  });
  await page.waitForTimeout(700);
  await capture(page, "abyssforge-backpack-workshop.png");
}

(async () => {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !message.text().includes("ReadPixels")) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await waitForGame(page);
  await stageSurfaceCamp(page);
  await stageHorizon(page);
  await stageBiomeIntel(page);
  await stageHiddenLore(page);
  await stageBackpack(page);
  await browser.close();

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log(JSON.stringify({
    images: fs.readdirSync(IMAGE_DIR).filter((name) => name.endsWith(".png")).sort()
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
