import * as THREE from 'three';

// NASA SVS CGI Moon Kit: real LROC albedo and LOLA elevation data.
// Its lighting is independent of the nearby pink stage lights.
export function createMoon() {
  const loader = new THREE.TextureLoader();
  const albedo = loader.load('/textures/moon/lroc-color-2k.jpg');
  albedo.colorSpace = THREE.SRGBColorSpace;
  const elevation = loader.load('/textures/moon/ldem-height-1k.jpg');
  albedo.wrapS = elevation.wrapS = THREE.RepeatWrapping;
  const material = new THREE.ShaderMaterial({
    name: 'Lunar regolith',
    defines: { USE_BUMPMAP: '' },
    uniforms: {
      lunarMap: { value: albedo },
      bumpMap: { value: elevation },
      bumpScale: { value: .055 },
      sunDirection: { value: new THREE.Vector3(-.15, .42, 1).normalize() },
    },
    vertexShader: /* glsl */`
      uniform vec3 sunDirection;
      varying vec2 vBumpMapUv;
      varying vec3 vMoonNormal;
      varying vec3 vMoonPosition;
      varying vec3 vSunDirection;
      void main() {
        vBumpMapUv = uv;
        vMoonNormal = normalize(normalMatrix * normal);
        vSunDirection = mat3(viewMatrix) * sunDirection;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vMoonPosition = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D lunarMap;
      varying vec2 vBumpMapUv;
      varying vec3 vMoonNormal;
      varying vec3 vMoonPosition;
      varying vec3 vSunDirection;
      #include <bumpmap_pars_fragment>
      void main() {
        vec3 normal = perturbNormalArb(vMoonPosition, normalize(vMoonNormal), dHdxy_fwd(), 1.0);
        vec3 viewDirection = normalize(-vMoonPosition);
        float incidence = dot(normal, normalize(vSunDirection));
        float emission = max(dot(normal, viewDirection), 0.0);
        float sun = max(incidence, 0.0);
        // Lunar dust scatters differently from a glossy or purely Lambertian ball.
        float regolith = mix(sun, sun / max(sun + emission, .04), .72);
        float day = smoothstep(-.015, .045, incidence);
        vec3 surface = texture2D(lunarMap, vBumpMapUv).rgb;
        vec3 lit = surface * (regolith * 1.85 * day + .018);
        // A little foreground haze integrates the limb without blurring the maria.
        vec3 sky = vec3(.0055, .0065, .012);
        float haze = .075 + .055 * pow(1.0 - emission, 3.0);
        gl_FragColor = vec4(mix(lit * vec3(.96, .98, 1.0), sky, haze), 1.0);
        #include <colorspace_fragment>
      }
    `,
    fog: false,
    toneMapped: false,
  });
  material.addEventListener('dispose', () => { albedo.dispose(); elevation.dispose(); });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.05, 64, 48), material);
  moon.name = 'Moon — NASA LROC / LOLA';
  moon.position.set(-3.8, 4.1, -8.5);
  // Face the familiar, Earth-facing hemisphere toward the resting camera.
  moon.rotation.set(.025, -1.085, -.09);
  return moon;
}
