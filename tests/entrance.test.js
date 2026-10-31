import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntrance } from '../src/entrance.js';

test('waits for begin, then advances only with the supplied animation clock', () => {
  const entrance = createEntrance({ duration: 4 });
  entrance.update(20);
  assert.deepEqual(entrance.state, { phase: 'idle', progress: 0 });
  assert.equal(entrance.begin(), true);
  assert.deepEqual(entrance.state, { phase: 'running', progress: 0 });
  entrance.update(1);
  assert.deepEqual(entrance.state, { phase: 'running', progress: .25 });
  entrance.update(3);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
  entrance.update(5);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
});

test('duplicate begins do not restart an active reveal, and completion allows replay', () => {
  const entrance = createEntrance({ duration: 2 });
  entrance.begin(); entrance.update(1);
  for (let i = 0; i < 5; i++) assert.equal(entrance.begin(), false);
  assert.deepEqual(entrance.state, { phase: 'running', progress: .5 });
  entrance.update(1);
  assert.equal(entrance.begin(), true);
  assert.deepEqual(entrance.state, { phase: 'running', progress: 0 });
  entrance.update(2);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
});

test('uses the default duration and clamps an overshooting clock to completion', () => {
  const entrance = createEntrance();
  entrance.begin(); entrance.update(1.6);
  assert.equal(entrance.state.progress, .5);
  entrance.update(100);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
});

test('reduced motion completes immediately on each accepted begin', () => {
  const entrance = createEntrance({ reducedMotion: true });
  assert.deepEqual(entrance.state, { phase: 'idle', progress: 0 });
  assert.equal(entrance.begin(), true);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
  entrance.update(1);
  assert.equal(entrance.begin(), true);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
});

test('finish is safe before starting, during playback, and after completion', () => {
  const entrance = createEntrance({ duration: 2 });
  entrance.finish(); entrance.finish();
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
  entrance.begin(); entrance.update(.5); entrance.finish();
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
  entrance.update(1); entrance.finish();
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
});

test('invalid clock values and zero cannot corrupt or rewind progress', () => {
  const entrance = createEntrance({ duration: 2 });
  entrance.begin(); entrance.update(.5);
  for (const delta of [-1, NaN, Infinity, -Infinity, undefined, null, '1', {}, 0]) entrance.update(delta);
  assert.deepEqual(entrance.state, { phase: 'running', progress: .25 });
  entrance.update(1.5);
  assert.deepEqual(entrance.state, { phase: 'complete', progress: 1 });
});

test('returned snapshots do not expose mutable entrance state', () => {
  const entrance = createEntrance({ duration: 2 });
  entrance.begin(); entrance.update(1);
  const state = entrance.state; state.phase = 'idle'; state.progress = -1;
  assert.deepEqual(entrance.state, { phase: 'running', progress: .5 });
});

test('rejects a duration that cannot define a finite animation clock', () => {
  for (const duration of [0, -1, NaN, Infinity, '3.2', null]) {
    assert.throws(() => createEntrance({ duration }), RangeError);
  }
});
