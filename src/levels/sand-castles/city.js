import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { GeoBuilder, buildTower } from './towerkit.js';
import { facadeMaterial, FAC, SunMap } from './facade.js';
import { GRID, BLVD, isWater, canalDist, CANAL_W, district, onPalm, PALM, COAST_Z } from './layout.js';

// =====================================================================================
//  THE CITY — every tower that never falls is one merged mesh (one draw), plus:
//   - a per-tower ruin height in a float texture: the vertex shader crushes anything above it
//     into a torn, sooty stump, so ANY tower can be swapped to a ruin (behind the dust wall)
//     by writing one texel — the far-skyline swap from the prototype, for the whole city,
//   - the low-rise fabric (instanced boxes with the same facade shader, one draw),
//   - the far ring past the city (instanced, intact / ruined),
//   - the sun height map every surface marches for city-wide shadows.
// =====================================================================================

const STYLES = { marina: [3, 7, 1, 0, 3, 5], blvd: [0, 1, 2, 5, 6, 4, 1], downtown: [1, 2, 5, 0, 6], biz: [0, 4, 5, 1, 4], city: [3, 7, 4, 3], outer: [3, 4] };

export class City {
  constructor(scene, plan, F) {
    this.F = F; this.scene = scene;
    const rng = makeRng(777);
    this.sun = new SunMap(-4200, -4600, 8400, F.isQuest ? 1024 : 2048);
    // ---- static towers (everything but the fallers)
    const statics = plan.towers.filter(t => t.role === 'static' || t.role === 'fight');
    statics.forEach((t, i) => { t.idx = i; const st = STYLES[t.district] || STYLES.city; t.style = st[Math.floor(rng() * st.length)]; });
    this.statics = statics;
    const gb = new GeoBuilder();
    this.roofs = new Map(); // tower -> roof info (fight towers stand gunmen on them)
    for (const t of statics) { const r = buildTower(gb, t, {}); this.roofs.set(t, r); this.sun.addStatic(t, t.h + (t.roof === 'crown' ? 12 : 0)); }
    this.tris = gb.tris;
    // ruin texture: x, z, ruin height, unused (ruin height 1e5 = intact)
    const N = Math.max(1, statics.length);
    this.ruinData = new Float32Array(N * 4);
    statics.forEach((t, i) => { this.ruinData.set([t.x, t.z, 1e5, 0], i * 4); });
    this.ruinTex = new THREE.DataTexture(this.ruinData, N, 1, THREE.RGBAFormat, THREE.FloatType);
    this.ruinTex.minFilter = this.ruinTex.magFilter = THREE.NearestFilter; this.ruinTex.needsUpdate = true;
    FAC.tRuin.value = this.ruinTex; FAC.uRuinN.value = N;
    const mat = facadeMaterial({
      key: 'city',
      uniforms: { tRuin: FAC.tRuin, uRuinN: FAC.uRuinN },
      vertexHead: 'uniform sampler2D tRuin; uniform float uRuinN; varying float vRuinS;',
      vertexTransform: `
        vec3 transformed = vec3(position);
        vec4 RU = texture2D(tRuin, vec2((aS.w + 0.5) / uRuinN, 0.5));
        vRuinS = 0.0;
        if (transformed.y > RU.z) {
          float j = fract(sin(dot(position.xz * 0.37 + position.y * 0.011, vec2(12.9898, 78.233))) * 43758.5453);
          float over = transformed.y - RU.z;
          transformed.y = RU.z - 4.0 + 16.0 * j * (1.0 - exp(-over / 30.0));
          transformed.xz = mix(transformed.xz, RU.xy, 0.08 + 0.12 * j);
          vRuinS = 1.0;
        }`,
      vertexTail: 'vRuin = vRuinS;',
    });
    this.mesh = new THREE.Mesh(gb.geometry(), mat);
    this.mesh.frustumCulled = false; this.mesh.name = 'city';
    scene.add(this.mesh);
    // ---- low-rise fabric: blocks on the grid, shorter inside the towers' districts (podium streets)
    this.lowrise = this._lowrise(plan, rng);
    // ---- far ring
    this.far = new FarRing(scene, plan.far, F);
    this.sun.commit();
  }
  ruin(t, h) { if (t.idx == null) return; this.ruinData[t.idx * 4 + 2] = h; this.ruinTex.needsUpdate = true; this.sun.setDynamic('s' + t.idx, t, 0); }

  _lowrise(plan, rng) {
    const G = GRID, list = [];
    const occ = plan.towers.map(t => [t.x, t.z, Math.hypot(t.w, t.d) * 0.5 + 16]);
    const freeAt = (x, z, r) => occ.every(([ox, oz, or]) => Math.hypot(ox - x, oz - z) > or + r);
    for (let gx = G.x0 - 600; gx < G.x1 + 600; gx += G.pitch) for (let gz = G.z0; gz < G.z1 + 900; gz += G.pitch) {
      const d = district(gx + G.pitch / 2, gz + G.pitch / 2);
      if (d === 'sea') continue;
      const outer = d === 'outer';
      if (outer && rng() < 0.55) continue;
      // 2x2 to 3x3 buildings per block
      const n = outer ? 2 : 3, cell = (G.pitch - G.road - 10) / n;
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
        if (rng() < (outer ? 0.45 : 0.25)) continue;
        const x = gx + G.road / 2 + 5 + cell * (i + 0.5) + (rng() - 0.5) * 6, z = gz + G.road / 2 + 5 + cell * (k + 0.5) + (rng() - 0.5) * 6;
        if (isWater(x, z) || canalDist(x, z) < CANAL_W * 0.5 + 18 || Math.abs(z - BLVD.z) < BLVD.w / 2 + 14) continue;
        const w = cell * (0.55 + rng() * 0.35), dd = cell * (0.55 + rng() * 0.35);
        if (!freeAt(x, z, Math.hypot(w, dd) * 0.5)) continue;
        const hk = d === 'city' || outer ? 1 : 0.6;
        const h = (6 + rng() * rng() * 34) * hk + (d === 'marina' || d === 'blvd' ? 4 : 0);
        list.push({ x, z, w, d: dd, h, style: [3, 7, 4, 3, 1][Math.floor(rng() * 5)], rot: 0 });
      }
    }
    // the palm island's villas and the crescent's hotels
    const pr = makeRng(31337);
    for (let i = 0; i < 2600 && list.length < 5200; i++) {
      const x = PALM.x + (pr() - 0.5) * 2400, z = PALM.z + (pr() - 0.5) * 2400;
      if (!onPalm(x, z)) continue;
      const r = Math.hypot(x - PALM.x, z - PALM.z);
      const hotel = Math.abs(r - PALM.crescentR * 0.62) < 30;
      const w = hotel ? 30 + pr() * 30 : 9 + pr() * 6;
      list.push({ x, z, w, d: hotel ? 18 : 9 + pr() * 6, h: hotel ? 20 + pr() * 30 : 5 + pr() * 4, style: hotel ? 7 : 4, rot: Math.atan2(z - PALM.z, x - PALM.x) });
    }
    const geo = new THREE.BoxGeometry(2, 2, 2); geo.translate(0, 1, 0);
    // the inst facade shader reads local coords from the instance scale: keep the box centred in x/z, base at y = 0
    const mat = facadeMaterial({ inst: true, key: 'low' });
    const N = list.length;
    const im = new THREE.InstancedMesh(geo, mat, N);
    const org = new Float32Array(N * 4), st = new Float32Array(N * 4);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
    list.forEach((b, i) => {
      q.setFromAxisAngle(Y, b.rot); p.set(b.x, 0, b.z); s.set(b.w / 2, b.h / 2, b.d / 2);
      m.compose(p, q, s); im.setMatrixAt(i, m);
      org.set([0, -b.h / 2 + b.h / 2, 0, (b.x * 3.1 + b.z) % 97], i * 4); // aOrg.y offsets v so v = height above ground
      st.set([b.style, makeRng(i + 9)(), 3.4, 0], i * 4);
      this.sun.addStatic({ x: b.x, z: b.z, w: b.w, d: b.d, rot: b.rot }, b.h);
    });
    // geometry spans y 0..2 scaled by h/2 -> local y = 0..h; lp.y in the shader = position.y * scale = 0..h
    im.geometry.setAttribute('aOrg', new THREE.InstancedBufferAttribute(org, 4));
    im.geometry.setAttribute('aSt', new THREE.InstancedBufferAttribute(st, 4));
    im.frustumCulled = false; im.name = 'lowrise';
    this.scene.add(im);
    this.lowCount = N;
    return im;
  }
}

// ---------------------------------------------------------------------------- the far ring
export class FarRing {
  constructor(scene, list, F) {
    this.list = list; this.F = F;
    const N = Math.max(1, list.length);
    const box = new THREE.BoxGeometry(2, 2, 2); box.translate(0, 1, 0);
    const ruin = new THREE.BoxGeometry(2, 2, 2, 3, 2, 3); ruin.translate(0, 1, 0);
    const p = ruin.attributes.position, rr = makeRng(31);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 1.99) p.setY(i, 1.0 + rr() * 1.0); if (y > 1.0) { p.setX(i, p.getX(i) * (0.82 + rr() * 0.2)); p.setZ(i, p.getZ(i) * (0.82 + rr() * 0.2)); } }
    ruin.computeVertexNormals();
    this.intact = new THREE.InstancedMesh(box, facadeMaterial({ inst: true, key: 'far' }), N);
    const rm = facadeMaterial({ inst: true, key: 'farR' });
    if (F.swapdebug) rm.color.set(0xff2010);
    this.ruined = new THREE.InstancedMesh(ruin, rm, N);
    for (const m of [this.intact, this.ruined]) {
      m.geometry.setAttribute('aOrg', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4));
      m.geometry.setAttribute('aSt', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4));
      m.frustumCulled = false; scene.add(m);
    }
    this.swapped = list.map(() => false);
    this.samples = list.map(t => [[0, 3, 0], [0, t.h * 0.5, 0], [0, t.h, 0], [t.w / 2, t.h * 0.5, 0], [-t.w / 2, t.h * 0.5, 0], [0, t.h + 25, 0]].map(([x, y, z]) => new THREE.Vector3(t.x + x, y, t.z + z)));
    this.count = 0; this.cursor = 0;
    this._write();
  }
  _write() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    let a = 0, b = 0;
    const st = (mesh) => mesh.geometry.attributes.aSt;
    this.list.forEach((t, i) => {
      q.setFromAxisAngle(Y, t.rot); p.set(t.x, 0, t.z);
      const style = [0, 1, 4, 3, 5][i % 5];
      if (this.swapped[i]) { m.compose(p, q, s.set(t.w / 2, t.h * t.ruin / 2, t.d / 2)); this.ruined.setMatrixAt(b, m); st(this.ruined).setXYZW(b, style, (i * 0.37) % 1, 4, 1); b++; }
      else { m.compose(p, q, s.set(t.w / 2, t.h / 2, t.d / 2)); this.intact.setMatrixAt(a, m); st(this.intact).setXYZW(a, style, (i * 0.37) % 1, 4, 0); a++; }
    });
    this.intact.count = a; this.ruined.count = b;
    for (const mesh of [this.intact, this.ruined]) { mesh.instanceMatrix.needsUpdate = true; st(mesh).needsUpdate = true; }
    this.count = b;
  }
  reset() { this.swapped.fill(false); this._write(); }
  // time-sliced: a tower swaps only when every sample point is behind the opaque part of the wall
  update(eye, wall) {
    if (!this.F.swap || !wall.state || !this.list.length) return;
    const n = Math.ceil(this.list.length / 4);
    let changed = false;
    for (let k = 0; k < n; k++) {
      const i = this.cursor++ % this.list.length;
      if (this.swapped[i]) continue;
      if (this.samples[i].every(P => wall.hides(eye, P))) { this.swapped[i] = true; changed = true; }
    }
    if (changed) this._write();
  }
}

// ---------------------------------------------------------------------------- aviation beacons
// red obstruction lights on every tall roof (one Points draw); they blink out of phase and come up
// with the dusk / the storm — the skyline's silhouette when the sun goes
export function buildBeacons(scene, towers, extra = []) {
  const pts = [];
  for (const t of towers) if (t.h > 170) pts.push(t.x, t.h + (t.roof === 'crown' ? 22 : 4), t.z, (t.x * 0.13 + t.z * 0.07) % 1);
  for (const p of extra) pts.push(...p);
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(pts), n = pts.length / 4;
  const pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([arr[i * 4], arr[i * 4 + 1], arr[i * 4 + 2]], i * 3); ph[i] = arr[i * 4 + 3]; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: FAC.uTime, uNight: FAC.uNight, uScale: { value: 600 } },
    vertexShader: `attribute float aPh; uniform float uTime; uniform float uNight; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float blink = step(0.55, fract(uTime * 0.6 + aPh));
        vA = blink * (0.25 + 0.75 * clamp(uNight * 1.6, 0.0, 1.0));
        gl_PointSize = clamp(uScale * 2.2 / -mv.z, 2.0, 18.0);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 18.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(2.6, 0.12, 0.05) * a, 0.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 6;
  scene.add(p);
  return p;
}
