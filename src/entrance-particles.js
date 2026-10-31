import * as THREE from 'three';
import { CINEMATIC_DURATION } from './cinematic-camera.js';

// One instanced mesh turns the notice into cupped paper petals. Its clock is
// supplied by world.update(); no emitter, timer, or additional RAF is created.
export function createEntranceParticles(count = 220) {
  const instanceCount = Number.isFinite(count) ? Math.max(1, Math.min(800, Math.floor(count))) : 220;
  const plane = new THREE.PlaneGeometry(1, 1, 6, 8);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.attributes = plane.attributes;
  geometry.instanceCount = instanceCount;
  const origins = new Float32Array(instanceCount * 2);
  const variations = new Float32Array(instanceCount * 4);
  const sizes = new Float32Array(instanceCount);
  let randomState = 1412;
  const random = () => { randomState = randomState * 16807 % 2147483647; return randomState / 2147483647; };
  // A jittered grid fills the card, rather than placing all petals at its centre.
  const columns = Math.ceil(Math.sqrt(instanceCount * 1.6));
  const rows = Math.ceil(instanceCount / columns);
  for (let i = 0; i < instanceCount; i++) {
    origins.set([((i % columns) + .15 + random() * .7) / columns, (Math.floor(i / columns) + .15 + random() * .7) / rows], i * 2);
    variations.set([random(), random(), random(), random()], i * 4);
    sizes[i] = .055 + random() ** .7 * .105;
  }
  geometry.setAttribute('petalOrigin', new THREE.InstancedBufferAttribute(origins, 2));
  geometry.setAttribute('variation', new THREE.InstancedBufferAttribute(variations, 4));
  geometry.setAttribute('petalSize', new THREE.InstancedBufferAttribute(sizes, 1));

  const petalMap = new THREE.CanvasTexture(drawPetal());
  petalMap.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false,
    forceSinglePass: true,
    uniforms: {
      progress: { value: 0 },
      duration: { value: CINEMATIC_DURATION },
      paperSize: { value: new THREE.Vector2(3.05, 1.95) },
      dissolveOrigin: { value: new THREE.Vector2(.5, .5) },
      petalMap: { value: petalMap },
    },
    vertexShader: `
      attribute vec2 petalOrigin;
      attribute vec4 variation;
      attribute float petalSize;
      uniform float progress;
      uniform float duration;
      uniform vec2 paperSize;
      uniform vec2 dissolveOrigin;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vBlush;
      varying vec3 vNormal;
      mat3 rotateX(float a) {
        float s = sin(a), c = cos(a);
        return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);
      }
      mat3 rotateY(float a) {
        float s = sin(a), c = cos(a);
        return mat3(c,0.,-s, 0.,1.,0., s,0.,c);
      }
      mat3 rotateZ(float a) {
        float s = sin(a), c = cos(a);
        return mat3(c,s,0., -s,c,0., 0.,0.,1.);
      }
      void main() {
        // Distance is measured on the physical paper so this follows a circular
        // mask expanding from the actual pointer, including off-centre clicks.
        vec2 radialOffset = (petalOrigin - dissolveOrigin) * paperSize;
        vec2 farthestCorner = max(dissolveOrigin, 1. - dissolveOrigin) * paperSize;
        float radius = length(radialOffset) / max(.001, length(farthestCorner));
        float birth = .012 + radius * .185 + variation.y * .006;
        float age = max(0., progress - birth);
        float seconds = age * duration;
        float departure = pow(clamp(age / .46, 0., 1.), 1.12);
        float arrival = smoothstep(0., .014, age);
        float fade = 1. - smoothstep(.38 + variation.x * .08, .61 + variation.y * .06, progress);
        vec3 centre = vec3((petalOrigin - .5) * paperSize, .015);
        vec2 outward = radialOffset / max(.001, length(radialOffset));
        vec3 wind = vec3(
          outward.x * (1.5 + variation.x * 3.) + (variation.w - .5) * 1.1,
          outward.y * (1. + variation.y * 2.2) + 1.5 + variation.y * 1.4,
          1.8 + variation.z * 7.2
        );
        centre += wind * departure;
        centre.x += sin(seconds * 1.7 + variation.w * 6.283) * departure * .7;
        centre.y += sin(seconds * 1.3 + variation.x * 6.283) * departure * .5;

        vec3 leaf = position;
        leaf.z = .24 * position.x * position.x * 4. + .09 * sin((position.y + .5) * 3.14159);
        vec3 leafNormal = normalize(vec3(-1.92 * position.x, -.2827 * cos((position.y + .5) * 3.14159), 1.));
        mat3 tumble = rotateZ(variation.w * 6.283 + seconds * (variation.x - .5) * 2.4)
                    * rotateY(seconds * (1. + variation.y * 1.8))
                    * rotateX(seconds * (variation.z - .5) * 2.6);
        float size = petalSize * arrival * (1. + departure * .38);
        vec3 p = centre + tumble * leaf * size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
        vUv = uv;
        vNormal = normalize(normalMatrix * tumble * leafNormal);
        vAlpha = arrival * fade;
        vBlush = step(.62, variation.w) * (.35 + variation.x * .65);
      }`,
    fragmentShader: `
      uniform sampler2D petalMap;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vBlush;
      varying vec3 vNormal;
      void main() {
        vec4 paper = texture2D(petalMap, vUv);
        float alpha = paper.a * vAlpha;
        if (alpha < .035) discard;
        float light = .82 + .18 * abs(dot(normalize(vNormal), normalize(vec3(-.4, .7, 1.))));
        vec3 tint = mix(vec3(1., .985, .95), vec3(1., .73, .82), vBlush);
        gl_FragColor = vec4(paper.rgb * tint * light, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // Uniform textures are not found by the world's generic material-map scan.
  material.addEventListener('dispose', () => petalMap.dispose());
  const object = new THREE.Mesh(geometry, material);
  object.name = 'Invitation paper petals';
  object.position.set(0, 1.95, .3);
  object.frustumCulled = false;
  object.visible = false;
  object.renderOrder = 8;
  return {
    object,
    start(camera, { width = 3.05, height = 1.95, originX = .5, originY = .5 } = {}) {
      material.uniforms.progress.value = 0;
      material.uniforms.paperSize.value.set(
        Number.isFinite(width) && width > 0 ? width : 3.05,
        Number.isFinite(height) && height > 0 ? height : 1.95,
      );
      material.uniforms.dissolveOrigin.value.set(
        Number.isFinite(originX) ? THREE.MathUtils.clamp(originX, 0, 1) : .5,
        Number.isFinite(originY) ? THREE.MathUtils.clamp(originY, 0, 1) : .5,
      );
      object.quaternion.copy(camera.quaternion);
      object.visible = false;
    },
    update(progress, visible) {
      const p = Number.isFinite(progress) ? THREE.MathUtils.clamp(progress, 0, 1) : 1;
      material.uniforms.progress.value = p;
      object.visible = Boolean(visible) && p > .012 && p < .69;
    },
  };
}

function drawPetal() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  // A slender, asymmetric blossom petal: a rounded cap with only a tiny cleft,
  // then a long taper to the base. Avoid the two broad lobes of a heart icon.
  ctx.moveTo(65, 120);
  ctx.bezierCurveTo(54, 99, 36, 73, 38, 43);
  ctx.bezierCurveTo(39, 21, 50, 8, 61, 10);
  ctx.quadraticCurveTo(63, 11, 65, 15);
  ctx.lineTo(68, 10);
  ctx.bezierCurveTo(82, 10, 93, 25, 92, 47);
  ctx.bezierCurveTo(91, 75, 75, 105, 65, 120);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(37, 15, 91, 118);
  gradient.addColorStop(0, '#fffaf2');
  gradient.addColorStop(.5, '#fbede6');
  gradient.addColorStop(1, '#edcdd1');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.save(); ctx.clip();
  const vein = ctx.createLinearGradient(64, 20, 64, 115);
  vein.addColorStop(0, '#a97b8800');
  vein.addColorStop(1, '#a97b8830');
  ctx.strokeStyle = vein;
  ctx.lineWidth = .7;
  for (const offset of [-14, -7, 0, 7, 14]) {
    ctx.beginPath(); ctx.moveTo(64, 118);
    ctx.quadraticCurveTo(64 + offset * .25, 70, 64 + offset, 26);
    ctx.stroke();
  }
  ctx.restore();
  return canvas;
}
