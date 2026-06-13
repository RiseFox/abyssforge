// AbyssForge v2 - world simulation: generation, save/load, inventory, crafting.
// Pure data layer: no Phaser objects in here.
(() => {
  "use strict";
  const ML = window.ML;
  const { TILE, WORLD_W, WORLD_H, HORIZONTAL_EXPAND_COLUMNS, AIR, Tile, BLOCKS, ENEMIES, MOB_SPAWN_RULES, clamp, mulberry32 } = ML;

  class MinerSim {
    constructor() {
      const saved = this.load();
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
      this.lampCharge = Number.isFinite(this.lampCharge) ? this.lampCharge : this.maxLampCharge();
      this.lampCharge = clamp(this.lampCharge, 0, this.maxLampCharge());
      this.maxHealth = this.maxHealth || 100;
      this.maxEnergy = this.maxEnergy || 100;
      this.ward = Boolean(this.ward);
      this.fallGuard = Boolean(this.fallGuard);
      this.speedBoost = Boolean(this.speedBoost);
      this.regenBoost = Boolean(this.regenBoost);
      this.treasureSense = Boolean(this.treasureSense);
      this.lootBonus = Boolean(this.lootBonus);
      this.recallCharm = Boolean(this.recallCharm);
      this.blastRadius = this.blastRadius || 0;
      this.shadowPressure = clamp(this.shadowPressure || 0, 0, 100);
      this.health = clamp(this.health ?? this.maxHealth, 0, this.maxHealth);
      this.energy = clamp(this.energy ?? this.maxEnergy, 0, this.maxEnergy);
      this.stats = Object.assign({
        mined: 0,
        deepest: 0,
        enemies: 0,
        bosses: 0,
        secrets: 0,
        chests: 0,
        crafted: 0,
        contracts: 0,
        events: 0,
        recalls: 0,
        campUses: 0,
        camps: 0,
        watcherSightings: 0,
        watcherTraces: 0,
        shadowPeaks: 0,
        worldExpansions: 0,
        horizontalExpansions: 0,
        surfaceDiscoveries: 0,
        observerAnomalies: 0,
        heroThoughts: 0,
        mobAwareness: 0,
        spatialRifts: 0
      }, this.stats || {});
      this.achievements = Object.assign({}, this.achievements || {});
      ML.LoreSystem?.ensure?.(this);
      this.craftedRecipes = Object.assign({}, this.craftedRecipes || {});
      this.campAnchors = Object.assign({}, this.campAnchors || {});
      this.lastCamp = this.lastCamp && Number.isFinite(this.lastCamp.x) && Number.isFinite(this.lastCamp.y)
        ? { x: this.lastCamp.x, y: this.lastCamp.y }
        : null;
      this.inventory = Object.assign(
        { dirt: 0, stone: 0, wood: 0, coal: 0, copper: 0, iron: 0, gold: 0, crystal: 0, obsidian: 0, gel: 0, coin: 0, silk: 0, fang: 0, relic: 0, core: 0, torch: 0, battery: 0, ladder: 0, platform: 0, charge: 0, mushroom: 0, kit: 0 },
        this.inventory || {}
      );
      if (!Array.isArray(this.secrets)) this.secrets = [];
      if (!Array.isArray(this.surfaceDiscoveries)) this.surfaceDiscoveries = [];
      if (!Array.isArray(this.lights)) this.rebuildLights();
      if (!Array.isArray(this.mobs)) {
        this.mobs = this.generateMobs();
        this.mobBaseline = this.mobs.length;
      }
      this.repairMobEcology();
      if (!this.mobSeq) this.mobSeq = this.mobs.reduce((max, m) => Math.max(max, m.id), 0) + 1;
      if (!this.mobBaseline) this.mobBaseline = Math.max(this.mobs.length, 1);
      this.contractSeq = this.contractSeq || 0;
      this.ensureContract();
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
      this.lampCharge = this.maxLampCharge();
      this.ward = false;
      this.fallGuard = false;
      this.speedBoost = false;
      this.regenBoost = false;
      this.treasureSense = false;
      this.lootBonus = false;
      this.recallCharm = false;
      this.blastRadius = 0;
      this.shadowPressure = 0;
      this.selected = 3;
      this.inventory = {
        dirt: 0, stone: 0, wood: 8, coal: 2, copper: 0, iron: 0, gold: 0, crystal: 0,
        obsidian: 0, gel: 0, coin: 0, silk: 0, fang: 0, relic: 0, core: 0,
        torch: 6, battery: 1, ladder: 8, platform: 0, charge: 0, mushroom: 0, kit: 1
      };
      const generated = this.generateWorld(seed);
      this.world = generated.world;
      this.surface = generated.surface;
      this.spawn = generated.spawn;
      this.shaft = generated.shaft;
      this.secrets = generated.secrets || [];
      this.stats = {
        mined: 0,
        deepest: 0,
        enemies: 0,
        bosses: 0,
        secrets: 0,
        chests: 0,
        crafted: 0,
        contracts: 0,
        events: 0,
        recalls: 0,
        campUses: 0,
        camps: 0,
        watcherSightings: 0,
        watcherTraces: 0,
        shadowPeaks: 0,
        worldExpansions: 0,
        horizontalExpansions: 0,
        surfaceDiscoveries: 0,
        observerAnomalies: 0,
        heroThoughts: 0,
        mobAwareness: 0,
        spatialRifts: 0
      };
      this.achievements = {};
      this.surfaceDiscoveries = [];
      this.lore = ML.LoreSystem?.initialState?.() || { awakened: false, notes: {}, lastNoteId: null, completedGoals: {} };
      this.craftedRecipes = {};
      this.campAnchors = {};
      this.lastCamp = null;
      this.contractSeq = 0;
      this.contract = null;
      this.repairSpawnShaft();
      this.player = this.safeSpawnPixels();
      this.rebuildLights();
      this.mobs = this.generateMobs(mulberry32(seed ^ 0x9e3779b9));
      this.mobBaseline = this.mobs.length;
      this.repairPlayerPosition(true);
      this.ensureContract();
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
            world[y][x] = this.deepTileFor(x, y, rand, surface);
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
          let campX = roomX + w - 3;
          if (campX === chestX || campX === lampX) campX = roomX + 2;
          if (campX === chestX || campX === lampX) campX = roomX + 1;
          world[floorY][chestX] = Tile.CHEST;
          world[floorY][lampX] = tier >= 2 ? Tile.MUSHROOM : Tile.TORCH;
          if (!bossKind) world[floorY][campX] = Tile.CAMPFIRE;

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
            chest: { x: chestX, y: floorY },
            camp: !bossKind ? { x: campX, y: floorY } : null
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

    worldHeight() {
      return Array.isArray(this.world) ? this.world.length : WORLD_H;
    }

    worldWidth() {
      return Array.isArray(this.world?.[0]) ? this.world[0].length : WORLD_W;
    }

    canOpenDepthSeam(x, y) {
      return y >= this.worldHeight() - 7 && x > 1 && x < this.worldWidth() - 2;
    }

    depthAtTile(x, y, surfaceOverride = this.surface) {
      const tx = clamp(Math.floor(x), 0, this.worldWidth() - 1);
      return Math.max(0, Math.floor(y) - (surfaceOverride?.[tx] || 24));
    }

    stratumForDepth(depth = 0) {
      const profiles = ML.STRATA_PROFILES || [];
      if (!profiles.length) return null;
      let active = profiles[0];
      for (const profile of profiles) {
        if (depth >= (profile.minDepth || 0)) active = profile;
      }
      return active;
    }

    stratumAt(x, y, surfaceOverride = this.surface) {
      return this.stratumForDepth(this.depthAtTile(x, y, surfaceOverride));
    }

    weightedPick(weights, rand = Math.random) {
      const entries = Object.entries(weights || {}).filter(([, weight]) => weight > 0);
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (total <= 0) return null;
      let roll = rand() * total;
      for (const [id, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return id;
      }
      return entries[entries.length - 1]?.[0] || null;
    }

    deepTileForColumn(y, surfaceY, rand) {
      const depth = y - surfaceY;
      const profile = this.stratumForDepth(depth);
      let tile = depth > (profile?.deepAt ?? 210) ? Tile.DEEP : Tile.STONE;
      const ores = profile?.ores || [];
      for (let i = ores.length - 1; i >= 0; i -= 1) {
        const ore = ores[i];
        if (depth < (ore.minDepth || 0)) continue;
        if (rand() < (ore.chance || 0)) {
          tile = ore.tile;
          break;
        }
      }
      return tile;
    }

    deepTileFor(x, y, rand, surfaceOverride = this.surface) {
      return this.deepTileForColumn(y, surfaceOverride?.[x] || 24, rand);
    }

    carveAirCircle(cx, cy, radius, minY = 1, maxY = this.worldHeight() - 2) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        for (let oy = -radius; oy <= radius; oy += 1) {
          if (ox * ox + oy * oy > radius * radius + 0.7) continue;
          const x = cx + ox;
          const y = cy + oy;
          if (x <= 2 || x >= this.worldWidth() - 3 || y < minY || y > maxY) continue;
          this.world[y][x] = AIR;
        }
      }
    }

    edgeProfile(direction = "right", sampleWidth = 12) {
      if (!Array.isArray(this.world) || !Array.isArray(this.surface)) return null;
      const width = this.worldWidth();
      const height = this.worldHeight();
      const left = direction === "left";
      const edgeX = left ? 0 : width - 1;
      const inward = left ? 1 : -1;
      const samples = [];
      const maxSamples = clamp(Math.floor(sampleWidth), 4, Math.min(24, width));
      for (let i = 0; i < maxSamples; i += 1) {
        const x = clamp(edgeX + inward * i, 0, width - 1);
        samples.push({
          x,
          surface: this.surface[x] || 24,
          cells: this.world.map((row) => row[x])
        });
      }
      const edgeSurface = this.surface[edgeX] || 24;
      const innerSurface = samples[samples.length - 1]?.surface || edgeSurface;
      const surfaceSlope = clamp((edgeSurface - innerSurface) / Math.max(1, samples.length - 1), -0.72, 0.72);
      const isOpenTile = (tile) => tile === AIR || (tile !== Tile.LAVA && BLOCKS[tile] && !BLOCKS[tile].solid);
      let airTiles = 0;
      let totalTiles = 0;
      let run = null;
      const openings = [];

      for (let y = Math.max(2, edgeSurface + 5); y < height - 7; y += 1) {
        let rowOpen = false;
        for (const sample of samples) {
          if (y <= sample.surface + 4) continue;
          totalTiles += 1;
          if (isOpenTile(sample.cells[y])) {
            airTiles += 1;
            if (Math.abs(sample.x - edgeX) <= 3) rowOpen = true;
          }
        }
        if (rowOpen) {
          if (!run) run = { start: y, end: y, weight: 1 };
          else {
            run.end = y;
            run.weight += 1;
          }
        } else if (run) {
          openings.push(run);
          run = null;
        }
      }
      if (run) openings.push(run);

      return {
        side: left ? "left" : "right",
        left,
        edgeX,
        edgeSurface,
        surfaceSlope,
        openness: totalTiles ? airTiles / totalTiles : 0,
        samples,
        openings: openings
          .map((entry) => ({
            y: Math.round((entry.start + entry.end) / 2),
            height: entry.end - entry.start + 1,
            radius: clamp(Math.ceil((entry.end - entry.start + 1) / 3), 1, 3),
            weight: entry.weight
          }))
          .filter((entry) => entry.height >= 2)
          .slice(0, 18)
      };
    }

    naturalEdgeTile(tile) {
      return tile !== AIR
        && tile !== Tile.BEDROCK
        && tile !== Tile.CHEST
        && tile !== Tile.CAMPFIRE
        && tile !== Tile.PLATFORM
        && tile !== Tile.LADDER
        && tile !== Tile.TORCH
        && tile !== Tile.WOOD
        && tile !== Tile.LEAVES
        && tile !== Tile.SIGN
        && BLOCKS[tile]?.solid;
    }

    edgeSolidTileAt(profile, y, rand = Math.random) {
      const candidates = [];
      for (const sample of profile?.samples || []) {
        const tile = sample.cells?.[y];
        if (this.naturalEdgeTile(tile)) candidates.push(tile);
      }
      if (!candidates.length) return null;
      return candidates[Math.floor(rand() * candidates.length)];
    }

    horizonTileForColumn(y, surfaceY, rand, profile, distanceFromSeam = 0) {
      let tile = this.deepTileForColumn(y, surfaceY, rand);
      const edgeTile = this.edgeSolidTileAt(profile, y, rand);
      const inheritChance = clamp(0.66 - distanceFromSeam * 0.035, 0.08, 0.66);
      if (edgeTile !== null && rand() < inheritChance) tile = edgeTile;
      return tile;
    }

    surfaceFloorY(x) {
      return this.surface?.[x] ?? 24;
    }

    hasSurfaceClearance(x, floorY, height = 6) {
      for (let y = floorY - height; y < floorY; y += 1) {
        if (y <= 1) continue;
        const tile = this.tileAt(x, y);
        if (tile !== AIR && BLOCKS[tile]?.solid) return false;
      }
      return true;
    }

    placeSurfaceSign(x, type, title, message, rand = Math.random) {
      x = clamp(Math.floor(x), 2, this.worldWidth() - 3);
      const floorY = this.surfaceFloorY(x);
      const y = floorY - 1;
      const floor = this.tileAt(x, floorY);
      if (!BLOCKS[floor]?.solid || y < 2) return null;
      for (let yy = y - 2; yy <= y; yy += 1) {
        if (yy >= 0 && yy < this.worldHeight()) this.world[yy][x] = AIR;
      }
      this.world[y][x] = Tile.SIGN;
      const id = `surf-${type}-${this.surfaceDiscoveries.length + 1}-${Math.abs((x * 73856093) ^ (y * 19349663) ^ Math.floor(rand() * 99991))}`;
      const discovery = { id, type, title, message, x, y, seen: false, read: false };
      this.surfaceDiscoveries.push(discovery);
      return discovery;
    }

    flattenSurfaceRange(x0, x1, targetY) {
      const width = this.worldWidth();
      const height = this.worldHeight();
      for (let x = clamp(x0, 2, width - 3); x <= clamp(x1, 2, width - 3); x += 1) {
        const oldSurface = this.surfaceFloorY(x);
        const y = clamp(targetY, 16, 36);
        this.surface[x] = y;
        for (let yy = Math.max(1, y - 8); yy < y; yy += 1) this.world[yy][x] = AIR;
        this.world[y][x] = Tile.GRASS;
        for (let yy = y + 1; yy < Math.min(height - 4, y + 5); yy += 1) {
          if (yy < oldSurface - 1) this.world[yy][x] = Tile.DIRT;
          else if (this.world[yy][x] === AIR) this.world[yy][x] = Tile.DIRT;
        }
      }
    }

    buildSurfaceShelter(centerX, floorY, rand = Math.random) {
      const left = clamp(centerX - 4, 2, this.worldWidth() - 8);
      const right = left + 7;
      for (let x = left; x <= right; x += 1) {
        for (let y = floorY - 6; y < floorY; y += 1) this.world[y][x] = AIR;
      }
      for (let y = floorY - 4; y < floorY; y += 1) {
        this.world[y][left] = Tile.WOOD;
        this.world[y][right] = Tile.WOOD;
      }
      for (let x = left; x <= right; x += 1) {
        this.world[floorY - 5][x] = Tile.PLATFORM;
      }
      const chestX = clamp(left + 2 + Math.floor(rand() * 3), left + 1, right - 1);
      this.world[floorY - 1][chestX] = Tile.CHEST;
      const torchX = clamp(right - 1, left + 1, right - 1);
      if (torchX !== chestX && rand() < 0.55) this.world[floorY - 1][torchX] = Tile.TORCH;
    }

    addSurfaceDiscovery(type, x, side, rand = Math.random) {
      const distance = Math.max(0, Math.abs(x - (this.shaft?.x || this.spawn?.x || Math.floor(this.worldWidth() / 2))));
      const signMessages = [
        "The road keeps walking after the map stops. Count your campfires, not your steps.",
        "Guild survey mark: if the sky is still here, the forge has not closed the loop.",
        "Do not dig under quiet roofs. They remember names better than stone does.",
        "A watcher was seen at noon. Nobody believed the report."
      ];
      const sideName = side === "left" ? "western" : "eastern";
      const titleByType = {
        sign: `${sideName} road sign`,
        waypost: `${sideName} waypost`,
        hamlet: `silent ${sideName} hamlet`
      };
      const messageByType = {
        sign: signMessages[Math.floor(rand() * signMessages.length)],
        waypost: `The ${sideName} waypost still has warm ash. Someone crossed ${distance} tiles from the shaft and did not return underground.`,
        hamlet: `A dead surface hamlet: roofs, a cache, and no footprints. The mine was not the only place that moved.`
      };
      const discovery = this.placeSurfaceSign(x, type, titleByType[type] || "surface mark", messageByType[type] || signMessages[0], rand);
      if (discovery) discovery.distance = distance;
      return discovery;
    }

    generateSurfaceLandmarks(regionStart, regionEnd, side, rand = Math.random) {
      if (!Array.isArray(this.surfaceDiscoveries)) this.surfaceDiscoveries = [];
      const width = this.worldWidth();
      const minX = clamp(regionStart + 6, 3, width - 4);
      const maxX = clamp(regionEnd - 6, 3, width - 4);
      const discoveries = [];
      const span = Math.max(1, maxX - minX);
      const candidates = [];
      for (let tries = 0; tries < 160; tries += 1) {
        const x = minX + Math.floor(rand() * span);
        const y = this.surfaceFloorY(x);
        if (y < 17 || y > 36) continue;
        const floor = this.tileAt(x, y);
        if (!BLOCKS[floor]?.solid || !this.hasSurfaceClearance(x, y, 7)) continue;
        if (Math.abs(x - (this.shaft?.x || -9999)) < 18) continue;
        candidates.push({ x, y });
      }
      if (!candidates.length) return discoveries;

      const primary = candidates[Math.floor(rand() * candidates.length)];
      const roll = rand();
      if (roll < 0.2 && candidates.length > 4) {
        const targetY = primary.y;
        this.flattenSurfaceRange(primary.x - 11, primary.x + 12, targetY);
        this.buildSurfaceShelter(primary.x - 5, targetY, rand);
        this.buildSurfaceShelter(primary.x + 6, targetY, rand);
        this.world[targetY - 1][primary.x] = Tile.CAMPFIRE;
        discoveries.push(this.addSurfaceDiscovery("hamlet", primary.x - 9, side, rand));
      } else if (roll < 0.62) {
        const targetY = primary.y;
        this.flattenSurfaceRange(primary.x - 4, primary.x + 5, targetY);
        this.world[targetY - 1][primary.x + 2] = Tile.CAMPFIRE;
        this.world[targetY - 1][primary.x - 2] = Tile.CHEST;
        discoveries.push(this.addSurfaceDiscovery("waypost", primary.x, side, rand));
      } else {
        discoveries.push(this.addSurfaceDiscovery("sign", primary.x, side, rand));
      }

      if (rand() < 0.34 && candidates.length > 8) {
        const extra = candidates[Math.floor(rand() * candidates.length)];
        if (Math.abs(extra.x - primary.x) > 14) discoveries.push(this.addSurfaceDiscovery("sign", extra.x, side, rand));
      }
      return discoveries.filter(Boolean);
    }

    surfaceDiscoveryAt(x, y) {
      return (this.surfaceDiscoveries || []).find((entry) => Math.abs(entry.x - x) <= 1 && Math.abs(entry.y - y) <= 1) || null;
    }

    shiftTileCoordinates(deltaX) {
      if (!deltaX) return;
      const shiftPoint = (point) => {
        if (point && Number.isFinite(point.x)) point.x += deltaX;
      };
      shiftPoint(this.spawn);
      shiftPoint(this.shaft);
      shiftPoint(this.lastCamp);
      for (const secret of this.secrets || []) {
        secret.x += deltaX;
        shiftPoint(secret.chest);
        shiftPoint(secret.camp);
        shiftPoint(secret.boss);
      }
      for (const light of this.lights || []) shiftPoint(light);
      for (const mob of this.mobs || []) shiftPoint(mob);
      for (const discovery of this.surfaceDiscoveries || []) shiftPoint(discovery);
      if (this.player && Number.isFinite(this.player.x)) this.player.x += deltaX * TILE;
      if (this.campAnchors && typeof this.campAnchors === "object") {
        const shifted = {};
        for (const [key, value] of Object.entries(this.campAnchors)) {
          const [x, y] = key.split(":").map(Number);
          if (Number.isFinite(x) && Number.isFinite(y)) shifted[`${x + deltaX}:${y}`] = value;
          else shifted[key] = value;
        }
        this.campAnchors = shifted;
      }
    }

    extendHorizontal(direction = "right", columns = HORIZONTAL_EXPAND_COLUMNS || 96) {
      if (!Array.isArray(this.world) || !Array.isArray(this.surface)) return null;
      const side = direction === "left" ? "left" : "right";
      const addColumns = clamp(Math.floor(columns), 48, 160);
      const oldWidth = this.worldWidth();
      const height = this.worldHeight();
      const left = side === "left";
      const edgeX = left ? 0 : oldWidth - 1;
      const profile = this.edgeProfile(side, 14);
      const seedMix = (this.seed
        ^ (oldWidth * 1103515245)
        ^ (height * 2654435761)
        ^ (((this.stats.horizontalExpansions || 0) + 1) * 2246822519)
        ^ (Math.round((profile?.openness || 0) * 10000) * 374761393)
        ^ ((profile?.edgeSurface || 24) * 668265263)
        ^ (left ? 0x51f15e : 0xe451de)) >>> 0;
      const rand = mulberry32(seedMix);

      const outwardSurfaces = [];
      let surfaceFloat = profile?.edgeSurface ?? this.surface[edgeX] ?? 24;
      let surfaceY = Math.round(surfaceFloat);
      let trend = profile?.surfaceSlope || 0;
      for (let i = 0; i < addColumns; i += 1) {
        const noise = (rand() - 0.5) * 1.55 + (rand() < 0.08 ? (rand() < 0.5 ? -1 : 1) : 0);
        surfaceFloat = clamp(surfaceFloat + trend * 0.85 + noise, 17, 34);
        surfaceY = clamp(Math.round(surfaceFloat), 17, 34);
        trend *= 0.94;
        outwardSurfaces.push(surfaceY);
      }
      const newSurfaces = left ? outwardSurfaces.reverse() : outwardSurfaces;
      let inheritedTiles = 0;
      const newColumns = newSurfaces.map((colSurface, index) => {
        const distanceFromSeam = left ? addColumns - 1 - index : index;
        const column = Array(height).fill(AIR);
        for (let y = colSurface; y < height; y += 1) {
          if (y >= height - 4) column[y] = Tile.BEDROCK;
          else if (y === colSurface) column[y] = Tile.GRASS;
          else if (y < colSurface + 5) column[y] = Tile.DIRT;
          else {
            const edgeTile = this.edgeSolidTileAt(profile, y, rand);
            column[y] = this.horizonTileForColumn(y, colSurface, rand, profile, distanceFromSeam);
            if (edgeTile !== null && column[y] === edgeTile) inheritedTiles += 1;
          }
        }
        return column;
      });

      for (let y = 0; y < height; y += 1) {
        const cells = newColumns.map((column) => column[y]);
        if (left) this.world[y].unshift(...cells);
        else this.world[y].push(...cells);
      }
      if (left) {
        this.surface.unshift(...newSurfaces);
        this.shiftTileCoordinates(addColumns);
      } else {
        this.surface.push(...newSurfaces);
      }

      const regionStart = left ? 0 : oldWidth;
      const regionEnd = regionStart + addColumns - 1;
      const minX = regionStart + 4;
      const maxX = regionEnd - 4;
      const randX = () => minX + Math.floor(rand() * Math.max(1, maxX - minX + 1));
      const solidAt = (x, y) => {
        const t = this.tileAt(x, y);
        return t !== AIR && BLOCKS[t]?.solid;
      };

      const seamX = left ? addColumns : oldWidth - 1;
      const outDir = left ? -1 : 1;
      let edgeCorridors = 0;
      for (const opening of profile?.openings || []) {
        let x = seamX;
        let y = clamp(opening.y, (this.surface[clamp(seamX, 0, this.worldWidth() - 1)] || 24) + 6, height - 8);
        const length = clamp(10 + opening.height * 2 + Math.floor(rand() * 24), 10, addColumns - 6);
        const radius = clamp(opening.radius, 1, 3);
        for (let step = 0; step < length; step += 1) {
          x += outDir;
          if (x < regionStart || x > regionEnd) break;
          y = clamp(y + Math.floor(rand() * 3) - 1, (this.surface[x] || 24) + 6, height - 8);
          this.carveAirCircle(x, y, radius, (this.surface[x] || 24) + 4, height - 6);
          if (rand() < 0.18) this.carveAirCircle(x, y + (rand() < 0.5 ? -1 : 1), Math.max(1, radius - 1), (this.surface[x] || 24) + 4, height - 6);
        }
        edgeCorridors += 1;
      }

      for (let i = 0; i < 5; i += 1) {
        const base = this.surface[clamp(seamX, 0, this.worldWidth() - 1)] || 24;
        const y = clamp(base + 20 + i * 38 + Math.floor(rand() * 12), base + 9, height - 8);
        const start = left ? seamX - 8 : seamX - 5;
        const end = left ? seamX + 5 : seamX + 8;
        for (let x = start; x <= end; x += 1) this.carveAirCircle(x, y, rand() < 0.35 ? 2 : 1, base + 4, height - 6);
      }

      const caveWorms = Math.max(20, Math.round(addColumns * (0.42 + (profile?.openness || 0) * 0.95)));
      for (let c = 0; c < caveWorms; c += 1) {
        let x = randX();
        let y = (this.surface[x] || 24) + 18 + Math.floor(rand() * Math.max(16, height - (this.surface[x] || 24) - 32));
        let radius = rand() < 0.7 ? 1 : 2;
        const steps = 24 + Math.floor(rand() * 70);
        for (let i = 0; i < steps; i += 1) {
          this.carveAirCircle(x, y, radius, (this.surface[x] || 24) + 5, height - 6);
          x = clamp(x + Math.floor(rand() * 3) - 1, minX, maxX);
          y = clamp(y + Math.floor(rand() * 3) - 1, (this.surface[x] || 24) + 8, height - 8);
          if (rand() < 0.13) radius = radius === 1 ? 2 : 1;
        }
      }

      let chests = 0;
      let camps = 0;
      const featureSpots = [];
      for (let tries = 0; tries < 420; tries += 1) {
        const x = randX();
        const y = (this.surface[x] || 24) + 14 + Math.floor(rand() * Math.max(12, height - (this.surface[x] || 24) - 28));
        if (this.tileAt(x, y) !== AIR || !solidAt(x, y + 1)) continue;
        featureSpots.push({ x, y });
        const depth = this.mobDepthAt(x, y);
        if (chests < Math.max(6, Math.floor(addColumns / 16)) && rand() < 0.28) {
          this.world[y][x] = Tile.CHEST;
          chests += 1;
          continue;
        }
        if (camps < 2 && depth > 18 && rand() < 0.08) {
          this.world[y][x] = Tile.CAMPFIRE;
          camps += 1;
          continue;
        }
        if (rand() < 0.16) this.world[y][x] = Tile.MUSHROOM;
      }
      const targetChests = Math.max(3, Math.floor(addColumns / 24));
      for (const spot of featureSpots) {
        if (chests >= targetChests) break;
        if (this.world[spot.y][spot.x] !== AIR || !solidAt(spot.x, spot.y + 1)) continue;
        this.world[spot.y][spot.x] = Tile.CHEST;
        chests += 1;
      }
      if (camps < 1) {
        const campSpot = featureSpots.find((spot) => this.mobDepthAt(spot.x, spot.y) > 24 && this.world[spot.y][spot.x] === AIR && solidAt(spot.x, spot.y + 1));
        if (campSpot) {
          this.world[campSpot.y][campSpot.x] = Tile.CAMPFIRE;
          camps += 1;
        }
      }

      for (let y = 210; y < height - 8; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (this.world[y][x] === AIR && solidAt(x, y + 1) && rand() < 0.035) {
            this.world[y][x] = Tile.LAVA;
            if (this.world[y][x + 1] === AIR && solidAt(x + 1, y + 1) && rand() < 0.55) this.world[y][x + 1] = Tile.LAVA;
          }
        }
      }

      for (let x = minX; x <= maxX; x += 1) {
        if (Math.abs(x - (this.shaft?.x || -9999)) <= 9) continue;
        if (rand() >= 0.08) continue;
        const ground = this.surface[x] || 24;
        const trunk = 3 + Math.floor(rand() * 3);
        for (let y = ground - trunk; y < ground; y += 1) this.world[y][x] = Tile.WOOD;
        for (let ox = -2; ox <= 2; ox += 1) {
          for (let oy = -2; oy <= 1; oy += 1) {
            const tx = x + ox;
            const ty = ground - trunk + oy;
            if (tx <= 1 || tx >= this.worldWidth() - 2 || ty <= 2 || this.world[ty][tx] !== AIR) continue;
            if (Math.abs(ox) + Math.abs(oy) < 4 && rand() > 0.12) this.world[ty][tx] = Tile.LEAVES;
          }
        }
      }

      const surfaceDiscoveries = this.generateSurfaceLandmarks(regionStart, regionEnd, side, rand);

      let mobAdds = 0;
      const mobCap = Math.max(12, Math.floor(addColumns / 5));
      for (let tries = 0; tries < 360 && mobAdds < mobCap; tries += 1) {
        const x = randX();
        const y = (this.surface[x] || 24) + 16 + Math.floor(rand() * Math.max(12, height - (this.surface[x] || 24) - 24));
        const picked = this.pickMobForSpot(x, y, rand, { natural: true });
        if (!picked) continue;
        const depth = picked.y - (this.surface[x] || 24);
        this.addMob(x, picked.y, picked.kind, { elite: depth > 140 && rand() < 0.07 });
        mobAdds += 1;
      }
      if (mobAdds < 4) {
        for (const spot of featureSpots) {
          if (mobAdds >= 4) break;
          const picked = this.pickMobForSpot(spot.x, spot.y, rand, { natural: true });
          if (!picked) continue;
          const depth = picked.y - (this.surface[spot.x] || 24);
          this.addMob(spot.x, picked.y, picked.kind, { elite: depth > 140 && rand() < 0.07 });
          mobAdds += 1;
        }
      }

      this.rebuildLights();
      this.mobBaseline = Math.max(this.mobBaseline || 0, (this.mobs || []).length);
      this.stats.horizontalExpansions = (this.stats.horizontalExpansions || 0) + 1;
      return {
        direction: side,
        from: left ? 0 : oldWidth,
        to: this.worldWidth(),
        columns: addColumns,
        shiftTiles: left ? addColumns : 0,
        chests,
        camps,
        mobs: mobAdds,
        inheritedTiles,
        edgeOpenings: profile?.openings?.length || 0,
        edgeCorridors,
        edgeOpenness: profile?.openness || 0,
        edgeSurface: profile?.edgeSurface || this.surface[edgeX] || 24,
        nearestSurface: left ? this.surface[addColumns - 1] : this.surface[oldWidth],
        surfaceStep: Math.abs((profile?.edgeSurface || 24) - (left ? this.surface[addColumns - 1] : this.surface[oldWidth] || 24)),
        discoveries: surfaceDiscoveries.length
      };
    }

    extendDepth(entryX = Math.floor(WORLD_W / 2), rows = 96) {
      if (!Array.isArray(this.world)) return null;
      const width = this.worldWidth();
      const oldHeight = this.worldHeight();
      const addRows = clamp(Math.floor(rows), 48, 160);
      const newHeight = oldHeight + addRows;
      const seedMix = (this.seed ^ (oldHeight * 1103515245) ^ (entryX * 2654435761)) >>> 0;
      const rand = mulberry32(seedMix);
      entryX = clamp(Math.floor(entryX), 5, width - 6);
      const stratum = this.stratumAt(entryX, oldHeight) || this.stratumForDepth(oldHeight);
      const caveWorms = Math.max(18, Math.round(42 * (stratum?.caveWorms || 1)));
      const caveStepScale = stratum?.caveSteps || 1;
      const maxChests = stratum?.maxChests ?? 7;
      const maxCamps = stratum?.maxCamps ?? 2;
      const mobCap = stratum?.mobCap ?? 24;

      for (let y = Math.max(0, oldHeight - 8); y < oldHeight; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (this.world[y][x] === Tile.BEDROCK) this.world[y][x] = this.deepTileFor(x, y, rand);
        }
      }

      for (let y = oldHeight; y < newHeight; y += 1) {
        const row = Array(width).fill(AIR);
        for (let x = 0; x < width; x += 1) {
          row[x] = y >= newHeight - 4 ? Tile.BEDROCK : this.deepTileFor(x, y, rand);
        }
        this.world.push(row);
      }

      // Ensure the old bottom becomes an explorable seam instead of a hard stop.
      let riftX = entryX;
      for (let y = oldHeight - 10; y < Math.min(newHeight - 8, oldHeight + Math.floor(addRows * 0.62)); y += 1) {
        riftX = clamp(riftX + Math.floor(rand() * 3) - 1, 6, width - 7);
        const radius = rand() < 0.28 ? 2 : 1;
        this.carveAirCircle(riftX, y, radius, oldHeight - 12, newHeight - 6);
        if (rand() < (stratum?.ladderChance ?? 0.24)) this.world[y][clamp(riftX + (rand() < 0.5 ? -2 : 2), 2, width - 3)] = Tile.LADDER;
      }

      for (let c = 0; c < caveWorms; c += 1) {
        let x = 6 + Math.floor(rand() * (width - 12));
        let y = oldHeight + 4 + Math.floor(rand() * Math.max(1, addRows - 18));
        let radius = rand() < 0.68 ? 1 : 2;
        const steps = Math.round((18 + Math.floor(rand() * 58)) * caveStepScale);
        for (let i = 0; i < steps; i += 1) {
          this.carveAirCircle(x, y, radius, oldHeight - 6, newHeight - 6);
          x = clamp(x + Math.floor(rand() * 3) - 1, 4, width - 5);
          y = clamp(y + Math.floor(rand() * 3) - 1, oldHeight - 4, newHeight - 8);
          if (rand() < 0.13) radius = radius === 1 ? 2 : 1;
        }
      }

      const solidAt = (x, y) => {
        const t = this.tileAt(x, y);
        return t !== AIR && BLOCKS[t]?.solid;
      };
      let chests = 0;
      let camps = 0;
      for (let tries = 0; tries < 420; tries += 1) {
        const x = 5 + Math.floor(rand() * (width - 10));
        const y = oldHeight + 4 + Math.floor(rand() * Math.max(1, addRows - 16));
        if (this.tileAt(x, y) !== AIR || !solidAt(x, y + 1)) continue;
        if (chests < maxChests && rand() < (stratum?.cacheChance ?? 0.32)) {
          this.world[y][x] = Tile.CHEST;
          chests += 1;
          continue;
        }
        if (camps < maxCamps && rand() < (stratum?.campChance ?? 0.13)) {
          this.world[y][x] = Tile.CAMPFIRE;
          camps += 1;
          continue;
        }
        if (rand() < (stratum?.mushroomChance ?? 0.2)) this.world[y][x] = Tile.MUSHROOM;
      }

      for (let y = oldHeight + 8; y < newHeight - 8; y += 1) {
        for (let x = 4; x < width - 4; x += 1) {
          if (this.world[y][x] === AIR && solidAt(x, y + 1) && rand() < (stratum?.lavaChance ?? 0.045)) {
            this.world[y][x] = Tile.LAVA;
            if (this.world[y][x + 1] === AIR && solidAt(x + 1, y + 1) && rand() < (stratum?.lavaSpread ?? 0.55)) this.world[y][x + 1] = Tile.LAVA;
          }
        }
      }

      let mobAdds = 0;
      for (let tries = 0; tries < 320 && mobAdds < mobCap; tries += 1) {
        const x = 4 + Math.floor(rand() * (width - 8));
        const y = oldHeight + 6 + Math.floor(rand() * Math.max(1, addRows - 18));
        const picked = this.pickMobForSpot(x, y, rand, { natural: true });
        if (!picked) continue;
        const depth = picked.y - (this.surface[x] || 24);
        this.addMob(x, picked.y, picked.kind, { elite: depth > 190 && rand() < (stratum?.eliteChance ?? 0.08) });
        mobAdds += 1;
      }

      this.rebuildLights();
      this.mobBaseline = Math.max(this.mobBaseline || 0, (this.mobs || []).length);
      this.stats.worldExpansions = (this.stats.worldExpansions || 0) + 1;
      return { from: oldHeight, to: newHeight, rows: addRows, entryX, chests, camps, mobs: mobAdds, stratumId: stratum?.id, stratumName: stratum?.name };
    }

    // Mobs are part of the world, decided at generation time like ores: they
    // live at fixed homes in the caves and only get a sprite when the player
    // comes near. Killed mobs are gone for good (minus a small dawn repop).
    mobDepthAt(x, y) {
      const tx = clamp(Math.floor(x), 0, this.worldWidth() - 1);
      return Math.floor(y) - (this.surface?.[tx] || 24);
    }

    mobBiomeIdAt(x, y) {
      return ML.BiomeSystem?.biomeAt?.(this, x, y)?.id || "surface";
    }

    mobSpawnRule(kind) {
      return MOB_SPAWN_RULES?.[kind] || null;
    }

    insideSecretAt(x, y) {
      return (this.secrets || []).find((secret) =>
        x >= secret.x && x < secret.x + secret.w && y >= secret.y && y < secret.y + secret.h
      ) || null;
    }

    openSkyAt(x, y) {
      for (let yy = Math.floor(y); yy >= 0; yy -= 1) {
        const tile = this.tileAt(x, yy);
        if (tile !== AIR && BLOCKS[tile]?.solid) return false;
      }
      return true;
    }

    airPocketHeightAt(x, y, max = 5) {
      let height = 0;
      for (let yy = Math.floor(y); yy > 1 && height < max; yy -= 1) {
        if (this.tileAt(x, yy) !== AIR) break;
        height += 1;
      }
      return height;
    }

    hasCeilingAbove(x, y, range = 8) {
      for (let yy = Math.floor(y) - 1; yy >= Math.max(0, y - range); yy -= 1) {
        const tile = this.tileAt(x, yy);
        if (tile !== AIR && BLOCKS[tile]?.solid) return true;
      }
      return false;
    }

    floorWidthAt(x, floorY, maxRadius = 3) {
      let width = 1;
      for (const dir of [-1, 1]) {
        for (let step = 1; step <= maxRadius; step += 1) {
          const tile = this.tileAt(x + dir * step, floorY);
          if (tile === AIR || !BLOCKS[tile]?.solid) break;
          width += 1;
        }
      }
      return width;
    }

    localBlockLightAt(x, y) {
      if (!Array.isArray(this.lights)) return 0;
      let best = 0;
      for (const light of this.lights) {
        const block = BLOCKS[light.t];
        if (!block?.light) continue;
        const distance = Math.hypot(light.x - x, light.y - y);
        if (distance > block.light) continue;
        best = Math.max(best, block.light - distance);
      }
      return best;
    }

    mobHomeY(kind, floorY) {
      return ENEMIES[kind]?.fly ? floorY - 1 : floorY;
    }

    canSpawnMobAt(kind, x, y, context = {}) {
      const cfg = ENEMIES?.[kind];
      const rule = this.mobSpawnRule(kind);
      if (!cfg || !rule) return false;
      const width = this.worldWidth();
      const height = this.worldHeight();
      x = clamp(Math.floor(x), 1, width - 2);
      y = clamp(Math.floor(y), 1, height - 2);
      const depth = this.mobDepthAt(x, y);
      const biomeId = this.mobBiomeIdAt(x, y);

      if (rule.boss) {
        if (!context.boss && !context.secret) return false;
        if (depth < (rule.minDepth ?? 0)) return false;
        return Boolean(this.insideSecretAt(x, y));
      }

      if (rule.surfaceOnly) {
        if (!context.surface && !context.temporary && !context.nightRaid) return false;
        if (depth < (rule.minDepth ?? -2) || depth > (rule.maxDepth ?? 2)) return false;
        if (rule.biomes && !rule.biomes.includes(biomeId)) return false;
        if (this.tileAt(x, y) !== AIR) return false;
        const below = this.tileAt(x, y + 1);
        if (below === AIR || !BLOCKS[below]?.solid) return false;
        if (rule.openSky && !this.openSkyAt(x, y)) return false;
        return true;
      }

      if (context.surface || biomeId === "surface" || depth < (rule.minDepth ?? 0)) return false;
      if (rule.maxDepth !== undefined && depth > rule.maxDepth) return false;
      if (rule.biomes && !rule.biomes.includes(biomeId)) return false;
      if (this.openSkyAt(x, y)) return false;
      if (rule.ceiling && !this.hasCeilingAbove(x, y, rule.ceilingRange || 8)) return false;
      if (rule.maxLight !== undefined && this.localBlockLightAt(x, y) > rule.maxLight) return false;
      if (this.insideSecretAt(x, y) && !context.boss && !context.event && !context.summoned) return false;

      if (cfg.fly) {
        if (this.tileAt(x, y) !== AIR) return false;
        return this.airPocketHeightAt(x, y, rule.minAir || 2) >= (rule.minAir || 2);
      }

      if (this.tileAt(x, y) !== AIR || this.tileAt(x, y - 1) !== AIR) return false;
      const below = this.tileAt(x, y + 1);
      if (below === AIR || !BLOCKS[below]?.solid) return false;
      if (rule.floorWidth && this.floorWidthAt(x, y + 1, rule.floorWidth) < rule.floorWidth) return false;
      return true;
    }

    pickMobKind(depth, roll, context = {}) {
      const biomeId = context.biomeId || "stonewarrens";
      if (depth > 150) {
        if (biomeId === "obsidianabyss" || biomeId === "deepstone") return roll < 0.46 ? "golem" : roll < 0.7 ? "crawler" : roll < 0.86 ? "bat" : "slime";
        if (biomeId === "crystalvein") return roll < 0.34 ? "golem" : roll < 0.62 ? "bat" : roll < 0.82 ? "crawler" : "slime";
        return roll < 0.28 ? "golem" : roll < 0.56 ? "crawler" : roll < 0.8 ? "slime" : "bat";
      }
      if (depth > 60) {
        if (biomeId === "fungalhollow") return roll < 0.5 ? "slime" : roll < 0.78 ? "crawler" : "bat";
        if (biomeId === "ironfault") return roll < 0.5 ? "crawler" : roll < 0.72 ? "bat" : "slime";
        return roll < 0.45 ? "crawler" : roll < 0.72 ? "slime" : "bat";
      }
      if (biomeId === "fungalhollow") return roll < 0.68 ? "slime" : "crawler";
      return roll < 0.68 ? "crawler" : "slime";
    }

    mobCandidatesForDepth(depth) {
      if (depth > 150) return ["golem", "crawler", "bat", "slime"];
      if (depth > 80) return ["crawler", "slime", "bat", "golem"];
      return ["crawler", "slime", "bat"];
    }

    pickMobForSpot(x, floorY, rand = Math.random, context = {}) {
      const depth = this.mobDepthAt(x, floorY);
      const biomeId = this.mobBiomeIdAt(x, floorY);
      const first = this.pickMobKind(depth, rand(), { biomeId });
      const candidates = [first, ...this.mobCandidatesForDepth(depth)].filter((kind, index, list) => kind && list.indexOf(kind) === index);
      for (const kind of candidates) {
        const y = this.mobHomeY(kind, floorY);
        if (this.canSpawnMobAt(kind, x, y, context)) return { kind, y };
      }
      return null;
    }

    findValidMobHome(mob, radius = 6, context = {}) {
      for (let r = 0; r <= radius; r += 1) {
        for (let ox = -r; ox <= r; ox += 1) {
          for (let oy = -r; oy <= r; oy += 1) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
            const x = clamp((mob.x || 1) + ox, 1, this.worldWidth() - 2);
            const y = clamp((mob.y || 1) + oy, 1, this.worldHeight() - 2);
            if (this.canSpawnMobAt(mob.kind, x, y, context)) return { x, y };
          }
        }
      }
      return null;
    }

    repairMobEcology() {
      if (!Array.isArray(this.mobs)) return;
      const repaired = [];
      for (const mob of this.mobs) {
        if (!ENEMIES[mob.kind]) continue;
        const context = {
          boss: Boolean(mob.boss),
          secret: Boolean(mob.secretId),
          event: Boolean(mob.event),
          summoned: Boolean(mob.summoned),
          surface: Boolean(mob.surf),
          temporary: Boolean(mob.surf),
          nightRaid: Boolean(mob.surf)
        };
        if (this.canSpawnMobAt(mob.kind, mob.x, mob.y, context)) {
          repaired.push(mob);
          continue;
        }
        const home = this.findValidMobHome(mob, mob.boss ? 10 : 6, context);
        if (home) {
          mob.x = home.x;
          mob.y = home.y;
          repaired.push(mob);
        }
      }
      this.mobs = repaired;
    }

    generateMobs(rand = Math.random) {
      const mobs = [];
      const width = this.worldWidth();
      this.mobSeq = 1;
      const solidAt = (x, y) => {
        const t = this.tileAt(x, y);
        return t !== AIR && BLOCKS[t] && BLOCKS[t].solid;
      };
      for (let x = 3; x < width - 3 && mobs.length < Math.max(140, Math.floor(width * 0.78)); x += 1) {
        const surfaceY = this.surface[x] || 24;
        for (let y = surfaceY + 16; y < WORLD_H - 6; y += 1) {
          // Needs a 2-tall air pocket standing on solid ground (not lava).
          if (this.world[y][x] !== AIR || this.world[y - 1][x] !== AIR) continue;
          if (!solidAt(x, y + 1)) continue;
          if (Math.abs(x - this.shaft.x) <= 10 && y <= this.shaft.y + 24) continue;
          const depth = y - surfaceY;
          const density = depth > 150 ? 0.06 : depth > 60 ? 0.045 : 0.03;
          if (rand() >= density) continue;
          const picked = this.pickMobForSpot(x, y, rand, { natural: true });
          if (!picked) continue;
          const kind = picked.kind;
          const elite = depth > 75 && rand() < (depth > 150 ? 0.08 : 0.045);
          mobs.push({ id: this.mobSeq++, x, y: picked.y, kind, elite });
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
      const height = this.worldHeight();
      const width = this.worldWidth();
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
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
      const width = this.worldWidth();
      const shaft = this.shaft || { x: this.spawn.x, y: this.spawn.y };
      const sx = shaft.x;
      const sy = shaft.y;
      this.shaft = { x: sx, y: sy };
      this.spawn = { x: clamp(sx - 3, 1, width - 2), y: sy };
      const floorY = sy + 2;

      for (let y = sy - 7; y < sy + 18; y += 1) {
        if (y < 0 || y >= WORLD_H) continue;
        for (let x = sx - 2; x <= sx + 2; x += 1) {
          if (x >= 0 && x < width) this.world[y][x] = AIR;
        }
        if (y >= sy + 2) this.world[y][sx] = Tile.LADDER;
        if (y === sy + 7 || y === sy + 15) this.world[y][sx + 1] = Tile.TORCH;
      }

      for (let x = sx - 4; x <= sx + 4; x += 1) {
        if (x < 0 || x >= width || floorY >= WORLD_H) continue;
        if (Math.abs(x - sx) > 1) this.world[floorY][x] = Tile.GRASS;
        else this.world[floorY][x] = AIR;
      }
      for (let y = floorY + 1; y <= floorY + 4; y += 1) {
        if (y < 0 || y >= WORLD_H) continue;
        for (let x = sx - 4; x <= sx + 4; x += 1) {
          if (x < 0 || x >= width) continue;
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
      const campX = clamp(sx - 4, 1, width - 2);
      if (floorY - 1 > 0) {
        this.world[floorY - 1][campX] = Tile.CAMPFIRE;
        this.world[floorY - 2][campX] = AIR;
      }
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
      if (x === undefined || y < 2 || y >= this.worldHeight()) return false;
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
      const centerX = clamp(Math.floor(player.x / TILE), 0, this.worldWidth() - 1);
      const height = this.worldHeight();
      const bodyY = clamp(Math.floor(player.y / TILE), 0, height - 1);
      const footY = clamp(Math.floor((player.y + 18) / TILE), 0, height - 1);
      const bodyTile = this.tileAt(centerX, bodyY);
      if (bodyTile === Tile.LADDER || this.tileAt(centerX, footY) === Tile.LADDER) return true;
      const footTile = this.tileAt(centerX, footY);
      return footTile !== AIR && BLOCKS[footTile]?.solid && this.hasHeadClearance(centerX, footY);
    }

    snapPlayerToTileCenter(player = this.player) {
      if (!player) return this.safeSpawnPixels();
      const centerX = clamp(Math.floor(player.x / TILE), 1, this.worldWidth() - 2);
      const height = this.worldHeight();
      const footY = clamp(Math.floor((player.y + 18) / TILE), 0, height - 1);
      const bodyY = clamp(Math.floor(player.y / TILE), 0, height - 1);
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
      const width = this.worldWidth();
      const startX = clamp(Math.floor(player.x / TILE), 1, width - 2);
      const height = this.worldHeight();
      const startY = clamp(Math.floor((player.y + 18) / TILE), 0, height - 2);

      for (let y = startY; y < Math.min(height - 2, startY + 5); y += 1) {
        for (let radius = 0; radius <= 3; radius += 1) {
          for (const x of [startX - radius, startX + radius]) {
            if (x < 1 || x >= width - 1) continue;
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
      const belowWorld = py >= this.worldHeight() - 5;
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

    ensureContract() {
      const exists = this.contract && (ML.CONTRACTS || []).some((contract) => contract.id === this.contract.id);
      if (!exists) this.rollContract();
      return this.contract;
    }

    statValueForContract(type) {
      return Number(this.stats?.[type] || 0);
    }

    availableContracts() {
      const completed = this.stats?.contracts || 0;
      const deepest = this.stats?.deepest || 0;
      return (ML.CONTRACTS || []).filter((contract) =>
        completed >= (contract.minContracts || 0) && deepest >= (contract.minDepth || 0)
      );
    }

    contractTarget(template, rank) {
      return Math.max(1, Math.floor((template.base || 1) + rank * (template.growth || 0)));
    }

    contractReward(template, rank) {
      const reward = Object.assign({}, template.reward || {});
      for (const [item, amount] of Object.entries(template.rewardEvery || {})) {
        reward[item] = (reward[item] || 0) + amount * Math.floor(rank / 2);
      }
      return reward;
    }

    rollContract() {
      const options = this.availableContracts();
      if (!options.length) {
        this.contract = null;
        return null;
      }
      const completed = this.stats?.contracts || 0;
      const index = Math.abs((this.seed || 0) + completed * 17 + (this.contractSeq || 0) * 31) % options.length;
      const template = options[index];
      const rank = completed + 1;
      const target = this.contractTarget(template, rank);
      const start = template.absolute ? 0 : this.statValueForContract(template.type);
      this.contractSeq = (this.contractSeq || 0) + 1;
      this.contract = {
        id: template.id,
        name: template.name,
        type: template.type,
        label: template.label,
        unit: template.unit,
        absolute: Boolean(template.absolute),
        target,
        start,
        reward: this.contractReward(template, rank)
      };
      return this.contract;
    }

    contractProgress() {
      const contract = this.ensureContract();
      if (!contract) return null;
      const value = this.statValueForContract(contract.type);
      const progress = contract.absolute ? value : Math.max(0, value - contract.start);
      return {
        contract,
        progress: clamp(Math.floor(progress), 0, contract.target),
        target: contract.target,
        done: progress >= contract.target
      };
    }

    claimContract() {
      const progress = this.contractProgress();
      if (!progress || !progress.done) return null;
      const completed = Object.assign({}, progress.contract, { reward: Object.assign({}, progress.contract.reward || {}) });
      for (const [item, count] of Object.entries(completed.reward || {})) {
        if (count > 0) this.addItem(item, count);
      }
      this.stats.contracts += 1;
      const next = this.rollContract();
      return { completed, next };
    }

    campService(service, player = null) {
      return ML.CampSystem.applyService(this, service, player);
    }

    load() {
      try {
        const raw = localStorage.getItem(ML.SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.version !== 4 || !data.state || !Array.isArray(data.state.world)) return null;
        return data.state;
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
        lampCharge: this.lampCharge,
        ward: this.ward,
        fallGuard: this.fallGuard,
        speedBoost: this.speedBoost,
        regenBoost: this.regenBoost,
        treasureSense: this.treasureSense,
        lootBonus: this.lootBonus,
        recallCharm: this.recallCharm,
        blastRadius: this.blastRadius,
        shadowPressure: this.shadowPressure,
        selected: this.selected,
        inventory: this.inventory,
        world: this.world,
        surface: this.surface,
        spawn: this.spawn,
        shaft: this.shaft,
        secrets: this.secrets,
        surfaceDiscoveries: this.surfaceDiscoveries,
        player: this.player,
        lights: this.lights,
        mobs: this.mobs,
        mobSeq: this.mobSeq,
        mobBaseline: this.mobBaseline,
        stats: this.stats,
        achievements: this.achievements,
        lore: this.lore,
        craftedRecipes: this.craftedRecipes,
        campAnchors: this.campAnchors,
        lastCamp: this.lastCamp,
        contract: this.contract,
        contractSeq: this.contractSeq
      };
      try {
        localStorage.setItem(ML.SAVE_KEY, JSON.stringify({ version: 4, state }));
        return true;
      } catch {
        return false;
      }
    }

    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= this.worldWidth() || y >= this.worldHeight()) return Tile.BEDROCK;
      return this.world[y][x];
    }

    setTile(x, y, tile) {
      if (x < 0 || y < 0 || x >= this.worldWidth() || y >= this.worldHeight()) return;
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

    lampSpec() {
      return ML.LAMPS[this.lamp] || ML.LAMPS[0];
    }

    maxLampCharge() {
      return this.lampSpec()?.capacity || 120;
    }

    lampChargeRatio() {
      return clamp((this.lampCharge ?? 0) / Math.max(1, this.maxLampCharge()), 0, 1);
    }

    lampOutput() {
      const spec = this.lampSpec();
      const ratio = this.lampChargeRatio();
      if (ratio <= 0) return { radius: 0, glow: 0, ratio, powered: false };
      const fade = ratio < 0.18 ? 0.38 + ratio / 0.18 * 0.62 : 1;
      return {
        radius: spec.radius * fade,
        glow: spec.glow * fade,
        ratio,
        powered: true
      };
    }

    refillLamp() {
      this.lampCharge = this.maxLampCharge();
      return this.lampCharge;
    }

    useLampCell() {
      if (!this.removeItem("battery", 1)) return false;
      this.refillLamp();
      return true;
    }

    drainLamp(dt, demand = 1) {
      const spec = this.lampSpec();
      const before = this.lampChargeRatio();
      if (this.lampCharge <= 0) {
        return this.useLampCell() ? { state: "swapped", before, after: 1 } : { state: "empty", before, after: 0 };
      }
      const drain = Math.max(0, dt) * (spec.drain || 1) * clamp(demand, 0.15, 1.65);
      this.lampCharge = clamp(this.lampCharge - drain, 0, this.maxLampCharge());
      const after = this.lampChargeRatio();
      if (after <= 0) {
        return this.useLampCell() ? { state: "swapped", before, after: 1 } : { state: "empty", before, after: 0 };
      }
      if (before > 0.22 && after <= 0.22) return { state: "low", before, after };
      return { state: "draining", before, after };
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
      if (recipe.recallCharm && this.recallCharm) return { ok: false, message: "Already built." };
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
      if (recipe.lamp) {
        this.lamp = recipe.lamp;
        this.refillLamp();
      }
      if (recipe.boots) this.boots = true;
      if (recipe.ward) this.ward = true;
      if (recipe.fallGuard) this.fallGuard = true;
      if (recipe.speedBoost) this.speedBoost = true;
      if (recipe.regenBoost) this.regenBoost = true;
      if (recipe.treasureSense) this.treasureSense = true;
      if (recipe.lootBonus) this.lootBonus = true;
      if (recipe.recallCharm) this.recallCharm = true;
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
