import * as THREE from 'three';

const MODES = ['candy', 'hop', 'lantern', 'wiggle', 'pink-stars', 'moon-rings', 'violet-sparks'];
const DURATIONS = [2.8, 1.1, 1.8, 1.3, 2.1, 1.8, 2.3];

/** Small, distinct pumpkin surprises, driven by the world's existing clock. */
export function createPumpkinInteractions(targets, { reducedMotion = false, glowTexture, onCandy = () => true } = {}) {
  const object = new THREE.Group(); object.name = 'Seven pumpkin surprises';
  const count = 48;
  const slots = targets.map((target, index) => {
    const group = new THREE.Group(); group.name = MODES[index]; group.visible = false;
    group.userData.effect = MODES[index]; object.add(group);
    const size = target.userData.pumpkinSize || .35;
    const glowMaterials = new Map();
    target.traverse(child => {
      for (const material of child.material ? [child.material].flat() : []) {
        if (material.emissive && material.emissiveIntensity > 0) glowMaterials.set(material, material.emissiveIntensity);
      }
    });
    const slot = { target, group, size, age: Infinity, position: target.position.clone(), rotation: target.rotation.clone(), scale: target.scale.clone(), glowMaterials };
    group.position.copy(slot.position); group.position.y += size * .85;
    if (index === 1 || index === 2 || index === 3) {
      if (glowTexture) {
        slot.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#ffcf85', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        slot.halo.scale.setScalar(size * 4.4); group.add(slot.halo);
      }
      slot.light = new THREE.PointLight('#ffbd64', 0, 3, 2); group.add(slot.light);
    }
    if (index === 4 || index === 6) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color(index === 4 ? '#ff9fcf' : '#b6a0ff') } },
        vertexShader: `void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(65./max(1.,-p.z),2.,8.);}`,
        fragmentShader: `uniform float opacity;uniform vec3 tint;void main(){vec2 p=abs(gl_PointCoord-.5);float d=length(p)*2.;if(d>1.)discard;float glow=exp(-d*d*5.);float cross=exp(-min(p.x,p.y)*45.)*(1.-d);gl_FragColor=vec4(tint*1.5,(glow*.5+cross*.8)*opacity);#include <colorspace_fragment>}`.replace(';#include', ';\n#include'),
      });
      slot.points = new THREE.Points(geometry, material); slot.points.frustumCulled = false; group.add(slot.points);
    }
    if (index === 5) {
      slot.rings = [0, 1, 2].map(i => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.19, .006, 5, 48), new THREE.MeshBasicMaterial({ color: i === 1 ? '#ddd6ff' : '#ffd99b', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        ring.rotation.x = Math.PI / 2; group.add(ring); return ring;
      });
    }
    return slot;
  });
  let disposed = false;
  function restore(slot) {
    slot.target.position.copy(slot.position); slot.target.rotation.copy(slot.rotation); slot.target.scale.copy(slot.scale);
    for (const [material, intensity] of slot.glowMaterials) material.emissiveIntensity = intensity;
    slot.group.visible = false;
    if (slot.light) slot.light.intensity = 0;
  }
  function apply(slot, index) {
    const p = Math.min(1, slot.age / DURATIONS[index]);
    const pulse = Math.sin(p * Math.PI), fade = 1 - THREE.MathUtils.smoothstep(p, .55, 1);
    restore(slot); slot.group.visible = true;
    if (!reducedMotion && index === 1) {
      slot.target.position.y += Math.sin(p * Math.PI) * .28;
      slot.target.scale.y *= 1 + pulse * .04;
    }
    if (!reducedMotion && index === 3) {
      slot.target.rotation.z += Math.sin(p * Math.PI * 4) * .12 * (1 - p);
      slot.target.rotation.x += Math.sin(p * Math.PI * 2) * .06;
    }
    if (slot.halo) slot.halo.material.opacity = (reducedMotion ? .28 : .12 + pulse * .22) * fade;
    if (slot.light) slot.light.intensity = (index === 2 ? 3.8 : 1.2) * (reducedMotion ? fade : pulse * pulse);
    if (index === 2) for (const [material, intensity] of slot.glowMaterials) material.emissiveIntensity = intensity + (reducedMotion ? .8 * fade : pulse * 1.8);
    if (slot.points) {
      const positions = slot.points.geometry.attributes.position;
      const travel = reducedMotion ? .55 : p;
      for (let i = 0; i < count; i++) {
        const a = i * 2.399963, f = (i * 37 % 97) / 97;
        if (index === 4) {
          const radius = (.08 + f * .45) * Math.sin(travel * Math.PI / 2);
          positions.setXYZ(i, Math.cos(a + travel * 4) * radius, f * .65 + travel * .45, Math.sin(a + travel * 4) * radius);
        } else {
          const vertical = 1 - 2 * (i + .5) / count, radius = Math.sqrt(1 - vertical * vertical);
          const distance = Math.sin(travel * Math.PI / 2) * .78;
          positions.setXYZ(i, Math.cos(a) * radius * distance, vertical * distance + .48 * travel - .36 * travel * travel, Math.sin(a) * radius * distance);
        }
      }
      positions.needsUpdate = true; slot.points.material.uniforms.opacity.value = fade;
    }
    if (slot.rings) slot.rings.forEach((ring, i) => {
      const phase = reducedMotion ? .5 : Math.max(0, p - i * .12);
      ring.scale.setScalar(.45 + phase * 3.2); ring.position.y = i * .10;
      ring.material.opacity = (1 - phase) * fade * .85;
    });
  }
  function clear() {
    slots.forEach(slot => { slot.age = Infinity; restore(slot); });
  }
  return {
    object,
    trigger(index) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= slots.length) return false;
      if (index === 0) return Boolean(onCandy());
      const slot = slots[index];
      if (slot.age < .18) return false;
      slot.age = 0; apply(slot, index); return true;
    },
    update(delta, enabled = true) {
      if (disposed) return;
      if (!enabled) { clear(); return; }
      const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
      slots.forEach((slot, index) => {
        if (!Number.isFinite(slot.age)) return;
        slot.age += dt;
        if (slot.age >= DURATIONS[index]) { slot.age = Infinity; restore(slot); }
        else apply(slot, index);
      });
    },
    clear,
    dispose() {
      if (disposed) return;
      clear(); object.removeFromParent();
      const geometries = new Set(), materials = new Set();
      object.traverse(child => { if (child.geometry) geometries.add(child.geometry); if (child.material) materials.add(child.material); });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      disposed = true;
    },
  };
}
