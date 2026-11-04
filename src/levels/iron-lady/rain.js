import * as THREE from 'three';
import { makeRng, rand, range } from '../../rng.js';
import { ringTexture } from '../../textures.js';
import { fogShared } from '../../atmosphere.js';

// =====================================================================================
//  Drizzle: GPU rain streaks in a box that wraps around the head (one draw, no CPU per drop),
//  slanted by the wind and stretched along their fall direction, brighter where they catch the
//  warm city light low in the frame; plus little splash rings on the cobbles / river around you
//  (one instanced draw). VR-safe: streaks fade out within 1.2 m of the eye.
// =====================================================================================
const BOX = new THREE.Vector3(26, 16, 26);

export class Rain {
  constructor(scene, { quest = false, ground, fog } = {}) {
    this.ground = ground;
    const N = quest ? 1100 : 2400;
    const rng = makeRng(77);
    // one streak = a quad: corner.x = side (-1..1), corner.y = along (0 = head, 1 = tail)
    const base = new THREE.InstancedBufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    base.setIndex([0, 1, 2, 0, 2, 3]);
    const off = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { off[i * 4] = rng() * BOX.x; off[i * 4 + 1] = rng() * BOX.y; off[i * 4 + 2] = rng() * BOX.z; off[i * 4 + 3] = rng(); }
    base.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    base.instanceCount = N;
    this.u = {
      uTime: { value: 0 }, uEye: { value: new THREE.Vector3() }, uBox: { value: BOX }, uWind: { value: new THREE.Vector3(1.6, -9.5, 0.7) },
      uK: { value: 1 }, fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */`
        attribute vec4 aOff;
        uniform float uTime; uniform vec3 uEye; uniform vec3 uBox; uniform vec3 uWind;
        varying float vA; varying vec2 vQ; varying float vD;
        void main() {
          vec3 v = uWind * (0.85 + 0.3 * aOff.w);
          vec3 p = aOff.xyz + v * uTime;
          p = mod(p - uEye + uBox * 0.5, uBox) - uBox * 0.5 + uEye;
          vec3 dir = normalize(v);
          float len = 0.42 + 0.25 * aOff.w;
          vec3 toEye = normalize(uEye - p);
          vec3 side = normalize(cross(dir, toEye)) * 0.011;
          vec3 wp = p + side * position.x - dir * len * position.y;
          vD = distance(uEye, p);
          vA = smoothstep(1.2, 3.0, vD) * (1.0 - smoothstep(9.0, 13.0, vD));
          vQ = position.xy;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uK; varying float vA; varying vec2 vQ; varying float vD;
        void main() {
          float a = (1.0 - abs(vQ.x)) * (1.0 - vQ.y) * vA * 0.3 * uK;
          // a cool sheen with a hint of the sodium glow
          gl_FragColor = vec4(vec3(0.75, 0.78, 0.86) * a, 0.0);   // purely additive: no dark specks over fire / bright glows
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, fog: false,
    });
    this.mesh = new THREE.Mesh(base, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 30;
    scene.add(this.mesh);
    // splashes: tiny rings on whatever is under them
    const M = quest ? 60 : 140;
    this.rings = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0x8e96a4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: true }), M);
    this.rings.frustumCulled = false; this.rings.renderOrder = 5;
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(M * 3), 3);
    scene.add(this.rings);
    this.drops = Array.from({ length: M }, () => ({ t: rand() * 0.8, life: 0.5, p: new THREE.Vector3(), s: 0.2 }));
    this.k = 1;
  }
  set intensity(k) { this.k = k; this.u.uK.value = k; }
  update(dt, eye, camera) {
    this.u.uTime.value += dt;
    this.u.uEye.value.copy(eye);
    this.u.fogNear.value = this.u.fogNear.value; // (fog is shared by reference for colour)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
    let i = 0;
    for (const d of this.drops) {
      d.t += dt;
      if (d.t > d.life) {
        d.t = 0; d.life = range(0.25, 0.45); d.s = range(0.12, 0.26);
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 9 + 0.6;
        d.p.set(eye.x + Math.cos(a) * r, 0, eye.z + Math.sin(a) * r);
        d.p.y = this.ground(d.p.x, d.p.z) + 0.02;
        if (d.p.y < eye.y - 9) d.life = 0; // nothing under it nearby (over the edge)
      }
      const k = d.t / d.life;
      m.compose(d.p, q, s.setScalar(d.s * (0.3 + k * 1.2)));
      this.rings.setMatrixAt(i, m);
      const a = (1 - k) * this.k;
      this.rings.instanceColor.setXYZ(i, a, a, a);
      i++;
    }
    this.rings.count = i;
    this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true;
  }
}
