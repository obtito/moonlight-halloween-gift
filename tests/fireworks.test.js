import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFireworks } from '../src/fireworks.js';

function points(fireworks) { return fireworks.object.children.find(child => child.isPoints); }
function release(fireworks) {
  fireworks.object.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
}

test('rocket and burst attributes have matching finite buffers for a displaced additive point cloud', () => {
  const fireworks = createFireworks(), cloud = points(fireworks);
  const count = cloud.geometry.attributes.position.count;
  assert.ok(count > 1000);
  for (const attribute of Object.values(cloud.geometry.attributes)) {
    assert.equal(attribute.count, count);
    assert.ok([...attribute.array].every(Number.isFinite));
  }
  const kinds = new Set(cloud.geometry.attributes.aKind.array);
  assert.deepEqual(kinds, new Set([1, 0]));
  assert.equal(cloud.geometry.drawRange.count, count);
  assert.equal(cloud.frustumCulled, false);
  assert.equal(cloud.material.depthWrite, false);
  assert.equal(cloud.material.blending, THREE.AdditiveBlending);
  release(fireworks);
});

test('compact mode reduces the point budget while preserving rockets and bursts', () => {
  const full = createFireworks(), compact = createFireworks({ compact: true });
  assert.ok(points(compact).geometry.attributes.position.count < points(full).geometry.attributes.position.count * .6);
  assert.deepEqual(new Set(points(compact).geometry.attributes.aKind.array), new Set([1, 0]));
  release(full); release(compact);
});

test('the supplied clock supports pausing, cancelling tails and replaying without retained flashes', () => {
  const fireworks = createFireworks(), cloud = points(fireworks);
  const flash = fireworks.object.children.find(child => child.isPointLight);
  assert.equal(fireworks.object.visible, false);
  fireworks.update(.9, { active: true });
  assert.equal(fireworks.object.visible, true);
  assert.ok(flash.intensity > 0);
  fireworks.update(8, { active: true });
  fireworks.update(8, { active: true });
  assert.equal(cloud.material.uniforms.time.value, 8);
  fireworks.update(8, { active: false });
  assert.equal(fireworks.object.visible, false);
  assert.equal(flash.intensity, 0);
  assert.equal(cloud.material.uniforms.time.value, 0);
  fireworks.update(.1, { active: true });
  assert.equal(cloud.material.uniforms.time.value, .1);
  assert.equal(flash.intensity, 0);
  release(fireworks);
});

test('reduced motion and disabled particles suppress fireworks and invalid clocks stay finite', () => {
  const quiet = createFireworks({ reducedMotion: true });
  quiet.update(.9, { active: true });
  assert.equal(quiet.object.visible, false);
  assert.equal(quiet.object.children.find(child => child.isPointLight).intensity, 0);
  const fireworks = createFireworks(), uniforms = points(fireworks).material.uniforms;
  fireworks.update(4, { active: true, particlesEnabled: false });
  assert.equal(fireworks.object.visible, false);
  for (const time of [NaN, Infinity, -Infinity, -1, undefined]) {
    fireworks.update(time, { active: true, pixelRatio: NaN });
    assert.equal(uniforms.time.value, 0);
    assert.equal(uniforms.pixelRatio.value, 1);
  }
  release(quiet); release(fireworks);
});
