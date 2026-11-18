// All sound is synthesized with WebAudio — no audio files, no network. The music
// is a small step sequencer (bass, hats, a lead line) that starts on the first
// user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBuffer(duration) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch { /* sound is best-effort */ }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(duration);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch { /* sound is best-effort */ }
  }

  const api = {
    unlock() { resume(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
      if (value) api.stopEngine();
    },
    isMuted() { return muted; },
    click() { blip(660, 0.07, 'square', 0.12); },
    pickup() { blip(880, 0.09, 'sine', 0.2); setTimeout(() => blip(1318, 0.12, 'sine', 0.2), 70); },
    cash() { blip(1046, 0.08, 'triangle', 0.22); setTimeout(() => blip(1568, 0.14, 'triangle', 0.22), 80); },
    punch() { noiseBurst(0.12, 0.4, 500); },
    gunshot() { noiseBurst(0.16, 0.5, 2400); blip(180, 0.1, 'square', 0.25, 60); },
    crash() { noiseBurst(0.3, 0.5, 700); blip(90, 0.25, 'sawtooth', 0.3, 40); },
    explosion() { noiseBurst(0.7, 0.7, 900); blip(60, 0.6, 'sawtooth', 0.4, 30); },
    sirenOn() {
      if (!ensure() || muted) return;
      try {
        if (sirenOsc) return;
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenOsc._timer = window.setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setValueAtTime(high ? 950 : 700, ctx.currentTime);
        }, 380);
      } catch { /* best-effort */ }
    },
    sirenOff() {
      if (sirenOsc) {
        try {
          window.clearInterval(sirenOsc._timer);
          sirenOsc.stop();
        } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    engineStart() {
      if (!ensure() || muted) return;
      try {
        if (engineOsc) return;
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.03;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } catch { /* best-effort */ }
    },
    engineSet(speedNorm) {
      if (engineOsc && !muted) {
        try {
          engineOsc.frequency.setValueAtTime(55 + speedNorm * 165, ctx.currentTime);
          engineGain.gain.setValueAtTime(0.02 + speedNorm * 0.05, ctx.currentTime);
        } catch { /* best-effort */ }
      }
    },
    stopEngine() {
      if (engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
      }
    },
    missionJingle() {
      if (!ensure() || muted) return;
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 110));
    },
    failTone() {
      if (!ensure() || muted) return;
      [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.2, 'triangle', 0.22), i * 140));
    },
    musicStart() {
      if (!ensure() || musicTimer) return;
      // Bass line in A minor, one bar of eight steps, hats on the off-beats.
      const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
      const lead = [220, 0, 261.6, 0, 0, 329.6, 0, 0, 220, 0, 0, 196, 0, 0, 164.8, 0];
      musicTimer = window.setInterval(() => {
        if (muted || !ctx || ctx.state !== 'running') { step = (step + 1) % 16; return; }
        const i = step % 16;
        if (bass[i]) blip(bass[i], 0.22, 'triangle', 0.16);
        if (lead[i]) blip(lead[i], 0.18, 'sine', 0.07);
        if (i % 2 === 1) noiseBurst(0.03, 0.05, 6000);
        step = (step + 1) % 16;
      }, 170);
    },
    musicStop() {
      if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
    },
  };
  return api;
}
