# AbyssForge

AbyssForge is a browser-based 2D mining, crafting, and survival prototype inspired by Terraria-style cave exploration and Minecraft-like resource loops.

## Features

- Procedural mine world with seed-based terrain and a quality-gated spawn area.
- Mining, block placement, ladders, torches, crafting, mobs, loot, health, energy, and depth progression.
- Secret vault rooms with cache chests, rare relic materials, and hidden depth bosses.
- Torch and headlamp lighting, day/night mood, situational background music, and compact pixel-art UI.
- Craft-ready HUD badge and notifications when new recipes become buildable.
- Expanded crafting with block kits, survival kits, relic charms, movement upgrades, loot upgrades, and boss-material progression.
- Achievements with unlock toasts and a pause-menu progress list.
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
