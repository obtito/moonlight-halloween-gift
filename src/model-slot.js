import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const JOINTS = {
  body: { axis: new THREE.Vector3(0, 1, 0), sign: 1, min: -90, max: 90 },
  head: { axis: new THREE.Vector3(0, 0, 1), sign: 1, min: -45, max: 45 },
  la: { axis: new THREE.Vector3(0, 0, 1), sign: -1, min: -180, max: 180 },
  ra: { axis: new THREE.Vector3(0, 0, 1), sign: 1, min: -180, max: 180 },
  le: { axis: new THREE.Vector3(1, 0, 0), sign: -1, min: -120, max: 120 },
  re: { axis: new THREE.Vector3(1, 0, 0), sign: -1, min: -120, max: 120 },
  ll: { axis: new THREE.Vector3(1, 0, 0), sign: 1, min: -75, max: 75 },
  rl: { axis: new THREE.Vector3(1, 0, 0), sign: 1, min: -75, max: 75 },
};

const emptyMapping = () => Object.fromEntries(Object.keys(JOINTS).map(key => [key, '']));
const neutralPose = () => Object.fromEntries(Object.keys(JOINTS).map(key => [key, 0]));
const normalizeName = name => name.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^\p{L}\p{N}]/gu, '');

// These hints cover common Mixamo, Blender, VRM and Japanese humanoid bone names.
// Imported rigs can use different local axes: the manual mapping is not a full
// animation-retargeting system. Angles retain the original studio conventions.
const NAME_HINTS = {
  body: [/^hips$/, /^pelvis$/, /^jbipchips$/],
  head: [/^head$/, /^jbipchead$/, /^頭$/],
  la: [/^leftarm$/, /^leftupperarm$/, /^upperarml$/, /^lupperarm$/, /^jbiplupperarm$/, /^左腕$/],
  ra: [/^rightarm$/, /^rightupperarm$/, /^upperarmr$/, /^rupperarm$/, /^jbiprupperarm$/, /^右腕$/],
  le: [/^leftforearm$/, /^leftlowerarm$/, /^forearml$/, /^lowerarml$/, /^llowerarm$/, /^jbipllowerarm$/, /^左ひじ$/],
  re: [/^rightforearm$/, /^rightlowerarm$/, /^forearmr$/, /^lowerarmr$/, /^rlowerarm$/, /^jbiprlowerarm$/, /^右ひじ$/],
  ll: [/^leftupleg$/, /^leftupperleg$/, /^thighl$/, /^upperlegl$/, /^lupperleg$/, /^jbiplupperleg$/, /^左足$/],
  rl: [/^rightupleg$/, /^rightupperleg$/, /^thighr$/, /^upperlegr$/, /^rupperleg$/, /^jbiprupperleg$/, /^右足$/],
};

function disposeResources(roots) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  for (const root of roots) {
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
  }
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

function disposeGLTF(gltf) {
  const roots = [...new Set([gltf.scene, ...(gltf.scenes || [])].filter(Boolean))];
  disposeResources(roots);
}

// Keep source error messages stable for callers, while the UI renders the
// selected language from this structured key rather than parsing prose.
function modelError(message, i18nKey, i18nParams = {}, ErrorType = Error) {
  const error = new ErrorType(message);
  error.i18nKey = i18nKey;
  error.i18nParams = i18nParams;
  return error;
}

function cancelled() {
  const error = modelError('已取消较早的模型加载。', 'extra.model.cancelled');
  error.name = 'AbortError';
  return error;
}

function readableError(error) {
  if (error?.name === 'AbortError') return error;
  if (error?.i18nKey) return error;
  const detail = String(error?.message || error || '');
  if (/DRACOLoader|KHR_draco_mesh_compression|KTX2Loader|EXT_meshopt_compression|MeshoptDecoder/i.test(detail)) {
    return modelError('此模型使用了压缩扩展，请先导出为未压缩、贴图内嵌的 GLB 后再导入。', 'extra.model.compressed');
  }
  return modelError(`模型加载失败，原有模型已保留。${detail ? ` ${detail}` : ''}`, 'extra.model.loadFailed');
}

/**
 * A model attachment point in the existing Three.js scene. No renderer, camera,
 * animation loop or character geometry is created here.
 *
 * loadFile accepts self-contained GLB files. loadUrl can also resolve hosted
 * glTF resources using GLTFLoader's normal relative-resource behavior.
 */
export function createModelSlot(parentGroup, { onChange = () => {} } = {}) {
  if (!parentGroup?.isObject3D) throw modelError('模型预留位需要 Three.js Object3D 父节点。', 'extra.model.invalidParent', {}, TypeError);

  const slotRoot = new THREE.Group();
  slotRoot.name = 'model-slot';
  parentGroup.add(slotRoot);
  const loader = new GLTFLoader();
  let active = null, loadSequence = 0, disposed = false, skeletonVisible = false;
  let pose = neutralPose();
  const deltaQuaternion = new THREE.Quaternion();
  const inverseHostMatrix = new THREE.Matrix4();

  function ensureActive() {
    if (disposed) throw modelError('模型预留位已关闭。', 'extra.model.closed');
  }

  function getInfo() {
    return {
      loaded: Boolean(active),
      name: active?.name || '',
      bones: active ? active.bones.map(entry => entry.label) : [],
      mapping: active ? { ...active.mapping } : emptyMapping(),
      animationNames: active ? [...active.animationNames] : [],
      mappedCount: active ? Object.values(active.mapping).filter(Boolean).length : 0,
    };
  }

  const emit = () => onChange(getInfo());

  function removeActive() {
    if (!active) return;
    active.helper?.removeFromParent();
    active.helper?.geometry.dispose();
    if (active.helper?.material) {
      for (const material of Array.isArray(active.helper.material) ? active.helper.material : [active.helper.material]) material.dispose();
    }
    active.poseRoot.removeFromParent();
    disposeGLTF(active.gltf);
    active = null;
  }

  function updateSkeleton() {
    if (!active?.helper) return;
    slotRoot.updateWorldMatrix(true, true);
    // SkeletonHelper uses model-local vertices. Its matrix must be relative to
    // its actual host, otherwise a transformed stage would be applied twice.
    inverseHostMatrix.copy(slotRoot.matrixWorld).invert();
    active.helper.matrix.copy(inverseHostMatrix).multiply(active.model.matrixWorld);
    active.helper.visible = skeletonVisible;
    active.helper.updateMatrixWorld(true);
  }

  function applyPose() {
    if (!active) return;
    active.poseRoot.quaternion.identity();
    for (const entry of active.bones) entry.bone.quaternion.copy(entry.baseQuaternion);
    for (const [key, spec] of Object.entries(JOINTS)) {
      const angle = pose[key] * spec.sign * THREE.MathUtils.DEG2RAD;
      const label = active.mapping[key];
      if (!label) {
        if (key === 'body') active.poseRoot.rotation.y = angle;
        continue;
      }
      const entry = active.boneByLabel.get(label);
      if (entry) entry.bone.quaternion.copy(entry.baseQuaternion).multiply(deltaQuaternion.setFromAxisAngle(spec.axis, angle));
    }
    active.poseRoot.updateWorldMatrix(true, true);
    updateSkeleton();
  }

  function prepare(gltf, name) {
    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw modelError('文件中没有可显示的场景。', 'extra.model.noScene');
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const size = bounds.getSize(new THREE.Vector3());
    if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y < 1e-7) throw modelError('模型没有可显示的三维网格。', 'extra.model.noMesh');
    const center = bounds.getCenter(new THREE.Vector3());

    const poseRoot = new THREE.Group();
    poseRoot.name = 'imported-model-pose';
    const fitRoot = new THREE.Group();
    fitRoot.name = 'imported-model-fit';
    const scale = 3.4 / size.y;
    fitRoot.scale.setScalar(scale);
    fitRoot.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    fitRoot.add(model);
    poseRoot.add(fitRoot);

    const bones = [], boneByLabel = new Map();
    model.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.isSkinnedMesh) object.frustumCulled = false;
      }
      if (!object.isBone) return;
      const stem = object.name.trim() || `未命名骨骼 ${bones.length + 1}`;
      let label = stem, suffix = 2;
      while (boneByLabel.has(label)) label = `${stem} (${suffix++})`;
      const entry = { label, bone: object, baseQuaternion: object.quaternion.clone(), normalizedName: normalizeName(object.name) };
      bones.push(entry);
      boneByLabel.set(label, entry);
    });

    const mapping = emptyMapping(), usedBones = new Set();
    for (const key of Object.keys(JOINTS)) {
      let entry;
      for (const hint of NAME_HINTS[key]) {
        entry = bones.find(candidate => !usedBones.has(candidate.bone) && hint.test(candidate.normalizedName));
        if (entry) break;
      }
      if (entry) {
        mapping[key] = entry.label;
        usedBones.add(entry.bone);
      }
    }

    const helper = bones.length ? new THREE.SkeletonHelper(model) : null;
    if (helper) {
      helper.name = 'imported-model-skeleton';
      // Detach the matrix reference installed by SkeletonHelper's constructor.
      helper.matrix = new THREE.Matrix4();
      helper.visible = skeletonVisible;
      helper.renderOrder = 10;
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = 0.85;
    }

    return {
      gltf, name, model, poseRoot, fitRoot, bones, boneByLabel, mapping, helper,
      animationNames: (gltf.animations || []).map((clip, index) => clip.name || `动画 ${index + 1}`),
    };
  }

  async function load(loadModel, name) {
    ensureActive();
    const sequence = ++loadSequence;
    let gltf;
    let next;
    try {
      gltf = await loadModel();
      if (disposed || sequence !== loadSequence) throw cancelled();
      next = prepare(gltf, name);
    } catch (error) {
      if (gltf) disposeGLTF(gltf);
      if (disposed || sequence !== loadSequence) throw cancelled();
      throw readableError(error);
    }
    removeActive();
    active = next;
    slotRoot.add(active.poseRoot);
    if (active.helper) slotRoot.add(active.helper);
    applyPose();
    emit();
    return getInfo();
  }

  return {
    async loadFile(file) {
      ensureActive();
      if (!file || typeof file.arrayBuffer !== 'function') throw modelError('请选择一个 GLB 模型文件。', 'extra.model.selectFile');
      if (!/\.glb$/i.test(file.name || '')) {
        throw modelError('本地导入仅支持 GLB。请将 glTF 及其贴图、二进制文件打包导出为一个 GLB 后再导入。', 'extra.model.glbOnly');
      }
      return load(async () => loader.parseAsync(await file.arrayBuffer(), ''), file.name);
    },
    async loadUrl(url) {
      ensureActive();
      if (typeof url !== 'string' || !url.trim()) throw modelError('请提供模型地址。', 'extra.model.urlRequired');
      let name = url.split(/[?#]/)[0].split('/').pop() || '远程模型';
      try { name = decodeURIComponent(name); } catch { /* Keep valid undecoded URL text. */ }
      return load(() => loader.loadAsync(url), name);
    },
    clear() {
      ensureActive();
      ++loadSequence;
      removeActive();
      emit();
    },
    setPose(nextPose) {
      ensureActive();
      if (!nextPose || typeof nextPose !== 'object') return;
      for (const [key, spec] of Object.entries(JOINTS)) {
        const value = nextPose[key];
        if (typeof value === 'number' && Number.isFinite(value)) pose[key] = THREE.MathUtils.clamp(value, spec.min, spec.max);
      }
      applyPose();
    },
    setMapping(key, boneName = '') {
      ensureActive();
      if (!Object.hasOwn(JOINTS, key)) throw modelError('未知的关节控制项。', 'extra.model.unknownJoint');
      if (!active) throw modelError('请先导入带骨骼的 GLB 模型。', 'extra.model.importFirst');
      const label = boneName || '';
      if (label && !active.boneByLabel.has(label)) throw modelError('所选骨骼不存在。', 'extra.model.missingBone');
      if (label && Object.entries(active.mapping).some(([otherKey, value]) => otherKey !== key && value === label)) {
        throw modelError('该骨骼已用于另一个关节，请先取消原有对应关系。', 'extra.model.boneInUse');
      }
      active.mapping[key] = label;
      applyPose();
      emit();
      return getInfo();
    },
    getInfo,
    setSkeletonVisible(value) {
      ensureActive();
      skeletonVisible = Boolean(value);
      updateSkeleton();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++loadSequence;
      removeActive();
      slotRoot.removeFromParent();
    },
  };
}
