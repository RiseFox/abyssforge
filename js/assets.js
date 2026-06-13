// AbyssForge v2 - approved external asset bridge.
(() => {
  "use strict";
  const ML = window.ML;

  const ROOT = "assets/external/";

  const RAW_ASSETS = {
    chestClosed: "sparklinlabs/medieval-fantasy/items/wood-chest-close.png",
    chestOpen: "sparklinlabs/medieval-fantasy/items/wood-chest-open.png",
    rareChestClosed: "sparklinlabs/medieval-fantasy/items/gold-chest-close.png",
    crate: "sparklinlabs/medieval-fantasy/items/crate.png",
    barrel: "sparklinlabs/medieval-fantasy/items/barrel.png",
    coin: "sparklinlabs/medieval-fantasy/items/coin.png",
    gem1: "sparklinlabs/medieval-fantasy/items/gem-1.png",
    gem2: "sparklinlabs/medieval-fantasy/items/gem-2.png",
    gem3: "sparklinlabs/medieval-fantasy/items/gem-3.png",
    gem4: "sparklinlabs/medieval-fantasy/items/gem-4.png",
    bat: "sparklinlabs/medieval-fantasy/monsters/bat.png",
    slime: "sparklinlabs/medieval-fantasy/monsters/slim.png",
    snake: "sparklinlabs/medieval-fantasy/monsters/snake.png",
    impact: "sparklinlabs/medieval-fantasy/fx/impact-1.png",
    relicFx: "sparklinlabs/medieval-fantasy/fx/relic-5.png",
    key: "sparklinlabs/ninja-adventure/items/gold-key.png",
    scroll: "sparklinlabs/ninja-adventure/items/scroll-rock.png",
    medipack: "sparklinlabs/ninja-adventure/items/medipack.png",
    hammer: "sparklinlabs/ninja-adventure/weapons/hammer.png",
    dungeonItems: "opengameart/dungeon-items/DungeonItems.png",
    chestStrip: "opengameart/chest/chest_plain_open_anim-sheet.png"
  };

  const ITEM_ICON_ASSETS = {
    coin: "coin",
    gold: "gem3",
    crystal: "gem1",
    obsidian: "gem4",
    quartz: "gem2",
    voidglass: "gem4",
    relic: "scroll",
    mapScrap: "scroll",
    strangeKey: "key",
    kit: "medipack",
    charge: "impact",
    core: "relicFx",
    clockwork: "hammer"
  };

  const RUNTIME_ITEM_TEXTURES = {
    coin: "asset-item-coin",
    gold: "asset-item-gold",
    crystal: "asset-item-crystal",
    obsidian: "asset-item-obsidian",
    quartz: "asset-item-quartz",
    voidglass: "asset-item-voidglass",
    relic: "asset-item-relic",
    mapScrap: "asset-item-mapScrap",
    strangeKey: "asset-item-strangeKey",
    kit: "asset-item-kit",
    charge: "asset-item-charge",
    core: "asset-item-core",
    clockwork: "asset-item-clockwork"
  };

  const state = {
    requested: 0,
    loaded: new Set(),
    normalized: new Set(),
    missing: new Set()
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

  function drawImageInBox(ctx, image, x, y, width, height, options = {}) {
    const iw = image.naturalWidth || image.width || 1;
    const ih = image.naturalHeight || image.height || 1;
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
    ctx.drawImage(image, dx, dy, drawW, drawH);
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

    for (const [item, sourceName] of Object.entries(ITEM_ICON_ASSETS)) {
      const targetKey = RUNTIME_ITEM_TEXTURES[item];
      createNormalizedTexture(scene, targetKey, sourceName, 22, 22, {
        pad: 2,
        scale: item === "charge" || item === "core" ? 0.9 : 1,
        alignY: 0.5,
        shadow: true
      });
    }
  }

  function itemTextureKey(item, scene = ML.sceneRef) {
    const key = RUNTIME_ITEM_TEXTURES[item];
    return key && scene?.textures?.exists?.(key) ? key : null;
  }

  function itemCssUrl(item) {
    const sourceName = ITEM_ICON_ASSETS[item];
    return sourceName ? rawUrl(sourceName) : "";
  }

  function report(scene = ML.sceneRef) {
    const requestedKeys = Object.keys(RAW_ASSETS).map(rawKey);
    const loaded = requestedKeys.filter((key) => scene?.textures?.exists?.(key));
    const itemTextureCount = Object.keys(RUNTIME_ITEM_TEXTURES)
      .filter((item) => itemTextureKey(item, scene)).length;
    return {
      requested: requestedKeys.length,
      loaded: loaded.length,
      normalized: state.normalized.size,
      itemTextureCount,
      missing: [...state.missing].filter((key) => !scene?.textures?.exists?.(key))
    };
  }

  ML.ExternalAssets = {
    RAW_ASSETS,
    ITEM_ICON_ASSETS,
    RUNTIME_ITEM_TEXTURES,
    preload,
    drawRawInto,
    createNormalizedTexture,
    makeRuntimeTextures,
    itemTextureKey,
    itemCssUrl,
    report
  };
})();
