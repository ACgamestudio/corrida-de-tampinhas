// ==========================================================================
// Motor de som 100% sintetizado via Web Audio API — nenhum arquivo de áudio
// externo é necessário. Isso evita qualquer risco de direitos autorais com
// trilhas/efeitos de terceiros e já funciona assim que o jogo é aberto.
// ==========================================================================

const SoundEngine = (() => {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Desbloqueia o áudio no primeiro toque do usuário (necessário nos
  // navegadores que bloqueiam áudio automático).
  function unlock() { ensureCtx(); }

  function tone({ freq, dur = 0.15, type = 'sine', gain = 0.2, delay = 0, freqEnd = null }) {
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    const t0 = c.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noiseBurst({ dur = 0.12, gain = 0.2, delay = 0, filterFreq = 1200 }) {
    const c = ensureCtx();
    if (!c) return;
    const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
  }

  // -------------------- efeitos das jogadas --------------------
  const SFX = {
    punch() {
      tone({ freq: 150, dur: 0.1, type: 'square', gain: 0.22 });
      noiseBurst({ dur: 0.08, gain: 0.18, filterFreq: 900 });
    },
    kick() {
      tone({ freq: 95, dur: 0.22, type: 'sawtooth', gain: 0.25, freqEnd: 45 });
      noiseBurst({ dur: 0.14, gain: 0.2, filterFreq: 700 });
    },
    block() {
      tone({ freq: 700, dur: 0.06, type: 'square', gain: 0.16 });
      tone({ freq: 1000, dur: 0.08, type: 'square', gain: 0.14, delay: 0.05 });
    },
    special() {
      tone({ freq: 180, dur: 0.45, type: 'sawtooth', gain: 0.28, freqEnd: 900 });
      noiseBurst({ dur: 0.3, gain: 0.22, filterFreq: 2200, delay: 0.05 });
    },
    hit() {
      noiseBurst({ dur: 0.1, gain: 0.2, filterFreq: 500 });
      tone({ freq: 120, dur: 0.12, type: 'triangle', gain: 0.18 });
    },
    select() {
      tone({ freq: 660, dur: 0.07, type: 'sine', gain: 0.18 });
      tone({ freq: 990, dur: 0.09, type: 'sine', gain: 0.14, delay: 0.05 });
    },
    confirm() {
      tone({ freq: 520, dur: 0.09, type: 'triangle', gain: 0.2 });
      tone({ freq: 780, dur: 0.12, type: 'triangle', gain: 0.16, delay: 0.06 });
    },
    click() {
      tone({ freq: 500, dur: 0.05, type: 'sine', gain: 0.12 });
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.22, delay: i * 0.13 })
      );
    },
    defeat() {
      tone({ freq: 260, dur: 0.5, type: 'sawtooth', gain: 0.22, freqEnd: 70 });
    },
  };

  // -------------------- música de fundo (gerada, em loop) --------------------
  const BGM = (() => {
    let playing = false;
    let timeoutId = null;

    // escala menor (Lá menor) — soa tensa/heróica, combina com o clima do jogo
    const scale = [220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0];
    const melodyPattern = [0, 2, 4, 2, 0, 3, 4, 5, 4, 2, 0, -1, 2, 4, 5, 4];
    const bassPattern = [0, 0, 3, 3];

    function note(freq, t, dur, gain, type) {
      const c = ensureCtx();
      if (!c) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = c.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    const BEAT = 0.28;
    const BARS = melodyPattern.length;

    function scheduleBar() {
      melodyPattern.forEach((deg, i) => {
        if (deg === -1) return; // pausa
        const freq = scale[((deg % scale.length) + scale.length) % scale.length] * 2;
        note(freq, i * BEAT, BEAT * 0.85, 0.05, 'triangle');
      });
      bassPattern.forEach((deg, i) => {
        const freq = scale[deg % scale.length] / 2;
        note(freq, i * BEAT * 4, BEAT * 3.6, 0.07, 'sine');
      });
    }

    function loop() {
      if (!playing) return;
      scheduleBar();
      timeoutId = setTimeout(loop, BARS * BEAT * 1000);
    }

    return {
      start() {
        if (playing) return;
        const c = ensureCtx();
        if (!c) return;
        playing = true;
        loop();
      },
      stop() {
        playing = false;
        if (timeoutId) clearTimeout(timeoutId);
      },
      get isPlaying() { return playing; },
    };
  })();

  return { unlock, SFX, BGM };
})();
