// AbyssForge v2 - hidden lore, field notes, and long-form expedition purpose.
(() => {
  "use strict";
  const ML = window.ML;

  const LORE_NOTES = [
    {
      id: "firstSignal",
      title: "Signal Under the Shaft",
      tag: "Signal",
      body: "The contract ledger lies. The first shaft was not dug for ore; it follows a pulse below the roots.",
      condition: (sim) => (sim.stats.deepest || 0) >= 40
    },
    {
      id: "cacheMarks",
      title: "Cache Marks",
      tag: "Vault",
      body: "Every sealed cache repeats the same forge mark. Someone hid supplies for a return trip that never happened.",
      condition: (sim) => (sim.stats.secrets || 0) >= 1
    },
    {
      id: "wayfireLedger",
      title: "Wayfire Ledger",
      tag: "Camp",
      body: "Campfires are not comfort. They are old wayfires, each one pinning a safe coordinate into the mine's memory.",
      condition: (sim) => (sim.stats.camps || 0) >= 1
    },
    {
      id: "fungalChorus",
      title: "The Fungal Chorus",
      tag: "Biome",
      body: "Glow caps flare when tools strike crystal. Their light is a warning system grown over buried machinery.",
      condition: (sim, context) => context.biome?.id === "fungalhollow" || (sim.inventory.mushroom || 0) >= 5
    },
    {
      id: "faultSong",
      title: "Iron Fault Song",
      tag: "Biome",
      body: "The iron fault answers explosions with a low note. The rock is under tension, as if something is still turning below.",
      condition: (sim, context) => context.biome?.id === "ironfault" && (sim.stats.deepest || 0) >= 70
    },
    {
      id: "crystalRoute",
      title: "Crystal Route",
      tag: "Map",
      body: "Crystal veins do not grow randomly. They bend toward vault rooms and away from lava, like a map drawn in ore.",
      condition: (sim, context) => context.biome?.id === "crystalvein" || (sim.inventory.crystal || 0) >= 1
    },
    {
      id: "broodSeal",
      title: "The Brood Seal",
      tag: "Boss",
      body: "The Broodmother guarded silk, not treasure. Her webbing held a cracked seal shut for generations.",
      condition: (sim, context) => context.bossKind === "broodmother" || (sim.stats.bosses || 0) >= 1
    },
    {
      id: "obsidianBorder",
      title: "Obsidian Border",
      tag: "Abyss",
      body: "Obsidian forms around forge vents. The deeper glass is not volcanic - it cooled around something artificial.",
      condition: (sim, context) => context.biome?.id === "obsidianabyss" || (sim.inventory.obsidian || 0) >= 1
    },
    {
      id: "wardenName",
      title: "Warden's Name",
      tag: "Boss",
      body: "The Warden was built to keep miners out of the forge, but its orders are older than the guild that fears it.",
      condition: (sim, context) => context.bossKind === "warden" || (sim.stats.bosses || 0) >= 2
    },
    {
      id: "forgePurpose",
      title: "What the Forge Wanted",
      tag: "Truth",
      body: "The abyss forge was a rescue engine. It made anchors, lamps, and drills for a collapse that never stopped spreading.",
      condition: (sim) => truthProgress(sim).done
    }
  ];

  const HIDDEN_GOALS = [
    {
      id: "signal",
      title: "Track the buried signal",
      hint: "The first strange reading sits below the starter shaft.",
      progress: (sim) => progress((sim.stats.deepest || 0), 40, "m")
    },
    {
      id: "vaults",
      title: "Decode the cache trail",
      hint: "Secret caches repeat the forge mark. Open three of them.",
      progress: (sim) => progress((sim.stats.secrets || 0), 3, "caches")
    },
    {
      id: "wayfires",
      title: "Rebuild the wayfire network",
      hint: "Rest at three different campfires to make the mine remember safe points.",
      progress: (sim) => progress((sim.stats.camps || 0), 3, "anchors")
    },
    {
      id: "kit",
      title: "Assemble abyss gear",
      hint: "The forge needs light, recall, warding, and a drill that can cut obsidian.",
      progress: (sim) => {
        const checks = [
          sim.pickLevel >= 5,
          sim.lamp >= 2,
          Boolean(sim.recallCharm),
          Boolean(sim.ward)
        ];
        return progress(checks.filter(Boolean).length, checks.length, "systems");
      }
    },
    {
      id: "bosses",
      title: "Break the hidden seals",
      hint: "Two bosses are hiding in sealed vault rooms.",
      progress: (sim) => progress((sim.stats.bosses || 0), 2, "seals")
    },
    {
      id: "truth",
      title: "Open the Warden's forge",
      hint: "The final truth needs depth, vaults, seals, and starforged mining power.",
      progress: truthProgress
    }
  ];

  function progress(value, target, unit) {
    const current = Math.max(0, Math.min(target, Math.floor(value)));
    return {
      current,
      target,
      unit,
      ratio: target > 0 ? current / target : 1,
      done: current >= target
    };
  }

  function truthProgress(sim) {
    const checks = [
      (sim.stats.deepest || 0) >= 220,
      (sim.stats.secrets || 0) >= 5,
      (sim.stats.bosses || 0) >= 2,
      sim.pickLevel >= 6
    ];
    return progress(checks.filter(Boolean).length, checks.length, "locks");
  }

  function initialState() {
    return {
      awakened: false,
      notes: {},
      lastNoteId: null,
      completedGoals: {}
    };
  }

  function ensure(sim) {
    if (!sim.lore || typeof sim.lore !== "object") sim.lore = initialState();
    sim.lore.notes = Object.assign({}, sim.lore.notes || {});
    sim.lore.completedGoals = Object.assign({}, sim.lore.completedGoals || {});
    sim.lore.awakened = Boolean(sim.lore.awakened);
    return sim.lore;
  }

  function knownNotes(sim) {
    const lore = ensure(sim);
    return LORE_NOTES.filter((note) => lore.notes[note.id]);
  }

  function activeGoal(sim) {
    const lore = ensure(sim);
    if (!lore.awakened) return null;
    return HIDDEN_GOALS.find((goal) => !goal.progress(sim).done) || HIDDEN_GOALS[HIDDEN_GOALS.length - 1];
  }

  function completedGoals(sim) {
    return HIDDEN_GOALS.filter((goal) => goal.progress(sim).done);
  }

  function evaluate(sim, context = {}) {
    const lore = ensure(sim);
    const biome = context.biome || null;
    const enriched = Object.assign({ biome }, context);
    const unlocked = [];

    for (const note of LORE_NOTES) {
      if (lore.notes[note.id]) continue;
      if (!note.condition(sim, enriched)) continue;
      lore.notes[note.id] = true;
      lore.lastNoteId = note.id;
      lore.awakened = true;
      unlocked.push(note);
    }

    for (const goal of HIDDEN_GOALS) {
      if (!goal.progress(sim).done) continue;
      lore.completedGoals[goal.id] = true;
    }

    return unlocked;
  }

  function intel(sim) {
    const lore = ensure(sim);
    const goal = activeGoal(sim);
    const notes = knownNotes(sim);
    const last = notes.find((note) => note.id === lore.lastNoteId) || notes[notes.length - 1] || null;
    const completed = completedGoals(sim);
    return {
      awakened: lore.awakened,
      noteCount: notes.length,
      totalNotes: LORE_NOTES.length,
      notes,
      last,
      goal,
      goalProgress: goal ? goal.progress(sim) : null,
      completedGoals: completed.length,
      totalGoals: HIDDEN_GOALS.length,
      done: truthProgress(sim).done
    };
  }

  Object.assign(ML, {
    LORE_NOTES,
    HIDDEN_GOALS,
    LoreSystem: {
      initialState,
      ensure,
      evaluate,
      intel,
      knownNotes,
      activeGoal,
      completedGoals
    }
  });
})();
