import * as THREE from 'three';

let sharedMaps;
let skinVariant = 0;
function surfaceMaps() {
  if (sharedMaps) return sharedMaps;
  const loader = new THREE.TextureLoader();
  const load = (name, color = false) => {
    const texture = loader.load(`${import.meta.env.BASE_URL}textures/pumpkin/${name}`);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  sharedMaps = {
    color: [load('skin-color-0.png', true), load('skin-color-1.png', true)],
    height: load('skin-height.png'),
    roughness: load('skin-roughness.png'),
    stemColor: load('stem-color.png', true),
    stemHeight: load('stem-height.png'),
  };
  return sharedMaps;
}

/** A rounded, ribbed pumpkin. Its body rests on local y=0. */
export function createPumpkin({ size = .45, color = '#c77832', face = true, rotation = 0 } = {}) {
  const group = new THREE.Group();
  const maps = surfaceMaps();
  group.name = 'Halloween pumpkin';
  group.userData.pumpkinSize = size;
  group.rotation.y = rotation;
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const angle = Math.atan2(z, x), radial = Math.hypot(x, z);
    const rib = Math.cos(angle * 8);
    const width = .96 * (1 + .065 * rib) * (1 - .025 * Math.max(y, 0));
    const height = Math.max(0, .94 + .98 * y - (y > 0 ? .09 * Math.exp(-radial * radial / .12) : 0));
    position.setXYZ(i, x * width * size, height * size, z * width * size);
    const shade = .96 + .04 * rib;
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .88),
    map: maps.color[skinVariant++ % maps.color.length],
    bumpMap: maps.height,
    bumpScale: size * .015,
    roughnessMap: maps.roughness,
    vertexColors: true,
    roughness: .94,
    metalness: 0,
  }));
  group.add(body);

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.77, 0), new THREE.Vector3(.035, 1.94, .015),
    new THREE.Vector3(.08, 2.08, -.02), new THREE.Vector3(.045, 2.17, -.045),
  ].map(v => v.multiplyScalar(size)));
  const stemGeometry = new THREE.TubeGeometry(stemCurve, 14, size * .074, 8, false);
  const stemVertices = stemGeometry.attributes.position;
  for (let ring = 0; ring <= 14; ring++) {
    const center = stemCurve.getPointAt(ring / 14);
    const taper = 1 - ring / 14 * .43;
    for (let side = 0; side <= 8; side++) {
      const i = ring * 9 + side;
      const vertex = new THREE.Vector3().fromBufferAttribute(stemVertices, i).sub(center).multiplyScalar(taper).add(center);
      stemVertices.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
  }
  stemGeometry.computeVertexNormals();
  group.add(new THREE.Mesh(stemGeometry, new THREE.MeshStandardMaterial({ color: '#e0d2ac', map: maps.stemColor, bumpMap: maps.stemHeight, bumpScale: size * .009, roughness: .93 })));
  const vinePoints = [[.02, 1.95, .02], [-.13, 2.04, .05], [-.28, 2.04, .09], [-.32, 1.95, .13], [-.24, 1.91, .15], [-.19, 1.96, .15]];
  const vineCurve = new THREE.CatmullRomCurve3(vinePoints.map(p => new THREE.Vector3(...p).multiplyScalar(size)));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(vineCurve, 20, size * .013, 5, false), new THREE.MeshStandardMaterial({ color: '#6a7046', roughness: .85 })));

  if (face) {
    const dark = new THREE.MeshStandardMaterial({ color: '#432615', roughness: 1 });
    const glow = new THREE.MeshStandardMaterial({ color: '#ebb35f', emissive: '#e28a28', emissiveIntensity: .42, roughness: .72 });
    const features = [
      [[-.47, 1.15], [-.18, 1.15], [-.33, 1.44]],
      [[.18, 1.15], [.47, 1.15], [.33, 1.44]],
      [[-.56, .90], [-.30, .79], [-.12, .86], [.07, .78], [.28, .86], [.56, .92], [.43, .61], [.20, .50], [0, .47], [-.23, .52], [-.43, .65]],
    ];
    for (const points of features) {
      group.add(new THREE.Mesh(faceGeometry(points, size, .017), dark));
      const center = points.reduce((v, p) => [v[0] + p[0] / points.length, v[1] + p[1] / points.length], [0, 0]);
      const inner = points.map(p => [center[0] + (p[0] - center[0]) * .79, center[1] + (p[1] - center[1]) * .79]);
      group.add(new THREE.Mesh(faceGeometry(inner, size, .023), glow));
    }
  }
  group.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return group;
}

// Subdivide then conform to the curved shell, so wide smiles stay visible.
function faceGeometry(points, size, offset) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
  shape.closePath();
  const flat = new THREE.ShapeGeometry(shape);
  const p = flat.attributes.position, indices = flat.index.array, vertices = [];
  const project = point => {
    const [x, y] = point;
    const unitY = THREE.MathUtils.clamp((y - .94) / .98, -.99, .99);
    const radial = Math.sqrt(1 - unitY * unitY) * .96 * (1 - .025 * Math.max(unitY, 0));
    let low = 0, high = radial * 1.1;
    for (let i = 0; i < 15; i++) {
      const z = (low + high) / 2;
      const r = radial * (1 + .065 * Math.cos(Math.atan2(z, x) * 8));
      if (x * x + z * z > r * r) high = z; else low = z;
    }
    return [x * size, y * size, ((low + high) / 2 + offset) * size];
  };
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function triangle(a, b, c, depth) {
    if (!depth) { vertices.push(...project(a), ...project(b), ...project(c)); return; }
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1);
    triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const v = [0, 1, 2].map(j => [p.getX(indices[i + j]), p.getY(indices[i + j])]);
    triangle(...v, 3);
  }
  flat.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  result.computeVertexNormals();
  return result;
}
