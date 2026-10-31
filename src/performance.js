// The light show advances only from the world's existing animation clock.
const WARMUP_DURATION = 2;
const DANCE_BEATS = 32;

export function createPerformance({ reducedMotion = false, duration = 22, bpm = 112, beats = DANCE_BEATS } = {}) {
  if (!Number.isSafeInteger(beats) || beats <= 0) throw new RangeError('Performance beats must be a positive safe integer');
  const beatDuration = 60 / bpm;
  const danceEnd = WARMUP_DURATION + beats * beatDuration;
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(beatDuration) || danceEnd <= WARMUP_DURATION || !Number.isFinite(danceEnd)) {
    throw new RangeError('Performance tempo must define a positive finite beat duration');
  }
  if (!Number.isFinite(duration) || duration < danceEnd) {
    throw new RangeError('Performance duration must cover the warmup and all configured beats');
  }

  let phase = 'idle', time = 0, runId = 0;
  function snapshot() {
    let chapter = phase, beatIndex = -1, pulse = 0;
    if (phase === 'running') {
      if (time < WARMUP_DURATION) chapter = 'warmup';
      else if (time < danceEnd) {
        chapter = 'dance';
        const elapsedBeats = (time - WARMUP_DURATION) / beatDuration;
        // Tolerate roundoff at beat boundaries without adding an extra beat.
        const tolerance = Number.EPSILON * Math.max(1, elapsedBeats) * 32;
        beatIndex = Math.min(beats - 1, Math.floor(elapsedBeats + tolerance));
        const fraction = Math.max(0, Math.min(1, elapsedBeats - beatIndex));
        pulse = (1 - fraction) ** 3;
      } else chapter = 'finale';
    }
    return { phase, active: phase === 'running', runId, time, progress: time / duration, duration, bpm, chapter, beatIndex, pulse };
  }
  return {
    get state() { return snapshot(); },
    begin() {
      if (phase === 'running') return false;
      runId++;
      phase = reducedMotion ? 'complete' : 'running';
      time = reducedMotion ? duration : 0;
      return true;
    },
    update(delta) {
      if (phase !== 'running' || !Number.isFinite(delta) || delta <= 0) return;
      time = Math.min(duration, time + delta);
      for (const boundary of [WARMUP_DURATION, danceEnd, duration]) {
        if (Math.abs(time - boundary) <= Number.EPSILON * Math.max(1, boundary) * 32) time = boundary;
      }
      if (time === duration) phase = 'complete';
    },
    finish() {
      if (phase !== 'running') return;
      time = duration; phase = 'complete';
    },
    cancel() { phase = 'idle'; time = 0; },
  };
}
