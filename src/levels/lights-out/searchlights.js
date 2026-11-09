import * as THREE from 'three';
import { CELL } from '../../particles.js';
import { range, rand, clamp, damp } from '../../rng.js';
import { fogShared } from '../../atmosphere.js';

// =====================================================================================
//  Searchlights on generators (after the blackout they are the only white light in the city):
//  a hard lamp on a mount, a long beam through the fog. They sweep; when the beam holds on you they
//  LOCK and the shooters tied to that light get much better at hitting you. Shoot the lamp out:
//  sparks, glass, the beam dies, its shooters lose you for a while.
//  One instanced mesh for every beam (an open cone, additive, bright at the lamp and along the
//  axis, fading with length / at the edges / right in front of the eye), the lamps in a glow batch.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

export class Searchlights {
  constructor(game, max = 14) {
    this.g = game; this.max = max; this.list = [];
    const geo = new THREE.CylinderGeometry(1, 0.08, 1, 18, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    const fog = game.scene.fog;
    const mat = new THREE.ShaderMaterial({
      uniforms: { fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far }, uTime: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec4 iCol;            // rgb, len (m)
        varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vEye; varying vec3 vW;
        void main(){
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vAlong = position.z;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          vCol = iCol.rgb;
          vec4 mv = viewMatrix * w; vEye = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 fogColor; uniform float fogNear, fogFar, uTime;
        varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vEye; varying vec3 vW;
        float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
        void main(){
          // a soft core: brightest where you look through the most beam (the silhouette edge fades out)
          float edge = abs(dot(normalize(vN), vV));
          float core = pow(edge, 1.6);
          float along = (1.0 - smoothstep(0.0, 1.0, vAlong)) * (0.35 + 0.65 * exp(-vAlong * 3.0));
          // dust / fog drifting through the beam
          float n = 0.65 + 0.35 * vn(vW.xz * 0.15 + vec2(uTime * 0.3, vW.y * 0.1));
          float k = core * along * n * smoothstep(0.8, 6.0, vEye);
          float fogK = smoothstep(fogNear, fogFar * 1.4, vEye);
          vec3 c = vCol * k * (1.0 - fogK * 0.85) * 0.5;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    geo.setAttribute('iCol', this.aCol);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 17;
    game.scene.add(this.mesh);
    this.mat = mat;
  }
  // { p: Vector3 lamp, carrier?: {obj, local}, yaw0, pitch0, sweep: [yawAmp, pitchAmp, rate], len, spread (rad), shooters: [] }
  add(o) {
    const L = { p: o.p.clone(), carrier: o.carrier || null, yaw0: o.yaw0 ?? 0, pitch0: o.pitch0 ?? 0.6, sweep: o.sweep || [0.7, 0.25, 0.25], len: o.len ?? 160, spread: o.spread ?? 0.075,
      dir: new THREE.Vector3(), ph: rand() * 6, on: o.on ?? 1, k: 0, hp: o.hp ?? 3, dead: false, lock: 0, lockOn: false, shooters: o.shooters || [], track: 0, color: o.color || [3.2, 3.0, 2.6], blind: 0 };
    this.list.push(L);
    // shootable lamp
    const self = this, g = this.g;
    L.target = {
      active: () => !L.dead && L.k > 0.2,
      ray(o2, d) { const c = L.p; _v.subVectors(o2, c); const b = _v.dot(d), cc = _v.lengthSq() - 0.9 * 0.9, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; },
      hit(P) { L.hp--; g.fx.impact(P, _v2.subVectors(g.headPos, P).normalize(), 'glass'); g.hitMarker(false); if (L.hp <= 0) self.kill(L); },
      blast(P, r) { if (P.distanceTo(L.p) < r + 1) self.kill(L); },
      aim: () => L.p,
      auto: (head, A) => { const d = L.p.distanceTo(head); if (d > 120 || !L.lockOn) return null; return { kind: 'target', p: L.p.clone(), score: 70 + L.lock * 40 - d * 0.3, ref: L.target, tol: 0.03 }; },
    };
    g.targets.push(L.target);
    return L;
  }
  kill(L) {
    if (L.dead) return;
    const g = this.g;
    L.dead = true; L.lockOn = false; L.lock = 0;
    g.lightsOut++;
    g.addScore(300, 'LIGHTS OUT', L.p.clone().setY(L.p.y + 2), 'big');
    g.audio.play('impact_glass', { x: L.p.x, y: L.p.y, z: L.p.z, volume: 1, pitch: 0.8 });
    g.audio.play('fuel_whoomp', { x: L.p.x, y: L.p.y, z: L.p.z, volume: 0.4 });
    g.fx.main.spawn({ x: L.p.x, y: L.p.y, z: L.p.z, frame: CELL.FLASH, s0: 2, s1: 5, life: 0.12, r: 4, g: 3.8, b: 3.4, fadeIn: 0, fadeOut: 0.4 });
    for (let i = 0; i < 26; i++) g.fx.sparks.spawn({ x: L.p.x, y: L.p.y, z: L.p.z, vx: range(-5, 5), vy: range(-1, 6), vz: range(-5, 5), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.12, life: range(0.6, 1.6), r: 3, g: 2.6, b: 1.8, a: 1, fadeOut: 0.4 });
    // its shooters lose you
    for (const s of L.shooters) if (s.alive) { s.hitMul = 0.25; s.blindT = 6; }
    g.events.push({ type: 'searchlightDown', L });
  }
  update(dt) {
    const g = this.g, head = g.headPos;
    this.mat.uniforms.uTime.value = g.time;
    const fog = g.scene.fog; this.mat.uniforms.fogNear.value = fog.near; this.mat.uniforms.fogFar.value = fog.far;
    let n = 0;
    this.spotted = 0;
    for (const L of this.list) {
      if (L.carrier) { L.carrier.obj.updateMatrixWorld(); L.p.copy(L.carrier.local).applyMatrix4(L.carrier.obj.matrixWorld); }
      L.k = damp(L.k, L.dead ? 0 : L.on, L.dead ? 30 : 2, dt);
      if (L.k < 0.01) continue;
      // sweep, or track the player while locked
      L.ph += dt * L.sweep[2];
      const yaw = L.yaw0 + Math.sin(L.ph) * L.sweep[0], pitch = L.pitch0 + Math.sin(L.ph * 1.7 + 1) * L.sweep[1];
      _v.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      _v2.subVectors(head, L.p); const dist = _v2.length(); _v2.divideScalar(dist);
      const inBeam = dist < L.len && Math.acos(clamp(L.dir.dot(_v2), -1, 1)) < L.spread * 1.6 + 1.2 / Math.max(dist, 1);
      L.lock = clamp(L.lock + (inBeam ? dt * 0.9 : -dt * 0.5), 0, 1);
      if (L.lock > 0.55 && !L.lockOn) { L.lockOn = true; g.events.push({ type: 'spotted', L }); }
      if (L.lock < 0.1) L.lockOn = false;
      L.track = damp(L.track, L.lockOn ? 1 : (inBeam ? 0.6 : 0), 3, dt);
      L.dir.copy(_v).lerp(_v2, L.track).normalize();
      if (L.lockOn) this.spotted = Math.max(this.spotted, L.lock);
      for (const s of L.shooters) if (s.alive && !(s.blindT > 0)) s.hitMul = L.lockOn ? 2.6 : 1;
      for (const s of L.shooters) if (s.blindT > 0) s.blindT -= dt;
      if (n >= this.max) continue;
      const len = L.len, rad = Math.tan(L.spread) * len;
      _q.setFromUnitVectors(Z, L.dir);
      _m.compose(L.p, _q, _s.set(rad, rad, len)); this.mesh.setMatrixAt(n, _m);
      const k = L.k * (L.flick ? 0.6 + 0.4 * Math.sin(g.time * 40) : 1);
      this.aCol.setXYZW(n, L.color[0] * k, L.color[1] * k, L.color[2] * k, len);
      n++;
      // the lamp face
      g.fx.main.spawn({ x: L.p.x + L.dir.x * 0.6, y: L.p.y + L.dir.y * 0.6, z: L.p.z + L.dir.z * 0.6, frame: CELL.GLOW, s0: 3.2 * L.k, life: 0.04, r: 3 * k, g: 2.9 * k, b: 2.6 * k, a: 1, anchored: false });
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.aCol.needsUpdate = true;
  }
}
