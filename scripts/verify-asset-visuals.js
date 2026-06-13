const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const GAME_URL = pathToFileURL(path.join(PROJECT_ROOT, "index.html")).href;
const SCREENSHOT_PATH = process.env.ASSET_VISUAL_SCREENSHOT || "";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 960, height: 640 },
    deviceScaleFactor: 1
  });
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto(GAME_URL);
  await page.waitForFunction(() =>
    window.ML?.sceneRef?.sim
    && window.ML.sceneRef.chestPropPool
    && window.ML.ExternalAssets?.report
  );

  const snapshot = await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    const sim = scene.sim;
    let firstChest = null;
    for (let y = 0; y < sim.worldHeight(); y += 1) {
      for (let x = 0; x < sim.worldWidth(); x += 1) {
        if (sim.tileAt(x, y) === window.ML.Tile.CHEST) {
          firstChest = { x, y };
          break;
        }
      }
      if (firstChest) break;
    }

    if (firstChest) {
      const cam = scene.cameras.main;
      cam.stopFollow();
      cam.setScroll(
        Math.max(0, firstChest.x * window.ML.TILE - cam.width / 2),
        Math.max(0, firstChest.y * window.ML.TILE - cam.height / 2)
      );
      scene.updateChestProps(true);
    }

    scene.spawnRecoverFx("kit");
    const visibleCaches = scene.chestPropPool.filter((sprite) => sprite.visible);
    const recoverFx = scene.children.list.filter((child) => child.texture?.key === "asset-heart-full");
    const firstTexture = visibleCaches[0]?.texture?.key || null;
    const cacheProfile = firstChest ? scene.cacheVisualProfile(firstChest.x, firstChest.y) : null;
    const slicedItems = ["sealedLetter", "strangeKey", "watcherToken", "battery"];
    const slicedIconUrls = Object.fromEntries(
      slicedItems.map((item) => [item, window.ML.ExternalAssets.itemCssUrl(item)])
    );
    const slicedIconUnique = new Set(Object.values(slicedIconUrls).filter(Boolean)).size;

    return {
      firstChest,
      cacheProfile,
      visibleCacheProps: scene.visibleChestPropCount,
      firstTexture,
      recoverFxCount: recoverFx.length,
      slicedIconUrls,
      slicedIconUnique,
      externalAssets: window.ML.ExternalAssets.report(scene)
    };
  });

  if (SCREENSHOT_PATH) {
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  }

  await browser.close();

  const failures = [];
  if ((snapshot.externalAssets?.loaded || 0) < 25) failures.push("expected 25 external assets loaded");
  if ((snapshot.externalAssets?.normalized || 0) < 39) failures.push("expected 39 normalized runtime textures");
  if ((snapshot.externalAssets?.cacheTextureCount || 0) < 8) failures.push("expected 8 cache textures");
  if ((snapshot.externalAssets?.itemTextureCount || 0) < 20) failures.push("expected expanded item textures");
  if ((snapshot.externalAssets?.derivedCssIconCount || 0) < 20) failures.push("expected derived CSS item icons");
  if ((snapshot.externalAssets?.sheetIconCount || 0) < 4) failures.push("expected sliced sheet item icons");
  if (!snapshot.firstChest) failures.push("expected at least one cache tile in the generated world");
  if ((snapshot.visibleCacheProps || 0) < 1) failures.push("expected visible cache prop overlay");
  if (!snapshot.firstTexture?.startsWith("asset-cache-")) failures.push("expected normalized cache texture in scene");
  if ((snapshot.recoverFxCount || 0) < 1) failures.push("expected recover heart FX");
  if ((snapshot.slicedIconUnique || 0) < 4) failures.push("expected unique sliced lore/supply icons");

  if (failures.length) {
    console.error(`Asset visual check failed: ${failures.join("; ")}`);
    console.error(JSON.stringify(snapshot, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(snapshot, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
