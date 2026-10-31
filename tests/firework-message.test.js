import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFireworkMessage } from '../src/firework-message.js';

function release(message) { message.object.geometry.dispose(); message.object.material.dispose(); }

test('the shaped shell has two centred lines with finite seeds and spark trails', () => {
  const message = createFireworkMessage(), { geometry } = message.object;
  const positions = geometry.attributes.position, seeds = geometry.attributes.aSeed, tails = geometry.attributes.aTail;
  assert.ok(positions.count > 500);
  assert.equal(seeds.count, positions.count);
  assert.equal(tails.count, positions.count);
  assert.ok([...positions.array].every(Number.isFinite));
  assert.ok([...seeds.array].every(Number.isFinite));
  assert.ok(Math.max(...tails.array) > 0);
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.min.y < 0 && geometry.boundingBox.max.y > 0);
  assert.ok(Math.abs(geometry.boundingBox.getCenter(new THREE.Vector3()).x) < .05);
  assert.equal(message.object.frustumCulled, false);
  release(message);
});

test('the shaped shell appears only at its burst, then clears on completion, cancellation or replay', () => {
  const message = createFireworkMessage();
  const positions = [...message.object.geometry.attributes.position.array];
  assert.equal(message.object.visible, false);
  message.update(11.4, { active: true });
  assert.equal(message.object.visible, false);
  for (const time of [11.6, 13, 16]) {
    message.update(time, { active: true });
    assert.equal(message.object.visible, true);
    assert.equal(message.object.material.uniforms.time.value, time);
  }
  message.update(18, { active: true });
  assert.equal(message.object.visible, false);
  message.update(13, { active: false });
  assert.equal(message.object.material.uniforms.time.value, 0);
  message.update(11.6, { active: true });
  assert.equal(message.object.visible, true);
  assert.deepEqual([...message.object.geometry.attributes.position.array], positions);
  release(message);
});

test('letters face the shared camera, compact mode lowers the budget, and invalid clocks remain hidden', () => {
  const message = createFireworkMessage(), compact = createFireworkMessage({ compact: true });
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(6.5, 4.7, 11); camera.lookAt(0, 1.6, 0);
  message.update(13, { active: true, camera, pixelRatio: 2 });
  assert.ok(message.object.quaternion.angleTo(camera.quaternion) < 1e-7);
  assert.equal(message.object.material.uniforms.pixelRatio.value, 1.7);
  camera.rotation.set(.2, -.4, .1);
  message.update(13, { active: true, camera });
  assert.ok(message.object.quaternion.angleTo(camera.quaternion) < 1e-7);
  assert.ok(compact.object.geometry.attributes.position.count < message.object.geometry.attributes.position.count);
  for (const time of [NaN, Infinity, -Infinity, undefined]) {
    message.update(time, { active: true });
    assert.equal(message.object.visible, false);
  }
  release(message); release(compact);
});

test('the word stays in the framed sky above the stage, clear of the left headline', () => {
  const message = createFireworkMessage();
  const camera = new THREE.PerspectiveCamera(34, 759 / 610, .1, 100);
  camera.position.set(6.5, 4.7, 11); camera.lookAt(0, 1.6, 0);
  camera.setViewOffset(759, 610, -759 * .2, 0, 759, 610);
  message.update(13, { active: true, camera });
  message.object.updateMatrixWorld();
  const bounds = message.object.geometry.boundingBox;
  const left = new THREE.Vector3(bounds.min.x * 1.07, 0, 0);
  const right = new THREE.Vector3(bounds.max.x * 1.07, 0, 0);
  message.object.localToWorld(left); message.object.localToWorld(right);
  left.project(camera); right.project(camera);
  assert.ok(left.x >= .13 - 1e-5);
  assert.ok(right.x <= .90 + 1e-5);
  assert.ok(right.x - left.x > .65);
  release(message);
});
