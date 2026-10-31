// Joint angles are in degrees. Duration is the time between adjacent keyframes.
export const specs = [
  { key: 'body', label: '身体', min: -90, max: 90 },
  { key: 'head', label: '头部', min: -45, max: 45 },
  { key: 'la', label: '左臂', min: -180, max: 180 },
  { key: 'ra', label: '右臂', min: -180, max: 180 },
  { key: 'le', label: '左肘', min: -120, max: 120 },
  { key: 're', label: '右肘', min: -120, max: 120 },
  { key: 'll', label: '左腿', min: -75, max: 75 },
  { key: 'rl', label: '右腿', min: -75, max: 75 },
];
const neutral = { body: 0, head: 0, la: 0, ra: 0, le: 0, re: 0, ll: 0, rl: 0 };
export const presets = {
  neutral: { ...neutral },
  salute: { body: -8, head: -8, la: 12, ra: 135, le: 0, re: 105, ll: 0, rl: 0 },
  spread: { body: 0, head: 0, la: 85, ra: 85, le: 10, re: 10, ll: 8, rl: -8 },
  step: { body: 15, head: -10, la: 45, ra: 25, le: 25, re: 25, ll: 30, rl: -20 },
};
export const demoFrames = [
  { ...presets.neutral },
  { ...presets.salute },
  { body: -18, head: 12, la: 50, ra: 70, le: 25, re: 20, ll: 25, rl: -20 },
  { ...presets.spread },
  { ...presets.step },
  { body: -15, head: 10, la: 25, ra: 45, le: 25, re: 25, ll: -20, rl: 30 },
  { ...presets.salute },
  { ...presets.neutral },
];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const copy = p => ({ ...p });
const validPose = pose => {
  if (!pose || typeof pose !== 'object' || Array.isArray(pose)) throw new Error('Invalid pose');
  const result = {};
  for (const { key, min, max } of specs) {
    if (typeof pose[key] !== 'number' || !Number.isFinite(pose[key]) || pose[key] < min || pose[key] > max) throw new Error(`Invalid joint: ${key}`);
    result[key] = pose[key];
  }
  return result;
};

export function createChoreography(initial) {
  let frames = demoFrames.map(copy), pose = copy(frames[0]);
  let selected = 0, playing = false, time = 0, duration = 0.7, speed = 1, loop = true;
  const listeners = new Set();
  const length = () => frames.length > 1 ? (loop ? frames.length : frames.length - 1) * duration : 0;
  // Times are choreography seconds. Speed changes playback rate, not keyframe positions.
  // Looping includes the closing transition from the last frame back to the first.
  const snapshot = () => ({ frames: frames.map(copy), pose: copy(pose), selected, playing, time, duration, speed, loop, totalDuration: length() });
  const emit = () => { const s = snapshot(); for (const fn of listeners) fn(s); };
  const sample = () => {
    if (frames.length === 0) return;
    if (frames.length === 1) { pose = copy(frames[0]); return; }
    const position = time / duration;
    const left = Math.min(Math.floor(position), frames.length - 1);
    const right = left === frames.length - 1 ? (loop ? 0 : left) : left + 1;
    const t = clamp(position - left, 0, 1);
    const eased = t * t * (3 - 2 * t);
    pose = Object.fromEntries(specs.map(({ key }) => [key, frames[left][key] + (frames[right][key] - frames[left][key]) * eased]));
  };
  const applyPose = next => {
    playing = false;
    pose = copy(next);
    if (selected >= 0 && selected < frames.length) {
      frames[selected] = copy(pose);
      time = selected * duration;
    }
    emit();
  };
  const api = {
    get state() { return snapshot(); },
    get totalDuration() { return length(); },
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    setJoint(key, value) {
      const spec = specs.find(s => s.key === key);
      if (!spec || !Number.isFinite(Number(value))) return;
      applyPose({ ...pose, [key]: clamp(Number(value), spec.min, spec.max) });
    },
    applyPreset(name) { if (Object.hasOwn(presets, name)) applyPose(presets[name]); },
    selectFrame(index) {
      if (!Number.isInteger(index) || index < 0 || index >= frames.length) return;
      playing = false; selected = index; time = index * duration; pose = copy(frames[index]); emit();
    },
    addFrame() {
      if (frames.length >= 200) return;
      playing = false; frames.push(copy(pose)); selected = frames.length - 1; time = selected * duration; emit();
    },
    deleteFrame(index) {
      if (!Number.isInteger(index) || index < 0 || index >= frames.length) return;
      playing = false; frames.splice(index, 1);
      if (!frames.length) { selected = -1; time = 0; }
      else { selected = Math.min(index, frames.length - 1); time = selected * duration; pose = copy(frames[selected]); }
      emit();
    },
    resetPose() { applyPose(neutral); },
    clear() { frames = []; pose = copy(neutral); selected = -1; playing = false; time = 0; emit(); },
    loadDemo() { frames = demoFrames.map(copy); pose = copy(frames[0]); selected = 0; playing = false; time = 0; emit(); },
    togglePlayback() {
      if (frames.length < 2) return;
      if (!playing && !loop && time >= length()) time = 0;
      playing = !playing; if (playing) { selected = -1; sample(); } emit();
    },
    stop() { playing = false; time = 0; selected = frames.length ? 0 : -1; if (frames.length) pose = copy(frames[0]); emit(); },
    seek(seconds) {
      if (!Number.isFinite(Number(seconds))) return;
      time = clamp(Number(seconds), 0, length()); selected = -1; sample(); emit();
    },
    setDuration(seconds) {
      if (!Number.isFinite(Number(seconds))) return;
      const position = time / duration; duration = clamp(Number(seconds), 0.1, 10); time = Math.min(position * duration, length()); sample(); emit();
    },
    setSpeed(value) { if (Number.isFinite(Number(value))) { speed = clamp(Number(value), 0.1, 4); emit(); } },
    setLoop(value) { loop = Boolean(value); time = Math.min(time, length()); sample(); emit(); },
    update(delta) {
      if (!playing || !Number.isFinite(delta) || delta <= 0) return;
      const total = length();
      if (!total) { playing = false; emit(); return; }
      time += delta * speed;
      if (loop) time %= total;
      else if (time >= total) { time = total; playing = false; }
      sample(); emit();
    },
    serialize() { return JSON.stringify({ version: 1, frames: frames.map(copy), duration, speed, loop }, null, 2); },
    load(data) {
      const input = typeof data === 'string' ? JSON.parse(data) : data;
      if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.frames) || input.frames.length > 200 || (input.version !== undefined && input.version !== 1)) throw new Error('Invalid choreography');
      const nextFrames = input.frames.map(validPose);
      const nextDuration = input.duration === undefined ? 0.7 : input.duration;
      const nextSpeed = input.speed === undefined ? 1 : input.speed;
      const nextLoop = input.loop === undefined ? true : input.loop;
      if (typeof nextDuration !== 'number' || !Number.isFinite(nextDuration) || nextDuration < 0.1 || nextDuration > 10 || typeof nextSpeed !== 'number' || !Number.isFinite(nextSpeed) || nextSpeed < 0.1 || nextSpeed > 4 || typeof nextLoop !== 'boolean') throw new Error('Invalid choreography settings');
      frames = nextFrames; duration = nextDuration; speed = nextSpeed; loop = nextLoop;
      selected = frames.length ? 0 : -1; pose = frames.length ? copy(frames[0]) : copy(neutral); playing = false; time = 0; emit();
    },
  };
  if (initial !== undefined) api.load(initial);
  return api;
}
