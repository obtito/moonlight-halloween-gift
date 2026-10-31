import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPumpkinInteractions } from '../src/pumpkin-interactions.js';

function pumpkins() {
  return Array.from({ length: 7 }, (_, i) => {
    const target = new THREE.Group(); target.position.set(i * .3, -.024, i * -.2);
    target.rotation.y = .03; target.userData.pumpkinSize = .25 + i * .02;
    const material = new THREE.MeshStandardMaterial({ emissive: '#ff9911', emissiveIntensity: .42 });
    target.add(new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 4), material));
    return target;
  });
}
function homes(targets) {
  return targets.map(target => ({ position: target.position.toArray(), rotation: target.rotation.toArray(), scale: target.scale.toArray(), glow: target.children[0].material.emissiveIntensity }));
}
function release(targets) { targets.forEach(target => { target.children[0].geometry.dispose(); target.children[0].material.dispose(); }); }

test('all seven pumpkins have distinct surprises and only the first delegates to candy', () => {
  const targets = pumpkins(); let candy = 0;
  const effects = createPumpkinInteractions(targets, { onCandy: () => { candy++; return true; } });
  assert.equal(new Set(effects.object.children.map(child => child.userData.effect)).size, 7);
  for (let i = 0; i < 7; i++) assert.equal(effects.trigger(i), true);
  assert.equal(candy, 1);
  effects.update(.25);
  assert.ok(targets[1].position.y > -.024);
  assert.ok(targets[2].children[0].material.emissiveIntensity > .42);
  assert.notEqual(targets[3].rotation.z, 0);
  effects.object.traverse(child => {
    if (child.geometry?.attributes.position) assert.ok([...child.geometry.attributes.position.array].every(Number.isFinite));
  });
  effects.dispose(); release(targets);
});

test('effects return every pumpkin to its original pose and glow after completion or cancellation', () => {
  const targets = pumpkins(), initial = homes(targets), effects = createPumpkinInteractions(targets);
  for (let i = 1; i < 7; i++) effects.trigger(i);
  for (let frame = 0; frame < 180; frame++) effects.update(1 / 60);
  assert.deepEqual(homes(targets), initial);
  assert.ok(effects.object.children.every(child => !child.visible));
  effects.trigger(1); effects.trigger(2); effects.update(.3); effects.update(.1, false);
  assert.deepEqual(homes(targets), initial);
  effects.dispose(); release(targets);
});

test('rapid repeat taps are bounded and restarting an effect never accumulates transforms', () => {
  const targets = pumpkins(), initial = homes(targets), effects = createPumpkinInteractions(targets);
  assert.equal(effects.trigger(1), true);
  assert.equal(effects.trigger(1), false);
  effects.update(.2);
  assert.equal(effects.trigger(1), true);
  effects.update(5);
  assert.deepEqual(homes(targets), initial);
  for (const index of [-1, 7, NaN, null, '0', {}]) assert.equal(effects.trigger(index), false);
  effects.dispose(); release(targets);
});

test('reduced motion keeps pumpkin transforms still and disposal preserves externally owned materials', () => {
  const targets = pumpkins(), initial = homes(targets), effects = createPumpkinInteractions(targets, { reducedMotion: true });
  let externalDisposals = 0;
  targets.forEach(target => target.children[0].material.addEventListener('dispose', () => externalDisposals++));
  for (let i = 1; i < 7; i++) effects.trigger(i);
  effects.update(.3);
  targets.forEach((target, i) => {
    assert.deepEqual(target.position.toArray(), initial[i].position);
    assert.deepEqual(target.rotation.toArray(), initial[i].rotation);
    assert.deepEqual(target.scale.toArray(), initial[i].scale);
  });
  effects.dispose(); effects.dispose();
  assert.equal(externalDisposals, 0);
  assert.deepEqual(homes(targets), initial);
  assert.equal(effects.trigger(1), false);
  release(targets);
});
