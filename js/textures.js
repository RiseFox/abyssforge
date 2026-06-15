// AbyssForge v2 - canvas-first textures with audited external candidates.
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

    // Deterministic per-tile noise so the look is stable between boots.
    let _seed = 0x9e3779b9 >>> 0;
    const rnd = () => {
      _seed = (_seed + 0x6D2B79F5) >>> 0;
      let t = _seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // A rocky matrix: solid fill plus soft blotches (not uniform specks).
    const rock = (id, base, shades, blotches = 11) => {
      const x0 = id * TILE;
      ctx.fillStyle = base;
      ctx.fillRect(x0, 0, TILE, TILE);
      for (let i = 0; i < blotches; i += 1) {
        ctx.fillStyle = shades[Math.floor(rnd() * shades.length)];
        const w = 3 + Math.floor(rnd() * 6);
        const h = 2 + Math.floor(rnd() * 5);
        ctx.fillRect(x0 + Math.floor(rnd() * (TILE - w)), Math.floor(rnd() * (TILE - h)), w, h);
      }
    };

    // Carve a 3D bevel: lit top/left edge, shadowed bottom/right edge.
    // sides="all" bevels every edge; "skipTop" leaves the top clean (grass).
    const bevel = (id, light = "rgba(255,255,255,0.15)", dark = "rgba(0,0,0,0.36)", sides = "all") => {
      const x0 = id * TILE;
      ctx.fillStyle = light;
      if (sides !== "skipTop") ctx.fillRect(x0, 0, TILE, 2);
      ctx.fillRect(x0, 0, 2, TILE);
      ctx.fillStyle = dark;
      ctx.fillRect(x0, TILE - 3, TILE, 3);
      ctx.fillRect(x0 + TILE - 2, 0, 2, TILE);
    };

    // Scatter mineral inclusions with a highlight + shadow so they read as 3D.
    // shape: "lump" (nuggets), "shard" (faceted gems), "streak" (metal veins).
    const nuggets = (id, count, opts) => {
      const { core, light, dark, size = 4, shape = "lump", spark = false } = opts;
      const x0 = id * TILE;
      for (let i = 0; i < count; i += 1) {
        const s = size + Math.floor(rnd() * 2);
        const px = x0 + 3 + Math.floor(rnd() * Math.max(1, TILE - s - 6));
        const py = 3 + Math.floor(rnd() * Math.max(1, TILE - s - 6));
        if (shape === "shard") {
          ctx.fillStyle = dark;
          ctx.fillRect(px, py, s, s);
          ctx.fillStyle = core;
          ctx.fillRect(px + 1, py, s - 2, s);
          ctx.fillRect(px, py + 1, s, s - 2);
          ctx.fillStyle = light;
          ctx.fillRect(px + 1, py + 1, 2, 2);
        } else if (shape === "streak") {
          ctx.fillStyle = dark;
          ctx.fillRect(px, py + 1, s + 3, 2);
          ctx.fillStyle = core;
          ctx.fillRect(px, py, s + 3, 2);
          ctx.fillStyle = light;
          ctx.fillRect(px, py, 2, 1);
        } else {
          ctx.fillStyle = dark;
          ctx.fillRect(px, py, s, s);
          ctx.fillStyle = core;
          ctx.fillRect(px, py, s - 1, s - 1);
          ctx.fillStyle = light;
          ctx.fillRect(px, py, 2, 1);
          ctx.fillRect(px, py, 1, 2);
        }
        if (spark) {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.fillRect(px + s - 1, py + s - 2, 1, 1);
        }
      }
    };

    // --- Dirt + grass cap ---
    rock(Tile.DIRT, "#7a5230", ["#6a4527", "#895d38", "#5a3a22", "#9a7048"], 13);
    nuggets(Tile.DIRT, 3, { core: "#9a7048", light: "#b88a58", dark: "#553620", size: 3, shape: "lump" });
    bevel(Tile.DIRT);

    const grassX = Tile.GRASS * TILE;
    rock(Tile.GRASS, "#7a5230", ["#6a4527", "#895d38", "#5a3a22"], 9);
    ctx.fillStyle = "#54863e";
    ctx.fillRect(grassX, 0, TILE, 9);
    ctx.fillStyle = "#69a64c";
    ctx.fillRect(grassX, 0, TILE, 4);
    ctx.fillStyle = "#7cbb59";
    for (let i = 0; i < TILE; i += 4) ctx.fillRect(grassX + i, 8, 2, 2 + Math.floor(rnd() * 4));
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(grassX, 9, TILE, 1);
    bevel(Tile.GRASS, "rgba(255,255,255,0.12)", "rgba(0,0,0,0.34)", "skipTop");

    // --- Stone family ---
    rock(Tile.STONE, "#7e817b", ["#6e716b", "#8d9089", "#62655f"], 13);
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Tile.STONE * TILE + 8, 6);
    ctx.lineTo(Tile.STONE * TILE + 20, 18);
    ctx.stroke();
    bevel(Tile.STONE);

    rock(Tile.DEEP, "#4a4d52", ["#3f4146", "#565a60", "#383b40"], 12);
    bevel(Tile.DEEP, "rgba(255,255,255,0.10)", "rgba(0,0,0,0.42)");

    rock(Tile.BEDROCK, "#26262a", ["#1c1c20", "#323238", "#161619"], 12);
    bevel(Tile.BEDROCK, "rgba(255,255,255,0.06)", "rgba(0,0,0,0.5)");

    // --- Ores: stone matrix + identity inclusions ---
    rock(Tile.COAL, "#63655f", ["#54564f", "#70726b"], 8);
    nuggets(Tile.COAL, 7, { core: "#1d1e20", light: "#45474a", dark: "#0c0c0d", size: 4, shape: "lump" });
    bevel(Tile.COAL);

    rock(Tile.COPPER, "#6f6a5e", ["#5f5b50", "#7d7868"], 8);
    nuggets(Tile.COPPER, 6, { core: "#cf7f3a", light: "#f2ab5e", dark: "#874826", size: 4, shape: "lump" });
    bevel(Tile.COPPER);

    rock(Tile.IRON, "#6f716b", ["#5f615c", "#7e807a"], 8);
    nuggets(Tile.IRON, 6, { core: "#cbc6b8", light: "#f1ede1", dark: "#7c7a70", size: 4, shape: "streak" });
    bevel(Tile.IRON);

    rock(Tile.CRYSTAL, "#2f4f55", ["#284449", "#365d63"], 9);
    nuggets(Tile.CRYSTAL, 6, { core: "#76ecdb", light: "#cafff8", dark: "#2c7b74", size: 5, shape: "shard", spark: true });
    bevel(Tile.CRYSTAL, "rgba(180,255,248,0.13)", "rgba(0,0,0,0.4)");

    // --- Wood + leaves ---
    const woodX = Tile.WOOD * TILE;
    ctx.fillStyle = "#7a4d24";
    ctx.fillRect(woodX, 0, TILE, TILE);
    for (let i = 0; i < TILE; i += 2) {
      ctx.fillStyle = i % 4 === 0 ? "#895a2c" : "#693f1f";
      ctx.fillRect(woodX + i, 0, 2, TILE);
    }
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.fillRect(woodX + 10, 0, 2, TILE);
    ctx.fillRect(woodX + 22, 0, 2, TILE);
    ctx.fillStyle = "#5a3617";
    ctx.fillRect(woodX + 13, 12, 5, 4);
    ctx.fillStyle = "#8a5a2c";
    ctx.fillRect(woodX + 14, 13, 3, 2);
    bevel(Tile.WOOD, "rgba(255,255,255,0.10)", "rgba(0,0,0,0.3)");

    rock(Tile.LEAVES, "#3f6a36", ["#356030", "#4d7d40", "#2c5228"], 16);
    nuggets(Tile.LEAVES, 5, { core: "#6fa84f", light: "#8cc163", dark: "#2c5228", size: 4, shape: "lump" });

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

    // Gold: bright nuggets with a sparkle in a warm stone matrix.
    rock(Tile.GOLD, "#6b6354", ["#5b5447", "#7a7160"], 8);
    nuggets(Tile.GOLD, 5, { core: "#f3c34a", light: "#fff0a6", dark: "#9c6f1e", size: 4, shape: "lump", spark: true });
    bevel(Tile.GOLD, "rgba(255,240,170,0.13)", "rgba(0,0,0,0.38)");

    // Obsidian: glassy violet-black with conchoidal sheen.
    rock(Tile.OBSIDIAN, "#16101f", ["#0f0a17", "#251a36"], 8);
    const obsX = Tile.OBSIDIAN * TILE;
    ctx.strokeStyle = "rgba(155,110,225,0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obsX + 5, 26);
    ctx.lineTo(obsX + 14, 9);
    ctx.moveTo(obsX + 17, 27);
    ctx.lineTo(obsX + 26, 12);
    ctx.stroke();
    nuggets(Tile.OBSIDIAN, 3, { core: "#3f2a63", light: "#9b7ee0", dark: "#0c0814", size: 5, shape: "shard" });
    bevel(Tile.OBSIDIAN, "rgba(170,140,255,0.12)", "rgba(0,0,0,0.5)");

    // Amber: glossy resin blobs trapped in dark earth.
    rock(Tile.AMBER, "#5b4528", ["#4d3a21", "#6b5331", "#3f2f1a"], 9);
    nuggets(Tile.AMBER, 4, { core: "#e3a948", light: "#f8d488", dark: "#8a5a1e", size: 6, shape: "lump", spark: true });
    bevel(Tile.AMBER, "rgba(255,220,140,0.12)", "rgba(0,0,0,0.36)");

    // Quartz: milky faceted prisms.
    rock(Tile.QUARTZ, "#5e6b6a", ["#52605f", "#6c7a78"], 8);
    nuggets(Tile.QUARTZ, 5, { core: "#e9fffb", light: "#ffffff", dark: "#9fbab6", size: 5, shape: "shard", spark: true });
    bevel(Tile.QUARTZ);

    // Ember shale: scorched rock veined with glowing heat.
    rock(Tile.EMBER, "#382826", ["#2c1f1d", "#46302c"], 11);
    const emberX = Tile.EMBER * TILE;
    ctx.strokeStyle = "rgba(255,120,48,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(emberX + 6, 24);
    ctx.lineTo(emberX + 15, 12);
    ctx.lineTo(emberX + 24, 20);
    ctx.stroke();
    nuggets(Tile.EMBER, 5, { core: "#ff7a30", light: "#ffd062", dark: "#7a2f12", size: 4, shape: "lump", spark: true });
    bevel(Tile.EMBER, "rgba(255,150,80,0.13)", "rgba(0,0,0,0.45)");

    // Voidglass: near-black with violet fractures that catch the light.
    rock(Tile.VOIDGLASS, "#160f24", ["#100a1b", "#221733"], 8);
    const voidX = Tile.VOIDGLASS * TILE;
    ctx.strokeStyle = "rgba(150,135,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(voidX + 5, 8);
    ctx.lineTo(voidX + 27, 24);
    ctx.moveTo(voidX + 18, 5);
    ctx.lineTo(voidX + 9, 28);
    ctx.stroke();
    nuggets(Tile.VOIDGLASS, 3, { core: "#8b78ff", light: "#cabdff", dark: "#0e0a18", size: 5, shape: "shard", spark: true });
    bevel(Tile.VOIDGLASS, "rgba(160,145,255,0.12)", "rgba(0,0,0,0.5)");

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
    ML.ExternalAssets?.drawRawInto?.(scene, ctx, "chestClosed", chestX, 0, TILE, TILE, {
      pad: 4,
      scale: 1.18,
      alignY: 0.66,
      shadow: true
    });

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

    const drawLightPropTextures = () => {
      const propSize = 32;
      const makeProp = (key) => {
        const texture = freshCanvasTexture(key, propSize, propSize);
        const propCtx = texture.getContext();
        propCtx.clearRect(0, 0, propSize, propSize);
        return [texture, propCtx];
      };

      for (let frame = 0; frame < 3; frame += 1) {
        const lift = frame === 1 ? 1 : frame === 2 ? -1 : 0;
        let texture;
        let propCtx;

        [texture, propCtx] = makeProp(`light-campfire-${frame}`);
        propCtx.fillStyle = "rgba(0,0,0,0.28)";
        propCtx.fillRect(4, 27, 24, 4);
        propCtx.fillStyle = "#4a2a16";
        propCtx.fillRect(7, 24, 19, 4);
        propCtx.fillStyle = "#8d5829";
        propCtx.fillRect(5, 22, 21, 4);
        propCtx.fillRect(9, 26, 17, 2);
        propCtx.fillStyle = "#2c1a10";
        propCtx.fillRect(8, 25, 16, 3);
        propCtx.fillStyle = "#9d3a24";
        propCtx.fillRect(14, 17 + lift, 4, 7);
        propCtx.fillStyle = "#f08a3e";
        propCtx.fillRect(10, 15 - lift, 5, 9);
        propCtx.fillRect(18, 16 + lift, 5, 8);
        propCtx.fillStyle = "#ffdf78";
        propCtx.fillRect(14, 9 - lift, 5, 13);
        propCtx.fillStyle = "#fff1a8";
        propCtx.fillRect(15, 12 - lift, 3, 6);
        propCtx.fillStyle = "rgba(255,202,94,0.65)";
        propCtx.fillRect(8 + frame * 6, 7 + frame, 2, 2);
        texture.refresh();

        [texture, propCtx] = makeProp(`light-torch-${frame}`);
        propCtx.fillStyle = "rgba(0,0,0,0.22)";
        propCtx.fillRect(10, 30, 12, 2);
        propCtx.fillStyle = "#4d2d17";
        propCtx.fillRect(14, 14, 5, 17);
        propCtx.fillStyle = "#8c5a2d";
        propCtx.fillRect(13, 15, 7, 3);
        propCtx.fillRect(13, 22, 7, 3);
        propCtx.fillStyle = "#9d3a24";
        propCtx.fillRect(15, 9 + lift, 3, 7);
        propCtx.fillStyle = "#f37a42";
        propCtx.fillRect(12, 7 - lift, 8, 8);
        propCtx.fillStyle = "#f3ce62";
        propCtx.fillRect(13, 4 - lift, 6, 9);
        propCtx.fillStyle = "#fff1a8";
        propCtx.fillRect(15, 6 - lift, 3, 5);
        texture.refresh();

        [texture, propCtx] = makeProp(`light-glowcap-${frame}`);
        const pulse = frame === 1 ? 1 : 0;
        propCtx.fillStyle = "rgba(70,230,210,0.16)";
        propCtx.fillRect(6 - pulse, 14 - pulse, 20 + pulse * 2, 9 + pulse * 2);
        propCtx.fillStyle = "rgba(0,0,0,0.22)";
        propCtx.fillRect(10, 29, 13, 2);
        propCtx.fillStyle = "#c9c1aa";
        propCtx.fillRect(14, 17, 5, 13);
        propCtx.fillStyle = "#eee0c4";
        propCtx.fillRect(15, 17, 3, 11);
        propCtx.fillStyle = "#2ab9ad";
        propCtx.fillRect(6, 11 - pulse, 20, 8);
        propCtx.fillRect(9, 8 - pulse, 14, 4);
        propCtx.fillStyle = "#6ff7e9";
        propCtx.fillRect(9, 12 - pulse, 5, 3);
        propCtx.fillRect(19, 13 - pulse, 4, 3);
        propCtx.fillStyle = "#d7fff8";
        propCtx.fillRect(16, 10 - pulse, 2, 2);
        texture.refresh();
      }
    };
    drawLightPropTextures();

    const drawOrePropTextures = () => {
      const propSize = 32;
      const makeOre = (key) => {
        const texture = freshCanvasTexture(key, propSize, propSize);
        const propCtx = texture.getContext();
        propCtx.clearRect(0, 0, propSize, propSize);
        return [texture, propCtx];
      };
      const drawSpark = (propCtx, x, y, size = 2) => {
        propCtx.fillStyle = "rgba(255,255,255,0.92)";
        propCtx.fillRect(x, y, size, size);
        propCtx.fillStyle = "rgba(255,255,255,0.36)";
        propCtx.fillRect(x - 1, y, size + 2, 1);
        propCtx.fillRect(x, y - 1, 1, size + 2);
      };

      for (let frame = 0; frame < 3; frame += 1) {
        let texture;
        let propCtx;
        const offset = frame - 1;

        [texture, propCtx] = makeOre(`ore-glint-metal-${frame}`);
        propCtx.fillStyle = "rgba(255,246,202,0.16)";
        propCtx.fillRect(7 + offset, 8, 4, 2);
        propCtx.fillRect(18, 18 - offset, 5, 2);
        drawSpark(propCtx, 11 + frame * 3, 11 + offset, frame === 1 ? 3 : 2);
        propCtx.fillStyle = "rgba(255,214,128,0.42)";
        propCtx.fillRect(19 - offset, 21, 3, 1);
        texture.refresh();

        [texture, propCtx] = makeOre(`ore-glint-gem-${frame}`);
        propCtx.fillStyle = "rgba(210,255,250,0.22)";
        propCtx.fillRect(9, 7 + offset, 3, 9);
        propCtx.fillRect(18, 14 - offset, 5, 8);
        drawSpark(propCtx, 15 + offset * 2, 10, 2);
        drawSpark(propCtx, 21, 20 - frame, 2);
        texture.refresh();

        [texture, propCtx] = makeOre(`ore-glint-shadow-${frame}`);
        propCtx.fillStyle = "rgba(210,196,255,0.16)";
        propCtx.fillRect(8 + frame, 10, 3, 8);
        propCtx.fillRect(20 - frame, 18, 3, 6);
        propCtx.fillStyle = "rgba(255,255,255,0.2)";
        propCtx.fillRect(13 + offset, 13, 2, 2);
        propCtx.fillRect(23 - offset, 23, 2, 1);
        texture.refresh();
      }
    };
    drawOrePropTextures();

    // ---- Player sprite sheet: 8 frames of 28x36 ---------------------------
    const FRAME_W = 28;
    const FRAME_H = 36;
    const frames = ["idle0", "idle1", "walk0", "walk1", "walk2", "walk3", "jump", "fall"];
    const sheet = freshCanvasTexture("playerSheet", FRAME_W * frames.length, FRAME_H);
    const pc = sheet.getContext();
    pc.clearRect(0, 0, FRAME_W * frames.length, FRAME_H);

    // Faces right by default (scene flips with setFlipX).
    // bob shifts the upper body; legL/legR offset each boot (x, y).
    const drawMiner = (ox, { bob = 0, legL = [0, 0], legR = [0, 0] } = {}) => {
      const b = bob;

      // Trousers + boots (behind the torso).
      pc.fillStyle = "#2b3d4d";
      pc.fillRect(ox + 7, 27, 6, 6);
      pc.fillRect(ox + 15, 27, 6, 6);
      pc.fillStyle = "#26333d";
      pc.fillRect(ox + 5 + legL[0], 31 + legL[1], 8, 4 - Math.min(0, legL[1]));
      pc.fillRect(ox + 15 + legR[0], 31 + legR[1], 8, 4 - Math.min(0, legR[1]));
      pc.fillStyle = "#3d525f"; // boot toe shine
      pc.fillRect(ox + 11 + legL[0], 31 + legL[1], 2, 1);
      pc.fillRect(ox + 21 + legR[0], 31 + legR[1], 2, 1);

      // Jacket torso with side shading.
      pc.fillStyle = "#3a5068";
      pc.fillRect(ox + 6, 19 + b, 16, 10 - b);
      pc.fillStyle = "#48637f"; // lit front (right)
      pc.fillRect(ox + 15, 19 + b, 7, 10 - b);
      pc.fillStyle = "#2c4051"; // shaded back (left)
      pc.fillRect(ox + 6, 19 + b, 3, 10 - b);
      pc.fillStyle = "#5a7c9e"; // collar
      pc.fillRect(ox + 8, 19 + b, 12, 2);

      // Tool belt with buckle.
      pc.fillStyle = "#5e3f22";
      pc.fillRect(ox + 6, 26, 16, 3);
      pc.fillStyle = "#7a5526";
      pc.fillRect(ox + 6, 26, 16, 1);
      pc.fillStyle = "#d8b25c";
      pc.fillRect(ox + 12, 26, 4, 3);

      // Face with a single forward eye.
      pc.fillStyle = "#c78a4b";
      pc.fillRect(ox + 8, 10 + b, 13, 9);
      pc.fillStyle = "#a9713a"; // jaw + back-of-head shadow
      pc.fillRect(ox + 8, 10 + b, 3, 9);
      pc.fillRect(ox + 8, 17 + b, 13, 2);
      pc.fillStyle = "rgba(0,0,0,0.22)"; // helmet brow shadow
      pc.fillRect(ox + 8, 10 + b, 13, 1);
      pc.fillStyle = "#f4ecd8";
      pc.fillRect(ox + 16, 12 + b, 3, 3);
      pc.fillStyle = "#2a2622";
      pc.fillRect(ox + 17, 12 + b, 2, 2);

      // Hard hat: dome, highlight, shade, brim.
      pc.fillStyle = "#efbe5e";
      pc.fillRect(ox + 6, 5 + b, 16, 5);
      pc.fillStyle = "#f6d484";
      pc.fillRect(ox + 8, 5 + b, 8, 2);
      pc.fillStyle = "#cf9b40";
      pc.fillRect(ox + 6, 8 + b, 16, 2);
      pc.fillStyle = "#7a5526";
      pc.fillRect(ox + 5, 9 + b, 18, 2);

      // Headlamp lens on the brim, glowing forward.
      pc.fillStyle = "#3a3026";
      pc.fillRect(ox + 19, 7 + b, 5, 4);
      pc.fillStyle = "#fff4c0";
      pc.fillRect(ox + 20, 8 + b, 3, 2);
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
      { head: "#8df2e0", dark: "#2f8a83", edge: "#d8fff8", spot: "#40b6b2", glow: "rgba(150,255,244,0.95)" }, // crystal
      { head: "#ffd76a", dark: "#a96f23", edge: "#fff2b4", spot: "#ff9b44", glow: "rgba(255,228,140,0.95)" } // starforged
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
      // Diagonal metallic shine across the head.
      drawBlock(ox + 10, 8, 8, 1, style.edge);
      drawBlock(ox + 12, 9, 4, 1, "rgba(255,255,255,0.55)");
      // High-tier heads sparkle and cast a faint glow.
      if (style.glow) {
        drawBlock(ox + 6, 6, 2, 2, style.glow);
        drawBlock(ox + 25, 9, 2, 2, style.glow);
        drawBlock(ox + 20, 5, 1, 1, "rgba(255,255,255,0.95)");
        drawBlock(ox + 9, 12, 1, 1, "rgba(255,255,255,0.8)");
      }
    });
    pickHeads.forEach((_, i) => picks.add(`pick${i}`, 0, i * PICK_W, 0, PICK_W, PICK_W));
    picks.refresh();

    // Export each pick frame as a data URL so the HUD can show the real sprite
    // (tier-correct) instead of a hand-drawn CSS pickaxe.
    ML.pickIconUrls = pickHeads.map((_, i) => {
      const fc = document.createElement("canvas");
      fc.width = PICK_W;
      fc.height = PICK_W;
      fc.getContext("2d").drawImage(pk.canvas, i * PICK_W, 0, PICK_W, PICK_W, 0, 0, PICK_W, PICK_W);
      return fc.toDataURL();
    });

    // ---- Enemies ----------------------------------------------------------
    const mossling = freshCanvasTexture("mossling", 28, 18);
    const mc = mossling.getContext();
    mc.clearRect(0, 0, 28, 18);
    mc.fillStyle = "rgba(0,0,0,0.25)";
    mc.fillRect(5, 16, 18, 2);
    mc.fillStyle = "#3c6b39"; // legs
    mc.fillRect(6, 13, 4, 4);
    mc.fillRect(18, 13, 4, 4);
    mc.fillStyle = "#3c6b39"; // body base
    mc.fillRect(5, 8, 18, 7);
    mc.fillStyle = "#6f9152"; // upper body
    mc.fillRect(6, 5, 16, 8);
    mc.fillStyle = "#9fbe69"; // top highlight
    mc.fillRect(8, 4, 12, 3);
    mc.fillStyle = "#2f4a2c"; // belly shade
    mc.fillRect(6, 12, 16, 2);
    mc.fillStyle = "#b7d97e"; // moss tufts
    mc.fillRect(9, 3, 2, 2);
    mc.fillRect(15, 3, 2, 2);
    mc.fillStyle = "#f4ecd8"; // eyes
    mc.fillRect(9, 7, 4, 4);
    mc.fillRect(16, 7, 4, 4);
    mc.fillStyle = "#1c2719";
    mc.fillRect(11, 8, 2, 2);
    mc.fillRect(18, 8, 2, 2);
    mc.fillStyle = "#23351f"; // mouth
    mc.fillRect(11, 12, 7, 1);
    mossling.refresh();

    const crawler = freshCanvasTexture("crawler", 30, 18);
    const cc = crawler.getContext();
    cc.clearRect(0, 0, 30, 18);
    cc.fillStyle = "rgba(0,0,0,0.25)";
    cc.fillRect(5, 16, 20, 2);
    cc.fillStyle = "#3a2a47"; // jointed legs
    cc.fillRect(5, 13, 3, 4);
    cc.fillRect(13, 14, 3, 3);
    cc.fillRect(22, 13, 3, 4);
    cc.fillStyle = "#4a3458"; // carapace base
    cc.fillRect(4, 7, 22, 8);
    cc.fillStyle = "#6b4d82"; // carapace
    cc.fillRect(7, 4, 16, 8);
    cc.fillStyle = "#8a68a3"; // ridge highlight
    cc.fillRect(9, 3, 12, 2);
    cc.fillStyle = "#3a2a47"; // segment lines
    cc.fillRect(13, 4, 1, 10);
    cc.fillRect(18, 5, 1, 9);
    cc.fillStyle = "#2a1d36"; // mandibles
    cc.fillRect(2, 9, 4, 2);
    cc.fillRect(24, 9, 4, 2);
    cc.fillStyle = "#ff9b6a"; // glowing eyes
    cc.fillRect(10, 7, 3, 3);
    cc.fillRect(18, 7, 3, 3);
    cc.fillStyle = "#fff0d8";
    cc.fillRect(11, 7, 1, 1);
    cc.fillRect(19, 7, 1, 1);
    crawler.refresh();

    const bat = freshCanvasTexture("bat", 26, 20);
    const bc = bat.getContext();
    bc.clearRect(0, 0, 26, 20);
    bc.fillStyle = "#3a2d4d"; // wing membrane
    bc.beginPath();
    bc.moveTo(0, 3);
    bc.lineTo(11, 10);
    bc.lineTo(2, 15);
    bc.closePath();
    bc.fill();
    bc.beginPath();
    bc.moveTo(26, 3);
    bc.lineTo(15, 10);
    bc.lineTo(24, 15);
    bc.closePath();
    bc.fill();
    bc.strokeStyle = "#5a4775"; // wing bones
    bc.lineWidth = 1;
    bc.beginPath();
    bc.moveTo(3, 5);
    bc.lineTo(9, 10);
    bc.moveTo(23, 5);
    bc.lineTo(17, 10);
    bc.stroke();
    bc.fillStyle = "#6d5586"; // body
    bc.fillRect(9, 5, 8, 11);
    bc.fillStyle = "#5a4775"; // belly shade
    bc.fillRect(9, 12, 8, 4);
    bc.fillStyle = "#4a3a5e"; // ears
    bc.fillRect(9, 3, 2, 3);
    bc.fillRect(15, 3, 2, 3);
    bc.fillStyle = "#ff9b6a"; // glowing eyes
    bc.fillRect(10, 8, 2, 2);
    bc.fillRect(14, 8, 2, 2);
    bc.fillStyle = "#f0e8d8"; // fangs
    bc.fillRect(11, 14, 1, 2);
    bc.fillRect(14, 14, 1, 2);
    bat.refresh();

    const slime = freshCanvasTexture("slime", 28, 20);
    const slc = slime.getContext();
    slc.clearRect(0, 0, 28, 20);
    slc.fillStyle = "rgba(0,0,0,0.22)";
    slc.fillRect(5, 18, 18, 2);
    slc.fillStyle = "#3f7d4f"; // base
    slc.fillRect(4, 9, 20, 9);
    slc.fillStyle = "#4f8f5f"; // mid
    slc.fillRect(5, 6, 18, 10);
    slc.fillRect(8, 4, 12, 4);
    slc.fillStyle = "#8fd89b"; // gloss
    slc.fillRect(8, 6, 5, 3);
    slc.fillStyle = "rgba(255,255,255,0.5)";
    slc.fillRect(9, 6, 2, 2);
    slc.fillStyle = "#2f6a3e"; // nucleus
    slc.fillRect(12, 12, 5, 4);
    slc.fillStyle = "#f4ecd8"; // eyes
    slc.fillRect(9, 10, 4, 4);
    slc.fillRect(16, 10, 4, 4);
    slc.fillStyle = "#1f3a26";
    slc.fillRect(11, 11, 2, 2);
    slc.fillRect(18, 11, 2, 2);
    slc.fillStyle = "#4f8f5f"; // drips
    slc.fillRect(7, 17, 3, 2);
    slc.fillRect(18, 17, 3, 2);
    slime.refresh();

    ML.ExternalAssets?.makeRuntimeTextures?.(scene);

    const golem = freshCanvasTexture("golem", 32, 36);
    const gc = golem.getContext();
    gc.clearRect(0, 0, 32, 36);
    gc.fillStyle = "rgba(0,0,0,0.25)";
    gc.fillRect(6, 33, 20, 3);
    gc.fillStyle = "#494c52"; // arms
    gc.fillRect(2, 14, 6, 16);
    gc.fillRect(24, 14, 6, 16);
    gc.fillStyle = "#5e6168"; // arm light
    gc.fillRect(2, 14, 3, 16);
    gc.fillRect(24, 14, 3, 16);
    gc.fillStyle = "#5e6168"; // body
    gc.fillRect(5, 8, 22, 26);
    gc.fillStyle = "#6e7178"; // top light
    gc.fillRect(5, 8, 22, 4);
    gc.fillStyle = "#494c52"; // bottom shade
    gc.fillRect(5, 28, 22, 6);
    gc.strokeStyle = "#3a3d42"; // cracks
    gc.lineWidth = 1;
    gc.beginPath();
    gc.moveTo(12, 12);
    gc.lineTo(16, 20);
    gc.lineTo(13, 28);
    gc.moveTo(22, 14);
    gc.lineTo(19, 22);
    gc.stroke();
    gc.fillStyle = "#74777e"; // head
    gc.fillRect(8, 3, 16, 8);
    gc.fillStyle = "#ffb347"; // glowing eyes
    gc.fillRect(11, 6, 4, 3);
    gc.fillRect(18, 6, 4, 3);
    gc.fillStyle = "#fff0c0";
    gc.fillRect(12, 6, 1, 1);
    gc.fillRect(19, 6, 1, 1);
    gc.fillStyle = "#f0c75e"; // core
    gc.fillRect(13, 18, 6, 7);
    gc.fillStyle = "#fff0b0";
    gc.fillRect(14, 19, 2, 2);
    gc.fillStyle = "#5a7c3a"; // moss
    gc.fillRect(7, 8, 4, 2);
    gc.fillRect(20, 9, 3, 2);
    gc.fillStyle = "#3a3d42"; // feet
    gc.fillRect(6, 30, 8, 4);
    gc.fillRect(18, 30, 8, 4);
    golem.refresh();

    const brood = freshCanvasTexture("broodmother", 56, 42);
    const br = brood.getContext();
    br.clearRect(0, 0, 56, 42);
    br.fillStyle = "rgba(0,0,0,0.25)";
    br.fillRect(10, 38, 36, 3);
    br.fillStyle = "#33223d"; // legs
    br.fillRect(5, 22, 9, 6);
    br.fillRect(15, 26, 8, 6);
    br.fillRect(33, 26, 8, 6);
    br.fillRect(43, 22, 9, 6);
    br.fillStyle = "#5e3f78"; // abdomen
    br.fillRect(8, 14, 40, 20);
    br.fillStyle = "#4a3160"; // belly shade
    br.fillRect(8, 28, 40, 6);
    br.fillStyle = "#3a2750"; // abdomen marking
    br.fillRect(24, 22, 8, 8);
    br.fillStyle = "#7f5aa0"; // thorax
    br.fillRect(14, 9, 28, 12);
    br.fillStyle = "#9a72bd"; // head light
    br.fillRect(18, 6, 20, 7);
    br.fillStyle = "#ff7a6a"; // eye cluster
    br.fillRect(19, 11, 4, 4);
    br.fillRect(32, 11, 4, 4);
    br.fillRect(26, 9, 4, 3);
    br.fillStyle = "#fff0d8";
    br.fillRect(20, 11, 1, 1);
    br.fillRect(33, 11, 1, 1);
    br.fillStyle = "#f0c75e"; // egg sac
    br.fillRect(25, 18, 6, 6);
    br.fillStyle = "#fff0b0";
    br.fillRect(26, 19, 2, 2);
    br.fillStyle = "#1f1627"; // feet
    br.fillRect(7, 31, 8, 5);
    br.fillRect(20, 33, 7, 4);
    br.fillRect(30, 33, 7, 4);
    br.fillRect(42, 31, 8, 5);
    brood.refresh();

    const warden = freshCanvasTexture("warden", 56, 64);
    const wc = warden.getContext();
    wc.clearRect(0, 0, 56, 64);
    wc.fillStyle = "rgba(0,0,0,0.3)";
    wc.fillRect(12, 60, 32, 3);
    wc.fillStyle = "#3c2850"; // arms
    wc.fillRect(9, 24, 9, 26);
    wc.fillRect(38, 24, 9, 26);
    wc.fillStyle = "#2a182f"; // robe body
    wc.fillRect(13, 16, 30, 42);
    wc.fillStyle = "#48315f"; // lit side
    wc.fillRect(31, 16, 12, 42);
    wc.fillStyle = "#17101d"; // tattered hem
    wc.fillRect(13, 55, 6, 5);
    wc.fillRect(23, 57, 6, 5);
    wc.fillRect(33, 55, 6, 5);
    wc.fillStyle = "#1b1024"; // hood
    wc.fillRect(16, 5, 24, 16);
    wc.fillStyle = "#5c4278"; // hood crown
    wc.fillRect(18, 3, 20, 6);
    wc.fillStyle = "#0c0712"; // face void
    wc.fillRect(19, 11, 18, 9);
    wc.fillStyle = "#ff7a2e"; // glowing eyes
    wc.fillRect(21, 13, 5, 4);
    wc.fillRect(30, 13, 5, 4);
    wc.fillStyle = "#ffd56a";
    wc.fillRect(22, 13, 1, 1);
    wc.fillRect(31, 13, 1, 1);
    wc.fillStyle = "#6a4ba3"; // chest core ring
    wc.fillRect(22, 30, 12, 10);
    wc.fillStyle = "#b98cff";
    wc.fillRect(24, 32, 8, 6);
    wc.fillStyle = "#ffffff";
    wc.fillRect(26, 33, 2, 2);
    wc.fillStyle = "#2a182f"; // belt
    wc.fillRect(18, 42, 20, 4);
    wc.fillStyle = "#17101d"; // boots
    wc.fillRect(16, 56, 9, 4);
    wc.fillRect(31, 56, 9, 4);
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

    // ---- Cave back wall (tileable parallax-free backdrop) -----------------
    // A dark masonry texture shown behind air pockets underground so caves
    // read with depth instead of flat black. Kept very dark to never compete
    // with foreground tiles.
    const caveWall = freshCanvasTexture("caveWall", 64, 64);
    const cw = caveWall.getContext();
    cw.fillStyle = "#211d15";
    cw.fillRect(0, 0, 64, 64);
    // soft blotches for an uneven quarried look
    for (let i = 0; i < 26; i += 1) {
      cw.fillStyle = rnd() < 0.5 ? "#28241a" : "#191610";
      const w = 6 + Math.floor(rnd() * 12);
      const h = 5 + Math.floor(rnd() * 10);
      cw.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), w, h);
    }
    // brick courses, offset every other row
    cw.fillStyle = "rgba(0,0,0,0.4)";
    for (let y = 0; y < 64; y += 16) cw.fillRect(0, y, 64, 2);
    for (let row = 0; row < 4; row += 1) {
      const y = row * 16;
      for (let x = row % 2 ? 16 : 0; x < 64; x += 32) cw.fillRect(x, y, 2, 16);
    }
    // faint top-edge highlight on each course for subtle relief
    cw.fillStyle = "rgba(255,236,200,0.06)";
    for (let y = 2; y < 64; y += 16) cw.fillRect(0, y, 64, 1);
    caveWall.refresh();

    // ---- Sky decor (surface backdrop, all baked once) ---------------------
    // Horizon glow: transparent at the top, white near the bottom, tinted per
    // phase at runtime (warm dawn/dusk, pale-blue day).
    const skyGlow = freshCanvasTexture("skyGlow", 8, 256);
    const sgc = skyGlow.getContext();
    const sgGrad = sgc.createLinearGradient(0, 0, 0, 256);
    sgGrad.addColorStop(0, "rgba(255,255,255,0)");
    sgGrad.addColorStop(0.5, "rgba(255,255,255,0.06)");
    sgGrad.addColorStop(1, "rgba(255,255,255,0.62)");
    sgc.fillStyle = sgGrad;
    sgc.fillRect(0, 0, 8, 256);
    skyGlow.refresh();

    // Star field (tileable).
    const stars = freshCanvasTexture("skyStars", 256, 256);
    const stc = stars.getContext();
    stc.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i += 1) {
      const sxp = Math.floor(rnd() * 256);
      const syp = Math.floor(rnd() * 256);
      const br = 0.4 + rnd() * 0.6;
      const sz = rnd() < 0.18 ? 2 : 1;
      stc.fillStyle = `rgba(255,255,255,${br.toFixed(2)})`;
      stc.fillRect(sxp, syp, sz, sz);
    }
    stars.refresh();

    // Sun: warm radial disc with a soft corona.
    const sun = freshCanvasTexture("skySun", 96, 96);
    const sunc = sun.getContext();
    const sunGrad = sunc.createRadialGradient(48, 48, 4, 48, 48, 48);
    sunGrad.addColorStop(0, "rgba(255,247,214,1)");
    sunGrad.addColorStop(0.32, "rgba(255,223,134,0.95)");
    sunGrad.addColorStop(0.66, "rgba(255,182,84,0.34)");
    sunGrad.addColorStop(1, "rgba(255,170,70,0)");
    sunc.fillStyle = sunGrad;
    sunc.fillRect(0, 0, 96, 96);
    sun.refresh();

    // Moon: pale disc with craters and a faint halo.
    const moon = freshCanvasTexture("skyMoon", 96, 96);
    const moonc = moon.getContext();
    const moonHalo = moonc.createRadialGradient(48, 48, 10, 48, 48, 48);
    moonHalo.addColorStop(0, "rgba(226,235,255,0.5)");
    moonHalo.addColorStop(0.5, "rgba(200,215,245,0.16)");
    moonHalo.addColorStop(1, "rgba(200,215,245,0)");
    moonc.fillStyle = moonHalo;
    moonc.fillRect(0, 0, 96, 96);
    moonc.fillStyle = "#dfe6f5";
    moonc.beginPath();
    moonc.arc(48, 48, 20, 0, Math.PI * 2);
    moonc.fill();
    moonc.fillStyle = "#c4cee0";
    [[42, 43, 4], [54, 52, 3], [50, 40, 2]].forEach(([cx, cy, cr]) => {
      moonc.beginPath();
      moonc.arc(cx, cy, cr, 0, Math.PI * 2);
      moonc.fill();
    });
    moon.refresh();

    // Cloud bands (tileable puffs on transparent), far + near.
    // Wide, sparse cloud band. Puffs live only in the upper rows so the band
    // (drawn as a fixed-height strip at the top of the sky) never repeats down
    // the screen. Texture is 1024 wide so tiles are spaced far apart.
    const CLOUD_W = 1024;
    const CLOUD_H = 200;
    const makeClouds = (key, clusters, puffAlpha) => {
      const tex = freshCanvasTexture(key, CLOUD_W, CLOUD_H);
      const c = tex.getContext();
      c.clearRect(0, 0, CLOUD_W, CLOUD_H);
      for (let i = 0; i < clusters; i += 1) {
        const cx = rnd() * CLOUD_W;
        const cy = 40 + rnd() * 70;
        const w = 60 + rnd() * 80;
        for (let b = 0; b < 5; b += 1) {
          const bx = cx + (rnd() - 0.5) * w;
          const by = cy + (rnd() - 0.5) * 20;
          const brad = 10 + rnd() * 16;
          const g = c.createRadialGradient(bx, by, 1, bx, by, brad);
          g.addColorStop(0, `rgba(255,255,255,${puffAlpha})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          c.fillStyle = g;
          c.fillRect(bx - brad, by - brad, brad * 2, brad * 2);
        }
      }
      tex.refresh();
    };
    makeClouds("skyCloudFar", 3, 0.3);
    makeClouds("skyCloudNear", 2, 0.42);

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
    // Spawn telegraph: something claws up through cracked ground. Drawn in
    // neutral greys with WHITE eyes so the runtime per-mob tint colours it; no
    // arcane purple, no additive glow (see queueMobMaterialize).
    mw.clearRect(0, 0, 48, 28);
    // Dark fracture / hole — near-black so it stays dark under any tint.
    mw.fillStyle = "rgba(0,0,0,0.5)";
    mw.fillRect(9, 22, 30, 4);
    mw.fillRect(13, 20, 22, 2);
    // Broken rubble lip around the break.
    mw.fillStyle = "#564f46";
    mw.fillRect(11, 19, 6, 3);
    mw.fillRect(20, 20, 7, 2);
    mw.fillRect(30, 19, 6, 3);
    mw.fillStyle = "#7b7367"; // top-lit edge of the rubble
    mw.fillRect(11, 19, 6, 1);
    mw.fillRect(30, 19, 6, 1);
    // Twin cracks splitting upward from the break.
    mw.fillStyle = "#1b1712";
    mw.fillRect(22, 13, 2, 8);
    mw.fillRect(27, 15, 1, 6);
    // Faint dust lifting off (low alpha, tints softly).
    mw.fillStyle = "rgba(235,228,214,0.22)";
    mw.fillRect(15, 11, 3, 1);
    mw.fillRect(31, 10, 2, 1);
    mw.fillRect(23, 7, 2, 1);
    // Twin eyes glinting in the dark — the focal tell (white -> takes the tint).
    mw.fillStyle = "rgba(255,255,255,0.32)"; // eye haze
    mw.fillRect(13, 12, 7, 5);
    mw.fillRect(28, 11, 7, 5);
    mw.fillStyle = "#ffffff"; // eye cores
    mw.fillRect(15, 13, 3, 3);
    mw.fillRect(30, 12, 3, 3);
    mobWake.refresh();

    // Camp keeper — a hooded guild figure who mans a lit campfire, giving the
    // camps a visible NPC presence (placed beside any fire by updateCampKeepers).
    const keeper = freshCanvasTexture("campKeeper", 18, 26);
    const kc = keeper.getContext();
    kc.clearRect(0, 0, 18, 26);
    kc.fillStyle = "rgba(0,0,0,0.32)"; // ground shadow
    kc.fillRect(3, 24, 12, 2);
    kc.fillStyle = "#46371f"; // cloak base
    kc.fillRect(5, 12, 8, 12);
    kc.fillStyle = "#5c4a2c"; // fire-lit side
    kc.fillRect(5, 12, 3, 12);
    kc.fillStyle = "#33281a"; // shadow side
    kc.fillRect(11, 12, 2, 12);
    kc.fillStyle = "#46371f"; // shoulders
    kc.fillRect(4, 11, 10, 2);
    kc.fillStyle = "#caa06a"; // face
    kc.fillRect(6, 7, 6, 5);
    kc.fillStyle = "#332617"; // hood crown
    kc.fillRect(5, 4, 8, 4);
    kc.fillStyle = "#2a2016"; // hood sides
    kc.fillRect(5, 6, 1, 6);
    kc.fillRect(12, 6, 1, 6);
    kc.fillStyle = "#241a10"; // eye shade
    kc.fillRect(8, 9, 3, 1);
    kc.fillStyle = "#ffd98a"; // eye glint
    kc.fillRect(9, 9, 1, 1);
    kc.fillStyle = "rgba(245,180,92,0.45)"; // warm rim from the fire
    kc.fillRect(5, 5, 1, 19);
    kc.fillStyle = "#2c2114"; // hem
    kc.fillRect(5, 23, 8, 1);
    keeper.refresh();

    // Ambient surface fauna (cosmetic): a bird silhouette for the daytime sky and
    // a little beetle for the ground. Driven by scene.updateCritters.
    const bird = freshCanvasTexture("critterBird", 12, 8);
    const bd = bird.getContext();
    bd.clearRect(0, 0, 12, 8);
    bd.fillStyle = "#2c2622";
    bd.fillRect(1, 3, 2, 1); bd.fillRect(3, 2, 2, 1); // left wing rising
    bd.fillRect(9, 3, 2, 1); bd.fillRect(7, 2, 2, 1); // right wing rising
    bd.fillRect(5, 3, 2, 2);                          // body
    bird.refresh();

    const beetle = freshCanvasTexture("critterBeetle", 9, 6);
    const be = beetle.getContext();
    be.clearRect(0, 0, 9, 6);
    be.fillStyle = "#15100b"; be.fillRect(1, 4, 7, 1); // legs/underside
    be.fillStyle = "#241c14"; be.fillRect(1, 2, 6, 2); // shell
    be.fillStyle = "#3a2c1d"; be.fillRect(1, 2, 6, 1); // shell sheen
    be.fillStyle = "#4a3a26"; be.fillRect(7, 2, 1, 2); // head
    beetle.refresh();

    const orb = freshCanvasTexture("lightOrb", 256, 256);
    const oc = orb.getContext();
    oc.clearRect(0, 0, 256, 256);
    const og = oc.createRadialGradient(128, 128, 0, 128, 128, 128);
    // Solid core out to ~60% for a clear lit pool, then a short falloff —
    // avoids the big washy gradient ring that bled over the back wall.
    og.addColorStop(0, "rgba(255,255,255,1)");
    og.addColorStop(0.6, "rgba(255,255,255,0.97)");
    og.addColorStop(0.82, "rgba(255,255,255,0.5)");
    og.addColorStop(1, "rgba(255,255,255,0)");
    oc.fillStyle = og;
    oc.fillRect(0, 0, 256, 256);
    orb.refresh();
  }

  ML.makeTextures = makeTextures;
})();
