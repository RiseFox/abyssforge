# Asset Pipeline

AbyssForge uses external raster assets only when they make the game clearer or more tactile than the code-generated pixel art.

## Production Bar

An asset is runtime-ready only when all of these are true:

- The source is license-clean and listed in `assets/external/manifest.json`.
- The downloaded file is pinned in `assets/external/asset-lock.json` with size and SHA-256.
- The asset improves a player-facing read: item identity, chest type, enemy silhouette, FX feedback, or HUD clarity.
- The runtime texture is normalized in `js/assets.js` for size, scale, anchor, crop, and shadow.
- UI icons use derived normalized PNGs, not raw sheets or oversized source art.
- Playwright gates prove the asset loads, appears in scene or HUD, and does not silently regress.

## Runtime Rules

- Raw files stay under `assets/external/`.
- `npm run assets:build-runtime` packs audited files into `js/asset-data.js`.
- Phaser textures are generated from the packed data so local `index.html` runs without a server.
- Item icons may crop a source sheet with a source rect, then export a derived CSS PNG for the backpack and hotbar.
- World props use pooled sprites instead of unbounded object creation.
- Ore seams use generated glint overlays to improve readability without replacing the base tile texture.

## Current Gates

- `npm run assets:audit` checks metadata, lock hashes, packed data URLs, and minimum packed asset count.
- `npm run test:spawn` checks external asset counts inside the main systems gate.
- `npm run test:input` checks keyboard-layout-safe physical controls, menu resume, and focus recovery.
- `npm run test:perf` checks HUD/runtime counts and pooled chest/ore/light props.
- `npm run test:assets` checks cache overlays, animated ore/light props, cache-opening animation frames, mob-wake animation frames, recover FX, derived CSS icons, and unique sliced sheet icons.
- `npm run docs:screenshots` regenerates product screenshots from the current build.

## Replacement Decisions

Replace code-generated art only when the external asset is clearly stronger at game scale. Keep generated art when it is more readable, more consistent with the palette, or cheaper to animate. When using a sheet, crop only the exact slot that matches the item; do not show the whole sheet as a UI icon.
