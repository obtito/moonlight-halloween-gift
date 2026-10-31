import * as THREE from 'three';

/** Small characters at the edges of the stage, using the world's shared clock. */
export function createHalloweenCompanions({ reducedMotion = false } = {}) {
  const object = new THREE.Group(); object.name = 'Little cloth ghosts';
  const fabric = createFabricMap();
  const ghosts = [
    createGhost({ x: 2.08, y: 1.62, z: -.85, scale: .76, phase: .5, yaw: .40, fabric }),
    createGhost({ x: -3.2, y: 2.15, z: -1.7, scale: .46, phase: 2.7, yaw: .65, fabric }),
  ];
  ghosts.forEach(ghost => object.add(ghost.object));
  return { object, update(elapsed = 0) {
    const time = reducedMotion ? 0 : elapsed;
    ghosts.forEach(ghost => ghost.update(time));
  } };
}

function createGhost({ x, y, z, scale, phase, yaw, fabric }) {
  const object = new THREE.Group(); object.name = 'Little floating cloth ghost';
  object.scale.setScalar(scale);
  const curve = new THREE.SplineCurve([
    [.35, 0], [.335, .10], [.30, .30], [.28, .54],
    [.262, .68], [.22, .81], [.14, .90], [.025, .944], [0, .946],
  ].map(([radius, height]) => new THREE.Vector2(radius, height)));
  const profile = curve.getPoints(56).map(point => new THREE.Vector2(Math.max(0, point.x), point.y));
  const geometry = new THREE.LatheGeometry(profile, 72);
  const position = geometry.attributes.position;
  const rest = position.array.slice();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lower = Math.max(0, 1 - position.getY(i) / .946);
    const shade = 1 - lower ** 3 * .12;
    colors.set([shade, shade, shade * .99], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ebe7e3', roughness: .96, metalness: 0,
    sheen: .55, sheenColor: '#c9bed8', sheenRoughness: .85,
    bumpMap: fabric, bumpScale: .006, vertexColors: true,
    emissive: '#302b38', emissiveIntensity: .06,
    transparent: true, opacity: .96, depthWrite: true,
    side: THREE.DoubleSide,
  });
  // Actual openings in the fabric, with recessed dark cavities behind them.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vGhostLocal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGhostLocal = position;');
    shader.fragmentShader = 'varying vec3 vGhostLocal;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
      #include <alphatest_fragment>
      if (vGhostLocal.z > .12) {
        float leftEye = length((vGhostLocal.xy - vec2(-.084, .668)) / vec2(.038, .056));
        float rightEye = length((vGhostLocal.xy - vec2(.084, .655)) / vec2(.036, .053));
        float mouth = length((vGhostLocal.xy - vec2(.0, .535)) / vec2(.026, .034));
        if (min(min(leftEye, rightEye), mouth) < 1.0) discard;
      }
    `);
  };
  material.customProgramCacheKey = () => 'woven-ghost-openings-v1';
  const cloth = new THREE.Mesh(geometry, material); object.add(cloth);
  const faceMaterial = new THREE.MeshStandardMaterial({ color: '#24212b', roughness: 1 });
  const hemMaterial = new THREE.MeshStandardMaterial({ color: '#dfd9d6', roughness: .96, bumpMap: fabric, bumpScale: .004 });
  const eyeGeometry = new THREE.SphereGeometry(1, 16, 12);
  function radiusAt(height) {
    const i = profile.findIndex(point => point.y >= height);
    if (i <= 0) return profile[Math.max(0, i)].x;
    const a = profile[i - 1], b = profile[i];
    return THREE.MathUtils.lerp(a.x, b.x, (height - a.y) / Math.max(.0001, b.y - a.y));
  }
  function opening(cx, cy, width, height) {
    const eye = new THREE.Mesh(eyeGeometry, faceMaterial);
    eye.scale.set(width * 1.3, height * 1.25, .018);
    const depth = Math.sqrt(Math.max(0, radiusAt(cy) ** 2 - cx ** 2));
    eye.position.set(cx, cy, depth - .028); object.add(eye);
    const edge = [];
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const px = cx + Math.cos(a) * width * 1.10, py = cy + Math.sin(a) * height * 1.06;
      edge.push(new THREE.Vector3(px, py, Math.sqrt(Math.max(0, radiusAt(py) ** 2 - px ** 2)) + .004));
    }
    const curve = new THREE.CatmullRomCurve3(edge, true);
    object.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .0042, 5, true), hemMaterial));
  }
  opening(-.084, .668, .038, .056);
  opening(.084, .655, .036, .053);
  opening(0, .535, .026, .034);
  const hemPoints = Array.from({ length: 73 }, (_, i) => {
    const a = i / 72 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * .35, 0, Math.sin(a) * .35);
  });
  const hemGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPoints, true), 96, .007, 6, true);
  const hemPosition = hemGeometry.attributes.position, hemRest = hemPosition.array.slice();
  object.add(new THREE.Mesh(hemGeometry, hemMaterial));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  hemPosition.setUsage(THREE.DynamicDrawUsage);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .47, 0), .70);
  let previousTime = NaN;
  function update(time) {
    if (time === previousTime) return;
    previousTime = time;
    object.position.set(x + Math.sin(time * .36 + phase) * .07, y + Math.sin(time * .78 + phase) * .09, z + Math.cos(time * .29 + phase) * .07);
    object.rotation.set(Math.sin(time * .57 + phase) * .025, yaw + Math.sin(time * .32 + phase) * .15, Math.sin(time * .61 + phase) * .045);
    function drape(attribute, original) {
      for (let i = 0; i < attribute.count; i++) {
      const px = original[i * 3], py = original[i * 3 + 1], pz = original[i * 3 + 2];
      const angle = Math.atan2(pz, px), lower = Math.max(0, 1 - py / .946);
      const folds = Math.cos(angle * 7 + lower * 1.6) * .078 + Math.sin(angle * 11 + .5) * .026;
      const billow = Math.sin(angle * 3 + time * 1.2 + phase) * .045;
      const radial = 1 + (folds + billow) * lower ** 1.5;
      const hem = (Math.sin(angle * 5 + phase) * .038 + Math.cos(angle * 3 + .6) * .014) * lower ** 5;
      const flutter = Math.sin(angle * 4 - time * 1.35 + phase) * .019 * lower ** 4;
      attribute.setXYZ(i, px * radial, py + hem + flutter, pz * radial);
      }
      attribute.needsUpdate = true;
    }
    drape(position, rest); drape(hemPosition, hemRest);
    geometry.computeVertexNormals(); hemGeometry.computeVertexNormals();
  }
  update(0);
  return { object, update };
}

function createFabricMap() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d'), pixels = context.createImageData(512, 512);
  let seed = 1412;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const warp = Math.cos(x / 8 * Math.PI * 2), weft = Math.cos(y / 8 * Math.PI * 2);
    const over = ((x >> 3) + (y >> 3)) % 2;
    const value = 146 + (over ? warp * 22 + weft * 7 : weft * 22 + warp * 7) + (seed / 4294967296 - .5) * 9;
    const i = (y * 512 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 1.5); texture.anisotropy = 4;
  return texture;
}
