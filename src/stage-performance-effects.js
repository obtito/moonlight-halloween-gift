import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFireworks } from './fireworks.js';

const PUMPKIN_MOUTH = new THREE.Vector3(-2.15, .39, 1.14);
const GOLD = new THREE.Color('#ffcf98');
const PINK = new THREE.Color('#efacd3');
const LILAC = new THREE.Color('#b4b6f6');
const IVORY = new THREE.Color('#fff0df');

/** Stage cues and a small candy burst, advanced only by the world's shared RAF. */
export function createStagePerformanceEffects({ reducedMotion = false, glowTexture, compact = false } = {}) {
  const object = new THREE.Group(); object.name = 'Moonlight performance cues';
  const show = new THREE.Group(); show.visible = false; object.add(show);
  const spotlight = new THREE.SpotLight('#ffdcba', 0, 13, .39, .78, 1.5);
  spotlight.position.set(-1.3, 5.8, 1.1); spotlight.target.position.set(0, .85, 0);
  show.add(spotlight, spotlight.target);
  const fireworks = createFireworks({ reducedMotion, compact });
  show.add(fireworks.object);

  const hint = new THREE.Group(); hint.name = 'A tiny secret in the front-left pumpkin'; object.add(hint);
  let hintGlow;
  if (glowTexture) {
    hintGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#ffd58e', transparent: true, opacity: .10, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    hintGlow.position.copy(PUMPKIN_MOUTH); hintGlow.scale.setScalar(.40); hint.add(hintGlow);
  }
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(.021, 0), new THREE.MeshBasicMaterial({ color: '#f4ce91', transparent: true, opacity: .7, toneMapped: false }));
  glint.position.set(-2.13, 1.09, .65); hint.add(glint);

  const candy = createCandyBurst({ reducedMotion }); object.add(candy.object);
  const look = { strength: 0, pulse: 0, finale: 0, color: GOLD.clone() };
  let previousActive = false;
  function update(elapsed, delta, state = {}, { particlesEnabled = true, interactive = false, pixelRatio = 1, camera } = {}) {
    const dt = Math.min(.06, Math.max(0, Number(delta) || 0));
    const active = Boolean(state.active);
    const time = Math.max(0, Number(state.time) || 0), progress = THREE.MathUtils.clamp(Number(state.progress) || 0, 0, 1);
    const ending = active ? THREE.MathUtils.smoothstep(progress, .87, 1) : 0;
    look.strength = active ? THREE.MathUtils.smoothstep(time, 0, 1.45) * (1 - ending) : 0;
    look.pulse = active && !reducedMotion ? THREE.MathUtils.damp(look.pulse, THREE.MathUtils.clamp(Number(state.pulse) || 0, 0, 1), 6, dt) : 0;
    look.finale = ending;
    if (state.chapter === 'dance') {
      const passage = Math.max(0, time - 2) * .19;
      const palette = [GOLD, PINK, LILAC, PINK];
      const section = Math.floor(passage) % palette.length;
      look.color.copy(palette[section]).lerp(palette[(section + 1) % palette.length], THREE.MathUtils.smoothstep(passage % 1, 0, 1));
    } else look.color.copy(GOLD);
    show.visible = active && look.strength > .001;
    spotlight.color.copy(look.color).lerp(IVORY, .48);
    spotlight.intensity = look.strength * (15 + look.pulse * 2.5);
    fireworks.update(time, { active, particlesEnabled, pixelRatio, camera });
    hint.visible = interactive && !active;
    const slow = reducedMotion ? 0 : elapsed;
    glint.position.y = 1.09 + Math.sin(slow * 1.2) * .017;
    glint.rotation.y = slow * .32;
    glint.material.opacity = .45 + (reducedMotion ? .1 : (Math.sin(slow * 1.2) + 1) * .14);
    if (hintGlow) hintGlow.material.opacity = .075 + (reducedMotion ? .02 : (Math.sin(slow * 1.2) + 1) * .025);
    if (active && !previousActive) candy.clear();
    previousActive = active;
    candy.update(dt);
    return look;
  }
  return { object, update, releaseCandy: candy.release, clearCandy: candy.clear };
}

function createCandyGeometry() {
  const parts = [];
  function part(geometry, shade) {
    const colors = new Float32Array(geometry.attributes.position.count * 3); colors.fill(shade);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(geometry);
  }
  const center = new THREE.CapsuleGeometry(.035, .055, 4, 10); center.rotateZ(Math.PI / 2); part(center, 1);
  for (const side of [-1, 1]) {
    const wrapper = new THREE.ConeGeometry(.044, .074, 5, 1, true);
    wrapper.rotateZ(side * Math.PI / 2); wrapper.translate(side * .099, 0, 0); part(wrapper, .78);
    const stripe = new THREE.TorusGeometry(.036, .004, 5, 12);
    stripe.rotateY(Math.PI / 2); stripe.translate(side * .019, 0, 0); part(stripe, .59);
  }
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose()); return geometry;
}

function createCandyBurst({ reducedMotion }) {
  const count = 10, geometry = createCandyGeometry();
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); geometry.setAttribute('candyOpacity', opacity);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .37, metalness: .05, transparent: true, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float candyOpacity; varying float vCandyOpacity;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCandyOpacity = candyOpacity;');
    shader.fragmentShader = 'varying float vCandyOpacity;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a *= vCandyOpacity;\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey = () => 'pumpkin-candy-opacity-v1';
  const object = new THREE.InstancedMesh(geometry, material, count); object.name = 'Wrapped pumpkin candies'; object.visible = false; object.frustumCulled = false;
  material.addEventListener('dispose', () => object.dispose());
  object.instanceMatrix.setUsage(THREE.DynamicDrawUsage); opacity.setUsage(THREE.DynamicDrawUsage);
  const palette = ['#f5b6d0', '#f2cc8f', '#bbb2f0', '#eadcc5'];
  for (let i = 0; i < count; i++) object.setColorAt(i, new THREE.Color(palette[i % palette.length]));
  const pieces = Array.from({ length: count }, (_, i) => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Euler(), spin: new THREE.Vector3(2.1 + i * .17, 1.4 + i * .21, 2.9 - i * .12), landed: false }));
  const dummy = new THREE.Object3D();
  let age = 3;
  function clear() { age = 3; object.visible = false; }
  function release() {
    if (age < .45) return false;
    age = 0; object.visible = true;
    pieces.forEach((piece, i) => {
      const f = (i * 37 % 97) / 97, g = (i * 23 % 79) / 79;
      piece.position.copy(PUMPKIN_MOUTH); piece.position.x += (f - .5) * .06;
      piece.velocity.set(1.0 + f * 1.3, 1.55 + g * .75, .15 + g * .66);
      piece.rotation.set(i * .7, i * 1.3, i * .4); piece.landed = false;
      if (reducedMotion) piece.position.set(-1.85 + i % 5 * .17, .065, 1.17 + Math.floor(i / 5) * .18);
    });
    update(0); return true;
  }
  function update(dt) {
    if (age >= 2.85) { object.visible = false; return; }
    age += dt;
    const alpha = 1 - THREE.MathUtils.smoothstep(age, 1.95, 2.8);
    pieces.forEach((piece, i) => {
      if (!reducedMotion) {
        piece.velocity.y -= 4.9 * dt; piece.position.addScaledVector(piece.velocity, dt);
        if (piece.position.y < .063) {
          piece.position.y = .063;
          if (!piece.landed) { piece.velocity.y = Math.abs(piece.velocity.y) * .25; piece.landed = true; }
          else { piece.velocity.y = 0; piece.velocity.x *= Math.exp(-dt * 5); piece.velocity.z *= Math.exp(-dt * 5); }
        }
        const spin = piece.landed ? .18 : 1;
        piece.rotation.x += piece.spin.x * dt * spin; piece.rotation.y += piece.spin.y * dt * spin; piece.rotation.z += piece.spin.z * dt * spin;
      }
      dummy.position.copy(piece.position); dummy.rotation.copy(piece.rotation); dummy.scale.setScalar(.92 + i % 3 * .08); dummy.updateMatrix();
      object.setMatrixAt(i, dummy.matrix); opacity.setX(i, alpha);
    });
    object.instanceMatrix.needsUpdate = true; opacity.needsUpdate = true;
  }
  return { object, release, update, clear };
}
