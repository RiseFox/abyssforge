const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const GAME_URL = process.env.ABYSSFORGE_URL || pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;

async function physicalKey(page, code, key, holdMs = 420) {
  await page.evaluate(({ code, key }) => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      code,
      key,
      bubbles: true,
      cancelable: true
    }));
  }, { code, key });
  await page.waitForTimeout(holdMs);
  await page.evaluate(({ code, key }) => {
    window.dispatchEvent(new KeyboardEvent("keyup", {
      code,
      key,
      bubbles: true,
      cancelable: true
    }));
  }, { code, key });
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(GAME_URL);
  await page.waitForFunction(() => window.ML?.sceneRef?.player && window.ML?.ui?.pauseMenu);

  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    const scene = window.ML.sceneRef;
    const { TILE, Tile, AIR } = window.ML;
    scene.sim.newWorld(20260614);
    const safe = scene.sim.safeSpawnPixels();
    const centerX = Math.floor(safe.x / TILE);
    const floorY = Math.floor((safe.y + 20) / TILE);
    for (let x = centerX - 16; x <= centerX + 16; x += 1) {
      for (let y = floorY - 5; y < floorY; y += 1) scene.sim.setTile(x, y, AIR);
      scene.sim.setTile(x, floorY, Tile.GRASS);
      scene.sim.setTile(x, floorY + 1, Tile.DIRT);
      scene.sim.setTile(x, floorY + 2, Tile.STONE);
    }
    scene.rebuildWorldLayer();
    const startX = centerX * TILE + TILE / 2;
    const startY = floorY * TILE - 18;
    scene.player.setPosition(startX, startY);
    scene.player.setVelocity(0, 0);
    scene.sim.player = { x: startX, y: startY };
    scene.setPaused(false, { silent: true });
    scene.focusGameInput();
    window.ML.renderAll(scene.sim);
  });

  const read = () => page.evaluate(() => {
    const scene = window.ML.sceneRef;
    return {
      x: scene.player.x,
      y: scene.player.y,
      paused: scene.pausedByUI,
      keyboard: scene.input.keyboard.enabled,
      physical: { ...scene.physicalKeys },
      activeTag: document.activeElement?.tagName || null,
      canvasFocused: document.activeElement === scene.game.canvas
    };
  });

  const start = await read();
  await physicalKey(page, "KeyD", "в");
  const afterRight = await read();
  await physicalKey(page, "KeyA", "ф");
  const afterLeft = await read();

  await page.click("#menuToggle");
  await page.click("#resumeBtn");
  const afterMenuResume = await read();
  await physicalKey(page, "KeyD", "в");
  const afterMenuRight = await read();

  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  const afterFocusRestore = await read();
  await physicalKey(page, "KeyA", "ф");
  const afterFocusLeft = await read();

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(120);
  const afterEscPause = await read();
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(120);
  const afterEscResume = await read();

  await browser.close();

  const failures = [];
  if (errors.length) failures.push(`browser errors: ${errors.join("; ")}`);
  if (afterRight.x - start.x < 28) failures.push("physical KeyD with Cyrillic key did not move right");
  if (afterRight.physical.right) failures.push("right physical key did not reset after keyup");
  if (afterRight.x - afterLeft.x < 28) failures.push("physical KeyA with Cyrillic key did not move left");
  if (afterMenuResume.paused) failures.push("resume button did not unpause the game");
  if (afterMenuRight.x - afterMenuResume.x < 28) failures.push("physical movement failed after pause menu resume");
  if (!afterFocusRestore.canvasFocused) failures.push("canvas focus was not restored after blur/focus");
  if (afterMenuRight.x - afterFocusLeft.x < 28) failures.push("physical movement failed after blur/focus restore");
  if (!afterEscPause.paused) failures.push("physical Escape did not pause");
  if (afterEscResume.paused) failures.push("physical Escape did not resume");

  const snapshot = {
    start,
    afterRight,
    afterLeft,
    afterMenuResume,
    afterMenuRight,
    afterFocusRestore,
    afterFocusLeft,
    afterEscPause,
    afterEscResume,
    errors
  };

  if (failures.length) {
    console.error(`Input control check failed: ${failures.join("; ")}`);
    console.error(JSON.stringify(snapshot, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(snapshot, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
