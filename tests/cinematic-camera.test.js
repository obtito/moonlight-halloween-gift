import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { CINEMATIC_DURATION, createCinematicCamera } from '../src/cinematic-camera.js';

const home = [6.5, 4.7, 11];
const far = [12.025, 7.335, 20.35];
const target = [0, 1.6, 0];

test('starts in the far view, holds while the notice dissolves, and ends exactly at home', () => {
  const camera = createCinematicCamera();
  assert.equal(CINEMATIC_DURATION, 6.4);
  for (const progress of [0, .05, .1, .13]) {
    assert.deepEqual(camera.sample(progress).position.toArray(), far);
  }
  assert.deepEqual(camera.sample(1).position.toArray(), home);
  assert.deepEqual(camera.sample(1).target.toArray(), target);
});

test('all samples remain on the same viewing ray and approach the stage monotonically', () => {
  const camera = createCinematicCamera();
  const direction = new Vector3(...home).sub(new Vector3(...target)).normalize();
  const actual = new Vector3();
  let previousDistance = Infinity;
  const out = { position: new Vector3(), target: new Vector3() };
  for (let index = 0; index <= 1000; index++) {
    const pose = camera.sample(index / 1000, out);
    actual.copy(pose.position).sub(pose.target);
    const distance = actual.length();
    assert.ok(distance <= previousDistance + 1e-10, 'the dolly must never reverse');
    assert.ok(distance >= new Vector3(...home).distanceTo(new Vector3(...target)) - 1e-10);
    assert.ok(actual.normalize().distanceTo(direction) < 1e-12, 'the shot must not orbit or pan');
    assert.deepEqual(pose.target.toArray(), target);
    assert.equal(pose.fov, 34);
    assert.equal(pose.roll, 0);
    for (const number of [...pose.position, ...pose.target]) assert.ok(Number.isFinite(number));
    previousDistance = distance;
  }
  assert.ok(camera.sample(.5).position.distanceTo(camera.sample(0).position) > 1);
});

test('the whole shot is continuous with stationary eased endpoints', () => {
  const camera = createCinematicCamera();
  assert.ok(camera.sample(.13).position.distanceTo(camera.sample(.13001).position) < 1e-10);
  assert.ok(camera.sample(.99999).position.distanceTo(camera.sample(1).position) < 1e-10);
  let previous = camera.sample(0);
  for (let index = 1; index <= 1000; index++) {
    const current = camera.sample(index / 1000);
    assert.ok(current.position.distanceTo(previous.position) < .025, 'the dolly must not jump');
    previous = current;
  }
});

test('clamps progress and treats nonnumeric input as the far starting view', () => {
  const camera = createCinematicCamera();
  for (const progress of [-1, -Infinity, NaN, undefined, null, '0.5', {}]) {
    assert.deepEqual(camera.sample(progress).position.toArray(), far);
    assert.equal(camera.sample(progress).fov, 34);
  }
  for (const progress of [2, Infinity]) assert.deepEqual(camera.sample(progress).position.toArray(), home);
});

test('reuses an output pose without exposing or mutating the path state', () => {
  const camera = createCinematicCamera();
  const position = new Vector3(), lookAt = new Vector3();
  const out = { position, target: lookAt };
  assert.equal(camera.sample(.4, out), out);
  assert.equal(out.position, position);
  assert.equal(out.target, lookAt);
  const expected = camera.sample(.4).position.clone();
  out.position.set(1000, 1000, 1000);
  out.target.set(-1000, -1000, -1000);
  assert.deepEqual(camera.sample(.4).position.toArray(), expected.toArray());
  assert.deepEqual(camera.sample(.4).target.toArray(), target);
  const empty = {};
  assert.equal(camera.sample(.5, empty), empty);
  assert.ok(empty.position.isVector3 && empty.target.isVector3);
});
