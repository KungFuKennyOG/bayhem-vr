import{a7 as g,F as u,a6 as h,a8 as l,r as p,a2 as f,a9 as w,D as y,ae as d,b6 as x,af as b,h as F}from"./index-CbIHAFn9.js";import{W as m,B as v,e as c,f as z,L as P}from"./index-B53Fho0u.js";import"./collision-BA5OYuxu.js";import"./player-NM9SR8fn.js";import"./dustfx-Dqri5aWN.js";import"./heli-Xh-ZYjUO.js";const A=1,D=2,k=`
attribute vec4 iP;   // light xyz, intensity
attribute vec4 iC;   // rgb, width (m)
attribute vec4 iD;   // len (m), plane y, flags, seed
uniform float uTime;
varying vec3 vW;
varying vec3 vCol;
varying vec4 vAx;    // camera ground xz, axis dir xz
varying vec4 vK;     // hc, θm, δnear, δfar
varying vec4 vS;     // half width, water, seed, fresnel·intensity
varying vec2 vEnds;  // near / far ground distance
varying float vMask;
varying vec3 vFogViewPos;
void main() {
  float flags = iD.z;
  float water = mod(flags, 2.0);
  float g = iD.y + 0.01;
  float hc = cameraPosition.y - g;
  float hl = iP.y - g;
  vec2 toL = iP.xz - cameraPosition.xz;
  float D = length(toL);
  if (iP.w <= 0.001 || hc < 0.08 || hl < 0.05 || D < 0.6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 dir = toL / D, perp = vec2(-dir.y, dir.x);
  float thm = atan(hc + hl, D);                       // depression of the mirrored light
  // glossy lobe in angle: ripples on water spread it a lot, wet stone less; the lobe stretches toward
  // the horizon (that's what makes the streak a column instead of a blob)
  float sg = (water > 0.5 ? 0.15 : 0.065) * mix(1.0, 1.5, smoothstep(0.5, 0.05, thm));
  // water: ripple facets smear tall lights all the way toward the horizon (lobe ∝ mirror angle)
  float dn = sg, df = water > 0.5 ? sg * 0.6 + thm * 0.75 : sg * 1.15;
  float dNear = hc / tan(min(thm + dn * 2.2, 1.52));
  float dFar = hc / tan(max(thm - df * 2.2, 0.0025));
  float dm = D * hc / (hc + hl);
  dFar = min(dFar, D + (water > 0.5 ? 0.6 : 0.25));    // never past the light's foot
  float L = iD.x * (water > 0.5 ? 2.0 : 1.4);         // anchor len caps the smear (metres)
  dNear = max(dNear, max(0.25, water > 0.5 ? dm * 0.12 : dm - L * 0.8));
  dFar = min(dFar, dm + L);
  if (dFar <= dNear + 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float hw = iC.w * 0.5 * (water > 0.5 ? 0.8 : 0.75);
  // quad: position.x = -1..1 across, position.y = 0..1 near → far
  float d = mix(dNear, dFar, position.y);
  // constant *angular* half-width (a straight column on screen, not a wedge): the source's size seen
  // between its mirror point and itself, plus the sideways ripple spread
  float ang = hw / mix(max(dm, 0.3), D, 0.5) + (water > 0.5 ? 0.008 : 0.004);
  vec2 xz = cameraPosition.xz + dir * d + perp * position.x * ang * d * 1.6;
  vW = vec3(xz.x, g, xz.y);
  // Fresnel at the mirror angle (water ~ dielectric; wet stone a bit duller)
  float c = sin(thm);
  float F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
  F = water > 0.5 ? min(1.0, F * 1.2 + 0.03) : min(1.0, F + 0.03);
  // broad floodlit sources (the tower: width > 3 m) light whole ripple fields, not single facets
  F = max(F, smoothstep(3.0, 10.0, iC.w) * 0.32);
  vCol = iC.rgb;
  vAx = vec4(cameraPosition.xz, dir);
  vK = vec4(hc, thm, dn, df);
  vS = vec4(ang, water, iD.w, F * iP.w / (1.0 + D / 600.0));
  vEnds = vec2(dNear, dFar);
  vMask = mod(floor(flags / 2.0), 2.0) > 0.5 ? 0.0 : 1.0;
  vec4 mv = viewMatrix * vec4(vW, 1.0);
  vFogViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,C=`
uniform float uTime;
uniform float uGain;
uniform vec3 fogColor;
uniform float fogNear, fogFar;
varying vec3 vW;
varying vec3 vCol;
varying vec4 vAx;
varying vec4 vK;
varying vec4 vS;
varying vec2 vEnds;
varying float vMask;
varying vec3 vFogViewPos;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
// the surface that really exists at this height (layout.js: river, lower quays, street + bridge deck)
float surfaceY(vec2 p) {
  float az = abs(p.y);
  if (abs(p.x) < ${v.half.toFixed(1)} && az < ${v.z1.toFixed(1)}) return 0.0;
  if (az < ${c.z1.toFixed(1)}) return ${m.toFixed(2)};
  if (az < ${z.wall.toFixed(1)}) return ${P.toFixed(2)};
  return 0.0;
}
void main() {
  if (vMask > 0.5) {
    float sy = surfaceY(vW.xz);
    if (vS.y > 0.5) { if (abs(vW.z) > ${c.z1.toFixed(1)} - 0.15) discard; }   // water: only between the quay walls
    else if (abs(sy - vW.y) > 0.6) discard;
  }
  vec2 rel = vW.xz - vAx.xy;
  float d = dot(rel, vAx.zw);
  float lat = dot(rel, vec2(-vAx.w, vAx.z));
  float hc = vK.x, thm = vK.y;
  float th = atan(hc, max(d, 0.01));
  float u = th - thm;                                  // > 0: nearer the eye than the mirror point
  float s = u > 0.0 ? u / vK.z : u / vK.w;
  float along = exp(-s * s * 0.5) * (0.35 + 0.65 * exp(-abs(s) * 1.5));   // peaked core + soft skirt
  along *= smoothstep(vEnds.x, vEnds.x + (vEnds.y - vEnds.x) * 0.12 + 0.05, d) * (1.0 - smoothstep(vEnds.y - (vEnds.y - vEnds.x) * 0.2 - 0.05, vEnds.y, d));
  float t = uTime, seed = vS.z;
  float water = vS.y;
  float hw = vS.x * max(d, 0.05);
  float shimmer;
  float a;
  if (water > 0.5) {
    // angle-space dashes: horizontal bands of ripple facets catching the light, drifting toward the eye
    float k = th * 160.0;
    float wob = (vn(vec2(k * 0.22 + t * 0.9, seed * 7.0)) - 0.5) * 0.9 + (vn(vec2(k * 0.9 - t * 2.1, seed * 3.0 + 5.0)) - 0.5) * 0.45;
    a = lat / hw + wob * mix(0.35, 0.9, smoothstep(0.0, 0.3, abs(s)));
    float n1 = vn(vec2(k + t * 2.6, seed * 11.0 + lat * 0.35));
    float n2 = vn(vec2(k * 2.3 - t * 3.7, seed * 5.0 + lat * 0.9));
    shimmer = pow(smoothstep(0.42, 0.85, n1 * 0.62 + n2 * 0.48), 1.5) * 2.2;
    // the core of the column stays more continuous; the flanks break up into flecks
    shimmer = mix(shimmer, 0.8, 0.2 * exp(-a * a * 8.0) * exp(-s * s));
    // calmer in a headset: long continuous streaks, only a little fleck break-up (no high-frequency glitter)
    shimmer = mix(shimmer, 0.85, 0.55);
  } else {
    // wet stone: soft column with a fine pocked grain (rain), barely moving
    a = lat / hw + (vn(vec2(th * 90.0, seed * 9.0)) - 0.5) * 0.25;
    float g1 = vn(vW.xz * 5.5 + seed * 17.0), g2 = vn(vW.xz * 13.0 - seed * 3.0 + t * 0.15);
    shimmer = 0.72 + 0.4 * g1 + 0.25 * smoothstep(0.65, 0.95, g2);
  }
  float across = exp(-a * a * (water > 0.5 ? 2.6 : 2.2)) * (1.0 - smoothstep(0.9, 1.55, abs(a)));
  vec3 hdr = vCol * vS.w * uGain * along * across * shimmer * (water > 0.5 ? 0.2 : 0.3);
  // fog: same curve as the global fog chunk; additive light just fades into the haze
  float fogK = smoothstep(fogNear, fogFar, length(vFogViewPos));
  fogK = 1.0 - (1.0 - fogK) * (1.0 - fogK);
  hdr *= 1.0 - fogK * 0.92;
  hdr = min(hdr, vec3(3.0));
  vec3 c = hdr;
  #ifdef TONE_MAPPING
    c = toneMapping(c);
  #endif
  c = linearToOutputTexel(vec4(c, 1.0)).rgb;
  #ifdef TONE_MAPPING
    c = max(bayGrade(c) - bayGrade(vec3(0.0)), 0.0);   // graded, minus the black lift (it's additive)
  #endif
  gl_FragColor = vec4(c, 1.0);
}`;class G{constructor(t,{max:e=256,fog:i=t==null?void 0:t.fog}={}){this.max=e;const a=new g;a.setAttribute("position",new u([-1,0,0,1,0,0,1,1,0,-1,1,0],3)),a.setIndex([0,2,1,0,3,2]),this.aP=new h(new Float32Array(e*4),4).setUsage(l),this.aC=new h(new Float32Array(e*4),4).setUsage(l),this.aD=new h(new Float32Array(e*4),4).setUsage(l),a.setAttribute("iP",this.aP),a.setAttribute("iC",this.aC),a.setAttribute("iD",this.aD),a.instanceCount=0,this.geometry=a,this.fog=i||{color:new p(.15,.1,.1),near:60,far:1500},this.uniforms={uTime:{value:0},uGain:{value:1},fogColor:{value:this.fog.color},fogNear:{value:this.fog.near},fogFar:{value:this.fog.far},fogColorSun:{value:f.sunColor},fogSunDir:{value:f.sunDirView}},this.material=new w({uniforms:this.uniforms,vertexShader:k,fragmentShader:C,transparent:!0,depthWrite:!1,depthTest:!0,blending:b,blendEquation:x,blendSrc:d,blendDst:d,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4,side:y}),this.material.name="wetReflections",this.mesh=new F(a,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=2,this.mesh.name="reflections",t&&t.add(this.mesh),this.free=[],this.high=0,this.dirty=!0,this.time=0,this.count=0}add(t){let e;if(this.free.length)e=this.free.pop();else{if(this.high>=this.max)return-1;e=this.high++}const i=t.p.isVector3?t.p.toArray():t.p,a=t.color||[2.4,1.4,.6],s=t.ground??0,r=(t.water??Math.abs(s-m)<.3?A:0)+(t.mask===!1?D:0);return this.aP.array.set([i[0],i[1],i[2],t.intensity??1],e*4),this.aC.array.set([a[0],a[1],a[2],t.width??1.2],e*4),this.aD.array.set([t.len??9,s,r,e*.618034%1*97],e*4),this.dirty=!0,this.count++,e}set(t,{p:e,color:i,intensity:a}={}){if(t==null||t<0||t>=this.high)return;const s=this.aP.array,o=this.aC.array,r=t*4;if(e){const n=e.isVector3?e.toArray():e;s[r]=n[0],s[r+1]=n[1],s[r+2]=n[2]}i&&(o[r]=i[0],o[r+1]=i[1],o[r+2]=i[2]),a!==void 0&&(s[r+3]=a),this.dirty=!0}remove(t){t==null||t<0||t>=this.high||(this.aP.array[t*4+3]=0,this.free.push(t),this.count--,this.dirty=!0)}update(t=0,e){if(this.time+=t,this.uniforms.uTime.value=this.time,this.uniforms.fogNear.value=this.fog.near,this.uniforms.fogFar.value=this.fog.far,this.dirty){for(const i of[this.aP,this.aC,this.aD])i.clearUpdateRanges(),i.addUpdateRange(0,this.high*4),i.needsUpdate=!0;this.geometry.instanceCount=this.high,this.dirty=!1}}get info(){return{draws:1,instances:this.high,live:this.count,tris:this.high*2}}}export{G as Reflections};
