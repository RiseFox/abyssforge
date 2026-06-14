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
    && window.ML.sceneRef.orePropPool
    && window.ML.sceneRef.lightPropPool
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
    if (firstChest) {
      scene.playCacheOpenFx(firstChest.x, firstChest.y, { kind: "chest", label: "Test cache" });
    }
    const firstLight = (scene.sim.lights || []).find((light) => {
      const tile = sim.tileAt(light.x, light.y);
      return tile === window.ML.Tile.CAMPFIRE || tile === window.ML.Tile.TORCH || tile === window.ML.Tile.MUSHROOM;
    }) || null;
    if (firstLight) {
      const cam = scene.cameras.main;
      cam.stopFollow();
      cam.setScroll(
        Math.max(0, firstLight.x * window.ML.TILE - cam.width / 2),
        Math.max(0, firstLight.y * window.ML.TILE - cam.height / 2)
      );
      scene.updateLightProps(true);
    }
    const lightPropFrames = scene.lightPropFrameKeys?.() || [];
    const visibleLightProps = scene.lightPropPool.filter((sprite) => sprite.visible);
    const oreTiles = [
      window.ML.Tile.COAL,
      window.ML.Tile.COPPER,
      window.ML.Tile.IRON,
      window.ML.Tile.CRYSTAL,
      window.ML.Tile.GOLD,
      window.ML.Tile.OBSIDIAN,
      window.ML.Tile.AMBER,
      window.ML.Tile.QUARTZ,
      window.ML.Tile.EMBER,
      window.ML.Tile.VOIDGLASS
    ];
    let firstOre = null;
    for (let y = 0; y < sim.worldHeight(); y += 1) {
      for (let x = 0; x < sim.worldWidth(); x += 1) {
        const tile = sim.tileAt(x, y);
        if (oreTiles.includes(tile) && (!scene.isOrePropCandidate || scene.isOrePropCandidate(tile, x, y))) {
          firstOre = { x, y, tile };
          break;
        }
      }
      if (firstOre) break;
    }
    if (firstOre) {
      const cam = scene.cameras.main;
      cam.stopFollow();
      scene.player.setPosition(firstOre.x * window.ML.TILE + window.ML.TILE / 2, firstOre.y * window.ML.TILE - 28);
      scene.sim.player = { x: scene.player.x, y: scene.player.y };
      cam.setScroll(
        Math.max(0, firstOre.x * window.ML.TILE - cam.width / 2),
        Math.max(0, firstOre.y * window.ML.TILE - cam.height / 2)
      );
      scene.updateOreProps(true);
    }
    const orePropFrames = scene.orePropFrameKeys?.() || [];
    const visibleOreProps = scene.orePropPool.filter((sprite) => sprite.visible);
    const mobWakeFrames = window.ML.ExternalAssets.mobWakeFrameKeys?.(scene) || [];
    const mobWakePreview = mobWakeFrames[0]
      ? scene.add.image(scene.player.x + 92, scene.player.y - 4, mobWakeFrames[0])
        .setDepth(85)
        .setScale(1.45)
        .setAlpha(0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
      : null;

    return {
      firstChest,
      cacheProfile,
      visibleCacheProps: scene.visibleChestPropCount,
      firstTexture,
      recoverFxCount: recoverFx.length,
      cacheOpenAnimation: scene.lastCacheOpenAnimation || null,
      firstLight,
      lightPropPoolSize: scene.lightPropPool.length,
      visibleLightProps: scene.visibleLightPropCount,
      firstLightTexture: visibleLightProps[0]?.texture?.key || null,
      lightPropFrameCount: lightPropFrames.length,
      firstOre,
      orePropPoolSize: scene.orePropPool.length,
      visibleOreProps: scene.visibleOrePropCount,
      firstOreTexture: visibleOreProps[0]?.texture?.key || null,
      orePropFrameCount: orePropFrames.length,
      mobWakeFrameCount: mobWakeFrames.length,
      mobWakePreviewTexture: mobWakePreview?.texture?.key || null,
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
  if ((snapshot.externalAssets?.normalized || 0) < 48) failures.push("expected 48 normalized runtime textures");
  if ((snapshot.externalAssets?.cacheTextureCount || 0) < 8) failures.push("expected 8 cache textures");
  if ((snapshot.externalAssets?.cacheAnimationFrameCount || 0) < 4) failures.push("expected 4 cache animation frames");
  if ((snapshot.externalAssets?.mobWakeAnimationFrameCount || 0) < 5) failures.push("expected 5 mob wake animation frames");
  if ((snapshot.externalAssets?.itemTextureCount || 0) < 20) failures.push("expected expanded item textures");
  if ((snapshot.externalAssets?.derivedCssIconCount || 0) < 20) failures.push("expected derived CSS item icons");
  if ((snapshot.externalAssets?.sheetIconCount || 0) < 4) failures.push("expected sliced sheet item icons");
  if (!snapshot.firstChest) failures.push("expected at least one cache tile in the generated world");
  if ((snapshot.visibleCacheProps || 0) < 1) failures.push("expected visible cache prop overlay");
  if (!snapshot.firstTexture?.startsWith("asset-cache-")) failures.push("expected normalized cache texture in scene");
  if ((snapshot.cacheOpenAnimation?.frameCount || 0) < 4) failures.push("expected cache opening animation to run");
  if (!snapshot.firstLight) failures.push("expected at least one light prop source in the generated world");
  if ((snapshot.lightPropPoolSize || 0) < 96) failures.push("expected pooled light prop sprites");
  if ((snapshot.visibleLightProps || 0) < 1) failures.push("expected visible light prop overlay");
  if ((snapshot.lightPropFrameCount || 0) < 9) failures.push("expected generated light prop animation frames");
  if (!snapshot.firstLightTexture?.startsWith?.("light-")) failures.push("expected animated light prop texture in scene");
  if (!snapshot.firstOre) failures.push("expected at least one ore prop source in the generated world");
  if ((snapshot.orePropPoolSize || 0) < 72) failures.push("expected pooled ore prop sprites");
  if ((snapshot.visibleOreProps || 0) < 1) failures.push("expected visible ore prop overlay");
  if ((snapshot.orePropFrameCount || 0) < 9) failures.push("expected generated ore prop animation frames");
  if (!snapshot.firstOreTexture?.startsWith?.("ore-glint-")) failures.push("expected animated ore glint texture in scene");
  if ((snapshot.mobWakeFrameCount || 0) < 5) failures.push("expected mob wake frame list");
  if (!snapshot.mobWakePreviewTexture?.startsWith?.("asset-mob-wake-frame")) failures.push("expected mob wake preview texture");
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
