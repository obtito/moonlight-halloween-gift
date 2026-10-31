// An original, quiet score for the shared-clock light show. The caller owns
// the AudioContext and sound preference; this module never starts a clock.
export function createPerformanceScore() {
  let context = null, bus = null, noiseBuffer = null, disposed = false;
  let runId = null, lastChapter = null, lastStep = -1, lastTime = -1;
  const voices = new Set();
  const chords = [
    [220, 261.6256, 329.6276],
    [174.6141, 220, 261.6256],
    [261.6256, 329.6276, 391.9954],
    [195.9977, 246.9417, 293.6648],
  ];
  const bassNotes = [110, 87.3071, 130.8128, 97.9989];
  const pentatonic = [440, 523.2511, 587.3295, 659.2551, 783.9909];
  const motif = [0, -1, 2, 4, -1, 3, 1, -1];

  function release(voice) {
    if (!voices.delete(voice)) return;
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
  }

  function silence(immediate = false) {
    const now = context?.currentTime ?? 0;
    for (const voice of [...voices]) {
      if (immediate || context?.state !== 'running') {
        try { voice.source.stop(now); } catch {}
        release(voice);
        continue;
      }
      if (voice.stopping) continue;
      voice.stopping = true;
      try {
        if (voice.gain.gain.cancelAndHoldAtTime) voice.gain.gain.cancelAndHoldAtTime(now);
        else {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(Math.max(.0001, voice.gain.gain.value), now);
        }
        voice.gain.gain.linearRampToValueAtTime(.0001, now + .035);
        voice.source.stop(now + .045);
      } catch { release(voice); }
    }
  }

  function resetClock() {
    runId = null; lastChapter = null; lastStep = -1; lastTime = -1;
  }

  function useContext(nextContext) {
    if (context === nextContext && bus) return;
    silence(true);
    try { bus?.disconnect(); } catch {}
    bus = null; noiseBuffer = null; context = nextContext;
    resetClock();
    if (!context?.createGain || !context.createOscillator || !context.destination) return;
    bus = context.createGain(); bus.gain.value = .66; bus.connect(context.destination);
  }

  function filter(kind, frequency, resonance = .6) {
    if (!context.createBiquadFilter) return null;
    const node = context.createBiquadFilter(); node.type = kind;
    node.frequency.value = frequency; node.Q.value = resonance; return node;
  }

  function play(source, { at, duration, volume, attack = .006, colour = null }) {
    if (!source || !bus) return;
    const gain = context.createGain();
    const nodes = [source, gain];
    if (colour) { source.connect(colour); colour.connect(gain); nodes.push(colour); }
    else source.connect(gain);
    gain.connect(bus);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    const voice = { source, gain, nodes };
    voices.add(voice); source.onended = () => release(voice);
    try { source.start(at); source.stop(at + duration + .035); }
    catch { release(voice); }
  }

  function note(frequency, { at = context.currentTime, duration = .35, volume = .015, type = 'triangle', cutoff = 2400, attack = .006 } = {}) {
    const oscillator = context.createOscillator(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    play(oscillator, { at, duration, volume, attack, colour: filter('lowpass', cutoff) });
  }

  function noise({ at, duration, volume, frequency, kind = 'highpass' }) {
    if (!context.createBuffer || !context.createBufferSource) return;
    if (!noiseBuffer) {
      const sampleRate = context.sampleRate || 44100;
      noiseBuffer = context.createBuffer(1, Math.ceil(sampleRate * .35), sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let seed = 1412;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = seed / 2147483648 - 1;
      }
    }
    const source = context.createBufferSource(); source.buffer = noiseBuffer;
    play(source, { at, duration, volume, attack: .002, colour: filter(kind, frequency, .7) });
  }

  function kick(at) {
    const oscillator = context.createOscillator(); oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(96, at);
    oscillator.frequency.exponentialRampToValueAtTime(38, at + .16);
    play(oscillator, { at, duration: .22, volume: .058, attack: .004 });
  }

  function chord(index, at, beatSeconds, volume = .008) {
    chords[index % chords.length].forEach((frequency, voice) => {
      note(frequency, { at: at + voice * .012, duration: beatSeconds * 3.5, volume, type: 'sine', cutoff: 1500, attack: .055 });
    });
  }

  function chapterCue(chapter, state) {
    const now = context.currentTime;
    if (chapter === 'warmup' && state.time < .65) {
      [440, 659.2551].forEach((frequency, index) => note(frequency, { at: now + index * .16, duration: 1.35, volume: .009, type: 'sine', attack: .025 }));
    } else if (chapter === 'finale') {
      [523.2511, 659.2551, 880].forEach((frequency, index) => note(frequency, { at: now + index * .14, duration: 1.7 - index * .12, volume: .010, type: 'sine', attack: .024 }));
    }
  }

  function stepCue(step, beatSeconds) {
    const now = context.currentTime;
    const bar = Math.floor(step / 8), part = step % 8, harmony = bar % 4;
    const beat = Math.floor(part / 2);
    // Light percussion leaves room for the warm plucks and the stage chimes.
    if (part % 2 === 0) {
      if (beat === 0 || beat === 2) kick(now);
      else noise({ at: now, duration: .12, volume: .016, frequency: 1650, kind: 'bandpass' });
      if (beat === 0 || beat === 2) note(bassNotes[harmony], { at: now, duration: beatSeconds * .70, volume: .024, type: 'sine', cutoff: 550, attack: .012 });
    }
    noise({ at: now, duration: part % 2 ? .042 : .030, volume: part % 2 ? .006 : .004, frequency: 6800 });
    if (part === 0) chord(harmony, now, beatSeconds);
    const scaleIndex = motif[part];
    if (scaleIndex >= 0) {
      const variation = bar >= 4 && part === 6 ? 2 : 0;
      note(pentatonic[(scaleIndex + variation) % pentatonic.length], { at: now + .008, duration: beatSeconds * .72, volume: part === 0 ? .015 : .012 });
    }
  }

  function stop() {
    silence(); resetClock();
  }

  return {
    update(state, nextContext) {
      if (disposed) return;
      if (!state?.active) { stop(); return; }
      if (!nextContext || nextContext.state !== 'running' || !Number.isFinite(state.time) || !Number.isFinite(state.bpm) || state.bpm <= 0) return;
      try {
        useContext(nextContext);
        if (!bus) return;
        if (runId !== state.runId || state.time < lastTime - .001) {
          silence(); resetClock(); runId = state.runId;
        }
        lastTime = state.time;
        if (lastChapter !== state.chapter) {
          lastChapter = state.chapter; chapterCue(state.chapter, state);
        }
        if (state.chapter !== 'dance' || !Number.isInteger(state.beatIndex) || state.beatIndex < 0 || state.beatIndex > 31) return;
        // Dance begins two seconds into the supplied performance clock. Only
        // the current half-beat can sound; a seek/resume never replays a backlog.
        const rawStep = Math.max(0, (state.time - 2) * state.bpm / 60 * 2);
        const step = Math.min(63, Math.floor(rawStep + .00001));
        if (step === lastStep) return;
        lastStep = step;
        if (rawStep - step > .34) return;
        stepCue(step, 60 / state.bpm);
      } catch {
        // A closed/interrupted audio device must not interrupt the visual loop.
        silence(true); resetClock();
      }
    },
    stop,
    dispose() {
      if (disposed) return;
      silence(true); resetClock();
      try { bus?.disconnect(); } catch {}
      bus = null; noiseBuffer = null; context = null; disposed = true;
    },
  };
}
