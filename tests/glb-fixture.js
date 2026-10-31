import * as THREE from 'three';

// A self-contained QA cube with eight test bones. It is not a character asset
// and is never included in public/ or loaded by the gift page.
export function makeRigGLB({ duplicateName = false, autoMapping = true, skinned = true, rootTranslation, rootScale } = {}) {
  const geometry = new THREE.BoxGeometry(1, 2, 0.7).translate(0, 1, 0);
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const count = geometry.attributes.position.count;
  const joints = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) weights[index * 4] = 1;
  const indices = new Uint16Array(geometry.index.array);
  const chunks = [], bufferViews = [], accessors = [];
  let offset = 0;
  function accessor(array, componentType, type, accessorCount, options = {}) {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const view = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes);
    const padding = (4 - bytes.length % 4) % 4;
    if (padding) chunks.push(Buffer.alloc(padding));
    offset += bytes.length + padding;
    const result = accessors.length;
    accessors.push({ bufferView: view, componentType, count: accessorCount, type, ...options });
    return result;
  }
  const positionAccessor = accessor(positions, 5126, 'VEC3', count, { min: [-.5, 0, -.35], max: [.5, 2, .35] });
  const normalAccessor = accessor(normals, 5126, 'VEC3', count);
  const jointAccessor = accessor(joints, 5123, 'VEC4', count);
  const weightAccessor = accessor(weights, 5126, 'VEC4', count);
  const indexAccessor = accessor(indices, 5123, 'SCALAR', indices.length);
  const binary = Buffer.concat(chunks);

  const names = ['Hips', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg'];
  const name = index => autoMapping ? `mixamorig:${names[index]}` : `custom_bone_${index + 1}`;
  const nodes = [
    { name: 'QA cube', mesh: 0, ...(skinned ? { skin: 0 } : {}), children: [1] },
    { name: name(0), children: [2, 3, 5, 7, 8] },
    { name: name(1), translation: [0, 1.8, 0], rotation: [0, 0, Math.sin(.1), Math.cos(.1)] },
    { name: name(2), children: [4], translation: [-.3, 1.5, 0] },
    { name: name(3), translation: [-.4, -.3, 0] },
    { name: duplicateName ? name(2) : name(4), children: [6], translation: [.3, 1.5, 0] },
    { name: name(5), translation: [.4, -.3, 0] },
    { name: name(6), translation: [-.2, .8, 0] },
    { name: name(7), translation: [.2, .8, 0] },
  ];
  const attributes = { POSITION: positionAccessor, NORMAL: normalAccessor };
  if (rootTranslation) nodes[0].translation = rootTranslation;
  if (rootScale) nodes[0].scale = rootScale;
  if (skinned) Object.assign(attributes, { JOINTS_0: jointAccessor, WEIGHTS_0: weightAccessor });
  const document = {
    asset: { version: '2.0', generator: 'Moonlight synthetic QA fixture' },
    scene: 0, scenes: [{ nodes: [0] }], nodes,
    skins: [{ joints: [1, 2, 3, 4, 5, 6, 7, 8], skeleton: 1 }],
    meshes: [{ primitives: [{ attributes, indices: indexAccessor, material: 0 }] }],
    materials: [{ name: 'QA lavender', pbrMetallicRoughness: { baseColorFactor: [.64, .54, 1, 1], roughnessFactor: .5, metallicFactor: .2 } }],
    buffers: [{ byteLength: binary.length }], bufferViews, accessors,
  };
  let json = Buffer.from(JSON.stringify(document));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  geometry.dispose();
  return Buffer.concat([header, json, binaryHeader, binary]);
}

export function rigFile(options, name = 'qa-rig.glb') {
  const bytes = makeRigGLB(options);
  return { name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}
