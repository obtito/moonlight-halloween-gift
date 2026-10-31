import * as THREE from 'three';
import { createBats } from './bats.js';
import { createHalloweenCompanions } from './halloween-companions.js';

/** Native scene decorations; the caller owns visibility and the shared frame clock. */
export function createHalloweenAtmosphere({ reducedMotion = false } = {}) {
  const object = new THREE.Group();
  object.name = 'Halloween night — bats, cobweb and ground mist';
  const bats = createBats(); object.add(bats.object);
  const cobweb = createCobweb(); object.add(cobweb);
  const mist = createMist(); object.add(mist);
  const companions = createHalloweenCompanions({ reducedMotion }); object.add(companions.object);
  const candleLights = [-1, 1].map(side => {
    const light = new THREE.PointLight('#ffab54', 2.5, 3.5, 2);
    light.position.set(side * 2.1, .55, .9); object.add(light); return light;
  });
  return {
    object,
    update(elapsed, reveal) {
      const time = reducedMotion ? 0 : elapsed;
      bats.update(time);
      companions.update(time);
      mist.material.uniforms.time.value = time;
      mist.material.uniforms.reveal.value = reveal;
      candleLights.forEach((light, index) => {
        light.intensity = (1.1 + reveal * 1.8) * (1 + Math.sin(time * 2.6 + index * 1.8) * .045);
      });
    },
  };
}

function createCobweb() {
  const object = new THREE.Group(); object.name = 'Silver cobweb on a wrought iron stand';
  object.position.set(-2.55, .015, -.9); object.rotation.y = .34;
  const metal = new THREE.MeshStandardMaterial({ color: '#35303c', metalness: .72, roughness: .46 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.022, .033, 1.66, 10), metal);
  pole.position.set(-.37, .83, 0); object.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .84, 10), metal);
  arm.rotation.z = Math.PI / 2; arm.position.set(.03, 1.66, 0); object.add(arm);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.15, .19, .045, 20), metal);
  foot.position.set(-.37, .012, 0); object.add(foot);
  const points = [];
  const center = new THREE.Vector3(-.37, 1.66, .014);
  const at = (angle, radius) => new THREE.Vector3(center.x + Math.cos(angle) * radius, center.y - Math.sin(angle) * radius, center.z);
  const segment = (a, b) => points.push(a, b);
  for (let spoke = 0; spoke < 7; spoke++) segment(center, at(spoke / 6 * Math.PI / 2, .75));
  for (let ring = 1; ring <= 5; ring++) {
    const radius = ring * .145;
    for (let spoke = 0; spoke < 6; spoke++) {
      const a = spoke / 6 * Math.PI / 2, b = (spoke + 1) / 6 * Math.PI / 2;
      const middle = at((a + b) / 2, radius * .94);
      segment(at(a, radius), middle); segment(middle, at(b, radius));
    }
  }
  segment(new THREE.Vector3(.36, 1.66, .014), new THREE.Vector3(.36, .92, .014));
  const thread = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#bdb3c9', transparent: true, opacity: .42 }));
  object.add(thread);
  const spider = new THREE.Group(); spider.position.set(.36, .88, .014);
  const spiderMaterial = new THREE.MeshStandardMaterial({ color: '#28202c', roughness: .8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(.047, 12, 8), spiderMaterial); body.scale.y = 1.25; spider.add(body);
  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const y = .035 - i * .025;
    const a = new THREE.Vector3(side * .028, y, 0), b = new THREE.Vector3(side * .075, y + .025, 0), c = new THREE.Vector3(side * .10, y - .025, 0);
    legs.push(a, b, b, c);
  }
  spider.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(legs), new THREE.LineBasicMaterial({ color: '#7b647e' })));
  object.add(spider); return object;
}

function createMist() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, reveal: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: /* glsl */`
      uniform float time; uniform float reveal; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 p=(vUv-.5)*2.; float radius=length(p*vec2(1.,1.08));
        float band=smoothstep(.40,.60,radius)*(1.-smoothstep(.75,1.,radius));
        vec2 flow=vUv*6.+vec2(time*.026,time*-.017);
        float clouds=noise(flow)*.6+noise(flow*2.1)*.28+noise(flow*4.3)*.12;
        float alpha=band*smoothstep(.23,.76,clouds)*(.055+.10*reveal);
        gl_FragColor=vec4(vec3(.23,.22,.30),alpha);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 12.5), material);
  mist.name = 'Slow ground mist outside the stage'; mist.rotation.x = -Math.PI / 2; mist.position.y = -.21;
  return mist;
}
