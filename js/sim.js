// AbyssForge v2 - world simulation: generation, save/load, inventory, crafting.
// Pure data layer: no Phaser objects in here.
(() => {
  "use strict";
  const ML = window.ML;
  const { TILE, WORLD_W, WORLD_H, AIR, Tile, BLOCKS, clamp, mulberry32 } = ML;

  class MinerSim {
    constructor() {
      const saved = this.load() || this.loadLegacy();
      if (saved) {
        Object.assign(this, saved);
        this.ensureDefaults();
        this.repairSpawnShaft();
        this.repairPlayerPosition();
        return;
      }
      this.newWorld();
    }

    ensureDefaults() {
      this.blade = this.blade || 0;
      this.boots = Boolean(this.boots);
      this.lamp = this.lamp || 0;
      this.maxHealth = this.maxHealth || 100;
      this.maxEnergy = this.maxEnergy || 100;
      this.ward = Boolean(this.ward);
      this.fallGuard = Boolean(this.fallGuard);
      this.speedBoost = Boolean(this.speedBoost);
      this.regenBoost = Boolean(this.regenBoost);
      this.treasureSense = Boolean(this.treasureSense);
      this.lootBonus = Boolean(this.lootBonus);
      this.blastRadius = this.blastRadius || 0;
      this.health = clamp(this.health ?? this.maxHealth, 0, this.maxHealth);
      this.energy = clamp(this.energy ?? this.maxEnergy, 0, this.maxEnergy);
      this.stats = Object.assign({ mined: 0, deepest: 0, enemies: 0, bosses: 0, secrets: 0, chests: 0, crafted: 0 }, this.stats || {});
      this.achievements = Object.assign({}, this.achievements || {});
      this.craftedRecipes = Object.assign({}, this.craftedRecipes || {});
      this.inventory = Object.assign(
        { dirt: 0, stone: 0, wood: 0, coal: 0, copper: 0, iron: 0, gold: 0, crystal: 0, obsidian: 0, gel: 0, coin: 0, silk: 0, fang: 0, relic: 0, core: 0, torch: 0, ladder: 0, platform: 0, charge: 0, mushroom: 0, kit: 0 },
        this.inventory || {}
      );
      if (!Array.isArray(this.secrets)) this.secrets = [];
      if (!Array.isArray(this.lights)) this.rebuildLights();
      if (!Array.isArray(this.mobs)) {
        this.mobs = this.generateMobs();
        this.mobBaseline = this.mobs.length;
      }
      if (!this.mobSeq) this.mobSeq = this.mobs.reduce((max, m) => Math.max(max, m.id), 0) + 1;
      if (!this.mobBaseline) this.mobBaseline = Math.max(this.mobs.length, 1);
      this.selected = clamp(this.selected || 0, 0, ML.HOTBAR.length - 1);
    }

    newWorld(seed = Math.floor(Date.now() % 1000000000)) {
      this.seed = seed;
      this.time = 0;
      this.health = 100;
      this.energy = 100;
      this.maxHealth = 100;
      this.maxEnergy = 100;
      this.pickLevel = 1;
      this.blade = 0;
      this.boots = false;
      this.lamp = 0;
      this.ward = false;
      this.fallGuard = false;
      this.speedBoost = false;
      this.regenBoost = false;
      this.treasureSense = false;
      this.lootBonus = false;
      this.blastRadius = 0;
      this.selected = 3;
      this.inventory = {
        dirt: 0, stone: 0, wood: 8, coal: 2, copper: 0, iron: 0, gold: 0, crystal: 0,
        obsidian: 0, gel: 0, coin: 0, silk: 0, fang: 0, relic: 0, core: 0,
        torch: 6, ladder: 8, platform: 0, charge: 0, mushroom: 0, kit: 1
      };
      const generated = this.generateWorld(seed);
      this.world = generated.world;
      this.surface = generated.surface;
      this.spawn = generated.spawn;
      this.shaft = generated.shaft;
      this.secrets = generated.secrets || [];
      this.stats = { mined: 0, deepest: 0, enemies: 0, bosses: 0, secrets: 0, chests: 0, crafted: 0 };
      this.achievements = {};
      this.craftedRecipes = {};
      this.repairSpawnShaft();
      this.player = this.safeSpawnPixels();
      this.rebuildLights();
      this.mobs = this.generateMobs(mulberry32(seed ^ 0x9e3779b9));
      this.mobBaseline = this.mobs.length;
      this.repairPlayerPosition(true);
    }

    generateWorld(seed) {
      const rand = mulberry32(seed);
      const world = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(AIR));
      const surface = [];

      // Terrain column by column with an ore lottery per cell.
      let h = 24;
      for (let x = 0; x < WORLD_W; x += 1) {
        h += Math.floor(rand() * 3) - 1;
        const wave = Math.sin(x / 12) * 2 + Math.sin(x / 31) * 4;
        surface[x] = clamp(Math.floor(h + wave), 18, 31);
        for (let y = surface[x]; y < WORLD_H; y += 1) {
          if (y >= WORLD_H - 4) {
            world[y][x] = Tile.BEDROCK;
          } else if (y === surface[x]) {
            world[y][x] = Tile.GRASS;
          } else if (y < surface[x] + 5) {
            world[y][x] = Tile.DIRT;
          } else {
            const depth = y - surface[x];
            let tile = y > 178 ? Tile.DEEP : Tile.STONE;
            const roll = rand();
            if (depth > 10 && roll < 0.04) tile = Tile.COAL;
            else if (depth > 32 && roll > 0.95 && roll <= 0.972) tile = Tile.COPPER;
            else if (depth > 72 && roll > 0.972 && roll <= 0.984) tile = Tile.IRON;
            else if (depth > 105 && roll > 0.984 && roll <= 0.991) tile = Tile.GOLD;
            else if (depth > 140 && roll > 0.991 && roll <= 0.9965) tile = Tile.CRYSTAL;
            else if (depth > 185 && roll > 0.9965) tile = Tile.OBSIDIAN;
            if (y >= WORLD_H - 16 && y < WORLD_H - 4 && rand() < 0.14) tile = Tile.OBSIDIAN;
            world[y][x] = tile;
          }
        }
      }

      // Cave worms.
      for (let c = 0; c < 115; c += 1) {
        let x = Math.floor(rand() * (WORLD_W - 12)) + 6;
        let y = Math.floor(rand() * (WORLD_H - 70)) + 45;
        let radius = rand() < 0.72 ? 1 : 2;
        const steps = 35 + Math.floor(rand() * 90);
        for (let i = 0; i < steps; i += 1) {
          for (let ox = -radius; ox <= radius; ox += 1) {
            for (let oy = -radius; oy <= radius; oy += 1) {
              const tx = x + ox;
              const ty = y + oy;
              if (tx > 2 && tx < WORLD_W - 3 && ty > surface[tx] + 5 && ty < WORLD_H - 6 && ox * ox + oy * oy <= radius * radius + 0.7) {
                world[ty][tx] = AIR;
              }
            }
          }
          x = clamp(x + Math.floor(rand() * 3) - 1, 4, WORLD_W - 5);
          y = clamp(y + Math.floor(rand() * 3) - 1, 36, WORLD_H - 8);
          if (rand() < 0.12) radius = radius === 1 ? 2 : 1;
        }
      }

      const sx = Math.floor(WORLD_W / 2);
      const solidAt = (x, y) => {
        if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true;
        const t = world[y][x];
        return t !== AIR && BLOCKS[t] && BLOCKS[t].solid;
      };
      const secrets = [];
      const canCarveSecret = (roomX, roomY, w, h) => {
        if (roomX < 4 || roomY < 38 || roomX + w >= WORLD_W - 4 || roomY + h >= WORLD_H - 8) return false;
        if (Math.abs(roomX + w / 2 - sx) < 14) return false;
        let solid = 0;
        let total = 0;
        for (let yy = roomY; yy < roomY + h; yy += 1) {
          for (let xx = roomX; xx < roomX + w; xx += 1) {
            const t = world[yy][xx];
            if (t === Tile.LAVA || t === Tile.BEDROCK || t === Tile.CHEST) return false;
            if (t !== AIR) solid += 1;
            total += 1;
          }
        }
        return solid / total > 0.68;
      };
      const carveSecret = (id, tier, minDepth, maxDepth, bossKind = null) => {
        for (let tries = 0; tries < 180; tries += 1) {
          const cx = 8 + Math.floor(rand() * (WORLD_W - 16));
          const base = surface[cx] || 24;
          const depth = minDepth + Math.floor(rand() * Math.max(1, maxDepth - minDepth));
          const w = 8 + Math.floor(rand() * 5);
          const h = 5 + Math.floor(rand() * 3);
          const roomX = clamp(cx - Math.floor(w / 2), 4, WORLD_W - w - 5);
          const roomY = clamp(base + depth, 38, WORLD_H - h - 8);
          if (!canCarveSecret(roomX, roomY, w, h)) continue;

          const wallTile = tier >= 3 ? Tile.DEEP : Tile.STONE;
          for (let yy = roomY; yy < roomY + h; yy += 1) {
            for (let xx = roomX; xx < roomX + w; xx += 1) {
              const border = xx === roomX || xx === roomX + w - 1 || yy === roomY || yy === roomY + h - 1;
              world[yy][xx] = border ? wallTile : AIR;
            }
          }

          const floorY = roomY + h - 2;
          const chestX = roomX + Math.floor(w / 2);
          let lampX = roomX + 1 + Math.floor(rand() * Math.max(1, w - 2));
          if (lampX === chestX) lampX = chestX > roomX + 2 ? chestX - 2 : chestX + 2;
          world[floorY][chestX] = Tile.CHEST;
          world[floorY][lampX] = tier >= 2 ? Tile.MUSHROOM : Tile.TORCH;

          const ore = tier >= 3 ? Tile.CRYSTAL : tier >= 2 ? Tile.GOLD : Tile.IRON;
          world[roomY + 1][roomX + 1] = ore;
          world[roomY + 1][roomX + w - 2] = ore;
          if (tier >= 3) world[floorY - 1][roomX + 2] = Tile.OBSIDIAN;

          const secret = {
            id,
            tier,
            x: roomX,
            y: roomY,
            w,
            h,
            opened: false,
            chest: { x: chestX, y: floorY }
          };
          if (bossKind) {
            secret.boss = {
              kind: bossKind,
              x: roomX + (bossKind === "warden" ? w - 3 : 2),
              y: floorY
            };
          }
          secrets.push(secret);
          return true;
        }
        return false;
      };

      // Lava pools on deep cave floors.
      for (let y = 215; y < WORLD_H - 6; y += 1) {
        for (let x = 4; x < WORLD_W - 4; x += 1) {
          if (world[y][x] === AIR && solidAt(x, y + 1) && rand() < 0.05) {
            world[y][x] = Tile.LAVA;
            if (world[y][x + 1] === AIR && solidAt(x + 1, y + 1) && rand() < 0.7) world[y][x + 1] = Tile.LAVA;
            if (world[y][x - 1] === AIR && solidAt(x - 1, y + 1) && rand() < 0.7) world[y][x - 1] = Tile.LAVA;
          }
        }
      }

      // Glow caps in caves.
      for (let x = 3; x < WORLD_W - 3; x += 1) {
        for (let y = surface[x] + 12; y < WORLD_H - 8; y += 1) {
          if (world[y][x] === AIR && solidAt(x, y + 1) && world[y][x] !== Tile.LAVA && rand() < 0.016) {
            world[y][x] = Tile.MUSHROOM;
          }
        }
      }

      [
        { tier: 1, min: 38, max: 78 },
        { tier: 1, min: 58, max: 108 },
        { tier: 2, min: 92, max: 145 },
        { tier: 2, min: 118, max: 168, boss: "broodmother" },
        { tier: 2, min: 138, max: 188 },
        { tier: 3, min: 178, max: 238 },
        { tier: 3, min: 198, max: 258, boss: "warden" }
      ].forEach((spec, index) => carveSecret(index + 1, spec.tier, spec.min, spec.max, spec.boss));

      // Supply chests tucked into caves.
      let chests = 0;
      for (let tries = 0; tries < 600 && chests < 14; tries += 1) {
        const x = 4 + Math.floor(rand() * (WORLD_W - 8));
        const y = surface[x] + 15 + Math.floor(rand() * (WORLD_H - surface[x] - 28));
        if (Math.abs(x - sx) < 10) continue;
        if (world[y][x] === AIR && solidAt(x, y + 1)) {
          world[y][x] = Tile.CHEST;
          chests += 1;
        }
      }

      // Trees.
      for (let x = 6; x < WORLD_W - 6; x += 1) {
        if (Math.abs(x - sx) <= 7) continue;
        if (rand() < 0.095) {
          const ground = surface[x];
          const trunk = 3 + Math.floor(rand() * 3);
          for (let y = ground - trunk; y < ground; y += 1) world[y][x] = Tile.WOOD;
          for (let ox = -2; ox <= 2; ox += 1) {
            for (let oy = -2; oy <= 1; oy += 1) {
              if (Math.abs(ox) + Math.abs(oy) < 4 && rand() > 0.12) {
                const tx = x + ox;
                const ty = ground - trunk + oy;
                if (tx > 1 && tx < WORLD_W - 2 && ty > 2 && world[ty][tx] === AIR) {
                  world[ty][tx] = Tile.LEAVES;
                }
              }
            }
          }
        }
      }

      // Spawn shaft down the middle.
      const sy = surface[sx] - 2;
      for (let y = sy - 7; y < sy + 18; y += 1) {
        for (let x = sx - 2; x <= sx + 2; x += 1) {
          if (y >= 0 && y < WORLD_H) world[y][x] = AIR;
        }
        if (y >= sy + 2) world[y][sx] = Tile.LADDER;
        if (y === sy + 7 || y === sy + 15) world[y][sx + 1] = Tile.TORCH;
      }
      return { world, surface, spawn: { x: sx - 3, y: sy }, shaft: { x: sx, y: sy }, secrets };
    }

    // Mobs are part of the world, decided at generation time like ores: they
    // live at fixed homes in the caves and only get a sprite when the player
    // comes near. Killed mobs are gone for good (minus a small dawn repop).
    pickMobKind(depth, roll) {
      if (depth > 150) return roll < 0.28 ? "golem" : roll < 0.56 ? "crawler" : roll < 0.8 ? "slime" : "bat";
      if (depth > 60) return roll < 0.45 ? "crawler" : roll < 0.72 ? "slime" : "bat";
      return roll < 0.62 ? "crawler" : "slime";
    }

    generateMobs(rand = Math.random) {
      const mobs = [];
      this.mobSeq = 1;
      const solidAt = (x, y) => {
        const t = this.tileAt(x, y);
        return t !== AIR && BLOCKS[t] && BLOCKS[t].solid;
      };
      for (let x = 3; x < WORLD_W - 3 && mobs.length < 140; x += 1) {
        const surfaceY = this.surface[x] || 24;
        for (let y = surfaceY + 16; y < WORLD_H - 6; y += 1) {
          // Needs a 2-tall air pocket standing on solid ground (not lava).
          if (this.world[y][x] !== AIR || this.world[y - 1][x] !== AIR) continue;
          if (!solidAt(x, y + 1)) continue;
          if (Math.abs(x - this.shaft.x) <= 10 && y <= this.shaft.y + 24) continue;
          const depth = y - surfaceY;
          const density = depth > 150 ? 0.06 : depth > 60 ? 0.045 : 0.03;
          if (rand() >= density) continue;
          const kind = this.pickMobKind(depth, rand());
          mobs.push({ id: this.mobSeq++, x, y: kind === "bat" ? y - 1 : y, kind });
          y += 5; // keep packs from clumping in one column
        }
      }
      for (const secret of this.secrets || []) {
        if (!secret.boss) continue;
        mobs.push({
          id: this.mobSeq++,
          x: secret.boss.x,
          y: secret.boss.y,
          kind: secret.boss.kind,
          boss: true,
          secretId: secret.id
        });
      }
      return mobs;
    }

    addMob(x, y, kind, extra = {}) {
      const mob = { id: this.mobSeq++, x, y, kind, ...extra };
      this.mobs.push(mob);
      return mob;
    }

    rebuildLights() {
      this.lights = [];
      if (!this.world) return;
      for (let y = 0; y < WORLD_H; y += 1) {
        for (let x = 0; x < WORLD_W; x += 1) {
          const t = this.world[y][x];
          if (t !== AIR && BLOCKS[t] && BLOCKS[t].light) this.lights.push({ x, y, t });
        }
      }
    }

    addLight(x, y, t) {
      this.lights.push({ x, y, t });
    }

    removeLightAt(x, y) {
      this.lights = this.lights.filter((l) => l.x !== x || l.y !== y);
    }

    secretAt(x, y) {
      return (this.secrets || []).find((secret) => secret.chest?.x === x && secret.chest?.y === y) || null;
    }

    markSecretOpened(secret) {
      if (!secret || secret.opened) return false;
      secret.opened = true;
      this.stats.secrets += 1;
      return true;
    }

    repairSpawnShaft() {
      if (!this.world || !this.spawn) return;
      const shaft = this.shaft || { x: this.spawn.x, y: this.spawn.y };
      const sx = shaft.x;
      const sy = shaft.y;
      this.shaft = { x: sx, y: sy };
      this.spawn = { x: clamp(sx - 3, 1, WORLD_W - 2), y: sy };
      const floorY = sy + 2;

      for (let y = sy - 7; y < sy + 18; y += 1) {
        if (y < 0 || y >= WORLD_H) continue;
        for (let x = sx - 2; x <= sx + 2; x += 1) {
          if (x >= 0 && x < WORLD_W) this.world[y][x] = AIR;
        }
        if (y >= sy + 2) this.world[y][sx] = Tile.LADDER;
        if (y === sy + 7 || y === sy + 15) this.world[y][sx + 1] = Tile.TORCH;
      }

      for (let x = sx - 4; x <= sx + 4; x += 1) {
        if (x < 0 || x >= WORLD_W || floorY >= WORLD_H) continue;
        if (Math.abs(x - sx) > 1) this.world[floorY][x] = Tile.GRASS;
        else this.world[floorY][x] = AIR;
      }
      for (let y = floorY + 1; y <= floorY + 4; y += 1) {
        if (y < 0 || y >= WORLD_H) continue;
        for (let x = sx - 4; x <= sx + 4; x += 1) {
          if (x < 0 || x >= WORLD_W) continue;
          if (Math.abs(x - sx) > 1) this.world[y][x] = Tile.DIRT;
          else this.world[y][x] = x === sx ? Tile.LADDER : AIR;
        }
      }
      this.world[floorY][sx] = Tile.LADDER;
      this.world[floorY - 1][this.spawn.x] = AIR;
      this.world[floorY - 2][this.spawn.x] = AIR;
      this.world[floorY - 1][this.spawn.x - 1] = AIR;
      this.world[floorY - 2][this.spawn.x - 1] = AIR;
      this.world[floorY - 1][this.spawn.x + 1] = AIR;
      this.world[floorY - 2][this.spawn.x + 1] = AIR;
      if (Array.isArray(this.lights)) this.rebuildLights();
      if (Array.isArray(this.mobs)) {
        this.mobs = this.mobs.filter((m) => Math.abs(m.x - sx) > 10 || m.y > sy + 24);
      }
    }

    spawnFloorY() {
      return (this.shaft?.y ?? this.spawn.y) + 2;
    }

    hasStableSpawnFloor() {
      const x = this.spawn?.x;
      const y = this.spawnFloorY();
      if (x === undefined || y < 2 || y >= WORLD_H) return false;
      const floor = this.tileAt(x, y);
      return floor !== AIR && floor !== Tile.PLATFORM && BLOCKS[floor]?.solid && this.hasHeadClearance(x, y);
    }

    safeSpawnPixels() {
      if (!this.hasStableSpawnFloor()) this.repairSpawnShaft();
      const floorTop = this.spawnFloorY() * TILE;
      return {
        x: this.spawn.x * TILE + TILE / 2,
        y: floorTop - 17
      };
    }

    hasPlayerSupport(player = this.player) {
      if (!player) return false;
      const centerX = clamp(Math.floor(player.x / TILE), 0, WORLD_W - 1);
      const bodyY = clamp(Math.floor(player.y / TILE), 0, WORLD_H - 1);
      const footY = clamp(Math.floor((player.y + 18) / TILE), 0, WORLD_H - 1);
      const bodyTile = this.tileAt(centerX, bodyY);
      if (bodyTile === Tile.LADDER || this.tileAt(centerX, footY) === Tile.LADDER) return true;
      const footTile = this.tileAt(centerX, footY);
      return footTile !== AIR && BLOCKS[footTile]?.solid && this.hasHeadClearance(centerX, footY);
    }

    snapPlayerToTileCenter(player = this.player) {
      if (!player) return this.safeSpawnPixels();
      const centerX = clamp(Math.floor(player.x / TILE), 1, WORLD_W - 2);
      const footY = clamp(Math.floor((player.y + 18) / TILE), 0, WORLD_H - 1);
      const bodyY = clamp(Math.floor(player.y / TILE), 0, WORLD_H - 1);
      if (this.tileAt(centerX, bodyY) === Tile.LADDER || this.tileAt(centerX, footY) === Tile.LADDER) {
        return { x: centerX * TILE + TILE / 2, y: player.y };
      }
      const footTile = this.tileAt(centerX, footY);
      if (footTile !== AIR && BLOCKS[footTile]?.solid && this.hasHeadClearance(centerX, footY)) {
        return { x: centerX * TILE + TILE / 2, y: footY * TILE - 17 };
      }
      return this.nearestSafePlayerPixels(player);
    }

    hasHeadClearance(x, floorY) {
      const upper = this.tileAt(x, floorY - 1);
      const head = this.tileAt(x, floorY - 2);
      return (upper === AIR || !BLOCKS[upper]?.solid) && (head === AIR || !BLOCKS[head]?.solid);
    }

    nearestSafePlayerPixels(player = this.player) {
      if (!player) return this.safeSpawnPixels();
      const startX = clamp(Math.floor(player.x / TILE), 1, WORLD_W - 2);
      const startY = clamp(Math.floor((player.y + 18) / TILE), 0, WORLD_H - 2);

      for (let y = startY; y < Math.min(WORLD_H - 2, startY + 5); y += 1) {
        for (let radius = 0; radius <= 3; radius += 1) {
          for (const x of [startX - radius, startX + radius]) {
            if (x < 1 || x >= WORLD_W - 1) continue;
            const t = this.tileAt(x, y);
            if (t !== AIR && BLOCKS[t]?.solid && this.hasHeadClearance(x, y)) {
              return { x: x * TILE + TILE / 2, y: y * TILE - 17 };
            }
          }
        }
      }

      return this.safeSpawnPixels();
    }

    repairPlayerPosition(force = false) {
      const safe = this.safeSpawnPixels();
      if (force || !this.player) {
        this.player = safe;
        return;
      }
      const px = Math.floor(this.player.x / TILE);
      const py = Math.floor(this.player.y / TILE);
      const sx = this.shaft?.x ?? this.spawn.x + 3;
      const sy = this.shaft?.y ?? this.spawn.y;
      // Only the cleared shaft area counts — a save made deep below the shaft
      // column must not get teleported back to the surface.
      const inStartDrop = Math.abs(px - sx) <= 10 && py >= sy - 4 && py <= sy + 24;
      const belowWorld = py >= WORLD_H - 5;
      const unsupported = !this.hasPlayerSupport(this.player);
      if (inStartDrop || belowWorld || unsupported || !this.hasStableSpawnFloor()) {
        if (unsupported && !inStartDrop && !belowWorld) {
          this.player = this.nearestSafePlayerPixels(this.player);
          return;
        }
        this.player = safe;
      } else {
        this.player = this.snapPlayerToTileCenter(this.player);
      }
    }

    load() {
      try {
        const raw = localStorage.getItem(ML.SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.version !== 2 || !data.state || !Array.isArray(data.state.world)) return null;
        return data.state;
      } catch {
        return null;
      }
    }

    // Migrate pre-rename saves. Old MinerLand v2 saves live under the legacy
    // key; older v1 saves need a small equipment reset.
    loadLegacy() {
      try {
        const raw = localStorage.getItem(ML.LEGACY_SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !data.state || !Array.isArray(data.state.world)) return null;
        const state = data.state;
        if (data.version === 1) {
          delete state.torches;
          state.blade = 0;
          state.boots = false;
          state.lamp = 0;
        }
        // The legacy key is removed only after a v2 save succeeds (see save()).
        return state;
      } catch {
        return null;
      }
    }

    save(player) {
      if (player) {
        this.player = { x: player.x, y: player.y };
      }
      const state = {
        seed: this.seed,
        time: this.time,
        health: this.health,
        energy: this.energy,
        maxHealth: this.maxHealth,
        maxEnergy: this.maxEnergy,
        pickLevel: this.pickLevel,
        blade: this.blade,
        boots: this.boots,
        lamp: this.lamp,
        ward: this.ward,
        fallGuard: this.fallGuard,
        speedBoost: this.speedBoost,
        regenBoost: this.regenBoost,
        treasureSense: this.treasureSense,
        lootBonus: this.lootBonus,
        blastRadius: this.blastRadius,
        selected: this.selected,
        inventory: this.inventory,
        world: this.world,
        surface: this.surface,
        spawn: this.spawn,
        shaft: this.shaft,
        secrets: this.secrets,
        player: this.player,
        lights: this.lights,
        mobs: this.mobs,
        mobSeq: this.mobSeq,
        mobBaseline: this.mobBaseline,
        stats: this.stats,
        achievements: this.achievements,
        craftedRecipes: this.craftedRecipes
      };
      try {
        localStorage.setItem(ML.SAVE_KEY, JSON.stringify({ version: 2, state }));
        localStorage.removeItem(ML.LEGACY_SAVE_KEY);
        return true;
      } catch {
        return false;
      }
    }

    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return Tile.BEDROCK;
      return this.world[y][x];
    }

    setTile(x, y, tile) {
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return;
      this.world[y][x] = tile;
    }

    addItem(item, count) {
      this.inventory[item] = (this.inventory[item] || 0) + count;
    }

    removeItem(item, count) {
      if ((this.inventory[item] || 0) < count) return false;
      this.inventory[item] -= count;
      return true;
    }

    attackDamage() {
      return 1 + Math.floor(this.pickLevel / 2) + ML.BLADES[this.blade].bonus;
    }

    craft(recipe) {
      if (recipe.upgrade && this.pickLevel >= recipe.upgrade) return { ok: false, message: "Already built." };
      if (recipe.blade && this.blade >= recipe.blade) return { ok: false, message: "Already built." };
      if (recipe.lamp && this.lamp >= recipe.lamp) return { ok: false, message: "Already built." };
      if (recipe.boots && this.boots) return { ok: false, message: "Already built." };
      if (recipe.ward && this.ward) return { ok: false, message: "Already built." };
      if (recipe.fallGuard && this.fallGuard) return { ok: false, message: "Already built." };
      if (recipe.speedBoost && this.speedBoost) return { ok: false, message: "Already built." };
      if (recipe.regenBoost && this.regenBoost) return { ok: false, message: "Already built." };
      if (recipe.treasureSense && this.treasureSense) return { ok: false, message: "Already built." };
      if (recipe.lootBonus && this.lootBonus) return { ok: false, message: "Already built." };
      if (recipe.maxHealth && this.maxHealth >= recipe.maxHealth) return { ok: false, message: "Already built." };
      if (recipe.maxEnergy && this.maxEnergy >= recipe.maxEnergy) return { ok: false, message: "Already built." };
      if (recipe.blastRadius && this.blastRadius >= recipe.blastRadius) return { ok: false, message: "Already built." };
      if (!ML.canAfford(this.inventory, recipe.cost)) {
        return { ok: false, message: "Need " + ML.formatCost(recipe.cost) + "." };
      }
      ML.spend(this.inventory, recipe.cost);
      if (recipe.out) {
        for (const [item, count] of Object.entries(recipe.out)) this.addItem(item, count);
      }
      if (recipe.upgrade) this.pickLevel = recipe.upgrade;
      if (recipe.blade) this.blade = recipe.blade;
      if (recipe.lamp) this.lamp = recipe.lamp;
      if (recipe.boots) this.boots = true;
      if (recipe.ward) this.ward = true;
      if (recipe.fallGuard) this.fallGuard = true;
      if (recipe.speedBoost) this.speedBoost = true;
      if (recipe.regenBoost) this.regenBoost = true;
      if (recipe.treasureSense) this.treasureSense = true;
      if (recipe.lootBonus) this.lootBonus = true;
      if (recipe.maxHealth) {
        const oldMax = this.maxHealth;
        this.maxHealth = recipe.maxHealth;
        this.health = clamp(this.health + Math.max(0, this.maxHealth - oldMax), 0, this.maxHealth);
      }
      if (recipe.maxEnergy) {
        const oldMax = this.maxEnergy;
        this.maxEnergy = recipe.maxEnergy;
        this.energy = clamp(this.energy + Math.max(0, this.maxEnergy - oldMax), 0, this.maxEnergy);
      }
      if (recipe.blastRadius) this.blastRadius = recipe.blastRadius;
      this.stats.crafted += 1;
      this.craftedRecipes[recipe.id] = true;
      return { ok: true, message: `${recipe.name} crafted.` };
    }

    eat(item) {
      const meta = ML.ITEM_META[item];
      if (!meta || !meta.consumable) return { ok: false, message: "Not edible." };
      if (!this.removeItem(item, 1)) return { ok: false, message: `No ${meta.name}.` };
      this.health = clamp(this.health + meta.consumable.heal, 0, this.maxHealth);
      this.energy = clamp(this.energy + meta.consumable.energy, 0, this.maxEnergy);
      return { ok: true, message: `${meta.name}: +${meta.consumable.heal} health, +${meta.consumable.energy} energy.` };
    }
  }

  ML.MinerSim = MinerSim;
})();
