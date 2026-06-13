const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const GAME_URL = process.env.ABYSSFORGE_URL || pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;
const MIN_FPS = Number(process.env.MIN_FPS || 30);
const MAX_AVG_FRAME = Number(process.env.MAX_AVG_FRAME_MS || 34);
const MAX_P95_FRAME = Number(process.env.MAX_P95_FRAME_MS || 55);
const MAX_HUD_NODES = Number(process.env.MAX_HUD_NODES || 1200);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !message.text().includes("ReadPixels")) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto(GAME_URL);
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => window.ML?.sceneRef?.player && window.ML?.ui?.perfChip);

  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    const scene = window.ML.sceneRef;
    scene.sim.newWorld(7919);
    const safe = scene.sim.safeSpawnPixels();
    scene.player.setPosition(safe.x, safe.y);
    scene.sim.player = { x: safe.x, y: safe.y };
    scene.rebuildWorldLayer();
    window.ML.renderAll(scene.sim);
  });

  await page.waitForFunction(() => window.ML?.performanceSnapshot?.samples >= 2, null, { timeout: 6000 });

  const frameMetrics = await page.evaluate(async () => {
    const deltas = [];
    let last = performance.now();
    for (let i = 0; i < 160; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      deltas.push(now - last);
      last = now;
    }
    const sorted = [...deltas].sort((a, b) => a - b);
    const sum = deltas.reduce((total, value) => total + value, 0);
    const avgFrame = sum / deltas.length;
    const p95Frame = sorted[Math.floor(sorted.length * 0.95)] || 0;
    return {
      rafFps: 1000 / avgFrame,
      rafAvgFrame: avgFrame,
      rafP95Frame: p95Frame,
      rafWorstFrame: sorted[sorted.length - 1] || 0
    };
  });

  const snapshot = await page.evaluate(() => {
    const scene = window.ML.sceneRef;
    scene?.updateLightProps?.(true);
    const hud = document.getElementById("hud");
    const hotbar = document.getElementById("hotbar");
    const topLeft = document.querySelector(".top-left");
    const topRight = document.querySelector(".top-right");
    const perfChip = document.getElementById("perfChip");
    const minimapHidden = document.getElementById("minimapPanel")?.classList.contains("hidden");
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      performance: window.ML.performanceSnapshot,
      hudNodes: hud ? hud.getElementsByTagName("*").length : 0,
      canvasCount: document.querySelectorAll("canvas").length,
      minimapHidden,
      topLeft: rectOf(topLeft),
      topRight: rectOf(topRight),
      hotbar: rectOf(hotbar),
      perfChip: rectOf(perfChip),
      externalAssets: window.ML.ExternalAssets?.report?.() || null,
      assetIconCount: document.querySelectorAll(".asset-icon").length,
      chestPropPool: scene?.chestPropPool?.length || 0,
      visibleChestProps: scene?.visibleChestPropCount || 0,
      lightPropPool: scene?.lightPropPool?.length || 0,
      visibleLightProps: scene?.visibleLightPropCount || 0,
      lightPropFrameCount: scene?.lightPropFrameKeys?.().length || 0
    };
  });

  const result = { frameMetrics, snapshot, errors };
  console.log(JSON.stringify(result, null, 2));

  await browser.close();

  const failures = [];
  if (errors.length) failures.push("browser errors");
  if (frameMetrics.rafFps < MIN_FPS) failures.push(`raf fps ${frameMetrics.rafFps.toFixed(1)} < ${MIN_FPS}`);
  if (frameMetrics.rafAvgFrame > MAX_AVG_FRAME) failures.push(`avg frame ${frameMetrics.rafAvgFrame.toFixed(1)}ms > ${MAX_AVG_FRAME}ms`);
  if (frameMetrics.rafP95Frame > MAX_P95_FRAME) failures.push(`p95 frame ${frameMetrics.rafP95Frame.toFixed(1)}ms > ${MAX_P95_FRAME}ms`);
  if ((snapshot.hudNodes || 0) > MAX_HUD_NODES) failures.push(`hud nodes ${snapshot.hudNodes} > ${MAX_HUD_NODES}`);
  if (!snapshot.minimapHidden) failures.push("minimap should be closed by default");
  if ((snapshot.canvasCount || 0) < 2) failures.push("expected game canvas and minimap canvas");
  if ((snapshot.externalAssets?.loaded || 0) < 25) failures.push("expected runtime external assets to be loaded");
  if ((snapshot.externalAssets?.cacheTextureCount || 0) < 8) failures.push("expected external cache textures to be normalized");
  if ((snapshot.externalAssets?.cacheAnimationFrameCount || 0) < 4) failures.push("expected cache opening animation frames");
  if ((snapshot.externalAssets?.mobWakeAnimationFrameCount || 0) < 5) failures.push("expected mob wake animation frames");
  if ((snapshot.externalAssets?.itemTextureCount || 0) < 20) failures.push("expected expanded external item texture set");
  if ((snapshot.externalAssets?.derivedCssIconCount || 0) < 20) failures.push("expected derived CSS item icons");
  if ((snapshot.externalAssets?.sheetIconCount || 0) < 4) failures.push("expected sliced sheet item icons");
  if ((snapshot.assetIconCount || 0) < 1) failures.push("expected at least one external asset icon in the HUD");
  if ((snapshot.chestPropPool || 0) < 48) failures.push("expected pooled chest prop sprites");
  if ((snapshot.lightPropPool || 0) < 96) failures.push("expected pooled light prop sprites");
  if ((snapshot.lightPropFrameCount || 0) < 9) failures.push("expected animated light prop frames");

  if (failures.length) {
    console.error(`HUD performance check failed: ${failures.join("; ")}`);
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
