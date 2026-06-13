// AbyssForge v2 - DOM HUD: status bars, hotbar, crafting drawer, minimap, toasts.
(() => {
  "use strict";
  const ML = window.ML;
  const { WORLD_W, WORLD_H, AIR, TILE, ITEM_META, HOTBAR, PICKS, BLADES, LAMPS, RECIPES, CRAFT_CATS, CAMP_SERVICES, ACHIEVEMENTS, MAP_COLORS, clamp } = ML;

  const ui = {
    hud: document.getElementById("hud"),
    healthText: document.getElementById("healthText"),
    healthBar: document.getElementById("healthBar"),
    energyText: document.getElementById("energyText"),
    energyBar: document.getElementById("energyBar"),
    depthText: document.getElementById("depthText"),
    depthBar: document.getElementById("depthBar"),
    lightText: document.getElementById("lightText"),
    lightBar: document.getElementById("lightBar"),
    shadowText: document.getElementById("shadowText"),
    shadowBar: document.getElementById("shadowBar"),
    worldLabel: document.getElementById("worldLabel"),
    pickHudText: document.getElementById("pickHudText"),
    pickTierText: document.getElementById("pickTierText"),
    pickText: document.getElementById("pickText"),
    damageText: document.getElementById("damageText"),
    gearText: document.getElementById("gearText"),
    actionText: document.getElementById("actionText"),
    targetText: document.getElementById("targetText"),
    recallText: document.getElementById("recallText"),
    contractTitle: document.getElementById("contractTitle"),
    contractText: document.getElementById("contractText"),
    contractBar: document.getElementById("contractBar"),
    contractReward: document.getElementById("contractReward"),
    biomePanel: document.querySelector(".biome-panel"),
    biomeName: document.getElementById("biomeName"),
    biomeEffects: document.getElementById("biomeEffects"),
    biomeLore: document.getElementById("biomeLore"),
    mysteryPanel: document.getElementById("mysteryPanel"),
    mysteryTitle: document.getElementById("mysteryTitle"),
    mysteryBar: document.getElementById("mysteryBar"),
    mysteryText: document.getElementById("mysteryText"),
    mysteryNote: document.getElementById("mysteryNote"),
    hotbar: document.getElementById("hotbar"),
    helpDrawer: document.getElementById("helpDrawer"),
    campDrawer: document.getElementById("campDrawer"),
    campServices: document.getElementById("campServices"),
    campStatus: document.getElementById("campStatus"),
    craftDrawer: document.getElementById("craftDrawer"),
    craftTabs: document.getElementById("craftTabs"),
    inventoryGrid: document.getElementById("inventoryGrid"),
    recipes: document.getElementById("recipes"),
    packDrawer: document.getElementById("packDrawer"),
    packGrid: document.getElementById("packGrid"),
    packSummary: document.getElementById("packSummary"),
    packFill: document.getElementById("packFill"),
    packHint: document.getElementById("packHint"),
    helpToggle: document.getElementById("helpToggle"),
    campToggle: document.getElementById("campToggle"),
    closeCamp: document.getElementById("closeCamp"),
    closeHelp: document.getElementById("closeHelp"),
    craftToggle: document.getElementById("craftToggle"),
    craftBadge: document.getElementById("craftBadge"),
    craftReady: document.getElementById("craftReady"),
    craftReadyText: document.getElementById("craftReadyText"),
    closeCraft: document.getElementById("closeCraft"),
    packToggle: document.getElementById("packToggle"),
    closePack: document.getElementById("closePack"),
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
    eventChip: document.getElementById("eventChip"),
    eventName: document.getElementById("eventName"),
    eventTimer: document.getElementById("eventTimer"),
    eventNote: document.getElementById("eventNote"),
    bossBar: document.getElementById("bossBar"),
    bossName: document.getElementById("bossName"),
    bossHp: document.getElementById("bossHp"),
    bossFill: document.getElementById("bossFill"),
    minimapPanel: document.getElementById("minimapPanel"),
    minimapCanvas: document.getElementById("minimapCanvas"),
    closeMap: document.getElementById("closeMap"),
    deathPanel: document.getElementById("deathPanel"),
    deathCause: document.getElementById("deathCause"),
    deathStats: document.getElementById("deathStats"),
    respawnBtn: document.getElementById("respawnBtn"),
    newWorldBtn: document.getElementById("newWorldBtn"),
    damageFlash: document.getElementById("damageFlash"),
    interactPrompt: document.getElementById("interactPrompt"),
    interactKey: document.getElementById("interactKey"),
    interactAction: document.getElementById("interactAction"),
    interactName: document.getElementById("interactName"),
    interactHint: document.getElementById("interactHint"),
    achievementToast: document.getElementById("achievementToast"),
    achievementToastName: document.getElementById("achievementToastName"),
    achievementToastNote: document.getElementById("achievementToastNote"),
    achievementProgress: document.getElementById("achievementProgress"),
    achievementList: document.getElementById("achievementList"),
    storyProgress: document.getElementById("storyProgress"),
    storyList: document.getElementById("storyList"),
    perfChip: document.getElementById("perfChip"),
    fpsText: document.getElementById("fpsText"),
    frameText: document.getElementById("frameText"),
    perfMetaText: document.getElementById("perfMetaText")
  };

  const mobile = { left: false, right: false, jumpTap: false, mineTap: false, placeTap: false, attackTap: false };

  let toastTimer = 0;
  let craftTab = "tools";
  let minimapOpen = false;
  let lastFlashAt = 0;
  let hotbarEls = null;
  let lastCraftableIds = null;
  let craftReadyTimer = 0;
  let achievementTimer = 0;
  let achievementQueue = [];
  let achievementShowing = false;
  const renderCache = {
    biome: "",
    contract: "",
    event: "",
    boss: "",
    recall: "",
    interaction: "",
    craftReady: "",
    craft: "",
    camp: "",
    pack: "",
    mystery: "",
    story: "",
    achievements: ""
  };
  const perfState = {
    lastAt: 0,
    frames: 0,
    frameSum: 0,
    worstFrame: 0,
    samples: 0
  };

  const ITEM_KIND = {
    dirt: "Terrain",
    stone: "Terrain",
    wood: "Build",
    torch: "Light",
    battery: "Cell",
    ladder: "Route",
    platform: "Route",
    charge: "Blast",
    mushroom: "Use",
    kit: "Use",
    coal: "Fuel",
    copper: "Ore",
    iron: "Ore",
    gold: "Rare",
    crystal: "Rare",
    obsidian: "Abyss",
    amber: "Resin",
    quartz: "Focus",
    ember: "Heat",
    voidglass: "Abyss",
    gel: "Drop",
    coin: "Trade",
    silk: "Boss",
    fang: "Boss",
    relic: "Relic",
    core: "Core",
    mapScrap: "Cache",
    clockwork: "Odd",
    mirrorShard: "Odd",
    strangeKey: "Odd"
  };

  const RARE_ITEMS = new Set(["gold", "crystal", "obsidian", "voidglass", "silk", "fang", "relic", "core", "clockwork", "mirrorShard", "strangeKey"]);
  const VOLATILE_ITEMS = new Set(["charge", "core", "ember"]);

  function setText(el, value) {
    if (!el) return;
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }

  function setTitle(el, value) {
    if (!el) return;
    const text = String(value);
    if (el.title !== text) el.title = text;
  }

  function setWidth(el, value) {
    if (!el) return;
    const width = typeof value === "number" ? `${value}%` : String(value);
    if (el.style.width !== width) el.style.width = width;
  }

  function setClass(el, cls, on) {
    if (!el) return;
    if (el.classList.contains(cls) !== Boolean(on)) el.classList.toggle(cls, Boolean(on));
  }

  function inventorySignature(sim, options = {}) {
    const keys = inventoryItemKeys(sim, options);
    const knownSig = ML.Progression?.signature ? ML.Progression.signature(sim) : "";
    return `${knownSig}|${keys.map((item) => `${item}:${sim.inventory[item] || 0}`).join("|")}`;
  }

  function recipeStateSignature(sim) {
    return [
      inventorySignature(sim, { includeEmpty: true }),
      sim.pickLevel,
      sim.blade,
      sim.lamp,
      sim.boots ? 1 : 0,
      sim.ward ? 1 : 0,
      sim.fallGuard ? 1 : 0,
      sim.noiseMuffle ? 1 : 0,
      sim.speedBoost ? 1 : 0,
      sim.regenBoost ? 1 : 0,
      sim.treasureSense ? 1 : 0,
      sim.lootBonus ? 1 : 0,
      sim.recallCharm ? 1 : 0,
      sim.maxHealth || 100,
      sim.maxEnergy || 100,
      sim.blastRadius || 0,
      ML.Progression?.signature ? ML.Progression.signature(sim) : ""
    ].join("|");
  }

  function itemAccent(item) {
    const tint = ITEM_META[item]?.tint;
    return typeof tint === "number" ? `#${tint.toString(16).padStart(6, "0")}` : "#e1a84d";
  }

  function itemStateClass(item, amount) {
    const parts = [`item-${item}`];
    if (ITEM_META[item]?.tile !== undefined) parts.push("placeable");
    if (ITEM_META[item]?.consumable) parts.push("usable");
    if (RARE_ITEMS.has(item)) parts.push("rare");
    if (VOLATILE_ITEMS.has(item)) parts.push("volatile");
    parts.push(amount > 0 ? "has-items" : "empty");
    return parts.join(" ");
  }

  function setItemIcon(el, baseClass, item, known = true) {
    if (!el) return;
    const assetUrl = known ? ML.ExternalAssets?.itemCssUrl?.(item) || "" : "";
    const cls = known
      ? `${baseClass} ${ITEM_META[item].cls}${assetUrl ? " asset-icon" : ""}`
      : `${baseClass} icon-unknown`;
    if (el.className !== cls) el.className = cls;
    if (assetUrl) {
      el.style.setProperty("--asset-icon-url", `url("${assetUrl}")`);
    } else {
      el.style.removeProperty("--asset-icon-url");
    }
  }

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
    const scene = ML.sceneRef;
    const maxHealth = sim.maxHealth || 100;
    const maxEnergy = sim.maxEnergy || 100;
    const healthPct = clamp(sim.health / maxHealth, 0, 1);
    const energyPct = clamp(sim.energy / maxEnergy, 0, 1);
    setText(ui.healthText, maxHealth > 100 ? `${Math.round(sim.health)}/${maxHealth}` : Math.round(sim.health));
    setWidth(ui.healthBar, healthPct * 100);
    setText(ui.energyText, maxEnergy > 100 ? `${Math.round(sim.energy)}/${maxEnergy}` : Math.round(sim.energy));
    setWidth(ui.energyBar, energyPct * 100);
    const px = player ? player.x : sim.player.x;
    const py = player ? player.y : sim.player.y;
    const width = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
    const tileX = clamp(Math.floor(px / TILE), 0, width - 1);
    const depth = Math.max(0, Math.floor(py / TILE - (sim.surface[tileX] || 24)));
    setText(ui.depthText, `${depth} m`);
    const depthCap = Math.max(230, (sim.worldHeight?.() || WORLD_H) - 32);
    setWidth(ui.depthBar, clamp(depth / depthCap * 100, 0, 100));
    const lampPct = Math.round((sim.lampChargeRatio?.() ?? 0) * 100);
    const lightState = light > 0.7 ? "Clear" : light > 0.35 ? "Dim" : "Dark";
    setText(ui.lightText, `${lightState} · ${lampPct}%`);
    setWidth(ui.lightBar, Math.round(light * 100));
    const shadow = clamp(scene?.shadowPressure ?? sim.shadowPressure ?? 0, 0, 100);
    if (ui.shadowText && ui.shadowBar) {
      setText(ui.shadowText, shadow > 76 ? "Watched" : shadow > 48 ? "Rising" : shadow > 14 ? "Whisper" : "Still");
      setWidth(ui.shadowBar, Math.round(shadow));
    }
    const day = scene ? scene.dayNumber() : 1;
    const phase = scene ? scene.phaseName() : "Day";
    const biome = scene?.currentBiome ? scene.currentBiome() : ML.BiomeSystem?.current?.(sim, { x: px, y: py });
    const stratum = scene?.currentStratum ? scene.currentStratum() : sim.stratumAt?.(tileX, Math.floor(py / TILE));
    const zoneLabel = stratum?.name || biome?.name || "Surface";
    setText(ui.worldLabel, `Day ${day} · ${phase} · ${zoneLabel}`);
    setTitle(ui.worldLabel, `Seed ${sim.seed}${biome?.name ? ` · ${biome.name}` : ""}${stratum?.name ? ` · ${stratum.name}` : ""}`);
    renderBiome(biome, stratum);
    const pickName = PICKS[sim.pickLevel]?.name || "Pickaxe";
    setText(ui.pickText, pickName);
    setText(ui.pickHudText, pickName);
    setText(ui.pickTierText, `Tier ${sim.pickLevel}`);
    setText(ui.damageText, `${sim.attackDamage()} · ${BLADES[sim.blade].name}`);
    const cells = sim.inventory?.battery || 0;
    const lampMode = scene?.lampStandby ? "standby" : scene?.lampDemand > 1.05 ? "draw" : "active";
    const gear = [`${LAMPS[sim.lamp].name} ${lampPct}% ${lampMode}`];
    gear.push(`${cells} cell${cells === 1 ? "" : "s"}`);
    if (sim.boots) gear.push("Cave boots");
    if (sim.speedBoost) gear.push("Greaves");
    if (sim.cellEfficiency) gear.push("Regulator");
    if (sim.fallGuard) gear.push("Soles");
    if (sim.noiseMuffle) gear.push("Echo padding");
    if (sim.ward) gear.push("Ward");
    if (sim.recallCharm) gear.push("Recall");
    setText(ui.gearText, gear.join(" · "));
    setText(ui.actionText, scene?.currentAction || "Explore");
    setText(ui.targetText, scene?.targetLabel || "None");
    setClass(ui.campToggle, "camp-ready", Boolean(scene?.nearCamp?.()));
    if (ui.hud) {
      const cssVars = {
        "--health-pct": healthPct.toFixed(3),
        "--energy-pct": energyPct.toFixed(3),
        "--light-pct": clamp(light, 0, 1).toFixed(3),
        "--shadow-pct": (shadow / 100).toFixed(3)
      };
      for (const [name, value] of Object.entries(cssVars)) {
        if (ui.hud.style.getPropertyValue(name) !== value) ui.hud.style.setProperty(name, value);
      }
      setClass(ui.hud, "low-health", healthPct < 0.34);
      setClass(ui.hud, "low-energy", energyPct < 0.28);
      setClass(ui.hud, "low-light", light < 0.34);
      setClass(ui.hud, "shadow-warning", shadow > 48);
      setClass(ui.hud, "near-camp", Boolean(scene?.nearCamp?.()));
      setClass(ui.hud, "event-active", Boolean(scene?.caveEvent));
      setClass(ui.hud, "boss-active", Boolean(scene?.activeBoss?.()));
    }
    setClass(ui.healthBar.closest(".stat"), "warning", healthPct < 0.34);
    setClass(ui.energyBar.closest(".stat"), "warning", energyPct < 0.28);
    setClass(ui.lightBar.closest(".stat"), "warning", light < 0.34);
    setClass(ui.shadowBar?.closest(".stat"), "warning", shadow > 48);
  }

  function updatePerformance(scene = ML.sceneRef, delta = 0) {
    if (!ui.perfChip || !ui.fpsText || !ui.frameText) return;
    const now = performance.now();
    if (!perfState.lastAt) perfState.lastAt = now;
    perfState.frames += 1;
    perfState.frameSum += delta;
    perfState.worstFrame = Math.max(perfState.worstFrame, delta);
    const elapsed = now - perfState.lastAt;
    if (elapsed < 700) return;

    const fps = perfState.frames * 1000 / Math.max(1, elapsed);
    const avgFrame = perfState.frameSum / Math.max(1, perfState.frames);
    const worstFrame = perfState.worstFrame;
    const hudNodes = ui.hud ? ui.hud.getElementsByTagName("*").length : 0;
    const enemies = scene?.enemies?.countActive ? scene.enemies.countActive(true) : 0;
    const rows = scene?.sim?.worldHeight?.() || scene?.sim?.world?.length || WORLD_H;
    const status = fps < 30 || avgFrame > 34 ? "bad" : fps < 45 || avgFrame > 24 ? "warn" : "good";

    setText(ui.fpsText, Math.round(fps));
    setText(ui.frameText, `${avgFrame.toFixed(1)} ms`);
    setText(ui.perfMetaText, `${rows} rows · ${enemies} mobs`);
    setClass(ui.perfChip, "perf-good", status === "good");
    setClass(ui.perfChip, "perf-warn", status === "warn");
    setClass(ui.perfChip, "perf-bad", status === "bad");

    perfState.samples += 1;
    ML.performanceSnapshot = {
      fps,
      avgFrame,
      worstFrame,
      hudNodes,
      enemies,
      rows,
      status,
      samples: perfState.samples
    };

    perfState.lastAt = now;
    perfState.frames = 0;
    perfState.frameSum = 0;
    perfState.worstFrame = 0;
  }

  function renderBiome(biome, stratum = null) {
    if (!ui.biomePanel || !biome || !ui.biomeName || !ui.biomeEffects || !ui.biomeLore) return;
    const biomeEffects = ML.BiomeSystem?.effectText?.(biome) || biome.tone || "";
    const effects = stratum?.tone ? `${biomeEffects} · ${stratum.tone}` : biomeEffects;
    const lore = stratum?.note ? `${biome.lore || ""} ${stratum.note}`.trim() : (biome.lore || "");
    const accent = biome.accent || "";
    const sig = `${biome.id || biome.name}|${stratum?.id || ""}|${effects}|${lore}|${accent}`;
    if (renderCache.biome === sig) return;
    renderCache.biome = sig;
    setText(ui.biomeName, biome.name);
    setText(ui.biomeEffects, effects);
    setText(ui.biomeLore, lore);
    if (ui.biomePanel.style.borderColor !== accent) ui.biomePanel.style.borderColor = accent;
    const shadow = `0 0 0 1px ${accent || "rgba(236, 205, 135, 0.24)"}22, 0 12px 32px var(--shadow)`;
    if (ui.biomePanel.style.boxShadow !== shadow) ui.biomePanel.style.boxShadow = shadow;
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
      slot.dataset.item = item;
      slot.style.setProperty("--item-accent", itemAccent(item));
      slot.addEventListener("click", () => {
        sim.selected = index;
        ML.audio.play("click");
        renderHotbar(sim);
      });

      const key = document.createElement("span");
      key.className = "slot-key";
      key.textContent = String(index + 1);

      const icon = document.createElement("i");
      setItemIcon(icon, "slot-icon", item, true);

      const count = document.createElement("span");
      count.className = "slot-count";
      count.dataset.item = item;

      const type = document.createElement("span");
      type.className = "slot-type";
      type.textContent = ITEM_KIND[item] || "Item";

      slot.append(key, icon, type, count);
      let use = null;
      if (ITEM_META[item].consumable) {
        use = document.createElement("span");
        use.className = "slot-use";
        use.textContent = "USE";
        slot.appendChild(use);
      }
      ui.hotbar.appendChild(slot);
      return { slot, icon, type, count, use };
    });
  }

  function renderHotbar(sim) {
    if (!hotbarEls) buildHotbar(sim);
    HOTBAR.forEach((item, index) => {
      const { slot, icon, type, count, use } = hotbarEls[index];
      const known = ML.Progression?.isItemKnown ? ML.Progression.isItemKnown(sim, item) : true;
      const amount = known ? sim.inventory[item] || 0 : 0;
      const cls = known ? `slot ${itemStateClass(item, amount)}` : "slot undiscovered locked";
      if (slot.className !== cls) slot.className = cls;
      slot.style.setProperty("--item-accent", known ? itemAccent(item) : "#746f62");
      setTitle(slot, known ? `${ITEM_META[item].name}: ${amount}` : `Slot ${index + 1}: undiscovered`);
      setItemIcon(icon, "slot-icon", item, known);
      setText(type, known ? (ITEM_KIND[item] || "Item") : "Locked");
      setClass(slot, "selected", sim.selected === index);
      const label = known ? String(amount) : "";
      if (count.textContent !== label) count.textContent = label;
      setClass(count, "zero", known && amount <= 0);
      setClass(use, "hidden", !known || !ITEM_META[item].consumable);
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
    if (ML.Progression?.recipeVisible && !ML.Progression.recipeVisible(sim, recipe)) return false;
    if (recipe.upgrade) return sim.pickLevel < recipe.upgrade;
    if (recipe.blade) return sim.blade < recipe.blade;
    if (recipe.lamp) return sim.lamp < recipe.lamp;
    if (recipe.boots) return !sim.boots;
    if (recipe.ward) return !sim.ward;
    if (recipe.fallGuard) return !sim.fallGuard;
    if (recipe.noiseMuffle) return !sim.noiseMuffle;
    if (recipe.speedBoost) return !sim.speedBoost;
    if (recipe.cellEfficiency) return !sim.cellEfficiency;
    if (recipe.regenBoost) return !sim.regenBoost;
    if (recipe.treasureSense) return !sim.treasureSense;
    if (recipe.lootBonus) return !sim.lootBonus;
    if (recipe.recallCharm) return !sim.recallCharm;
    if (recipe.maxHealth) return (sim.maxHealth || 100) < recipe.maxHealth;
    if (recipe.maxEnergy) return (sim.maxEnergy || 100) < recipe.maxEnergy;
    if (recipe.blastRadius) return (sim.blastRadius || 0) < recipe.blastRadius;
    return true;
  }

  function craftableRecipes(sim) {
    return RECIPES.filter((recipe) => recipeVisible(sim, recipe) && ML.canAfford(sim.inventory, recipe.cost));
  }

  function updateCraftReady(sim) {
    const sig = recipeStateSignature(sim);
    if (renderCache.craftReady === sig) return;
    renderCache.craftReady = sig;
    const ready = craftableRecipes(sim);
    const ids = new Set(ready.map((recipe) => recipe.id));
    const count = ready.length;
    setClass(ui.craftToggle, "has-ready", count > 0);
    if (ui.craftBadge) {
      setText(ui.craftBadge, Math.min(count, 99));
      setClass(ui.craftBadge, "hidden", count === 0);
    }

    if (lastCraftableIds) {
      const newlyReady = ready.filter((recipe) => !lastCraftableIds.has(recipe.id));
      if (newlyReady.length && !ML.sceneRef?.craftOpen) {
        const first = newlyReady[0];
        showCraftReady(newlyReady.length === 1 ? first.name : `${newlyReady.length} new recipes ready`);
      }
    }
    lastCraftableIds = ids;
  }

  function showCraftReady(label) {
    if (!ui.craftReady || !ui.craftReadyText) return;
    ui.craftReadyText.textContent = label;
    ui.craftReady.classList.remove("hidden");
    requestAnimationFrame(() => ui.craftReady.classList.add("visible"));
    clearTimeout(craftReadyTimer);
    craftReadyTimer = setTimeout(() => {
      ui.craftReady.classList.remove("visible");
      setTimeout(() => ui.craftReady.classList.add("hidden"), 180);
    }, 3400);
  }

  function rewardText(reward) {
    const parts = [];
    for (const [item, count] of Object.entries(reward || {})) {
      if (!count) continue;
      parts.push(`${ITEM_META[item]?.name || item} +${count}`);
    }
    return parts.length ? parts.join(", ") : "No reward";
  }

  function renderContract(sim) {
    if (!ui.contractTitle || !sim?.contractProgress) return;
    const state = sim.contractProgress();
    if (!state) {
      if (renderCache.contract === "none") return;
      renderCache.contract = "none";
      setText(ui.contractTitle, "No contract");
      setText(ui.contractText, "Explore");
      setText(ui.contractReward, "");
      setWidth(ui.contractBar, 0);
      return;
    }
    const { contract, progress, target, done } = state;
    const unit = contract.unit || "done";
    const reward = done ? "Ready to claim" : rewardText(contract.reward);
    const width = clamp(progress / target * 100, 0, 100);
    const sig = `${contract.id}|${progress}|${target}|${done}|${reward}`;
    if (renderCache.contract === sig) return;
    renderCache.contract = sig;
    setText(ui.contractTitle, contract.name);
    setText(ui.contractText, `${contract.label}: ${progress}/${target} ${unit}`);
    setText(ui.contractReward, reward);
    setWidth(ui.contractBar, width);
    setClass(ui.contractTitle.closest(".objective-panel"), "complete", done);
  }

  function renderEvent(scene = ML.sceneRef) {
    if (!ui.eventChip) return;
    const event = scene?.caveEvent;
    if (!event) {
      if (renderCache.event !== "none") {
        renderCache.event = "none";
        ui.eventChip.classList.add("hidden");
      }
      return;
    }
    const seconds = Math.max(0, Math.ceil((event.until - scene.time.now) / 1000));
    const sig = `${event.id}|${event.name}|${event.note}|${seconds}`;
    if (renderCache.event === sig) return;
    renderCache.event = sig;
    setText(ui.eventName, event.name);
    setText(ui.eventTimer, `${seconds}s`);
    setText(ui.eventNote, event.note);
    ui.eventChip.classList.remove("hidden");
  }

  function renderBossBar(scene = ML.sceneRef) {
    if (!ui.bossBar) return;
    const boss = scene?.activeBoss ? scene.activeBoss() : null;
    if (!boss) {
      if (renderCache.boss !== "none") {
        renderCache.boss = "none";
        ui.bossBar.classList.add("hidden");
      }
      return;
    }
    const hp = clamp((boss.hp || 0) / Math.max(1, boss.maxHp || 1), 0, 1);
    const name = scene.enemyName ? scene.enemyName(boss.kind, boss) : "Boss";
    const sig = `${boss.mobId || boss.kind}|${name}|${Math.ceil(hp * 100)}`;
    if (renderCache.boss === sig) return;
    renderCache.boss = sig;
    setText(ui.bossName, name);
    setText(ui.bossHp, `${Math.ceil(hp * 100)}%`);
    setWidth(ui.bossFill, hp * 100);
    ui.bossBar.classList.remove("hidden");
  }

  function renderRecall(scene = ML.sceneRef) {
    if (!ui.recallText) return;
    const remaining = scene?.recallCooldownRemaining ? scene.recallCooldownRemaining() : 0;
    const cost = scene?.recallCost ? scene.recallCost() : 0;
    const anchor = scene?.sim ? ML.CampSystem.activeCamp(scene.sim) : null;
    const anchorText = scene?.sim ? ML.CampSystem.campLabel(scene.sim, anchor) : "camp";
    const label = remaining > 0 ? `${remaining}s` : "R";
    const title = remaining > 0 ? `Recall recharging: ${remaining}s` : `Recall to ${anchorText} campfire: ${cost} energy`;
    const sig = `${label}|${title}`;
    if (renderCache.recall === sig) return;
    renderCache.recall = sig;
    setText(ui.recallText, label);
    setTitle(ui.recallText, title);
    setClass(ui.recallText.closest(".action-chip"), "disabled", remaining > 0);
  }

  function renderInteraction(scene = ML.sceneRef) {
    if (!ui.interactPrompt) return;
    const target = (!scene?.pausedByUI && !scene?.dead && !scene?.craftOpen && !scene?.campOpen && !scene?.helpOpen && !scene?.packOpen)
      ? scene.interactionTarget?.()
      : null;
    if (!target) {
      if (renderCache.interaction !== "none") {
        renderCache.interaction = "none";
        ui.interactPrompt.classList.add("hidden");
      }
      return;
    }
    const key = target.key || "E";
    const action = target.action || "Use";
    const name = target.name || "Object";
    const hint = target.hint || "Nearby";
    const title = `${key}: ${action} ${target.name || "object"}`;
    const sig = `${key}|${action}|${name}|${hint}|${target.x ?? ""}|${target.y ?? ""}`;
    if (renderCache.interaction === sig) return;
    renderCache.interaction = sig;
    ui.interactPrompt.classList.remove("hidden");
    setText(ui.interactKey, key);
    setText(ui.interactAction, action);
    setText(ui.interactName, name);
    setText(ui.interactHint, hint);
    setTitle(ui.interactPrompt, title);
  }

  function inventoryItemKeys(sim, options = {}) {
    if (ML.Progression?.inventoryItems) return ML.Progression.inventoryItems(sim, options);
    const includeEmpty = Boolean(options.includeEmpty);
    const includeHotbarEmpty = Boolean(options.includeHotbarEmpty);
    return Object.keys(ITEM_META).filter((item) =>
      includeEmpty || (sim.inventory[item] || 0) > 0 || (includeHotbarEmpty && HOTBAR.includes(item))
    );
  }

  function buildInventoryChip(item, amount) {
    const chip = document.createElement("div");
    chip.className = `inv-chip ${itemStateClass(item, amount)}`;
    chip.style.setProperty("--item-accent", itemAccent(item));
    const icon = document.createElement("i");
    setItemIcon(icon, "mini-icon", item, true);
    const label = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = ITEM_META[item].name;
    const kind = document.createElement("small");
    kind.textContent = ITEM_KIND[item] || "Item";
    label.append(name, kind);
    const qty = document.createElement("b");
    qty.textContent = `x${amount}`;
    chip.append(icon, label, qty);
    return chip;
  }

  function renderInventoryGrid(container, sim, options = {}) {
    if (!container) return;
    container.textContent = "";
    for (const item of inventoryItemKeys(sim, options)) {
      container.appendChild(buildInventoryChip(item, sim.inventory[item] || 0));
    }
  }

  function renderPack(sim) {
    const scene = ML.sceneRef;
    if (!scene || !scene.packOpen || !ui.packGrid) return;
    const keys = inventoryItemKeys(sim, { includeEmpty: true });
    const used = keys.filter((item) => (sim.inventory[item] || 0) > 0).length;
    const total = Math.max(1, keys.length);
    const itemCount = keys.reduce((sum, item) => sum + (sim.inventory[item] || 0), 0);
    const selected = HOTBAR[sim.selected] || HOTBAR[0];
    const sig = `${used}|${total}|${itemCount}|${sim.selected}|${inventorySignature(sim, { includeEmpty: true })}`;
    if (renderCache.pack === sig) return;
    renderCache.pack = sig;
    renderInventoryGrid(ui.packGrid, sim, { includeEmpty: true });
    setText(ui.packSummary, `${used}/${total} known stacks · ${itemCount} items`);
    setWidth(ui.packFill, Math.round(used / total * 100));
    if (ui.packHint) {
      const selectedKnown = ML.Progression?.isItemKnown ? ML.Progression.isItemKnown(sim, selected) : true;
      const selectedName = selectedKnown ? ITEM_META[selected]?.name || selected : "undiscovered slot";
      setText(ui.packHint, `Quick belt: ${selectedName}. New materials and tools appear here after the mine teaches them.`);
    }
  }

  function renderCraft(sim) {
    if (!ML.sceneRef || !ML.sceneRef.craftOpen) return;
    const sig = `${craftTab}|${recipeStateSignature(sim)}`;
    if (renderCache.craft === sig) return;
    renderCache.craft = sig;

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

    renderInventoryGrid(ui.inventoryGrid, sim, { includeHotbarEmpty: true });

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
        if (result.ok) {
          renderCache.craft = "";
          renderCache.craftReady = "";
          renderCache.pack = "";
          ML.sceneRef?.checkContract?.();
          ML.sceneRef?.checkLore?.("craft", { recipe });
          ML.sceneRef?.checkAchievements?.();
        }
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

  function campServiceSummary(service) {
    return ML.CampSystem.serviceSummary(service) || rewardText(service.out);
  }

  function renderCamp(sim) {
    const scene = ML.sceneRef;
    if (!scene || !ui.campServices || !scene.campOpen) return;
    const near = scene.nearCamp ? scene.nearCamp() : false;
    const nearby = ML.CampSystem.nearestCampfire(sim, scene.player);
    const anchor = ML.CampSystem.activeCamp(sim);
    const campLabel = ML.CampSystem.campLabel(sim, anchor);
    const sig = `${near ? 1 : 0}|${campLabel}|${nearby?.x ?? ""}:${nearby?.y ?? ""}|${inventorySignature(sim, { includeEmpty: true })}`;
    if (renderCache.camp === sig) return;
    renderCache.camp = sig;
    setText(ui.campStatus, near
      ? `Campfire ready · anchor ${campLabel}`
      : `Find a campfire · anchor ${campLabel}`);
    ui.campServices.textContent = "";
    CAMP_SERVICES.forEach((service) => {
      const ok = near && ML.canAfford(sim.inventory, service.cost || {});
      const btn = document.createElement("button");
      btn.className = "camp-service";
      btn.type = "button";
      btn.disabled = !ok;
      btn.addEventListener("click", () => scene.useCampService(service.id));

      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = service.name;
      const small = document.createElement("small");
      const cost = ML.costParts(service.cost || {}, sim.inventory);
      if (cost.length) {
        cost.forEach((part, index) => {
          if (index > 0) small.appendChild(document.createTextNode(", "));
          const span = document.createElement("span");
          span.className = part.ok ? "cost-ok" : "cost-short";
          span.textContent = part.label;
          small.appendChild(span);
        });
        small.appendChild(document.createTextNode(`. ${campServiceSummary(service)} ${service.note}`));
      } else {
        small.textContent = `${campServiceSummary(service)} ${service.note}`;
      }
      copy.append(name, small);

      const action = document.createElement("b");
      action.textContent = near ? service.action : "Away";
      btn.append(copy, action);
      if (nearby && anchor && ML.CampSystem.sameCamp(nearby, anchor)) btn.classList.add("anchored");
      ui.campServices.appendChild(btn);
    });
  }

  function renderMystery(sim) {
    if (!ui.mysteryPanel || !ML.LoreSystem) return;
    const intel = ML.LoreSystem.intel(sim);
    if (!intel.awakened) {
      if (renderCache.mystery !== "hidden") {
        renderCache.mystery = "hidden";
        ui.mysteryPanel.classList.add("hidden");
      }
      return;
    }
    const goal = intel.goal;
    const progress = intel.goalProgress;
    const title = intel.done ? "Forge truth assembled" : goal?.title || "Field notes";
    const text = progress
      ? `${progress.current}/${progress.target} ${progress.unit}`
      : `${intel.noteCount}/${intel.totalNotes} notes`;
    const note = intel.done
      ? "The mine was built to survive a collapse, not to feed the guild."
      : (goal?.hint || intel.last?.body || "The contracts are not the whole story.");
    const width = Math.round((progress?.ratio || 0) * 100);
    const sig = `${title}|${text}|${note}|${width}|${intel.done ? 1 : 0}`;
    if (renderCache.mystery === sig) return;
    renderCache.mystery = sig;
    ui.mysteryPanel.classList.remove("hidden");
    setText(ui.mysteryTitle, title);
    setText(ui.mysteryText, text);
    setText(ui.mysteryNote, note);
    setWidth(ui.mysteryBar, width);
    setClass(ui.mysteryPanel, "complete", Boolean(intel.done));
  }

  function renderStory(sim) {
    if (!ui.storyList || !ui.storyProgress || !ML.LoreSystem) return;
    const intel = ML.LoreSystem.intel(sim);
    const knownSig = ML.LORE_NOTES.map((entry) => sim.lore?.notes?.[entry.id] ? "1" : "0").join("");
    const sig = `${intel.awakened ? 1 : 0}|${intel.noteCount}|${intel.totalNotes}|${knownSig}`;
    if (renderCache.story === sig) return;
    renderCache.story = sig;
    setText(ui.storyProgress, `${intel.noteCount}/${intel.totalNotes}`);
    ui.storyList.textContent = "";

    if (!intel.awakened) {
      const row = document.createElement("div");
      row.className = "story-row locked";
      const title = document.createElement("b");
      title.textContent = "No field notes decoded";
      const note = document.createElement("p");
      note.textContent = "Mine deeper, open strange caches, and watch for places where the contracts stop making sense.";
      row.append(title, note);
      ui.storyList.appendChild(row);
      return;
    }

    ML.LORE_NOTES.forEach((entry) => {
      const known = Boolean(sim.lore?.notes?.[entry.id]);
      const row = document.createElement("div");
      row.className = "story-row " + (known ? "unlocked" : "locked");
      const title = document.createElement("b");
      title.textContent = known ? entry.title : "Unread field note";
      const tag = document.createElement("small");
      tag.textContent = known ? entry.tag : "Hidden";
      const body = document.createElement("p");
      body.textContent = known ? entry.body : "Keep exploring the depths, caches, bosses, and old wayfires.";
      row.append(title, tag, body);
      ui.storyList.appendChild(row);
    });
  }

  function resetRenderCache() {
    Object.keys(renderCache).forEach((key) => {
      renderCache[key] = "";
    });
    lastCraftableIds = null;
  }

  function renderAll(sim, options = {}) {
    if (options.force) resetRenderCache();
    const scene = ML.sceneRef;
    renderStatus(sim, scene?.player, scene?.playerLight ? scene.playerLight() : 1);
    renderHotbar(sim);
    renderContract(sim);
    renderEvent(scene);
    renderBossBar(scene);
    renderRecall(scene);
    renderInteraction(scene);
    updateCraftReady(sim);
    renderAchievements(sim);
    renderMystery(sim);
    renderStory(sim);
    renderCamp(sim);
    renderCraft(sim);
    renderPack(sim);
  }

  function achievementMet(sim, achievement) {
    if (achievement.stat) return (sim.stats?.[achievement.stat] || 0) >= achievement.at;
    if (achievement.item) return (sim.inventory?.[achievement.item] || 0) >= achievement.at;
    if (achievement.prop) return (sim[achievement.prop] || 0) >= achievement.at;
    if (achievement.flag) return Boolean(sim[achievement.flag]);
    if (achievement.loreNotes) return (ML.LoreSystem?.knownNotes?.(sim).length || 0) >= achievement.loreNotes;
    if (achievement.loreGoal) return Boolean(sim.lore?.completedGoals?.[achievement.loreGoal]);
    return false;
  }

  function renderAchievements(sim) {
    if (!ui.achievementList || !ui.achievementProgress) return;
    const unlocked = ACHIEVEMENTS.filter((achievement) => sim.achievements?.[achievement.id]).length;
    const sig = `${unlocked}/${ACHIEVEMENTS.length}|${ACHIEVEMENTS.map((achievement) => sim.achievements?.[achievement.id] ? "1" : "0").join("")}`;
    if (renderCache.achievements === sig) return;
    renderCache.achievements = sig;
    setText(ui.achievementProgress, `${unlocked}/${ACHIEVEMENTS.length}`);
    ui.achievementList.textContent = "";
    ACHIEVEMENTS.forEach((achievement) => {
      const done = Boolean(sim.achievements?.[achievement.id]);
      const row = document.createElement("div");
      row.className = "achievement-row " + (done ? "unlocked" : "locked");
      const copy = document.createElement("div");
      const name = document.createElement("b");
      name.textContent = achievement.name;
      const note = document.createElement("small");
      note.textContent = done ? achievement.note : "Locked";
      copy.append(name, note);
      row.appendChild(copy);
      ui.achievementList.appendChild(row);
    });
  }

  function showAchievement(achievement) {
    achievementQueue.push(achievement);
    if (achievementShowing) return;
    showNextAchievement();
  }

  function showNextAchievement() {
    const achievement = achievementQueue.shift();
    if (!achievement) {
      achievementShowing = false;
      return;
    }
    achievementShowing = true;
    if (!ui.achievementToast) return;
    ui.achievementToastName.textContent = achievement.name;
    ui.achievementToastNote.textContent = achievement.note;
    ui.achievementToast.classList.remove("hidden");
    requestAnimationFrame(() => ui.achievementToast.classList.add("visible"));
    clearTimeout(achievementTimer);
    achievementTimer = setTimeout(() => {
      ui.achievementToast.classList.remove("visible");
      setTimeout(() => {
        ui.achievementToast.classList.add("hidden");
        showNextAchievement();
      }, 220);
    }, 3900);
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
      const width = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
      const height = sim.worldHeight?.() || sim.world?.length || WORLD_H;
      this.off = document.createElement("canvas");
      this.off.width = width;
      this.off.height = height;
      this.offCtx = this.off.getContext("2d");
      if (ui.minimapCanvas) {
        ui.minimapCanvas.width = width;
        ui.minimapCanvas.height = height;
      }
      const img = this.offCtx.createImageData(width, height);
      const px = new Uint32Array(img.data.buffer);
      for (let y = 0; y < height; y += 1) {
        const row = sim.world[y];
        for (let x = 0; x < width; x += 1) {
          const t = row[x];
          px[y * width + x] = t === AIR
            ? (y <= (sim.surface[x] || 24) ? SKY_U32 : CAVE_U32)
            : (MAP_COLORS_U32[t] ?? FALLBACK_U32);
        }
      }
      this.offCtx.putImageData(img, 0, 0);
      ui.minimapPanel.classList.toggle("hidden", !minimapOpen);
      ui.mapToggle?.classList.toggle("active", minimapOpen);
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
      const width = sim.worldWidth?.() || sim.world?.[0]?.length || WORLD_W;
      const height = sim.worldHeight?.() || sim.world?.length || WORLD_H;
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      this.paintPixel(sim, x, y);
    },

    render(scene) {
      if (!minimapOpen || !this.off || !ui.minimapCanvas) return;
      const ctx = ui.minimapCanvas.getContext("2d");
      const width = scene?.sim?.worldWidth?.() || scene?.sim?.world?.[0]?.length || WORLD_W;
      const height = scene?.sim?.worldHeight?.() || scene?.sim?.world?.length || WORLD_H;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(this.off, 0, 0);
      if (!scene || !scene.player) return;
      // Enemies as red dots, player as a gold dot.
      for (const enemy of scene.enemies?.getChildren() || []) {
        if (!enemy.active) continue;
        ctx.fillStyle = "#e25555";
        ctx.fillRect(Math.floor(enemy.x / TILE) - 1, Math.floor(enemy.y / TILE) - 1, 2, 2);
      }
      if (scene.sim?.treasureSense) {
        ctx.fillStyle = "#d8b6ff";
        for (const secret of scene.sim.secrets || []) {
          if (secret.opened || !secret.chest) continue;
          ctx.fillRect(secret.chest.x - 1, secret.chest.y - 1, 3, 3);
        }
      }
      const activeCamp = ML.CampSystem.activeCamp(scene.sim);
      for (const light of scene.sim.lights || []) {
        if (light.t !== ML.Tile.CAMPFIRE) continue;
        ctx.fillStyle = activeCamp && ML.CampSystem.sameCamp(activeCamp, light) ? "#76d66f" : "#f0a84d";
        ctx.fillRect(light.x - 1, light.y - 1, 3, 3);
      }
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(Math.floor(scene.player.x / TILE) - 1, Math.floor(scene.player.y / TILE) - 1, 3, 3);
    }
  };

  function toggleMinimap(force) {
    minimapOpen = typeof force === "boolean" ? force : !minimapOpen;
    ui.minimapPanel.classList.toggle("hidden", !minimapOpen);
    ui.mapToggle?.classList.toggle("active", minimapOpen);
    if (minimapOpen) {
      ML.sceneRef?.toggleCraft(false);
      ML.sceneRef?.toggleHelp(false);
      ML.sceneRef?.toggleCamp(false);
      ML.sceneRef?.togglePack(false);
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
    const anchor = ML.CampSystem.activeCamp(sim);
    ui.deathCause.textContent = `${cause} Your campfire anchor (${ML.CampSystem.campLabel(sim, anchor)}) pulled you back with part of the haul lost.`;
    ui.deathStats.textContent = "";
    const stats = [
      ["Blocks mined", sim.stats.mined],
      ["Deepest", `${sim.stats.deepest} m`],
      ["Kills", sim.stats.enemies],
      ["Bosses", sim.stats.bosses || 0],
      ["Secrets", sim.stats.secrets || 0],
      ["Contracts", sim.stats.contracts || 0],
      ["Events", sim.stats.events || 0],
      ["Recalls", sim.stats.recalls || 0],
      ["Camp", sim.stats.campUses || 0],
      ["Anchors", sim.stats.camps || 0],
      ["Achievements", Object.keys(sim.achievements || {}).length],
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
    ui.campToggle?.addEventListener("click", () => activeScene().toggleCamp());
    ui.interactPrompt?.addEventListener("click", () => activeScene().interactOrCraft());
    ui.closeCamp?.addEventListener("click", () => activeScene().toggleCamp(false));
    ui.craftToggle.addEventListener("click", () => activeScene().toggleCraft());
    ui.craftReady?.addEventListener("click", () => activeScene().toggleCraft(true));
    ui.closeCraft.addEventListener("click", () => activeScene().toggleCraft(false));
    ui.packToggle?.addEventListener("click", () => activeScene().togglePack());
    ui.closePack?.addEventListener("click", () => activeScene().togglePack(false));
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
    renderBiome,
    renderHotbar,
    bumpItem,
    recipeVisible,
    craftableRecipes,
    achievementMet,
    renderCraft,
    renderContract,
    renderEvent,
    renderBossBar,
    renderRecall,
    renderInteraction,
    renderCamp,
    renderPack,
    renderMystery,
    renderStory,
    renderAll,
    updatePerformance,
    minimap,
    toggleMinimap,
    showDeath,
    renderAchievements,
    resetRenderCache,
    showAchievement,
    hideDeath,
    bindUi
  });
})();
