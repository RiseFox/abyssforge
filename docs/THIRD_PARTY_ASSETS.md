# Third-Party Assets

AbyssForge primarily uses code-generated pixel textures. External assets are treated as candidates and references until they are normalized into the game's style.

## Intake Rules

- Allowed by default: `CC0-1.0`.
- Each source must have a source URL, license URL, author, and intended role.
- Raw assets live under `assets/external/`.
- Runtime-ready derivatives should be normalized before use and should not silently replace existing code-generated sprites.
- Do not import ripped Minecraft, Terraria, or commercial game assets.

## Downloaded Candidates

### Sparklin Labs / Pixel-boy - Superpowers Asset Packs

- Source: https://github.com/sparklinlabs/superpowers-asset-packs
- License: `CC0-1.0`
- License evidence: `assets/external/sparklinlabs/LICENSE.txt`
- Local files: `assets/external/sparklinlabs/`
- Use case: chests, cache props, currency/gem icons, mob silhouette references, HUD heart references, small FX, and tool/key/lore item references.
- Runtime status: candidate only; needs palette and scale normalization before direct in-game use.

### OpenGameArt - Pixel Art Dungeon Items

- Source: https://opengameart.org/content/pixel-art-dungeon-items
- License: `CC0-1.0`
- License evidence: source page lists CC0.
- Local files: `assets/external/opengameart/dungeon-items/`
- Use case: potion, skull, parchment, and strange-loot references for chest rewards and secret caches.
- Runtime status: candidate only; needs item slicing and palette cleanup before direct in-game use.

### OpenGameArt - Chest - Opening Animation 16x16

- Source: https://opengameart.org/content/chest-opening-animation-16x16
- License: `CC0-1.0`
- License evidence: source page lists CC0.
- Local files: `assets/external/opengameart/chest/`
- Use case: chest-opening strip reference for richer cache/chest interactions.
- Runtime status: candidate only; needs frame extraction and animation timing before direct in-game use.

## Approved Future Sources

### Kenney

- Source: https://kenney.nl/assets
- License evidence: https://kenney.nl/support
- License: `CC0-1.0`
- Use case: UI, input prompts, interface elements, general CC0 game assets.
- Download mode: official site/itch flow.

### 0x72 - 16x16 DungeonTileset II

- Source: https://0x72.itch.io/dungeontileset-ii
- License evidence: same page, asset license listed as Creative Commons Zero.
- License: `CC0-1.0`
- Use case: cave enemies, dungeon props, item silhouettes.
- Download mode: official itch flow.

### Pixel Frog - Pixel Adventure

- Source: https://pixelfrog-assets.itch.io/pixel-adventure-1
- License evidence: same page, asset license listed as Creative Commons Zero.
- License: `CC0-1.0`
- Use case: animation reference and item ideas.
- Download mode: official itch flow.

## Notes

The first automated intake combines a GitHub raw source with direct official OpenGameArt files. Kenney, 0x72, and Pixel Frog remain approved sources, but their official download flows should be respected rather than scraped around.
