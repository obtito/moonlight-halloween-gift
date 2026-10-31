import test from 'node:test';
import assert from 'node:assert/strict';
import { createChoreography, presets } from '../src/choreography.js';

function twoPoses() {
  const choreography = createChoreography();
  choreography.clear();
  choreography.addFrame();
  choreography.addFrame();
  choreography.applyPreset('spread');
  choreography.setDuration(1);
  return choreography;
}

test('interpolates and stops at the final frame without looping', () => {
  const c = twoPoses();
  c.setLoop(false);
  c.seek(0.5);
  assert.equal(c.state.pose.la, 42.5);
  c.togglePlayback();
  c.update(1);
  assert.equal(c.state.playing, false);
  assert.equal(c.state.time, 1);
  assert.equal(c.state.pose.ra, presets.spread.ra);
});

test('loops from final frame to first and pause preserves pose', () => {
  const c = twoPoses();
  c.seek(1.5);
  assert.equal(c.state.pose.ra, 42.5);
  c.togglePlayback();
  c.update(0.25);
  c.togglePlayback();
  const paused = c.state;
  c.update(1);
  assert.equal(c.state.time, paused.time);
  assert.deepEqual(c.state.pose, paused.pose);
  c.togglePlayback();
  c.update(0.5);
  assert.equal(c.state.time, 0.25);
});

test('selected frame edits persist, while adding duplicates current pose', () => {
  const c = twoPoses();
  c.selectFrame(0);
  c.setJoint('body', 80);
  assert.equal(c.state.frames[0].body, 80);
  c.seek(0.5);
  const interpolated = c.state.pose;
  c.addFrame();
  assert.deepEqual(c.state.frames[2], interpolated);
  c.deleteFrame(2);
  assert.equal(c.state.frames.length, 2);
});

test('round-trips settings and frames, rejecting invalid input without mutation', () => {
  const c = twoPoses();
  c.setSpeed(1.5);
  c.setLoop(false);
  const data = c.serialize();
  const restored = createChoreography(data);
  assert.equal(restored.serialize(), data);
  assert.throws(() => restored.load({ frames: [{ ...presets.neutral, body: 91 }] }));
  assert.throws(() => restored.load({ frames: Array(201).fill(presets.neutral) }));
  assert.throws(() => restored.load({ frames: [presets.neutral], duration: Infinity }));
  assert.equal(restored.serialize(), data);
});

test('subscriptions get an immediate snapshot and unsubscribe', () => {
  const c = createChoreography();
  let calls = 0;
  const unsubscribe = c.subscribe(() => calls++);
  c.setJoint('body', 10);
  unsubscribe();
  c.setJoint('body', 20);
  assert.equal(calls, 2);
});

test('imports legacy version-one files with default speed and loop and original leg limits', () => {
  const c = createChoreography({
    version: 1,
    duration: 1.2,
    frames: [{ ...presets.neutral, ll: 75, rl: -75 }, { ...presets.salute }],
  });
  assert.equal(c.state.speed, 1);
  assert.equal(c.state.loop, true);
  assert.equal(c.state.duration, 1.2);
  assert.equal(c.state.pose.ll, 75);
  assert.equal(c.state.pose.rl, -75);
});

test('duration exposes closing transition only for loops, independently of playback speed', () => {
  const c = twoPoses();
  assert.equal(c.state.totalDuration, 2);
  assert.equal(c.totalDuration, 2);
  c.setSpeed(2);
  assert.equal(c.state.totalDuration, 2);
  c.setLoop(false);
  assert.equal(c.state.totalDuration, 1);
  c.setDuration(2);
  assert.equal(c.state.totalDuration, 2);
  assert.equal(c.state.time, 2);
  c.setJoint('head', -15);
  assert.equal(c.state.selected, 1);
  assert.equal(c.state.time, 2);
  assert.equal(c.state.frames[1].head, -15);
});

test('completed non-looping playback starts again at the first pose', () => {
  const c = twoPoses();
  c.setLoop(false);
  c.selectFrame(0);
  c.togglePlayback();
  c.update(2);
  assert.equal(c.state.playing, false);
  assert.equal(c.state.pose.la, 85);
  c.togglePlayback();
  assert.equal(c.state.playing, true);
  assert.equal(c.state.time, 0);
  assert.equal(c.state.pose.la, 0);
});

test('empty and single-frame timelines remain editable and cannot start playback', () => {
  const c = createChoreography();
  c.clear();
  assert.equal(c.state.totalDuration, 0);
  c.applyPreset('salute');
  c.togglePlayback();
  assert.equal(c.state.playing, false);
  c.addFrame();
  assert.equal(c.state.frames.length, 1);
  assert.deepEqual(c.state.frames[0], presets.salute);
  c.togglePlayback();
  assert.equal(c.state.playing, false);
  c.deleteFrame(0);
  assert.equal(c.state.frames.length, 0);
  assert.equal(c.state.selected, -1);
  assert.equal(c.state.time, 0);
  c.addFrame();
  assert.deepEqual(c.state.frames[0], presets.salute);
});

test('frame limit is enforced without changing selection or settings', () => {
  const c = createChoreography({ frames: Array.from({ length: 200 }, () => ({ ...presets.neutral })), duration: 0.7 });
  c.selectFrame(100);
  c.addFrame();
  assert.equal(c.state.frames.length, 200);
  assert.equal(c.state.selected, 100);
  assert.equal(c.state.time, 70);
});

test('bad frame data, malformed JSON and unsupported versions leave all state unchanged', () => {
  const c = twoPoses();
  c.setSpeed(1.8);
  c.togglePlayback();
  c.update(0.1);
  const before = c.state;
  for (const invalid of [
    '{',
    { version: 2, frames: [presets.neutral], duration: 1 },
    { frames: [presets.neutral, { ...presets.spread, la: NaN }], duration: 1 },
    { frames: [presets.neutral], speed: 0 },
    { frames: [presets.neutral], loop: 'yes' },
  ]) {
    assert.throws(() => c.load(invalid));
    assert.deepEqual(c.state, before);
  }
});

test('snapshots cannot mutate stored keyframes and unknown presets are ignored', () => {
  const c = twoPoses();
  const before = c.state;
  const external = c.state;
  external.frames[0].la = 100;
  external.pose.la = 100;
  external.frames.push({ ...presets.neutral });
  c.applyPreset('toString');
  assert.deepEqual(c.state, before);
});
