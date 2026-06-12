// AbyssForge v2 - tiny WebAudio synth for SFX. No assets, everything generated.
(() => {
  "use strict";
  const ML = window.ML;

  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicMode = "surface";
  let musicTimer = 0;
  let musicStep = 0;
  let musicRunning = false;
  let muted = false;
  try {
    muted = localStorage.getItem(ML.MUTE_KEY) === "1";
  } catch {
    muted = false;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function tone({ freq = 440, end = null, type = "square", dur = 0.1, vol = 0.05, delay = 0, bus = master }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null && end !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.1, vol = 0.05, freq = 1200, delay = 0 }) {
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  const sounds = {
    dig() { noise({ dur: 0.05, vol: 0.05, freq: 900 }); tone({ freq: 190, end: 130, dur: 0.05, vol: 0.025 }); },
    break() { noise({ dur: 0.13, vol: 0.07, freq: 700 }); tone({ freq: 250, end: 90, dur: 0.13, vol: 0.04 }); },
    place() { tone({ freq: 210, end: 280, dur: 0.07, vol: 0.045 }); },
    jump() { tone({ freq: 300, end: 540, dur: 0.11, vol: 0.03 }); },
    doubleJump() { tone({ freq: 430, end: 740, dur: 0.12, vol: 0.035 }); },
    land() { noise({ dur: 0.08, vol: 0.05, freq: 500 }); },
    hurt() { tone({ freq: 230, end: 85, type: "sawtooth", dur: 0.18, vol: 0.06 }); },
    enemyHit() { tone({ freq: 170, end: 110, dur: 0.06, vol: 0.05 }); noise({ dur: 0.04, vol: 0.04, freq: 1500 }); },
    enemyDie() { tone({ freq: 330, end: 60, type: "sawtooth", dur: 0.24, vol: 0.05 }); },
    craft() { tone({ freq: 520, dur: 0.08, vol: 0.04 }); tone({ freq: 740, dur: 0.1, vol: 0.04, delay: 0.08 }); },
    denied() { tone({ freq: 150, end: 95, dur: 0.12, vol: 0.045 }); },
    pickup() { tone({ freq: 680, end: 920, type: "sine", dur: 0.07, vol: 0.03 }); },
    eat() { noise({ dur: 0.09, vol: 0.04, freq: 600 }); tone({ freq: 320, end: 190, dur: 0.1, vol: 0.03 }); },
    explode() { noise({ dur: 0.4, vol: 0.13, freq: 380 }); tone({ freq: 95, end: 38, type: "sine", dur: 0.4, vol: 0.09 }); },
    chest() { tone({ freq: 420, dur: 0.07, vol: 0.04 }); tone({ freq: 530, dur: 0.07, vol: 0.04, delay: 0.07 }); tone({ freq: 660, dur: 0.12, vol: 0.045, delay: 0.14 }); },
    secret() { tone({ freq: 392, type: "sine", dur: 0.14, vol: 0.035 }); tone({ freq: 587, type: "sine", dur: 0.2, vol: 0.035, delay: 0.12 }); tone({ freq: 784, type: "triangle", dur: 0.28, vol: 0.03, delay: 0.24 }); },
    roar() { tone({ freq: 118, end: 52, type: "sawtooth", dur: 0.42, vol: 0.075 }); noise({ dur: 0.22, vol: 0.06, freq: 420 }); },
    save() { tone({ freq: 500, type: "sine", dur: 0.1, vol: 0.03 }); },
    sizzle() { noise({ dur: 0.15, vol: 0.05, freq: 2400 }); },
    click() { tone({ freq: 240, dur: 0.03, vol: 0.03 }); }
  };

  const music = {
    surface: {
      tempo: 420,
      bass: [196, 196, 247, 247, 220, 220, 247, 247],
      lead: [392, 0, 440, 494, 523, 0, 494, 440, 392, 0, 330, 349, 392, 0, 440, 0],
      type: "triangle",
      leadVol: 0.024,
      bassVol: 0.016
    },
    night: {
      tempo: 520,
      bass: [147, 147, 196, 196, 165, 165, 196, 196],
      lead: [294, 0, 330, 0, 392, 370, 330, 0, 294, 0, 247, 0, 294, 330, 0, 0],
      type: "sine",
      leadVol: 0.020,
      bassVol: 0.014
    },
    cave: {
      tempo: 610,
      bass: [98, 0, 123, 0, 110, 0, 92, 0],
      lead: [196, 0, 0, 247, 0, 220, 0, 0, 185, 0, 220, 0, 196, 0, 0, 0],
      type: "sine",
      leadVol: 0.018,
      bassVol: 0.018
    },
    deep: {
      tempo: 680,
      bass: [73, 0, 82, 0, 98, 0, 82, 0],
      lead: [147, 0, 0, 165, 0, 0, 196, 0, 185, 0, 0, 165, 0, 147, 0, 0],
      type: "triangle",
      leadVol: 0.016,
      bassVol: 0.023
    },
    danger: {
      tempo: 330,
      bass: [110, 110, 98, 110, 123, 110, 98, 0],
      lead: [220, 0, 247, 220, 294, 0, 247, 220, 196, 0, 247, 196, 220, 0, 196, 0],
      type: "square",
      leadVol: 0.019,
      bassVol: 0.02
    },
    treasure: {
      tempo: 390,
      bass: [165, 0, 196, 0, 220, 0, 196, 0],
      lead: [330, 392, 494, 0, 440, 392, 330, 0, 370, 440, 554, 0, 494, 440, 370, 0],
      type: "triangle",
      leadVol: 0.022,
      bassVol: 0.014
    },
    boss: {
      tempo: 285,
      bass: [73, 73, 82, 73, 98, 73, 82, 65],
      lead: [147, 0, 196, 185, 165, 0, 196, 220, 147, 0, 123, 147, 165, 0, 185, 0],
      type: "sawtooth",
      leadVol: 0.022,
      bassVol: 0.027
    }
  };

  function playMusicStep() {
    if (!musicRunning || muted || !ctx || !musicGain) return;
    const track = music[musicMode] || music.surface;
    const lead = track.lead[musicStep % track.lead.length];
    const bass = track.bass[musicStep % track.bass.length];
    const phraseStart = musicStep % 8 === 0;
    if (bass) {
      tone({ freq: bass, type: "sine", dur: track.tempo / 1000 * 1.55, vol: track.bassVol, bus: musicGain });
    }
    if (lead) {
      tone({ freq: lead, type: track.type, dur: track.tempo / 1000 * 0.72, vol: track.leadVol, bus: musicGain });
      if (phraseStart && musicMode !== "cave") {
        tone({ freq: lead * 1.5, type: "sine", dur: 0.35, vol: track.leadVol * 0.42, delay: 0.03, bus: musicGain });
      }
    }
    musicStep += 1;
    musicTimer = window.setTimeout(playMusicStep, track.tempo);
  }

  function startMusic() {
    if (musicRunning || muted) return;
    if (!ensure()) return;
    musicRunning = true;
    clearTimeout(musicTimer);
    playMusicStep();
  }

  function stopMusic() {
    musicRunning = false;
    clearTimeout(musicTimer);
    musicTimer = 0;
  }

  ML.audio = {
    get muted() { return muted; },
    unlock() {
      try {
        ensure();
        startMusic();
      } catch { /* no audio available */ }
    },
    play(name) {
      if (muted) return;
      try {
        if (!ensure()) return;
        if (sounds[name]) sounds[name]();
      } catch { /* never let audio break the game */ }
    },
    toggleMuted() {
      muted = !muted;
      try { localStorage.setItem(ML.MUTE_KEY, muted ? "1" : "0"); } catch { /* ignore */ }
      if (muted) stopMusic();
      else {
        try { startMusic(); } catch { /* no audio available */ }
      }
      return muted;
    },
    setMusicMode(mode) {
      if (mode && music[mode] && mode !== musicMode) {
        musicMode = mode;
        musicStep = 0;
      }
      if (!muted && ctx) startMusic();
    },
    stopMusic
  };
})();
