import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createModelSlot } from '../src/model-slot.js';
import { rigFile } from './glb-fixture.js';

function setup() {
  const scene = new THREE.Scene();
  const host = new THREE.Group();
  scene.add(host);
  const changes = [];
  const slot = createModelSlot(host, { onChange: value => changes.push(value) });
  return { scene, host, slot, changes };
}

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-5, `${message}: ${actual} != ${expected}`);
const findBone = (host, name) => host.getObjectByProperty('name', name);

test('starts empty, loads a self-contained GLB, fits its visible bounds, then clears', async () => {
  const { scene, host, slot, changes } = setup();
  assert.equal(slot.getInfo().loaded, false);
  assert.equal(slot.getInfo().mappedCount, 0);
  assert.equal(host.children.length, 1);
  const info = await slot.loadFile(rigFile());
  assert.equal(info.loaded, true);
  assert.equal(info.name, 'qa-rig.glb');
  assert.equal(info.mappedCount, 8);
  assert.equal(info.bones.length, 8);
  // A renderer updates the whole scene, including SkinnedMesh bind inverses.
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(host.getObjectByName('imported-model-pose'), true);
  const center = bounds.getCenter(new THREE.Vector3());
  close(bounds.getSize(new THREE.Vector3()).y, 3.4, 'height');
  close(bounds.min.y, 0, 'floor');
  close(center.x, 0, 'center X');
  close(center.z, 0, 'center Z');
  slot.clear();
  assert.equal(slot.getInfo().loaded, false);
  assert.equal(host.getObjectByName('model-slot').children.length, 0);
  assert.deepEqual(changes.map(value => value.loaded), [true, false]);
  slot.dispose();
  assert.equal(host.children.length, 0);
});

test('joint deltas preserve the rest quaternion and do not accumulate over repeated frames', async () => {
  const { host, slot } = setup();
  const info = await slot.loadFile(rigFile());
  const head = findBone(host, info.mapping.head);
  const restQuaternion = head.quaternion.clone();
  slot.setPose({ head: 20, la: 50, body: -12 });
  const expected = restQuaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(20)));
  close(head.quaternion.angleTo(expected), 0, 'relative rotation');
  const frameQuaternion = head.quaternion.clone();
  for (let index = 0; index < 20; index++) slot.setPose({ head: 20, la: 50, body: -12 });
  close(head.quaternion.angleTo(frameQuaternion), 0, 'idempotent rotation');
  slot.setPose({ head: 0 });
  close(head.quaternion.angleTo(restQuaternion), 0, 'rest pose restored');
  slot.dispose();
});

test('model fitting preserves normalization when an imported skinned root has authored translation and scale', async () => {
  const { scene, host, slot } = setup();
  await slot.loadFile(rigFile({ rootTranslation: [2, 1, -3], rootScale: [1.2, 1.2, 1.2] }));
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(host.getObjectByName('imported-model-pose'), true);
  const center = bounds.getCenter(new THREE.Vector3());
  close(bounds.getSize(new THREE.Vector3()).y, 3.4, 'transformed model height');
  close(bounds.min.y, 0, 'transformed model floor');
  close(center.x, 0, 'transformed model center X');
  close(center.z, 0, 'transformed model center Z');
  slot.dispose();
});

test('manual mapping validates bone names, prevents one bone controlling two joints, and restores removed mappings', async () => {
  const { host, slot } = setup();
  const info = await slot.loadFile(rigFile());
  const headName = info.mapping.head;
  const head = findBone(host, headName);
  const restQuaternion = head.quaternion.clone();
  assert.throws(() => slot.setMapping('head', info.mapping.la), /另一个关节/);
  assert.throws(() => slot.setMapping('head', 'missing bone'), /不存在/);
  assert.throws(() => slot.setMapping('unknown', headName), /未知/);
  slot.setPose({ head: 30 });
  slot.setMapping('head', '');
  close(head.quaternion.angleTo(restQuaternion), 0, 'unmapped bone restored');
  assert.equal(slot.getInfo().mappedCount, 7);
  slot.setMapping('head', headName);
  assert.equal(slot.getInfo().mappedCount, 8);
  assert.ok(head.quaternion.angleTo(restQuaternion) > .1);
  // Returned state must not mutate the live mapping.
  const copied = slot.getInfo();
  copied.mapping.head = 'other';
  copied.bones.length = 0;
  assert.equal(slot.getInfo().mapping.head, headName);
  assert.equal(slot.getInfo().bones.length, 8);
  slot.dispose();
});

test('duplicate source bone names remain independently addressable', async () => {
  const { slot } = setup();
  const info = await slot.loadFile(rigFile({ duplicateName: true }));
  assert.equal(info.bones.length, 8);
  assert.equal(new Set(info.bones).size, 8);
  const duplicateArm = info.bones.find(name => name.includes('LeftArm') && name !== info.mapping.la);
  assert.ok(duplicateArm);
  assert.equal(info.mapping.ra, '');
  slot.setMapping('ra', duplicateArm);
  assert.equal(slot.getInfo().mapping.ra, duplicateArm);
  assert.equal(slot.getInfo().mappedCount, 8);
  slot.dispose();
});

test('unrecognized rigs keep manual control available and fall back to whole-model yaw', async () => {
  const { host, slot } = setup();
  const info = await slot.loadFile(rigFile({ autoMapping: false }));
  assert.equal(info.mappedCount, 0);
  slot.setPose({ body: 40 });
  close(host.getObjectByName('imported-model-pose').rotation.y, THREE.MathUtils.degToRad(40), 'fallback yaw');
  slot.setMapping('body', info.bones[0]);
  close(host.getObjectByName('imported-model-pose').rotation.y, 0, 'fallback removed when mapped');
  slot.dispose();
});

test('skeleton display is opt-in and uses the same world transform as the loaded rig', async () => {
  const { scene, host, slot } = setup();
  host.position.set(2, .3, -1);
  host.rotation.y = .4;
  await slot.loadFile(rigFile());
  const helper = host.getObjectByName('imported-model-skeleton');
  assert.equal(helper.visible, false);
  slot.setSkeletonVisible(true);
  slot.setPose({ body: 18, la: 50 });
  scene.updateMatrixWorld(true);
  assert.equal(helper.visible, true);
  const model = host.getObjectByName('imported-model-fit').children[0];
  for (let index = 0; index < 16; index++) close(helper.matrixWorld.elements[index], model.matrixWorld.elements[index], `helper matrix ${index}`);
  slot.setSkeletonVisible(false);
  assert.equal(helper.visible, false);
  slot.dispose();
});

test('invalid GLB and local glTF do not destroy the previous imported model', async () => {
  const { slot } = setup();
  await slot.loadFile(rigFile());
  await assert.rejects(slot.loadFile({ name: 'bad.gltf', arrayBuffer: async () => new ArrayBuffer(0) }), /仅支持 GLB/);
  await assert.rejects(slot.loadFile({ name: 'bad.glb', arrayBuffer: async () => new ArrayBuffer(0) }), /模型加载失败/);
  assert.equal(slot.getInfo().loaded, true);
  assert.equal(slot.getInfo().name, 'qa-rig.glb');
  assert.equal(slot.getInfo().mappedCount, 8);
  slot.dispose();
});

test('newer imports win races and clear cancels pending work', async () => {
  const { slot } = setup();
  const file = rigFile();
  let release;
  const older = slot.loadFile({ name: 'older.glb', arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
  await slot.loadFile(rigFile({}, 'newer.glb'));
  release(await file.arrayBuffer());
  await assert.rejects(older, error => error.name === 'AbortError');
  assert.equal(slot.getInfo().name, 'newer.glb');
  let releaseSecond;
  const pending = slot.loadFile({ name: 'pending.glb', arrayBuffer: () => new Promise(resolve => { releaseSecond = resolve; }) });
  slot.clear();
  releaseSecond(await file.arrayBuffer());
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(slot.getInfo().loaded, false);
  slot.dispose();
});

test('replacement and disposal release owned GPU resources and disposal is safe twice', async () => {
  const { host, slot } = setup();
  await slot.loadFile(rigFile());
  const mesh = host.getObjectByName('imported-model-fit').children[0].getObjectByProperty('isMesh', true);
  let geometries = 0, materials = 0;
  mesh.geometry.addEventListener('dispose', () => geometries++);
  mesh.material.addEventListener('dispose', () => materials++);
  await slot.loadFile(rigFile({}, 'replacement.glb'));
  assert.equal(geometries, 1);
  assert.equal(materials, 1);
  slot.dispose();
  slot.dispose();
  assert.equal(host.children.length, 0);
  assert.throws(() => slot.setPose({ body: 10 }), /已关闭/);
  await assert.rejects(slot.loadFile(rigFile()), /已关闭/);
});
