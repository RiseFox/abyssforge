// AbyssForge v2 - every texture is generated on canvas at boot. No image assets.
(() => {
  "use strict";
  const ML = window.ML;
  const { TILE, Tile } = ML;

  function makeTextures(scene) {
    const freshCanvasTexture = (key, width, height) => {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const texture = scene.textures.createCanvas(key, width, height);
      if (!texture) throw new Error(`Could not create texture: ${key}`);
      return texture;
    };

    // ---- World tiles: one row, indexed by tile id -------------------------
    const count = Math.max(...Object.values(Tile)) + 1;
    const tiles = freshCanvasTexture("tiles", TILE * count, TILE);
    const ctx = tiles.getContext();
    ctx.clearRect(0, 0, TILE * count, TILE);

    const pixelNoise = (id, base, fleck, amount = 26) => {
      const x0 = id * TILE;
      ctx.fillStyle = base;
      ctx.fillRect(x0, 0, TILE, TILE);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x0, TILE - 4, TILE, 4);
      ctx.fillStyle = fleck;
      for (let i = 0; i < amount; i += 1) {
        const x = x0 + Math.floor(Math.random() * TILE);
        const y = Math.floor(Math.random() * TILE);
        ctx.fillRect(x, y, 2, 2);
      }
    };

    pixelNoise(Tile.GRASS, "#6f9152", "#c7d277");
    ctx.fillStyle = "#4e7e3c";
    ctx.fillRect(Tile.GRASS * TILE, 0, TILE, 7);
    pixelNoise(Tile.DIRT, "#785331", "#b18455", 32);
    pixelNoise(Tile.STONE, "#777a76", "#a7aaa2", 32);
    pixelNoise(Tile.COAL, "#686b68", "#1f2020", 34);
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = "#202020";
      ctx.fillRect(Tile.COAL * TILE + 6 + i * 3, 7 + (i % 3) * 6, 4, 4);
    }
    pixelNoise(Tile.COPPER, "#756e62", "#d18a55", 32);
    pixelNoise(Tile.IRON, "#6f716d", "#d7d2c4", 32);
    pixelNoise(Tile.CRYSTAL, "#4c777e", "#a5fff1", 42);
    pixelNoise(Tile.DEEP, "#45474c", "#747982", 24);
    pixelNoise(Tile.BEDROCK, "#242426", "#55555a", 20);
    pixelNoise(Tile.WOOD, "#74471f", "#b97836", 18);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let x = 3; x < TILE; x += 8) ctx.fillRect(Tile.WOOD * TILE + x, 0, 2, TILE);
    pixelNoise(Tile.LEAVES, "#456d3e", "#85ac58", 34);

    const torchX = Tile.TORCH * TILE;
    ctx.clearRect(torchX, 0, TILE, TILE);
    ctx.fillStyle = "#71431f";
    ctx.fillRect(torchX + 14, 11, 5, 19);
    ctx.fillStyle = "#f3ce62";
    ctx.fillRect(torchX + 11, 3, 11, 10);
    ctx.fillStyle = "#f37a42";
    ctx.fillRect(torchX + 14, 6, 5, 6);

    const ladderX = Tile.LADDER * TILE;
    ctx.clearRect(ladderX, 0, TILE, TILE);
    ctx.fillStyle = "#7b4c24";
    ctx.fillRect(ladderX + 7, 0, 5, TILE);
    ctx.fillRect(ladderX + 21, 0, 5, TILE);
    ctx.fillStyle = "#b37135";
    for (let y = 5; y < TILE; y += 9) ctx.fillRect(ladderX + 7, y, 19, 4);

    const platformX = Tile.PLATFORM * TILE;
    ctx.clearRect(platformX, 0, TILE, TILE);
    ctx.fillStyle = "#8d5b2e";
    ctx.fillRect(platformX, 8, TILE, 13);
    ctx.fillStyle = "#5f3c21";
    ctx.fillRect(platformX, 19, TILE, 6);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(platformX, 8, TILE, 2);

    pixelNoise(Tile.GOLD, "#74695a", "#ffd76a", 30);
    ctx.fillStyle = "#f7e08e";
    const goldX = Tile.GOLD * TILE;
    ctx.fillRect(goldX + 7, 8, 4, 4);
    ctx.fillRect(goldX + 19, 16, 5, 4);
    ctx.fillRect(goldX + 12, 23, 4, 3);

    pixelNoise(Tile.OBSIDIAN, "#191024", "#3f2a63", 26);
    const obsX = Tile.OBSIDIAN * TILE;
    ctx.strokeStyle = "rgba(155,110,225,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obsX + 5, 26);
    ctx.lineTo(obsX + 14, 9);
    ctx.moveTo(obsX + 17, 27);
    ctx.lineTo(obsX + 26, 12);
    ctx.stroke();

    pixelNoise(Tile.AMBER, "#6b5335", "#e1a84d", 34);
    const amberX = Tile.AMBER * TILE;
    ctx.fillStyle = "#f5c166";
    ctx.fillRect(amberX + 9, 9, 5, 5);
    ctx.fillRect(amberX + 18, 18, 4, 4);
    ctx.fillStyle = "rgba(75,42,16,0.34)";
    ctx.fillRect(amberX + 10, 10, 2, 2);

    pixelNoise(Tile.QUARTZ, "#657271", "#d8fff7", 36);
    const quartzX = Tile.QUARTZ * TILE;
    ctx.fillStyle = "#f3fffb";
    ctx.fillRect(quartzX + 8, 7, 4, 13);
    ctx.fillRect(quartzX + 18, 12, 5, 11);
    ctx.fillStyle = "#91d8d1";
    ctx.fillRect(quartzX + 10, 20, 9, 3);

    pixelNoise(Tile.EMBER, "#3d2d2a", "#df5d35", 30);
    const emberX = Tile.EMBER * TILE;
    ctx.fillStyle = "#ff8a3d";
    ctx.fillRect(emberX + 7, 20, 5, 4);
    ctx.fillRect(emberX + 17, 9, 4, 5);
    ctx.fillStyle = "#ffd26a";
    ctx.fillRect(emberX + 19, 10, 2, 2);

    pixelNoise(Tile.VOIDGLASS, "#120d1f", "#5e50c8", 28);
    const voidX = Tile.VOIDGLASS * TILE;
    ctx.strokeStyle = "rgba(155,135,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(voidX + 5, 8);
    ctx.lineTo(voidX + 27, 24);
    ctx.moveTo(voidX + 18, 5);
    ctx.lineTo(voidX + 9, 28);
    ctx.stroke();

    const lavaX = Tile.LAVA * TILE;
    ctx.fillStyle = "#c43d14";
    ctx.fillRect(lavaX, 0, TILE, TILE);
    ctx.fillStyle = "#ff9038";
    ctx.fillRect(lavaX, 0, TILE, 6);
    ctx.fillStyle = "#ffd24a";
    for (let i = 0; i < 14; i += 1) {
      ctx.fillRect(lavaX + Math.floor(Math.random() * (TILE - 4)) + 2, Math.floor(Math.random() * (TILE - 6)) + 3, 3, 3);
    }

    const mushX = Tile.MUSHROOM * TILE;
    ctx.clearRect(mushX, 0, TILE, TILE);
    ctx.fillStyle = "#d8cdb4";
    ctx.fillRect(mushX + 13, 16, 6, 14);
    ctx.fillStyle = "#48d8c4";
    ctx.fillRect(mushX + 6, 9, 20, 9);
    ctx.fillRect(mushX + 9, 6, 14, 4);
    ctx.fillStyle = "#a9ffef";
    ctx.fillRect(mushX + 9, 10, 5, 3);
    ctx.fillRect(mushX + 19, 12, 4, 3);

    const chestX = Tile.CHEST * TILE;
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(chestX, 2, TILE, TILE - 2);
    ctx.fillStyle = "#52351c";
    ctx.fillRect(chestX, 2, TILE, 4);
    ctx.fillRect(chestX, 14, TILE, 3);
    ctx.fillStyle = "#d8b25c";
    ctx.fillRect(chestX + 12, 11, 8, 9);
    ctx.fillStyle = "#7a5a22";
    ctx.fillRect(chestX + 14, 14, 4, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(chestX + 1, 3, TILE - 2, TILE - 4);

    const campX = Tile.CAMPFIRE * TILE;
    ctx.clearRect(campX, 0, TILE, TILE);
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.fillRect(campX + 5, 25, 22, 4);
    ctx.fillStyle = "#6b3d1e";
    ctx.fillRect(campX + 7, 23, 18, 5);
    ctx.fillStyle = "#a16432";
    ctx.fillRect(campX + 6, 21, 20, 4);
    ctx.fillStyle = "#412615";
    ctx.fillRect(campX + 9, 24, 14, 3);
    ctx.fillStyle = "#f7d276";
    ctx.fillRect(campX + 14, 11, 5, 11);
    ctx.fillStyle = "#f08a3e";
    ctx.fillRect(campX + 11, 14, 4, 8);
    ctx.fillRect(campX + 18, 15, 4, 7);
    ctx.fillStyle = "#9d3a24";
    ctx.fillRect(campX + 15, 18, 3, 5);

    const signX = Tile.SIGN * TILE;
    ctx.clearRect(signX, 0, TILE, TILE);
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.fillRect(signX + 6, 28, 20, 3);
    ctx.fillStyle = "#6e431f";
    ctx.fillRect(signX + 14, 13, 5, 17);
    ctx.fillStyle = "#c7924c";
    ctx.fillRect(signX + 5, 7, 22, 11);
    ctx.fillStyle = "#6a3f1d";
    ctx.fillRect(signX + 6, 8, 20, 2);
    ctx.fillRect(signX + 6, 17, 20, 2);
    ctx.fillStyle = "#2f2014";
    ctx.fillRect(signX + 9, 11, 10, 2);
    ctx.fillRect(signX + 9, 14, 14, 2);
    tiles.refresh();

    // ---- Player sprite sheet: 8 frames of 28x36 ---------------------------
    const FRAME_W = 28;
    const FRAME_H = 36;
    const frames = ["idle0", "idle1", "walk0", "walk1", "walk2", "walk3", "jump", "fall"];
    const sheet = freshCanvasTexture("playerSheet", FRAME_W * frames.length, FRAME_H);
    const pc = sheet.getContext();
    pc.clearRect(0, 0, FRAME_W * frames.length, FRAME_H);

    // bob shifts the body, legL/legR offset each boot (x, y), spread widens stance
    const drawMiner = (ox, { bob = 0, legL = [0, 0], legR = [0, 0] } = {}) => {
      const b = bob;
      pc.fillStyle = "#c78a4b"; // face
      pc.fillRect(ox + 7, 9 + b, 14, 11);
      pc.fillStyle = "#f1c46b"; // helmet
      pc.fillRect(ox + 6, 5 + b, 16, 5);
      pc.fillStyle = "#e8d8ba"; // eyes strip
      pc.fillRect(ox + 10, 11 + b, 8, 6);
      pc.fillStyle = "#3d5670"; // torso
      pc.fillRect(ox + 6, 20 + b, 16, 12 - b);
      pc.fillStyle = "#26333d"; // boots
      pc.fillRect(ox + 5 + legL[0], 31 + legL[1], 7, 4 - Math.min(0, legL[1]));
      pc.fillRect(ox + 16 + legR[0], 31 + legR[1], 7, 4 - Math.min(0, legR[1]));
      pc.fillStyle = "#f4dc83"; // headlamp
      pc.fillRect(ox + 19, 7 + b, 5, 4);
    };

    drawMiner(0 * FRAME_W, {});
    drawMiner(1 * FRAME_W, { bob: 1 });
    drawMiner(2 * FRAME_W, { legL: [-2, -3], legR: [2, 0], bob: 1 });
    drawMiner(3 * FRAME_W, { legL: [0, -1], legR: [0, -1] });
    drawMiner(4 * FRAME_W, { legL: [2, 0], legR: [-2, -3], bob: 1 });
    drawMiner(5 * FRAME_W, { legL: [0, -1], legR: [0, -1] });
    drawMiner(6 * FRAME_W, { legL: [-1, -4], legR: [1, -2], bob: 1 }); // jump tuck
    drawMiner(7 * FRAME_W, { legL: [-2, 0], legR: [2, -2] }); // fall spread
    frames.forEach((name, i) => sheet.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H));
    sheet.refresh();

    // ---- Pickaxes: 6 frames of 34x34, one per tier ------------------------
    const PICK_W = 34;
    const pickHeads = [
      { head: "#9a9487", dark: "#5f5b52", edge: "#c4bdae", spot: "#77452b" }, // rust
      { head: "#a9aca6", dark: "#676c66", edge: "#d0d2cc", spot: null }, // stone
      { head: "#d58b55", dark: "#824725", edge: "#f0ba7a", spot: "#7a3d21" }, // copper
      { head: "#e8e4d8", dark: "#8d8a82", edge: "#fff9e9", spot: null }, // iron
      { head: "#8df2e0", dark: "#2f8a83", edge: "#d8fff8", spot: "#40b6b2" }, // crystal
      { head: "#ffd76a", dark: "#a96f23", edge: "#fff2b4", spot: "#ff9b44" } // starforged
    ];
    const picks = freshCanvasTexture("picks", PICK_W * pickHeads.length, PICK_W);
    const pk = picks.getContext();
    pk.clearRect(0, 0, PICK_W * pickHeads.length, PICK_W);
    const drawBlock = (x, y, w, h, color) => {
      pk.fillStyle = color;
      pk.fillRect(x, y, w, h);
    };
    pickHeads.forEach((style, i) => {
      const ox = i * PICK_W;
      drawBlock(ox + 15, 12, 5, 20, "#2f2118");
      drawBlock(ox + 16, 11, 4, 20, "#8b562a");
      drawBlock(ox + 18, 11, 1, 18, "#c47b38");
      drawBlock(ox + 14, 29, 7, 3, "#4b2d1d");

      drawBlock(ox + 7, 4, 20, 3, style.dark);
      drawBlock(ox + 5, 7, 24, 6, style.dark);
      drawBlock(ox + 8, 5, 17, 3, style.edge);
      drawBlock(ox + 7, 7, 20, 4, style.head);
      drawBlock(ox + 3, 9, 6, 3, style.dark);
      drawBlock(ox + 27, 8, 4, 4, style.dark);
      drawBlock(ox + 9, 11, 17, 2, style.dark);
      drawBlock(ox + 14, 10, 7, 6, "#3a2b21");
      drawBlock(ox + 15, 10, 5, 3, "#81522f");
      if (style.spot) {
        drawBlock(ox + 11, 7, 3, 2, style.spot);
        drawBlock(ox + 22, 7, 2, 2, style.edge);
      }
    });
    pickHeads.forEach((_, i) => picks.add(`pick${i}`, 0, i * PICK_W, 0, PICK_W, PICK_W));
    picks.refresh();

    // ---- Enemies ----------------------------------------------------------
    const mossling = freshCanvasTexture("mossling", 28, 18);
    const mc = mossling.getContext();
    mc.clearRect(0, 0, 28, 18);
    mc.fillStyle = "#2f4a2c";
    mc.fillRect(4, 9, 20, 6);
    mc.fillStyle = "#6f9152";
    mc.fillRect(7, 5, 14, 8);
    mc.fillStyle = "#9fbe69";
    mc.fillRect(9, 3, 4, 3);
    mc.fillRect(17, 4, 5, 3);
    mc.fillStyle = "#1c2719";
    mc.fillRect(10, 9, 3, 3);
    mc.fillRect(18, 9, 3, 3);
    mc.fillStyle = "#7a4f29";
    mc.fillRect(5, 14, 5, 2);
    mc.fillRect(18, 14, 5, 2);
    mossling.refresh();

    const crawler = freshCanvasTexture("crawler", 30, 18);
    const cc = crawler.getContext();
    cc.clearRect(0, 0, 30, 18);
    cc.fillStyle = "#563f67";
    cc.fillRect(4, 6, 22, 9);
    cc.fillStyle = "#7c5a91";
    cc.fillRect(8, 3, 14, 8);
    cc.fillStyle = "#e9ddc7";
    cc.fillRect(10, 7, 3, 3);
    cc.fillRect(19, 7, 3, 3);
    cc.fillStyle = "#3a2a47";
    cc.fillRect(5, 14, 4, 3);
    cc.fillRect(13, 14, 4, 3);
    cc.fillRect(21, 14, 4, 3);
    crawler.refresh();

    const bat = freshCanvasTexture("bat", 26, 20);
    const bc = bat.getContext();
    bc.clearRect(0, 0, 26, 20);
    bc.fillStyle = "#4a3a5e";
    bc.beginPath();
    bc.moveTo(1, 4);
    bc.lineTo(10, 9);
    bc.lineTo(3, 13);
    bc.closePath();
    bc.fill();
    bc.beginPath();
    bc.moveTo(25, 4);
    bc.lineTo(16, 9);
    bc.lineTo(23, 13);
    bc.closePath();
    bc.fill();
    bc.fillStyle = "#6d5586";
    bc.fillRect(9, 5, 8, 10);
    bc.fillStyle = "#f0c7c7";
    bc.fillRect(10, 8, 2, 2);
    bc.fillRect(14, 8, 2, 2);
    bat.refresh();

    const slime = freshCanvasTexture("slime", 28, 20);
    const slc = slime.getContext();
    slc.clearRect(0, 0, 28, 20);
    slc.fillStyle = "#4f8f5f";
    slc.fillRect(4, 8, 20, 10);
    slc.fillRect(7, 4, 14, 6);
    slc.fillStyle = "#79bd87";
    slc.fillRect(8, 6, 6, 4);
    slc.fillStyle = "#1f3a26";
    slc.fillRect(10, 10, 3, 3);
    slc.fillRect(17, 10, 3, 3);
    slime.refresh();

    const golem = freshCanvasTexture("golem", 32, 36);
    const gc = golem.getContext();
    gc.clearRect(0, 0, 32, 36);
    gc.fillStyle = "#5e6168";
    gc.fillRect(5, 8, 22, 26);
    gc.fillStyle = "#494c52";
    gc.fillRect(5, 8, 22, 5);
    gc.fillRect(2, 14, 6, 14);
    gc.fillRect(24, 14, 6, 14);
    gc.fillStyle = "#74777e";
    gc.fillRect(8, 3, 16, 8);
    gc.fillStyle = "#f0a23e";
    gc.fillRect(11, 6, 4, 3);
    gc.fillRect(18, 6, 4, 3);
    gc.fillStyle = "#f0c75e";
    gc.fillRect(13, 19, 6, 6);
    gc.fillStyle = "#3a3d42";
    gc.fillRect(6, 30, 8, 4);
    gc.fillRect(18, 30, 8, 4);
    golem.refresh();

    const brood = freshCanvasTexture("broodmother", 56, 42);
    const br = brood.getContext();
    br.clearRect(0, 0, 56, 42);
    br.fillStyle = "#33223d";
    br.fillRect(5, 24, 9, 5);
    br.fillRect(15, 27, 8, 5);
    br.fillRect(33, 27, 8, 5);
    br.fillRect(43, 24, 9, 5);
    br.fillStyle = "#5e3f78";
    br.fillRect(8, 14, 40, 18);
    br.fillRect(14, 9, 28, 10);
    br.fillStyle = "#7f5aa0";
    br.fillRect(18, 6, 20, 8);
    br.fillStyle = "#e9ddc7";
    br.fillRect(19, 12, 4, 4);
    br.fillRect(32, 12, 4, 4);
    br.fillStyle = "#f0c75e";
    br.fillRect(25, 19, 6, 5);
    br.fillStyle = "#1f1627";
    br.fillRect(7, 31, 8, 4);
    br.fillRect(20, 33, 7, 4);
    br.fillRect(30, 33, 7, 4);
    br.fillRect(42, 31, 8, 4);
    brood.refresh();

    const warden = freshCanvasTexture("warden", 56, 64);
    const wc = warden.getContext();
    wc.clearRect(0, 0, 56, 64);
    wc.fillStyle = "#24152d";
    wc.fillRect(13, 16, 30, 38);
    wc.fillStyle = "#3c2850";
    wc.fillRect(9, 24, 9, 24);
    wc.fillRect(38, 24, 9, 24);
    wc.fillStyle = "#5c4278";
    wc.fillRect(16, 7, 24, 16);
    wc.fillStyle = "#1b1024";
    wc.fillRect(18, 3, 20, 7);
    wc.fillStyle = "#ff7a2e";
    wc.fillRect(20, 13, 5, 4);
    wc.fillRect(31, 13, 5, 4);
    wc.fillStyle = "#ffd56a";
    wc.fillRect(23, 30, 10, 9);
    wc.fillStyle = "#6a4ba3";
    wc.fillRect(18, 42, 20, 6);
    wc.fillStyle = "#17101d";
    wc.fillRect(14, 54, 10, 5);
    wc.fillRect(32, 54, 10, 5);
    warden.refresh();

    const watcher = freshCanvasTexture("watcher", 34, 52);
    const sh = watcher.getContext();
    sh.clearRect(0, 0, 34, 52);
    sh.fillStyle = "rgba(0,0,0,0.28)";
    sh.fillRect(7, 47, 20, 3);
    sh.fillStyle = "#05060b";
    sh.fillRect(12, 13, 10, 31);
    sh.fillRect(9, 22, 4, 16);
    sh.fillRect(21, 22, 4, 16);
    sh.fillStyle = "#111322";
    sh.fillRect(10, 8, 14, 12);
    sh.fillRect(13, 4, 8, 6);
    sh.fillStyle = "#2a2440";
    sh.fillRect(13, 18, 8, 23);
    sh.fillStyle = "#d8b6ff";
    sh.fillRect(13, 12, 2, 2);
    sh.fillRect(19, 12, 2, 2);
    sh.fillStyle = "rgba(216,182,255,0.24)";
    sh.fillRect(8, 20, 18, 2);
    watcher.refresh();

    const watcherTrace = freshCanvasTexture("watcherTrace", 24, 20);
    const wt = watcherTrace.getContext();
    wt.clearRect(0, 0, 24, 20);
    wt.fillStyle = "rgba(0,0,0,0.22)";
    wt.fillRect(4, 16, 16, 2);
    wt.fillStyle = "rgba(216,182,255,0.3)";
    wt.fillRect(10, 5, 4, 10);
    wt.fillRect(7, 10, 10, 2);
    wt.fillStyle = "#d8b6ff";
    wt.fillRect(11, 3, 2, 2);
    wt.fillRect(9, 8, 2, 2);
    wt.fillRect(14, 12, 2, 2);
    wt.fillStyle = "rgba(97,224,208,0.48)";
    wt.fillRect(6, 15, 12, 1);
    watcherTrace.refresh();

    // ---- Particles + light mask -------------------------------------------
    const spark = freshCanvasTexture("spark", 7, 7);
    const sc = spark.getContext();
    sc.clearRect(0, 0, 7, 7);
    sc.fillStyle = "#ffffff";
    sc.fillRect(2, 0, 3, 7);
    sc.fillRect(0, 2, 7, 3);
    spark.refresh();

    const dust = freshCanvasTexture("dust", 8, 8);
    const dc = dust.getContext();
    dc.clearRect(0, 0, 8, 8);
    const dg = dc.createRadialGradient(4, 4, 0, 4, 4, 4);
    dg.addColorStop(0, "rgba(225,212,185,0.9)");
    dg.addColorStop(1, "rgba(225,212,185,0)");
    dc.fillStyle = dg;
    dc.fillRect(0, 0, 8, 8);
    dust.refresh();

    const mobWake = freshCanvasTexture("mobWake", 48, 28);
    const mw = mobWake.getContext();
    mw.clearRect(0, 0, 48, 28);
    mw.fillStyle = "rgba(0,0,0,0.48)";
    mw.fillRect(7, 21, 34, 4);
    mw.fillStyle = "rgba(216,182,255,0.34)";
    mw.fillRect(8, 17, 31, 2);
    mw.fillRect(13, 13, 21, 2);
    mw.fillRect(18, 9, 12, 2);
    mw.fillStyle = "#5a3d78";
    mw.fillRect(11, 18, 7, 3);
    mw.fillRect(27, 18, 8, 3);
    mw.fillStyle = "#8d6db3";
    mw.fillRect(15, 15, 4, 2);
    mw.fillRect(30, 14, 4, 2);
    mw.fillStyle = "#d8b6ff";
    mw.fillRect(17, 7, 3, 3);
    mw.fillRect(30, 8, 3, 3);
    mw.fillStyle = "rgba(255,213,106,0.58)";
    mw.fillRect(22, 19, 7, 1);
    mobWake.refresh();

    const orb = freshCanvasTexture("lightOrb", 256, 256);
    const oc = orb.getContext();
    oc.clearRect(0, 0, 256, 256);
    const og = oc.createRadialGradient(128, 128, 0, 128, 128, 128);
    og.addColorStop(0, "rgba(255,255,255,1)");
    og.addColorStop(0.45, "rgba(255,255,255,0.85)");
    og.addColorStop(0.75, "rgba(255,255,255,0.35)");
    og.addColorStop(1, "rgba(255,255,255,0)");
    oc.fillStyle = og;
    oc.fillRect(0, 0, 256, 256);
    orb.refresh();
  }

  ML.makeTextures = makeTextures;
})();
