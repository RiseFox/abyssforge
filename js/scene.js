// AbyssForge v2 - the Phaser scene: movement, mining, combat, lighting, hazards.
(() => {
  "use strict";
  const ML = window.ML;
  const {
    TILE, WORLD_W, WORLD_H, AIR, DAY_LENGTH, INTERACT_RANGE_TILES,
    Tile, BLOCKS, SOLID_TILES, BLOCK_TINTS, ITEM_META, HOTBAR, PICKS, ENEMIES, clamp
  } = ML;

  const SKY_DAY = { r: 0x6f, g: 0x9f, b: 0xd6 };
  const SKY_NIGHT = { r: 0x0b, g: 0x0e, b: 0x1d };

  const DEATH_CAUSES = {
    mossling: "A night mossling caught you on the surface.",
    crawler: "A cave crawler got you.",
    bat: "Bats picked you apart in the dark.",
    slime: "Dissolved by a cave slime.",
    golem: "Crushed by a deep golem.",
    broodmother: "The Broodmother dragged you into the webbed vault.",
    warden: "The Abyss Warden broke your descent.",
    lava: "You fell into lava.",
    dark: "The deep darkness drained you.",
    fall: "You hit the ground too hard.",
    tremor: "A cave tremor dropped the ceiling on you.",
    blast: "Caught in your own blast.",
    void: "The depths claimed you."
  };

  class MineScene extends Phaser.Scene {
    constructor() {
      super("MineScene");
      this.sim = new ML.MinerSim();
    }

    preload() {
      ML.ExternalAssets?.preload?.(this);
    }

    create() {
      ML.sceneRef = this;
      // Reset per-run state here: create() runs again after scene.restart().
      this.dead = false;
      this.pausedByUI = false;
      this.craftOpen = false;
      this.campOpen = false;
      this.helpOpen = false;
      this.packOpen = false;
      this.mineTarget = null;
      this.mineProgress = 0;
      this.enemyClock = 0;
      this.activeMobIds = new Set();
      this.pendingMobSpawns = new Map();
      this.noiseEvents = [];
      this.noiseSeq = 1;
      this.nextNoiseEventAt = 0;
      this.lastNoiseToastAt = 0;
      this.lastDay = Math.floor(this.sim.time / DAY_LENGTH) + 1;
      this.lastHudUpdate = 0;
      this.lastMapUpdate = 0;
      this.lastMusicCheck = 0;
      this.nextDarknessDrawAt = 0;
      this.darknessDrawKey = "";
      this.achievementClock = 0;
      this.currentAction = "Explore";
      this.targetLabel = "None";
      this.actionHoldUntil = 0;
      this.pickSwingStart = 0;
      this.pickSwingUntil = 0;
      this.lastGhostAt = 0;
      this.nextAttackAt = 0;
      this.playerIframesUntil = 0;
      this.lastDamageAt = -99999;
      this.jumpsUsed = 0;
      this.wasAirborne = false;
      this.peakFallVy = 0;
      this.platformDrop = false;
      this.autoPausedByVisibility = false;
      this.lastSizzleAt = 0;
      this.lastDarkWarnAt = 0;
      this.lastLampWarnAt = 0;
      this.lastLampSwapAt = 0;
      this.lampStandby = false;
      this.lampDemand = 0;
      this.externalLight = 1;
      this.visiblePoiSignals = [];
      this.nextPoiSignalScanAt = 0;
      this.nextPoiSignalToastAt = 0;
      this.lastSurfaceDiscoveryAt = 0;
      this.lastSurfaceDiscoveryCheckAt = 0;
      this.lastCampHintAt = 0;
      this.lastBiomeId = null;
      this.lastStratumId = null;
      this.lastStoryPhaseId = ML.LoreSystem?.phase?.(this.sim)?.id || "contract";
      this.lastBiomeToastAt = 0;
      this.shadowPressure = clamp(this.sim.shadowPressure || 0, 0, 100);
      this.lastShadowWarnAt = 0;
      this.nextWatcherAt = 9000;
      this.watcherUntil = 0;
      this.watcherState = null;
      this.watcherTraceMarks = [];
      this.caveEvent = null;
      this.nextCaveEventAt = 0;
      this.eventPulseAt = 0;
      this.nextHorizontalExpandAt = 0;
      this.nextObserverMomentAt = 8000;
      this.nextHeroThoughtAt = 12000;
      this.nextSpatialRiftAt = 26000;
      this.lastObserverCheckAt = 0;
      this.lastObserverInputAt = 0;
      this.lastObserverMoveAt = 0;
      this.observerPulseUntil = 0;
      this.observerRifts = [];
      this.nextRecallAt = 0;
      this.physics.world.resume();
      this.sim.ensureContract();

      ML.makeTextures(this);

      this.map = this.make.tilemap({ data: this.sim.world, tileWidth: TILE, tileHeight: TILE });
      const tileset = this.map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0);
      this.layer = this.map.createLayer(0, tileset, 0, 0);
      this.initCollision();

      this.physics.world.setBounds(0, 0, this.worldWidthTiles() * TILE, this.worldHeightTiles() * TILE);
      this.player = this.physics.add.sprite(this.sim.player.x, this.sim.player.y, "playerSheet", "idle0");
      this.player.setCollideWorldBounds(true);
      this.player.body.setSize(20, 30).setOffset(4, 5);
      // Terminal velocity: keeps huge background-tab deltas from tunneling
      // the body through one-way platforms, and bounds fall damage.
      this.player.body.setMaxVelocity(420, 1150);
      this.player.setDepth(10);
      this.createAnims();

      // Hold S to drop through platforms.
      this.playerLayerCollider = this.physics.add.collider(this.player, this.layer, null, (_player, tile) => {
        if (tile.index === Tile.PLATFORM && this.platformDrop && this.canDropThroughPlatform(tile)) return false;
        return true;
      }, this);

      // Pooled FX: sparks as particles (no physics bodies), reusable pick ghosts.
      // Must exist before the first updatePickaxeVisual call below.
      this.sparkEmitter = this.add.particles(0, 0, "spark", {
        speed: { min: 50, max: 170 },
        angle: { min: 210, max: 330 },
        gravityY: 580,
        lifespan: { min: 300, max: 520 },
        scale: { start: 1, end: 0.4 },
        alpha: { start: 0.95, end: 0 },
        emitting: false
      }).setDepth(25);
      this.ghostPool = Array.from({ length: 5 }, () =>
        this.add.image(0, 0, "picks", "pick0").setOrigin(0.5, 0.9).setDepth(11).setVisible(false).setAlpha(0)
      );
      this.ghostIndex = 0;
      this.curPickLevel = 0;

      this.pickSprite = this.add.image(this.player.x + 12, this.player.y - 1, "picks", "pick0");
      this.pickSprite.setOrigin(0.5, 0.9).setDepth(12);
      this.updatePickaxeVisual(false);

      this.enemies = this.physics.add.group();
      this.enemyLayerCollider = this.physics.add.collider(this.enemies, this.layer);
      this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);

      this.cameras.main.setBounds(0, 0, this.worldWidthTiles() * TILE, this.worldHeightTiles() * TILE);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      this.cameras.main.setDeadzone(120, 80);

      this.mineGraphics = this.add.graphics().setDepth(30);
      this.lightGlow = this.add.graphics()
        .setScrollFactor(0)
        .setDepth(79);
      this.tileFx = this.add.graphics().setDepth(9);
      this.chestPropPool = Array.from({ length: 72 }, () =>
        this.add.image(0, 0, "asset-cache-chest")
          .setDepth(8)
          .setVisible(false)
          .setOrigin(0.5, 0.5)
      );
      this.visibleChestPropCount = 0;
      this.nextChestPropScanAt = 0;
      this.watcher = this.add.image(this.player.x, this.player.y, "watcher")
        .setOrigin(0.5, 1)
        .setDepth(82)
        .setVisible(false)
        .setAlpha(0);

      // Screen-space darkness with holes punched out around light sources.
      this.darknessRT = this.add.renderTexture(0, 0, this.scale.width, this.scale.height)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(80);
      this.lightMask = this.make.image({ key: "lightOrb", add: false })
        .setOrigin(0.5);
      const onResize = (gameSize) => {
        if (this.darknessRT && this.darknessRT.resize) {
          this.darknessRT.resize(gameSize.width, gameSize.height);
        }
      };
      this.scale.on("resize", onResize);
      this.events.once("shutdown", () => this.scale.off("resize", onResize));

      this.keys = this.input.keyboard.addKeys({
        left: "A",
        right: "D",
        up: "W",
        down: "S",
        jump: "SPACE",
        sprint: "SHIFT",
        altLeft: "LEFT",
        altRight: "RIGHT",
        altUp: "UP",
        altDown: "DOWN"
      });

      this.input.keyboard.on("keydown-E", () => this.interactOrCraft());
      this.input.keyboard.on("keydown-C", () => this.toggleCamp());
      this.input.keyboard.on("keydown-B", () => this.togglePack());
      this.input.keyboard.on("keydown-I", () => this.togglePack());
      this.input.keyboard.on("keydown-M", () => ML.toggleMinimap());
      this.input.keyboard.on("keydown-ESC", () => this.setPaused(!this.pausedByUI));
      this.input.keyboard.on("keydown-F", () => this.attack());
      this.input.keyboard.on("keydown-R", () => this.recallToCamp());
      const digitNames = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
      for (let i = 0; i < HOTBAR.length && i < digitNames.length; i += 1) {
        this.input.keyboard.on(`keydown-${digitNames[i]}`, () => {
          this.sim.selected = i;
          ML.renderHotbar(this.sim);
          ML.audio.play("click");
        });
      }
      this.prepareGameInputFocus();

      this.input.on("wheel", (_pointer, _objects, _dx, dy) => {
        if (this.craftOpen || this.campOpen || this.helpOpen || this.packOpen) return;
        this.sim.selected = (this.sim.selected + (dy > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
        ML.renderHotbar(this.sim);
      });

      this.input.on("pointerdown", (pointer) => {
        if (this.pausedByUI || this.dead) return;
        if (pointer.leftButtonDown() && this.findEnemyAtPointer(pointer)) {
          this.attack(pointer);
          return;
        }
        if (pointer.rightButtonDown()) {
          this.tryUseSelected(pointer);
        }
      });

      this.time.addEvent({
        delay: 30000,
        loop: true,
        callback: () => {
          if (this.dead || this.pausedByUI) return;
          if (this.saveGame()) {
            ML.showToast("Autosaved.", 900);
          }
        }
      });

      ML.bindUi(this);
      ML.minimap.init(this.sim);
      ML.hideDeath();
      ML.ui.craftDrawer.classList.add("hidden");
      ML.ui.campDrawer?.classList.add("hidden");
      ML.ui.helpDrawer.classList.add("hidden");
      ML.ui.packDrawer?.classList.add("hidden");
      this.scheduleNextCaveEvent(true);
      this.refreshMobActivation();
      ML.resetRenderCache?.();
      ML.renderAll(this.sim, { force: true });
      this.checkLore("load", { silent: true });
      this.checkAchievements();
      ML.showToast("Pickaxe ready. LMB mines, RMB places or uses, E opens nearby objects or crafts, F attacks.", 4600);
    }

    createAnims() {
      // Anims live on the GLOBAL AnimationManager and capture hard Frame
      // references; our canvas textures are destroyed and recreated on every
      // scene.restart(), so the anims must be rebuilt against fresh frames.
      const def = (key, names, frameRate, repeat) => {
        if (this.anims.exists(key)) this.anims.remove(key);
        this.anims.create({
          key,
          frames: names.map((frame) => ({ key: "playerSheet", frame })),
          frameRate,
          repeat
        });
      };
      def("idle", ["idle0", "idle1"], 2, -1);
      def("walk", ["walk0", "walk1", "walk2", "walk3"], 11, -1);
      def("jump", ["jump"], 1, -1);
      def("fall", ["fall"], 1, -1);
    }

    initCollision() {
      this.layer.setCollision(SOLID_TILES);
      this.layer.forEachTile((tile) => {
        if (tile.index === Tile.PLATFORM) tile.setCollision(false, false, true, false);
      });
      this.layer.calculateFacesWithin(0, 0, this.worldWidthTiles(), this.worldHeightTiles());
    }

    worldHeightTiles() {
      return this.sim?.worldHeight?.() || this.sim?.world?.length || WORLD_H;
    }

    worldWidthTiles() {
      return this.sim?.worldWidth?.() || this.sim?.world?.[0]?.length || WORLD_W;
    }

    refreshWorldBounds() {
      const heightPx = this.worldHeightTiles() * TILE;
      this.physics.world.setBounds(0, 0, this.worldWidthTiles() * TILE, heightPx);
      this.cameras.main.setBounds(0, 0, this.worldWidthTiles() * TILE, heightPx);
    }

    rebuildWorldLayer() {
      this.playerLayerCollider?.destroy();
      this.enemyLayerCollider?.destroy();
      this.layer?.destroy();
      this.map = this.make.tilemap({ data: this.sim.world, tileWidth: TILE, tileHeight: TILE });
      const tileset = this.map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0);
      this.layer = this.map.createLayer(0, tileset, 0, 0);
      this.initCollision();
      this.playerLayerCollider = this.physics.add.collider(this.player, this.layer, null, (_player, tile) => {
        if (tile.index === Tile.PLATFORM && this.platformDrop && this.canDropThroughPlatform(tile)) return false;
        return true;
      }, this);
      this.enemyLayerCollider = this.physics.add.collider(this.enemies, this.layer);
      this.refreshWorldBounds();
    }

    prepareGameInputFocus() {
      const canvas = this.game?.canvas;
      if (!canvas) return;
      canvas.setAttribute("tabindex", "0");
      canvas.setAttribute("aria-label", "AbyssForge game");
      this._canvasFocusHandler = () => this.focusGameInput();
      canvas.addEventListener("pointerdown", this._canvasFocusHandler);
      this.events.once("shutdown", () => {
        canvas.removeEventListener("pointerdown", this._canvasFocusHandler);
        this._canvasFocusHandler = null;
      });
      this.focusGameInput();
    }

    focusGameInput() {
      const canvas = this.game?.canvas;
      if (!canvas) return;
      if (this.input) this.input.enabled = true;
      if (this.input?.keyboard) this.input.keyboard.enabled = true;
      try {
        canvas.focus({ preventScroll: true });
      } catch {
        try { canvas.focus(); } catch { /* ignore focus failures */ }
      }
    }

    resetInputState() {
      this.platformDrop = false;
      ML.mobile.left = false;
      ML.mobile.right = false;
      ML.mobile.jumpTap = false;
      ML.mobile.mineTap = false;
      ML.mobile.placeTap = false;
      ML.mobile.attackTap = false;
      if (this.input?.keyboard?.resetKeys) this.input.keyboard.resetKeys();
      if (this.keys) {
        for (const key of Object.values(this.keys)) {
          if (key?.reset) key.reset();
        }
      }
      if (this.player?.body && !this.dead) this.player.setVelocityX(0);
    }

    canDropThroughPlatform(tile) {
      const shaft = this.sim.shaft;
      if (!shaft) return true;
      const isStarterBridge = Math.abs(tile.x - shaft.x) <= 4 && tile.y === shaft.y + 2;
      return !isStarterBridge;
    }

    update(_time, delta) {
      ML.updatePerformance?.(this, delta);
      if (this.pausedByUI || this.dead) {
        // Taps queued while input is ignored must not fire after resume.
        ML.mobile.jumpTap = ML.mobile.mineTap = ML.mobile.placeTap = ML.mobile.attackTap = false;
        return;
      }
      // worldX/worldY only refresh on DOM events; the camera scrolls between them.
      this.input.activePointer.updateWorldPoint(this.cameras.main);
      const dt = delta / 1000;
      this.sim.time += dt;
      this.enemyClock += dt;
      this.lastMusicCheck += delta;
      if (this.lastMusicCheck > 1000) {
        this.lastMusicCheck = 0;
        ML.audio.setMusicMode(this.currentMusicMode());
      }

      const left = this.keys.left.isDown || this.keys.altLeft.isDown || ML.mobile.left;
      const right = this.keys.right.isDown || this.keys.altRight.isDown || ML.mobile.right;
      const up = this.keys.up.isDown || this.keys.altUp.isDown;
      const down = this.keys.down.isDown || this.keys.altDown.isDown;
      const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.jump) || ML.mobile.jumpTap;
      const pointer = this.input.activePointer;
      if (left || right || up || down || jumpPressed || pointer.isDown || ML.mobile.mineTap || ML.mobile.placeTap || ML.mobile.attackTap) {
        this.lastObserverInputAt = this.time.now;
      }
      ML.mobile.jumpTap = false;

      const tileX = Math.floor(this.player.x / TILE);
      const tileY = Math.floor(this.player.y / TILE);
      const standingTile = this.sim.tileAt(tileX, tileY);
      const onLadder = standingTile === Tile.LADDER || this.sim.tileAt(tileX, tileY + 1) === Tile.LADDER;
      const onFloor = this.player.body.blocked.down || this.player.body.onFloor();
      const inLava = this.touchingLava();

      this.platformDrop = down && !onLadder;

      const sprinting = this.keys.sprint.isDown && this.sim.energy > 6 && onFloor && !onLadder;
      let speed = sprinting ? 305 : 220;
      if (this.sim.speedBoost) speed *= sprinting ? 1.18 : 1.12;
      if (inLava) speed *= 0.5;
      let vx = 0;
      if (left) vx -= speed;
      if (right) vx += speed;
      this.player.setVelocityX(vx);
      this.player.setFlipX(vx < 0 ? true : vx > 0 ? false : this.player.flipX);

      if (onLadder) {
        this.player.body.allowGravity = false;
        this.jumpsUsed = 0;
        this.wasAirborne = false;
        this.peakFallVy = 0;
        if (up) {
          this.player.setVelocityY(-170);
        } else if (down) {
          this.player.setVelocityY(170);
        } else {
          this.player.setVelocityY(0);
        }
        if (jumpPressed && (left || right)) {
          this.player.body.allowGravity = true;
          this.player.setVelocityY(-335);
          ML.audio.play("jump");
        }
      } else {
        this.player.body.allowGravity = true;
        if (onFloor) this.jumpsUsed = 0;
        if (jumpPressed) {
          if (onFloor) {
            this.player.setVelocityY(inLava ? -300 : -455);
            this.jumpsUsed = 1;
            ML.audio.play("jump");
          } else if (this.sim.boots && this.jumpsUsed < 2) {
            this.player.setVelocityY(-400);
            this.jumpsUsed = 2;
            this.peakFallVy = 0; // boots arrest the fall — no phantom landing damage
            ML.audio.play("doubleJump");
            this.emitDust(this.player.x, this.player.y + 14, 4);
          }
        }
      }

      this.trackFall(onFloor, onLadder);
      this.updatePlayerAnim(vx, onFloor, onLadder);

      if (!this.actionHoldUntil || this.time.now > this.actionHoldUntil) {
        if (onLadder) {
          this.currentAction = "Climb";
        } else if (sprinting && Math.abs(vx) > 0) {
          this.currentAction = "Sprint";
        } else if (Math.abs(vx) > 0) {
          this.currentAction = "Move";
        } else {
          this.currentAction = "Explore";
        }
      }

      if (Math.abs(vx) > 0 && onFloor) {
        this.sim.energy = clamp(this.sim.energy - dt * (sprinting ? 7.5 : 2.4), 0, this.sim.maxEnergy);
      } else {
        this.sim.energy = clamp(this.sim.energy + dt * 5.5, 0, this.sim.maxEnergy);
      }
      if (this.nearCamp() && onFloor && !inLava) {
        this.sim.energy = clamp(this.sim.energy + dt * 6.5, 0, this.sim.maxEnergy);
      }
      this.updateSurvivalRegen(dt, onFloor, inLava);
      if (this.caveEvent?.id === "lanternDraft") {
        this.sim.energy = clamp(this.sim.energy + dt * 4.5, 0, this.sim.maxEnergy);
      }
      this.applyBiomeEnergy(dt, onFloor, inLava);

      if (pointer.isDown && pointer.leftButtonDown() && !this.findEnemyAtPointer(pointer)) {
        ML.mobile.mineTap = false;
        this.handleMining(delta);
      } else if (ML.mobile.mineTap) {
        ML.mobile.mineTap = false;
        this.handleMining(360);
      } else {
        this.mineTarget = null;
        this.mineProgress = 0;
        this.mineGraphics.clear();
      }

      if (ML.mobile.placeTap) {
        ML.mobile.placeTap = false;
        this.tryUseSelected(pointer);
      }
      if (ML.mobile.attackTap) {
        ML.mobile.attackTap = false;
        this.attack();
      }

      this.updateNoiseEvents();
      this.updateEnemies(dt);
      this.updateCaveEvents(dt);
      this.updateLampBattery(dt);
      this.updateHazards(dt, inLava);
      this.updateHorizontalExpansion();
      this.updateSurfaceDiscoveries();
      this.updatePoiAmbience();
      this.updateObserverAwareness(dt, { vx, left, right, up, down, jumpPressed, onFloor, onLadder, pointer });
      this.updateSky();
      this.drawAnimatedTileFx();
      this.updateChestProps();
      this.updateDarkness();
      this.updatePickaxeVisual(Boolean(this.mineTarget));

      this.lastHudUpdate += delta;
      if (this.lastHudUpdate > 120) {
        this.lastHudUpdate = 0;
        this.targetLabel = this.describePointerTarget();
        ML.renderStatus(this.sim, this.player, this.playerLight());
        ML.renderContract(this.sim);
        ML.renderEvent(this);
        ML.renderBossBar(this);
        ML.renderRecall(this);
        ML.renderInteraction(this);
        this.checkBiomeTransition();
      }
      this.lastMapUpdate += delta;
      if (this.lastMapUpdate > 400) {
        this.lastMapUpdate = 0;
        ML.minimap.render(this);
      }
      this.achievementClock += delta;
      if (this.achievementClock > 800) {
        this.achievementClock = 0;
        this.checkAchievements();
      }
    }

    // ---- Time of day -------------------------------------------------------

    timeOfDay() {
      return (this.sim.time % DAY_LENGTH) / DAY_LENGTH;
    }

    dayNumber() {
      return Math.floor(this.sim.time / DAY_LENGTH) + 1;
    }

    sunHeight() {
      return Math.sin(this.timeOfDay() * Math.PI * 2);
    }

    surfaceBrightness() {
      return clamp(0.22 + 0.85 * Math.max(0, this.sunHeight()), 0.22, 1);
    }

    phaseName() {
      const tod = this.timeOfDay();
      if (tod < 0.07 || (tod >= 0.43 && tod < 0.5)) return tod < 0.07 ? "Dawn" : "Dusk";
      if (tod < 0.43) return "Day";
      return "Night";
    }

    currentMusicMode() {
      const depth = this.depthMeters();
      const biome = this.currentBiome();
      if (this.hasActiveBoss()) return "boss";
      if (this.caveEvent?.id === "swarm" || this.caveEvent?.id === "tremor") return "danger";
      if (this.caveEvent?.id === "oreSurge") return "treasure";
      if ((this.shadowPressure || 0) > 74 || this.watcher?.visible) return "danger";
      if (this.hasNearbyDanger()) return "danger";
      if (this.nearCamp()) return "camp";
      if (this.nearUnopenedSecretChest()) return "treasure";
      if (biome?.id && biome.id !== "surface") return biome.music || (depth > 130 ? "deep" : "cave");
      if (depth > 130) return "deep";
      if (depth > 10) return "cave";
      return this.phaseName() === "Night" ? "night" : "surface";
    }

    activeBoss() {
      if (!this.enemies) return null;
      let best = null;
      let bestDistance = Infinity;
      for (const enemy of this.enemies.getChildren()) {
        if (!enemy.active || !ENEMIES[enemy.kind]?.boss) continue;
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        if (distance < bestDistance) {
          best = enemy;
          bestDistance = distance;
        }
      }
      return best;
    }

    hasActiveBoss() {
      return Boolean(this.activeBoss());
    }

    hasNearbyDanger() {
      if (!this.enemies) return false;
      return this.enemies.getChildren().some((enemy) =>
        enemy.active && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 220
      );
    }

    nearUnopenedSecretChest() {
      const px = this.player.x / TILE;
      const py = this.player.y / TILE;
      return (this.sim.secrets || []).some((secret) =>
        !secret.opened && secret.chest && Math.abs(secret.chest.x - px) <= 8 && Math.abs(secret.chest.y - py) <= 6
      );
    }

    updateSky() {
      const t = clamp((this.sunHeight() + 0.25) / 1.25, 0, 1);
      const r = Math.round(SKY_NIGHT.r + (SKY_DAY.r - SKY_NIGHT.r) * t);
      const g = Math.round(SKY_NIGHT.g + (SKY_DAY.g - SKY_NIGHT.g) * t);
      const b = Math.round(SKY_NIGHT.b + (SKY_DAY.b - SKY_NIGHT.b) * t);
      this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(r, g, b));
    }

    // ---- Light -------------------------------------------------------------

    depthMeters() {
      const tileX = clamp(Math.floor(this.player.x / TILE), 0, this.worldWidthTiles() - 1);
      const surfaceY = this.sim.surface[tileX] || 24;
      return Math.max(0, Math.floor(this.player.y / TILE - surfaceY));
    }

    currentBiome() {
      return ML.BiomeSystem?.current?.(this.sim, this.player) || ML.BIOMES?.surface || null;
    }

    currentStratum() {
      if (!this.player || !this.sim?.stratumAt) return null;
      return this.sim.stratumAt(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
    }

    biomeName() {
      return this.currentBiome()?.name || "Surface";
    }

    ambientLight() {
      const depth = this.depthMeters();
      const biome = this.currentBiome();
      const df = clamp(1 - depth / 46, 0, 1);
      const floor = biome?.ambientFloor ?? 0.08;
      return clamp(Math.max(floor, df * this.surfaceBrightness()), floor, 1);
    }

    externalLightAt(x, y) {
      const tx = clamp(Math.floor(x / TILE), 0, this.worldWidthTiles() - 1);
      const ty = clamp(Math.floor(y / TILE), 0, this.worldHeightTiles() - 1);
      const surfaceY = this.sim.surface[tx] || 24;
      const depth = Math.max(0, ty - surfaceY);
      const biome = ML.BiomeSystem?.biomeAt?.(this.sim, tx, ty) || this.currentBiome();
      const floor = biome?.ambientFloor ?? 0.08;
      const depthFalloff = clamp(1 - depth / 46, 0, 1);
      let best = clamp(Math.max(floor, depthFalloff * this.surfaceBrightness()), floor, 1);
      if (this.sim.ward) best = Math.max(best, 0.18);
      if (this.caveEvent?.id === "lanternDraft") best = Math.max(best, 0.38);
      const px = x / TILE;
      const py = y / TILE;
      for (const light of this.sim.lights) {
        const r = BLOCKS[light.t]?.light || 0;
        if (!r) continue;
        const d = Math.hypot(light.x + 0.5 - px, light.y + 0.5 - py);
        if (d < r + 1) best = Math.max(best, 1 - d / (r + 1));
      }
      return clamp(best, 0, 1);
    }

    personalLampOutput() {
      const lamp = this.sim.lampOutput();
      if (!lamp.powered || !this.lampStandby) return lamp;
      return { radius: 0, glow: 0, ratio: lamp.ratio, powered: false, standby: true };
    }

    updateLampBattery(dt) {
      const depth = this.depthMeters();
      const ambient = this.ambientLight();
      const outsideLight = this.externalLightAt(this.player.x, this.player.y);
      const standbyThreshold = this.lampStandby ? 0.48 : 0.58;
      this.externalLight = outsideLight;
      this.lampStandby = this.nearCamp() || (depth <= 6 && ambient > 0.58) || outsideLight >= standbyThreshold;
      if (this.lampStandby) {
        this.lampDemand = 0;
        return;
      }

      const eventRelief = this.caveEvent?.id === "lanternDraft" ? 0.55 : 1;
      const demand = clamp((0.52 + depth / 260 + Math.max(0, 0.52 - outsideLight) * 1.15) * eventRelief, 0.2, 1.55);
      this.lampDemand = demand;
      const result = this.sim.drainLamp(dt, demand);
      const now = this.time.now;

      if (result.state === "swapped" && now - this.lastLampSwapAt > 900) {
        this.lastLampSwapAt = now;
        this.lastLampWarnAt = now;
        ML.showToast(`Lamp cell swapped. ${this.sim.inventory.battery || 0} spare cells left.`, 1800);
        ML.bumpItem("battery");
        this.setAction("Cell swapped", 1100);
        return;
      }

      if (result.state === "low" && now - this.lastLampWarnAt > 7000) {
        this.lastLampWarnAt = now;
        ML.showToast("Lamp cell is low. Craft cells or return to a campfire.", 2400);
        this.setAction("Low lamp cell", 1200);
        return;
      }

      if (result.state === "empty" && now - this.lastLampWarnAt > 3600) {
        this.lastLampWarnAt = now;
        ML.showToast("Lamp is out of cells. Torches and campfires still give light.", 2600);
        this.setAction("Lamp empty", 1300);
      }
    }

    playerLight() {
      const lamp = this.personalLampOutput();
      let best = Math.max(this.externalLightAt(this.player.x, this.player.y), lamp.glow);
      if (this.sim.ward) best = Math.max(best, 0.28);
      if (this.caveEvent?.id === "lanternDraft") best = Math.max(best, 0.46);
      return clamp(best, 0, 1);
    }

    lightLevelAt(x, y) {
      let best = this.externalLightAt(x, y);

      const lamp = this.personalLampOutput();
      const lampRadius = lamp.radius / TILE;
      const playerDistance = Math.hypot(x / TILE - this.player.x / TILE, y / TILE - this.player.y / TILE);
      if (playerDistance < lampRadius) {
        best = Math.max(best, (1 - playerDistance / lampRadius) * Math.max(0.28, lamp.glow));
      }
      return clamp(best, 0, 1);
    }

    drawAnimatedTileFx() {
      if (!this.tileFx) return;
      const fx = this.tileFx;
      const cam = this.cameras.main;
      const now = this.time.now;
      const minX = cam.scrollX - 80;
      const maxX = cam.scrollX + cam.width + 80;
      const minY = cam.scrollY - 80;
      const maxY = cam.scrollY + cam.height + 80;
      fx.clear();
      for (const light of this.sim.lights) {
        if (light.t !== Tile.CAMPFIRE && light.t !== Tile.TORCH && light.t !== Tile.MUSHROOM) continue;
        const x = light.x * TILE;
        const y = light.y * TILE;
        if (x < minX || x > maxX || y < minY || y > maxY) continue;
        const flicker = Math.sin(now / 92 + light.x * 11 + light.y * 5);
        if (light.t === Tile.CAMPFIRE) {
          const lift = flicker > 0 ? 1 : 0;
          fx.fillStyle(0x4a2a16, 0.9);
          fx.fillRect(x + 7, y + 24, 18, 4);
          fx.fillStyle(0xf08a3e, 0.9);
          fx.fillRect(x + 11, y + 14 - lift, 4, 8 + lift);
          fx.fillRect(x + 18, y + 15 + lift, 4, 7);
          fx.fillStyle(0xffdf78, 0.96);
          fx.fillRect(x + 14, y + 10 - lift, 5, 11 + lift);
          if (Math.sin(now / 210 + light.x) > 0.35) {
            fx.fillStyle(0xffc45a, 0.75);
            fx.fillRect(x + 12 + ((light.x + light.y) % 8), y + 6 - (now / 80) % 5, 2, 2);
          }
        } else if (light.t === Tile.TORCH) {
          fx.fillStyle(0xf3ce62, 0.9);
          fx.fillRect(x + 11, y + 3 - (flicker > 0 ? 1 : 0), 11, 10);
          fx.fillStyle(0xf37a42, 0.92);
          fx.fillRect(x + 14, y + 6 + (flicker < 0 ? 1 : 0), 5, 6);
        } else if (light.t === Tile.MUSHROOM) {
          const alpha = 0.36 + Math.sin(now / 300 + light.x) * 0.12;
          fx.fillStyle(0xa9ffef, alpha);
          fx.fillRect(x + 7, y + 8, 18, 4);
          fx.fillRect(x + 10, y + 5, 12, 3);
        }
      }
      for (const discovery of this.visiblePoiSignals || []) {
        const x = discovery.x * TILE;
        const y = discovery.y * TILE;
        if (x < minX || x > maxX || y < minY || y > maxY) continue;
        const underground = discovery.scope === "underground";
        const unread = !discovery.read;
        const pulse = 0.5 + Math.sin(now / (underground ? 420 : 560) + discovery.x * 0.37 + discovery.y * 0.21) * 0.5;
        const color = underground ? 0x9efff0 : 0xffe2a0;
        const alpha = (unread ? 0.42 : 0.18) + pulse * (unread ? 0.18 : 0.08);
        fx.lineStyle(1, color, alpha);
        fx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
        if (underground && unread) {
          fx.fillStyle(color, 0.12 + pulse * 0.08);
          fx.fillCircle(x + TILE / 2, y + TILE / 2, 10 + pulse * 4);
        }
      }
    }

    chestTableIdAt(x, y, secret = null) {
      const table = ML.WorldGenDirector?.chestTableFor?.(this.sim, x, y, secret);
      if (!table) return null;
      return Object.entries(ML.CHEST_TABLES || {}).find(([, value]) => value === table)?.[0] || null;
    }

    cacheVisualProfile(x, y, options = {}) {
      const secret = options.secret !== undefined ? options.secret : this.sim.secretAt(x, y);
      const tag = this.sim.chestTagAt?.(x, y) || null;
      const tableId = this.chestTableIdAt(x, y, secret) || tag?.type || "cave";
      const table = ML.WorldGenDirector?.chestTableFor?.(this.sim, x, y, secret) || null;
      let kind = "chest";
      if (secret || ["secret", "village", "watcher", "crystal", "abyss"].includes(tableId)) kind = "rare";
      else if (tableId === "lowland" || tableId === "surface") kind = "crate";
      else if (tableId === "grove" || tableId === "road") kind = "barrel";
      const tint = secret ? 0xd8b6ff
        : tableId === "watcher" ? 0xa985ff
          : tableId === "abyss" ? 0xff9b66
            : tableId === "crystal" ? 0x9efff0
              : null;
      return {
        kind,
        tableId,
        label: table?.label || (secret ? "Secret cache" : "Supply chest"),
        secret: Boolean(secret),
        tint
      };
    }

    updateChestProps(force = false) {
      if (!this.chestPropPool?.length || !ML.ExternalAssets?.cacheTextureKey) return;
      const now = this.time.now || 0;
      if (!force && now < this.nextChestPropScanAt) return;
      this.nextChestPropScanAt = now + 180;
      const cam = this.cameras.main;
      const minX = clamp(Math.floor((cam.scrollX - 64) / TILE), 0, this.worldWidthTiles() - 1);
      const maxX = clamp(Math.ceil((cam.scrollX + cam.width + 64) / TILE), 0, this.worldWidthTiles() - 1);
      const minY = clamp(Math.floor((cam.scrollY - 64) / TILE), 0, this.worldHeightTiles() - 1);
      const maxY = clamp(Math.ceil((cam.scrollY + cam.height + 64) / TILE), 0, this.worldHeightTiles() - 1);
      let used = 0;
      for (let y = minY; y <= maxY && used < this.chestPropPool.length; y += 1) {
        for (let x = minX; x <= maxX && used < this.chestPropPool.length; x += 1) {
          if (this.sim.tileAt(x, y) !== Tile.CHEST) continue;
          const profile = this.cacheVisualProfile(x, y);
          const key = ML.ExternalAssets.cacheTextureKey(profile.kind, false, this);
          if (!key) continue;
          const sprite = this.chestPropPool[used];
          used += 1;
          const pulse = profile.secret ? Math.sin(now / 360 + x * 0.6 + y * 0.35) * 0.05 : 0;
          sprite
            .setTexture(key)
            .setPosition(x * TILE + TILE / 2, y * TILE + TILE / 2)
            .setScale(1 + pulse)
            .setAlpha(profile.secret ? 0.98 : 0.94)
            .setVisible(true);
          if (profile.tint) sprite.setTint(profile.tint);
          else sprite.clearTint();
        }
      }
      for (let i = used; i < this.chestPropPool.length; i += 1) {
        this.chestPropPool[i].setVisible(false);
      }
      this.visibleChestPropCount = used;
    }

    updateDarkness() {
      const now = this.time.now || 0;
      const speed = Math.hypot(this.player.body?.velocity?.x || 0, this.player.body?.velocity?.y || 0);
      const key = [
        Math.round(this.player.x / 5),
        Math.round(this.player.y / 5),
        Math.round(this.cameras.main.scrollX / 5),
        Math.round(this.cameras.main.scrollY / 5),
        Math.round((this.shadowPressure || 0) / 2),
        Math.round((this.lampCharge || this.sim.lampCharge || 0) * 20),
        Math.round((this.externalLight || 0) * 20),
        Math.round(this.ambientLight() * 40),
        this.sim.lamp,
        this.lampStandby ? 1 : 0,
        this.sim.lights?.length || 0
      ].join("|");
      const idleDelay = speed > 8 || this.caveEvent || this.hasActiveBoss() ? 0 : 72;
      if (key === this.darknessDrawKey && now < this.nextDarknessDrawAt) return;
      this.darknessDrawKey = key;
      this.nextDarknessDrawAt = now + idleDelay;
      this.drawDarkness();
    }

    drawDarkness() {
      const cam = this.cameras.main;
      const ambient = this.ambientLight();
      const pressureBoost = clamp((this.shadowPressure || 0) / 100 * 0.1, 0, 0.1);
      const alpha = clamp(0.86 - ambient * 0.86 + pressureBoost, 0, 0.9);
      const rt = this.darknessRT;
      const glow = this.lightGlow;
      if (glow) glow.clear();
      rt.clear();

      const mask = this.lightMask;
      const now = this.time.now;
      const margin = 300;
      const minX = cam.scrollX - margin;
      const maxX = cam.scrollX + cam.width + margin;
      const minY = cam.scrollY - margin;
      const maxY = cam.scrollY + cam.height + margin;
      const punchLight = (screenX, screenY, radius) => {
        if (radius <= 1) return;
        mask.setDisplaySize(radius * 2, radius * 2);
        if (typeof rt.erase === "function") {
          rt.erase(mask, screenX, screenY);
        } else {
          mask.setBlendMode(Phaser.BlendModes.ERASE);
          rt.draw(mask, screenX, screenY);
          mask.setBlendMode(Phaser.BlendModes.NORMAL);
        }
      };
      const drawGlow = (screenX, screenY, radius, color, strength = 1) => {
        if (!glow || radius <= 1) return;
        glow.fillStyle(color, 0.10 * strength);
        glow.fillCircle(screenX, screenY, radius * 1.15);
        glow.fillStyle(color, 0.18 * strength);
        glow.fillCircle(screenX, screenY, radius * 0.58);
      };
      const drawHeadlampBeam = (screenX, screenY, radius) => {
        if (!glow || radius <= 1) return;
        const dir = this.player.flipX ? -1 : 1;
        const headX = screenX + dir * 9;
        const headY = screenY - 17;
        const reach = radius * 0.88;
        glow.fillStyle(0xf0c36a, 0.12);
        glow.fillCircle(headX, headY, 10);
        glow.fillStyle(0xf0c36a, 0.075);
        glow.beginPath();
        glow.moveTo(headX, headY);
        glow.lineTo(headX + dir * reach, headY - radius * 0.28);
        glow.lineTo(headX + dir * reach, headY + radius * 0.28);
        glow.closePath();
        glow.fillPath();
      };

      if (alpha <= 0.03) return;
      rt.fill(0x040309, alpha);
      let radius = this.personalLampOutput().radius;
      const playerScreenX = this.player.x - cam.scrollX;
      const playerScreenY = this.player.y - cam.scrollY;
      drawHeadlampBeam(playerScreenX, playerScreenY, radius);
      punchLight(playerScreenX, playerScreenY, radius);
      for (const light of this.sim.lights) {
        const r = BLOCKS[light.t]?.light || 0;
        if (!r) continue;
        const wx = light.x * TILE + TILE / 2;
        const wy = light.y * TILE + TILE / 2;
        if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;
        radius = r * TILE;
        if (light.t === Tile.TORCH || light.t === Tile.LAVA || light.t === Tile.CAMPFIRE) {
          radius += Math.sin(now / 95 + light.x * 13 + light.y * 7) * 7;
        }
        const sx = wx - cam.scrollX;
        const sy = wy - cam.scrollY;
        const color = light.t === Tile.LAVA ? 0xff6a2f : light.t === Tile.MUSHROOM ? 0x61e0d0 : light.t === Tile.CAMPFIRE ? 0xf5b45c : 0xf0b85c;
        const strength = light.t === Tile.CAMPFIRE ? 1.15 : light.t === Tile.TORCH ? 1 : 0.75;
        drawGlow(sx, sy, radius, color, strength);
        punchLight(sx, sy, radius);
      }
    }

    // ---- Observer anomalies --------------------------------------------------

    observerPhaseIndex() {
      return ML.LoreSystem?.phaseIndex?.(this.sim) || 0;
    }

    observerUnlocked(minPhase = 2) {
      const phase = this.observerPhaseIndex();
      return phase >= minPhase || ((this.sim.stats.watcherSightings || 0) > 0 && minPhase <= 3);
    }

    observerMomentLine(kind, cfg, phase) {
      const lines = (cfg.lines || []).filter((line) => phase >= (line.minPhase ?? cfg.minPhase ?? 0));
      const pool = lines.length ? lines : (cfg.lines || []);
      if (!pool.length) return { float: kind.toUpperCase(), note: cfg.action || "Something notices." };
      const seed = ((this.sim.seed || 0)
        + Math.floor((this.sim.time || 0) * 19)
        + (this.sim.stats.observerAnomalies || 0) * 29
        + kind.length * 43) >>> 0;
      return pool[seed % pool.length];
    }

    observerRiftPosition(options = {}) {
      if (Number.isFinite(options.x) && Number.isFinite(options.y)) return { x: options.x, y: options.y };
      const dir = this.player.flipX ? -1 : 1;
      const x = clamp(this.player.x + dir * Phaser.Math.Between(92, 150), 32, this.worldWidthTiles() * TILE - 32);
      const y = clamp(this.player.y - Phaser.Math.Between(52, 132), 42, this.worldHeightTiles() * TILE - 42);
      return { x, y };
    }

    spawnObserverRift(x, y, line = {}) {
      const rift = this.add.graphics({ x, y })
        .setDepth(84)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      const warm = line.float === "SPACE WINDOW" ? 0xf0c75e : 0x9efff0;
      rift.fillStyle(0x0b0e1d, 0.28);
      rift.fillRect(-19, -28, 38, 56);
      rift.lineStyle(2, warm, 0.78);
      rift.strokeRect(-18, -27, 36, 54);
      rift.lineStyle(1, 0xd8b6ff, 0.54);
      rift.strokeRect(-10, -19, 20, 38);
      rift.lineBetween(-23, -7, -10, -7);
      rift.lineBetween(10, 8, 24, 8);
      rift.lineBetween(-3, -33, -3, -22);
      rift.lineBetween(4, 22, 4, 33);
      this.observerRifts.push(rift);
      while (this.observerRifts.length > 3) {
        const old = this.observerRifts.shift();
        old?.destroy();
      }
      this.tweens.add({
        targets: rift,
        alpha: { from: 0.86, to: 0 },
        scaleX: { from: 0.62, to: 1.24 },
        scaleY: { from: 0.86, to: 1.08 },
        angle: Phaser.Math.Between(-2, 2),
        duration: 1280,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.observerRifts = this.observerRifts.filter((entry) => entry !== rift);
          rift.destroy();
        }
      });
      return rift;
    }

    triggerObserverMoment(kind, options = {}) {
      if (this.dead || !this.player) return false;
      const cfg = ML.OBSERVER_MOMENTS?.[kind];
      if (!cfg) return false;
      const now = this.time.now || 0;
      const phase = this.observerPhaseIndex();
      if (!options.force) {
        if (!this.observerUnlocked(cfg.minPhase || 2)) return false;
        if (now < this.nextObserverMomentAt) return false;
      }

      const line = this.observerMomentLine(kind, cfg, phase);
      this.sim.stats.observerAnomalies = (this.sim.stats.observerAnomalies || 0) + 1;
      if (cfg.stat) this.sim.stats[cfg.stat] = (this.sim.stats[cfg.stat] || 0) + 1;
      this.observerPulseUntil = Math.max(this.observerPulseUntil || 0, now + (cfg.pulse || 900));

      const min = cfg.cooldownMin || 16000;
      const max = Math.max(min, cfg.cooldownMax || min);
      if (!options.force) {
        this.nextObserverMomentAt = now + Phaser.Math.Between(min, max);
        if (kind === "idle" || kind === "lowLight" || kind === "pain") {
          this.nextHeroThoughtAt = now + Phaser.Math.Between(18000, 34000);
        }
        if (kind === "spatialRift") {
          this.nextSpatialRiftAt = now + Phaser.Math.Between(32000, 56000);
        }
      }

      if (kind === "spatialRift") {
        const spot = this.observerRiftPosition(options);
        this.spawnObserverRift(spot.x, spot.y, line);
      }

      if (!options.silent) {
        this.setAction(cfg.action || "Observed", 1400);
        const fxX = options.enemy?.x ?? this.player.x;
        const fxY = options.enemy?.y ?? this.player.y;
        this.floatText(fxX - 34, fxY - 42, line.float || cfg.action || "SEEN", kind === "pain" ? "#ffb36a" : "#9efff0");
        if (line.note) ML.showToast(line.note, 3300);
        if (cfg.camera) this.cameras.main.shake(140, cfg.camera);
        ML.audio.play(cfg.audio || "event");
      }

      this.checkLore(kind, { observer: true, spatialRift: kind === "spatialRift", silent: options.silent });
      this.checkAchievements();
      return true;
    }

    isEnemyObserved(enemy) {
      if (!enemy?.active || !this.observerUnlocked(3)) return false;
      const cam = this.cameras.main;
      const sx = enemy.x - cam.scrollX;
      const sy = enemy.y - cam.scrollY;
      if (sx < 42 || sx > cam.width - 42 || sy < 46 || sy > cam.height - 130) return false;
      const centered = Math.hypot((sx - cam.width / 2) / cam.width, (sy - cam.height / 2) / cam.height) < 0.34;
      const pointer = this.input?.activePointer;
      const pointerNear = pointer && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, enemy.x, enemy.y) < 78;
      return Boolean(centered || pointerNear);
    }

    updateObserverAwareness(_dt, state = {}) {
      if (this.dead || this.pausedByUI || !this.observerUnlocked(2)) return;
      const now = this.time.now || 0;
      const moving = Math.abs(state.vx || 0) > 5 || state.up || state.down || state.jumpPressed;
      if (moving) this.lastObserverMoveAt = now;

      if (!moving && state.onFloor && !state.onLadder && state.pointer && now - (this.lastObserverInputAt || 0) > 1200) {
        const dx = state.pointer.worldX - this.player.x;
        if (Math.abs(dx) > 18) this.player.setFlipX(dx < 0);
      }
      if (now - (this.lastObserverCheckAt || 0) < 220) return;
      this.lastObserverCheckAt = now;

      const idleMs = now - Math.max(this.lastObserverInputAt || 0, this.lastObserverMoveAt || 0);
      if (idleMs > 6500 && now > this.nextHeroThoughtAt && this.depthMeters() > 8 && !this.hasNearbyDanger()) {
        this.triggerObserverMoment("idle");
      }

      const light = this.playerLight();
      if (light < 0.28 && (this.shadowPressure || 0) > 42 && now > this.nextHeroThoughtAt) {
        this.triggerObserverMoment("lowLight");
      }

      const phase = this.observerPhaseIndex();
      const dangerousFrame = (this.shadowPressure || 0) > 62 || this.watcher?.visible || this.caveEvent?.id === "swarm" || this.caveEvent?.id === "tremor";
      if (phase >= 4 && dangerousFrame && this.depthMeters() > 55 && now > this.nextSpatialRiftAt) {
        this.triggerObserverMoment("spatialRift");
      }
    }

    // ---- Player feedback -----------------------------------------------------

    trackFall(onFloor, onLadder) {
      if (onLadder) return;
      if (!onFloor) {
        this.peakFallVy = Math.max(this.peakFallVy, this.player.body.velocity.y);
        this.wasAirborne = true;
        return;
      }
      if (!this.wasAirborne) return;
      this.wasAirborne = false;
      const peak = this.peakFallVy;
      this.peakFallVy = 0;
      if (peak > 320) {
        this.emitDust(this.player.x, this.player.y + 15, peak > 700 ? 7 : 4);
        this.emitNoise("landing", this.player.x, this.player.y + 12, {
          radius: TILE * (peak > 700 ? 8.5 : 5.5),
          intensity: peak > 700 ? 1.2 : 0.55,
          ttl: 3600
        });
        this.tweens.add({
          targets: this.player,
          scaleY: 0.84,
          scaleX: 1.12,
          duration: 60,
          yoyo: true,
          ease: "Quad.easeOut",
          onComplete: () => this.player.setScale(1, 1)
        });
      }
      const threshold = 760;
      if (peak > threshold) {
        let dmg = Math.round((peak - threshold) / 16);
        if (this.sim.boots) dmg = Math.round(dmg * 0.55);
        if (this.sim.fallGuard) dmg = Math.round(dmg * 0.55);
        if (dmg > 0) {
          ML.audio.play("land");
          this.cameras.main.shake(110, 0.005);
          this.applyDamage(dmg, "fall");
          this.floatText(this.player.x - 10, this.player.y - 30, `-${dmg}`, "#f08561");
        }
      }
    }

    updatePlayerAnim(vx, onFloor, onLadder) {
      if (onLadder) {
        this.player.anims.play(Math.abs(this.player.body.velocity.y) > 5 ? "walk" : "idle", true);
        return;
      }
      if (!onFloor) {
        this.player.anims.play(this.player.body.velocity.y < 0 ? "jump" : "fall", true);
        return;
      }
      this.player.anims.play(Math.abs(vx) > 5 ? "walk" : "idle", true);
    }

    applyDamage(amount, cause) {
      if (this.dead) return;
      this.lastDamageAt = this.time.now;
      this.sim.health = clamp(this.sim.health - amount, 0, this.sim.maxHealth);
      ML.flashDamage();
      if (this.sim.health > 0 && this.sim.health / Math.max(1, this.sim.maxHealth) < 0.34) {
        this.triggerObserverMoment("pain");
      }
      if (this.sim.health <= 0) this.failDescent(cause);
    }

    emitNoise(kind, x = this.player?.x || 0, y = this.player?.y || 0, options = {}) {
      if (!ML.MobSensors?.emitNoise) return null;
      const muffled = this.sim.noiseMuffle && options.source !== "enemy";
      const tuned = muffled
        ? Object.assign({}, options, {
          radius: (options.radius || TILE * 7) * 0.62,
          intensity: (options.intensity ?? 1) * 0.58
        })
        : options;
      return ML.MobSensors.emitNoise(this, kind, x, y, tuned);
    }

    updateNoiseEvents() {
      const now = this.time.now || 0;
      ML.MobSensors?.prune?.(this, now);
      const pressure = ML.MobSensors?.pressure?.(this, now) || 0;
      this.noisePressure = pressure;
      if (pressure < 2.8 || this.depthMeters() < 18 || this.caveEvent || this.hasActiveBoss()) return;
      if (now < this.nextNoiseEventAt) return;
      this.nextNoiseEventAt = now + 46000;
      this.sim.stats.noiseLures = (this.sim.stats.noiseLures || 0) + 1;
      this.floatText(this.player.x - 28, this.player.y - 46, "TOO LOUD", "#d8b6ff");
      if (now - this.lastNoiseToastAt > 9000) {
        this.lastNoiseToastAt = now;
        ML.showToast("The rock carries your noise. Something changes route.", 2600);
      }
      if (!this.startCaveEvent("swarm")) {
        this.spawnEventSwarm();
      }
      this.checkAchievements();
    }

    updateSurvivalRegen(dt, onFloor, inLava) {
      if (inLava || !onFloor || this.sim.health >= this.sim.maxHealth) return;
      if (this.time.now - this.lastDamageAt < 5200) return;
      if (this.sim.energy < 30) return;
      const danger = this.enemies.getChildren().some((enemy) =>
        enemy.active && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 150
      );
      if (danger) return;
      const light = this.playerLight();
      const surfaceRest = this.depthMeters() <= 3;
      const litRest = light > 0.5;
      const campRest = this.nearCamp();
      if (!surfaceRest && !litRest && !campRest) return;
      const biome = this.currentBiome();
      let rate = campRest ? 1.7 : surfaceRest ? 1.15 : 0.55;
      rate *= biome?.regenRate || 1;
      if (this.sim.regenBoost) rate *= 1.55;
      if (this.caveEvent?.id === "lanternDraft") rate *= 1.8;
      const before = this.sim.health;
      this.sim.health = clamp(this.sim.health + dt * rate, 0, this.sim.maxHealth);
      if (Math.floor(before) !== Math.floor(this.sim.health) && (!this.actionHoldUntil || this.time.now > this.actionHoldUntil)) {
        this.currentAction = campRest ? "Resting" : "Recover";
      }
    }

    applyBiomeEnergy(dt, onFloor, inLava) {
      if (inLava) return;
      const biome = this.currentBiome();
      const rate = biome?.energyRate || 0;
      if (!rate) return;
      const floorFactor = onFloor ? 1 : 0.45;
      const campFactor = this.nearCamp() && rate < 0 ? 0.2 : 1;
      this.sim.energy = clamp(this.sim.energy + dt * rate * floorFactor * campFactor, 0, this.sim.maxEnergy);
    }

    checkBiomeTransition() {
      const biome = this.currentBiome();
      const stratum = this.currentStratum();
      if (stratum && stratum.id !== this.lastStratumId) {
        const previousStratum = this.lastStratumId;
        this.lastStratumId = stratum.id;
        if (previousStratum && this.depthMeters() > 18) {
          this.setAction(stratum.tone || "New stratum", 1200);
          ML.showToast(`${stratum.name}: ${stratum.note}`, 3600);
        }
      }
      if (!biome || biome.id === this.lastBiomeId) return;
      const previous = this.lastBiomeId;
      this.lastBiomeId = biome.id;
      if (!previous) return;
      const now = this.time.now;
      if (now - this.lastBiomeToastAt < 3000) return;
      this.lastBiomeToastAt = now;
      this.setAction(biome.tone || "Biome", 1000);
      ML.showToast(ML.BiomeSystem.transitionText(biome), 2600);
      this.checkLore("biome", { biome });
    }

    touchingLava() {
      const body = this.player.body;
      const feetY = Math.floor((body.bottom - 3) / TILE);
      const midY = Math.floor((body.top + body.height / 2) / TILE);
      const leftX = Math.floor((body.left + 3) / TILE);
      const rightX = Math.floor((body.right - 3) / TILE);
      return this.sim.tileAt(leftX, feetY) === Tile.LAVA || this.sim.tileAt(rightX, feetY) === Tile.LAVA
        || this.sim.tileAt(leftX, midY) === Tile.LAVA || this.sim.tileAt(rightX, midY) === Tile.LAVA;
    }

    // ---- Pointer helpers -----------------------------------------------------

    targetTile(pointer) {
      const result = ML.ActionRules.targetTile(this.sim, this.player, pointer.worldX, pointer.worldY, INTERACT_RANGE_TILES);
      return result.ok ? { x: result.x, y: result.y, tile: result.tile, distance: result.distanceTiles } : null;
    }

    playerTilePoint() {
      return {
        x: this.player.x / TILE,
        y: this.player.y / TILE
      };
    }

    hasSightToTile(x, y) {
      return ML.ActionRules.hasLineOfSight(this.sim, this.playerTilePoint(), { x: x + 0.5, y: y + 0.5 });
    }

    hasSightBetweenWorld(ax, ay, bx, by) {
      return ML.ActionRules.hasWorldLineOfSight(this.sim, ax, ay, bx, by);
    }

    hasSightToEnemy(enemy) {
      if (!enemy?.active) return false;
      return ML.ActionRules.hasWorldLineOfSight(this.sim, this.player.x, this.player.y, enemy.x, enemy.y);
    }

    hasSightBetweenTiles(from, to) {
      return ML.ActionRules.hasLineOfSight(this.sim, from, to);
    }

    nearestTileObject(predicate, radius = INTERACT_RANGE_TILES) {
      const player = this.playerTilePoint();
      const minX = Math.max(0, Math.floor(player.x - radius - 1));
      const maxX = Math.min(this.worldWidthTiles() - 1, Math.ceil(player.x + radius + 1));
      const minY = Math.max(0, Math.floor(player.y - radius - 1));
      const maxY = Math.min(this.worldHeightTiles() - 1, Math.ceil(player.y + radius + 1));
      let best = null;
      let bestDistance = Infinity;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const tile = this.sim.tileAt(x, y);
          if (!predicate(tile, x, y)) continue;
          const distance = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y);
          if (distance > radius || distance >= bestDistance) continue;
          if (!this.hasSightToTile(x, y)) continue;
          best = { x, y, tile, distance };
          bestDistance = distance;
        }
      }
      return best;
    }

    interactionTarget() {
      if (!this.player || this.dead || this.pausedByUI) return null;
      const candidates = [];
      const pushCandidate = (target, distance = 0, priority = 0) => {
        candidates.push({ target, distance, priority });
      };

      const chest = this.nearestTileObject((tile) => tile === Tile.CHEST, INTERACT_RANGE_TILES);
      if (chest) {
        const secret = this.sim.secretAt(chest.x, chest.y);
        pushCandidate({
          kind: secret ? "secretChest" : "chest",
          key: "E",
          action: "Open",
          name: secret ? "Secret cache" : "Supply chest",
          hint: secret ? "Hidden loot" : "Loot cache",
          x: chest.x,
          y: chest.y
        }, chest.distance, 0.08);
      }

      const sign = this.nearestTileObject((tile) => tile === Tile.SIGN, INTERACT_RANGE_TILES);
      if (sign) {
        const discovery = this.sim.surfaceDiscoveryAt?.(sign.x, sign.y);
        pushCandidate({
          kind: "surfaceDiscovery",
          key: "E",
          action: "Read",
          name: discovery?.title || "Road sign",
          hint: discovery?.read ? "Read again" : discovery?.scope === "underground" ? "Field note" : "Surface clue",
          x: sign.x,
          y: sign.y
        }, sign.distance, 0);
      }

      const camp = ML.CampSystem.nearestCampfire(this.sim, this.player);
      if (camp) {
        pushCandidate({
          kind: "camp",
          key: "E",
          action: "Use",
          name: "Campfire",
          hint: `Anchor ${ML.CampSystem.campLabel(this.sim, ML.CampSystem.activeCamp(this.sim))}`,
          x: camp.x,
          y: camp.y
        }, camp.distance || 0, 0.16);
      }

      candidates.sort((a, b) => {
        const scoreA = a.distance + a.priority;
        const scoreB = b.distance + b.priority;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.distance - b.distance;
      });
      return candidates[0]?.target || null;
    }

    interact() {
      const target = this.interactionTarget();
      if (!target) return false;
      if (target.kind === "chest" || target.kind === "secretChest") {
        return this.openChest(target.x, target.y);
      }
      if (target.kind === "surfaceDiscovery") {
        return this.readSurfaceDiscovery(target.x, target.y);
      }
      if (target.kind === "camp") {
        this.toggleCamp(true);
        return true;
      }
      return false;
    }

    discoveryFloatLabel(discovery) {
      if (!discovery) return "FIELD MARK";
      if (discovery.label) return discovery.label;
      if (discovery.type === "hamlet") return "SILENT HAMLET";
      if (discovery.type === "waypost") return "WAYPOST";
      return discovery.scope === "underground" ? "SURVEY MARK" : "ROAD MARK";
    }

    discoveryCue(discovery) {
      if (!discovery) return "A mark catches your eye.";
      if (discovery.scope === "underground") {
        if (discovery.type === "pump") return "Old machinery interrupts the cave shape.";
        if (discovery.type === "shrine") return "Warm soot marks a chamber that should be cold.";
        if (discovery.type === "cache") return "A misfiled cache tag glints in the dark.";
        return "A survey mark stands where no survey should be.";
      }
      if (discovery.type === "hamlet") return "Roofs interrupt the empty horizon.";
      if (discovery.type === "waypost") return "A waypost stands beyond the old map.";
      return "A road sign catches your eye.";
    }

    markSurfaceDiscovery(discovery, read = false) {
      if (!discovery) return false;
      const firstSeen = !discovery.seen;
      discovery.seen = true;
      if (read) discovery.read = true;
      if (firstSeen) {
        this.sim.stats.poiDiscoveries = (this.sim.stats.poiDiscoveries || 0) + 1;
        if (discovery.scope === "underground") {
          this.sim.stats.undergroundDiscoveries = (this.sim.stats.undergroundDiscoveries || 0) + 1;
        } else {
          this.sim.stats.surfaceDiscoveries = (this.sim.stats.surfaceDiscoveries || 0) + 1;
        }
        this.checkAchievements();
      }
      return firstSeen;
    }

    readSurfaceDiscovery(x, y) {
      const discovery = this.sim.surfaceDiscoveryAt?.(x, y);
      if (!discovery) return false;
      const firstSeen = this.markSurfaceDiscovery(discovery, true);
      this.setAction(discovery.scope === "underground" ? "Read field mark" : "Read sign", 1200);
      this.floatText(x * TILE - 18, y * TILE - 18, this.discoveryFloatLabel(discovery), discovery.scope === "underground" ? "#b8f7ff" : "#ffe2a0");
      ML.audio.play(firstSeen ? "secret" : "click");
      ML.showToast(`${discovery.title}: ${discovery.message}`, 6200);
      ML.renderAll(this.sim);
      this.saveGame();
      return true;
    }

    updatePoiAmbience() {
      const now = this.time.now || 0;
      if (now < this.nextPoiSignalScanAt) return;
      this.nextPoiSignalScanAt = now + 320;
      if (!Array.isArray(this.sim.surfaceDiscoveries) || !this.sim.surfaceDiscoveries.length) {
        this.visiblePoiSignals = [];
        return;
      }
      const cam = this.cameras.main;
      const minX = (cam.scrollX - 128) / TILE;
      const maxX = (cam.scrollX + cam.width + 128) / TILE;
      const minY = (cam.scrollY - 128) / TILE;
      const maxY = (cam.scrollY + cam.height + 128) / TILE;
      const px = this.player.x / TILE;
      const py = this.player.y / TILE;
      const visible = [];
      for (const discovery of this.sim.surfaceDiscoveries) {
        if (this.sim.tileAt(discovery.x, discovery.y) !== Tile.SIGN) continue;
        if (discovery.x < minX || discovery.x > maxX || discovery.y < minY || discovery.y > maxY) continue;
        const distance = Math.hypot(discovery.x + 0.5 - px, discovery.y + 0.5 - py);
        visible.push({ discovery, distance });
      }
      visible.sort((a, b) => a.distance - b.distance);
      this.visiblePoiSignals = visible.slice(0, 14).map((entry) => entry.discovery);

      const nearest = visible.find((entry) => entry.discovery.scope === "underground" && !entry.discovery.read && entry.distance < 9);
      if (nearest && now > this.nextPoiSignalToastAt) {
        this.nextPoiSignalToastAt = now + 9000;
        this.floatText(nearest.discovery.x * TILE - 20, nearest.discovery.y * TILE - 20, "SIGNAL", "#9efff0");
      }
    }

    updateSurfaceDiscoveries() {
      const now = this.time.now || 0;
      if (now - this.lastSurfaceDiscoveryCheckAt < 650) return;
      this.lastSurfaceDiscoveryCheckAt = now;
      if (!Array.isArray(this.sim.surfaceDiscoveries) || !this.sim.surfaceDiscoveries.length) return;
      const px = this.player.x / TILE;
      const py = this.player.y / TILE;
      for (const discovery of this.sim.surfaceDiscoveries) {
        if (discovery.seen) continue;
        const distance = Math.hypot(discovery.x + 0.5 - px, discovery.y + 0.5 - py);
        if (distance > 8.5) continue;
        this.markSurfaceDiscovery(discovery, false);
        if (now - this.lastSurfaceDiscoveryAt > 4500) {
          this.lastSurfaceDiscoveryAt = now;
          const cue = this.discoveryCue(discovery);
          this.setAction(discovery.scope === "underground" ? "Field mark" : "Surface clue", 1400);
          this.floatText(discovery.x * TILE - 18, discovery.y * TILE - 18, this.discoveryFloatLabel(discovery), discovery.scope === "underground" ? "#b8f7ff" : "#ffe2a0");
          ML.showToast(`${cue} Press E to read it.`, 3200);
        }
        this.saveGame();
        break;
      }
    }

    interactOrCraft() {
      if (this.pausedByUI || this.dead) return false;
      if (this.craftOpen) {
        this.toggleCraft(false);
        return true;
      }
      if (this.campOpen) {
        this.toggleCamp(false);
        return true;
      }
      if (this.packOpen) {
        this.togglePack(false);
        return true;
      }
      if (this.interact()) return true;
      this.toggleCraft();
      return true;
    }

    describePointerTarget() {
      const enemy = this.findEnemyAtPointer(this.input.activePointer);
      if (enemy) return this.enemyName(enemy.kind);
      const target = this.targetTile(this.input.activePointer);
      if (!target) return "Out of range";
      if (target.tile === AIR) return "Air";
      return BLOCKS[target.tile]?.name || "Unknown";
    }

    enemyName(kind, enemy = null) {
      const names = {
        mossling: "Mossling",
        crawler: "Crawler",
        bat: "Bat",
        slime: "Slime",
        golem: "Deep golem",
        broodmother: "Broodmother",
        warden: "Abyss Warden"
      };
      const base = names[kind] || "Enemy";
      return enemy?.elite ? `Elite ${base}` : base;
    }

    findEnemyAtPointer(pointer) {
      if (!pointer || !this.enemies) return null;
      let best = null;
      let bestDistance = Infinity;
      for (const enemy of this.enemies.getChildren()) {
        if (!enemy.active) continue;
        if (!this.hasSightToEnemy(enemy)) continue;
        const distance = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, enemy.x, enemy.y);
        if (distance < 34 && distance < bestDistance) {
          best = enemy;
          bestDistance = distance;
        }
      }
      return best;
    }

    setAction(label, holdMs = 0) {
      this.currentAction = label;
      this.actionHoldUntil = holdMs ? this.time.now + holdMs : 0;
    }

    rewardSummary(reward) {
      const parts = [];
      for (const [item, count] of Object.entries(reward || {})) {
        if (!count) continue;
        parts.push(`${ITEM_META[item]?.name || item} +${count}`);
      }
      return parts.join(", ");
    }

    checkContract() {
      const result = this.sim.claimContract?.();
      if (!result) return false;
      const reward = this.rewardSummary(result.completed.reward);
      this.setAction("Contract", 1500);
      this.floatText(this.player.x - 32, this.player.y - 42, "CONTRACT", "#9edbe2");
      ML.audio.play("contract");
      ML.showToast(`${result.completed.name} complete: ${reward}. New contract: ${result.next?.name || "none"}.`, 4200);
      ML.renderAll(this.sim);
      this.checkAchievements();
      return true;
    }

    recallCost() {
      return this.sim.recallCharm ? 18 : 34;
    }

    recallCooldownMs() {
      return this.sim.recallCharm ? 30000 : 54000;
    }

    recallCooldownRemaining() {
      return Math.max(0, Math.ceil(((this.nextRecallAt || 0) - this.time.now) / 1000));
    }

    recallToCamp() {
      if (this.pausedByUI || this.dead) return false;
      const anchor = ML.CampSystem.activeCamp(this.sim);
      const anchorSpawn = ML.CampSystem.campSpawnPixels(this.sim, anchor);
      const anchorDepth = ML.CampSystem.campDepth(this.sim, anchor);
      const currentDepth = this.depthMeters();
      const nearest = ML.CampSystem.nearestCampfire(this.sim, this.player);
      if (ML.CampSystem.sameCamp(anchor, nearest)) {
        this.setAction("At camp", 900);
        ML.showToast("You are already near the anchored campfire.", 1200);
        return false;
      }
      if (currentDepth + 3 < anchorDepth) {
        this.setAction("Anchor below", 1100);
        ML.audio.play("denied");
        ML.showToast("Recall cannot pull you deeper to an anchored campfire.", 1900);
        return false;
      }
      if (this.hasActiveBoss()) {
        this.setAction("Boss lock", 1100);
        ML.audio.play("denied");
        ML.showToast("A boss aura blocks recall. Finish the fight or retreat first.", 2200);
        return false;
      }
      if (this.time.now - this.lastDamageAt < 1400) {
        this.setAction("Interrupted", 900);
        ML.audio.play("denied");
        ML.showToast("Recall needs a clean second after damage.", 1600);
        return false;
      }
      const remaining = this.recallCooldownRemaining();
      if (remaining > 0) {
        this.setAction("Recharging", 900);
        ML.audio.play("denied");
        ML.showToast(`Recall is recharging: ${remaining}s.`, 1300);
        return false;
      }
      const cost = this.recallCost();
      if (this.sim.energy < cost) {
        this.setAction("Low energy", 900);
        ML.audio.play("denied");
        ML.showToast(`Recall needs ${cost} energy.`, 1500);
        return false;
      }

      this.sim.energy = clamp(this.sim.energy - cost, 0, this.sim.maxEnergy);
      this.nextRecallAt = this.time.now + this.recallCooldownMs();
      this.sim.stats.recalls += 1;
      this.setAction("Recall", 1400);
      this.resetInputState();
      this.emitDust(this.player.x, this.player.y + 14, 10);
      this.floatText(this.player.x - 24, this.player.y - 42, "RECALL", "#9edbe2");
      ML.audio.play("recall");
      this.cameras.main.fadeOut(110, 12, 18, 28);
      this.time.delayedCall(130, () => {
        const safe = anchorSpawn;
        this.player.setPosition(safe.x, safe.y);
        this.player.setVelocity(0, 0);
        this.sim.player = safe;
        this.wasAirborne = false;
        this.peakFallVy = 0;
        this.jumpsUsed = 0;
        this.playerIframesUntil = this.time.now + 900;
        this.cameras.main.fadeIn(190, 12, 18, 28);
        this.emitDust(this.player.x, this.player.y + 14, 8);
        ML.showToast(`Recalled to campfire anchor (${ML.CampSystem.campLabel(this.sim, anchor)}).`, 1700);
        this.checkAchievements();
        ML.renderAll(this.sim);
        this.saveGame();
      });
      ML.renderAll(this.sim);
      return true;
    }

    // ---- Pickaxe visuals -----------------------------------------------------

    swingPickaxe(duration = 330) {
      this.pickSwingStart = this.time.now;
      this.pickSwingUntil = this.time.now + duration;
    }

    updatePickaxeVisual(mining) {
      if (!this.pickSprite || !this.player) return;
      const dir = this.player.flipX ? -1 : 1;
      const now = this.time.now || 0;
      const baseAngle = dir > 0 ? 0.48 : -0.48;
      let angle = baseAngle;
      if (this.curPickLevel !== this.sim.pickLevel) {
        this.curPickLevel = this.sim.pickLevel;
        this.pickSprite.setFrame(`pick${clamp(this.sim.pickLevel - 1, 0, PICKS.length - 2)}`);
      }

      const swinging = now < this.pickSwingUntil;
      if (swinging) {
        const span = Math.max(1, this.pickSwingUntil - this.pickSwingStart);
        const p = clamp((now - this.pickSwingStart) / span, 0, 1);
        const arc = Math.sin(p * Math.PI);
        angle = dir > 0 ? 0.95 - arc * 1.25 : -0.95 + arc * 1.25;
        if (now - this.lastGhostAt > 42) {
          this.lastGhostAt = now;
          const ghost = this.ghostPool[this.ghostIndex];
          this.ghostIndex = (this.ghostIndex + 1) % this.ghostPool.length;
          ghost.setFrame(this.pickSprite.frame.name)
            .setPosition(this.pickSprite.x, this.pickSprite.y)
            .setRotation(this.pickSprite.rotation)
            .setFlipX(this.pickSprite.flipX)
            .setAlpha(0.32)
            .setVisible(true);
        }
      } else if (mining) {
        const pulse = Math.sin(now / 52) * 0.22;
        angle = dir > 0 ? 0.78 + pulse : -0.78 - pulse;
      }
      for (const ghost of this.ghostPool) {
        if (ghost.alpha > 0) {
          ghost.setAlpha(Math.max(0, ghost.alpha - 0.04));
          if (ghost.alpha === 0) ghost.setVisible(false);
        }
      }

      // High-tier drills shimmer.
      const glow = this.sim.pickLevel >= 5 ? 0.92 + Math.sin(now / 140) * 0.08 : 1;
      this.pickSprite
        .setPosition(this.player.x + dir * 12, this.player.y - 1)
        .setFlipX(dir < 0)
        .setRotation(angle)
        .setAlpha(glow);
    }

    // ---- Mining --------------------------------------------------------------

    handleMining(delta) {
      const target = this.targetTile(this.input.activePointer);
      if (!target) {
        this.targetLabel = "Out of range";
        this.setAction("Too far", 220);
        this.mineGraphics.clear();
        this.mineTarget = null;
        return;
      }
      if (target.tile === AIR) {
        this.mineGraphics.clear();
        this.mineTarget = null;
        return;
      }
      const rule = ML.ActionRules.canMineTile(this.sim, this.player, { ok: true, ...target }, this.sim.pickLevel);
      const block = rule.block || BLOCKS[target.tile];
      if (!rule.ok && (rule.reason === "unknown" || rule.reason === "bedrock" || rule.reason === "lava")) {
        this.targetLabel = block ? block.name : "Unknown";
        if (target.tile === Tile.BEDROCK && this.openAbyssSeam(target)) {
          this.mineTarget = null;
          this.mineProgress = 0;
          return;
        }
        ML.showToast(target.tile === Tile.LAVA ? "You cannot mine lava. Cover it with a block." : "Ancient bedrock holds. The lower seam is where the world continues.");
        this.mineTarget = null;
        return;
      }
      if (!rule.ok && rule.reason === "camp") {
        this.targetLabel = block.name;
        this.setAction("Camp point", 420);
        if (this.time.now - this.lastCampHintAt > 1500) {
          this.lastCampHintAt = this.time.now;
          ML.showToast("Campfire is a rest point. Press C nearby.", 1200);
        }
        this.mineTarget = null;
        return;
      }
      if (!rule.ok && rule.reason === "tier") {
        this.targetLabel = block.name;
        ML.showToast(`${block.name} needs ${PICKS[block.tier]?.name || "a better pick"}.`);
        ML.audio.play("denied");
        this.mineTarget = null;
        return;
      }
      const key = `${target.x}:${target.y}`;
      if (this.mineTarget !== key) {
        this.mineTarget = key;
        this.mineProgress = 0;
      }

      let stamina = 0.55 + this.sim.energy / 220;
      if (this.sim.energy < 5) stamina *= 0.55;
      const fatigue = this.currentStratum()?.miningFatigue || 1;
      this.mineProgress += (delta / 1000) * PICKS[this.sim.pickLevel].speed * stamina / (block.hardness * fatigue);
      this.sim.energy = clamp(this.sim.energy - (delta / 1000) * 9.5 * fatigue, 0, this.sim.maxEnergy);
      this.targetLabel = block.name;
      this.setAction("Mining", 220);
      if (this.time.now > this.pickSwingUntil - 80) {
        this.swingPickaxe(240);
        ML.audio.play("dig");
        this.emitBlockBurst(target.x, target.y, BLOCK_TINTS[target.tile] || 0xffffff, 2);
        this.emitNoise("mining", target.x * TILE + TILE / 2, target.y * TILE + TILE / 2, {
          radius: TILE * 6.5,
          intensity: 0.48,
          ttl: 3200
        });
      }
      this.drawMiningTarget(target, this.mineProgress);

      if (this.mineProgress >= 1) {
        this.breakTile(target.x, target.y, true);
        this.mineProgress = 0;
        this.mineTarget = null;
        this.mineGraphics.clear();
      }
    }

    drawMiningTarget(target, progress) {
      const x = target.x * TILE;
      const y = target.y * TILE;
      const p = clamp(progress, 0, 1);
      this.mineGraphics.clear();
      this.mineGraphics.lineStyle(2, 0xf0cf6d, 1);
      this.mineGraphics.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      this.mineGraphics.fillStyle(0xf0cf6d, 0.7);
      this.mineGraphics.fillRect(x + 4, y + TILE - 7, (TILE - 8) * p, 3);
      // Crack lines appear in stages.
      const stage = Math.floor(p * 4);
      if (stage > 0) {
        this.mineGraphics.lineStyle(1, 0x1d150c, 0.75);
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        const cracks = [
          [cx, cy, x + 6, y + 5],
          [cx, cy, x + TILE - 4, y + 9],
          [cx, cy, x + 8, y + TILE - 5],
          [cx, cy, x + TILE - 7, y + TILE - 6]
        ];
        for (let i = 0; i < stage && i < cracks.length; i += 1) {
          const [x1, y1, x2, y2] = cracks[i];
          this.mineGraphics.lineBetween(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
          this.mineGraphics.lineBetween((x1 + x2) / 2 + 2, (y1 + y2) / 2 - 1, x2, y2);
        }
      }
    }

    openAbyssSeam(target = null, reason = "mine") {
      const x = clamp(Math.floor(target?.x ?? this.player.x / TILE), 2, this.worldWidthTiles() - 3);
      const y = Math.floor(target?.y ?? this.player.y / TILE);
      if (!this.sim.canOpenDepthSeam?.(x, y)) return false;
      const result = this.sim.extendDepth(x, 96);
      if (!result) return false;
      this.rebuildWorldLayer();
      ML.minimap.init(this.sim);
      this.cameras.main.shake(reason === "fall" ? 190 : 260, reason === "fall" ? 0.006 : 0.009);
      this.emitBlockBurst(x, Math.max(1, result.from - 3), 0xd8b6ff, 18);
      this.emitDust(x * TILE + TILE / 2, (result.from - 2) * TILE, 10);
      this.floatText(this.player.x - 36, this.player.y - 52, "ABYSS SEAM", "#d8b6ff");
      this.setAction("World opens", 1600);
      this.checkAchievements();
      ML.audio.play("rumble");
      ML.showToast(`${result.stratumName || "New stratum"} opened: ${result.from}m-${result.to}m.`, 4200);
      return true;
    }

    syncAndClearActiveMobs() {
      for (const enemy of this.enemies?.getChildren?.() || []) {
        if (enemy.active && enemy.mobId) this.syncMobEntry(enemy);
        enemy.destroy();
      }
      this.activeMobIds.clear();
      this.clearPendingMobSpawns(false);
    }

    updateHorizontalExpansion() {
      const now = this.time.now || 0;
      if (now < this.nextHorizontalExpandAt || !this.sim?.extendHorizontal) return false;
      const width = this.worldWidthTiles();
      const px = this.player.x / TILE;
      const margin = Math.max(16, Math.ceil(this.cameras.main.width / TILE * 0.28));
      if (px < margin) return this.openHorizontalRegion("left");
      if (width - px < margin) return this.openHorizontalRegion("right");
      return false;
    }

    openHorizontalRegion(direction) {
      const side = direction === "left" ? "left" : "right";
      this.nextHorizontalExpandAt = (this.time.now || 0) + 1800;
      this.syncAndClearActiveMobs();
      const result = this.sim.extendHorizontal(side);
      if (!result) return false;
      const shiftPx = (result.shiftTiles || 0) * TILE;
      if (shiftPx) {
        this.player.x += shiftPx;
        this.cameras.main.scrollX += shiftPx;
        this.mineTarget = null;
        this.mineProgress = 0;
        this.mineGraphics?.clear();
      }
      this.rebuildWorldLayer();
      ML.minimap.init(this.sim);
      this.refreshMobActivation();
      this.cameras.main.shake(160, 0.004);
      this.emitDust(this.player.x, this.player.y + 12, 8);
      this.floatText(this.player.x - 42, this.player.y - 50, side === "left" ? "WEST OPENS" : "EAST OPENS", "#9efff0");
      this.setAction("Horizon opens", 1500);
      ML.audio.play("rumble");
      ML.showToast(`${side === "left" ? "Western" : "Eastern"} horizon opened: +${result.columns} columns, ${result.chests} caches, ${result.mobs} mobs.`, 3600);
      this.checkAchievements();
      ML.renderAll(this.sim);
      this.saveGame();
      return true;
    }

    breakTile(x, y, awardDrop, opts = {}) {
      const tile = this.sim.tileAt(x, y);
      if (tile === AIR || tile === Tile.BEDROCK) return false;
      const block = BLOCKS[tile];
      if (!block) return false;

      this.sim.setTile(x, y, AIR);
      this.layer.removeTileAt(x, y, true, false);
      if (!opts.batch) this.layer.calculateFacesWithin(x - 1, y - 1, 3, 3);
      if (block.light) this.sim.removeLightAt(x, y);

      if (block.loot && awardDrop) {
        this.lootChest(x, y);
      } else if (awardDrop && block.drop && (tile !== Tile.LEAVES || Math.random() < 0.45)) {
        this.sim.addItem(block.drop, 1);
        this.spawnPickupFx(x, y, block.drop);
        if (this.caveEvent?.id === "oreSurge" && tile !== Tile.LEAVES && Math.random() < 0.34) {
          this.sim.addItem(block.drop, 1);
          this.spawnPickupFx(x, y, block.drop);
          this.floatText(x * TILE + 4, y * TILE - 12, "+surge", "#9edbe2");
        }
      }

      this.sim.stats.mined += 1;
      if (!opts.batch) {
        this.emitNoise("break", x * TILE + TILE / 2, y * TILE + TILE / 2, {
          radius: TILE * 7.5,
          intensity: 0.86,
          ttl: 4200
        });
      }
      this.checkContract();
      this.checkAchievements();
      this.emitBlockBurst(x, y, BLOCK_TINTS[tile] || 0xffffff, opts.batch ? 3 : 6);
      ML.minimap.paintTile(this.sim, x, y);
      if (!opts.batch) {
        ML.audio.play("break");
        ML.renderAll(this.sim);
      }
      return true;
    }

    openChest(x, y) {
      if (this.sim.tileAt(x, y) !== Tile.CHEST) return false;
      const profile = this.cacheVisualProfile(x, y);
      this.sim.setTile(x, y, AIR);
      this.layer.removeTileAt(x, y, true, false);
      this.layer.calculateFacesWithin(x - 1, y - 1, 3, 3);
      this.playCacheOpenFx(x, y, profile);
      this.updateChestProps(true);
      this.emitBlockBurst(x, y, BLOCK_TINTS[Tile.CHEST] || 0xcaa258, 7);
      ML.minimap.paintTile(this.sim, x, y);
      this.setAction("Open cache", 900);
      this.emitNoise("cache", x * TILE + TILE / 2, y * TILE + TILE / 2, {
        radius: TILE * 4.5,
        intensity: 0.42,
        ttl: 2800
      });
      this.lootChest(x, y, profile);
      ML.renderAll(this.sim);
      this.saveGame();
      return true;
    }

    playCacheOpenFx(x, y, profile = null) {
      const frameKeys = ML.ExternalAssets?.cacheOpenFrameKeys?.(this) || [];
      if ((profile?.kind || "chest") === "chest" && frameKeys.length >= 4) {
        this.playCacheOpenAnimationFx(x, y, profile, frameKeys);
        return;
      }
      const key = ML.ExternalAssets?.cacheTextureKey?.(profile?.kind || "chest", true, this);
      if (!key) return;
      const sprite = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, key)
        .setDepth(42)
        .setScale(0.92)
        .setAlpha(0.98);
      if (profile?.tint) sprite.setTint(profile.tint);
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 8,
        scale: 1.24,
        alpha: 0,
        duration: profile?.secret ? 760 : 560,
        ease: "Sine.easeOut",
        onComplete: () => sprite.destroy()
      });
    }

    playCacheOpenAnimationFx(x, y, profile = null, frameKeys = []) {
      const sprite = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, frameKeys[0])
        .setDepth(42)
        .setScale(0.98)
        .setAlpha(0.98);
      if (profile?.tint) sprite.setTint(profile.tint);
      this.lastCacheOpenAnimation = {
        x,
        y,
        kind: profile?.kind || "chest",
        frameCount: frameKeys.length,
        startedAt: this.time.now || 0
      };
      frameKeys.forEach((frameKey, index) => {
        this.time.delayedCall(index * 82, () => {
          if (sprite.active) sprite.setTexture(frameKey);
        });
      });
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 8,
        scale: 1.26,
        alpha: 0,
        delay: 82 * Math.max(0, frameKeys.length - 1),
        duration: 420,
        ease: "Sine.easeOut",
        onComplete: () => sprite.destroy()
      });
    }

    lootChest(x, y, cacheProfile = null) {
      const depth = Math.max(0, y - (this.sim.surface[x] || 24));
      const secret = this.sim.secretAt(x, y);
      const rolled = ML.WorldGenDirector?.rollChestLoot?.(this.sim, x, y, { secret, rand: Math.random }) || null;
      const loot = rolled?.loot || { coal: 2 + Math.floor(Math.random() * 3), coin: 4 + Math.floor(Math.random() * 7) };
      if (secret) {
        this.sim.markSecretOpened(secret);
        this.checkLore("secret", { secret });
        loot.coin = (loot.coin || 0) + 6 + secret.tier * 4;
        loot.relic = (loot.relic || 0) + Math.max(1, secret.tier - 1);
        if (secret.tier >= 2) loot.gold = (loot.gold || 0) + 2;
        if (secret.tier >= 3) {
          loot.crystal = (loot.crystal || 0) + 2;
          loot.obsidian = (loot.obsidian || 0) + 2;
        }
      }
      const parts = [];
      for (const [item, n] of Object.entries(loot)) {
        if (!n) continue;
        this.sim.addItem(item, n);
        parts.push(`${ITEM_META[item]?.name || item} +${n}`);
        this.spawnPickupFx(x, y, item);
      }
      ML.audio.play(secret ? "secret" : "chest");
      const label = secret ? "Secret cache" : rolled?.label || cacheProfile?.label || "Chest";
      this.floatText(x * TILE, y * TILE - 6, `${label}!`, secret ? "#d8b6ff" : "#ffe49a");
      ML.showToast(`${label}: ${parts.join(", ")}.`, 3600);
      this.sim.stats.chests += 1;
      this.checkContract();
      this.checkAchievements();
    }

    // ---- Placing & using items -------------------------------------------------

    tryUseSelected(pointer) {
      const item = HOTBAR[this.sim.selected];
      const meta = ITEM_META[item];
      const target = this.targetTile(pointer);

      // Consumables are eaten — except a glow cap aimed at open air, which is planted.
      if (meta.consumable) {
        const canPlace = meta.tile !== undefined && target && target.tile === AIR && (this.sim.inventory[item] || 0) > 0;
        if (!canPlace) {
          const result = this.sim.eat(item);
          ML.showToast(result.message, 1600);
          ML.audio.play(result.ok ? "eat" : "denied");
          if (result.ok) {
            this.setAction("Recover", 800);
            this.spawnRecoverFx(item);
          }
          ML.renderAll(this.sim);
          return;
        }
      }

      if (!target) {
        this.setAction("Too far", 900);
        ML.showToast(`Move closer. Reach is ${INTERACT_RANGE_TILES.toFixed(1)} blocks.`);
        return;
      }
      if ((this.sim.inventory[item] || 0) <= 0) {
        this.setAction("Need item", 900);
        ML.audio.play("denied");
        ML.showToast(`No ${meta.name}.`);
        return;
      }

      if (item === "charge") {
        if (target.tile === AIR) {
          this.setAction("Aim charge", 900);
          ML.showToast("Aim a charge at rock.");
          return;
        }
        this.setAction("Charge", 900);
        this.sim.removeItem("charge", 1);
        this.floatText(target.x * TILE, target.y * TILE, "Charge set", "#f5d77a");
        this.time.delayedCall(420, () => this.explode(target.x, target.y, 2.45 + (this.sim.blastRadius || 0)));
        ML.renderAll(this.sim);
        return;
      }

      const placeTile = meta.tile;
      if (placeTile === undefined) return;

      // Dropping a solid block into lava hardens it to stone.
      if (target.tile === Tile.LAVA && BLOCKS[placeTile].solid) {
        const lavaRect = new Phaser.Geom.Rectangle(target.x * TILE, target.y * TILE, TILE, TILE);
        if (Phaser.Geom.Intersects.RectangleToRectangle(lavaRect, this.player.getBounds())) {
          this.setAction("Too close", 900);
          ML.showToast("Step out of the lava first.");
          return;
        }
        if (!this.sim.removeItem(item, 1)) return;
        this.sim.removeLightAt(target.x, target.y);
        this.placeTileAt(Tile.STONE, target.x, target.y);
        this.setAction("Cool lava", 900);
        ML.showToast("The lava hardens into stone.");
        ML.audio.play("place");
        ML.renderAll(this.sim);
        return;
      }

      if (target.tile !== AIR) {
        this.setAction("Blocked", 900);
        ML.showToast("Space is occupied.");
        return;
      }
      const rect = new Phaser.Geom.Rectangle(target.x * TILE, target.y * TILE, TILE, TILE);
      if (BLOCKS[placeTile].solid && !BLOCKS[placeTile].platform && Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
        this.setAction("Too close", 900);
        ML.showToast("Too close.");
        return;
      }
      if (!this.sim.removeItem(item, 1)) return;
      this.setAction("Place", 650);
      this.placeTileAt(placeTile, target.x, target.y);
      ML.audio.play("place");
      ML.renderAll(this.sim);
    }

    placeTileAt(placeTile, x, y) {
      this.sim.setTile(x, y, placeTile);
      const tile = this.layer.putTileAt(placeTile, x, y, false);
      const block = BLOCKS[placeTile];
      if (tile) {
        if (block.solid) {
          if (block.platform) tile.setCollision(false, false, true, false);
          else tile.setCollision(true);
        } else {
          tile.setCollision(false);
        }
      }
      this.layer.calculateFacesWithin(x - 1, y - 1, 3, 3);
      if (block.light) this.sim.addLight(x, y, placeTile);
      ML.minimap.paintTile(this.sim, x, y);
    }

    explode(cx, cy, radius) {
      this.cameras.main.shake(200, 0.011);
      ML.audio.play("explode");
      this.emitNoise("blast", cx * TILE + TILE / 2, cy * TILE + TILE / 2, {
        radius: TILE * (radius * 4.2),
        intensity: 2.45,
        ttl: 6200
      });
      this.emitBlockBurst(cx, cy, 0xff9038, 14, 220);
      this.emitDust(cx * TILE + TILE / 2, cy * TILE + TILE / 2, 8);

      for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
        for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
          const d = Math.hypot(x - cx, y - cy);
          const tile = this.sim.tileAt(x, y);
          if (d <= radius && tile !== AIR && tile !== Tile.BEDROCK) {
            const block = BLOCKS[tile];
            if (block && block.tier <= Math.max(4, this.sim.pickLevel + 1)) {
              this.breakTile(x, y, Math.random() < 0.6, { batch: true });
            }
          }
        }
      }
      const span = Math.ceil(radius) + 1;
      this.layer.calculateFacesWithin(Math.floor(cx) - span, Math.floor(cy) - span, span * 2 + 1, span * 2 + 1);

      // The blast hurts everything close to it.
      const blastX = cx * TILE + TILE / 2;
      const blastY = cy * TILE + TILE / 2;
      if (ML.ActionRules.canRadialAffect(this.sim, blastX, blastY, this.player.x, this.player.y, radius * TILE * 1.25).ok) {
        this.applyDamage(12, "blast");
        this.floatText(this.player.x - 10, this.player.y - 30, "-12", "#f08561");
      }
      this.enemies.getChildren().forEach((enemy) => {
        if (!enemy.active) return;
        if (ML.ActionRules.canRadialAffect(this.sim, blastX, blastY, enemy.x, enemy.y, radius * TILE * 1.4).ok) {
          this.damageEnemy(enemy, 6, blastX);
        }
      });

      this.floatText(cx * TILE, cy * TILE, "BOOM", "#ff9d66");
      ML.renderAll(this.sim);
    }

    // ---- Combat -----------------------------------------------------------------

    attack(pointer = null) {
      if (this.pausedByUI || this.dead) return false;
      const now = this.time.now;
      if (now < this.nextAttackAt) return false;
      this.nextAttackAt = now + 360;
      this.setAction("Attack", 700);
      this.swingPickaxe(360);
      this.emitNoise("swing", this.player.x, this.player.y, {
        radius: TILE * 4.5,
        intensity: 0.34,
        ttl: 2200
      });

      const targets = this.findAttackTargets(pointer);
      this.sim.energy = clamp(this.sim.energy - (targets.length ? 6 : 3), 0, this.sim.maxEnergy);
      if (!targets.length) {
        this.floatText(this.player.x - 12, this.player.y - 28, "Miss", "#bcae93");
        ML.audio.play("dig");
        ML.renderStatus(this.sim, this.player, this.playerLight());
        return false;
      }

      const baseDamage = this.sim.attackDamage();
      targets.forEach((enemy) => {
        const crit = Math.random() < 0.12;
        this.damageEnemy(enemy, crit ? baseDamage * 2 : baseDamage, this.player.x, crit);
      });
      this.cameras.main.shake(55, 0.0025);
      ML.renderAll(this.sim);
      return true;
    }

    findAttackTargets(pointer = null) {
      const facing = this.player.flipX ? -1 : 1;
      const targets = [];
      const aimed = pointer ? this.findEnemyAtPointer(pointer) : null;
      this.enemies.getChildren().forEach((enemy) => {
        if (!enemy.active) return;
        const rule = ML.ActionRules.canAttackEnemy(this.sim, this.player, enemy, { facing, aimed: aimed === enemy });
        if (rule.ok) targets.push(enemy);
      });
      return targets;
    }

    damageEnemy(enemy, damage, fromX, crit = false) {
      enemy.hp -= damage;
      const cfg = ENEMIES[enemy.kind];
      if (!cfg.heavy) {
        const knockDir = enemy.x < fromX ? -1 : 1;
        enemy.setVelocityX(knockDir * (300 + this.sim.pickLevel * 22));
        if (!cfg.fly) enemy.setVelocityY(-150);
        enemy.stunUntil = this.time.now + 260;
      }
      enemy.setTint(0xffc8b0);
      this.time.delayedCall(120, () => {
        if (enemy.active) {
          if (enemy.elite) enemy.setTint(0xf0c75e);
          else enemy.clearTint();
        }
      });
      this.floatText(enemy.x - 10, enemy.y - 18, crit ? `CRIT -${damage}` : `-${damage}`, crit ? "#ffb347" : "#f5d77a");
      ML.audio.play("enemyHit");
      this.emitNoise("hit", enemy.x, enemy.y, {
        radius: TILE * 6,
        intensity: crit ? 0.98 : 0.68,
        ttl: 3400
      });

      if (enemy.hp <= 0) {
        this.killEnemy(enemy);
      }
    }

    killEnemy(enemy) {
      const drops = this.dropsFor(enemy.kind);
      if (enemy.elite) {
        drops.coin = (drops.coin || 0) + 8 + Math.floor(Math.random() * 8);
        drops.gel = (drops.gel || 0) + 2;
        if (Math.random() < 0.35) drops.mushroom = (drops.mushroom || 0) + 1;
      }
      if (this.sim.lootBonus) drops.coin = (drops.coin || 0) + (ENEMIES[enemy.kind]?.boss ? 18 : 3);
      for (const [item, n] of Object.entries(drops)) {
        this.sim.addItem(item, n);
        this.spawnPickupFx(Math.floor(enemy.x / TILE), Math.floor(enemy.y / TILE), item);
      }
      this.sim.stats.enemies += 1;
      if (ENEMIES[enemy.kind]?.boss) {
        this.sim.stats.bosses += 1;
        this.cameras.main.shake(260, 0.012);
        this.floatText(enemy.x - 30, enemy.y - 38, "BOSS DOWN", "#ffcf6a");
        ML.showToast(`${this.enemyName(enemy.kind)} defeated. New boss materials unlocked.`, 4200);
        this.checkLore("boss", { bossKind: enemy.kind });
      }
      this.checkContract();
      this.checkAchievements();
      this.emitBlockBurst(Math.floor(enemy.x / TILE), Math.floor(enemy.y / TILE), 0x7c5a91, 6);
      ML.audio.play("enemyDie");
      // Dead for good — remove the world entry, no respawn at this home.
      if (enemy.mobId) {
        this.sim.mobs = this.sim.mobs.filter((m) => m.id !== enemy.mobId);
        this.activeMobIds.delete(enemy.mobId);
      }
      enemy.destroy();
    }

    dropsFor(kind) {
      const r = Math.random();
      switch (kind) {
        case "broodmother":
          return { silk: 7, fang: 3, relic: 1, gel: 6, coin: 24 + Math.floor(Math.random() * 12) };
        case "warden":
          return { core: 1, relic: 2, fang: 2, obsidian: 4, crystal: 3, coin: 38 + Math.floor(Math.random() * 20) };
        case "mossling": return r < 0.62 ? { wood: 1, coin: 1 } : { mushroom: 1, coin: 1 };
        case "bat": return r < 0.3 ? { crystal: 1, coin: 2 } : { coal: 1, coin: 1 };
        case "slime": return r < 0.72 ? { gel: 2 + Math.floor(Math.random() * 2), coin: 1 } : { mushroom: 1, gel: 1, coin: 1 };
        case "golem": {
          const loot = { gold: 1 + (Math.random() < 0.5 ? 1 : 0), coin: 8 + Math.floor(Math.random() * 8) };
          if (Math.random() < 0.4) loot.obsidian = 1;
          if (Math.random() < 0.35) loot.crystal = 1;
          return loot;
        }
        default: return r < 0.7 ? { coal: 1, gel: 1, coin: 1 } : { copper: 1, coin: 2 };
      }
    }

    hitPlayer(_player, enemy) {
      const now = this.time.now;
      if (now < this.playerIframesUntil) return;
      this.playerIframesUntil = now + 700;
      const touch = (enemy.touch || 8) * (this.sim.ward && ENEMIES[enemy.kind]?.boss ? 0.72 : 1);
      this.applyDamage(touch, enemy.kind);
      this.player.setVelocityY(-190);
      this.player.setVelocityX((this.player.x < enemy.x ? -1 : 1) * 230);
      this.player.setTint(0xff9c8a);
      this.time.delayedCall(160, () => this.player.clearTint());
      this.cameras.main.shake(90, 0.004);
      ML.audio.play("hurt");
      ML.renderStatus(this.sim, this.player, this.playerLight());
    }

    // ---- Enemies ------------------------------------------------------------------

    discoveryAnchorForEnemy(enemy, now = this.time.now) {
      if (!enemy?.active || !Array.isArray(this.sim.surfaceDiscoveries)) return null;
      if (enemy.nextPoiScanAt && now < enemy.nextPoiScanAt) return enemy.poiAnchor || null;
      enemy.nextPoiScanAt = now + Phaser.Math.Between(760, 1240);
      enemy.poiAnchor = null;
      let best = null;
      let bestDistance = Infinity;
      for (const discovery of this.sim.surfaceDiscoveries) {
        if (discovery.scope !== "underground" || discovery.read) continue;
        if (this.sim.tileAt(discovery.x, discovery.y) !== Tile.SIGN) continue;
        const wx = discovery.x * TILE + TILE / 2;
        const wy = discovery.y * TILE + TILE / 2;
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, wx, wy);
        if (distance > 280 || distance >= bestDistance) continue;
        if (!this.hasSightBetweenWorld(enemy.x, enemy.y, wx, wy)) continue;
        bestDistance = distance;
        best = { x: wx, y: wy, discovery, distance };
      }
      enemy.poiAnchor = best;
      return best;
    }

    enemyInstinct(enemy, now = this.time.now) {
      if (enemy.nextThinkAt && now < enemy.nextThinkAt && enemy.intent) return enemy.intent;
      const sensor = ML.MobSensors?.sense?.(this, enemy, now) || null;
      const cfg = sensor?.cfg || ENEMIES[enemy.kind] || {};
      const ai = cfg.ai || {};
      const dx = sensor?.dx ?? (this.player.x - enemy.x);
      const dy = sensor?.dy ?? (this.player.y - enemy.y);
      const distance = sensor?.targetDistance ?? Math.max(1, Math.hypot(dx, dy));
      const playerDistance = sensor?.playerDistance ?? Math.max(1, Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y));
      const dir = sensor?.dir ?? (Math.sign(dx) || 1);
      const localLight = sensor?.localLight ?? this.lightLevelAt(enemy.x, enemy.y);
      const hpRatio = clamp((enemy.hp || 1) / Math.max(1, enemy.maxHp || 1), 0, 1);
      const playerWeak = (this.sim.health / Math.max(1, this.sim.maxHealth) < 0.34)
        || (this.sim.energy / Math.max(1, this.sim.maxEnergy) < 0.24)
        || (this.shadowPressure || 0) > 58;
      const observed = this.isEnemyObserved(enemy);
      const poiAnchor = !cfg.boss && !enemy.elite ? this.discoveryAnchorForEnemy(enemy, now) : null;
      const poiCurious = Boolean(poiAnchor
        && !sensor?.canSeePlayer
        && !sensor?.heardNoise
        && !sensor?.hasMemory
        && ["guardian", "stalker", "ambusher", "harrier"].includes(ai.mind));
      const aware = Boolean(sensor?.canSeePlayer || sensor?.heardNoise || sensor?.hasMemory || cfg.boss || enemy.elite);
      let allies = 0;
      for (const other of this.enemies.getChildren()) {
        if (!other.active || other === enemy || other.kind !== enemy.kind) continue;
        if (Phaser.Math.Distance.Between(other.x, other.y, enemy.x, enemy.y) < 150) allies += 1;
      }

      let mode = aware ? "press" : "wait";
      if (!aware) {
        if (poiCurious) mode = ai.mind === "guardian" ? "guard" : ai.mind === "ambusher" ? "wait" : "stalk";
        else mode = ai.mind === "guardian" ? "guard" : "wait";
      } else if (!sensor?.canSeePlayer && sensor?.heardNoise) {
        mode = ai.mind === "ambusher" ? "wait" : "stalk";
      } else if (!sensor?.canSeePlayer && sensor?.hasMemory) {
        mode = "stalk";
      } else if (cfg.boss) {
        mode = playerDistance > 260 ? "guard" : playerWeak ? "pressure" : "press";
      } else if (observed && !playerWeak && playerDistance > 82 && playerDistance < 360 && ["stalker", "ambusher", "guardian", "harrier"].includes(ai.mind)) {
        mode = "watch";
      } else if (hpRatio < 0.38 && (ai.courage || 0.5) < 0.75 && localLight > 0.34) {
        mode = "retreat";
      } else if (localLight > (0.48 + (ai.courage || 0.5) * 0.22) && (ai.lightFear || 0) > 0.28) {
        mode = "circle";
      } else if (ai.mind === "ambusher" && playerDistance > 125 && !playerWeak) {
        mode = "wait";
      } else if (ai.mind === "guardian" && playerDistance > 230) {
        mode = "guard";
      } else if (playerWeak || allies >= 2 || enemy.elite || enemy.event) {
        mode = "pressure";
      } else if (ai.mind === "stalker" && playerDistance > 170) {
        mode = "stalk";
      } else if (ai.mind === "skittish" && (playerDistance < 78 || localLight > 0.52)) {
        mode = "retreat";
      }

      const speedMult = mode === "pressure" ? 1.22
        : mode === "stalk" ? 0.72
        : mode === "circle" ? 0.88
        : mode === "guard" ? 0.5
        : mode === "wait" ? 0.25
        : mode === "watch" ? 0
        : mode === "retreat" ? 1.05
        : 1;
      const targetX = poiCurious ? poiAnchor.x : sensor?.targetX ?? this.player.x;
      const targetY = poiCurious ? poiAnchor.y : sensor?.targetY ?? this.player.y;
      const moveDx = poiCurious ? targetX - enemy.x : dx;
      const moveDy = poiCurious ? targetY - enemy.y : dy;
      const moveDistance = poiCurious ? Math.max(1, Math.hypot(moveDx, moveDy)) : distance;
      const moveDir = Math.sign(moveDx) || dir;
      enemy.intent = {
        mode,
        dx: moveDx,
        dy: moveDy,
        dir: moveDir,
        distance: moveDistance,
        playerDistance,
        localLight,
        hpRatio,
        playerWeak,
        allies,
        observed,
        speedMult,
        sensorReason: sensor?.reason || "direct",
        canSeePlayer: Boolean(sensor?.canSeePlayer),
        heardNoise: Boolean(sensor?.heardNoise),
        poiCurious,
        targetX,
        targetY
      };
      enemy.nextThinkAt = now + Phaser.Math.Between(240, 420);
      if (enemy.lastIntentMode !== mode && now > (enemy.intentToastAt || 0)) {
        enemy.intentToastAt = now + 4200;
        enemy.lastIntentMode = mode;
        if (mode === "stalk" && sensor?.heardNoise && playerDistance < 320) this.floatText(enemy.x - 18, enemy.y - 24, "HEARS", "#d8b6ff");
        if (poiCurious && playerDistance < 360) this.floatText(enemy.x - 20, enemy.y - 25, mode === "guard" ? "GUARDS" : "STUDIES", "#9efff0");
        if (mode === "pressure" && playerDistance < 260) this.floatText(enemy.x - 18, enemy.y - 26, "HUNTS", "#f0c75e");
        if (mode === "retreat" && playerDistance < 220) this.floatText(enemy.x - 16, enemy.y - 24, "FLEES", "#9efff0");
        if (mode === "watch") {
          this.floatText(enemy.x - 24, enemy.y - 28, "SEES", "#d8b6ff");
          this.triggerObserverMoment("mobStare", { enemy });
        }
      }
      return enemy.intent;
    }

    updateEnemies(dt) {
      if (this.enemyClock > 0.6) {
        this.enemyClock = 0;
        this.mobTick();
      }
      const now = this.time.now;
      const list = this.enemies.getChildren();
      // Backwards: storeMob/destroy splices the live array.
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const enemy = list[i];
        if (!enemy.active) continue;
        if (enemy.stunUntil && now < enemy.stunUntil) continue;

        const intent = this.enemyInstinct(enemy, now);
        const dir = intent.mode === "retreat" ? -intent.dir : intent.dir;
        const speed = enemy.speed * (Number.isFinite(intent.speedMult) ? intent.speedMult : 1);
        if (intent.mode === "watch") {
          enemy.setVelocityX(0);
          if (ENEMIES[enemy.kind]?.fly) enemy.setVelocityY(Math.sin(now / 180 + enemy.bobSeed) * 24);
          enemy.setFlipX(intent.dx < 0);
          continue;
        }
        if (intent.mode === "wait" && !ENEMIES[enemy.kind]?.boss) {
          enemy.setVelocityX(0);
          if (ENEMIES[enemy.kind]?.fly) enemy.setVelocityY(Math.sin(now / 180 + enemy.bobSeed) * 18);
          enemy.setFlipX((intent.targetX ?? this.player.x) < enemy.x);
          continue;
        }
        switch (enemy.kind) {
          case "bat": {
            const orbit = intent.mode === "circle" ? Math.sin(now / 260 + enemy.bobSeed) * 90 : 0;
            const targetX = intent.targetX ?? this.player.x;
            const targetY = intent.targetY ?? this.player.y;
            const dx = intent.mode === "retreat" ? -intent.dx + orbit : targetX + orbit - enemy.x;
            const dy = intent.mode === "retreat" ? -intent.dy - 28 : targetY - 6 - enemy.y;
            const dist = Math.max(20, Math.hypot(dx, dy));
            enemy.setVelocityX((dx / dist) * speed);
            enemy.setVelocityY((dy / dist) * speed * 0.8 + Math.sin(now / 170 + enemy.bobSeed) * 46);
            enemy.setFlipX(dx < 0);
            break;
          }
          case "slime": {
            if (enemy.body.blocked.down) {
              enemy.setVelocityX(enemy.body.velocity.x * 0.8);
              if (intent.mode !== "wait" && now > enemy.nextHopAt) {
                enemy.nextHopAt = now + (intent.mode === "pressure" ? 620 : 900) + Math.random() * 700;
                enemy.setVelocityX(dir * (intent.mode === "retreat" ? 145 : 175));
                enemy.setVelocityY(intent.mode === "pressure" ? -390 : -365);
              }
            }
            break;
          }
          case "broodmother": {
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down) {
              enemy.setVelocityX(enemy.body.velocity.x * 0.72);
              if (now > enemy.nextHopAt) {
                enemy.nextHopAt = now + (intent.playerWeak ? 560 : 760) + Math.random() * 520;
                enemy.setVelocityX(dir * (intent.mode === "retreat" ? 190 : 265));
                enemy.setVelocityY(-430);
              }
            }
            if (now > enemy.nextSpecialAt) {
              enemy.nextSpecialAt = now + (intent.playerWeak ? 3600 : 5200) + Math.random() * 2600;
              this.summonMinion(enemy, Math.random() < 0.55 ? "crawler" : "slime");
            }
            break;
          }
          case "warden": {
            enemy.setVelocityX(dir * speed);
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down && (enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.04) {
              enemy.setVelocityY(-315);
            }
            if (now > enemy.nextSpecialAt) {
              enemy.nextSpecialAt = now + (intent.playerWeak ? 1900 : 2600) + Math.random() * 1600;
              this.bossShockwave(enemy);
            }
            break;
          }
          case "golem": {
            enemy.setVelocityX(dir * speed);
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down && (enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.03) {
              enemy.setVelocityY(-300);
            }
            break;
          }
          default: { // crawler
            enemy.setVelocityX(dir * speed);
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down && intent.mode !== "wait" && ((this.player.y < enemy.y - 40 && Math.random() < (intent.mode === "pressure" ? 0.028 : 0.012)) || ((enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.06))) {
              enemy.setVelocityY(intent.mode === "pressure" ? -360 : -330);
            }
          }
        }
      }
    }

    summonMinion(enemy, kind) {
      if (this.enemies.countActive(true) >= 12) return;
      const dir = this.player.x < enemy.x ? -1 : 1;
      const tx = clamp(Math.floor(enemy.x / TILE) + dir * 2, 2, this.worldWidthTiles() - 3);
      const ty = clamp(Math.floor(enemy.y / TILE), 2, this.worldHeightTiles() - 3);
      if (!this.sim.canSpawnMobAt(kind, tx, ty, { summoned: true })) return;
      const mob = this.sim.addMob(tx, ty, kind, { summoned: true });
      const spot = this.findMobSpot(mob);
      if (spot) this.queueMobMaterialize(mob, spot, { delay: 620, reason: "summon", event: true });
      else this.sim.mobs = this.sim.mobs.filter((entry) => entry.id !== mob.id);
      this.floatText(enemy.x - 20, enemy.y - 34, "Summon", "#d8b6ff");
      ML.audio.play("roar");
    }

    bossShockwave(enemy) {
      this.cameras.main.shake(120, 0.006);
      this.emitDust(enemy.x, enemy.y + 20, 8);
      ML.audio.play("roar");
      this.emitNoise("stomp", enemy.x, enemy.y, {
        radius: TILE * 10,
        intensity: 1.8,
        ttl: 5200,
        source: "enemy"
      });
      this.floatText(enemy.x - 14, enemy.y - 38, "STOMP", "#ffb36a");
      if (ML.ActionRules.canRadialAffect(this.sim, enemy.x, enemy.y, this.player.x, this.player.y, 145).ok) {
        const damage = this.sim.ward ? 5 : 8;
        this.applyDamage(damage, enemy.kind);
        this.player.setVelocityY(-260);
        this.player.setVelocityX((this.player.x < enemy.x ? -1 : 1) * 280);
        this.floatText(this.player.x - 10, this.player.y - 32, `-${damage}`, "#f08561");
      }
    }

    // ---- World-resident mobs ------------------------------------------------
    // Mobs live at fixed homes decided at world generation (sim.mobs). They
    // get a sprite only while the player is near, sleep back into data when
    // the player leaves, and die permanently when killed.

    mobTick() {
      const day = this.dayNumber();
      if (day !== this.lastDay) {
        this.lastDay = day;
        this.repopulateMobs();
      }
      if (this.surfaceBrightness() >= 0.5) this.despawnSurfaceMobs(); // raiders burrow away in daylight
      else this.maybeNightRaid();
      this.refreshMobActivation();
    }

    refreshMobActivation() {
      const px = this.player.x / TILE;
      const py = this.player.y / TILE;
      // Wake just beyond the screen edge, whatever the window size.
      const cam = this.cameras.main;
      const wakeX = Math.max(34, cam.width / TILE / 2 + 4);
      const wakeY = Math.max(22, cam.height / TILE / 2 + 4);
      this.updatePendingMobSpawns();

      // Sleep sprites that wandered far from the player.
      const list = this.enemies.getChildren();
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const enemy = list[i];
        if (!enemy.active) continue;
        if (Math.abs(enemy.x / TILE - px) > wakeX + 14 || Math.abs(enemy.y / TILE - py) > wakeY + 8) {
          this.storeMob(enemy);
        }
      }

      // Wake dormant mobs whose homes are just off-screen.
      for (const mob of this.sim.mobs) {
        if (this.enemies.countActive(true) + this.pendingMobSpawns.size >= 12) break;
        if (this.activeMobIds.has(mob.id)) continue;
        if (this.pendingMobSpawns.has(mob.id)) continue;
        if (Math.abs(mob.x - px) > wakeX || Math.abs(mob.y - py) > wakeY) continue;
        const spot = this.findMobSpot(mob);
        if (!spot) continue;
        const wake = this.mobWakeInfo(mob, spot);
        if (!wake.canWake) continue;
        if (wake.needsTelegraph) this.queueMobMaterialize(mob, spot, { delay: wake.delay, reason: "wake" });
        else this.materializeMob(mob, { spot });
      }
    }

    mobWakeInfo(mob, spot) {
      const cam = this.cameras.main;
      const wx = spot.x * TILE + TILE / 2;
      const wy = spot.y * TILE + 12;
      const sx = wx - cam.scrollX;
      const sy = wy - cam.scrollY;
      const inView = sx > 18 && sx < cam.width - 18 && sy > 22 && sy < cam.height - 116;
      const distance = Phaser.Math.Distance.Between(wx, wy, this.player.x, this.player.y);
      const tileDx = Math.abs(spot.x - this.player.x / TILE);
      const tileDy = Math.abs(spot.y - this.player.y / TILE);
      const natural = !mob.boss && !mob.event && !mob.summoned && !mob.surf;
      const tooClose = distance < (mob.event || mob.summoned ? 185 : 285) || (tileDx < 6 && tileDy < 4);
      const bright = natural && this.lightLevelAt(wx, wy) > 0.48;
      const canWake = !tooClose && !bright;
      const delay = mob.event || mob.summoned ? Phaser.Math.Between(560, 780) : Phaser.Math.Between(850, 1250);
      return {
        canWake,
        inView,
        tooClose,
        bright,
        distance,
        needsTelegraph: inView || distance < 430 || Boolean(mob.event || mob.summoned),
        delay
      };
    }

    findMobSpot(mob) {
      const ok = (x, y) => {
        return this.sim.canSpawnMobAt(mob.kind, x, y, {
          boss: Boolean(mob.boss),
          secret: Boolean(mob.secretId),
          event: Boolean(mob.event),
          summoned: Boolean(mob.summoned),
          surface: Boolean(mob.surf),
          temporary: Boolean(mob.surf),
          nightRaid: Boolean(mob.surf)
        });
      };
      if (ok(mob.x, mob.y)) return { x: mob.x, y: mob.y };
      // The home may have been mined out or built over — look nearby.
      for (let r = 1; r <= 4; r += 1) {
        for (let ox = -r; ox <= r; ox += 1) {
          for (let oy = -r; oy <= r; oy += 1) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
            if (ok(mob.x + ox, mob.y + oy)) return { x: mob.x + ox, y: mob.y + oy };
          }
        }
      }
      return null; // buried — stays dormant
    }

    queueMobMaterialize(mob, spot, options = {}) {
      if (!mob || !spot || this.activeMobIds.has(mob.id) || this.pendingMobSpawns.has(mob.id)) return false;
      const wx = spot.x * TILE + TILE / 2;
      const wy = spot.y * TILE + 12;
      const cfg = ENEMIES[mob.kind];
      const marker = this.add.image(wx, wy + 6, "mobWake")
        .setOrigin(0.5, 1)
        .setDepth(83)
        .setAlpha(0)
        .setScale(cfg?.heavy ? 1.55 : 1.32);
      marker.setTint(mob.elite ? 0xf0c75e : mob.event ? 0xd8b6ff : 0x8a6fa8);
      marker.setBlendMode(Phaser.BlendModes.ADD);
      this.emitDust(wx, wy + 8, mob.event ? 5 : 3);
      this.tweens.add({
        targets: marker,
        alpha: { from: 0.28, to: 0.9 },
        y: wy + 1,
        duration: 240,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      this.pendingMobSpawns.set(mob.id, {
        mob,
        spot,
        marker,
        queuedAt: this.time.now,
        readyAt: this.time.now + (options.delay ?? 900),
        event: Boolean(mob.event || mob.summoned || options.event),
        reason: options.reason || "wake"
      });
      return true;
    }

    cancelPendingMobSpawn(id, fade = true) {
      const pending = this.pendingMobSpawns?.get(id);
      if (!pending) return false;
      this.pendingMobSpawns.delete(id);
      if (!pending.marker) return true;
      this.tweens.killTweensOf(pending.marker);
      if (!fade) {
        pending.marker.destroy();
        return true;
      }
      this.tweens.add({
        targets: pending.marker,
        alpha: 0,
        y: pending.marker.y - 7,
        duration: 180,
        ease: "Sine.easeIn",
        onComplete: () => pending.marker.destroy()
      });
      return true;
    }

    clearPendingMobSpawns(fade = false) {
      for (const id of Array.from(this.pendingMobSpawns?.keys?.() || [])) {
        this.cancelPendingMobSpawn(id, fade);
      }
    }

    updatePendingMobSpawns() {
      if (!this.pendingMobSpawns?.size) return;
      for (const [id, pending] of Array.from(this.pendingMobSpawns.entries())) {
        const stillExists = this.sim.mobs.some((mob) => mob.id === id);
        if (!stillExists || this.activeMobIds.has(id)) {
          this.cancelPendingMobSpawn(id, false);
          continue;
        }
        const wake = this.mobWakeInfo(pending.mob, pending.spot);
        if (!pending.event && !wake.canWake) {
          this.cancelPendingMobSpawn(id);
          continue;
        }
        if (wake.tooClose) {
          pending.readyAt = this.time.now + 420;
          continue;
        }
        if (this.time.now < pending.readyAt) continue;
        if (this.enemies.countActive(true) >= 12) continue;
        this.cancelPendingMobSpawn(id, false);
        this.materializeMob(pending.mob, { spot: pending.spot, staged: true });
      }
    }

    materializeMob(mob, options = {}) {
      const spot = options.spot || this.findMobSpot(mob);
      if (!spot) return;
      mob.x = spot.x;
      mob.y = spot.y;
      const cfg = ENEMIES[mob.kind];
      const deep = spot.y - (this.sim.surface[spot.x] || 24) > 150;
      const enemy = this.enemies.create(spot.x * TILE + 16, spot.y * TILE + 12, cfg.texture);
      enemy.kind = mob.kind;
      enemy.mobId = mob.id;
      enemy.body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.offX, cfg.offY);
      enemy.hp = mob.hp ?? (deep ? cfg.deepHp : cfg.hp);
      enemy.maxHp = deep ? cfg.deepHp : cfg.hp;
      enemy.speed = deep ? cfg.deepSpeed : cfg.speed;
      enemy.touch = cfg.touch;
      enemy.boss = Boolean(cfg.boss || mob.boss);
      enemy.elite = Boolean(mob.elite && !enemy.boss);
      if (enemy.elite) {
        enemy.hp = Math.ceil(enemy.hp * 1.85);
        enemy.maxHp = enemy.hp;
        enemy.speed *= 1.12;
        enemy.touch = Math.ceil(enemy.touch * 1.28);
        enemy.setTint(0xf0c75e);
      }
      enemy.stunUntil = 0;
      enemy.nextHopAt = 0;
      enemy.nextSpecialAt = this.time.now + 1600 + Math.random() * 1400;
      enemy.bobSeed = Math.random() * 10;
      enemy.setDepth(enemy.boss ? 11 : 9);
      if (cfg.fly) enemy.body.setAllowGravity(false);
      if (options.staged) {
        enemy.setAlpha(0).setScale(0.84);
        this.emitDust(enemy.x, enemy.y + 8, enemy.boss ? 8 : 5);
        this.tweens.add({
          targets: enemy,
          alpha: 1,
          scale: 1,
          duration: 220,
          ease: "Back.easeOut"
        });
      }
      if (enemy.boss) {
        this.cameras.main.shake(160, 0.005);
        ML.audio.play("roar");
        ML.showToast(`${this.enemyName(enemy.kind)} has awakened in the hidden vault.`, 3200);
      }
      this.activeMobIds.add(mob.id);
    }

    syncMobEntry(enemy) {
      const mob = this.sim.mobs.find((m) => m.id === enemy.mobId);
      if (!mob) return;
      const tx = clamp(Math.floor(enemy.x / TILE), 1, this.worldWidthTiles() - 2);
      const ty = clamp(Math.floor(enemy.y / TILE), 1, this.worldHeightTiles() - 2);
      if (this.sim.tileAt(tx, ty) === AIR) {
        mob.x = tx;
        mob.y = ty;
      }
      mob.hp = enemy.hp;
    }

    storeMob(enemy) {
      this.syncMobEntry(enemy);
      this.activeMobIds.delete(enemy.mobId);
      enemy.destroy();
    }

    // At night a few surface scavengers creep over open grass far away;
    // survivors burrow away at dawn. Cave-only mobs never use this path.
    maybeNightRaid() {
      if (this.surfaceBrightness() >= 0.4) return;
      if (this.sim.mobs.filter((m) => m.surf).length >= 3) return;
      if (Math.random() > 0.12) return;
      const px = Math.floor(this.player.x / TILE);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const x = clamp(px + dir * (38 + Math.floor(Math.random() * 18)), 4, this.worldWidthTiles() - 5);
      const y = (this.sim.surface[x] || 24) - 1;
      if (!this.sim.canSpawnMobAt("mossling", x, y, { surface: true, temporary: true, nightRaid: true })) return;
      this.sim.addMob(x, y, "mossling", { surf: true, nightRaid: true });
    }

    despawnSurfaceMobs() {
      const surfIds = new Set(this.sim.mobs.filter((m) => m.surf).map((m) => m.id));
      if (!surfIds.size) return;
      const list = this.enemies.getChildren();
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const enemy = list[i];
        if (!enemy.active || !surfIds.has(enemy.mobId)) continue;
        this.emitDust(enemy.x, enemy.y + 4, 4);
        this.activeMobIds.delete(enemy.mobId);
        enemy.destroy();
      }
      this.sim.mobs = this.sim.mobs.filter((m) => !m.surf);
    }

    // Each dawn a handful of creatures creep back into far-away caves, up to
    // the world's original population.
    repopulateMobs() {
      const missing = (this.sim.mobBaseline || 0) - this.sim.mobs.length;
      if (missing <= 0) return;
      const px = this.player.x / TILE;
      const py = this.player.y / TILE;
      let added = 0;
      for (let tries = 0; tries < 80 && added < Math.min(missing, 5); tries += 1) {
        const x = 4 + Math.floor(Math.random() * (this.worldWidthTiles() - 8));
        const surfaceY = this.sim.surface[x] || 24;
        const height = this.worldHeightTiles();
        const y = surfaceY + 16 + Math.floor(Math.random() * Math.max(1, height - surfaceY - 24));
        if (Math.abs(x - px) < 40 && Math.abs(y - py) < 26) continue;
        if (Math.abs(x - this.sim.shaft.x) <= 10 && y <= this.sim.shaft.y + 24) continue;
        const budget = ML.WorldGenDirector?.spawnBudgetFor?.(this.sim, x, y, { repopulate: true }) || { density: 0.04 };
        if (Math.random() >= Math.min(0.5, budget.density * 4.5)) continue;
        const picked = this.sim.pickMobForSpot(x, y, Math.random, { natural: true });
        if (!picked) continue;
        this.sim.addMob(x, picked.y, picked.kind);
        added += 1;
      }
    }

    // ---- Cave events ---------------------------------------------------------------

    scheduleNextCaveEvent(initial = false) {
      const depth = this.player ? this.depthMeters() : 0;
      const stratum = this.currentStratum();
      const base = initial ? 26000 : 52000;
      const depthDiscount = Math.min(17000, depth * 115);
      const pace = stratum?.eventPace || 1;
      this.nextCaveEventAt = this.time.now + Math.max(14000, (base + Math.random() * 24000 - depthDiscount) * pace);
    }

    chooseCaveEvent() {
      const depth = this.depthMeters();
      const stratum = this.currentStratum();
      const weighted = this.sim.weightedPick?.(stratum?.events, Math.random);
      if (weighted) return weighted;
      const pool = ["oreSurge", "lanternDraft"];
      if (depth > 24) pool.push("swarm");
      if (depth > 58) pool.push("tremor");
      return pool[Math.floor(Math.random() * pool.length)];
    }

    eventCopyFor(id, cfg) {
      const phaseIndex = ML.LoreSystem?.phaseIndex?.(this.sim) || 0;
      const variants = (cfg.variants || []).filter((variant) => phaseIndex >= (variant.minPhase || 0));
      if (!variants.length) return { id, name: cfg.name, note: cfg.note, float: null };
      const seed = ((this.sim.seed || 0) + Math.floor((this.sim.time || 0) * 13) + (this.sim.stats?.events || 0) * 17 + id.length * 31) >>> 0;
      const variant = variants[seed % variants.length];
      return {
        id,
        name: variant.name || cfg.name,
        note: variant.note || cfg.note,
        float: variant.float || null
      };
    }

    startCaveEvent(kind = null) {
      const id = kind || this.chooseCaveEvent();
      const cfg = ML.CAVE_EVENTS?.[id];
      if (!cfg) return false;
      const copy = this.eventCopyFor(id, cfg);
      this.caveEvent = {
        id,
        name: copy.name,
        note: copy.note,
        float: copy.float,
        started: this.time.now,
        until: this.time.now + cfg.duration
      };
      this.eventPulseAt = this.time.now + 700;
      this.sim.stats.events += 1;

      if (id === "swarm") this.spawnEventSwarm();
      if (id === "tremor") {
        this.cameras.main.shake(160, 0.005);
        ML.audio.play("rumble");
      }
      if (id === "oreSurge") this.emitDust(this.player.x, this.player.y + 16, 8);
      if (id === "lanternDraft") this.floatText(this.player.x - 22, this.player.y - 40, "DRAFT", "#9edbe2");
      if (copy.float) this.floatText(this.player.x - 30, this.player.y - 56, copy.float, "#9efff0");

      ML.audio.play("event");
      ML.showToast(`${copy.name}: ${copy.note}`, 3900);
      ML.renderEvent(this);
      this.checkAchievements();
      return true;
    }

    endCaveEvent() {
      const ended = this.caveEvent;
      this.caveEvent = null;
      this.scheduleNextCaveEvent();
      if (ended) {
        ML.renderEvent(this);
        ML.showToast(`${ended.name} settled.`, 1200);
      }
    }

    updateCaveEvents() {
      const now = this.time.now;
      if (this.caveEvent) {
        if (now >= this.caveEvent.until) {
          this.endCaveEvent();
          return;
        }
        if (this.caveEvent.id === "tremor" && now >= this.eventPulseAt) {
          this.eventPulseAt = now + 1150 + Math.random() * 750;
          this.dropTremorRock();
        }
        return;
      }

      if (!this.nextCaveEventAt) this.scheduleNextCaveEvent(true);
      if (now < this.nextCaveEventAt) return;
      if (this.depthMeters() < 10 || this.hasActiveBoss()) {
        this.scheduleNextCaveEvent(true);
        return;
      }
      this.startCaveEvent();
    }

    spawnEventSwarm() {
      const depth = this.depthMeters();
      const count = depth > 135 ? 4 : depth > 70 ? 3 : 2;
      let spawned = 0;
      for (let i = 0; i < count; i += 1) {
        const kind = depth > 150 && Math.random() < 0.35 ? "golem" : this.sim.pickMobKind(depth, Math.random());
        const elite = depth > 100 && i === 0 && Math.random() < 0.45;
        if (this.spawnEventMob(kind, elite)) spawned += 1;
      }
      if (spawned > 0) {
        this.floatText(this.player.x - 28, this.player.y - 44, "SWARM", "#d8b6ff");
        ML.audio.play("roar");
      }
    }

    spawnEventMob(kind, elite = false) {
      if (this.enemies.countActive(true) >= 14) return false;
      const px = Math.floor(this.player.x / TILE);
      const py = Math.floor(this.player.y / TILE);
      for (let tries = 0; tries < 32; tries += 1) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const x = clamp(px + dir * Phaser.Math.Between(5, 11), 3, this.worldWidthTiles() - 4);
        const y = clamp(py + Phaser.Math.Between(-4, 5), 5, this.worldHeightTiles() - 6);
        if (Math.abs(x - px) < 4 && Math.abs(y - py) < 3) continue;
        let spawnKind = kind;
        let spawnY = y;
        if (!this.sim.canSpawnMobAt(spawnKind, x, spawnY, { event: true })) {
          const picked = this.sim.pickMobForSpot(x, y, Math.random, { event: true });
          if (!picked) continue;
          spawnKind = picked.kind;
          spawnY = picked.y;
        }
        const mob = this.sim.addMob(x, spawnY, spawnKind, { event: true, elite });
        const spot = this.findMobSpot(mob);
        if (!spot) {
          this.sim.mobs = this.sim.mobs.filter((entry) => entry.id !== mob.id);
          continue;
        }
        this.queueMobMaterialize(mob, spot, { delay: Phaser.Math.Between(560, 760), reason: "swarm", event: true });
        return true;
      }
      return false;
    }

    dropTremorRock() {
      const x = this.player.x + Phaser.Math.Between(-130, 130);
      const startY = this.player.y - Phaser.Math.Between(170, 240);
      const targetY = this.player.y + 48;
      const rock = this.add.image(x, startY, "spark")
        .setTint(0x8f8a7d)
        .setScale(2.4)
        .setDepth(31);
      this.emitDust(x, startY, 4);
      ML.audio.play("rumble");
      this.tweens.add({
        targets: rock,
        y: targetY,
        x: x + Phaser.Math.Between(-18, 18),
        duration: 620,
        ease: "Quad.easeIn",
        onComplete: () => {
          const rx = rock.x;
          const ry = rock.y;
          const tx = clamp(Math.floor(rx / TILE), 0, this.worldWidthTiles() - 1);
          const ty = clamp(Math.floor(ry / TILE), 0, this.worldHeightTiles() - 1);
          this.emitBlockBurst(tx, ty, 0x8f8a7d, 8);
          this.emitDust(rx, ry, 7);
          if (Phaser.Math.Distance.Between(rx, ry, this.player.x, this.player.y) < 48) {
            const damage = this.sim.ward ? 4 : 7;
            this.applyDamage(damage, "tremor");
            this.floatText(this.player.x - 10, this.player.y - 32, `-${damage}`, "#f08561");
            this.player.setVelocityY(-190);
          }
          rock.destroy();
        }
      });
    }

    saveGame() {
      for (const enemy of this.enemies.getChildren()) {
        if (enemy.active && enemy.mobId) this.syncMobEntry(enemy);
      }
      this.sim.shadowPressure = clamp(this.shadowPressure || 0, 0, 100);
      const snapshot = { x: this.player.x, y: this.player.y };
      if (!this.sim.hasPlayerSupport(snapshot)) {
        const vy = Math.abs(this.player.body?.velocity?.y || 0);
        if (vy > 35) return true;
        const repaired = this.sim.nearestSafePlayerPixels(snapshot);
        return this.sim.save(repaired);
      }
      return this.sim.save(this.sim.snapPlayerToTileCenter(snapshot));
    }

    // ---- Shadow pressure + watcher ---------------------------------------------

    updateShadowPressure(dt, light, depth, biome) {
      const now = this.time.now;
      const previous = this.shadowPressure || 0;
      const nearCamp = this.nearCamp();
      const darkLimit = depth > 12 && !nearCamp ? 0.34 : 0.18;
      if (light < darkLimit && depth > 8) {
        const deficit = darkLimit - light;
        const biomeFactor = 1 + (biome?.darkPressure || 0) * 0.32;
        const depthFactor = clamp(depth / 190, 0.2, 1.2);
        const wardCap = this.sim.ward ? 74 : 100;
        this.shadowPressure = clamp(previous + dt * (8 + deficit * 72) * biomeFactor * (0.65 + depthFactor), 0, wardCap);
      } else {
        const relief = nearCamp ? 42 : light > 0.58 ? 28 : 14;
        this.shadowPressure = clamp(previous - dt * relief, 0, 100);
      }

      if (this.shadowPressure > 34 && light < 0.32) {
        const drain = (this.sim.ward ? 0.45 : 1) * clamp((this.shadowPressure - 28) / 25, 0, 3.2);
        this.sim.energy = clamp(this.sim.energy - dt * drain, 0, this.sim.maxEnergy);
      }

      if (this.shadowPressure >= 70 && previous < 70) {
        this.sim.stats.shadowPeaks = (this.sim.stats.shadowPeaks || 0) + 1;
        this.cameras.main.shake(90, 0.002);
        this.checkLore("shadowPeak", { shadowPeak: true, biome });
      }

      if (this.shadowPressure > 44 && now - this.lastShadowWarnAt > 15000) {
        this.lastShadowWarnAt = now;
        ML.showToast("The dark is listening. Place light or return to a campfire before it rises.", 2600);
      }

      if (this.shadowPressure > 54 && depth > 28 && light < 0.34 && now > this.nextWatcherAt && !this.hasActiveBoss()) {
        this.spawnWatcherSighting();
      }

      this.sim.shadowPressure = this.shadowPressure;
      this.updateWatcherSprite(dt, light);
    }

    findWatcherSpot(options = {}) {
      const px = Math.floor(this.player.x / TILE);
      const py = Math.floor(this.player.y / TILE);
      const facing = this.player.flipX ? -1 : 1;
      const sides = [-facing, facing];
      const distances = options.force ? [8, 10, 12, 14, 16] : [10, 12, 14, 16, 18];
      const yOffsets = [-5, -3, -1, 1, 3, 5, 7];
      const cam = this.cameras.main;
      const left = cam.scrollX;
      const top = cam.scrollY;
      const right = left + cam.width;
      const bottom = top + cam.height;
      const screenPenalty = (wx, wy) => {
        const sx = wx - left;
        const sy = wy - top;
        let penalty = 0;
        if (sx < Math.min(350, cam.width * 0.32) && sy < cam.height - 118) penalty += 520;
        if (sy > cam.height - 116) penalty += 560;
        if (sx > cam.width - Math.min(330, cam.width * 0.28) && sy < 430) penalty += 360;
        return penalty;
      };
      const candidates = [];

      for (const distance of distances) {
        for (const side of sides) {
          const x = clamp(px + side * distance, 2, this.worldWidthTiles() - 3);
          for (const offset of yOffsets) {
            const startY = clamp(py + offset, 4, this.worldHeightTiles() - 7);
            const endY = Math.min(this.worldHeightTiles() - 4, startY + 9);
            for (let y = startY; y < endY; y += 1) {
              const tile = this.sim.tileAt(x, y);
              if (tile === AIR || !BLOCKS[tile]?.solid || !this.sim.hasHeadClearance(x, y)) continue;
              const wx = x * TILE + TILE / 2;
              const wy = y * TILE;
              const distancePx = Phaser.Math.Distance.Between(wx, wy, this.player.x, this.player.y);
              const maxDistance = options.force ? 640 : Math.max(360, Math.min(640, cam.width * 0.72));
              if (distancePx < 245 || distancePx > maxDistance) continue;
              const inView = wx > left + 24 && wx < right - 24 && wy > top + 28 && wy < bottom - 28;
              if (!inView) continue;
              const localLight = this.lightLevelAt(wx, wy);
              if (!options.force && localLight > 0.42) continue;
              const edgeDistance = Math.min(wx - left, right - wx, wy - top, bottom - wy);
              const facingWatcher = Math.sign(wx - this.player.x || facing) === facing;
              const uiPenalty = screenPenalty(wx, wy);
              const hiddenScore = edgeDistance + uiPenalty + (facingWatcher ? 120 : 0) + localLight * 260 + Math.random() * 40 - distancePx * 0.04;
              candidates.push({ x: wx, y: wy, side, score: hiddenScore, light: localLight, distance: distancePx, uiPenalty });
              break;
            }
          }
        }
      }

      if (!candidates.length) {
        const minTileX = clamp(Math.floor((left + 24) / TILE), 2, this.worldWidthTiles() - 3);
        const maxTileX = clamp(Math.ceil((right - 24) / TILE), 2, this.worldWidthTiles() - 3);
        const minTileY = clamp(Math.floor((top + 28) / TILE), 4, this.worldHeightTiles() - 7);
        const maxTileY = clamp(Math.ceil((bottom - 28) / TILE), 4, this.worldHeightTiles() - 4);
        for (let y = minTileY; y <= maxTileY; y += 1) {
          for (let x = minTileX; x <= maxTileX; x += 1) {
            if (Math.abs(x - px) < 8 && Math.abs(y - py) < 5) continue;
            const tile = this.sim.tileAt(x, y);
            if (tile === AIR || !BLOCKS[tile]?.solid || !this.sim.hasHeadClearance(x, y)) continue;
            const wx = x * TILE + TILE / 2;
            const wy = y * TILE;
            const distancePx = Phaser.Math.Distance.Between(wx, wy, this.player.x, this.player.y);
            const maxDistance = options.force ? 760 : Math.max(420, Math.min(760, cam.width * 0.82));
            if (distancePx < 245 || distancePx > maxDistance) continue;
            const localLight = this.lightLevelAt(wx, wy);
            if (!options.force && localLight > 0.44) continue;
            const edgeDistance = Math.min(wx - left, right - wx, wy - top, bottom - wy);
            const facingWatcher = Math.sign(wx - this.player.x || facing) === facing;
            const uiPenalty = screenPenalty(wx, wy);
            const score = edgeDistance + uiPenalty + (facingWatcher ? 110 : 0) + localLight * 240 + Math.random() * 28 - distancePx * 0.03;
            candidates.push({ x: wx, y: wy, side: wx < this.player.x ? -1 : 1, score, light: localLight, distance: distancePx, uiPenalty });
          }
        }
      }

      const visibleCandidates = candidates.filter((candidate) => candidate.uiPenalty < 500);
      const pool = visibleCandidates.length ? visibleCandidates : candidates;
      pool.sort((a, b) => a.score - b.score);
      return pool[0] || null;
    }

    leaveWatcherTrace(x, y, reason = "trail") {
      if (!this.add || !this.textures.exists("watcherTrace")) return null;
      const trace = this.add.image(x, y, "watcherTrace")
        .setOrigin(0.5, 1)
        .setDepth(81)
        .setAlpha(0)
        .setScale(reason === "noticed" ? 1.08 : 0.92);
      trace.setTint(reason === "bright" ? 0xffd56a : reason === "camp" ? 0x76d66f : 0xd8b6ff);
      this.watcherTraceMarks.push(trace);
      while (this.watcherTraceMarks.length > 8) {
        const old = this.watcherTraceMarks.shift();
        old?.destroy();
      }
      this.sim.stats.watcherTraces = (this.sim.stats.watcherTraces || 0) + 1;
      this.checkAchievements();
      this.tweens.add({
        targets: trace,
        alpha: { from: 0, to: 0.62 },
        y: y - 2,
        duration: 280,
        ease: "Sine.easeOut"
      });
      this.tweens.add({
        targets: trace,
        alpha: 0,
        y: y - 12,
        delay: 7600,
        duration: 900,
        ease: "Sine.easeIn",
        onComplete: () => {
          this.watcherTraceMarks = this.watcherTraceMarks.filter((mark) => mark !== trace);
          trace.destroy();
        }
      });
      return trace;
    }

    dismissWatcher(reason = "fade") {
      if (!this.watcher?.visible) return false;
      const state = this.watcherState || {};
      if (state.dismissing) return false;
      state.dismissing = true;
      this.watcherState = state;
      const wx = this.watcher.x;
      const wy = this.watcher.y;
      if (reason !== "timeout" || (this.shadowPressure || 0) > 46) {
        this.leaveWatcherTrace(wx, wy, reason);
      }
      this.tweens.killTweensOf(this.watcher);
      this.tweens.add({
        targets: this.watcher,
        alpha: 0,
        y: wy - (reason === "noticed" ? 18 : 10),
        duration: reason === "bright" ? 180 : 360,
        ease: "Sine.easeIn",
        onComplete: () => {
          this.watcher?.setVisible(false);
          if (this.watcherState === state) this.watcherState = null;
        }
      });
      return true;
    }

    spawnWatcherSighting(options = {}) {
      if (!options.force && this.nearCamp()) return false;
      const spot = this.findWatcherSpot(options);
      const now = this.time.now;
      this.nextWatcherAt = now + (options.force ? 3000 : Phaser.Math.Between(18000, 34000));
      if (!spot || !this.watcher) return false;

      const firstSighting = (this.sim.stats.watcherSightings || 0) === 0;
      const noticed = options.silent ? false : (firstSighting || (this.shadowPressure || 0) > 82 || Math.random() < 0.24);
      const lifetime = options.force ? 5200 : Phaser.Math.Between(5200, 9000);
      this.tweens.killTweensOf(this.watcher);
      this.watcherState = {
        homeX: spot.x,
        homeY: spot.y,
        appearedAt: now,
        vanishAt: now + lifetime,
        side: spot.side,
        noticed,
        noticedToast: noticed,
        pulse: Math.random() * Math.PI * 2
      };
      this.watcher.setPosition(spot.x, spot.y)
        .setFlipX(spot.x < this.player.x)
        .setVisible(true)
        .setAlpha(0);
      this.watcherUntil = this.watcherState.vanishAt;
      this.sim.stats.watcherSightings = (this.sim.stats.watcherSightings || 0) + 1;
      this.checkLore("watcher", { watcher: true });
      this.checkAchievements();
      this.setAction(noticed ? "Watched" : "Uneasy", noticed ? 1200 : 800);
      if (noticed) {
        this.floatText(this.player.x - 34, this.player.y - 48, "SOMETHING WATCHES", "#d8b6ff");
        ML.audio.play("secret");
        ML.showToast("A silhouette watches from the edge of your light.", 2800);
      }
      this.tweens.add({
        targets: this.watcher,
        alpha: noticed ? 0.48 : 0.32,
        duration: noticed ? 520 : 760,
        ease: "Sine.easeOut"
      });
      return true;
    }

    updateWatcherSprite(dt, light) {
      if (!this.watcher?.visible) return;
      const now = this.time.now;
      const state = this.watcherState;
      if (!state) {
        this.dismissWatcher("timeout");
        return;
      }
      const localLight = Math.max(this.lightLevelAt(this.watcher.x, this.watcher.y), light * 0.35);
      const distance = Phaser.Math.Distance.Between(this.watcher.x, this.watcher.y, this.player.x, this.player.y);
      const facing = this.player.flipX ? -1 : 1;
      const dx = this.watcher.x - this.player.x;
      const dy = this.watcher.y - this.player.y;
      const lookedAt = Math.sign(dx || facing) === facing && Math.abs(dx) < 390 && Math.abs(dy) < 180;
      const close = distance < 150;

      if (now > state.vanishAt || this.nearCamp()) {
        this.dismissWatcher(this.nearCamp() ? "camp" : "timeout");
        return;
      }
      if (localLight > 0.55 || close || (lookedAt && now - state.appearedAt > 700)) {
        if ((close || lookedAt) && !state.noticedToast) {
          state.noticedToast = true;
          this.floatText(this.player.x - 18, this.player.y - 44, "TRACE", "#d8b6ff");
        }
        this.dismissWatcher(close || lookedAt ? "noticed" : "bright");
        return;
      }

      const wobble = Math.sin(now / 820 + state.pulse);
      this.watcher.x = Phaser.Math.Linear(this.watcher.x, state.homeX + wobble * 3, clamp(dt * 2.6, 0, 1));
      this.watcher.y = Phaser.Math.Linear(this.watcher.y, state.homeY + Math.sin(now / 1180 + state.pulse) * 2, clamp(dt * 2.3, 0, 1));
      this.watcher.setFlipX(this.watcher.x < this.player.x);
      const darknessAlpha = clamp((this.shadowPressure - 24) / 130, 0.18, state.noticed ? 0.5 : 0.38);
      const targetAlpha = clamp(darknessAlpha * (1 - localLight * 0.42), 0.12, 0.52);
      this.watcher.setAlpha(Phaser.Math.Linear(this.watcher.alpha, targetAlpha, clamp(dt * 1.7, 0, 1)));
    }

    // ---- Hazards -----------------------------------------------------------------

    updateHazards(dt, inLava) {
      const depth = this.depthMeters();
      const previousDeepest = this.sim.stats.deepest || 0;
      this.sim.stats.deepest = Math.max(previousDeepest, depth);
      if (this.sim.stats.deepest !== previousDeepest) {
        this.checkContract();
        this.checkLore("depth");
      }
      const now = this.time.now;

      if (inLava) {
        this.applyDamage(16 * dt, "lava");
        if (now - this.lastSizzleAt > 600) {
          this.lastSizzleAt = now;
          ML.audio.play("sizzle");
          this.emitDust(this.player.x, this.player.y + 10, 3);
        }
      }

      const light = this.playerLight();
      const biome = this.currentBiome();
      this.updateShadowPressure(dt, light, depth, biome);
      const darkPressure = biome?.darkPressure || 0;
      const darkDepth = biome?.darkDepth ?? 140;
      const darkThreshold = biome?.darkThreshold ?? 0.22;
      if (darkPressure > 0 && depth > darkDepth && light < darkThreshold) {
        const wardFactor = this.sim.ward ? 0.45 : 1;
        this.applyDamage(darkPressure * 2.05 * wardFactor * dt, "dark");
        if (now - this.lastDarkWarnAt > 12000) {
          this.lastDarkWarnAt = now;
          ML.showToast(`${biome.name} is crushing your light. Place a torch or craft a lamp.`, 2800);
        }
      }

      const bottomY = this.worldHeightTiles() * TILE;
      if (this.player.y > bottomY - 150) {
        const opened = this.openAbyssSeam({ x: Math.floor(this.player.x / TILE), y: this.worldHeightTiles() - 3 }, "fall");
        if (!opened && this.player.y > bottomY - 72) this.failDescent("void");
      }
    }

    // ---- FX ------------------------------------------------------------------------

    emitBlockBurst(tileX, tileY, tint, count = 5) {
      this.sparkEmitter.setParticleTint(tint);
      this.sparkEmitter.explode(count, tileX * TILE + TILE / 2, tileY * TILE + TILE / 2);
    }

    emitDust(x, y, count = 4) {
      for (let i = 0; i < count; i += 1) {
        const dust = this.add.image(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-3, 3), "dust");
        dust.setDepth(24);
        dust.setAlpha(0.7);
        dust.setScale(1 + Math.random());
        this.tweens.add({
          targets: dust,
          y: dust.y - Phaser.Math.Between(4, 14),
          x: dust.x + Phaser.Math.Between(-10, 10),
          alpha: 0,
          scale: dust.scale * 1.8,
          duration: 360 + Math.random() * 200,
          onComplete: () => dust.destroy()
        });
      }
    }

    spawnPickupFx(tileX, tileY, item) {
      const textureKey = ML.ExternalAssets?.itemTextureKey?.(item, this) || "spark";
      const icon = this.add.image(tileX * TILE + 16, tileY * TILE + 10, textureKey)
        .setScale(textureKey === "spark" ? 1.5 : 1.15)
        .setDepth(40);
      if (textureKey === "spark") icon.setTint(ITEM_META[item]?.tint || 0xffffff);
      const sx = icon.x;
      const sy = icon.y;
      // Home in on the player's live position, not where they stood at break time.
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 280,
        ease: "Quad.easeIn",
        onUpdate: (tween) => {
          const t = tween.getValue();
          icon.setPosition(
            Phaser.Math.Linear(sx, this.player.x, t),
            Phaser.Math.Linear(sy, this.player.y - 8, t)
          );
          const startScale = textureKey === "spark" ? 1.5 : 1.15;
          icon.setScale(startScale - (textureKey === "spark" ? 0.9 : 0.62) * t);
        },
        onComplete: () => {
          icon.destroy();
          ML.audio.play("pickup");
          ML.bumpItem(item);
        }
      });
    }

    spawnRecoverFx(item) {
      if (!this.player?.active) return;
      const textureKey = this.textures.exists("asset-heart-full") ? "asset-heart-full" : "spark";
      const count = item === "kit" ? 4 : 2;
      for (let i = 0; i < count; i += 1) {
        const icon = this.add.image(
          this.player.x + Phaser.Math.Between(-10, 10),
          this.player.y - 18 + Phaser.Math.Between(-5, 4),
          textureKey
        )
          .setDepth(44)
          .setAlpha(0.95)
          .setScale(textureKey === "spark" ? 1.25 : 0.9);
        if (textureKey === "spark") icon.setTint(0xff6f82);
        this.tweens.add({
          targets: icon,
          y: icon.y - Phaser.Math.Between(18, 30),
          x: icon.x + Phaser.Math.Between(-8, 8),
          alpha: 0,
          scale: textureKey === "spark" ? 0.7 : 1.14,
          delay: i * 70,
          duration: 620,
          ease: "Sine.easeOut",
          onComplete: () => icon.destroy()
        });
      }
    }

    floatText(x, y, text, color = "#f5d77a") {
      const label = this.add.text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "12px",
        color,
        stroke: "#1b1510",
        strokeThickness: 3
      }).setDepth(90);
      this.tweens.add({
        targets: label,
        y: y - 24,
        alpha: 0,
        duration: 850,
        ease: "Sine.easeOut",
        onComplete: () => label.destroy()
      });
    }

    checkAchievements() {
      let unlockedAny = false;
      for (const achievement of ML.ACHIEVEMENTS || []) {
        if (this.sim.achievements?.[achievement.id]) continue;
        if (!ML.achievementMet(this.sim, achievement)) continue;
        this.sim.achievements[achievement.id] = true;
        unlockedAny = true;
        ML.showAchievement(achievement);
        ML.audio.play("achievement");
      }
      if (unlockedAny) ML.renderAll(this.sim);
    }

    checkLore(reason = "explore", context = {}) {
      if (!ML.LoreSystem) return [];
      const beforePhase = ML.LoreSystem.phase?.(this.sim);
      const payload = Object.assign({ reason, biome: this.currentBiome() }, context);
      const unlocked = ML.LoreSystem.evaluate(this.sim, payload);
      const afterPhase = ML.LoreSystem.phase?.(this.sim);
      if (afterPhase?.id && afterPhase.id !== (beforePhase?.id || this.lastStoryPhaseId)) {
        this.lastStoryPhaseId = afterPhase.id;
        if (!context.silent) {
          this.setAction(afterPhase.tone || "Signal shift", 1600);
          this.floatText(this.player.x - 34, this.player.y - 56, "SIGNAL SHIFT", "#9efff0");
          ML.showToast(`${afterPhase.title}: ${afterPhase.summary}`, 4600);
        }
      }
      if (!unlocked.length) {
        ML.renderMystery?.(this.sim);
        return [];
      }

      if (!context.silent) {
        const first = unlocked[0];
        this.setAction("Field note", 1300);
        this.floatText(this.player.x - 32, this.player.y - 44, "FIELD NOTE", "#d8b6ff");
        ML.audio.play("secret");
        ML.showToast(`Field note decoded: ${first.title}. ${first.body}`, unlocked.length > 1 ? 5200 : 4300);
      }

      ML.renderAll(this.sim);
      this.checkAchievements();
      return unlocked;
    }

    // ---- UI plumbing ------------------------------------------------------------------

    nearCamp() {
      return ML.CampSystem.isNearCamp(this.sim, this.player);
    }

    toggleCamp(force) {
      const opening = typeof force === "boolean" ? force : !this.campOpen;
      if (opening && !this.nearCamp()) {
        this.setAction("Find camp", 900);
        ML.audio.play("denied");
        ML.showToast("Camp services are available near a lit campfire.", 1800);
        return;
      }
      this.campOpen = opening;
      ML.ui.campDrawer?.classList.toggle("hidden", !this.campOpen);
      if (this.campOpen) {
        this.toggleCraft(false);
        this.toggleHelp(false);
        this.togglePack(false);
        ML.toggleMinimap(false);
        ML.renderCamp(this.sim);
      }
      ML.renderInteraction?.(this);
    }

    useCampService(id) {
      if (!this.nearCamp()) {
        this.toggleCamp(false);
        ML.audio.play("denied");
        ML.showToast("Move back to a campfire.", 1300);
        return false;
      }
      const service = (ML.CAMP_SERVICES || []).find((entry) => entry.id === id);
      const result = this.sim.campService(service, { x: this.player.x, y: this.player.y });
      ML.audio.play(result.ok ? (service?.kind === "rest" ? "recall" : "craft") : "denied");
      const message = result.ok && result.anchor?.ok
        ? `${result.message} Anchor set at ${ML.CampSystem.campLabel(this.sim, result.anchor.camp)}.`
        : result.message;
      ML.showToast(message, result.ok ? 1900 : 1800);
      if (!result.ok) {
        ML.renderCamp(this.sim);
        return false;
      }
      if (service.kind === "rest") {
        this.nextRecallAt = 0;
        this.playerIframesUntil = this.time.now + 700;
      }
      this.setAction("Camp", 900);
      this.floatText(this.player.x - 18, this.player.y - 38, service.action.toUpperCase(), "#f5d77a");
      this.checkLore("camp", { service, result });
      this.checkAchievements();
      ML.renderAll(this.sim);
      this.saveGame();
      return true;
    }

    toggleCraft(force) {
      this.craftOpen = typeof force === "boolean" ? force : !this.craftOpen;
      ML.ui.craftDrawer.classList.toggle("hidden", !this.craftOpen);
      if (this.craftOpen) {
        this.toggleCamp(false);
        this.toggleHelp(false);
        this.togglePack(false);
        ML.toggleMinimap(false);
        ML.renderCraft(this.sim);
      }
      ML.renderInteraction?.(this);
    }

    togglePack(force) {
      this.packOpen = typeof force === "boolean" ? force : !this.packOpen;
      ML.ui.packDrawer?.classList.toggle("hidden", !this.packOpen);
      ML.ui.packToggle?.classList.toggle("active", this.packOpen);
      if (this.packOpen) {
        this.toggleCamp(false);
        this.toggleCraft(false);
        this.toggleHelp(false);
        ML.toggleMinimap(false);
        ML.renderPack?.(this.sim);
      }
      ML.renderInteraction?.(this);
    }

    toggleHelp(force) {
      this.helpOpen = typeof force === "boolean" ? force : !this.helpOpen;
      ML.ui.helpDrawer.classList.toggle("hidden", !this.helpOpen);
      if (this.helpOpen) {
        this.toggleCamp(false);
        this.toggleCraft(false);
        this.togglePack(false);
        ML.toggleMinimap(false);
      }
    }

    setPaused(paused, options = {}) {
      if (this.dead) return; // the death panel owns this state
      if (!paused) this.autoPausedByVisibility = false;
      this.pausedByUI = paused;
      this.resetInputState();
      if (paused) {
        this.physics.world.pause();
        this.toggleCamp(false);
        this.toggleCraft(false);
        this.toggleHelp(false);
        this.togglePack(false);
        ML.toggleMinimap(false);
        ML.ui.pauseMenu?.classList.remove("hidden");
      } else {
        this.physics.world.resume();
        ML.ui.pauseMenu?.classList.add("hidden");
        this.focusGameInput();
      }
      ML.ui.pauseIcon.innerHTML = paused ? '<path d="M8 5v14l11-7z"/>' : '<path d="M8 5v14"/><path d="M16 5v14"/>';
      if (!options.silent) ML.showToast(paused ? "Paused." : "Back to the mine.", 1000);
    }

    failDescent(cause) {
      if (this.dead) return;
      this.dead = true;
      this.autoPausedByVisibility = false;
      this.sim.health = 0;
      this.physics.world.pause();
      this.clearPendingMobSpawns(false);
      this.toggleCamp(false);
      this.toggleCraft(false);
      this.toggleHelp(false);
      this.togglePack(false);
      ML.ui.pauseMenu?.classList.add("hidden");
      for (const item of ["coal", "copper", "iron", "gold", "crystal", "obsidian"]) {
        this.sim.inventory[item] = Math.floor((this.sim.inventory[item] || 0) * 0.72);
      }
      ML.audio.play("hurt");
      ML.showDeath(this.sim, DEATH_CAUSES[cause] || DEATH_CAUSES.void, this.dayNumber());
      ML.renderAll(this.sim);
    }

    respawn() {
      this.restartAtSpawn();
    }

    restartAtSpawn() {
      this.dead = false;
      this.pausedByUI = false;
      this.autoPausedByVisibility = false;
      this.resetInputState();
      ML.ui.pauseIcon.innerHTML = '<path d="M8 5v14"/><path d="M16 5v14"/>';
      ML.hideDeath();
      this.clearPendingMobSpawns(false);
      this.toggleCamp(false);
      this.toggleCraft(false);
      this.toggleHelp(false);
      this.togglePack(false);
      ML.ui.pauseMenu?.classList.add("hidden");
      this.physics.world.resume();
      this.sim.health = this.sim.maxHealth;
      this.sim.energy = this.sim.maxEnergy;
      this.sim.refillLamp?.();
      const anchor = ML.CampSystem.activeCamp(this.sim);
      const safe = ML.CampSystem.campSpawnPixels(this.sim, anchor);
      this.player.setPosition(safe.x, safe.y);
      this.sim.player = safe;
      this.player.setVelocity(0, 0);
      this.wasAirborne = false;
      this.peakFallVy = 0;
      this.jumpsUsed = 0;
      this.playerIframesUntil = this.time.now + 1200;
      this.cameras.main.fadeIn(220, 0, 0, 0);
      this.focusGameInput();
      ML.showToast(`Returned to campfire anchor (${ML.CampSystem.campLabel(this.sim, anchor)}).`, 1500);
      ML.renderAll(this.sim);
    }

    restartWorld() {
      try { localStorage.removeItem(ML.SAVE_KEY); } catch { /* ignore */ }
      this.sim.newWorld();
      ML.hideDeath();
      this.clearPendingMobSpawns(false);
      this.toggleCamp(false);
      this.toggleCraft(false);
      this.toggleHelp(false);
      this.togglePack(false);
      ML.ui.pauseMenu?.classList.add("hidden");
      this.scene.restart();
    }
  }

  ML.MineScene = MineScene;
})();
