// MinerLand v2 — DOM HUD: status bars, hotbar, crafting drawer, minimap, toasts.
(() => {
  "use strict";
  const ML = window.ML;
  const { WORLD_W, WORLD_H, AIR, TILE, ITEM_META, HOTBAR, PICKS, BLADES, LAMPS, RECIPES, CRAFT_CATS, MAP_COLORS, clamp } = ML;

  const ui = {
    healthText: document.getElementById("healthText"),
    healthBar: document.getElementById("healthBar"),
    energyText: document.getElementById("energyText"),
    energyBar: document.getElementById("energyBar"),
    depthText: document.getElementById("depthText"),
    depthBar: document.getElementById("depthBar"),
    lightText: document.getElementById("lightText"),
    lightBar: document.getElementById("lightBar"),
    worldLabel: document.getElementById("worldLabel"),
    pickHudText: document.getElementById("pickHudText"),
    pickTierText: document.getElementById("pickTierText"),
    pickText: document.getElementById("pickText"),
    damageText: document.getElementById("damageText"),
    gearText: document.getElementById("gearText"),
    actionText: document.getElementById("actionText"),
    targetText: document.getElementById("targetText"),
    hotbar: document.getElementById("hotbar"),
    helpDrawer: document.getElementById("helpDrawer"),
    craftDrawer: document.getElementById("craftDrawer"),
    craftTabs: document.getElementById("craftTabs"),
    inventoryGrid: document.getElementById("inventoryGrid"),
    recipes: document.getElementById("recipes"),
    helpToggle: document.getElementById("helpToggle"),
    closeHelp: document.getElementById("closeHelp"),
    craftToggle: document.getElementById("craftToggle"),
    closeCraft: document.getElementById("closeCraft"),
    mapToggle: document.getElementById("mapToggle"),
    muteToggle: document.getElementById("muteToggle"),
    muteIcon: document.getElementById("muteIcon"),
    saveBtn: document.getElementById("saveBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    pauseIcon: document.getElementById("pauseIcon"),
    menuToggle: document.getElementById("menuToggle"),
    pauseMenu: document.getElementById("pauseMenu"),
    closeMenu: document.getElementById("closeMenu"),
    resumeBtn: document.getElementById("resumeBtn"),
    menuSaveBtn: document.getElementById("menuSaveBtn"),
    menuRespawnBtn: document.getElementById("menuRespawnBtn"),
    menuNewWorldBtn: document.getElementById("menuNewWorldBtn"),
    toast: document.getElementById("toast"),
    minimapPanel: document.getElementById("minimapPanel"),
    minimapCanvas: document.getElementById("minimapCanvas"),
    closeMap: document.getElementById("closeMap"),
    deathPanel: document.getElementById("deathPanel"),
    deathCause: document.getElementById("deathCause"),
    deathStats: document.getElementById("deathStats"),
    respawnBtn: document.getElementById("respawnBtn"),
    newWorldBtn: document.getElementById("newWorldBtn"),
    damageFlash: document.getElementById("damageFlash")
  };

  const mobile = { left: false, right: false, jumpTap: false, mineTap: false, placeTap: false, attackTap: false };

  let toastTimer = 0;
  let craftTab = "tools";
  let minimapOpen = window.matchMedia("(min-width: 761px)").matches;
  let lastFlashAt = 0;
  let hotbarEls = null;

  function showToast(message, ms = 2000) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("visible"), ms);
  }

  function flashDamage() {
    if (!ui.damageFlash) return;
    // Damage-over-time calls this every frame; retriggering the animation
    // each time would pin the vignette at full opacity and force reflows.
    const now = performance.now();
    if (now - lastFlashAt < 340) return;
    lastFlashAt = now;
    ui.damageFlash.classList.remove("active");
    void ui.damageFlash.offsetWidth; // restart the CSS animation
    ui.damageFlash.classList.add("active");
  }

  function renderStatus(sim, player, light = 1) {
    ui.healthText.textContent = String(Math.round(sim.health));
    ui.healthBar.style.width = `${clamp(sim.health, 0, 100)}%`;
    ui.energyText.textContent = String(Math.round(sim.energy));
    ui.energyBar.style.width = `${clamp(sim.energy, 0, 100)}%`;
    const px = player ? player.x : sim.player.x;
    const py = player ? player.y : sim.player.y;
    const tileX = clamp(Math.floor(px / TILE), 0, WORLD_W - 1);
    const depth = Math.max(0, Math.floor(py / TILE - (sim.surface[tileX] || 24)));
    ui.depthText.textContent = `${depth} m`;
    ui.depthBar.style.width = `${clamp(depth / 230 * 100, 0, 100)}%`;
    ui.lightText.textContent = light > 0.7 ? "Clear" : light > 0.35 ? "Dim" : "Dark";
    ui.lightBar.style.width = `${Math.round(light * 100)}%`;

    const scene = ML.sceneRef;
    const day = scene ? scene.dayNumber() : 1;
    const phase = scene ? scene.phaseName() : "Day";
    ui.worldLabel.textContent = `Seed ${sim.seed} · Day ${day} · ${phase}`;
    const pickName = PICKS[sim.pickLevel]?.name || "Pickaxe";
    ui.pickText.textContent = pickName;
    ui.pickHudText.textContent = pickName;
    ui.pickTierText.textContent = `Tier ${sim.pickLevel}`;
    ui.damageText.textContent = `${sim.attackDamage()} · ${BLADES[sim.blade].name}`;
    const gear = [LAMPS[sim.lamp].name];
    if (sim.boots) gear.push("Cave boots");
    ui.gearText.textContent = gear.join(" · ");
    ui.actionText.textContent = scene?.currentAction || "Explore";
    ui.targetText.textContent = scene?.targetLabel || "None";
  }

  // The hotbar DOM is built once; later calls only patch counts and selection.
  // renderHotbar fires on every mined block — a full rebuild would churn ~500
  // nodes per second during fast mining.
  function buildHotbar(sim) {
    ui.hotbar.textContent = "";
    hotbarEls = HOTBAR.map((item, index) => {
      const slot = document.createElement("button");
      slot.className = "slot";
      slot.type = "button";
      slot.title = ITEM_META[item].name;
      slot.addEventListener("click", () => {
        sim.selected = index;
        ML.audio.play("click");
        renderHotbar(sim);
      });

      const key = document.createElement("span");
      key.className = "slot-key";
      key.textContent = String(index + 1);

      const icon = document.createElement("i");
      icon.className = "slot-icon " + ITEM_META[item].cls;

      const count = document.createElement("span");
      count.className = "slot-count";
      count.dataset.item = item;

      slot.append(key, icon, count);
      if (ITEM_META[item].consumable) {
        const use = document.createElement("span");
        use.className = "slot-use";
        use.textContent = "USE";
        slot.appendChild(use);
      }
      ui.hotbar.appendChild(slot);
      return { slot, count };
    });
  }

  function renderHotbar(sim) {
    if (!hotbarEls) buildHotbar(sim);
    HOTBAR.forEach((item, index) => {
      const { slot, count } = hotbarEls[index];
      slot.classList.toggle("selected", sim.selected === index);
      const amount = String(sim.inventory[item] || 0);
      if (count.textContent !== amount) count.textContent = amount;
    });
  }

  function bumpItem(item) {
    const count = ui.hotbar.querySelector(`.slot-count[data-item="${item}"]`);
    if (!count) return;
    count.classList.remove("bump");
    void count.offsetWidth;
    count.classList.add("bump");
  }

  function recipeVisible(sim, recipe) {
    if (recipe.upgrade) return sim.pickLevel < recipe.upgrade;
    if (recipe.blade) return sim.blade < recipe.blade;
    if (recipe.lamp) return sim.lamp < recipe.lamp;
    if (recipe.boots) return !sim.boots;
    return true;
  }

  function renderCraft(sim) {
    if (!ML.sceneRef || !ML.sceneRef.craftOpen) return;

    ui.craftTabs.textContent = "";
    CRAFT_CATS.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "craft-tab" + (craftTab === cat.id ? " active" : "");
      const affordable = RECIPES.filter((r) => r.cat === cat.id && recipeVisible(sim, r) && ML.canAfford(sim.inventory, r.cost)).length;
      btn.textContent = affordable > 0 ? `${cat.label} (${affordable})` : cat.label;
      btn.addEventListener("click", () => {
        craftTab = cat.id;
        ML.audio.play("click");
        renderCraft(sim);
      });
      ui.craftTabs.appendChild(btn);
    });

    ui.inventoryGrid.textContent = "";
    for (const item of Object.keys(ITEM_META)) {
      const amount = sim.inventory[item] || 0;
      if (!amount && !HOTBAR.includes(item)) continue;
      const chip = document.createElement("div");
      chip.className = "inv-chip";
      const icon = document.createElement("i");
      icon.className = "mini-icon " + ITEM_META[item].cls;
      const label = document.createElement("span");
      label.textContent = `${ITEM_META[item].name} ${amount}`;
      chip.append(icon, label);
      ui.inventoryGrid.appendChild(chip);
    }

    ui.recipes.textContent = "";
    RECIPES.filter((r) => r.cat === craftTab && recipeVisible(sim, r)).forEach((recipe) => {
      const btn = document.createElement("button");
      btn.className = "recipe";
      btn.type = "button";
      const ok = ML.canAfford(sim.inventory, recipe.cost);
      btn.disabled = !ok;
      btn.addEventListener("click", () => {
        const result = sim.craft(recipe);
        showToast(result.message);
        ML.audio.play(result.ok ? "craft" : "denied");
        ML.renderAll(sim); // renderAll already re-renders the open drawer
      });

      const text = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = recipe.name;
      const small = document.createElement("small");
      ML.costParts(recipe.cost, sim.inventory).forEach((part, i) => {
        if (i > 0) small.appendChild(document.createTextNode(", "));
        const span = document.createElement("span");
        span.className = part.ok ? "cost-ok" : "cost-short";
        span.textContent = part.label;
        small.appendChild(span);
      });
      small.appendChild(document.createTextNode(`. ${recipe.note}`));
      text.append(strong, small);

      const afford = document.createElement("b");
      afford.textContent = ok ? "Build" : "Need";
      btn.append(text, afford);
      ui.recipes.appendChild(btn);
    });
  }

  function renderAll(sim) {
    const scene = ML.sceneRef;
    renderStatus(sim, scene?.player, scene?.playerLight ? scene.playerLight() : 1);
    renderHotbar(sim);
    renderCraft(sim);
  }

  // ---- Minimap ---------------------------------------------------------------

  // CSS hex colors packed once into ImageData-order uint32 (little-endian ABGR)
  // so the initial 180x300 paint is one putImageData instead of 54k fillRects.
  function packColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0xff << 24) | (b << 16) | (g << 8) | r;
  }
  const MAP_COLORS_U32 = {};
  for (const [tile, hex] of Object.entries(MAP_COLORS)) MAP_COLORS_U32[tile] = packColor(hex);
  const SKY_U32 = packColor("#1b2433");
  const CAVE_U32 = packColor("#11101a");
  const FALLBACK_U32 = packColor("#777a76");

  const minimap = {
    off: null,
    offCtx: null,

    init(sim) {
      this.off = document.createElement("canvas");
      this.off.width = WORLD_W;
      this.off.height = WORLD_H;
      this.offCtx = this.off.getContext("2d");
      const img = this.offCtx.createImageData(WORLD_W, WORLD_H);
      const px = new Uint32Array(img.data.buffer);
      for (let y = 0; y < WORLD_H; y += 1) {
        const row = sim.world[y];
        for (let x = 0; x < WORLD_W; x += 1) {
          const t = row[x];
          px[y * WORLD_W + x] = t === AIR
            ? (y <= (sim.surface[x] || 24) ? SKY_U32 : CAVE_U32)
            : (MAP_COLORS_U32[t] ?? FALLBACK_U32);
        }
      }
      this.offCtx.putImageData(img, 0, 0);
      ui.minimapPanel.classList.toggle("hidden", !minimapOpen);
      this.render(ML.sceneRef);
    },

    paintPixel(sim, x, y) {
      const t = sim.world[y][x];
      if (t === AIR) {
        this.offCtx.fillStyle = y <= (sim.surface[x] || 24) ? "#1b2433" : "#11101a";
      } else {
        this.offCtx.fillStyle = MAP_COLORS[t] || "#777a76";
      }
      this.offCtx.fillRect(x, y, 1, 1);
    },

    paintTile(sim, x, y) {
      if (!this.offCtx) return;
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return;
      this.paintPixel(sim, x, y);
    },

    render(scene) {
      if (!minimapOpen || !this.off || !ui.minimapCanvas) return;
      const ctx = ui.minimapCanvas.getContext("2d");
      ctx.clearRect(0, 0, WORLD_W, WORLD_H);
      ctx.drawImage(this.off, 0, 0);
      if (!scene || !scene.player) return;
      // Enemies as red dots, player as a gold dot.
      for (const enemy of scene.enemies?.getChildren() || []) {
        if (!enemy.active) continue;
        ctx.fillStyle = "#e25555";
        ctx.fillRect(Math.floor(enemy.x / TILE) - 1, Math.floor(enemy.y / TILE) - 1, 2, 2);
      }
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(Math.floor(scene.player.x / TILE) - 1, Math.floor(scene.player.y / TILE) - 1, 3, 3);
    }
  };

  function toggleMinimap(force) {
    minimapOpen = typeof force === "boolean" ? force : !minimapOpen;
    ui.minimapPanel.classList.toggle("hidden", !minimapOpen);
    if (minimapOpen) {
      ML.sceneRef?.toggleCraft(false);
      ML.sceneRef?.toggleHelp(false);
      minimap.render(ML.sceneRef);
    }
  }

  function updateMuteIcon() {
    // Static SVG fragments only — never user input.
    ui.muteIcon.innerHTML = ML.audio.muted
      ? '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>'
      : '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/>';
  }

  function showDeath(sim, cause, day) {
    ui.deathCause.textContent = `${cause} The lift pulled you back up with part of the haul lost.`;
    ui.deathStats.textContent = "";
    const stats = [
      ["Blocks mined", sim.stats.mined],
      ["Deepest", `${sim.stats.deepest} m`],
      ["Kills", sim.stats.enemies],
      ["Days", day]
    ];
    for (const [label, value] of stats) {
      const cell = document.createElement("div");
      cell.className = "death-stat";
      const b = document.createElement("b");
      b.textContent = String(value);
      const span = document.createElement("span");
      span.textContent = label;
      cell.append(b, span);
      ui.deathStats.appendChild(cell);
    }
    ui.deathPanel.classList.remove("hidden");
  }

  function hideDeath() {
    ui.deathPanel.classList.add("hidden");
  }

  function bindUi(scene) {
    if (bindUi.bound) return;
    bindUi.bound = true;
    const activeScene = () => ML.sceneRef || scene;
    const saveActive = () => {
      const active = activeScene();
      if (active.dead) {
        showToast("Cannot save while down — respawn first.");
        return;
      }
      const ok = active.saveGame();
      ML.audio.play("save");
      showToast(ok ? "Saved locally." : "Save failed (storage unavailable).");
    };

    ui.helpToggle.addEventListener("click", () => activeScene().toggleHelp());
    ui.closeHelp.addEventListener("click", () => activeScene().toggleHelp(false));
    ui.craftToggle.addEventListener("click", () => activeScene().toggleCraft());
    ui.closeCraft.addEventListener("click", () => activeScene().toggleCraft(false));
    ui.mapToggle.addEventListener("click", () => toggleMinimap());
    ui.closeMap.addEventListener("click", () => toggleMinimap(false));
    ui.muteToggle.addEventListener("click", () => {
      ML.audio.toggleMuted();
      updateMuteIcon();
      showToast(ML.audio.muted ? "Sound off." : "Sound on.", 900);
    });
    ui.saveBtn.addEventListener("click", saveActive);
    ui.pauseBtn.addEventListener("click", () => {
      const active = activeScene();
      active.setPaused(!active.pausedByUI);
    });
    ui.menuToggle?.addEventListener("click", () => activeScene().setPaused(true));
    ui.closeMenu?.addEventListener("click", () => activeScene().setPaused(false));
    ui.resumeBtn?.addEventListener("click", () => activeScene().setPaused(false));
    ui.menuSaveBtn?.addEventListener("click", saveActive);
    ui.menuRespawnBtn?.addEventListener("click", () => activeScene().restartAtSpawn());
    ui.menuNewWorldBtn?.addEventListener("click", () => activeScene().restartWorld());
    ui.respawnBtn.addEventListener("click", () => activeScene().respawn());
    ui.newWorldBtn.addEventListener("click", () => activeScene().restartWorld());
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("pointerdown", () => ML.audio.unlock(), { once: true });
    document.addEventListener("pointerdown", () => activeScene().focusGameInput?.());
    const restoreAfterFocus = () => {
      const active = ML.sceneRef;
      if (!active) return;
      active.resetInputState?.();
      active.focusGameInput?.();
      if (!active.dead && active.autoPausedByVisibility) {
        active.autoPausedByVisibility = false;
        active.setPaused(false);
      }
    };
    window.addEventListener("blur", () => ML.sceneRef?.resetInputState?.());
    window.addEventListener("focus", restoreAfterFocus);
    document.addEventListener("visibilitychange", () => {
      const active = ML.sceneRef;
      if (!active) return;
      active.resetInputState?.();
      if (document.hidden && !active.dead) {
        active.saveGame();
        if (!active.pausedByUI) {
          active.autoPausedByVisibility = true;
          active.setPaused(true, { silent: true });
        }
      } else {
        restoreAfterFocus();
      }
    });

    document.querySelectorAll("[data-hold]").forEach((btn) => {
      const key = btn.getAttribute("data-hold");
      const set = (value) => {
        mobile[key] = value;
      };
      btn.addEventListener("pointerdown", () => set(true));
      btn.addEventListener("pointerup", () => set(false));
      btn.addEventListener("pointercancel", () => set(false));
      btn.addEventListener("pointerleave", () => set(false));
    });
    document.querySelectorAll("[data-tap]").forEach((btn) => {
      const key = btn.getAttribute("data-tap");
      btn.addEventListener("pointerdown", () => {
        if (key === "jump") mobile.jumpTap = true;
        if (key === "mine") mobile.mineTap = true;
        if (key === "place") mobile.placeTap = true;
        if (key === "attack") mobile.attackTap = true;
      });
    });

    updateMuteIcon();
  }

  Object.assign(ML, {
    ui,
    mobile,
    showToast,
    flashDamage,
    renderStatus,
    renderHotbar,
    bumpItem,
    renderCraft,
    renderAll,
    minimap,
    toggleMinimap,
    showDeath,
    hideDeath,
    bindUi
  });
})();
