import{e as B,G as vt,F as V,h as tt,V as $,k as ft,$ as At,Z as Xt,P as Vt,j as Yt,I as Wt,Q as jt,a7 as Ut,d as X,t as H,ao as Ct,a1 as Ht,B as qt,m as yt,f as St,M as Gt}from"./index-gQSLSIeB.js";const F={L40:12.19,L20:6.06,W:2.44,H:2.59},{W:A,H:x}=F,D=.16,Rt=.035,dt=.06,C=.16,T=.16,rt=[.56,1.06,1.38,1.88],nt=[{name:"VICTORY LINES",short:"VICTORY",code:"VCTU",serial:"482913",chk:"2",base:"#a3241c",text:"#f3eee4",logo:"star"},{name:"OCEANIX",short:"OCEANIX",code:"OCXU",serial:"730164",chk:"8",base:"#1e5ba6",text:"#eef3f7",logo:"wave"},{name:"HANSA BLUE",short:"HANSA",code:"HBLU",serial:"215587",chk:"0",base:"#1b2847",text:"#eef0f3",logo:"band"},{name:"KRONOS",short:"KRONOS",code:"KRNU",serial:"903372",chk:"5",base:"#d0601c",text:"#2a2522",logo:"hourglass"},{name:"EVERFAR",short:"EVERFAR",code:"EVFU",serial:"617240",chk:"3",base:"#2d653a",text:"#f0f0e8",logo:"ring"},{name:"TRITON",short:"TRITON",code:"TRTU",serial:"358016",chk:"7",base:"#587a78",text:"#f1f3f0",logo:"trident"},{name:"SEAHAUL",short:"SEAHAUL",code:"SHLU",serial:"144859",chk:"1",base:"#6a2026",text:"#efe6df",logo:"diamond"},{name:"NORDLEASE",short:"NORDLEASE",code:"NRLU",serial:"560731",chk:"4",base:"#d6cdb8",text:"#3a3e45",logo:"lease"}],g0=nt.map(t=>t.name),q=2048;let G=256;const K=[0,1344],U=[1344,672],ht=[2016,32],Q=(ht[0]+ht[1]/2)/q,ut=new Float32Array(16),It=[.3,2.02];let k=null;function Et(t){const e=parseInt(t.slice(1),16);return[e>>16&255,e>>8&255,e&255]}function W(t,e,s=0){const[n,o,i]=Et(t),r=a=>Math.max(0,Math.min(255,Math.round(a*e+s)));return`rgb(${r(n)},${r(o)},${r(i)})`}function et(t,e){const[s,n,o]=Et(t);return`rgba(${s},${n},${o},${e})`}function Kt(t,e=256,s=6,n=4,o=1.6){const i=yt(t,64),r=X(e,e),a=r.getContext("2d"),l=a.createImageData(e,e);for(let f=0;f<e;f++)for(let g=0;g<e;g++){let b=St(i,g/e,f/e,s,n);b=Math.max(0,Math.min(1,(b-.5)*o+.5));const h=(f*e+g)*4;l.data[h]=l.data[h+1]=l.data[h+2]=b*255,l.data[h+3]=255}return a.putImageData(l,0,0),r}function Lt(t,e,s,n){const o=X(e,s),i=o.getContext("2d"),r=i.createImageData(e,s);for(let a=0;a<s;a++)for(let l=0;l<e;l++){const f=t[a*e+(l-1+e)%e],g=t[a*e+(l+1)%e],b=t[(a-1+s)%s*e+l],h=t[(a+1)%s*e+l];let d=(f-g)*n,p=(h-b)*n,u=1;const m=Math.hypot(d,p,u);d/=m,p/=m,u/=m;const y=(a*e+l)*4;r.data[y]=(d*.5+.5)*255,r.data[y+1]=(p*.5+.5)*255,r.data[y+2]=(u*.5+.5)*255,r.data[y+3]=255}return i.putImageData(r,0,0),o}function mt(t,e="Anton",s=400){return e==="Anton"?`400 ${t}px Anton, Impact, sans-serif`:`${s} ${t}px Oswald, 'Arial Narrow', sans-serif`}function _(t,e,s,n,o,{maxW:i=1e9,color:r="#fff",fam:a="Anton",wt:l=400,align:f="center",spacing:g=0,alpha:b=1}={}){const{ctx:h}=t;let p=o/(a==="Anton"?.735:.72)*t.sy;h.save(),h.font=mt(p,a,l),h.letterSpacing=`${g*p}px`;let u=h.measureText(e).width/t.sy;return u>i&&(p*=i/u,o*=i/u,h.font=mt(p,a,l),h.letterSpacing=`${g*p}px`,u=i),h.translate(t.X(s),t.Y(n-o/2)),h.scale(t.sx/t.sy,1),h.textAlign=f,h.textBaseline="alphabetic",h.globalAlpha=b,h.fillStyle=r,h.fillText(e,0,0),h.restore(),u}function Qt(t,e,s,n){const{ctx:o}=t;o.save(),o.translate(t.X(e),t.Y(s)),o.scale(t.sx,-t.sy),n(o),o.restore()}function xt(t,e,s,n,o,i,r){const a=n/i,l=o/r;return{ctx:t,x0:e,y0:s,wpx:n,hpx:o,wm:i,hm:r,sx:a,sy:l,X:f=>e+f*a,Y:f=>s+(r-f)*l}}function gt(t,e,s,n,o){const i=e.text;Qt(t,s,n,r=>{switch(r.fillStyle=i,r.strokeStyle=i,e.logo){case"star":{r.beginPath(),r.arc(0,0,o/2,0,Math.PI*2),r.fill(),r.fillStyle=e.base,r.beginPath();for(let a=0;a<10;a++){const l=Math.PI/2+a*Math.PI/5,f=(a%2?.19:.46)*o;r.lineTo(Math.cos(l)*f,Math.sin(l)*f)}r.closePath(),r.fill();break}case"wave":{r.lineWidth=o*.11,r.lineCap="round";for(let a=0;a<3;a++){r.beginPath();for(let l=0;l<=24;l++){const f=l/24,g=(f-.5)*o*1.3;r.lineTo(g,(a-1)*o*.3+Math.sin(f*Math.PI*2)*o*.09)}r.stroke()}break}case"hourglass":{r.beginPath(),r.moveTo(-o*.4,o/2),r.lineTo(o*.4,o/2),r.lineTo(0,.02*o),r.closePath(),r.fill(),r.beginPath(),r.moveTo(-o*.4,-o/2),r.lineTo(o*.4,-o/2),r.lineTo(0,-.02*o),r.closePath(),r.fill();break}case"ring":{r.lineWidth=o*.14,r.beginPath(),r.arc(0,0,o*.42,.5,Math.PI*2-.2),r.stroke(),r.fillRect(-o*.12,-o*.07,o*.5,o*.14);break}case"trident":{const a=o*.08;r.fillRect(-a/2,-o/2,a,o*.85),r.fillRect(-o*.3,o*.08,o*.6,a);for(const l of[-o*.3,o*.3-a])r.fillRect(l,o*.08,a,o*.34);for(const l of[-o*.3+a/2,0,o*.3-a/2])r.beginPath(),r.moveTo(l-a*1.1,o*.4),r.lineTo(l+a*1.1,o*.4),r.lineTo(l,o*.52),r.closePath(),r.fill();break}case"diamond":{r.beginPath(),r.moveTo(0,o/2),r.lineTo(o*.45,0),r.lineTo(0,-o/2),r.lineTo(-o*.45,0),r.closePath(),r.fill(),r.strokeStyle=e.base,r.lineWidth=o*.09,r.beginPath();for(let a=0;a<=20;a++){const l=a/20;r.lineTo((l-.5)*o*.5,Math.sin(l*Math.PI*2)*o*.09)}r.stroke();break}case"lease":{r.fillRect(-o/2,-o/2,o,o),r.fillStyle=e.base,r.fillRect(-o*.3,-o*.3,o*.2,o*.6),r.fillRect(-o*.3,-o*.3,o*.6,o*.2);break}}})}function Tt(t,e,s,n,o,i,r,a,l){const f=xt(t,e,s,n,G,o,x);t.save(),t.beginPath(),t.rect(e,s,n,G),t.clip(),t.fillStyle=i.base,t.fillRect(e,s,n,G);const g=i.text,b=o/2;i.logo==="band"&&(t.fillStyle=g,t.fillRect(f.X(0),f.Y(2.28),n,.2*f.sy),t.fillStyle=et(g,.9),t.fillRect(f.X(0),f.Y(.62),n,.06*f.sy));let h=o/2,d=o/2;if(i.logo==="lease")if(gt(f,i,.62,2.05,.34),_(f,i.name,.92,2.05,.2,{color:g,fam:"Oswald",wt:700,align:"left",spacing:.04,alpha:.85}),_(f,"LEASED UNIT  ·  RETURN TO DEPOT",.92,1.82,.065,{color:g,fam:"Oswald",wt:500,align:"left",alpha:.7}),l)h=o/2-1.2,d=o/2+1.2;else{const m=_(f,"NORD",o-2.6,1.3,.55,{color:et(g,.18),alpha:1});h=o-2.6-m/2,d=o-2.6+m/2}else{const m=l?i.short:i.name,y=l?m.length>7?.6:.74:.95,S=l?.9:1.15,c=o-(l?2.1:3.4),v=.35;t.font=mt(y/.735*f.sy),t.letterSpacing=`${.03*y/.735*f.sy}px`;let M=Math.min(c,t.measureText(m).width/f.sy);const R=S+v+M,I=b-R/2,z=1.3;h=I,d=I+R,gt(f,i,I+S/2,z,S),_(f,m,I+S+v,z,y,{maxW:c,color:g,align:"left",spacing:.03,alpha:.96}),!l&&i.logo!=="band"&&_(f,i.logo==="star"?"★  WE DELIVER  ★":i.logo==="hourglass"?"ON TIME. EVERY TIME.":"GLOBAL CONTAINER SERVICE",I+S+v+M/2,.58,.12,{color:g,fam:"Oswald",wt:500,spacing:.15,alpha:.75})}const p=i.logo==="lease"||i.logo==="hourglass"?"#2b2b2b":"#f2f0ea";_(f,`${i.code} ${i.serial} ${i.chk}`,o-.35,2.32,.1,{color:p,fam:"Oswald",wt:700,align:"right",alpha:.9}),_(f,l?"22G1":"45G1",o-.35,2.15,.1,{color:p,fam:"Oswald",wt:700,align:"right",alpha:.9});let u=t.createLinearGradient(0,s,0,s+G);u.addColorStop(0,"rgba(255,244,228,0.22)"),u.addColorStop(.45,"rgba(255,244,228,0.06)"),u.addColorStop(1,"rgba(255,244,228,0)"),t.fillStyle=u,t.fillRect(e,s,n,G),u=t.createLinearGradient(0,s+G,0,s+G*.55),u.addColorStop(0,"rgba(48,36,24,0.45)"),u.addColorStop(1,"rgba(48,36,24,0)"),t.fillStyle=u,t.fillRect(e,s,n,G);for(let m=0;m<o*120;m++){const y=f.X(r()*o),S=s+r()*G,c=.4+r()*r()*2.2;t.fillStyle=r()<.75?et(i.base,.75):"rgba(110,100,90,0.6)",t.fillRect(y,S,c*(.6+r()),c)}return t.restore(),Math.max(0,Math.min(h-.45,o-.45-d))}function Zt(t,e,s,n){const[o,i]=ht;t.fillStyle=s.base,t.fillRect(o,e,i,G);let r=t.createLinearGradient(0,e,0,e+G);r.addColorStop(0,"rgba(255,244,228,0.22)"),r.addColorStop(.45,"rgba(255,244,228,0.06)"),r.addColorStop(1,"rgba(255,244,228,0)"),t.fillStyle=r,t.fillRect(o,e,i,G),r=t.createLinearGradient(0,e+G,0,e+G*.55),r.addColorStop(0,"rgba(48,36,24,0.45)"),r.addColorStop(1,"rgba(48,36,24,0)"),t.fillStyle=r,t.fillRect(o,e,i,G)}const ot=[D,A/2-.006],at=[A/2+.006,A-D];function Jt(){const e=X(512,512),s=e.getContext("2d"),n=xt(s,0,0,512,512,A,x);s.fillStyle="rgb(128,128,128)",s.fillRect(0,0,512,512);const o=(a,l,f,g,b)=>{s.fillStyle=b,s.fillRect(n.X(a),n.Y(g),(f-a)*n.sx,(g-l)*n.sy)};for(const[a,l]of[ot,at]){o(a,C,l,x-T,"rgb(150,150,150)");const f=a+.07,g=l-.07,b=4,h=(g-f)/b;for(let d=0;d<b;d++){const p=f+d*h,u=s.createLinearGradient(n.X(p),0,n.X(p+h),0);u.addColorStop(0,"rgb(150,150,150)"),u.addColorStop(.18,"rgb(150,150,150)"),u.addColorStop(.36,"rgb(95,95,95)"),u.addColorStop(.64,"rgb(95,95,95)"),u.addColorStop(.82,"rgb(150,150,150)"),u.addColorStop(1,"rgb(150,150,150)"),s.fillStyle=u,s.fillRect(n.X(p),n.Y(x-T-.16),h*n.sx,(x-T-C-.32)*n.sy)}o(f,C+.13,g,C+.16,"rgb(122,122,122)"),o(f,x-T-.16,g,x-T-.13,"rgb(122,122,122)"),o(a,C,a+.015,x-T,"rgb(70,70,70)"),o(l-.015,C,l,x-T,"rgb(70,70,70)"),o(a,C,l,C+.015,"rgb(70,70,70)"),o(a,x-T-.015,l,x-T,"rgb(70,70,70)")}o(A/2-.006,C,A/2+.006,x-T,"rgb(40,40,40)");for(const a of[.45,1.02,1.62,2.18])o(D-.02,a-.035,D+.085,a+.035,"rgb(190,190,190)"),o(A-D-.085,a-.035,A-D+.02,a+.035,"rgb(190,190,190)");for(const a of rt){for(const f of[.78,1.78])o(a-.045,f-.03,a+.045,f+.03,"rgb(185,185,185)");o(a-.045,C+.015,a+.045,C+.11,"rgb(200,200,200)"),o(a-.045,x-T-.11,a+.045,x-T-.015,"rgb(200,200,200)");const l=a<A/2?1:-1;o(Math.min(a,a+l*.07)-.012,1,Math.max(a,a+l*.07)+.012,1.06,"rgb(180,180,180)")}o(.3,1.36,.5,1.5,"rgb(165,165,165)"),s.filter="blur(1.2px)",s.drawImage(e,0,0),s.filter="none";const i=s.getImageData(0,0,512,512).data,r=new Float32Array(512*512);for(let a=0;a<512*512;a++)r[a]=i[a*4]/255;return{canvas:e,h:r,S:512}}const j=384;function t0(t,e,s,n,o,i){const r=j,a=xt(t,e,s,r,r,A,x);t.save(),t.beginPath(),t.rect(e,s,r,r),t.clip();const l=(c,v,M,R,I)=>{t.fillStyle=I,t.fillRect(a.X(c),a.Y(R),(M-c)*a.sx,(R-v)*a.sy)};t.fillStyle=n.base,t.fillRect(e,s,r,r);const f=t.createPattern(i,"repeat");f.setTransform(new DOMMatrix().translate(e+o()*200,s).scale(1.3,1.3)),t.globalCompositeOperation="multiply",t.globalAlpha=.2,t.fillStyle=f,t.fillRect(e,s,r,r),t.globalCompositeOperation="source-over",t.globalAlpha=1;for(const[c,v]of[ot,at]){const M=c+.07,R=v-.07,I=4,z=(R-M)/I;for(let P=0;P<I;P++){const L=M+P*z;l(L+z*.36,C+.16,L+z*.64,x-T-.16,"rgba(0,0,0,0.07)"),l(L+z*.18,C+.16,L+z*.36,x-T-.16,"rgba(255,255,255,0.035)")}l(c,C,c+.016,x-T,"rgba(18,16,15,0.9)"),l(v-.016,C,v,x-T,"rgba(18,16,15,0.9)"),l(c,C,v,C+.016,"rgba(18,16,15,0.9)"),l(c,x-T-.016,v,x-T,"rgba(18,16,15,0.9)")}l(A/2-.007,C,A/2+.007,x-T,"#0d0c0b"),l(0,0,D,x,W(n.base,.85)),l(A-D,0,A,x,W(n.base,.85)),l(0,0,A,C,W(n.base,.8)),l(0,x-T,A,x,W(n.base,.85));const g=W(n.base,.62,8);for(const c of[.45,1.02,1.62,2.18])for(const[v,M]of[[D-.02,D+.085],[A-D-.085,A-D+.02]])l(v,c-.035,M,c+.035,g),l(v,c+.02,M,c+.035,"rgba(255,255,255,0.15)"),l(v+.01,c-.012,M-.01,c+.012,"rgba(0,0,0,0.35)");for(const c of rt){l(c-.03,C,c+.03,x-T,"rgba(0,0,0,0.22)");for(const M of[.78,1.78])l(c-.045,M-.03,c+.045,M+.03,g),l(c-.045,M-.032,c+.045,M-.026,"rgba(0,0,0,0.4)");l(c-.045,C+.015,c+.045,C+.11,W(n.base,.55,6)),l(c-.045,x-T-.11,c+.045,x-T-.015,W(n.base,.55,6));const v=c<A/2?1:-1;l(Math.min(c,c+v*.07)-.012,1,Math.max(c,c+v*.07)+.012,1.06,g),l(c+v*.035-.011,.92,c+v*.035+.011,1.5,"rgba(25,22,20,0.55)"),l(c+v*.035-.011,.92,c+v*.035-.004,1.5,"rgba(255,255,255,0.12)")}l(.3,1.36,.5,1.5,"#a9aba6"),l(.3,1.36,.5,1.37,"rgba(0,0,0,0.4)"),t.fillStyle="rgba(40,40,40,0.75)";for(let c=0;c<7;c++)t.fillRect(a.X(.315),a.Y(1.48-c*.016),(.06+o()*.11)*a.sx,1.2);_(a,"CSC SAFETY APPROVAL",.4,1.485,.009,{color:"#222",fam:"Oswald",wt:700});const b=n.logo==="lease"||n.logo==="hourglass"?"#262422":"#f1efe8",h=(at[0]+at[1])/2,d=_(a,`${n.code} ${n.serial}`,h-.09,2.2,.085,{color:b,fam:"Oswald",wt:700,spacing:.04}),p=h-.09+d/2+.07;t.strokeStyle=b,t.lineWidth=2,t.strokeRect(a.X(p-.045),a.Y(2.26),.09*a.sx,.12*a.sy),_(a,n.chk,p,2.2,.085,{color:b,fam:"Oswald",wt:700}),_(a,"45G1",h,2.05,.085,{color:b,fam:"Oswald",wt:700,spacing:.05});const u=(ot[0]+ot[1])/2+.03;if(["MAX. GROSS  30,480 KG","67,200 LB","TARE  3,750 KG","8,270 LB","NET  26,730 KG","CU. CAP.  33.2 CU.M"].forEach((c,v)=>_(a,c,u,2.24-v*.06,.03,{color:b,fam:"Oswald",wt:500,alpha:.9})),gt(a,n,h,1.55,.26),_(a,n.short,h,1.3,.085,{color:n.text,maxW:.9,spacing:.04}),o()<.8){const c=.35+o()*.4,v=.55+o()*.25;l(c,v,c+.11,v+.11,"rgba(235,225,200,0.7)"),l(c+.02,v+.06,c+.09,v+.08,"rgba(160,30,20,0.6)")}let y=t.createLinearGradient(0,s,0,s+r);y.addColorStop(0,"rgba(255,244,228,0.18)"),y.addColorStop(.5,"rgba(255,244,228,0.04)"),y.addColorStop(1,"rgba(255,244,228,0)"),t.fillStyle=y,t.fillRect(e,s,r,r),y=t.createLinearGradient(0,s+r,0,s+r*.62),y.addColorStop(0,"rgba(60,36,18,0.6)"),y.addColorStop(1,"rgba(60,36,18,0)"),t.fillStyle=y,t.fillRect(e,s,r,r);const S=(c,v,M,R)=>{const I=t.createLinearGradient(0,a.Y(v),0,a.Y(v-M));I.addColorStop(0,`rgba(110,45,14,${R})`),I.addColorStop(1,"rgba(110,45,14,0)"),t.fillStyle=I,t.fillRect(a.X(c),a.Y(v),1.5+o()*2.5,M*a.sy)};for(const c of[.45,1.02,1.62,2.18])S(D+.03+o()*.04,c-.03,.15+o()*.5,.5),S(A-D-.06+o()*.04,c-.03,.15+o()*.5,.5);for(const c of rt)S(c-.03+o()*.06,1.75,.2+o()*.6,.4),S(c-.03+o()*.06,.75,.2+o()*.4,.45);for(let c=0;c<26;c++){const v=D+o()*(A-2*D),M=C+o()*.25,R=Math.max(2,(.01+o()*.05)*a.sx),I=t.createRadialGradient(a.X(v),a.Y(M),0,a.X(v),a.Y(M),R);I.addColorStop(0,"rgba(95,40,12,0.8)"),I.addColorStop(1,"rgba(95,40,12,0)"),t.fillStyle=I,t.fillRect(a.X(v)-R,a.Y(M)-R,R*2,R*2)}for(let c=0;c<120;c++){const v=e+o()*r,M=s+o()*r,R=.5+o()*o()*2;t.fillStyle=o()<.7?et(n.base,.7):"rgba(105,95,85,0.6)",t.fillRect(v,M,R*(.6+o()),R)}t.restore()}function e0(){const e=B(7771),s=X(512,512),n=s.getContext("2d");n.fillStyle="#000",n.fillRect(0,0,512,512),n.globalCompositeOperation="lighter";const o=(d,p)=>{p(d),d<40&&p(d+512),d>472&&p(d-512)};for(let d=0;d<300;d++){const p=e()<.72,u=e()*512,m=p?e()*14:40+e()*380,y=p?20+Math.pow(e(),1.8)*420:15+e()*140,S=.8+e()*e()*4,c=.15+e()*.65;o(u,v=>{const M=n.createLinearGradient(0,m,0,m+y);if(M.addColorStop(0,`rgba(255,255,255,${c})`),M.addColorStop(.3,`rgba(255,255,255,${c*.7})`),M.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=M,n.fillRect(v-S/2,m,S,y),!p){const R=n.createRadialGradient(v,m,0,v,m,3+e()*6);R.addColorStop(0,`rgba(255,255,255,${c})`),R.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=R,n.fillRect(v-10,m-10,20,20)}})}for(let d=0;d<90;d++){const p=e()*512,u=e()<.65?512-e()*46:e()*14,m=3+e()*22,y=.2+e()*.6;o(p,S=>{const c=n.createRadialGradient(S,u,0,S,u,m);c.addColorStop(0,`rgba(255,255,255,${y})`),c.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=c,n.fillRect(S-m,u-m,m*2,m*2)})}n.globalCompositeOperation="source-over",n.filter="blur(0.7px)",n.drawImage(s,0,0),n.filter="none";const i=X(512,512),r=i.getContext("2d");r.fillStyle="#000",r.fillRect(0,0,512,512),r.lineCap="round";for(let d=0;d<220;d++){const p=e()*512,u=Math.pow(e(),.8)*512,m=3+e()*e()*40,y=e()<.7?(e()-.5)*.6:e()*Math.PI,S=.3+e()*.7;r.strokeStyle=`rgba(255,255,255,${S})`,r.lineWidth=.5+e()*1.3;for(const c of[0,512,-512])for(const v of[0,512,-512])r.beginPath(),r.moveTo(p+c,u+v),r.lineTo(p+c+Math.cos(y)*m,u+v+Math.sin(y)*m),r.stroke()}for(let d=0;d<160;d++){const p=e()*512,u=e()*512,m=1+e()*3;r.fillStyle=`rgba(255,255,255,${.5+e()*.5})`,r.fillRect(p,u,m,m*(.5+e()))}const a=n.getImageData(0,0,512,512).data,l=r.getImageData(0,0,512,512).data,f=yt(4242,64),g=X(512,512),b=g.getContext("2d"),h=b.createImageData(512,512);for(let d=0;d<512;d++)for(let p=0;p<512;p++){const u=(d*512+p)*4;let m=St(f,p/512,d/512,5,5);m=Math.max(0,Math.min(1,(m-.42)*2.4)),h.data[u]=a[u],h.data[u+1]=m*255,h.data[u+2]=l[u],h.data[u+3]=255}return b.putImageData(h,0,0),g}function o0(){const e=B(991),s=new Float32Array(512*512),n=yt(77,32);for(let o=0;o<512;o++)for(let i=0;i<512;i++)s[o*512+i]=St(n,i/512,o/512,3,4)*1.2;for(let o=0;o<46;o++){const i=e()*512,r=e()*512,a=6+Math.pow(e(),2)*60,l=(.4+e())*(a/40),f=Math.ceil(a*2.5);for(let g=-f;g<=f;g++)for(let b=-f;b<=f;b++){const h=((Math.floor(i)+b)%512+512)%512,d=((Math.floor(r)+g)%512+512)%512;s[d*512+h]-=l*Math.exp(-(b*b+g*g)/(2*a*a))}}for(let o=0;o<40;o++){let i=e()*512,r=e()*512;const a=(e()-.5)*.8+(e()<.3?1.5:0),l=10+e()*80;for(let f=0;f<l;f++){const g=(Math.floor(i)%512+512)%512,b=(Math.floor(r)%512+512)%512;s[b*512+g]-=.25,i+=Math.cos(a),r+=Math.sin(a)}}return Lt(s,512,512,2.2)}const a0=`
attribute vec2 aA; attribute vec3 aD; attribute vec3 aT; attribute vec4 aInst;
varying vec2 vA; varying vec3 vD; varying vec4 vI; varying vec3 vT;
#ifdef CTR_DMG
attribute vec2 aDmg; varying vec2 vDmg;
#endif
`,r0=`
vA = aA; vD = aD; vI = aInst;
{ vec3 tO = aT;
#ifdef USE_INSTANCING
  tO = mat3(instanceMatrix) * tO;
#endif
  vT = normalize(mat3(modelViewMatrix) * tO); }
#ifdef CTR_DMG
vDmg = aDmg;
#endif
`,n0=`
uniform sampler2D tAtlas; uniform sampler2D tDoor; uniform sampler2D tGrime; uniform sampler2D tDetN; uniform sampler2D tDoorN;
uniform float uShift[16];
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float rowV(float li, float v) { return 1.0 - (li + 1.0 - clamp(v, 0.012, 0.988)) * 0.125; }
float edgeLine(float d, float w, float fw) { return 1.0 - smoothstep(w, w + fw * 1.5 + 1e-4, d); }
varying vec2 vA; varying vec3 vD; varying vec4 vI; varying vec3 vT;
#ifdef CTR_DMG
varying vec2 vDmg;
#endif
float cbox(float t, float a, float b, float e) { return smoothstep(a - e, a + e, t) - smoothstep(b - e, b + e, t); }
// trapezoidal corrugation: returns dh/du, 'inner' = 1 on the recessed flats
float trap(float u, float P, float depth, out float inner) {
  float fw = fwidth(u) / P;
  float t = fract(u / P);
  float e = clamp(fw * 1.2, 0.03, 0.14);
  float fade = 1.0 - smoothstep(0.09, 0.3, fw);
  inner = cbox(t, 0.37, 0.63, e) * fade;
  return (cbox(t, 0.63, 0.87, e) - cbox(t, 0.13, 0.37, e)) * depth / (0.24 * P) * fade;
}
`,s0=`
int fti = int(vD.z + 0.5);
float sideK = floor((vD.z - float(fti)) * 10.0 + 0.5);
float liF = floor(vI.x + 0.5);
float seedI = floor(vI.z * 4096.0 + 0.5) * 0.37 + sideK * 7.0; // quantised: interpolation noise x hash = speckle
const float CELL = 1.112; // one corrugation sheet = 4 ribs
float ci = floor(vD.x / CELL);
float cfr = fract(vD.x / CELL);
float fwX = fwidth(vD.x), fwY = fwidth(vD.y), fwXY = max(fwX, fwY); // derivatives outside any branch
vec2 dAx = dFdx(vA) * vec2(1.0, 0.125), dAy = dFdy(vA) * vec2(1.0, 0.125);
vec2 gs = fract(vec2(vI.z * 17.13, vI.z * 5.71 + 0.3));
float hgt = clamp(vD.y / ${x.toFixed(2)}, 0.0, 1.0);
vec3 col; float cRough = 0.6; float cMetal = 0.12;
bool horiz = (fti == 1 || fti == 5);
vec3 gr = texture2D(tGrime, horiz ? vD.xy / vec2(4.0, 2.44) + gs : vec2(vD.x / 4.0 + gs.x, clamp(hgt, 0.004, 0.996))).rgb;
if (fti == 3) {
  int li = int(vI.x + 0.5); float gx = float(li - (li / 4) * 4), gy = float(li / 4);
  vec2 l = clamp(vA, 0.003, 0.997);
  col = texture2D(tDoor, vec2((gx + l.x) * 0.25, 1.0 - (gy + 1.0 - l.y) * 0.5)).rgb;
} else if (fti <= 5) {
  float av = fti == 4 ? (vA.y < 0.0 ? 0.97 : hgt) : (fti == 5 ? 0.03 : vA.y);
  vec2 auv = vec2(vA.x, rowV(liF, av));
  if (fti == 0) {
    // slide the side graphic per instance (wraps inside the panel; only the lettering band moves)
    bool is20 = vA.x * ${q}.0 >= ${U[0]}.0;
    float Lp = is20 ? ${F.L20} : ${F.L40};
    float bandTop = liF > 6.5 ? 1.70 : ${It[1].toFixed(3)};
    if (vD.y > ${It[0].toFixed(3)} && vD.y < bandTop) {
      float sh = (fract(vI.z * 31.77) * 2.0 - 1.0) * uShift[int(liF) * 2 + (is20 ? 1 : 0)];
      float um = mod(vD.x - sh, Lp);
      auv.x = (is20 ? ${U[0]}.0 + um / Lp * ${U[1]}.0 : ${K[0]}.0 + um / Lp * ${K[1]}.0) / ${q}.0;
    }
  }
  // explicit gradients from the continuous coordinate: no mip pops at the band edges / wrap point
  col = textureGrad(tAtlas, auv, dAx, dAy).rgb;
  vec3 swC = textureGrad(tAtlas, vec2(${Q.toFixed(5)}, rowV(liF, hgt)), vec2(0.0), vec2(0.0)).rgb;
  if (fti == 0 || fti == 2) {
    // per-box sheet variation, seams and occasional repainted / primer patch sheets
    float hs = h12(vec2(ci, seedI));
    col *= 0.95 + 0.1 * hs;
    col *= 1.0 - 0.16 * edgeLine(min(cfr, 1.0 - cfr) * CELL, 0.004, fwX) * (1.0 - smoothstep(0.004, 0.02, fwX));
    float hp = h12(vec2(ci * 1.37 + 5.1, seedI + 3.3));
    if (fti == 0 && hp < 0.085) {
      float h2 = h12(vec2(ci, seedI + 9.1)), h3 = h12(vec2(ci + 2.0, seedI + 1.7));
      bool bottom = h2 < 0.6;
      float ph = 0.45 + h3 * 1.1;
      float y0 = bottom ? ${C} : ${x-.1} - ph, y1 = y0 + ph;
      if (vD.y > y0 && vD.y < y1) {
        vec3 pc = h3 > 0.88 ? vec3(0.26, 0.25, 0.23) : swC * (0.86 + 0.22 * h2);
        float e = min(min(cfr, 1.0 - cfr) * CELL, min(vD.y - y0, y1 - vD.y));
        col = mix(pc, vec3(0.28, 0.13, 0.05), 0.55 * edgeLine(e, 0.008, fwXY));
      }
    }
  }
  if (fti == 5) {
    // underside: dark steel cross members, forklift pockets (20') / gooseneck tunnel (40'), bottom rails, castings
    float Lb = vA.y, x = vD.x, z = vD.y;
    vec3 steel = mix(vec3(0.16, 0.15, 0.14), col * 0.55, 0.35);
    float cm = fract(x / 0.6);
    float member = step(0.78, cm);
    float rim = edgeLine(abs(cm - 0.78) * 0.6, 0.006, fwX) + edgeLine(abs(cm - 1.0) * 0.6, 0.006, fwX);
    vec3 u = steel * (0.7 + 0.3 * gr.g);
    u = mix(u, steel * 1.35, member);
    u = mix(u, steel * 0.45, 0.6 * rim);
    float rail = step(z, 0.16) + step(${A-.16}, z);
    u = mix(u, col * 0.8, clamp(rail, 0.0, 1.0));
    if (Lb < 8.0) {
      for (int k = 0; k < 2; k++) {
        float pc = Lb * 0.5 + (k == 0 ? -1.025 : 1.025);
        float d = abs(x - pc);
        if (d < 0.18) u = mix(vec3(0.02), steel * 1.5, edgeLine(0.18 - d, 0.02, fwXY));
      }
    } else if (x < 3.15 && abs(z - ${A/2}) < 0.515) {
      float d = min(3.15 - x, 0.515 - abs(z - ${A/2}));
      u = mix(steel * 0.3, steel * 1.4, edgeLine(d, 0.02, fwXY));
    }
    vec2 cq = vec2(min(x, Lb - x), min(z, ${A} - z));
    if (cq.x < ${D} && cq.y < ${D}) {
      u = col * 0.6;
      u = mix(u, vec3(0.01), 1.0 - smoothstep(0.7, 1.0, length((cq - vec2(${D/2})) / vec2(0.06, 0.03))));
    }
    col = u;
    cMetal = 0.25; cRough = 0.75;
  }
  if (fti == 4) {
    // corner castings: bottom/top 118 mm of the posts, oval apertures
    const float CP = ${D.toFixed(3)};
    float hole = 0.0, isC = 0.0;
    if (vA.y > 0.0) {
      float Lf = vA.y;
      float cu = vD.x < CP + 0.01 ? CP * 0.5 : (vD.x > Lf - CP - 0.01 ? Lf - CP * 0.5 : -1.0);
      if (cu > 0.0 && (vD.y < 0.118 || vD.y > ${(x-.118).toFixed(3)})) {
        isC = 1.0;
        float cv = vD.y < 0.118 ? 0.062 : ${(x-.062).toFixed(3)};
        vec2 q = (vD.xy - vec2(cu, cv)) / (Lf > 3.0 ? vec2(0.039, 0.025) : vec2(0.03, 0.025));
        hole = 1.0 - smoothstep(0.75, 1.0, length(q));
      }
    } else {
      float Lf = -vA.y;
      float ux = vD.x < CP + 0.01 ? CP * 0.5 : (vD.x > Lf - CP - 0.01 ? Lf - CP * 0.5 : -1.0);
      float uz = vD.y < CP + 0.01 ? CP * 0.5 : (vD.y > ${(A-D-.01).toFixed(3)} ? ${(A-D/2).toFixed(3)} : -1.0);
      if (uz > 0.0 && ux > 0.0) { vec2 q = (vD.xy - vec2(ux, uz)) / vec2(0.03, 0.06); hole = 1.0 - smoothstep(0.75, 1.0, length(q)); isC = 1.0; }
    }
    col = mix(col, col * vec3(0.72, 0.66, 0.6), isC);
    col = mix(col, vec3(0.015), hole);
    cRough = mix(cRough, 0.75, isC);
  }
} else if (fti == 6) {
  col = vec3(0.30, 0.29, 0.27) * (0.85 + 0.3 * gr.g); cRough = 0.95; cMetal = 0.0;
} else if (fti == 7) {
  float pl = fract(vD.y / 0.305);
  float grain = texture2D(tGrime, vec2(vD.x / 7.0, vD.y / 0.5)).g;
  col = vec3(0.40, 0.26, 0.15) * (0.7 + 0.55 * grain) * (0.55 + 0.45 * smoothstep(0.0, 0.04, pl) * smoothstep(1.0, 0.96, pl));
  cRough = 0.85; cMetal = 0.0;
} else {
  col = vec3(0.55, 0.40, 0.24) * (0.85 + 0.25 * gr.g);
  if (abs(vA.x - 0.5) < 0.07) col = vec3(0.62, 0.52, 0.36);
  cRough = 0.9; cMetal = 0.0;
}
if (fti <= 5) {
  float rustA = vI.w;
  col *= 1.0 - 0.2 * (1.0 - gr.g); // mottling
  float streak;
  if (horiz) streak = smoothstep(0.62, 0.9, gr.g) * rustA * (fti == 5 ? 0.35 : 0.8);
  else {
    float a1 = h12(vec2(ci, seedI + 11.0)), b1 = h12(vec2(ci + 7.0, seedI + 2.0)), c1 = h12(vec2(ci + 3.0, seedI + 5.0));
    float dTop = 1.0 - hgt;
    float s1 = 0.45 + 1.1 * b1;
    vec2 gdx = vec2(dFdx(vD.x) / 4.0, dFdx(hgt)), gdy = vec2(dFdy(vD.x) / 4.0, dFdy(hgt));
    float r1 = textureGrad(tGrime, vec2(vD.x / 4.0 * (0.8 + 0.4 * c1) + a1 * 7.31, clamp(1.0 - dTop / s1, 0.004, 0.996)), gdx, gdy / s1).r * step(dTop, s1);
    float k1 = pow(c1, 1.6) * 1.9;
    float cj = floor(vD.x / 1.946 + 0.37);
    float a2 = h12(vec2(cj, seedI + 21.0)), c2 = h12(vec2(cj + 1.0, seedI + 23.0));
    float r2 = textureGrad(tGrime, vec2(vD.x / 3.1 + a2 * 5.17, hgt), gdx * 1.29, gdy).r;
    float k2 = 0.25 + pow(c2, 2.0) * 1.2;
    streak = max(r1 * k1, r2 * k2) * (0.25 + 1.1 * rustA);
  }
  if (fti == 3) streak *= 0.7;
  vec3 rustC = mix(vec3(0.24, 0.085, 0.03), vec3(0.50, 0.22, 0.07), gr.g);
  float rs = clamp(streak, 0.0, 1.0) * 0.8;
  col = mix(col, rustC, rs);
  float dirt = horiz ? smoothstep(0.3, 0.9, gr.g) * 0.45 : gr.g * (smoothstep(0.5, 0.0, hgt) * 0.9 + 0.2);
  dirt *= 0.45 + rustA * 0.7;
  col = mix(col, col * vec3(0.5, 0.46, 0.4), clamp(dirt, 0.0, 1.0));
  float scr = smoothstep(0.45, 1.0, gr.b) * (0.2 + rustA * 0.5) * (horiz ? 0.35 : 1.0) * (1.0 - smoothstep(0.4, 1.5, fwX * 100.0));
  col = mix(col, mix(col, vec3(0.36, 0.34, 0.32), 0.6), scr);
  if (fti == 1) { float lum = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(col, vec3(lum) * vec3(1.04, 1.0, 0.95), 0.35) * 0.92; cRough = 0.8; }
  col *= vI.y;
  cRough = mix(cRough, 0.92, rs) ; cRough = mix(cRough, 0.42, scr * 0.6);
  cMetal = mix(cMetal, 0.55, scr * 0.6); cMetal = mix(cMetal, 0.0, rs);
}
#ifdef CTR_DMG
col = mix(col, vec3(0.42, 0.40, 0.37) * (0.8 + 0.4 * gr.g), clamp(vDmg.y, 0.0, 1.0));
cRough = mix(cRough, 0.4, clamp(vDmg.y, 0.0, 1.0)); cMetal = mix(cMetal, 0.65, clamp(vDmg.y, 0.0, 1.0));
if (fti < 6) col *= 1.0 - clamp(vDmg.x, 0.0, 0.95);
#endif
diffuseColor.rgb *= col;
`,l0=`
{
  vec3 Tv = vT - dot(vT, normal) * normal; float tl = length(Tv);
  Tv = tl > 1e-4 ? Tv / tl : vec3(1.0, 0.0, 0.0);
  vec3 Bv = cross(normal, Tv);
  float inner = 0.0; float sl = 0.0;
  if (fti == 0 || fti == 2) sl = trap(vD.x, 0.278, 0.022, inner);
  else if (fti == 6) sl = -0.7 * trap(vD.x, 0.278, 0.036, inner);
  else if (fti == 1) { float P = 0.46; float fw = fwidth(vD.x) / P; sl = 0.035 * cos(6.2832 * vD.x / P) * (1.0 - smoothstep(0.15, 0.4, fw)); }
  vec2 dn = vec2(0.0);
  if (fti <= 3) dn = (texture2D(tDetN, vD.xy / vec2(2.7, 2.1) + gs * 3.0).xy * 2.0 - 1.0) * (0.45 + vI.w * 0.7) * (fti == 1 ? 0.3 : (fti == 3 ? 0.45 : 1.0));
  if (fti == 3) dn += (texture2D(tDoorN, clamp(vA, 0.0, 1.0)).xy * 2.0 - 1.0) * 1.1;
  vec3 nG = normal;
  normal = normalize(normal - Tv * sl + Tv * dn.x + Bv * dn.y);
#if NUM_DIR_LIGHTS > 0
  // faces turned away from the sun: don't let ribs catch direct light (would expose back-face shadow acne)
  { vec3 Ls = directionalLights[0].direction; float gl = dot(nG, Ls);
    if (gl < 0.02) { float nl = dot(normal, Ls); if (nl > gl) normal = normalize(normal - Ls * (nl - min(gl, 0.0)) * 1.02); } }
#endif
  diffuseColor.rgb *= 1.0 - inner * 0.06;
}
`,i0=`
if (fti == 5) {
#if NUM_HEMI_LIGHTS > 0
  vec3 amb = hemisphereLights[0].skyColor * 0.35 + hemisphereLights[0].groundColor * 0.65;
#else
  vec3 amb = vec3(0.35);
#endif
  reflectedLight.indirectDiffuse = max(reflectedLight.indirectDiffuse, diffuseColor.rgb * max(amb, vec3(0.06)) * 1.1);
}
#ifdef CTR_DMG
if (fti >= 6) {
  float occ = 1.0 - clamp(vDmg.x, 0.0, 0.95);
  reflectedLight.directDiffuse *= occ * occ; reflectedLight.directSpecular *= occ * occ;
  reflectedLight.indirectDiffuse *= occ; reflectedLight.indirectSpecular *= occ * occ;
}
#endif
`;function zt(t){const e=new Gt({color:16777215,roughness:.6,metalness:.12});return t&&(e.defines={CTR_DMG:1}),e.onBeforeCompile=s=>{s.uniforms.tAtlas={value:k.atlas},s.uniforms.tDoor={value:k.door},s.uniforms.tGrime={value:k.grime},s.uniforms.tDetN={value:k.detN},s.uniforms.tDoorN={value:k.doorN},s.uniforms.uShift={value:ut},s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
`+a0).replace("#include <begin_vertex>",`#include <begin_vertex>
`+r0),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
`+n0).replace("#include <map_fragment>",s0).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = cRough;`).replace("#include <metalnessmap_fragment>",`#include <metalnessmap_fragment>
metalnessFactor = cMetal;`).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
`+l0).replace("#include <aomap_fragment>",`#include <aomap_fragment>
`+i0)},e.customProgramCacheKey=()=>"bayhem-container-"+(t?1:0),e}function c0(){try{return typeof location<"u"&&/[?&]ctrlow=1/.test(location.search)?!0:typeof navigator<"u"&&/OculusBrowser|Quest|Pico/i.test(navigator.userAgent||"")}catch{return!1}}function Z(t,{lowMem:e=c0()}={}){if(k)return k;const s=performance.now();G=e?128:256;const n=t?Math.min(8,t.capabilities.getMaxAnisotropy()):4,o=Kt(31,256,6,4,1.8),i=X(q,G*8),r=i.getContext("2d");nt.forEach((u,m)=>{const y=B(1e3+m*77);ut[m*2]=Tt(r,K[0],m*G,K[1],F.L40,u,y,o,!1),ut[m*2+1]=Tt(r,U[0],m*G,U[1],F.L20,u,y,o,!0),Zt(r,m*G,u)});const a=X(j*4,j*2),l=a.getContext("2d");nt.forEach((u,m)=>t0(l,m%4*j,Math.floor(m/4)*j,u,B(500+m*31),o));const f=Jt(),g=H(i,{repeat:!1,aniso:n});g.wrapS=g.wrapT=Ct;const b=H(a,{repeat:!1,aniso:n});b.wrapS=b.wrapT=Ct;const h=H(e0(),{srgb:!1,aniso:n}),d=H(o0(),{srgb:!1,aniso:n}),p=H(Lt(f.h,f.S,f.S,3),{srgb:!1,aniso:n,repeat:!1});return k={atlas:g,door:b,grime:h,detN:d,doorN:p,canvases:{ac:i,dc:a}},k.field=zt(!1),k.hero=zt(!0),k.field.shadowSide=Ht,k.cardboard=f0(),k.buildMs=Math.round(performance.now()-s),k.texBytes=Math.round((q*G*8+j*j*8+3*512*512+128*128)*4*4/3),k.lowMem=e,k}function f0(){const t=X(128,128),e=t.getContext("2d"),s=B(55);e.fillStyle="#8c6a43",e.fillRect(0,0,128,128);for(let n=0;n<400;n++)e.fillStyle=`rgba(${s()<.5?"60,40,20":"170,140,100"},0.08)`,e.fillRect(s()*128,s()*128,2+s()*10,1);return e.fillStyle="#b39a74",e.fillRect(54,0,20,128),e.fillStyle="rgba(30,25,20,0.8)",e.font="700 13px Oswald, sans-serif",e.fillText("THIS SIDE UP",6,112),e.fillText("↑↑",100,20),new Gt({map:H(t,{aniso:4}),roughness:.92,metalness:0})}function pt(){return{p:[],n:[],a:[],d:[],t:[],dm:[],w:[],i:[]}}const w=(t,e,s)=>[t,e,s];function d0(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]}function kt(t){const e=Math.hypot(t[0],t[1],t[2])||1;return[t[0]/e,t[1]/e,t[2]/e]}function h0(t,e,s){return Math.abs(e[1])>.5?[t[0]+s/2,t[2]+A/2]:Math.abs(e[2])>.5?[e[2]>0?t[0]+s/2:s/2-t[0],t[1]]:[e[0]>0?A/2-t[2]:t[2]+A/2,t[1]]}function E(t,e,s,n,o,i,{nu:r=1,nv:a=1,side:l=null,dm:f=null,wgt:g=1,cargo:b=!1}={}){const h=kt(d0(s,n)),d=kt(s),p=t.p.length/3;for(let u=0;u<=a;u++)for(let m=0;m<=r;m++){const y=m/r,S=u/a,c=[e[0]+s[0]*y+n[0]*S,e[1]+s[1]*y+n[1]*S,e[2]+s[2]*y+n[2]*S],[v,M]=h0(c,h,i);let R;b?R=[y,S]:o===0?R=[(l[0]+Math.min(1,Math.max(0,v/i))*l[1])/q,c[1]/x]:o===3?R=[v/A,c[1]/x]:o===4?R=[Q,Math.abs(h[1])>.5?-i:Math.abs(h[2])>.5?i:A]:o===5?R=[Q,i]:Math.abs(h[1])>.5?R=[Q,h[1]>0?.97:.03]:R=[Q,c[1]/x];const I=h[2]>.5?0:h[2]<-.5?1:h[0]>.5?2:h[0]<-.5?3:0;t.p.push(...c),t.n.push(...h),t.t.push(...d),t.a.push(...R),t.d.push(v,M,o+.1*I);const z=f?f(c):[0,0];t.dm.push(z[0],z[1]),t.w.push(g)}for(let u=0;u<a;u++)for(let m=0;m<r;m++){const y=p+u*(r+1)+m,S=y+1,c=y+r+2,v=y+r+1;t.i.push(y,S,c,y,c,v)}}function O(t,e,s,n,o,i,r={}){const a=s[0]-e[0],l=s[1]-e[1],f=s[2]-e[2],g=r.sub||[1,1,1];for(const b of n){const h={...r};switch(b){case"+x":E(t,w(s[0],e[1],s[2]),w(0,0,-f),w(0,l,0),o,i,{...h,nu:g[2],nv:g[1]});break;case"-x":E(t,w(e[0],e[1],e[2]),w(0,0,f),w(0,l,0),o,i,{...h,nu:g[2],nv:g[1]});break;case"+z":E(t,w(e[0],e[1],s[2]),w(a,0,0),w(0,l,0),o,i,{...h,nu:g[0],nv:g[1]});break;case"-z":E(t,w(s[0],e[1],e[2]),w(-a,0,0),w(0,l,0),o,i,{...h,nu:g[0],nv:g[1]});break;case"+y":E(t,w(e[0],s[1],s[2]),w(a,0,0),w(0,0,-f),o,i,{...h,nu:g[0],nv:g[2]});break;case"-y":E(t,w(e[0],e[1],e[2]),w(a,0,0),w(0,0,f),o,i,{...h,nu:g[0],nv:g[2]});break}}}function bt(t,e=!1){const s=new qt;return s.setAttribute("position",new V(t.p,3)),s.setAttribute("normal",new V(t.n,3)),s.setAttribute("aA",new V(t.a,2)),s.setAttribute("aD",new V(t.d,3)),s.setAttribute("aT",new V(t.t,3)),e&&s.setAttribute("aDmg",new V(t.dm,2)),s.setIndex(t.i),s.computeBoundingBox(),s.computeBoundingSphere(),s}function $t(t,e,s){const n=e/2,o=A/2,i=s?Math.max(4,Math.ceil(e/.3)):1,r=s?8:1;for(const a of[-1,1])for(const l of[-1,1]){const f=a>0?n-D:-n,g=l>0?o-D:-o;O(t,[f,0,g],[f+D,x,g+D],["+x","-x","+z","-z","+y"],4,e,{sub:[1,r,1]})}for(const a of[-1,1]){const l=a>0?[o-.045,o-.002]:[-o+.002,-o+.045];O(t,[-n+D,0,l[0]],[n-D,C,l[1]],[a>0?"+z":"-z","+y"],4,e,{sub:[i,1,1]});const f=a>0?[o-.1,o-.002]:[-o+.002,-o+.1];O(t,[-n+D,x-.1,f[0]],[n-D,x-.004,f[1]],[a>0?"+z":"-z","-y","+y",a>0?"-z":"+z"],4,e,{sub:[i,1,1]})}O(t,[-n+.002,0,-o+D],[-n+.05,C,o-D],["-x","+y"],4,e,{sub:[1,1,s?6:1]}),O(t,[-n+.002,x-T,-o+D],[-n+.11,x-.004,o-D],["-x","-y","+y","+x"],4,e,{sub:[1,1,s?6:1]}),O(t,[n-.12,0,-o+D],[n-.002,C,o-D],["+x","+y"],4,e,{sub:[1,1,s?6:1]}),O(t,[n-T,x-T,-o+D],[n-.002,x-.004,o-D],["+x","-y","+y","-x"],4,e,{sub:[1,1,s?6:1]})}function _t(t,e,s,n,o){const i=e/2,r=A/2,a=n?Math.max(4,Math.ceil(e/.3)):1,l=n?8:1,f=n?8:1,g=r-Rt,b=C,h=x-.1;E(t,w(-i+D,b,g),w(e-2*D,0,0),w(0,h-b,0),0,e,{nu:a,nv:l,side:s}),E(t,w(i-D,b,-g),w(-(e-2*D),0,0),w(0,h-b,0),0,e,{nu:a,nv:l,side:s}),E(t,w(-i+.1,x-.025,r-.1),w(e-.2,0,0),w(0,0,-(A-.2)),1,e,{nu:a,nv:f}),E(t,w(-i+Rt,C,-r+D),w(0,0,A-2*D),w(0,x-T-C,0),2,e,{nu:f,nv:l}),E(t,w(-i,.001,-r),w(e,0,0),w(0,0,A),5,e,{nu:n?12:1,nv:1})}function Ot(t,e,s,n=()=>!0){for(const o of rt){const i=A/2-o;n(i)&&O(t,[s,C+.01,i-.017],[s+.042,x-T-.01,i+.017],["+x","+z","-z"],4,e)}}function Pt(t){const e=pt(),s=t>10?K:U;return _t(e,t,s,!1),$t(e,t,!1),E(e,w(t/2-dt,C,A/2-D),w(0,0,-(A-2*D)),w(0,x-T-C,0),3,t),Ot(e,t,t/2-dt),bt(e)}function N(t){return t=t^61^t>>>16,t=t+(t<<3),t=t^t>>>4,t=Math.imul(t,668265261),t=t^t>>>15,(t>>>0)/4294967296}const it=[.85,1,1,1,1,1,1,1.25];function u0(t,e){const s=new Array(t.length),n=new Map,o=(a,l,f)=>`${Math.round(a*2)},${Math.round(l*2)},${f}`,i=t.map((a,l)=>l).sort((a,l)=>(t[a].tier||0)-(t[l].tier||0)),r=it.reduce((a,l)=>a+l,0);for(const a of i){const l=t[a],f=l.tier||0,g=(l.seed??a*7919+13)>>>0,b=new Set;for(const p of[1,2]){const u=n.get(o(l.x,l.z,f-p));u!==void 0&&b.add(u)}const h=l.rot?[2.5,0]:[0,2.5];for(const p of[-1,1]){const u=n.get(o(l.x+p*h[0],l.z+p*h[1],f));u!==void 0&&b.add(u)}let d;if(e&&l.livery!==void 0)d=(l.livery%8+8)%8;else{let p=N(g*17+9)*r;for(d=0;d<7&&p>it[d];)p-=it[d],d++}for(let p=0;p<8&&b.has(d);p++)d=(d+1+Math.floor(N(g+p*31)*7))%8;if(b.has(d)){for(let p=0;p<8;p++)if(!b.has(p)){d=p;break}}s[a]=d,n.set(o(l.x,l.z,f),d)}return s}function Ft(t,e={}){Z(e.renderer||null);const s=u0(t,!!e.keepLivery),n=new vt;n.name="containers";const o={40:k.geo40||(k.geo40=Pt(F.L40)),20:k.geo20||(k.geo20=Pt(F.L20))},i={40:[],20:[]};t.forEach((S,c)=>i[S.len===20?20:40].push(c));const r=new Array(t.length),a={},l=[],f=new ft,g=new jt,b=new $,h=new $(1,1,1),d=new $(0,1,0);for(const S of[40,20]){const c=i[S];if(!c.length)continue;const v=new Wt(o[S],k.field,c.length),M=new Float32Array(c.length*4);c.forEach((I,z)=>{const P=t[I],L=(P.seed??I*7919+13)>>>0,st=N(L*3+1),Y=N(L*5+2),J=N(L*7+3),lt=N(L*11+4),Nt=st<.5?Math.PI:0;g.setFromAxisAngle(d,(P.rot?Math.PI/2:0)+Nt+(lt-.5)*.012),b.set(P.x,(P.tier||0)*x,P.z),f.compose(b,g,h),v.setMatrixAt(z,f);const Bt=s[I];M[z*4]=Bt,M[z*4+1]=.86+Y*.2,M[z*4+2]=J,M[z*4+3]=Math.pow(N(L*13+5),1.4),r[I]={mesh:v,k:z};const Mt=S===40?F.L40:F.L20,wt=P.rot?A/2:Mt/2,Dt=P.rot?Mt/2:A/2;l.push({min:[P.x-wt,b.y,P.z-Dt],max:[P.x+wt,b.y+x,P.z+Dt]})}),v.geometry=o[S];const R=o[S].clone();R.setAttribute("aInst",new Ut(M,4)),v.geometry=R,v.castShadow=!0,v.receiveShadow=!0,v.instanceMatrix.needsUpdate=!0,v.computeBoundingSphere(),v.name=`containers${S}`,a[S]=v,n.add(v)}const p=new ft().makeScale(0,0,0),u=o[40].index.count/3,m=o[20].index.count/3,y=new Array(8).fill(0);return s.forEach(S=>y[S]++),{root:n,colliders:e.colliders?l:[],count:t.length,liveries:s,info:{livHist:y,lowMem:k.lowMem,instances40:i[40].length,instances20:i[20].length,trisPerBox40:u,trisPerBox20:m,drawCalls:Object.keys(a).length,texMB:+(k.texBytes/1048576).toFixed(1),texBuildMs:k.buildMs,aabbs:l},remove(S){const c=r[S];c&&(c.mesh.setMatrixAt(c.k,p),c.mesh.instanceMatrix.needsUpdate=!0)}}}class ct{constructor({len:e=40,livery:s=0,seed:n=1}={}){Z(null),this.L=e===20?F.L20:F.L40,this.livery=s%nt.length,this.seed=n>>>0,this.rng=B(this.seed*9973+17);const o=this.L,i=o/2,r=A/2,a=[this.livery,.92+N(this.seed)*.12,N(this.seed*3+1),.25+.6*N(this.seed*7+2)];this.root=new vt,this.root.name="heroContainer";const l=pt();_t(l,o,e===20?U:K,!0),$t(l,o,!0);const g=y=>[.35+.55*Math.min(1,(i-y[0])/Math.min(o,4.5)),0],b=Math.max(3,Math.ceil(o/.5)),h=r-.11,d=x-.09;E(l,w(i-D,C,h),w(-(o-D-.08),0,0),w(0,d-C,0),6,o,{nu:b,nv:5,dm:g}),E(l,w(-i+.08,C,-h),w(o-D-.08,0,0),w(0,d-C,0),6,o,{nu:b,nv:5,dm:g}),E(l,w(-i+.08,d,-h),w(o-D-.08,0,0),w(0,0,2*h),6,o,{nu:b,nv:4,dm:g}),E(l,w(-i+.08,C,h),w(o-.12-.08,0,0),w(0,0,-2*h),7,o,{nu:b,nv:4,dm:g}),E(l,w(-i+.08,C,h),w(0,0,-2*h),w(0,d-C,0),6,o,{nu:4,nv:5,dm:g});const p=B(this.seed*31+5);let u=-i+.12;for(;u<i-(e===20?2.4:4);){const y=.5+p()*.3;for(let S=-h+.04;S<h-.45;){const c=.45+p()*.35,v=2+Math.floor(p()*3);let M=C;for(let R=0;R<v;R++){const I=.4+p()*.25;if(M+I>d-.45)break;const z=(p()-.5)*.06,P=(p()-.5)*.06;O(l,[u+z,M,S+P],[u+z+y,M+I,S+P+Math.min(c,h-S-.02)],["+x","+y","-z","+z"],8,o,{cargo:!0,wgt:.8,dm:g}),M+=I}S+=c+.02}u+=y+.03}this.shellGeo=bt(l,!0),this.base=Float32Array.from(this.shellGeo.attributes.position.array),this.wgt=Float32Array.from(l.w),this.off=new Float32Array(this.base.length),this.dmg=this.shellGeo.attributes.aDmg,this.dmg0=Float32Array.from(this.dmg.array);const m=this.base.length/3;this.shellGeo.setAttribute("aInst",new V(new Float32Array(m*4).map((y,S)=>a[S%4]),4)),this.shell=new tt(this.shellGeo,k.hero),this.shell.castShadow=this.shell.receiveShadow=!0,this.root.add(this.shell),this.doors=[];for(const y of[1,-1]){const S=pt(),c=y*(r-D),v=y*.006,M=i-dt,R=M-.05,I=Math.min(c,v),z=Math.max(c,v);O(S,[R,C+.004,I],[M,x-T-.004,z],["+x"],3,o,{sub:[1,8,4]}),O(S,[R,C+.004,I],[M,x-T-.004,z],["-x"],6,o,{sub:[1,4,2],dm:()=>[.1,0]}),O(S,[R,C+.004,I],[M,x-T-.004,z],["+z","-z","+y","-y"],4,o),Ot(S,o,M,J=>J*y>0);const P=new $(i-.04,0,y*(r-.02)),L=bt(S,!0);L.translate(-P.x,0,-P.z);const st=L.attributes.position.count;L.setAttribute("aInst",new V(new Float32Array(st*4).map((J,lt)=>a[lt%4]),4));const Y=new tt(L,k.hero);Y.position.copy(P),Y.castShadow=Y.receiveShadow=!0,this.root.add(Y),this.doors.push({mesh:Y,sign:y>0?-1:1,ang:0,vel:0,attached:!0})}this._crush=0,this._crushVec=null,this.burstDone=!1,this.info={tris:this.shellGeo.index.count/3,doorTris:this.doors[0].mesh.geometry.index.count/3,drawCalls:3}}_apply(){const e=this.shellGeo.attributes.position,s=e.array,n=this._crushVec,o=this._crush;for(let i=0;i<s.length;i++)s[i]=this.base[i]+this.off[i]+(n?n[i]*o:0);e.needsUpdate=!0,this.shellGeo.computeVertexNormals(),this.shellGeo.computeBoundingSphere(),this.dmg.needsUpdate=!0}dent(e,s,n=.6,o=.15){this.root.updateMatrixWorld(!0);const i=new ft().copy(this.root.matrixWorld).invert(),r=e.clone().applyMatrix4(i),a=s.clone().transformDirection(i).normalize(),l=this.shellGeo.attributes.position.array,f=this.dmg.array,g=n*n;for(let b=0,h=0;b<l.length;b+=3,h++){const d=l[b]-r.x,p=l[b+1]-r.y,u=l[b+2]-r.z,m=d*d+p*p+u*u;if(m>=g)continue;const y=1-m/g,S=y*y*this.wgt[h],c=Math.min(1,this.base[b+1]/.3);this.off[b]+=a.x*o*S,this.off[b+1]+=a.y*o*S*c,this.off[b+2]+=a.z*o*S,f[h*2]=Math.min(.6,f[h*2]+.22*S),f[h*2+1]=Math.min(.9,f[h*2+1]+Math.max(0,S-.35)*1.2*(.6+.4*this.rng()))}this._apply()}crush(e=1){const s=this.L,n=s/2;if(!this._crushVec){const a=this.base,l=new Float32Array(a.length),g=B(this.seed*13+3)()*6.28;for(let b=0,h=0;b<a.length;b+=3,h++){const d=a[b],p=a[b+1],u=a[b+2];this.wgt[h];const m=Math.sin(Math.PI*Math.min(1,Math.max(0,(d+n)/s))),y=Math.min(1,Math.max(0,p/x)),S=u/(A/2),c=At.smoothstep(d,-n+2,-n),v=Math.sin(d*2.3+g)*Math.sin(u*3.1+g*.7)*.06+Math.sin(d*5.7+g*2)*.025;let M=(-.5*Math.pow(m,1.2)*(1-.4*S*S)+v*m)*Math.pow(y,1.5),R=Math.sign(u)*(.16*m+.05*Math.sin(d*1.7+g))*Math.sin(Math.PI*y)*Math.min(1,Math.abs(S)*1.2),I=.32*c*y*y;M+=-.35*c*y+.06*c*Math.sin(p*7+g)*Math.sin(Math.PI*y),R+=.1*c*Math.sin(p*9+d*3+g)*Math.sign(u||1)*Math.sin(Math.PI*y);const z=1;l[b]=I*z,l[b+1]=M*z,l[b+2]=R*z}this._crushVec=l}const o=this._crush;this._crush=Math.max(this._crush,Math.min(1.2,e));const i=this.dmg.array,r=this._crushVec;for(let a=0;a<i.length/2;a++){const l=Math.hypot(r[a*3],r[a*3+1],r[a*3+2])*(this._crush-o);l<=0||(i[a*2]=Math.min(.55,i[a*2]+l*.35),i[a*2+1]=Math.min(.85,i[a*2+1]+Math.max(0,l-.25)*1.4*this.rng()))}this._apply()}burst(e=new $(0,0,-1)){const s={pieces:[],spill:[]};if(this.burstDone)return s;this.burstDone=!0;const n=this.rng,o=this.L,i=o/2;this.root.updateMatrixWorld(!0);const r=(()=>{let d=this.root;for(;d.parent;)d=d.parent;return d})(),a=(d,p,u)=>new $(d,p,u).applyMatrix4(this.root.matrixWorld),l=new $(1,0,0).transformDirection(this.root.matrixWorld);for(const d of[1,-1])this.dent(a(i-1.2-n()*1.2,1.3,d*A/2),new $(0,0,d).transformDirection(this.root.matrixWorld),1.4,.16);this.dent(a(i-1.5,x,0),new $(0,1,0).transformDirection(this.root.matrixWorld),1.5,.14);const f=this.dmg.array,g=this.base;for(let d=0;d<f.length/2;d++){const p=g[d*3],u=At.smoothstep(p,i-1.6,i);f[d*2]=Math.min(.92,f[d*2]+u*.45)}this.dmg.needsUpdate=!0;const b=n()<.65?n()<.5?0:1:-1;this.doors.forEach((d,p)=>{if(d.vel=d.sign*(11+n()*7),p===b){d.attached=!1,d.mesh.rotation.y=d.sign*.5,d.mesh.updateMatrixWorld(!0),r.attach(d.mesh);const u=l.clone().multiplyScalar(8+n()*5).addScaledVector(e,2).add(new $(0,3.5+n()*3,0));s.pieces.push({obj:d.mesh,vel:u,angVel:new $((n()-.5)*8,(n()-.5)*10,(n()-.5)*8)})}});const h=4+Math.floor(n()*3);for(let d=0;d<h;d++){const p=.35+n()*.3,u=new tt(new Xt(p*(1+n()*.4),p,p*(.8+n()*.4)),k.cardboard);u.castShadow=u.receiveShadow=!0,u.position.copy(a(i-.4-n()*1.2,C+p/2+n()*1.2,(n()-.5)*1.6)),u.rotation.set(n()*3,n()*3,n()*3),r.attach(u);const m=l.clone().multiplyScalar(4+n()*6).add(new $((n()-.5)*3,2+n()*4,(n()-.5)*3)).addScaledVector(e,1.5);s.spill.push({obj:u,vel:m})}return s}update(e){const s=3*Math.PI/2-.06;for(const n of this.doors){if(!n.attached||n.vel===0&&n.ang===0)continue;n.vel*=Math.exp(-1.6*e),n.ang+=n.vel*e;const o=n.ang*n.sign;o>s&&(n.ang=n.sign*s,n.vel=-n.vel*.3),o<0&&(n.ang=0,n.vel=-n.vel*.3),Math.abs(n.vel)<.02&&(n.vel=0),n.mesh.rotation.y=n.ang}}}async function p0(t={}){var u;try{await Promise.all([document.fonts.load("400 64px Anton"),document.fonts.load("700 64px Oswald"),document.fonts.load("500 64px Oswald")])}catch{}Z(t.renderer);const e=B(2024),s=[],n=[-3.42,-5.92,-8.42,-15.4,-17.9,3.42,5.92,8.42,15.4,17.9],o=[5.9,-6.6,-19.1,-31.6];let i=1;for(const m of n){const y=Math.abs(m)>12;for(const S of o){const c=1+Math.floor(e()*(y?4:3.4));for(let v=0;v<c;v++)if(e()<.22&&v===0)for(const M of[-3.08,3.08])s.push({x:m,z:S+M,tier:0,rot:1,len:20,livery:Math.floor(e()*8),seed:i++});else s.push({x:m,z:S,tier:v,rot:1,len:40,livery:Math.floor(e()*8),seed:i++})}}for(let m=0;m<4;m++)for(let y=0;y<1+m%3;y++)s.push({x:-19+m*12.5,z:-42,tier:y,rot:0,len:40,livery:Math.floor(e()*8),seed:i++});s.push({x:0,z:-12,tier:15/x,rot:0,len:40,livery:2,seed:4242});const r=Ft(s,{renderer:t.renderer}),a=new vt;a.add(r.root);const l=new ct({len:20,livery:0,seed:3});l.root.position.set(-4.6,0,16.2),l.root.rotation.y=-Math.PI/2+.25;const f=new ct({len:20,livery:3,seed:8});f.root.position.set(4.8,0,16),f.root.rotation.y=-Math.PI/2-.2;const g=new ct({len:40,livery:1,seed:5});g.root.position.set(.6,0,-50),g.root.rotation.y=.12,a.add(l.root,f.root,g.root),t.scene&&t.scene.add(a),a.updateMatrixWorld(!0);const b=new $;for(const[m,y,S,c]of[[.6,1.3,.8,.26],[-1.7,.7,.55,.18],[-.6,2.2,.7,.14],[2.1,1.7,.4,.12]]){const v=new $(m,y,-A/2).applyMatrix4(f.root.matrixWorld);b.set(0,0,1).transformDirection(f.root.matrixWorld),f.dent(v,b,S,c)}g.crush(1);const h=l.burst(new $(0,0,-1)),d=t.scene||a;for(const m of[...h.spill,...h.pieces]){d.attach(m.obj);const y=m.obj===((u=h.pieces[0])==null?void 0:u.obj);if(m.obj.position.addScaledVector(m.vel,y?.32:.22),y)m.obj.rotation.set(-Math.PI/2,0,.6),m.obj.position.y=.05;else{m.obj.geometry.computeBoundingBox();const S=m.obj.geometry.boundingBox;m.obj.rotation.set(0,m.obj.rotation.y,0),m.obj.position.y=(S.max.y-S.min.y)/2}}for(let m=0;m<90;m++)l.update(1/30);const p=r.info.trisPerBox40*r.info.instances40+r.info.trisPerBox20*r.info.instances20;return{root:a,update(m){l.update(m),f.update(m),g.update(m)},info:{field:{...r.info,aabbs:void 0},fieldTris:p,hero:l.info,count:s.length}}}async function b0(t="side",e={}){typeof t=="object"&&(e=t,t="side");try{await Promise.all([document.fonts.load("400 64px Anton"),document.fonts.load("700 64px Oswald"),document.fonts.load("500 64px Oswald")])}catch{}Z(e.renderer);const s=t==="door"?k.door:k.atlas;return{root:new tt(new Vt(t==="door"?3.2:2.4,t==="door"?1.6:2.4),new Yt({map:s,toneMapped:!1,fog:!1}))}}async function v0(t={}){t&&t.renderer===void 0&&arguments.length>1&&(t=arguments[arguments.length-1]),Z(t.renderer);const e=B(99),s=[];let n=1;for(let r=0;r<6;r++)for(let a=0;a<6;a++){const l=-60+r*22,f=10-a*22,g=(r+a)%2;for(let b=0;b<6;b++)for(let h=0;h<1;h++){const d=1+Math.floor(e()*4);for(let p=0;p<d;p++){const u=b*2.5;s.push(g?{x:l+u,z:f-6,tier:p,rot:1,len:40,livery:Math.floor(e()*8),seed:n++}:{x:l+6,z:f-u,tier:p,rot:0,len:e()<.2?20:40,livery:Math.floor(e()*8),seed:n++})}}}const o=performance.now(),i=Ft(s,{renderer:t.renderer});return{root:i.root,info:{...i.info,aabbs:void 0,buildFieldMs:Math.round(performance.now()-o)}}}export{F as CONTAINER,g0 as CONTAINER_LIVERIES,ct as HeroContainer,b0 as _atlas,p0 as _demo,v0 as _perf,Ft as buildContainerField,Z as initContainerMaterials};
