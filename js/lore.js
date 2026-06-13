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
      id: "eyesPastLamp",
      title: "Eyes Past the Lamp",
      tag: "Watcher",
      body: "Something stands where your lamp stops. It retreats from fire and follows only when the dark gets loud.",
      condition: (sim, context) => context.watcher || (sim.stats.watcherSightings || 0) >= 1
    },
    {
      id: "theOneWhoStayed",
      title: "The One Who Stayed",
      tag: "Watcher",
      body: "The silhouette is not hunting you. It watches the anchors, as if counting which wayfires still answer.",
      condition: (sim) => (sim.stats.watcherSightings || 0) >= 3 && (sim.stats.camps || 0) >= 1
    },
    {
      id: "whenLightFails",
      title: "When Light Fails",
      tag: "Dark",
      body: "Low light does not only hide stone. It lets the mine measure your pulse, drain your breath, and call the watcher closer.",
      condition: (sim, context) => context.shadowPeak || (sim.stats.shadowPeaks || 0) >= 1
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
      id: "eventLanguage",
      title: "The Mine Changes Names",
      tag: "Events",
      body: "The same tremor does not feel like weather anymore. The mine repeats events with intent, like a damaged system choosing words.",
      condition: (sim) => (sim.stats.events || 0) >= 3
    },
    {
      id: "creatureInstincts",
      title: "Creature Instincts",
      tag: "Mobs",
      body: "Cave life does not simply charge. Some retreat from lamp glare, some wait for weakness, and some herd you toward old machinery.",
      condition: (sim) => (sim.stats.enemies || 0) >= 10 || (sim.stats.deepest || 0) >= 120
    },
    {
      id: "voidglassRepeat",
      title: "Voidglass Repeat",
      tag: "Abyss",
      body: "The lower shelf repeats routes that should not know each other. It is not endless stone; it is a failing memory loop.",
      condition: (sim) => (sim.stats.worldExpansions || 0) >= 2
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
      id: "watcher",
      title: "Understand the silhouette",
      hint: "Let the dark reveal the observer, then relight the route before pressure peaks.",
      progress: (sim) => progress((sim.stats.watcherSightings || 0), 3, "sightings")
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

  const STORY_PHASES = [
    {
      id: "contract",
      title: "Guild contract",
      tone: "Mine, craft, survive",
      summary: "The run still looks like a normal paid descent."
    },
    {
      id: "signal",
      title: "Buried signal",
      tone: "The shaft is too precise",
      summary: "The ledger starts contradicting the route below the starter camp.",
      condition: (sim) => (sim.stats.deepest || 0) >= 40 || knownNotes(sim).length >= 1
    },
    {
      id: "witness",
      title: "Something remembers",
      tone: "The mine watches back",
      summary: "Low light, wayfires, and the silhouette begin to connect.",
      condition: (sim) => (sim.stats.watcherSightings || 0) >= 1 || knownNotes(sim).length >= 4
    },
    {
      id: "conspiracy",
      title: "False expedition",
      tone: "Caches were planted for you",
      summary: "The caches, contracts, and camps stop looking like coincidence.",
      condition: (sim) => (sim.stats.secrets || 0) >= 3 || (sim.stats.camps || 0) >= 2 || knownNotes(sim).length >= 7
    },
    {
      id: "abyss",
      title: "Forge network",
      tone: "The cave is a machine",
      summary: "The descent opens old strata that behave like damaged systems.",
      condition: (sim) => (sim.stats.worldExpansions || 0) >= 1 || (sim.stats.deepest || 0) >= 220 || knownNotes(sim).length >= 10
    },
    {
      id: "truth",
      title: "Rescue engine",
      tone: "The forge was not built for ore",
      summary: "The mine reveals itself as a broken rescue machine still trying to finish its work.",
      condition: (sim) => truthProgress(sim).done
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
      (sim.stats.watcherSightings || 0) >= 3,
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

  function phaseIndex(sim) {
    let index = 0;
    for (let i = 1; i < STORY_PHASES.length; i += 1) {
      const phase = STORY_PHASES[i];
      if (phase.condition?.(sim)) index = i;
    }
    return index;
  }

  function phase(sim) {
    return STORY_PHASES[phaseIndex(sim)] || STORY_PHASES[0];
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
      phase: phase(sim),
      phaseIndex: phaseIndex(sim),
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
    STORY_PHASES,
    LoreSystem: {
      initialState,
      ensure,
      evaluate,
      intel,
      knownNotes,
      activeGoal,
      completedGoals,
      phase,
      phaseIndex
    }
  });
})();
