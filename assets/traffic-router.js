"use strict";
/* =========================================================
   GAME 1: TRAFFIC ROUTER
   ========================================================= */
const TR = (() => {
  const cv = $('#tr-canvas'), ctx = cv.getContext('2d');
  const CAP = 4, BUDGET = 10, QMAX = 11, TTL = 6500;
  const SVC = [{name:'Rails API', ms:620},{name:'Search', ms:900},{name:'Recs (slow)', ms:1450}];
  const WIDE = {tall:false, W:720, H:380, GW:{x:24, y:40, w:190, h:304}, box:i => ({x:450, y:40 + i*108, w:250, h:88}),
    ox:214, oy:64, tx:330, hudX:450, footX:24, footY:368, msgX:450, msgY:368};
  const TALL = {tall:true, W:360, H:548, GW:{x:16, y:56, w:328, h:100}, box:i => ({x:28, y:188 + i*104, w:316, h:90}),
    ox:16, oy:106, tx:8, hudX:16, footX:16, footY:516, msgX:16, msgY:536};
  let L = WIDE;
  let st, raf = 0, last = 0;
  let best = +(store.get('cp-tr-best') || 0);
  $('#tr-best').textContent = best;

  function size(){
    const pw = cv.parentElement.clientWidth || 720;
    L = pw > 0 && pw < 560 ? TALL : WIDE;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = L.W*dpr; cv.height = L.H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    cv.style.aspectRatio = L.W + '/' + L.H;
  }
  function reset(){
    st = {t:0, q:[], svcs:SVC.map(s => ({...s, q:0, inflight:0, prog:0, down:0, flash:0})), pk:[], served:0, dropped:0,
          next:700, spike:0, nextSpike:16000, phase:'ready', msg:'', msgT:0, shake:0};
  }
  function say(m, c){ st.msg = m; st.msgT = 2200; st.msgC = c || 'muted'; }
  function start(){ reset(); st.phase = 'run'; last = performance.now(); say('Route requests with 1, 2, 3', 'muted'); loop(last); }
  function over(){
    st.phase = 'over';
    if(st.served > best){ best = st.served; store.set('cp-tr-best', best); $('#tr-best').textContent = best; }
  }
  function drop(reason){ st.dropped++; st.shake = 160; say(reason, 'red'); if(st.dropped >= BUDGET) over(); }
  function route(i){
    if(!st || st.phase !== 'run'){ if(!st || st.phase !== 'run') start(); return; }
    const s = st.svcs[i];
    if(!st.q.length){ say('Gateway is empty', 'muted'); return; }
    if(s.down > 0){ s.flash = 300; say(s.name + ': breaker open, failing fast', 'amber'); return; }
    if(s.q + s.inflight >= CAP){ st.q.shift(); s.down = 2600; drop(s.name + ' overloaded. Breaker opened.'); return; }
    st.q.shift(); s.inflight++; st.pk.push({i, t:0});
  }
  function update(dt){
    st.t += dt;
    if(st.msgT > 0) st.msgT -= dt;
    if(st.shake > 0) st.shake -= dt;
    st.nextSpike -= dt;
    if(st.nextSpike <= 0){ st.spike = 4500; st.nextSpike = 17000 + Math.random()*6000; say('Traffic spike', 'red'); }
    if(st.spike > 0) st.spike -= dt;
    st.next -= dt;
    if(st.next <= 0){
      const base = Math.max(360, 1150 - st.t/1000*14);
      st.next = base / (st.spike > 0 ? 2.4 : 1) * (0.7 + Math.random()*0.6);
      if(st.q.length >= QMAX) drop('Gateway queue full. Request rejected.');
      else st.q.push({age:0});
    }
    for(let k = st.q.length-1; k >= 0; k--){
      st.q[k].age += dt;
      if(st.q[k].age >= TTL){ st.q.splice(k,1); drop('Request timed out at the gateway'); if(st.phase !== 'run') return; }
    }
    st.pk = st.pk.filter(p => { p.t += dt/260; if(p.t >= 1){ const s = st.svcs[p.i]; s.inflight--; s.q++; return false; } return true; });
    st.svcs.forEach(s => {
      if(s.down > 0) s.down -= dt;
      if(s.flash > 0) s.flash -= dt;
      if(s.q > 0){ s.prog += dt / s.ms; if(s.prog >= 1){ s.prog = 0; s.q--; st.served++; } } else s.prog = 0;
    });
  }
  function rrect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function draw(){
    if(!st) reset();
    const c = colors(), mono = c.mono || 'monospace', disp = c.disp || 'sans-serif';
    const {W, H, GW, tall} = L, BOX = L.box;
    ctx.save();
    ctx.fillStyle = c.paper; ctx.fillRect(0,0,W,H);
    if(st.shake > 0) ctx.translate((Math.random()-.5)*4, (Math.random()-.5)*4);
    ctx.textBaseline = 'alphabetic';
    // gateway
    ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; ctx.strokeRect(GW.x, GW.y, GW.w, GW.h);
    ctx.fillStyle = c.line; ctx.font = `700 11px ${mono}`;
    ctx.fillText('GATEWAY QUEUE', GW.x, GW.y - 10);
    ctx.fillStyle = c.muted; ctx.font = `10px ${mono}`;
    ctx.fillText(`${st.q.length}/${QMAX}`, GW.x + GW.w - 34, GW.y - 10);
    st.q.forEach((r, k) => {
      const left = 1 - r.age/TTL, col = left > .5 ? c.line : left > .25 ? c.amber : c.red;
      if(tall){
        const w = 22, h = GW.h - 34, x = GW.x + 10 + k*28, y = GW.y + 14;
        ctx.fillStyle = c.panel; rrect(x,y,w,h,3); ctx.fill();
        ctx.fillStyle = col; const fh = Math.max(6, h*left); rrect(x, y + h - fh, w, fh, 3); ctx.fill();
        if(k === 0){ ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; rrect(x-3,y-3,w+6,h+6,4); ctx.stroke(); ctx.fillStyle = c.ink; ctx.font = `700 9px ${mono}`; ctx.fillText('NEXT', x - 2, y + h + 13); }
      } else {
        const y = GW.y + 10 + k*26, x = GW.x + 10, w = GW.w - 20, h = 20;
        ctx.fillStyle = c.panel; rrect(x,y,w,h,3); ctx.fill();
        ctx.fillStyle = col; rrect(x, y, Math.max(6, w*left), h, 3); ctx.fill();
        ctx.fillStyle = c.paper; ctx.font = `10px ${mono}`;
        ctx.fillText(k === 0 ? 'NEXT  req' : 'req', x + 8, y + 14);
        if(k === 0){ ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; rrect(x-3,y-3,w+6,h+6,4); ctx.stroke(); }
      }
    });
    // wires: (ox,oy) -> (tx,oy) -> (tx,ty) -> (b.x,ty)
    st.svcs.forEach((s,i) => {
      const b = BOX(i), ty = b.y + b.h/2;
      ctx.strokeStyle = s.down > 0 ? c.red : c.line; ctx.lineWidth = 1.2;
      ctx.setLineDash(s.down > 0 ? [4,4] : []);
      ctx.beginPath(); ctx.moveTo(L.ox, L.oy); ctx.lineTo(L.tx, L.oy); ctx.lineTo(L.tx, ty); ctx.lineTo(b.x, ty); ctx.stroke();
      ctx.setLineDash([]);
    });
    st.pk.forEach(p => {
      const b = BOX(p.i), ty = b.y + b.h/2;
      const L1 = Math.abs(L.tx - L.ox), L2 = Math.abs(ty - L.oy), L3 = Math.abs(b.x - L.tx), T = L1+L2+L3; let d = p.t*T, x, y;
      if(d < L1){ x = L.ox + Math.sign(L.tx-L.ox)*d; y = L.oy; }
      else if(d < L1+L2){ x = L.tx; y = L.oy + Math.sign(ty-L.oy)*(d-L1); }
      else { x = L.tx + Math.sign(b.x-L.tx)*(d-L1-L2); y = ty; }
      ctx.fillStyle = c.line; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
    });
    // services
    st.svcs.forEach((s,i) => {
      const b = BOX(i), down = s.down > 0;
      ctx.fillStyle = s.flash > 0 ? c.panel : c.paper; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = down ? c.red : c.line; ctx.lineWidth = down ? 2 : 1.5;
      ctx.setLineDash(down ? [5,4] : []); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
      ctx.fillStyle = c.ink; ctx.font = `700 13px ${mono}`;
      ctx.fillText(`${i+1} · ${s.name}`, b.x + 12, b.y + 22);
      ctx.fillStyle = down ? c.red : c.muted; ctx.font = `10px ${mono}`;
      ctx.fillText(down ? `BREAKER OPEN ${(s.down/1000).toFixed(1)}s` : `${s.ms} ms / request`, b.x + 12, b.y + 38);
      for(let k = 0; k < CAP; k++){
        const sx = b.x + 12 + k*30, sy = b.y + 50;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 24, 24);
        if(k < s.q){ ctx.fillStyle = k === 0 ? c.line : c.soft; ctx.fillRect(sx+3, sy+3, 18, 18); }
        else if(k < s.q + s.inflight){ ctx.setLineDash([2,2]); ctx.strokeRect(sx+4, sy+4, 16, 16); ctx.setLineDash([]); }
      }
      const px = b.x + 140, pw = b.w - 152;
      ctx.strokeStyle = c.soft; ctx.strokeRect(px, b.y + 58, pw, 8);
      ctx.fillStyle = c.ok; ctx.fillRect(px, b.y + 58, pw*s.prog, 8);
      ctx.fillStyle = c.muted; ctx.font = `9px ${mono}`; ctx.fillText('processing', px, b.y + 80);
    });
    // HUD
    ctx.fillStyle = c.ink; ctx.font = `700 12px ${mono}`;
    ctx.fillText(`SERVED ${st.served}`, L.hudX, 22);
    ctx.fillStyle = c.muted; ctx.font = `10px ${mono}`; ctx.fillText('ERROR BUDGET', L.hudX + 110, 22);
    for(let k = 0; k < BUDGET; k++){ ctx.fillStyle = k < BUDGET - st.dropped ? c.ok : c.soft; ctx.fillRect(L.hudX + 110 + k*14, 27, 10, 4); }
    ctx.fillStyle = c.muted; ctx.font = `10px ${mono}`; ctx.fillText(`T+${Math.floor(st.t/1000)}s`, L.footX, L.footY);
    if(st.spike > 0 && st.phase === 'run'){ ctx.fillStyle = c.red; ctx.font = `700 11px ${mono}`; ctx.fillText('▲ TRAFFIC SPIKE', L.footX + 70, L.footY); }
    if(st.msgT > 0 && st.phase === 'run'){ ctx.fillStyle = c[st.msgC] || c.muted; ctx.font = `11px ${mono}`; ctx.fillText(st.msg, L.msgX, L.msgY); }
    // overlay
    if(st.phase !== 'run'){
      ctx.fillStyle = c.paper; ctx.globalAlpha = .92; ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1;
      const bw = Math.min(380, W - 32), bh = 224, bx = (W - bw)/2, by = (H - bh)/2;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
      ctx.textAlign = 'center'; ctx.fillStyle = c.ink;
      ctx.font = `800 26px ${disp}`;
      ctx.fillText(st.phase === 'over' ? 'Error budget spent' : st.phase === 'paused' ? 'Paused' : 'Traffic Router', W/2, by + 46);
      let lines;
      if(st.phase === 'over'){
        const tip = st.served >= 120 ? ['That would hold up at','27k requests a minute.'] : st.served >= 60 ? ['Solid. Watch the slow','service during spikes.'] : ['Tip: keep Recs light.','It is the slowest service.'];
        lines = [`Served ${st.served} requests`, `in ${Math.floor(st.t/1000)} seconds.`, ...tip];
      } else lines = ['Send each request to a service','before it times out.','Full service = breaker opens.','10 drops = game over.'];
      ctx.font = `12px ${mono}`; ctx.fillStyle = c.muted;
      lines.forEach((t, k) => ctx.fillText(t, W/2, by + 78 + k*19));
      ctx.fillStyle = c.line; ctx.fillRect(W/2 - 90, by + bh - 52, 180, 36);
      ctx.fillStyle = c.paper; ctx.font = `700 13px ${mono}`;
      ctx.fillText(st.phase === 'over' ? 'PLAY AGAIN' : st.phase === 'paused' ? 'RESUME' : 'START', W/2, by + bh - 29);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  function loop(now){
    cancelAnimationFrame(raf);
    const step = t => {
      const dt = Math.min(50, t - last); last = t;
      if(st.phase === 'run') update(dt);
      draw();
      if(st.phase === 'run') raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function resume(){ st.phase = 'run'; last = performance.now(); loop(last); }
  function pause(){ if(st && st.phase === 'run'){ st.phase = 'paused'; cancelAnimationFrame(raf); draw(); } }
  function hit(e){
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * L.W / r.width, y = (e.clientY - r.top) * L.H / r.height, BOX = L.box;
    if(st.phase === 'paused'){ resume(); return; }
    if(st.phase !== 'run'){ start(); return; }
    for(let i = 0; i < 3; i++){ const b = BOX(i); if(x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h){ route(i); return; } }
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.focus({preventScroll:true}); hit(e); });
  document.querySelectorAll('[data-route]').forEach(b => b.addEventListener('click', () => {
    if(st.phase === 'paused') resume(); else route(+b.dataset.route);
  }));
  window.addEventListener('keydown', e => {
    if(e.target.tagName === 'INPUT') return;
    const r = $('#game').getBoundingClientRect(); if(r.bottom < 0 || r.top > innerHeight) return;
    if(['1','2','3'].includes(e.key)){ e.preventDefault(); if(st.phase === 'paused') resume(); else route(+e.key - 1); }
    else if(e.key === ' ' && document.activeElement === cv){ e.preventDefault(); if(st.phase === 'paused') resume(); else if(st.phase !== 'run') start(); }
  });
  document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
  size(); reset(); draw();
  let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { size(); draw(); }, 120); });
  if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => draw());
  $('#theme-btn').addEventListener('click', () => draw());
  return {pause, draw, redraw(){ size(); draw(); }};
})();
