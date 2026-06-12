# MinerLand

MinerLand is a browser-based 2D mining, crafting, and survival prototype inspired by Terraria-style cave exploration and Minecraft-like resource loops.

## Features

- Procedural mine world with seed-based terrain and a quality-gated spawn area.
- Mining, block placement, ladders, torches, crafting, mobs, loot, health, energy, and depth progression.
- Torch and headlamp lighting, day/night mood, background music, and compact pixel-art UI.
- Local Playwright smoke check for spawn stability across many seeds.

## Controls

- `A` / `D` - move left and right
- `W` / `Space` - jump or climb up
- `S` - climb down ladders or drop from platforms
- Left mouse - mine blocks or hit targets
- Right mouse - place or use the selected hotbar item
- `F` - attack with the pickaxe
- `E` - craft selected recipe
- `1`-`9` - select hotbar slot
- `M` - toggle map
- `Esc` - open menu

## Run

Open `index.html` in a browser, or serve the folder with any static file server.

## Verification

Install dependencies and run the spawn quality gate:

```bash
npm install
npm test
```

The test launches the game with Playwright and checks that generated starts have stable floor support instead of spawning the player in air or between blocks.
