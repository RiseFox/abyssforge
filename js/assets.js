// AbyssForge v2 - approved external asset bridge.
(() => {
  "use strict";
  const ML = window.ML;

  const ROOT = "assets/external/";

  const RAW_ASSETS = {
    chestClosed: "sparklinlabs/medieval-fantasy/items/wood-chest-close.png",
    chestOpen: "sparklinlabs/medieval-fantasy/items/wood-chest-open.png",
    rareChestClosed: "sparklinlabs/medieval-fantasy/items/gold-chest-close.png",
    rareChestOpen: "sparklinlabs/medieval-fantasy/items/gold-chest-open.png",
    crate: "sparklinlabs/medieval-fantasy/items/crate.png",
    barrel: "sparklinlabs/medieval-fantasy/items/barrel.png",
    coin: "sparklinlabs/medieval-fantasy/items/coin.png",
    gem1: "sparklinlabs/medieval-fantasy/items/gem-1.png",
    gem2: "sparklinlabs/medieval-fantasy/items/gem-2.png",
    gem3: "sparklinlabs/medieval-fantasy/items/gem-3.png",
    gem4: "sparklinlabs/medieval-fantasy/items/gem-4.png",
    bat: "sparklinlabs/medieval-fantasy/monsters/bat.png",
    slime: "sparklinlabs/medieval-fantasy/monsters/slim.png",
    skeleton: "sparklinlabs/medieval-fantasy/monsters/skeleton.png",
    snake: "sparklinlabs/medieval-fantasy/monsters/snake.png",
    impact: "sparklinlabs/medieval-fantasy/fx/impact-1.png",
    relicFx: "sparklinlabs/medieval-fantasy/fx/relic-5.png",
    fullHeart: "sparklinlabs/medieval-fantasy/hud/full-heart.png",
    emptyHeart: "sparklinlabs/medieval-fantasy/hud/empty-heart.png",
    key: "sparklinlabs/ninja-adventure/items/gold-key.png",
    scroll: "sparklinlabs/ninja-adventure/items/scroll-rock.png",
    medipack: "sparklinlabs/ninja-adventure/items/medipack.png",
    hammer: "sparklinlabs/ninja-adventure/weapons/hammer.png",
    dungeonItems: "opengameart/dungeon-items/DungeonItems.png",
    chestStrip: "opengameart/chest/chest_plain_open_anim-sheet.png",
    dtGoblin: "0x72_DungeonTilesetII/frames/goblin_idle_anim_f0.png",
    dtOgre: "0x72_DungeonTilesetII/frames/ogre_idle_anim_f0.png",
    dtBigDemon: "0x72_DungeonTilesetII/frames/big_demon_idle_anim_f0.png",
    dtBigZombie: "0x72_DungeonTilesetII/frames/big_zombie_idle_anim_f0.png"
  };

  const ITEM_ICON_ASSETS = {
    copper: { source: "gem2", scale: 1 },
    iron: { source: "gem2", scale: 1 },
    coin: { source: "coin", scale: 1 },
    amber: { source: "gem3", scale: 1 },
    gold: { source: "gem3", scale: 1 },
    crystal: { source: "gem1", scale: 1 },
    obsidian: { source: "gem4", scale: 1 },
    quartz: { source: "gem2", scale: 1 },
    ember: { source: "impact", scale: 0.9 },
    voidglass: { source: "gem4", scale: 1 },
    gel: { source: "slime", scale: 1 },
    fang: { source: "skeleton", scale: 1.18, alignY: 0.6 },
    relic: { source: "scroll", scale: 1 },
    mapScrap: { source: "scroll", scale: 0.96 },
    sealedLetter: { source: "dungeonItems", rect: [8, 0, 8, 8], scale: 1.56, pad: 1 },
    oldCompass: { source: "coin", scale: 0.95 },
    watcherToken: { source: "dungeonItems", rect: [0, 0, 8, 8], scale: 1.46, pad: 1 },
    mirrorShard: { source: "gem2", scale: 1.08 },
    strangeKey: { source: "dungeonItems", rect: [8, 8, 8, 8], scale: 1.48, pad: 1 },
    kit: { source: "medipack", scale: 1 },
    charge: { source: "impact", scale: 0.9 },
    battery: { source: "dungeonItems", rect: [0, 8, 8, 8], scale: 1.5, pad: 1 },
    core: { source: "relicFx", scale: 0.9 },
    clockwork: { source: "hammer", scale: 1 }
  };

  const RUNTIME_ITEM_TEXTURES = Object.freeze(
    Object.fromEntries(Object.keys(ITEM_ICON_ASSETS).map((item) => [item, `asset-item-${item}`]))
  );

  const CACHE_TEXTURES = {
    chest: { closed: "asset-cache-chest", open: "asset-cache-chest-open", sourceClosed: "chestClosed", sourceOpen: "chestOpen" },
    rare: { closed: "asset-cache-rare", open: "asset-cache-rare-open", sourceClosed: "rareChestClosed", sourceOpen: "rareChestOpen" },
    crate: { closed: "asset-cache-crate", open: "asset-cache-crate-open", sourceClosed: "crate", sourceOpen: "crate" },
    barrel: { closed: "asset-cache-barrel", open: "asset-cache-barrel-open", sourceClosed: "barrel", sourceOpen: "barrel" }
  };

  const CACHE_OPEN_FRAMES = Object.freeze([
    { key: "asset-cache-open-frame-0", rect: [0, 0, 16, 16] },
    { key: "asset-cache-open-frame-1", rect: [16, 0, 16, 16] },
    { key: "asset-cache-open-frame-2", rect: [0, 16, 16, 16] },
    { key: "asset-cache-open-frame-3", rect: [16, 16, 16, 16] }
  ]);

  const MOB_WAKE_FRAMES = Object.freeze([
    { key: "asset-mob-wake-frame-0", rect: [0, 0, 13, 13] },
    { key: "asset-mob-wake-frame-1", rect: [13, 0, 13, 13] },
    { key: "asset-mob-wake-frame-2", rect: [26, 0, 13, 13] },
    { key: "asset-mob-wake-frame-3", rect: [39, 0, 13, 13] },
    { key: "asset-mob-wake-frame-4", rect: [52, 0, 13, 13] }
  ]);

  const state = {
    requested: 0,
    loaded: new Set(),
    normalized: new Set(),
    missing: new Set(),
    cssIcons: Object.create(null)
  };

  function rawKey(name) {
    return `raw-${name}`;
  }

  function rawUrl(name) {
    const assetPath = RAW_ASSETS[name];
    return ML.EXTERNAL_ASSET_DATA?.[assetPath] || ROOT + assetPath;
  }

  function sourceImage(scene, nameOrKey) {
    const key = RAW_ASSETS[nameOrKey] ? rawKey(nameOrKey) : nameOrKey;
    if (!scene?.textures?.exists?.(key)) return null;
    const texture = scene.textures.get(key);
    const image = texture?.getSourceImage?.() || texture?.source?.[0]?.image || null;
    const width = image?.naturalWidth || image?.width || 0;
    const height = image?.naturalHeight || image?.height || 0;
    if (!image || width <= 0 || height <= 0) return null;
    state.loaded.add(key);
    return image;
  }

  function preload(scene) {
    if (!scene?.load) return;
    for (const name of Object.keys(RAW_ASSETS)) {
      const key = rawKey(name);
      state.requested += 1;
      if (scene.textures.exists(key)) continue;
      scene.load.image(key, rawUrl(name));
    }
  }

  function sourceRectFor(image, options = {}) {
    const iw = image.naturalWidth || image.width || 1;
    const ih = image.naturalHeight || image.height || 1;
    const rect = Array.isArray(options.sourceRect) ? options.sourceRect : null;
    if (!rect) return { sx: 0, sy: 0, sw: iw, sh: ih };
    return {
      sx: clampInt(rect[0], 0, iw - 1),
      sy: clampInt(rect[1], 0, ih - 1),
      sw: clampInt(rect[2], 1, iw),
      sh: clampInt(rect[3], 1, ih)
    };
  }

  function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
  }

  function itemSpec(item) {
    const spec = ITEM_ICON_ASSETS[item];
    if (!spec) return null;
    return typeof spec === "string" ? { source: spec } : spec;
  }

  function textureDataUrl(scene, key) {
    if (!scene?.textures?.exists?.(key)) return "";
    const texture = scene.textures.get(key);
    const image = texture?.getSourceImage?.() || texture?.source?.[0]?.image || null;
    if (!image?.toDataURL) return "";
    try {
      return image.toDataURL("image/png");
    } catch {
      return "";
    }
  }

  function drawImageInBox(ctx, image, x, y, width, height, options = {}) {
    const rect = sourceRectFor(image, options);
    const iw = rect.sw;
    const ih = rect.sh;
    const pad = options.pad ?? 2;
    const boxW = Math.max(1, width - pad * 2);
    const boxH = Math.max(1, height - pad * 2);
    const scale = Math.min(boxW / iw, boxH / ih) * (options.scale || 1);
    const drawW = Math.max(1, Math.round(iw * scale));
    const drawH = Math.max(1, Math.round(ih * scale));
    const alignX = options.alignX ?? 0.5;
    const alignY = options.alignY ?? 0.5;
    const dx = Math.round(x + pad + (boxW - drawW) * alignX);
    const dy = Math.round(y + pad + (boxH - drawH) * alignY);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (options.shadow) {
      ctx.fillStyle = options.shadowColor || "rgba(0,0,0,0.24)";
      ctx.fillRect(dx + Math.max(1, Math.round(drawW * 0.12)), dy + drawH - 2, Math.max(3, Math.round(drawW * 0.76)), 3);
    }
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, drawW, drawH);
    ctx.restore();
  }

  function drawRawInto(scene, ctx, name, x, y, width, height, options = {}) {
    const image = sourceImage(scene, name);
    if (!image) {
      state.missing.add(rawKey(name));
      return false;
    }
    drawImageInBox(ctx, image, x, y, width, height, options);
    state.normalized.add(`${name}:draw`);
    return true;
  }

  function createNormalizedTexture(scene, targetKey, sourceName, width, height, options = {}) {
    const image = sourceImage(scene, sourceName);
    if (!image) {
      state.missing.add(rawKey(sourceName));
      return false;
    }
    if (scene.textures.exists(targetKey)) scene.textures.remove(targetKey);
    const texture = scene.textures.createCanvas(targetKey, width, height);
    if (!texture) return false;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, width, height);
    if (options.backdrop) {
      ctx.fillStyle = options.backdrop;
      ctx.fillRect(0, 0, width, height);
    }
    drawImageInBox(ctx, image, 0, 0, width, height, options);
    texture.refresh();
    state.normalized.add(targetKey);
    return true;
  }

  function makeRuntimeTextures(scene) {
    createNormalizedTexture(scene, "bat", "bat", 26, 20, { pad: 2, scale: 1.16, alignY: 0.5 });
    createNormalizedTexture(scene, "slime", "slime", 28, 20, { pad: 2, scale: 1.3, alignY: 0.68, shadow: true });
    createNormalizedTexture(scene, "crawler", "snake", 30, 18, { pad: 1, scale: 1.05, alignY: 0.68, shadow: true });
    // Cave bestiary upgraded to 0x72 DungeonTileset II (CC0). Each override keeps
    // the mob's original canvas frame size so the configured body offsets stay
    // aligned; only the artwork changes.
    createNormalizedTexture(scene, "mossling", "dtGoblin", 28, 18, { pad: 2, scale: 1.04, alignY: 0.74, shadow: true });
    createNormalizedTexture(scene, "golem", "dtOgre", 32, 36, { pad: 2, scale: 1.0, alignY: 0.6, shadow: true });
    createNormalizedTexture(scene, "warden", "dtBigDemon", 56, 64, { pad: 3, scale: 0.96, alignY: 0.58, shadow: true });
    createNormalizedTexture(scene, "broodmother", "dtBigZombie", 56, 42, { pad: 3, scale: 1.0, alignY: 0.6, shadow: true });
    createNormalizedTexture(scene, "asset-bone-drop", "skeleton", 24, 22, { pad: 2, scale: 1.08, alignY: 0.62, shadow: true });
    createNormalizedTexture(scene, "asset-heart-full", "fullHeart", 18, 18, { pad: 1, scale: 1.1, alignY: 0.5 });
    createNormalizedTexture(scene, "asset-heart-empty", "emptyHeart", 18, 18, { pad: 1, scale: 1.1, alignY: 0.5 });

    for (const cache of Object.values(CACHE_TEXTURES)) {
      createNormalizedTexture(scene, cache.closed, cache.sourceClosed, 32, 32, {
        pad: 3,
        scale: 1.24,
        alignY: 0.66,
        shadow: true
      });
      createNormalizedTexture(scene, cache.open, cache.sourceOpen, 32, 32, {
        pad: cache.sourceOpen === "crate" || cache.sourceOpen === "barrel" ? 4 : 3,
        scale: cache.sourceOpen === "crate" || cache.sourceOpen === "barrel" ? 1.16 : 1.24,
        alignY: 0.66,
        shadow: true
      });
    }

    for (const frame of CACHE_OPEN_FRAMES) {
      createNormalizedTexture(scene, frame.key, "chestStrip", 32, 32, {
        pad: 3,
        scale: 1.28,
        alignY: 0.66,
        sourceRect: frame.rect,
        shadow: true
      });
    }

    for (const frame of MOB_WAKE_FRAMES) {
      createNormalizedTexture(scene, frame.key, "relicFx", 34, 30, {
        pad: 2,
        scale: 1.42,
        alignY: 0.56,
        sourceRect: frame.rect,
        shadow: true
      });
    }

    for (const item of Object.keys(ITEM_ICON_ASSETS)) {
      const spec = itemSpec(item);
      const targetKey = RUNTIME_ITEM_TEXTURES[item];
      createNormalizedTexture(scene, targetKey, spec.source, 22, 22, {
        pad: spec.pad ?? 2,
        scale: spec.scale ?? 1,
        alignY: spec.alignY ?? 0.5,
        sourceRect: spec.rect,
        shadow: true
      });
      state.cssIcons[item] = textureDataUrl(scene, targetKey) || rawUrl(spec.source);
    }
  }

  function itemTextureKey(item, scene = ML.sceneRef) {
    const key = RUNTIME_ITEM_TEXTURES[item];
    return key && scene?.textures?.exists?.(key) ? key : null;
  }

  function itemCssUrl(item) {
    const spec = itemSpec(item);
    return state.cssIcons[item] || (spec?.source ? rawUrl(spec.source) : "");
  }

  function cacheTextureKey(kind = "chest", open = false, scene = ML.sceneRef) {
    const cache = CACHE_TEXTURES[kind] || CACHE_TEXTURES.chest;
    const key = open ? cache.open : cache.closed;
    return scene?.textures?.exists?.(key) ? key : null;
  }

  function cacheOpenFrameKeys(scene = ML.sceneRef) {
    return CACHE_OPEN_FRAMES
      .map((frame) => frame.key)
      .filter((key) => scene?.textures?.exists?.(key));
  }

  function mobWakeFrameKeys(scene = ML.sceneRef) {
    return MOB_WAKE_FRAMES
      .map((frame) => frame.key)
      .filter((key) => scene?.textures?.exists?.(key));
  }

  function report(scene = ML.sceneRef) {
    const requestedKeys = Object.keys(RAW_ASSETS).map(rawKey);
    const loaded = requestedKeys.filter((key) => scene?.textures?.exists?.(key));
    const itemTextureCount = Object.keys(RUNTIME_ITEM_TEXTURES)
      .filter((item) => itemTextureKey(item, scene)).length;
    const derivedCssIconCount = Object.keys(RUNTIME_ITEM_TEXTURES)
      .filter((item) => state.cssIcons[item]?.startsWith?.("data:image/png;base64,")).length;
    const sheetIconCount = Object.values(ITEM_ICON_ASSETS)
      .filter((spec) => Array.isArray(spec?.rect)).length;
    const cacheTextureCount = Object.values(CACHE_TEXTURES)
      .flatMap((cache) => [cache.closed, cache.open])
      .filter((key) => scene?.textures?.exists?.(key)).length;
    const cacheAnimationFrameCount = cacheOpenFrameKeys(scene).length;
    const mobWakeAnimationFrameCount = mobWakeFrameKeys(scene).length;
    return {
      requested: requestedKeys.length,
      loaded: loaded.length,
      normalized: state.normalized.size,
      itemTextureCount,
      derivedCssIconCount,
      sheetIconCount,
      cacheTextureCount,
      cacheAnimationFrameCount,
      mobWakeAnimationFrameCount,
      missing: [...state.missing].filter((key) => !scene?.textures?.exists?.(key))
    };
  }

  ML.ExternalAssets = {
    RAW_ASSETS,
    ITEM_ICON_ASSETS,
    RUNTIME_ITEM_TEXTURES,
    CACHE_TEXTURES,
    CACHE_OPEN_FRAMES,
    MOB_WAKE_FRAMES,
    preload,
    drawRawInto,
    createNormalizedTexture,
    makeRuntimeTextures,
    itemTextureKey,
    itemCssUrl,
    cacheTextureKey,
    cacheOpenFrameKeys,
    mobWakeFrameKeys,
    report
  };
})();
