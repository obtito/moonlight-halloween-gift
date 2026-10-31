import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPumpkin } from './pumpkin.js';
import { createEntranceParticles } from './entrance-particles.js';
import { createCinematicCamera } from './cinematic-camera.js';
import { createMoon } from './moon.js';
import { createHalloweenAtmosphere } from './halloween-atmosphere.js';
import { createHalloweenCandles } from './halloween-candles.js';
import { createStagePerformanceEffects } from './stage-performance-effects.js';
import { createPumpkinInteractions } from './pumpkin-interactions.js';
import { t } from './i18n.js';

// One renderer, camera, scene and animation clock are shared by the whole experience.
export function createWorld(container, { reducedMotion = false, onPumpkin = () => {} } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#100f20', .023);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', t('extra.world.canvasLabel'));
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 7;
  controls.maxDistance = 30;
  controls.minPolarAngle = .6;
  controls.maxPolarAngle = Math.PI * .49;
  controls.autoRotateSpeed = .35;
  const stage = new THREE.Group();
  scene.add(stage);
  const modelRoot = new THREE.Group();
  modelRoot.name = 'MODEL_SLOT';
  stage.add(modelRoot);
  const ambient = new THREE.HemisphereLight('#c5c8f2', '#241525', 1.8);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff3dc', 3.2);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -5 });
  key.shadow.bias = -.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#a3a7ff', 2.4);
  rim.position.set(-4, 5, -5); scene.add(rim);
  const pink = new THREE.PointLight('#f29cc8', 8, 14, 2);
  pink.position.set(3, 2, -1); scene.add(pink);
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .2, ...extra });
  const add = (parent, geometry, material, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); parent.add(mesh); return mesh;
  };
  const cylinder = (r1, r2, height, material, y) => add(stage, new THREE.CylinderGeometry(r1, r2, height, 128), material, [0, y, 0]);
  cylinder(3.05, 3.22, .18, mat('#252333', { metalness: .68, roughness: .3 }), -.14).receiveShadow = true;
  cylinder(3.22, 3.22, .055, mat('#9e8b72', { metalness: .8, roughness: .24 }), -.27);
  cylinder(3.23, 3.08, .17, mat('#171824', { metalness: .5 }), -.39);
  cylinder(2.95, 2.95, .018, mat('#272435', { metalness: .3, roughness: .4 }), -.035).receiveShadow = true;
  const rings = [];
  for (const [radius, opacity] of [[2.85, .75], [2.73, .25], [1.43, .5], [1.34, .18]]) {
    const mesh = add(stage, new THREE.RingGeometry(radius, radius + .012, 128), new THREE.MeshBasicMaterial({ color: '#e8c8a3', transparent: true, opacity, side: THREE.DoubleSide }), [0, -.016, 0]);
    mesh.rotation.x = -Math.PI / 2; mesh.userData.litOpacity = opacity; rings.push(mesh);
  }
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, r = 2.78;
    const line = add(stage, new THREE.BoxGeometry(.009, .003, i % 4 ? .035 : .1), new THREE.MeshBasicMaterial({ color: '#a99980', transparent: true, opacity: .55 }), [Math.sin(a) * r, -.007, Math.cos(a) * r]);
    line.rotation.y = a;
  }
  const haloTexture = new THREE.CanvasTexture(drawGlow());
  const groundGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: '#d7c6f5', transparent: true, opacity: .14, depthWrite: false, blending: THREE.AdditiveBlending }));
  groundGlow.position.set(0, .03, 0); groundGlow.scale.set(5.4, 1.1, 1); stage.add(groundGlow);
  const moon = createMoon(); scene.add(moon);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: '#a8b3c9', opacity: .035, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  moonHalo.position.copy(moon.position); moonHalo.scale.set(4.4, 4.4, 1); scene.add(moonHalo);
  const skyline = new THREE.Group(); scene.add(skyline);
  for (let i = 0; i < 37; i++) {
    const h = .35 + ((i * 37) % 17) * .12;
    add(skyline, new THREE.BoxGeometry(.65 + i % 3 * .2, h, .6), mat('#121420', { metalness: 0, roughness: 1 }), [(i - 18) * .9, h / 2 - .6, -7 - i % 3]);
  }
  const orbitGroup = new THREE.Group(); stage.add(orbitGroup);
  const silver = new THREE.MeshBasicMaterial({ color: '#e7cba1', transparent: true, opacity: .4 });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const star = add(orbitGroup, new THREE.OctahedronGeometry(.035, 0), silver, [Math.cos(a) * 2.2, 1.1 + Math.sin(a) * .45, Math.sin(a) * 1.8]);
    star.rotation.z = .5;
  }
  // Small clusters frame the stage while leaving the character's central slot clear.
  const stageFrontYaw = 0; // Fixed local +Z stage front, independent of the orbit camera.
  const pumpkinTargets = [];
  for (const [x, z, size, color, face] of [
    [-2.15, .65, .48, '#c77a35', true],
    [-2.35, 1.2, .25, '#ad622d', false],
    [-2.45, -.35, .31, '#db9143', true],
    [2.3, 1.15, .45, '#c77330', true],
    [2.45, .3, .28, '#d48b3f', false],
    [.1, -2.6, .23, '#a85e2d', false],
    [1.5, -2.0, .34, '#ce8238', true],
  ]) {
    const pumpkin = createPumpkin({ size, color, face, rotation: stageFrontYaw });
    pumpkin.userData.pumpkinIndex = pumpkinTargets.length;
    pumpkin.position.set(x, -.024, z);
    stage.add(pumpkin); pumpkinTargets.push(pumpkin);
  }
  const particles = createParticles(THREE, 480, reducedMotion);
  stage.add(particles.object);
  const halloween = createHalloweenAtmosphere({ reducedMotion });
  const candles = createHalloweenCandles({ glowTexture: haloTexture, reducedMotion });
  stage.add(halloween.object, candles.object);
  const performanceEffects = createStagePerformanceEffects({ reducedMotion, glowTexture: haloTexture, compact: container.clientWidth < 700 });
  stage.add(performanceEffects.object);
  const pumpkinInteractions = createPumpkinInteractions(pumpkinTargets, { reducedMotion, glowTexture: haloTexture, onCandy: () => performanceEffects.releaseCandy() });
  stage.add(pumpkinInteractions.object);
  const entranceParticles = createEntranceParticles(container.clientWidth < 700 ? 130 : 220);
  // Foreground petals travel with the lens while the stage moves in perspective.
  camera.add(entranceParticles.object); scene.add(camera);
  const cinematicCamera = createCinematicCamera();
  const cinematicPose = cinematicCamera.sample(0);
  let reveal = 0, targetReveal = 0, initialized = false, activeModel = false, editing = false;
  let entranceActive = false, entranceProgress = 1, autoRotate = false, particlesEnabled = true;
  let entranceCompleted = false;
  let performanceState = { active: false, time: 0, progress: 0, chapter: 'idle', pulse: 0 };
  const keyHomeColor = key.color.clone(), rimHomeColor = rim.color.clone();
  const ringHomeColor = new THREE.Color(), showWhite = new THREE.Color('#fff0df');
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null;
  const canInteract = () => entranceCompleted && !editing && !entranceActive && !performanceState.active;
  function pickTarget(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pumpkinTargets, true)[0];
    if (!hit) return null;
    let node = hit.object;
    while (node && !Number.isInteger(node.userData.pumpkinIndex)) node = node.parent;
    return Number.isInteger(node?.userData.pumpkinIndex) ? node.userData.pumpkinIndex : null;
  }
  function onPointerDown(e) { down = e.button === 0 && canInteract() ? [e.clientX, e.clientY, e.pointerId] : null; }
  function onPointerUp(e) {
    const origin = down; down = null;
    if (!canInteract() || !origin || origin[2] !== e.pointerId || Math.hypot(e.clientX - origin[0], e.clientY - origin[1]) > 6) return;
    const target = pickTarget(e);
    if (Number.isInteger(target)) onPumpkin(target);
  }
  function onPointerMove(e) { renderer.domElement.style.cursor = canInteract() && !e.buttons && Number.isInteger(pickTarget(e)) ? 'pointer' : ''; }
  function clearPointer() { down = null; renderer.domElement.style.cursor = ''; }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', clearPointer);
  renderer.domElement.addEventListener('pointercancel', clearPointer);
  function setPerformance(state = {}) {
    const wasActive = performanceState.active;
    const active = Boolean(state?.active) && entranceCompleted && !editing && !entranceActive;
    performanceState = active ? { ...state, active } : { active: false, time: 0, progress: 0, chapter: 'idle', pulse: 0 };
    controls.enabled = (entranceCompleted || editing) && !entranceActive && !active;
    controls.autoRotate = autoRotate && !reducedMotion && !entranceActive && !active;
    if (active !== wasActive) clearPointer();
  }
  function releaseCandy() { return canInteract() && performanceEffects.releaseCandy(); }
  function playPumpkinInteraction(index) { return canInteract() && pumpkinInteractions.trigger(index); }
  function resetCamera() {
    camera.up.set(0, 1, 0);
    camera.position.set(6.5, 4.7, 11);
    controls.target.set(0, 1.6, 0); controls.update();
  }
  function setInvitationCamera() {
    const pose = cinematicCamera.sample(0, cinematicPose);
    camera.position.copy(pose.position);
    camera.up.set(0, 1, 0);
    controls.target.copy(pose.target); controls.update();
  }
  function frameCamera(fov, offset = 1) {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    camera.fov = fov;
    camera.setViewOffset(width, height, editing ? 0 : width < 700 ? 0 : -width * .2 * offset, width < 700 && !editing ? -height * .12 * offset : 0, width, height);
    camera.updateProjectionMatrix();
  }
  function resize() {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    frameCamera(width < 700 ? 40 : 34);
    renderer.setSize(width, height, false);
    renderer.domElement.style.touchAction = width < 700 ? 'pan-y' : 'none';
    if (!initialized) { setInvitationCamera(); initialized = true; }
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function update(elapsed, delta) {
    const dt = Math.min(delta, .06);
    reveal = THREE.MathUtils.damp(reveal, targetReveal, reducedMotion ? 30 : 2.8, dt);
    const t = reducedMotion ? 0 : elapsed;
    const showStage = !entranceActive || entranceProgress >= .15;
    stage.visible = showStage; skyline.visible = showStage;
    moon.visible = showStage; moonHalo.visible = showStage;
    orbitGroup.rotation.y = t * .13;
    particles.update(t, reveal);
    halloween.update(elapsed, reveal);
    candles.update(elapsed, reveal);
    entranceParticles.update(entranceProgress, entranceActive && particlesEnabled && !reducedMotion);
    if (entranceActive && !reducedMotion) {
      const pose = cinematicCamera.sample(entranceProgress, cinematicPose);
      camera.position.copy(pose.position);
      camera.up.set(0, 1, 0); camera.lookAt(pose.target); camera.rotateZ(pose.roll);
      frameCamera(pose.fov + (container.clientWidth < 700 ? 6 : 0));
    }
    // Cue only the entrance lights; the completed stage keeps its original look.
    const lightProgress = entranceActive && !reducedMotion && !editing ? entranceProgress : 1;
    const floorOn = THREE.MathUtils.smoothstep(lightProgress, .24, .38);
    const rimOn = THREE.MathUtils.smoothstep(lightProgress, .38, .51);
    const keyOn = THREE.MathUtils.smoothstep(lightProgress, .52, .68);
    const pinkOn = THREE.MathUtils.smoothstep(lightProgress, .70, .86);
    pink.intensity = (6 + reveal * 12) * pinkOn;
    const lightLevel = editing ? 1 : reveal;
    key.intensity = (1.5 + lightLevel * 1.7) * keyOn;
    ambient.intensity = (.95 + lightLevel * .85) * (.18 + floorOn * .82);
    rim.intensity = (1.5 + lightLevel * .9) * rimOn;
    pink.color.set(targetReveal > .5 ? '#f09fcc' : '#acb4f5');
    groundGlow.material.opacity = (.12 + reveal * .08) * floorOn;
    for (const ring of rings) {
      ring.material.opacity = ring.userData.litOpacity * floorOn;
      ring.material.color.set(targetReveal > .5 ? '#e7bbd7' : '#e8c8a3');
    }
    key.color.copy(keyHomeColor); rim.color.copy(rimHomeColor);
    const cue = performanceEffects.update(elapsed, dt, performanceState, { particlesEnabled, interactive: canInteract(), pixelRatio: renderer.getPixelRatio(), camera });
    pumpkinInteractions.update(dt, canInteract());
    if (cue.strength > 0) {
      const strength = cue.strength;
      key.color.lerp(showWhite, strength * .65);
      key.intensity *= 1 - strength * .12;
      ambient.intensity *= 1 - strength * .28;
      rim.color.lerp(cue.color, strength * .35);
      rim.intensity *= 1 + strength * .25;
      pink.color.lerp(cue.color, strength * .86);
      pink.intensity *= 1 + strength * (.31 + cue.pulse * .12);
      groundGlow.material.opacity += strength * (.03 + cue.pulse * .03);
      ringHomeColor.copy(cue.color);
      for (const ring of rings) ring.material.color.lerp(ringHomeColor, strength * .9);
    }
    if (modelRoot.userData.revealMaterials) {
      for (const m of modelRoot.userData.revealMaterials) {
        if (m.userData.revealUniform) m.userData.revealUniform.value = reveal;
      }
    }
    if (!entranceActive && !performanceState.active) controls.update(dt);
    renderer.render(scene, camera);
  }
  function beginEntrance(cardSource = {}) {
    setPerformance(); performanceEffects.clearCandy(); clearPointer();
    pumpkinInteractions.clear();
    entranceActive = true; entranceProgress = 0;
    reveal = 0; targetReveal = 0;
    controls.enabled = false; controls.autoRotate = false; controls.enableDamping = false;
    frameCamera(container.clientWidth < 700 ? 40 : 34);
    setInvitationCamera(); camera.updateMatrixWorld(true);
    const depth = 6;
    const height = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const width = height * camera.aspect;
    entranceParticles.start(camera, { width: width * (cardSource.width || .42), height: height * (cardSource.height || .35), originX: cardSource.originX, originY: cardSource.originY });
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward, camera.position.clone().addScaledVector(forward, depth));
    const center = new THREE.Vector2((cardSource.centerX ?? .68) * 2 - 1, 1 - (cardSource.centerY ?? .45) * 2);
    raycaster.setFromCamera(center, camera);
    const anchor = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    entranceParticles.object.position.copy(anchor ? camera.worldToLocal(anchor) : new THREE.Vector3(0, 0, -depth));
    entranceParticles.object.quaternion.identity();
    entranceParticles.object.rotation.z = cardSource.roll || 0;
  }
  function setEntranceProgress(progress) {
    entranceProgress = THREE.MathUtils.clamp(progress, 0, 1);
    targetReveal = THREE.MathUtils.smoothstep(entranceProgress, .27, .84);
    if (entranceProgress >= 1 && (entranceActive || !entranceCompleted)) {
      entranceCompleted = true;
      entranceActive = false; controls.enabled = !performanceState.active; controls.enableDamping = true;
      controls.autoRotate = autoRotate && !reducedMotion && !performanceState.active;
      reveal = 1; targetReveal = 1;
      frameCamera(container.clientWidth < 700 ? 40 : 34); resetCamera();
    }
  }
  function setModelLoaded(loaded) {
    activeModel = loaded;
    if (!loaded) modelRoot.userData.revealMaterials = [];
    else {
      const materials = new Set();
      modelRoot.traverse(o => {
        if (!o.isMesh || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (materials.has(m)) continue;
          materials.add(m);
          if (!m.userData.revealUniform) {
            const revealUniform = { value: 1 };
            m.userData.revealUniform = revealUniform;
            const previousCompile = m.onBeforeCompile;
            m.onBeforeCompile = function(shader, ...args) {
              previousCompile?.call(this, shader, ...args);
              shader.uniforms.uGiftReveal = revealUniform;
              shader.vertexShader = 'varying vec3 vGiftLocal;\n' + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGiftLocal = position;');
              shader.fragmentShader = 'uniform float uGiftReveal;\nvarying vec3 vGiftLocal;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
                float giftNoise = fract(sin(dot(floor(vGiftLocal * 18.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                float giftThreshold = mix(-0.12, 1.12, uGiftReveal);
                if (giftNoise > giftThreshold) discard;
                float giftEdge = 1.0 - smoothstep(0.0, 0.10, giftThreshold - giftNoise);
                gl_FragColor.rgb += vec3(0.75, 0.60, 0.82) * giftEdge * (1.0 - step(0.99, uGiftReveal));
                #include <dithering_fragment>
              `);
            };
            m.customProgramCacheKey = () => 'moonlight-reveal-v1';
            m.needsUpdate = true;
          }
        }
      });
      modelRoot.userData.revealMaterials = [...materials];
    }
  }
  function dispose() {
    observer.disconnect(); controls.dispose();
    pumpkinInteractions.dispose();
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerleave', clearPointer);
    renderer.domElement.removeEventListener('pointercancel', clearPointer);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { materials.add(m); Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); }); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    renderer.dispose(); renderer.domElement.remove();
  }
  function setLanguage() {
    renderer.domElement.setAttribute('aria-label', t('extra.world.canvasLabel'));
  }
  return { scene, camera, renderer, modelRoot, resize, update, dispose, resetCamera, beginEntrance, setEntranceProgress,
    reveal: () => { reveal = 0; targetReveal = 1; },
    reset: () => { targetReveal = 0; reveal = 0; resetCamera(); },
    setParticles: value => { particlesEnabled = value; particles.object.visible = value; orbitGroup.visible = value; },
    setAutoRotate: value => { autoRotate = value; controls.autoRotate = value && !reducedMotion && !entranceActive && !performanceState.active; },
    setEditing: value => { editing = value; if (value) setPerformance(); controls.enabled = (value || entranceCompleted) && !entranceActive && !performanceState.active; resize(); if (value) resetCamera(); else if (!entranceCompleted) setInvitationCamera(); },
    setModelLoaded, setLanguage, setPerformance, releaseCandy, playPumpkinInteraction,
    capture: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    get hasModel() { return activeModel; },
    get pumpkinCount() { return pumpkinTargets.length; },
  };
}

function drawGlow() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(.12, '#ffffffad'); g.addColorStop(.4, '#ffffff28'); g.addColorStop(1, '#ffffff00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return canvas;
}
function createParticles(T, count, reducedMotion) {
  const positions = new Float32Array(count * 3), phases = new Float32Array(count), sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996, r = .9 + ((i * 37) % 113) / 113 * 5;
    positions.set([Math.cos(a) * r, ((i * 17) % 107) / 107 * 6, Math.sin(a) * r - 1], i * 3);
    phases[i] = i * .37; sizes[i] = .8 + i % 5 * .5;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new T.BufferAttribute(phases, 1));
  geometry.setAttribute('size', new T.BufferAttribute(sizes, 1));
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, reveal: { value: 0 }, pixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.7) } },
    vertexShader: `attribute float phase; attribute float size; uniform float time; uniform float pixelRatio; uniform float reveal; varying float vAlpha; varying float vPhase;
      void main(){ vec3 p = position; float a = time * 0.045; p.xz = mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz; p.y += sin(time * 0.55 + phase) * 0.12; vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(18.0,size * pixelRatio * 36.0 / max(1.0,-mv.z)); vAlpha = (0.25 + 0.35 * sin(time + phase) * sin(time + phase)) * (0.6 + reveal * 0.4); vPhase=phase; }`,
    fragmentShader: `varying float vAlpha; varying float vPhase; void main(){float d = length(gl_PointCoord - .5); if(d>.5)discard; float a = pow(1.0-d*2.0,2.3); vec3 c = mix(vec3(.75,.72,1.0),vec3(1.0,.65,.77),step(.7,fract(vPhase))); gl_FragColor=vec4(c,a*vAlpha);}`,
  });
  const object = new T.Points(geometry, material);
  return { object, update: (time, reveal) => { material.uniforms.time.value = reducedMotion ? 0 : time; material.uniforms.reveal.value = reveal; } };
}
