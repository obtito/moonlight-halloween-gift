// Advances only from the shared animation clock; no timers or browser APIs.
export function createEntrance({ duration = 3.2, reducedMotion = false } = {}) {
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Entrance duration must be a positive finite number');
  let phase = 'idle', elapsed = 0;
  return {
    get state() { return { phase, progress: elapsed / duration }; },
    begin() {
      if (phase === 'running') return false;
      phase = reducedMotion ? 'complete' : 'running';
      elapsed = reducedMotion ? duration : 0;
      return true;
    },
    update(delta) {
      if (phase !== 'running' || !Number.isFinite(delta) || delta < 0) return;
      elapsed = Math.min(duration, elapsed + delta);
      if (elapsed === duration) phase = 'complete';
    },
    finish() { elapsed = duration; phase = 'complete'; },
  };
}
