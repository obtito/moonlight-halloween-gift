import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance } from '../src/performance.js';

const beatDuration = 60 / 112;
const danceEnd = 2 + 32 * beatDuration;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);

test('waits for begin and follows warmup, 32 beats, finale and completion on the supplied clock', () => {
  const show = createPerformance();
  show.update(10);
  assert.deepEqual(show.state, {
    phase: 'idle', active: false, runId: 0, time: 0, progress: 0,
    duration: 22, bpm: 112, chapter: 'idle', beatIndex: -1, pulse: 0,
  });
  assert.equal(show.begin(), true);
  assert.equal(show.state.chapter, 'warmup');
  assert.equal(show.state.active, true);
  show.update(1.9);
  assert.equal(show.state.chapter, 'warmup');
  show.update(.1);
  assert.equal(show.state.chapter, 'dance');
  assert.equal(show.state.beatIndex, 0);
  assert.equal(show.state.pulse, 1);
  show.update(danceEnd - 2);
  assert.equal(show.state.chapter, 'finale');
  assert.equal(show.state.beatIndex, -1);
  assert.equal(show.state.pulse, 0);
  show.update(22 - danceEnd);
  assert.equal(show.state.phase, 'complete');
  assert.equal(show.state.chapter, 'complete');
  assert.equal(show.state.active, false);
  assert.equal(show.state.progress, 1);
});

test('beat index advances once per beat and its pulse decays smoothly between beats', () => {
  const show = createPerformance(); show.begin(); show.update(2);
  for (let beat = 0; beat < 32; beat++) {
    const start = show.state;
    assert.equal(start.chapter, 'dance');
    assert.equal(start.beatIndex, beat);
    near(start.pulse, 1);
    show.update(beatDuration / 2);
    assert.equal(show.state.beatIndex, beat);
    near(show.state.pulse, .125);
    show.update(beatDuration / 2);
  }
  assert.equal(show.state.chapter, 'finale');
  assert.equal(show.state.beatIndex, -1);
  assert.equal(show.state.pulse, 0);
});

test('duplicate begin preserves playback and completion permits a fresh identified replay', () => {
  const show = createPerformance(); show.begin(); show.update(7);
  const running = show.state;
  for (let i = 0; i < 3; i++) assert.equal(show.begin(), false);
  assert.deepEqual(show.state, running);
  show.finish();
  assert.equal(show.state.runId, 1);
  assert.equal(show.begin(), true);
  assert.equal(show.state.runId, 2);
  assert.equal(show.state.time, 0);
  assert.equal(show.state.chapter, 'warmup');
});

test('skip completes only a running show and remains safe before begin and after completion', () => {
  const show = createPerformance();
  show.finish();
  assert.equal(show.state.phase, 'idle');
  assert.equal(show.state.runId, 0);
  show.begin(); show.update(.5); show.finish();
  const complete = show.state;
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.time, complete.duration);
  assert.equal(complete.beatIndex, -1);
  show.finish(); show.update(5);
  assert.deepEqual(show.state, complete);
});

test('cancel returns to idle from any phase without producing completion or rewinding run IDs', () => {
  const show = createPerformance(); show.cancel();
  assert.equal(show.state.runId, 0);
  show.begin(); show.update(4); show.cancel();
  assert.equal(show.state.phase, 'idle');
  assert.equal(show.state.active, false);
  assert.equal(show.state.time, 0);
  assert.equal(show.state.progress, 0);
  assert.equal(show.state.runId, 1);
  show.update(100); show.finish();
  assert.equal(show.state.phase, 'idle');
  show.begin(); show.finish(); show.cancel();
  assert.equal(show.state.phase, 'idle');
  assert.equal(show.state.runId, 2);
  show.begin();
  assert.equal(show.state.runId, 3);
});

test('overshooting delta stops exactly at completion and invalid clock values cannot corrupt it', () => {
  const show = createPerformance(); show.begin(); show.update(4);
  const before = show.state;
  for (const delta of [0, -1, NaN, Infinity, -Infinity, undefined, null, '1', {}]) show.update(delta);
  assert.deepEqual(show.state, before);
  show.update(Number.MAX_VALUE);
  assert.equal(show.state.time, 22);
  assert.equal(show.state.phase, 'complete');
  assert.equal(show.state.progress, 1);
});

test('reduced motion reveals immediately and still supports replay and cancellation', () => {
  const show = createPerformance({ reducedMotion: true });
  assert.equal(show.state.phase, 'idle');
  assert.equal(show.begin(), true);
  assert.equal(show.state.phase, 'complete');
  assert.equal(show.state.time, 22);
  assert.equal(show.state.active, false);
  assert.equal(show.state.beatIndex, -1);
  assert.equal(show.state.pulse, 0);
  assert.equal(show.begin(), true);
  assert.equal(show.state.runId, 2);
  show.cancel();
  assert.equal(show.state.phase, 'idle');
  assert.equal(show.state.progress, 0);
});

test('a state snapshot cannot mutate the clock or a future snapshot', () => {
  const show = createPerformance(); show.begin(); show.update(3);
  const expected = show.state, snapshot = show.state;
  snapshot.phase = 'idle'; snapshot.time = -1; snapshot.runId = 500;
  snapshot.progress = 2; snapshot.pulse = Infinity; snapshot.bpm = 0;
  assert.deepEqual(show.state, expected);
  assert.notStrictEqual(show.state, show.state);
});

test('supports a slower configured tempo when the duration covers all beats', () => {
  const show = createPerformance({ bpm: 80, duration: 30 });
  show.begin(); show.update(2 + 31 * .75);
  assert.equal(show.state.chapter, 'dance');
  assert.equal(show.state.beatIndex, 31);
  show.update(.75);
  assert.equal(show.state.chapter, 'finale');
  show.update(4);
  assert.equal(show.state.phase, 'complete');
});

test('a shorter fireworks score keeps the configured beats and ends at 18 seconds', () => {
  const show = createPerformance({ duration: 18, beats: 20 });
  show.begin(); show.update(2 + 19 * 60 / 112);
  assert.equal(show.state.chapter, 'dance');
  assert.equal(show.state.beatIndex, 19);
  show.update(60 / 112);
  assert.equal(show.state.chapter, 'finale');
  show.update(18 - show.state.time);
  assert.equal(show.state.phase, 'complete');
  for (const beats of [0, -1, 1.5, NaN, Infinity, '20', null]) {
    assert.throws(() => createPerformance({ beats }), RangeError);
  }
});

test('rejects an invalid tempo or a duration too short to contain the score', () => {
  for (const bpm of [0, -1, NaN, Infinity, -Infinity, '112', null, Number.MIN_VALUE, Number.MAX_VALUE]) {
    assert.throws(() => createPerformance({ bpm }), RangeError);
  }
  for (const duration of [0, -1, NaN, Infinity, -Infinity, '22', null, danceEnd - .01]) {
    assert.throws(() => createPerformance({ duration }), RangeError);
  }
  const exactScore = createPerformance({ duration: danceEnd });
  exactScore.begin(); exactScore.update(danceEnd);
  assert.equal(exactScore.state.phase, 'complete');
});
