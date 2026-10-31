import * as THREE from 'three';
import { createFireworkMessage } from './firework-message.js';
import { FIREWORK_CUES as CUES, fireworkFlight } from './firework-cues.js';

// Each cue contains a launch time, burst centre and colour. The last trails
// settle as the final firework lettering begins.


/** Rockets, spherical bursts and falling spark trails share the world's clock. */
export function createFireworks({ reducedMotion = false, compact = false } = {}) {
  const object = new THREE.Group(); object.name = 'Halloween fireworks';
  object.visible = false;
  const rays = compact ? 112 : 220, trails = compact ? 4 : 6, rocketPoints = 28;
  const positions = [], velocities = [], colors = [], timing = [], sizes = [], kinds = [], tails = [], messageFlags = [];
  const burstTimes = [];
  function point(position, velocity, color, launch, flight, size, kind, tail, message = 0) {
    positions.push(...position); velocities.push(...velocity); colors.push(color.r, color.g, color.b);
    timing.push(launch, flight); sizes.push(size); kinds.push(kind); tails.push(tail);
    messageFlags.push(message);
  }
  CUES.forEach(([launch, x, y, z, tint], cueIndex) => {
    const color = new THREE.Color(tint), flight = fireworkFlight(cueIndex);
    burstTimes.push(launch + flight);
    const startX = x * .6, startZ = z + .25;
    for (let i = 0; i < rocketPoints; i++) {
      point([startX, .12, startZ], [x - startX, y - .12, z - startZ], color, launch, flight, 4.2, 1, i, cueIndex === CUES.length - 1 ? 1 : 0);
    }
    // The final shell bursts into the message instead of a spherical pattern.
    if (cueIndex === CUES.length - 1) return;
    for (let ray = 0; ray < rays; ray++) {
      const azimuth = ray * 2.399963229728653 + cueIndex * .53;
      const vertical = 1 - 2 * (ray + .5) / rays;
      const radius = Math.sqrt(1 - vertical * vertical);
      const inner = ray % 6 === 0;
      const speed = (inner ? 1.3 : 2.6) + (ray * 37 % 29) / 29 * .35;
      const velocity = [Math.cos(azimuth) * radius * speed, vertical * speed * .9 + .14, Math.sin(azimuth) * radius * speed];
      const sparkColor = color.clone().lerp(new THREE.Color('#fff3dc'), inner ? .7 : (ray % 4) * .06);
      for (let trail = 0; trail < trails; trail++) {
        point([x, y, z], velocity, sparkColor, launch, flight, (inner ? 4.1 : 3.2) - trail * .22, 0, trail);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aVelocity', new THREE.Float32BufferAttribute(velocities, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aTiming', new THREE.Float32BufferAttribute(timing, 2));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1));
  geometry.setAttribute('aTail', new THREE.Float32BufferAttribute(tails, 1));
  geometry.setAttribute('aMessage', new THREE.Float32BufferAttribute(messageFlags, 1));
  geometry.setDrawRange(0, positions.length / 3);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexColors: true, toneMapped: false,
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 }, messageOffset: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */`
      attribute vec3 aVelocity;
      attribute vec2 aTiming;
      attribute float aSize;
      attribute float aKind;
      attribute float aTail;
      attribute float aMessage;
      uniform float time;
      uniform float pixelRatio;
      uniform vec3 messageOffset;
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float age;
        float alpha = 0.;
        if (aKind > .5) {
          age = time - aTiming.x - aTail * .012;
          float progress = clamp(age / aTiming.y, 0., 1.);
          float travel = 1. - (1. - progress) * (1. - progress);
          p += aVelocity * travel;
          p += messageOffset * (aMessage * travel);
          alpha = step(0., age) * (1. - step(aTiming.y, age));
          alpha *= exp(-aTail * .095) * .88;
        } else {
          age = time - aTiming.x - aTiming.y - aTail * .045;
          float t = max(0., age);
          float travel = (1. - exp(-t * .72)) / .72;
          p += aVelocity * travel;
          p.y -= .48 * t * t;
          alpha = step(0., age) * (1. - smoothstep(.75, 2.65, t));
          alpha *= (1. - smoothstep(2.65, 2.85, t)) * exp(-aTail * .21);
          alpha *= .79 + .21 * sin(t * 14. + aVelocity.x * 17.);
        }
        vec4 view = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(aSize * pixelRatio * 21. / max(1., -view.z), 1., 9.);
        vTint = color;
        vAlpha = alpha;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        float distance = length(gl_PointCoord - .5) * 2.;
        if (distance > 1. || vAlpha < .005) discard;
        float halo = exp(-4.5 * distance * distance);
        float core = exp(-24. * distance * distance);
        gl_FragColor = vec4(vTint * (1.8 + core * 1.8), (halo * .65 + core * .9) * vAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const sparks = new THREE.Points(geometry, material);
  sparks.name = 'Firework rockets and falling sparks'; sparks.frustumCulled = false;
  object.add(sparks);
  const flash = new THREE.PointLight('#ffd49a', 0, 7, 2); object.add(flash);
  const message = createFireworkMessage({ compact }); object.add(message.object);
  const messageOrigin = new THREE.Vector3(0, 3.2, .1);
  function update(time, { active = false, particlesEnabled = true, pixelRatio = 1, camera } = {}) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    object.visible = Boolean(active) && particlesEnabled && !reducedMotion;
    material.uniforms.time.value = object.visible ? t : 0;
    material.uniforms.pixelRatio.value = Number.isFinite(pixelRatio) ? THREE.MathUtils.clamp(pixelRatio, 1, 1.7) : 1;
    message.update(t, { active: object.visible, pixelRatio, camera });
    material.uniforms.messageOffset.value.copy(message.object.position).sub(messageOrigin);
    let strength = 0, brightest = 0;
    if (object.visible) burstTimes.forEach((burst, index) => {
      const age = t - burst;
      const value = age >= 0 && age < .45 ? Math.exp(-age * 9) : 0;
      if (value > strength) { strength = value; brightest = index; }
    });
    flash.intensity = strength * 3.5;
    if (strength) {
      const cue = CUES[brightest]; flash.position.set(cue[1], cue[2], cue[3]); flash.color.set(cue[4]);
      if (brightest === CUES.length - 1) flash.position.copy(message.object.position);
    }
  }
  return { object, update };
}
