# AbyssForge

**AbyssForge** is a browser-based 2D mining, crafting, survival, and descent game about turning a ruined surface camp into a lifeline through a hostile living mine.

You start with a weak pick, a few torches, and a campfire beside the first shaft. Every trip downward changes the run: new resources unlock tools, campfires become anchors, biome pressure changes recovery and light rules, secrets hide bosses, and the mine pushes back with events, mobs, darkness, and contracts.

![AbyssForge surface camp](docs/images/abyssforge-surface-camp.png)

## Game Fantasy

The old lift network under the Guild is broken. Below it, the mine is not just deeper rock - it is a layered machine of roots, ore faults, glow hollows, crystal veins, and obsidian heat. Campfires are the only reliable marks of human control. Light buys time. Crafting buys options. Going deeper buys answers.

The long-term goal is to recover enough relic technology to reach the Warden's forge and survive what the first expedition woke up.

## Hidden Purpose

At first, AbyssForge plays like a direct mining game: dig, craft, light the route, and survive. The deeper structure is deliberately hidden. Reaching suspicious depths, opening secret caches, activating campfire waypoints, entering strange biomes, crafting relic systems, and defeating vault bosses decode field notes that slowly reframe the run.

The hidden thread asks the player to rebuild the old wayfire network, decode cache marks, assemble abyss gear, break two sealed bosses, and eventually learn what the forge was actually built to do.

![AbyssForge hidden field notes](docs/images/abyssforge-hidden-lore.png)

## Darkness And The Watcher

Light now has a second failure state. Before the deep dark starts killing the player, low light builds **Shadow pressure**: energy drains faster, the darkness thickens, field notes can unlock, and a hidden NPC called **the Watcher** may appear at the edge of the lamp radius.

The Watcher does not attack. It follows from outside safe light, retreats from campfires and strong lamps, and quietly ties into the old wayfire lore. Repeated sightings reveal that it is less a monster than a leftover witness to the forge network.

## Core Loop

- Mine blocks, ores, mushrooms, and hidden caches.
- Craft picks, battery-fed lamps, weapons, movement gear, charms, bridges, charges, and survival kits.
- Build ladders, platforms, torches, and safer descent routes.
- Rest at campfires to heal, recover energy, set respawn anchors, and resupply.
- Complete expedition contracts for supplies and coin.
- Discover secret rooms with chests, camp points, relics, and bosses.
- Push through deeper biomes where darkness, recovery, and music change with the terrain.
- Manage lamp cells, torches, and Shadow pressure when light runs low, then learn why something follows beyond the lamp.
- Decode hidden field notes that reveal the Warden, the wayfires, and the true purpose of the abyss forge.

## Biomes With Properties

Biomes are runtime systems, not only labels. The current biome affects ambient light, recovery rate, energy pressure, darkness damage, situational music, and the HUD intel panel.

| Biome | Identity | Gameplay Effect |
| --- | --- | --- |
| Surface Ruins | Last honest sky | Safe camp access, daylight recovery, low pressure. |
| Rootline Burrows | Soft earth | Easier recovery and early route building around roots and soil. |
| Stone Warrens | Working mine | Stable midgame rock with balanced threats and coal routes. |
| Fungal Hollow | Living light | Glow caps raise local light and recovery, but slime routes become common. |
| Iron Fault | Ore pressure | Richer metal paths with lower recovery and tremor-like tension. |
| Deepstone Pressure | Heavy dark | Stronger darkness pressure, heavier mobs, weaker natural recovery. |
| Crystal Vein | Vault signal | Crystal glow and energy trickle mark valuable secret routes. |
| Obsidian Abyss | Boss country | Severe darkness, lava heat, and late-game Warden territory. |

![AbyssForge biome intel](docs/images/abyssforge-biome-intel.png)

## Strata Progression

Depth is no longer a single hardcoded ore ladder. AbyssForge now uses data-driven strata profiles that change generation and play rules as the mine opens downward. A stratum controls ore weights, cave size, lava pressure, cache density, camp rarity, mob caps, elite chance, cave-event weights, and mining fatigue.

| Stratum | Starts Near | Expedition Meaning |
| --- | ---: | --- |
| Rootline Drift | 0 m | Forgiving starter rock with roots, coal, copper, safe routes, and more camps. |
| Iron Fault | 72 m | Ore-rich pressure shelves with longer mining pulls and more tremor events. |
| Crystal Vein | 138 m | Valuable glow chambers with stronger detours, swarms, crystals, and soft recovery signals. |
| Obsidian Abyss | 220 m | Lava-glass danger with fewer camps, heavier mobs, richer caches, and severe darkness. |
| Voidglass Shelf | 330 m | Strange repeating lower shelves where safe light is scarce and the mine stops behaving naturally. |

Opening bedrock seams extends the world and moves the next generated abyss section into the active stratum instead of repeating the same cave recipe forever.

## Current Features

- Seeded procedural world with a quality-gated spawn area.
- Data-driven strata profiles for ore distribution, cave shape, lava, caches, camps, mob pressure, elite chance, cave events, and mining fatigue.
- Stable starter shaft, no-air spawn checks, and a protected first drop bridge.
- Mining, block placement, ladders, torches, platforms, charges, and hotbar use.
- Pickaxe combat against crawlers, slimes, bats, golems, and hidden bosses.
- Expanded crafting across tools, blocks, survival items, and relic upgrades.
- Campfire rest points with warm light, services, safe respawn anchors, and recall support.
- Secret vault rooms with chests, rare relic materials, boss rooms, and deeper camp points.
- Dynamic cave events: ore surge, lantern draft, depth swarm, and cave tremor.
- Story-phase event variants: familiar cave events start as mining hazards, then slowly read like signals from a broken machine.
- Instinct-based enemy behavior: mobs react to light, weakness, allies, distance, and their own health instead of only walking at the player.
- Observer anomaly layer: the miner can hesitate, mobs can stare through the camera, and rare space-window tears expose the frame behind the world.
- Situational music modes for surface, night, caves, danger, treasure, camp, deep zones, and bosses.
- Hidden field-note system with staged long-term goals, lore reveals, and a mystery HUD that appears only after the first impossible clue.
- Shadow pressure system with lamp-cell drain, energy pressure, stronger darkness feedback, and a non-hostile hidden Watcher NPC.
- Achievements, unlock toasts, craft-ready notifications, contracts, minimap, pause menu, and death recap.
- Local Playwright smoke test covering spawn quality, progression data, camp anchors, biome variety, hidden-lore progression, and Watcher runtime hooks.

## Controls

| Input | Action |
| --- | --- |
| `A` / `D` | Move left and right |
| `W` / `Space` | Jump or climb up |
| `S` | Climb down ladders or drop through normal platforms |
| `Shift` | Sprint while energy allows |
| Left mouse | Mine blocks or hit an enemy under the cursor |
| Right mouse | Place or use the selected hotbar item |
| `F` | Swing the pickaxe at enemies in front of you |
| `R` | Recall to the active campfire anchor |
| `C` | Open camp services while near a campfire |
| `E` | Open crafting |
| `1`-`9` | Select hotbar slot |
| `M` | Toggle map |
| `Esc` | Pause or resume |

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static file server.

```bash
npm install
npm test
```

`npm test` launches Playwright, opens the game, verifies 300 generated starts, checks that the spawn has real support, confirms the starter camp is reachable, validates campfire anchors and progression systems, samples biome variety, and runs a HUD performance smoke gate for FPS, frame time, DOM weight, and default overlay state.

## Project Shape

- `index.html` - Phaser host page and HUD markup.
- `css/style.css` - pixel-art UI, panels, hotbar, drawers, and responsive layout.
- `js/config.js` - shared constants, items, recipes, strata profiles, contracts, achievements, enemies, and events.
- `js/sim.js` - pure world simulation, generation, strata selection, saves, inventory, crafting, contracts, mobs, and spawn repair.
- `js/biomes.js` - biome definitions, detection, lore, and gameplay properties.
- `js/camp.js` - campfire proximity, anchor, respawn, and service logic.
- `js/audio.js` - Web Audio SFX and situational music modes.
- `js/textures.js` - generated pixel textures and sprites.
- `js/ui.js` - DOM HUD, crafting drawer, minimap, toasts, achievements, and death panel.
- `js/scene.js` - Phaser gameplay scene, movement, mining, combat, lighting, hazards, events, and camera.
- `scripts/verify-spawn-seeds.js` - browser smoke test and spawn/progression quality gate.

## Design Direction

AbyssForge is moving toward a deeper Terraria-like expedition structure: each descent should force a route decision, each biome should change the rules slightly, and every campfire should feel like a meaningful foothold in a hostile vertical world.
