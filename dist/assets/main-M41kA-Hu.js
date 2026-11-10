const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-Cpao31y8.js","./geom-_uRDsqh1.js","./player-pF0wNE6J.js","./collision-xJRtH7oH.js","./vehicles-BFrjx_Ep.js","./physics-CBicSHo_.js","./ai-D18hTjZw.js","./dustfx-CpD9UGV8.js","./beats-BSO71suU.js","./index-BIC6IZeA.js","./snipers-C9hvpopv.js","./glass-DkZIMnNL.js","./birds-BfZEwQ_U.js","./heli-CO4vBTsl.js","./index-CxbRluyP.js","./debug-D9HZ3r3h.js","./index-Cy1CjNxM.js","./layout-CFCO55gl.js","./auto-m4w5fb3F.js","./index-BemA0WcI.js","./lasers-Ie4FZnNs.js","./reflections-D_A2GnaT.js","./auto-B4dmFIbH.js","./index-Bu0Xvo2U.js","./index-C4-tjS-H.js","./index-B25I8YkR.js","./index-BkwAKH01.js","./index-Bu6P-knG.js"])))=>i.map(i=>d[i]);
(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(i){if(i.ep)return;i.ep=!0;const s=e(i);fetch(i.href,s)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Go="170",Lp={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},Dp={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},wd=0,gc=1,Td=2,Up=3,Np=0,Wo=1,Lc=2,Ln=3,ri=0,Le=1,Dn=2,ni=0,ji=1,Qi=2,xc=3,vc=4,Dc=5,bi=100,Ad=101,Ed=102,Cd=103,Rd=104,Id=200,Qa=201,Pd=202,Ld=203,to=204,ks=205,Dd=206,Ud=207,Nd=208,Od=209,Fd=210,Bd=211,zd=212,kd=213,Hd=214,eo=0,no=1,io=2,is=3,so=4,ro=5,ao=6,oo=7,Hr=0,Vd=1,Gd=2,ii=0,Wd=1,Xd=2,qd=3,Uc=4,Yd=5,$d=6,Zd=7,_c="attached",Kd="detached",Xo=300,ai=301,Si=302,Sr=303,wr=304,Xs=306,Hs=1e3,un=1001,Tr=1002,De=1003,Nc=1004,Op=1004,Ds=1005,Fp=1005,we=1006,fr=1007,Bp=1007,vn=1008,zp=1008,zn=1009,Oc=1010,Fc=1011,Vs=1012,qo=1013,oi=1014,tn=1015,qs=1016,Yo=1017,$o=1018,ss=1020,Bc=35902,zc=1021,kc=1022,Xe=1023,Hc=1024,Vc=1025,ts=1026,rs=1027,Zo=1028,Vr=1029,Gc=1030,Ko=1031,kp=1032,Jo=1033,pr=33776,mr=33777,gr=33778,xr=33779,lo=35840,co=35841,ho=35842,uo=35843,fo=36196,po=37492,mo=37496,go=37808,xo=37809,vo=37810,_o=37811,yo=37812,bo=37813,Mo=37814,So=37815,wo=37816,To=37817,Ao=37818,Eo=37819,Co=37820,Ro=37821,vr=36492,Io=36494,Po=36495,Wc=36283,Lo=36284,Do=36285,Uo=36286,Jd=2200,jd=2201,Qd=2202,Ar=2300,No=2301,Ka=2302,$i=2400,Zi=2401,Er=2402,jo=2500,Xc=2501,Hp=0,Vp=1,Gp=2,tf=3200,ef=3201,Wp=3202,Xp=3203,Ti=0,nf=1,Un="",me="srgb",ls="srgb-linear",Gr="linear",ae="srgb",qp=0,Wi=7680,Yp=7681,$p=7682,Zp=7683,Kp=34055,Jp=34056,jp=5386,Qp=512,tm=513,em=514,nm=515,im=516,sm=517,rm=518,yc=519,sf=512,rf=513,af=514,qc=515,of=516,lf=517,cf=518,hf=519,Cr=35044,_i=35048,am=35040,om=35045,lm=35049,cm=35041,hm=35046,um=35050,dm=35042,fm="100",bc="300 es",Nn=2e3,Rr=2001;class kn{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const i=this._listeners[t];if(i!==void 0){const s=i.indexOf(e);s!==-1&&i.splice(s,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let s=0,a=i.length;s<a;s++)i[s].call(this,t);t.target=null}}}const Ne=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Nh=1234567;const es=Math.PI/180,Gs=180/Math.PI;function dn(){const r=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ne[r&255]+Ne[r>>8&255]+Ne[r>>16&255]+Ne[r>>24&255]+"-"+Ne[t&255]+Ne[t>>8&255]+"-"+Ne[t>>16&15|64]+Ne[t>>24&255]+"-"+Ne[e&63|128]+Ne[e>>8&255]+"-"+Ne[e>>16&255]+Ne[e>>24&255]+Ne[n&255]+Ne[n>>8&255]+Ne[n>>16&255]+Ne[n>>24&255]).toLowerCase()}function _e(r,t,e){return Math.max(t,Math.min(e,r))}function Yc(r,t){return(r%t+t)%t}function pm(r,t,e,n,i){return n+(r-t)*(i-n)/(e-t)}function mm(r,t,e){return r!==t?(e-r)/(t-r):0}function _r(r,t,e){return(1-e)*r+e*t}function gm(r,t,e,n){return _r(r,t,1-Math.exp(-e*n))}function xm(r,t=1){return t-Math.abs(Yc(r,t*2)-t)}function vm(r,t,e){return r<=t?0:r>=e?1:(r=(r-t)/(e-t),r*r*(3-2*r))}function _m(r,t,e){return r<=t?0:r>=e?1:(r=(r-t)/(e-t),r*r*r*(r*(r*6-15)+10))}function ym(r,t){return r+Math.floor(Math.random()*(t-r+1))}function bm(r,t){return r+Math.random()*(t-r)}function Mm(r){return r*(.5-Math.random())}function Sm(r){r!==void 0&&(Nh=r);let t=Nh+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function wm(r){return r*es}function Tm(r){return r*Gs}function Am(r){return(r&r-1)===0&&r!==0}function Em(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))}function Cm(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}function Rm(r,t,e,n,i){const s=Math.cos,a=Math.sin,o=s(e/2),l=a(e/2),c=s((t+n)/2),h=a((t+n)/2),u=s((t-n)/2),d=a((t-n)/2),f=s((n-t)/2),m=a((n-t)/2);switch(i){case"XYX":r.set(o*h,l*u,l*d,o*c);break;case"YZY":r.set(l*d,o*h,l*u,o*c);break;case"ZXZ":r.set(l*u,l*d,o*h,o*c);break;case"XZX":r.set(o*h,l*m,l*f,o*c);break;case"YXY":r.set(l*f,o*h,l*m,o*c);break;case"ZYZ":r.set(l*m,l*f,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function We(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return r/4294967295;case Uint16Array:return r/65535;case Uint8Array:return r/255;case Int32Array:return Math.max(r/2147483647,-1);case Int16Array:return Math.max(r/32767,-1);case Int8Array:return Math.max(r/127,-1);default:throw new Error("Invalid component type.")}}function Gt(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return Math.round(r*4294967295);case Uint16Array:return Math.round(r*65535);case Uint8Array:return Math.round(r*255);case Int32Array:return Math.round(r*2147483647);case Int16Array:return Math.round(r*32767);case Int8Array:return Math.round(r*127);default:throw new Error("Invalid component type.")}}const uf={DEG2RAD:es,RAD2DEG:Gs,generateUUID:dn,clamp:_e,euclideanModulo:Yc,mapLinear:pm,inverseLerp:mm,lerp:_r,damp:gm,pingpong:xm,smoothstep:vm,smootherstep:_m,randInt:ym,randFloat:bm,randFloatSpread:Mm,seededRandom:Sm,degToRad:wm,radToDeg:Tm,isPowerOfTwo:Am,ceilPowerOfTwo:Em,floorPowerOfTwo:Cm,setQuaternionFromProperEuler:Rm,normalize:Gt,denormalize:We};class tt{constructor(t=0,e=0){tt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(_e(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),s=this.x-t.x,a=this.y-t.y;return this.x=s*n-a*i+t.x,this.y=s*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Ht{constructor(t,e,n,i,s,a,o,l,c){Ht.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,a,o,l,c)}set(t,e,n,i,s,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=s,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,s=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],f=n[5],m=n[8],x=i[0],g=i[3],p=i[6],_=i[1],v=i[4],y=i[7],P=i[2],S=i[5],T=i[8];return s[0]=a*x+o*_+l*P,s[3]=a*g+o*v+l*S,s[6]=a*p+o*y+l*T,s[1]=c*x+h*_+u*P,s[4]=c*g+h*v+u*S,s[7]=c*p+h*y+u*T,s[2]=d*x+f*_+m*P,s[5]=d*g+f*v+m*S,s[8]=d*p+f*y+m*T,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*s*h+n*o*l+i*s*c-i*a*l}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*s,f=c*s-a*l,m=e*u+n*d+i*f;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const x=1/m;return t[0]=u*x,t[1]=(i*c-h*n)*x,t[2]=(o*n-i*a)*x,t[3]=d*x,t[4]=(h*e-i*l)*x,t[5]=(i*s-o*e)*x,t[6]=f*x,t[7]=(n*l-c*e)*x,t[8]=(a*e-n*s)*x,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-i*c,i*l,-i*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Sl.makeScale(t,e)),this}rotate(t){return this.premultiply(Sl.makeRotation(-t)),this}translate(t,e){return this.premultiply(Sl.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Sl=new Ht;function df(r){for(let t=r.length-1;t>=0;--t)if(r[t]>=65535)return!0;return!1}const Im={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};function Us(r,t){return new Im[r](t)}function Ir(r){return document.createElementNS("http://www.w3.org/1999/xhtml",r)}function ff(){const r=Ir("canvas");return r.style.display="block",r}const Oh={};function hr(r){r in Oh||(Oh[r]=!0,console.warn(r))}function Pm(r,t,e){return new Promise(function(n,i){function s(){switch(r.clientWaitSync(t,r.SYNC_FLUSH_COMMANDS_BIT,0)){case r.WAIT_FAILED:i();break;case r.TIMEOUT_EXPIRED:setTimeout(s,e);break;default:n()}}setTimeout(s,e)})}function Lm(r){const t=r.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function Dm(r){const t=r.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Jt={enabled:!0,workingColorSpace:ls,spaces:{},convert:function(r,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===ae&&(r.r=si(r.r),r.g=si(r.g),r.b=si(r.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(r.applyMatrix3(this.spaces[t].toXYZ),r.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===ae&&(r.r=Bs(r.r),r.g=Bs(r.g),r.b=Bs(r.b))),r},fromWorkingColorSpace:function(r,t){return this.convert(r,this.workingColorSpace,t)},toWorkingColorSpace:function(r,t){return this.convert(r,t,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Un?Gr:this.spaces[r].transfer},getLuminanceCoefficients:function(r,t=this.workingColorSpace){return r.fromArray(this.spaces[t].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,t,e){return r.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace}};function si(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function Bs(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}const Fh=[.64,.33,.3,.6,.15,.06],Bh=[.2126,.7152,.0722],zh=[.3127,.329],kh=new Ht().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Hh=new Ht().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Jt.define({[ls]:{primaries:Fh,whitePoint:zh,transfer:Gr,toXYZ:kh,fromXYZ:Hh,luminanceCoefficients:Bh,workingColorSpaceConfig:{unpackColorSpace:me},outputColorSpaceConfig:{drawingBufferColorSpace:me}},[me]:{primaries:Fh,whitePoint:zh,transfer:ae,toXYZ:kh,fromXYZ:Hh,luminanceCoefficients:Bh,outputColorSpaceConfig:{drawingBufferColorSpace:me}}});let ps;class pf{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{ps===void 0&&(ps=Ir("canvas")),ps.width=t.width,ps.height=t.height;const n=ps.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=ps}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Ir("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),s=i.data;for(let a=0;a<s.length;a++)s[a]=si(s[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(si(e[n]/255)*255):e[n]=si(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let Um=0;class Ki{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Um++}),this.uuid=dn(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?s.push(wl(i[a].image)):s.push(wl(i[a]))}else s=wl(i);n.url=s}return e||(t.images[this.uuid]=n),n}}function wl(r){return typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&r instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&r instanceof ImageBitmap?pf.getDataURL(r):r.data?{data:Array.from(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Nm=0;class ye extends kn{constructor(t=ye.DEFAULT_IMAGE,e=ye.DEFAULT_MAPPING,n=un,i=un,s=we,a=vn,o=Xe,l=zn,c=ye.DEFAULT_ANISOTROPY,h=Un){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Nm++}),this.uuid=dn(),this.name="",this.source=new Ki(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new tt(0,0),this.repeat=new tt(1,1),this.center=new tt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ht,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Xo)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Hs:t.x=t.x-Math.floor(t.x);break;case un:t.x=t.x<0?0:1;break;case Tr:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Hs:t.y=t.y-Math.floor(t.y);break;case un:t.y=t.y<0?0:1;break;case Tr:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}ye.DEFAULT_IMAGE=null;ye.DEFAULT_MAPPING=Xo;ye.DEFAULT_ANISOTROPY=1;class te{constructor(t=0,e=0,n=0,i=1){te.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,s=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*s,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*s,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*s,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*s,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,s;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],m=l[9],x=l[2],g=l[6],p=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-x)<.01&&Math.abs(m-g)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+x)<.1&&Math.abs(m+g)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const v=(c+1)/2,y=(f+1)/2,P=(p+1)/2,S=(h+d)/4,T=(u+x)/4,E=(m+g)/4;return v>y&&v>P?v<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(v),i=S/n,s=T/n):y>P?y<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(y),n=S/i,s=E/i):P<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(P),n=T/s,i=E/s),this.set(n,i,s,e),this}let _=Math.sqrt((g-m)*(g-m)+(u-x)*(u-x)+(d-h)*(d-h));return Math.abs(_)<.001&&(_=1),this.x=(g-m)/_,this.y=(u-x)/_,this.z=(d-h)/_,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class mf extends kn{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new te(0,0,t,e),this.scissorTest=!1,this.viewport=new te(0,0,t,e);const i={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:we,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const s=new ye(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);s.flipY=!1,s.generateMipmaps=n.generateMipmaps,s.internalFormat=n.internalFormat,this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let i=0,s=this.textures.length;i<s;i++)this.textures[i].image.width=t,this.textures[i].image.height=e,this.textures[i].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Ki(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class _n extends mf{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Qo extends ye{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=De,this.minFilter=De,this.wrapR=un,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Om extends _n{constructor(t=1,e=1,n=1,i={}){super(t,e,i),this.isWebGLArrayRenderTarget=!0,this.depth=n,this.texture=new Qo(null,t,e,n),this.texture.isRenderTargetTexture=!0}}class $c extends ye{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=De,this.minFilter=De,this.wrapR=un,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Fm extends _n{constructor(t=1,e=1,n=1,i={}){super(t,e,i),this.isWebGL3DRenderTarget=!0,this.depth=n,this.texture=new $c(null,t,e,n),this.texture.isRenderTargetTexture=!0}}class Ae{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,s,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3];const d=s[a+0],f=s[a+1],m=s[a+2],x=s[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=f,t[e+2]=m,t[e+3]=x;return}if(u!==x||l!==d||c!==f||h!==m){let g=1-o;const p=l*d+c*f+h*m+u*x,_=p>=0?1:-1,v=1-p*p;if(v>Number.EPSILON){const P=Math.sqrt(v),S=Math.atan2(P,p*_);g=Math.sin(g*S)/P,o=Math.sin(o*S)/P}const y=o*_;if(l=l*g+d*y,c=c*g+f*y,h=h*g+m*y,u=u*g+x*y,g===1-o){const P=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=P,c*=P,h*=P,u*=P}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,s,a){const o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=s[a],d=s[a+1],f=s[a+2],m=s[a+3];return t[e]=o*m+h*u+l*f-c*d,t[e+1]=l*m+h*d+c*u-o*f,t[e+2]=c*m+h*f+o*d-l*u,t[e+3]=h*m-o*u-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,s=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),u=o(s/2),d=l(n/2),f=l(i/2),m=l(s/2);switch(a){case"XYZ":this._x=d*h*u+c*f*m,this._y=c*f*u-d*h*m,this._z=c*h*m+d*f*u,this._w=c*h*u-d*f*m;break;case"YXZ":this._x=d*h*u+c*f*m,this._y=c*f*u-d*h*m,this._z=c*h*m-d*f*u,this._w=c*h*u+d*f*m;break;case"ZXY":this._x=d*h*u-c*f*m,this._y=c*f*u+d*h*m,this._z=c*h*m+d*f*u,this._w=c*h*u-d*f*m;break;case"ZYX":this._x=d*h*u-c*f*m,this._y=c*f*u+d*h*m,this._z=c*h*m-d*f*u,this._w=c*h*u+d*f*m;break;case"YZX":this._x=d*h*u+c*f*m,this._y=c*f*u+d*h*m,this._z=c*h*m-d*f*u,this._w=c*h*u-d*f*m;break;case"XZY":this._x=d*h*u-c*f*m,this._y=c*f*u-d*h*m,this._z=c*h*m+d*f*u,this._w=c*h*u+d*f*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],s=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(s-c)*f,this._z=(a-i)*f}else if(n>o&&n>u){const f=2*Math.sqrt(1+n-o-u);this._w=(h-l)/f,this._x=.25*f,this._y=(i+a)/f,this._z=(s+c)/f}else if(o>u){const f=2*Math.sqrt(1+o-n-u);this._w=(s-c)/f,this._x=(i+a)/f,this._y=.25*f,this._z=(l+h)/f}else{const f=2*Math.sqrt(1+u-n-o);this._w=(a-i)/f,this._x=(s+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(_e(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,s=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+i*c-s*l,this._y=i*h+a*l+s*o-n*c,this._z=s*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-s*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,s=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+s*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=s,this;const l=1-o*o;if(l<=Number.EPSILON){const f=1-e;return this._w=f*a+e*this._w,this._x=f*n+e*this._x,this._y=f*i+e*this._y,this._z=f*s+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=s*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),s*Math.sin(e),s*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class R{constructor(t=0,e=0,n=0){R.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Vh.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Vh.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6]*i,this.y=s[1]*e+s[4]*n+s[7]*i,this.z=s[2]*e+s[5]*n+s[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,s=t.elements,a=1/(s[3]*e+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*e+s[4]*n+s[8]*i+s[12])*a,this.y=(s[1]*e+s[5]*n+s[9]*i+s[13])*a,this.z=(s[2]*e+s[6]*n+s[10]*i+s[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,s=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*i-o*n),h=2*(o*e-s*i),u=2*(s*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-s*u,this.z=i+l*u+s*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[4]*n+s[8]*i,this.y=s[1]*e+s[5]*n+s[9]*i,this.z=s[2]*e+s[6]*n+s[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,s=t.z,a=e.x,o=e.y,l=e.z;return this.x=i*l-s*o,this.y=s*a-n*l,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Tl.copy(this).projectOnVector(t),this.sub(Tl)}reflect(t){return this.sub(Tl.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(_e(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Tl=new R,Vh=new Ae;class qe{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(Sn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(Sn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=Sn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const s=n.getAttribute("position");if(e===!0&&s!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Sn):Sn.fromBufferAttribute(s,a),Sn.applyMatrix4(t.matrixWorld),this.expandByPoint(Sn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ea.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ea.copy(n.boundingBox)),ea.applyMatrix4(t.matrixWorld),this.union(ea)}const i=t.children;for(let s=0,a=i.length;s<a;s++)this.expandByObject(i[s],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Sn),Sn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Js),na.subVectors(this.max,Js),ms.subVectors(t.a,Js),gs.subVectors(t.b,Js),xs.subVectors(t.c,Js),di.subVectors(gs,ms),fi.subVectors(xs,gs),Ii.subVectors(ms,xs);let e=[0,-di.z,di.y,0,-fi.z,fi.y,0,-Ii.z,Ii.y,di.z,0,-di.x,fi.z,0,-fi.x,Ii.z,0,-Ii.x,-di.y,di.x,0,-fi.y,fi.x,0,-Ii.y,Ii.x,0];return!Al(e,ms,gs,xs,na)||(e=[1,0,0,0,1,0,0,0,1],!Al(e,ms,gs,xs,na))?!1:(ia.crossVectors(di,fi),e=[ia.x,ia.y,ia.z],Al(e,ms,gs,xs,na))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Sn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Sn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Xn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Xn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Xn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Xn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Xn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Xn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Xn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Xn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Xn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const Xn=[new R,new R,new R,new R,new R,new R,new R,new R],Sn=new R,ea=new qe,ms=new R,gs=new R,xs=new R,di=new R,fi=new R,Ii=new R,Js=new R,na=new R,ia=new R,Pi=new R;function Al(r,t,e,n,i){for(let s=0,a=r.length-3;s<=a;s+=3){Pi.fromArray(r,s);const o=i.x*Math.abs(Pi.x)+i.y*Math.abs(Pi.y)+i.z*Math.abs(Pi.z),l=t.dot(Pi),c=e.dot(Pi),h=n.dot(Pi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Bm=new qe,js=new R,El=new R;class Be{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Bm.setFromPoints(t).getCenter(n);let i=0;for(let s=0,a=t.length;s<a;s++)i=Math.max(i,n.distanceToSquared(t[s]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;js.subVectors(t,this.center);const e=js.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(js,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(El.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(js.copy(t.center).add(El)),this.expandByPoint(js.copy(t.center).sub(El))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const qn=new R,Cl=new R,sa=new R,pi=new R,Rl=new R,ra=new R,Il=new R;class Ys{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,qn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=qn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(qn.copy(this.origin).addScaledVector(this.direction,e),qn.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){Cl.copy(t).add(e).multiplyScalar(.5),sa.copy(e).sub(t).normalize(),pi.copy(this.origin).sub(Cl);const s=t.distanceTo(e)*.5,a=-this.direction.dot(sa),o=pi.dot(this.direction),l=-pi.dot(sa),c=pi.lengthSq(),h=Math.abs(1-a*a);let u,d,f,m;if(h>0)if(u=a*l-o,d=a*o-l,m=s*h,u>=0)if(d>=-m)if(d<=m){const x=1/h;u*=x,d*=x,f=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=s,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d=-s,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d<=-m?(u=Math.max(0,-(-a*s+o)),d=u>0?-s:Math.min(Math.max(-s,-l),s),f=-u*u+d*(d+2*l)+c):d<=m?(u=0,d=Math.min(Math.max(-s,-l),s),f=d*(d+2*l)+c):(u=Math.max(0,-(a*s+o)),d=u>0?s:Math.min(Math.max(-s,-l),s),f=-u*u+d*(d+2*l)+c);else d=a>0?-s:s,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(Cl).addScaledVector(sa,d),f}intersectSphere(t,e){qn.subVectors(t.center,this.origin);const n=qn.dot(this.direction),i=qn.dot(qn)-n*n,s=t.radius*t.radius;if(i>s)return null;const a=Math.sqrt(s-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,s,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,i=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,i=(t.min.x-d.x)*c),h>=0?(s=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(s=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||s>i||((s>n||isNaN(n))&&(n=s),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,qn)!==null}intersectTriangle(t,e,n,i,s){Rl.subVectors(e,t),ra.subVectors(n,t),Il.crossVectors(Rl,ra);let a=this.direction.dot(Il),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;pi.subVectors(this.origin,t);const l=o*this.direction.dot(ra.crossVectors(pi,ra));if(l<0)return null;const c=o*this.direction.dot(Rl.cross(pi));if(c<0||l+c>a)return null;const h=-o*pi.dot(Il);return h<0?null:this.at(h/a,s)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Ut{constructor(t,e,n,i,s,a,o,l,c,h,u,d,f,m,x,g){Ut.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,a,o,l,c,h,u,d,f,m,x,g)}set(t,e,n,i,s,a,o,l,c,h,u,d,f,m,x,g){const p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=i,p[1]=s,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=h,p[10]=u,p[14]=d,p[3]=f,p[7]=m,p[11]=x,p[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ut().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/vs.setFromMatrixColumn(t,0).length(),s=1/vs.setFromMatrixColumn(t,1).length(),a=1/vs.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*s,e[5]=n[5]*s,e[6]=n[6]*s,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,s=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(s),u=Math.sin(s);if(t.order==="XYZ"){const d=a*h,f=a*u,m=o*h,x=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=f+m*c,e[5]=d-x*c,e[9]=-o*l,e[2]=x-d*c,e[6]=m+f*c,e[10]=a*l}else if(t.order==="YXZ"){const d=l*h,f=l*u,m=c*h,x=c*u;e[0]=d+x*o,e[4]=m*o-f,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=f*o-m,e[6]=x+d*o,e[10]=a*l}else if(t.order==="ZXY"){const d=l*h,f=l*u,m=c*h,x=c*u;e[0]=d-x*o,e[4]=-a*u,e[8]=m+f*o,e[1]=f+m*o,e[5]=a*h,e[9]=x-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const d=a*h,f=a*u,m=o*h,x=o*u;e[0]=l*h,e[4]=m*c-f,e[8]=d*c+x,e[1]=l*u,e[5]=x*c+d,e[9]=f*c-m,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const d=a*l,f=a*c,m=o*l,x=o*c;e[0]=l*h,e[4]=x-d*u,e[8]=m*u+f,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=f*u+m,e[10]=d-x*u}else if(t.order==="XZY"){const d=a*l,f=a*c,m=o*l,x=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+x,e[5]=a*h,e[9]=f*u-m,e[2]=m*u-f,e[6]=o*h,e[10]=x*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(zm,t,km)}lookAt(t,e,n){const i=this.elements;return sn.subVectors(t,e),sn.lengthSq()===0&&(sn.z=1),sn.normalize(),mi.crossVectors(n,sn),mi.lengthSq()===0&&(Math.abs(n.z)===1?sn.x+=1e-4:sn.z+=1e-4,sn.normalize(),mi.crossVectors(n,sn)),mi.normalize(),aa.crossVectors(sn,mi),i[0]=mi.x,i[4]=aa.x,i[8]=sn.x,i[1]=mi.y,i[5]=aa.y,i[9]=sn.y,i[2]=mi.z,i[6]=aa.z,i[10]=sn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,s=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],f=n[13],m=n[2],x=n[6],g=n[10],p=n[14],_=n[3],v=n[7],y=n[11],P=n[15],S=i[0],T=i[4],E=i[8],M=i[12],b=i[1],C=i[5],N=i[9],D=i[13],U=i[2],H=i[6],k=i[10],G=i[14],O=i[3],J=i[7],K=i[11],ot=i[15];return s[0]=a*S+o*b+l*U+c*O,s[4]=a*T+o*C+l*H+c*J,s[8]=a*E+o*N+l*k+c*K,s[12]=a*M+o*D+l*G+c*ot,s[1]=h*S+u*b+d*U+f*O,s[5]=h*T+u*C+d*H+f*J,s[9]=h*E+u*N+d*k+f*K,s[13]=h*M+u*D+d*G+f*ot,s[2]=m*S+x*b+g*U+p*O,s[6]=m*T+x*C+g*H+p*J,s[10]=m*E+x*N+g*k+p*K,s[14]=m*M+x*D+g*G+p*ot,s[3]=_*S+v*b+y*U+P*O,s[7]=_*T+v*C+y*H+P*J,s[11]=_*E+v*N+y*k+P*K,s[15]=_*M+v*D+y*G+P*ot,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],s=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],f=t[14],m=t[3],x=t[7],g=t[11],p=t[15];return m*(+s*l*u-i*c*u-s*o*d+n*c*d+i*o*f-n*l*f)+x*(+e*l*f-e*c*d+s*a*d-i*a*f+i*c*h-s*l*h)+g*(+e*c*u-e*o*f-s*a*u+n*a*f+s*o*h-n*c*h)+p*(-i*o*h-e*l*u+e*o*d+i*a*u-n*a*d+n*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],f=t[11],m=t[12],x=t[13],g=t[14],p=t[15],_=u*g*c-x*d*c+x*l*f-o*g*f-u*l*p+o*d*p,v=m*d*c-h*g*c-m*l*f+a*g*f+h*l*p-a*d*p,y=h*x*c-m*u*c+m*o*f-a*x*f-h*o*p+a*u*p,P=m*u*l-h*x*l-m*o*d+a*x*d+h*o*g-a*u*g,S=e*_+n*v+i*y+s*P;if(S===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const T=1/S;return t[0]=_*T,t[1]=(x*d*s-u*g*s-x*i*f+n*g*f+u*i*p-n*d*p)*T,t[2]=(o*g*s-x*l*s+x*i*c-n*g*c-o*i*p+n*l*p)*T,t[3]=(u*l*s-o*d*s-u*i*c+n*d*c+o*i*f-n*l*f)*T,t[4]=v*T,t[5]=(h*g*s-m*d*s+m*i*f-e*g*f-h*i*p+e*d*p)*T,t[6]=(m*l*s-a*g*s-m*i*c+e*g*c+a*i*p-e*l*p)*T,t[7]=(a*d*s-h*l*s+h*i*c-e*d*c-a*i*f+e*l*f)*T,t[8]=y*T,t[9]=(m*u*s-h*x*s-m*n*f+e*x*f+h*n*p-e*u*p)*T,t[10]=(a*x*s-m*o*s+m*n*c-e*x*c-a*n*p+e*o*p)*T,t[11]=(h*o*s-a*u*s-h*n*c+e*u*c+a*n*f-e*o*f)*T,t[12]=P*T,t[13]=(h*x*i-m*u*i+m*n*d-e*x*d-h*n*g+e*u*g)*T,t[14]=(m*o*i-a*x*i-m*n*l+e*x*l+a*n*g-e*o*g)*T,t[15]=(a*u*i-h*o*i+h*n*l-e*u*l-a*n*d+e*o*d)*T,this}scale(t){const e=this.elements,n=t.x,i=t.y,s=t.z;return e[0]*=n,e[4]*=i,e[8]*=s,e[1]*=n,e[5]*=i,e[9]*=s,e[2]*=n,e[6]*=i,e[10]*=s,e[3]*=n,e[7]*=i,e[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),s=1-n,a=t.x,o=t.y,l=t.z,c=s*a,h=s*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,s*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,s,a){return this.set(1,n,s,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,s=e._x,a=e._y,o=e._z,l=e._w,c=s+s,h=a+a,u=o+o,d=s*c,f=s*h,m=s*u,x=a*h,g=a*u,p=o*u,_=l*c,v=l*h,y=l*u,P=n.x,S=n.y,T=n.z;return i[0]=(1-(x+p))*P,i[1]=(f+y)*P,i[2]=(m-v)*P,i[3]=0,i[4]=(f-y)*S,i[5]=(1-(d+p))*S,i[6]=(g+_)*S,i[7]=0,i[8]=(m+v)*T,i[9]=(g-_)*T,i[10]=(1-(d+x))*T,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let s=vs.set(i[0],i[1],i[2]).length();const a=vs.set(i[4],i[5],i[6]).length(),o=vs.set(i[8],i[9],i[10]).length();this.determinant()<0&&(s=-s),t.x=i[12],t.y=i[13],t.z=i[14],wn.copy(this);const c=1/s,h=1/a,u=1/o;return wn.elements[0]*=c,wn.elements[1]*=c,wn.elements[2]*=c,wn.elements[4]*=h,wn.elements[5]*=h,wn.elements[6]*=h,wn.elements[8]*=u,wn.elements[9]*=u,wn.elements[10]*=u,e.setFromRotationMatrix(wn),n.x=s,n.y=a,n.z=o,this}makePerspective(t,e,n,i,s,a,o=Nn){const l=this.elements,c=2*s/(e-t),h=2*s/(n-i),u=(e+t)/(e-t),d=(n+i)/(n-i);let f,m;if(o===Nn)f=-(a+s)/(a-s),m=-2*a*s/(a-s);else if(o===Rr)f=-a/(a-s),m=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=f,l[14]=m,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,i,s,a,o=Nn){const l=this.elements,c=1/(e-t),h=1/(n-i),u=1/(a-s),d=(e+t)*c,f=(n+i)*h;let m,x;if(o===Nn)m=(a+s)*u,x=-2*u;else if(o===Rr)m=s*u,x=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-f,l[2]=0,l[6]=0,l[10]=x,l[14]=-m,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const vs=new R,wn=new Ut,zm=new R(0,0,0),km=new R(1,1,1),mi=new R,aa=new R,sn=new R,Gh=new Ut,Wh=new Ae;class ze{constructor(t=0,e=0,n=0,i=ze.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,s=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],u=i[2],d=i[6],f=i[10];switch(e){case"XYZ":this._y=Math.asin(_e(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-_e(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,s),this._z=0);break;case"ZXY":this._x=Math.asin(_e(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-_e(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(_e(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,s)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-_e(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Gh.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Gh,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Wh.setFromEuler(this),this.setFromQuaternion(Wh,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}ze.DEFAULT_ORDER="XYZ";class tl{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Hm=0;const Xh=new R,_s=new Ae,Yn=new Ut,oa=new R,Qs=new R,Vm=new R,Gm=new Ae,qh=new R(1,0,0),Yh=new R(0,1,0),$h=new R(0,0,1),Zh={type:"added"},Wm={type:"removed"},ys={type:"childadded",child:null},Pl={type:"childremoved",child:null};class ee extends kn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Hm++}),this.uuid=dn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ee.DEFAULT_UP.clone();const t=new R,e=new ze,n=new Ae,i=new R(1,1,1);function s(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(s),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Ut},normalMatrix:{value:new Ht}}),this.matrix=new Ut,this.matrixWorld=new Ut,this.matrixAutoUpdate=ee.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ee.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new tl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return _s.setFromAxisAngle(t,e),this.quaternion.multiply(_s),this}rotateOnWorldAxis(t,e){return _s.setFromAxisAngle(t,e),this.quaternion.premultiply(_s),this}rotateX(t){return this.rotateOnAxis(qh,t)}rotateY(t){return this.rotateOnAxis(Yh,t)}rotateZ(t){return this.rotateOnAxis($h,t)}translateOnAxis(t,e){return Xh.copy(t).applyQuaternion(this.quaternion),this.position.add(Xh.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(qh,t)}translateY(t){return this.translateOnAxis(Yh,t)}translateZ(t){return this.translateOnAxis($h,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Yn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?oa.copy(t):oa.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Qs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Yn.lookAt(Qs,oa,this.up):Yn.lookAt(oa,Qs,this.up),this.quaternion.setFromRotationMatrix(Yn),i&&(Yn.extractRotation(i.matrixWorld),_s.setFromRotationMatrix(Yn),this.quaternion.premultiply(_s.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Zh),ys.child=t,this.dispatchEvent(ys),ys.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Wm),Pl.child=t,this.dispatchEvent(Pl),Pl.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Yn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Yn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Yn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Zh),ys.child=t,this.dispatchEvent(ys),ys.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qs,t,Vm),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qs,Gm,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];s(t.shapes,u)}else s(t.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(t.materials,this.material[l]));i.material=o}else i.material=s(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(s(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),f=a(t.animations),m=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),m.length>0&&(n.nodes=m)}return n.object=i,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}ee.DEFAULT_UP=new R(0,1,0);ee.DEFAULT_MATRIX_AUTO_UPDATE=!0;ee.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Tn=new R,$n=new R,Ll=new R,Zn=new R,bs=new R,Ms=new R,Kh=new R,Dl=new R,Ul=new R,Nl=new R,Ol=new te,Fl=new te,Bl=new te;class Qe{constructor(t=new R,e=new R,n=new R){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),Tn.subVectors(t,e),i.cross(Tn);const s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(t,e,n,i,s){Tn.subVectors(i,e),$n.subVectors(n,e),Ll.subVectors(t,e);const a=Tn.dot(Tn),o=Tn.dot($n),l=Tn.dot(Ll),c=$n.dot($n),h=$n.dot(Ll),u=a*c-o*o;if(u===0)return s.set(0,0,0),null;const d=1/u,f=(c*l-o*h)*d,m=(a*h-o*l)*d;return s.set(1-f-m,m,f)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,Zn)===null?!1:Zn.x>=0&&Zn.y>=0&&Zn.x+Zn.y<=1}static getInterpolation(t,e,n,i,s,a,o,l){return this.getBarycoord(t,e,n,i,Zn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Zn.x),l.addScaledVector(a,Zn.y),l.addScaledVector(o,Zn.z),l)}static getInterpolatedAttribute(t,e,n,i,s,a){return Ol.setScalar(0),Fl.setScalar(0),Bl.setScalar(0),Ol.fromBufferAttribute(t,e),Fl.fromBufferAttribute(t,n),Bl.fromBufferAttribute(t,i),a.setScalar(0),a.addScaledVector(Ol,s.x),a.addScaledVector(Fl,s.y),a.addScaledVector(Bl,s.z),a}static isFrontFacing(t,e,n,i){return Tn.subVectors(n,e),$n.subVectors(t,e),Tn.cross($n).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Tn.subVectors(this.c,this.b),$n.subVectors(this.a,this.b),Tn.cross($n).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Qe.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Qe.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,i,s){return Qe.getInterpolation(t,this.a,this.b,this.c,e,n,i,s)}containsPoint(t){return Qe.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Qe.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,s=this.c;let a,o;bs.subVectors(i,n),Ms.subVectors(s,n),Dl.subVectors(t,n);const l=bs.dot(Dl),c=Ms.dot(Dl);if(l<=0&&c<=0)return e.copy(n);Ul.subVectors(t,i);const h=bs.dot(Ul),u=Ms.dot(Ul);if(h>=0&&u<=h)return e.copy(i);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(bs,a);Nl.subVectors(t,s);const f=bs.dot(Nl),m=Ms.dot(Nl);if(m>=0&&f<=m)return e.copy(s);const x=f*c-l*m;if(x<=0&&c>=0&&m<=0)return o=c/(c-m),e.copy(n).addScaledVector(Ms,o);const g=h*m-f*u;if(g<=0&&u-h>=0&&f-m>=0)return Kh.subVectors(s,i),o=(u-h)/(u-h+(f-m)),e.copy(i).addScaledVector(Kh,o);const p=1/(g+x+d);return a=x*p,o=d*p,e.copy(n).addScaledVector(bs,a).addScaledVector(Ms,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const gf={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},gi={h:0,s:0,l:0},la={h:0,s:0,l:0};function zl(r,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?r+(t-r)*6*e:e<1/2?t:e<2/3?r+(t-r)*6*(2/3-e):r}class ht{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=me){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Jt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=Jt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Jt.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=Jt.workingColorSpace){if(t=Yc(t,1),e=_e(e,0,1),n=_e(n,0,1),e===0)this.r=this.g=this.b=n;else{const s=n<=.5?n*(1+e):n+e-n*e,a=2*n-s;this.r=zl(a,s,t+1/3),this.g=zl(a,s,t),this.b=zl(a,s,t-1/3)}return Jt.toWorkingColorSpace(this,i),this}setStyle(t,e=me){function n(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let s;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,e);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,e);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const s=i[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(s,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=me){const n=gf[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=si(t.r),this.g=si(t.g),this.b=si(t.b),this}copyLinearToSRGB(t){return this.r=Bs(t.r),this.g=Bs(t.g),this.b=Bs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=me){return Jt.fromWorkingColorSpace(Oe.copy(this),t),Math.round(_e(Oe.r*255,0,255))*65536+Math.round(_e(Oe.g*255,0,255))*256+Math.round(_e(Oe.b*255,0,255))}getHexString(t=me){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Jt.workingColorSpace){Jt.fromWorkingColorSpace(Oe.copy(this),e);const n=Oe.r,i=Oe.g,s=Oe.b,a=Math.max(n,i,s),o=Math.min(n,i,s);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-s)/u+(i<s?6:0);break;case i:l=(s-n)/u+2;break;case s:l=(n-i)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Jt.workingColorSpace){return Jt.fromWorkingColorSpace(Oe.copy(this),e),t.r=Oe.r,t.g=Oe.g,t.b=Oe.b,t}getStyle(t=me){Jt.fromWorkingColorSpace(Oe.copy(this),t);const e=Oe.r,n=Oe.g,i=Oe.b;return t!==me?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(gi),this.setHSL(gi.h+t,gi.s+e,gi.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(gi),t.getHSL(la);const n=_r(gi.h,la.h,e),i=_r(gi.s,la.s,e),s=_r(gi.l,la.l,e);return this.setHSL(n,i,s),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,s=t.elements;return this.r=s[0]*e+s[3]*n+s[6]*i,this.g=s[1]*e+s[4]*n+s[7]*i,this.b=s[2]*e+s[5]*n+s[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Oe=new ht;ht.NAMES=gf;let Xm=0;class ke extends kn{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Xm++}),this.uuid=dn(),this.name="",this.blending=ji,this.side=ri,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=to,this.blendDst=ks,this.blendEquation=bi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ht(0,0,0),this.blendAlpha=0,this.depthFunc=is,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=yc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Wi,this.stencilZFail=Wi,this.stencilZPass=Wi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==ji&&(n.blending=this.blending),this.side!==ri&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==to&&(n.blendSrc=this.blendSrc),this.blendDst!==ks&&(n.blendDst=this.blendDst),this.blendEquation!==bi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==is&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==yc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Wi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Wi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Wi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(s){const a=[];for(const o in s){const l=s[o];delete l.metadata,a.push(l)}return a}if(e){const s=i(t.textures),a=i(t.images);s.length>0&&(n.textures=s),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=e[s].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class yn extends ke{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new ht(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ze,this.combine=Hr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const jn=qm();function qm(){const r=new ArrayBuffer(4),t=new Float32Array(r),e=new Uint32Array(r),n=new Uint32Array(512),i=new Uint32Array(512);for(let l=0;l<256;++l){const c=l-127;c<-27?(n[l]=0,n[l|256]=32768,i[l]=24,i[l|256]=24):c<-14?(n[l]=1024>>-c-14,n[l|256]=1024>>-c-14|32768,i[l]=-c-1,i[l|256]=-c-1):c<=15?(n[l]=c+15<<10,n[l|256]=c+15<<10|32768,i[l]=13,i[l|256]=13):c<128?(n[l]=31744,n[l|256]=64512,i[l]=24,i[l|256]=24):(n[l]=31744,n[l|256]=64512,i[l]=13,i[l|256]=13)}const s=new Uint32Array(2048),a=new Uint32Array(64),o=new Uint32Array(64);for(let l=1;l<1024;++l){let c=l<<13,h=0;for(;!(c&8388608);)c<<=1,h-=8388608;c&=-8388609,h+=947912704,s[l]=c|h}for(let l=1024;l<2048;++l)s[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)a[l]=l<<23;a[31]=1199570944,a[32]=2147483648;for(let l=33;l<63;++l)a[l]=2147483648+(l-32<<23);a[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(o[l]=1024);return{floatView:t,uint32View:e,baseTable:n,shiftTable:i,mantissaTable:s,exponentTable:a,offsetTable:o}}function Je(r){Math.abs(r)>65504&&console.warn("THREE.DataUtils.toHalfFloat(): Value out of range."),r=_e(r,-65504,65504),jn.floatView[0]=r;const t=jn.uint32View[0],e=t>>23&511;return jn.baseTable[e]+((t&8388607)>>jn.shiftTable[e])}function ur(r){const t=r>>10;return jn.uint32View[0]=jn.mantissaTable[jn.offsetTable[t]+(r&1023)]+jn.exponentTable[t],jn.floatView[0]}const Ym={toHalfFloat:Je,fromHalfFloat:ur},Se=new R,ca=new tt;class oe{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Cr,this.updateRanges=[],this.gpuType=tn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ca.fromBufferAttribute(this,e),ca.applyMatrix3(t),this.setXY(e,ca.x,ca.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.applyMatrix3(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.applyMatrix4(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.applyNormalMatrix(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.transformDirection(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=We(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Gt(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=We(e,this.array)),e}setX(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=We(e,this.array)),e}setY(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=We(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=We(e,this.array)),e}setW(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array),i=Gt(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,s){return t*=this.itemSize,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array),i=Gt(i,this.array),s=Gt(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=s,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Cr&&(t.usage=this.usage),t}}class $m extends oe{constructor(t,e,n){super(new Int8Array(t),e,n)}}class Zm extends oe{constructor(t,e,n){super(new Uint8Array(t),e,n)}}class Km extends oe{constructor(t,e,n){super(new Uint8ClampedArray(t),e,n)}}class Jm extends oe{constructor(t,e,n){super(new Int16Array(t),e,n)}}class Zc extends oe{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class jm extends oe{constructor(t,e,n){super(new Int32Array(t),e,n)}}class Kc extends oe{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class Qm extends oe{constructor(t,e,n){super(new Uint16Array(t),e,n),this.isFloat16BufferAttribute=!0}getX(t){let e=ur(this.array[t*this.itemSize]);return this.normalized&&(e=We(e,this.array)),e}setX(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize]=Je(e),this}getY(t){let e=ur(this.array[t*this.itemSize+1]);return this.normalized&&(e=We(e,this.array)),e}setY(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize+1]=Je(e),this}getZ(t){let e=ur(this.array[t*this.itemSize+2]);return this.normalized&&(e=We(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize+2]=Je(e),this}getW(t){let e=ur(this.array[t*this.itemSize+3]);return this.normalized&&(e=We(e,this.array)),e}setW(t,e){return this.normalized&&(e=Gt(e,this.array)),this.array[t*this.itemSize+3]=Je(e),this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array)),this.array[t+0]=Je(e),this.array[t+1]=Je(n),this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array),i=Gt(i,this.array)),this.array[t+0]=Je(e),this.array[t+1]=Je(n),this.array[t+2]=Je(i),this}setXYZW(t,e,n,i,s){return t*=this.itemSize,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array),i=Gt(i,this.array),s=Gt(s,this.array)),this.array[t+0]=Je(e),this.array[t+1]=Je(n),this.array[t+2]=Je(i),this.array[t+3]=Je(s),this}}class Tt extends oe{constructor(t,e,n){super(new Float32Array(t),e,n)}}let t0=0;const mn=new Ut,kl=new ee,Ss=new R,rn=new qe,tr=new qe,Re=new R;class qt extends kn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:t0++}),this.uuid=dn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(df(t)?Kc:Zc)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const s=new Ht().getNormalMatrix(t);n.applyNormalMatrix(s),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return mn.makeRotationFromQuaternion(t),this.applyMatrix4(mn),this}rotateX(t){return mn.makeRotationX(t),this.applyMatrix4(mn),this}rotateY(t){return mn.makeRotationY(t),this.applyMatrix4(mn),this}rotateZ(t){return mn.makeRotationZ(t),this.applyMatrix4(mn),this}translate(t,e,n){return mn.makeTranslation(t,e,n),this.applyMatrix4(mn),this}scale(t,e,n){return mn.makeScale(t,e,n),this.applyMatrix4(mn),this}lookAt(t){return kl.lookAt(t),kl.updateMatrix(),this.applyMatrix4(kl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ss).negate(),this.translate(Ss.x,Ss.y,Ss.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let i=0,s=t.length;i<s;i++){const a=t[i];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Tt(n,3))}else{for(let n=0,i=e.count;n<i;n++){const s=t[n];e.setXYZ(n,s.x,s.y,s.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new qe);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const s=e[n];rn.setFromBufferAttribute(s),this.morphTargetsRelative?(Re.addVectors(this.boundingBox.min,rn.min),this.boundingBox.expandByPoint(Re),Re.addVectors(this.boundingBox.max,rn.max),this.boundingBox.expandByPoint(Re)):(this.boundingBox.expandByPoint(rn.min),this.boundingBox.expandByPoint(rn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Be);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(t){const n=this.boundingSphere.center;if(rn.setFromBufferAttribute(t),e)for(let s=0,a=e.length;s<a;s++){const o=e[s];tr.setFromBufferAttribute(o),this.morphTargetsRelative?(Re.addVectors(rn.min,tr.min),rn.expandByPoint(Re),Re.addVectors(rn.max,tr.max),rn.expandByPoint(Re)):(rn.expandByPoint(tr.min),rn.expandByPoint(tr.max))}rn.getCenter(n);let i=0;for(let s=0,a=t.count;s<a;s++)Re.fromBufferAttribute(t,s),i=Math.max(i,n.distanceToSquared(Re));if(e)for(let s=0,a=e.length;s<a;s++){const o=e[s],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Re.fromBufferAttribute(o,c),l&&(Ss.fromBufferAttribute(t,c),Re.add(Ss)),i=Math.max(i,n.distanceToSquared(Re))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,i=e.normal,s=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new oe(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let E=0;E<n.count;E++)o[E]=new R,l[E]=new R;const c=new R,h=new R,u=new R,d=new tt,f=new tt,m=new tt,x=new R,g=new R;function p(E,M,b){c.fromBufferAttribute(n,E),h.fromBufferAttribute(n,M),u.fromBufferAttribute(n,b),d.fromBufferAttribute(s,E),f.fromBufferAttribute(s,M),m.fromBufferAttribute(s,b),h.sub(c),u.sub(c),f.sub(d),m.sub(d);const C=1/(f.x*m.y-m.x*f.y);isFinite(C)&&(x.copy(h).multiplyScalar(m.y).addScaledVector(u,-f.y).multiplyScalar(C),g.copy(u).multiplyScalar(f.x).addScaledVector(h,-m.x).multiplyScalar(C),o[E].add(x),o[M].add(x),o[b].add(x),l[E].add(g),l[M].add(g),l[b].add(g))}let _=this.groups;_.length===0&&(_=[{start:0,count:t.count}]);for(let E=0,M=_.length;E<M;++E){const b=_[E],C=b.start,N=b.count;for(let D=C,U=C+N;D<U;D+=3)p(t.getX(D+0),t.getX(D+1),t.getX(D+2))}const v=new R,y=new R,P=new R,S=new R;function T(E){P.fromBufferAttribute(i,E),S.copy(P);const M=o[E];v.copy(M),v.sub(P.multiplyScalar(P.dot(M))).normalize(),y.crossVectors(S,M);const C=y.dot(l[E])<0?-1:1;a.setXYZW(E,v.x,v.y,v.z,C)}for(let E=0,M=_.length;E<M;++E){const b=_[E],C=b.start,N=b.count;for(let D=C,U=C+N;D<U;D+=3)T(t.getX(D+0)),T(t.getX(D+1)),T(t.getX(D+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new oe(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);const i=new R,s=new R,a=new R,o=new R,l=new R,c=new R,h=new R,u=new R;if(t)for(let d=0,f=t.count;d<f;d+=3){const m=t.getX(d+0),x=t.getX(d+1),g=t.getX(d+2);i.fromBufferAttribute(e,m),s.fromBufferAttribute(e,x),a.fromBufferAttribute(e,g),h.subVectors(a,s),u.subVectors(i,s),h.cross(u),o.fromBufferAttribute(n,m),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,g),o.add(h),l.add(h),c.add(h),n.setXYZ(m,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(g,c.x,c.y,c.z)}else for(let d=0,f=e.count;d<f;d+=3)i.fromBufferAttribute(e,d+0),s.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,s),u.subVectors(i,s),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Re.fromBufferAttribute(t,e),Re.normalize(),t.setXYZ(e,Re.x,Re.y,Re.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let f=0,m=0;for(let x=0,g=l.length;x<g;x++){o.isInterleavedBufferAttribute?f=l[x]*o.data.stride+o.offset:f=l[x]*h;for(let p=0;p<h;p++)d[m++]=c[f++]}return new oe(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new qt,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=t(l,n);e.setAttribute(o,c)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],f=t(d,n);l.push(f)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const i={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const f=c[u];h.push(f.toJSON(t.data))}h.length>0&&(i[l]=h,s=!0)}s&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const i=t.attributes;for(const c in i){const h=i[c];this.setAttribute(c,h.clone(e))}const s=t.morphAttributes;for(const c in s){const h=[],u=s[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Jh=new Ut,Li=new Ys,ha=new Be,jh=new R,ua=new R,da=new R,fa=new R,Hl=new R,pa=new R,Qh=new R,ma=new R;class ue extends ee{constructor(t=new qt,e=new yn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(s&&o){pa.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const h=o[l],u=s[l];h!==0&&(Hl.fromBufferAttribute(u,t),a?pa.addScaledVector(Hl,h):pa.addScaledVector(Hl.sub(e),h))}e.add(pa)}return e}raycast(t,e){const n=this.geometry,i=this.material,s=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ha.copy(n.boundingSphere),ha.applyMatrix4(s),Li.copy(t.ray).recast(t.near),!(ha.containsPoint(Li.origin)===!1&&(Li.intersectSphere(ha,jh)===null||Li.origin.distanceToSquared(jh)>(t.far-t.near)**2))&&(Jh.copy(s).invert(),Li.copy(t.ray).applyMatrix4(Jh),!(n.boundingBox!==null&&Li.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Li)))}_computeIntersections(t,e,n){let i;const s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,u=s.attributes.normal,d=s.groups,f=s.drawRange;if(o!==null)if(Array.isArray(a))for(let m=0,x=d.length;m<x;m++){const g=d[m],p=a[g.materialIndex],_=Math.max(g.start,f.start),v=Math.min(o.count,Math.min(g.start+g.count,f.start+f.count));for(let y=_,P=v;y<P;y+=3){const S=o.getX(y),T=o.getX(y+1),E=o.getX(y+2);i=ga(this,p,t,n,c,h,u,S,T,E),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=g.materialIndex,e.push(i))}}else{const m=Math.max(0,f.start),x=Math.min(o.count,f.start+f.count);for(let g=m,p=x;g<p;g+=3){const _=o.getX(g),v=o.getX(g+1),y=o.getX(g+2);i=ga(this,a,t,n,c,h,u,_,v,y),i&&(i.faceIndex=Math.floor(g/3),e.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let m=0,x=d.length;m<x;m++){const g=d[m],p=a[g.materialIndex],_=Math.max(g.start,f.start),v=Math.min(l.count,Math.min(g.start+g.count,f.start+f.count));for(let y=_,P=v;y<P;y+=3){const S=y,T=y+1,E=y+2;i=ga(this,p,t,n,c,h,u,S,T,E),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=g.materialIndex,e.push(i))}}else{const m=Math.max(0,f.start),x=Math.min(l.count,f.start+f.count);for(let g=m,p=x;g<p;g+=3){const _=g,v=g+1,y=g+2;i=ga(this,a,t,n,c,h,u,_,v,y),i&&(i.faceIndex=Math.floor(g/3),e.push(i))}}}}function e0(r,t,e,n,i,s,a,o){let l;if(t.side===Le?l=n.intersectTriangle(a,s,i,!0,o):l=n.intersectTriangle(i,s,a,t.side===ri,o),l===null)return null;ma.copy(o),ma.applyMatrix4(r.matrixWorld);const c=e.ray.origin.distanceTo(ma);return c<e.near||c>e.far?null:{distance:c,point:ma.clone(),object:r}}function ga(r,t,e,n,i,s,a,o,l,c){r.getVertexPosition(o,ua),r.getVertexPosition(l,da),r.getVertexPosition(c,fa);const h=e0(r,t,e,n,ua,da,fa,Qh);if(h){const u=new R;Qe.getBarycoord(Qh,ua,da,fa,u),i&&(h.uv=Qe.getInterpolatedAttribute(i,o,l,c,u,new tt)),s&&(h.uv1=Qe.getInterpolatedAttribute(s,o,l,c,u,new tt)),a&&(h.normal=Qe.getInterpolatedAttribute(a,o,l,c,u,new R),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new R,materialIndex:0};Qe.getNormal(ua,da,fa,d.normal),h.face=d,h.barycoord=u}return h}class Ai extends qt{constructor(t=1,e=1,n=1,i=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:s,depthSegments:a};const o=this;i=Math.floor(i),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,f=0;m("z","y","x",-1,-1,n,e,t,a,s,0),m("z","y","x",1,-1,n,e,-t,a,s,1),m("x","z","y",1,1,t,n,e,i,a,2),m("x","z","y",1,-1,t,n,-e,i,a,3),m("x","y","z",1,-1,t,e,n,i,s,4),m("x","y","z",-1,-1,t,e,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new Tt(c,3)),this.setAttribute("normal",new Tt(h,3)),this.setAttribute("uv",new Tt(u,2));function m(x,g,p,_,v,y,P,S,T,E,M){const b=y/T,C=P/E,N=y/2,D=P/2,U=S/2,H=T+1,k=E+1;let G=0,O=0;const J=new R;for(let K=0;K<k;K++){const ot=K*C-D;for(let bt=0;bt<H;bt++){const Dt=bt*b-N;J[x]=Dt*_,J[g]=ot*v,J[p]=U,c.push(J.x,J.y,J.z),J[x]=0,J[g]=0,J[p]=S>0?1:-1,h.push(J.x,J.y,J.z),u.push(bt/T),u.push(1-K/E),G+=1}}for(let K=0;K<E;K++)for(let ot=0;ot<T;ot++){const bt=d+ot+H*K,Dt=d+ot+H*(K+1),Y=d+(ot+1)+H*(K+1),it=d+(ot+1)+H*K;l.push(bt,Dt,it),l.push(Dt,Y,it),O+=6}o.addGroup(f,O,M),f+=O,d+=G}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ai(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Ws(r){const t={};for(const e in r){t[e]={};for(const n in r[e]){const i=r[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Ge(r){const t={};for(let e=0;e<r.length;e++){const n=Ws(r[e]);for(const i in n)t[i]=n[i]}return t}function n0(r){const t=[];for(let e=0;e<r.length;e++)t.push(r[e].clone());return t}function xf(r){const t=r.getRenderTarget();return t===null?r.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Jt.workingColorSpace}const vf={clone:Ws,merge:Ge};var i0=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,s0=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Ye extends ke{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=i0,this.fragmentShader=s0,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Ws(t.uniforms),this.uniformsGroups=n0(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class el extends ee{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ut,this.projectionMatrix=new Ut,this.projectionMatrixInverse=new Ut,this.coordinateSystem=Nn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const xi=new R,tu=new tt,eu=new tt;class Pe extends el{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Gs*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(es*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Gs*2*Math.atan(Math.tan(es*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){xi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(xi.x,xi.y).multiplyScalar(-t/xi.z),xi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(xi.x,xi.y).multiplyScalar(-t/xi.z)}getViewSize(t,e){return this.getViewBounds(t,tu,eu),e.subVectors(eu,tu)}setViewOffset(t,e,n,i,s,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(es*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,s=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*i/l,e-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(s+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const ws=-90,Ts=1;class _f extends ee{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new Pe(ws,Ts,t,e);i.layers=this.layers,this.add(i);const s=new Pe(ws,Ts,t,e);s.layers=this.layers,this.add(s);const a=new Pe(ws,Ts,t,e);a.layers=this.layers,this.add(a);const o=new Pe(ws,Ts,t,e);o.layers=this.layers,this.add(o);const l=new Pe(ws,Ts,t,e);l.layers=this.layers,this.add(l);const c=new Pe(ws,Ts,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,s,a,o,l]=e;for(const c of e)this.remove(c);if(t===Nn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Rr)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[s,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;const x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,s),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,l),t.setRenderTarget(n,4,i),t.render(e,c),n.texture.generateMipmaps=x,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=m,n.texture.needsPMREMUpdate=!0}}class Wr extends ye{constructor(t,e,n,i,s,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:ai,super(t,e,n,i,s,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class yf extends _n{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];this.texture=new Wr(i,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:we}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Ai(5,5,5),s=new Ye({name:"CubemapFromEquirect",uniforms:Ws(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Le,blending:ni});s.uniforms.tEquirect.value=e;const a=new ue(i,s),o=e.minFilter;return e.minFilter===vn&&(e.minFilter=we),new _f(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,i){const s=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(s)}}const Vl=new R,r0=new R,a0=new Ht;class yi{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=Vl.subVectors(n,e).cross(r0.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Vl),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const s=-(t.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:e.copy(t.start).addScaledVector(n,s)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||a0.getNormalMatrix(t),i=this.coplanarPoint(Vl).applyMatrix4(t),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Di=new Be,xa=new R;class Xr{constructor(t=new yi,e=new yi,n=new yi,i=new yi,s=new yi,a=new yi){this.planes=[t,e,n,i,s,a]}set(t,e,n,i,s,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(s),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Nn){const n=this.planes,i=t.elements,s=i[0],a=i[1],o=i[2],l=i[3],c=i[4],h=i[5],u=i[6],d=i[7],f=i[8],m=i[9],x=i[10],g=i[11],p=i[12],_=i[13],v=i[14],y=i[15];if(n[0].setComponents(l-s,d-c,g-f,y-p).normalize(),n[1].setComponents(l+s,d+c,g+f,y+p).normalize(),n[2].setComponents(l+a,d+h,g+m,y+_).normalize(),n[3].setComponents(l-a,d-h,g-m,y-_).normalize(),n[4].setComponents(l-o,d-u,g-x,y-v).normalize(),e===Nn)n[5].setComponents(l+o,d+u,g+x,y+v).normalize();else if(e===Rr)n[5].setComponents(o,u,x,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Di.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Di.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Di)}intersectsSprite(t){return Di.center.set(0,0,0),Di.radius=.7071067811865476,Di.applyMatrix4(t.matrixWorld),this.intersectsSphere(Di)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let s=0;s<6;s++)if(e[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(xa.x=i.normal.x>0?t.max.x:t.min.x,xa.y=i.normal.y>0?t.max.y:t.min.y,xa.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(xa)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function bf(){let r=null,t=!1,e=null,n=null;function i(s,a){e(s,a),n=r.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=r.requestAnimationFrame(i),t=!0)},stop:function(){r.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(s){e=s},setContext:function(s){r=s}}}function o0(r){const t=new WeakMap;function e(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=r.createBuffer();r.bindBuffer(l,d),r.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=r.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=r.HALF_FLOAT:f=r.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=r.SHORT;else if(c instanceof Uint32Array)f=r.UNSIGNED_INT;else if(c instanceof Int32Array)f=r.INT;else if(c instanceof Int8Array)f=r.BYTE;else if(c instanceof Uint8Array)f=r.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=r.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){const h=l.array,u=l.updateRanges;if(r.bindBuffer(c,o),u.length===0)r.bufferSubData(c,0,h);else{u.sort((f,m)=>f.start-m.start);let d=0;for(let f=1;f<u.length;f++){const m=u[d],x=u[f];x.start<=m.start+m.count+1?m.count=Math.max(m.count,x.start+x.count-m.start):(++d,u[d]=x)}u.length=d+1;for(let f=0,m=u.length;f<m;f++){const x=u[f];r.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(r.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:i,remove:s,update:a}}class Hn extends qt{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const s=t/2,a=e/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,u=t/o,d=e/l,f=[],m=[],x=[],g=[];for(let p=0;p<h;p++){const _=p*d-a;for(let v=0;v<c;v++){const y=v*u-s;m.push(y,-_,0),x.push(0,0,1),g.push(v/o),g.push(1-p/l)}}for(let p=0;p<l;p++)for(let _=0;_<o;_++){const v=_+c*p,y=_+c*(p+1),P=_+1+c*(p+1),S=_+1+c*p;f.push(v,y,S),f.push(y,P,S)}this.setIndex(f),this.setAttribute("position",new Tt(m,3)),this.setAttribute("normal",new Tt(x,3)),this.setAttribute("uv",new Tt(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Hn(t.width,t.height,t.widthSegments,t.heightSegments)}}var l0=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,c0=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,h0=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,u0=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,d0=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,f0=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,p0=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,m0=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,g0=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,x0=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,v0=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,_0=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,y0=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,b0=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,M0=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,S0=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,w0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,T0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,A0=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,E0=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,C0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,R0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,I0=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,P0=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,L0=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,D0=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,U0=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,N0=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,O0=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,F0=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,B0="gl_FragColor = linearToOutputTexel( gl_FragColor );",z0=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,k0=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,H0=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,V0=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,G0=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,W0=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,X0=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,q0=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Y0=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,$0=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Z0=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,K0=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,J0=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,j0=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Q0=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,tg=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,eg=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ng=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ig=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,sg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,rg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,ag=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,og=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lg=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,cg=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,hg=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,ug=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,dg=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,fg=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,pg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,mg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,gg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,xg=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,vg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,_g=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,yg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,bg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Mg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Sg=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,wg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Tg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Ag=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Eg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Cg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Rg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Ig=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Pg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Lg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Dg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ug=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Ng=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Og=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Fg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Bg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,zg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,kg=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Hg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Vg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Gg=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Wg=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Xg=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,qg=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Yg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,$g=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Zg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Kg=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Jg=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,jg=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Qg=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tx=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,ex=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,nx=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,ix=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,sx=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,rx=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,ax=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const ox=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,lx=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cx=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,hx=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ux=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,dx=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,fx=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,px=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,mx=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,gx=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,xx=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,vx=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_x=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,yx=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,bx=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Mx=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Sx=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,wx=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tx=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Ax=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ex=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Cx=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Rx=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ix=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Px=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Lx=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Dx=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ux=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Nx=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Ox=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Fx=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Bx=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,zx=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,kx=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Vt={alphahash_fragment:l0,alphahash_pars_fragment:c0,alphamap_fragment:h0,alphamap_pars_fragment:u0,alphatest_fragment:d0,alphatest_pars_fragment:f0,aomap_fragment:p0,aomap_pars_fragment:m0,batching_pars_vertex:g0,batching_vertex:x0,begin_vertex:v0,beginnormal_vertex:_0,bsdfs:y0,iridescence_fragment:b0,bumpmap_pars_fragment:M0,clipping_planes_fragment:S0,clipping_planes_pars_fragment:w0,clipping_planes_pars_vertex:T0,clipping_planes_vertex:A0,color_fragment:E0,color_pars_fragment:C0,color_pars_vertex:R0,color_vertex:I0,common:P0,cube_uv_reflection_fragment:L0,defaultnormal_vertex:D0,displacementmap_pars_vertex:U0,displacementmap_vertex:N0,emissivemap_fragment:O0,emissivemap_pars_fragment:F0,colorspace_fragment:B0,colorspace_pars_fragment:z0,envmap_fragment:k0,envmap_common_pars_fragment:H0,envmap_pars_fragment:V0,envmap_pars_vertex:G0,envmap_physical_pars_fragment:tg,envmap_vertex:W0,fog_vertex:X0,fog_pars_vertex:q0,fog_fragment:Y0,fog_pars_fragment:$0,gradientmap_pars_fragment:Z0,lightmap_pars_fragment:K0,lights_lambert_fragment:J0,lights_lambert_pars_fragment:j0,lights_pars_begin:Q0,lights_toon_fragment:eg,lights_toon_pars_fragment:ng,lights_phong_fragment:ig,lights_phong_pars_fragment:sg,lights_physical_fragment:rg,lights_physical_pars_fragment:ag,lights_fragment_begin:og,lights_fragment_maps:lg,lights_fragment_end:cg,logdepthbuf_fragment:hg,logdepthbuf_pars_fragment:ug,logdepthbuf_pars_vertex:dg,logdepthbuf_vertex:fg,map_fragment:pg,map_pars_fragment:mg,map_particle_fragment:gg,map_particle_pars_fragment:xg,metalnessmap_fragment:vg,metalnessmap_pars_fragment:_g,morphinstance_vertex:yg,morphcolor_vertex:bg,morphnormal_vertex:Mg,morphtarget_pars_vertex:Sg,morphtarget_vertex:wg,normal_fragment_begin:Tg,normal_fragment_maps:Ag,normal_pars_fragment:Eg,normal_pars_vertex:Cg,normal_vertex:Rg,normalmap_pars_fragment:Ig,clearcoat_normal_fragment_begin:Pg,clearcoat_normal_fragment_maps:Lg,clearcoat_pars_fragment:Dg,iridescence_pars_fragment:Ug,opaque_fragment:Ng,packing:Og,premultiplied_alpha_fragment:Fg,project_vertex:Bg,dithering_fragment:zg,dithering_pars_fragment:kg,roughnessmap_fragment:Hg,roughnessmap_pars_fragment:Vg,shadowmap_pars_fragment:Gg,shadowmap_pars_vertex:Wg,shadowmap_vertex:Xg,shadowmask_pars_fragment:qg,skinbase_vertex:Yg,skinning_pars_vertex:$g,skinning_vertex:Zg,skinnormal_vertex:Kg,specularmap_fragment:Jg,specularmap_pars_fragment:jg,tonemapping_fragment:Qg,tonemapping_pars_fragment:tx,transmission_fragment:ex,transmission_pars_fragment:nx,uv_pars_fragment:ix,uv_pars_vertex:sx,uv_vertex:rx,worldpos_vertex:ax,background_vert:ox,background_frag:lx,backgroundCube_vert:cx,backgroundCube_frag:hx,cube_vert:ux,cube_frag:dx,depth_vert:fx,depth_frag:px,distanceRGBA_vert:mx,distanceRGBA_frag:gx,equirect_vert:xx,equirect_frag:vx,linedashed_vert:_x,linedashed_frag:yx,meshbasic_vert:bx,meshbasic_frag:Mx,meshlambert_vert:Sx,meshlambert_frag:wx,meshmatcap_vert:Tx,meshmatcap_frag:Ax,meshnormal_vert:Ex,meshnormal_frag:Cx,meshphong_vert:Rx,meshphong_frag:Ix,meshphysical_vert:Px,meshphysical_frag:Lx,meshtoon_vert:Dx,meshtoon_frag:Ux,points_vert:Nx,points_frag:Ox,shadow_vert:Fx,shadow_frag:Bx,sprite_vert:zx,sprite_frag:kx},dt={common:{diffuse:{value:new ht(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ht}},envmap:{envMap:{value:null},envMapRotation:{value:new Ht},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ht}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ht}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ht},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ht},normalScale:{value:new tt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ht},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ht}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ht}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ht}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ht(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ht(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0},uvTransform:{value:new Ht}},sprite:{diffuse:{value:new ht(16777215)},opacity:{value:1},center:{value:new tt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}}},cn={basic:{uniforms:Ge([dt.common,dt.specularmap,dt.envmap,dt.aomap,dt.lightmap,dt.fog]),vertexShader:Vt.meshbasic_vert,fragmentShader:Vt.meshbasic_frag},lambert:{uniforms:Ge([dt.common,dt.specularmap,dt.envmap,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.fog,dt.lights,{emissive:{value:new ht(0)}}]),vertexShader:Vt.meshlambert_vert,fragmentShader:Vt.meshlambert_frag},phong:{uniforms:Ge([dt.common,dt.specularmap,dt.envmap,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.fog,dt.lights,{emissive:{value:new ht(0)},specular:{value:new ht(1118481)},shininess:{value:30}}]),vertexShader:Vt.meshphong_vert,fragmentShader:Vt.meshphong_frag},standard:{uniforms:Ge([dt.common,dt.envmap,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.roughnessmap,dt.metalnessmap,dt.fog,dt.lights,{emissive:{value:new ht(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Vt.meshphysical_vert,fragmentShader:Vt.meshphysical_frag},toon:{uniforms:Ge([dt.common,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.gradientmap,dt.fog,dt.lights,{emissive:{value:new ht(0)}}]),vertexShader:Vt.meshtoon_vert,fragmentShader:Vt.meshtoon_frag},matcap:{uniforms:Ge([dt.common,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.fog,{matcap:{value:null}}]),vertexShader:Vt.meshmatcap_vert,fragmentShader:Vt.meshmatcap_frag},points:{uniforms:Ge([dt.points,dt.fog]),vertexShader:Vt.points_vert,fragmentShader:Vt.points_frag},dashed:{uniforms:Ge([dt.common,dt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Vt.linedashed_vert,fragmentShader:Vt.linedashed_frag},depth:{uniforms:Ge([dt.common,dt.displacementmap]),vertexShader:Vt.depth_vert,fragmentShader:Vt.depth_frag},normal:{uniforms:Ge([dt.common,dt.bumpmap,dt.normalmap,dt.displacementmap,{opacity:{value:1}}]),vertexShader:Vt.meshnormal_vert,fragmentShader:Vt.meshnormal_frag},sprite:{uniforms:Ge([dt.sprite,dt.fog]),vertexShader:Vt.sprite_vert,fragmentShader:Vt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ht},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Vt.background_vert,fragmentShader:Vt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ht}},vertexShader:Vt.backgroundCube_vert,fragmentShader:Vt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Vt.cube_vert,fragmentShader:Vt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Vt.equirect_vert,fragmentShader:Vt.equirect_frag},distanceRGBA:{uniforms:Ge([dt.common,dt.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Vt.distanceRGBA_vert,fragmentShader:Vt.distanceRGBA_frag},shadow:{uniforms:Ge([dt.lights,dt.fog,{color:{value:new ht(0)},opacity:{value:1}}]),vertexShader:Vt.shadow_vert,fragmentShader:Vt.shadow_frag}};cn.physical={uniforms:Ge([cn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ht},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ht},clearcoatNormalScale:{value:new tt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ht},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ht},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ht},sheen:{value:0},sheenColor:{value:new ht(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ht},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ht},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ht},transmissionSamplerSize:{value:new tt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ht},attenuationDistance:{value:0},attenuationColor:{value:new ht(0)},specularColor:{value:new ht(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ht},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ht},anisotropyVector:{value:new tt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ht}}]),vertexShader:Vt.meshphysical_vert,fragmentShader:Vt.meshphysical_frag};const va={r:0,b:0,g:0},Ui=new ze,Hx=new Ut;function Vx(r,t,e,n,i,s,a){const o=new ht(0);let l=s===!0?0:1,c,h,u=null,d=0,f=null;function m(_){let v=_.isScene===!0?_.background:null;return v&&v.isTexture&&(v=(_.backgroundBlurriness>0?e:t).get(v)),v}function x(_){let v=!1;const y=m(_);y===null?p(o,l):y&&y.isColor&&(p(y,1),v=!0);const P=r.xr.getEnvironmentBlendMode();P==="additive"?n.buffers.color.setClear(0,0,0,1,a):P==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(r.autoClear||v)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil))}function g(_,v){const y=m(v);y&&(y.isCubeTexture||y.mapping===Xs)?(h===void 0&&(h=new ue(new Ai(1,1,1),new Ye({name:"BackgroundCubeMaterial",uniforms:Ws(cn.backgroundCube.uniforms),vertexShader:cn.backgroundCube.vertexShader,fragmentShader:cn.backgroundCube.fragmentShader,side:Le,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(P,S,T){this.matrixWorld.copyPosition(T.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),Ui.copy(v.backgroundRotation),Ui.x*=-1,Ui.y*=-1,Ui.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(Ui.y*=-1,Ui.z*=-1),h.material.uniforms.envMap.value=y,h.material.uniforms.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=v.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=v.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(Hx.makeRotationFromEuler(Ui)),h.material.toneMapped=Jt.getTransfer(y.colorSpace)!==ae,(u!==y||d!==y.version||f!==r.toneMapping)&&(h.material.needsUpdate=!0,u=y,d=y.version,f=r.toneMapping),h.layers.enableAll(),_.unshift(h,h.geometry,h.material,0,0,null)):y&&y.isTexture&&(c===void 0&&(c=new ue(new Hn(2,2),new Ye({name:"BackgroundMaterial",uniforms:Ws(cn.background.uniforms),vertexShader:cn.background.vertexShader,fragmentShader:cn.background.fragmentShader,side:ri,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=y,c.material.uniforms.backgroundIntensity.value=v.backgroundIntensity,c.material.toneMapped=Jt.getTransfer(y.colorSpace)!==ae,y.matrixAutoUpdate===!0&&y.updateMatrix(),c.material.uniforms.uvTransform.value.copy(y.matrix),(u!==y||d!==y.version||f!==r.toneMapping)&&(c.material.needsUpdate=!0,u=y,d=y.version,f=r.toneMapping),c.layers.enableAll(),_.unshift(c,c.geometry,c.material,0,0,null))}function p(_,v){_.getRGB(va,xf(r)),n.buffers.color.setClear(va.r,va.g,va.b,v,a)}return{getClearColor:function(){return o},setClearColor:function(_,v=1){o.set(_),l=v,p(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(_){l=_,p(o,l)},render:x,addToRenderList:g}}function Gx(r,t){const e=r.getParameter(r.MAX_VERTEX_ATTRIBS),n={},i=d(null);let s=i,a=!1;function o(b,C,N,D,U){let H=!1;const k=u(D,N,C);s!==k&&(s=k,c(s.object)),H=f(b,D,N,U),H&&m(b,D,N,U),U!==null&&t.update(U,r.ELEMENT_ARRAY_BUFFER),(H||a)&&(a=!1,y(b,C,N,D),U!==null&&r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t.get(U).buffer))}function l(){return r.createVertexArray()}function c(b){return r.bindVertexArray(b)}function h(b){return r.deleteVertexArray(b)}function u(b,C,N){const D=N.wireframe===!0;let U=n[b.id];U===void 0&&(U={},n[b.id]=U);let H=U[C.id];H===void 0&&(H={},U[C.id]=H);let k=H[D];return k===void 0&&(k=d(l()),H[D]=k),k}function d(b){const C=[],N=[],D=[];for(let U=0;U<e;U++)C[U]=0,N[U]=0,D[U]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:C,enabledAttributes:N,attributeDivisors:D,object:b,attributes:{},index:null}}function f(b,C,N,D){const U=s.attributes,H=C.attributes;let k=0;const G=N.getAttributes();for(const O in G)if(G[O].location>=0){const K=U[O];let ot=H[O];if(ot===void 0&&(O==="instanceMatrix"&&b.instanceMatrix&&(ot=b.instanceMatrix),O==="instanceColor"&&b.instanceColor&&(ot=b.instanceColor)),K===void 0||K.attribute!==ot||ot&&K.data!==ot.data)return!0;k++}return s.attributesNum!==k||s.index!==D}function m(b,C,N,D){const U={},H=C.attributes;let k=0;const G=N.getAttributes();for(const O in G)if(G[O].location>=0){let K=H[O];K===void 0&&(O==="instanceMatrix"&&b.instanceMatrix&&(K=b.instanceMatrix),O==="instanceColor"&&b.instanceColor&&(K=b.instanceColor));const ot={};ot.attribute=K,K&&K.data&&(ot.data=K.data),U[O]=ot,k++}s.attributes=U,s.attributesNum=k,s.index=D}function x(){const b=s.newAttributes;for(let C=0,N=b.length;C<N;C++)b[C]=0}function g(b){p(b,0)}function p(b,C){const N=s.newAttributes,D=s.enabledAttributes,U=s.attributeDivisors;N[b]=1,D[b]===0&&(r.enableVertexAttribArray(b),D[b]=1),U[b]!==C&&(r.vertexAttribDivisor(b,C),U[b]=C)}function _(){const b=s.newAttributes,C=s.enabledAttributes;for(let N=0,D=C.length;N<D;N++)C[N]!==b[N]&&(r.disableVertexAttribArray(N),C[N]=0)}function v(b,C,N,D,U,H,k){k===!0?r.vertexAttribIPointer(b,C,N,U,H):r.vertexAttribPointer(b,C,N,D,U,H)}function y(b,C,N,D){x();const U=D.attributes,H=N.getAttributes(),k=C.defaultAttributeValues;for(const G in H){const O=H[G];if(O.location>=0){let J=U[G];if(J===void 0&&(G==="instanceMatrix"&&b.instanceMatrix&&(J=b.instanceMatrix),G==="instanceColor"&&b.instanceColor&&(J=b.instanceColor)),J!==void 0){const K=J.normalized,ot=J.itemSize,bt=t.get(J);if(bt===void 0)continue;const Dt=bt.buffer,Y=bt.type,it=bt.bytesPerElement,mt=Y===r.INT||Y===r.UNSIGNED_INT||J.gpuType===qo;if(J.isInterleavedBufferAttribute){const lt=J.data,Lt=lt.stride,Bt=J.offset;if(lt.isInstancedInterleavedBuffer){for(let Nt=0;Nt<O.locationSize;Nt++)p(O.location+Nt,lt.meshPerAttribute);b.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=lt.meshPerAttribute*lt.count)}else for(let Nt=0;Nt<O.locationSize;Nt++)g(O.location+Nt);r.bindBuffer(r.ARRAY_BUFFER,Dt);for(let Nt=0;Nt<O.locationSize;Nt++)v(O.location+Nt,ot/O.locationSize,Y,K,Lt*it,(Bt+ot/O.locationSize*Nt)*it,mt)}else{if(J.isInstancedBufferAttribute){for(let lt=0;lt<O.locationSize;lt++)p(O.location+lt,J.meshPerAttribute);b.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let lt=0;lt<O.locationSize;lt++)g(O.location+lt);r.bindBuffer(r.ARRAY_BUFFER,Dt);for(let lt=0;lt<O.locationSize;lt++)v(O.location+lt,ot/O.locationSize,Y,K,ot*it,ot/O.locationSize*lt*it,mt)}}else if(k!==void 0){const K=k[G];if(K!==void 0)switch(K.length){case 2:r.vertexAttrib2fv(O.location,K);break;case 3:r.vertexAttrib3fv(O.location,K);break;case 4:r.vertexAttrib4fv(O.location,K);break;default:r.vertexAttrib1fv(O.location,K)}}}}_()}function P(){E();for(const b in n){const C=n[b];for(const N in C){const D=C[N];for(const U in D)h(D[U].object),delete D[U];delete C[N]}delete n[b]}}function S(b){if(n[b.id]===void 0)return;const C=n[b.id];for(const N in C){const D=C[N];for(const U in D)h(D[U].object),delete D[U];delete C[N]}delete n[b.id]}function T(b){for(const C in n){const N=n[C];if(N[b.id]===void 0)continue;const D=N[b.id];for(const U in D)h(D[U].object),delete D[U];delete N[b.id]}}function E(){M(),a=!0,s!==i&&(s=i,c(s.object))}function M(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:o,reset:E,resetDefaultState:M,dispose:P,releaseStatesOfGeometry:S,releaseStatesOfProgram:T,initAttributes:x,enableAttribute:g,disableUnusedAttributes:_}}function Wx(r,t,e){let n;function i(c){n=c}function s(c,h){r.drawArrays(n,c,h),e.update(h,n,1)}function a(c,h,u){u!==0&&(r.drawArraysInstanced(n,c,h,u),e.update(h,n,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let f=0;for(let m=0;m<u;m++)f+=h[m];e.update(f,n,1)}function l(c,h,u,d){if(u===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let m=0;m<c.length;m++)a(c[m],h[m],d[m]);else{f.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let m=0;for(let x=0;x<u;x++)m+=h[x]*d[x];e.update(m,n,1)}}this.setMode=i,this.render=s,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Xx(r,t,e,n){let i;function s(){if(i!==void 0)return i;if(t.has("EXT_texture_filter_anisotropic")===!0){const T=t.get("EXT_texture_filter_anisotropic");i=r.getParameter(T.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function a(T){return!(T!==Xe&&n.convert(T)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(T){const E=T===qs&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(T!==zn&&n.convert(T)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_TYPE)&&T!==tn&&!E)}function l(T){if(T==="highp"){if(r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.HIGH_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT).precision>0)return"highp";T="mediump"}return T==="mediump"&&r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.MEDIUM_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),f=r.getParameter(r.MAX_TEXTURE_IMAGE_UNITS),m=r.getParameter(r.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=r.getParameter(r.MAX_TEXTURE_SIZE),g=r.getParameter(r.MAX_CUBE_MAP_TEXTURE_SIZE),p=r.getParameter(r.MAX_VERTEX_ATTRIBS),_=r.getParameter(r.MAX_VERTEX_UNIFORM_VECTORS),v=r.getParameter(r.MAX_VARYING_VECTORS),y=r.getParameter(r.MAX_FRAGMENT_UNIFORM_VECTORS),P=m>0,S=r.getParameter(r.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:f,maxVertexTextures:m,maxTextureSize:x,maxCubemapSize:g,maxAttributes:p,maxVertexUniforms:_,maxVaryings:v,maxFragmentUniforms:y,vertexTextures:P,maxSamples:S}}function qx(r){const t=this;let e=null,n=0,i=!1,s=!1;const a=new yi,o=new Ht,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const f=u.length!==0||d||n!==0||i;return i=d,n=u.length,f},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){const m=u.clippingPlanes,x=u.clipIntersection,g=u.clipShadows,p=r.get(u);if(!i||m===null||m.length===0||s&&!g)s?h(null):c();else{const _=s?0:n,v=_*4;let y=p.clippingState||null;l.value=y,y=h(m,d,v,f);for(let P=0;P!==v;++P)y[P]=e[P];p.clippingState=y,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=_}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,f,m){const x=u!==null?u.length:0;let g=null;if(x!==0){if(g=l.value,m!==!0||g===null){const p=f+x*4,_=d.matrixWorldInverse;o.getNormalMatrix(_),(g===null||g.length<p)&&(g=new Float32Array(p));for(let v=0,y=f;v!==x;++v,y+=4)a.copy(u[v]).applyMatrix4(_,o),a.normal.toArray(g,y),g[y+3]=a.constant}l.value=g,l.needsUpdate=!0}return t.numPlanes=x,t.numIntersection=0,g}}function Yx(r){let t=new WeakMap;function e(a,o){return o===Sr?a.mapping=ai:o===wr&&(a.mapping=Si),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Sr||o===wr)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new yf(l.height);return c.fromEquirectangularTexture(r,a),t.set(a,c),a.addEventListener("dispose",i),e(c.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function s(){t=new WeakMap}return{get:n,dispose:s}}class qr extends el{constructor(t=-1,e=1,n=1,i=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let s=n-t,a=n+t,o=i+e,l=i-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const Ns=4,nu=[.125,.215,.35,.446,.526,.582],Yi=20,Gl=new qr,iu=new ht;let Wl=null,Xl=0,ql=0,Yl=!1;const Xi=(1+Math.sqrt(5))/2,As=1/Xi,su=[new R(-Xi,As,0),new R(Xi,As,0),new R(-As,0,Xi),new R(As,0,Xi),new R(0,Xi,-As),new R(0,Xi,As),new R(-1,1,-1),new R(1,1,-1),new R(-1,1,1),new R(1,1,1)];class Oo{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){Wl=this._renderer.getRenderTarget(),Xl=this._renderer.getActiveCubeFace(),ql=this._renderer.getActiveMipmapLevel(),Yl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(t,n,i,s),e>0&&this._blur(s,0,0,e),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ou(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=au(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Wl,Xl,ql),this._renderer.xr.enabled=Yl,t.scissorTest=!1,_a(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===ai||t.mapping===Si?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Wl=this._renderer.getRenderTarget(),Xl=this._renderer.getActiveCubeFace(),ql=this._renderer.getActiveMipmapLevel(),Yl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:we,minFilter:we,generateMipmaps:!1,type:qs,format:Xe,colorSpace:ls,depthBuffer:!1},i=ru(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=ru(t,e,n);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=$x(s)),this._blurMaterial=Zx(s,t,e)}return i}_compileMaterial(t){const e=new ue(this._lodPlanes[0],t);this._renderer.compile(e,Gl)}_sceneToCubeUV(t,e,n,i){const o=new Pe(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(iu),h.toneMapping=ii,h.autoClear=!1;const f=new yn({name:"PMREM.Background",side:Le,depthWrite:!1,depthTest:!1}),m=new ue(new Ai,f);let x=!1;const g=t.background;g?g.isColor&&(f.color.copy(g),t.background=null,x=!0):(f.color.copy(iu),x=!0);for(let p=0;p<6;p++){const _=p%3;_===0?(o.up.set(0,l[p],0),o.lookAt(c[p],0,0)):_===1?(o.up.set(0,0,l[p]),o.lookAt(0,c[p],0)):(o.up.set(0,l[p],0),o.lookAt(0,0,c[p]));const v=this._cubeSize;_a(i,_*v,p>2?v:0,v,v),h.setRenderTarget(i),x&&h.render(m,o),h.render(t,o)}m.geometry.dispose(),m.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=g}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===ai||t.mapping===Si;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=ou()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=au());const s=i?this._cubemapMaterial:this._equirectMaterial,a=new ue(this._lodPlanes[0],s),o=s.uniforms;o.envMap.value=t;const l=this._cubeSize;_a(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Gl)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const i=this._lodPlanes.length;for(let s=1;s<i;s++){const a=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),o=su[(i-s-1)%su.length];this._blur(t,s-1,s,a,o)}e.autoClear=n}_blur(t,e,n,i,s){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",s),this._halfBlur(a,t,n,n,i,"longitudinal",s)}_halfBlur(t,e,n,i,s,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new ue(this._lodPlanes[i],c),d=c.uniforms,f=this._sizeLods[n]-1,m=isFinite(s)?Math.PI/(2*f):2*Math.PI/(2*Yi-1),x=s/m,g=isFinite(s)?1+Math.floor(h*x):Yi;g>Yi&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${Yi}`);const p=[];let _=0;for(let T=0;T<Yi;++T){const E=T/x,M=Math.exp(-E*E/2);p.push(M),T===0?_+=M:T<g&&(_+=2*M)}for(let T=0;T<p.length;T++)p[T]=p[T]/_;d.envMap.value=t.texture,d.samples.value=g,d.weights.value=p,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:v}=this;d.dTheta.value=m,d.mipInt.value=v-n;const y=this._sizeLods[i],P=3*y*(i>v-Ns?i-v+Ns:0),S=4*(this._cubeSize-y);_a(e,P,S,3*y,2*y),l.setRenderTarget(e),l.render(u,Gl)}}function $x(r){const t=[],e=[],n=[];let i=r;const s=r-Ns+1+nu.length;for(let a=0;a<s;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>r-Ns?l=nu[a-r+Ns-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,m=6,x=3,g=2,p=1,_=new Float32Array(x*m*f),v=new Float32Array(g*m*f),y=new Float32Array(p*m*f);for(let S=0;S<f;S++){const T=S%3*2/3-1,E=S>2?0:-1,M=[T,E,0,T+2/3,E,0,T+2/3,E+1,0,T,E,0,T+2/3,E+1,0,T,E+1,0];_.set(M,x*m*S),v.set(d,g*m*S);const b=[S,S,S,S,S,S];y.set(b,p*m*S)}const P=new qt;P.setAttribute("position",new oe(_,x)),P.setAttribute("uv",new oe(v,g)),P.setAttribute("faceIndex",new oe(y,p)),t.push(P),i>Ns&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function ru(r,t,e){const n=new _n(r,t,e);return n.texture.mapping=Xs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function _a(r,t,e,n,i){r.viewport.set(t,e,n,i),r.scissor.set(t,e,n,i)}function Zx(r,t,e){const n=new Float32Array(Yi),i=new R(0,1,0);return new Ye({name:"SphericalGaussianBlur",defines:{n:Yi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Jc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:ni,depthTest:!1,depthWrite:!1})}function au(){return new Ye({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Jc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:ni,depthTest:!1,depthWrite:!1})}function ou(){return new Ye({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Jc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:ni,depthTest:!1,depthWrite:!1})}function Jc(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Kx(r){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===Sr||l===wr,h=l===ai||l===Si;if(c||h){let u=t.get(o);const d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new Oo(r)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{const f=o.image;return c&&f&&f.height>0||h&&f&&i(f)?(e===null&&(e=new Oo(r)),u=c?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",s),u.texture):null}}}return o}function i(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function s(o){const l=o.target;l.removeEventListener("dispose",s);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function Jx(r){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=r.getExtension("WEBGL_depth_texture")||r.getExtension("MOZ_WEBGL_depth_texture")||r.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=r.getExtension("EXT_texture_filter_anisotropic")||r.getExtension("MOZ_EXT_texture_filter_anisotropic")||r.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=r.getExtension("WEBGL_compressed_texture_s3tc")||r.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=r.getExtension("WEBGL_compressed_texture_pvrtc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=r.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const i=e(n);return i===null&&hr("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function jx(r,t,e,n){const i={},s=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const m in d.attributes)t.remove(d.attributes[m]);for(const m in d.morphAttributes){const x=d.morphAttributes[m];for(let g=0,p=x.length;g<p;g++)t.remove(x[g])}d.removeEventListener("dispose",a),delete i[d.id];const f=s.get(d);f&&(t.remove(f),s.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const m in d)t.update(d[m],r.ARRAY_BUFFER);const f=u.morphAttributes;for(const m in f){const x=f[m];for(let g=0,p=x.length;g<p;g++)t.update(x[g],r.ARRAY_BUFFER)}}function c(u){const d=[],f=u.index,m=u.attributes.position;let x=0;if(f!==null){const _=f.array;x=f.version;for(let v=0,y=_.length;v<y;v+=3){const P=_[v+0],S=_[v+1],T=_[v+2];d.push(P,S,S,T,T,P)}}else if(m!==void 0){const _=m.array;x=m.version;for(let v=0,y=_.length/3-1;v<y;v+=3){const P=v+0,S=v+1,T=v+2;d.push(P,S,S,T,T,P)}}else return;const g=new(df(d)?Kc:Zc)(d,1);g.version=x;const p=s.get(u);p&&t.remove(p),s.set(u,g)}function h(u){const d=s.get(u);if(d){const f=u.index;f!==null&&d.version<f.version&&c(u)}else c(u);return s.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Qx(r,t,e){let n;function i(d){n=d}let s,a;function o(d){s=d.type,a=d.bytesPerElement}function l(d,f){r.drawElements(n,f,s,d*a),e.update(f,n,1)}function c(d,f,m){m!==0&&(r.drawElementsInstanced(n,f,s,d*a,m),e.update(f,n,m))}function h(d,f,m){if(m===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,s,d,0,m);let g=0;for(let p=0;p<m;p++)g+=f[p];e.update(g,n,1)}function u(d,f,m,x){if(m===0)return;const g=t.get("WEBGL_multi_draw");if(g===null)for(let p=0;p<d.length;p++)c(d[p]/a,f[p],x[p]);else{g.multiDrawElementsInstancedWEBGL(n,f,0,s,d,0,x,0,m);let p=0;for(let _=0;_<m;_++)p+=f[_]*x[_];e.update(p,n,1)}}this.setMode=i,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function tv(r){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,a,o){switch(e.calls++,a){case r.TRIANGLES:e.triangles+=o*(s/3);break;case r.LINES:e.lines+=o*(s/2);break;case r.LINE_STRIP:e.lines+=o*(s-1);break;case r.LINE_LOOP:e.lines+=o*s;break;case r.POINTS:e.points+=o*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function ev(r,t,e){const n=new WeakMap,i=new te;function s(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(o);if(d===void 0||d.count!==u){let M=function(){T.dispose(),n.delete(o),o.removeEventListener("dispose",M)};d!==void 0&&d.texture.dispose();const f=o.morphAttributes.position!==void 0,m=o.morphAttributes.normal!==void 0,x=o.morphAttributes.color!==void 0,g=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],_=o.morphAttributes.color||[];let v=0;f===!0&&(v=1),m===!0&&(v=2),x===!0&&(v=3);let y=o.attributes.position.count*v,P=1;y>t.maxTextureSize&&(P=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);const S=new Float32Array(y*P*4*u),T=new Qo(S,y,P,u);T.type=tn,T.needsUpdate=!0;const E=v*4;for(let b=0;b<u;b++){const C=g[b],N=p[b],D=_[b],U=y*P*4*b;for(let H=0;H<C.count;H++){const k=H*E;f===!0&&(i.fromBufferAttribute(C,H),S[U+k+0]=i.x,S[U+k+1]=i.y,S[U+k+2]=i.z,S[U+k+3]=0),m===!0&&(i.fromBufferAttribute(N,H),S[U+k+4]=i.x,S[U+k+5]=i.y,S[U+k+6]=i.z,S[U+k+7]=0),x===!0&&(i.fromBufferAttribute(D,H),S[U+k+8]=i.x,S[U+k+9]=i.y,S[U+k+10]=i.z,S[U+k+11]=D.itemSize===4?i.w:1)}}d={count:u,texture:T,size:new tt(y,P)},n.set(o,d),o.addEventListener("dispose",M)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(r,"morphTexture",a.morphTexture,e);else{let f=0;for(let x=0;x<c.length;x++)f+=c[x];const m=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(r,"morphTargetBaseInfluence",m),l.getUniforms().setValue(r,"morphTargetInfluences",c)}l.getUniforms().setValue(r,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(r,"morphTargetsTextureSize",d.size)}return{update:s}}function nv(r,t,e,n){let i=new WeakMap;function s(l){const c=n.render.frame,h=l.geometry,u=t.get(l,h);if(i.get(u)!==c&&(t.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),i.get(l)!==c&&(e.update(l.instanceMatrix,r.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,r.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;i.get(d)!==c&&(d.update(),i.set(d,c))}return u}function a(){i=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:s,dispose:a}}class jc extends ye{constructor(t,e,n,i,s,a,o,l,c,h=ts){if(h!==ts&&h!==rs)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===ts&&(n=oi),n===void 0&&h===rs&&(n=ss),super(null,i,s,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:De,this.minFilter=l!==void 0?l:De,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Mf=new ye,lu=new jc(1,1),Sf=new Qo,wf=new $c,Tf=new Wr,cu=[],hu=[],uu=new Float32Array(16),du=new Float32Array(9),fu=new Float32Array(4);function $s(r,t,e){const n=r[0];if(n<=0||n>0)return r;const i=t*e;let s=cu[i];if(s===void 0&&(s=new Float32Array(i),cu[i]=s),t!==0){n.toArray(s,0);for(let a=1,o=0;a!==t;++a)o+=e,r[a].toArray(s,o)}return s}function Ee(r,t){if(r.length!==t.length)return!1;for(let e=0,n=r.length;e<n;e++)if(r[e]!==t[e])return!1;return!0}function Ce(r,t){for(let e=0,n=t.length;e<n;e++)r[e]=t[e]}function nl(r,t){let e=hu[t];e===void 0&&(e=new Int32Array(t),hu[t]=e);for(let n=0;n!==t;++n)e[n]=r.allocateTextureUnit();return e}function iv(r,t){const e=this.cache;e[0]!==t&&(r.uniform1f(this.addr,t),e[0]=t)}function sv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ee(e,t))return;r.uniform2fv(this.addr,t),Ce(e,t)}}function rv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(r.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Ee(e,t))return;r.uniform3fv(this.addr,t),Ce(e,t)}}function av(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ee(e,t))return;r.uniform4fv(this.addr,t),Ce(e,t)}}function ov(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(Ee(e,t))return;r.uniformMatrix2fv(this.addr,!1,t),Ce(e,t)}else{if(Ee(e,n))return;fu.set(n),r.uniformMatrix2fv(this.addr,!1,fu),Ce(e,n)}}function lv(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(Ee(e,t))return;r.uniformMatrix3fv(this.addr,!1,t),Ce(e,t)}else{if(Ee(e,n))return;du.set(n),r.uniformMatrix3fv(this.addr,!1,du),Ce(e,n)}}function cv(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(Ee(e,t))return;r.uniformMatrix4fv(this.addr,!1,t),Ce(e,t)}else{if(Ee(e,n))return;uu.set(n),r.uniformMatrix4fv(this.addr,!1,uu),Ce(e,n)}}function hv(r,t){const e=this.cache;e[0]!==t&&(r.uniform1i(this.addr,t),e[0]=t)}function uv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ee(e,t))return;r.uniform2iv(this.addr,t),Ce(e,t)}}function dv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ee(e,t))return;r.uniform3iv(this.addr,t),Ce(e,t)}}function fv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ee(e,t))return;r.uniform4iv(this.addr,t),Ce(e,t)}}function pv(r,t){const e=this.cache;e[0]!==t&&(r.uniform1ui(this.addr,t),e[0]=t)}function mv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ee(e,t))return;r.uniform2uiv(this.addr,t),Ce(e,t)}}function gv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ee(e,t))return;r.uniform3uiv(this.addr,t),Ce(e,t)}}function xv(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ee(e,t))return;r.uniform4uiv(this.addr,t),Ce(e,t)}}function vv(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i);let s;this.type===r.SAMPLER_2D_SHADOW?(lu.compareFunction=qc,s=lu):s=Mf,e.setTexture2D(t||s,i)}function _v(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||wf,i)}function yv(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||Tf,i)}function bv(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||Sf,i)}function Mv(r){switch(r){case 5126:return iv;case 35664:return sv;case 35665:return rv;case 35666:return av;case 35674:return ov;case 35675:return lv;case 35676:return cv;case 5124:case 35670:return hv;case 35667:case 35671:return uv;case 35668:case 35672:return dv;case 35669:case 35673:return fv;case 5125:return pv;case 36294:return mv;case 36295:return gv;case 36296:return xv;case 35678:case 36198:case 36298:case 36306:case 35682:return vv;case 35679:case 36299:case 36307:return _v;case 35680:case 36300:case 36308:case 36293:return yv;case 36289:case 36303:case 36311:case 36292:return bv}}function Sv(r,t){r.uniform1fv(this.addr,t)}function wv(r,t){const e=$s(t,this.size,2);r.uniform2fv(this.addr,e)}function Tv(r,t){const e=$s(t,this.size,3);r.uniform3fv(this.addr,e)}function Av(r,t){const e=$s(t,this.size,4);r.uniform4fv(this.addr,e)}function Ev(r,t){const e=$s(t,this.size,4);r.uniformMatrix2fv(this.addr,!1,e)}function Cv(r,t){const e=$s(t,this.size,9);r.uniformMatrix3fv(this.addr,!1,e)}function Rv(r,t){const e=$s(t,this.size,16);r.uniformMatrix4fv(this.addr,!1,e)}function Iv(r,t){r.uniform1iv(this.addr,t)}function Pv(r,t){r.uniform2iv(this.addr,t)}function Lv(r,t){r.uniform3iv(this.addr,t)}function Dv(r,t){r.uniform4iv(this.addr,t)}function Uv(r,t){r.uniform1uiv(this.addr,t)}function Nv(r,t){r.uniform2uiv(this.addr,t)}function Ov(r,t){r.uniform3uiv(this.addr,t)}function Fv(r,t){r.uniform4uiv(this.addr,t)}function Bv(r,t,e){const n=this.cache,i=t.length,s=nl(e,i);Ee(n,s)||(r.uniform1iv(this.addr,s),Ce(n,s));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||Mf,s[a])}function zv(r,t,e){const n=this.cache,i=t.length,s=nl(e,i);Ee(n,s)||(r.uniform1iv(this.addr,s),Ce(n,s));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||wf,s[a])}function kv(r,t,e){const n=this.cache,i=t.length,s=nl(e,i);Ee(n,s)||(r.uniform1iv(this.addr,s),Ce(n,s));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||Tf,s[a])}function Hv(r,t,e){const n=this.cache,i=t.length,s=nl(e,i);Ee(n,s)||(r.uniform1iv(this.addr,s),Ce(n,s));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||Sf,s[a])}function Vv(r){switch(r){case 5126:return Sv;case 35664:return wv;case 35665:return Tv;case 35666:return Av;case 35674:return Ev;case 35675:return Cv;case 35676:return Rv;case 5124:case 35670:return Iv;case 35667:case 35671:return Pv;case 35668:case 35672:return Lv;case 35669:case 35673:return Dv;case 5125:return Uv;case 36294:return Nv;case 36295:return Ov;case 36296:return Fv;case 35678:case 36198:case 36298:case 36306:case 35682:return Bv;case 35679:case 36299:case 36307:return zv;case 35680:case 36300:case 36308:case 36293:return kv;case 36289:case 36303:case 36311:case 36292:return Hv}}class Gv{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Mv(e.type)}}class Wv{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Vv(e.type)}}class Xv{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let s=0,a=i.length;s!==a;++s){const o=i[s];o.setValue(t,e[o.id],n)}}}const $l=/(\w+)(\])?(\[|\.)?/g;function pu(r,t){r.seq.push(t),r.map[t.id]=t}function qv(r,t,e){const n=r.name,i=n.length;for($l.lastIndex=0;;){const s=$l.exec(n),a=$l.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){pu(e,c===void 0?new Gv(o,r,t):new Wv(o,r,t));break}else{let u=e.map[o];u===void 0&&(u=new Xv(o),pu(e,u)),e=u}}}class Ja{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const s=t.getActiveUniform(e,i),a=t.getUniformLocation(e,s.name);qv(s,a,this)}}setValue(t,e,n,i){const s=this.map[e];s!==void 0&&s.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let s=0,a=e.length;s!==a;++s){const o=e[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,s=t.length;i!==s;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function mu(r,t,e){const n=r.createShader(t);return r.shaderSource(n,e),r.compileShader(n),n}const Yv=37297;let $v=0;function Zv(r,t){const e=r.split(`
`),n=[],i=Math.max(t-6,0),s=Math.min(t+6,e.length);for(let a=i;a<s;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}const gu=new Ht;function Kv(r){Jt._getMatrix(gu,Jt.workingColorSpace,r);const t=`mat3( ${gu.elements.map(e=>e.toFixed(4))} )`;switch(Jt.getTransfer(r)){case Gr:return[t,"LinearTransferOETF"];case ae:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",r),[t,"LinearTransferOETF"]}}function xu(r,t,e){const n=r.getShaderParameter(t,r.COMPILE_STATUS),i=r.getShaderInfoLog(t).trim();if(n&&i==="")return"";const s=/ERROR: 0:(\d+)/.exec(i);if(s){const a=parseInt(s[1]);return e.toUpperCase()+`

`+i+`

`+Zv(r.getShaderSource(t),a)}else return i}function Jv(r,t){const e=Kv(t);return[`vec4 ${r}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function jv(r,t){let e;switch(t){case Wd:e="Linear";break;case Xd:e="Reinhard";break;case qd:e="Cineon";break;case Uc:e="ACESFilmic";break;case $d:e="AgX";break;case Zd:e="Neutral";break;case Yd:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+r+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const ya=new R;function Qv(){Jt.getLuminanceCoefficients(ya);const r=ya.x.toFixed(4),t=ya.y.toFixed(4),e=ya.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${r}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function t_(r){return[r.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",r.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(dr).join(`
`)}function e_(r){const t=[];for(const e in r){const n=r[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function n_(r,t){const e={},n=r.getProgramParameter(t,r.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const s=r.getActiveAttrib(t,i),a=s.name;let o=1;s.type===r.FLOAT_MAT2&&(o=2),s.type===r.FLOAT_MAT3&&(o=3),s.type===r.FLOAT_MAT4&&(o=4),e[a]={type:s.type,location:r.getAttribLocation(t,a),locationSize:o}}return e}function dr(r){return r!==""}function vu(r,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return r.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function _u(r,t){return r.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const i_=/^[ \t]*#include +<([\w\d./]+)>/gm;function Mc(r){return r.replace(i_,r_)}const s_=new Map;function r_(r,t){let e=Vt[t];if(e===void 0){const n=s_.get(t);if(n!==void 0)e=Vt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return Mc(e)}const a_=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function yu(r){return r.replace(a_,o_)}function o_(r,t,e,n){let i="";for(let s=parseInt(t);s<parseInt(e);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function bu(r){let t=`precision ${r.precision} float;
	precision ${r.precision} int;
	precision ${r.precision} sampler2D;
	precision ${r.precision} samplerCube;
	precision ${r.precision} sampler3D;
	precision ${r.precision} sampler2DArray;
	precision ${r.precision} sampler2DShadow;
	precision ${r.precision} samplerCubeShadow;
	precision ${r.precision} sampler2DArrayShadow;
	precision ${r.precision} isampler2D;
	precision ${r.precision} isampler3D;
	precision ${r.precision} isamplerCube;
	precision ${r.precision} isampler2DArray;
	precision ${r.precision} usampler2D;
	precision ${r.precision} usampler3D;
	precision ${r.precision} usamplerCube;
	precision ${r.precision} usampler2DArray;
	`;return r.precision==="highp"?t+=`
#define HIGH_PRECISION`:r.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function l_(r){let t="SHADOWMAP_TYPE_BASIC";return r.shadowMapType===Wo?t="SHADOWMAP_TYPE_PCF":r.shadowMapType===Lc?t="SHADOWMAP_TYPE_PCF_SOFT":r.shadowMapType===Ln&&(t="SHADOWMAP_TYPE_VSM"),t}function c_(r){let t="ENVMAP_TYPE_CUBE";if(r.envMap)switch(r.envMapMode){case ai:case Si:t="ENVMAP_TYPE_CUBE";break;case Xs:t="ENVMAP_TYPE_CUBE_UV";break}return t}function h_(r){let t="ENVMAP_MODE_REFLECTION";if(r.envMap)switch(r.envMapMode){case Si:t="ENVMAP_MODE_REFRACTION";break}return t}function u_(r){let t="ENVMAP_BLENDING_NONE";if(r.envMap)switch(r.combine){case Hr:t="ENVMAP_BLENDING_MULTIPLY";break;case Vd:t="ENVMAP_BLENDING_MIX";break;case Gd:t="ENVMAP_BLENDING_ADD";break}return t}function d_(r){const t=r.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function f_(r,t,e,n){const i=r.getContext(),s=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=l_(e),c=c_(e),h=h_(e),u=u_(e),d=d_(e),f=t_(e),m=e_(s),x=i.createProgram();let g,p,_=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(dr).join(`
`),g.length>0&&(g+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(dr).join(`
`),p.length>0&&(p+=`
`)):(g=[bu(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(dr).join(`
`),p=[bu(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==ii?"#define TONE_MAPPING":"",e.toneMapping!==ii?Vt.tonemapping_pars_fragment:"",e.toneMapping!==ii?jv("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Vt.colorspace_pars_fragment,Jv("linearToOutputTexel",e.outputColorSpace),Qv(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(dr).join(`
`)),a=Mc(a),a=vu(a,e),a=_u(a,e),o=Mc(o),o=vu(o,e),o=_u(o,e),a=yu(a),o=yu(o),e.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,g=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,p=["#define varying in",e.glslVersion===bc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===bc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const v=_+g+a,y=_+p+o,P=mu(i,i.VERTEX_SHADER,v),S=mu(i,i.FRAGMENT_SHADER,y);i.attachShader(x,P),i.attachShader(x,S),e.index0AttributeName!==void 0?i.bindAttribLocation(x,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(x,0,"position"),i.linkProgram(x);function T(C){if(r.debug.checkShaderErrors){const N=i.getProgramInfoLog(x).trim(),D=i.getShaderInfoLog(P).trim(),U=i.getShaderInfoLog(S).trim();let H=!0,k=!0;if(i.getProgramParameter(x,i.LINK_STATUS)===!1)if(H=!1,typeof r.debug.onShaderError=="function")r.debug.onShaderError(i,x,P,S);else{const G=xu(i,P,"vertex"),O=xu(i,S,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(x,i.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+N+`
`+G+`
`+O)}else N!==""?console.warn("THREE.WebGLProgram: Program Info Log:",N):(D===""||U==="")&&(k=!1);k&&(C.diagnostics={runnable:H,programLog:N,vertexShader:{log:D,prefix:g},fragmentShader:{log:U,prefix:p}})}i.deleteShader(P),i.deleteShader(S),E=new Ja(i,x),M=n_(i,x)}let E;this.getUniforms=function(){return E===void 0&&T(this),E};let M;this.getAttributes=function(){return M===void 0&&T(this),M};let b=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return b===!1&&(b=i.getProgramParameter(x,Yv)),b},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(x),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=$v++,this.cacheKey=t,this.usedTimes=1,this.program=x,this.vertexShader=P,this.fragmentShader=S,this}let p_=0;class m_{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),s=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(s)===!1&&(a.add(s),s.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new g_(t),e.set(t,n)),n}}class g_{constructor(t){this.id=p_++,this.code=t,this.usedTimes=0}}function x_(r,t,e,n,i,s,a){const o=new tl,l=new m_,c=new Set,h=[],u=i.logarithmicDepthBuffer,d=i.vertexTextures;let f=i.precision;const m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(M){return c.add(M),M===0?"uv":`uv${M}`}function g(M,b,C,N,D){const U=N.fog,H=D.geometry,k=M.isMeshStandardMaterial?N.environment:null,G=(M.isMeshStandardMaterial?e:t).get(M.envMap||k),O=G&&G.mapping===Xs?G.image.height:null,J=m[M.type];M.precision!==null&&(f=i.getMaxPrecision(M.precision),f!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",f,"instead."));const K=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,ot=K!==void 0?K.length:0;let bt=0;H.morphAttributes.position!==void 0&&(bt=1),H.morphAttributes.normal!==void 0&&(bt=2),H.morphAttributes.color!==void 0&&(bt=3);let Dt,Y,it,mt;if(J){const re=cn[J];Dt=re.vertexShader,Y=re.fragmentShader}else Dt=M.vertexShader,Y=M.fragmentShader,l.update(M),it=l.getVertexShaderID(M),mt=l.getFragmentShaderID(M);const lt=r.getRenderTarget(),Lt=r.state.buffers.depth.getReversed(),Bt=D.isInstancedMesh===!0,Nt=D.isBatchedMesh===!0,Zt=!!M.map,et=!!M.matcap,at=!!G,L=!!M.aoMap,It=!!M.lightMap,st=!!M.bumpMap,Mt=!!M.normalMap,ut=!!M.displacementMap,Ot=!!M.emissiveMap,_t=!!M.metalnessMap,I=!!M.roughnessMap,w=M.anisotropy>0,V=M.clearcoat>0,$=M.dispersion>0,nt=M.iridescence>0,Z=M.sheen>0,At=M.transmission>0,ft=w&&!!M.anisotropyMap,yt=V&&!!M.clearcoatMap,Kt=V&&!!M.clearcoatNormalMap,rt=V&&!!M.clearcoatRoughnessMap,St=nt&&!!M.iridescenceMap,Ft=nt&&!!M.iridescenceThicknessMap,zt=Z&&!!M.sheenColorMap,wt=Z&&!!M.sheenRoughnessMap,jt=!!M.specularMap,Yt=!!M.specularColorMap,ce=!!M.specularIntensityMap,F=At&&!!M.transmissionMap,pt=At&&!!M.thicknessMap,q=!!M.gradientMap,Q=!!M.alphaMap,vt=M.alphaTest>0,gt=!!M.alphaHash,Wt=!!M.extensions;let xe=ii;M.toneMapped&&(lt===null||lt.isXRRenderTarget===!0)&&(xe=r.toneMapping);const Ue={shaderID:J,shaderType:M.type,shaderName:M.name,vertexShader:Dt,fragmentShader:Y,defines:M.defines,customVertexShaderID:it,customFragmentShaderID:mt,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:f,batching:Nt,batchingColor:Nt&&D._colorsTexture!==null,instancing:Bt,instancingColor:Bt&&D.instanceColor!==null,instancingMorph:Bt&&D.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:lt===null?r.outputColorSpace:lt.isXRRenderTarget===!0?lt.texture.colorSpace:ls,alphaToCoverage:!!M.alphaToCoverage,map:Zt,matcap:et,envMap:at,envMapMode:at&&G.mapping,envMapCubeUVHeight:O,aoMap:L,lightMap:It,bumpMap:st,normalMap:Mt,displacementMap:d&&ut,emissiveMap:Ot,normalMapObjectSpace:Mt&&M.normalMapType===nf,normalMapTangentSpace:Mt&&M.normalMapType===Ti,metalnessMap:_t,roughnessMap:I,anisotropy:w,anisotropyMap:ft,clearcoat:V,clearcoatMap:yt,clearcoatNormalMap:Kt,clearcoatRoughnessMap:rt,dispersion:$,iridescence:nt,iridescenceMap:St,iridescenceThicknessMap:Ft,sheen:Z,sheenColorMap:zt,sheenRoughnessMap:wt,specularMap:jt,specularColorMap:Yt,specularIntensityMap:ce,transmission:At,transmissionMap:F,thicknessMap:pt,gradientMap:q,opaque:M.transparent===!1&&M.blending===ji&&M.alphaToCoverage===!1,alphaMap:Q,alphaTest:vt,alphaHash:gt,combine:M.combine,mapUv:Zt&&x(M.map.channel),aoMapUv:L&&x(M.aoMap.channel),lightMapUv:It&&x(M.lightMap.channel),bumpMapUv:st&&x(M.bumpMap.channel),normalMapUv:Mt&&x(M.normalMap.channel),displacementMapUv:ut&&x(M.displacementMap.channel),emissiveMapUv:Ot&&x(M.emissiveMap.channel),metalnessMapUv:_t&&x(M.metalnessMap.channel),roughnessMapUv:I&&x(M.roughnessMap.channel),anisotropyMapUv:ft&&x(M.anisotropyMap.channel),clearcoatMapUv:yt&&x(M.clearcoatMap.channel),clearcoatNormalMapUv:Kt&&x(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:rt&&x(M.clearcoatRoughnessMap.channel),iridescenceMapUv:St&&x(M.iridescenceMap.channel),iridescenceThicknessMapUv:Ft&&x(M.iridescenceThicknessMap.channel),sheenColorMapUv:zt&&x(M.sheenColorMap.channel),sheenRoughnessMapUv:wt&&x(M.sheenRoughnessMap.channel),specularMapUv:jt&&x(M.specularMap.channel),specularColorMapUv:Yt&&x(M.specularColorMap.channel),specularIntensityMapUv:ce&&x(M.specularIntensityMap.channel),transmissionMapUv:F&&x(M.transmissionMap.channel),thicknessMapUv:pt&&x(M.thicknessMap.channel),alphaMapUv:Q&&x(M.alphaMap.channel),vertexTangents:!!H.attributes.tangent&&(Mt||w),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!H.attributes.uv&&(Zt||Q),fog:!!U,useFog:M.fog===!0,fogExp2:!!U&&U.isFogExp2,flatShading:M.flatShading===!0,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Lt,skinning:D.isSkinnedMesh===!0,morphTargets:H.morphAttributes.position!==void 0,morphNormals:H.morphAttributes.normal!==void 0,morphColors:H.morphAttributes.color!==void 0,morphTargetsCount:ot,morphTextureStride:bt,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:M.dithering,shadowMapEnabled:r.shadowMap.enabled&&C.length>0,shadowMapType:r.shadowMap.type,toneMapping:xe,decodeVideoTexture:Zt&&M.map.isVideoTexture===!0&&Jt.getTransfer(M.map.colorSpace)===ae,decodeVideoTextureEmissive:Ot&&M.emissiveMap.isVideoTexture===!0&&Jt.getTransfer(M.emissiveMap.colorSpace)===ae,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===Dn,flipSided:M.side===Le,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionClipCullDistance:Wt&&M.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Wt&&M.extensions.multiDraw===!0||Nt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()};return Ue.vertexUv1s=c.has(1),Ue.vertexUv2s=c.has(2),Ue.vertexUv3s=c.has(3),c.clear(),Ue}function p(M){const b=[];if(M.shaderID?b.push(M.shaderID):(b.push(M.customVertexShaderID),b.push(M.customFragmentShaderID)),M.defines!==void 0)for(const C in M.defines)b.push(C),b.push(M.defines[C]);return M.isRawShaderMaterial===!1&&(_(b,M),v(b,M),b.push(r.outputColorSpace)),b.push(M.customProgramCacheKey),b.join()}function _(M,b){M.push(b.precision),M.push(b.outputColorSpace),M.push(b.envMapMode),M.push(b.envMapCubeUVHeight),M.push(b.mapUv),M.push(b.alphaMapUv),M.push(b.lightMapUv),M.push(b.aoMapUv),M.push(b.bumpMapUv),M.push(b.normalMapUv),M.push(b.displacementMapUv),M.push(b.emissiveMapUv),M.push(b.metalnessMapUv),M.push(b.roughnessMapUv),M.push(b.anisotropyMapUv),M.push(b.clearcoatMapUv),M.push(b.clearcoatNormalMapUv),M.push(b.clearcoatRoughnessMapUv),M.push(b.iridescenceMapUv),M.push(b.iridescenceThicknessMapUv),M.push(b.sheenColorMapUv),M.push(b.sheenRoughnessMapUv),M.push(b.specularMapUv),M.push(b.specularColorMapUv),M.push(b.specularIntensityMapUv),M.push(b.transmissionMapUv),M.push(b.thicknessMapUv),M.push(b.combine),M.push(b.fogExp2),M.push(b.sizeAttenuation),M.push(b.morphTargetsCount),M.push(b.morphAttributeCount),M.push(b.numDirLights),M.push(b.numPointLights),M.push(b.numSpotLights),M.push(b.numSpotLightMaps),M.push(b.numHemiLights),M.push(b.numRectAreaLights),M.push(b.numDirLightShadows),M.push(b.numPointLightShadows),M.push(b.numSpotLightShadows),M.push(b.numSpotLightShadowsWithMaps),M.push(b.numLightProbes),M.push(b.shadowMapType),M.push(b.toneMapping),M.push(b.numClippingPlanes),M.push(b.numClipIntersection),M.push(b.depthPacking)}function v(M,b){o.disableAll(),b.supportsVertexTextures&&o.enable(0),b.instancing&&o.enable(1),b.instancingColor&&o.enable(2),b.instancingMorph&&o.enable(3),b.matcap&&o.enable(4),b.envMap&&o.enable(5),b.normalMapObjectSpace&&o.enable(6),b.normalMapTangentSpace&&o.enable(7),b.clearcoat&&o.enable(8),b.iridescence&&o.enable(9),b.alphaTest&&o.enable(10),b.vertexColors&&o.enable(11),b.vertexAlphas&&o.enable(12),b.vertexUv1s&&o.enable(13),b.vertexUv2s&&o.enable(14),b.vertexUv3s&&o.enable(15),b.vertexTangents&&o.enable(16),b.anisotropy&&o.enable(17),b.alphaHash&&o.enable(18),b.batching&&o.enable(19),b.dispersion&&o.enable(20),b.batchingColor&&o.enable(21),M.push(o.mask),o.disableAll(),b.fog&&o.enable(0),b.useFog&&o.enable(1),b.flatShading&&o.enable(2),b.logarithmicDepthBuffer&&o.enable(3),b.reverseDepthBuffer&&o.enable(4),b.skinning&&o.enable(5),b.morphTargets&&o.enable(6),b.morphNormals&&o.enable(7),b.morphColors&&o.enable(8),b.premultipliedAlpha&&o.enable(9),b.shadowMapEnabled&&o.enable(10),b.doubleSided&&o.enable(11),b.flipSided&&o.enable(12),b.useDepthPacking&&o.enable(13),b.dithering&&o.enable(14),b.transmission&&o.enable(15),b.sheen&&o.enable(16),b.opaque&&o.enable(17),b.pointsUvs&&o.enable(18),b.decodeVideoTexture&&o.enable(19),b.decodeVideoTextureEmissive&&o.enable(20),b.alphaToCoverage&&o.enable(21),M.push(o.mask)}function y(M){const b=m[M.type];let C;if(b){const N=cn[b];C=vf.clone(N.uniforms)}else C=M.uniforms;return C}function P(M,b){let C;for(let N=0,D=h.length;N<D;N++){const U=h[N];if(U.cacheKey===b){C=U,++C.usedTimes;break}}return C===void 0&&(C=new f_(r,b,M,s),h.push(C)),C}function S(M){if(--M.usedTimes===0){const b=h.indexOf(M);h[b]=h[h.length-1],h.pop(),M.destroy()}}function T(M){l.remove(M)}function E(){l.dispose()}return{getParameters:g,getProgramCacheKey:p,getUniforms:y,acquireProgram:P,releaseProgram:S,releaseShaderCache:T,programs:h,dispose:E}}function v_(){let r=new WeakMap;function t(a){return r.has(a)}function e(a){let o=r.get(a);return o===void 0&&(o={},r.set(a,o)),o}function n(a){r.delete(a)}function i(a,o,l){r.get(a)[o]=l}function s(){r=new WeakMap}return{has:t,get:e,remove:n,update:i,dispose:s}}function __(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.material.id!==t.material.id?r.material.id-t.material.id:r.z!==t.z?r.z-t.z:r.id-t.id}function Mu(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.z!==t.z?t.z-r.z:r.id-t.id}function Su(){const r=[];let t=0;const e=[],n=[],i=[];function s(){t=0,e.length=0,n.length=0,i.length=0}function a(u,d,f,m,x,g){let p=r[t];return p===void 0?(p={id:u.id,object:u,geometry:d,material:f,groupOrder:m,renderOrder:u.renderOrder,z:x,group:g},r[t]=p):(p.id=u.id,p.object=u,p.geometry=d,p.material=f,p.groupOrder=m,p.renderOrder=u.renderOrder,p.z=x,p.group=g),t++,p}function o(u,d,f,m,x,g){const p=a(u,d,f,m,x,g);f.transmission>0?n.push(p):f.transparent===!0?i.push(p):e.push(p)}function l(u,d,f,m,x,g){const p=a(u,d,f,m,x,g);f.transmission>0?n.unshift(p):f.transparent===!0?i.unshift(p):e.unshift(p)}function c(u,d){e.length>1&&e.sort(u||__),n.length>1&&n.sort(d||Mu),i.length>1&&i.sort(d||Mu)}function h(){for(let u=t,d=r.length;u<d;u++){const f=r[u];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:e,transmissive:n,transparent:i,init:s,push:o,unshift:l,finish:h,sort:c}}function y_(){let r=new WeakMap;function t(n,i){const s=r.get(n);let a;return s===void 0?(a=new Su,r.set(n,[a])):i>=s.length?(a=new Su,s.push(a)):a=s[i],a}function e(){r=new WeakMap}return{get:t,dispose:e}}function b_(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new R,color:new ht};break;case"SpotLight":e={position:new R,direction:new R,color:new ht,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new ht,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new ht,groundColor:new ht};break;case"RectAreaLight":e={color:new ht,position:new R,halfWidth:new R,halfHeight:new R};break}return r[t.id]=e,e}}}function M_(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[t.id]=e,e}}}let S_=0;function w_(r,t){return(t.castShadow?2:0)-(r.castShadow?2:0)+(t.map?1:0)-(r.map?1:0)}function T_(r){const t=new b_,e=M_(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new R);const i=new R,s=new Ut,a=new Ut;function o(c){let h=0,u=0,d=0;for(let M=0;M<9;M++)n.probe[M].set(0,0,0);let f=0,m=0,x=0,g=0,p=0,_=0,v=0,y=0,P=0,S=0,T=0;c.sort(w_);for(let M=0,b=c.length;M<b;M++){const C=c[M],N=C.color,D=C.intensity,U=C.distance,H=C.shadow&&C.shadow.map?C.shadow.map.texture:null;if(C.isAmbientLight)h+=N.r*D,u+=N.g*D,d+=N.b*D;else if(C.isLightProbe){for(let k=0;k<9;k++)n.probe[k].addScaledVector(C.sh.coefficients[k],D);T++}else if(C.isDirectionalLight){const k=t.get(C);if(k.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const G=C.shadow,O=e.get(C);O.shadowIntensity=G.intensity,O.shadowBias=G.bias,O.shadowNormalBias=G.normalBias,O.shadowRadius=G.radius,O.shadowMapSize=G.mapSize,n.directionalShadow[f]=O,n.directionalShadowMap[f]=H,n.directionalShadowMatrix[f]=C.shadow.matrix,_++}n.directional[f]=k,f++}else if(C.isSpotLight){const k=t.get(C);k.position.setFromMatrixPosition(C.matrixWorld),k.color.copy(N).multiplyScalar(D),k.distance=U,k.coneCos=Math.cos(C.angle),k.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),k.decay=C.decay,n.spot[x]=k;const G=C.shadow;if(C.map&&(n.spotLightMap[P]=C.map,P++,G.updateMatrices(C),C.castShadow&&S++),n.spotLightMatrix[x]=G.matrix,C.castShadow){const O=e.get(C);O.shadowIntensity=G.intensity,O.shadowBias=G.bias,O.shadowNormalBias=G.normalBias,O.shadowRadius=G.radius,O.shadowMapSize=G.mapSize,n.spotShadow[x]=O,n.spotShadowMap[x]=H,y++}x++}else if(C.isRectAreaLight){const k=t.get(C);k.color.copy(N).multiplyScalar(D),k.halfWidth.set(C.width*.5,0,0),k.halfHeight.set(0,C.height*.5,0),n.rectArea[g]=k,g++}else if(C.isPointLight){const k=t.get(C);if(k.color.copy(C.color).multiplyScalar(C.intensity),k.distance=C.distance,k.decay=C.decay,C.castShadow){const G=C.shadow,O=e.get(C);O.shadowIntensity=G.intensity,O.shadowBias=G.bias,O.shadowNormalBias=G.normalBias,O.shadowRadius=G.radius,O.shadowMapSize=G.mapSize,O.shadowCameraNear=G.camera.near,O.shadowCameraFar=G.camera.far,n.pointShadow[m]=O,n.pointShadowMap[m]=H,n.pointShadowMatrix[m]=C.shadow.matrix,v++}n.point[m]=k,m++}else if(C.isHemisphereLight){const k=t.get(C);k.skyColor.copy(C.color).multiplyScalar(D),k.groundColor.copy(C.groundColor).multiplyScalar(D),n.hemi[p]=k,p++}}g>0&&(r.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=dt.LTC_FLOAT_1,n.rectAreaLTC2=dt.LTC_FLOAT_2):(n.rectAreaLTC1=dt.LTC_HALF_1,n.rectAreaLTC2=dt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const E=n.hash;(E.directionalLength!==f||E.pointLength!==m||E.spotLength!==x||E.rectAreaLength!==g||E.hemiLength!==p||E.numDirectionalShadows!==_||E.numPointShadows!==v||E.numSpotShadows!==y||E.numSpotMaps!==P||E.numLightProbes!==T)&&(n.directional.length=f,n.spot.length=x,n.rectArea.length=g,n.point.length=m,n.hemi.length=p,n.directionalShadow.length=_,n.directionalShadowMap.length=_,n.pointShadow.length=v,n.pointShadowMap.length=v,n.spotShadow.length=y,n.spotShadowMap.length=y,n.directionalShadowMatrix.length=_,n.pointShadowMatrix.length=v,n.spotLightMatrix.length=y+P-S,n.spotLightMap.length=P,n.numSpotLightShadowsWithMaps=S,n.numLightProbes=T,E.directionalLength=f,E.pointLength=m,E.spotLength=x,E.rectAreaLength=g,E.hemiLength=p,E.numDirectionalShadows=_,E.numPointShadows=v,E.numSpotShadows=y,E.numSpotMaps=P,E.numLightProbes=T,n.version=S_++)}function l(c,h){let u=0,d=0,f=0,m=0,x=0;const g=h.matrixWorldInverse;for(let p=0,_=c.length;p<_;p++){const v=c[p];if(v.isDirectionalLight){const y=n.directional[u];y.direction.setFromMatrixPosition(v.matrixWorld),i.setFromMatrixPosition(v.target.matrixWorld),y.direction.sub(i),y.direction.transformDirection(g),u++}else if(v.isSpotLight){const y=n.spot[f];y.position.setFromMatrixPosition(v.matrixWorld),y.position.applyMatrix4(g),y.direction.setFromMatrixPosition(v.matrixWorld),i.setFromMatrixPosition(v.target.matrixWorld),y.direction.sub(i),y.direction.transformDirection(g),f++}else if(v.isRectAreaLight){const y=n.rectArea[m];y.position.setFromMatrixPosition(v.matrixWorld),y.position.applyMatrix4(g),a.identity(),s.copy(v.matrixWorld),s.premultiply(g),a.extractRotation(s),y.halfWidth.set(v.width*.5,0,0),y.halfHeight.set(0,v.height*.5,0),y.halfWidth.applyMatrix4(a),y.halfHeight.applyMatrix4(a),m++}else if(v.isPointLight){const y=n.point[d];y.position.setFromMatrixPosition(v.matrixWorld),y.position.applyMatrix4(g),d++}else if(v.isHemisphereLight){const y=n.hemi[x];y.direction.setFromMatrixPosition(v.matrixWorld),y.direction.transformDirection(g),x++}}}return{setup:o,setupView:l,state:n}}function wu(r){const t=new T_(r),e=[],n=[];function i(h){c.camera=h,e.length=0,n.length=0}function s(h){e.push(h)}function a(h){n.push(h)}function o(){t.setup(e)}function l(h){t.setupView(e,h)}const c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:i,state:c,setupLights:o,setupLightsView:l,pushLight:s,pushShadow:a}}function A_(r){let t=new WeakMap;function e(i,s=0){const a=t.get(i);let o;return a===void 0?(o=new wu(r),t.set(i,[o])):s>=a.length?(o=new wu(r),a.push(o)):o=a[s],o}function n(){t=new WeakMap}return{get:e,dispose:n}}class Qc extends ke{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=tf,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class th extends ke{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const E_=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,C_=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function R_(r,t,e){let n=new Xr;const i=new tt,s=new tt,a=new te,o=new Qc({depthPacking:ef}),l=new th,c={},h=e.maxTextureSize,u={[ri]:Le,[Le]:ri,[Dn]:Dn},d=new Ye({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new tt},radius:{value:4}},vertexShader:E_,fragmentShader:C_}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const m=new qt;m.setAttribute("position",new oe(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const x=new ue(m,d),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Wo;let p=this.type;this.render=function(S,T,E){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||S.length===0)return;const M=r.getRenderTarget(),b=r.getActiveCubeFace(),C=r.getActiveMipmapLevel(),N=r.state;N.setBlending(ni),N.buffers.color.setClear(1,1,1,1),N.buffers.depth.setTest(!0),N.setScissorTest(!1);const D=p!==Ln&&this.type===Ln,U=p===Ln&&this.type!==Ln;for(let H=0,k=S.length;H<k;H++){const G=S[H],O=G.shadow;if(O===void 0){console.warn("THREE.WebGLShadowMap:",G,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;i.copy(O.mapSize);const J=O.getFrameExtents();if(i.multiply(J),s.copy(O.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(s.x=Math.floor(h/J.x),i.x=s.x*J.x,O.mapSize.x=s.x),i.y>h&&(s.y=Math.floor(h/J.y),i.y=s.y*J.y,O.mapSize.y=s.y)),O.map===null||D===!0||U===!0){const ot=this.type!==Ln?{minFilter:De,magFilter:De}:{};O.map!==null&&O.map.dispose(),O.map=new _n(i.x,i.y,ot),O.map.texture.name=G.name+".shadowMap",O.camera.updateProjectionMatrix()}r.setRenderTarget(O.map),r.clear();const K=O.getViewportCount();for(let ot=0;ot<K;ot++){const bt=O.getViewport(ot);a.set(s.x*bt.x,s.y*bt.y,s.x*bt.z,s.y*bt.w),N.viewport(a),O.updateMatrices(G,ot),n=O.getFrustum(),y(T,E,O.camera,G,this.type)}O.isPointLightShadow!==!0&&this.type===Ln&&_(O,E),O.needsUpdate=!1}p=this.type,g.needsUpdate=!1,r.setRenderTarget(M,b,C)};function _(S,T){const E=t.update(x);d.defines.VSM_SAMPLES!==S.blurSamples&&(d.defines.VSM_SAMPLES=S.blurSamples,f.defines.VSM_SAMPLES=S.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),S.mapPass===null&&(S.mapPass=new _n(i.x,i.y)),d.uniforms.shadow_pass.value=S.map.texture,d.uniforms.resolution.value=S.mapSize,d.uniforms.radius.value=S.radius,r.setRenderTarget(S.mapPass),r.clear(),r.renderBufferDirect(T,null,E,d,x,null),f.uniforms.shadow_pass.value=S.mapPass.texture,f.uniforms.resolution.value=S.mapSize,f.uniforms.radius.value=S.radius,r.setRenderTarget(S.map),r.clear(),r.renderBufferDirect(T,null,E,f,x,null)}function v(S,T,E,M){let b=null;const C=E.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(C!==void 0)b=C;else if(b=E.isPointLight===!0?l:o,r.localClippingEnabled&&T.clipShadows===!0&&Array.isArray(T.clippingPlanes)&&T.clippingPlanes.length!==0||T.displacementMap&&T.displacementScale!==0||T.alphaMap&&T.alphaTest>0||T.map&&T.alphaTest>0){const N=b.uuid,D=T.uuid;let U=c[N];U===void 0&&(U={},c[N]=U);let H=U[D];H===void 0&&(H=b.clone(),U[D]=H,T.addEventListener("dispose",P)),b=H}if(b.visible=T.visible,b.wireframe=T.wireframe,M===Ln?b.side=T.shadowSide!==null?T.shadowSide:T.side:b.side=T.shadowSide!==null?T.shadowSide:u[T.side],b.alphaMap=T.alphaMap,b.alphaTest=T.alphaTest,b.map=T.map,b.clipShadows=T.clipShadows,b.clippingPlanes=T.clippingPlanes,b.clipIntersection=T.clipIntersection,b.displacementMap=T.displacementMap,b.displacementScale=T.displacementScale,b.displacementBias=T.displacementBias,b.wireframeLinewidth=T.wireframeLinewidth,b.linewidth=T.linewidth,E.isPointLight===!0&&b.isMeshDistanceMaterial===!0){const N=r.properties.get(b);N.light=E}return b}function y(S,T,E,M,b){if(S.visible===!1)return;if(S.layers.test(T.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&b===Ln)&&(!S.frustumCulled||n.intersectsObject(S))){S.modelViewMatrix.multiplyMatrices(E.matrixWorldInverse,S.matrixWorld);const D=t.update(S),U=S.material;if(Array.isArray(U)){const H=D.groups;for(let k=0,G=H.length;k<G;k++){const O=H[k],J=U[O.materialIndex];if(J&&J.visible){const K=v(S,J,M,b);S.onBeforeShadow(r,S,T,E,D,K,O),r.renderBufferDirect(E,null,D,K,S,O),S.onAfterShadow(r,S,T,E,D,K,O)}}}else if(U.visible){const H=v(S,U,M,b);S.onBeforeShadow(r,S,T,E,D,H,null),r.renderBufferDirect(E,null,D,H,S,null),S.onAfterShadow(r,S,T,E,D,H,null)}}const N=S.children;for(let D=0,U=N.length;D<U;D++)y(N[D],T,E,M,b)}function P(S){S.target.removeEventListener("dispose",P);for(const E in c){const M=c[E],b=S.target.uuid;b in M&&(M[b].dispose(),delete M[b])}}}const I_={[eo]:no,[io]:ao,[so]:oo,[is]:ro,[no]:eo,[ao]:io,[oo]:so,[ro]:is};function P_(r,t){function e(){let F=!1;const pt=new te;let q=null;const Q=new te(0,0,0,0);return{setMask:function(vt){q!==vt&&!F&&(r.colorMask(vt,vt,vt,vt),q=vt)},setLocked:function(vt){F=vt},setClear:function(vt,gt,Wt,xe,Ue){Ue===!0&&(vt*=xe,gt*=xe,Wt*=xe),pt.set(vt,gt,Wt,xe),Q.equals(pt)===!1&&(r.clearColor(vt,gt,Wt,xe),Q.copy(pt))},reset:function(){F=!1,q=null,Q.set(-1,0,0,0)}}}function n(){let F=!1,pt=!1,q=null,Q=null,vt=null;return{setReversed:function(gt){if(pt!==gt){const Wt=t.get("EXT_clip_control");pt?Wt.clipControlEXT(Wt.LOWER_LEFT_EXT,Wt.ZERO_TO_ONE_EXT):Wt.clipControlEXT(Wt.LOWER_LEFT_EXT,Wt.NEGATIVE_ONE_TO_ONE_EXT);const xe=vt;vt=null,this.setClear(xe)}pt=gt},getReversed:function(){return pt},setTest:function(gt){gt?lt(r.DEPTH_TEST):Lt(r.DEPTH_TEST)},setMask:function(gt){q!==gt&&!F&&(r.depthMask(gt),q=gt)},setFunc:function(gt){if(pt&&(gt=I_[gt]),Q!==gt){switch(gt){case eo:r.depthFunc(r.NEVER);break;case no:r.depthFunc(r.ALWAYS);break;case io:r.depthFunc(r.LESS);break;case is:r.depthFunc(r.LEQUAL);break;case so:r.depthFunc(r.EQUAL);break;case ro:r.depthFunc(r.GEQUAL);break;case ao:r.depthFunc(r.GREATER);break;case oo:r.depthFunc(r.NOTEQUAL);break;default:r.depthFunc(r.LEQUAL)}Q=gt}},setLocked:function(gt){F=gt},setClear:function(gt){vt!==gt&&(pt&&(gt=1-gt),r.clearDepth(gt),vt=gt)},reset:function(){F=!1,q=null,Q=null,vt=null,pt=!1}}}function i(){let F=!1,pt=null,q=null,Q=null,vt=null,gt=null,Wt=null,xe=null,Ue=null;return{setTest:function(re){F||(re?lt(r.STENCIL_TEST):Lt(r.STENCIL_TEST))},setMask:function(re){pt!==re&&!F&&(r.stencilMask(re),pt=re)},setFunc:function(re,bn,Gn){(q!==re||Q!==bn||vt!==Gn)&&(r.stencilFunc(re,bn,Gn),q=re,Q=bn,vt=Gn)},setOp:function(re,bn,Gn){(gt!==re||Wt!==bn||xe!==Gn)&&(r.stencilOp(re,bn,Gn),gt=re,Wt=bn,xe=Gn)},setLocked:function(re){F=re},setClear:function(re){Ue!==re&&(r.clearStencil(re),Ue=re)},reset:function(){F=!1,pt=null,q=null,Q=null,vt=null,gt=null,Wt=null,xe=null,Ue=null}}}const s=new e,a=new n,o=new i,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,f=[],m=null,x=!1,g=null,p=null,_=null,v=null,y=null,P=null,S=null,T=new ht(0,0,0),E=0,M=!1,b=null,C=null,N=null,D=null,U=null;const H=r.getParameter(r.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let k=!1,G=0;const O=r.getParameter(r.VERSION);O.indexOf("WebGL")!==-1?(G=parseFloat(/^WebGL (\d)/.exec(O)[1]),k=G>=1):O.indexOf("OpenGL ES")!==-1&&(G=parseFloat(/^OpenGL ES (\d)/.exec(O)[1]),k=G>=2);let J=null,K={};const ot=r.getParameter(r.SCISSOR_BOX),bt=r.getParameter(r.VIEWPORT),Dt=new te().fromArray(ot),Y=new te().fromArray(bt);function it(F,pt,q,Q){const vt=new Uint8Array(4),gt=r.createTexture();r.bindTexture(F,gt),r.texParameteri(F,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(F,r.TEXTURE_MAG_FILTER,r.NEAREST);for(let Wt=0;Wt<q;Wt++)F===r.TEXTURE_3D||F===r.TEXTURE_2D_ARRAY?r.texImage3D(pt,0,r.RGBA,1,1,Q,0,r.RGBA,r.UNSIGNED_BYTE,vt):r.texImage2D(pt+Wt,0,r.RGBA,1,1,0,r.RGBA,r.UNSIGNED_BYTE,vt);return gt}const mt={};mt[r.TEXTURE_2D]=it(r.TEXTURE_2D,r.TEXTURE_2D,1),mt[r.TEXTURE_CUBE_MAP]=it(r.TEXTURE_CUBE_MAP,r.TEXTURE_CUBE_MAP_POSITIVE_X,6),mt[r.TEXTURE_2D_ARRAY]=it(r.TEXTURE_2D_ARRAY,r.TEXTURE_2D_ARRAY,1,1),mt[r.TEXTURE_3D]=it(r.TEXTURE_3D,r.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),lt(r.DEPTH_TEST),a.setFunc(is),st(!1),Mt(gc),lt(r.CULL_FACE),L(ni);function lt(F){h[F]!==!0&&(r.enable(F),h[F]=!0)}function Lt(F){h[F]!==!1&&(r.disable(F),h[F]=!1)}function Bt(F,pt){return u[F]!==pt?(r.bindFramebuffer(F,pt),u[F]=pt,F===r.DRAW_FRAMEBUFFER&&(u[r.FRAMEBUFFER]=pt),F===r.FRAMEBUFFER&&(u[r.DRAW_FRAMEBUFFER]=pt),!0):!1}function Nt(F,pt){let q=f,Q=!1;if(F){q=d.get(pt),q===void 0&&(q=[],d.set(pt,q));const vt=F.textures;if(q.length!==vt.length||q[0]!==r.COLOR_ATTACHMENT0){for(let gt=0,Wt=vt.length;gt<Wt;gt++)q[gt]=r.COLOR_ATTACHMENT0+gt;q.length=vt.length,Q=!0}}else q[0]!==r.BACK&&(q[0]=r.BACK,Q=!0);Q&&r.drawBuffers(q)}function Zt(F){return m!==F?(r.useProgram(F),m=F,!0):!1}const et={[bi]:r.FUNC_ADD,[Ad]:r.FUNC_SUBTRACT,[Ed]:r.FUNC_REVERSE_SUBTRACT};et[Cd]=r.MIN,et[Rd]=r.MAX;const at={[Id]:r.ZERO,[Qa]:r.ONE,[Pd]:r.SRC_COLOR,[to]:r.SRC_ALPHA,[Fd]:r.SRC_ALPHA_SATURATE,[Nd]:r.DST_COLOR,[Dd]:r.DST_ALPHA,[Ld]:r.ONE_MINUS_SRC_COLOR,[ks]:r.ONE_MINUS_SRC_ALPHA,[Od]:r.ONE_MINUS_DST_COLOR,[Ud]:r.ONE_MINUS_DST_ALPHA,[Bd]:r.CONSTANT_COLOR,[zd]:r.ONE_MINUS_CONSTANT_COLOR,[kd]:r.CONSTANT_ALPHA,[Hd]:r.ONE_MINUS_CONSTANT_ALPHA};function L(F,pt,q,Q,vt,gt,Wt,xe,Ue,re){if(F===ni){x===!0&&(Lt(r.BLEND),x=!1);return}if(x===!1&&(lt(r.BLEND),x=!0),F!==Dc){if(F!==g||re!==M){if((p!==bi||y!==bi)&&(r.blendEquation(r.FUNC_ADD),p=bi,y=bi),re)switch(F){case ji:r.blendFuncSeparate(r.ONE,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case Qi:r.blendFunc(r.ONE,r.ONE);break;case xc:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case vc:r.blendFuncSeparate(r.ZERO,r.SRC_COLOR,r.ZERO,r.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",F);break}else switch(F){case ji:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case Qi:r.blendFunc(r.SRC_ALPHA,r.ONE);break;case xc:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case vc:r.blendFunc(r.ZERO,r.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",F);break}_=null,v=null,P=null,S=null,T.set(0,0,0),E=0,g=F,M=re}return}vt=vt||pt,gt=gt||q,Wt=Wt||Q,(pt!==p||vt!==y)&&(r.blendEquationSeparate(et[pt],et[vt]),p=pt,y=vt),(q!==_||Q!==v||gt!==P||Wt!==S)&&(r.blendFuncSeparate(at[q],at[Q],at[gt],at[Wt]),_=q,v=Q,P=gt,S=Wt),(xe.equals(T)===!1||Ue!==E)&&(r.blendColor(xe.r,xe.g,xe.b,Ue),T.copy(xe),E=Ue),g=F,M=!1}function It(F,pt){F.side===Dn?Lt(r.CULL_FACE):lt(r.CULL_FACE);let q=F.side===Le;pt&&(q=!q),st(q),F.blending===ji&&F.transparent===!1?L(ni):L(F.blending,F.blendEquation,F.blendSrc,F.blendDst,F.blendEquationAlpha,F.blendSrcAlpha,F.blendDstAlpha,F.blendColor,F.blendAlpha,F.premultipliedAlpha),a.setFunc(F.depthFunc),a.setTest(F.depthTest),a.setMask(F.depthWrite),s.setMask(F.colorWrite);const Q=F.stencilWrite;o.setTest(Q),Q&&(o.setMask(F.stencilWriteMask),o.setFunc(F.stencilFunc,F.stencilRef,F.stencilFuncMask),o.setOp(F.stencilFail,F.stencilZFail,F.stencilZPass)),Ot(F.polygonOffset,F.polygonOffsetFactor,F.polygonOffsetUnits),F.alphaToCoverage===!0?lt(r.SAMPLE_ALPHA_TO_COVERAGE):Lt(r.SAMPLE_ALPHA_TO_COVERAGE)}function st(F){b!==F&&(F?r.frontFace(r.CW):r.frontFace(r.CCW),b=F)}function Mt(F){F!==wd?(lt(r.CULL_FACE),F!==C&&(F===gc?r.cullFace(r.BACK):F===Td?r.cullFace(r.FRONT):r.cullFace(r.FRONT_AND_BACK))):Lt(r.CULL_FACE),C=F}function ut(F){F!==N&&(k&&r.lineWidth(F),N=F)}function Ot(F,pt,q){F?(lt(r.POLYGON_OFFSET_FILL),(D!==pt||U!==q)&&(r.polygonOffset(pt,q),D=pt,U=q)):Lt(r.POLYGON_OFFSET_FILL)}function _t(F){F?lt(r.SCISSOR_TEST):Lt(r.SCISSOR_TEST)}function I(F){F===void 0&&(F=r.TEXTURE0+H-1),J!==F&&(r.activeTexture(F),J=F)}function w(F,pt,q){q===void 0&&(J===null?q=r.TEXTURE0+H-1:q=J);let Q=K[q];Q===void 0&&(Q={type:void 0,texture:void 0},K[q]=Q),(Q.type!==F||Q.texture!==pt)&&(J!==q&&(r.activeTexture(q),J=q),r.bindTexture(F,pt||mt[F]),Q.type=F,Q.texture=pt)}function V(){const F=K[J];F!==void 0&&F.type!==void 0&&(r.bindTexture(F.type,null),F.type=void 0,F.texture=void 0)}function $(){try{r.compressedTexImage2D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function nt(){try{r.compressedTexImage3D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function Z(){try{r.texSubImage2D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function At(){try{r.texSubImage3D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function ft(){try{r.compressedTexSubImage2D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function yt(){try{r.compressedTexSubImage3D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function Kt(){try{r.texStorage2D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function rt(){try{r.texStorage3D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function St(){try{r.texImage2D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function Ft(){try{r.texImage3D.apply(r,arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function zt(F){Dt.equals(F)===!1&&(r.scissor(F.x,F.y,F.z,F.w),Dt.copy(F))}function wt(F){Y.equals(F)===!1&&(r.viewport(F.x,F.y,F.z,F.w),Y.copy(F))}function jt(F,pt){let q=c.get(pt);q===void 0&&(q=new WeakMap,c.set(pt,q));let Q=q.get(F);Q===void 0&&(Q=r.getUniformBlockIndex(pt,F.name),q.set(F,Q))}function Yt(F,pt){const Q=c.get(pt).get(F);l.get(pt)!==Q&&(r.uniformBlockBinding(pt,Q,F.__bindingPointIndex),l.set(pt,Q))}function ce(){r.disable(r.BLEND),r.disable(r.CULL_FACE),r.disable(r.DEPTH_TEST),r.disable(r.POLYGON_OFFSET_FILL),r.disable(r.SCISSOR_TEST),r.disable(r.STENCIL_TEST),r.disable(r.SAMPLE_ALPHA_TO_COVERAGE),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.ONE,r.ZERO),r.blendFuncSeparate(r.ONE,r.ZERO,r.ONE,r.ZERO),r.blendColor(0,0,0,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(r.LESS),a.setReversed(!1),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(r.ALWAYS,0,4294967295),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),r.clearStencil(0),r.cullFace(r.BACK),r.frontFace(r.CCW),r.polygonOffset(0,0),r.activeTexture(r.TEXTURE0),r.bindFramebuffer(r.FRAMEBUFFER,null),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),r.bindFramebuffer(r.READ_FRAMEBUFFER,null),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),h={},J=null,K={},u={},d=new WeakMap,f=[],m=null,x=!1,g=null,p=null,_=null,v=null,y=null,P=null,S=null,T=new ht(0,0,0),E=0,M=!1,b=null,C=null,N=null,D=null,U=null,Dt.set(0,0,r.canvas.width,r.canvas.height),Y.set(0,0,r.canvas.width,r.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:lt,disable:Lt,bindFramebuffer:Bt,drawBuffers:Nt,useProgram:Zt,setBlending:L,setMaterial:It,setFlipSided:st,setCullFace:Mt,setLineWidth:ut,setPolygonOffset:Ot,setScissorTest:_t,activeTexture:I,bindTexture:w,unbindTexture:V,compressedTexImage2D:$,compressedTexImage3D:nt,texImage2D:St,texImage3D:Ft,updateUBOMapping:jt,uniformBlockBinding:Yt,texStorage2D:Kt,texStorage3D:rt,texSubImage2D:Z,texSubImage3D:At,compressedTexSubImage2D:ft,compressedTexSubImage3D:yt,scissor:zt,viewport:wt,reset:ce}}function L_(r,t){const e=r.image&&r.image.width?r.image.width/r.image.height:1;return e>t?(r.repeat.x=1,r.repeat.y=e/t,r.offset.x=0,r.offset.y=(1-r.repeat.y)/2):(r.repeat.x=t/e,r.repeat.y=1,r.offset.x=(1-r.repeat.x)/2,r.offset.y=0),r}function D_(r,t){const e=r.image&&r.image.width?r.image.width/r.image.height:1;return e>t?(r.repeat.x=t/e,r.repeat.y=1,r.offset.x=(1-r.repeat.x)/2,r.offset.y=0):(r.repeat.x=1,r.repeat.y=e/t,r.offset.x=0,r.offset.y=(1-r.repeat.y)/2),r}function U_(r){return r.repeat.x=1,r.repeat.y=1,r.offset.x=0,r.offset.y=0,r}function Sc(r,t,e,n){const i=N_(n);switch(e){case zc:return r*t;case Hc:return r*t;case Vc:return r*t*2;case Zo:return r*t/i.components*i.byteLength;case Vr:return r*t/i.components*i.byteLength;case Gc:return r*t*2/i.components*i.byteLength;case Ko:return r*t*2/i.components*i.byteLength;case kc:return r*t*3/i.components*i.byteLength;case Xe:return r*t*4/i.components*i.byteLength;case Jo:return r*t*4/i.components*i.byteLength;case pr:case mr:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case gr:case xr:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case co:case uo:return Math.max(r,16)*Math.max(t,8)/4;case lo:case ho:return Math.max(r,8)*Math.max(t,8)/2;case fo:case po:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case mo:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case go:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case xo:return Math.floor((r+4)/5)*Math.floor((t+3)/4)*16;case vo:return Math.floor((r+4)/5)*Math.floor((t+4)/5)*16;case _o:return Math.floor((r+5)/6)*Math.floor((t+4)/5)*16;case yo:return Math.floor((r+5)/6)*Math.floor((t+5)/6)*16;case bo:return Math.floor((r+7)/8)*Math.floor((t+4)/5)*16;case Mo:return Math.floor((r+7)/8)*Math.floor((t+5)/6)*16;case So:return Math.floor((r+7)/8)*Math.floor((t+7)/8)*16;case wo:return Math.floor((r+9)/10)*Math.floor((t+4)/5)*16;case To:return Math.floor((r+9)/10)*Math.floor((t+5)/6)*16;case Ao:return Math.floor((r+9)/10)*Math.floor((t+7)/8)*16;case Eo:return Math.floor((r+9)/10)*Math.floor((t+9)/10)*16;case Co:return Math.floor((r+11)/12)*Math.floor((t+9)/10)*16;case Ro:return Math.floor((r+11)/12)*Math.floor((t+11)/12)*16;case vr:case Io:case Po:return Math.ceil(r/4)*Math.ceil(t/4)*16;case Wc:case Lo:return Math.ceil(r/4)*Math.ceil(t/4)*8;case Do:case Uo:return Math.ceil(r/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function N_(r){switch(r){case zn:case Oc:return{byteLength:1,components:1};case Vs:case Fc:case qs:return{byteLength:2,components:1};case Yo:case $o:return{byteLength:2,components:4};case oi:case qo:case tn:return{byteLength:4,components:1};case Bc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${r}.`)}const O_={contain:L_,cover:D_,fill:U_,getByteLength:Sc};function F_(r,t,e,n,i,s,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new tt,h=new WeakMap;let u;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(I,w){return f?new OffscreenCanvas(I,w):Ir("canvas")}function x(I,w,V){let $=1;const nt=_t(I);if((nt.width>V||nt.height>V)&&($=V/Math.max(nt.width,nt.height)),$<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){const Z=Math.floor($*nt.width),At=Math.floor($*nt.height);u===void 0&&(u=m(Z,At));const ft=w?m(Z,At):u;return ft.width=Z,ft.height=At,ft.getContext("2d").drawImage(I,0,0,Z,At),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+nt.width+"x"+nt.height+") to ("+Z+"x"+At+")."),ft}else return"data"in I&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+nt.width+"x"+nt.height+")."),I;return I}function g(I){return I.generateMipmaps}function p(I){r.generateMipmap(I)}function _(I){return I.isWebGLCubeRenderTarget?r.TEXTURE_CUBE_MAP:I.isWebGL3DRenderTarget?r.TEXTURE_3D:I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture?r.TEXTURE_2D_ARRAY:r.TEXTURE_2D}function v(I,w,V,$,nt=!1){if(I!==null){if(r[I]!==void 0)return r[I];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let Z=w;if(w===r.RED&&(V===r.FLOAT&&(Z=r.R32F),V===r.HALF_FLOAT&&(Z=r.R16F),V===r.UNSIGNED_BYTE&&(Z=r.R8)),w===r.RED_INTEGER&&(V===r.UNSIGNED_BYTE&&(Z=r.R8UI),V===r.UNSIGNED_SHORT&&(Z=r.R16UI),V===r.UNSIGNED_INT&&(Z=r.R32UI),V===r.BYTE&&(Z=r.R8I),V===r.SHORT&&(Z=r.R16I),V===r.INT&&(Z=r.R32I)),w===r.RG&&(V===r.FLOAT&&(Z=r.RG32F),V===r.HALF_FLOAT&&(Z=r.RG16F),V===r.UNSIGNED_BYTE&&(Z=r.RG8)),w===r.RG_INTEGER&&(V===r.UNSIGNED_BYTE&&(Z=r.RG8UI),V===r.UNSIGNED_SHORT&&(Z=r.RG16UI),V===r.UNSIGNED_INT&&(Z=r.RG32UI),V===r.BYTE&&(Z=r.RG8I),V===r.SHORT&&(Z=r.RG16I),V===r.INT&&(Z=r.RG32I)),w===r.RGB_INTEGER&&(V===r.UNSIGNED_BYTE&&(Z=r.RGB8UI),V===r.UNSIGNED_SHORT&&(Z=r.RGB16UI),V===r.UNSIGNED_INT&&(Z=r.RGB32UI),V===r.BYTE&&(Z=r.RGB8I),V===r.SHORT&&(Z=r.RGB16I),V===r.INT&&(Z=r.RGB32I)),w===r.RGBA_INTEGER&&(V===r.UNSIGNED_BYTE&&(Z=r.RGBA8UI),V===r.UNSIGNED_SHORT&&(Z=r.RGBA16UI),V===r.UNSIGNED_INT&&(Z=r.RGBA32UI),V===r.BYTE&&(Z=r.RGBA8I),V===r.SHORT&&(Z=r.RGBA16I),V===r.INT&&(Z=r.RGBA32I)),w===r.RGB&&V===r.UNSIGNED_INT_5_9_9_9_REV&&(Z=r.RGB9_E5),w===r.RGBA){const At=nt?Gr:Jt.getTransfer($);V===r.FLOAT&&(Z=r.RGBA32F),V===r.HALF_FLOAT&&(Z=r.RGBA16F),V===r.UNSIGNED_BYTE&&(Z=At===ae?r.SRGB8_ALPHA8:r.RGBA8),V===r.UNSIGNED_SHORT_4_4_4_4&&(Z=r.RGBA4),V===r.UNSIGNED_SHORT_5_5_5_1&&(Z=r.RGB5_A1)}return(Z===r.R16F||Z===r.R32F||Z===r.RG16F||Z===r.RG32F||Z===r.RGBA16F||Z===r.RGBA32F)&&t.get("EXT_color_buffer_float"),Z}function y(I,w){let V;return I?w===null||w===oi||w===ss?V=r.DEPTH24_STENCIL8:w===tn?V=r.DEPTH32F_STENCIL8:w===Vs&&(V=r.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):w===null||w===oi||w===ss?V=r.DEPTH_COMPONENT24:w===tn?V=r.DEPTH_COMPONENT32F:w===Vs&&(V=r.DEPTH_COMPONENT16),V}function P(I,w){return g(I)===!0||I.isFramebufferTexture&&I.minFilter!==De&&I.minFilter!==we?Math.log2(Math.max(w.width,w.height))+1:I.mipmaps!==void 0&&I.mipmaps.length>0?I.mipmaps.length:I.isCompressedTexture&&Array.isArray(I.image)?w.mipmaps.length:1}function S(I){const w=I.target;w.removeEventListener("dispose",S),E(w),w.isVideoTexture&&h.delete(w)}function T(I){const w=I.target;w.removeEventListener("dispose",T),b(w)}function E(I){const w=n.get(I);if(w.__webglInit===void 0)return;const V=I.source,$=d.get(V);if($){const nt=$[w.__cacheKey];nt.usedTimes--,nt.usedTimes===0&&M(I),Object.keys($).length===0&&d.delete(V)}n.remove(I)}function M(I){const w=n.get(I);r.deleteTexture(w.__webglTexture);const V=I.source,$=d.get(V);delete $[w.__cacheKey],a.memory.textures--}function b(I){const w=n.get(I);if(I.depthTexture&&(I.depthTexture.dispose(),n.remove(I.depthTexture)),I.isWebGLCubeRenderTarget)for(let $=0;$<6;$++){if(Array.isArray(w.__webglFramebuffer[$]))for(let nt=0;nt<w.__webglFramebuffer[$].length;nt++)r.deleteFramebuffer(w.__webglFramebuffer[$][nt]);else r.deleteFramebuffer(w.__webglFramebuffer[$]);w.__webglDepthbuffer&&r.deleteRenderbuffer(w.__webglDepthbuffer[$])}else{if(Array.isArray(w.__webglFramebuffer))for(let $=0;$<w.__webglFramebuffer.length;$++)r.deleteFramebuffer(w.__webglFramebuffer[$]);else r.deleteFramebuffer(w.__webglFramebuffer);if(w.__webglDepthbuffer&&r.deleteRenderbuffer(w.__webglDepthbuffer),w.__webglMultisampledFramebuffer&&r.deleteFramebuffer(w.__webglMultisampledFramebuffer),w.__webglColorRenderbuffer)for(let $=0;$<w.__webglColorRenderbuffer.length;$++)w.__webglColorRenderbuffer[$]&&r.deleteRenderbuffer(w.__webglColorRenderbuffer[$]);w.__webglDepthRenderbuffer&&r.deleteRenderbuffer(w.__webglDepthRenderbuffer)}const V=I.textures;for(let $=0,nt=V.length;$<nt;$++){const Z=n.get(V[$]);Z.__webglTexture&&(r.deleteTexture(Z.__webglTexture),a.memory.textures--),n.remove(V[$])}n.remove(I)}let C=0;function N(){C=0}function D(){const I=C;return I>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+I+" texture units while this GPU supports only "+i.maxTextures),C+=1,I}function U(I){const w=[];return w.push(I.wrapS),w.push(I.wrapT),w.push(I.wrapR||0),w.push(I.magFilter),w.push(I.minFilter),w.push(I.anisotropy),w.push(I.internalFormat),w.push(I.format),w.push(I.type),w.push(I.generateMipmaps),w.push(I.premultiplyAlpha),w.push(I.flipY),w.push(I.unpackAlignment),w.push(I.colorSpace),w.join()}function H(I,w){const V=n.get(I);if(I.isVideoTexture&&ut(I),I.isRenderTargetTexture===!1&&I.version>0&&V.__version!==I.version){const $=I.image;if($===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if($.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(V,I,w);return}}e.bindTexture(r.TEXTURE_2D,V.__webglTexture,r.TEXTURE0+w)}function k(I,w){const V=n.get(I);if(I.version>0&&V.__version!==I.version){Y(V,I,w);return}e.bindTexture(r.TEXTURE_2D_ARRAY,V.__webglTexture,r.TEXTURE0+w)}function G(I,w){const V=n.get(I);if(I.version>0&&V.__version!==I.version){Y(V,I,w);return}e.bindTexture(r.TEXTURE_3D,V.__webglTexture,r.TEXTURE0+w)}function O(I,w){const V=n.get(I);if(I.version>0&&V.__version!==I.version){it(V,I,w);return}e.bindTexture(r.TEXTURE_CUBE_MAP,V.__webglTexture,r.TEXTURE0+w)}const J={[Hs]:r.REPEAT,[un]:r.CLAMP_TO_EDGE,[Tr]:r.MIRRORED_REPEAT},K={[De]:r.NEAREST,[Nc]:r.NEAREST_MIPMAP_NEAREST,[Ds]:r.NEAREST_MIPMAP_LINEAR,[we]:r.LINEAR,[fr]:r.LINEAR_MIPMAP_NEAREST,[vn]:r.LINEAR_MIPMAP_LINEAR},ot={[sf]:r.NEVER,[hf]:r.ALWAYS,[rf]:r.LESS,[qc]:r.LEQUAL,[af]:r.EQUAL,[cf]:r.GEQUAL,[of]:r.GREATER,[lf]:r.NOTEQUAL};function bt(I,w){if(w.type===tn&&t.has("OES_texture_float_linear")===!1&&(w.magFilter===we||w.magFilter===fr||w.magFilter===Ds||w.magFilter===vn||w.minFilter===we||w.minFilter===fr||w.minFilter===Ds||w.minFilter===vn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),r.texParameteri(I,r.TEXTURE_WRAP_S,J[w.wrapS]),r.texParameteri(I,r.TEXTURE_WRAP_T,J[w.wrapT]),(I===r.TEXTURE_3D||I===r.TEXTURE_2D_ARRAY)&&r.texParameteri(I,r.TEXTURE_WRAP_R,J[w.wrapR]),r.texParameteri(I,r.TEXTURE_MAG_FILTER,K[w.magFilter]),r.texParameteri(I,r.TEXTURE_MIN_FILTER,K[w.minFilter]),w.compareFunction&&(r.texParameteri(I,r.TEXTURE_COMPARE_MODE,r.COMPARE_REF_TO_TEXTURE),r.texParameteri(I,r.TEXTURE_COMPARE_FUNC,ot[w.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(w.magFilter===De||w.minFilter!==Ds&&w.minFilter!==vn||w.type===tn&&t.has("OES_texture_float_linear")===!1)return;if(w.anisotropy>1||n.get(w).__currentAnisotropy){const V=t.get("EXT_texture_filter_anisotropic");r.texParameterf(I,V.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(w.anisotropy,i.getMaxAnisotropy())),n.get(w).__currentAnisotropy=w.anisotropy}}}function Dt(I,w){let V=!1;I.__webglInit===void 0&&(I.__webglInit=!0,w.addEventListener("dispose",S));const $=w.source;let nt=d.get($);nt===void 0&&(nt={},d.set($,nt));const Z=U(w);if(Z!==I.__cacheKey){nt[Z]===void 0&&(nt[Z]={texture:r.createTexture(),usedTimes:0},a.memory.textures++,V=!0),nt[Z].usedTimes++;const At=nt[I.__cacheKey];At!==void 0&&(nt[I.__cacheKey].usedTimes--,At.usedTimes===0&&M(w)),I.__cacheKey=Z,I.__webglTexture=nt[Z].texture}return V}function Y(I,w,V){let $=r.TEXTURE_2D;(w.isDataArrayTexture||w.isCompressedArrayTexture)&&($=r.TEXTURE_2D_ARRAY),w.isData3DTexture&&($=r.TEXTURE_3D);const nt=Dt(I,w),Z=w.source;e.bindTexture($,I.__webglTexture,r.TEXTURE0+V);const At=n.get(Z);if(Z.version!==At.__version||nt===!0){e.activeTexture(r.TEXTURE0+V);const ft=Jt.getPrimaries(Jt.workingColorSpace),yt=w.colorSpace===Un?null:Jt.getPrimaries(w.colorSpace),Kt=w.colorSpace===Un||ft===yt?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,w.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,w.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,Kt);let rt=x(w.image,!1,i.maxTextureSize);rt=Ot(w,rt);const St=s.convert(w.format,w.colorSpace),Ft=s.convert(w.type);let zt=v(w.internalFormat,St,Ft,w.colorSpace,w.isVideoTexture);bt($,w);let wt;const jt=w.mipmaps,Yt=w.isVideoTexture!==!0,ce=At.__version===void 0||nt===!0,F=Z.dataReady,pt=P(w,rt);if(w.isDepthTexture)zt=y(w.format===rs,w.type),ce&&(Yt?e.texStorage2D(r.TEXTURE_2D,1,zt,rt.width,rt.height):e.texImage2D(r.TEXTURE_2D,0,zt,rt.width,rt.height,0,St,Ft,null));else if(w.isDataTexture)if(jt.length>0){Yt&&ce&&e.texStorage2D(r.TEXTURE_2D,pt,zt,jt[0].width,jt[0].height);for(let q=0,Q=jt.length;q<Q;q++)wt=jt[q],Yt?F&&e.texSubImage2D(r.TEXTURE_2D,q,0,0,wt.width,wt.height,St,Ft,wt.data):e.texImage2D(r.TEXTURE_2D,q,zt,wt.width,wt.height,0,St,Ft,wt.data);w.generateMipmaps=!1}else Yt?(ce&&e.texStorage2D(r.TEXTURE_2D,pt,zt,rt.width,rt.height),F&&e.texSubImage2D(r.TEXTURE_2D,0,0,0,rt.width,rt.height,St,Ft,rt.data)):e.texImage2D(r.TEXTURE_2D,0,zt,rt.width,rt.height,0,St,Ft,rt.data);else if(w.isCompressedTexture)if(w.isCompressedArrayTexture){Yt&&ce&&e.texStorage3D(r.TEXTURE_2D_ARRAY,pt,zt,jt[0].width,jt[0].height,rt.depth);for(let q=0,Q=jt.length;q<Q;q++)if(wt=jt[q],w.format!==Xe)if(St!==null)if(Yt){if(F)if(w.layerUpdates.size>0){const vt=Sc(wt.width,wt.height,w.format,w.type);for(const gt of w.layerUpdates){const Wt=wt.data.subarray(gt*vt/wt.data.BYTES_PER_ELEMENT,(gt+1)*vt/wt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,q,0,0,gt,wt.width,wt.height,1,St,Wt)}w.clearLayerUpdates()}else e.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,q,0,0,0,wt.width,wt.height,rt.depth,St,wt.data)}else e.compressedTexImage3D(r.TEXTURE_2D_ARRAY,q,zt,wt.width,wt.height,rt.depth,0,wt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Yt?F&&e.texSubImage3D(r.TEXTURE_2D_ARRAY,q,0,0,0,wt.width,wt.height,rt.depth,St,Ft,wt.data):e.texImage3D(r.TEXTURE_2D_ARRAY,q,zt,wt.width,wt.height,rt.depth,0,St,Ft,wt.data)}else{Yt&&ce&&e.texStorage2D(r.TEXTURE_2D,pt,zt,jt[0].width,jt[0].height);for(let q=0,Q=jt.length;q<Q;q++)wt=jt[q],w.format!==Xe?St!==null?Yt?F&&e.compressedTexSubImage2D(r.TEXTURE_2D,q,0,0,wt.width,wt.height,St,wt.data):e.compressedTexImage2D(r.TEXTURE_2D,q,zt,wt.width,wt.height,0,wt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Yt?F&&e.texSubImage2D(r.TEXTURE_2D,q,0,0,wt.width,wt.height,St,Ft,wt.data):e.texImage2D(r.TEXTURE_2D,q,zt,wt.width,wt.height,0,St,Ft,wt.data)}else if(w.isDataArrayTexture)if(Yt){if(ce&&e.texStorage3D(r.TEXTURE_2D_ARRAY,pt,zt,rt.width,rt.height,rt.depth),F)if(w.layerUpdates.size>0){const q=Sc(rt.width,rt.height,w.format,w.type);for(const Q of w.layerUpdates){const vt=rt.data.subarray(Q*q/rt.data.BYTES_PER_ELEMENT,(Q+1)*q/rt.data.BYTES_PER_ELEMENT);e.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,Q,rt.width,rt.height,1,St,Ft,vt)}w.clearLayerUpdates()}else e.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,0,rt.width,rt.height,rt.depth,St,Ft,rt.data)}else e.texImage3D(r.TEXTURE_2D_ARRAY,0,zt,rt.width,rt.height,rt.depth,0,St,Ft,rt.data);else if(w.isData3DTexture)Yt?(ce&&e.texStorage3D(r.TEXTURE_3D,pt,zt,rt.width,rt.height,rt.depth),F&&e.texSubImage3D(r.TEXTURE_3D,0,0,0,0,rt.width,rt.height,rt.depth,St,Ft,rt.data)):e.texImage3D(r.TEXTURE_3D,0,zt,rt.width,rt.height,rt.depth,0,St,Ft,rt.data);else if(w.isFramebufferTexture){if(ce)if(Yt)e.texStorage2D(r.TEXTURE_2D,pt,zt,rt.width,rt.height);else{let q=rt.width,Q=rt.height;for(let vt=0;vt<pt;vt++)e.texImage2D(r.TEXTURE_2D,vt,zt,q,Q,0,St,Ft,null),q>>=1,Q>>=1}}else if(jt.length>0){if(Yt&&ce){const q=_t(jt[0]);e.texStorage2D(r.TEXTURE_2D,pt,zt,q.width,q.height)}for(let q=0,Q=jt.length;q<Q;q++)wt=jt[q],Yt?F&&e.texSubImage2D(r.TEXTURE_2D,q,0,0,St,Ft,wt):e.texImage2D(r.TEXTURE_2D,q,zt,St,Ft,wt);w.generateMipmaps=!1}else if(Yt){if(ce){const q=_t(rt);e.texStorage2D(r.TEXTURE_2D,pt,zt,q.width,q.height)}F&&e.texSubImage2D(r.TEXTURE_2D,0,0,0,St,Ft,rt)}else e.texImage2D(r.TEXTURE_2D,0,zt,St,Ft,rt);g(w)&&p($),At.__version=Z.version,w.onUpdate&&w.onUpdate(w)}I.__version=w.version}function it(I,w,V){if(w.image.length!==6)return;const $=Dt(I,w),nt=w.source;e.bindTexture(r.TEXTURE_CUBE_MAP,I.__webglTexture,r.TEXTURE0+V);const Z=n.get(nt);if(nt.version!==Z.__version||$===!0){e.activeTexture(r.TEXTURE0+V);const At=Jt.getPrimaries(Jt.workingColorSpace),ft=w.colorSpace===Un?null:Jt.getPrimaries(w.colorSpace),yt=w.colorSpace===Un||At===ft?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,w.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,w.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,yt);const Kt=w.isCompressedTexture||w.image[0].isCompressedTexture,rt=w.image[0]&&w.image[0].isDataTexture,St=[];for(let Q=0;Q<6;Q++)!Kt&&!rt?St[Q]=x(w.image[Q],!0,i.maxCubemapSize):St[Q]=rt?w.image[Q].image:w.image[Q],St[Q]=Ot(w,St[Q]);const Ft=St[0],zt=s.convert(w.format,w.colorSpace),wt=s.convert(w.type),jt=v(w.internalFormat,zt,wt,w.colorSpace),Yt=w.isVideoTexture!==!0,ce=Z.__version===void 0||$===!0,F=nt.dataReady;let pt=P(w,Ft);bt(r.TEXTURE_CUBE_MAP,w);let q;if(Kt){Yt&&ce&&e.texStorage2D(r.TEXTURE_CUBE_MAP,pt,jt,Ft.width,Ft.height);for(let Q=0;Q<6;Q++){q=St[Q].mipmaps;for(let vt=0;vt<q.length;vt++){const gt=q[vt];w.format!==Xe?zt!==null?Yt?F&&e.compressedTexSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,0,0,gt.width,gt.height,zt,gt.data):e.compressedTexImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,jt,gt.width,gt.height,0,gt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Yt?F&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,0,0,gt.width,gt.height,zt,wt,gt.data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,jt,gt.width,gt.height,0,zt,wt,gt.data)}}}else{if(q=w.mipmaps,Yt&&ce){q.length>0&&pt++;const Q=_t(St[0]);e.texStorage2D(r.TEXTURE_CUBE_MAP,pt,jt,Q.width,Q.height)}for(let Q=0;Q<6;Q++)if(rt){Yt?F&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,St[Q].width,St[Q].height,zt,wt,St[Q].data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,jt,St[Q].width,St[Q].height,0,zt,wt,St[Q].data);for(let vt=0;vt<q.length;vt++){const Wt=q[vt].image[Q].image;Yt?F&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,0,0,Wt.width,Wt.height,zt,wt,Wt.data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,jt,Wt.width,Wt.height,0,zt,wt,Wt.data)}}else{Yt?F&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,zt,wt,St[Q]):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,jt,zt,wt,St[Q]);for(let vt=0;vt<q.length;vt++){const gt=q[vt];Yt?F&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,0,0,zt,wt,gt.image[Q]):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,jt,zt,wt,gt.image[Q])}}}g(w)&&p(r.TEXTURE_CUBE_MAP),Z.__version=nt.version,w.onUpdate&&w.onUpdate(w)}I.__version=w.version}function mt(I,w,V,$,nt,Z){const At=s.convert(V.format,V.colorSpace),ft=s.convert(V.type),yt=v(V.internalFormat,At,ft,V.colorSpace),Kt=n.get(w),rt=n.get(V);if(rt.__renderTarget=w,!Kt.__hasExternalTextures){const St=Math.max(1,w.width>>Z),Ft=Math.max(1,w.height>>Z);nt===r.TEXTURE_3D||nt===r.TEXTURE_2D_ARRAY?e.texImage3D(nt,Z,yt,St,Ft,w.depth,0,At,ft,null):e.texImage2D(nt,Z,yt,St,Ft,0,At,ft,null)}e.bindFramebuffer(r.FRAMEBUFFER,I),Mt(w)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,$,nt,rt.__webglTexture,0,st(w)):(nt===r.TEXTURE_2D||nt>=r.TEXTURE_CUBE_MAP_POSITIVE_X&&nt<=r.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&r.framebufferTexture2D(r.FRAMEBUFFER,$,nt,rt.__webglTexture,Z),e.bindFramebuffer(r.FRAMEBUFFER,null)}function lt(I,w,V){if(r.bindRenderbuffer(r.RENDERBUFFER,I),w.depthBuffer){const $=w.depthTexture,nt=$&&$.isDepthTexture?$.type:null,Z=y(w.stencilBuffer,nt),At=w.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,ft=st(w);Mt(w)?o.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,ft,Z,w.width,w.height):V?r.renderbufferStorageMultisample(r.RENDERBUFFER,ft,Z,w.width,w.height):r.renderbufferStorage(r.RENDERBUFFER,Z,w.width,w.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,At,r.RENDERBUFFER,I)}else{const $=w.textures;for(let nt=0;nt<$.length;nt++){const Z=$[nt],At=s.convert(Z.format,Z.colorSpace),ft=s.convert(Z.type),yt=v(Z.internalFormat,At,ft,Z.colorSpace),Kt=st(w);V&&Mt(w)===!1?r.renderbufferStorageMultisample(r.RENDERBUFFER,Kt,yt,w.width,w.height):Mt(w)?o.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,Kt,yt,w.width,w.height):r.renderbufferStorage(r.RENDERBUFFER,yt,w.width,w.height)}}r.bindRenderbuffer(r.RENDERBUFFER,null)}function Lt(I,w){if(w&&w.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(r.FRAMEBUFFER,I),!(w.depthTexture&&w.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const $=n.get(w.depthTexture);$.__renderTarget=w,(!$.__webglTexture||w.depthTexture.image.width!==w.width||w.depthTexture.image.height!==w.height)&&(w.depthTexture.image.width=w.width,w.depthTexture.image.height=w.height,w.depthTexture.needsUpdate=!0),H(w.depthTexture,0);const nt=$.__webglTexture,Z=st(w);if(w.depthTexture.format===ts)Mt(w)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,nt,0,Z):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,nt,0);else if(w.depthTexture.format===rs)Mt(w)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,nt,0,Z):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,nt,0);else throw new Error("Unknown depthTexture format")}function Bt(I){const w=n.get(I),V=I.isWebGLCubeRenderTarget===!0;if(w.__boundDepthTexture!==I.depthTexture){const $=I.depthTexture;if(w.__depthDisposeCallback&&w.__depthDisposeCallback(),$){const nt=()=>{delete w.__boundDepthTexture,delete w.__depthDisposeCallback,$.removeEventListener("dispose",nt)};$.addEventListener("dispose",nt),w.__depthDisposeCallback=nt}w.__boundDepthTexture=$}if(I.depthTexture&&!w.__autoAllocateDepthBuffer){if(V)throw new Error("target.depthTexture not supported in Cube render targets");Lt(w.__webglFramebuffer,I)}else if(V){w.__webglDepthbuffer=[];for(let $=0;$<6;$++)if(e.bindFramebuffer(r.FRAMEBUFFER,w.__webglFramebuffer[$]),w.__webglDepthbuffer[$]===void 0)w.__webglDepthbuffer[$]=r.createRenderbuffer(),lt(w.__webglDepthbuffer[$],I,!1);else{const nt=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,Z=w.__webglDepthbuffer[$];r.bindRenderbuffer(r.RENDERBUFFER,Z),r.framebufferRenderbuffer(r.FRAMEBUFFER,nt,r.RENDERBUFFER,Z)}}else if(e.bindFramebuffer(r.FRAMEBUFFER,w.__webglFramebuffer),w.__webglDepthbuffer===void 0)w.__webglDepthbuffer=r.createRenderbuffer(),lt(w.__webglDepthbuffer,I,!1);else{const $=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,nt=w.__webglDepthbuffer;r.bindRenderbuffer(r.RENDERBUFFER,nt),r.framebufferRenderbuffer(r.FRAMEBUFFER,$,r.RENDERBUFFER,nt)}e.bindFramebuffer(r.FRAMEBUFFER,null)}function Nt(I,w,V){const $=n.get(I);w!==void 0&&mt($.__webglFramebuffer,I,I.texture,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,0),V!==void 0&&Bt(I)}function Zt(I){const w=I.texture,V=n.get(I),$=n.get(w);I.addEventListener("dispose",T);const nt=I.textures,Z=I.isWebGLCubeRenderTarget===!0,At=nt.length>1;if(At||($.__webglTexture===void 0&&($.__webglTexture=r.createTexture()),$.__version=w.version,a.memory.textures++),Z){V.__webglFramebuffer=[];for(let ft=0;ft<6;ft++)if(w.mipmaps&&w.mipmaps.length>0){V.__webglFramebuffer[ft]=[];for(let yt=0;yt<w.mipmaps.length;yt++)V.__webglFramebuffer[ft][yt]=r.createFramebuffer()}else V.__webglFramebuffer[ft]=r.createFramebuffer()}else{if(w.mipmaps&&w.mipmaps.length>0){V.__webglFramebuffer=[];for(let ft=0;ft<w.mipmaps.length;ft++)V.__webglFramebuffer[ft]=r.createFramebuffer()}else V.__webglFramebuffer=r.createFramebuffer();if(At)for(let ft=0,yt=nt.length;ft<yt;ft++){const Kt=n.get(nt[ft]);Kt.__webglTexture===void 0&&(Kt.__webglTexture=r.createTexture(),a.memory.textures++)}if(I.samples>0&&Mt(I)===!1){V.__webglMultisampledFramebuffer=r.createFramebuffer(),V.__webglColorRenderbuffer=[],e.bindFramebuffer(r.FRAMEBUFFER,V.__webglMultisampledFramebuffer);for(let ft=0;ft<nt.length;ft++){const yt=nt[ft];V.__webglColorRenderbuffer[ft]=r.createRenderbuffer(),r.bindRenderbuffer(r.RENDERBUFFER,V.__webglColorRenderbuffer[ft]);const Kt=s.convert(yt.format,yt.colorSpace),rt=s.convert(yt.type),St=v(yt.internalFormat,Kt,rt,yt.colorSpace,I.isXRRenderTarget===!0),Ft=st(I);r.renderbufferStorageMultisample(r.RENDERBUFFER,Ft,St,I.width,I.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+ft,r.RENDERBUFFER,V.__webglColorRenderbuffer[ft])}r.bindRenderbuffer(r.RENDERBUFFER,null),I.depthBuffer&&(V.__webglDepthRenderbuffer=r.createRenderbuffer(),lt(V.__webglDepthRenderbuffer,I,!0)),e.bindFramebuffer(r.FRAMEBUFFER,null)}}if(Z){e.bindTexture(r.TEXTURE_CUBE_MAP,$.__webglTexture),bt(r.TEXTURE_CUBE_MAP,w);for(let ft=0;ft<6;ft++)if(w.mipmaps&&w.mipmaps.length>0)for(let yt=0;yt<w.mipmaps.length;yt++)mt(V.__webglFramebuffer[ft][yt],I,w,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+ft,yt);else mt(V.__webglFramebuffer[ft],I,w,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+ft,0);g(w)&&p(r.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(At){for(let ft=0,yt=nt.length;ft<yt;ft++){const Kt=nt[ft],rt=n.get(Kt);e.bindTexture(r.TEXTURE_2D,rt.__webglTexture),bt(r.TEXTURE_2D,Kt),mt(V.__webglFramebuffer,I,Kt,r.COLOR_ATTACHMENT0+ft,r.TEXTURE_2D,0),g(Kt)&&p(r.TEXTURE_2D)}e.unbindTexture()}else{let ft=r.TEXTURE_2D;if((I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(ft=I.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),e.bindTexture(ft,$.__webglTexture),bt(ft,w),w.mipmaps&&w.mipmaps.length>0)for(let yt=0;yt<w.mipmaps.length;yt++)mt(V.__webglFramebuffer[yt],I,w,r.COLOR_ATTACHMENT0,ft,yt);else mt(V.__webglFramebuffer,I,w,r.COLOR_ATTACHMENT0,ft,0);g(w)&&p(ft),e.unbindTexture()}I.depthBuffer&&Bt(I)}function et(I){const w=I.textures;for(let V=0,$=w.length;V<$;V++){const nt=w[V];if(g(nt)){const Z=_(I),At=n.get(nt).__webglTexture;e.bindTexture(Z,At),p(Z),e.unbindTexture()}}}const at=[],L=[];function It(I){if(I.samples>0){if(Mt(I)===!1){const w=I.textures,V=I.width,$=I.height;let nt=r.COLOR_BUFFER_BIT;const Z=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,At=n.get(I),ft=w.length>1;if(ft)for(let yt=0;yt<w.length;yt++)e.bindFramebuffer(r.FRAMEBUFFER,At.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+yt,r.RENDERBUFFER,null),e.bindFramebuffer(r.FRAMEBUFFER,At.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+yt,r.TEXTURE_2D,null,0);e.bindFramebuffer(r.READ_FRAMEBUFFER,At.__webglMultisampledFramebuffer),e.bindFramebuffer(r.DRAW_FRAMEBUFFER,At.__webglFramebuffer);for(let yt=0;yt<w.length;yt++){if(I.resolveDepthBuffer&&(I.depthBuffer&&(nt|=r.DEPTH_BUFFER_BIT),I.stencilBuffer&&I.resolveStencilBuffer&&(nt|=r.STENCIL_BUFFER_BIT)),ft){r.framebufferRenderbuffer(r.READ_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.RENDERBUFFER,At.__webglColorRenderbuffer[yt]);const Kt=n.get(w[yt]).__webglTexture;r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,Kt,0)}r.blitFramebuffer(0,0,V,$,0,0,V,$,nt,r.NEAREST),l===!0&&(at.length=0,L.length=0,at.push(r.COLOR_ATTACHMENT0+yt),I.depthBuffer&&I.resolveDepthBuffer===!1&&(at.push(Z),L.push(Z),r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,L)),r.invalidateFramebuffer(r.READ_FRAMEBUFFER,at))}if(e.bindFramebuffer(r.READ_FRAMEBUFFER,null),e.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),ft)for(let yt=0;yt<w.length;yt++){e.bindFramebuffer(r.FRAMEBUFFER,At.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+yt,r.RENDERBUFFER,At.__webglColorRenderbuffer[yt]);const Kt=n.get(w[yt]).__webglTexture;e.bindFramebuffer(r.FRAMEBUFFER,At.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+yt,r.TEXTURE_2D,Kt,0)}e.bindFramebuffer(r.DRAW_FRAMEBUFFER,At.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.resolveDepthBuffer===!1&&l){const w=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,[w])}}}function st(I){return Math.min(i.maxSamples,I.samples)}function Mt(I){const w=n.get(I);return I.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&w.__useRenderToTexture!==!1}function ut(I){const w=a.render.frame;h.get(I)!==w&&(h.set(I,w),I.update())}function Ot(I,w){const V=I.colorSpace,$=I.format,nt=I.type;return I.isCompressedTexture===!0||I.isVideoTexture===!0||V!==ls&&V!==Un&&(Jt.getTransfer(V)===ae?($!==Xe||nt!==zn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",V)),w}function _t(I){return typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement?(c.width=I.naturalWidth||I.width,c.height=I.naturalHeight||I.height):typeof VideoFrame<"u"&&I instanceof VideoFrame?(c.width=I.displayWidth,c.height=I.displayHeight):(c.width=I.width,c.height=I.height),c}this.allocateTextureUnit=D,this.resetTextureUnits=N,this.setTexture2D=H,this.setTexture2DArray=k,this.setTexture3D=G,this.setTextureCube=O,this.rebindTextures=Nt,this.setupRenderTarget=Zt,this.updateRenderTargetMipmap=et,this.updateMultisampleRenderTarget=It,this.setupDepthRenderbuffer=Bt,this.setupFrameBufferTexture=mt,this.useMultisampledRTT=Mt}function Af(r,t){function e(n,i=Un){let s;const a=Jt.getTransfer(i);if(n===zn)return r.UNSIGNED_BYTE;if(n===Yo)return r.UNSIGNED_SHORT_4_4_4_4;if(n===$o)return r.UNSIGNED_SHORT_5_5_5_1;if(n===Bc)return r.UNSIGNED_INT_5_9_9_9_REV;if(n===Oc)return r.BYTE;if(n===Fc)return r.SHORT;if(n===Vs)return r.UNSIGNED_SHORT;if(n===qo)return r.INT;if(n===oi)return r.UNSIGNED_INT;if(n===tn)return r.FLOAT;if(n===qs)return r.HALF_FLOAT;if(n===zc)return r.ALPHA;if(n===kc)return r.RGB;if(n===Xe)return r.RGBA;if(n===Hc)return r.LUMINANCE;if(n===Vc)return r.LUMINANCE_ALPHA;if(n===ts)return r.DEPTH_COMPONENT;if(n===rs)return r.DEPTH_STENCIL;if(n===Zo)return r.RED;if(n===Vr)return r.RED_INTEGER;if(n===Gc)return r.RG;if(n===Ko)return r.RG_INTEGER;if(n===Jo)return r.RGBA_INTEGER;if(n===pr||n===mr||n===gr||n===xr)if(a===ae)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===pr)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===mr)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===gr)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===xr)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===pr)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===mr)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===gr)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===xr)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===lo||n===co||n===ho||n===uo)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===lo)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===co)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===ho)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===uo)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===fo||n===po||n===mo)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(n===fo||n===po)return a===ae?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===mo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===go||n===xo||n===vo||n===_o||n===yo||n===bo||n===Mo||n===So||n===wo||n===To||n===Ao||n===Eo||n===Co||n===Ro)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(n===go)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===xo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===vo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===_o)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===yo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===bo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Mo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===So)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===wo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===To)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Ao)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Eo)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Co)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Ro)return a===ae?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===vr||n===Io||n===Po)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(n===vr)return a===ae?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Io)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Po)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Wc||n===Lo||n===Do||n===Uo)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(n===vr)return s.COMPRESSED_RED_RGTC1_EXT;if(n===Lo)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Do)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Uo)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===ss?r.UNSIGNED_INT_24_8:r[n]!==void 0?r[n]:null}return{convert:e}}class Ef extends Pe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Qn extends ee{constructor(){super(),this.isGroup=!0,this.type="Group"}}const B_={type:"move"};class Zl{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Qn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Qn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Qn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,s=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const x of t.hand.values()){const g=e.getJointPose(x,n),p=this._getHandJoint(c,x);g!==null&&(p.matrix.fromArray(g.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=g.radius),p.visible=g!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,m=.005;c.inputState.pinching&&d>f+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=f-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(s=e.getPose(t.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&s!==null&&(i=s),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(B_)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new Qn;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const z_=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,k_=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class H_{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const i=new ye,s=t.properties.get(i);s.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new Ye({vertexShader:z_,fragmentShader:k_,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new ue(new Hn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class V_ extends kn{constructor(t,e){super();const n=this;let i=null,s=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,m=null;const x=new H_,g=e.getContextAttributes();let p=null,_=null;const v=[],y=[],P=new tt;let S=null;const T=new Pe;T.viewport=new te;const E=new Pe;E.viewport=new te;const M=[T,E],b=new Ef;let C=null,N=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let it=v[Y];return it===void 0&&(it=new Zl,v[Y]=it),it.getTargetRaySpace()},this.getControllerGrip=function(Y){let it=v[Y];return it===void 0&&(it=new Zl,v[Y]=it),it.getGripSpace()},this.getHand=function(Y){let it=v[Y];return it===void 0&&(it=new Zl,v[Y]=it),it.getHandSpace()};function D(Y){const it=y.indexOf(Y.inputSource);if(it===-1)return;const mt=v[it];mt!==void 0&&(mt.update(Y.inputSource,Y.frame,c||a),mt.dispatchEvent({type:Y.type,data:Y.inputSource}))}function U(){i.removeEventListener("select",D),i.removeEventListener("selectstart",D),i.removeEventListener("selectend",D),i.removeEventListener("squeeze",D),i.removeEventListener("squeezestart",D),i.removeEventListener("squeezeend",D),i.removeEventListener("end",U),i.removeEventListener("inputsourceschange",H);for(let Y=0;Y<v.length;Y++){const it=y[Y];it!==null&&(y[Y]=null,v[Y].disconnect(it))}C=null,N=null,x.reset(),t.setRenderTarget(p),f=null,d=null,u=null,i=null,_=null,Dt.stop(),n.isPresenting=!1,t.setPixelRatio(S),t.setSize(P.width,P.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){s=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u},this.getFrame=function(){return m},this.getSession=function(){return i},this.setSession=async function(Y){if(i=Y,i!==null){if(p=t.getRenderTarget(),i.addEventListener("select",D),i.addEventListener("selectstart",D),i.addEventListener("selectend",D),i.addEventListener("squeeze",D),i.addEventListener("squeezestart",D),i.addEventListener("squeezeend",D),i.addEventListener("end",U),i.addEventListener("inputsourceschange",H),g.xrCompatible!==!0&&await e.makeXRCompatible(),S=t.getPixelRatio(),t.getSize(P),i.renderState.layers===void 0){const it={antialias:g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:s};f=new XRWebGLLayer(i,e,it),i.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),_=new _n(f.framebufferWidth,f.framebufferHeight,{format:Xe,type:zn,colorSpace:t.outputColorSpace,stencilBuffer:g.stencil})}else{let it=null,mt=null,lt=null;g.depth&&(lt=g.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,it=g.stencil?rs:ts,mt=g.stencil?ss:oi);const Lt={colorFormat:e.RGBA8,depthFormat:lt,scaleFactor:s};u=new XRWebGLBinding(i,e),d=u.createProjectionLayer(Lt),i.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),_=new _n(d.textureWidth,d.textureHeight,{format:Xe,type:zn,depthTexture:new jc(d.textureWidth,d.textureHeight,mt,void 0,void 0,void 0,void 0,void 0,void 0,it),stencilBuffer:g.stencil,colorSpace:t.outputColorSpace,samples:g.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),Dt.setContext(i),Dt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return x.getDepthTexture()};function H(Y){for(let it=0;it<Y.removed.length;it++){const mt=Y.removed[it],lt=y.indexOf(mt);lt>=0&&(y[lt]=null,v[lt].disconnect(mt))}for(let it=0;it<Y.added.length;it++){const mt=Y.added[it];let lt=y.indexOf(mt);if(lt===-1){for(let Bt=0;Bt<v.length;Bt++)if(Bt>=y.length){y.push(mt),lt=Bt;break}else if(y[Bt]===null){y[Bt]=mt,lt=Bt;break}if(lt===-1)break}const Lt=v[lt];Lt&&Lt.connect(mt)}}const k=new R,G=new R;function O(Y,it,mt){k.setFromMatrixPosition(it.matrixWorld),G.setFromMatrixPosition(mt.matrixWorld);const lt=k.distanceTo(G),Lt=it.projectionMatrix.elements,Bt=mt.projectionMatrix.elements,Nt=Lt[14]/(Lt[10]-1),Zt=Lt[14]/(Lt[10]+1),et=(Lt[9]+1)/Lt[5],at=(Lt[9]-1)/Lt[5],L=(Lt[8]-1)/Lt[0],It=(Bt[8]+1)/Bt[0],st=Nt*L,Mt=Nt*It,ut=lt/(-L+It),Ot=ut*-L;if(it.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Ot),Y.translateZ(ut),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),Lt[10]===-1)Y.projectionMatrix.copy(it.projectionMatrix),Y.projectionMatrixInverse.copy(it.projectionMatrixInverse);else{const _t=Nt+ut,I=Zt+ut,w=st-Ot,V=Mt+(lt-Ot),$=et*Zt/I*_t,nt=at*Zt/I*_t;Y.projectionMatrix.makePerspective(w,V,$,nt,_t,I),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function J(Y,it){it===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(it.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(i===null)return;let it=Y.near,mt=Y.far;x.texture!==null&&(x.depthNear>0&&(it=x.depthNear),x.depthFar>0&&(mt=x.depthFar)),b.near=E.near=T.near=it,b.far=E.far=T.far=mt,(C!==b.near||N!==b.far)&&(i.updateRenderState({depthNear:b.near,depthFar:b.far}),C=b.near,N=b.far),T.layers.mask=Y.layers.mask|2,E.layers.mask=Y.layers.mask|4,b.layers.mask=T.layers.mask|E.layers.mask;const lt=Y.parent,Lt=b.cameras;J(b,lt);for(let Bt=0;Bt<Lt.length;Bt++)J(Lt[Bt],lt);Lt.length===2?O(b,T,E):b.projectionMatrix.copy(T.projectionMatrix),K(Y,b,lt)};function K(Y,it,mt){mt===null?Y.matrix.copy(it.matrixWorld):(Y.matrix.copy(mt.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(it.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(it.projectionMatrix),Y.projectionMatrixInverse.copy(it.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Gs*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return b},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Y)},this.hasDepthSensing=function(){return x.texture!==null},this.getDepthSensingMesh=function(){return x.getMesh(b)};let ot=null;function bt(Y,it){if(h=it.getViewerPose(c||a),m=it,h!==null){const mt=h.views;f!==null&&(t.setRenderTargetFramebuffer(_,f.framebuffer),t.setRenderTarget(_));let lt=!1;mt.length!==b.cameras.length&&(b.cameras.length=0,lt=!0);for(let Bt=0;Bt<mt.length;Bt++){const Nt=mt[Bt];let Zt=null;if(f!==null)Zt=f.getViewport(Nt);else{const at=u.getViewSubImage(d,Nt);Zt=at.viewport,Bt===0&&(t.setRenderTargetTextures(_,at.colorTexture,d.ignoreDepthValues?void 0:at.depthStencilTexture),t.setRenderTarget(_))}let et=M[Bt];et===void 0&&(et=new Pe,et.layers.enable(Bt),et.viewport=new te,M[Bt]=et),et.matrix.fromArray(Nt.transform.matrix),et.matrix.decompose(et.position,et.quaternion,et.scale),et.projectionMatrix.fromArray(Nt.projectionMatrix),et.projectionMatrixInverse.copy(et.projectionMatrix).invert(),et.viewport.set(Zt.x,Zt.y,Zt.width,Zt.height),Bt===0&&(b.matrix.copy(et.matrix),b.matrix.decompose(b.position,b.quaternion,b.scale)),lt===!0&&b.cameras.push(et)}const Lt=i.enabledFeatures;if(Lt&&Lt.includes("depth-sensing")){const Bt=u.getDepthInformation(mt[0]);Bt&&Bt.isValid&&Bt.texture&&x.init(t,Bt,i.renderState)}}for(let mt=0;mt<v.length;mt++){const lt=y[mt],Lt=v[mt];lt!==null&&Lt!==void 0&&Lt.update(lt,it,c||a)}ot&&ot(Y,it),it.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:it}),m=null}const Dt=new bf;Dt.setAnimationLoop(bt),this.setAnimationLoop=function(Y){ot=Y},this.dispose=function(){}}}const Ni=new ze,G_=new Ut;function W_(r,t){function e(g,p){g.matrixAutoUpdate===!0&&g.updateMatrix(),p.value.copy(g.matrix)}function n(g,p){p.color.getRGB(g.fogColor.value,xf(r)),p.isFog?(g.fogNear.value=p.near,g.fogFar.value=p.far):p.isFogExp2&&(g.fogDensity.value=p.density)}function i(g,p,_,v,y){p.isMeshBasicMaterial||p.isMeshLambertMaterial?s(g,p):p.isMeshToonMaterial?(s(g,p),u(g,p)):p.isMeshPhongMaterial?(s(g,p),h(g,p)):p.isMeshStandardMaterial?(s(g,p),d(g,p),p.isMeshPhysicalMaterial&&f(g,p,y)):p.isMeshMatcapMaterial?(s(g,p),m(g,p)):p.isMeshDepthMaterial?s(g,p):p.isMeshDistanceMaterial?(s(g,p),x(g,p)):p.isMeshNormalMaterial?s(g,p):p.isLineBasicMaterial?(a(g,p),p.isLineDashedMaterial&&o(g,p)):p.isPointsMaterial?l(g,p,_,v):p.isSpriteMaterial?c(g,p):p.isShadowMaterial?(g.color.value.copy(p.color),g.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(g,p){g.opacity.value=p.opacity,p.color&&g.diffuse.value.copy(p.color),p.emissive&&g.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(g.map.value=p.map,e(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,e(p.alphaMap,g.alphaMapTransform)),p.bumpMap&&(g.bumpMap.value=p.bumpMap,e(p.bumpMap,g.bumpMapTransform),g.bumpScale.value=p.bumpScale,p.side===Le&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,e(p.normalMap,g.normalMapTransform),g.normalScale.value.copy(p.normalScale),p.side===Le&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,e(p.displacementMap,g.displacementMapTransform),g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,g.emissiveMapTransform)),p.specularMap&&(g.specularMap.value=p.specularMap,e(p.specularMap,g.specularMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest);const _=t.get(p),v=_.envMap,y=_.envMapRotation;v&&(g.envMap.value=v,Ni.copy(y),Ni.x*=-1,Ni.y*=-1,Ni.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(Ni.y*=-1,Ni.z*=-1),g.envMapRotation.value.setFromMatrix4(G_.makeRotationFromEuler(Ni)),g.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,g.reflectivity.value=p.reflectivity,g.ior.value=p.ior,g.refractionRatio.value=p.refractionRatio),p.lightMap&&(g.lightMap.value=p.lightMap,g.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,g.lightMapTransform)),p.aoMap&&(g.aoMap.value=p.aoMap,g.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,g.aoMapTransform))}function a(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,p.map&&(g.map.value=p.map,e(p.map,g.mapTransform))}function o(g,p){g.dashSize.value=p.dashSize,g.totalSize.value=p.dashSize+p.gapSize,g.scale.value=p.scale}function l(g,p,_,v){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.size.value=p.size*_,g.scale.value=v*.5,p.map&&(g.map.value=p.map,e(p.map,g.uvTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,e(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function c(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.rotation.value=p.rotation,p.map&&(g.map.value=p.map,e(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,e(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function h(g,p){g.specular.value.copy(p.specular),g.shininess.value=Math.max(p.shininess,1e-4)}function u(g,p){p.gradientMap&&(g.gradientMap.value=p.gradientMap)}function d(g,p){g.metalness.value=p.metalness,p.metalnessMap&&(g.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,g.metalnessMapTransform)),g.roughness.value=p.roughness,p.roughnessMap&&(g.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,g.roughnessMapTransform)),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)}function f(g,p,_){g.ior.value=p.ior,p.sheen>0&&(g.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),g.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(g.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,g.sheenColorMapTransform)),p.sheenRoughnessMap&&(g.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,g.sheenRoughnessMapTransform))),p.clearcoat>0&&(g.clearcoat.value=p.clearcoat,g.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(g.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,g.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(g.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Le&&g.clearcoatNormalScale.value.negate())),p.dispersion>0&&(g.dispersion.value=p.dispersion),p.iridescence>0&&(g.iridescence.value=p.iridescence,g.iridescenceIOR.value=p.iridescenceIOR,g.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(g.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,g.iridescenceMapTransform)),p.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),p.transmission>0&&(g.transmission.value=p.transmission,g.transmissionSamplerMap.value=_.texture,g.transmissionSamplerSize.value.set(_.width,_.height),p.transmissionMap&&(g.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,g.transmissionMapTransform)),g.thickness.value=p.thickness,p.thicknessMap&&(g.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=p.attenuationDistance,g.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(g.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(g.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=p.specularIntensity,g.specularColor.value.copy(p.specularColor),p.specularColorMap&&(g.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,g.specularColorMapTransform)),p.specularIntensityMap&&(g.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,g.specularIntensityMapTransform))}function m(g,p){p.matcap&&(g.matcap.value=p.matcap)}function x(g,p){const _=t.get(p).light;g.referencePosition.value.setFromMatrixPosition(_.matrixWorld),g.nearDistance.value=_.shadow.camera.near,g.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function X_(r,t,e,n){let i={},s={},a=[];const o=r.getParameter(r.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,v){const y=v.program;n.uniformBlockBinding(_,y)}function c(_,v){let y=i[_.id];y===void 0&&(m(_),y=h(_),i[_.id]=y,_.addEventListener("dispose",g));const P=v.program;n.updateUBOMapping(_,P);const S=t.render.frame;s[_.id]!==S&&(d(_),s[_.id]=S)}function h(_){const v=u();_.__bindingPointIndex=v;const y=r.createBuffer(),P=_.__size,S=_.usage;return r.bindBuffer(r.UNIFORM_BUFFER,y),r.bufferData(r.UNIFORM_BUFFER,P,S),r.bindBuffer(r.UNIFORM_BUFFER,null),r.bindBufferBase(r.UNIFORM_BUFFER,v,y),y}function u(){for(let _=0;_<o;_++)if(a.indexOf(_)===-1)return a.push(_),_;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(_){const v=i[_.id],y=_.uniforms,P=_.__cache;r.bindBuffer(r.UNIFORM_BUFFER,v);for(let S=0,T=y.length;S<T;S++){const E=Array.isArray(y[S])?y[S]:[y[S]];for(let M=0,b=E.length;M<b;M++){const C=E[M];if(f(C,S,M,P)===!0){const N=C.__offset,D=Array.isArray(C.value)?C.value:[C.value];let U=0;for(let H=0;H<D.length;H++){const k=D[H],G=x(k);typeof k=="number"||typeof k=="boolean"?(C.__data[0]=k,r.bufferSubData(r.UNIFORM_BUFFER,N+U,C.__data)):k.isMatrix3?(C.__data[0]=k.elements[0],C.__data[1]=k.elements[1],C.__data[2]=k.elements[2],C.__data[3]=0,C.__data[4]=k.elements[3],C.__data[5]=k.elements[4],C.__data[6]=k.elements[5],C.__data[7]=0,C.__data[8]=k.elements[6],C.__data[9]=k.elements[7],C.__data[10]=k.elements[8],C.__data[11]=0):(k.toArray(C.__data,U),U+=G.storage/Float32Array.BYTES_PER_ELEMENT)}r.bufferSubData(r.UNIFORM_BUFFER,N,C.__data)}}}r.bindBuffer(r.UNIFORM_BUFFER,null)}function f(_,v,y,P){const S=_.value,T=v+"_"+y;if(P[T]===void 0)return typeof S=="number"||typeof S=="boolean"?P[T]=S:P[T]=S.clone(),!0;{const E=P[T];if(typeof S=="number"||typeof S=="boolean"){if(E!==S)return P[T]=S,!0}else if(E.equals(S)===!1)return E.copy(S),!0}return!1}function m(_){const v=_.uniforms;let y=0;const P=16;for(let T=0,E=v.length;T<E;T++){const M=Array.isArray(v[T])?v[T]:[v[T]];for(let b=0,C=M.length;b<C;b++){const N=M[b],D=Array.isArray(N.value)?N.value:[N.value];for(let U=0,H=D.length;U<H;U++){const k=D[U],G=x(k),O=y%P,J=O%G.boundary,K=O+J;y+=J,K!==0&&P-K<G.storage&&(y+=P-K),N.__data=new Float32Array(G.storage/Float32Array.BYTES_PER_ELEMENT),N.__offset=y,y+=G.storage}}}const S=y%P;return S>0&&(y+=P-S),_.__size=y,_.__cache={},this}function x(_){const v={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(v.boundary=4,v.storage=4):_.isVector2?(v.boundary=8,v.storage=8):_.isVector3||_.isColor?(v.boundary=16,v.storage=12):_.isVector4?(v.boundary=16,v.storage=16):_.isMatrix3?(v.boundary=48,v.storage=48):_.isMatrix4?(v.boundary=64,v.storage=64):_.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",_),v}function g(_){const v=_.target;v.removeEventListener("dispose",g);const y=a.indexOf(v.__bindingPointIndex);a.splice(y,1),r.deleteBuffer(i[v.id]),delete i[v.id],delete s[v.id]}function p(){for(const _ in i)r.deleteBuffer(i[_]);a=[],i={},s={}}return{bind:l,update:c,dispose:p}}class Cf{constructor(t={}){const{canvas:e=ff(),context:n=null,depth:i=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let f;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=n.getContextAttributes().alpha}else f=a;const m=new Uint32Array(4),x=new Int32Array(4);let g=null,p=null;const _=[],v=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=me,this.toneMapping=ii,this.toneMappingExposure=1;const y=this;let P=!1,S=0,T=0,E=null,M=-1,b=null;const C=new te,N=new te;let D=null;const U=new ht(0);let H=0,k=e.width,G=e.height,O=1,J=null,K=null;const ot=new te(0,0,k,G),bt=new te(0,0,k,G);let Dt=!1;const Y=new Xr;let it=!1,mt=!1;const lt=new Ut,Lt=new Ut,Bt=new R,Nt=new te,Zt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let et=!1;function at(){return E===null?O:1}let L=n;function It(A,B){return e.getContext(A,B)}try{const A={alpha:!0,depth:i,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Go}`),e.addEventListener("webglcontextlost",Q,!1),e.addEventListener("webglcontextrestored",vt,!1),e.addEventListener("webglcontextcreationerror",gt,!1),L===null){const B="webgl2";if(L=It(B,A),L===null)throw It(B)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(A){throw console.error("THREE.WebGLRenderer: "+A.message),A}let st,Mt,ut,Ot,_t,I,w,V,$,nt,Z,At,ft,yt,Kt,rt,St,Ft,zt,wt,jt,Yt,ce,F;function pt(){st=new Jx(L),st.init(),Yt=new Af(L,st),Mt=new Xx(L,st,t,Yt),ut=new P_(L,st),Mt.reverseDepthBuffer&&d&&ut.buffers.depth.setReversed(!0),Ot=new tv(L),_t=new v_,I=new F_(L,st,ut,_t,Mt,Yt,Ot),w=new Yx(y),V=new Kx(y),$=new o0(L),ce=new Gx(L,$),nt=new jx(L,$,Ot,ce),Z=new nv(L,nt,$,Ot),zt=new ev(L,Mt,I),rt=new qx(_t),At=new x_(y,w,V,st,Mt,ce,rt),ft=new W_(y,_t),yt=new y_,Kt=new A_(st),Ft=new Vx(y,w,V,ut,Z,f,l),St=new R_(y,Z,Mt),F=new X_(L,Ot,Mt,ut),wt=new Wx(L,st,Ot),jt=new Qx(L,st,Ot),Ot.programs=At.programs,y.capabilities=Mt,y.extensions=st,y.properties=_t,y.renderLists=yt,y.shadowMap=St,y.state=ut,y.info=Ot}pt();const q=new V_(y,L);this.xr=q,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){const A=st.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){const A=st.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return O},this.setPixelRatio=function(A){A!==void 0&&(O=A,this.setSize(k,G,!1))},this.getSize=function(A){return A.set(k,G)},this.setSize=function(A,B,W=!0){if(q.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}k=A,G=B,e.width=Math.floor(A*O),e.height=Math.floor(B*O),W===!0&&(e.style.width=A+"px",e.style.height=B+"px"),this.setViewport(0,0,A,B)},this.getDrawingBufferSize=function(A){return A.set(k*O,G*O).floor()},this.setDrawingBufferSize=function(A,B,W){k=A,G=B,O=W,e.width=Math.floor(A*W),e.height=Math.floor(B*W),this.setViewport(0,0,A,B)},this.getCurrentViewport=function(A){return A.copy(C)},this.getViewport=function(A){return A.copy(ot)},this.setViewport=function(A,B,W,X){A.isVector4?ot.set(A.x,A.y,A.z,A.w):ot.set(A,B,W,X),ut.viewport(C.copy(ot).multiplyScalar(O).round())},this.getScissor=function(A){return A.copy(bt)},this.setScissor=function(A,B,W,X){A.isVector4?bt.set(A.x,A.y,A.z,A.w):bt.set(A,B,W,X),ut.scissor(N.copy(bt).multiplyScalar(O).round())},this.getScissorTest=function(){return Dt},this.setScissorTest=function(A){ut.setScissorTest(Dt=A)},this.setOpaqueSort=function(A){J=A},this.setTransparentSort=function(A){K=A},this.getClearColor=function(A){return A.copy(Ft.getClearColor())},this.setClearColor=function(){Ft.setClearColor.apply(Ft,arguments)},this.getClearAlpha=function(){return Ft.getClearAlpha()},this.setClearAlpha=function(){Ft.setClearAlpha.apply(Ft,arguments)},this.clear=function(A=!0,B=!0,W=!0){let X=0;if(A){let z=!1;if(E!==null){const ct=E.texture.format;z=ct===Jo||ct===Ko||ct===Vr}if(z){const ct=E.texture.type,xt=ct===zn||ct===oi||ct===Vs||ct===ss||ct===Yo||ct===$o,Et=Ft.getClearColor(),Ct=Ft.getClearAlpha(),kt=Et.r,Xt=Et.g,Rt=Et.b;xt?(m[0]=kt,m[1]=Xt,m[2]=Rt,m[3]=Ct,L.clearBufferuiv(L.COLOR,0,m)):(x[0]=kt,x[1]=Xt,x[2]=Rt,x[3]=Ct,L.clearBufferiv(L.COLOR,0,x))}else X|=L.COLOR_BUFFER_BIT}B&&(X|=L.DEPTH_BUFFER_BIT),W&&(X|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),L.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",Q,!1),e.removeEventListener("webglcontextrestored",vt,!1),e.removeEventListener("webglcontextcreationerror",gt,!1),yt.dispose(),Kt.dispose(),_t.dispose(),w.dispose(),V.dispose(),Z.dispose(),ce.dispose(),F.dispose(),At.dispose(),q.dispose(),q.removeEventListener("sessionstart",Eh),q.removeEventListener("sessionend",Ch),Ri.stop()};function Q(A){A.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),P=!0}function vt(){console.log("THREE.WebGLRenderer: Context Restored."),P=!1;const A=Ot.autoReset,B=St.enabled,W=St.autoUpdate,X=St.needsUpdate,z=St.type;pt(),Ot.autoReset=A,St.enabled=B,St.autoUpdate=W,St.needsUpdate=X,St.type=z}function gt(A){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function Wt(A){const B=A.target;B.removeEventListener("dispose",Wt),xe(B)}function xe(A){Ue(A),_t.remove(A)}function Ue(A){const B=_t.get(A).programs;B!==void 0&&(B.forEach(function(W){At.releaseProgram(W)}),A.isShaderMaterial&&At.releaseShaderCache(A))}this.renderBufferDirect=function(A,B,W,X,z,ct){B===null&&(B=Zt);const xt=z.isMesh&&z.matrixWorld.determinant()<0,Et=Rp(A,B,W,X,z);ut.setMaterial(X,xt);let Ct=W.index,kt=1;if(X.wireframe===!0){if(Ct=nt.getWireframeAttribute(W),Ct===void 0)return;kt=2}const Xt=W.drawRange,Rt=W.attributes.position;let ne=Xt.start*kt,he=(Xt.start+Xt.count)*kt;ct!==null&&(ne=Math.max(ne,ct.start*kt),he=Math.min(he,(ct.start+ct.count)*kt)),Ct!==null?(ne=Math.max(ne,0),he=Math.min(he,Ct.count)):Rt!=null&&(ne=Math.max(ne,0),he=Math.min(he,Rt.count));const de=he-ne;if(de<0||de===1/0)return;ce.setup(z,X,Et,W,Ct);let Ze,ie=wt;if(Ct!==null&&(Ze=$.get(Ct),ie=jt,ie.setIndex(Ze)),z.isMesh)X.wireframe===!0?(ut.setLineWidth(X.wireframeLinewidth*at()),ie.setMode(L.LINES)):ie.setMode(L.TRIANGLES);else if(z.isLine){let Pt=X.linewidth;Pt===void 0&&(Pt=1),ut.setLineWidth(Pt*at()),z.isLineSegments?ie.setMode(L.LINES):z.isLineLoop?ie.setMode(L.LINE_LOOP):ie.setMode(L.LINE_STRIP)}else z.isPoints?ie.setMode(L.POINTS):z.isSprite&&ie.setMode(L.TRIANGLES);if(z.isBatchedMesh)if(z._multiDrawInstances!==null)ie.renderMultiDrawInstances(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount,z._multiDrawInstances);else if(st.get("WEBGL_multi_draw"))ie.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const Pt=z._multiDrawStarts,Wn=z._multiDrawCounts,se=z._multiDrawCount,Mn=Ct?$.get(Ct).bytesPerElement:1,fs=_t.get(X).currentProgram.getUniforms();for(let nn=0;nn<se;nn++)fs.setValue(L,"_gl_DrawID",nn),ie.render(Pt[nn]/Mn,Wn[nn])}else if(z.isInstancedMesh)ie.renderInstances(ne,de,z.count);else if(W.isInstancedBufferGeometry){const Pt=W._maxInstanceCount!==void 0?W._maxInstanceCount:1/0,Wn=Math.min(W.instanceCount,Pt);ie.renderInstances(ne,de,Wn)}else ie.render(ne,de)};function re(A,B,W){A.transparent===!0&&A.side===Dn&&A.forceSinglePass===!1?(A.side=Le,A.needsUpdate=!0,ta(A,B,W),A.side=ri,A.needsUpdate=!0,ta(A,B,W),A.side=Dn):ta(A,B,W)}this.compile=function(A,B,W=null){W===null&&(W=A),p=Kt.get(W),p.init(B),v.push(p),W.traverseVisible(function(z){z.isLight&&z.layers.test(B.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),A!==W&&A.traverseVisible(function(z){z.isLight&&z.layers.test(B.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),p.setupLights();const X=new Set;return A.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const ct=z.material;if(ct)if(Array.isArray(ct))for(let xt=0;xt<ct.length;xt++){const Et=ct[xt];re(Et,W,z),X.add(Et)}else re(ct,W,z),X.add(ct)}),v.pop(),p=null,X},this.compileAsync=function(A,B,W=null){const X=this.compile(A,B,W);return new Promise(z=>{function ct(){if(X.forEach(function(xt){_t.get(xt).currentProgram.isReady()&&X.delete(xt)}),X.size===0){z(A);return}setTimeout(ct,10)}st.get("KHR_parallel_shader_compile")!==null?ct():setTimeout(ct,10)})};let bn=null;function Gn(A){bn&&bn(A)}function Eh(){Ri.stop()}function Ch(){Ri.start()}const Ri=new bf;Ri.setAnimationLoop(Gn),typeof self<"u"&&Ri.setContext(self),this.setAnimationLoop=function(A){bn=A,q.setAnimationLoop(A),A===null?Ri.stop():Ri.start()},q.addEventListener("sessionstart",Eh),q.addEventListener("sessionend",Ch),this.render=function(A,B){if(B!==void 0&&B.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;if(A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),B.parent===null&&B.matrixWorldAutoUpdate===!0&&B.updateMatrixWorld(),q.enabled===!0&&q.isPresenting===!0&&(q.cameraAutoUpdate===!0&&q.updateCamera(B),B=q.getCamera()),A.isScene===!0&&A.onBeforeRender(y,A,B,E),p=Kt.get(A,v.length),p.init(B),v.push(p),Lt.multiplyMatrices(B.projectionMatrix,B.matrixWorldInverse),Y.setFromProjectionMatrix(Lt),mt=this.localClippingEnabled,it=rt.init(this.clippingPlanes,mt),g=yt.get(A,_.length),g.init(),_.push(g),q.enabled===!0&&q.isPresenting===!0){const ct=y.xr.getDepthSensingMesh();ct!==null&&Ml(ct,B,-1/0,y.sortObjects)}Ml(A,B,0,y.sortObjects),g.finish(),y.sortObjects===!0&&g.sort(J,K),et=q.enabled===!1||q.isPresenting===!1||q.hasDepthSensing()===!1,et&&Ft.addToRenderList(g,A),this.info.render.frame++,it===!0&&rt.beginShadows();const W=p.state.shadowsArray;St.render(W,A,B),it===!0&&rt.endShadows(),this.info.autoReset===!0&&this.info.reset();const X=g.opaque,z=g.transmissive;if(p.setupLights(),B.isArrayCamera){const ct=B.cameras;if(z.length>0)for(let xt=0,Et=ct.length;xt<Et;xt++){const Ct=ct[xt];Ih(X,z,A,Ct)}et&&Ft.render(A);for(let xt=0,Et=ct.length;xt<Et;xt++){const Ct=ct[xt];Rh(g,A,Ct,Ct.viewport)}}else z.length>0&&Ih(X,z,A,B),et&&Ft.render(A),Rh(g,A,B);E!==null&&(I.updateMultisampleRenderTarget(E),I.updateRenderTargetMipmap(E)),A.isScene===!0&&A.onAfterRender(y,A,B),ce.resetDefaultState(),M=-1,b=null,v.pop(),v.length>0?(p=v[v.length-1],it===!0&&rt.setGlobalState(y.clippingPlanes,p.state.camera)):p=null,_.pop(),_.length>0?g=_[_.length-1]:g=null};function Ml(A,B,W,X){if(A.visible===!1)return;if(A.layers.test(B.layers)){if(A.isGroup)W=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(B);else if(A.isLight)p.pushLight(A),A.castShadow&&p.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||Y.intersectsSprite(A)){X&&Nt.setFromMatrixPosition(A.matrixWorld).applyMatrix4(Lt);const xt=Z.update(A),Et=A.material;Et.visible&&g.push(A,xt,Et,W,Nt.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||Y.intersectsObject(A))){const xt=Z.update(A),Et=A.material;if(X&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),Nt.copy(A.boundingSphere.center)):(xt.boundingSphere===null&&xt.computeBoundingSphere(),Nt.copy(xt.boundingSphere.center)),Nt.applyMatrix4(A.matrixWorld).applyMatrix4(Lt)),Array.isArray(Et)){const Ct=xt.groups;for(let kt=0,Xt=Ct.length;kt<Xt;kt++){const Rt=Ct[kt],ne=Et[Rt.materialIndex];ne&&ne.visible&&g.push(A,xt,ne,W,Nt.z,Rt)}}else Et.visible&&g.push(A,xt,Et,W,Nt.z,null)}}const ct=A.children;for(let xt=0,Et=ct.length;xt<Et;xt++)Ml(ct[xt],B,W,X)}function Rh(A,B,W,X){const z=A.opaque,ct=A.transmissive,xt=A.transparent;p.setupLightsView(W),it===!0&&rt.setGlobalState(y.clippingPlanes,W),X&&ut.viewport(C.copy(X)),z.length>0&&Qr(z,B,W),ct.length>0&&Qr(ct,B,W),xt.length>0&&Qr(xt,B,W),ut.buffers.depth.setTest(!0),ut.buffers.depth.setMask(!0),ut.buffers.color.setMask(!0),ut.setPolygonOffset(!1)}function Ih(A,B,W,X){if((W.isScene===!0?W.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[X.id]===void 0&&(p.state.transmissionRenderTarget[X.id]=new _n(1,1,{generateMipmaps:!0,type:st.has("EXT_color_buffer_half_float")||st.has("EXT_color_buffer_float")?qs:zn,minFilter:vn,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Jt.workingColorSpace}));const ct=p.state.transmissionRenderTarget[X.id],xt=X.viewport||C;ct.setSize(xt.z,xt.w);const Et=y.getRenderTarget();y.setRenderTarget(ct),y.getClearColor(U),H=y.getClearAlpha(),H<1&&y.setClearColor(16777215,.5),y.clear(),et&&Ft.render(W);const Ct=y.toneMapping;y.toneMapping=ii;const kt=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),p.setupLightsView(X),it===!0&&rt.setGlobalState(y.clippingPlanes,X),Qr(A,W,X),I.updateMultisampleRenderTarget(ct),I.updateRenderTargetMipmap(ct),st.has("WEBGL_multisampled_render_to_texture")===!1){let Xt=!1;for(let Rt=0,ne=B.length;Rt<ne;Rt++){const he=B[Rt],de=he.object,Ze=he.geometry,ie=he.material,Pt=he.group;if(ie.side===Dn&&de.layers.test(X.layers)){const Wn=ie.side;ie.side=Le,ie.needsUpdate=!0,Ph(de,W,X,Ze,ie,Pt),ie.side=Wn,ie.needsUpdate=!0,Xt=!0}}Xt===!0&&(I.updateMultisampleRenderTarget(ct),I.updateRenderTargetMipmap(ct))}y.setRenderTarget(Et),y.setClearColor(U,H),kt!==void 0&&(X.viewport=kt),y.toneMapping=Ct}function Qr(A,B,W){const X=B.isScene===!0?B.overrideMaterial:null;for(let z=0,ct=A.length;z<ct;z++){const xt=A[z],Et=xt.object,Ct=xt.geometry,kt=X===null?xt.material:X,Xt=xt.group;Et.layers.test(W.layers)&&Ph(Et,B,W,Ct,kt,Xt)}}function Ph(A,B,W,X,z,ct){A.onBeforeRender(y,B,W,X,z,ct),A.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),z.onBeforeRender(y,B,W,X,A,ct),z.transparent===!0&&z.side===Dn&&z.forceSinglePass===!1?(z.side=Le,z.needsUpdate=!0,y.renderBufferDirect(W,B,X,z,A,ct),z.side=ri,z.needsUpdate=!0,y.renderBufferDirect(W,B,X,z,A,ct),z.side=Dn):y.renderBufferDirect(W,B,X,z,A,ct),A.onAfterRender(y,B,W,X,z,ct)}function ta(A,B,W){B.isScene!==!0&&(B=Zt);const X=_t.get(A),z=p.state.lights,ct=p.state.shadowsArray,xt=z.state.version,Et=At.getParameters(A,z.state,ct,B,W),Ct=At.getProgramCacheKey(Et);let kt=X.programs;X.environment=A.isMeshStandardMaterial?B.environment:null,X.fog=B.fog,X.envMap=(A.isMeshStandardMaterial?V:w).get(A.envMap||X.environment),X.envMapRotation=X.environment!==null&&A.envMap===null?B.environmentRotation:A.envMapRotation,kt===void 0&&(A.addEventListener("dispose",Wt),kt=new Map,X.programs=kt);let Xt=kt.get(Ct);if(Xt!==void 0){if(X.currentProgram===Xt&&X.lightsStateVersion===xt)return Dh(A,Et),Xt}else Et.uniforms=At.getUniforms(A),A.onBeforeCompile(Et,y),Xt=At.acquireProgram(Et,Ct),kt.set(Ct,Xt),X.uniforms=Et.uniforms;const Rt=X.uniforms;return(!A.isShaderMaterial&&!A.isRawShaderMaterial||A.clipping===!0)&&(Rt.clippingPlanes=rt.uniform),Dh(A,Et),X.needsLights=Pp(A),X.lightsStateVersion=xt,X.needsLights&&(Rt.ambientLightColor.value=z.state.ambient,Rt.lightProbe.value=z.state.probe,Rt.directionalLights.value=z.state.directional,Rt.directionalLightShadows.value=z.state.directionalShadow,Rt.spotLights.value=z.state.spot,Rt.spotLightShadows.value=z.state.spotShadow,Rt.rectAreaLights.value=z.state.rectArea,Rt.ltc_1.value=z.state.rectAreaLTC1,Rt.ltc_2.value=z.state.rectAreaLTC2,Rt.pointLights.value=z.state.point,Rt.pointLightShadows.value=z.state.pointShadow,Rt.hemisphereLights.value=z.state.hemi,Rt.directionalShadowMap.value=z.state.directionalShadowMap,Rt.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Rt.spotShadowMap.value=z.state.spotShadowMap,Rt.spotLightMatrix.value=z.state.spotLightMatrix,Rt.spotLightMap.value=z.state.spotLightMap,Rt.pointShadowMap.value=z.state.pointShadowMap,Rt.pointShadowMatrix.value=z.state.pointShadowMatrix),X.currentProgram=Xt,X.uniformsList=null,Xt}function Lh(A){if(A.uniformsList===null){const B=A.currentProgram.getUniforms();A.uniformsList=Ja.seqWithValue(B.seq,A.uniforms)}return A.uniformsList}function Dh(A,B){const W=_t.get(A);W.outputColorSpace=B.outputColorSpace,W.batching=B.batching,W.batchingColor=B.batchingColor,W.instancing=B.instancing,W.instancingColor=B.instancingColor,W.instancingMorph=B.instancingMorph,W.skinning=B.skinning,W.morphTargets=B.morphTargets,W.morphNormals=B.morphNormals,W.morphColors=B.morphColors,W.morphTargetsCount=B.morphTargetsCount,W.numClippingPlanes=B.numClippingPlanes,W.numIntersection=B.numClipIntersection,W.vertexAlphas=B.vertexAlphas,W.vertexTangents=B.vertexTangents,W.toneMapping=B.toneMapping}function Rp(A,B,W,X,z){B.isScene!==!0&&(B=Zt),I.resetTextureUnits();const ct=B.fog,xt=X.isMeshStandardMaterial?B.environment:null,Et=E===null?y.outputColorSpace:E.isXRRenderTarget===!0?E.texture.colorSpace:ls,Ct=(X.isMeshStandardMaterial?V:w).get(X.envMap||xt),kt=X.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,Xt=!!W.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),Rt=!!W.morphAttributes.position,ne=!!W.morphAttributes.normal,he=!!W.morphAttributes.color;let de=ii;X.toneMapped&&(E===null||E.isXRRenderTarget===!0)&&(de=y.toneMapping);const Ze=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,ie=Ze!==void 0?Ze.length:0,Pt=_t.get(X),Wn=p.state.lights;if(it===!0&&(mt===!0||A!==b)){const pn=A===b&&X.id===M;rt.setState(X,A,pn)}let se=!1;X.version===Pt.__version?(Pt.needsLights&&Pt.lightsStateVersion!==Wn.state.version||Pt.outputColorSpace!==Et||z.isBatchedMesh&&Pt.batching===!1||!z.isBatchedMesh&&Pt.batching===!0||z.isBatchedMesh&&Pt.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&Pt.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&Pt.instancing===!1||!z.isInstancedMesh&&Pt.instancing===!0||z.isSkinnedMesh&&Pt.skinning===!1||!z.isSkinnedMesh&&Pt.skinning===!0||z.isInstancedMesh&&Pt.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Pt.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Pt.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Pt.instancingMorph===!1&&z.morphTexture!==null||Pt.envMap!==Ct||X.fog===!0&&Pt.fog!==ct||Pt.numClippingPlanes!==void 0&&(Pt.numClippingPlanes!==rt.numPlanes||Pt.numIntersection!==rt.numIntersection)||Pt.vertexAlphas!==kt||Pt.vertexTangents!==Xt||Pt.morphTargets!==Rt||Pt.morphNormals!==ne||Pt.morphColors!==he||Pt.toneMapping!==de||Pt.morphTargetsCount!==ie)&&(se=!0):(se=!0,Pt.__version=X.version);let Mn=Pt.currentProgram;se===!0&&(Mn=ta(X,B,z));let fs=!1,nn=!1,Zs=!1;const fe=Mn.getUniforms(),Pn=Pt.uniforms;if(ut.useProgram(Mn.program)&&(fs=!0,nn=!0,Zs=!0),X.id!==M&&(M=X.id,nn=!0),fs||b!==A){ut.buffers.depth.getReversed()?(lt.copy(A.projectionMatrix),Lm(lt),Dm(lt),fe.setValue(L,"projectionMatrix",lt)):fe.setValue(L,"projectionMatrix",A.projectionMatrix),fe.setValue(L,"viewMatrix",A.matrixWorldInverse);const hi=fe.map.cameraPosition;hi!==void 0&&hi.setValue(L,Bt.setFromMatrixPosition(A.matrixWorld)),Mt.logarithmicDepthBuffer&&fe.setValue(L,"logDepthBufFC",2/(Math.log(A.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&fe.setValue(L,"isOrthographic",A.isOrthographicCamera===!0),b!==A&&(b=A,nn=!0,Zs=!0)}if(z.isSkinnedMesh){fe.setOptional(L,z,"bindMatrix"),fe.setOptional(L,z,"bindMatrixInverse");const pn=z.skeleton;pn&&(pn.boneTexture===null&&pn.computeBoneTexture(),fe.setValue(L,"boneTexture",pn.boneTexture,I))}z.isBatchedMesh&&(fe.setOptional(L,z,"batchingTexture"),fe.setValue(L,"batchingTexture",z._matricesTexture,I),fe.setOptional(L,z,"batchingIdTexture"),fe.setValue(L,"batchingIdTexture",z._indirectTexture,I),fe.setOptional(L,z,"batchingColorTexture"),z._colorsTexture!==null&&fe.setValue(L,"batchingColorTexture",z._colorsTexture,I));const Ks=W.morphAttributes;if((Ks.position!==void 0||Ks.normal!==void 0||Ks.color!==void 0)&&zt.update(z,W,Mn),(nn||Pt.receiveShadow!==z.receiveShadow)&&(Pt.receiveShadow=z.receiveShadow,fe.setValue(L,"receiveShadow",z.receiveShadow)),X.isMeshGouraudMaterial&&X.envMap!==null&&(Pn.envMap.value=Ct,Pn.flipEnvMap.value=Ct.isCubeTexture&&Ct.isRenderTargetTexture===!1?-1:1),X.isMeshStandardMaterial&&X.envMap===null&&B.environment!==null&&(Pn.envMapIntensity.value=B.environmentIntensity),nn&&(fe.setValue(L,"toneMappingExposure",y.toneMappingExposure),Pt.needsLights&&Ip(Pn,Zs),ct&&X.fog===!0&&ft.refreshFogUniforms(Pn,ct),ft.refreshMaterialUniforms(Pn,X,O,G,p.state.transmissionRenderTarget[A.id]),Ja.upload(L,Lh(Pt),Pn,I)),X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(Ja.upload(L,Lh(Pt),Pn,I),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&fe.setValue(L,"center",z.center),fe.setValue(L,"modelViewMatrix",z.modelViewMatrix),fe.setValue(L,"normalMatrix",z.normalMatrix),fe.setValue(L,"modelMatrix",z.matrixWorld),X.isShaderMaterial||X.isRawShaderMaterial){const pn=X.uniformsGroups;for(let hi=0,ui=pn.length;hi<ui;hi++){const Uh=pn[hi];F.update(Uh,Mn),F.bind(Uh,Mn)}}return Mn}function Ip(A,B){A.ambientLightColor.needsUpdate=B,A.lightProbe.needsUpdate=B,A.directionalLights.needsUpdate=B,A.directionalLightShadows.needsUpdate=B,A.pointLights.needsUpdate=B,A.pointLightShadows.needsUpdate=B,A.spotLights.needsUpdate=B,A.spotLightShadows.needsUpdate=B,A.rectAreaLights.needsUpdate=B,A.hemisphereLights.needsUpdate=B}function Pp(A){return A.isMeshLambertMaterial||A.isMeshToonMaterial||A.isMeshPhongMaterial||A.isMeshStandardMaterial||A.isShadowMaterial||A.isShaderMaterial&&A.lights===!0}this.getActiveCubeFace=function(){return S},this.getActiveMipmapLevel=function(){return T},this.getRenderTarget=function(){return E},this.setRenderTargetTextures=function(A,B,W){_t.get(A.texture).__webglTexture=B,_t.get(A.depthTexture).__webglTexture=W;const X=_t.get(A);X.__hasExternalTextures=!0,X.__autoAllocateDepthBuffer=W===void 0,X.__autoAllocateDepthBuffer||st.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),X.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(A,B){const W=_t.get(A);W.__webglFramebuffer=B,W.__useDefaultFramebuffer=B===void 0},this.setRenderTarget=function(A,B=0,W=0){E=A,S=B,T=W;let X=!0,z=null,ct=!1,xt=!1;if(A){const Ct=_t.get(A);if(Ct.__useDefaultFramebuffer!==void 0)ut.bindFramebuffer(L.FRAMEBUFFER,null),X=!1;else if(Ct.__webglFramebuffer===void 0)I.setupRenderTarget(A);else if(Ct.__hasExternalTextures)I.rebindTextures(A,_t.get(A.texture).__webglTexture,_t.get(A.depthTexture).__webglTexture);else if(A.depthBuffer){const Rt=A.depthTexture;if(Ct.__boundDepthTexture!==Rt){if(Rt!==null&&_t.has(Rt)&&(A.width!==Rt.image.width||A.height!==Rt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");I.setupDepthRenderbuffer(A)}}const kt=A.texture;(kt.isData3DTexture||kt.isDataArrayTexture||kt.isCompressedArrayTexture)&&(xt=!0);const Xt=_t.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(Array.isArray(Xt[B])?z=Xt[B][W]:z=Xt[B],ct=!0):A.samples>0&&I.useMultisampledRTT(A)===!1?z=_t.get(A).__webglMultisampledFramebuffer:Array.isArray(Xt)?z=Xt[W]:z=Xt,C.copy(A.viewport),N.copy(A.scissor),D=A.scissorTest}else C.copy(ot).multiplyScalar(O).floor(),N.copy(bt).multiplyScalar(O).floor(),D=Dt;if(ut.bindFramebuffer(L.FRAMEBUFFER,z)&&X&&ut.drawBuffers(A,z),ut.viewport(C),ut.scissor(N),ut.setScissorTest(D),ct){const Ct=_t.get(A.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+B,Ct.__webglTexture,W)}else if(xt){const Ct=_t.get(A.texture),kt=B||0;L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,Ct.__webglTexture,W||0,kt)}M=-1},this.readRenderTargetPixels=function(A,B,W,X,z,ct,xt){if(!(A&&A.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Et=_t.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&xt!==void 0&&(Et=Et[xt]),Et){ut.bindFramebuffer(L.FRAMEBUFFER,Et);try{const Ct=A.texture,kt=Ct.format,Xt=Ct.type;if(!Mt.textureFormatReadable(kt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Mt.textureTypeReadable(Xt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}B>=0&&B<=A.width-X&&W>=0&&W<=A.height-z&&L.readPixels(B,W,X,z,Yt.convert(kt),Yt.convert(Xt),ct)}finally{const Ct=E!==null?_t.get(E).__webglFramebuffer:null;ut.bindFramebuffer(L.FRAMEBUFFER,Ct)}}},this.readRenderTargetPixelsAsync=async function(A,B,W,X,z,ct,xt){if(!(A&&A.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Et=_t.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&xt!==void 0&&(Et=Et[xt]),Et){const Ct=A.texture,kt=Ct.format,Xt=Ct.type;if(!Mt.textureFormatReadable(kt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Mt.textureTypeReadable(Xt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(B>=0&&B<=A.width-X&&W>=0&&W<=A.height-z){ut.bindFramebuffer(L.FRAMEBUFFER,Et);const Rt=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Rt),L.bufferData(L.PIXEL_PACK_BUFFER,ct.byteLength,L.STREAM_READ),L.readPixels(B,W,X,z,Yt.convert(kt),Yt.convert(Xt),0);const ne=E!==null?_t.get(E).__webglFramebuffer:null;ut.bindFramebuffer(L.FRAMEBUFFER,ne);const he=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Pm(L,he,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Rt),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,ct),L.deleteBuffer(Rt),L.deleteSync(he),ct}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(A,B=null,W=0){A.isTexture!==!0&&(hr("WebGLRenderer: copyFramebufferToTexture function signature has changed."),B=arguments[0]||null,A=arguments[1]);const X=Math.pow(2,-W),z=Math.floor(A.image.width*X),ct=Math.floor(A.image.height*X),xt=B!==null?B.x:0,Et=B!==null?B.y:0;I.setTexture2D(A,0),L.copyTexSubImage2D(L.TEXTURE_2D,W,0,0,xt,Et,z,ct),ut.unbindTexture()},this.copyTextureToTexture=function(A,B,W=null,X=null,z=0){A.isTexture!==!0&&(hr("WebGLRenderer: copyTextureToTexture function signature has changed."),X=arguments[0]||null,A=arguments[1],B=arguments[2],z=arguments[3]||0,W=null);let ct,xt,Et,Ct,kt,Xt,Rt,ne,he;const de=A.isCompressedTexture?A.mipmaps[z]:A.image;W!==null?(ct=W.max.x-W.min.x,xt=W.max.y-W.min.y,Et=W.isBox3?W.max.z-W.min.z:1,Ct=W.min.x,kt=W.min.y,Xt=W.isBox3?W.min.z:0):(ct=de.width,xt=de.height,Et=de.depth||1,Ct=0,kt=0,Xt=0),X!==null?(Rt=X.x,ne=X.y,he=X.z):(Rt=0,ne=0,he=0);const Ze=Yt.convert(B.format),ie=Yt.convert(B.type);let Pt;B.isData3DTexture?(I.setTexture3D(B,0),Pt=L.TEXTURE_3D):B.isDataArrayTexture||B.isCompressedArrayTexture?(I.setTexture2DArray(B,0),Pt=L.TEXTURE_2D_ARRAY):(I.setTexture2D(B,0),Pt=L.TEXTURE_2D),L.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,B.flipY),L.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,B.premultiplyAlpha),L.pixelStorei(L.UNPACK_ALIGNMENT,B.unpackAlignment);const Wn=L.getParameter(L.UNPACK_ROW_LENGTH),se=L.getParameter(L.UNPACK_IMAGE_HEIGHT),Mn=L.getParameter(L.UNPACK_SKIP_PIXELS),fs=L.getParameter(L.UNPACK_SKIP_ROWS),nn=L.getParameter(L.UNPACK_SKIP_IMAGES);L.pixelStorei(L.UNPACK_ROW_LENGTH,de.width),L.pixelStorei(L.UNPACK_IMAGE_HEIGHT,de.height),L.pixelStorei(L.UNPACK_SKIP_PIXELS,Ct),L.pixelStorei(L.UNPACK_SKIP_ROWS,kt),L.pixelStorei(L.UNPACK_SKIP_IMAGES,Xt);const Zs=A.isDataArrayTexture||A.isData3DTexture,fe=B.isDataArrayTexture||B.isData3DTexture;if(A.isRenderTargetTexture||A.isDepthTexture){const Pn=_t.get(A),Ks=_t.get(B),pn=_t.get(Pn.__renderTarget),hi=_t.get(Ks.__renderTarget);ut.bindFramebuffer(L.READ_FRAMEBUFFER,pn.__webglFramebuffer),ut.bindFramebuffer(L.DRAW_FRAMEBUFFER,hi.__webglFramebuffer);for(let ui=0;ui<Et;ui++)Zs&&L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,_t.get(A).__webglTexture,z,Xt+ui),A.isDepthTexture?(fe&&L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,_t.get(B).__webglTexture,z,he+ui),L.blitFramebuffer(Ct,kt,ct,xt,Rt,ne,ct,xt,L.DEPTH_BUFFER_BIT,L.NEAREST)):fe?L.copyTexSubImage3D(Pt,z,Rt,ne,he+ui,Ct,kt,ct,xt):L.copyTexSubImage2D(Pt,z,Rt,ne,he+ui,Ct,kt,ct,xt);ut.bindFramebuffer(L.READ_FRAMEBUFFER,null),ut.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else fe?A.isDataTexture||A.isData3DTexture?L.texSubImage3D(Pt,z,Rt,ne,he,ct,xt,Et,Ze,ie,de.data):B.isCompressedArrayTexture?L.compressedTexSubImage3D(Pt,z,Rt,ne,he,ct,xt,Et,Ze,de.data):L.texSubImage3D(Pt,z,Rt,ne,he,ct,xt,Et,Ze,ie,de):A.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,z,Rt,ne,ct,xt,Ze,ie,de.data):A.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,z,Rt,ne,de.width,de.height,Ze,de.data):L.texSubImage2D(L.TEXTURE_2D,z,Rt,ne,ct,xt,Ze,ie,de);L.pixelStorei(L.UNPACK_ROW_LENGTH,Wn),L.pixelStorei(L.UNPACK_IMAGE_HEIGHT,se),L.pixelStorei(L.UNPACK_SKIP_PIXELS,Mn),L.pixelStorei(L.UNPACK_SKIP_ROWS,fs),L.pixelStorei(L.UNPACK_SKIP_IMAGES,nn),z===0&&B.generateMipmaps&&L.generateMipmap(Pt),ut.unbindTexture()},this.copyTextureToTexture3D=function(A,B,W=null,X=null,z=0){return A.isTexture!==!0&&(hr("WebGLRenderer: copyTextureToTexture3D function signature has changed."),W=arguments[0]||null,X=arguments[1]||null,A=arguments[2],B=arguments[3],z=arguments[4]||0),hr('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(A,B,W,X,z)},this.initRenderTarget=function(A){_t.get(A).__webglFramebuffer===void 0&&I.setupRenderTarget(A)},this.initTexture=function(A){A.isCubeTexture?I.setTextureCube(A,0):A.isData3DTexture?I.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?I.setTexture2DArray(A,0):I.setTexture2D(A,0),ut.unbindTexture()},this.resetState=function(){S=0,T=0,E=null,ut.reset(),ce.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Nn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Jt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Jt._getUnpackColorSpace()}}class il{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new ht(t),this.density=e}clone(){return new il(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class Yr{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new ht(t),this.near=e,this.far=n}clone(){return new Yr(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class $r extends ee{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ze,this.environmentIntensity=1,this.environmentRotation=new ze,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class sl{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Cr,this.updateRanges=[],this.version=0,this.uuid=dn()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let i=0,s=this.stride;i<s;i++)this.array[t+i]=e.array[n+i];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=dn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=dn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const He=new R;class as{constructor(t,e,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)He.fromBufferAttribute(this,e),He.applyMatrix4(t),this.setXYZ(e,He.x,He.y,He.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)He.fromBufferAttribute(this,e),He.applyNormalMatrix(t),this.setXYZ(e,He.x,He.y,He.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)He.fromBufferAttribute(this,e),He.transformDirection(t),this.setXYZ(e,He.x,He.y,He.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=We(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Gt(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=Gt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Gt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Gt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Gt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=We(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=We(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=We(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=We(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array),i=Gt(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this}setXYZW(t,e,n,i,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=Gt(e,this.array),n=Gt(n,this.array),i=Gt(i,this.array),s=Gt(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this.data.array[t+3]=s,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)e.push(this.data.array[i+s])}return new oe(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new as(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)e.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class On extends ke{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new ht(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let Es;const er=new R,Cs=new R,Rs=new R,Is=new tt,nr=new tt,Rf=new Ut,ba=new R,ir=new R,Ma=new R,Tu=new tt,Kl=new tt,Au=new tt;class ti extends ee{constructor(t=new On){if(super(),this.isSprite=!0,this.type="Sprite",Es===void 0){Es=new qt;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new sl(e,5);Es.setIndex([0,1,2,0,2,3]),Es.setAttribute("position",new as(n,3,0,!1)),Es.setAttribute("uv",new as(n,2,3,!1))}this.geometry=Es,this.material=t,this.center=new tt(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Cs.setFromMatrixScale(this.matrixWorld),Rf.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),Rs.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Cs.multiplyScalar(-Rs.z);const n=this.material.rotation;let i,s;n!==0&&(s=Math.cos(n),i=Math.sin(n));const a=this.center;Sa(ba.set(-.5,-.5,0),Rs,a,Cs,i,s),Sa(ir.set(.5,-.5,0),Rs,a,Cs,i,s),Sa(Ma.set(.5,.5,0),Rs,a,Cs,i,s),Tu.set(0,0),Kl.set(1,0),Au.set(1,1);let o=t.ray.intersectTriangle(ba,ir,Ma,!1,er);if(o===null&&(Sa(ir.set(-.5,.5,0),Rs,a,Cs,i,s),Kl.set(0,1),o=t.ray.intersectTriangle(ba,Ma,ir,!1,er),o===null))return;const l=t.ray.origin.distanceTo(er);l<t.near||l>t.far||e.push({distance:l,point:er.clone(),uv:Qe.getInterpolation(er,ba,ir,Ma,Tu,Kl,Au,new tt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function Sa(r,t,e,n,i,s){Is.subVectors(r,e).addScalar(.5).multiply(n),i!==void 0?(nr.x=s*Is.x-i*Is.y,nr.y=i*Is.x+s*Is.y):nr.copy(Is),r.copy(t),r.x+=nr.x,r.y+=nr.y,r.applyMatrix4(Rf)}const wa=new R,Eu=new R;class If extends ee{constructor(){super(),this._currentLevel=0,this.type="LOD",Object.defineProperties(this,{levels:{enumerable:!0,value:[]},isLOD:{value:!0}}),this.autoUpdate=!0}copy(t){super.copy(t,!1);const e=t.levels;for(let n=0,i=e.length;n<i;n++){const s=e[n];this.addLevel(s.object.clone(),s.distance,s.hysteresis)}return this.autoUpdate=t.autoUpdate,this}addLevel(t,e=0,n=0){e=Math.abs(e);const i=this.levels;let s;for(s=0;s<i.length&&!(e<i[s].distance);s++);return i.splice(s,0,{distance:e,hysteresis:n,object:t}),this.add(t),this}removeLevel(t){const e=this.levels;for(let n=0;n<e.length;n++)if(e[n].distance===t){const i=e.splice(n,1);return this.remove(i[0].object),!0}return!1}getCurrentLevel(){return this._currentLevel}getObjectForDistance(t){const e=this.levels;if(e.length>0){let n,i;for(n=1,i=e.length;n<i;n++){let s=e[n].distance;if(e[n].object.visible&&(s-=s*e[n].hysteresis),t<s)break}return e[n-1].object}return null}raycast(t,e){if(this.levels.length>0){wa.setFromMatrixPosition(this.matrixWorld);const i=t.ray.origin.distanceTo(wa);this.getObjectForDistance(i).raycast(t,e)}}update(t){const e=this.levels;if(e.length>1){wa.setFromMatrixPosition(t.matrixWorld),Eu.setFromMatrixPosition(this.matrixWorld);const n=wa.distanceTo(Eu)/t.zoom;e[0].object.visible=!0;let i,s;for(i=1,s=e.length;i<s;i++){let a=e[i].distance;if(e[i].object.visible&&(a-=a*e[i].hysteresis),n>=a)e[i-1].object.visible=!1,e[i].object.visible=!0;else break}for(this._currentLevel=i-1;i<s;i++)e[i].object.visible=!1}}toJSON(t){const e=super.toJSON(t);this.autoUpdate===!1&&(e.object.autoUpdate=!1),e.object.levels=[];const n=this.levels;for(let i=0,s=n.length;i<s;i++){const a=n[i];e.object.levels.push({object:a.object.uuid,distance:a.distance,hysteresis:a.hysteresis})}return e}}const Cu=new R,Ru=new te,Iu=new te,q_=new R,Pu=new Ut,Ta=new R,Jl=new Be,Lu=new Ut,jl=new Ys;class Pf extends ue{constructor(t,e){super(t,e),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=_c,this.bindMatrix=new Ut,this.bindMatrixInverse=new Ut,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const t=this.geometry;this.boundingBox===null&&(this.boundingBox=new qe),this.boundingBox.makeEmpty();const e=t.getAttribute("position");for(let n=0;n<e.count;n++)this.getVertexPosition(n,Ta),this.boundingBox.expandByPoint(Ta)}computeBoundingSphere(){const t=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Be),this.boundingSphere.makeEmpty();const e=t.getAttribute("position");for(let n=0;n<e.count;n++)this.getVertexPosition(n,Ta),this.boundingSphere.expandByPoint(Ta)}copy(t,e){return super.copy(t,e),this.bindMode=t.bindMode,this.bindMatrix.copy(t.bindMatrix),this.bindMatrixInverse.copy(t.bindMatrixInverse),this.skeleton=t.skeleton,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}raycast(t,e){const n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Jl.copy(this.boundingSphere),Jl.applyMatrix4(i),t.ray.intersectsSphere(Jl)!==!1&&(Lu.copy(i).invert(),jl.copy(t.ray).applyMatrix4(Lu),!(this.boundingBox!==null&&jl.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(t,e,jl)))}getVertexPosition(t,e){return super.getVertexPosition(t,e),this.applyBoneTransform(t,e),e}bind(t,e){this.skeleton=t,e===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),e=this.matrixWorld),this.bindMatrix.copy(e),this.bindMatrixInverse.copy(e).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const t=new te,e=this.geometry.attributes.skinWeight;for(let n=0,i=e.count;n<i;n++){t.fromBufferAttribute(e,n);const s=1/t.manhattanLength();s!==1/0?t.multiplyScalar(s):t.set(1,0,0,0),e.setXYZW(n,t.x,t.y,t.z,t.w)}}updateMatrixWorld(t){super.updateMatrixWorld(t),this.bindMode===_c?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Kd?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(t,e){const n=this.skeleton,i=this.geometry;Ru.fromBufferAttribute(i.attributes.skinIndex,t),Iu.fromBufferAttribute(i.attributes.skinWeight,t),Cu.copy(e).applyMatrix4(this.bindMatrix),e.set(0,0,0);for(let s=0;s<4;s++){const a=Iu.getComponent(s);if(a!==0){const o=Ru.getComponent(s);Pu.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),e.addScaledVector(q_.copy(Cu).applyMatrix4(Pu),a)}}return e.applyMatrix4(this.bindMatrixInverse)}}class eh extends ee{constructor(){super(),this.isBone=!0,this.type="Bone"}}class Fn extends ye{constructor(t=null,e=1,n=1,i,s,a,o,l,c=De,h=De,u,d){super(null,a,o,l,c,h,i,s,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Du=new Ut,Y_=new Ut;class rl{constructor(t=[],e=[]){this.uuid=dn(),this.bones=t.slice(0),this.boneInverses=e,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const t=this.bones,e=this.boneInverses;if(this.boneMatrices=new Float32Array(t.length*16),e.length===0)this.calculateInverses();else if(t.length!==e.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Ut)}}calculateInverses(){this.boneInverses.length=0;for(let t=0,e=this.bones.length;t<e;t++){const n=new Ut;this.bones[t]&&n.copy(this.bones[t].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let t=0,e=this.bones.length;t<e;t++){const n=this.bones[t];n&&n.matrixWorld.copy(this.boneInverses[t]).invert()}for(let t=0,e=this.bones.length;t<e;t++){const n=this.bones[t];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){const t=this.bones,e=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let s=0,a=t.length;s<a;s++){const o=t[s]?t[s].matrixWorld:Y_;Du.multiplyMatrices(o,e[s]),Du.toArray(n,s*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new rl(this.bones,this.boneInverses)}computeBoneTexture(){let t=Math.sqrt(this.bones.length*4);t=Math.ceil(t/4)*4,t=Math.max(t,4);const e=new Float32Array(t*t*4);e.set(this.boneMatrices);const n=new Fn(e,t,t,Xe,tn);return n.needsUpdate=!0,this.boneMatrices=e,this.boneTexture=n,this}getBoneByName(t){for(let e=0,n=this.bones.length;e<n;e++){const i=this.bones[e];if(i.name===t)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(t,e){this.uuid=t.uuid;for(let n=0,i=t.bones.length;n<i;n++){const s=t.bones[n];let a=e[s];a===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),a=new eh),this.bones.push(a),this.boneInverses.push(new Ut().fromArray(t.boneInverses[n]))}return this.init(),this}toJSON(){const t={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};t.uuid=this.uuid;const e=this.bones,n=this.boneInverses;for(let i=0,s=e.length;i<s;i++){const a=e[i];t.bones.push(a.uuid);const o=n[i];t.boneInverses.push(o.toArray())}return t}}class je extends oe{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Ps=new Ut,Uu=new Ut,Aa=[],Nu=new qe,$_=new Ut,sr=new ue,rr=new Be;class Os extends ue{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new je(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,$_)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new qe),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ps),Nu.copy(t.boundingBox).applyMatrix4(Ps),this.boundingBox.union(Nu)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Be),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ps),rr.copy(t.boundingSphere).applyMatrix4(Ps),this.boundingSphere.union(rr)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,i=this.morphTexture.source.data.data,s=n.length+1,a=t*s+1;for(let o=0;o<n.length;o++)n[o]=i[a+o]}raycast(t,e){const n=this.matrixWorld,i=this.count;if(sr.geometry=this.geometry,sr.material=this.material,sr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),rr.copy(this.boundingSphere),rr.applyMatrix4(n),t.ray.intersectsSphere(rr)!==!1))for(let s=0;s<i;s++){this.getMatrixAt(s,Ps),Uu.multiplyMatrices(n,Ps),sr.matrixWorld=Uu,sr.raycast(t,Aa);for(let a=0,o=Aa.length;a<o;a++){const l=Aa[a];l.instanceId=s,l.object=this,e.push(l)}Aa.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new je(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Fn(new Float32Array(i*this.count),i,this.count,Zo,tn));const s=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=i*t;s[l]=o,s.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}function Ql(r,t){return r-t}function Z_(r,t){return r.z-t.z}function K_(r,t){return t.z-r.z}class J_{constructor(){this.index=0,this.pool=[],this.list=[]}push(t,e,n,i){const s=this.pool,a=this.list;this.index>=s.length&&s.push({start:-1,count:-1,z:-1,index:-1});const o=s[this.index];a.push(o),this.index++,o.start=t,o.count=e,o.z=n,o.index=i}reset(){this.list.length=0,this.index=0}}const Ke=new Ut,j_=new ht(1,1,1),tc=new Xr,Ea=new qe,Oi=new Be,ar=new R,Ou=new R,Q_=new R,ec=new J_,Fe=new ue,Ca=[];function ty(r,t,e=0){const n=t.itemSize;if(r.isInterleavedBufferAttribute||r.array.constructor!==t.array.constructor){const i=r.count;for(let s=0;s<i;s++)for(let a=0;a<n;a++)t.setComponent(s+e,a,r.getComponent(s,a))}else t.array.set(r.array,e*n);t.needsUpdate=!0}function Fi(r,t){if(r.constructor!==t.constructor){const e=Math.min(r.length,t.length);for(let n=0;n<e;n++)t[n]=r[n]}else{const e=Math.min(r.length,t.length);t.set(new r.constructor(r.buffer,0,e))}}class Lf extends ue{get maxInstanceCount(){return this._maxInstanceCount}get instanceCount(){return this._instanceInfo.length-this._availableInstanceIds.length}get unusedVertexCount(){return this._maxVertexCount-this._nextVertexStart}get unusedIndexCount(){return this._maxIndexCount-this._nextIndexStart}constructor(t,e,n=e*2,i){super(new qt,i),this.isBatchedMesh=!0,this.perObjectFrustumCulled=!0,this.sortObjects=!0,this.boundingBox=null,this.boundingSphere=null,this.customSort=null,this._instanceInfo=[],this._geometryInfo=[],this._availableInstanceIds=[],this._availableGeometryIds=[],this._nextIndexStart=0,this._nextVertexStart=0,this._geometryCount=0,this._visibilityChanged=!0,this._geometryInitialized=!1,this._maxInstanceCount=t,this._maxVertexCount=e,this._maxIndexCount=n,this._multiDrawCounts=new Int32Array(t),this._multiDrawStarts=new Int32Array(t),this._multiDrawCount=0,this._multiDrawInstances=null,this._matricesTexture=null,this._indirectTexture=null,this._colorsTexture=null,this._initMatricesTexture(),this._initIndirectTexture()}_initMatricesTexture(){let t=Math.sqrt(this._maxInstanceCount*4);t=Math.ceil(t/4)*4,t=Math.max(t,4);const e=new Float32Array(t*t*4),n=new Fn(e,t,t,Xe,tn);this._matricesTexture=n}_initIndirectTexture(){let t=Math.sqrt(this._maxInstanceCount);t=Math.ceil(t);const e=new Uint32Array(t*t),n=new Fn(e,t,t,Vr,oi);this._indirectTexture=n}_initColorsTexture(){let t=Math.sqrt(this._maxInstanceCount);t=Math.ceil(t);const e=new Float32Array(t*t*4).fill(1),n=new Fn(e,t,t,Xe,tn);n.colorSpace=Jt.workingColorSpace,this._colorsTexture=n}_initializeGeometry(t){const e=this.geometry,n=this._maxVertexCount,i=this._maxIndexCount;if(this._geometryInitialized===!1){for(const s in t.attributes){const a=t.getAttribute(s),{array:o,itemSize:l,normalized:c}=a,h=new o.constructor(n*l),u=new oe(h,l,c);e.setAttribute(s,u)}if(t.getIndex()!==null){const s=n>65535?new Uint32Array(i):new Uint16Array(i);e.setIndex(new oe(s,1))}this._geometryInitialized=!0}}_validateGeometry(t){const e=this.geometry;if(!!t.getIndex()!=!!e.getIndex())throw new Error('BatchedMesh: All geometries must consistently have "index".');for(const n in e.attributes){if(!t.hasAttribute(n))throw new Error(`BatchedMesh: Added geometry missing "${n}". All geometries must have consistent attributes.`);const i=t.getAttribute(n),s=e.getAttribute(n);if(i.itemSize!==s.itemSize||i.normalized!==s.normalized)throw new Error("BatchedMesh: All attributes must have a consistent itemSize and normalized value.")}}setCustomSort(t){return this.customSort=t,this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new qe);const t=this.boundingBox,e=this._instanceInfo;t.makeEmpty();for(let n=0,i=e.length;n<i;n++){if(e[n].active===!1)continue;const s=e[n].geometryIndex;this.getMatrixAt(n,Ke),this.getBoundingBoxAt(s,Ea).applyMatrix4(Ke),t.union(Ea)}}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Be);const t=this.boundingSphere,e=this._instanceInfo;t.makeEmpty();for(let n=0,i=e.length;n<i;n++){if(e[n].active===!1)continue;const s=e[n].geometryIndex;this.getMatrixAt(n,Ke),this.getBoundingSphereAt(s,Oi).applyMatrix4(Ke),t.union(Oi)}}addInstance(t){if(this._instanceInfo.length>=this.maxInstanceCount&&this._availableInstanceIds.length===0)throw new Error("BatchedMesh: Maximum item count reached.");const n={visible:!0,active:!0,geometryIndex:t};let i=null;this._availableInstanceIds.length>0?(this._availableInstanceIds.sort(Ql),i=this._availableInstanceIds.shift(),this._instanceInfo[i]=n):(i=this._instanceInfo.length,this._instanceInfo.push(n));const s=this._matricesTexture;Ke.identity().toArray(s.image.data,i*16),s.needsUpdate=!0;const a=this._colorsTexture;return a&&(j_.toArray(a.image.data,i*4),a.needsUpdate=!0),this._visibilityChanged=!0,i}addGeometry(t,e=-1,n=-1){this._initializeGeometry(t),this._validateGeometry(t);const i={vertexStart:-1,vertexCount:-1,reservedVertexCount:-1,indexStart:-1,indexCount:-1,reservedIndexCount:-1,start:-1,count:-1,boundingBox:null,boundingSphere:null,active:!0},s=this._geometryInfo;i.vertexStart=this._nextVertexStart,i.reservedVertexCount=e===-1?t.getAttribute("position").count:e;const a=t.getIndex();if(a!==null&&(i.indexStart=this._nextIndexStart,i.reservedIndexCount=n===-1?a.count:n),i.indexStart!==-1&&i.indexStart+i.reservedIndexCount>this._maxIndexCount||i.vertexStart+i.reservedVertexCount>this._maxVertexCount)throw new Error("BatchedMesh: Reserved space request exceeds the maximum buffer size.");let l;return this._availableGeometryIds.length>0?(this._availableGeometryIds.sort(Ql),l=this._availableGeometryIds.shift(),s[l]=i):(l=this._geometryCount,this._geometryCount++,s.push(i)),this.setGeometryAt(l,t),this._nextIndexStart=i.indexStart+i.reservedIndexCount,this._nextVertexStart=i.vertexStart+i.reservedVertexCount,l}setGeometryAt(t,e){if(t>=this._geometryCount)throw new Error("BatchedMesh: Maximum geometry count reached.");this._validateGeometry(e);const n=this.geometry,i=n.getIndex()!==null,s=n.getIndex(),a=e.getIndex(),o=this._geometryInfo[t];if(i&&a.count>o.reservedIndexCount||e.attributes.position.count>o.reservedVertexCount)throw new Error("BatchedMesh: Reserved space not large enough for provided geometry.");const l=o.vertexStart,c=o.reservedVertexCount;o.vertexCount=e.getAttribute("position").count;for(const h in n.attributes){const u=e.getAttribute(h),d=n.getAttribute(h);ty(u,d,l);const f=u.itemSize;for(let m=u.count,x=c;m<x;m++){const g=l+m;for(let p=0;p<f;p++)d.setComponent(g,p,0)}d.needsUpdate=!0,d.addUpdateRange(l*f,c*f)}if(i){const h=o.indexStart,u=o.reservedIndexCount;o.indexCount=e.getIndex().count;for(let d=0;d<a.count;d++)s.setX(h+d,l+a.getX(d));for(let d=a.count,f=u;d<f;d++)s.setX(h+d,l);s.needsUpdate=!0,s.addUpdateRange(h,o.reservedIndexCount)}return o.start=i?o.indexStart:o.vertexStart,o.count=i?o.indexCount:o.vertexCount,o.boundingBox=null,e.boundingBox!==null&&(o.boundingBox=e.boundingBox.clone()),o.boundingSphere=null,e.boundingSphere!==null&&(o.boundingSphere=e.boundingSphere.clone()),this._visibilityChanged=!0,t}deleteGeometry(t){const e=this._geometryInfo;if(t>=e.length||e[t].active===!1)return this;const n=this._instanceInfo;for(let i=0,s=n.length;i<s;i++)n[i].geometryIndex===t&&this.deleteInstance(i);return e[t].active=!1,this._availableGeometryIds.push(t),this._visibilityChanged=!0,this}deleteInstance(t){const e=this._instanceInfo;return t>=e.length||e[t].active===!1?this:(e[t].active=!1,this._availableInstanceIds.push(t),this._visibilityChanged=!0,this)}optimize(){let t=0,e=0;const n=this._geometryInfo,i=n.map((a,o)=>o).sort((a,o)=>n[a].vertexStart-n[o].vertexStart),s=this.geometry;for(let a=0,o=n.length;a<o;a++){const l=i[a],c=n[l];if(c.active!==!1){if(s.index!==null){if(c.indexStart!==e){const{indexStart:h,vertexStart:u,reservedIndexCount:d}=c,f=s.index,m=f.array,x=t-u;for(let g=h;g<h+d;g++)m[g]=m[g]+x;f.array.copyWithin(e,h,h+d),f.addUpdateRange(e,d),c.indexStart=e}e+=c.reservedIndexCount}if(c.vertexStart!==t){const{vertexStart:h,reservedVertexCount:u}=c,d=s.attributes;for(const f in d){const m=d[f],{array:x,itemSize:g}=m;x.copyWithin(t*g,h*g,(h+u)*g),m.addUpdateRange(t*g,u*g)}c.vertexStart=t}t+=c.reservedVertexCount,c.start=s.index?c.indexStart:c.vertexStart,this._nextIndexStart=s.index?c.indexStart+c.reservedIndexCount:0,this._nextVertexStart=c.vertexStart+c.reservedVertexCount}}return this}getBoundingBoxAt(t,e){if(t>=this._geometryCount)return null;const n=this.geometry,i=this._geometryInfo[t];if(i.boundingBox===null){const s=new qe,a=n.index,o=n.attributes.position;for(let l=i.start,c=i.start+i.count;l<c;l++){let h=l;a&&(h=a.getX(h)),s.expandByPoint(ar.fromBufferAttribute(o,h))}i.boundingBox=s}return e.copy(i.boundingBox),e}getBoundingSphereAt(t,e){if(t>=this._geometryCount)return null;const n=this.geometry,i=this._geometryInfo[t];if(i.boundingSphere===null){const s=new Be;this.getBoundingBoxAt(t,Ea),Ea.getCenter(s.center);const a=n.index,o=n.attributes.position;let l=0;for(let c=i.start,h=i.start+i.count;c<h;c++){let u=c;a&&(u=a.getX(u)),ar.fromBufferAttribute(o,u),l=Math.max(l,s.center.distanceToSquared(ar))}s.radius=Math.sqrt(l),i.boundingSphere=s}return e.copy(i.boundingSphere),e}setMatrixAt(t,e){const n=this._instanceInfo,i=this._matricesTexture,s=this._matricesTexture.image.data;return t>=n.length||n[t].active===!1?this:(e.toArray(s,t*16),i.needsUpdate=!0,this)}getMatrixAt(t,e){const n=this._instanceInfo,i=this._matricesTexture.image.data;return t>=n.length||n[t].active===!1?null:e.fromArray(i,t*16)}setColorAt(t,e){this._colorsTexture===null&&this._initColorsTexture();const n=this._colorsTexture,i=this._colorsTexture.image.data,s=this._instanceInfo;return t>=s.length||s[t].active===!1?this:(e.toArray(i,t*4),n.needsUpdate=!0,this)}getColorAt(t,e){const n=this._colorsTexture.image.data,i=this._instanceInfo;return t>=i.length||i[t].active===!1?null:e.fromArray(n,t*4)}setVisibleAt(t,e){const n=this._instanceInfo;return t>=n.length||n[t].active===!1||n[t].visible===e?this:(n[t].visible=e,this._visibilityChanged=!0,this)}getVisibleAt(t){const e=this._instanceInfo;return t>=e.length||e[t].active===!1?!1:e[t].visible}setGeometryIdAt(t,e){const n=this._instanceInfo,i=this._geometryInfo;return t>=n.length||n[t].active===!1||e>=i.length||i[e].active===!1?null:(n[t].geometryIndex=e,this)}getGeometryIdAt(t){const e=this._instanceInfo;return t>=e.length||e[t].active===!1?-1:e[t].geometryIndex}getGeometryRangeAt(t,e={}){if(t<0||t>=this._geometryCount)return null;const n=this._geometryInfo[t];return e.vertexStart=n.vertexStart,e.vertexCount=n.vertexCount,e.reservedVertexCount=n.reservedVertexCount,e.indexStart=n.indexStart,e.indexCount=n.indexCount,e.reservedIndexCount=n.reservedIndexCount,e.start=n.start,e.count=n.count,e}setInstanceCount(t){const e=this._availableInstanceIds,n=this._instanceInfo;for(e.sort(Ql);e[e.length-1]===n.length;)n.pop(),e.pop();if(t<n.length)throw new Error(`BatchedMesh: Instance ids outside the range ${t} are being used. Cannot shrink instance count.`);const i=new Int32Array(t),s=new Int32Array(t);Fi(this._multiDrawCounts,i),Fi(this._multiDrawStarts,s),this._multiDrawCounts=i,this._multiDrawStarts=s,this._maxInstanceCount=t;const a=this._indirectTexture,o=this._matricesTexture,l=this._colorsTexture;a.dispose(),this._initIndirectTexture(),Fi(a.image.data,this._indirectTexture.image.data),o.dispose(),this._initMatricesTexture(),Fi(o.image.data,this._matricesTexture.image.data),l&&(l.dispose(),this._initColorsTexture(),Fi(l.image.data,this._colorsTexture.image.data))}setGeometrySize(t,e){const n=[...this._geometryInfo].filter(o=>o.active);if(Math.max(...n.map(o=>o.vertexStart+o.reservedVertexCount))>t)throw new Error(`BatchedMesh: Geometry vertex values are being used outside the range ${e}. Cannot shrink further.`);if(this.geometry.index&&Math.max(...n.map(l=>l.indexStart+l.reservedIndexCount))>e)throw new Error(`BatchedMesh: Geometry index values are being used outside the range ${e}. Cannot shrink further.`);const s=this.geometry;s.dispose(),this._maxVertexCount=t,this._maxIndexCount=e,this._geometryInitialized&&(this._geometryInitialized=!1,this.geometry=new qt,this._initializeGeometry(s));const a=this.geometry;s.index&&Fi(s.index.array,a.index.array);for(const o in s.attributes)Fi(s.attributes[o].array,a.attributes[o].array)}raycast(t,e){const n=this._instanceInfo,i=this._geometryInfo,s=this.matrixWorld,a=this.geometry;Fe.material=this.material,Fe.geometry.index=a.index,Fe.geometry.attributes=a.attributes,Fe.geometry.boundingBox===null&&(Fe.geometry.boundingBox=new qe),Fe.geometry.boundingSphere===null&&(Fe.geometry.boundingSphere=new Be);for(let o=0,l=n.length;o<l;o++){if(!n[o].visible||!n[o].active)continue;const c=n[o].geometryIndex,h=i[c];Fe.geometry.setDrawRange(h.start,h.count),this.getMatrixAt(o,Fe.matrixWorld).premultiply(s),this.getBoundingBoxAt(c,Fe.geometry.boundingBox),this.getBoundingSphereAt(c,Fe.geometry.boundingSphere),Fe.raycast(t,Ca);for(let u=0,d=Ca.length;u<d;u++){const f=Ca[u];f.object=this,f.batchId=o,e.push(f)}Ca.length=0}Fe.material=null,Fe.geometry.index=null,Fe.geometry.attributes={},Fe.geometry.setDrawRange(0,1/0)}copy(t){return super.copy(t),this.geometry=t.geometry.clone(),this.perObjectFrustumCulled=t.perObjectFrustumCulled,this.sortObjects=t.sortObjects,this.boundingBox=t.boundingBox!==null?t.boundingBox.clone():null,this.boundingSphere=t.boundingSphere!==null?t.boundingSphere.clone():null,this._geometryInfo=t._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox!==null?e.boundingBox.clone():null,boundingSphere:e.boundingSphere!==null?e.boundingSphere.clone():null})),this._instanceInfo=t._instanceInfo.map(e=>({...e})),this._maxInstanceCount=t._maxInstanceCount,this._maxVertexCount=t._maxVertexCount,this._maxIndexCount=t._maxIndexCount,this._geometryInitialized=t._geometryInitialized,this._geometryCount=t._geometryCount,this._multiDrawCounts=t._multiDrawCounts.slice(),this._multiDrawStarts=t._multiDrawStarts.slice(),this._matricesTexture=t._matricesTexture.clone(),this._matricesTexture.image.data=this._matricesTexture.image.data.slice(),this._colorsTexture!==null&&(this._colorsTexture=t._colorsTexture.clone(),this._colorsTexture.image.data=this._colorsTexture.image.data.slice()),this}dispose(){return this.geometry.dispose(),this._matricesTexture.dispose(),this._matricesTexture=null,this._indirectTexture.dispose(),this._indirectTexture=null,this._colorsTexture!==null&&(this._colorsTexture.dispose(),this._colorsTexture=null),this}onBeforeRender(t,e,n,i,s){if(!this._visibilityChanged&&!this.perObjectFrustumCulled&&!this.sortObjects)return;const a=i.getIndex(),o=a===null?1:a.array.BYTES_PER_ELEMENT,l=this._instanceInfo,c=this._multiDrawStarts,h=this._multiDrawCounts,u=this._geometryInfo,d=this.perObjectFrustumCulled,f=this._indirectTexture,m=f.image.data;d&&(Ke.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse).multiply(this.matrixWorld),tc.setFromProjectionMatrix(Ke,t.coordinateSystem));let x=0;if(this.sortObjects){Ke.copy(this.matrixWorld).invert(),ar.setFromMatrixPosition(n.matrixWorld).applyMatrix4(Ke),Ou.set(0,0,-1).transformDirection(n.matrixWorld).transformDirection(Ke);for(let _=0,v=l.length;_<v;_++)if(l[_].visible&&l[_].active){const y=l[_].geometryIndex;this.getMatrixAt(_,Ke),this.getBoundingSphereAt(y,Oi).applyMatrix4(Ke);let P=!1;if(d&&(P=!tc.intersectsSphere(Oi)),!P){const S=u[y],T=Q_.subVectors(Oi.center,ar).dot(Ou);ec.push(S.start,S.count,T,_)}}const g=ec.list,p=this.customSort;p===null?g.sort(s.transparent?K_:Z_):p.call(this,g,n);for(let _=0,v=g.length;_<v;_++){const y=g[_];c[x]=y.start*o,h[x]=y.count,m[x]=y.index,x++}ec.reset()}else for(let g=0,p=l.length;g<p;g++)if(l[g].visible&&l[g].active){const _=l[g].geometryIndex;let v=!1;if(d&&(this.getMatrixAt(g,Ke),this.getBoundingSphereAt(_,Oi).applyMatrix4(Ke),v=!tc.intersectsSphere(Oi)),!v){const y=u[_];c[x]=y.start*o,h[x]=y.count,m[x]=g,x++}}f.needsUpdate=!0,this._multiDrawCount=x,this._visibilityChanged=!1}onBeforeShadow(t,e,n,i,s,a){this.onBeforeRender(t,null,i,s,a)}}class $e extends ke{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new ht(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const Fo=new R,Bo=new R,Fu=new Ut,or=new Ys,Ra=new Be,nc=new R,Bu=new R;class wi extends ee{constructor(t=new qt,e=new $e){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let i=1,s=e.count;i<s;i++)Fo.fromBufferAttribute(e,i-1),Bo.fromBufferAttribute(e,i),n[i]=n[i-1],n[i]+=Fo.distanceTo(Bo);t.setAttribute("lineDistance",new Tt(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,s=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ra.copy(n.boundingSphere),Ra.applyMatrix4(i),Ra.radius+=s,t.ray.intersectsSphere(Ra)===!1)return;Fu.copy(i).invert(),or.copy(t.ray).applyMatrix4(Fu);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,d=n.attributes.position;if(h!==null){const f=Math.max(0,a.start),m=Math.min(h.count,a.start+a.count);for(let x=f,g=m-1;x<g;x+=c){const p=h.getX(x),_=h.getX(x+1),v=Ia(this,t,or,l,p,_);v&&e.push(v)}if(this.isLineLoop){const x=h.getX(m-1),g=h.getX(f),p=Ia(this,t,or,l,x,g);p&&e.push(p)}}else{const f=Math.max(0,a.start),m=Math.min(d.count,a.start+a.count);for(let x=f,g=m-1;x<g;x+=c){const p=Ia(this,t,or,l,x,x+1);p&&e.push(p)}if(this.isLineLoop){const x=Ia(this,t,or,l,m-1,f);x&&e.push(x)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Ia(r,t,e,n,i,s){const a=r.geometry.attributes.position;if(Fo.fromBufferAttribute(a,i),Bo.fromBufferAttribute(a,s),e.distanceSqToSegment(Fo,Bo,nc,Bu)>n)return;nc.applyMatrix4(r.matrixWorld);const l=t.ray.origin.distanceTo(nc);if(!(l<t.near||l>t.far))return{distance:l,point:Bu.clone().applyMatrix4(r.matrixWorld),index:i,face:null,faceIndex:null,barycoord:null,object:r}}const zu=new R,ku=new R;class Vn extends wi{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[];for(let i=0,s=e.count;i<s;i+=2)zu.fromBufferAttribute(e,i),ku.fromBufferAttribute(e,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+zu.distanceTo(ku);t.setAttribute("lineDistance",new Tt(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Df extends wi{constructor(t,e){super(t,e),this.isLineLoop=!0,this.type="LineLoop"}}class nh extends ke{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new ht(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const Hu=new Ut,wc=new Ys,Pa=new Be,La=new R;class Uf extends ee{constructor(t=new qt,e=new nh){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,s=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Pa.copy(n.boundingSphere),Pa.applyMatrix4(i),Pa.radius+=s,t.ray.intersectsSphere(Pa)===!1)return;Hu.copy(i).invert(),wc.copy(t.ray).applyMatrix4(Hu);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let m=d,x=f;m<x;m++){const g=c.getX(m);La.fromBufferAttribute(u,g),Vu(La,g,l,i,t,e,this)}}else{const d=Math.max(0,a.start),f=Math.min(u.count,a.start+a.count);for(let m=d,x=f;m<x;m++)La.fromBufferAttribute(u,m),Vu(La,m,l,i,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Vu(r,t,e,n,i,s,a){const o=wc.distanceSqToPoint(r);if(o<e){const l=new R;wc.closestPointToPoint(r,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}class ey extends ye{constructor(t,e,n,i,s,a,o,l,c){super(t,e,n,i,s,a,o,l,c),this.isVideoTexture=!0,this.minFilter=a!==void 0?a:we,this.magFilter=s!==void 0?s:we,this.generateMipmaps=!1;const h=this;function u(){h.needsUpdate=!0,t.requestVideoFrameCallback(u)}"requestVideoFrameCallback"in t&&t.requestVideoFrameCallback(u)}clone(){return new this.constructor(this.image).copy(this)}update(){const t=this.image;"requestVideoFrameCallback"in t===!1&&t.readyState>=t.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}}class ny extends ye{constructor(t,e){super({width:t,height:e}),this.isFramebufferTexture=!0,this.magFilter=De,this.minFilter=De,this.generateMipmaps=!1,this.needsUpdate=!0}}class al extends ye{constructor(t,e,n,i,s,a,o,l,c,h,u,d){super(null,a,o,l,c,h,i,s,u,d),this.isCompressedTexture=!0,this.image={width:e,height:n},this.mipmaps=t,this.flipY=!1,this.generateMipmaps=!1}}class iy extends al{constructor(t,e,n,i,s,a){super(t,e,n,s,a),this.isCompressedArrayTexture=!0,this.image.depth=i,this.wrapR=un,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class sy extends al{constructor(t,e,n){super(void 0,t[0].width,t[0].height,e,n,ai),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=t}}class ln extends ye{constructor(t,e,n,i,s,a,o,l,c){super(t,e,n,i,s,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Rn{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,i=this.getPoint(0),s=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),s+=n.distanceTo(i),e.push(s),i=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let i=0;const s=n.length;let a;e?a=e:a=t*n[s-1];let o=0,l=s-1,c;for(;o<=l;)if(i=Math.floor(o+(l-o)/2),c=n[i]-a,c<0)o=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===a)return i/(s-1);const h=n[i],d=n[i+1]-h,f=(a-h)/d;return(i+f)/(s-1)}getTangent(t,e){let i=t-1e-4,s=t+1e-4;i<0&&(i=0),s>1&&(s=1);const a=this.getPoint(i),o=this.getPoint(s),l=e||(a.isVector2?new tt:new R);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new R,i=[],s=[],a=[],o=new R,l=new Ut;for(let f=0;f<=t;f++){const m=f/t;i[f]=this.getTangentAt(m,new R)}s[0]=new R,a[0]=new R;let c=Number.MAX_VALUE;const h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(i[0],n).normalize(),s[0].crossVectors(i[0],o),a[0].crossVectors(i[0],s[0]);for(let f=1;f<=t;f++){if(s[f]=s[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(i[f-1],i[f]),o.length()>Number.EPSILON){o.normalize();const m=Math.acos(_e(i[f-1].dot(i[f]),-1,1));s[f].applyMatrix4(l.makeRotationAxis(o,m))}a[f].crossVectors(i[f],s[f])}if(e===!0){let f=Math.acos(_e(s[0].dot(s[t]),-1,1));f/=t,i[0].dot(o.crossVectors(s[0],s[t]))>0&&(f=-f);for(let m=1;m<=t;m++)s[m].applyMatrix4(l.makeRotationAxis(i[m],f*m)),a[m].crossVectors(i[m],s[m])}return{tangents:i,normals:s,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class ol extends Rn{constructor(t=0,e=0,n=1,i=1,s=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=i,this.aStartAngle=s,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new tt){const n=e,i=Math.PI*2;let s=this.aEndAngle-this.aStartAngle;const a=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=i;for(;s>i;)s-=i;s<Number.EPSILON&&(a?s=0:s=i),this.aClockwise===!0&&!a&&(s===i?s=-i:s=s-i);const o=this.aStartAngle+t*s;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*h-f*u+this.aX,c=d*u+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class Nf extends ol{constructor(t,e,n,i,s,a){super(t,e,n,n,i,s,a),this.isArcCurve=!0,this.type="ArcCurve"}}function ih(){let r=0,t=0,e=0,n=0;function i(s,a,o,l){r=s,t=o,e=-3*s+3*a-2*o-l,n=2*s-2*a+o+l}return{initCatmullRom:function(s,a,o,l,c){i(a,o,c*(o-s),c*(l-a))},initNonuniformCatmullRom:function(s,a,o,l,c,h,u){let d=(a-s)/c-(o-s)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,f*=h,i(a,o,d,f)},calc:function(s){const a=s*s,o=a*s;return r+t*s+e*a+n*o}}}const Da=new R,ic=new ih,sc=new ih,rc=new ih;class Of extends Rn{constructor(t=[],e=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=i}getPoint(t,e=new R){const n=e,i=this.points,s=i.length,a=(s-(this.closed?0:1))*t;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/s)+1)*s:l===0&&o===s-1&&(o=s-2,l=1);let c,h;this.closed||o>0?c=i[(o-1)%s]:(Da.subVectors(i[0],i[1]).add(i[0]),c=Da);const u=i[o%s],d=i[(o+1)%s];if(this.closed||o+2<s?h=i[(o+2)%s]:(Da.subVectors(i[s-1],i[s-2]).add(i[s-1]),h=Da),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let m=Math.pow(c.distanceToSquared(u),f),x=Math.pow(u.distanceToSquared(d),f),g=Math.pow(d.distanceToSquared(h),f);x<1e-4&&(x=1),m<1e-4&&(m=x),g<1e-4&&(g=x),ic.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,m,x,g),sc.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,m,x,g),rc.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,m,x,g)}else this.curveType==="catmullrom"&&(ic.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),sc.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),rc.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(ic.calc(l),sc.calc(l),rc.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new R().fromArray(i))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function Gu(r,t,e,n,i){const s=(n-t)*.5,a=(i-e)*.5,o=r*r,l=r*o;return(2*e-2*n+s+a)*l+(-3*e+3*n-2*s-a)*o+s*r+e}function ry(r,t){const e=1-r;return e*e*t}function ay(r,t){return 2*(1-r)*r*t}function oy(r,t){return r*r*t}function yr(r,t,e,n){return ry(r,t)+ay(r,e)+oy(r,n)}function ly(r,t){const e=1-r;return e*e*e*t}function cy(r,t){const e=1-r;return 3*e*e*r*t}function hy(r,t){return 3*(1-r)*r*r*t}function uy(r,t){return r*r*r*t}function br(r,t,e,n,i){return ly(r,t)+cy(r,e)+hy(r,n)+uy(r,i)}class sh extends Rn{constructor(t=new tt,e=new tt,n=new tt,i=new tt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new tt){const n=e,i=this.v0,s=this.v1,a=this.v2,o=this.v3;return n.set(br(t,i.x,s.x,a.x,o.x),br(t,i.y,s.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Ff extends Rn{constructor(t=new R,e=new R,n=new R,i=new R){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new R){const n=e,i=this.v0,s=this.v1,a=this.v2,o=this.v3;return n.set(br(t,i.x,s.x,a.x,o.x),br(t,i.y,s.y,a.y,o.y),br(t,i.z,s.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class rh extends Rn{constructor(t=new tt,e=new tt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new tt){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new tt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Bf extends Rn{constructor(t=new R,e=new R){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new R){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new R){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class ah extends Rn{constructor(t=new tt,e=new tt,n=new tt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new tt){const n=e,i=this.v0,s=this.v1,a=this.v2;return n.set(yr(t,i.x,s.x,a.x),yr(t,i.y,s.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class oh extends Rn{constructor(t=new R,e=new R,n=new R){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new R){const n=e,i=this.v0,s=this.v1,a=this.v2;return n.set(yr(t,i.x,s.x,a.x),yr(t,i.y,s.y,a.y),yr(t,i.z,s.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class lh extends Rn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new tt){const n=e,i=this.points,s=(i.length-1)*t,a=Math.floor(s),o=s-a,l=i[a===0?a:a-1],c=i[a],h=i[a>i.length-2?i.length-1:a+1],u=i[a>i.length-3?i.length-1:a+2];return n.set(Gu(o,l.x,c.x,h.x,u.x),Gu(o,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new tt().fromArray(i))}return this}}var zo=Object.freeze({__proto__:null,ArcCurve:Nf,CatmullRomCurve3:Of,CubicBezierCurve:sh,CubicBezierCurve3:Ff,EllipseCurve:ol,LineCurve:rh,LineCurve3:Bf,QuadraticBezierCurve:ah,QuadraticBezierCurve3:oh,SplineCurve:lh});class zf extends Rn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new zo[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),i=this.getCurveLengths();let s=0;for(;s<i.length;){if(i[s]>=n){const a=i[s]-n,o=this.curves[s],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}s++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,i=this.curves.length;n<i;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let i=0,s=this.curves;i<s.length;i++){const a=s[i],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(i.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const i=this.curves[e];t.curves.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const i=t.curves[e];this.curves.push(new zo[i.type]().fromJSON(i))}return this}}class Pr extends zf{constructor(t){super(),this.type="Path",this.currentPoint=new tt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new rh(this.currentPoint.clone(),new tt(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,i){const s=new ah(this.currentPoint.clone(),new tt(t,e),new tt(n,i));return this.curves.push(s),this.currentPoint.set(n,i),this}bezierCurveTo(t,e,n,i,s,a){const o=new sh(this.currentPoint.clone(),new tt(t,e),new tt(n,i),new tt(s,a));return this.curves.push(o),this.currentPoint.set(s,a),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new lh(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,i,s,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,i,s,a),this}absarc(t,e,n,i,s,a){return this.absellipse(t,e,n,n,i,s,a),this}ellipse(t,e,n,i,s,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,i,s,a,o,l),this}absellipse(t,e,n,i,s,a,o,l){const c=new ol(t,e,n,i,s,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Zr extends qt{constructor(t=[new tt(0,-.5),new tt(.5,0),new tt(0,.5)],e=12,n=0,i=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:i},e=Math.floor(e),i=_e(i,0,Math.PI*2);const s=[],a=[],o=[],l=[],c=[],h=1/e,u=new R,d=new tt,f=new R,m=new R,x=new R;let g=0,p=0;for(let _=0;_<=t.length-1;_++)switch(_){case 0:g=t[_+1].x-t[_].x,p=t[_+1].y-t[_].y,f.x=p*1,f.y=-g,f.z=p*0,x.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:l.push(x.x,x.y,x.z);break;default:g=t[_+1].x-t[_].x,p=t[_+1].y-t[_].y,f.x=p*1,f.y=-g,f.z=p*0,m.copy(f),f.x+=x.x,f.y+=x.y,f.z+=x.z,f.normalize(),l.push(f.x,f.y,f.z),x.copy(m)}for(let _=0;_<=e;_++){const v=n+_*h*i,y=Math.sin(v),P=Math.cos(v);for(let S=0;S<=t.length-1;S++){u.x=t[S].x*y,u.y=t[S].y,u.z=t[S].x*P,a.push(u.x,u.y,u.z),d.x=_/e,d.y=S/(t.length-1),o.push(d.x,d.y);const T=l[3*S+0]*y,E=l[3*S+1],M=l[3*S+0]*P;c.push(T,E,M)}}for(let _=0;_<e;_++)for(let v=0;v<t.length-1;v++){const y=v+_*t.length,P=y,S=y+t.length,T=y+t.length+1,E=y+1;s.push(P,S,E),s.push(T,E,S)}this.setIndex(s),this.setAttribute("position",new Tt(a,3)),this.setAttribute("uv",new Tt(o,2)),this.setAttribute("normal",new Tt(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Zr(t.points,t.segments,t.phiStart,t.phiLength)}}class ll extends Zr{constructor(t=1,e=1,n=4,i=8){const s=new Pr;s.absarc(0,-e/2,t,Math.PI*1.5,0),s.absarc(0,e/2,t,0,Math.PI*.5),super(s.getPoints(n),i),this.type="CapsuleGeometry",this.parameters={radius:t,length:e,capSegments:n,radialSegments:i}}static fromJSON(t){return new ll(t.radius,t.length,t.capSegments,t.radialSegments)}}class cl extends qt{constructor(t=1,e=32,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:i},e=Math.max(3,e);const s=[],a=[],o=[],l=[],c=new R,h=new tt;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=e;u++,d+=3){const f=n+u/e*i;c.x=t*Math.cos(f),c.y=t*Math.sin(f),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/t+1)/2,h.y=(a[d+1]/t+1)/2,l.push(h.x,h.y)}for(let u=1;u<=e;u++)s.push(u,u+1,0);this.setIndex(s),this.setAttribute("position",new Tt(a,3)),this.setAttribute("normal",new Tt(o,3)),this.setAttribute("uv",new Tt(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new cl(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class cs extends qt{constructor(t=1,e=1,n=1,i=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),s=Math.floor(s);const h=[],u=[],d=[],f=[];let m=0;const x=[],g=n/2;let p=0;_(),a===!1&&(t>0&&v(!0),e>0&&v(!1)),this.setIndex(h),this.setAttribute("position",new Tt(u,3)),this.setAttribute("normal",new Tt(d,3)),this.setAttribute("uv",new Tt(f,2));function _(){const y=new R,P=new R;let S=0;const T=(e-t)/n;for(let E=0;E<=s;E++){const M=[],b=E/s,C=b*(e-t)+t;for(let N=0;N<=i;N++){const D=N/i,U=D*l+o,H=Math.sin(U),k=Math.cos(U);P.x=C*H,P.y=-b*n+g,P.z=C*k,u.push(P.x,P.y,P.z),y.set(H,T,k).normalize(),d.push(y.x,y.y,y.z),f.push(D,1-b),M.push(m++)}x.push(M)}for(let E=0;E<i;E++)for(let M=0;M<s;M++){const b=x[M][E],C=x[M+1][E],N=x[M+1][E+1],D=x[M][E+1];(t>0||M!==0)&&(h.push(b,C,D),S+=3),(e>0||M!==s-1)&&(h.push(C,N,D),S+=3)}c.addGroup(p,S,0),p+=S}function v(y){const P=m,S=new tt,T=new R;let E=0;const M=y===!0?t:e,b=y===!0?1:-1;for(let N=1;N<=i;N++)u.push(0,g*b,0),d.push(0,b,0),f.push(.5,.5),m++;const C=m;for(let N=0;N<=i;N++){const U=N/i*l+o,H=Math.cos(U),k=Math.sin(U);T.x=M*k,T.y=g*b,T.z=M*H,u.push(T.x,T.y,T.z),d.push(0,b,0),S.x=H*.5+.5,S.y=k*.5*b+.5,f.push(S.x,S.y),m++}for(let N=0;N<i;N++){const D=P+N,U=C+N;y===!0?h.push(U,U+1,D):h.push(U+1,U,D),E+=3}c.addGroup(p,E,y===!0?1:2),p+=E}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new cs(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class hl extends cs{constructor(t=1,e=1,n=32,i=1,s=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,s,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(t){return new hl(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Ei extends qt{constructor(t=[],e=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:i};const s=[],a=[];o(i),c(n),h(),this.setAttribute("position",new Tt(s,3)),this.setAttribute("normal",new Tt(s.slice(),3)),this.setAttribute("uv",new Tt(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function o(_){const v=new R,y=new R,P=new R;for(let S=0;S<e.length;S+=3)f(e[S+0],v),f(e[S+1],y),f(e[S+2],P),l(v,y,P,_)}function l(_,v,y,P){const S=P+1,T=[];for(let E=0;E<=S;E++){T[E]=[];const M=_.clone().lerp(y,E/S),b=v.clone().lerp(y,E/S),C=S-E;for(let N=0;N<=C;N++)N===0&&E===S?T[E][N]=M:T[E][N]=M.clone().lerp(b,N/C)}for(let E=0;E<S;E++)for(let M=0;M<2*(S-E)-1;M++){const b=Math.floor(M/2);M%2===0?(d(T[E][b+1]),d(T[E+1][b]),d(T[E][b])):(d(T[E][b+1]),d(T[E+1][b+1]),d(T[E+1][b]))}}function c(_){const v=new R;for(let y=0;y<s.length;y+=3)v.x=s[y+0],v.y=s[y+1],v.z=s[y+2],v.normalize().multiplyScalar(_),s[y+0]=v.x,s[y+1]=v.y,s[y+2]=v.z}function h(){const _=new R;for(let v=0;v<s.length;v+=3){_.x=s[v+0],_.y=s[v+1],_.z=s[v+2];const y=g(_)/2/Math.PI+.5,P=p(_)/Math.PI+.5;a.push(y,1-P)}m(),u()}function u(){for(let _=0;_<a.length;_+=6){const v=a[_+0],y=a[_+2],P=a[_+4],S=Math.max(v,y,P),T=Math.min(v,y,P);S>.9&&T<.1&&(v<.2&&(a[_+0]+=1),y<.2&&(a[_+2]+=1),P<.2&&(a[_+4]+=1))}}function d(_){s.push(_.x,_.y,_.z)}function f(_,v){const y=_*3;v.x=t[y+0],v.y=t[y+1],v.z=t[y+2]}function m(){const _=new R,v=new R,y=new R,P=new R,S=new tt,T=new tt,E=new tt;for(let M=0,b=0;M<s.length;M+=9,b+=6){_.set(s[M+0],s[M+1],s[M+2]),v.set(s[M+3],s[M+4],s[M+5]),y.set(s[M+6],s[M+7],s[M+8]),S.set(a[b+0],a[b+1]),T.set(a[b+2],a[b+3]),E.set(a[b+4],a[b+5]),P.copy(_).add(v).add(y).divideScalar(3);const C=g(P);x(S,b+0,_,C),x(T,b+2,v,C),x(E,b+4,y,C)}}function x(_,v,y,P){P<0&&_.x===1&&(a[v]=_.x-1),y.x===0&&y.z===0&&(a[v]=P/2/Math.PI+.5)}function g(_){return Math.atan2(_.z,-_.x)}function p(_){return Math.atan2(-_.y,Math.sqrt(_.x*_.x+_.z*_.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ei(t.vertices,t.indices,t.radius,t.details)}}class ul extends Ei{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=1/n,s=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(s,a,t,e),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new ul(t.radius,t.detail)}}const Ua=new R,Na=new R,ac=new R,Oa=new Qe;class kf extends qt{constructor(t=null,e=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:t,thresholdAngle:e},t!==null){const i=Math.pow(10,4),s=Math.cos(es*e),a=t.getIndex(),o=t.getAttribute("position"),l=a?a.count:o.count,c=[0,0,0],h=["a","b","c"],u=new Array(3),d={},f=[];for(let m=0;m<l;m+=3){a?(c[0]=a.getX(m),c[1]=a.getX(m+1),c[2]=a.getX(m+2)):(c[0]=m,c[1]=m+1,c[2]=m+2);const{a:x,b:g,c:p}=Oa;if(x.fromBufferAttribute(o,c[0]),g.fromBufferAttribute(o,c[1]),p.fromBufferAttribute(o,c[2]),Oa.getNormal(ac),u[0]=`${Math.round(x.x*i)},${Math.round(x.y*i)},${Math.round(x.z*i)}`,u[1]=`${Math.round(g.x*i)},${Math.round(g.y*i)},${Math.round(g.z*i)}`,u[2]=`${Math.round(p.x*i)},${Math.round(p.y*i)},${Math.round(p.z*i)}`,!(u[0]===u[1]||u[1]===u[2]||u[2]===u[0]))for(let _=0;_<3;_++){const v=(_+1)%3,y=u[_],P=u[v],S=Oa[h[_]],T=Oa[h[v]],E=`${y}_${P}`,M=`${P}_${y}`;M in d&&d[M]?(ac.dot(d[M].normal)<=s&&(f.push(S.x,S.y,S.z),f.push(T.x,T.y,T.z)),d[M]=null):E in d||(d[E]={index0:c[_],index1:c[v],normal:ac.clone()})}}for(const m in d)if(d[m]){const{index0:x,index1:g}=d[m];Ua.fromBufferAttribute(o,x),Na.fromBufferAttribute(o,g),f.push(Ua.x,Ua.y,Ua.z),f.push(Na.x,Na.y,Na.z)}this.setAttribute("position",new Tt(f,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}}class ns extends Pr{constructor(t){super(t),this.uuid=dn(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let n=0,i=this.holes.length;n<i;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){const i=this.holes[e];t.holes.push(i.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const i=t.holes[e];this.holes.push(new Pr().fromJSON(i))}return this}}const dy={triangulate:function(r,t,e=2){const n=t&&t.length,i=n?t[0]*e:r.length;let s=Hf(r,0,i,e,!0);const a=[];if(!s||s.next===s.prev)return a;let o,l,c,h,u,d,f;if(n&&(s=xy(r,t,s,e)),r.length>80*e){o=c=r[0],l=h=r[1];for(let m=e;m<i;m+=e)u=r[m],d=r[m+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);f=Math.max(c-o,h-l),f=f!==0?32767/f:0}return Lr(s,a,e,o,l,f,0),a}};function Hf(r,t,e,n,i){let s,a;if(i===Cy(r,t,e,n)>0)for(s=t;s<e;s+=n)a=Wu(s,r[s],r[s+1],a);else for(s=e-n;s>=t;s-=n)a=Wu(s,r[s],r[s+1],a);return a&&dl(a,a.next)&&(Ur(a),a=a.next),a}function os(r,t){if(!r)return r;t||(t=r);let e=r,n;do if(n=!1,!e.steiner&&(dl(e,e.next)||ge(e.prev,e,e.next)===0)){if(Ur(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Lr(r,t,e,n,i,s,a){if(!r)return;!a&&s&&My(r,n,i,s);let o=r,l,c;for(;r.prev!==r.next;){if(l=r.prev,c=r.next,s?py(r,n,i,s):fy(r)){t.push(l.i/e|0),t.push(r.i/e|0),t.push(c.i/e|0),Ur(r),r=c.next,o=c.next;continue}if(r=c,r===o){a?a===1?(r=my(os(r),t,e),Lr(r,t,e,n,i,s,2)):a===2&&gy(r,t,e,n,i,s):Lr(os(r),t,e,n,i,s,1);break}}}function fy(r){const t=r.prev,e=r,n=r.next;if(ge(t,e,n)>=0)return!1;const i=t.x,s=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=i<s?i<a?i:a:s<a?s:a,u=o<l?o<c?o:c:l<c?l:c,d=i>s?i>a?i:a:s>a?s:a,f=o>l?o>c?o:c:l>c?l:c;let m=n.next;for(;m!==t;){if(m.x>=h&&m.x<=d&&m.y>=u&&m.y<=f&&Fs(i,o,s,l,a,c,m.x,m.y)&&ge(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function py(r,t,e,n){const i=r.prev,s=r,a=r.next;if(ge(i,s,a)>=0)return!1;const o=i.x,l=s.x,c=a.x,h=i.y,u=s.y,d=a.y,f=o<l?o<c?o:c:l<c?l:c,m=h<u?h<d?h:d:u<d?u:d,x=o>l?o>c?o:c:l>c?l:c,g=h>u?h>d?h:d:u>d?u:d,p=Tc(f,m,t,e,n),_=Tc(x,g,t,e,n);let v=r.prevZ,y=r.nextZ;for(;v&&v.z>=p&&y&&y.z<=_;){if(v.x>=f&&v.x<=x&&v.y>=m&&v.y<=g&&v!==i&&v!==a&&Fs(o,h,l,u,c,d,v.x,v.y)&&ge(v.prev,v,v.next)>=0||(v=v.prevZ,y.x>=f&&y.x<=x&&y.y>=m&&y.y<=g&&y!==i&&y!==a&&Fs(o,h,l,u,c,d,y.x,y.y)&&ge(y.prev,y,y.next)>=0))return!1;y=y.nextZ}for(;v&&v.z>=p;){if(v.x>=f&&v.x<=x&&v.y>=m&&v.y<=g&&v!==i&&v!==a&&Fs(o,h,l,u,c,d,v.x,v.y)&&ge(v.prev,v,v.next)>=0)return!1;v=v.prevZ}for(;y&&y.z<=_;){if(y.x>=f&&y.x<=x&&y.y>=m&&y.y<=g&&y!==i&&y!==a&&Fs(o,h,l,u,c,d,y.x,y.y)&&ge(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function my(r,t,e){let n=r;do{const i=n.prev,s=n.next.next;!dl(i,s)&&Vf(i,n,n.next,s)&&Dr(i,s)&&Dr(s,i)&&(t.push(i.i/e|0),t.push(n.i/e|0),t.push(s.i/e|0),Ur(n),Ur(n.next),n=r=s),n=n.next}while(n!==r);return os(n)}function gy(r,t,e,n,i,s){let a=r;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Ty(a,o)){let l=Gf(a,o);a=os(a,a.next),l=os(l,l.next),Lr(a,t,e,n,i,s,0),Lr(l,t,e,n,i,s,0);return}o=o.next}a=a.next}while(a!==r)}function xy(r,t,e,n){const i=[];let s,a,o,l,c;for(s=0,a=t.length;s<a;s++)o=t[s]*n,l=s<a-1?t[s+1]*n:r.length,c=Hf(r,o,l,n,!1),c===c.next&&(c.steiner=!0),i.push(wy(c));for(i.sort(vy),s=0;s<i.length;s++)e=_y(i[s],e);return e}function vy(r,t){return r.x-t.x}function _y(r,t){const e=yy(r,t);if(!e)return t;const n=Gf(e,r);return os(n,n.next),os(e,e.next)}function yy(r,t){let e=t,n=-1/0,i;const s=r.x,a=r.y;do{if(a<=e.y&&a>=e.next.y&&e.next.y!==e.y){const d=e.x+(a-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=s&&d>n&&(n=d,i=e.x<e.next.x?e:e.next,d===s))return i}e=e.next}while(e!==t);if(!i)return null;const o=i,l=i.x,c=i.y;let h=1/0,u;e=i;do s>=e.x&&e.x>=l&&s!==e.x&&Fs(a<c?s:n,a,l,c,a<c?n:s,a,e.x,e.y)&&(u=Math.abs(a-e.y)/(s-e.x),Dr(e,r)&&(u<h||u===h&&(e.x>i.x||e.x===i.x&&by(i,e)))&&(i=e,h=u)),e=e.next;while(e!==o);return i}function by(r,t){return ge(r.prev,r,t.prev)<0&&ge(t.next,r,r.next)<0}function My(r,t,e,n){let i=r;do i.z===0&&(i.z=Tc(i.x,i.y,t,e,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==r);i.prevZ.nextZ=null,i.prevZ=null,Sy(i)}function Sy(r){let t,e,n,i,s,a,o,l,c=1;do{for(e=r,r=null,s=null,a=0;e;){for(a++,n=e,o=0,t=0;t<c&&(o++,n=n.nextZ,!!n);t++);for(l=c;o>0||l>0&&n;)o!==0&&(l===0||!n||e.z<=n.z)?(i=e,e=e.nextZ,o--):(i=n,n=n.nextZ,l--),s?s.nextZ=i:r=i,i.prevZ=s,s=i;e=n}s.nextZ=null,c*=2}while(a>1);return r}function Tc(r,t,e,n,i){return r=(r-e)*i|0,t=(t-n)*i|0,r=(r|r<<8)&16711935,r=(r|r<<4)&252645135,r=(r|r<<2)&858993459,r=(r|r<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,r|t<<1}function wy(r){let t=r,e=r;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==r);return e}function Fs(r,t,e,n,i,s,a,o){return(i-a)*(t-o)>=(r-a)*(s-o)&&(r-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(s-o)>=(i-a)*(n-o)}function Ty(r,t){return r.next.i!==t.i&&r.prev.i!==t.i&&!Ay(r,t)&&(Dr(r,t)&&Dr(t,r)&&Ey(r,t)&&(ge(r.prev,r,t.prev)||ge(r,t.prev,t))||dl(r,t)&&ge(r.prev,r,r.next)>0&&ge(t.prev,t,t.next)>0)}function ge(r,t,e){return(t.y-r.y)*(e.x-t.x)-(t.x-r.x)*(e.y-t.y)}function dl(r,t){return r.x===t.x&&r.y===t.y}function Vf(r,t,e,n){const i=Ba(ge(r,t,e)),s=Ba(ge(r,t,n)),a=Ba(ge(e,n,r)),o=Ba(ge(e,n,t));return!!(i!==s&&a!==o||i===0&&Fa(r,e,t)||s===0&&Fa(r,n,t)||a===0&&Fa(e,r,n)||o===0&&Fa(e,t,n))}function Fa(r,t,e){return t.x<=Math.max(r.x,e.x)&&t.x>=Math.min(r.x,e.x)&&t.y<=Math.max(r.y,e.y)&&t.y>=Math.min(r.y,e.y)}function Ba(r){return r>0?1:r<0?-1:0}function Ay(r,t){let e=r;do{if(e.i!==r.i&&e.next.i!==r.i&&e.i!==t.i&&e.next.i!==t.i&&Vf(e,e.next,r,t))return!0;e=e.next}while(e!==r);return!1}function Dr(r,t){return ge(r.prev,r,r.next)<0?ge(r,t,r.next)>=0&&ge(r,r.prev,t)>=0:ge(r,t,r.prev)<0||ge(r,r.next,t)<0}function Ey(r,t){let e=r,n=!1;const i=(r.x+t.x)/2,s=(r.y+t.y)/2;do e.y>s!=e.next.y>s&&e.next.y!==e.y&&i<(e.next.x-e.x)*(s-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==r);return n}function Gf(r,t){const e=new Ac(r.i,r.x,r.y),n=new Ac(t.i,t.x,t.y),i=r.next,s=t.prev;return r.next=t,t.prev=r,e.next=i,i.prev=e,n.next=e,e.prev=n,s.next=n,n.prev=s,n}function Wu(r,t,e,n){const i=new Ac(r,t,e);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function Ur(r){r.next.prev=r.prev,r.prev.next=r.next,r.prevZ&&(r.prevZ.nextZ=r.nextZ),r.nextZ&&(r.nextZ.prevZ=r.prevZ)}function Ac(r,t,e){this.i=r,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Cy(r,t,e,n){let i=0;for(let s=t,a=e-n;s<e;s+=n)i+=(r[a]-r[s])*(r[s+1]+r[a+1]),a=s;return i}class Bn{static area(t){const e=t.length;let n=0;for(let i=e-1,s=0;s<e;i=s++)n+=t[i].x*t[s].y-t[s].x*t[i].y;return n*.5}static isClockWise(t){return Bn.area(t)<0}static triangulateShape(t,e){const n=[],i=[],s=[];Xu(t),qu(n,t);let a=t.length;e.forEach(Xu);for(let l=0;l<e.length;l++)i.push(a),a+=e[l].length,qu(n,e[l]);const o=dy.triangulate(n,i);for(let l=0;l<o.length;l+=3)s.push(o.slice(l,l+3));return s}}function Xu(r){const t=r.length;t>2&&r[t-1].equals(r[0])&&r.pop()}function qu(r,t){for(let e=0;e<t.length;e++)r.push(t[e].x),r.push(t[e].y)}class fl extends qt{constructor(t=new ns([new tt(.5,.5),new tt(-.5,.5),new tt(-.5,-.5),new tt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const n=this,i=[],s=[];for(let o=0,l=t.length;o<l;o++){const c=t[o];a(c)}this.setAttribute("position",new Tt(i,3)),this.setAttribute("uv",new Tt(s,2)),this.computeVertexNormals();function a(o){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,m=e.bevelSize!==void 0?e.bevelSize:f-.1,x=e.bevelOffset!==void 0?e.bevelOffset:0,g=e.bevelSegments!==void 0?e.bevelSegments:3;const p=e.extrudePath,_=e.UVGenerator!==void 0?e.UVGenerator:Ry;let v,y=!1,P,S,T,E;p&&(v=p.getSpacedPoints(h),y=!0,d=!1,P=p.computeFrenetFrames(h,!1),S=new R,T=new R,E=new R),d||(g=0,f=0,m=0,x=0);const M=o.extractPoints(c);let b=M.shape;const C=M.holes;if(!Bn.isClockWise(b)){b=b.reverse();for(let et=0,at=C.length;et<at;et++){const L=C[et];Bn.isClockWise(L)&&(C[et]=L.reverse())}}const D=Bn.triangulateShape(b,C),U=b;for(let et=0,at=C.length;et<at;et++){const L=C[et];b=b.concat(L)}function H(et,at,L){return at||console.error("THREE.ExtrudeGeometry: vec does not exist"),et.clone().addScaledVector(at,L)}const k=b.length,G=D.length;function O(et,at,L){let It,st,Mt;const ut=et.x-at.x,Ot=et.y-at.y,_t=L.x-et.x,I=L.y-et.y,w=ut*ut+Ot*Ot,V=ut*I-Ot*_t;if(Math.abs(V)>Number.EPSILON){const $=Math.sqrt(w),nt=Math.sqrt(_t*_t+I*I),Z=at.x-Ot/$,At=at.y+ut/$,ft=L.x-I/nt,yt=L.y+_t/nt,Kt=((ft-Z)*I-(yt-At)*_t)/(ut*I-Ot*_t);It=Z+ut*Kt-et.x,st=At+Ot*Kt-et.y;const rt=It*It+st*st;if(rt<=2)return new tt(It,st);Mt=Math.sqrt(rt/2)}else{let $=!1;ut>Number.EPSILON?_t>Number.EPSILON&&($=!0):ut<-Number.EPSILON?_t<-Number.EPSILON&&($=!0):Math.sign(Ot)===Math.sign(I)&&($=!0),$?(It=-Ot,st=ut,Mt=Math.sqrt(w)):(It=ut,st=Ot,Mt=Math.sqrt(w/2))}return new tt(It/Mt,st/Mt)}const J=[];for(let et=0,at=U.length,L=at-1,It=et+1;et<at;et++,L++,It++)L===at&&(L=0),It===at&&(It=0),J[et]=O(U[et],U[L],U[It]);const K=[];let ot,bt=J.concat();for(let et=0,at=C.length;et<at;et++){const L=C[et];ot=[];for(let It=0,st=L.length,Mt=st-1,ut=It+1;It<st;It++,Mt++,ut++)Mt===st&&(Mt=0),ut===st&&(ut=0),ot[It]=O(L[It],L[Mt],L[ut]);K.push(ot),bt=bt.concat(ot)}for(let et=0;et<g;et++){const at=et/g,L=f*Math.cos(at*Math.PI/2),It=m*Math.sin(at*Math.PI/2)+x;for(let st=0,Mt=U.length;st<Mt;st++){const ut=H(U[st],J[st],It);lt(ut.x,ut.y,-L)}for(let st=0,Mt=C.length;st<Mt;st++){const ut=C[st];ot=K[st];for(let Ot=0,_t=ut.length;Ot<_t;Ot++){const I=H(ut[Ot],ot[Ot],It);lt(I.x,I.y,-L)}}}const Dt=m+x;for(let et=0;et<k;et++){const at=d?H(b[et],bt[et],Dt):b[et];y?(T.copy(P.normals[0]).multiplyScalar(at.x),S.copy(P.binormals[0]).multiplyScalar(at.y),E.copy(v[0]).add(T).add(S),lt(E.x,E.y,E.z)):lt(at.x,at.y,0)}for(let et=1;et<=h;et++)for(let at=0;at<k;at++){const L=d?H(b[at],bt[at],Dt):b[at];y?(T.copy(P.normals[et]).multiplyScalar(L.x),S.copy(P.binormals[et]).multiplyScalar(L.y),E.copy(v[et]).add(T).add(S),lt(E.x,E.y,E.z)):lt(L.x,L.y,u/h*et)}for(let et=g-1;et>=0;et--){const at=et/g,L=f*Math.cos(at*Math.PI/2),It=m*Math.sin(at*Math.PI/2)+x;for(let st=0,Mt=U.length;st<Mt;st++){const ut=H(U[st],J[st],It);lt(ut.x,ut.y,u+L)}for(let st=0,Mt=C.length;st<Mt;st++){const ut=C[st];ot=K[st];for(let Ot=0,_t=ut.length;Ot<_t;Ot++){const I=H(ut[Ot],ot[Ot],It);y?lt(I.x,I.y+v[h-1].y,v[h-1].x+L):lt(I.x,I.y,u+L)}}}Y(),it();function Y(){const et=i.length/3;if(d){let at=0,L=k*at;for(let It=0;It<G;It++){const st=D[It];Lt(st[2]+L,st[1]+L,st[0]+L)}at=h+g*2,L=k*at;for(let It=0;It<G;It++){const st=D[It];Lt(st[0]+L,st[1]+L,st[2]+L)}}else{for(let at=0;at<G;at++){const L=D[at];Lt(L[2],L[1],L[0])}for(let at=0;at<G;at++){const L=D[at];Lt(L[0]+k*h,L[1]+k*h,L[2]+k*h)}}n.addGroup(et,i.length/3-et,0)}function it(){const et=i.length/3;let at=0;mt(U,at),at+=U.length;for(let L=0,It=C.length;L<It;L++){const st=C[L];mt(st,at),at+=st.length}n.addGroup(et,i.length/3-et,1)}function mt(et,at){let L=et.length;for(;--L>=0;){const It=L;let st=L-1;st<0&&(st=et.length-1);for(let Mt=0,ut=h+g*2;Mt<ut;Mt++){const Ot=k*Mt,_t=k*(Mt+1),I=at+It+Ot,w=at+st+Ot,V=at+st+_t,$=at+It+_t;Bt(I,w,V,$)}}}function lt(et,at,L){l.push(et),l.push(at),l.push(L)}function Lt(et,at,L){Nt(et),Nt(at),Nt(L);const It=i.length/3,st=_.generateTopUV(n,i,It-3,It-2,It-1);Zt(st[0]),Zt(st[1]),Zt(st[2])}function Bt(et,at,L,It){Nt(et),Nt(at),Nt(It),Nt(at),Nt(L),Nt(It);const st=i.length/3,Mt=_.generateSideWallUV(n,i,st-6,st-3,st-2,st-1);Zt(Mt[0]),Zt(Mt[1]),Zt(Mt[3]),Zt(Mt[1]),Zt(Mt[2]),Zt(Mt[3])}function Nt(et){i.push(l[et*3+0]),i.push(l[et*3+1]),i.push(l[et*3+2])}function Zt(et){s.push(et.x),s.push(et.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return Iy(e,n,t)}static fromJSON(t,e){const n=[];for(let s=0,a=t.shapes.length;s<a;s++){const o=e[t.shapes[s]];n.push(o)}const i=t.options.extrudePath;return i!==void 0&&(t.options.extrudePath=new zo[i.type]().fromJSON(i)),new fl(n,t.options)}}const Ry={generateTopUV:function(r,t,e,n,i){const s=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[i*3],h=t[i*3+1];return[new tt(s,a),new tt(o,l),new tt(c,h)]},generateSideWallUV:function(r,t,e,n,i,s){const a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[i*3],f=t[i*3+1],m=t[i*3+2],x=t[s*3],g=t[s*3+1],p=t[s*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new tt(a,1-l),new tt(c,1-u),new tt(d,1-m),new tt(x,1-p)]:[new tt(o,1-l),new tt(h,1-u),new tt(f,1-m),new tt(g,1-p)]}};function Iy(r,t,e){if(e.shapes=[],Array.isArray(r))for(let n=0,i=r.length;n<i;n++){const s=r[n];e.shapes.push(s.uuid)}else e.shapes.push(r.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class pl extends Ei{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(i,s,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new pl(t.radius,t.detail)}}class Kr extends Ei{constructor(t=1,e=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],i=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,i,t,e),this.type="OctahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new Kr(t.radius,t.detail)}}class ml extends qt{constructor(t=.5,e=1,n=32,i=1,s=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:a},n=Math.max(3,n),i=Math.max(1,i);const o=[],l=[],c=[],h=[];let u=t;const d=(e-t)/i,f=new R,m=new tt;for(let x=0;x<=i;x++){for(let g=0;g<=n;g++){const p=s+g/n*a;f.x=u*Math.cos(p),f.y=u*Math.sin(p),l.push(f.x,f.y,f.z),c.push(0,0,1),m.x=(f.x/e+1)/2,m.y=(f.y/e+1)/2,h.push(m.x,m.y)}u+=d}for(let x=0;x<i;x++){const g=x*(n+1);for(let p=0;p<n;p++){const _=p+g,v=_,y=_+n+1,P=_+n+2,S=_+1;o.push(v,y,S),o.push(y,P,S)}}this.setIndex(o),this.setAttribute("position",new Tt(l,3)),this.setAttribute("normal",new Tt(c,3)),this.setAttribute("uv",new Tt(h,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ml(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class gl extends qt{constructor(t=new ns([new tt(0,.5),new tt(-.5,-.5),new tt(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};const n=[],i=[],s=[],a=[];let o=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let h=0;h<t.length;h++)c(t[h]),this.addGroup(o,l,h),o+=l,l=0;this.setIndex(n),this.setAttribute("position",new Tt(i,3)),this.setAttribute("normal",new Tt(s,3)),this.setAttribute("uv",new Tt(a,2));function c(h){const u=i.length/3,d=h.extractPoints(e);let f=d.shape;const m=d.holes;Bn.isClockWise(f)===!1&&(f=f.reverse());for(let g=0,p=m.length;g<p;g++){const _=m[g];Bn.isClockWise(_)===!0&&(m[g]=_.reverse())}const x=Bn.triangulateShape(f,m);for(let g=0,p=m.length;g<p;g++){const _=m[g];f=f.concat(_)}for(let g=0,p=f.length;g<p;g++){const _=f[g];i.push(_.x,_.y,0),s.push(0,0,1),a.push(_.x,_.y)}for(let g=0,p=x.length;g<p;g++){const _=x[g],v=_[0]+u,y=_[1]+u,P=_[2]+u;n.push(v,y,P),l+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes;return Py(e,t)}static fromJSON(t,e){const n=[];for(let i=0,s=t.shapes.length;i<s;i++){const a=e[t.shapes[i]];n.push(a)}return new gl(n,t.curveSegments)}}function Py(r,t){if(t.shapes=[],Array.isArray(r))for(let e=0,n=r.length;e<n;e++){const i=r[e];t.shapes.push(i.uuid)}else t.shapes.push(r.uuid);return t}class hs extends qt{constructor(t=1,e=32,n=16,i=0,s=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:s,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new R,d=new R,f=[],m=[],x=[],g=[];for(let p=0;p<=n;p++){const _=[],v=p/n;let y=0;p===0&&a===0?y=.5/e:p===n&&l===Math.PI&&(y=-.5/e);for(let P=0;P<=e;P++){const S=P/e;u.x=-t*Math.cos(i+S*s)*Math.sin(a+v*o),u.y=t*Math.cos(a+v*o),u.z=t*Math.sin(i+S*s)*Math.sin(a+v*o),m.push(u.x,u.y,u.z),d.copy(u).normalize(),x.push(d.x,d.y,d.z),g.push(S+y,1-v),_.push(c++)}h.push(_)}for(let p=0;p<n;p++)for(let _=0;_<e;_++){const v=h[p][_+1],y=h[p][_],P=h[p+1][_],S=h[p+1][_+1];(p!==0||a>0)&&f.push(v,y,S),(p!==n-1||l<Math.PI)&&f.push(y,P,S)}this.setIndex(f),this.setAttribute("position",new Tt(m,3)),this.setAttribute("normal",new Tt(x,3)),this.setAttribute("uv",new Tt(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new hs(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class xl extends Ei{constructor(t=1,e=0){const n=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],i=[2,1,0,0,3,2,1,3,0,2,3,1];super(n,i,t,e),this.type="TetrahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new xl(t.radius,t.detail)}}class vl extends qt{constructor(t=1,e=.4,n=12,i=48,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:i,arc:s},n=Math.floor(n),i=Math.floor(i);const a=[],o=[],l=[],c=[],h=new R,u=new R,d=new R;for(let f=0;f<=n;f++)for(let m=0;m<=i;m++){const x=m/i*s,g=f/n*Math.PI*2;u.x=(t+e*Math.cos(g))*Math.cos(x),u.y=(t+e*Math.cos(g))*Math.sin(x),u.z=e*Math.sin(g),o.push(u.x,u.y,u.z),h.x=t*Math.cos(x),h.y=t*Math.sin(x),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(m/i),c.push(f/n)}for(let f=1;f<=n;f++)for(let m=1;m<=i;m++){const x=(i+1)*f+m-1,g=(i+1)*(f-1)+m-1,p=(i+1)*(f-1)+m,_=(i+1)*f+m;a.push(x,g,_),a.push(g,p,_)}this.setIndex(a),this.setAttribute("position",new Tt(o,3)),this.setAttribute("normal",new Tt(l,3)),this.setAttribute("uv",new Tt(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new vl(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class _l extends qt{constructor(t=1,e=.4,n=64,i=8,s=2,a=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:t,tube:e,tubularSegments:n,radialSegments:i,p:s,q:a},n=Math.floor(n),i=Math.floor(i);const o=[],l=[],c=[],h=[],u=new R,d=new R,f=new R,m=new R,x=new R,g=new R,p=new R;for(let v=0;v<=n;++v){const y=v/n*s*Math.PI*2;_(y,s,a,t,f),_(y+.01,s,a,t,m),g.subVectors(m,f),p.addVectors(m,f),x.crossVectors(g,p),p.crossVectors(x,g),x.normalize(),p.normalize();for(let P=0;P<=i;++P){const S=P/i*Math.PI*2,T=-e*Math.cos(S),E=e*Math.sin(S);u.x=f.x+(T*p.x+E*x.x),u.y=f.y+(T*p.y+E*x.y),u.z=f.z+(T*p.z+E*x.z),l.push(u.x,u.y,u.z),d.subVectors(u,f).normalize(),c.push(d.x,d.y,d.z),h.push(v/n),h.push(P/i)}}for(let v=1;v<=n;v++)for(let y=1;y<=i;y++){const P=(i+1)*(v-1)+(y-1),S=(i+1)*v+(y-1),T=(i+1)*v+y,E=(i+1)*(v-1)+y;o.push(P,S,E),o.push(S,T,E)}this.setIndex(o),this.setAttribute("position",new Tt(l,3)),this.setAttribute("normal",new Tt(c,3)),this.setAttribute("uv",new Tt(h,2));function _(v,y,P,S,T){const E=Math.cos(v),M=Math.sin(v),b=P/y*v,C=Math.cos(b);T.x=S*(2+C)*.5*E,T.y=S*(2+C)*M*.5,T.z=S*Math.sin(b)*.5}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new _l(t.radius,t.tube,t.tubularSegments,t.radialSegments,t.p,t.q)}}class yl extends qt{constructor(t=new oh(new R(-1,-1,0),new R(-1,1,0),new R(1,1,0)),e=64,n=1,i=8,s=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:i,closed:s};const a=t.computeFrenetFrames(e,s);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;const o=new R,l=new R,c=new tt;let h=new R;const u=[],d=[],f=[],m=[];x(),this.setIndex(m),this.setAttribute("position",new Tt(u,3)),this.setAttribute("normal",new Tt(d,3)),this.setAttribute("uv",new Tt(f,2));function x(){for(let v=0;v<e;v++)g(v);g(s===!1?e:0),_(),p()}function g(v){h=t.getPointAt(v/e,h);const y=a.normals[v],P=a.binormals[v];for(let S=0;S<=i;S++){const T=S/i*Math.PI*2,E=Math.sin(T),M=-Math.cos(T);l.x=M*y.x+E*P.x,l.y=M*y.y+E*P.y,l.z=M*y.z+E*P.z,l.normalize(),d.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,u.push(o.x,o.y,o.z)}}function p(){for(let v=1;v<=e;v++)for(let y=1;y<=i;y++){const P=(i+1)*(v-1)+(y-1),S=(i+1)*v+(y-1),T=(i+1)*v+y,E=(i+1)*(v-1)+y;m.push(P,S,E),m.push(S,T,E)}}function _(){for(let v=0;v<=e;v++)for(let y=0;y<=i;y++)c.x=v/e,c.y=y/i,f.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new yl(new zo[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}}class Wf extends qt{constructor(t=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:t},t!==null){const e=[],n=new Set,i=new R,s=new R;if(t.index!==null){const a=t.attributes.position,o=t.index;let l=t.groups;l.length===0&&(l=[{start:0,count:o.count,materialIndex:0}]);for(let c=0,h=l.length;c<h;++c){const u=l[c],d=u.start,f=u.count;for(let m=d,x=d+f;m<x;m+=3)for(let g=0;g<3;g++){const p=o.getX(m+g),_=o.getX(m+(g+1)%3);i.fromBufferAttribute(a,p),s.fromBufferAttribute(a,_),Yu(i,s,n)===!0&&(e.push(i.x,i.y,i.z),e.push(s.x,s.y,s.z))}}}else{const a=t.attributes.position;for(let o=0,l=a.count/3;o<l;o++)for(let c=0;c<3;c++){const h=3*o+c,u=3*o+(c+1)%3;i.fromBufferAttribute(a,h),s.fromBufferAttribute(a,u),Yu(i,s,n)===!0&&(e.push(i.x,i.y,i.z),e.push(s.x,s.y,s.z))}}this.setAttribute("position",new Tt(e,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}}function Yu(r,t,e){const n=`${r.x},${r.y},${r.z}-${t.x},${t.y},${t.z}`,i=`${t.x},${t.y},${t.z}-${r.x},${r.y},${r.z}`;return e.has(n)===!0||e.has(i)===!0?!1:(e.add(n),e.add(i),!0)}var $u=Object.freeze({__proto__:null,BoxGeometry:Ai,CapsuleGeometry:ll,CircleGeometry:cl,ConeGeometry:hl,CylinderGeometry:cs,DodecahedronGeometry:ul,EdgesGeometry:kf,ExtrudeGeometry:fl,IcosahedronGeometry:pl,LatheGeometry:Zr,OctahedronGeometry:Kr,PlaneGeometry:Hn,PolyhedronGeometry:Ei,RingGeometry:ml,ShapeGeometry:gl,SphereGeometry:hs,TetrahedronGeometry:xl,TorusGeometry:vl,TorusKnotGeometry:_l,TubeGeometry:yl,WireframeGeometry:Wf});class Xf extends ke{static get type(){return"ShadowMaterial"}constructor(t){super(),this.isShadowMaterial=!0,this.color=new ht(0),this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.fog=t.fog,this}}class qf extends Ye{static get type(){return"RawShaderMaterial"}constructor(t){super(t),this.isRawShaderMaterial=!0}}class Nr extends ke{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new ht(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ti,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ze,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Yf extends Nr{static get type(){return"MeshPhysicalMaterial"}constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new tt(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return _e(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new ht(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new ht(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new ht(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}}class $f extends ke{static get type(){return"MeshPhongMaterial"}constructor(t){super(),this.isMeshPhongMaterial=!0,this.color=new ht(16777215),this.specular=new ht(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ti,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ze,this.combine=Hr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.specular.copy(t.specular),this.shininess=t.shininess,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Zf extends ke{static get type(){return"MeshToonMaterial"}constructor(t){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.color=new ht(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ti,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.gradientMap=t.gradientMap,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.alphaMap=t.alphaMap,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}class Kf extends ke{static get type(){return"MeshNormalMaterial"}constructor(t){super(),this.isMeshNormalMaterial=!0,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ti,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(t)}copy(t){return super.copy(t),this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.flatShading=t.flatShading,this}}class Jf extends ke{static get type(){return"MeshLambertMaterial"}constructor(t){super(),this.isMeshLambertMaterial=!0,this.color=new ht(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ti,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ze,this.combine=Hr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class jf extends ke{static get type(){return"MeshMatcapMaterial"}constructor(t){super(),this.isMeshMatcapMaterial=!0,this.defines={MATCAP:""},this.color=new ht(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ti,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={MATCAP:""},this.color.copy(t.color),this.matcap=t.matcap,this.map=t.map,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.alphaMap=t.alphaMap,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Qf extends $e{static get type(){return"LineDashedMaterial"}constructor(t){super(),this.isLineDashedMaterial=!0,this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}}function Ji(r,t,e){return!r||!e&&r.constructor===t?r:typeof t.BYTES_PER_ELEMENT=="number"?new t(r):Array.prototype.slice.call(r)}function tp(r){return ArrayBuffer.isView(r)&&!(r instanceof DataView)}function ep(r){function t(i,s){return r[i]-r[s]}const e=r.length,n=new Array(e);for(let i=0;i!==e;++i)n[i]=i;return n.sort(t),n}function Ec(r,t,e){const n=r.length,i=new r.constructor(n);for(let s=0,a=0;a!==n;++s){const o=e[s]*t;for(let l=0;l!==t;++l)i[a++]=r[o+l]}return i}function ch(r,t,e,n){let i=1,s=r[0];for(;s!==void 0&&s[n]===void 0;)s=r[i++];if(s===void 0)return;let a=s[n];if(a!==void 0)if(Array.isArray(a))do a=s[n],a!==void 0&&(t.push(s.time),e.push.apply(e,a)),s=r[i++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[n],a!==void 0&&(t.push(s.time),a.toArray(e,e.length)),s=r[i++];while(s!==void 0);else do a=s[n],a!==void 0&&(t.push(s.time),e.push(a)),s=r[i++];while(s!==void 0)}function Ly(r,t,e,n,i=30){const s=r.clone();s.name=t;const a=[];for(let l=0;l<s.tracks.length;++l){const c=s.tracks[l],h=c.getValueSize(),u=[],d=[];for(let f=0;f<c.times.length;++f){const m=c.times[f]*i;if(!(m<e||m>=n)){u.push(c.times[f]);for(let x=0;x<h;++x)d.push(c.values[f*h+x])}}u.length!==0&&(c.times=Ji(u,c.times.constructor),c.values=Ji(d,c.values.constructor),a.push(c))}s.tracks=a;let o=1/0;for(let l=0;l<s.tracks.length;++l)o>s.tracks[l].times[0]&&(o=s.tracks[l].times[0]);for(let l=0;l<s.tracks.length;++l)s.tracks[l].shift(-1*o);return s.resetDuration(),s}function Dy(r,t=0,e=r,n=30){n<=0&&(n=30);const i=e.tracks.length,s=t/n;for(let a=0;a<i;++a){const o=e.tracks[a],l=o.ValueTypeName;if(l==="bool"||l==="string")continue;const c=r.tracks.find(function(p){return p.name===o.name&&p.ValueTypeName===l});if(c===void 0)continue;let h=0;const u=o.getValueSize();o.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(h=u/3);let d=0;const f=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(d=f/3);const m=o.times.length-1;let x;if(s<=o.times[0]){const p=h,_=u-h;x=o.values.slice(p,_)}else if(s>=o.times[m]){const p=m*u+h,_=p+u-h;x=o.values.slice(p,_)}else{const p=o.createInterpolant(),_=h,v=u-h;p.evaluate(s),x=p.resultBuffer.slice(_,v)}l==="quaternion"&&new Ae().fromArray(x).normalize().conjugate().toArray(x);const g=c.times.length;for(let p=0;p<g;++p){const _=p*f+d;if(l==="quaternion")Ae.multiplyQuaternionsFlat(c.values,_,x,0,c.values,_);else{const v=f-d*2;for(let y=0;y<v;++y)c.values[_+y]-=x[y]}}}return r.blendMode=Xc,r}const Uy={convertArray:Ji,isTypedArray:tp,getKeyframeOrder:ep,sortedArray:Ec,flattenJSON:ch,subclip:Ly,makeClipAdditive:Dy};class Jr{constructor(t,e,n,i){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){const e=this.parameterPositions;let n=this._cachedIndex,i=e[n],s=e[n-1];t:{e:{let a;n:{i:if(!(t<i)){for(let o=n+2;;){if(i===void 0){if(t<s)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=i,i=e[++n],t<i)break e}a=e.length;break n}if(!(t>=s)){const o=e[1];t<o&&(n=2,s=o);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=s,s=e[--n-1],t>=s)break e}a=n,n=0;break n}break t}for(;n<a;){const o=n+a>>>1;t<e[o]?a=o:n=o+1}if(i=e[n],s=e[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,t,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){const e=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=t*i;for(let a=0;a!==i;++a)e[a]=n[s+a];return e}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class np extends Jr{constructor(t,e,n,i){super(t,e,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:$i,endingEnd:$i}}intervalChanged_(t,e,n){const i=this.parameterPositions;let s=t-2,a=t+1,o=i[s],l=i[a];if(o===void 0)switch(this.getSettings_().endingStart){case Zi:s=t,o=2*e-n;break;case Er:s=i.length-2,o=e+i[s]-i[s+1];break;default:s=t,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Zi:a=t,l=2*n-e;break;case Er:a=1,l=n+i[1]-i[0];break;default:a=t-1,l=e}const c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(l-n),this._offsetPrev=s*h,this._offsetNext=a*h}interpolate_(t,e,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,m=(n-e)/(i-e),x=m*m,g=x*m,p=-d*g+2*d*x-d*m,_=(1+d)*g+(-1.5-2*d)*x+(-.5+d)*m+1,v=(-1-f)*g+(1.5+f)*x+.5*m,y=f*g-f*x;for(let P=0;P!==o;++P)s[P]=p*a[h+P]+_*a[c+P]+v*a[l+P]+y*a[u+P];return s}}class hh extends Jr{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t,e,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(n-e)/(i-e),u=1-h;for(let d=0;d!==o;++d)s[d]=a[c+d]*u+a[l+d]*h;return s}}class ip extends Jr{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t){return this.copySampleValue_(t-1)}}class In{constructor(t,e,n,i){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Ji(e,this.TimeBufferType),this.values=Ji(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(t){const e=t.constructor;let n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:Ji(t.times,Array),values:Ji(t.values,Array)};const i=t.getInterpolation();i!==t.DefaultInterpolation&&(n.interpolation=i)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new ip(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new hh(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new np(this.times,this.values,this.getValueSize(),t)}setInterpolation(t){let e;switch(t){case Ar:e=this.InterpolantFactoryMethodDiscrete;break;case No:e=this.InterpolantFactoryMethodLinear;break;case Ka:e=this.InterpolantFactoryMethodSmooth;break}if(e===void 0){const n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Ar;case this.InterpolantFactoryMethodLinear:return No;case this.InterpolantFactoryMethodSmooth:return Ka}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){const e=this.times;for(let n=0,i=e.length;n!==i;++n)e[n]+=t}return this}scale(t){if(t!==1){const e=this.times;for(let n=0,i=e.length;n!==i;++n)e[n]*=t}return this}trim(t,e){const n=this.times,i=n.length;let s=0,a=i-1;for(;s!==i&&n[s]<t;)++s;for(;a!==-1&&n[a]>e;)--a;if(++a,s!==0||a!==i){s>=a&&(a=Math.max(a,1),s=a-1);const o=this.getValueSize();this.times=n.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let t=!0;const e=this.getValueSize();e-Math.floor(e)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),t=!1);const n=this.times,i=this.values,s=n.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==s;o++){const l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),t=!1;break}a=l}if(i!==void 0&&tp(i))for(let o=0,l=i.length;o!==l;++o){const c=i[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){const t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Ka,s=t.length-1;let a=1;for(let o=1;o<s;++o){let l=!1;const c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(i)l=!0;else{const u=o*n,d=u-n,f=u+n;for(let m=0;m!==n;++m){const x=e[u+m];if(x!==e[d+m]||x!==e[f+m]){l=!0;break}}}if(l){if(o!==a){t[a]=t[o];const u=o*n,d=a*n;for(let f=0;f!==n;++f)e[d+f]=e[u+f]}++a}}if(s>0){t[a]=t[s];for(let o=s*n,l=a*n,c=0;c!==n;++c)e[l+c]=e[o+c];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){const t=this.times.slice(),e=this.values.slice(),n=this.constructor,i=new n(this.name,t,e);return i.createInterpolant=this.createInterpolant,i}}In.prototype.TimeBufferType=Float32Array;In.prototype.ValueBufferType=Float32Array;In.prototype.DefaultInterpolation=No;class us extends In{constructor(t,e,n){super(t,e,n)}}us.prototype.ValueTypeName="bool";us.prototype.ValueBufferType=Array;us.prototype.DefaultInterpolation=Ar;us.prototype.InterpolantFactoryMethodLinear=void 0;us.prototype.InterpolantFactoryMethodSmooth=void 0;class uh extends In{}uh.prototype.ValueTypeName="color";class Or extends In{}Or.prototype.ValueTypeName="number";class sp extends Jr{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t,e,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-e)/(i-e);let c=t*o;for(let h=c+o;c!==h;c+=4)Ae.slerpFlat(s,0,a,c-o,a,c,l);return s}}class jr extends In{InterpolantFactoryMethodLinear(t){return new sp(this.times,this.values,this.getValueSize(),t)}}jr.prototype.ValueTypeName="quaternion";jr.prototype.InterpolantFactoryMethodSmooth=void 0;class ds extends In{constructor(t,e,n){super(t,e,n)}}ds.prototype.ValueTypeName="string";ds.prototype.ValueBufferType=Array;ds.prototype.DefaultInterpolation=Ar;ds.prototype.InterpolantFactoryMethodLinear=void 0;ds.prototype.InterpolantFactoryMethodSmooth=void 0;class Fr extends In{}Fr.prototype.ValueTypeName="vector";class Br{constructor(t="",e=-1,n=[],i=jo){this.name=t,this.tracks=n,this.duration=e,this.blendMode=i,this.uuid=dn(),this.duration<0&&this.resetDuration()}static parse(t){const e=[],n=t.tracks,i=1/(t.fps||1);for(let a=0,o=n.length;a!==o;++a)e.push(Oy(n[a]).scale(i));const s=new this(t.name,t.duration,e,t.blendMode);return s.uuid=t.uuid,s}static toJSON(t){const e=[],n=t.tracks,i={name:t.name,duration:t.duration,tracks:e,uuid:t.uuid,blendMode:t.blendMode};for(let s=0,a=n.length;s!==a;++s)e.push(In.toJSON(n[s]));return i}static CreateFromMorphTargetSequence(t,e,n,i){const s=e.length,a=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);const h=ep(l);l=Ec(l,1,h),c=Ec(c,1,h),!i&&l[0]===0&&(l.push(s),c.push(c[0])),a.push(new Or(".morphTargetInfluences["+e[o].name+"]",l,c).scale(1/n))}return new this(t,-1,a)}static findByName(t,e){let n=t;if(!Array.isArray(t)){const i=t;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===e)return n[i];return null}static CreateClipsFromMorphTargetSequences(t,e,n){const i={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=t.length;o<l;o++){const c=t[o],h=c.name.match(s);if(h&&h.length>1){const u=h[1];let d=i[u];d||(i[u]=d=[]),d.push(c)}}const a=[];for(const o in i)a.push(this.CreateFromMorphTargetSequence(o,i[o],e,n));return a}static parseAnimation(t,e){if(!t)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const n=function(u,d,f,m,x){if(f.length!==0){const g=[],p=[];ch(f,g,p,m),g.length!==0&&x.push(new u(d,g,p))}},i=[],s=t.name||"default",a=t.fps||30,o=t.blendMode;let l=t.length||-1;const c=t.hierarchy||[];for(let u=0;u<c.length;u++){const d=c[u].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const f={};let m;for(m=0;m<d.length;m++)if(d[m].morphTargets)for(let x=0;x<d[m].morphTargets.length;x++)f[d[m].morphTargets[x]]=-1;for(const x in f){const g=[],p=[];for(let _=0;_!==d[m].morphTargets.length;++_){const v=d[m];g.push(v.time),p.push(v.morphTarget===x?1:0)}i.push(new Or(".morphTargetInfluence["+x+"]",g,p))}l=f.length*a}else{const f=".bones["+e[u].name+"]";n(Fr,f+".position",d,"pos",i),n(jr,f+".quaternion",d,"rot",i),n(Fr,f+".scale",d,"scl",i)}}return i.length===0?null:new this(s,l,i,o)}resetDuration(){const t=this.tracks;let e=0;for(let n=0,i=t.length;n!==i;++n){const s=this.tracks[n];e=Math.max(e,s.times[s.times.length-1])}return this.duration=e,this}trim(){for(let t=0;t<this.tracks.length;t++)this.tracks[t].trim(0,this.duration);return this}validate(){let t=!0;for(let e=0;e<this.tracks.length;e++)t=t&&this.tracks[e].validate();return t}optimize(){for(let t=0;t<this.tracks.length;t++)this.tracks[t].optimize();return this}clone(){const t=[];for(let e=0;e<this.tracks.length;e++)t.push(this.tracks[e].clone());return new this.constructor(this.name,this.duration,t,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}}function Ny(r){switch(r.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Or;case"vector":case"vector2":case"vector3":case"vector4":return Fr;case"color":return uh;case"quaternion":return jr;case"bool":case"boolean":return us;case"string":return ds}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+r)}function Oy(r){if(r.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const t=Ny(r.type);if(r.times===void 0){const e=[],n=[];ch(r.keys,e,n,"value"),r.times=e,r.values=n}return t.parse!==void 0?t.parse(r):new t(r.name,r.times,r.values,r.interpolation)}const ei={enabled:!1,files:{},add:function(r,t){this.enabled!==!1&&(this.files[r]=t)},get:function(r){if(this.enabled!==!1)return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}};class dh{constructor(t,e,n){const i=this;let s=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(h){o++,s===!1&&i.onStart!==void 0&&i.onStart(h,a,o),s=!0},this.itemEnd=function(h){a++,i.onProgress!==void 0&&i.onProgress(h,a,o),a===o&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){const u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){const f=c[u],m=c[u+1];if(f.global&&(f.lastIndex=0),f.test(h))return m}return null}}}const rp=new dh;class en{constructor(t){this.manager=t!==void 0?t:rp,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){const n=this;return new Promise(function(i,s){n.load(t,i,e,s)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}}en.DEFAULT_MATERIAL_NAME="__DEFAULT";const Kn={};class Fy extends Error{constructor(t,e){super(t),this.response=e}}class li extends en{constructor(t){super(t)}load(t,e,n,i){t===void 0&&(t=""),this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const s=ei.get(t);if(s!==void 0)return this.manager.itemStart(t),setTimeout(()=>{e&&e(s),this.manager.itemEnd(t)},0),s;if(Kn[t]!==void 0){Kn[t].push({onLoad:e,onProgress:n,onError:i});return}Kn[t]=[],Kn[t].push({onLoad:e,onProgress:n,onError:i});const a=new Request(t,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const h=Kn[t],u=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),f=d?parseInt(d):0,m=f!==0;let x=0;const g=new ReadableStream({start(p){_();function _(){u.read().then(({done:v,value:y})=>{if(v)p.close();else{x+=y.byteLength;const P=new ProgressEvent("progress",{lengthComputable:m,loaded:x,total:f});for(let S=0,T=h.length;S<T;S++){const E=h[S];E.onProgress&&E.onProgress(P)}p.enqueue(y),_()}},v=>{p.error(v)})}}});return new Response(g)}else throw new Fy(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,o));case"json":return c.json();default:if(o===void 0)return c.text();{const u=/charset="?([^;"\s]*)"?/i.exec(o),d=u&&u[1]?u[1].toLowerCase():void 0,f=new TextDecoder(d);return c.arrayBuffer().then(m=>f.decode(m))}}}).then(c=>{ei.add(t,c);const h=Kn[t];delete Kn[t];for(let u=0,d=h.length;u<d;u++){const f=h[u];f.onLoad&&f.onLoad(c)}}).catch(c=>{const h=Kn[t];if(h===void 0)throw this.manager.itemError(t),c;delete Kn[t];for(let u=0,d=h.length;u<d;u++){const f=h[u];f.onError&&f.onError(c)}this.manager.itemError(t)}).finally(()=>{this.manager.itemEnd(t)}),this.manager.itemStart(t)}setResponseType(t){return this.responseType=t,this}setMimeType(t){return this.mimeType=t,this}}class By extends en{constructor(t){super(t)}load(t,e,n,i){const s=this,a=new li(this.manager);a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(t,function(o){try{e(s.parse(JSON.parse(o)))}catch(l){i?i(l):console.error(l),s.manager.itemError(t)}},n,i)}parse(t){const e=[];for(let n=0;n<t.length;n++){const i=Br.parse(t[n]);e.push(i)}return e}}class zy extends en{constructor(t){super(t)}load(t,e,n,i){const s=this,a=[],o=new al,l=new li(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(s.withCredentials);let c=0;function h(u){l.load(t[u],function(d){const f=s.parse(d,!0);a[u]={width:f.width,height:f.height,format:f.format,mipmaps:f.mipmaps},c+=1,c===6&&(f.mipmapCount===1&&(o.minFilter=we),o.image=a,o.format=f.format,o.needsUpdate=!0,e&&e(o))},n,i)}if(Array.isArray(t))for(let u=0,d=t.length;u<d;++u)h(u);else l.load(t,function(u){const d=s.parse(u,!0);if(d.isCubemap){const f=d.mipmaps.length/d.mipmapCount;for(let m=0;m<f;m++){a[m]={mipmaps:[]};for(let x=0;x<d.mipmapCount;x++)a[m].mipmaps.push(d.mipmaps[m*d.mipmapCount+x]),a[m].format=d.format,a[m].width=d.width,a[m].height=d.height}o.image=a}else o.image.width=d.width,o.image.height=d.height,o.mipmaps=d.mipmaps;d.mipmapCount===1&&(o.minFilter=we),o.format=d.format,o.needsUpdate=!0,e&&e(o)},n,i);return o}}class zr extends en{constructor(t){super(t)}load(t,e,n,i){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const s=this,a=ei.get(t);if(a!==void 0)return s.manager.itemStart(t),setTimeout(function(){e&&e(a),s.manager.itemEnd(t)},0),a;const o=Ir("img");function l(){h(),ei.add(t,this),e&&e(this),s.manager.itemEnd(t)}function c(u){h(),i&&i(u),s.manager.itemError(t),s.manager.itemEnd(t)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),s.manager.itemStart(t),o.src=t,o}}class ky extends en{constructor(t){super(t)}load(t,e,n,i){const s=new Wr;s.colorSpace=me;const a=new zr(this.manager);a.setCrossOrigin(this.crossOrigin),a.setPath(this.path);let o=0;function l(c){a.load(t[c],function(h){s.images[c]=h,o++,o===6&&(s.needsUpdate=!0,e&&e(s))},void 0,i)}for(let c=0;c<t.length;++c)l(c);return s}}class Hy extends en{constructor(t){super(t)}load(t,e,n,i){const s=this,a=new Fn,o=new li(this.manager);return o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setPath(this.path),o.setWithCredentials(s.withCredentials),o.load(t,function(l){let c;try{c=s.parse(l)}catch(h){if(i!==void 0)i(h);else{console.error(h);return}}c.image!==void 0?a.image=c.image:c.data!==void 0&&(a.image.width=c.width,a.image.height=c.height,a.image.data=c.data),a.wrapS=c.wrapS!==void 0?c.wrapS:un,a.wrapT=c.wrapT!==void 0?c.wrapT:un,a.magFilter=c.magFilter!==void 0?c.magFilter:we,a.minFilter=c.minFilter!==void 0?c.minFilter:we,a.anisotropy=c.anisotropy!==void 0?c.anisotropy:1,c.colorSpace!==void 0&&(a.colorSpace=c.colorSpace),c.flipY!==void 0&&(a.flipY=c.flipY),c.format!==void 0&&(a.format=c.format),c.type!==void 0&&(a.type=c.type),c.mipmaps!==void 0&&(a.mipmaps=c.mipmaps,a.minFilter=vn),c.mipmapCount===1&&(a.minFilter=we),c.generateMipmaps!==void 0&&(a.generateMipmaps=c.generateMipmaps),a.needsUpdate=!0,e&&e(a,c)},n,i),a}}class Vy extends en{constructor(t){super(t)}load(t,e,n,i){const s=new ye,a=new zr(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(t,function(o){s.image=o,s.needsUpdate=!0,e!==void 0&&e(s)},n,i),s}}class Ci extends ee{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new ht(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class fh extends Ci{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ee.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ht(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const oc=new Ut,Zu=new R,Ku=new R;class ph{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new tt(512,512),this.map=null,this.mapPass=null,this.matrix=new Ut,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Xr,this._frameExtents=new tt(1,1),this._viewportCount=1,this._viewports=[new te(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;Zu.setFromMatrixPosition(t.matrixWorld),e.position.copy(Zu),Ku.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ku),e.updateMatrixWorld(),oc.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(oc),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(oc)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class Gy extends ph{constructor(){super(new Pe(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(t){const e=this.camera,n=Gs*2*t.angle*this.focus,i=this.mapSize.width/this.mapSize.height,s=t.distance||e.far;(n!==e.fov||i!==e.aspect||s!==e.far)&&(e.fov=n,e.aspect=i,e.far=s,e.updateProjectionMatrix()),super.updateMatrices(t)}copy(t){return super.copy(t),this.focus=t.focus,this}}class ap extends Ci{constructor(t,e,n=0,i=Math.PI/3,s=0,a=2){super(t,e),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(ee.DEFAULT_UP),this.updateMatrix(),this.target=new ee,this.distance=n,this.angle=i,this.penumbra=s,this.decay=a,this.map=null,this.shadow=new Gy}get power(){return this.intensity*Math.PI}set power(t){this.intensity=t/Math.PI}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.angle=t.angle,this.penumbra=t.penumbra,this.decay=t.decay,this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}const Ju=new Ut,lr=new R,lc=new R;class Wy extends ph{constructor(){super(new Pe(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new tt(4,2),this._viewportCount=6,this._viewports=[new te(2,1,1,1),new te(0,1,1,1),new te(3,1,1,1),new te(1,1,1,1),new te(3,0,1,1),new te(1,0,1,1)],this._cubeDirections=[new R(1,0,0),new R(-1,0,0),new R(0,0,1),new R(0,0,-1),new R(0,1,0),new R(0,-1,0)],this._cubeUps=[new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,0,1),new R(0,0,-1)]}updateMatrices(t,e=0){const n=this.camera,i=this.matrix,s=t.distance||n.far;s!==n.far&&(n.far=s,n.updateProjectionMatrix()),lr.setFromMatrixPosition(t.matrixWorld),n.position.copy(lr),lc.copy(n.position),lc.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt(lc),n.updateMatrixWorld(),i.makeTranslation(-lr.x,-lr.y,-lr.z),Ju.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ju)}}class mh extends Ci{constructor(t,e,n=0,i=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Wy}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class Xy extends ph{constructor(){super(new qr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class gh extends Ci{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ee.DEFAULT_UP),this.updateMatrix(),this.target=new ee,this.shadow=new Xy}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class op extends Ci{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}class lp extends Ci{constructor(t,e,n=10,i=10){super(t,e),this.isRectAreaLight=!0,this.type="RectAreaLight",this.width=n,this.height=i}get power(){return this.intensity*this.width*this.height*Math.PI}set power(t){this.intensity=t/(this.width*this.height*Math.PI)}copy(t){return super.copy(t),this.width=t.width,this.height=t.height,this}toJSON(t){const e=super.toJSON(t);return e.object.width=this.width,e.object.height=this.height,e}}class cp{constructor(){this.isSphericalHarmonics3=!0,this.coefficients=[];for(let t=0;t<9;t++)this.coefficients.push(new R)}set(t){for(let e=0;e<9;e++)this.coefficients[e].copy(t[e]);return this}zero(){for(let t=0;t<9;t++)this.coefficients[t].set(0,0,0);return this}getAt(t,e){const n=t.x,i=t.y,s=t.z,a=this.coefficients;return e.copy(a[0]).multiplyScalar(.282095),e.addScaledVector(a[1],.488603*i),e.addScaledVector(a[2],.488603*s),e.addScaledVector(a[3],.488603*n),e.addScaledVector(a[4],1.092548*(n*i)),e.addScaledVector(a[5],1.092548*(i*s)),e.addScaledVector(a[6],.315392*(3*s*s-1)),e.addScaledVector(a[7],1.092548*(n*s)),e.addScaledVector(a[8],.546274*(n*n-i*i)),e}getIrradianceAt(t,e){const n=t.x,i=t.y,s=t.z,a=this.coefficients;return e.copy(a[0]).multiplyScalar(.886227),e.addScaledVector(a[1],2*.511664*i),e.addScaledVector(a[2],2*.511664*s),e.addScaledVector(a[3],2*.511664*n),e.addScaledVector(a[4],2*.429043*n*i),e.addScaledVector(a[5],2*.429043*i*s),e.addScaledVector(a[6],.743125*s*s-.247708),e.addScaledVector(a[7],2*.429043*n*s),e.addScaledVector(a[8],.429043*(n*n-i*i)),e}add(t){for(let e=0;e<9;e++)this.coefficients[e].add(t.coefficients[e]);return this}addScaledSH(t,e){for(let n=0;n<9;n++)this.coefficients[n].addScaledVector(t.coefficients[n],e);return this}scale(t){for(let e=0;e<9;e++)this.coefficients[e].multiplyScalar(t);return this}lerp(t,e){for(let n=0;n<9;n++)this.coefficients[n].lerp(t.coefficients[n],e);return this}equals(t){for(let e=0;e<9;e++)if(!this.coefficients[e].equals(t.coefficients[e]))return!1;return!0}copy(t){return this.set(t.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(t,e=0){const n=this.coefficients;for(let i=0;i<9;i++)n[i].fromArray(t,e+i*3);return this}toArray(t=[],e=0){const n=this.coefficients;for(let i=0;i<9;i++)n[i].toArray(t,e+i*3);return t}static getBasisAt(t,e){const n=t.x,i=t.y,s=t.z;e[0]=.282095,e[1]=.488603*i,e[2]=.488603*s,e[3]=.488603*n,e[4]=1.092548*n*i,e[5]=1.092548*i*s,e[6]=.315392*(3*s*s-1),e[7]=1.092548*n*s,e[8]=.546274*(n*n-i*i)}}class hp extends Ci{constructor(t=new cp,e=1){super(void 0,e),this.isLightProbe=!0,this.sh=t}copy(t){return super.copy(t),this.sh.copy(t.sh),this}fromJSON(t){return this.intensity=t.intensity,this.sh.fromArray(t.sh),this}toJSON(t){const e=super.toJSON(t);return e.object.sh=this.sh.toArray(),e}}class bl extends en{constructor(t){super(t),this.textures={}}load(t,e,n,i){const s=this,a=new li(s.manager);a.setPath(s.path),a.setRequestHeader(s.requestHeader),a.setWithCredentials(s.withCredentials),a.load(t,function(o){try{e(s.parse(JSON.parse(o)))}catch(l){i?i(l):console.error(l),s.manager.itemError(t)}},n,i)}parse(t){const e=this.textures;function n(s){return e[s]===void 0&&console.warn("THREE.MaterialLoader: Undefined texture",s),e[s]}const i=this.createMaterialFromType(t.type);if(t.uuid!==void 0&&(i.uuid=t.uuid),t.name!==void 0&&(i.name=t.name),t.color!==void 0&&i.color!==void 0&&i.color.setHex(t.color),t.roughness!==void 0&&(i.roughness=t.roughness),t.metalness!==void 0&&(i.metalness=t.metalness),t.sheen!==void 0&&(i.sheen=t.sheen),t.sheenColor!==void 0&&(i.sheenColor=new ht().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(i.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&i.emissive!==void 0&&i.emissive.setHex(t.emissive),t.specular!==void 0&&i.specular!==void 0&&i.specular.setHex(t.specular),t.specularIntensity!==void 0&&(i.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&i.specularColor!==void 0&&i.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(i.shininess=t.shininess),t.clearcoat!==void 0&&(i.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(i.dispersion=t.dispersion),t.iridescence!==void 0&&(i.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(i.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(i.transmission=t.transmission),t.thickness!==void 0&&(i.thickness=t.thickness),t.attenuationDistance!==void 0&&(i.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&i.attenuationColor!==void 0&&i.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(i.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(i.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(i.fog=t.fog),t.flatShading!==void 0&&(i.flatShading=t.flatShading),t.blending!==void 0&&(i.blending=t.blending),t.combine!==void 0&&(i.combine=t.combine),t.side!==void 0&&(i.side=t.side),t.shadowSide!==void 0&&(i.shadowSide=t.shadowSide),t.opacity!==void 0&&(i.opacity=t.opacity),t.transparent!==void 0&&(i.transparent=t.transparent),t.alphaTest!==void 0&&(i.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(i.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(i.depthFunc=t.depthFunc),t.depthTest!==void 0&&(i.depthTest=t.depthTest),t.depthWrite!==void 0&&(i.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(i.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(i.blendSrc=t.blendSrc),t.blendDst!==void 0&&(i.blendDst=t.blendDst),t.blendEquation!==void 0&&(i.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(i.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(i.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(i.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&i.blendColor!==void 0&&i.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(i.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(i.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(i.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(i.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(i.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(i.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(i.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(i.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(i.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(i.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(i.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(i.rotation=t.rotation),t.linewidth!==void 0&&(i.linewidth=t.linewidth),t.dashSize!==void 0&&(i.dashSize=t.dashSize),t.gapSize!==void 0&&(i.gapSize=t.gapSize),t.scale!==void 0&&(i.scale=t.scale),t.polygonOffset!==void 0&&(i.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(i.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(i.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(i.dithering=t.dithering),t.alphaToCoverage!==void 0&&(i.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(i.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(i.forceSinglePass=t.forceSinglePass),t.visible!==void 0&&(i.visible=t.visible),t.toneMapped!==void 0&&(i.toneMapped=t.toneMapped),t.userData!==void 0&&(i.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?i.vertexColors=t.vertexColors>0:i.vertexColors=t.vertexColors),t.uniforms!==void 0)for(const s in t.uniforms){const a=t.uniforms[s];switch(i.uniforms[s]={},a.type){case"t":i.uniforms[s].value=n(a.value);break;case"c":i.uniforms[s].value=new ht().setHex(a.value);break;case"v2":i.uniforms[s].value=new tt().fromArray(a.value);break;case"v3":i.uniforms[s].value=new R().fromArray(a.value);break;case"v4":i.uniforms[s].value=new te().fromArray(a.value);break;case"m3":i.uniforms[s].value=new Ht().fromArray(a.value);break;case"m4":i.uniforms[s].value=new Ut().fromArray(a.value);break;default:i.uniforms[s].value=a.value}}if(t.defines!==void 0&&(i.defines=t.defines),t.vertexShader!==void 0&&(i.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(i.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(i.glslVersion=t.glslVersion),t.extensions!==void 0)for(const s in t.extensions)i.extensions[s]=t.extensions[s];if(t.lights!==void 0&&(i.lights=t.lights),t.clipping!==void 0&&(i.clipping=t.clipping),t.size!==void 0&&(i.size=t.size),t.sizeAttenuation!==void 0&&(i.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(i.map=n(t.map)),t.matcap!==void 0&&(i.matcap=n(t.matcap)),t.alphaMap!==void 0&&(i.alphaMap=n(t.alphaMap)),t.bumpMap!==void 0&&(i.bumpMap=n(t.bumpMap)),t.bumpScale!==void 0&&(i.bumpScale=t.bumpScale),t.normalMap!==void 0&&(i.normalMap=n(t.normalMap)),t.normalMapType!==void 0&&(i.normalMapType=t.normalMapType),t.normalScale!==void 0){let s=t.normalScale;Array.isArray(s)===!1&&(s=[s,s]),i.normalScale=new tt().fromArray(s)}return t.displacementMap!==void 0&&(i.displacementMap=n(t.displacementMap)),t.displacementScale!==void 0&&(i.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(i.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(i.roughnessMap=n(t.roughnessMap)),t.metalnessMap!==void 0&&(i.metalnessMap=n(t.metalnessMap)),t.emissiveMap!==void 0&&(i.emissiveMap=n(t.emissiveMap)),t.emissiveIntensity!==void 0&&(i.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(i.specularMap=n(t.specularMap)),t.specularIntensityMap!==void 0&&(i.specularIntensityMap=n(t.specularIntensityMap)),t.specularColorMap!==void 0&&(i.specularColorMap=n(t.specularColorMap)),t.envMap!==void 0&&(i.envMap=n(t.envMap)),t.envMapRotation!==void 0&&i.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(i.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(i.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(i.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(i.lightMap=n(t.lightMap)),t.lightMapIntensity!==void 0&&(i.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(i.aoMap=n(t.aoMap)),t.aoMapIntensity!==void 0&&(i.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(i.gradientMap=n(t.gradientMap)),t.clearcoatMap!==void 0&&(i.clearcoatMap=n(t.clearcoatMap)),t.clearcoatRoughnessMap!==void 0&&(i.clearcoatRoughnessMap=n(t.clearcoatRoughnessMap)),t.clearcoatNormalMap!==void 0&&(i.clearcoatNormalMap=n(t.clearcoatNormalMap)),t.clearcoatNormalScale!==void 0&&(i.clearcoatNormalScale=new tt().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(i.iridescenceMap=n(t.iridescenceMap)),t.iridescenceThicknessMap!==void 0&&(i.iridescenceThicknessMap=n(t.iridescenceThicknessMap)),t.transmissionMap!==void 0&&(i.transmissionMap=n(t.transmissionMap)),t.thicknessMap!==void 0&&(i.thicknessMap=n(t.thicknessMap)),t.anisotropyMap!==void 0&&(i.anisotropyMap=n(t.anisotropyMap)),t.sheenColorMap!==void 0&&(i.sheenColorMap=n(t.sheenColorMap)),t.sheenRoughnessMap!==void 0&&(i.sheenRoughnessMap=n(t.sheenRoughnessMap)),i}setTextures(t){return this.textures=t,this}createMaterialFromType(t){return bl.createMaterialFromType(t)}static createMaterialFromType(t){const e={ShadowMaterial:Xf,SpriteMaterial:On,RawShaderMaterial:qf,ShaderMaterial:Ye,PointsMaterial:nh,MeshPhysicalMaterial:Yf,MeshStandardMaterial:Nr,MeshPhongMaterial:$f,MeshToonMaterial:Zf,MeshNormalMaterial:Kf,MeshLambertMaterial:Jf,MeshDepthMaterial:Qc,MeshDistanceMaterial:th,MeshBasicMaterial:yn,MeshMatcapMaterial:jf,LineDashedMaterial:Qf,LineBasicMaterial:$e,Material:ke};return new e[t]}}class Cc{static decodeText(t){if(console.warn("THREE.LoaderUtils: decodeText() has been deprecated with r165 and will be removed with r175. Use TextDecoder instead."),typeof TextDecoder<"u")return new TextDecoder().decode(t);let e="";for(let n=0,i=t.length;n<i;n++)e+=String.fromCharCode(t[n]);try{return decodeURIComponent(escape(e))}catch{return e}}static extractUrlBase(t){const e=t.lastIndexOf("/");return e===-1?"./":t.slice(0,e+1)}static resolveURL(t,e){return typeof t!="string"||t===""?"":(/^https?:\/\//i.test(e)&&/^\//.test(t)&&(e=e.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(t)||/^data:.*,.*$/i.test(t)||/^blob:.*$/i.test(t)?t:e+t)}}class xh extends qt{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(t){return super.copy(t),this.instanceCount=t.instanceCount,this}toJSON(){const t=super.toJSON();return t.instanceCount=this.instanceCount,t.isInstancedBufferGeometry=!0,t}}class up extends en{constructor(t){super(t)}load(t,e,n,i){const s=this,a=new li(s.manager);a.setPath(s.path),a.setRequestHeader(s.requestHeader),a.setWithCredentials(s.withCredentials),a.load(t,function(o){try{e(s.parse(JSON.parse(o)))}catch(l){i?i(l):console.error(l),s.manager.itemError(t)}},n,i)}parse(t){const e={},n={};function i(f,m){if(e[m]!==void 0)return e[m];const g=f.interleavedBuffers[m],p=s(f,g.buffer),_=Us(g.type,p),v=new sl(_,g.stride);return v.uuid=g.uuid,e[m]=v,v}function s(f,m){if(n[m]!==void 0)return n[m];const g=f.arrayBuffers[m],p=new Uint32Array(g).buffer;return n[m]=p,p}const a=t.isInstancedBufferGeometry?new xh:new qt,o=t.data.index;if(o!==void 0){const f=Us(o.type,o.array);a.setIndex(new oe(f,1))}const l=t.data.attributes;for(const f in l){const m=l[f];let x;if(m.isInterleavedBufferAttribute){const g=i(t.data,m.data);x=new as(g,m.itemSize,m.offset,m.normalized)}else{const g=Us(m.type,m.array),p=m.isInstancedBufferAttribute?je:oe;x=new p(g,m.itemSize,m.normalized)}m.name!==void 0&&(x.name=m.name),m.usage!==void 0&&x.setUsage(m.usage),a.setAttribute(f,x)}const c=t.data.morphAttributes;if(c)for(const f in c){const m=c[f],x=[];for(let g=0,p=m.length;g<p;g++){const _=m[g];let v;if(_.isInterleavedBufferAttribute){const y=i(t.data,_.data);v=new as(y,_.itemSize,_.offset,_.normalized)}else{const y=Us(_.type,_.array);v=new oe(y,_.itemSize,_.normalized)}_.name!==void 0&&(v.name=_.name),x.push(v)}a.morphAttributes[f]=x}t.data.morphTargetsRelative&&(a.morphTargetsRelative=!0);const u=t.data.groups||t.data.drawcalls||t.data.offsets;if(u!==void 0)for(let f=0,m=u.length;f!==m;++f){const x=u[f];a.addGroup(x.start,x.count,x.materialIndex)}const d=t.data.boundingSphere;if(d!==void 0){const f=new R;d.center!==void 0&&f.fromArray(d.center),a.boundingSphere=new Be(f,d.radius)}return t.name&&(a.name=t.name),t.userData&&(a.userData=t.userData),a}}class qy extends en{constructor(t){super(t)}load(t,e,n,i){const s=this,a=this.path===""?Cc.extractUrlBase(t):this.path;this.resourcePath=this.resourcePath||a;const o=new li(this.manager);o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(t,function(l){let c=null;try{c=JSON.parse(l)}catch(u){i!==void 0&&i(u),console.error("THREE:ObjectLoader: Can't parse "+t+".",u.message);return}const h=c.metadata;if(h===void 0||h.type===void 0||h.type.toLowerCase()==="geometry"){i!==void 0&&i(new Error("THREE.ObjectLoader: Can't load "+t)),console.error("THREE.ObjectLoader: Can't load "+t);return}s.parse(c,e)},n,i)}async loadAsync(t,e){const n=this,i=this.path===""?Cc.extractUrlBase(t):this.path;this.resourcePath=this.resourcePath||i;const s=new li(this.manager);s.setPath(this.path),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials);const a=await s.loadAsync(t,e),o=JSON.parse(a),l=o.metadata;if(l===void 0||l.type===void 0||l.type.toLowerCase()==="geometry")throw new Error("THREE.ObjectLoader: Can't load "+t);return await n.parseAsync(o)}parse(t,e){const n=this.parseAnimations(t.animations),i=this.parseShapes(t.shapes),s=this.parseGeometries(t.geometries,i),a=this.parseImages(t.images,function(){e!==void 0&&e(c)}),o=this.parseTextures(t.textures,a),l=this.parseMaterials(t.materials,o),c=this.parseObject(t.object,s,l,o,n),h=this.parseSkeletons(t.skeletons,c);if(this.bindSkeletons(c,h),this.bindLightTargets(c),e!==void 0){let u=!1;for(const d in a)if(a[d].data instanceof HTMLImageElement){u=!0;break}u===!1&&e(c)}return c}async parseAsync(t){const e=this.parseAnimations(t.animations),n=this.parseShapes(t.shapes),i=this.parseGeometries(t.geometries,n),s=await this.parseImagesAsync(t.images),a=this.parseTextures(t.textures,s),o=this.parseMaterials(t.materials,a),l=this.parseObject(t.object,i,o,a,e),c=this.parseSkeletons(t.skeletons,l);return this.bindSkeletons(l,c),this.bindLightTargets(l),l}parseShapes(t){const e={};if(t!==void 0)for(let n=0,i=t.length;n<i;n++){const s=new ns().fromJSON(t[n]);e[s.uuid]=s}return e}parseSkeletons(t,e){const n={},i={};if(e.traverse(function(s){s.isBone&&(i[s.uuid]=s)}),t!==void 0)for(let s=0,a=t.length;s<a;s++){const o=new rl().fromJSON(t[s],i);n[o.uuid]=o}return n}parseGeometries(t,e){const n={};if(t!==void 0){const i=new up;for(let s=0,a=t.length;s<a;s++){let o;const l=t[s];switch(l.type){case"BufferGeometry":case"InstancedBufferGeometry":o=i.parse(l);break;default:l.type in $u?o=$u[l.type].fromJSON(l,e):console.warn(`THREE.ObjectLoader: Unsupported geometry type "${l.type}"`)}o.uuid=l.uuid,l.name!==void 0&&(o.name=l.name),l.userData!==void 0&&(o.userData=l.userData),n[l.uuid]=o}}return n}parseMaterials(t,e){const n={},i={};if(t!==void 0){const s=new bl;s.setTextures(e);for(let a=0,o=t.length;a<o;a++){const l=t[a];n[l.uuid]===void 0&&(n[l.uuid]=s.parse(l)),i[l.uuid]=n[l.uuid]}}return i}parseAnimations(t){const e={};if(t!==void 0)for(let n=0;n<t.length;n++){const i=t[n],s=Br.parse(i);e[s.uuid]=s}return e}parseImages(t,e){const n=this,i={};let s;function a(l){return n.manager.itemStart(l),s.load(l,function(){n.manager.itemEnd(l)},void 0,function(){n.manager.itemError(l),n.manager.itemEnd(l)})}function o(l){if(typeof l=="string"){const c=l,h=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(c)?c:n.resourcePath+c;return a(h)}else return l.data?{data:Us(l.type,l.data),width:l.width,height:l.height}:null}if(t!==void 0&&t.length>0){const l=new dh(e);s=new zr(l),s.setCrossOrigin(this.crossOrigin);for(let c=0,h=t.length;c<h;c++){const u=t[c],d=u.url;if(Array.isArray(d)){const f=[];for(let m=0,x=d.length;m<x;m++){const g=d[m],p=o(g);p!==null&&(p instanceof HTMLImageElement?f.push(p):f.push(new Fn(p.data,p.width,p.height)))}i[u.uuid]=new Ki(f)}else{const f=o(u.url);i[u.uuid]=new Ki(f)}}}return i}async parseImagesAsync(t){const e=this,n={};let i;async function s(a){if(typeof a=="string"){const o=a,l=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(o)?o:e.resourcePath+o;return await i.loadAsync(l)}else return a.data?{data:Us(a.type,a.data),width:a.width,height:a.height}:null}if(t!==void 0&&t.length>0){i=new zr(this.manager),i.setCrossOrigin(this.crossOrigin);for(let a=0,o=t.length;a<o;a++){const l=t[a],c=l.url;if(Array.isArray(c)){const h=[];for(let u=0,d=c.length;u<d;u++){const f=c[u],m=await s(f);m!==null&&(m instanceof HTMLImageElement?h.push(m):h.push(new Fn(m.data,m.width,m.height)))}n[l.uuid]=new Ki(h)}else{const h=await s(l.url);n[l.uuid]=new Ki(h)}}}return n}parseTextures(t,e){function n(s,a){return typeof s=="number"?s:(console.warn("THREE.ObjectLoader.parseTexture: Constant should be in numeric form.",s),a[s])}const i={};if(t!==void 0)for(let s=0,a=t.length;s<a;s++){const o=t[s];o.image===void 0&&console.warn('THREE.ObjectLoader: No "image" specified for',o.uuid),e[o.image]===void 0&&console.warn("THREE.ObjectLoader: Undefined image",o.image);const l=e[o.image],c=l.data;let h;Array.isArray(c)?(h=new Wr,c.length===6&&(h.needsUpdate=!0)):(c&&c.data?h=new Fn:h=new ye,c&&(h.needsUpdate=!0)),h.source=l,h.uuid=o.uuid,o.name!==void 0&&(h.name=o.name),o.mapping!==void 0&&(h.mapping=n(o.mapping,Yy)),o.channel!==void 0&&(h.channel=o.channel),o.offset!==void 0&&h.offset.fromArray(o.offset),o.repeat!==void 0&&h.repeat.fromArray(o.repeat),o.center!==void 0&&h.center.fromArray(o.center),o.rotation!==void 0&&(h.rotation=o.rotation),o.wrap!==void 0&&(h.wrapS=n(o.wrap[0],ju),h.wrapT=n(o.wrap[1],ju)),o.format!==void 0&&(h.format=o.format),o.internalFormat!==void 0&&(h.internalFormat=o.internalFormat),o.type!==void 0&&(h.type=o.type),o.colorSpace!==void 0&&(h.colorSpace=o.colorSpace),o.minFilter!==void 0&&(h.minFilter=n(o.minFilter,Qu)),o.magFilter!==void 0&&(h.magFilter=n(o.magFilter,Qu)),o.anisotropy!==void 0&&(h.anisotropy=o.anisotropy),o.flipY!==void 0&&(h.flipY=o.flipY),o.generateMipmaps!==void 0&&(h.generateMipmaps=o.generateMipmaps),o.premultiplyAlpha!==void 0&&(h.premultiplyAlpha=o.premultiplyAlpha),o.unpackAlignment!==void 0&&(h.unpackAlignment=o.unpackAlignment),o.compareFunction!==void 0&&(h.compareFunction=o.compareFunction),o.userData!==void 0&&(h.userData=o.userData),i[o.uuid]=h}return i}parseObject(t,e,n,i,s){let a;function o(d){return e[d]===void 0&&console.warn("THREE.ObjectLoader: Undefined geometry",d),e[d]}function l(d){if(d!==void 0){if(Array.isArray(d)){const f=[];for(let m=0,x=d.length;m<x;m++){const g=d[m];n[g]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",g),f.push(n[g])}return f}return n[d]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",d),n[d]}}function c(d){return i[d]===void 0&&console.warn("THREE.ObjectLoader: Undefined texture",d),i[d]}let h,u;switch(t.type){case"Scene":a=new $r,t.background!==void 0&&(Number.isInteger(t.background)?a.background=new ht(t.background):a.background=c(t.background)),t.environment!==void 0&&(a.environment=c(t.environment)),t.fog!==void 0&&(t.fog.type==="Fog"?a.fog=new Yr(t.fog.color,t.fog.near,t.fog.far):t.fog.type==="FogExp2"&&(a.fog=new il(t.fog.color,t.fog.density)),t.fog.name!==""&&(a.fog.name=t.fog.name)),t.backgroundBlurriness!==void 0&&(a.backgroundBlurriness=t.backgroundBlurriness),t.backgroundIntensity!==void 0&&(a.backgroundIntensity=t.backgroundIntensity),t.backgroundRotation!==void 0&&a.backgroundRotation.fromArray(t.backgroundRotation),t.environmentIntensity!==void 0&&(a.environmentIntensity=t.environmentIntensity),t.environmentRotation!==void 0&&a.environmentRotation.fromArray(t.environmentRotation);break;case"PerspectiveCamera":a=new Pe(t.fov,t.aspect,t.near,t.far),t.focus!==void 0&&(a.focus=t.focus),t.zoom!==void 0&&(a.zoom=t.zoom),t.filmGauge!==void 0&&(a.filmGauge=t.filmGauge),t.filmOffset!==void 0&&(a.filmOffset=t.filmOffset),t.view!==void 0&&(a.view=Object.assign({},t.view));break;case"OrthographicCamera":a=new qr(t.left,t.right,t.top,t.bottom,t.near,t.far),t.zoom!==void 0&&(a.zoom=t.zoom),t.view!==void 0&&(a.view=Object.assign({},t.view));break;case"AmbientLight":a=new op(t.color,t.intensity);break;case"DirectionalLight":a=new gh(t.color,t.intensity),a.target=t.target||"";break;case"PointLight":a=new mh(t.color,t.intensity,t.distance,t.decay);break;case"RectAreaLight":a=new lp(t.color,t.intensity,t.width,t.height);break;case"SpotLight":a=new ap(t.color,t.intensity,t.distance,t.angle,t.penumbra,t.decay),a.target=t.target||"";break;case"HemisphereLight":a=new fh(t.color,t.groundColor,t.intensity);break;case"LightProbe":a=new hp().fromJSON(t);break;case"SkinnedMesh":h=o(t.geometry),u=l(t.material),a=new Pf(h,u),t.bindMode!==void 0&&(a.bindMode=t.bindMode),t.bindMatrix!==void 0&&a.bindMatrix.fromArray(t.bindMatrix),t.skeleton!==void 0&&(a.skeleton=t.skeleton);break;case"Mesh":h=o(t.geometry),u=l(t.material),a=new ue(h,u);break;case"InstancedMesh":h=o(t.geometry),u=l(t.material);const d=t.count,f=t.instanceMatrix,m=t.instanceColor;a=new Os(h,u,d),a.instanceMatrix=new je(new Float32Array(f.array),16),m!==void 0&&(a.instanceColor=new je(new Float32Array(m.array),m.itemSize));break;case"BatchedMesh":h=o(t.geometry),u=l(t.material),a=new Lf(t.maxInstanceCount,t.maxVertexCount,t.maxIndexCount,u),a.geometry=h,a.perObjectFrustumCulled=t.perObjectFrustumCulled,a.sortObjects=t.sortObjects,a._drawRanges=t.drawRanges,a._reservedRanges=t.reservedRanges,a._visibility=t.visibility,a._active=t.active,a._bounds=t.bounds.map(x=>{const g=new qe;g.min.fromArray(x.boxMin),g.max.fromArray(x.boxMax);const p=new Be;return p.radius=x.sphereRadius,p.center.fromArray(x.sphereCenter),{boxInitialized:x.boxInitialized,box:g,sphereInitialized:x.sphereInitialized,sphere:p}}),a._maxInstanceCount=t.maxInstanceCount,a._maxVertexCount=t.maxVertexCount,a._maxIndexCount=t.maxIndexCount,a._geometryInitialized=t.geometryInitialized,a._geometryCount=t.geometryCount,a._matricesTexture=c(t.matricesTexture.uuid),t.colorsTexture!==void 0&&(a._colorsTexture=c(t.colorsTexture.uuid));break;case"LOD":a=new If;break;case"Line":a=new wi(o(t.geometry),l(t.material));break;case"LineLoop":a=new Df(o(t.geometry),l(t.material));break;case"LineSegments":a=new Vn(o(t.geometry),l(t.material));break;case"PointCloud":case"Points":a=new Uf(o(t.geometry),l(t.material));break;case"Sprite":a=new ti(l(t.material));break;case"Group":a=new Qn;break;case"Bone":a=new eh;break;default:a=new ee}if(a.uuid=t.uuid,t.name!==void 0&&(a.name=t.name),t.matrix!==void 0?(a.matrix.fromArray(t.matrix),t.matrixAutoUpdate!==void 0&&(a.matrixAutoUpdate=t.matrixAutoUpdate),a.matrixAutoUpdate&&a.matrix.decompose(a.position,a.quaternion,a.scale)):(t.position!==void 0&&a.position.fromArray(t.position),t.rotation!==void 0&&a.rotation.fromArray(t.rotation),t.quaternion!==void 0&&a.quaternion.fromArray(t.quaternion),t.scale!==void 0&&a.scale.fromArray(t.scale)),t.up!==void 0&&a.up.fromArray(t.up),t.castShadow!==void 0&&(a.castShadow=t.castShadow),t.receiveShadow!==void 0&&(a.receiveShadow=t.receiveShadow),t.shadow&&(t.shadow.intensity!==void 0&&(a.shadow.intensity=t.shadow.intensity),t.shadow.bias!==void 0&&(a.shadow.bias=t.shadow.bias),t.shadow.normalBias!==void 0&&(a.shadow.normalBias=t.shadow.normalBias),t.shadow.radius!==void 0&&(a.shadow.radius=t.shadow.radius),t.shadow.mapSize!==void 0&&a.shadow.mapSize.fromArray(t.shadow.mapSize),t.shadow.camera!==void 0&&(a.shadow.camera=this.parseObject(t.shadow.camera))),t.visible!==void 0&&(a.visible=t.visible),t.frustumCulled!==void 0&&(a.frustumCulled=t.frustumCulled),t.renderOrder!==void 0&&(a.renderOrder=t.renderOrder),t.userData!==void 0&&(a.userData=t.userData),t.layers!==void 0&&(a.layers.mask=t.layers),t.children!==void 0){const d=t.children;for(let f=0;f<d.length;f++)a.add(this.parseObject(d[f],e,n,i,s))}if(t.animations!==void 0){const d=t.animations;for(let f=0;f<d.length;f++){const m=d[f];a.animations.push(s[m])}}if(t.type==="LOD"){t.autoUpdate!==void 0&&(a.autoUpdate=t.autoUpdate);const d=t.levels;for(let f=0;f<d.length;f++){const m=d[f],x=a.getObjectByProperty("uuid",m.object);x!==void 0&&a.addLevel(x,m.distance,m.hysteresis)}}return a}bindSkeletons(t,e){Object.keys(e).length!==0&&t.traverse(function(n){if(n.isSkinnedMesh===!0&&n.skeleton!==void 0){const i=e[n.skeleton];i===void 0?console.warn("THREE.ObjectLoader: No skeleton found with UUID:",n.skeleton):n.bind(i,n.bindMatrix)}})}bindLightTargets(t){t.traverse(function(e){if(e.isDirectionalLight||e.isSpotLight){const n=e.target,i=t.getObjectByProperty("uuid",n);i!==void 0?e.target=i:e.target=new ee}})}}const Yy={UVMapping:Xo,CubeReflectionMapping:ai,CubeRefractionMapping:Si,EquirectangularReflectionMapping:Sr,EquirectangularRefractionMapping:wr,CubeUVReflectionMapping:Xs},ju={RepeatWrapping:Hs,ClampToEdgeWrapping:un,MirroredRepeatWrapping:Tr},Qu={NearestFilter:De,NearestMipmapNearestFilter:Nc,NearestMipmapLinearFilter:Ds,LinearFilter:we,LinearMipmapNearestFilter:fr,LinearMipmapLinearFilter:vn};class $y extends en{constructor(t){super(t),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(t){return this.options=t,this}load(t,e,n,i){t===void 0&&(t=""),this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const s=this,a=ei.get(t);if(a!==void 0){if(s.manager.itemStart(t),a.then){a.then(c=>{e&&e(c),s.manager.itemEnd(t)}).catch(c=>{i&&i(c)});return}return setTimeout(function(){e&&e(a),s.manager.itemEnd(t)},0),a}const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader;const l=fetch(t,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){return ei.add(t,c),e&&e(c),s.manager.itemEnd(t),c}).catch(function(c){i&&i(c),ei.remove(t),s.manager.itemError(t),s.manager.itemEnd(t)});ei.add(t,l),s.manager.itemStart(t)}}let za;class vh{static getContext(){return za===void 0&&(za=new(window.AudioContext||window.webkitAudioContext)),za}static setContext(t){za=t}}class Zy extends en{constructor(t){super(t)}load(t,e,n,i){const s=this,a=new li(this.manager);a.setResponseType("arraybuffer"),a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(t,function(l){try{const c=l.slice(0);vh.getContext().decodeAudioData(c,function(u){e(u)}).catch(o)}catch(c){o(c)}},n,i);function o(l){i?i(l):console.error(l),s.manager.itemError(t)}}}const td=new Ut,ed=new Ut,Bi=new Ut;class Ky{constructor(){this.type="StereoCamera",this.aspect=1,this.eyeSep=.064,this.cameraL=new Pe,this.cameraL.layers.enable(1),this.cameraL.matrixAutoUpdate=!1,this.cameraR=new Pe,this.cameraR.layers.enable(2),this.cameraR.matrixAutoUpdate=!1,this._cache={focus:null,fov:null,aspect:null,near:null,far:null,zoom:null,eyeSep:null}}update(t){const e=this._cache;if(e.focus!==t.focus||e.fov!==t.fov||e.aspect!==t.aspect*this.aspect||e.near!==t.near||e.far!==t.far||e.zoom!==t.zoom||e.eyeSep!==this.eyeSep){e.focus=t.focus,e.fov=t.fov,e.aspect=t.aspect*this.aspect,e.near=t.near,e.far=t.far,e.zoom=t.zoom,e.eyeSep=this.eyeSep,Bi.copy(t.projectionMatrix);const i=e.eyeSep/2,s=i*e.near/e.focus,a=e.near*Math.tan(es*e.fov*.5)/e.zoom;let o,l;ed.elements[12]=-i,td.elements[12]=i,o=-a*e.aspect+s,l=a*e.aspect+s,Bi.elements[0]=2*e.near/(l-o),Bi.elements[8]=(l+o)/(l-o),this.cameraL.projectionMatrix.copy(Bi),o=-a*e.aspect-s,l=a*e.aspect-s,Bi.elements[0]=2*e.near/(l-o),Bi.elements[8]=(l+o)/(l-o),this.cameraR.projectionMatrix.copy(Bi)}this.cameraL.matrixWorld.copy(t.matrixWorld).multiply(ed),this.cameraR.matrixWorld.copy(t.matrixWorld).multiply(td)}}class dp{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=nd(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const e=nd();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}}function nd(){return performance.now()}const zi=new R,id=new Ae,Jy=new R,ki=new R;class jy extends ee{constructor(){super(),this.type="AudioListener",this.context=vh.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null,this.timeDelta=0,this._clock=new dp}getInput(){return this.gain}removeFilter(){return this.filter!==null&&(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination),this.gain.connect(this.context.destination),this.filter=null),this}getFilter(){return this.filter}setFilter(t){return this.filter!==null?(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination)):this.gain.disconnect(this.context.destination),this.filter=t,this.gain.connect(this.filter),this.filter.connect(this.context.destination),this}getMasterVolume(){return this.gain.gain.value}setMasterVolume(t){return this.gain.gain.setTargetAtTime(t,this.context.currentTime,.01),this}updateMatrixWorld(t){super.updateMatrixWorld(t);const e=this.context.listener,n=this.up;if(this.timeDelta=this._clock.getDelta(),this.matrixWorld.decompose(zi,id,Jy),ki.set(0,0,-1).applyQuaternion(id),e.positionX){const i=this.context.currentTime+this.timeDelta;e.positionX.linearRampToValueAtTime(zi.x,i),e.positionY.linearRampToValueAtTime(zi.y,i),e.positionZ.linearRampToValueAtTime(zi.z,i),e.forwardX.linearRampToValueAtTime(ki.x,i),e.forwardY.linearRampToValueAtTime(ki.y,i),e.forwardZ.linearRampToValueAtTime(ki.z,i),e.upX.linearRampToValueAtTime(n.x,i),e.upY.linearRampToValueAtTime(n.y,i),e.upZ.linearRampToValueAtTime(n.z,i)}else e.setPosition(zi.x,zi.y,zi.z),e.setOrientation(ki.x,ki.y,ki.z,n.x,n.y,n.z)}}class fp extends ee{constructor(t){super(),this.type="Audio",this.listener=t,this.context=t.context,this.gain=this.context.createGain(),this.gain.connect(t.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(t){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=t,this.connect(),this}setMediaElementSource(t){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(t),this.connect(),this}setMediaStreamSource(t){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(t),this.connect(),this}setBuffer(t){return this.buffer=t,this.sourceType="buffer",this.autoplay&&this.play(),this}play(t=0){if(this.isPlaying===!0){console.warn("THREE.Audio: Audio is already playing.");return}if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}this._startedAt=this.context.currentTime+t;const e=this.context.createBufferSource();return e.buffer=this.buffer,e.loop=this.loop,e.loopStart=this.loopStart,e.loopEnd=this.loopEnd,e.onended=this.onEnded.bind(this),e.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=e,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(t=0){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this._progress=0,this.source!==null&&(this.source.stop(this.context.currentTime+t),this.source.onended=null),this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let t=1,e=this.filters.length;t<e;t++)this.filters[t-1].connect(this.filters[t]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this._connected!==!1){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let t=1,e=this.filters.length;t<e;t++)this.filters[t-1].disconnect(this.filters[t]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}}getFilters(){return this.filters}setFilters(t){return t||(t=[]),this._connected===!0?(this.disconnect(),this.filters=t.slice(),this.connect()):this.filters=t.slice(),this}setDetune(t){return this.detune=t,this.isPlaying===!0&&this.source.detune!==void 0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(t){return this.setFilters(t?[t]:[])}setPlaybackRate(t){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.playbackRate=t,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop}setLoop(t){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.loop=t,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(t){return this.loopStart=t,this}setLoopEnd(t){return this.loopEnd=t,this}getVolume(){return this.gain.gain.value}setVolume(t){return this.gain.gain.setTargetAtTime(t,this.context.currentTime,.01),this}}const Hi=new R,sd=new Ae,Qy=new R,Vi=new R;class tb extends fp{constructor(t){super(t),this.panner=this.context.createPanner(),this.panner.panningModel="HRTF",this.panner.connect(this.gain)}connect(){super.connect(),this.panner.connect(this.gain)}disconnect(){super.disconnect(),this.panner.disconnect(this.gain)}getOutput(){return this.panner}getRefDistance(){return this.panner.refDistance}setRefDistance(t){return this.panner.refDistance=t,this}getRolloffFactor(){return this.panner.rolloffFactor}setRolloffFactor(t){return this.panner.rolloffFactor=t,this}getDistanceModel(){return this.panner.distanceModel}setDistanceModel(t){return this.panner.distanceModel=t,this}getMaxDistance(){return this.panner.maxDistance}setMaxDistance(t){return this.panner.maxDistance=t,this}setDirectionalCone(t,e,n){return this.panner.coneInnerAngle=t,this.panner.coneOuterAngle=e,this.panner.coneOuterGain=n,this}updateMatrixWorld(t){if(super.updateMatrixWorld(t),this.hasPlaybackControl===!0&&this.isPlaying===!1)return;this.matrixWorld.decompose(Hi,sd,Qy),Vi.set(0,0,1).applyQuaternion(sd);const e=this.panner;if(e.positionX){const n=this.context.currentTime+this.listener.timeDelta;e.positionX.linearRampToValueAtTime(Hi.x,n),e.positionY.linearRampToValueAtTime(Hi.y,n),e.positionZ.linearRampToValueAtTime(Hi.z,n),e.orientationX.linearRampToValueAtTime(Vi.x,n),e.orientationY.linearRampToValueAtTime(Vi.y,n),e.orientationZ.linearRampToValueAtTime(Vi.z,n)}else e.setPosition(Hi.x,Hi.y,Hi.z),e.setOrientation(Vi.x,Vi.y,Vi.z)}}class eb{constructor(t,e=2048){this.analyser=t.context.createAnalyser(),this.analyser.fftSize=e,this.data=new Uint8Array(this.analyser.frequencyBinCount),t.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let t=0;const e=this.getFrequencyData();for(let n=0;n<e.length;n++)t+=e[n];return t/e.length}}class pp{constructor(t,e,n){this.binding=t,this.valueSize=n;let i,s,a;switch(e){case"quaternion":i=this._slerp,s=this._slerpAdditive,a=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(n*6),this._workIndex=5;break;case"string":case"bool":i=this._select,s=this._select,a=this._setAdditiveIdentityOther,this.buffer=new Array(n*5);break;default:i=this._lerp,s=this._lerpAdditive,a=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(n*5)}this._mixBufferRegion=i,this._mixBufferRegionAdditive=s,this._setIdentity=a,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(t,e){const n=this.buffer,i=this.valueSize,s=t*i+i;let a=this.cumulativeWeight;if(a===0){for(let o=0;o!==i;++o)n[s+o]=n[o];a=e}else{a+=e;const o=e/a;this._mixBufferRegion(n,s,0,o,i)}this.cumulativeWeight=a}accumulateAdditive(t){const e=this.buffer,n=this.valueSize,i=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(e,i,0,t,n),this.cumulativeWeightAdditive+=t}apply(t){const e=this.valueSize,n=this.buffer,i=t*e+e,s=this.cumulativeWeight,a=this.cumulativeWeightAdditive,o=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){const l=e*this._origIndex;this._mixBufferRegion(n,i,l,1-s,e)}a>0&&this._mixBufferRegionAdditive(n,i,this._addIndex*e,1,e);for(let l=e,c=e+e;l!==c;++l)if(n[l]!==n[l+e]){o.setValue(n,i);break}}saveOriginalState(){const t=this.binding,e=this.buffer,n=this.valueSize,i=n*this._origIndex;t.getValue(e,i);for(let s=n,a=i;s!==a;++s)e[s]=e[i+s%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const t=this.valueSize*3;this.binding.setValue(this.buffer,t)}_setAdditiveIdentityNumeric(){const t=this._addIndex*this.valueSize,e=t+this.valueSize;for(let n=t;n<e;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const t=this._origIndex*this.valueSize,e=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[e+n]=this.buffer[t+n]}_select(t,e,n,i,s){if(i>=.5)for(let a=0;a!==s;++a)t[e+a]=t[n+a]}_slerp(t,e,n,i){Ae.slerpFlat(t,e,t,e,t,n,i)}_slerpAdditive(t,e,n,i,s){const a=this._workIndex*s;Ae.multiplyQuaternionsFlat(t,a,t,e,t,n),Ae.slerpFlat(t,e,t,e,t,a,i)}_lerp(t,e,n,i,s){const a=1-i;for(let o=0;o!==s;++o){const l=e+o;t[l]=t[l]*a+t[n+o]*i}}_lerpAdditive(t,e,n,i,s){for(let a=0;a!==s;++a){const o=e+a;t[o]=t[o]+t[n+a]*i}}}const _h="\\[\\]\\.:\\/",nb=new RegExp("["+_h+"]","g"),yh="[^"+_h+"]",ib="[^"+_h.replace("\\.","")+"]",sb=/((?:WC+[\/:])*)/.source.replace("WC",yh),rb=/(WCOD+)?/.source.replace("WCOD",ib),ab=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",yh),ob=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",yh),lb=new RegExp("^"+sb+rb+ab+ob+"$"),cb=["material","materials","bones","map"];class hb{constructor(t,e,n){const i=n||Qt.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,i)}getValue(t,e){this.bind();const n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(t,e)}setValue(t,e){const n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(t,e)}bind(){const t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){const t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}}class Qt{constructor(t,e,n){this.path=e,this.parsedPath=n||Qt.parseTrackName(e),this.node=Qt.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new Qt.Composite(t,e,n):new Qt(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(nb,"")}static parseTrackName(t){const e=lb.exec(t);if(e===null)throw new Error("PropertyBinding: Cannot parse trackName: "+t);const n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){const s=n.nodeName.substring(i+1);cb.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){const n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){const n=function(s){for(let a=0;a<s.length;a++){const o=s[a];if(o.name===e||o.uuid===e)return o;const l=n(o.children);if(l)return l}return null},i=n(t.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)t[e++]=n[i]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=t[e++]}_setValue_array_setNeedsUpdate(t,e){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node;const e=this.parsedPath,n=e.objectName,i=e.propertyName;let s=e.propertyIndex;if(t||(t=Qt.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}const a=t[i];if(a===void 0){const c=e.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:t.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!t.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[s]!==void 0&&(s=t.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}Qt.Composite=hb;Qt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Qt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Qt.prototype.GetterByBindingType=[Qt.prototype._getValue_direct,Qt.prototype._getValue_array,Qt.prototype._getValue_arrayElement,Qt.prototype._getValue_toArray];Qt.prototype.SetterByBindingTypeAndVersioning=[[Qt.prototype._setValue_direct,Qt.prototype._setValue_direct_setNeedsUpdate,Qt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Qt.prototype._setValue_array,Qt.prototype._setValue_array_setNeedsUpdate,Qt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Qt.prototype._setValue_arrayElement,Qt.prototype._setValue_arrayElement_setNeedsUpdate,Qt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Qt.prototype._setValue_fromArray,Qt.prototype._setValue_fromArray_setNeedsUpdate,Qt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];class ub{constructor(){this.isAnimationObjectGroup=!0,this.uuid=dn(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;const t={};this._indicesByUUID=t;for(let n=0,i=arguments.length;n!==i;++n)t[arguments[n].uuid]=n;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};const e=this;this.stats={objects:{get total(){return e._objects.length},get inUse(){return this.total-e.nCachedObjects_}},get bindingsPerObject(){return e._bindings.length}}}add(){const t=this._objects,e=this._indicesByUUID,n=this._paths,i=this._parsedPaths,s=this._bindings,a=s.length;let o,l=t.length,c=this.nCachedObjects_;for(let h=0,u=arguments.length;h!==u;++h){const d=arguments[h],f=d.uuid;let m=e[f];if(m===void 0){m=l++,e[f]=m,t.push(d);for(let x=0,g=a;x!==g;++x)s[x].push(new Qt(d,n[x],i[x]))}else if(m<c){o=t[m];const x=--c,g=t[x];e[g.uuid]=m,t[m]=g,e[f]=x,t[x]=d;for(let p=0,_=a;p!==_;++p){const v=s[p],y=v[x];let P=v[m];v[m]=y,P===void 0&&(P=new Qt(d,n[p],i[p])),v[x]=P}}else t[m]!==o&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=c}remove(){const t=this._objects,e=this._indicesByUUID,n=this._bindings,i=n.length;let s=this.nCachedObjects_;for(let a=0,o=arguments.length;a!==o;++a){const l=arguments[a],c=l.uuid,h=e[c];if(h!==void 0&&h>=s){const u=s++,d=t[u];e[d.uuid]=h,t[h]=d,e[c]=u,t[u]=l;for(let f=0,m=i;f!==m;++f){const x=n[f],g=x[u],p=x[h];x[h]=g,x[u]=p}}}this.nCachedObjects_=s}uncache(){const t=this._objects,e=this._indicesByUUID,n=this._bindings,i=n.length;let s=this.nCachedObjects_,a=t.length;for(let o=0,l=arguments.length;o!==l;++o){const c=arguments[o],h=c.uuid,u=e[h];if(u!==void 0)if(delete e[h],u<s){const d=--s,f=t[d],m=--a,x=t[m];e[f.uuid]=u,t[u]=f,e[x.uuid]=d,t[d]=x,t.pop();for(let g=0,p=i;g!==p;++g){const _=n[g],v=_[d],y=_[m];_[u]=v,_[d]=y,_.pop()}}else{const d=--a,f=t[d];d>0&&(e[f.uuid]=u),t[u]=f,t.pop();for(let m=0,x=i;m!==x;++m){const g=n[m];g[u]=g[d],g.pop()}}}this.nCachedObjects_=s}subscribe_(t,e){const n=this._bindingsIndicesByPath;let i=n[t];const s=this._bindings;if(i!==void 0)return s[i];const a=this._paths,o=this._parsedPaths,l=this._objects,c=l.length,h=this.nCachedObjects_,u=new Array(c);i=s.length,n[t]=i,a.push(t),o.push(e),s.push(u);for(let d=h,f=l.length;d!==f;++d){const m=l[d];u[d]=new Qt(m,t,e)}return u}unsubscribe_(t){const e=this._bindingsIndicesByPath,n=e[t];if(n!==void 0){const i=this._paths,s=this._parsedPaths,a=this._bindings,o=a.length-1,l=a[o],c=t[o];e[c]=n,a[n]=l,a.pop(),s[n]=s[o],s.pop(),i[n]=i[o],i.pop()}}}class mp{constructor(t,e,n=null,i=e.blendMode){this._mixer=t,this._clip=e,this._localRoot=n,this.blendMode=i;const s=e.tracks,a=s.length,o=new Array(a),l={endingStart:$i,endingEnd:$i};for(let c=0;c!==a;++c){const h=s[c].createInterpolant(null);o[c]=h,h.settings=l}this._interpolantSettings=l,this._interpolants=o,this._propertyBindings=new Array(a),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=jd,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(t){return this._startTime=t,this}setLoop(t,e){return this.loop=t,this.repetitions=e,this}setEffectiveWeight(t){return this.weight=t,this._effectiveWeight=this.enabled?t:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(t){return this._scheduleFading(t,0,1)}fadeOut(t){return this._scheduleFading(t,1,0)}crossFadeFrom(t,e,n){if(t.fadeOut(e),this.fadeIn(e),n){const i=this._clip.duration,s=t._clip.duration,a=s/i,o=i/s;t.warp(1,a,e),this.warp(o,1,e)}return this}crossFadeTo(t,e,n){return t.crossFadeFrom(this,e,n)}stopFading(){const t=this._weightInterpolant;return t!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(t)),this}setEffectiveTimeScale(t){return this.timeScale=t,this._effectiveTimeScale=this.paused?0:t,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(t){return this.timeScale=this._clip.duration/t,this.stopWarping()}syncWith(t){return this.time=t.time,this.timeScale=t.timeScale,this.stopWarping()}halt(t){return this.warp(this._effectiveTimeScale,0,t)}warp(t,e,n){const i=this._mixer,s=i.time,a=this.timeScale;let o=this._timeScaleInterpolant;o===null&&(o=i._lendControlInterpolant(),this._timeScaleInterpolant=o);const l=o.parameterPositions,c=o.sampleValues;return l[0]=s,l[1]=s+n,c[0]=t/a,c[1]=e/a,this}stopWarping(){const t=this._timeScaleInterpolant;return t!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(t)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(t,e,n,i){if(!this.enabled){this._updateWeight(t);return}const s=this._startTime;if(s!==null){const l=(t-s)*n;l<0||n===0?e=0:(this._startTime=null,e=n*l)}e*=this._updateTimeScale(t);const a=this._updateTime(e),o=this._updateWeight(t);if(o>0){const l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case Xc:for(let h=0,u=l.length;h!==u;++h)l[h].evaluate(a),c[h].accumulateAdditive(o);break;case jo:default:for(let h=0,u=l.length;h!==u;++h)l[h].evaluate(a),c[h].accumulate(i,o)}}}_updateWeight(t){let e=0;if(this.enabled){e=this.weight;const n=this._weightInterpolant;if(n!==null){const i=n.evaluate(t)[0];e*=i,t>n.parameterPositions[1]&&(this.stopFading(),i===0&&(this.enabled=!1))}}return this._effectiveWeight=e,e}_updateTimeScale(t){let e=0;if(!this.paused){e=this.timeScale;const n=this._timeScaleInterpolant;if(n!==null){const i=n.evaluate(t)[0];e*=i,t>n.parameterPositions[1]&&(this.stopWarping(),e===0?this.paused=!0:this.timeScale=e)}}return this._effectiveTimeScale=e,e}_updateTime(t){const e=this._clip.duration,n=this.loop;let i=this.time+t,s=this._loopCount;const a=n===Qd;if(t===0)return s===-1?i:a&&(s&1)===1?e-i:i;if(n===Jd){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));t:{if(i>=e)i=e;else if(i<0)i=0;else{this.time=i;break t}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:t<0?-1:1})}}else{if(s===-1&&(t>=0?(s=0,this._setEndings(!0,this.repetitions===0,a)):this._setEndings(this.repetitions===0,!0,a)),i>=e||i<0){const o=Math.floor(i/e);i-=e*o,s+=Math.abs(o);const l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,i=t>0?e:0,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:t>0?1:-1});else{if(l===1){const c=t<0;this._setEndings(c,!c,a)}else this._setEndings(!1,!1,a);this._loopCount=s,this.time=i,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:o})}}else this.time=i;if(a&&(s&1)===1)return e-i}return i}_setEndings(t,e,n){const i=this._interpolantSettings;n?(i.endingStart=Zi,i.endingEnd=Zi):(t?i.endingStart=this.zeroSlopeAtStart?Zi:$i:i.endingStart=Er,e?i.endingEnd=this.zeroSlopeAtEnd?Zi:$i:i.endingEnd=Er)}_scheduleFading(t,e,n){const i=this._mixer,s=i.time;let a=this._weightInterpolant;a===null&&(a=i._lendControlInterpolant(),this._weightInterpolant=a);const o=a.parameterPositions,l=a.sampleValues;return o[0]=s,l[0]=e,o[1]=s+t,l[1]=n,this}}const db=new Float32Array(1);class fb extends kn{constructor(t){super(),this._root=t,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(t,e){const n=t._localRoot||this._root,i=t._clip.tracks,s=i.length,a=t._propertyBindings,o=t._interpolants,l=n.uuid,c=this._bindingsByRootAndName;let h=c[l];h===void 0&&(h={},c[l]=h);for(let u=0;u!==s;++u){const d=i[u],f=d.name;let m=h[f];if(m!==void 0)++m.referenceCount,a[u]=m;else{if(m=a[u],m!==void 0){m._cacheIndex===null&&(++m.referenceCount,this._addInactiveBinding(m,l,f));continue}const x=e&&e._propertyBindings[u].binding.parsedPath;m=new pp(Qt.create(n,f,x),d.ValueTypeName,d.getValueSize()),++m.referenceCount,this._addInactiveBinding(m,l,f),a[u]=m}o[u].resultBuffer=m.buffer}}_activateAction(t){if(!this._isActiveAction(t)){if(t._cacheIndex===null){const n=(t._localRoot||this._root).uuid,i=t._clip.uuid,s=this._actionsByClip[i];this._bindAction(t,s&&s.knownActions[0]),this._addInactiveAction(t,i,n)}const e=t._propertyBindings;for(let n=0,i=e.length;n!==i;++n){const s=e[n];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(t)}}_deactivateAction(t){if(this._isActiveAction(t)){const e=t._propertyBindings;for(let n=0,i=e.length;n!==i;++n){const s=e[n];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(t)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const t=this;this.stats={actions:{get total(){return t._actions.length},get inUse(){return t._nActiveActions}},bindings:{get total(){return t._bindings.length},get inUse(){return t._nActiveBindings}},controlInterpolants:{get total(){return t._controlInterpolants.length},get inUse(){return t._nActiveControlInterpolants}}}}_isActiveAction(t){const e=t._cacheIndex;return e!==null&&e<this._nActiveActions}_addInactiveAction(t,e,n){const i=this._actions,s=this._actionsByClip;let a=s[e];if(a===void 0)a={knownActions:[t],actionByRoot:{}},t._byClipCacheIndex=0,s[e]=a;else{const o=a.knownActions;t._byClipCacheIndex=o.length,o.push(t)}t._cacheIndex=i.length,i.push(t),a.actionByRoot[n]=t}_removeInactiveAction(t){const e=this._actions,n=e[e.length-1],i=t._cacheIndex;n._cacheIndex=i,e[i]=n,e.pop(),t._cacheIndex=null;const s=t._clip.uuid,a=this._actionsByClip,o=a[s],l=o.knownActions,c=l[l.length-1],h=t._byClipCacheIndex;c._byClipCacheIndex=h,l[h]=c,l.pop(),t._byClipCacheIndex=null;const u=o.actionByRoot,d=(t._localRoot||this._root).uuid;delete u[d],l.length===0&&delete a[s],this._removeInactiveBindingsForAction(t)}_removeInactiveBindingsForAction(t){const e=t._propertyBindings;for(let n=0,i=e.length;n!==i;++n){const s=e[n];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(t){const e=this._actions,n=t._cacheIndex,i=this._nActiveActions++,s=e[i];t._cacheIndex=i,e[i]=t,s._cacheIndex=n,e[n]=s}_takeBackAction(t){const e=this._actions,n=t._cacheIndex,i=--this._nActiveActions,s=e[i];t._cacheIndex=i,e[i]=t,s._cacheIndex=n,e[n]=s}_addInactiveBinding(t,e,n){const i=this._bindingsByRootAndName,s=this._bindings;let a=i[e];a===void 0&&(a={},i[e]=a),a[n]=t,t._cacheIndex=s.length,s.push(t)}_removeInactiveBinding(t){const e=this._bindings,n=t.binding,i=n.rootNode.uuid,s=n.path,a=this._bindingsByRootAndName,o=a[i],l=e[e.length-1],c=t._cacheIndex;l._cacheIndex=c,e[c]=l,e.pop(),delete o[s],Object.keys(o).length===0&&delete a[i]}_lendBinding(t){const e=this._bindings,n=t._cacheIndex,i=this._nActiveBindings++,s=e[i];t._cacheIndex=i,e[i]=t,s._cacheIndex=n,e[n]=s}_takeBackBinding(t){const e=this._bindings,n=t._cacheIndex,i=--this._nActiveBindings,s=e[i];t._cacheIndex=i,e[i]=t,s._cacheIndex=n,e[n]=s}_lendControlInterpolant(){const t=this._controlInterpolants,e=this._nActiveControlInterpolants++;let n=t[e];return n===void 0&&(n=new hh(new Float32Array(2),new Float32Array(2),1,db),n.__cacheIndex=e,t[e]=n),n}_takeBackControlInterpolant(t){const e=this._controlInterpolants,n=t.__cacheIndex,i=--this._nActiveControlInterpolants,s=e[i];t.__cacheIndex=i,e[i]=t,s.__cacheIndex=n,e[n]=s}clipAction(t,e,n){const i=e||this._root,s=i.uuid;let a=typeof t=="string"?Br.findByName(i,t):t;const o=a!==null?a.uuid:t,l=this._actionsByClip[o];let c=null;if(n===void 0&&(a!==null?n=a.blendMode:n=jo),l!==void 0){const u=l.actionByRoot[s];if(u!==void 0&&u.blendMode===n)return u;c=l.knownActions[0],a===null&&(a=c._clip)}if(a===null)return null;const h=new mp(this,a,e,n);return this._bindAction(h,c),this._addInactiveAction(h,o,s),h}existingAction(t,e){const n=e||this._root,i=n.uuid,s=typeof t=="string"?Br.findByName(n,t):t,a=s?s.uuid:t,o=this._actionsByClip[a];return o!==void 0&&o.actionByRoot[i]||null}stopAllAction(){const t=this._actions,e=this._nActiveActions;for(let n=e-1;n>=0;--n)t[n].stop();return this}update(t){t*=this.timeScale;const e=this._actions,n=this._nActiveActions,i=this.time+=t,s=Math.sign(t),a=this._accuIndex^=1;for(let c=0;c!==n;++c)e[c]._update(i,t,s,a);const o=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)o[c].apply(a);return this}setTime(t){this.time=0;for(let e=0;e<this._actions.length;e++)this._actions[e].time=0;return this.update(t)}getRoot(){return this._root}uncacheClip(t){const e=this._actions,n=t.uuid,i=this._actionsByClip,s=i[n];if(s!==void 0){const a=s.knownActions;for(let o=0,l=a.length;o!==l;++o){const c=a[o];this._deactivateAction(c);const h=c._cacheIndex,u=e[e.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,u._cacheIndex=h,e[h]=u,e.pop(),this._removeInactiveBindingsForAction(c)}delete i[n]}}uncacheRoot(t){const e=t.uuid,n=this._actionsByClip;for(const a in n){const o=n[a].actionByRoot,l=o[e];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}const i=this._bindingsByRootAndName,s=i[e];if(s!==void 0)for(const a in s){const o=s[a];o.restoreOriginalState(),this._removeInactiveBinding(o)}}uncacheAction(t,e){const n=this.existingAction(t,e);n!==null&&(this._deactivateAction(n),this._removeInactiveAction(n))}}class bh{constructor(t){this.value=t}clone(){return new bh(this.value.clone===void 0?this.value:this.value.clone())}}let pb=0;class mb extends kn{constructor(){super(),this.isUniformsGroup=!0,Object.defineProperty(this,"id",{value:pb++}),this.name="",this.usage=Cr,this.uniforms=[]}add(t){return this.uniforms.push(t),this}remove(t){const e=this.uniforms.indexOf(t);return e!==-1&&this.uniforms.splice(e,1),this}setName(t){return this.name=t,this}setUsage(t){return this.usage=t,this}dispose(){return this.dispatchEvent({type:"dispose"}),this}copy(t){this.name=t.name,this.usage=t.usage;const e=t.uniforms;this.uniforms.length=0;for(let n=0,i=e.length;n<i;n++){const s=Array.isArray(e[n])?e[n]:[e[n]];for(let a=0;a<s.length;a++)this.uniforms.push(s[a].clone())}return this}clone(){return new this.constructor().copy(this)}}class gb extends sl{constructor(t,e,n=1){super(t,e),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=n}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}clone(t){const e=super.clone(t);return e.meshPerAttribute=this.meshPerAttribute,e}toJSON(t){const e=super.toJSON(t);return e.isInstancedInterleavedBuffer=!0,e.meshPerAttribute=this.meshPerAttribute,e}}class xb{constructor(t,e,n,i,s){this.isGLBufferAttribute=!0,this.name="",this.buffer=t,this.type=e,this.itemSize=n,this.elementSize=i,this.count=s,this.version=0}set needsUpdate(t){t===!0&&this.version++}setBuffer(t){return this.buffer=t,this}setType(t,e){return this.type=t,this.elementSize=e,this}setItemSize(t){return this.itemSize=t,this}setCount(t){return this.count=t,this}}const rd=new Ut;class vb{constructor(t,e,n=0,i=1/0){this.ray=new Ys(t,e),this.near=n,this.far=i,this.camera=null,this.layers=new tl,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return rd.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(rd),this}intersectObject(t,e=!0,n=[]){return Rc(t,this,n,e),n.sort(ad),n}intersectObjects(t,e=!0,n=[]){for(let i=0,s=t.length;i<s;i++)Rc(t[i],this,n,e);return n.sort(ad),n}}function ad(r,t){return r.distance-t.distance}function Rc(r,t,e,n){let i=!0;if(r.layers.test(t.layers)&&r.raycast(t,e)===!1&&(i=!1),i===!0&&n===!0){const s=r.children;for(let a=0,o=s.length;a<o;a++)Rc(s[a],t,e,!0)}}class _b{constructor(t=1,e=0,n=0){return this.radius=t,this.phi=e,this.theta=n,this}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(_e(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class yb{constructor(t=1,e=0,n=0){return this.radius=t,this.theta=e,this.y=n,this}set(t,e,n){return this.radius=t,this.theta=e,this.y=n,this}copy(t){return this.radius=t.radius,this.theta=t.theta,this.y=t.y,this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+n*n),this.theta=Math.atan2(t,n),this.y=e,this}clone(){return new this.constructor().copy(this)}}class Mh{constructor(t,e,n,i){Mh.prototype.isMatrix2=!0,this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,i){const s=this.elements;return s[0]=t,s[2]=e,s[1]=n,s[3]=i,this}}const od=new tt;class bb{constructor(t=new tt(1/0,1/0),e=new tt(-1/0,-1/0)){this.isBox2=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=od.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(t){return this.isEmpty()?t.set(0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,od).distanceTo(t)}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const ld=new R,ka=new R;class Mb{constructor(t=new R,e=new R){this.start=t,this.end=e}set(t,e){return this.start.copy(t),this.end.copy(e),this}copy(t){return this.start.copy(t.start),this.end.copy(t.end),this}getCenter(t){return t.addVectors(this.start,this.end).multiplyScalar(.5)}delta(t){return t.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(t,e){return this.delta(e).multiplyScalar(t).add(this.start)}closestPointToPointParameter(t,e){ld.subVectors(t,this.start),ka.subVectors(this.end,this.start);const n=ka.dot(ka);let s=ka.dot(ld)/n;return e&&(s=_e(s,0,1)),s}closestPointToPoint(t,e,n){const i=this.closestPointToPointParameter(t,e);return this.delta(n).multiplyScalar(i).add(this.start)}applyMatrix4(t){return this.start.applyMatrix4(t),this.end.applyMatrix4(t),this}equals(t){return t.start.equals(this.start)&&t.end.equals(this.end)}clone(){return new this.constructor().copy(this)}}const cd=new R;class Sb extends ee{constructor(t,e){super(),this.light=t,this.matrixAutoUpdate=!1,this.color=e,this.type="SpotLightHelper";const n=new qt,i=[0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,-1,0,1,0,0,0,0,1,1,0,0,0,0,-1,1];for(let a=0,o=1,l=32;a<l;a++,o++){const c=a/l*Math.PI*2,h=o/l*Math.PI*2;i.push(Math.cos(c),Math.sin(c),1,Math.cos(h),Math.sin(h),1)}n.setAttribute("position",new Tt(i,3));const s=new $e({fog:!1,toneMapped:!1});this.cone=new Vn(n,s),this.add(this.cone),this.update()}dispose(){this.cone.geometry.dispose(),this.cone.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),this.parent?(this.parent.updateWorldMatrix(!0),this.matrix.copy(this.parent.matrixWorld).invert().multiply(this.light.matrixWorld)):this.matrix.copy(this.light.matrixWorld),this.matrixWorld.copy(this.light.matrixWorld);const t=this.light.distance?this.light.distance:1e3,e=t*Math.tan(this.light.angle);this.cone.scale.set(e,e,t),cd.setFromMatrixPosition(this.light.target.matrixWorld),this.cone.lookAt(cd),this.color!==void 0?this.cone.material.color.set(this.color):this.cone.material.color.copy(this.light.color)}}const vi=new R,Ha=new Ut,cc=new Ut;class wb extends Vn{constructor(t){const e=gp(t),n=new qt,i=[],s=[],a=new ht(0,0,1),o=new ht(0,1,0);for(let c=0;c<e.length;c++){const h=e[c];h.parent&&h.parent.isBone&&(i.push(0,0,0),i.push(0,0,0),s.push(a.r,a.g,a.b),s.push(o.r,o.g,o.b))}n.setAttribute("position",new Tt(i,3)),n.setAttribute("color",new Tt(s,3));const l=new $e({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(n,l),this.isSkeletonHelper=!0,this.type="SkeletonHelper",this.root=t,this.bones=e,this.matrix=t.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(t){const e=this.bones,n=this.geometry,i=n.getAttribute("position");cc.copy(this.root.matrixWorld).invert();for(let s=0,a=0;s<e.length;s++){const o=e[s];o.parent&&o.parent.isBone&&(Ha.multiplyMatrices(cc,o.matrixWorld),vi.setFromMatrixPosition(Ha),i.setXYZ(a,vi.x,vi.y,vi.z),Ha.multiplyMatrices(cc,o.parent.matrixWorld),vi.setFromMatrixPosition(Ha),i.setXYZ(a+1,vi.x,vi.y,vi.z),a+=2)}n.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(t)}dispose(){this.geometry.dispose(),this.material.dispose()}}function gp(r){const t=[];r.isBone===!0&&t.push(r);for(let e=0;e<r.children.length;e++)t.push.apply(t,gp(r.children[e]));return t}class Tb extends ue{constructor(t,e,n){const i=new hs(e,4,2),s=new yn({wireframe:!0,fog:!1,toneMapped:!1});super(i,s),this.light=t,this.color=n,this.type="PointLightHelper",this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}dispose(){this.geometry.dispose(),this.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.color!==void 0?this.material.color.set(this.color):this.material.color.copy(this.light.color)}}const Ab=new R,hd=new ht,ud=new ht;class Eb extends ee{constructor(t,e,n){super(),this.light=t,this.matrix=t.matrixWorld,this.matrixAutoUpdate=!1,this.color=n,this.type="HemisphereLightHelper";const i=new Kr(e);i.rotateY(Math.PI*.5),this.material=new yn({wireframe:!0,fog:!1,toneMapped:!1}),this.color===void 0&&(this.material.vertexColors=!0);const s=i.getAttribute("position"),a=new Float32Array(s.count*3);i.setAttribute("color",new oe(a,3)),this.add(new ue(i,this.material)),this.update()}dispose(){this.children[0].geometry.dispose(),this.children[0].material.dispose()}update(){const t=this.children[0];if(this.color!==void 0)this.material.color.set(this.color);else{const e=t.geometry.getAttribute("color");hd.copy(this.light.color),ud.copy(this.light.groundColor);for(let n=0,i=e.count;n<i;n++){const s=n<i/2?hd:ud;e.setXYZ(n,s.r,s.g,s.b)}e.needsUpdate=!0}this.light.updateWorldMatrix(!0,!1),t.lookAt(Ab.setFromMatrixPosition(this.light.matrixWorld).negate())}}class Cb extends Vn{constructor(t=10,e=10,n=4473924,i=8947848){n=new ht(n),i=new ht(i);const s=e/2,a=t/e,o=t/2,l=[],c=[];for(let d=0,f=0,m=-o;d<=e;d++,m+=a){l.push(-o,0,m,o,0,m),l.push(m,0,-o,m,0,o);const x=d===s?n:i;x.toArray(c,f),f+=3,x.toArray(c,f),f+=3,x.toArray(c,f),f+=3,x.toArray(c,f),f+=3}const h=new qt;h.setAttribute("position",new Tt(l,3)),h.setAttribute("color",new Tt(c,3));const u=new $e({vertexColors:!0,toneMapped:!1});super(h,u),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}class Rb extends Vn{constructor(t=10,e=16,n=8,i=64,s=4473924,a=8947848){s=new ht(s),a=new ht(a);const o=[],l=[];if(e>1)for(let u=0;u<e;u++){const d=u/e*(Math.PI*2),f=Math.sin(d)*t,m=Math.cos(d)*t;o.push(0,0,0),o.push(f,0,m);const x=u&1?s:a;l.push(x.r,x.g,x.b),l.push(x.r,x.g,x.b)}for(let u=0;u<n;u++){const d=u&1?s:a,f=t-t/n*u;for(let m=0;m<i;m++){let x=m/i*(Math.PI*2),g=Math.sin(x)*f,p=Math.cos(x)*f;o.push(g,0,p),l.push(d.r,d.g,d.b),x=(m+1)/i*(Math.PI*2),g=Math.sin(x)*f,p=Math.cos(x)*f,o.push(g,0,p),l.push(d.r,d.g,d.b)}}const c=new qt;c.setAttribute("position",new Tt(o,3)),c.setAttribute("color",new Tt(l,3));const h=new $e({vertexColors:!0,toneMapped:!1});super(c,h),this.type="PolarGridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}const dd=new R,Va=new R,fd=new R;class Ib extends ee{constructor(t,e,n){super(),this.light=t,this.matrix=t.matrixWorld,this.matrixAutoUpdate=!1,this.color=n,this.type="DirectionalLightHelper",e===void 0&&(e=1);let i=new qt;i.setAttribute("position",new Tt([-e,e,0,e,e,0,e,-e,0,-e,-e,0,-e,e,0],3));const s=new $e({fog:!1,toneMapped:!1});this.lightPlane=new wi(i,s),this.add(this.lightPlane),i=new qt,i.setAttribute("position",new Tt([0,0,0,0,0,1],3)),this.targetLine=new wi(i,s),this.add(this.targetLine),this.update()}dispose(){this.lightPlane.geometry.dispose(),this.lightPlane.material.dispose(),this.targetLine.geometry.dispose(),this.targetLine.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),dd.setFromMatrixPosition(this.light.matrixWorld),Va.setFromMatrixPosition(this.light.target.matrixWorld),fd.subVectors(Va,dd),this.lightPlane.lookAt(Va),this.color!==void 0?(this.lightPlane.material.color.set(this.color),this.targetLine.material.color.set(this.color)):(this.lightPlane.material.color.copy(this.light.color),this.targetLine.material.color.copy(this.light.color)),this.targetLine.lookAt(Va),this.targetLine.scale.z=fd.length()}}const Ga=new R,ve=new el;class Pb extends Vn{constructor(t){const e=new qt,n=new $e({color:16777215,vertexColors:!0,toneMapped:!1}),i=[],s=[],a={};o("n1","n2"),o("n2","n4"),o("n4","n3"),o("n3","n1"),o("f1","f2"),o("f2","f4"),o("f4","f3"),o("f3","f1"),o("n1","f1"),o("n2","f2"),o("n3","f3"),o("n4","f4"),o("p","n1"),o("p","n2"),o("p","n3"),o("p","n4"),o("u1","u2"),o("u2","u3"),o("u3","u1"),o("c","t"),o("p","c"),o("cn1","cn2"),o("cn3","cn4"),o("cf1","cf2"),o("cf3","cf4");function o(m,x){l(m),l(x)}function l(m){i.push(0,0,0),s.push(0,0,0),a[m]===void 0&&(a[m]=[]),a[m].push(i.length/3-1)}e.setAttribute("position",new Tt(i,3)),e.setAttribute("color",new Tt(s,3)),super(e,n),this.type="CameraHelper",this.camera=t,this.camera.updateProjectionMatrix&&this.camera.updateProjectionMatrix(),this.matrix=t.matrixWorld,this.matrixAutoUpdate=!1,this.pointMap=a,this.update();const c=new ht(16755200),h=new ht(16711680),u=new ht(43775),d=new ht(16777215),f=new ht(3355443);this.setColors(c,h,u,d,f)}setColors(t,e,n,i,s){const o=this.geometry.getAttribute("color");o.setXYZ(0,t.r,t.g,t.b),o.setXYZ(1,t.r,t.g,t.b),o.setXYZ(2,t.r,t.g,t.b),o.setXYZ(3,t.r,t.g,t.b),o.setXYZ(4,t.r,t.g,t.b),o.setXYZ(5,t.r,t.g,t.b),o.setXYZ(6,t.r,t.g,t.b),o.setXYZ(7,t.r,t.g,t.b),o.setXYZ(8,t.r,t.g,t.b),o.setXYZ(9,t.r,t.g,t.b),o.setXYZ(10,t.r,t.g,t.b),o.setXYZ(11,t.r,t.g,t.b),o.setXYZ(12,t.r,t.g,t.b),o.setXYZ(13,t.r,t.g,t.b),o.setXYZ(14,t.r,t.g,t.b),o.setXYZ(15,t.r,t.g,t.b),o.setXYZ(16,t.r,t.g,t.b),o.setXYZ(17,t.r,t.g,t.b),o.setXYZ(18,t.r,t.g,t.b),o.setXYZ(19,t.r,t.g,t.b),o.setXYZ(20,t.r,t.g,t.b),o.setXYZ(21,t.r,t.g,t.b),o.setXYZ(22,t.r,t.g,t.b),o.setXYZ(23,t.r,t.g,t.b),o.setXYZ(24,e.r,e.g,e.b),o.setXYZ(25,e.r,e.g,e.b),o.setXYZ(26,e.r,e.g,e.b),o.setXYZ(27,e.r,e.g,e.b),o.setXYZ(28,e.r,e.g,e.b),o.setXYZ(29,e.r,e.g,e.b),o.setXYZ(30,e.r,e.g,e.b),o.setXYZ(31,e.r,e.g,e.b),o.setXYZ(32,n.r,n.g,n.b),o.setXYZ(33,n.r,n.g,n.b),o.setXYZ(34,n.r,n.g,n.b),o.setXYZ(35,n.r,n.g,n.b),o.setXYZ(36,n.r,n.g,n.b),o.setXYZ(37,n.r,n.g,n.b),o.setXYZ(38,i.r,i.g,i.b),o.setXYZ(39,i.r,i.g,i.b),o.setXYZ(40,s.r,s.g,s.b),o.setXYZ(41,s.r,s.g,s.b),o.setXYZ(42,s.r,s.g,s.b),o.setXYZ(43,s.r,s.g,s.b),o.setXYZ(44,s.r,s.g,s.b),o.setXYZ(45,s.r,s.g,s.b),o.setXYZ(46,s.r,s.g,s.b),o.setXYZ(47,s.r,s.g,s.b),o.setXYZ(48,s.r,s.g,s.b),o.setXYZ(49,s.r,s.g,s.b),o.needsUpdate=!0}update(){const t=this.geometry,e=this.pointMap,n=1,i=1;ve.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse),be("c",e,t,ve,0,0,-1),be("t",e,t,ve,0,0,1),be("n1",e,t,ve,-n,-i,-1),be("n2",e,t,ve,n,-i,-1),be("n3",e,t,ve,-n,i,-1),be("n4",e,t,ve,n,i,-1),be("f1",e,t,ve,-n,-i,1),be("f2",e,t,ve,n,-i,1),be("f3",e,t,ve,-n,i,1),be("f4",e,t,ve,n,i,1),be("u1",e,t,ve,n*.7,i*1.1,-1),be("u2",e,t,ve,-n*.7,i*1.1,-1),be("u3",e,t,ve,0,i*2,-1),be("cf1",e,t,ve,-n,0,1),be("cf2",e,t,ve,n,0,1),be("cf3",e,t,ve,0,-i,1),be("cf4",e,t,ve,0,i,1),be("cn1",e,t,ve,-n,0,-1),be("cn2",e,t,ve,n,0,-1),be("cn3",e,t,ve,0,-i,-1),be("cn4",e,t,ve,0,i,-1),t.getAttribute("position").needsUpdate=!0}dispose(){this.geometry.dispose(),this.material.dispose()}}function be(r,t,e,n,i,s,a){Ga.set(i,s,a).unproject(n);const o=t[r];if(o!==void 0){const l=e.getAttribute("position");for(let c=0,h=o.length;c<h;c++)l.setXYZ(o[c],Ga.x,Ga.y,Ga.z)}}const Wa=new qe;class Lb extends Vn{constructor(t,e=16776960){const n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),i=new Float32Array(8*3),s=new qt;s.setIndex(new oe(n,1)),s.setAttribute("position",new oe(i,3)),super(s,new $e({color:e,toneMapped:!1})),this.object=t,this.type="BoxHelper",this.matrixAutoUpdate=!1,this.update()}update(t){if(t!==void 0&&console.warn("THREE.BoxHelper: .update() has no longer arguments."),this.object!==void 0&&Wa.setFromObject(this.object),Wa.isEmpty())return;const e=Wa.min,n=Wa.max,i=this.geometry.attributes.position,s=i.array;s[0]=n.x,s[1]=n.y,s[2]=n.z,s[3]=e.x,s[4]=n.y,s[5]=n.z,s[6]=e.x,s[7]=e.y,s[8]=n.z,s[9]=n.x,s[10]=e.y,s[11]=n.z,s[12]=n.x,s[13]=n.y,s[14]=e.z,s[15]=e.x,s[16]=n.y,s[17]=e.z,s[18]=e.x,s[19]=e.y,s[20]=e.z,s[21]=n.x,s[22]=e.y,s[23]=e.z,i.needsUpdate=!0,this.geometry.computeBoundingSphere()}setFromObject(t){return this.object=t,this.update(),this}copy(t,e){return super.copy(t,e),this.object=t.object,this}dispose(){this.geometry.dispose(),this.material.dispose()}}class Db extends Vn{constructor(t,e=16776960){const n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),i=[1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],s=new qt;s.setIndex(new oe(n,1)),s.setAttribute("position",new Tt(i,3)),super(s,new $e({color:e,toneMapped:!1})),this.box=t,this.type="Box3Helper",this.geometry.computeBoundingSphere()}updateMatrixWorld(t){const e=this.box;e.isEmpty()||(e.getCenter(this.position),e.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(t))}dispose(){this.geometry.dispose(),this.material.dispose()}}class Ub extends wi{constructor(t,e=1,n=16776960){const i=n,s=[1,-1,0,-1,1,0,-1,-1,0,1,1,0,-1,1,0,-1,-1,0,1,-1,0,1,1,0],a=new qt;a.setAttribute("position",new Tt(s,3)),a.computeBoundingSphere(),super(a,new $e({color:i,toneMapped:!1})),this.type="PlaneHelper",this.plane=t,this.size=e;const o=[1,1,0,-1,1,0,-1,-1,0,1,1,0,-1,-1,0,1,-1,0],l=new qt;l.setAttribute("position",new Tt(o,3)),l.computeBoundingSphere(),this.add(new ue(l,new yn({color:i,opacity:.2,transparent:!0,depthWrite:!1,toneMapped:!1})))}updateMatrixWorld(t){this.position.set(0,0,0),this.scale.set(.5*this.size,.5*this.size,1),this.lookAt(this.plane.normal),this.translateZ(-this.plane.constant),super.updateMatrixWorld(t)}dispose(){this.geometry.dispose(),this.material.dispose(),this.children[0].geometry.dispose(),this.children[0].material.dispose()}}const pd=new R;let Xa,hc;class Nb extends ee{constructor(t=new R(0,0,1),e=new R(0,0,0),n=1,i=16776960,s=n*.2,a=s*.2){super(),this.type="ArrowHelper",Xa===void 0&&(Xa=new qt,Xa.setAttribute("position",new Tt([0,0,0,0,1,0],3)),hc=new cs(0,.5,1,5,1),hc.translate(0,-.5,0)),this.position.copy(e),this.line=new wi(Xa,new $e({color:i,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new ue(hc,new yn({color:i,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(t),this.setLength(n,s,a)}setDirection(t){if(t.y>.99999)this.quaternion.set(0,0,0,1);else if(t.y<-.99999)this.quaternion.set(1,0,0,0);else{pd.set(t.z,0,-t.x).normalize();const e=Math.acos(t.y);this.quaternion.setFromAxisAngle(pd,e)}}setLength(t,e=t*.2,n=e*.2){this.line.scale.set(1,Math.max(1e-4,t-e),1),this.line.updateMatrix(),this.cone.scale.set(n,e,n),this.cone.position.y=t,this.cone.updateMatrix()}setColor(t){this.line.material.color.set(t),this.cone.material.color.set(t)}copy(t){return super.copy(t,!1),this.line.copy(t.line),this.cone.copy(t.cone),this}dispose(){this.line.geometry.dispose(),this.line.material.dispose(),this.cone.geometry.dispose(),this.cone.material.dispose()}}class Ob extends Vn{constructor(t=1){const e=[0,0,0,t,0,0,0,0,0,0,t,0,0,0,0,0,0,t],n=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],i=new qt;i.setAttribute("position",new Tt(e,3)),i.setAttribute("color",new Tt(n,3));const s=new $e({vertexColors:!0,toneMapped:!1});super(i,s),this.type="AxesHelper"}setColors(t,e,n){const i=new ht,s=this.geometry.attributes.color.array;return i.set(t),i.toArray(s,0),i.toArray(s,3),i.set(e),i.toArray(s,6),i.toArray(s,9),i.set(n),i.toArray(s,12),i.toArray(s,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}}class Fb{constructor(){this.type="ShapePath",this.color=new ht,this.subPaths=[],this.currentPath=null}moveTo(t,e){return this.currentPath=new Pr,this.subPaths.push(this.currentPath),this.currentPath.moveTo(t,e),this}lineTo(t,e){return this.currentPath.lineTo(t,e),this}quadraticCurveTo(t,e,n,i){return this.currentPath.quadraticCurveTo(t,e,n,i),this}bezierCurveTo(t,e,n,i,s,a){return this.currentPath.bezierCurveTo(t,e,n,i,s,a),this}splineThru(t){return this.currentPath.splineThru(t),this}toShapes(t){function e(p){const _=[];for(let v=0,y=p.length;v<y;v++){const P=p[v],S=new ns;S.curves=P.curves,_.push(S)}return _}function n(p,_){const v=_.length;let y=!1;for(let P=v-1,S=0;S<v;P=S++){let T=_[P],E=_[S],M=E.x-T.x,b=E.y-T.y;if(Math.abs(b)>Number.EPSILON){if(b<0&&(T=_[S],M=-M,E=_[P],b=-b),p.y<T.y||p.y>E.y)continue;if(p.y===T.y){if(p.x===T.x)return!0}else{const C=b*(p.x-T.x)-M*(p.y-T.y);if(C===0)return!0;if(C<0)continue;y=!y}}else{if(p.y!==T.y)continue;if(E.x<=p.x&&p.x<=T.x||T.x<=p.x&&p.x<=E.x)return!0}}return y}const i=Bn.isClockWise,s=this.subPaths;if(s.length===0)return[];let a,o,l;const c=[];if(s.length===1)return o=s[0],l=new ns,l.curves=o.curves,c.push(l),c;let h=!i(s[0].getPoints());h=t?!h:h;const u=[],d=[];let f=[],m=0,x;d[m]=void 0,f[m]=[];for(let p=0,_=s.length;p<_;p++)o=s[p],x=o.getPoints(),a=i(x),a=t?!a:a,a?(!h&&d[m]&&m++,d[m]={s:new ns,p:x},d[m].s.curves=o.curves,h&&m++,f[m]=[]):f[m].push({h:o,p:x[0]});if(!d[0])return e(s);if(d.length>1){let p=!1,_=0;for(let v=0,y=d.length;v<y;v++)u[v]=[];for(let v=0,y=d.length;v<y;v++){const P=f[v];for(let S=0;S<P.length;S++){const T=P[S];let E=!0;for(let M=0;M<d.length;M++)n(T.p,d[M].p)&&(v!==M&&_++,E?(E=!1,u[M].push(T)):p=!0);E&&u[v].push(T)}}_>0&&p===!1&&(f=u)}let g;for(let p=0,_=d.length;p<_;p++){l=d[p].s,c.push(l),g=f[p];for(let v=0,y=g.length;v<y;v++)l.holes.push(g[v].h)}return c}}class Bb extends kn{constructor(t,e=null){super(),this.object=t,this.domElement=e,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}}class zb extends _n{constructor(t=1,e=1,n=1,i={}){console.warn('THREE.WebGLMultipleRenderTargets has been deprecated and will be removed in r172. Use THREE.WebGLRenderTarget and set the "count" parameter to enable MRT.'),super(t,e,{...i,count:n}),this.isWebGLMultipleRenderTargets=!0}get texture(){return this.textures}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Go}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Go);const kb=Object.freeze(Object.defineProperty({__proto__:null,ACESFilmicToneMapping:Uc,AddEquation:bi,AddOperation:Gd,AdditiveAnimationBlendMode:Xc,AdditiveBlending:Qi,AgXToneMapping:$d,AlphaFormat:zc,AlwaysCompare:hf,AlwaysDepth:no,AlwaysStencilFunc:yc,AmbientLight:op,AnimationAction:mp,AnimationClip:Br,AnimationLoader:By,AnimationMixer:fb,AnimationObjectGroup:ub,AnimationUtils:Uy,ArcCurve:Nf,ArrayCamera:Ef,ArrowHelper:Nb,AttachedBindMode:_c,Audio:fp,AudioAnalyser:eb,AudioContext:vh,AudioListener:jy,AudioLoader:Zy,AxesHelper:Ob,BackSide:Le,BasicDepthPacking:tf,BasicShadowMap:Np,BatchedMesh:Lf,Bone:eh,BooleanKeyframeTrack:us,Box2:bb,Box3:qe,Box3Helper:Db,BoxGeometry:Ai,BoxHelper:Lb,BufferAttribute:oe,BufferGeometry:qt,BufferGeometryLoader:up,ByteType:Oc,Cache:ei,Camera:el,CameraHelper:Pb,CanvasTexture:ln,CapsuleGeometry:ll,CatmullRomCurve3:Of,CineonToneMapping:qd,CircleGeometry:cl,ClampToEdgeWrapping:un,Clock:dp,Color:ht,ColorKeyframeTrack:uh,ColorManagement:Jt,CompressedArrayTexture:iy,CompressedCubeTexture:sy,CompressedTexture:al,CompressedTextureLoader:zy,ConeGeometry:hl,ConstantAlphaFactor:kd,ConstantColorFactor:Bd,Controls:Bb,CubeCamera:_f,CubeReflectionMapping:ai,CubeRefractionMapping:Si,CubeTexture:Wr,CubeTextureLoader:ky,CubeUVReflectionMapping:Xs,CubicBezierCurve:sh,CubicBezierCurve3:Ff,CubicInterpolant:np,CullFaceBack:gc,CullFaceFront:Td,CullFaceFrontBack:Up,CullFaceNone:wd,Curve:Rn,CurvePath:zf,CustomBlending:Dc,CustomToneMapping:Yd,CylinderGeometry:cs,Cylindrical:yb,Data3DTexture:$c,DataArrayTexture:Qo,DataTexture:Fn,DataTextureLoader:Hy,DataUtils:Ym,DecrementStencilOp:Zp,DecrementWrapStencilOp:Jp,DefaultLoadingManager:rp,DepthFormat:ts,DepthStencilFormat:rs,DepthTexture:jc,DetachedBindMode:Kd,DirectionalLight:gh,DirectionalLightHelper:Ib,DiscreteInterpolant:ip,DodecahedronGeometry:ul,DoubleSide:Dn,DstAlphaFactor:Dd,DstColorFactor:Nd,DynamicCopyUsage:um,DynamicDrawUsage:_i,DynamicReadUsage:lm,EdgesGeometry:kf,EllipseCurve:ol,EqualCompare:af,EqualDepth:so,EqualStencilFunc:em,EquirectangularReflectionMapping:Sr,EquirectangularRefractionMapping:wr,Euler:ze,EventDispatcher:kn,ExtrudeGeometry:fl,FileLoader:li,Float16BufferAttribute:Qm,Float32BufferAttribute:Tt,FloatType:tn,Fog:Yr,FogExp2:il,FramebufferTexture:ny,FrontSide:ri,Frustum:Xr,GLBufferAttribute:xb,GLSL1:fm,GLSL3:bc,GreaterCompare:of,GreaterDepth:ao,GreaterEqualCompare:cf,GreaterEqualDepth:ro,GreaterEqualStencilFunc:rm,GreaterStencilFunc:im,GridHelper:Cb,Group:Qn,HalfFloatType:qs,HemisphereLight:fh,HemisphereLightHelper:Eb,IcosahedronGeometry:pl,ImageBitmapLoader:$y,ImageLoader:zr,ImageUtils:pf,IncrementStencilOp:$p,IncrementWrapStencilOp:Kp,InstancedBufferAttribute:je,InstancedBufferGeometry:xh,InstancedInterleavedBuffer:gb,InstancedMesh:Os,Int16BufferAttribute:Jm,Int32BufferAttribute:jm,Int8BufferAttribute:$m,IntType:qo,InterleavedBuffer:sl,InterleavedBufferAttribute:as,Interpolant:Jr,InterpolateDiscrete:Ar,InterpolateLinear:No,InterpolateSmooth:Ka,InvertStencilOp:jp,KeepStencilOp:Wi,KeyframeTrack:In,LOD:If,LatheGeometry:Zr,Layers:tl,LessCompare:rf,LessDepth:io,LessEqualCompare:qc,LessEqualDepth:is,LessEqualStencilFunc:nm,LessStencilFunc:tm,Light:Ci,LightProbe:hp,Line:wi,Line3:Mb,LineBasicMaterial:$e,LineCurve:rh,LineCurve3:Bf,LineDashedMaterial:Qf,LineLoop:Df,LineSegments:Vn,LinearFilter:we,LinearInterpolant:hh,LinearMipMapLinearFilter:zp,LinearMipMapNearestFilter:Bp,LinearMipmapLinearFilter:vn,LinearMipmapNearestFilter:fr,LinearSRGBColorSpace:ls,LinearToneMapping:Wd,LinearTransfer:Gr,Loader:en,LoaderUtils:Cc,LoadingManager:dh,LoopOnce:Jd,LoopPingPong:Qd,LoopRepeat:jd,LuminanceAlphaFormat:Vc,LuminanceFormat:Hc,MOUSE:Lp,Material:ke,MaterialLoader:bl,MathUtils:uf,Matrix2:Mh,Matrix3:Ht,Matrix4:Ut,MaxEquation:Rd,Mesh:ue,MeshBasicMaterial:yn,MeshDepthMaterial:Qc,MeshDistanceMaterial:th,MeshLambertMaterial:Jf,MeshMatcapMaterial:jf,MeshNormalMaterial:Kf,MeshPhongMaterial:$f,MeshPhysicalMaterial:Yf,MeshStandardMaterial:Nr,MeshToonMaterial:Zf,MinEquation:Cd,MirroredRepeatWrapping:Tr,MixOperation:Vd,MultiplyBlending:vc,MultiplyOperation:Hr,NearestFilter:De,NearestMipMapLinearFilter:Fp,NearestMipMapNearestFilter:Op,NearestMipmapLinearFilter:Ds,NearestMipmapNearestFilter:Nc,NeutralToneMapping:Zd,NeverCompare:sf,NeverDepth:eo,NeverStencilFunc:Qp,NoBlending:ni,NoColorSpace:Un,NoToneMapping:ii,NormalAnimationBlendMode:jo,NormalBlending:ji,NotEqualCompare:lf,NotEqualDepth:oo,NotEqualStencilFunc:sm,NumberKeyframeTrack:Or,Object3D:ee,ObjectLoader:qy,ObjectSpaceNormalMap:nf,OctahedronGeometry:Kr,OneFactor:Qa,OneMinusConstantAlphaFactor:Hd,OneMinusConstantColorFactor:zd,OneMinusDstAlphaFactor:Ud,OneMinusDstColorFactor:Od,OneMinusSrcAlphaFactor:ks,OneMinusSrcColorFactor:Ld,OrthographicCamera:qr,PCFShadowMap:Wo,PCFSoftShadowMap:Lc,PMREMGenerator:Oo,Path:Pr,PerspectiveCamera:Pe,Plane:yi,PlaneGeometry:Hn,PlaneHelper:Ub,PointLight:mh,PointLightHelper:Tb,Points:Uf,PointsMaterial:nh,PolarGridHelper:Rb,PolyhedronGeometry:Ei,PositionalAudio:tb,PropertyBinding:Qt,PropertyMixer:pp,QuadraticBezierCurve:ah,QuadraticBezierCurve3:oh,Quaternion:Ae,QuaternionKeyframeTrack:jr,QuaternionLinearInterpolant:sp,RED_GREEN_RGTC2_Format:Do,RED_RGTC1_Format:Wc,REVISION:Go,RGBADepthPacking:ef,RGBAFormat:Xe,RGBAIntegerFormat:Jo,RGBA_ASTC_10x10_Format:Eo,RGBA_ASTC_10x5_Format:wo,RGBA_ASTC_10x6_Format:To,RGBA_ASTC_10x8_Format:Ao,RGBA_ASTC_12x10_Format:Co,RGBA_ASTC_12x12_Format:Ro,RGBA_ASTC_4x4_Format:go,RGBA_ASTC_5x4_Format:xo,RGBA_ASTC_5x5_Format:vo,RGBA_ASTC_6x5_Format:_o,RGBA_ASTC_6x6_Format:yo,RGBA_ASTC_8x5_Format:bo,RGBA_ASTC_8x6_Format:Mo,RGBA_ASTC_8x8_Format:So,RGBA_BPTC_Format:vr,RGBA_ETC2_EAC_Format:mo,RGBA_PVRTC_2BPPV1_Format:uo,RGBA_PVRTC_4BPPV1_Format:ho,RGBA_S3TC_DXT1_Format:mr,RGBA_S3TC_DXT3_Format:gr,RGBA_S3TC_DXT5_Format:xr,RGBDepthPacking:Wp,RGBFormat:kc,RGBIntegerFormat:kp,RGB_BPTC_SIGNED_Format:Io,RGB_BPTC_UNSIGNED_Format:Po,RGB_ETC1_Format:fo,RGB_ETC2_Format:po,RGB_PVRTC_2BPPV1_Format:co,RGB_PVRTC_4BPPV1_Format:lo,RGB_S3TC_DXT1_Format:pr,RGDepthPacking:Xp,RGFormat:Gc,RGIntegerFormat:Ko,RawShaderMaterial:qf,Ray:Ys,Raycaster:vb,RectAreaLight:lp,RedFormat:Zo,RedIntegerFormat:Vr,ReinhardToneMapping:Xd,RenderTarget:mf,RepeatWrapping:Hs,ReplaceStencilOp:Yp,ReverseSubtractEquation:Ed,RingGeometry:ml,SIGNED_RED_GREEN_RGTC2_Format:Uo,SIGNED_RED_RGTC1_Format:Lo,SRGBColorSpace:me,SRGBTransfer:ae,Scene:$r,ShaderChunk:Vt,ShaderLib:cn,ShaderMaterial:Ye,ShadowMaterial:Xf,Shape:ns,ShapeGeometry:gl,ShapePath:Fb,ShapeUtils:Bn,ShortType:Fc,Skeleton:rl,SkeletonHelper:wb,SkinnedMesh:Pf,Source:Ki,Sphere:Be,SphereGeometry:hs,Spherical:_b,SphericalHarmonics3:cp,SplineCurve:lh,SpotLight:ap,SpotLightHelper:Sb,Sprite:ti,SpriteMaterial:On,SrcAlphaFactor:to,SrcAlphaSaturateFactor:Fd,SrcColorFactor:Pd,StaticCopyUsage:hm,StaticDrawUsage:Cr,StaticReadUsage:om,StereoCamera:Ky,StreamCopyUsage:dm,StreamDrawUsage:am,StreamReadUsage:cm,StringKeyframeTrack:ds,SubtractEquation:Ad,SubtractiveBlending:xc,TOUCH:Dp,TangentSpaceNormalMap:Ti,TetrahedronGeometry:xl,Texture:ye,TextureLoader:Vy,TextureUtils:O_,TorusGeometry:vl,TorusKnotGeometry:_l,Triangle:Qe,TriangleFanDrawMode:Gp,TriangleStripDrawMode:Vp,TrianglesDrawMode:Hp,TubeGeometry:yl,UVMapping:Xo,Uint16BufferAttribute:Zc,Uint32BufferAttribute:Kc,Uint8BufferAttribute:Zm,Uint8ClampedBufferAttribute:Km,Uniform:bh,UniformsGroup:mb,UniformsLib:dt,UniformsUtils:vf,UnsignedByteType:zn,UnsignedInt248Type:ss,UnsignedInt5999Type:Bc,UnsignedIntType:oi,UnsignedShort4444Type:Yo,UnsignedShort5551Type:$o,UnsignedShortType:Vs,VSMShadowMap:Ln,Vector2:tt,Vector3:R,Vector4:te,VectorKeyframeTrack:Fr,VideoTexture:ey,WebGL3DRenderTarget:Fm,WebGLArrayRenderTarget:Om,WebGLCoordinateSystem:Nn,WebGLCubeRenderTarget:yf,WebGLMultipleRenderTargets:zb,WebGLRenderTarget:_n,WebGLRenderer:Cf,WebGLUtils:Af,WebGPUCoordinateSystem:Rr,WireframeGeometry:Wf,WrapAroundEnding:Er,ZeroCurvatureEnding:$i,ZeroFactor:Id,ZeroSlopeEnding:Zi,ZeroStencilOp:qp,createCanvasElement:ff},Symbol.toStringTag,{value:"Module"}));let qi=2654435769;function Hb(r){qi=r>>>0}function $t(){qi|=0,qi=qi+1831565813|0;let r=Math.imul(qi^qi>>>15,1|qi);return r=r+Math.imul(r^r>>>7,61|r)^r,((r^r>>>14)>>>0)/4294967296}const j=(r,t)=>r+(t-r)*$t(),V1=r=>r[Math.floor($t()*r.length)],G1=r=>$t()<r;function W1(r){return r=r^61^r>>>16,r=r+(r<<3),r=r^r>>>4,r=Math.imul(r,668265261),r=r^r>>>15,(r>>>0)/4294967296}function fn(r){let t=r>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}const X1=(r,t,e)=>r<t?t:r>e?e:r,Vb=(r,t,e)=>r+(t-r)*e,q1=r=>r*r*(3-2*r),Y1=(r,t,e,n)=>Vb(r,t,1-Math.exp(-e*n));function Te(r,t){const e=fn(r),n=t,i=new Float32Array(n*n);for(let a=0;a<i.length;a++)i[a]=e();return(a,o)=>{const l=Math.floor(a),c=Math.floor(o),h=a-l,u=o-c,d=h*h*(3-2*h),f=u*u*(3-2*u),m=(l%n+n)%n,x=(c%n+n)%n,g=(m+1)%n,p=(x+1)%n,_=i[x*n+m],v=i[x*n+g],y=i[p*n+m],P=i[p*n+g];return _+(v-_)*d+(y-_)*f+(_-v-y+P)*d*f}}function Me(r,t,e,n,i=5,s=.5){let a=.5,o=0,l=0,c=n;for(let h=0;h<i;h++)o+=a*r(t*c,e*c),l+=a,a*=s,c*=2;return o/l}function le(r,t){const e=document.createElement("canvas");return e.width=r,e.height=t,e}function pe(r,{repeat:t=!0,srgb:e=!0,aniso:n=8,mips:i=!0}={}){const s=new ln(r);return t&&(s.wrapS=s.wrapT=Hs),e&&(s.colorSpace=me),s.anisotropy=n,s.generateMipmaps=i,s.needsUpdate=!0,s}function Gb(r,t,e,n){const i=le(t,e),s=i.getContext("2d"),a=s.createImageData(t,e);for(let o=0;o<e;o++)for(let l=0;l<t;l++){const c=r[o*t+(l-1+t)%t],h=r[o*t+(l+1)%t],u=r[(o-1+e)%e*t+l],d=r[(o+1)%e*t+l];let f=(c-h)*n,m=(u-d)*n,x=1;const g=Math.hypot(f,m,x);f/=g,m/=g,x/=g;const p=(o*t+l)*4;a.data[p]=(f*.5+.5)*255,a.data[p+1]=(m*.5+.5)*255,a.data[p+2]=(x*.5+.5)*255,a.data[p+3]=255}return s.putImageData(a,0,0),pe(i,{srgb:!1})}function Wb(r,t){const e={c:le(r,t),r:le(r,t),h:le(r,t)};for(const n in e)e[n+"x"]=e[n].getContext("2d");return e.each=n=>{n(e.cx,"c"),n(e.rx,"r"),n(e.hx,"h")},e}const Ve=(r,t=1)=>`rgba(${r*255|0},${r*255|0},${r*255|0},${t})`,uc={width:19,tileLen:20};function $1(){const e=1024/uc.width,n=512/uc.tileLen,i=Te(11,64),s=Te(23,32),a=Te(37,256),o=Te(41,16),l=Te(53,64),c=fn(99),h=1.6,u=16.4,d=new Float32Array(1024*512),f=new Float32Array(1024*512),m=new Float32Array(1024*512),x=new Float32Array(1024*512);for(let M=0;M<512;M++){const b=M/512;for(let C=0;C<1024;C++){const N=C/1024,D=C/e,U=M*1024+C,H=Me(s,N,b,3,3),k=Me(i,N,b,12,2),G=a(N*256,b*128);let O=.5+(H-.5)*.12+(k-.5)*.06+(G-.5)*.025,J=.88+(k-.5)*.1,K=G*.45,ot=0;const bt=c();if(bt>.975?(O+=.03+c()*.06,K+=.35,ot=(c()-.5)*.04,J+=.03):bt<.035&&(O-=.03+c()*.025,K-=.2),D<h||D>u){const Dt=Me(o,N,b,4,3);O+=.055+(Dt-.5)*.1,ot+=.03}else{const Dt=(D-h)%3.7,Y=Dt-.92,it=Dt-2.78,mt=.7+.3*k,lt=(Math.exp(-Y*Y/.075)+Math.exp(-it*it/.075))*mt;O-=lt*.085,J-=lt*.25,K*=1-lt*.55;const Lt=Dt-1.85,Bt=Math.exp(-Lt*Lt/.1),Nt=Math.min(1,Math.max(0,Me(l,N*2,b*2,16,2)-.47)*4.5),Zt=Bt*Nt;O-=Zt*.13,J-=Zt*.42,ot-=Zt*.04}d[U]=O,f[U]=J,m[U]=K,x[U]=ot}}const g=(M,b,C,N,D)=>{for(let U=Math.max(0,Math.floor(C));U<Math.min(512,N);U++)for(let H=Math.floor(M*e);H<(M+b)*e;H++){const k=Me(i,H/1024,U/512,32,3);if(k<.3)continue;const G=Math.min(1,(k-.28)*3.2)*.95,O=U*1024+H;d[O]=d[O]*(1-G)+D*G,f[O]=f[O]*(1-G)+.72*G,m[O]+=.25*G,x[O]=x[O]*(1-G)+(D<.7?.25:0)*G}};g(1.42,.15,0,512,.66),g(16.4,.16,0,512,.86);for(const M of[5.3,9,12.7])for(let b=0;b<2;b++)g(M-.07,.14,(b*10+1)*n,(b*10+4)*n,.86);const p=Wb(1024,512),_={c:p.cx.createImageData(1024,512),r:p.rx.createImageData(1024,512),h:p.hx.createImageData(1024,512)};for(let M=0;M<1024*512;M++){const b=d[M],C=x[M],N=M*4,D=b*(1.07+C*1.6),U=b*(1.02+C*.7),H=b*(.86-C*1.6);_.c.data[N]=Math.min(255,D*255),_.c.data[N+1]=Math.min(255,U*255),_.c.data[N+2]=Math.max(0,Math.min(255,H*255)),_.c.data[N+3]=255;const k=Math.max(0,Math.min(1,f[M]))*255;_.r.data[N]=_.r.data[N+1]=_.r.data[N+2]=k,_.r.data[N+3]=255;const G=Math.max(0,Math.min(1,m[M]*.6+.2))*255;_.h.data[N]=_.h.data[N+1]=_.h.data[N+2]=G,_.h.data[N+3]=255}p.cx.putImageData(_.c,0,0),p.rx.putImageData(_.r,0,0),p.hx.putImageData(_.h,0,0);const v=(M,b,C=!1,N=1)=>p.each((D,U)=>{M[U]&&(D.lineWidth=N,D.lineCap="round",D.lineJoin="round",C?(D.fillStyle=M[U],D.fill(b)):(D.strokeStyle=M[U],D.stroke(b)))});for(let M=0;M<4;M++){const b=Math.floor(c()*4),C=(h+b*3.7+c()*1.2)*e,N=(.8+c()*2.2)*e,D=c()*512,U=(.8+c()*4)*n,H=new Path2D;H.rect(C,D,N,U),v({c:`rgba(40,37,34,${.12+c()*.1})`,r:Ve(.76,.5),h:Ve(.3,.3)},H,!0),v({c:"rgba(24,22,21,0.55)",r:Ve(.45,.9),h:Ve(.7,.8)},H,!1,2)}for(const M of[h,5.3,9,12.7,u]){const b=new Path2D;let C=(M+.28+(c()-.5)*.08)*e;b.moveTo(C,-4);for(let N=0;N<=520;N+=24)C+=(c()-.5)*3,b.lineTo(C,N);v({c:"rgba(52,46,40,0.32)",r:Ve(.42),h:Ve(.6)},b,!1,2.2)}for(let M=0;M<17;M++){const b=new Path2D;let C=c()*1024,N=c()*512,D=M<6?(c()<.5?0:Math.PI)+(c()-.5)*.4:c()*Math.PI*2;b.moveTo(C,N);const U=10+c()*(M<6?60:30);for(let H=0;H<U;H++)D+=(c()-.5)*.9,C+=Math.cos(D)*9,N+=Math.sin(D)*9,b.lineTo(C,N);v({c:`rgba(58,50,43,${.14+c()*.12})`,r:Ve(.45),h:Ve(.55)},b,!1,.8+c()*1),v({c:"rgba(20,18,16,0.18)",r:null,h:Ve(.1)},b,!1,.5)}for(let M=0;M<70;M++){const b=Math.floor(c()*4),C=(h+b*3.7+1.85+(c()-.5)*.7)*e,N=c()*512,D=3+c()*14,U=new Path2D;U.ellipse(C,N,D*(.35+c()*.3),D*(1.6+c()*1.6),(c()-.5)*.3,0,Math.PI*2),v({c:`rgba(22,18,14,${.07+c()*.12})`,r:Ve(.3,.7),h:null},U,!0)}for(let M=0;M<3;M++){const b=(h+.6+c()*13)*e,C=c()*512*.6,N=(6+c()*8)*n,D=(c()-.5)*2.2*e;for(const U of[0,1.6*e]){const H=new Path2D;H.moveTo(b+U,C),H.quadraticCurveTo(b+U+D*.3,C+N*.5,b+U+D,C+N),v({c:"rgba(12,11,10,0.32)",r:Ve(.55,.6),h:null},H,!1,.2*e)}}for(const M of[.55,16.85])for(let b=0;b<512;b+=5){const C=new Path2D;C.rect(M*e,b,.45*e,2),v({c:"rgba(0,0,0,0.3)",r:null,h:Ve(.05,.8)},C,!0)}for(let M=0;M<1400;M++){const b=c()<.5?c()*(h-.1):u+.2+c()*(uc.width-u-.2),C=new Path2D,N=1+c()*3;C.ellipse(b*e,c()*512,N,N*(.6+c()*.6),c()*3,0,Math.PI*2);const D=c()<.6,U=D?.55+c()*.3:.12+c()*.1;v({c:`rgba(${U*255|0},${U*240|0},${U*215|0},0.85)`,r:null,h:Ve(D?.85:.2)},C,!0)}for(let M=0;M<14;M++){const b=c()<.5?.2+c()*1.1:16.7+c()*2,C=new Path2D,N=b*e,D=c()*512,U=c()*6,H=10+c()*30;C.moveTo(N,D),C.quadraticCurveTo(N+Math.cos(U)*H*.5+6,D+Math.sin(U)*H*.5,N+Math.cos(U)*H,D+Math.sin(U)*H),v({c:"rgba(14,14,15,0.9)",r:Ve(.8),h:Ve(.8)},C,!1,3+c()*4)}const y=pe(p.c,{aniso:16}),P=pe(p.r,{srgb:!1,aniso:16}),S=p.hx.getImageData(0,0,1024,512).data,T=new Float32Array(1024*512);for(let M=0;M<1024*512;M++)T[M]=S[M*4]/255;const E=Gb(T,1024,512,1.6);return E.anisotropy=16,{map:y,normalMap:E,roughnessMap:P}}function Z1(r=5,t=[.62,.58,.52],e=256,n=!0){const i=e,s=e,a=le(i,s),o=a.getContext("2d"),l=o.createImageData(i,s),c=Te(r,64),h=Te(r+7,16),u=fn(r*13);for(let d=0;d<s;d++)for(let f=0;f<i;f++){const m=f/i,x=d/s;let g=.85+(Me(c,m,x,4,5)-.5)*.35+(u()-.5)*.06;n&&(g-=Math.max(0,Me(h,m*3,x*.3,2,3)-.55)*.9*(.4+x*.8));const p=(d*i+f)*4;l.data[p]=t[0]*g*255,l.data[p+1]=t[1]*g*255,l.data[p+2]=t[2]*g*255,l.data[p+3]=255}return o.putImageData(l,0,0),pe(a)}function K1(){const e=le(768,768),n=e.getContext("2d"),i=n.createImageData(768,768),s=Te(77,64),a=Te(78,32),o=Te(79,256),l=Te(80,16),c=fn(5),h=[.66,.57,.36],u=[.5,.49,.3],d=[.62,.49,.36],f=[.57,.55,.51];for(let m=0;m<768;m++)for(let x=0;x<768;x++){const g=x/768,p=m/768,_=Me(s,g,p,3,4),v=Me(a,g,p,10,2),y=o(g*256,p*256),P=Me(l,g,p,6,2),S=Math.min(1,Math.max(0,(_-.45)*4.5)),T=Math.min(1,Math.max(0,(P-.6)*6))*(1-S*.5),E=Math.min(1,Math.max(0,(.42-v)*5)),M=c();let b=h.map((U,H)=>U*(1-E)+u[H]*E);b=b.map((U,H)=>U*(1-S)+d[H]*S),b=b.map((U,H)=>U*(1-T)+f[H]*T);const C=(1-S)*(1-T);let N=(y-.5)*.35*C+(M-.5)*(.12+.2*T);C>.4&&M>.93&&(N+=.22),M<.05&&(N-=.25);const D=(m*768+x)*4;i.data[D]=Math.min(255,b[0]*(1+N)*255),i.data[D+1]=Math.min(255,b[1]*(1+N)*255),i.data[D+2]=Math.min(255,b[2]*(1+N)*255),i.data[D+3]=255}n.putImageData(i,0,0);for(let m=0;m<900;m++){const x=c()*768,g=c()*768;if(Me(s,x/768,g/768,3,5)>.5)continue;const p=4+c()*9,_=5+c()*6,v=c();for(let y=0;y<_;y++){const P=c()*Math.PI*2,S=p*(.5+c()*.6),T=.35+v*.4+c()*.15;n.strokeStyle=`rgba(${T*230|0},${T*200|0},${T*120|0},0.7)`,n.lineWidth=1+c(),n.beginPath(),n.moveTo(x,g),n.lineTo(x+Math.cos(P)*S,g+Math.sin(P)*S),n.stroke()}}for(let m=0;m<160;m++){const x=c()*768,g=c()*768,p=2+Math.pow(c(),3)*16,_=.45+c()*.3;n.fillStyle="rgba(30,24,18,0.45)",n.beginPath(),n.ellipse(x+p*.3,g+p*.35,p*1.05,p*.8,0,0,Math.PI*2),n.fill(),n.fillStyle=`rgb(${_*255|0},${_*245|0},${_*228|0})`,n.beginPath(),n.ellipse(x,g,p,p*(.6+c()*.3),c()*3,0,Math.PI*2),n.fill(),n.fillStyle="rgba(255,240,220,0.3)",n.beginPath(),n.ellipse(x-p*.25,g-p*.25,p*.45,p*.3,0,0,Math.PI*2),n.fill()}for(let m=0;m<60;m++){const x=c()*768,g=c()*768,p=c();if(n.save(),n.translate(x,g),n.rotate(c()*6),p<.35)n.fillStyle=`rgba(${225+c()*30|0},${220+c()*30|0},${205+c()*30|0},0.92)`,n.fillRect(-6,-4,8+c()*10,6+c()*6),n.fillStyle="rgba(0,0,0,0.15)",n.fillRect(-6,2,14,2);else if(p<.55){const _=[[190,30,25],[200,200,205],[40,90,170]][Math.floor(c()*3)];n.fillStyle=`rgb(${_})`,n.fillRect(-5,-2.5,10,5),n.fillStyle="rgba(255,255,255,0.6)",n.fillRect(-5,-2.5,10,1.2)}else p<.72?(n.fillStyle=c()<.5?"rgba(60,110,50,0.85)":"rgba(120,70,30,0.85)",n.fillRect(-7,-2,14,4),n.fillStyle="rgba(255,255,240,0.8)",n.fillRect(-4,-1.5,5,1)):p<.95?(n.strokeStyle="rgba(16,16,17,0.95)",n.lineWidth=4+c()*4,n.beginPath(),n.arc(0,0,14+c()*16,0,.8+c()),n.stroke()):(n.fillStyle="rgb(180,182,186)",n.beginPath(),n.arc(0,0,12,0,Math.PI*2),n.fill(),n.fillStyle="rgb(90,92,96)",n.beginPath(),n.arc(0,0,5,0,Math.PI*2),n.fill());n.restore()}return pe(e,{aniso:8})}function J1(){const t=le(256,256),e=t.getContext("2d"),n=e.createImageData(256,256),i=Te(91,16),s=Te(92,32);for(let a=0;a<256;a++)for(let o=0;o<256;o++){const l=o/256,c=a/256,h=Me(i,l,c,3,4),u=Me(s,l,c,6,3);let d=.5,f=.5,m=.5;const x=Math.min(1,Math.max(0,(h-.58)*5)),g=Math.min(1,Math.max(0,(.38-h)*5)),p=Math.min(1,Math.max(0,(u-.6)*5));d+=-.07*x-.1*g+.04*p,f+=.03*x-.11*g+0*p,m+=-.06*x-.1*g-.02*p;const _=.92+(Me(s,l,c,12,2)-.5)*.25,v=(a*256+o)*4;n.data[v]=d*_*255,n.data[v+1]=f*_*255,n.data[v+2]=m*_*255,n.data[v+3]=255}return e.putImageData(n,0,0),pe(t,{srgb:!1,aniso:4})}function j1(){const e=le(512,256),n=e.getContext("2d"),i=Te(61,32),s=fn(62),a=n.createImageData(512,256);for(let o=0;o<256;o++)for(let l=0;l<512;l++){const c=.6+(Me(i,l/512,o/256*.5,6,4)-.5)*.22+(s()-.5)*.05,h=(o*512+l)*4;a.data[h]=c*240,a.data[h+1]=c*242,a.data[h+2]=c*246,a.data[h+3]=255}n.putImageData(a,0,0);for(let o=1;o<8;o++){const l=o*256/8;n.fillStyle="rgba(0,0,0,0.45)",n.fillRect(0,l-1.5,512,3),n.fillStyle="rgba(255,255,255,0.18)",n.fillRect(0,l+1.5,512,1.5)}for(let o=0;o<6;o++){const l=20+o*472/5;for(let c=8;c<256;c+=16)n.fillStyle="rgba(30,30,32,0.7)",n.fillRect(l-1.5,c-1.5,3,3)}for(let o=0;o<220;o++)n.fillStyle=`rgba(60,48,36,${.04+s()*.08})`,n.fillRect(s()*512,s()*256*.6,2+s()*4,20+s()*80);return n.fillStyle="rgba(40,40,42,0.85)",n.font="600 14px Oswald, sans-serif",n.fillText("CALTRANS  D7  0412-B",24,242),pe(e,{repeat:!1})}function Q1(r=3){const n=le(128,128),i=n.getContext("2d"),s=i.createImageData(128,128),a=Te(r,32);for(let o=0;o<128;o++)for(let l=0;l<128;l++){const c=.75+(Me(a,l/128,o/128*.2,4,4)-.5)*.4,h=(o*128+l)*4;s.data[h]=s.data[h+1]=s.data[h+2]=c*255,s.data[h+3]=255}return i.putImageData(s,0,0),pe(n)}function tM(){const e=le(128,512),n=e.getContext("2d"),i=fn(42);n.clearRect(0,0,128,512);for(let a=10;a<508;a+=3){const o=a/512,l=(Math.sin(o*Math.PI)*.85+.15)*(128*.5)*(.85+i()*.3);for(const c of[-1,1]){const h=60+i()*50;n.strokeStyle=`rgb(${h*.55|0},${h|0},${h*.35|0})`,n.lineWidth=1.6+i(),n.beginPath(),n.moveTo(128/2,a),n.quadraticCurveTo(128/2+c*l*.6,a+6,128/2+c*l,a+18+i()*14),n.stroke()}}return n.strokeStyle="rgb(70,64,34)",n.lineWidth=3,n.beginPath(),n.moveTo(128/2,0),n.lineTo(128/2,512),n.stroke(),pe(e,{repeat:!1})}function eM(){const e=le(64,256),n=e.getContext("2d"),i=fn(8);for(let s=0;s<256;s+=1){const o=.42+(s%12/12<.25?-.14:0)+(i()-.5)*.05;n.fillStyle=`rgb(${o*255*1.05|0},${o*255*.88|0},${o*255*.66|0})`,n.fillRect(0,s,64,1)}return pe(e)}function nM(r){const n=le(2048,256),i=n.getContext("2d"),s=fn(r);i.clearRect(0,0,2048,256);let a=0;for(;a<2048;){const l=18+s()*60,c=s()<.12,h=c?120+s()*120:30+s()*90,u=30+s()*25;i.fillStyle=`rgb(${u+8|0},${u|0},${u+14|0})`,i.fillRect(a,256-h,l,h),c&&s()<.5&&i.fillRect(a+l*.45,256-h-25,2,25);for(let d=256-h+6;d<252;d+=6)for(let f=a+3;f<a+l-3;f+=5)s()<.16&&(i.fillStyle=`rgba(255,${180+s()*60|0},${90+s()*60|0},${.5+s()*.5})`,i.fillRect(f,d,2,2));a+=l+(s()<.3?s()*12:0)}const o=pe(n,{repeat:!0});return o.wrapT=un,o}function md(r="rgba(255,255,255,1)",t="rgba(255,200,120,0.35)"){const n=le(128,128),i=n.getContext("2d"),s=i.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);return s.addColorStop(0,r),s.addColorStop(.18,t),s.addColorStop(1,"rgba(0,0,0,0)"),i.fillStyle=s,i.fillRect(0,0,128,128),pe(n,{repeat:!1})}function Xb(){const e=le(512,64),n=e.getContext("2d"),i=n.createImageData(512,64);for(let s=0;s<64;s++)for(let a=0;a<512;a++){const o=(a/512-.5)*2,l=(s/64-.5)*2,c=Math.exp(-l*l*40)*Math.pow(1-Math.abs(o),2.2)+Math.exp(-(o*o+l*l)*30)*.6,h=(s*512+a)*4;i.data[h]=255,i.data[h+1]=230,i.data[h+2]=200,i.data[h+3]=Math.min(255,c*255)}return n.putImageData(i,0,0),pe(e,{repeat:!1})}function qb(){const t=le(256,256),e=t.getContext("2d"),n=e.createRadialGradient(256/2,256/2,256*.3,256/2,256/2,256/2);return n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.7,"rgba(255,230,200,0.9)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,256,256),pe(t,{repeat:!1})}function Yb(){const t=le(256,256),e=t.getContext("2d"),n=Te(4,16),i=e.createImageData(256,256);for(let s=0;s<256;s++)for(let a=0;a<256;a++){const o=a/256-.5,l=s/256-.5,c=Math.hypot(o,l)*2,h=Me(n,a/256,s/256,3,4),u=Math.max(0,1-c*(.8+h*.6)),d=(s*256+a)*4;i.data[d]=10,i.data[d+1]=8,i.data[d+2]=6,i.data[d+3]=Math.min(255,u*1.6*255)}return e.putImageData(i,0,0),pe(t,{repeat:!1})}function iM(){const t=le(64,64),e=t.getContext("2d"),n=e.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);return n.addColorStop(0,"rgba(0,0,0,1)"),n.addColorStop(.18,"rgba(10,10,10,1)"),n.addColorStop(.28,"rgba(190,190,195,0.9)"),n.addColorStop(.45,"rgba(60,60,60,0.5)"),n.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=n,e.fillRect(0,0,64,64),pe(t,{repeat:!1})}function sM(){const t=le(256,256),e=t.getContext("2d"),n=fn(31);e.clearRect(0,0,256,256),e.strokeStyle="rgba(230,235,240,0.85)";for(let i=0;i<4;i++){const s=n()*256,a=n()*256;for(let o=0;o<14;o++){let l=s,c=a,h=o/14*Math.PI*2+n()*.3;e.lineWidth=1+n(),e.beginPath(),e.moveTo(l,c);for(let u=0;u<6;u++)h+=(n()-.5)*.5,l+=Math.cos(h)*14,c+=Math.sin(h)*14,e.lineTo(l,c);e.stroke()}for(let o=1;o<4;o++)e.lineWidth=.8,e.beginPath(),e.arc(s,a,o*14+n()*6,0,Math.PI*2),e.stroke()}return pe(t,{repeat:!1})}function rM(r,{arrow:t=!0,exit:e=null}={}){const s=le(512,256),a=s.getContext("2d");a.fillStyle="#0c5a34",a.fillRect(0,0,512,256),a.strokeStyle="#f2f2ea",a.lineWidth=8,a.strokeRect(10,10,492,236);const o=fn(r.join("").length*7);for(let c=0;c<600;c++)a.fillStyle=`rgba(0,0,0,${o()*.08})`,a.fillRect(o()*512,o()*256*1,3,3+o()*20);a.fillStyle="#f4f4ec",a.font="700 64px Oswald, sans-serif",a.textAlign="center",a.textBaseline="middle";const l=r.length===1?[256*.42]:[256*.3,256*.56];if(r.forEach((c,h)=>a.fillText(c,512/2,l[h])),t){a.beginPath();const c=512/2,h=256*.82;a.moveTo(c,h-24),a.lineTo(c+22,h+2),a.lineTo(c+8,h+2),a.lineTo(c+8,h+26),a.lineTo(c-8,h+26),a.lineTo(c-8,h+2),a.lineTo(c-22,h+2),a.closePath(),a.fill()}return e&&(a.fillStyle="#0c5a34",a.fillRect(322,0,180,54),a.strokeRect(322,10,180,44),a.fillStyle="#f4f4ec",a.font="600 34px Oswald, sans-serif",a.fillText(e,412,34)),pe(s,{repeat:!1})}function aM(r){const n=le(512,192),i=n.getContext("2d"),s=i.createLinearGradient(0,0,512,192);return r===0?(s.addColorStop(0,"#d22b1f"),s.addColorStop(1,"#7d0d0a"),i.fillStyle=s,i.fillRect(0,0,512,192),i.fillStyle="#ffe9c4",i.font="400 92px Anton, Impact, sans-serif",i.textAlign="left",i.textBaseline="middle",i.fillText("KABLAM",30,192*.45),i.font="600 30px Oswald, sans-serif",i.fillText("ENERGY DRINK — NOW 40% LOUDER",34,192*.83)):r===1?(s.addColorStop(0,"#0f2742"),s.addColorStop(1,"#1d5e8c"),i.fillStyle=s,i.fillRect(0,0,512,192),i.fillStyle="#f5b335",i.font="400 76px Anton, Impact, sans-serif",i.textAlign="center",i.textBaseline="middle",i.fillText("HAVEN CITY",512/2,192*.42),i.fillStyle="#fff",i.font="500 30px Oswald, sans-serif",i.fillText("WHERE EVERY DAY IS GOLDEN HOUR",512/2,192*.8)):r===3?(s.addColorStop(0,"#111"),s.addColorStop(1,"#2b2b2b"),i.fillStyle=s,i.fillRect(0,0,512,192),i.fillStyle="#ff6a1a",i.font="400 84px Anton, Impact, sans-serif",i.textAlign="left",i.textBaseline="middle",i.fillText("EXPLOSIONS 4",26,192*.42),i.fillStyle="#ddd",i.font="600 28px Oswald, sans-serif",i.fillText("IN THEATERS FRIDAY  •  RATED R FOR RELENTLESSNESS",30,192*.82)):r===4?(s.addColorStop(0,"#f6d23a"),s.addColorStop(1,"#e08a14"),i.fillStyle=s,i.fillRect(0,0,512,192),i.fillStyle="#1a1208",i.font="400 72px Anton, Impact, sans-serif",i.textAlign="center",i.textBaseline="middle",i.fillText("CHASE GONE BAD? CALL VINNY",512/2,192*.42),i.font="700 32px Oswald, sans-serif",i.fillText("1-800-WRECKED",512/2,192*.8)):(s.addColorStop(0,"#f0e2c0"),s.addColorStop(1,"#c9a56a"),i.fillStyle=s,i.fillRect(0,0,512,192),i.fillStyle="#20140a",i.font="400 70px Anton, Impact, sans-serif",i.textAlign="center",i.textBaseline="middle",i.fillText("DUSTY'S DINER",512/2,192*.42),i.font="600 30px Oswald, sans-serif",i.fillText("EXIT 42B  •  OPEN 24 HRS",512/2,192*.8)),pe(n,{repeat:!1})}function xp(r,{font:t="Anton",size:e=120,color:n="chrome",stroke:i=8,glow:s="rgba(255,120,20,0.9)",padding:a=40,sub:o=null}={}){const l=le(8,8).getContext("2d");l.font=`400 ${e}px ${t}, Impact, sans-serif`;let c=l.measureText(r).width;o&&(l.font=`500 ${e*.3}px Oswald, sans-serif`,c=Math.max(c,l.measureText(o).width),l.font=`400 ${e}px ${t}, Impact, sans-serif`);const h=Math.ceil(c+a*2),u=Math.ceil(e*1.35+a*2+(o?e*.4:0)),d=le(h,u),f=d.getContext("2d");f.font=l.font,f.textAlign="center",f.textBaseline="middle";const m=a+e*.68;s&&(f.shadowColor=s,f.shadowBlur=e*.35),f.lineJoin="round",f.strokeStyle="rgba(10,6,2,0.95)",f.lineWidth=i*2,f.strokeText(r,h/2,m),f.shadowBlur=0;let x;return n==="chrome"?(x=f.createLinearGradient(0,m-e*.55,0,m+e*.55),x.addColorStop(0,"#ffffff"),x.addColorStop(.42,"#e8d2b0"),x.addColorStop(.5,"#6a4a2c"),x.addColorStop(.58,"#ffc46b"),x.addColorStop(1,"#fff2d6")):n==="fire"?(x=f.createLinearGradient(0,m-e*.55,0,m+e*.55),x.addColorStop(0,"#fff6c8"),x.addColorStop(.45,"#ffb21a"),x.addColorStop(1,"#e2340b")):x=n,f.fillStyle=x,f.fillText(r,h/2,m),f.globalCompositeOperation="source-atop",f.fillStyle="rgba(255,255,255,0.25)",f.fillRect(0,m-e*.5,h,e*.12),f.globalCompositeOperation="source-over",o&&(f.font=`500 ${e*.3}px Oswald, sans-serif`,f.fillStyle="#ffe7c2",f.shadowColor="rgba(0,0,0,0.9)",f.shadowBlur=8,f.fillText(o,h/2,m+e*.78)),{texture:pe(d,{repeat:!1,aniso:4}),aspect:h/u,canvas:d}}function oM(r=21){const n=le(512,512),i=n.getContext("2d"),s=i.createImageData(512,512),a=Te(r,64),o=Te(r+3,16),l=Te(r+9,32),c=fn(r);for(let u=0;u<512;u++)for(let d=0;d<512;d++){const f=d/512,m=u/512,x=Math.floor(m*25),g=(f*25+x%2*.5)%1,p=m*25%1,_=g<.04||p<.08?.78:1;let v=(.74+(Me(a,f,m,8,4)-.5)*.22+(c()-.5)*.08)*_;v-=Math.max(0,Me(o,f*4,m*.25,2,3)-.5)*.5*(1-m*.6),f%.5<.035&&(v*=.82);let P=[.78*v,.7*v,.6*v];const S=.18+Me(l,f,.5,6,4)*.5,T=Me(l,f*4,m*4,16,4),E=c();if(1-m<S*(.6+T*.8)&&T>.42&&E>.18){const b=.12+T*.28+(E-.5)*.14;P=[b*.5,b*.66,b*.32]}const M=(u*512+d)*4;s.data[M]=Math.min(255,P[0]*255),s.data[M+1]=Math.min(255,P[1]*255),s.data[M+2]=Math.min(255,P[2]*255),s.data[M+3]=255}i.putImageData(s,0,0);const h=["BAY","K-RAD","BOOM","405","DUSK"];for(let u=0;u<1;u++){i.save(),i.translate(60+c()*292,170+c()*90),i.rotate((c()-.5)*.2),i.font=`400 ${50+c()*30}px Anton, Impact`;const d=[["#d43a2a","#1a1a1a"],["#3a7bd4","#f2f2f2"],["#e0b02a","#2a1a10"]][u%3];i.lineWidth=6,i.strokeStyle=d[1],i.globalAlpha=.5;const f=h[Math.floor(c()*h.length)];i.strokeText(f,0,0),i.fillStyle=d[0],i.fillText(f,0,0),i.restore()}return pe(n,{aniso:8})}function lM(r=3,t=[.32,.46,.2],e=null){const s=le(256,256),a=s.getContext("2d"),o=fn(r);a.clearRect(0,0,256,256);for(let l=0;l<900;l++){const c=o()*Math.PI*2,h=Math.pow(o(),.6)*118,u=256/2+Math.cos(c)*h,d=256*.58+Math.sin(c)*h*.75;if(d>252)continue;const f=.55+o()*.6,m=d/256*.45+.75;a.fillStyle=`rgb(${t[0]*f*255/m|0},${t[1]*f*255/m|0},${t[2]*f*255/m|0})`,a.beginPath(),a.ellipse(u,d,3+o()*5,1.5+o()*2.5,o()*3,0,Math.PI*2),a.fill(),e&&o()<.06&&(a.fillStyle=e,a.beginPath(),a.arc(u,d,2.5,0,Math.PI*2),a.fill())}return pe(s,{repeat:!1})}function cM(){const t=le(128,128),e=t.getContext("2d"),n=e.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);return n.addColorStop(0,"rgba(0,0,0,0.85)"),n.addColorStop(.55,"rgba(0,0,0,0.6)"),n.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=n,e.fillRect(0,0,128,128),pe(t,{repeat:!1,srgb:!1})}const gd=["LIQUOR","TACOS","NAILS","DONUTS","PHO 99","PAWN","TIRES","LAUNDRY","CHECKS CASHED","PHARMACY","VIDEO","INSURANCE","BAIL BONDS","BURGERS","DENTIST","WIGS","MATTRESS","TATTOO","BOBA","GUNS & AMMO","DISCOUNT","CELL REPAIR","BBQ","MOTEL"];function hM(){const e=le(2048,2048),n=e.getContext("2d"),i=le(2048,2048),s=i.getContext("2d"),a=le(1024,1024),o=a.getContext("2d");n.fillStyle="#808080",n.fillRect(0,0,2048,2048),s.fillStyle="#000",s.fillRect(0,0,2048,2048),o.fillStyle="#000",o.fillRect(0,0,1024,1024);const l=fn(2024),c=(S,T,E,M,b)=>{s.clearRect(S,T,E,M),s.fillStyle=`rgba(0,0,0,${1-.5*b})`,s.fillRect(S,T,E,M)},h=(S,T,E,M,b,C=null)=>{n.fillStyle=b,n.fillRect(S,T,E,M),C!==null&&c(S,T,E,M,C)},u=(S,T,E,M,b)=>{o.fillStyle=b,o.fillRect(S/2,T/2,E/2,M/2)},d=(S,T,E,M,b,C=.05)=>{for(let N=0;N<b;N++)n.fillStyle=l()<.5?`rgba(0,0,0,${l()*C})`:`rgba(255,255,255,${l()*C})`,n.fillRect(S+l()*E,T+l()*M,1+l()*4,1+l()*4)},f=(S,T,E,M)=>{const b=n.createLinearGradient(0,S,0,S+T);return b.addColorStop(0,E),b.addColorStop(1,M),b},m=()=>{const S=l();return S<.55?`rgb(${235+l()*20|0},${170+l()*40|0},${90+l()*40|0})`:S<.85?`rgb(${200+l()*30|0},${215+l()*25|0},${230+l()*25|0})`:`rgb(${90+l()*40|0},${130+l()*50|0},${230+l()*25|0})`},x={},g=(S,T,E,M,b,C,N)=>{x[S]={r:[T/2048,1-(E+b)/2048,M/2048,b/2048],t:[C,N]}};{const M=85.33333333333333,b=1024/12;h(0,0,1024,1024,"rgb(236,229,216)",1),d(0,0,1024,1024,9e3,.06);const C=[];for(let N=0;N<12;N++)C.push(N%4===0?2:N%2?0:1);for(let N=0;N<12;N++){const D=0+(11-N)*b;n.fillStyle="rgba(0,0,0,0.06)",n.fillRect(0,D+b-3,1024,3);for(let U=0;U<12;U++){const H=C[U],k=0+U*M,G=M*(H===2?.34:H===1?.62:.5),O=b*(H===2?.62:.5),J=k+(M-G)/2,K=D+b*(H===2?.16:.22),ot=l()<.055;h(J-3,K-3,G+6,O+6,"rgb(58,52,46)",0);const bt=.75+l()*.5;n.fillStyle=ot?f(K,O,"rgb(225,180,120)","rgb(160,110,60)"):f(K,O,`rgb(${180*bt|0},${154*bt|0},${148*bt|0})`,`rgb(${46*bt|0},${46*bt|0},${54*bt|0})`),n.fillRect(J,K,G,O);const Dt=l();if(Dt<.3){n.fillStyle="rgba(215,205,185,0.75)";const it=O*(.3+l()*.6);for(let mt=0;mt<it;mt+=3)n.fillRect(J,K+mt,G,1.6)}else if(Dt<.45){const it=["rgba(170,60,50,0.8)","rgba(200,180,120,0.8)","rgba(70,90,130,0.8)"][Math.floor(l()*3)];n.fillStyle=it,n.fillRect(J,K,G*.28,O),n.fillRect(J+G*.72,K,G*.28,O)}else if(Dt<.53&&H!==2){n.fillStyle="rgb(150,150,146)",n.fillRect(J+G*.25,K+O*.58,G*.5,O*.42),n.fillStyle="rgba(0,0,0,0.4)";for(let it=0;it<5;it++)n.fillRect(J+G*.28,K+O*.64+it*4,G*.44,1.5)}if(H===1&&h(J+G/2-1.5,K,3,O,"rgb(58,52,46)",0),ot){const it=m();if(u(J,K,G,O,it),Dt<.3){o.fillStyle="rgba(0,0,0,0.6)";for(let mt=0;mt<O;mt+=6)o.fillRect(J/2,(K+mt)/2,G/2,1)}Dt>=.3&&Dt<.45&&(o.fillStyle="#000",o.fillRect(J/2,K/2,G*.14,O/2),o.fillRect((J+G*.72)/2,K/2,G*.14,O/2))}h(J-6,K+O+3,G+12,5,"rgb(222,216,206)",.3);const Y=n.createLinearGradient(0,K+O+8,0,K+O+40);Y.addColorStop(0,"rgba(70,60,50,0.22)"),Y.addColorStop(1,"rgba(70,60,50,0)"),n.fillStyle=Y,n.fillRect(J-2,K+O+8,G+4,32)}}g("F0",0,0,1024,1024,12*3.4,12*3.3)}{const C=85.33333333333333;h(1024,0,1024,1024,"rgb(226,221,213)",1),d(1024,0,1024,1024,6e3,.05);for(let N=0;N<12;N++){const D=0+(11-N)*C,U=C*.6,H=.8+l()*.35;h(1024,D,1024,U,f(D,U,`rgb(${168*H|0},${150*H|0},${142*H|0})`,`rgb(${36*H|0},${40*H|0},${50*H|0})`),0),l()<.35&&(n.fillStyle="rgba(205,200,188,0.7)",n.fillRect(1024,D,1024,U*(.15+l()*.3)));let k=0,G=null;for(let O=0;O<16;O++)k<=0&&l()<.035&&(k=2+Math.floor(l()*5),G=m()),k>0&&(u(1024+O*64,D,64,U,G),n.fillStyle="rgba(255,240,215,0.25)",n.fillRect(1024+O*64,D,64,U),k--),h(1024+O*64-2,D,4,U,"rgb(84,86,90)",.3),O%2===0&&(n.fillStyle="rgba(0,0,0,0.12)",n.fillRect(1024+O*64-1,D+U,2,C-U));h(1024,D+U,1024,4,"rgb(84,86,90)",.3),n.fillStyle="rgba(0,0,0,0.1)",n.fillRect(1024,D+U+4,1024,6)}g("F1",1024,0,1024,1024,16*1.5,12*3.8)}{const C=85.33333333333333;for(let N=0;N<12;N++)for(let D=0;D<16;D++){const U=0+D*64,H=1024+(11-N)*C,k=.85+l()*.3,G=(11-N)/12,O=[170-G*90,140-G*70,150-G*60].map(K=>K*k|0),J=[60-G*25,82-G*30,96-G*30].map(K=>K*k|0);if(h(U,H,64,C,f(H,C,`rgb(${O})`,`rgb(${J})`),0),l()<.03){const K=m();u(U,H+6,64,C*.7,K),n.fillStyle="rgba(255,240,220,0.2)",n.fillRect(U,H,64,C)}h(U-1.5,H,3,C,"rgb(70,76,82)",.35)}for(let N=0;N<12;N++){const D=1024+(11-N)*C;h(0,D+C-8,1024,8,"rgb(36,42,48)",.2),h(0,D+C-9,1024,2,"rgb(110,116,122)",.35)}g("F2",0,1024,1024,1024,16*1.5,12*3.8)}const p=[["#b8261c","#fff4dc"],["#f2c230","#2a1a0c"],["#1c4f8c","#ffffff"],["#2a7a48","#f4f0e0"],["#f0ece2","#c0201a"],["#1a1a1c","#ffcc33"],["#e86a1a","#ffffff"],["#7a2a7a","#ffe0f0"]],_=(S,T)=>{h(1024,S,1024,256,"rgb(234,226,212)",1),d(1024,S,1024,256,1500,.05);for(let N=0;N<8;N++){const D=1024+N*128+7,U=114,H=l(),[k,G]=p[Math.floor(l()*p.length)],O=gd[Math.floor(l()*gd.length)],J=l()<.45;if(h(D,S+6,U,52,k,0),n.fillStyle="rgba(0,0,0,0.25)",n.fillRect(D,S+54,U,4),n.font=`400 ${O.length>8?22:32}px Anton, Impact, sans-serif`,n.textAlign="center",n.textBaseline="middle",n.fillStyle=G,n.fillText(O,D+U/2,S+32,U-10),J&&(o.fillStyle=k,o.globalAlpha=.55,o.fillRect(D/2,(S+6)/2,U/2,26),o.globalAlpha=1,o.font=`400 ${O.length>8?11:16}px Anton, Impact, sans-serif`,o.textAlign="center",o.textBaseline="middle",o.fillStyle=G,o.fillText(O,(D+U/2)/2,(S+32)/2,U/2-5)),h(D,S+62,U,4,"rgb(50,48,46)",0),H<.22){h(D,S+66,U,170,"rgb(148,148,144)",0),n.fillStyle="rgba(0,0,0,0.28)";for(let K=S+68;K<S+236;K+=5)n.fillRect(D,K,U,1.5);if(l()<.6){n.save(),n.translate(D+U*.5,S+150),n.rotate((l()-.5)*.3),n.font="400 30px Anton, Impact",n.textAlign="center",n.lineWidth=4,n.strokeStyle="rgba(20,20,20,0.6)";const K=["K-RAD","BAY","LA","405","SKRT"][Math.floor(l()*5)];n.strokeText(K,0,0),n.fillStyle=["#d43a2a","#3a7bd4","#e0b02a","#33b060"][Math.floor(l()*4)],n.fillText(K,0,0),n.restore()}}else{const K=l()<.28;h(D,S+66,U,170,"rgb(64,62,60)",0),n.fillStyle=K?f(S+70,162,"rgb(128,114,96)","rgb(66,58,50)"):f(S+70,162,"rgb(132,122,124)","rgb(30,32,38)"),n.fillRect(D+4,S+70,U-8,162),n.fillStyle="rgba(200,190,170,0.18)";for(let ot=0;ot<3;ot++)n.fillRect(D+8,S+120+ot*34,U-16,3);for(let ot=0;ot<2;ot++)l()<.6&&(n.fillStyle=p[Math.floor(l()*p.length)][0],n.fillRect(D+10+l()*(U-40),S+84+l()*60,18,24));if(h(D+U/2-2,S+70,4,162,"rgb(64,62,60)",0),l()<.5&&(h(D+U*.6,S+104,U*.32,128,"rgb(40,38,36)",0),n.fillStyle="rgba(140,130,120,0.5)",n.fillRect(D+U*.62,S+108,U*.28,120),h(D+U*.64,S+168,3,14,"rgb(200,200,200)",0)),K){const ot=l()<.4,bt=.6+l()*.4;u(D+4,S+70,U-8,162,ot?`rgb(${78*bt|0},${86*bt|0},${92*bt|0})`:`rgb(${96*bt|0},${70*bt|0},${38*bt|0})`),o.fillStyle="rgba(0,0,0,0.5)";for(let Dt=0;Dt<3;Dt++)o.fillRect((D+8)/2,(S+120+Dt*34)/2,(U-16)/2,4);l()<.5&&(o.fillStyle="rgb(255,40,60)",o.fillRect((D+12)/2,(S+80)/2,14,5),n.fillStyle="rgb(255,90,100)",n.fillRect(D+12,S+80,28,10))}}h(D-7,S+236,U+14,20,"rgb(96,92,86)",.2)}};_(1024),g("SF0",1024,1024,1024,256,8*4.5,5),_(1280),g("SF1",1024,1280,1024,256,8*4.5,5);const v=(S,T,E,M,b,C)=>{n.save(),n.beginPath(),n.rect(T,E,256,256),n.clip(),C(T,E),n.restore(),g(S,T,E,256,256,M,b)};v("TRIM",1024,1536,4,4,(S,T)=>{h(S,T,256,256,"rgb(226,220,210)",.35),d(S,T,256,256,900,.06)}),v("ROOF",1280,1536,8,8,(S,T)=>{h(S,T,256,256,"rgb(132,126,118)",0),d(S,T,256,256,3e3,.12),n.fillStyle="rgba(30,28,26,0.5)";for(let E=0;E<4;E++)n.fillRect(S,T+32+E*64,256,2);n.fillStyle="rgba(200,195,185,0.25)",n.fillRect(S+40,T+90,90,60)}),v("WALK",1536,1536,3,3,(S,T)=>{h(S,T,256,256,"rgb(190,184,174)",0),d(S,T,256,256,2500,.08),n.fillStyle="rgba(40,36,32,0.55)",n.fillRect(S,T,256,3),n.fillRect(S,T+128,256,2),n.fillRect(S,T,3,256),n.fillRect(S+128,T,2,256);for(let E=0;E<30;E++)n.fillStyle="rgba(40,36,34,0.35)",n.beginPath(),n.arc(S+l()*256,T+l()*256,1.5+l()*2,0,Math.PI*2),n.fill();n.fillStyle="rgba(70,60,50,0.12)",n.beginPath(),n.ellipse(S+180,T+70,40,22,.4,0,Math.PI*2),n.fill()}),v("METAL",1792,1536,2,2,(S,T)=>{h(S,T,256,256,"rgb(166,168,170)",0);for(let M=0;M<256;M+=16)n.fillStyle="rgba(0,0,0,0.25)",n.fillRect(S+M,T,3,256),n.fillStyle="rgba(255,255,255,0.18)",n.fillRect(S+M+3,T,2,256);const E=n.createLinearGradient(0,T+150,0,T+256);E.addColorStop(0,"rgba(90,70,50,0)"),E.addColorStop(1,"rgba(90,70,50,0.35)"),n.fillStyle=E,n.fillRect(S,T+150,256,106)}),v("AWNS",1024,1792,2,1,(S,T)=>{for(let E=0;E<8;E++)h(S+E*32,T,32,256,E%2?"rgb(232,224,206)":"rgb(176,40,34)",0);d(S,T,256,256,800,.08)}),v("AWNG",1280,1792,2,1,(S,T)=>{h(S,T,256,256,"rgb(40,92,66)",0),n.fillStyle="rgba(0,0,0,0.12)";for(let E=0;E<256;E+=4)n.fillRect(S,T+E,256,1)}),v("AD",1536,1792,1,1,(S,T)=>{const E=n.createLinearGradient(S,T,S,T+256);E.addColorStop(0,"#f6d23a"),E.addColorStop(1,"#e07a14"),h(S,T,256,256,E,0),n.fillStyle="#1a1208",n.textAlign="center",n.textBaseline="middle",n.font="400 60px Anton, Impact",n.fillText("MOTEL",S+128,T+80),n.font="400 40px Anton, Impact",n.fillText("VACANCY",S+128,T+150),n.font="600 22px Oswald",n.fillText("HBO • ICE • POOL",S+128,T+205),h(S,T,256,8,"#333",0),h(S,T+248,256,8,"#333",0)}),v("DARK",1792,1792,2,2,(S,T)=>{h(S,T,256,256,"rgb(34,34,36)",0),d(S,T,256,256,600,.1)}),n.save(),n.globalCompositeOperation="destination-in",n.drawImage(i,0,0),n.restore();const y=pe(e,{repeat:!1,aniso:4});y.minFilter=vn;const P=pe(a,{repeat:!1,aniso:4});return{map:y,emissiveMap:P,R:x}}const ci=new R(-.42,.105,-1).normalize(),Cn={sunColor:{r:2.3,g:.95,b:.36},sunDirView:{x:0,y:0,z:-1}},$b=new ht(.86,.5,.36),ja={color:{r:1.6,g:.85,b:.45}};function Zb(){const r=Vt;r.lights_pars_begin=`uniform vec3 rimSunDir;
uniform vec3 rimColor;
`+r.lights_pars_begin,r.lights_fragment_end+=`
  {
    float ndv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
    float fr = pow(1.0 - ndv, 5.0);
    float back = clamp(dot(-geometryViewDir, rimSunDir), 0.0, 1.0);
    // world-up facing surfaces (road, roofs) get no rim: viewMatrix maps world up into view space
    float nUp = dot(geometryNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
    float sideMask = 1.0 - smoothstep(0.45, 0.85, nUp);
    reflectedLight.directSpecular += rimColor * fr * (0.04 + 0.4 * pow(back, 3.0)) * sideMask;
  }`,r.colorspace_pars_fragment+=`
vec3 bayGrade(vec3 c){
  c = clamp(c, 0.0, 1.0);
  c = c * 0.965 + vec3(0.022, 0.018, 0.02); // filmic black lift
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // filmic S-curve for punch
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.42);
  // split-tone: teal shadows, amber highlights
  c += vec3(-0.02, 0.018, 0.04) * (1.0 - smoothstep(0.0, 0.5, l)) * smoothstep(0.0, 0.12, l);
  c += vec3(0.06, 0.02, -0.05) * smoothstep(0.45, 1.0, l);
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l2), c, 1.16);
  return clamp(c, 0.0, 1.0);
}`,r.colorspace_fragment=`gl_FragColor = linearToOutputTexel( gl_FragColor );
#ifdef TONE_MAPPING
  gl_FragColor.rgb = bayGrade(gl_FragColor.rgb);
#endif`,r.bay_premul_colorspace=`gl_FragColor = linearToOutputTexel( gl_FragColor );
#ifdef TONE_MAPPING
  gl_FragColor.rgb = max(bayGrade(gl_FragColor.rgb) - bayGrade(vec3(0.0)) * (1.0 - clamp(gl_FragColor.a, 0.0, 1.0)), 0.0);
#endif`,r.fog_pars_vertex=`#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogViewPos;
#endif`,r.fog_vertex=`#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogViewPos = mvPosition.xyz;
#endif`,r.fog_pars_fragment=`#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec3 fogColorSun;
  uniform vec3 fogSunDir;
  varying float vFogDepth;
  varying vec3 vFogViewPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`,r.fog_fragment=`#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    fogFactor = 1.0 - (1.0 - fogFactor) * (1.0 - fogFactor);
  #endif
  vec3 fdir = normalize(vFogViewPos);
  float fs = max(dot(fdir, fogSunDir), 0.0);
  vec3 fcol = mix(fogColor, fogColorSun, pow(fs, 3.0));
  fcol += fogColorSun * pow(fs, 20.0) * 0.6;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fcol, fogFactor );
#endif`;for(const t of Object.keys(cn)){const e=cn[t].uniforms;e&&e.fogColor&&(e.fogColorSun={value:Cn.sunColor},e.fogSunDir={value:Cn.sunDirView}),e&&(e.directionalLights||e.ambientLightColor)&&(e.rimSunDir={value:Cn.sunDirView},e.rimColor={value:ja.color})}}const Sh={value:0},gn={sun:new ht(1,.62,.34),sunI:4.8,hemiSky:new ht(.5,.62,.95),hemiGround:new ht(.6,.4,.26),hemiI:.95,fog:new ht(.86,.5,.36),fogSun:[2.3,.95,.36],rim:[1.6,.85,.45]},xn={sun:new ht(1,.36,.16),sunI:.5,hemiSky:new ht(.3,.42,.95),hemiGround:new ht(.22,.16,.16),hemiI:.62,fog:new ht(.2,.17,.3),fogSun:[1.1,.34,.14],rim:[.75,.32,.2]},Kb=new ht;function uM(r,{sun:t,hemi:e,fog:n,renderer:i}={}){r=Math.min(1,Math.max(0,r)),Sh.value=r;const s=(a,o)=>a+(o-a)*r;t&&(t.color.copy(gn.sun).lerp(xn.sun,r),t.intensity=s(gn.sunI,xn.sunI)),e&&(e.color.copy(gn.hemiSky).lerp(xn.hemiSky,r),e.groundColor.copy(gn.hemiGround).lerp(xn.hemiGround,r),e.intensity=s(gn.hemiI,xn.hemiI)),n&&n.color.copy(Kb.copy(gn.fog).lerp(xn.fog,r)),Cn.sunColor.r=s(gn.fogSun[0],xn.fogSun[0]),Cn.sunColor.g=s(gn.fogSun[1],xn.fogSun[1]),Cn.sunColor.b=s(gn.fogSun[2],xn.fogSun[2]),ja.color.r=s(gn.rim[0],xn.rim[0]),ja.color.g=s(gn.rim[1],xn.rim[1]),ja.color.b=s(gn.rim[2],xn.rim[2]),i&&(i.toneMappingExposure=s(1,1.32))}function dM(r,t=ci){const e=Math.hypot(t.x,t.z)||1,n=r*Math.PI/180;ci.set(t.x/e*Math.cos(n),Math.sin(n),t.z/e*Math.cos(n)).normalize()}const qa=new R;function Jb(r){qa.copy(ci).transformDirection(r.matrixWorldInverse),Cn.sunDirView.x=qa.x,Cn.sunDirView.y=qa.y,Cn.sunDirView.z=qa.z}const vp=`
uniform vec3 sunDir;
uniform float time;
uniform float dusk; // 0 = golden hour, 1 = blue hour (sun under the horizon)
varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
vec3 skyCol(vec3 d){
  float h = d.y;
  float sa = max(dot(d, sunDir), 0.0);
  vec3 zenith = mix(vec3(0.035, 0.11, 0.27), vec3(0.010, 0.025, 0.085), dusk);
  vec3 midAway = mix(vec3(0.20, 0.30, 0.48), vec3(0.055, 0.075, 0.19), dusk);
  vec3 horAway = mix(vec3(0.86, 0.50, 0.36), vec3(0.30, 0.20, 0.33), dusk);
  vec3 horSun  = mix(vec3(2.3, 0.95, 0.36), vec3(1.25, 0.36, 0.12), dusk);
  vec3 hor = mix(horAway, horSun, pow(sa, 3.0));
  float hh = max(h, 0.0);
  vec3 c = mix(hor, mix(midAway, zenith, smoothstep(0.15, 0.7, hh)), smoothstep(0.0, 0.28, pow(hh, 0.75)));
  // warm wash toward the sun across the sky
  float dk = 1.0 - 0.6 * dusk;
  c += vec3(1.3, 0.55, 0.16) * pow(sa, 3.0) * (1.0 - smoothstep(0.0, 0.55, hh)) * dk;
  c += vec3(0.5, 0.18, 0.05) * pow(sa, 1.5) * (1.0 - smoothstep(0.0, 0.3, hh)) * dk;
  c += vec3(1.6, 0.8, 0.35) * pow(sa, 48.0) * dk;
  c += vec3(4.0, 2.6, 1.4) * pow(sa, 600.0) * (1.0 - dusk);
  // blue hour: a band of afterglow along the whole western horizon, stars overhead
  c += vec3(0.55, 0.16, 0.06) * dusk * pow(max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z)))), 2.0) * (1.0 - smoothstep(0.0, 0.18, hh));
  if (dusk > 0.01) { vec2 sp = d.xz / (h + 0.35) * 420.0; float st = step(0.9982, h21(floor(sp))) * smoothstep(0.3, 0.75, h) * (1.0 - smoothstep(0.02, 0.12, dot(c, vec3(0.3, 0.5, 0.2)))); c += vec3(0.9, 0.95, 1.1) * st * dusk * dusk * 0.7 * (0.6 + 0.4 * sin(time * 3.0 + h21(floor(sp) + 7.0) * 40.0)); }
  // sun disk
  float disk = smoothstep(0.99955, 0.99975, sa);
  c = mix(c, mix(vec3(28.0, 18.0, 9.0), vec3(18.0, 6.0, 1.5), dusk), disk);
  // below horizon -> haze
  if (h < 0.0) c = mix(hor, hor * 0.55, smoothstep(0.0, -0.2, h));
  // clouds
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08);
    vec2 cuv = uv * vec2(0.35, 1.6) + vec2(time * 0.002, 0.0);
    float n = fbm(cuv * 1.2 + vec2(3.1, 1.7));
    float n2 = fbm(uv * vec2(0.9, 0.3) + 9.0);
    float cov = smoothstep(0.48, 0.78, n * 0.75 + n2 * 0.45);
    cov *= smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.35, 0.8, h));
    vec3 lit = mix(vec3(1.25, 0.52, 0.34), vec3(2.8, 1.3, 0.5), pow(sa, 2.0)) * mix(1.0, 0.42, dusk) + vec3(0.12, 0.0, 0.14) * dusk;
    vec3 shade = mix(vec3(0.20, 0.15, 0.28), vec3(0.62, 0.26, 0.16), pow(sa, 2.0)) * mix(1.0, 0.35, dusk);
    float rim = smoothstep(0.3, 1.0, n2);
    vec3 cc = mix(shade, lit, 0.35 + 0.65 * rim);
    cc += vec3(3.0, 1.5, 0.6) * pow(sa, 14.0) * 1.2;
    c = mix(c, cc, cov * 0.85);
  }
  return c;
}
`;function jb(){const r=new Ye({uniforms:{sunDir:{value:ci.clone()},time:{value:0},dusk:Sh},vertexShader:`
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_Position = p.xyww;
      }`,fragmentShader:vp+`
      void main(){
        vec3 c = skyCol(normalize(vDir));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,side:Le,depthWrite:!1,fog:!1}),t=new ue(new hs(2500,48,24),r);return t.frustumCulled=!1,t.renderOrder=-100,t}function Qb(r){const t=new $r,e=new Ye({uniforms:{sunDir:{value:ci.clone()},time:{value:0},dusk:Sh},vertexShader:"varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",fragmentShader:vp+`void main(){ vec3 d = normalize(vDir); vec3 c = skyCol(d);
      // darker ground hemisphere so cars get a horizon line
      if (d.y < 0.0) c = mix(vec3(0.5,0.32,0.22), vec3(0.06,0.05,0.05), smoothstep(0.0,-0.25,d.y));
      gl_FragColor = vec4(min(c, vec3(12.0)),1.0);} `,side:Le});t.add(new ue(new hs(100,64,32),e));const n=new Oo(r),i=n.fromScene(t,0,.1,500);return n.dispose(),i.texture}function t1(){const r=new Qn,t=new ti(new On({map:md("rgba(255,250,235,1)","rgba(255,170,80,0.45)"),color:16777215,blending:Qi,depthWrite:!1,fog:!1,transparent:!0,toneMapped:!1}));t.scale.setScalar(700);const e=new ti(new On({map:md("rgba(255,180,90,0.5)","rgba(255,120,40,0.12)"),blending:Qi,depthWrite:!1,fog:!1,transparent:!0,toneMapped:!1,opacity:.8}));e.scale.setScalar(2200);const n=new ti(new On({map:Xb(),color:16763024,blending:Qi,depthWrite:!1,fog:!1,transparent:!0,toneMapped:!1,opacity:.75}));return n.scale.set(3e3,90,1),r.add(e,t,n),r.position.copy(ci).multiplyScalar(2e3),r.renderOrder=-50,r}function e1(r,t){const e=new gh(new ht(1,.62,.34),4.8);e.castShadow=!0,e.shadow.mapSize.set(t,t);const n=e.shadow.camera;n.left=-38,n.right=38,n.top=38,n.bottom=-38,n.near=1,n.far=260,e.shadow.bias=-3e-4,e.shadow.normalBias=.05,n.updateProjectionMatrix(),r.add(e,e.target);const i=new fh(new ht(.5,.62,.95),new ht(.6,.4,.26),.95);return r.add(i),{sun:e,hemi:i}}const cr=new R;function n1(r,t){r.target.position.set(t.x,t.y>2?t.y-1.7:0,t.z-10),cr.copy(ci),cr.y<.045&&(cr.y=.045,cr.normalize()),r.position.copy(r.target.position).addScaledVector(cr,140)}const Ie={GLOW:8*16+0,STAR:8*16+1,RING:8*16+2,DUST:8*16+3,SPARK:8*16+4,CHIP:8*16+5,FLASH:8*16+6,STAR2:8*16+7,WISP:8*16+8,DIRT:8*16+9},i1=r=>(r=Math.max(0,Math.min(63,r|0)),Math.floor(r/8)*16+r%8),s1=r=>(r=Math.max(0,Math.min(63,r|0)),Math.floor(r/8)*16+8+r%8),r1=`
precision highp float;
varying vec2 vUv;
float h31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*n3(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 ramp(float h){
  // black body-ish ramp
  vec3 c = mix(vec3(0.0), vec3(0.45,0.04,0.0), smoothstep(0.0,0.25,h));
  c = mix(c, vec3(1.0,0.32,0.02), smoothstep(0.2,0.5,h));
  c = mix(c, vec3(1.0,0.72,0.2), smoothstep(0.45,0.75,h));
  c = mix(c, vec3(1.0,0.97,0.85), smoothstep(0.72,1.0,h));
  return c;
}
void main(){
  vec2 g = vUv * 16.0;
  vec2 cell = floor(g);
  vec2 p = (fract(g) - 0.5) * 2.0;   // -1..1
  cell.y = 15.0 - cell.y;             // row 0 at top
  float seedv = cell.x * 7.0 + cell.y * 13.0;
  vec4 outc = vec4(0.0);
  float r = length(p);
  float edgeMask = smoothstep(1.0, 0.86, max(abs(p.x), abs(p.y)));
  if (cell.y < 8.0 && cell.x < 8.0) {
    // FIRE flipbook
    float t = (cell.y * 8.0 + cell.x) / 63.0;
    vec3 q = vec3(p * 1.6, t * 1.8);
    float n = fbm3(q * 1.9 + vec3(0.0, -t * 2.0, 0.0));
    float n2 = fbm3(q * 4.0 + 5.0);
    float radius = 0.42 + 0.36 * smoothstep(0.0, 0.5, t);
    float d = r + (n - 0.5) * 0.85 + (n2 - 0.5) * 0.25;
    float dens = smoothstep(radius, radius - 0.38, d);
    // heat fades from core outward and over time
    float core = smoothstep(radius + 0.1, 0.0, d);
    float heat = clamp(core * (1.25 - t * 1.15) * (0.75 + n2 * 0.5), 0.0, 1.0);
    vec3 emit = ramp(heat) * smoothstep(0.05, 0.3, heat);
    // smoke where cool
    float smokeAmt = dens * smoothstep(0.55, 0.05, heat);
    float shade = 0.045 + 0.08 * fbm3(q * 3.0 + 2.0) + 0.03 * (p.y);
    vec3 smokeCol = vec3(shade * 1.05, shade * 0.88, shade * 0.75);
    float alpha = clamp(smokeAmt * (0.9 + t * 0.1), 0.0, 1.0) * edgeMask;
    vec3 rgb = (emit * dens + smokeCol * alpha) * edgeMask;
    // fade out toward the end
    float endFade = 1.0 - smoothstep(0.75, 1.0, t);
    outc = vec4(rgb * endFade, alpha * endFade);
  } else if (cell.y < 8.0) {
    // SMOKE flipbook
    float t = (cell.y * 8.0 + cell.x - 8.0) / 63.0;
    vec3 q = vec3(p * 1.3, t * 0.9);
    float n = fbm3(q * 2.0 + vec3(0.0, -t, 3.0));
    float d = r + (n - 0.5) * 0.9;
    float dens = smoothstep(0.92, 0.25, d);
    // fake lighting from upper side
    float nl = fbm3((q + vec3(-0.08, 0.1, 0.0)) * 2.0 + vec3(0.0, -t, 3.0));
    float light = clamp(0.5 + (n - nl) * 6.0 + p.y * 0.35, 0.0, 1.0);
    float shade = mix(0.22, 0.75, light);
    float alpha = dens * edgeMask * (0.85 + 0.15 * n);
    outc = vec4(vec3(shade) * alpha, alpha);
  } else {
    int id = int(cell.x);
    if (cell.y == 8.0) {
      if (id == 0) { float a = (exp(-r*r*5.0) * 0.9 + exp(-r*r*40.0) * 0.5) * smoothstep(1.0, 0.55, r); outc = vec4(vec3(a), 0.0); }
      else if (id == 1) { // muzzle star
        float ang = atan(p.y, p.x);
        float rays = pow(abs(cos(ang * 3.0)), 18.0) * 0.8 + pow(abs(cos(ang * 3.0 + 0.5)), 30.0) * 0.4;
        float n = fbm3(vec3(p * 6.0, 1.0));
        float a = (exp(-r * r * 9.0) + rays * exp(-r * 2.6)) * (0.6 + n * 0.7);
        a *= smoothstep(1.0, 0.7, r);
        outc = vec4(vec3(1.0, 0.75, 0.4) * a + vec3(0.6) * exp(-r*r*30.0), 0.0);
      }
      else if (id == 2) { float a = smoothstep(0.62, 0.86, r) * smoothstep(1.0, 0.88, r); outc = vec4(vec3(a), 0.0); }
      else if (id == 3) { float n = fbm3(vec3(p*2.2, 4.0)); float a = smoothstep(0.95, 0.2, r + (n-0.5)*0.8) * smoothstep(1.0, 0.8, r); outc = vec4(vec3(0.62,0.52,0.40)*a, a); }
      else if (id == 4) { float a = exp(-r*r*14.0) * smoothstep(1.0, 0.5, r); outc = vec4(vec3(a), 0.0); }
      else if (id == 5) { float a = step(abs(p.x) + abs(p.y) * 0.6, 0.6) ; outc = vec4(vec3(0.08)*a, a); }
      else if (id == 6) { float a = exp(-r*r*3.0) + exp(-r*r*30.0); float ang = atan(p.y,p.x); a += pow(abs(cos(ang*4.0)),40.0)*exp(-r*1.5)*0.6; outc = vec4(vec3(a)*smoothstep(1.0,0.55,r), 0.0); }
      else if (id == 7) { float ang = atan(p.y, p.x); float rays = pow(abs(cos(ang * 2.0)), 60.0); float a = (exp(-r*r*16.0) + rays*exp(-r*3.0))*smoothstep(1.0,0.8,r); outc = vec4(vec3(1.0,0.85,0.6)*a, 0.0); }
      else if (id == 8) { float n = fbm3(vec3(p * vec2(1.0, 2.5) * 1.8, 7.0)); float a = smoothstep(0.9, 0.1, r + (n-0.5)*1.0) * smoothstep(1.0, 0.8, r) * 0.6; outc = vec4(vec3(0.6) * a, a); }
      else if (id == 9) { float n = fbm3(vec3(p*3.0, 11.0)); float a = smoothstep(0.9, 0.3, r + (n-0.5)*1.2) * smoothstep(1.0, 0.8, r); outc = vec4(vec3(0.36,0.30,0.24)*a, a); }
    }
  }
  gl_FragColor = outc;
}`;function a1(r){const t=new _n(2048,2048,{generateMipmaps:!0,minFilter:vn,magFilter:we,depthBuffer:!1}),e=new $r,n=new qr(-1,1,1,-1,0,1),i=new Ye({vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }",fragmentShader:r1,depthTest:!1,depthWrite:!1});e.add(new ue(new Hn(2,2),i));const s=r.xr.enabled;r.xr.enabled=!1;const a=r.getRenderTarget();return r.setRenderTarget(t),r.render(e,n),r.setRenderTarget(a),r.xr.enabled=s,i.dispose(),t.texture.colorSpace=Un,t.texture}const o1=`
attribute vec3 iPos;
attribute vec2 iSize;
attribute float iRot;
attribute vec2 iFrame;   // frame index, next frame blend
attribute vec4 iColor;   // rgb mult, alpha
attribute vec3 iVel;
attribute float iGround; // ground height under this sprite (soft fade), 0 = the old road plane
uniform float stretchMode;
varying vec2 vUv0; varying vec2 vUv1; varying float vBlend;
varying vec4 vColor; varying float vFogDepth; varying vec3 vFogViewPos; varying float vGroundY; varying float vSoft;
vec2 cellUv(float f, vec2 uv){ float cx = mod(f, 16.0); float cy = floor(f / 16.0); return vec2((cx + uv.x) / 16.0, 1.0 - (cy + 1.0 - uv.y) / 16.0); }
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec3 offs;
  if (stretchMode > 0.5) {
    vec3 v = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
    float sp = length(v);
    vec3 axis = sp > 1e-4 ? v / sp : vec3(0.0, 1.0, 0.0);
    vec3 side = normalize(cross(axis, normalize(mv.xyz)));
    offs = axis * position.y * iSize.y + side * position.x * iSize.x;
  } else {
    float c = cos(iRot), s = sin(iRot);
    vec2 p = vec2(position.x * iSize.x, position.y * iSize.y);
    offs = vec3(c * p.x - s * p.y, s * p.x + c * p.y, 0.0);
  }
  mv.xyz += offs;
  vec2 uv = position.xy + 0.5;
  vUv0 = cellUv(floor(iFrame.x), uv);
  vUv1 = cellUv(floor(iFrame.x) + iFrame.y, uv);
  vBlend = fract(iFrame.x);
  vColor = iColor;
  // fade when very close to the eye (avoid giant sprites in face)
  vColor.a *= smoothstep(0.15, 1.2, -mv.z);
  // big sprites fade out as they reach the eye (readability + fill rate)
  float bigS = max(iSize.x, iSize.y);
  if (bigS > 1.5) vColor.a *= smoothstep(bigS * 0.35, bigS * 1.3, -mv.z);
  vFogDepth = -mv.z; vFogViewPos = mv.xyz;
  // height of this vertex above the ground under the sprite (soft intersection, no depth buffer needed)
  vGroundY = (inverse(viewMatrix) * vec4(mv.xyz, 1.0)).y - iGround;
  vSoft = max(0.05, min(iSize.x, iSize.y) * 0.22);
  gl_Position = projectionMatrix * mv;
  if (iColor.a <= 0.0 || iSize.x <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,l1=`
uniform sampler2D atlas;
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float emissiveBoost;
varying vec2 vUv0; varying vec2 vUv1; varying float vBlend;
varying vec4 vColor; varying float vFogDepth; varying vec3 vFogViewPos; varying float vGroundY; varying float vSoft;
void main(){
  vec4 a = texture2D(atlas, vUv0);
  vec4 b = texture2D(atlas, vUv1);
  vec4 t = mix(a, b, vBlend);
  // premultiplied: rgb = emission + lit smoke, a = coverage
  vec3 rgb = t.rgb * vColor.rgb * emissiveBoost;
  float al = t.a;
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  vec3 fdir = normalize(vFogViewPos);
  float fs = max(dot(fdir, fogSunDir), 0.0);
  vec3 fcol = mix(fogColor, fogColorSun, pow(fs, 3.0));
  rgb = mix(rgb, fcol * al, f);
  float soft = smoothstep(0.0, vSoft, vGroundY);
  gl_FragColor = vec4(rgb, al) * vColor.a * soft;
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;class _p{constructor(t,e,{stretch:n=!1,boost:i=1,renderOrder:s=10,fog:a,ground:o=0}={}){this.max=t,this.ground=o;const l=new xh;l.setAttribute("position",new Tt([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),l.setIndex([0,1,2,0,2,3]),this.aPos=new je(new Float32Array(t*3),3).setUsage(_i),this.aSize=new je(new Float32Array(t*2),2).setUsage(_i),this.aRot=new je(new Float32Array(t),1).setUsage(_i),this.aFrame=new je(new Float32Array(t*2),2).setUsage(_i),this.aColor=new je(new Float32Array(t*4),4).setUsage(_i),this.aVel=new je(new Float32Array(t*3),3).setUsage(_i),this.aGround=new je(new Float32Array(t).fill(o),1).setUsage(_i),l.setAttribute("iPos",this.aPos),l.setAttribute("iSize",this.aSize),l.setAttribute("iRot",this.aRot),l.setAttribute("iFrame",this.aFrame),l.setAttribute("iColor",this.aColor),l.setAttribute("iVel",this.aVel),l.setAttribute("iGround",this.aGround),l.instanceCount=t,this.material=new Ye({uniforms:{atlas:{value:e},stretchMode:{value:n?1:0},emissiveBoost:{value:i},fogColor:{value:a.color},fogNear:{value:a.near},fogFar:{value:a.far},fogColorSun:{value:Cn.sunColor},fogSunDir:{value:Cn.sunDirView}},vertexShader:o1,fragmentShader:l1,transparent:!0,depthWrite:!1,blending:Dc,blendSrc:Qa,blendDst:ks,blendSrcAlpha:Qa,blendDstAlpha:ks}),this.mesh=new ue(l,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=s,this.geometry=l}set(t,e,n,i,s,a,o,l,c,h,u,d,f,m=0,x=0,g=0,p=this.ground){const _=this.aPos.array,v=this.aSize.array,y=this.aFrame.array,P=this.aColor.array,S=this.aVel.array;_[t*3]=e,_[t*3+1]=n,_[t*3+2]=i,v[t*2]=s,v[t*2+1]=a,this.aRot.array[t]=o,y[t*2]=l,y[t*2+1]=c,P[t*4]=h,P[t*4+1]=u,P[t*4+2]=d,P[t*4+3]=f,S[t*3]=m,S[t*3+1]=x,S[t*3+2]=g,this.aGround.array[t]=p}hide(t){this.aColor.array[t*4+3]=0}commit(t=this.max){for(const e of[this.aPos,this.aSize,this.aRot,this.aFrame,this.aColor,this.aVel,this.aGround])e.clearUpdateRanges(),e.addUpdateRange(0,t*e.itemSize),e.needsUpdate=!0;this.geometry.instanceCount=t}}class dc{constructor(t,e,n){this.batch=new _p(t,e,n),this.mesh=this.batch.mesh,this.max=t,this.p=[];for(let i=0;i<t;i++)this.p.push({alive:!1});this.cursor=0,this.free=[];for(let i=t-1;i>=0;i--)this.free.push(i);this.bigAlive=0,this.bigBudget=n.bigBudget??140,this._dummy={},this.stretch=!!n.stretch,this.high=0}spawn(t){const e=(t.s1??t.s0??t.size??1)>5;if(e&&!t.force&&this.bigAlive>=this.bigBudget)return this._dummy;let n;this.free.length?n=this.free.pop():(n=this.cursor,this.cursor=(this.cursor+1)%this.max,this.p[n].big&&this.bigAlive--);const i=this.p[n];return i.big=e,e&&this.bigAlive++,i.alive=!0,i.x=t.x,i.y=t.y,i.z=t.z,i.vx=t.vx||0,i.vy=t.vy||0,i.vz=t.vz||0,i.age=0,i.life=t.life||1,i.s0=t.s0??t.size??1,i.s1=t.s1??i.s0,i.ease=t.ease??1,i.asp=t.aspect||1,i.rot=t.rot||0,i.vrot=t.vrot||0,i.f0=t.frame??0,i.fn=t.frames||0,i.fk=t.frameKind||0,i.r=t.r??1,i.g=t.g??1,i.b=t.b??1,i.a=t.a??1,i.r1=t.r1??i.r,i.g1=t.g1??i.g,i.b1=t.b1??i.b,i.fin=t.fadeIn??.05,i.fout=t.fadeOut??.6,i.drag=t.drag||0,i.grav=t.grav||0,i.anchored=t.anchored!==!1,i.len=t.len||0,i.w=t.w||.05,i.ground=t.ground||!1,i.timeScaleImmune=t.immune||!1,n+1>this.high&&(this.high=n+1),i}update(t,e){const n=this.batch;for(let i=0;i<this.high;i++){const s=this.p[i];if(!s.alive){n.hide(i);continue}if(s.age+=t,s.age>=s.life){s.alive=!1,n.hide(i),this.free.push(i),s.big&&(this.bigAlive--,s.big=!1);continue}const a=s.age/s.life,o=Math.exp(-s.drag*t);s.vx*=o,s.vy=s.vy*o+s.grav*t,s.vz*=o,s.x+=s.vx*t,s.y+=s.vy*t,s.z+=s.vz*t,s.anchored&&(s.z+=e);const l=this.groundAt?this.groundAt(s.x,s.z):0;s.ground&&s.y<l+.02&&(s.y=l+.02,s.vy=-s.vy*.35,s.vx*=.6,s.vz=s.vz*.6+(t>0&&s.anchored,0)),s.rot+=s.vrot*t;const c=Math.pow(a,s.ease),h=s.s0+(s.s1-s.s0)*c;s.fk>0&&s.y<l+h*.4&&(s.y=l+h*.4);let u=s.a;a<s.fin&&(u*=a/s.fin),a>s.fout&&(u*=1-(a-s.fout)/(1-s.fout));let d=s.f0,f=0;if(s.fk===1){const _=a*63,v=Math.floor(_);d=i1(v)+(_-v),f=v%8===7?9:1,v>=63&&(f=0)}else if(s.fk===2){const _=s.f0+a*s.fn,v=Math.floor(_)%64;d=s1(v)+(_-Math.floor(_)),f=v%8===7?9:1,v>=63&&(f=0)}const m=l<0?l:0,x=s.r+(s.r1-s.r)*a,g=s.g+(s.g1-s.g)*a,p=s.b+(s.b1-s.b)*a;if(this.stretch){const _=Math.hypot(s.vx,s.vy,s.vz),v=s.len>0?s.len:Math.max(h,_*.03);n.set(i,s.x,s.y,s.z,s.w*(h/(s.s0||1)),v,0,d,0,x,g,p,u,s.vx,s.vy,s.vz,m)}else n.set(i,s.x,s.y,s.z,h,h*s.asp,s.rot,d,f,x,g,p,u,0,0,0,m)}n.commit(this.high)}}const an=new R,Gi=new R;class c1{constructor(t,e,n,i){this.scene=t,this.q=i;const s=i==="high";this.main=new dc(s?4200:1600,e,{boost:1,renderOrder:20,fog:n,bigBudget:s?140:70}),this.sparks=new dc(s?1400:800,e,{stretch:!0,boost:3,renderOrder:21,fog:n}),this.near=new dc(200,e,{boost:1.5,renderOrder:22,fog:n}),this.carGlows=new _p(260,e,{boost:1,renderOrder:19,fog:n}),t.add(this.main.mesh,this.sparks.mesh,this.near.mesh,this.carGlows.mesh),this.time=0,this.queue=[],this.lights=[];for(let u=0;u<3;u++){const d=new mh(16747066,0,45,1.6);d.userData={life:0,max:1,peak:0,anchored:!0},t.add(d),this.lights.push(d)}const a=new Ai(1,1,1);this.debrisMesh=new Os(a,new Nr({color:1381139,roughness:.7,metalness:.4}),160),this.debrisMesh.castShadow=!0,this.debrisMesh.frustumCulled=!1,this.debrisMesh.count=0,t.add(this.debrisMesh),this.debris=[];const o=new cs(.0045,.0045,.03,6);o.rotateZ(Math.PI/2),this.casingMesh=new Os(o,new Nr({color:14264389,metalness:1,roughness:.25,envMapIntensity:1.5}),60),this.casingMesh.frustumCulled=!1,this.casingMesh.count=0,t.add(this.casingMesh),this.casings=[],this.casingCursor=0;const l=new yn({map:qb(),transparent:!0,depthWrite:!1,blending:Qi,color:16756848,toneMapped:!1}),c=new Hn(1,1);c.rotateX(-Math.PI/2),this.ringMesh=new Os(c,l,8),this.ringMesh.frustumCulled=!1,this.ringMesh.count=8,this.ringMesh.instanceColor=new je(new Float32Array(8*3),3),t.add(this.ringMesh),this.rings=[];for(let u=0;u<8;u++)this.rings.push({life:0,max:1,x:0,y:0,z:0,size:1});const h=new yn({map:Yb(),transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,opacity:.85});this.scorchMesh=new Os(c,h,20),this.scorchMesh.frustumCulled=!1,this.scorchMesh.count=20,t.add(this.scorchMesh),this.scorch=[];for(let u=0;u<20;u++)this.scorch.push({z:1e4,x:0,s:0,r:0});this.scorchCursor=0,this.emitters=[],this.groundV=30,this.onSound=()=>{},this.groundAt=null,this.heat=1,this.fireHue=0,this.smokeMul=1,this.smokeTint=null,this._m=new Ut,this._q=new Ae,this._s=new R,this._p=new R}later(t,e){this.queue.push({t:this.time+t,fn:e})}light(t,e,n,i=16747066,s=!0,a=45){let o=this.lights[0],l=1/0;for(const c of this.lights){const h=c.userData.life>0?c.userData.peak*(c.userData.life/c.userData.max):0;h<l&&(l=h,o=c)}o.position.copy(t),o.color.set(i),o.distance=a,o.userData={life:n,max:n,peak:e,anchored:s},o.intensity=e}setGround(t){this.groundAt=t,this.main.groundAt=t,this.sparks.groundAt=t,this.near.groundAt=t}_tint(t){const e=this.smokeTint;return e&&(t.r*=e[0],t.g*=e[1],t.b*=e[2],t.r1*=e[0],t.g1*=e[1],t.b1*=e[2]),t}explosion(t,e=1,{carVel:n=null,noRing:i=!1}={}){const s=t,a=this.groundAt?this.groundAt(s.x,s.z):0,o=s.y-a,l=Math.min(e,1.8),c=Math.sqrt(e),h=this.heat,u=this.fireHue,d=h*(2-u*.045),f=h*h*(1.5-u*.5),m=h*h*(1.1-u*.45);this.onSound("explosion_big",s),this.light(an.copy(s).setY(s.y+1.5),260*e,1.1,16748608,!0,60*e),this.main.spawn({x:s.x,y:s.y+.6,z:s.z,frame:Ie.FLASH,s0:5*l,s1:11*l,life:.12,r:2*h,g:1.35*h,b:.7*h,a:1,fadeIn:0,fadeOut:.2,ease:.4}),this.main.spawn({x:s.x,y:s.y+.6,z:s.z,frame:Ie.STAR,s0:8*l,s1:16*l,life:.1,r:1.8*h,g:1.2*h,b:.6*h,a:1,fadeIn:0,fadeOut:.1,rot:$t()*6});const x=Math.round(5*c+2);for(let g=0;g<x;g++){const p=g<3?0:j(0,.25),_=()=>{const v=$t()*Math.PI*2,y=j(.1,1.2),P=j(3,10)*e;this.main.spawn({x:s.x+j(-.8,.8)*e,y:s.y+j(.2,1.4)*e,z:s.z+j(-.8,.8)*e,vx:Math.cos(v)*Math.cos(y)*P+(n?n.x*.5:0),vy:Math.sin(y)*P+j(1,4),vz:Math.sin(v)*Math.cos(y)*P+(n?n.z*.5:0),drag:2.6,grav:2.2,frameKind:1,s0:j(3.6,5)*l,s1:j(9.5,14)*l,ease:.55,life:j(1.1,1.9),rot:$t()*6.28,vrot:j(-.8,.8),r:d,g:f,b:m,a:1,fadeIn:.02,fadeOut:.85})};p===0?_():this.later(p,_)}for(let g=0;g<3;g++)this.later(.1+g*.08,()=>{this.main.spawn({x:s.x,y:s.y+2*e,z:s.z,vy:j(6,9)*e,vx:j(-1,1),vz:j(-1,1),drag:1.1,frameKind:1,s0:5.5*l,s1:15*l,ease:.6,life:j(1.6,2.2),rot:$t()*6,vrot:.3,r:d*.95,g:f*.967,b:m*.955,fadeOut:.8})});if(u>0)for(let g=0;g<Math.round((4*c+2)*this.smokeMul);g++)this.later(j(.08,.3),()=>{const p=$t()*Math.PI*2,_=j(2.2,3.4)*l,v=j(.05,.1);this.main.spawn({x:s.x+Math.cos(p)*_,y:s.y+j(.8,2.6)*l,z:s.z+Math.sin(p)*_,vx:Math.cos(p)*j(1.5,3.5),vy:j(3,6),vz:Math.sin(p)*j(1.5,3.5),drag:.9,grav:.3,frameKind:2,frame:$t()*40,frames:20,s0:4.5*l,s1:Math.min(22,j(11,16)*l),ease:.55,life:j(5,8),rot:$t()*6.28,vrot:j(-.25,.25),...this._tint({r:v*1.7,g:v*1,b:v*.62,r1:v*1.15,g1:v*.9,b1:v*.8}),a:.92,fadeIn:.04,fadeOut:.5})});for(let g=0;g<Math.round((6*c+2)*this.smokeMul);g++)this.later(j(.25,.9),()=>{const p=j(.08,.17);this.main.spawn({x:s.x+j(-1.5,1.5)*e,y:s.y+j(1,3)*e,z:s.z+j(-1.5,1.5)*e,vx:j(-1.5,1.5),vy:j(2.5,5.5),vz:j(-1.5,1.5),drag:.6,grav:.4,frameKind:2,frame:$t()*40,frames:24,s0:6*l,s1:Math.min(26,j(15,21)*l),ease:.6,life:j(7,11),rot:$t()*6.28,vrot:j(-.2,.2),...this._tint({r:p*1.35,g:p*1,b:p*.72,r1:p*1.1,g1:p*.9,b1:p*.75}),a:.88,fadeIn:.1,fadeOut:.5})});for(let g=0;g<Math.round(60*c*(1-u*.55));g++){const p=$t()*Math.PI*2,_=j(-.1,1.3),v=j(14,38)*Math.sqrt(e)*(1-u*.25);this.sparks.spawn({x:s.x,y:s.y+.8,z:s.z,vx:Math.cos(p)*Math.cos(_)*v,vy:Math.sin(_)*v,vz:Math.sin(p)*Math.cos(_)*v,grav:-14,drag:.8,frame:Ie.SPARK,s0:1,w:j(.06,.12),life:j(.5,1.4)*(1-u*.35),r:1.6,g:j(.7,1)*(1-u*.3),b:.35*(1-u*.5),a:1,fadeOut:.6,ground:!0})}for(let g=0;g<Math.round(24*c);g++)this.main.spawn({x:s.x+j(-2,2)*l,y:s.y+j(.5,3)*e,z:s.z+j(-2,2)*e,vx:j(-4,4),vy:j(2,9),vz:j(-4,4),drag:1.2,grav:-1.5,frame:Ie.SPARK,s0:j(.12,.25),life:j(1.5,3.2),r:4,g:1.8,b:.6,a:1,fadeOut:.5});for(let g=0;g<12;g++){const p=g/12*Math.PI*2;this.main.spawn({x:s.x,y:a+.6,z:s.z,vx:Math.cos(p)*14*l,vz:Math.sin(p)*14*l,vy:.5,drag:3,frame:Ie.DUST,s0:2*l,s1:6*l,life:1.6,rot:$t()*6,r:.9,g:.78,b:.62,a:.55,fadeIn:.05,fadeOut:.3})}!i&&o<4&&this.ring(s,22*e,.45,a),o<3&&this.scorchAt(s.x,s.z,7*e,a);for(let g=0;g<Math.round(8*c+3);g++){const p=$t()*Math.PI*2,_=j(6,18);this.spawnDebris(s,Math.cos(p)*_*.6+(n?n.x:0),j(6,16),Math.sin(p)*_*.6+(n?n.z:0),j(.12,.42)*Math.sqrt(e),$t()<.22)}}smallExplosion(t,e=.5){this.onSound("explosion_small",t),this.light(t,60,.4,16752720,!0,20),this.main.spawn({x:t.x,y:t.y,z:t.z,frame:Ie.FLASH,s0:2.5,s1:5,life:.12,r:3,g:2.2,b:1.3,fadeIn:0,fadeOut:.2});for(let n=0;n<5;n++)this.main.spawn({x:t.x+j(-.3,.3),y:t.y+j(0,.4),z:t.z+j(-.3,.3),vx:j(-3,3),vy:j(1,4),vz:j(-3,3),drag:3,frameKind:1,s0:1.2*e*2,s1:3.2*e*2,ease:.5,life:j(.6,1),rot:$t()*6,r:2.2,g:1.9,b:1.6,fadeOut:.8});for(let n=0;n<4;n++)this.main.spawn({x:t.x,y:t.y+.5,z:t.z,vx:j(-1,1),vy:j(1.5,3),vz:j(-1,1),drag:.8,frameKind:2,frame:$t()*40,frames:16,s0:1.5,s1:5,life:j(2,3.5),rot:$t()*6,r:.36,g:.28,b:.22,a:.75,fadeOut:.5});for(let n=0;n<25;n++){const i=$t()*6.28,s=j(0,1.2),a=j(8,20);this.sparks.spawn({x:t.x,y:t.y,z:t.z,vx:Math.cos(i)*Math.cos(s)*a,vy:Math.sin(s)*a,vz:Math.sin(i)*Math.cos(s)*a,grav:-14,drag:1,frame:Ie.SPARK,s0:1,w:.06,life:j(.3,.8),r:1.6,g:.9,b:.4,fadeOut:.5,ground:!0})}}ring(t,e,n,i=0){let s=this.rings.find(a=>a.life<=0)||this.rings[0];s.life=n,s.max=n,s.x=t.x,s.y=i+Math.max(.15,(t.y-i)*.2),s.z=t.z,s.size=e}scorchAt(t,e,n,i=0){const s=this.scorch[this.scorchCursor++%this.scorch.length];s.x=t,s.z=e,s.s=n,s.r=$t()*6.28,s.y=i}spawnDebris(t,e,n,i,s,a){let o=this.debris.find(l=>!l.alive);o||(this.debris.length>=160?o=this.debris[(this.time*1e3|0)%160]:(o={},this.debris.push(o))),o.alive=!0,o.x=t.x,o.y=t.y+1,o.z=t.z,o.vx=e,o.vy=n,o.vz=i,o.sx=s*j(.6,1.6),o.sy=s*j(.1,.4),o.sz=s*j(.6,1.4),o.rx=$t()*6,o.ry=$t()*6,o.rz=$t()*6,o.wx=j(-12,12),o.wy=j(-12,12),o.wz=j(-12,12),o.life=j(3,5),o.life0=o.life,o.burning=a,o.emit=0,o.ground=!1,o._tl=null}muzzle(t,e,n="rifle",i=!0){const s=i?this.near:this.main,a=i?1:2.4,o=n==="launcher",l=o?.42:n==="enemy"?.5:.24;if(s.spawn({x:t.x+e.x*l*.3,y:t.y+e.y*l*.3,z:t.z+e.z*l*.3,frame:$t()<.5?Ie.STAR:Ie.STAR2,s0:l,s1:l*1.3,life:.05,rot:$t()*6.28,r:1.6*a,g:1.2*a,b:.7*a,a:1,fadeIn:0,fadeOut:.3,anchored:!i}),s.spawn({x:t.x+e.x*l*.8,y:t.y+e.y*l*.8,z:t.z+e.z*l*.8,frame:Ie.GLOW,s0:l*1.2,s1:l*1.6,life:.06,r:1.4*a,g:.8*a,b:.35*a,a:1,fadeIn:0,fadeOut:.2,anchored:!i}),!i||o)for(let c=0;c<2;c++)this.main.spawn({x:t.x+e.x*.2,y:t.y+e.y*.2,z:t.z+e.z*.2,vx:e.x*3+j(-.5,.5),vy:e.y*3+.5,vz:e.z*3+j(-.5,.5),drag:4,frame:Ie.WISP,s0:.2,s1:.9,life:.45,rot:$t()*6,r:.14,g:.12,b:.1,a:.3,fadeIn:.05,fadeOut:.3,anchored:!0})}tracer(t,e,{speed:n=420,color:i=[1.6,1,.45],width:s=.05,len:a=5}={}){an.subVectors(e,t);const o=an.length();if(o<.5)return;an.divideScalar(o);const l=o/n;this.sparks.spawn({x:t.x+an.x*a*.5,y:t.y+an.y*a*.5,z:t.z+an.z*a*.5,vx:an.x*n,vy:an.y*n,vz:an.z*n,frame:Ie.SPARK,s0:1,len:Math.min(a,o),w:s,life:Math.max(.016,l),r:i[0],g:i[1],b:i[2],a:1,fadeIn:0,fadeOut:.9,anchored:!1})}impact(t,e,n){if(n==="metal"||n==="glass"){const i=n==="metal"?8:4;for(let s=0;s<i;s++){Gi.set(j(-1,1),j(-1,1),j(-1,1)).normalize().multiplyScalar(.7).add(e).normalize();const a=j(6,16);this.sparks.spawn({x:t.x,y:t.y,z:t.z,vx:Gi.x*a,vy:Gi.y*a,vz:Gi.z*a,grav:-12,drag:1.5,frame:Ie.SPARK,s0:1,w:.035,life:j(.15,.45),r:1.7,g:1.1,b:.55,a:1,fadeOut:.4})}if(this.main.spawn({x:t.x+e.x*.05,y:t.y+e.y*.05,z:t.z+e.z*.05,frame:Ie.STAR2,s0:.35,s1:.5,life:.06,rot:$t()*6,r:3.6,g:2.6,b:1.6,fadeIn:0,fadeOut:.2}),n==="glass")for(let s=0;s<10;s++)this.sparks.spawn({x:t.x,y:t.y,z:t.z,vx:e.x*j(1,4)+j(-2,2),vy:j(0,3),vz:e.z*j(1,4)+j(-2,2),grav:-9.8,drag:.5,frame:Ie.SPARK,s0:1,w:.03,len:.06,life:j(.4,.8),r:.8,g:.9,b:1,a:.8,fadeOut:.6,ground:!0})}else if(n==="ground"){this.main.spawn({x:t.x,y:t.y+.15,z:t.z,vy:j(.8,2),frame:Ie.DIRT,s0:.3,s1:1.4,ease:.5,life:.8,rot:$t()*6,r:1,g:1,b:1,a:.8,fadeIn:.02,fadeOut:.3});for(let i=0;i<3;i++)this.sparks.spawn({x:t.x,y:t.y+.05,z:t.z,vx:j(-3,3),vy:j(3,7),vz:j(-3,3),grav:-12,frame:Ie.SPARK,s0:1,w:.03,life:.3,r:1.5,g:1,b:.5,fadeOut:.4})}else n==="body"&&this.main.spawn({x:t.x,y:t.y,z:t.z,vx:e.x,vy:.5,vz:e.z,drag:3,frame:Ie.DUST,s0:.2,s1:.8,life:.5,rot:$t()*6,r:.5,g:.45,b:.42,a:.7,fadeIn:.02,fadeOut:.3})}smoke(t,e,n=.22,i=3,s=2.5,a=.7){this.main.spawn({x:t.x+j(-.2,.2),y:t.y,z:t.z+j(-.2,.2),vx:j(-.4,.4),vy:s*j(.7,1.2),vz:j(-.4,.4),drag:.5,frameKind:2,frame:$t()*40,frames:16,s0:e*.5,s1:e*2.2,ease:.6,life:i*j(.8,1.2),rot:$t()*6.28,vrot:j(-.3,.3),r:n*1.3,g:n,b:n*.75,a,fadeIn:.08,fadeOut:.45})}flame(t,e,n=null){this.main.spawn({x:t.x+j(-.3,.3)*e,y:t.y,z:t.z+j(-.3,.3)*e,vx:j(-.5,.5)+(n?n.x:0),vy:j(2,4)*e,vz:j(-.5,.5)+(n?n.z*.8:0),anchored:!n,drag:n?0:1.5,frameKind:1,s0:e*.9,s1:e*1.8,ease:.7,life:j(.5,.8),rot:$t()*6.28,vrot:j(-1,1),r:2.1-this.fireHue*.2,g:1.8-this.fireHue*.6,b:1.5-this.fireHue*.85,a:1,fadeIn:.02,fadeOut:.6})}trailEmit(t,e,n,i,s){if(!t._tl){t._tl=e.clone(),i(e);return}t._tl.z+=s;const a=t._tl.distanceTo(e),o=Math.min(16,Math.floor(a/n));if(!(o<=0)){for(let l=0;l<o;l++)Gi.lerpVectors(t._tl,e,(l+$t())/o),i(Gi);t._tl.copy(e)}}casing(t,e){const n=this.casings[this.casingCursor%60]||(this.casings[this.casingCursor%60]={});this.casingCursor++,Object.assign(n,{alive:!0,x:t.x,y:t.y,z:t.z,vx:e.x,vy:e.y,vz:e.z,rx:0,ry:$t()*6,rz:0,w:j(10,30),life:2.5,bounced:0}),this.casingMesh.count=Math.min(60,this.casingCursor)}update(t,e,n){this.time+=t;for(let u=this.queue.length-1;u>=0;u--)if(this.queue[u].t<=this.time){const d=this.queue[u];this.queue.splice(u,1),d.fn()}this.main.update(t,e),this.sparks.update(t,e),this.near.update(t,0);for(const u of this.lights){const d=u.userData;if(d.life>0){d.life-=t;const f=Math.max(0,d.life/d.max);u.intensity=d.peak*f*f*(.85+.15*Math.sin(this.time*60)),d.anchored&&(u.position.z+=e)}else u.intensity=0}const i=this._m,s=this._q,a=this._s,o=this._p;let l=0;for(const u of this.debris){if(!u.alive)continue;if(u.life-=t,u.life<=0||u.z>320){u.alive=!1;continue}u.vy-=9.8*t,u.x+=u.vx*t,u.y+=u.vy*t,u.z+=u.vz*t+e;const d=this.groundAt?this.groundAt(u.x,u.z):0;if(u.y<d+u.sy*.5&&(u.y=d+u.sy*.5,u.vy<-2?(u.vy=-u.vy*.3,u.wx*=.5,u.wz*=.5):u.vy=0,u.vx*=.8,u.vz=u.vz*.8,u.ground=!0),u.ground||(u.rx+=u.wx*t,u.ry+=u.wy*t,u.rz+=u.wz*t),u.burning===2){if($t()<.6){const f=Math.min(1.3,u.sx*.8);this.main.spawn({x:u.x,y:u.y,z:u.z,vx:u.vx*.9,vy:u.vy*.9+1,vz:u.vz*.9,drag:.6,frameKind:1,s0:f,s1:f*2,ease:.7,life:j(.35,.55),rot:$t()*6.28,vrot:j(-1,1),r:1.7,g:.8,b:.35,a:1,fadeIn:.02,fadeOut:.6})}this.trailEmit(u,an.set(u.x,u.y,u.z),.38,f=>this.smoke(f,Math.min(2.2,.8+u.sx*.8),.055,3.4,.5,.7),e)}else u.burning&&u.life0-u.life<.8&&($t()<.7&&this.flame(an.set(u.x,u.y,u.z),.38,Gi.set(u.vx,0,u.vz)),this.trailEmit(u,an.set(u.x,u.y,u.z),.3,f=>this.smoke(f,.7,.14,1.6,.4,.45),e));o.set(u.x,u.y,u.z),s.setFromEuler(new ze(u.rx,u.ry,u.rz)),a.set(u.sx,u.sy,u.sz),i.compose(o,s,a),this.debrisMesh.setMatrixAt(l++,i)}this.debrisMesh.count=l,this.debrisMesh.instanceMatrix.needsUpdate=!0;const c=n?n.bedFloor:.91;for(let u=0;u<Math.min(60,this.casingCursor);u++){const d=this.casings[u];if(!d||!d.alive){a.set(0,0,0),i.compose(o.set(0,-10,0),s.identity(),a),this.casingMesh.setMatrixAt(u,i);continue}d.life-=t,d.vy-=9.8*t,d.x+=d.vx*t,d.y+=d.vy*t,d.z+=d.vz*t;const f=n&&n.groundAt?!0:n&&Math.abs(d.x-n.bedX)<n.bedHalfW&&d.z>n.bedZ0&&d.z<n.bedZ1,m=n&&n.groundAt?n.groundAt(d.x,d.z)+.006:f?c+.006:.006;f||(d.z+=e),d.y<m&&(d.y=m,d.vy<-.5?(d.vy*=-.4,d.vx*=.6,d.vz*=.6,d.w*=.6,d.bounced++<2&&n&&n.onCasing&&f&&n.onCasing(d)):(d.vy=0,d.vx*=.9,d.vz*=.9,d.w*=.9)),d.rz+=d.w*t,d.ry+=d.w*.3*t,(d.life<=0||d.z>150)&&(d.alive=!1),o.set(d.x,d.y,d.z),s.setFromEuler(new ze(0,d.ry,d.rz)),a.set(1,1,1),i.compose(o,s,a),this.casingMesh.setMatrixAt(u,i)}this.casingMesh.instanceMatrix.needsUpdate=!0;const h=this.ringMesh.instanceColor;this.rings.forEach((u,d)=>{u.life>0&&(u.life-=t,u.z+=e);const f=1-Math.max(0,u.life)/u.max,m=u.life>0?u.size*(.15+.85*Math.sqrt(f)):0;o.set(u.x,u.y,u.z),a.set(m,1,m),i.compose(o,s.identity(),a),this.ringMesh.setMatrixAt(d,i);const x=u.life>0?(1-f)*1.2:0;h.setXYZ(d,x,x,x)}),this.ringMesh.instanceMatrix.needsUpdate=!0,h.needsUpdate=!0,this.scorch.forEach((u,d)=>{u.z+=e;const f=u.z<470;o.set(u.x,(u.y||0)+.02,u.z),s.setFromEuler(new ze(0,u.r,0)),a.set(f?u.s:0,1,f?u.s:0),i.compose(o,s,a),this.scorchMesh.setMatrixAt(d,i)}),this.scorchMesh.instanceMatrix.needsUpdate=!0;for(let u=this.emitters.length-1;u>=0;u--)this.emitters[u](t)===!1&&this.emitters.splice(u,1)}}const fc=new Map,Ya=new R,xd=new Ae,vd=new Ut,$a=new R,Ls=new R,h1=new R,u1=new R,d1=new Ae,f1=new Ae,_d=(r,t,e)=>Math.min(e,Math.max(t,r)),p1=.55,m1={big:3,small:2},g1={big:1.3,small:.9,huge:2.6},x1={huge:3,big:2,small:1},yd=new Set(["GRENADE!","INCOMING!"]);function Ic(r,t,e,n,i,s,a,o){r.save(),r.fillStyle=a,r.shadowColor=a,r.shadowBlur=o,r.beginPath(),r.roundRect(t,e,n,i,s),r.fill(),r.restore()}function v1(r,t,e){const n=r.canvas;if(!n)return r;const i=n.getContext("2d"),s=n.width;n.height;const a=40;i.save(),i.globalCompositeOperation="destination-over";const o=a+t*.68+(e?t*.2:0),l=t*(e?1.45:1.05),c=s-a*1.2;return i.fillStyle="rgba(12,6,2,0.5)",i.shadowColor="rgba(12,6,2,0.55)",i.shadowBlur=t*.32,i.beginPath(),i.roundRect((s-c)/2,o-l/2,c,l,l/2),i.fill(),i.restore(),r.texture.needsUpdate=!0,r}function _1(r,t){const n=xp(r,{size:220,color:"chrome",stroke:12,padding:70});if(!t)return{...n,hk:1};const i=n.canvas,s=54,a=`700 ${s}px Oswald, sans-serif`,o=document.createElement("canvas").getContext("2d");o.font=a;const l=o.measureText(t).width+s*.12*t.length*.35,c=70+220*.68+220*.42,h=c+s*.95,u=Math.ceil(Math.max(i.width,l+s*3)),d=Math.ceil(Math.max(i.height,h+s*1.25)),f=document.createElement("canvas");f.width=u,f.height=d;const m=f.getContext("2d"),x=l+s*1.8,g=s*1.42,p=(u-x)/2,_=h-g/2;Ic(m,p,_,x,g,g/2,"rgba(10,6,3,0.66)",s*.7);const v=m.createLinearGradient(p,0,p+x,0);v.addColorStop(0,"rgba(255,150,50,0)"),v.addColorStop(.5,"rgba(255,160,60,0.85)"),v.addColorStop(1,"rgba(255,150,50,0)"),m.fillStyle=v,m.fillRect(p+g*.4,_+2,x-g*.8,3),m.fillRect(p+g*.4,_+g-5,x-g*.8,3),m.drawImage(i,(u-i.width)/2,0),m.font=a,m.textAlign="center",m.textBaseline="middle","letterSpacing"in m&&(m.letterSpacing="4px"),m.shadowColor="rgba(0,0,0,0.95)",m.shadowBlur=10,m.fillStyle="#fff0d8",m.fillText(t,u/2,h+2);const y=new ln(f);return y.colorSpace=me,y.anisotropy=4,n.texture.dispose(),{texture:y,aspect:u/d,hk:d/i.height}}function y1(r,t){return fc.has(r)||fc.set(r,t()),fc.get(r)}function pc(r,t){const n=document.createElement("canvas");n.width=n.height=256;const i=n.getContext("2d"),s=i.createRadialGradient(256/2,256/2,256*.18,256/2,256/2,256*.72);s.addColorStop(0,r),s.addColorStop(1,t),i.fillStyle=s,i.fillRect(0,0,256,256);const a=new ln(n);return a.colorSpace=me,a}function on(r,t,e,n={}){const i=new ue(new Hn(t,e),new yn({map:r,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,fog:!1,...n}));return i.renderOrder=200,i.frustumCulled=!1,i}class b1{constructor(t,e){this.scene=t,this.camera=e,this.root=new Qn,e.add(this.root),this.callouts=[],this.lanes={big:{q:[],cur:null,gap:0},small:{q:[],cur:null,gap:0}},this.endK=0,this.endCardOn=!1,this.vr=!1,this.hurt=on(pc("rgba(120,0,0,0)","rgba(160,6,0,0.95)"),4.2,4.2),this.hurt.position.set(0,0,-.9),this.hurt.material.opacity=0,this.slow=on(pc("rgba(30,14,0,0)","rgba(25,10,0,0.85)"),4.2,4.2),this.slow.position.set(0,0,-.91),this.slow.material.opacity=0,this.white=on(null,4,4,{color:16773336}),this.white.position.set(0,0,-.89),this.white.material.opacity=0,this.black=on(null,4,4,{color:0}),this.black.position.set(0,0,-.88),this.black.material.opacity=0,this.comfort=on(pc("rgba(0,0,0,0)","rgba(0,0,0,1)"),2.6,2.6),this.comfort.position.set(0,0,-.87),this.comfort.material.opacity=0,this.comfortK=0,this.root.add(this.hurt,this.slow,this.white,this.black,this.comfort),this.objCanvas=document.createElement("canvas"),this.objCanvas.width=1024,this.objCanvas.height=176,this.objTex=new ln(this.objCanvas),this.objTex.colorSpace=me,this.obj=on(this.objTex,.8,.1375),this.obj.position.set(0,.3,-1.2),this.obj.material.opacity=0,this.root.add(this.obj),this.objT=0,this.warnCanvas=document.createElement("canvas"),this.warnCanvas.width=256,this.warnCanvas.height=256,this.warnTex=new ln(this.warnCanvas),this.warnTex.colorSpace=me,this.warn=on(this.warnTex,.09,.09),this.warn.material.opacity=0,this.root.add(this.warn),this._drawWarn(),this.wpCanvas=document.createElement("canvas"),this.wpCanvas.width=128,this.wpCanvas.height=160,this.wpTex=new ln(this.wpCanvas),this.wpTex.colorSpace=me,this.wp=new ti(new On({map:this.wpTex,depthTest:!1,depthWrite:!1,transparent:!0,toneMapped:!1,fog:!1,opacity:0})),this.wp.renderOrder=140,this.wp.center.set(.5,.2),t.add(this.wp),this.wpPos=null,this.wpDist=-1;const n=document.createElement("canvas");n.width=n.height=128;const i=n.getContext("2d");i.strokeStyle="#fff",i.lineWidth=9,i.lineCap="round",i.shadowColor="rgba(0,0,0,0.8)",i.shadowBlur=6;for(const[h,u,d,f]of[[24,24,50,50],[104,24,78,50],[24,104,50,78],[104,104,78,78]])i.beginPath(),i.moveTo(h,u),i.lineTo(d,f),i.stroke();const s=new ln(n);this.marker=on(s,.06,.06),this.marker.position.set(0,0,-1.2),this.marker.material.opacity=0,this.root.add(this.marker),this.markerT=0,this.markerW=new ti(new On({map:s,depthTest:!1,depthWrite:!1,transparent:!0,toneMapped:!1,fog:!1,opacity:0})),this.markerW.renderOrder=141,this.markerW.visible=!1,t.add(this.markerW),this.lastHit=new R,this.lastHitT=-1;const a=document.createElement("canvas");a.width=a.height=64;const o=a.getContext("2d");o.fillStyle="rgba(255,240,220,0.9)",o.shadowColor="rgba(0,0,0,0.9)",o.shadowBlur=4,o.beginPath(),o.arc(32,32,3.2,0,Math.PI*2),o.fill(),o.fillRect(10,31,12,2),o.fillRect(42,31,12,2),o.fillRect(31,10,2,12),o.fillRect(31,42,2,12),this.cross=on(new ln(a),.035,.035),this.cross.position.set(0,0,-1.2),this.root.add(this.cross),this.subCanvas=document.createElement("canvas"),this.subCanvas.width=1024,this.subCanvas.height=160,this.subTex=new ln(this.subCanvas),this.subTex.colorSpace=me,this.sub=on(this.subTex,.95,.148),this.sub.position.set(0,-.36,-1.2),this.sub.material.opacity=0,this.root.add(this.sub),this.subT=0,this.scoreCanvas=document.createElement("canvas"),this.scoreCanvas.width=512,this.scoreCanvas.height=180,this.scoreTex=new ln(this.scoreCanvas),this.scoreTex.colorSpace=me,this.scorePanel=on(this.scoreTex,.4,.140625),this.scorePanel.position.set(-.52,.33,-1.2),this.root.add(this.scorePanel),this.lastScore=-1,this.lastHp=-1,this.lastAmmo="";const l=new Hn(.105,.105*180/434),c=l.attributes.uv;for(let h=0;h<c.count;h++)c.setX(h,c.getX(h)*434/512);this.wrist=new ue(l,new yn({map:this.scoreTex,transparent:!0,depthWrite:!1,toneMapped:!1,fog:!1,opacity:0})),this.wrist.renderOrder=150,this.wrist.frustumCulled=!1,this.wrist.visible=!1,t.add(this.wrist),this.wristAnchor=null,this.wristK=0,this.bossCanvas=document.createElement("canvas"),this.bossCanvas.width=1024,this.bossCanvas.height=96,this.bossTex=new ln(this.bossCanvas),this.bossTex.colorSpace=me,this.boss=on(this.bossTex,.7,.0656),this.boss.position.set(0,.42,-1.2),this.boss.visible=!1,this.root.add(this.boss),this.cdCanvas=document.createElement("canvas"),this.cdCanvas.width=512,this.cdCanvas.height=192,this.cdTex=new ln(this.cdCanvas),this.cdTex.colorSpace=me,this.cd=on(this.cdTex,.3,.1125),this.cd.visible=!1,this.root.add(this.cd),this.lastCd=null,this.lastBoss=-1,this.title=null}setVR(t){this.vr=t,this.cross.visible=!t,t?(this.scorePanel.position.set(-.3,-.28,-1.2),this.sub.position.set(0,-.42,-1.3),this.boss.position.set(0,.3,-1.3),this.obj.position.set(0,.2,-1.3)):(this.scorePanel.position.set(-.52,.33,-1.2),this.sub.position.set(0,-.36,-1.2),this.boss.position.set(0,.42,-1.2),this.obj.position.set(0,.3,-1.2),this.setAspect(this.camera.aspect))}setAspect(t){if(this.vr)return;const e=Math.tan(uf.degToRad(this.camera.fov/2))*1.2,n=e*t;this.scorePanel.position.set(-n+.24,e-.1,-1.2),this.boss.position.set(0,e-.09,-1.2),this.sub.position.set(0,-e+.13,-1.2),this.obj.position.set(0,e-.235,-1.2)}attachWrist(t){this.wristAnchor=t}_updateWrist(t,e,n){const i=this.wristAnchor;if(!this.vr||!i||!i.parent){this.wrist.visible=!1,this.wristK=0;return}i.updateWorldMatrix(!0,!1),Ya.set(.065,-.045,.13).applyMatrix4(i.matrixWorld),this.wrist.position.copy(Ya),this.wrist.lookAt(e),this.camera.getWorldDirection($a);const s=$a.angleTo(Ls.subVectors(Ya,e)),a=s<.24?1:s>.4?0:(.4-s)/.16;this.wristK+=(a-this.wristK)*Math.min(1,t*8),this.wrist.material.opacity=this.wristK*n,this.wrist.visible=this.wrist.material.opacity>.01}setComfort(t){this.comfortK=t}setWaypoint(t){this.wpPos=t?t.clone():null}_drawWp(t){const e=this.wpCanvas,n=e.getContext("2d");n.clearRect(0,0,128,160),n.shadowColor="rgba(255,110,20,0.9)",n.shadowBlur=14,n.fillStyle="rgba(255,170,60,0.95)",n.beginPath(),n.moveTo(64,98),n.lineTo(88,74),n.lineTo(64,50),n.lineTo(40,74),n.closePath(),n.fill(),n.shadowBlur=0,n.fillStyle="rgba(40,16,4,0.9)",n.beginPath(),n.moveTo(64,88),n.lineTo(78,74),n.lineTo(64,60),n.lineTo(50,74),n.closePath(),n.fill(),n.font="700 30px Oswald, sans-serif",n.textAlign="center",n.fillStyle="#fff2dc",n.shadowColor="rgba(0,0,0,0.9)",n.shadowBlur=6,n.fillText(t+" M",64,34),this.wpTex.needsUpdate=!0}objective(t,e=6){const n=this.objCanvas,i=n.getContext("2d"),s=t.toUpperCase();i.clearRect(0,0,n.width,n.height),i.textAlign="center",i.textBaseline="middle";let a=66;for(;i.font=`700 ${a}px Oswald, sans-serif`,!(i.measureText(s).width<n.width-150||a<=36);)a-=2;const o=i.measureText(s).width,l=Math.min(n.width-40,Math.max(420,o+110)),c=(n.width-l)/2;Ic(i,c,52,l,108,22,"rgba(10,6,3,0.68)",18),i.fillStyle="#ff8a2a",i.fillRect(c+22,155,l-44,4),Ic(i,n.width/2-112,14,224,46,10,"rgba(255,128,32,0.95)",0),i.font="400 34px Anton, Impact, sans-serif",i.fillStyle="#1a0c04","letterSpacing"in i&&(i.letterSpacing="5px"),i.fillText("OBJECTIVE",n.width/2+2,38),"letterSpacing"in i&&(i.letterSpacing="1px"),i.shadowColor="rgba(0,0,0,0.9)",i.shadowBlur=8,i.font=`700 ${a}px Oswald, sans-serif`,i.fillStyle="#fff4e2",i.fillText(s,n.width/2,108),"letterSpacing"in i&&(i.letterSpacing="0px"),this.objTex.needsUpdate=!0,this.objT=e}_drawWarn(){const t=this.warnCanvas,e=t.getContext("2d");e.clearRect(0,0,256,256),e.shadowColor="rgba(0,0,0,0.8)",e.shadowBlur=10,e.fillStyle="rgba(255,60,20,0.92)",e.beginPath(),e.arc(128,128,92,0,Math.PI*2),e.fill(),e.shadowBlur=0,e.strokeStyle="#fff0e0",e.lineWidth=8,e.stroke(),e.fillStyle="#fff6ea",e.font="400 92px Anton, Impact",e.textAlign="center",e.textBaseline="middle",e.fillText("!",128,128),this.warnTex.needsUpdate=!0}danger(t,e,n,i=1){if(!t){this.warn.material.opacity=0;return}const s=Ya.copy(t).sub(e).applyQuaternion(xd.copy(n).invert()),a=Math.atan2(s.x,s.y),o=s.z<0&&Math.hypot(s.x,s.y)/-s.z<.25?0:.17;this.warn.position.set(Math.sin(a)*o,Math.cos(a)*o-(o?0:.08),-1.2),this.warn.material.opacity=i,this.warn.scale.setScalar(1+.15*Math.sin(performance.now()*.02))}hitMarker(t){if(this.markerT=.12,this.markerBig=t?1.5:1,this.marker.scale.setScalar(this.markerBig),this.vr){if((this._clock||0)-this.lastHitT>.4){this.markerT=0;return}this.markerW.position.copy(this.lastHit)}}setLastHit(t){this.lastHit.copy(t),this.lastHitT=this._clock||0}callout(t,e,n="big",i=null){if(this.endCardOn)return;const s=this.lanes[n==="small"?"small":"big"];if(s.cur&&s.cur.text===t&&s.cur.t<1||s.q.some(l=>l.text===t))return;const a=(x1[n]||1)+(yd.has(t)?2:0);s.q.push({text:t,pos:e.clone(),style:n,sub:i,prio:a,age:0});const o=m1[n==="small"?"small":"big"];for(;s.q.length>o;){let l=0;for(let c=1;c<s.q.length;c++)s.q[c].prio<s.q[l].prio&&(l=c);s.q.splice(l,1)}}_laneUpdate(t){for(const e of["big","small"]){const n=this.lanes[e];n.gap-=t;for(const a of n.q)a.age+=t;if(n.q=n.q.filter(a=>a.age<(g1[a.style]||1)+(yd.has(a.text)?.6:0)),n.gap>0||!n.q.length)continue;let i=0;for(let a=1;a<n.q.length;a++)n.q[a].prio>n.q[i].prio&&(i=a);const s=n.q.splice(i,1)[0];n.cur&&!n.cur.dead&&(n.cur.retire=!0,n.cur.vy=3.2),n.cur=this._spawnCallout(s.text,s.pos,s.style,s.sub,e),n.gap=s.style==="huge"?1.3:p1}}_clampToView(t){const e=this.camera;if(!e)return t;const n=e.getWorldPosition(h1),i=e.getWorldQuaternion(d1),s=u1.subVectors(t,n).applyQuaternion(f1.copy(i).invert()),a=Math.max(4,s.length()),o=_d(Math.atan2(s.x,-s.z),-.36,.36),l=_d(Math.atan2(s.y,Math.hypot(s.x,s.z)),-.08,.24);return s.set(Math.sin(o)*Math.cos(l),Math.sin(l),-Math.cos(o)*Math.cos(l)).multiplyScalar(a).applyQuaternion(i),t.copy(n).add(s)}_spawnCallout(t,e,n,i,s){const a=n==="huge"?150:n==="big"?120:84,o=n==="small"?"#fff3dc":n==="huge"?"fire":"chrome",l=y1(t+"|"+n+"|"+i,()=>v1(xp(t,{size:a,color:o,sub:i,glow:n==="small"?"rgba(0,0,0,0.8)":"rgba(255,110,10,0.95)"}),a,!!i)),c=new On({map:l.texture,depthTest:!1,depthWrite:!1,transparent:!0,toneMapped:!1,fog:!1}),h=new ti(c);h.renderOrder=150,e=this._clampToView(e.clone()),h.position.copy(e),this.scene.add(h);const d={s:h,text:t,lane:s,t:0,life:n==="huge"?2.4:1.6,ang:n==="huge"?.22:n==="big"?.13:.07,aspect:l.aspect,vy:1,base:e.clone(),rise:0,off:0,h:0,retire:!1,fade:1};return this.callouts.push(d),d}_separate(t){const e=this.lanes.big.cur,n=this.lanes.small.cur;vd.copy(this.camera.matrixWorld).invert(),$a.set(0,1,0).applyQuaternion(this.camera.getWorldQuaternion(xd));const i=(a,o)=>(Ls.copy(a.base).setY(a.base.y+a.rise).applyMatrix4(vd),o.z=Math.max(.5,-Ls.z),o.x=Ls.x/o.z,o.y=Ls.y/o.z,o);let s=0;if(n&&e&&!e.dead&&!e.retire&&!n.retire){const a=i(e,this._pa||(this._pa={})),o=i(n,this._pb||(this._pb={})),l=e.h/a.z,c=n.h/o.z;if(Math.abs(a.x-o.x)<(l*e.aspect+c*n.aspect)*.5*.85){const h=(l+c)*.5*.66,u=o.y-a.y;Math.abs(u)<h&&(s=((u<=0?-h:h)-u)*o.z)}}for(const a of this.callouts){const o=a===n?s:a.off;a.off+=(o-a.off)*(a.t<.08?1:Math.min(1,(this._rdt||.016)*14)),a.s.position.copy(a.base).addScaledVector($a,a.off),a.s.position.y+=a.rise}}subtitle(t,e,n=2.5){this.subSpeaker=t.toUpperCase();const i=this.subCanvas,s=i.getContext("2d");s.clearRect(0,0,i.width,i.height),s.fillStyle="rgba(8,5,3,0.55)";const a=26;s.beginPath(),s.roundRect(30,30,i.width-60,i.height-60,a),s.fill(),s.textBaseline="middle";const o=t.toUpperCase()+":  ";let l=40,c,h;for(;s.font=`700 ${l}px Oswald, sans-serif`,c=s.measureText(o).width,s.font=`500 ${l}px Oswald, sans-serif`,h=s.measureText(e).width,!(c+h<i.width-110||l<=24);)l-=2;let u=(i.width-(c+h))/2;s.font=`700 ${l}px Oswald, sans-serif`,s.fillStyle="#ffae3a",s.fillText(o,u,i.height/2),s.font=`500 ${l}px Oswald, sans-serif`,s.fillStyle="#fff4e2",s.fillText(e,u+c,i.height/2),this.subTex.needsUpdate=!0,this.subT=n}showTitle(t,e="BAYHEM",n=null,i=4){var l;this.title&&(this.scene.remove(this.title.s),(l=this.title.s.material.map)==null||l.dispose(),this.title.s.material.dispose());const s=_1(e,n),a=new On({map:s.texture,depthTest:!1,transparent:!0,toneMapped:!1,fog:!1}),o=new ti(a);o.renderOrder=160,o.position.copy(t),this.scene.add(o),this.title={s:o,t:0,life:i,aspect:s.aspect,hk:s.hk,base:t.clone()},i>900&&this.endCard(!0)}endCard(t=!0){if(this.endCardOn=t,t){for(const e of Object.values(this.lanes))e.q.length=0;this.objT=Math.min(this.objT,.3),this.wpPos=null}}drawScore(t,e,n,i){const s=t+"|"+Math.round(e)+"|"+n+"|"+i;if(s===this.lastKey)return;this.lastKey=s;const a=this.scoreCanvas,o=a.getContext("2d");o.clearRect(0,0,a.width,a.height),o.fillStyle="rgba(8,5,3,0.5)",o.beginPath(),o.roundRect(2,2,430,a.height-4,18),o.fill(),o.shadowColor="rgba(0,0,0,0.85)",o.shadowBlur=8;const l=o.createLinearGradient(0,10,0,86);l.addColorStop(0,"#fffaf0"),l.addColorStop(.5,"#ffd38a"),l.addColorStop(1,"#ff9a2a"),o.fillStyle=l,o.font="400 74px Anton, Impact, sans-serif",o.textBaseline="top",o.fillText(String(t).padStart(6,"0"),14,8),i>1&&(o.fillStyle="#ff5a1f",o.font="400 50px Anton, Impact",o.fillText("x"+Math.min(5,i),290,26)),o.shadowBlur=0,o.fillStyle="rgba(0,0,0,0.5)",o.fillRect(16,100,300,16);const c=e>50?"#f4e3c4":e>25?"#ffae3a":"#ff3a1a";o.fillStyle=c,o.fillRect(18,102,296*Math.max(0,e)/100,12),o.fillStyle="#fff1dc",o.font="700 46px Oswald, sans-serif",o.textBaseline="middle",o.shadowColor="rgba(0,0,0,0.9)",o.shadowBlur=6,o.fillText(n,14,146),this.scoreTex.needsUpdate=!0}drawBoss(t,e){const n=Math.round(t*200)/200;if(n===this.lastBoss)return;this.lastBoss=n;const i=this.bossCanvas,s=i.getContext("2d");s.clearRect(0,0,i.width,i.height),s.shadowColor="rgba(0,0,0,0.9)",s.shadowBlur=8,s.save(),s.shadowBlur=0,s.fillStyle="rgba(8,5,3,0.55)",s.beginPath(),s.roundRect(90,0,844,92,18),s.fill(),s.restore(),s.fillStyle="#fff0d6",s.font="400 44px Anton, Impact",s.textAlign="center",s.textBaseline="top",s.fillText(e,i.width/2,2),s.shadowBlur=0,s.fillStyle="rgba(0,0,0,0.6)",s.fillRect(112,54,800,22);const a=s.createLinearGradient(0,0,i.width,0);a.addColorStop(0,"#ff3a10"),a.addColorStop(1,"#ffb030"),s.fillStyle=a,s.fillRect(116,58,792*Math.max(0,n),14),this.bossTex.needsUpdate=!0}update(t,e,n){this._clock=(this._clock||0)+t,this._rdt=t,this._laneUpdate(t);for(const h of this.callouts){h.t+=t;const u=h.t/h.life,d=h.t<.15?.3+h.t/.15*.9:h.t<.3?1.2-(h.t-.15)/.15*.2:1;h.rise+=h.vy*t,(h.retire||this.endCardOn)&&(h.fade-=t/.16);const f=Ls.copy(h.base).setY(h.base.y+h.rise).distanceTo(n),m=Math.max(.6,f*h.ang)*d;h.h=m,h.s.scale.set(m*h.aspect,m,1),h.s.material.opacity=Math.max(0,Math.min(h.fade,u>.7?1-(u-.7)/.3:1)),(u>=1||h.fade<=0)&&(this.scene.remove(h.s),h.s.material.dispose(),h.dead=!0)}this.callouts=this.callouts.filter(h=>!h.dead);for(const h of Object.values(this.lanes))h.cur&&h.cur.dead&&(h.cur=null);if(this._separate(n),this.title){const h=this.title;h.t+=t;const u=h.t/h.life,d=h.s.position.distanceTo(n),f=h.t<.35?.6+h.t/.35*.4:Math.min(1.06,1+(h.t-.35)*.02),m=d*(h.life>900?.4:.3)*f*(h.hk||1);h.s.scale.set(m*h.aspect,m,1),h.s.material.opacity=h.t<.2?h.t/.2:u>.8?Math.max(0,1-(u-.8)/.2):1,u>=1&&h.life<900&&(this.scene.remove(h.s),this.title=null)}if(this.markerT-=t,this.marker.material.opacity=this.markerT>0&&!this.vr?1:0,this.markerW.visible=this.vr&&this.markerT>0,this.markerW.visible){const h=Math.max(.5,this.markerW.position.distanceTo(n));this.markerW.scale.setScalar(h*.05*this.markerBig),this.markerW.material.opacity=1}this.subT-=t,this.sub.material.opacity=Math.max(0,Math.min(1,this.subT*3));const i=Math.min(1,e.hurtFlash*.9+(e.hp<40?(40-e.hp)/40*.55:0));this.hurt.material.opacity=i,this.slow.material.opacity=Math.min(1,(1-e.timeScale)*1.3)*.85;const s=this.comfort.material.opacity;if(this.comfort.material.opacity=s+(this.comfortK-s)*Math.min(1,t*10),this.comfort.visible=this.comfort.material.opacity>.01,this.wpPos){const h=this.wpPos.distanceTo(n),u=Math.round(h);u!==this.wpDist&&(this.wpDist=u,this._drawWp(u)),this.wp.position.copy(this.wpPos);const d=h*.06;this.wp.scale.set(d*.8,d,1);const f=h<5?0:Math.min(.9,(h-5)/6);this.wp.material.opacity+=(f-this.wp.material.opacity)*Math.min(1,t*4)}else this.wp.material.opacity=Math.max(0,this.wp.material.opacity-t*3);this.wp.visible=this.wp.material.opacity>.01,this.objT-=t,this.obj.material.opacity=Math.max(0,Math.min(1,this.objT*1.5,(6-this.objT)*3+0));const a=e.boss;a?(this.boss.visible=!0,this.drawBoss(a.frac,a.name)):this.boss.visible=!1;const o=e.countdown;if(o!=null){this.cd.visible=!0,this.cd.position.set(this.obj.position.x,this.obj.position.y-.1,this.obj.position.z);const h=Math.max(0,o).toFixed(1);if(h!==this.lastCd){this.lastCd=h;const f=this.cdCanvas,m=f.getContext("2d");m.clearRect(0,0,f.width,f.height),m.font="400 150px Anton, Impact",m.textAlign="center",m.textBaseline="middle",m.lineWidth=14,m.strokeStyle="rgba(20,4,2,0.85)",m.strokeText(h,256,100);const x=m.createLinearGradient(0,30,0,170);x.addColorStop(0,"#ffd2a0"),x.addColorStop(.5,"#ff4a1c"),x.addColorStop(1,"#a80c06"),m.shadowColor="rgba(255,40,10,0.9)",m.shadowBlur=24,m.fillStyle=x,m.fillText(h,256,100),this.cdTex.needsUpdate=!0}const u=2+Math.max(0,10-o)*.5,d=1+.08*Math.max(0,Math.sin(this._cdP=(this._cdP||0)+t*u*Math.PI*2));this.cd.scale.setScalar(d),this.cd.material.opacity=(.8+.2*d)*(1-this.endK)}else this.cd.visible=!1;this.endK+=((this.endCardOn?1:0)-this.endK)*Math.min(1,t*6);const l=1-this.endK,c=l>.02;this.scorePanel.material.opacity=l,this.scorePanel.visible=c&&!this.vr,this._updateWrist(t,n,l),this.cross.material.opacity=l,this.cross.visible=c&&!this.vr,c||(this.boss.visible=!1,this.cd.visible=!1,this.marker.material.opacity=0,this.warn.material.opacity=0,this.obj.material.opacity=0,this.wp.visible=!1)}}const M1="modulepreload",S1=function(r,t){return new URL(r,t).href},bd={},An=function(t,e,n){let i=Promise.resolve();if(e&&e.length>0){const a=document.getElementsByTagName("link"),o=document.querySelector("meta[property=csp-nonce]"),l=(o==null?void 0:o.nonce)||(o==null?void 0:o.getAttribute("nonce"));i=Promise.allSettled(e.map(c=>{if(c=S1(c,n),c in bd)return;bd[c]=!0;const h=c.endsWith(".css"),u=h?'[rel="stylesheet"]':"";if(!!n)for(let m=a.length-1;m>=0;m--){const x=a[m];if(x.href===c&&(!h||x.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${c}"]${u}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":M1,h||(f.as="script"),f.crossOrigin="",f.href=c,l&&f.setAttribute("nonce",l),document.head.appendChild(f),h)return new Promise((m,x)=>{f.addEventListener("load",m),f.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${c}`)))})}))}function s(a){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=a,window.dispatchEvent(o),!o.defaultPrevented)throw a}return i.then(a=>{for(const o of a||[])o.status==="rejected"&&s(o.reason);return t().catch(s)})};class w1{constructor(t){this.sys=null,this.record=t,this.events=[],this.t=0,this.listenerN=0}async init(){var t;if(!this.record){try{const e=Object.assign({"./audio.js":()=>An(()=>import("./audio-DHmvSn7o.js"),[],import.meta.url)})["./audio.js"];if(!e)throw new Error("audio module missing");const n=await e();this.sys=new n.AudioSystem,await this.sys.init()}catch(e){console.warn("audio unavailable",e),this.sys=null}await((t=this.onReady)==null?void 0:t.call(this))}}_ev(t,e,n,i){this.record&&this.events.push({t:+this.t.toFixed(4),type:t,name:e,opts:n?{...n}:void 0,value:i})}play(t,e={}){var n;this._ev("play",t,e),(n=this.sys)==null||n.play(t,e)}voice(t,e){var n;this._ev("voice",t,{url:e}),(n=this.sys)==null||n.voice(t)}async loadVoices(t){this.record||!this.sys||await Promise.all(t.map(([e,n])=>this.sys.loadVoice(e,n).catch(i=>console.warn("vo load failed",e,i))))}setLoop(t,e={}){var n;this.record&&(this._lt??(this._lt={}),(this._lt[t]===void 0||this.t-this._lt[t]>.1)&&(this._lt[t]=this.t,this._ev("loop",t,e))),(n=this.sys)==null||n.setLoop(t,e)}stopLoop(t){var e,n;this._ev("stopLoop",t),(n=(e=this.sys)==null?void 0:e.stopLoop)==null||n.call(e,t)}setTimeScale(t){var e;this.record&&Math.abs((this._ts??1)-t)>.02&&(this._ts=t,this._ev("timescale",null,null,+t.toFixed(3))),(e=this.sys)==null||e.setTimeScale(t)}setListener(t,e,n){var i;this.record&&this.listenerN++%3===0&&this.events.push({t:+this.t.toFixed(4),type:"listener",args:[t.x,t.y,t.z,e.x,e.y,e.z,n.x,n.y,n.z].map(s=>+s.toFixed(3))}),(i=this.sys)==null||i.setListener(t.x,t.y,t.z,e.x,e.y,e.z,n.x,n.y,n.z)}startMusic(){var t;this._ev("musicStart"),(t=this.sys)==null||t.startMusic()}setMusicIntensity(t){var e;this._ev("musicIntensity",null,null,t),(e=this.sys)==null||e.setMusicIntensity(t)}musicStinger(t){var e;this._ev("stinger",t),(e=this.sys)==null||e.musicStinger(t)}stopMusic(t=2){var e;this._ev("musicStop",null,null,t),(e=this.sys)==null||e.stopMusic(t)}update(t){var e;(e=this.sys)==null||e.update(t)}}const yp=r=>{var t;return typeof document<"u"&&((t=document.querySelector(`meta[name="${r}"]`))==null?void 0:t.content)||null},ko=parseInt(yp("bayhem-game")||"1",10)===2?2:1,bp=yp("bayhem-root")||"./",T1=r=>new URL(bp+r,location.href).toString();function wh(r,t=null,e=!0){const n=new URL(bp+(r===2?"2/":""),location.href);return e&&(n.search=location.search),t?n.searchParams.set("level",t):n.searchParams.delete("level"),n.toString()}const Ho={1:{title:"BAYHEM",sub:null,store:"bayhem.level"},2:{title:"BAYHEM",two:"2",sub:"THIS TIME IT’S GLOBAL",store:"bayhem2.level"}},mc={c7bb71f4:[5.17,["airport-no-return"]],f4fa44de:[3.25,["airport-no-return"]],"9ed18f71":[5.96,["airport-no-return"]],"924195ca":[6.04,["airport-no-return"]],"119ccce0":[4.97,["airport-no-return"]],"8509d3c8":[3.27,["airport-no-return"]],c981fdc2:[1.69,["airport-no-return"]],"2756d156":[3.75,["airport-no-return"]],b350112d:[3.23,["airport-no-return"]],b3e1f26d:[4.45,["airport-no-return"]],"1f7173f9":[3.01,["airport-no-return"]],"57a48c8c":[3.42,["airport-no-return"]],"2033d7bd":[3.21,["airport-no-return"]],c735e33f:[1.55,["airport-no-return"]],"310746e3":[4.39,["airport-no-return"]],d8a00114:[1.6,["airport-no-return"]],e3914609:[3.19,["airport-no-return"]],f589b41c:[2.87,["airport-no-return"]],bb678b98:[1.48,["airport-no-return"]],c57548b2:[2.65,["airport-no-return"]],"9f8df304":[2.33,["airport-no-return"]],"7707f893":[3.13,["airport-no-return","port-of-victory"]],"07da4781":[2.86,["airport-no-return"]],"0d16d01e":[1.7,["airport-no-return"]],"7cae501d":[1.46,["airport-no-return","the-405-job"]],"114b2663":[1.74,["airport-no-return"]],"1fd6bd8e":[3.59,["downtown-haven"]],"512c10a0":[3.24,["downtown-haven"]],"372425c2":[3.56,["downtown-haven"]],c49656d2:[2.97,["downtown-haven"]],bf9b2a58:[2.4,["downtown-haven"]],"566efc00":[4.51,["downtown-haven"]],dd16dd49:[4.47,["downtown-haven"]],"94c57a00":[4.74,["downtown-haven"]],"7f7269e0":[3.36,["downtown-haven"]],"7bf846eb":[3.6,["downtown-haven"]],"44cff792":[2.37,["downtown-haven"]],"4b7dea81":[3.64,["downtown-haven"]],"1db786d9":[3.99,["downtown-haven"]],"8197e2cf":[4.08,["downtown-haven"]],"541802eb":[4.06,["downtown-haven"]],"09166116":[3.5,["downtown-haven"]],"0613acb2":[2.98,["downtown-haven"]],d9ecac2b:[4.49,["downtown-haven"]],"4058c040":[5.44,["downtown-haven"]],"0590120c":[4.3,["downtown-haven"]],"6660f097":[4.97,["downtown-haven"]],"7c87fdbc":[3.99,["downtown-haven"]],e156021b:[2.29,["downtown-haven"]],53772430:[4.63,["downtown-haven"]],ae4c09da:[2.75,["downtown-haven","iron-lady"]],b475869b:[2.77,["downtown-haven","iron-lady","lights-out","tokyo-scramble","whiteout"]],c3362af3:[3.23,["downtown-haven","iron-lady"]],"963061ff":[2.75,["iron-lady"]],"4a15aae2":[4.33,["iron-lady"]],fa74a682:[3.55,["iron-lady"]],"69a080b5":[4.05,["iron-lady"]],"1d710f81":[4.06,["iron-lady"]],"6ff6f813":[4.09,["iron-lady"]],"196c1178":[4.75,["iron-lady"]],de9634e1:[5.25,["iron-lady"]],"32fb85c3":[3.33,["iron-lady"]],"456d693b":[4.47,["iron-lady"]],b0f72cce:[2.93,["iron-lady"]],bfa976af:[3.98,["iron-lady"]],89574654:[4.64,["iron-lady"]],"98eed00d":[3.69,["iron-lady"]],"80d5b33d":[5.08,["iron-lady"]],"2f383b22":[3.41,["iron-lady"]],"401d4b03":[3.52,["iron-lady"]],"699476a3":[5.56,["iron-lady"]],ed6b26ba:[2.73,["iron-lady"]],"0f18767b":[1.72,["iron-lady"]],"7f9fe4f9":[3.31,["iron-lady"]],b979e7b6:[5.05,["iron-lady"]],"3830993d":[1.08,["iron-lady"]],"173d8814":[4.12,["iron-lady"]],"6966f239":[1.37,["iron-lady","the-405-job"]],c12dcbd5:[3.35,["iron-lady"]],ed5cdfef:[2.71,["lights-out"]],ea294796:[2.67,["lights-out"]],"02c879e9":[4.29,["lights-out"]],"944a9e95":[1.53,["lights-out"]],"2b88f86f":[2.26,["lights-out"]],"2d7ec255":[2.07,["lights-out"]],"54c9d47e":[3.57,["lights-out"]],a93379bf:[1.7,["lights-out"]],"98676ed6":[2.29,["lights-out"]],46639004:[3.17,["lights-out"]],"3231bcff":[4.81,["lights-out"]],"7d82dea9":[4.12,["lights-out"]],"432f2df2":[3.06,["lights-out"]],"3fc54d35":[3.61,["lights-out"]],"72e5c7c3":[3.16,["lights-out"]],"2b29f462":[4.41,["lights-out"]],da745855:[3.64,["lights-out"]],d2e3159d:[3.34,["lights-out"]],b74838d6:[5.33,["lights-out"]],"4b2e6332":[6.88,["lights-out"]],"5a24b389":[5.19,["lights-out"]],ef074e05:[4.36,["lights-out"]],de4f4c62:[3.39,["lights-out"]],"0e8b6677":[5.61,["lights-out"]],"4c93bc55":[5.58,["lights-out"]],af2763bf:[4.27,["lights-out"]],"32790ce0":[4.83,["lights-out"]],b4c25050:[2.73,["lights-out"]],50412027:[2.44,["lights-out"]],a58ef76d:[1.33,["lights-out"]],"38bc3dc8":[2.45,["lights-out"]],eb0fe0b3:[4.57,["lights-out"]],e5352326:[5.46,["lights-out"]],"46cf3d32":[3.06,["lights-out"]],"3b70e359":[5.09,["lights-out"]],"435f3bb1":[4.99,["lights-out"]],"0f10c51b":[4.85,["lights-out"]],"584aa5f0":[4.46,["lights-out"]],a5f2a3a7:[3.04,["lights-out"]],"6ebea8d5":[3.05,["lights-out"]],"0403c777":[3.69,["lights-out"]],"1538be83":[3.43,["lights-out"]],"9098af64":[3.99,["lights-out"]],e5b3c67e:[3.34,["lights-out"]],"86f8956e":[5.35,["lights-out"]],"32e16dd9":[4.04,["lights-out"]],"1b6a9534":[2.47,["port-of-victory"]],"0641742d":[4.18,["port-of-victory"]],b6d86de1:[2.11,["port-of-victory"]],d677656d:[3.08,["port-of-victory"]],"9295b6ae":[2.78,["port-of-victory"]],c8bfa142:[4.4,["port-of-victory"]],"2969b070":[3.31,["port-of-victory"]],"006d0322":[1.95,["port-of-victory"]],ab0affb9:[2.75,["port-of-victory"]],a2ed3f26:[3.21,["port-of-victory"]],d0702a42:[3.5,["port-of-victory"]],"3088af27":[3.47,["port-of-victory"]],"589f624f":[2.41,["port-of-victory"]],"30d98d6c":[3.92,["port-of-victory"]],"714d67b8":[2.74,["port-of-victory"]],"71b4c39d":[3.42,["port-of-victory"]],dcdf0a7e:[1.45,["port-of-victory"]],"180a9267":[1.28,["port-of-victory"]],"30e2ab38":[2.49,["port-of-victory"]],b03df6a9:[2,["port-of-victory"]],a49f89c2:[4.17,["sand-castles"]],af2574a4:[2.76,["sand-castles"]],ebfcf336:[2.38,["sand-castles"]],cfcf2c35:[4.33,["sand-castles"]],"3057f97d":[4.33,["sand-castles"]],"2aac1ef0":[5.17,["sand-castles"]],"34c54663":[6.03,["sand-castles"]],"1ace4907":[3.31,["sand-castles"]],"7474b126":[3.19,["sand-castles"]],"321fcd07":[2.66,["sand-castles"]],c8e7fec2:[3.79,["sand-castles"]],"2f2f8f85":[3.08,["sand-castles"]],bba840a9:[2.52,["sand-castles"]],a636618c:[3.78,["sand-castles"]],cc0a54e2:[2.19,["sand-castles"]],cc9e5868:[2.23,["sand-castles"]],cc873296:[2.27,["sand-castles"]],"91bdfc5d":[4.51,["sand-castles"]],d4f6f2d9:[5.22,["sand-castles"]],"96000da5":[2.43,["sand-castles"]],"3fce6af9":[3.19,["sand-castles"]],"007e9454":[3.93,["sand-castles"]],"72b8553a":[7.14,["sand-castles"]],"340b6ecf":[3.68,["sand-castles"]],e27cf164:[2.13,["sand-castles"]],"0c16b169":[3.14,["sand-castles"]],"26feb3be":[6.31,["sand-castles"]],"250e94e1":[3.18,["sand-castles"]],a198377e:[1.19,["sand-castles"]],"6c7e22ce":[4.04,["sand-castles"]],"34067daf":[3.31,["sand-castles"]],"18c33d0e":[5.7,["sand-castles"]],f8db4505:[2.71,["sand-castles"]],"650fc09b":[4.18,["sand-castles"]],"76c768b6":[2.61,["the-405-job"]],"961f4865":[3.21,["the-405-job"]],"738dbcfb":[3.01,["the-405-job"]],fc4b87c2:[2.43,["the-405-job"]],"89cd055a":[2.47,["the-405-job"]],f9989b9d:[2.27,["the-405-job"]],"8b07ceb5":[3.1,["the-405-job"]],c3ac55b7:[1.84,["the-405-job"]],b9dbd1a7:[1.51,["the-405-job"]],b900ccb2:[2.25,["the-405-job"]],b5b32476:[3.65,["the-405-job"]],e65340bf:[3.24,["the-405-job"]],a3df61e6:[1.66,["the-405-job"]],"87990b23":[3.31,["the-405-job"]],c1b82a13:[3.06,["tokyo-scramble"]],"95efa8e5":[4.7,["tokyo-scramble"]],"83da6965":[2.88,["tokyo-scramble"]],"04860bb3":[3.82,["tokyo-scramble"]],"68432d60":[4.07,["tokyo-scramble"]],"327a581f":[2.01,["tokyo-scramble"]],f2494f84:[5.75,["tokyo-scramble"]],"095328ec":[4.81,["tokyo-scramble"]],"02d82173":[3.53,["tokyo-scramble"]],"3f865fcd":[4.28,["tokyo-scramble"]],d9e60d77:[6.54,["tokyo-scramble"]],"36ef17dc":[3.26,["tokyo-scramble"]],"93fc9952":[3.88,["tokyo-scramble"]],"6209a1fe":[2.85,["tokyo-scramble"]],"3a72c0a2":[5.05,["tokyo-scramble"]],"1b563d81":[6.29,["tokyo-scramble"]],"1e607600":[2.97,["tokyo-scramble"]],"0d38634d":[5.38,["tokyo-scramble"]],"90bf0be4":[2.09,["tokyo-scramble"]],aeb406cf:[3.25,["tokyo-scramble"]],"4c902682":[5.76,["tokyo-scramble"]],"65ec37d4":[7.13,["tokyo-scramble"]],"29e97ff7":[3.72,["tokyo-scramble"]],"4423bdff":[4,["tokyo-scramble"]],cd300485:[4.16,["tokyo-scramble"]],fb2c255c:[3.66,["tokyo-scramble"]],"8e58ed48":[2.15,["tokyo-scramble"]],d3f1c54c:[1.28,["tokyo-scramble"]],a45bd276:[3.14,["tokyo-scramble"]],"9aa3ee5c":[2.11,["tokyo-scramble"]],ba12321d:[3.08,["tokyo-scramble"]],"10d09faf":[4,["whiteout"]],"19dd3f75":[4.74,["whiteout"]],"151e4ea1":[4.19,["whiteout"]],ff7aea0d:[1.68,["whiteout"]],"0c7d40cd":[2.94,["whiteout"]],12844056:[4.35,["whiteout"]],eea2baff:[4.55,["whiteout"]],cff220b3:[5.15,["whiteout"]],a3e16cac:[3.48,["whiteout"]],"632ba720":[3.4,["whiteout"]],db11ce49:[4.72,["whiteout"]],"6a8355bf":[4.25,["whiteout"]],"7e322757":[4.4,["whiteout"]],"6875eaef":[2.66,["whiteout"]],ae72b02d:[5.64,["whiteout"]],"7c9ed4e1":[5.53,["whiteout"]],"71f5c30e":[6.65,["whiteout"]],"60aafe48":[1.66,["whiteout"]],"05b4d726":[1.47,["whiteout"]],"6a2470bc":[3.8,["whiteout"]],ee28e4bf:[3.81,["whiteout"]],"33464e76":[3.65,["whiteout"]],d2e94615:[4.41,["whiteout"]],"3d493ed1":[4.53,["whiteout"]],ec1b641d:[2.55,["whiteout"]],"3d22a7dc":[5.75,["whiteout"]],d016bdbb:[4.8,["whiteout"]],"6e607a79":[2.94,["whiteout"]],def3d610:[2.18,["whiteout"]],"8e29bde6":[.68,["whiteout"]],e582587b:[2.21,["whiteout"]],b6b1838e:[6.13,["whiteout"]],"8408f168":[3.1,["whiteout"]],"9512156f":[4.24,["whiteout"]],"1ee950f7":[3.05,["whiteout"]],"2ab65f8d":[2.86,["whiteout"]],"4013fa0d":[2.85,["whiteout"]]};function A1(r){let t=2166136261;for(let e=0;e<r.length;e++)t^=r.charCodeAt(e),t=Math.imul(t,16777619)>>>0;return t.toString(16).padStart(8,"0")}const Md=r=>T1(`vo/${r}.ogg`);function E1(r,t,e){const n=Object.keys(mc).filter(o=>mc[o][1].includes(e)),i=t.record?[]:n.map(o=>[o,fetch(Md(o)).then(l=>{if(!l.ok)throw new Error(l.status);return l.arrayBuffer()})]);i.forEach(([,o])=>o.catch(()=>{}));const s=()=>Promise.race([t.loadVoices(i),new Promise(o=>setTimeout(o,3e3))]);t.sys?s():t.onReady=s;const a=r.subtitle.bind(r);r.subtitle=(o,l,c=2.5)=>{if(o.toUpperCase()==="DRIVER"){t.play("radio_squelch",{volume:.6});const h=A1(l),u=mc[h];u&&(t.voice(h,Md(h)),c=Math.max(c,u[0]+.4))}a(o,l,c)}}const Mp="bayhem.settings",Sd={comfortVignette:!0};function C1(){try{return{...Sd,...JSON.parse(localStorage.getItem(Mp)||"{}")}}catch{return{...Sd}}}const Mr=C1();function R1(r,t){Mr[r]=t;try{localStorage.setItem(Mp,JSON.stringify(Mr))}catch{}}const I1=Object.assign({"./airport-no-return/index.js":()=>An(()=>import("./index-Cpao31y8.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8]),import.meta.url),"./downtown-haven/index.js":()=>An(()=>import("./index-BIC6IZeA.js").then(r=>r.i),__vite__mapDeps([9,3,4,2,5,10,11,12,7,13,8]),import.meta.url),"./dubai-proto/index.js":()=>An(()=>import("./index-CxbRluyP.js"),__vite__mapDeps([14,15,7,2,11,13]),import.meta.url),"./iron-lady/index.js":()=>An(()=>import("./index-Cy1CjNxM.js"),__vite__mapDeps([16,3,4,2,17,5,18,10,11,7,12,13,8]),import.meta.url),"./lights-out/index.js":()=>An(()=>import("./index-BemA0WcI.js").then(r=>r.k),__vite__mapDeps([19,3,4,2,5,10,11,20,7,12,21,17,13,8,22]),import.meta.url),"./port-of-victory/index.js":()=>An(()=>import("./index-Bu0Xvo2U.js"),__vite__mapDeps([23,1,2,3,4,5,6,8]),import.meta.url),"./sand-castles/index.js":()=>An(()=>import("./index-C4-tjS-H.js"),__vite__mapDeps([24,2,5,13,3,15,7,11]),import.meta.url),"./the-405-job/index.js":()=>An(()=>import("./index-B25I8YkR.js"),__vite__mapDeps([25,1,2,4,5,13]),import.meta.url),"./tokyo-scramble/index.js":()=>An(()=>import("./index-BkwAKH01.js").then(r=>r._),__vite__mapDeps([26,20,3,4,2,5,18,10,11,7,12,8]),import.meta.url),"./whiteout/index.js":()=>An(()=>import("./index-Bu6P-knG.js").then(r=>r.a0),__vite__mapDeps([27,3,4,2,5,10,11,7,8,22]),import.meta.url)}),Th=[{id:"the-405-job",game:1,num:"01",title:"THE 405 JOB",tagline:"A HIGHWAY CHASE IN FIVE EXPLOSIONS",blurb:"Freeway at sunset. You ride the truck bed. They bring SUVs, a fuel tanker and a gunship.",help:"Rail level: aim and shoot, the driver handles the road."},{id:"port-of-victory",game:1,num:"02",title:"PORT OF VICTORY",tagline:"DOCKS AT DUSK. ONE SHIP. TOO MUCH FUEL.",blurb:"On foot through a container maze at golden hour, all the way to the cargo ship. Then blow it up.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint."},{id:"downtown-haven",game:1,num:"03",title:"DOWNTOWN HAVEN CITY",tagline:"GLASS CANYON. RED DOTS. ONE FALLING SKYSCRAPER.",blurb:"On foot down an avenue of glass towers at sunset: rooftop snipers, a gunship, and a dust wall to outrun.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Watch for red laser dots."},{id:"airport-no-return",game:1,num:"04",title:"AIRPORT NO RETURN",tagline:"RUNWAY 27. SUNSET. ONE WAY OUT.",blurb:"Fight across a sunset apron, ground two jets, then chase a cargo plane down the runway in a borrowed jeep.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. In the jeep: just shoot. When it says JUMP: grip / A (VR) or Space."},{id:"iron-lady",game:2,num:"01",code:"PAR",loc:"PARIS",time:"21:00",title:"THE IRON LADY",tagline:"PARIS. 9 PM. THE TOWER DOESN’T MAKE IT.",blurb:"Night on the Seine. They bring a riverboat full of gunmen and a gunship. The gunship hits the tower. The tower hits the river.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. At the end, run onto the boat."},{id:"tokyo-scramble",game:2,num:"02",code:"TYO",loc:"KUROGANE, TOKYO",time:"15:40",title:"TOKYO SCRAMBLE",tagline:"THE BUSIEST CROSSING ON EARTH. FOR NOW.",blurb:"Under the giant screens, mid-afternoon. A tanker takes out the expressway. Then the gas main goes, block by block, right behind you.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Watch the billboard catwalks for red dots — and look up at the decks."},{id:"whiteout",game:2,num:"03",code:"GRH",loc:"GRAUHORN, ALPS",time:"3 412 M",title:"WHITEOUT",tagline:"ONE STORM. ONE CABLE CAR. ONE VERY BIG MOUNTAIN.",blurb:"Up a blizzard road, across the gorge by cable car, into the summit fortress. Then the mountain comes down after you.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. In the cable car: just shoot. Look up the slope — they shoot down from the road above."},{id:"sand-castles",game:2,num:"04",code:"SRB",loc:"AL-SARAB, GULF",time:"16:50",title:"SAND CASTLES",tagline:"SUPERTALLS. SANDSTORM. ONE MINIGUN.",blurb:"A minigun out of a helicopter door. Duel a gunship inside a sandstorm, paint targets with a laser. Then an 830-metre tower comes down.",help:"Seated or standing, the helicopter flies itself. Right hand: the door gun (hold the trigger). Left hand: grenade launcher, and later the laser designator (hold on a target)."},{id:"lights-out",game:2,num:"05",code:"LWU",loc:"LONGWU",time:"18:40",title:"LIGHTS OUT",final:!0,tagline:"TWENTY STOREYS UP IS GROUND FLOOR.",blurb:"A city stacked on cliffs. The power goes, district by district. You BASE‑jump off the tallest tower, and the hillside follows you into the river.",help:"On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Look UP and DOWN — they hold every level of the city. In the glide: just shoot (left stick / A-D nudges your line)."},{id:"dubai-proto",game:2,num:"04",title:"DUBAI PROTOTYPE",tagline:"TECH TEST: GREY BOXES, PERF PANEL",proto:!0,hidden:!0,blurb:"Door-gunner heli loop around a collapsing grey-box skyline. Measures the Level 8 finale on the headset.",help:"Heli rail, seated. L-grip = worst case, R-grip = reset, A = next mid tower, B = hero tower, X = dust level, Y = panel. Desktop: 1 worst, 0 reset, 2 mid, 3 hero, 4 dust, 5 panel."}],P1=[],L1=r=>P1.filter(t=>t.game===r),zs=Th.filter(r=>!r.hidden),Vo=r=>zs.filter(t=>t.game===r),Ah=r=>Th.find(t=>t.id===r)||zs[0],Sp=r=>Th.find(t=>t.id===r)||null;function D1(r){const t=U1(r);if(!t)throw new Error("unknown level "+r);return t()}function U1(r){return I1[`./${r}/index.js`]}const N1=r=>{const t=zs.findIndex(i=>i.id===r),e=zs[t],n=t<0?null:zs[t+1];return n&&!n.proto&&n.game===e.game?n:null};Zb();const hn=new URLSearchParams(location.search),En=hn.has("capture"),wp=hn.has("trailer"),Tp=hn.has("sandbox"),Ap=!Tp&&!hn.has("noauto")&&(En||hn.has("demo")||wp),O1={CAPTURE:En,TRAILER:wp,SANDBOX:Tp,AUTO:Ap};Hb(parseInt(hn.get("seed")||"1337",10));const kr=Sp(hn.get("level")),Za=En?null:Sp(F1(Ho[ko].store)),Mi=(kr||(Za&&Za.game===ko&&!Za.hidden?Za:null)||Vo(ko)[0]||zs[0]).id,Ep=!En&&kr&&kr.game!==ko;Ep&&location.replace(wh(kr.game,kr.id));const Jn=Ah(Mi).game;document.title=Jn===2?"BAYHEM 2":"BAYHEM";function F1(r){try{return localStorage.getItem(r)}catch{return null}}function Pc(r,t){try{localStorage.setItem(r,t)}catch{}}async function B1(){const r=En?null:k1();await Promise.all([document.fonts.load("400 64px Anton"),document.fonts.load("700 64px Oswald"),document.fonts.load("500 64px Oswald")]).catch(()=>{});const t=/OculusBrowser|Quest/i.test(navigator.userAgent),e=t?"quest":"high",n=new Cf({antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:En});n.setPixelRatio(En?1:Math.min(devicePixelRatio,t?1:2)),n.setSize(innerWidth,innerHeight),n.toneMapping=Uc,n.toneMappingExposure=1,n.shadowMap.enabled=!0,n.shadowMap.type=t||hn.has("pcf")?Wo:Lc,hn.has("noshadow")&&(n.shadowMap.enabled=!1),n.xr.enabled=!0,n.xr.setReferenceSpaceType("local-floor"),n.xr.setFoveation(1),document.body.appendChild(n.domElement);const i=new $r;i.fog=new Yr($b.clone(),25,520);const s=new Pe(En?70:72,innerWidth/innerHeight,.05,3e3),a=new Qn;i.add(a),a.add(s),s.position.set(0,1.65,0);const o=jb();i.add(o);const l=t1();i.add(l);const{sun:c,hemi:h}=e1(i,t?1024:2048),u=a1(n),d=new c1(i,u,i.fog,e),f=new b1(i,s);f.setAspect(innerWidth/innerHeight);const m=new w1(En);E1(f,m,Mi);const x={scene:i,renderer:n,camera:s,rig:a,sky:o,flare:l,sun:c,hemi:h,atlas:u,fx:d,hud:f,audio:m,params:hn,quality:e,flags:O1,isQuest:t},p=await(await D1(Mi)).create(x);i.environment=Qb(n),i.environmentIntensity=p.environmentIntensity??.8;const{game:_,player:v}=p;window.__renderer=n,window.__scene=i,window.__hud=f,window.__game=_,window.__fx=d,window.__player=v,window.__THREE=kb,window.__level=p,window.__audio=m,hn.has("yaw")&&(v.yaw=parseFloat(hn.get("yaw"))*Math.PI/180,v.pitch=parseFloat(hn.get("pitch")||"0")*Math.PI/180),p.warm&&(p.warm.position.set(a.position.x,-60,a.position.z),i.add(p.warm)),n.compile(i,s),p.warm&&i.remove(p.warm);const y=new R,P=new R,S=new R,T=new Ae;let E=!1,M=!1,b=0,C=-1;const N=()=>{E=!0,p.start()};function D(k,G=!1){var K,ot;b+=k,m.t=b;const O=k>1/45?2:1;for(let bt=0;bt<O;bt++)p.step(k/O,E);s.updateWorldMatrix(!0,!1);const J=s;J.getWorldPosition(y),_.headPos.copy(y),f.update(k,_,y),f.drawScore(_.score,_.hp,p.ammoText(),_.comboT>0?_.combo:0),J.getWorldDirection(P),S.set(0,1,0).applyQuaternion(J.getWorldQuaternion(T)),m.setListener(y,P,S),(K=p.frame)==null||K.call(p,k,E,y),m.update(k),_.lastExplosionT>C&&(C=_.lastExplosionT,v.shake=Math.min(1.5,v.shake+(_.lastExplosionShake??.8))),o.position.copy(y),o.material.uniforms.time.value=b,o.material.uniforms.sunDir.value.copy(ci),l.position.copy(y).addScaledVector(ci,2e3),n1(c,a.position),Jb(J),G||n.render(i,s),E&&!M&&((ot=p.director)!=null&&ot.done)&&!En&&(M=!0,setTimeout(()=>H1(n,f),2500))}if(window.__step=(k,G)=>D(k,G),window.__audioEvents=()=>m.events,window.__state=()=>({t:b,level:Mi,...p.state()}),En){N(),window.__ready=!0;return}window.__ready=!0;let U=performance.now();if(n.setAnimationLoop(()=>{const k=performance.now(),G=Math.min(1/20,(k-U)/1e3);U=k,D(G)}),addEventListener("resize",()=>{s.aspect=innerWidth/innerHeight,s.updateProjectionMatrix(),n.setSize(innerWidth,innerHeight),f.setAspect(s.aspect)}),Ap){r==null||r.remove();const k=async()=>{removeEventListener("pointerdown",k),await m.init()};addEventListener("pointerdown",k),N();return}const H=async k=>{var G,O;try{const J=k?navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","bounded-floor"]}):null;if(await m.init(),m.play("ui_select",{}),k){const K=await J;n.xr.setFramebufferScaleFactor(1),await n.xr.setSession(K),v.setupVR(),f.setVR(!0),K.addEventListener("end",()=>{var ot,bt,Dt;f.setVR(!1),v.mode="desktop";for(const Y of[v.rifle,v.launcher])s.add(Y.holder),(bt=(ot=Y.model).setMode)==null||bt.call(ot,"desktop");(Dt=v.onExitVR)==null||Dt.call(v)})}else(O=(G=n.domElement).requestPointerLock)==null||O.call(G)}catch(J){console.warn(J)}r.remove(),N()};r.ready(H)}const Cp=`
  #bay{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:16px;
    background:radial-gradient(ellipse at 50% 70%, rgba(255,120,30,0.16), rgba(10,4,2,0.82) 72%);z-index:10;text-align:center;padding:16px;overflow:auto}
  #bay > :first-child{margin-top:auto} #bay > :last-child{margin-bottom:auto}
  #bay h1{font:400 clamp(60px,12vw,170px)/0.9 Anton,Impact,sans-serif;margin:0;letter-spacing:0.02em;
    background:linear-gradient(#fff 0%,#ffe2b4 42%,#6a4a2c 50%,#ffc46b 58%,#fff2d6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 0 24px rgba(255,110,10,0.7)) drop-shadow(0 4px 0 #1a0d04)}
  #bay .levels{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:980px}
  #bay .lv{all:unset;box-sizing:border-box;cursor:pointer;width:min(440px,92vw);text-align:left;padding:14px 18px;border-radius:6px;border:2px solid rgba(255,179,90,0.28);
    background:linear-gradient(135deg,rgba(40,18,6,0.78),rgba(12,6,3,0.78));transition:border-color .15s, transform .15s, box-shadow .15s}
  #bay .lv:hover{border-color:rgba(255,179,90,0.7);transform:translateY(-2px)}
  #bay .lv.sel{border-color:#ffb35a;box-shadow:0 0 26px rgba(255,120,20,0.35), inset 0 0 40px rgba(255,120,20,0.08)}
  #bay .lv .n{font:400 15px Anton,Impact,sans-serif;letter-spacing:0.2em;color:#ff8a2a}
  #bay .lv .t{font:400 34px/1.05 Anton,Impact,sans-serif;letter-spacing:0.04em;color:#fff3df;margin:2px 0 4px}
  #bay .lv .g{font:700 12px Oswald,sans-serif;letter-spacing:0.22em;color:#ffd9a8}
  #bay .lv .b{font:500 14px/1.45 Oswald,sans-serif;color:#d9b99a;margin-top:6px}
  #bay .row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
  #bay button.go{font:400 22px Anton,Impact,sans-serif;letter-spacing:0.08em;padding:14px 30px;border-radius:4px;border:2px solid #ffb35a;
    background:linear-gradient(#ff8a2a,#c8400e);color:#fff8ee;cursor:pointer;box-shadow:0 0 24px rgba(255,120,20,0.45);min-width:200px}
  #bay button.go:disabled{opacity:0.35;cursor:default;box-shadow:none}
  #bay button.alt{background:rgba(20,10,4,0.6)}
  #bay button.opt{all:unset;cursor:pointer;font:700 14px Oswald,sans-serif;letter-spacing:0.18em;color:#d9b99a;padding:8px 16px;border-radius:4px;border:1px solid rgba(255,179,90,0.3);background:rgba(20,10,4,0.5)}
  #bay button.opt.on{color:#ffd9a8;border-color:rgba(255,179,90,0.7)}
  #bay a.xg{font:700 14px Oswald,sans-serif;letter-spacing:0.22em;color:#ffd9a8;text-decoration:none;padding:8px 16px;border-radius:4px;border:1px solid rgba(255,179,90,0.45);background:rgba(20,10,4,0.5)}
  #bay a.xg:hover{border-color:#ffb35a;color:#fff3df}
  #bay small{font:500 13px Oswald,sans-serif;color:#d9b99a;letter-spacing:0.08em;max-width:620px;line-height:1.6}`,z1=`
  #bay.g2{background:
      linear-gradient(rgba(120,180,255,0.05) 1px, transparent 1px) 0 0/100% 48px,
      linear-gradient(90deg, rgba(120,180,255,0.05) 1px, transparent 1px) 0 0/48px 100%,
      radial-gradient(ellipse at 50% 35%, rgba(40,90,160,0.30), rgba(3,7,14,0.90) 70%);gap:14px}
  #bay.g2 h1{letter-spacing:0.05em;font-size:clamp(56px,10vw,140px);padding-top:0.08em;
    background:linear-gradient(#ffffff 0%,#dfeaf7 38%,#3b4d63 50%,#9fb6cf 56%,#eef5ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 0 22px rgba(90,160,255,0.45)) drop-shadow(0 4px 0 #04080f)}
  #bay.g2 h1 .two{display:inline-block;margin:-0.08em -0.06em 0 0.02em;padding:0.08em 0.16em 0.02em 0.08em;font-style:italic;transform:skewX(-6deg) scale(1.08);transform-origin:50% 90%;
    background:linear-gradient(#fff4d6 0%,#ffb14a 30%,#ff5a14 55%,#9e1606 78%,#ff7a2a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 0 18px rgba(255,90,20,0.85)) drop-shadow(0 0 46px rgba(255,60,10,0.45))}
  #bay.g2 .sub{display:flex;align-items:center;gap:18px;font:700 clamp(12px,1.5vw,17px) Oswald,sans-serif;letter-spacing:0.55em;color:#cfe0f4;margin:-4px 0 0;padding-left:0.55em}
  #bay.g2 .sub::before,#bay.g2 .sub::after{content:'';width:clamp(30px,8vw,110px);height:1px;background:linear-gradient(90deg,transparent,#7fa6cf)}
  #bay.g2 .sub::after{background:linear-gradient(90deg,#7fa6cf,transparent)}
  #bay.g2 .route{display:flex;align-items:center;gap:0;font:700 12px Oswald,sans-serif;letter-spacing:0.24em;color:#8fb0d4;margin:2px 0 6px;flex-wrap:wrap;justify-content:center}
  #bay.g2 .route .stop{display:flex;align-items:center;gap:8px;padding:0 4px}
  #bay.g2 .route .stop i{width:9px;height:9px;border-radius:50%;border:2px solid #7fa6cf;box-sizing:border-box}
  #bay.g2 .route .stop.sel{color:#ffb35a}
  #bay.g2 .route .stop.sel i{border-color:#ff7a2a;background:#ff7a2a;box-shadow:0 0 10px #ff6a1a}
  #bay.g2 .route .leg{width:clamp(18px,5vw,64px);height:0;border-top:2px dashed rgba(127,166,207,0.55);margin:0 6px}
  #bay.g2 .lv{padding:12px 18px;border:1px solid rgba(140,180,225,0.30);border-left:4px solid rgba(140,180,225,0.35);border-radius:0;
    clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%);
    background:linear-gradient(160deg,rgba(18,30,48,0.86),rgba(6,10,18,0.86))}
  #bay.g2 .lv:hover{border-color:rgba(170,205,245,0.75)}
  #bay.g2 .lv.sel{border-color:rgba(170,205,245,0.6);border-left-color:#ff7a2a;box-shadow:inset 0 0 50px rgba(80,140,220,0.12)}
  #bay.g2 .lv .dz{display:flex;justify-content:space-between;gap:10px;font:700 11px Oswald,sans-serif;letter-spacing:0.22em;color:#7f9cbc;
    border-bottom:1px solid rgba(140,180,225,0.18);padding-bottom:6px;margin-bottom:6px}
  #bay.g2 .lv .dz b{color:#cfe0f4;font-weight:700}
  #bay.g2 .lv.sel .dz b{color:#ffb35a}
  #bay.g2 .lv .n{color:#8fb0d4}
  #bay.g2 .lv.sel .n{color:#ff8a2a}
  #bay.g2 .lv .t{color:#f2f7ff}
  #bay.g2 .lv .g{color:#b9cde4}
  #bay.g2 .lv .b{color:#93a8c0}
  #bay .lv.soon{cursor:default;position:relative;overflow:hidden}
  #bay .lv.soon:hover{transform:none}
  #bay.g2 .lv.soon{border-style:dashed;border-left-style:solid;border-left-color:rgba(140,180,225,0.2);
    background:repeating-linear-gradient(135deg,rgba(14,22,36,0.88) 0 14px,rgba(10,16,26,0.88) 14px 28px)}
  #bay.g2 .lv.soon .t{color:#9fb2c8}
  #bay.g2 .lv.soon .b,#bay.g2 .lv.soon .g,#bay.g2 .lv.soon .dz{opacity:0.75}
  #bay .lv.soon .stamp{position:absolute;right:16px;top:50px;transform:rotate(-8deg);
    font:400 21px Anton,Impact,sans-serif;letter-spacing:0.12em;color:rgba(255,122,42,0.9);border:3px solid rgba(255,122,42,0.8);padding:1px 10px;
    box-shadow:0 0 18px rgba(255,90,20,0.25);pointer-events:none}
  #bay.g2 .route .stop.soon{color:#5f7894}
  #bay.g2 .route .stop.soon i{border-style:dashed;border-color:#5f7894}
  #bay.g2 button.alt{background:rgba(8,14,24,0.7);border-color:#7fa6cf;box-shadow:0 0 18px rgba(80,140,220,0.25)}
  #bay.g2 button.opt,#bay.g2 a.xg{color:#b9cde4;border-color:rgba(140,180,225,0.4);background:rgba(8,14,24,0.6)}
  #bay.g2 button.opt.on{color:#e6f0fc;border-color:rgba(170,205,245,0.75)}
  #bay.g2 small{color:#93a8c0}`;function k1(){const r=document.createElement("div"),t=Ah(Mi),e=Ho[Jn],n=Jn===2?1:2,i=Vo(Jn);t.hidden&&i.push(t);const s=L1(Jn),a=[...i,...s].filter(c=>c.code&&!c.hidden);r.innerHTML=`<style>${Cp}${Jn===2?z1:""}</style>
  <div id="bay" class="g${Jn}">
    <h1>${e.title}${e.two?`<span class="two">${e.two}</span>`:""}</h1>
    ${e.sub?`<div class="sub">${e.sub}</div>`:""}
    ${a.length?`<div class="route">${a.map((c,h)=>`${h?'<span class="leg"></span>':""}<span class="stop${c.id===t.id?" sel":""}${s.includes(c)?" soon":""}"><i></i>${c.code}</span>`).join("")}</div>`:""}
    <div class="levels">${i.map(c=>`<button class="lv${c.id===t.id?" sel":""}" data-id="${c.id}">${c.loc?`<div class="dz"><b>${c.loc}</b><span>${c.time}</span></div>`:""}<div class="n">LEVEL ${c.num}${c.final?" · FINAL":""}</div><div class="t">${c.title}</div><div class="g">${c.tagline}</div><div class="b">${c.blurb}</div></button>`).join("")}${s.map(c=>`<div class="lv soon">${c.loc?`<div class="dz"><b>${c.loc}</b><span>${c.time}</span></div>`:""}<div class="n">LEVEL ${c.num}${c.final?" · FINAL":""}</div><div class="t">${c.title}</div><div class="g">${c.tagline}</div><div class="b">${c.blurb}</div><div class="stamp">COMING SOON</div></div>`).join("")}</div>
    <div class="row"><button id="vr" class="go" disabled>LOADING…</button><button id="play" class="go alt" disabled>LOADING…</button></div>
    <div class="row"><button id="comfort" class="opt"></button><a class="xg" href="${wh(n,null,!1)}">${n===2?"BAYHEM 2: ABROAD →":"← BAYHEM: HAVEN CITY"}</a></div>
    <small>${t.help}<br>VR: right trigger = rifle, left trigger = grenade launcher, A/X = reload, click the right stick = comfort vignette on/off.<br>Desktop: mouse to aim, left click = rifle, right click = launcher, R = reload.</small>
  </div>`,document.body.appendChild(r);const o=r.querySelector("#comfort"),l=()=>{o.textContent=`COMFORT VIGNETTE: ${Mr.comfortVignette?"ON":"OFF"}`,o.classList.toggle("on",Mr.comfortVignette)};l(),o.onclick=()=>{R1("comfortVignette",!Mr.comfortVignette),l()},o.title="Darkens the edges of your view while you move on foot in VR (reduces motion sickness)";for(const c of r.querySelectorAll(".lv"))c.onclick=()=>{if(c.dataset.id===t.id)return;Pc(e.store,c.dataset.id);const h=new URL(location.href);h.searchParams.set("level",c.dataset.id),location.href=h.toString()};return r.ready=c=>{const h=r.querySelector("#play"),u=r.querySelector("#vr");h.disabled=!1,h.textContent="PLAY ON DESKTOP",h.onclick=()=>c(!1),u.textContent="VR NOT DETECTED",navigator.xr&&navigator.xr.isSessionSupported("immersive-vr").then(d=>{d&&(u.disabled=!1,u.textContent="ENTER VR",u.onclick=()=>c(!0))}).catch(()=>{})},r}function H1(r,t){var o,l,c,h,u;t==null||t.endCard(!0);const e=(l=(o=r.xr).getSession)==null?void 0:l.call(o);e&&e.end().catch(()=>{}),(c=document.exitPointerLock)==null||c.call(document);const n=N1(Mi),i=!n&&Jn===1&&Ah(Mi).id===Vo(1).at(-1).id?Vo(2)[0]:null,s=document.createElement("div");s.innerHTML=`<style>${Cp} #bay{background:radial-gradient(ellipse at 50% 70%, rgba(255,120,30,0.10), rgba(10,4,2,0.55) 72%)}</style>
  <div id="bay"><div class="row">${n?`<button class="go" id="next">NEXT: ${n.title}</button>`:""}${i?'<button class="go" id="sequel">PLAY BAYHEM 2</button>':""}<button class="go alt" id="again">PLAY AGAIN</button><button class="go alt" id="menu">LEVEL SELECT</button></div></div>`,document.body.appendChild(s);const a=d=>{const f=new URL(location.href);f.searchParams.set("level",d),Pc(Ho[Jn].store,d),location.href=f.toString()};(h=s.querySelector("#next"))==null||h.addEventListener("click",()=>a(n.id)),(u=s.querySelector("#sequel"))==null||u.addEventListener("click",()=>{Pc(Ho[2].store,i.id),location.href=wh(2,i.id,!1)}),s.querySelector("#again").onclick=()=>a(Mi),s.querySelector("#menu").onclick=()=>{const d=new URL(location.href);d.searchParams.delete("level"),location.href=d.toString()}}Ep||B1();export{uf as $,Qi as A,qt as B,cs as C,Dn as D,fl as E,Tt as F,Qn as G,X1 as H,Os as I,V1 as J,Y1 as K,Zr as L,Nr as M,dM as N,uM as O,Hn as P,Ae as Q,Hs as R,ns as S,vl as T,ln as U,R as V,me as W,Vb as X,q1 as Y,Ai as Z,Of as _,tt as a,j1 as a$,An as a0,Le as a1,Cn as a2,Be as a3,qe as a4,ee as a5,pl as a6,je as a7,te as a8,Ht as a9,rl as aA,Pf as aB,ml as aC,mh as aD,Sh as aE,K1 as aF,On as aG,ti as aH,Zo as aI,Vt as aJ,tn as aK,Uf as aL,ll as aM,md as aN,Jf as aO,J1 as aP,$1 as aQ,uc as aR,Q1 as aS,tM as aT,eM as aU,yl as aV,hM as aW,oM as aX,lM as aY,aM as aZ,rM as a_,xh as aa,_i as ab,Ye as ac,a1 as ad,ks as ae,Qa as af,Dc as ag,qb as ah,$r as ai,Oo as aj,ja as ak,hl as al,De as am,Fn as an,Xe as ao,we as ap,Un as aq,ri as ar,Kc as as,Zc as at,zn as au,vn as av,un as aw,Vn as ax,$e as ay,eh as az,cl as b,vf as b0,dt as b1,Yb as b2,sM as b3,Mb as b4,yi as b5,Qe as b6,Yf as b7,cM as b8,vb as b9,W1 as ba,Bn as bb,Pr as bc,R1 as bd,Mr as be,_l as bf,vc as bg,bi as bh,cn as bi,nh as bj,hs as c,le as d,fn as e,Me as f,oe as g,ue as h,Z1 as i,yn as j,Ut as k,xp as l,Te as m,gl as n,ht as o,ci as p,ze as q,_p as r,nM as s,pe as t,Ie as u,Gb as v,iM as w,$t as x,j as y,G1 as z};
