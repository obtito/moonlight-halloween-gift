import * as THREE from 'three';

const OVAL = Array.from({ length: 25 }, (_, i) => {
  const angle = Math.PI / 2 + i / 24 * Math.PI * 2;
  return [.37 + Math.cos(angle) * .37, .5 + Math.sin(angle) * .5];
});
// Shape samples define the velocities of one shaped shell, without font assets.
const GLYPHS = {
  H: { width: .72, paths: [[[0, 0], [0, 1]], [[.72, 0], [.72, 1]], [[0, .5], [.72, .5]]] },
  A: { width: .72, paths: [[[0, 0], [.36, 1], [.72, 0]], [[.16, .43], [.56, .43]]] },
  P: { width: .67, paths: [[[0, 0], [0, 1], [.43, 1], [.64, .88], [.67, .74], [.60, .59], [.43, .52], [0, .52]]] },
  Y: { width: .72, paths: [[[0, 1], [.36, .5], [.72, 1]], [[.36, .5], [.36, 0]]] },
  L: { width: .60, paths: [[[0, 1], [0, 0], [.60, 0]]] },
  O: { width: .74, paths: [OVAL] },
  W: { width: .90, paths: [[[0, 1], [.19, 0], [.45, .72], [.71, 0], [.90, 1]]] },
  E: { width: .64, paths: [[[.64, 1], [0, 1], [0, 0], [.64, 0]], [[0, .5], [.53, .5]]] },
  N: { width: .74, paths: [[[0, 0], [0, 1], [.74, 0], [.74, 1]]] },
};

export function createFireworkMessage({ compact = false } = {}) {
  const positions = [], seeds = [], tails = [];
  const trailCount = compact ? 3 : 4;
  const spacing = .23, step = compact ? .055 : .035, scale = .66;
  for (const [row, word] of ['HAPPY', 'HALLOWEEN'].entries()) {
    const width = [...word].reduce((sum, letter) => sum + GLYPHS[letter].width, 0) + (word.length - 1) * spacing;
    let x = -width / 2;
    for (const letter of word) {
      const glyph = GLYPHS[letter];
      for (const path of glyph.paths) for (let i = 1; i < path.length; i++) {
        const [a, b] = [path[i - 1], path[i]];
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (let sample = 0; sample < steps; sample++) {
          const t = sample / steps;
          const seed = seeds.length * 2.399963;
          for (let tail = 0; tail < trailCount; tail++) {
            positions.push((x + a[0] + (b[0] - a[0]) * t) * scale, (a[1] + (b[1] - a[1]) * t + .25 - row * 1.5) * scale, 0);
            seeds.push(seed); tails.push(tail);
          }
        }
      }
      x += glyph.width + spacing;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aTail', new THREE.Float32BufferAttribute(tails, 1));
  geometry.computeBoundingBox();
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aTail;
      uniform float time;
      uniform float pixelRatio;
      varying float vAlpha;
      varying float vHue;
      void main() {
        float age = time - 11.5 - aTail * .035;
        float t = max(0., age);
        // Every spark starts at the same shell centre and flies outward at once.
        float spread = (1. - exp(-t * 3.1)) / (1. - exp(-3.1));
        vec3 p = position * spread;
        p.xy += vec2(sin(aSeed * 1.7), cos(aSeed * 1.3)) * .014 * spread;
        p.y += .28 * t - .10 * t * t;
        float falling = max(0., t - 3.);
        p.x += sin(aSeed) * .055 * falling * falling;
        p.y += (cos(aSeed * 1.3) * .04 - .12) * falling * falling;
        p.z += sin(aSeed * 1.7) * .025 * falling;
        float ignition = 1. - smoothstep(.05, .65, t);
        float appear = step(0., age) * smoothstep(0., .045, age);
        float fade = 1. - smoothstep(3.6, 6.35, t);
        vAlpha = appear * fade * exp(-aTail * .55) * (.79 + .21 * sin(aSeed + t * 4.));
        vHue = clamp(position.x / 5.4 + .5, 0., 1.) * .73 + .025;
        vec4 view = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((3.1 + ignition * 1.7) * pixelRatio * 15. / max(1., -view.z), 1.7, 6.);
      }
    `,
    fragmentShader: /* glsl */`
      varying float vAlpha;
      varying float vHue;
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.;
        if (radius > 1. || vAlpha < .005) discard;
        float halo = exp(-4. * radius * radius);
        float core = exp(-22. * radius * radius);
        vec3 spectrum = clamp(abs(fract(vHue + vec3(0., .666667, .333333)) * 6. - 3.) - 1., 0., 1.);
        vec3 tint = .16 + .84 * spectrum;
        gl_FragColor = vec4(tint * (1.6 + core * 1.3), (halo * .45 + core * .65) * vAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const object = new THREE.Points(geometry, material);
  object.name = 'HAPPY HALLOWEEN shaped firework burst'; object.frustumCulled = false;
  const anchor = new THREE.Vector3(0, 2.45, .1);
  object.position.copy(anchor); object.scale.setScalar(compact ? 1.1 : .95);
  object.visible = false; object.renderOrder = 20;
  const centre = new THREE.Vector3(), edge = new THREE.Vector3(), right = new THREE.Vector3();
  const halfWidth = Math.max(Math.abs(geometry.boundingBox.min.x), geometry.boundingBox.max.x) * 1.07;
  function update(time, { active = false, pixelRatio = 1, camera } = {}) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    object.visible = Boolean(active) && t >= 11.5 && t < 17.9;
    material.uniforms.time.value = object.visible ? t : 0;
    material.uniforms.pixelRatio.value = Number.isFinite(pixelRatio) ? THREE.MathUtils.clamp(pixelRatio, 1, 1.7) : 1;
    if (camera) {
      camera.updateMatrixWorld();
      object.quaternion.copy(camera.quaternion);
      object.position.copy(anchor);
      object.getWorldPosition(centre);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      edge.copy(centre).add(right);
      centre.project(camera); edge.project(camera);
      const projectedUnit = Math.max(.001, Math.abs(edge.x - centre.x));
      const targetX = compact ? 0 : .49;
      object.position.addScaledVector(right, (targetX - centre.x) / projectedUnit);
      const available = compact ? .86 : Math.min(.90 - targetX, targetX - .13);
      object.scale.setScalar(Math.min(compact ? 1.1 : .95, available / (projectedUnit * halfWidth)));
    }
  }
  return { object, update };
}
