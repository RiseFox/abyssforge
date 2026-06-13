// AbyssForge v2 - the Phaser scene: movement, mining, combat, lighting, hazards.
(() => {
  "use strict";
  const ML = window.ML;
  const {
    TILE, WORLD_W, WORLD_H, AIR, DAY_LENGTH, INTERACT_RANGE_TILES,
    Tile, BLOCKS, SOLID_TILES, BLOCK_TINTS, ITEM_META, HOTBAR, PICKS, LAMPS, ENEMIES, clamp
  } = ML;

  const SKY_DAY = { r: 0x6f, g: 0x9f, b: 0xd6 };
  const SKY_NIGHT = { r: 0x0b, g: 0x0e, b: 0x1d };

  const DEATH_CAUSES = {
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

    create() {
      ML.sceneRef = this;
      // Reset per-run state here: create() runs again after scene.restart().
      this.dead = false;
      this.pausedByUI = false;
      this.craftOpen = false;
      this.campOpen = false;
      this.helpOpen = false;
      this.mineTarget = null;
      this.mineProgress = 0;
      this.enemyClock = 0;
      this.activeMobIds = new Set();
      this.lastDay = Math.floor(this.sim.time / DAY_LENGTH) + 1;
      this.lastHudUpdate = 0;
      this.lastMapUpdate = 0;
      this.lastMusicCheck = 0;
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
      this.caveEvent = null;
      this.nextCaveEventAt = 0;
      this.eventPulseAt = 0;
      this.nextRecallAt = 0;
      this.physics.world.resume();
      this.sim.ensureContract();

      ML.makeTextures(this);

      this.map = this.make.tilemap({ data: this.sim.world, tileWidth: TILE, tileHeight: TILE });
      const tileset = this.map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0);
      this.layer = this.map.createLayer(0, tileset, 0, 0);
      this.initCollision();

      this.physics.world.setBounds(0, 0, WORLD_W * TILE, WORLD_H * TILE);
      this.player = this.physics.add.sprite(this.sim.player.x, this.sim.player.y, "playerSheet", "idle0");
      this.player.setCollideWorldBounds(true);
      this.player.body.setSize(20, 30).setOffset(4, 5);
      // Terminal velocity: keeps huge background-tab deltas from tunneling
      // the body through one-way platforms, and bounds fall damage.
      this.player.body.setMaxVelocity(420, 1150);
      this.player.setDepth(10);
      this.createAnims();

      // Hold S to drop through platforms.
      this.physics.add.collider(this.player, this.layer, null, (_player, tile) => {
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
      this.physics.add.collider(this.enemies, this.layer);
      this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);

      this.cameras.main.setBounds(0, 0, WORLD_W * TILE, WORLD_H * TILE);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      this.cameras.main.setDeadzone(120, 80);

      this.mineGraphics = this.add.graphics().setDepth(30);
      this.lightGlow = this.add.graphics()
        .setScrollFactor(0)
        .setDepth(79);

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

      this.input.keyboard.on("keydown-E", () => this.toggleCraft());
      this.input.keyboard.on("keydown-C", () => this.toggleCamp());
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
        if (this.craftOpen || this.campOpen || this.helpOpen) return;
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
      this.scheduleNextCaveEvent(true);
      this.refreshMobActivation();
      ML.renderAll(this.sim);
      this.checkAchievements();
      ML.showToast("Pickaxe ready. LMB mines, RMB places or uses, F attacks, E crafts, M map.", 4600);
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
      this.layer.calculateFacesWithin(0, 0, WORLD_W, WORLD_H);
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
      this.updateSurvivalRegen(dt, onFloor, inLava);
      if (this.caveEvent?.id === "lanternDraft") {
        this.sim.energy = clamp(this.sim.energy + dt * 4.5, 0, this.sim.maxEnergy);
      }

      const pointer = this.input.activePointer;
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

      this.updateEnemies(dt);
      this.updateCaveEvents(dt);
      this.updateHazards(dt, inLava);
      this.updateSky();
      this.drawDarkness();
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
      if (this.hasActiveBoss()) return "boss";
      if (this.caveEvent?.id === "swarm" || this.caveEvent?.id === "tremor") return "danger";
      if (this.caveEvent?.id === "oreSurge") return "treasure";
      if (this.hasNearbyDanger()) return "danger";
      if (this.nearUnopenedSecretChest()) return "treasure";
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
      const tileX = clamp(Math.floor(this.player.x / TILE), 0, WORLD_W - 1);
      const surfaceY = this.sim.surface[tileX] || 24;
      return Math.max(0, Math.floor(this.player.y / TILE - surfaceY));
    }

    biomeName() {
      const depth = this.depthMeters();
      if (depth > 210) return "Abyss";
      if (depth > 140) return "Deepstone";
      if (depth > 60) return "Lower caves";
      if (depth > 10) return "Upper caves";
      return "Surface";
    }

    ambientLight() {
      const depth = this.depthMeters();
      const df = clamp(1 - depth / 46, 0, 1);
      return clamp(0.08 + df * this.surfaceBrightness(), 0.08, 1);
    }

    playerLight() {
      let best = Math.max(this.ambientLight(), LAMPS[this.sim.lamp].glow);
      if (this.sim.ward) best = Math.max(best, 0.28);
      if (this.caveEvent?.id === "lanternDraft") best = Math.max(best, 0.46);
      const px = this.player.x / TILE;
      const py = this.player.y / TILE;
      for (const light of this.sim.lights) {
        const r = BLOCKS[light.t]?.light || 0;
        if (!r) continue;
        const d = Math.hypot(light.x + 0.5 - px, light.y + 0.5 - py);
        if (d < r + 1) best = Math.max(best, 1 - d / (r + 1));
      }
      return clamp(best, 0, 1);
    }

    drawDarkness() {
      const cam = this.cameras.main;
      const ambient = this.ambientLight();
      const alpha = clamp(0.86 - ambient * 0.86, 0, 0.86);
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
      let radius = LAMPS[this.sim.lamp].radius;
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
        if (light.t === Tile.TORCH || light.t === Tile.LAVA) {
          radius += Math.sin(now / 95 + light.x * 13 + light.y * 7) * 7;
        }
        const sx = wx - cam.scrollX;
        const sy = wy - cam.scrollY;
        const color = light.t === Tile.LAVA ? 0xff6a2f : light.t === Tile.MUSHROOM ? 0x61e0d0 : 0xf0b85c;
        drawGlow(sx, sy, radius, color, light.t === Tile.TORCH ? 1 : 0.75);
        punchLight(sx, sy, radius);
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
      if (this.sim.health <= 0) this.failDescent(cause);
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
      if (!surfaceRest && !litRest) return;
      let rate = surfaceRest ? 1.15 : 0.55;
      if (this.sim.regenBoost) rate *= 1.55;
      if (this.caveEvent?.id === "lanternDraft") rate *= 1.8;
      const before = this.sim.health;
      this.sim.health = clamp(this.sim.health + dt * rate, 0, this.sim.maxHealth);
      if (Math.floor(before) !== Math.floor(this.sim.health) && (!this.actionHoldUntil || this.time.now > this.actionHoldUntil)) {
        this.currentAction = "Recover";
      }
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
      const x = Math.floor(pointer.worldX / TILE);
      const y = Math.floor(pointer.worldY / TILE);
      const dx = x * TILE + TILE / 2 - this.player.x;
      const dy = y * TILE + TILE / 2 - this.player.y;
      if (Math.sqrt(dx * dx + dy * dy) > TILE * INTERACT_RANGE_TILES) return null;
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return null;
      return { x, y, tile: this.sim.tileAt(x, y) };
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
      if (this.depthMeters() <= 7) {
        this.setAction("At camp", 900);
        ML.showToast("You are already near the surface camp.", 1200);
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
        const safe = this.sim.safeSpawnPixels();
        this.player.setPosition(safe.x, safe.y);
        this.player.setVelocity(0, 0);
        this.sim.player = safe;
        this.wasAirborne = false;
        this.peakFallVy = 0;
        this.jumpsUsed = 0;
        this.playerIframesUntil = this.time.now + 900;
        this.cameras.main.fadeIn(190, 12, 18, 28);
        this.emitDust(this.player.x, this.player.y + 14, 8);
        ML.showToast("Recalled to surface camp.", 1600);
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
      const block = BLOCKS[target.tile];
      if (!block || target.tile === Tile.BEDROCK || target.tile === Tile.LAVA) {
        this.targetLabel = block ? block.name : "Unknown";
        ML.showToast(target.tile === Tile.LAVA ? "You cannot mine lava. Cover it with a block." : "Bedrock does not move.");
        this.mineTarget = null;
        return;
      }
      if (block.tier > this.sim.pickLevel) {
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
      this.mineProgress += (delta / 1000) * PICKS[this.sim.pickLevel].speed * stamina / block.hardness;
      this.sim.energy = clamp(this.sim.energy - (delta / 1000) * 9.5, 0, this.sim.maxEnergy);
      this.targetLabel = block.name;
      this.setAction("Mining", 220);
      if (this.time.now > this.pickSwingUntil - 80) {
        this.swingPickaxe(240);
        ML.audio.play("dig");
        this.emitBlockBurst(target.x, target.y, BLOCK_TINTS[target.tile] || 0xffffff, 2);
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

    lootChest(x, y) {
      const depth = Math.max(0, y - (this.sim.surface[x] || 24));
      const secret = this.sim.secretAt(x, y);
      const loot = { coal: 2 + Math.floor(Math.random() * 3), coin: 4 + Math.floor(Math.random() * 7) };
      const extras = [
        () => { loot.torch = (loot.torch || 0) + 2 + Math.floor(Math.random() * 2); },
        () => { loot.ladder = (loot.ladder || 0) + 2 + Math.floor(Math.random() * 2); },
        () => { loot.charge = (loot.charge || 0) + 1 + Math.floor(Math.random() * 2); },
        () => { loot.mushroom = (loot.mushroom || 0) + 2; },
        () => { if (Math.random() < 0.35) loot.kit = (loot.kit || 0) + 1; },
        () => { loot.gel = (loot.gel || 0) + 2 + Math.floor(Math.random() * 3); },
        () => { if (depth > 100) loot.gold = (loot.gold || 0) + 1 + Math.floor(Math.random() * 2); },
        () => { if (depth > 140 && Math.random() < 0.5) loot.crystal = (loot.crystal || 0) + 1; }
      ];
      for (let i = 0; i < (secret ? 5 : 3); i += 1) {
        extras[Math.floor(Math.random() * extras.length)]();
      }
      if (secret) {
        this.sim.markSecretOpened(secret);
        loot.coin = (loot.coin || 0) + 10 + secret.tier * 6;
        loot.relic = (loot.relic || 0) + secret.tier;
        loot.silk = (loot.silk || 0) + 1 + secret.tier;
        if (secret.tier >= 2) loot.gold = (loot.gold || 0) + 2;
        if (secret.tier >= 3) {
          loot.crystal = (loot.crystal || 0) + 2;
          loot.obsidian = (loot.obsidian || 0) + 2;
        }
      }
      if (this.sim.lootBonus) loot.coin = (loot.coin || 0) + 6 + Math.floor(Math.random() * 8);
      const parts = [];
      for (const [item, n] of Object.entries(loot)) {
        if (!n) continue;
        this.sim.addItem(item, n);
        parts.push(`${ITEM_META[item].name} +${n}`);
        this.spawnPickupFx(x, y, item);
      }
      ML.audio.play(secret ? "secret" : "chest");
      this.floatText(x * TILE, y * TILE - 6, secret ? "Secret cache!" : "Supplies!", secret ? "#d8b6ff" : "#ffe49a");
      ML.showToast(`${secret ? "Secret cache" : "Chest"}: ${parts.join(", ")}.`, 3600);
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
          if (result.ok) this.setAction("Recover", 800);
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
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, blastX, blastY) < radius * TILE * 1.25) {
        this.applyDamage(12, "blast");
        this.floatText(this.player.x - 10, this.player.y - 30, "-12", "#f08561");
      }
      this.enemies.getChildren().forEach((enemy) => {
        if (!enemy.active) return;
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, blastX, blastY) < radius * TILE * 1.4) {
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
        const dx = enemy.x - this.player.x;
        const dy = Math.abs(enemy.y - this.player.y);
        const distance = Math.hypot(dx, enemy.y - this.player.y);
        const inFacingArc = Math.sign(dx || facing) === facing && dy <= 58 && distance <= 120;
        const closeBody = distance <= 66;
        const isAimed = aimed === enemy && distance <= 130;
        if (inFacingArc || closeBody || isAimed) targets.push(enemy);
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

        const dir = Math.sign(this.player.x - enemy.x) || 1;
        switch (enemy.kind) {
          case "bat": {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - 6 - enemy.y;
            const dist = Math.max(20, Math.hypot(dx, dy));
            enemy.setVelocityX((dx / dist) * enemy.speed);
            enemy.setVelocityY((dy / dist) * enemy.speed * 0.8 + Math.sin(now / 170 + enemy.bobSeed) * 46);
            enemy.setFlipX(dx < 0);
            break;
          }
          case "slime": {
            if (enemy.body.blocked.down) {
              enemy.setVelocityX(enemy.body.velocity.x * 0.8);
              if (now > enemy.nextHopAt) {
                enemy.nextHopAt = now + 900 + Math.random() * 800;
                enemy.setVelocityX(dir * 175);
                enemy.setVelocityY(-365);
              }
            }
            break;
          }
          case "broodmother": {
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down) {
              enemy.setVelocityX(enemy.body.velocity.x * 0.72);
              if (now > enemy.nextHopAt) {
                enemy.nextHopAt = now + 760 + Math.random() * 520;
                enemy.setVelocityX(dir * 265);
                enemy.setVelocityY(-430);
              }
            }
            if (now > enemy.nextSpecialAt) {
              enemy.nextSpecialAt = now + 5200 + Math.random() * 2600;
              this.summonMinion(enemy, Math.random() < 0.55 ? "crawler" : "slime");
            }
            break;
          }
          case "warden": {
            enemy.setVelocityX(dir * enemy.speed);
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down && (enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.04) {
              enemy.setVelocityY(-315);
            }
            if (now > enemy.nextSpecialAt) {
              enemy.nextSpecialAt = now + 2600 + Math.random() * 1600;
              this.bossShockwave(enemy);
            }
            break;
          }
          case "golem": {
            enemy.setVelocityX(dir * enemy.speed);
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down && (enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.03) {
              enemy.setVelocityY(-300);
            }
            break;
          }
          default: { // crawler
            enemy.setVelocityX(dir * enemy.speed);
            enemy.setFlipX(dir < 0);
            if (enemy.body.blocked.down && ((this.player.y < enemy.y - 40 && Math.random() < 0.012) || ((enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.06))) {
              enemy.setVelocityY(-330);
            }
          }
        }
      }
    }

    summonMinion(enemy, kind) {
      if (this.enemies.countActive(true) >= 12) return;
      const dir = this.player.x < enemy.x ? -1 : 1;
      const tx = clamp(Math.floor(enemy.x / TILE) + dir * 2, 2, WORLD_W - 3);
      const ty = clamp(Math.floor(enemy.y / TILE), 2, WORLD_H - 3);
      if (this.sim.tileAt(tx, ty) !== AIR || this.sim.tileAt(tx, ty + 1) === AIR || !BLOCKS[this.sim.tileAt(tx, ty + 1)]?.solid) return;
      const mob = this.sim.addMob(tx, ty, kind, { summoned: true });
      this.materializeMob(mob);
      this.floatText(enemy.x - 20, enemy.y - 34, "Summon", "#d8b6ff");
      ML.audio.play("roar");
    }

    bossShockwave(enemy) {
      this.cameras.main.shake(120, 0.006);
      this.emitDust(enemy.x, enemy.y + 20, 8);
      ML.audio.play("roar");
      this.floatText(enemy.x - 14, enemy.y - 38, "STOMP", "#ffb36a");
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if (distance < 145) {
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
        if (this.enemies.countActive(true) >= 12) break;
        if (this.activeMobIds.has(mob.id)) continue;
        if (Math.abs(mob.x - px) > wakeX || Math.abs(mob.y - py) > wakeY) continue;
        this.materializeMob(mob);
      }
    }

    findMobSpot(mob) {
      const ok = (x, y) => {
        if (this.sim.tileAt(x, y) !== AIR) return false;
        if (ENEMIES[mob.kind].fly) return true;
        const below = this.sim.tileAt(x, y + 1);
        return below !== AIR && BLOCKS[below]?.solid;
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

    materializeMob(mob) {
      const spot = this.findMobSpot(mob);
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
      const tx = clamp(Math.floor(enemy.x / TILE), 1, WORLD_W - 2);
      const ty = clamp(Math.floor(enemy.y / TILE), 1, WORLD_H - 2);
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

    // At night a few crawlers creep onto the surface far away and walk in;
    // survivors burrow away at dawn.
    maybeNightRaid() {
      if (this.surfaceBrightness() >= 0.4) return;
      if (this.sim.mobs.filter((m) => m.surf).length >= 3) return;
      if (Math.random() > 0.12) return;
      const px = Math.floor(this.player.x / TILE);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const x = clamp(px + dir * (38 + Math.floor(Math.random() * 18)), 4, WORLD_W - 5);
      const y = (this.sim.surface[x] || 24) - 1;
      if (this.sim.tileAt(x, y) !== AIR) return;
      this.sim.addMob(x, y, "crawler", { surf: true });
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
        const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
        const surfaceY = this.sim.surface[x] || 24;
        const y = surfaceY + 16 + Math.floor(Math.random() * Math.max(1, WORLD_H - surfaceY - 24));
        if (Math.abs(x - px) < 40 && Math.abs(y - py) < 26) continue;
        if (Math.abs(x - this.sim.shaft.x) <= 10 && y <= this.sim.shaft.y + 24) continue;
        if (this.sim.tileAt(x, y) !== AIR || this.sim.tileAt(x, y - 1) !== AIR) continue;
        const below = this.sim.tileAt(x, y + 1);
        if (below === AIR || !BLOCKS[below]?.solid) continue;
        const kind = this.sim.pickMobKind(y - surfaceY, Math.random());
        this.sim.addMob(x, kind === "bat" ? y - 1 : y, kind);
        added += 1;
      }
    }

    // ---- Cave events ---------------------------------------------------------------

    scheduleNextCaveEvent(initial = false) {
      const depth = this.player ? this.depthMeters() : 0;
      const base = initial ? 26000 : 52000;
      const depthDiscount = Math.min(17000, depth * 115);
      this.nextCaveEventAt = this.time.now + Math.max(16000, base + Math.random() * 24000 - depthDiscount);
    }

    chooseCaveEvent() {
      const depth = this.depthMeters();
      const pool = ["oreSurge", "lanternDraft"];
      if (depth > 24) pool.push("swarm", "swarm");
      if (depth > 58) pool.push("tremor");
      if (depth > 135) pool.push("tremor", "swarm");
      return pool[Math.floor(Math.random() * pool.length)];
    }

    startCaveEvent(kind = null) {
      const id = kind || this.chooseCaveEvent();
      const cfg = ML.CAVE_EVENTS?.[id];
      if (!cfg) return false;
      this.caveEvent = {
        id,
        name: cfg.name,
        note: cfg.note,
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

      ML.audio.play("event");
      ML.showToast(`${cfg.name}: ${cfg.note}`, 3600);
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
      const fly = ENEMIES[kind]?.fly;
      const px = Math.floor(this.player.x / TILE);
      const py = Math.floor(this.player.y / TILE);
      for (let tries = 0; tries < 32; tries += 1) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const x = clamp(px + dir * Phaser.Math.Between(5, 11), 3, WORLD_W - 4);
        const y = clamp(py + Phaser.Math.Between(-4, 5), 5, WORLD_H - 6);
        if (Math.abs(x - px) < 4 && Math.abs(y - py) < 3) continue;
        if (this.sim.tileAt(x, y) !== AIR) continue;
        if (!fly) {
          const below = this.sim.tileAt(x, y + 1);
          if (below === AIR || !BLOCKS[below]?.solid) continue;
        }
        const mob = this.sim.addMob(x, y, kind, { event: true, elite });
        this.materializeMob(mob);
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
          const tx = clamp(Math.floor(rx / TILE), 0, WORLD_W - 1);
          const ty = clamp(Math.floor(ry / TILE), 0, WORLD_H - 1);
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
      const snapshot = { x: this.player.x, y: this.player.y };
      if (!this.sim.hasPlayerSupport(snapshot)) {
        const vy = Math.abs(this.player.body?.velocity?.y || 0);
        if (vy > 35) return true;
        const repaired = this.sim.nearestSafePlayerPixels(snapshot);
        return this.sim.save(repaired);
      }
      return this.sim.save(this.sim.snapPlayerToTileCenter(snapshot));
    }

    // ---- Hazards -----------------------------------------------------------------

    updateHazards(dt, inLava) {
      const depth = this.depthMeters();
      const previousDeepest = this.sim.stats.deepest || 0;
      this.sim.stats.deepest = Math.max(previousDeepest, depth);
      if (this.sim.stats.deepest !== previousDeepest) this.checkContract();
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
      if (depth > 140 && light < 0.22) {
        this.applyDamage((this.sim.ward ? 1.15 : 2.6) * dt, "dark");
        if (now - this.lastDarkWarnAt > 12000) {
          this.lastDarkWarnAt = now;
          ML.showToast("The darkness gnaws at you. Light a torch or craft a lamp.", 2600);
        }
      }

      if (this.player.y > WORLD_H * TILE - 80) this.failDescent("void");
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
      const icon = this.add.image(tileX * TILE + 16, tileY * TILE + 10, "spark")
        .setTint(ITEM_META[item]?.tint || 0xffffff)
        .setScale(1.5)
        .setDepth(40);
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
          icon.setScale(1.5 - 0.9 * t);
        },
        onComplete: () => {
          icon.destroy();
          ML.audio.play("pickup");
          ML.bumpItem(item);
        }
      });
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

    // ---- UI plumbing ------------------------------------------------------------------

    nearCamp() {
      if (!this.player) return false;
      const safe = this.sim.safeSpawnPixels();
      return this.depthMeters() <= 8 && Phaser.Math.Distance.Between(this.player.x, this.player.y, safe.x, safe.y) <= TILE * 8;
    }

    toggleCamp(force) {
      const opening = typeof force === "boolean" ? force : !this.campOpen;
      if (opening && !this.nearCamp()) {
        this.setAction("Find camp", 900);
        ML.audio.play("denied");
        ML.showToast("Camp services are available only at the surface camp.", 1800);
        return;
      }
      this.campOpen = opening;
      ML.ui.campDrawer?.classList.toggle("hidden", !this.campOpen);
      if (this.campOpen) {
        this.toggleCraft(false);
        this.toggleHelp(false);
        ML.toggleMinimap(false);
        ML.renderCamp(this.sim);
      }
    }

    useCampService(id) {
      if (!this.nearCamp()) {
        this.toggleCamp(false);
        ML.audio.play("denied");
        ML.showToast("Move back to the surface camp.", 1300);
        return false;
      }
      const service = (ML.CAMP_SERVICES || []).find((entry) => entry.id === id);
      const result = this.sim.campService(service);
      ML.audio.play(result.ok ? (service?.kind === "rest" ? "recall" : "craft") : "denied");
      ML.showToast(result.message, result.ok ? 1500 : 1800);
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
        ML.toggleMinimap(false);
        ML.renderCraft(this.sim);
      }
    }

    toggleHelp(force) {
      this.helpOpen = typeof force === "boolean" ? force : !this.helpOpen;
      ML.ui.helpDrawer.classList.toggle("hidden", !this.helpOpen);
      if (this.helpOpen) {
        this.toggleCamp(false);
        this.toggleCraft(false);
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
      this.toggleCamp(false);
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
      this.toggleCamp(false);
      ML.ui.pauseMenu?.classList.add("hidden");
      this.physics.world.resume();
      this.sim.health = this.sim.maxHealth;
      this.sim.energy = this.sim.maxEnergy;
      const safe = this.sim.safeSpawnPixels();
      this.player.setPosition(safe.x, safe.y);
      this.sim.player = safe;
      this.player.setVelocity(0, 0);
      this.wasAirborne = false;
      this.peakFallVy = 0;
      this.jumpsUsed = 0;
      this.playerIframesUntil = this.time.now + 1200;
      this.cameras.main.fadeIn(220, 0, 0, 0);
      this.focusGameInput();
      ML.renderAll(this.sim);
    }

    restartWorld() {
      try { localStorage.removeItem(ML.SAVE_KEY); } catch { /* ignore */ }
      this.sim.newWorld();
      ML.hideDeath();
      this.toggleCamp(false);
      ML.ui.pauseMenu?.classList.add("hidden");
      this.scene.restart();
    }
  }

  ML.MineScene = MineScene;
})();
