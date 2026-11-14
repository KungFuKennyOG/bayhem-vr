// injected by sand-castles-audit.cjs: samples every scripted event (eye in the seat, the real door opening) into window.__report()
(() => {
  const T3 = window.__THREE, L = window.__level, g = window.__game;
  const W = g.W, sp = L.setp, rail = W.rail, cab = W.cabin.root;
  const EYE = +(window.__EYE || 1.3);
  const HEAD = new T3.Vector3(-0.42, EYE, -0.1);
  const D = { x: -1.25, z0: -1.25, z1: 1.05, y1: 2.12 };
  const ev = {}; window.__ev = ev;
  const loc = new T3.Vector3();
  const classify = (P) => {
    cab.updateMatrixWorld(true);
    loc.copy(P); cab.worldToLocal(loc);
    const dx = loc.x - HEAD.x, dy = loc.y - HEAD.y, dz = loc.z - HEAD.z;
    // yaw off the door normal (-x): + = toward the nose (-z) ... report signed: nose side positive
    const yaw = Math.atan2(-dz, -dx) * 180 / Math.PI;
    const pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
    let cls;
    if (dx >= -0.01) cls = 'behind';
    else {
      const t = (D.x - HEAD.x) / dx, zi = HEAD.z + dz * t, yi = HEAD.y + dy * t;
      const through = zi > D.z0 && zi < D.z1 && yi > -0.05 && yi < D.y1;
      cls = !through ? (Math.abs(yaw) > 90 ? 'behind' : 'wall') : Math.abs(yaw) <= 40 ? 'view' : 'edge';
    }
    return { cls, yaw: Math.round(yaw), pitch: Math.round(pitch), d: Math.round(P.distanceTo(g.headPos)) };
  };
  const dir = () => L.director;
  const rec = (key, P, extra) => {
    const c = classify(P);
    const e = ev[key] || (ev[key] = { key, beat: dir()?.cur?.name, t0: +(dir()?.total || 0).toFixed(1), n: 0, view: 0, edge: 0, wall: 0, behind: 0, yaws: [], blocked: 0 });
    e.n++; e[c.cls]++; e.yaws.push(c.yaw); e.last = c; e.t1 = +(dir()?.total || 0).toFixed(1);
    if (extra?.T && dir()?._blocked(g.headPos, P, extra.T)) e.blocked++;
  };
  const V = (x, y, z) => new T3.Vector3(x, y, z);
  // one-shot hooks
  const push = g.events.push.bind(g.events);
  let nb = 0, nv = 0;
  g.events.push = (e) => {
    try {
      if (e.type === 'boom') rec('boom#' + (++nb) + (e.chain > 1 ? ' chain' + e.chain : ''), e.o.center || V(e.o.x, e.o.y || 0, e.o.z));
      if (e.type === 'viperCrash') rec('viperCrash#' + (++nv), e.p);
      if (e.type === 'wingCrash') rec('wingCrash', e.p);
      if (e.type === 'gunshipCrash') rec('gunshipCrash', e.p);
    } catch (err) { console.warn('hook ' + err.message); }
    return push(e);
  };
  const sample = () => {
    const d = dir(); if (!d) return;
    // falling towers
    const M = sp.mids;
    M.list.forEach((T, i) => {
      const S = M.state[i]; if (!S || S.done) return;
      const Lh = T.h - S.brk, th = S.th;
      const P = S.mode === 'pancake' ? V(T.x, Math.max(5, (T.h - S.drop) * 0.6), T.z)
        : V(T.x + S.fx * Math.sin(th) * Lh * 0.5, Math.max(5, S.brk - S.drop + Math.cos(th) * Lh * 0.5 - S.up), T.z + S.fz * Math.sin(th) * Lh * 0.5);
      rec('fall ' + T.id, P, { T });
    });
    // the Spire
    if (sp.hero.S && !sp.hero.done()) rec('SPIRE fall', V(window.__HERO?.x ?? sp.heroTarget.x, 300, sp.heroTarget.z));
    // wingman going down
    const w = g.wing; if (w && w.phase === 'hit') rec('wing falling', w.pos);
    if (w && w.phase === 'fly' && d.wingArmed && !d.wingShot) rec('wing pre-shot', w.pos);
    // gunship
    const G = g.gunship; if (G && G.phase === 'fight') rec('gunship fight', G.pos); if (G && G.phase === 'dying') rec('gunship dying', G.pos);
    // vipers
    for (const v of g.threats.vipers) { if (v.phase === 'pass') rec('viper' + v.id + ' pass', v.pos); if (v.phase === 'dying') rec('viper' + v.id + ' dying', v.pos); }
    // drones (centroid of each swarm still inbound)
    const dr = g.threats.drones.filter(x => !x.dead && x.t >= 0); if (dr.length) { const c = V(0, 0, 0); dr.forEach(x => c.add(x.pos)); c.divideScalar(dr.length); rec('drones@' + d.cur.name, c); }
    // missiles in flight
    for (const m of sp.strikes.missiles) if (!m.dead && m.pos) rec('missiles@' + d.cur.name, m.pos);
  };
  const step = window.__step; let k = 0;
  window.__step = (dt, nr) => { const r = step(dt, nr); if (++k % 10 === 0) try { sample(); } catch (err) { console.warn('sample ' + err.message); } return r; };
  window.__report = () => Object.values(ev).map(e => { const ys = e.yaws; return `${e.beat?.padEnd(8)} ${String(e.t0).padStart(6)}-${String(e.t1).padStart(6)}s  ${e.key.padEnd(24)} view ${Math.round(100 * e.view / e.n)}% edge ${Math.round(100 * e.edge / e.n)}% wall ${Math.round(100 * e.wall / e.n)}% behind ${Math.round(100 * e.behind / e.n)}%  yaw ${Math.min(...ys)}..${Math.max(...ys)}${e.blocked ? '  blocked ' + Math.round(100 * e.blocked / e.n) + '%' : ''}`; }).join('\n');
})();
