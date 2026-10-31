import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Small pools of warm light sit among the pumpkins; the central model slot stays clear.
export function createHalloweenCandles({ glowTexture, reducedMotion = false } = {}) {
  const object = new THREE.Group();
  object.name = 'Halloween candlelight';
  const waxParts = [], bronzeParts = [], wickParts = [], flames = [];
  const specifications = [
    [-1.85, 1.35, .48, .074],
    [-2.48, -.85, .58, .078],
    [2.85, .85, .32, .068],
    [2.55, -.45, .54, .081],
    [.65, -2.35, .28, .065],
  ];
  const flameGeometry = createFlameGeometry();
  const outerMaterial = new THREE.MeshBasicMaterial({ color: '#ffaf42', transparent: true, opacity: .68, depthWrite: false, toneMapped: false });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: '#fff4ce', toneMapped: false });

  function place(parts, geometry, x, y, z, rotateX = 0) {
    if (rotateX) geometry.rotateX(rotateX);
    geometry.translate(x, y, z);
    // The static pieces are merged and their temporary geometry released below.
    parts.push(geometry);
  }

  specifications.forEach(([x, z, height, radius], index) => {
    const bottom = .044;
    const wax = new THREE.CylinderGeometry(radius * .97, radius, height, 24, 6);
    const vertices = wax.attributes.position;
    for (let v = 0; v < vertices.count; v++) {
      const px = vertices.getX(v), pz = vertices.getZ(v);
      const angle = Math.atan2(pz, px);
      const upper = Math.pow(Math.max(0, vertices.getY(v) / height + .5), 9);
      const edge = Math.min(1, Math.hypot(px, pz) / radius);
      vertices.setY(v, vertices.getY(v) + upper * edge * (.005 * Math.sin(angle * 3 + index) + .004 * Math.sin(angle * 5 - index)));
    }
    wax.computeVertexNormals();
    place(waxParts, wax, x, bottom + height / 2, z);
    place(waxParts, new THREE.CylinderGeometry(radius * 1.07, radius * 1.16, .013, 24), x, bottom + .004, z);
    for (let drip = 0; drip < 4; drip++) {
      const angle = index * 1.13 + drip * 1.63;
      const length = height * (.13 + ((index + drip * 3) % 7) * .027);
      const dripRadius = radius * (.11 + (drip % 2) * .025);
      place(waxParts, new THREE.CapsuleGeometry(dripRadius, length, 3, 6),
        x + Math.sin(angle) * radius * .96,
        bottom + height - length / 2 - .008,
        z + Math.cos(angle) * radius * .96);
    }
    place(bronzeParts, new THREE.CylinderGeometry(radius * 1.55, radius * 1.21, .025, 24), x, .022, z);
    place(bronzeParts, new THREE.TorusGeometry(radius * 1.42, .01, 6, 24), x, .039, z, Math.PI / 2);
    place(bronzeParts, new THREE.CylinderGeometry(radius * 1.08, radius * 1.18, .014, 20), x, .009, z);
    place(wickParts, new THREE.CylinderGeometry(.004, .004, .035, 5), x, bottom + height + .013, z);
    place(wickParts, new THREE.CylinderGeometry(radius * .22, radius * .22, .003, 12), x, bottom + height + .001, z);

    const flame = new THREE.Group();
    flame.position.set(x, bottom + height + .021, z);
    const outer = new THREE.Mesh(flameGeometry, outerMaterial);
    flame.add(outer);
    const core = new THREE.Mesh(flameGeometry, coreMaterial);
    core.scale.set(.49, .63, .49);
    core.position.y = .004;
    flame.add(core);
    flame.scale.setScalar(.89 + index % 3 * .07);
    object.add(flame);

    let glow;
    if (glowTexture) {
      glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: '#ffa741', transparent: true,
        opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending,
        toneMapped: false,
      }));
      glow.position.copy(flame.position).y += .055;
      glow.scale.setScalar(.54);
      object.add(glow);
    }
    flames.push({ flame, glow, phase: index * 2.39996, baseScale: flame.scale.x });
  });

  function mergedMesh(parts, material) {
    // Only position and normal are needed; the source shapes have different UV layouts.
    parts.forEach(geometry => { geometry.deleteAttribute('uv'); });
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    parts.forEach(geometry => geometry.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
    return mesh;
  }
  mergedMesh(waxParts, new THREE.MeshStandardMaterial({
    color: '#e5cfaa', roughness: .88,
    emissive: '#4d2508', emissiveIntensity: .13,
  }));
  mergedMesh(bronzeParts, new THREE.MeshStandardMaterial({
    color: '#6a4b29', metalness: .78, roughness: .39,
  }));
  mergedMesh(wickParts, new THREE.MeshBasicMaterial({ color: '#362315' }));

  function update(elapsed = 0, reveal = 1) {
    const time = reducedMotion ? 0 : elapsed;
    const visibility = .36 + THREE.MathUtils.clamp(reveal, 0, 1) * .64;
    flames.forEach(({ flame, glow, phase, baseScale }) => {
      const flicker = Math.sin(time * 6.9 + phase) * .035 + Math.sin(time * 11.3 + phase * 1.7) * .025;
      flame.scale.set(baseScale * (1 - flicker * .4), baseScale * (1 + flicker), baseScale * (1 - flicker * .4));
      flame.rotation.z = Math.sin(time * 3.1 + phase) * .035;
      if (glow) {
        glow.material.opacity = (.21 + flicker * .5) * visibility;
        glow.scale.setScalar(.54 * (1 + flicker * .35));
      }
    });
  }
  update(0, 0);
  return { object, update };
}

function createFlameGeometry() {
  const profile = [
    [0, 0], [.014, .007], [.025, .03], [.027, .055],
    [.022, .085], [.013, .115], [.005, .145], [0, .17],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(profile, 12);
  const vertices = geometry.attributes.position;
  for (let v = 0; v < vertices.count; v++) {
    const bend = Math.pow(vertices.getY(v) / .17, 2) * .014;
    vertices.setX(v, vertices.getX(v) + bend);
  }
  geometry.computeVertexNormals();
  return geometry;
}
