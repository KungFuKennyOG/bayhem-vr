import{aa as B,F as T,a7 as k,ab as N,ac as Y,ae as V,af as O,ag as Q,a2 as q,h as W,at as K,ay as R,an as G,aw as j,aC as E,e as H}from"./main-BqQW2R6J.js";const p=128;function Z(){const A=p*2,e=new Uint8Array(A*A*4),a=H(9127);for(let g=0;g<4;g++){const r=new Float32Array(4096);for(let i=0;i<r.length;i++)r[i]=a();const d=(i,f)=>{const n=Math.floor(i),u=Math.floor(f),m=i-n,y=f-u,M=m*m*(3-2*m),P=y*y*(3-2*y),x=(I,L)=>r[(L&63)*64+(I&63)],F=x(n,u)+(x(n+1,u)-x(n,u))*M,S=x(n,u+1)+(x(n+1,u+1)-x(n,u+1))*M;return F+(S-F)*P},v=(i,f)=>{let n=0,u=.5,m=1,y=0;for(let M=0;M<4;M++)n+=u*(1-Math.abs(d(i*m+M*17.3,f*m-M*9.1)*2-1)),y+=u,u*=.42,m*=2.03;return n/y},h=a()*40,c=a()*40,t=[];for(let i=0;i<60;i++){const f=i<5,n=a()*Math.PI*2,u=f?.04+a()*.12:Math.sqrt(a())*.3,m=Math.cos(n)*u,y=Math.sin(n)*u*.85+(f?-.03:.02),M=f?.13+a()*.05:.055+a()*.075;t.push([m,y,M])}const o=new Float32Array(p*p);for(let i=0;i<p;i++)for(let f=0;f<p;f++){const n=(f+.5)/p-.5,u=(i+.5)/p-.5;let m=0,y=0;for(const[x,F,S]of t){const I=((n-x)**2+(u-F)**2)/(S*S);if(I<1){const L=Math.sqrt(1-I)*S+(.34-Math.hypot(x,F))*.3;y+=Math.exp(L*70),m=1}}m&&(m=Math.max(0,Math.log(y)/70));const M=v(n*6+h,u*6+c),P=Math.hypot(n,u);o[i*p+f]=m>0?Math.max(0,m*(.86+.14*M))*Math.min(1,Math.max(0,(.49-P)/.06)):0}let b=0;for(const i of o)b=Math.max(b,i);const _=(g&1)*p,C=(g>>1)*p;for(let i=0;i<p;i++)for(let f=0;f<p;f++){const n=(F,S)=>o[Math.min(p-1,Math.max(0,S))*p+Math.min(p-1,Math.max(0,F))]/b,u=n(f,i),m=(n(f+1,i)-n(f-1,i))*10,y=(n(f,i+1)-n(f,i-1))*10,M=Math.hypot(m,y,1),P=Math.min(1,Math.max(0,u/.45))*(u>0?1:0),x=((C+i)*A+_+f)*4;e[x]=Math.round(u*255),e[x+1]=Math.round((-m/M*.5+.5)*255),e[x+2]=Math.round((-y/M*.5+.5)*255),e[x+3]=Math.round(Math.pow(P*P*(3-2*P),.8)*255)}}const s=new K(e,A,A,R);return s.colorSpace=G,s.magFilter=j,s.minFilter=E,s.generateMipmaps=!0,s.needsUpdate=!0,s}const J=`
attribute vec3 iPos;
attribute vec4 iP;   // size, rot, alpha, variant
attribute vec4 iC;   // rgb tint, fire glow from below
attribute float iSt; // horizontal stretch (sheets of spray / a rolling front); 1 = round
uniform float uNearK;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY; varying float vFlip; varying vec2 vQ;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iP.y), s = sin(iP.y);
  vec2 p = position.xy * iP.x * vec2(iSt, 1.0);
  vec3 offs = vec3(c * p.x - s * p.y, s * p.x + c * p.y, 0.0);
  mv.xyz += offs;
  vQ = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * 2.0;   // view-space position across the puff, -1..1
  vWorldY = iPos.y + (offs * mat3(viewMatrix)).y;   // view → world rotation is the transpose
  // variants 4..7 are the mirrored atlas cells: twice the shapes, no visible repeats in a wall of them
  float vr = mod(iP.w, 4.0); vFlip = iP.w > 3.5 ? -1.0 : 1.0;
  vec2 cell = vec2(mod(vr, 2.0), floor(vr / 2.0));
  vUv = (cell + vec2(position.x * vFlip, position.y) + 0.5) * 0.5;
  vCS = vec2(c, s);
  vC = iC;
  // fade as the puff reaches the eye (fill rate + no cardboard planes in your face)
  float cz = -(modelViewMatrix * vec4(iPos, 1.0)).z;   // per puff, not per corner (no straight-edged gradients across big quads)
  vA = iP.z * smoothstep(0.8, 0.8 + iP.x * uNearK, cz);
  vFogDepth = -mv.z; vFogViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (iP.z <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,X=`
uniform sampler2D tex;
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float groundY; uniform float uDim;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY; varying float vFlip; varying vec2 vQ;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 t = texture2D(tex, vUv);
  float al = t.a * (0.72 + 0.28 * smoothstep(0.0, 0.6, t.r)) * vA * smoothstep(groundY - 0.5, groundY + 2.0, vWorldY); // thin, see-through fringes
  if (al < 0.003) discard;
  vec2 n2 = t.gb * 2.0 - 1.0; n2.x *= vFlip;
  vec2 nr = vec2(vCS.x * n2.x - vCS.y * n2.y, vCS.y * n2.x + vCS.x * n2.y);
  // mostly a lit sphere (big soft top-lit/bottom-dark shape), a little of the lobes on top of it
  vec3 Ns = vec3(vQ * 0.9, sqrt(max(0.05, 1.0 - dot(vQ, vQ) * 0.81)));
  vec3 N = normalize(Ns + vec3(nr * 0.85, 0.0));
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float sky = dot(N, upV) * 0.5 + 0.5;
  float sunL = max(dot(N, fogSunDir) * 0.6 + 0.4, 0.0);
  vec3 V = normalize(vFogViewPos);
  float toward = pow(max(dot(V, fogSunDir), 0.0), 5.0);
  vec3 base = vC.rgb;
  float lump = 0.8 + 0.2 * t.r;                                          // thick lobes catch light, cavities stay dark
  vec3 col = base * (0.32 + 0.8 * sky * sky) * lump;                      // sky from above, dark undersides
  col += base * fogColorSun * 0.32 * sunL * sunL * lump;                   // low sun on the lit side
  float edge = sqrt(t.a) * (1.0 - t.a) * 2.6;
  col += fogColorSun * (base + 0.03) * toward * edge * 0.06;               // sun shining through the thin fringe
  col += vec3(1.5, 0.58, 0.2) * vC.a * (1.0 - sky) * (1.0 - sky) * (0.4 + 0.6 * t.r);          // fire glow from below
  col *= 1.0 - 0.4 * uDim;                                                // the wall has eaten the sun
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  float fs = max(dot(V, fogSunDir), 0.0);
  col = mix(col, mix(fogColor, fogColorSun, pow(fs, 3.0)), f);
  gl_FragColor = vec4(col * al, al);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`,w=144,U=72,z=2*Math.PI/w,D=Math.PI/2,$=.04;class at{constructor(e,a,{max:s=320,occlusion:g=!0,fillBudget:l=0}={}){this.max=s,this.occlusion=g,this.fillBudget=l,this._T=new Float32Array(w*U),this._keep=[];const r=new B;r.setAttribute("position",new T([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),r.setIndex([0,1,2,0,2,3]),this.aPos=new k(new Float32Array(s*3),3).setUsage(N),this.aP=new k(new Float32Array(s*4),4).setUsage(N),this.aC=new k(new Float32Array(s*4),4).setUsage(N),this.aS=new k(new Float32Array(s).fill(1),1).setUsage(N),r.setAttribute("iPos",this.aPos),r.setAttribute("iP",this.aP),r.setAttribute("iC",this.aC),r.setAttribute("iSt",this.aS),r.instanceCount=0,this.geometry=r,this.material=new Y({uniforms:{tex:{value:Z()},uNearK:{value:.22},uDim:{value:0},groundY:{value:-50},fogColor:{value:a.color},fogNear:{value:a.near},fogFar:{value:a.far},fogColorSun:{value:q.sunColor},fogSunDir:{value:q.sunDirView}},vertexShader:J,fragmentShader:X,transparent:!0,depthWrite:!1,blending:Q,blendSrc:O,blendDst:V,blendSrcAlpha:O,blendDstAlpha:V}),this.fog=a,this.mesh=new W(r,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=9,e.add(this.mesh),this.p=[],this.order=[],this.vid=0}spawn(e){let a;if(this.p.length<this.max)a={},this.p.push(a);else{let s=0,g=-1;for(let l=0;l<this.p.length;l++){const r=this.p[l],d=r.alive?r.age/r.life:9;d>g&&(g=d,s=l)}a=this.p[s]}return a.alive=!0,a.age=0,a.x=e.x,a.y=e.y,a.z=e.z,a.vx=e.vx||0,a.vy=e.vy||0,a.vz=e.vz||0,a.drag=e.drag??.3,a.buoy=e.buoy||0,a.s0=e.s0,a.s1=e.s1??e.s0,a.life=e.life||5,a.a=e.a??1,a.fadeIn=e.fadeIn??.1,a.fadeOut=e.fadeOut??.4,a.rot=e.rot??this.vid*2.39996,a.vrot=e.vrot||0,a.r=e.r??.5,a.g=e.g??.44,a.b=e.b??.36,a.glow=e.glow||0,a.glowFade=e.glowFade??1,a.r1=e.r1??a.r,a.g1=e.g1??a.g,a.b1=e.b1??a.b,a.variant=e.variant??this.vid++%8,a.ride=e.ride||null,a.oz=e.oz||0,a.bv=this.fillBudget?0:1,a.st=e.st??1,a}update(e,a,s=-50,g=null){this.material.uniforms.groundY.value=s;const l=this.order;l.length=0;for(const t of this.p){if(!t.alive)continue;if(t.age+=e,t.age>=t.life){t.alive=!1;continue}const o=Math.exp(-t.drag*e);t.vx*=o,t.vy=t.vy*o+t.buoy*e,t.vz*=o,t.x+=t.vx*e,t.y+=t.vy*e,t.ride?(t.oz+=t.vz*e,t.z=t.ride.z+t.oz):t.z+=t.vz*e,t.rot+=t.vrot*e,t.d2=(t.x-a.x)**2+(t.y-a.y)**2+(t.z-a.z)**2,l.push(t)}for(const t of l){const o=t.age/t.life;t.sz=t.s0+(t.s1-t.s0)*(1-(1-o)*(1-o)),t.al=t.a*Math.min(1,o/Math.max(.001,t.fadeIn))*Math.min(1,(1-o)/Math.max(.001,t.fadeOut))}l.sort((t,o)=>o.d2-t.d2),this.occlusion&&this._occlude(l,a),this.fillBudget&&g&&this._budget(l,a,g,e);const r=this.aPos.array,d=this.aP.array,v=this.aC.array,h=this.aS.array;for(let t=0;t<l.length;t++){const o=l[t],b=o.age/o.life,_=o.sz,C=o.al*o.bv;r[t*3]=o.x,r[t*3+1]=o.y,r[t*3+2]=o.z,d[t*4]=_,d[t*4+1]=o.rot,d[t*4+2]=C,d[t*4+3]=o.variant,v[t*4]=o.r+(o.r1-o.r)*b,v[t*4+1]=o.g+(o.g1-o.g)*b,v[t*4+2]=o.b+(o.b1-o.b)*b,v[t*4+3]=o.glow*Math.max(0,1-b*o.glowFade),h[t]=o.st}for(const t of[this.aPos,this.aP,this.aC,this.aS])t.clearUpdateRanges(),t.addUpdateRange(0,l.length*t.itemSize),t.needsUpdate=!0;this.geometry.instanceCount=l.length;const c=this.material.uniforms;c.fogNear.value=this.fog.near,c.fogFar.value=this.fog.far}_occlude(e,a){const s=this._T,g=this.material.uniforms.uNearK.value,l=this._keep,r=this.fog.near,d=this.fog.far;s.fill(1),l.length=0;for(let v=e.length-1;v>=0;v--){const h=e[v],c=Math.sqrt(h.d2),t=(c-.8)/Math.max(.001,h.sz*g),o=t<=0?0:t>=1?1:t*t*(3-2*t),b=h.al*o;if(b<.01||(c-h.sz*.5-r)/Math.max(.001,d-r)>=1)continue;const C=Math.asin(Math.max(-1,Math.min(1,(h.y-a.y)/c))),i=Math.atan2(h.x-a.x,a.z-h.z),f=Math.atan(h.sz*.71/c);if(!this._visible(C,i,f))continue;l.push(h);const n=Math.atan(h.sz*.28/c);n>z&&this._attenuate(C,i,n,1-.8*b)}e.length=0;for(let v=l.length-1;v>=0;v--)e.push(l[v])}_budget(e,a,s,g){const r=Math.cos(70*Math.PI/180);let d=0;for(let h=e.length-1;h>=0;h--){const c=e[h],t=Math.max(.5,Math.sqrt(c.d2)),o=(c.x-a.x)/t,b=(c.y-a.y)/t,_=(c.z-a.z)/t,C=Math.atan(c.sz*.5/t),i=Math.acos(Math.max(-1,Math.min(1,o*s.x+b*s.y+_*s.z)))-C<Math.acos(r);let f=1;if(i){const n=Math.min(1,c.sz/(2*t));d+=n*n,d>this.fillBudget&&(f=0)}c.bv=f?c.bv+(1-c.bv)*.25:c.bv*.45}let v=0;for(let h=0;h<e.length;h++)e[h].bv>.02&&(e[v++]=e[h]);e.length=v}_visible(e,a,s){const g=this._T,l=Math.max(0,Math.floor((e-s+D)/z)),r=Math.min(U-1,Math.floor((e+s+D)/z)),d=Math.cos(Math.min(D,Math.abs(e)+s)),v=d<.1?Math.PI:s/d,h=Math.floor((a-v+Math.PI)/z),c=v>=Math.PI?h+w-1:Math.floor((a+v+Math.PI)/z);for(let t=l;t<=r;t++)for(let o=h;o<=c;o++)if(g[t*w+(o%w+w)%w]>$)return!0;return!1}_attenuate(e,a,s,g){const l=this._T,r=Math.ceil((e-s+D)/z),d=Math.floor((e+s+D)/z)-1,v=Math.ceil((a-s+Math.PI)/z),h=Math.floor((a+s+Math.PI)/z)-1;for(let c=Math.max(0,r);c<=Math.min(U-1,d);c++)for(let t=v;t<=h;t++)l[c*w+(t%w+w)%w]*=g}get alive(){return this.order.length}}export{at as D};
