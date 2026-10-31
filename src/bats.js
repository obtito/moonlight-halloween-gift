import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The long body points along local -Z. Wings beat vertically, with a flexible
// wrist/membrane, instead of facing the viewer as flat decorative icons.
export function createBats() {
  const object = new THREE.Group(); object.name = 'Distant flying bats';
  const wingSource = createMembrane();
  const bodyGeometry = createBody();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#211c20', roughness: 1 });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: '#4b4148', roughness: 1, metalness: 0,
    emissive: '#231e28', emissiveIntensity: .10,
    vertexColors: true, side: THREE.DoubleSide,
  });
  // Different depths, routes, speeds and phases keep the flock loose.
  const routes = [
    [-4.8, 4.5, -7.3, 1.6, .75, .38, .23, .55],
    [-2.6, 4.8, -8.0, 1.5, .85, .24, -.21, 2.30],
    [-.9, 3.9, -6.4, 1.45, .70, .35, .27, 4.00],
    [-4.5, 3.4, -6.8, 1.3, .80, .23, -.25, 5.10],
    [.25, 4.55, -8.1, 1.3, .65, .19, .24, 1.25],
    [-6.0, 4.0, -8.6, 1.1, .60, .18, .29, 3.20],
    [1.25, 3.8, -7.0, 1.4, .80, .24, -.23, .15],
  ];
  const bats = routes.map(([x, y, z, radiusX, radiusZ, size, speed, phase], index) => {
    const bat = new THREE.Group(); bat.scale.setScalar(size); bat.rotation.order = 'YXZ';
    bat.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
    const geometry = wingSource.clone();
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const rest = geometry.attributes.position.array.slice();
    const wings = [-1, 1].map(side => {
      const pivot = new THREE.Group(); pivot.scale.x = side;
      pivot.add(new THREE.Mesh(geometry, wingMaterial)); bat.add(pivot);
      return { pivot, side };
    });
    object.add(bat);
    return { bat, geometry, rest, wings, x, y, z, radiusX, radiusZ, speed, phase, beatRate: 2.15 + index * .095 };
  });
  wingSource.dispose();

  let previousTime = NaN;
  function update(time = 0) {
    if (time === previousTime) return;
    previousTime = time;
    for (const b of bats) {
      const angle = time * b.speed + b.phase;
      const velocityX = Math.cos(angle) * b.radiusX * b.speed;
      const velocityZ = -Math.sin(angle) * b.radiusZ * b.speed;
      const velocityY = Math.cos(angle * 2 + b.phase) * .28 * b.speed;
      const horizontalSpeed = Math.hypot(velocityX, velocityZ);
      const bank = THREE.MathUtils.clamp(-b.speed * b.radiusX * b.radiusZ / (horizontalSpeed / Math.abs(b.speed)) ** 2 * .95, -.38, .38);
      const cycle = time * b.beatRate * Math.PI * 2 + b.phase * 3.7;
      const flap = .18 + Math.sin(cycle) * .88;
      const fold = Math.max(0, Math.cos(cycle)); // Reduce wing area on the return stroke.
      b.bat.position.set(
        b.x + Math.sin(angle) * b.radiusX,
        b.y + Math.sin(angle * 2 + b.phase) * .14 + Math.sin(cycle - .5) * .012,
        b.z + Math.cos(angle) * b.radiusZ,
      );
      // A modest angle of attack reveals the underside at this low sky angle.
      b.bat.rotation.set(.22 + Math.atan2(velocityY, horizontalSpeed), Math.atan2(-velocityX, -velocityZ), bank, 'YXZ');
      for (const { pivot, side } of b.wings) pivot.rotation.z = side * (flap + bank * side * .16);
      const position = b.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = b.rest[i * 3], y = b.rest[i * 3 + 1], z = b.rest[i * 3 + 2];
        const wrist = THREE.MathUtils.smoothstep(x, .30, .93);
        position.setXYZ(i,
          x - fold * wrist * .24,
          y + Math.sin(cycle - .65) * wrist * .13,
          z + fold * wrist * .22,
        );
      }
      position.needsUpdate = true;
      b.geometry.computeVertexNormals();
    }
  }
  update(0);
  return { object, update };
}

function createBody() {
  const parts = [];
  function ellipsoid(x, y, z, sx, sy, sz) {
    const geometry = new THREE.SphereGeometry(1, 10, 8);
    geometry.scale(sx, sy, sz); geometry.translate(x, y, z); parts.push(geometry);
  }
  ellipsoid(0, 0, .025, .065, .060, .16);
  ellipsoid(0, .008, -.137, .061, .047, .065);
  // Small rounded ears preserve the silhouette without a cartoon face.
  for (const side of [-1, 1]) ellipsoid(side * .041, .046, -.148, .023, .049, .016);
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose()); return geometry;
}

function createMembrane() {
  const outline = new THREE.Shape();
  outline.moveTo(.045, -.075);
  outline.quadraticCurveTo(.17, -.22, .36, -.245);
  outline.quadraticCurveTo(.62, -.25, .93, -.36);
  outline.quadraticCurveTo(.83, -.13, .75, .055);
  outline.quadraticCurveTo(.58, -.015, .50, .22);
  outline.quadraticCurveTo(.33, .12, .28, .30);
  outline.quadraticCurveTo(.15, .18, .045, .17);
  outline.closePath();
  const flat = new THREE.ShapeGeometry(outline, 9).toNonIndexed();
  // Split the large triangles so the membrane curves through the wrist.
  const source = flat.attributes.position, vertices = [];
  const midpoint = (a, b) => a.map((v, i) => (v + b[i]) * .5);
  const split = (a, b, c) => {
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    for (const v of [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca]) vertices.push(...v);
  };
  for (let i = 0; i < source.count; i += 3) {
    split(...[0, 1, 2].map(j => [source.getX(i + j), source.getY(i + j), 0]));
  }
  flat.dispose();
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.Float32BufferAttribute(vertices, 3);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), sweep = position.getY(i);
    const camber = Math.sin((x - .045) / .885 * Math.PI) * .045;
    position.setXYZ(i, x, camber, sweep);
    const shade = .78 + .22 * Math.max(0, 1 - Math.abs(sweep + .16) * 2);
    colors.set([shade, shade * .96, shade * .98], i * 3);
  }
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // A conservative bound covers the complete wingbeat, avoiding edge popping.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(.45, 0, 0), .80);
  return geometry;
}
