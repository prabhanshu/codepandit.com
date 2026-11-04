"use strict";
/* =========================================================
   GAME 2: SQUASH PROD BUGS
   ========================================================= */
const BG = (() => {
  const NAMES = ['auth','gateway','search','jobs','kafka','redis','postgres','recs','sso','cdn','mailer','reports'];
  const BUG = '<svg class="bug" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 14 L6 10 M12 20 H5 M12 26 L6 30 M28 14 L34 10 M28 20 H35 M28 26 L34 30 M17 9 L14 5 M23 9 L26 5"/></g><ellipse cx="20" cy="21" rx="8" ry="11" fill="currentColor"/><line x1="20" y1="12" x2="20" y2="32" stroke="var(--paper)" stroke-width="1.5"/></svg>';
  const grid = $('#bg-grid');
  const tiles = NAMES.map(n => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile';
    b.innerHTML = `<span class="t-dot"></span><span class="t-name">${n}</span><span class="t-stat">p95 ${120 + Math.floor(Math.random()*180)} ms</span>${BUG}`;
    grid.appendChild(b);
    return {el:b, name:n, state:'ok', timer:0};
  });
  let run = false, score = 0, inc = 0, combo = 0, left = 40, spawnT = 0, clockT = 0, statT = 0, t0 = 0;
  let best = +(store.get('cp-bg-best') || 0);
  $('#bg-best').textContent = best;
  const msg = m => $('#bg-msg').textContent = m;
  function setState(t, s, label){
    t.state = s;
    t.el.classList.remove('is-bug','is-deploy','is-incident','is-squash');
    if(s !== 'ok') t.el.classList.add('is-' + s);
    t.el.querySelector('.t-stat').textContent = label || `p95 ${120 + Math.floor(Math.random()*180)} ms`;
    t.el.setAttribute('aria-label', `${t.name}: ${s === 'ok' ? 'healthy' : s}`);
  }
  function hud(){ $('#bg-score').textContent = score; $('#bg-inc').textContent = inc; $('#bg-time').textContent = left; }
  function spawn(){
    const free = tiles.filter(t => t.state === 'ok'); if(!free.length) return;
    const t = free[Math.floor(Math.random()*free.length)];
    const elapsed = (performance.now() - t0)/1000;
    if(Math.random() < 0.2){
      setState(t, 'deploy', 'deploying v2.' + Math.floor(Math.random()*90+10));
      t.timer = setTimeout(() => { if(t.state === 'deploy') setState(t, 'ok'); }, 1900);
    } else {
      setState(t, 'bug', '5xx rising');
      t.timer = setTimeout(() => {
        if(t.state !== 'bug' || !run) return;
        inc++; combo = 0; hud(); msg(`${t.name} paged someone. Incident opened.`);
        setState(t, 'incident', 'INCIDENT');
        t.timer = setTimeout(() => setState(t, 'ok'), 900);
      }, Math.max(750, 1750 - elapsed*25));
    }
  }
  tiles.forEach(t => t.el.addEventListener('pointerdown', e => {
    e.preventDefault();
    if(!run) return;
    if(t.state === 'bug'){
      clearTimeout(t.timer); combo++; score += 10 + Math.min(combo, 10)*2; hud();
      msg(combo > 2 ? `Squashed. ${combo} in a row.` : 'Squashed.');
      setState(t, 'squash', 'fixed'); t.timer = setTimeout(() => setState(t, 'ok'), 400);
    } else if(t.state === 'deploy'){
      clearTimeout(t.timer); score = Math.max(0, score - 15); combo = 0; hud();
      msg(`You rolled back a healthy deploy on ${t.name}. −15`);
      setState(t, 'incident', 'rolled back'); t.timer = setTimeout(() => setState(t, 'ok'), 700);
    }
  }));
  tiles.forEach(t => t.el.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); t.el.dispatchEvent(new PointerEvent('pointerdown')); } }));
  function tick(){
    if(!run) return;
    const elapsed = (performance.now() - t0)/1000;
    left = Math.max(0, 40 - Math.floor(elapsed)); hud();
    if(left <= 0){ stop(true); return; }
    spawnT = setTimeout(() => { spawn(); if(elapsed > 15 && Math.random() < .35) spawn(); tick(); }, Math.max(420, 950 - elapsed*14));
  }
  function start(){
    stop(false); run = true; score = 0; inc = 0; combo = 0; left = 40; t0 = performance.now(); hud();
    msg('Shift started. Watch the board.'); $('#bg-start').textContent = 'Restart shift';
    clockT = setInterval(() => { if(run){ left = Math.max(0, 40 - Math.floor((performance.now()-t0)/1000)); hud(); if(left <= 0) stop(true); } }, 250);
    statT = setInterval(() => tiles.forEach(t => { if(t.state === 'ok') t.el.querySelector('.t-stat').textContent = `p95 ${120 + Math.floor(Math.random()*180)} ms`; }), 1500);
    tick();
  }
  function stop(finished){
    const was = run;
    run = false; clearTimeout(spawnT); clearInterval(clockT); clearInterval(statT);
    tiles.forEach(t => { clearTimeout(t.timer); setState(t, 'ok'); });
    if(finished && was){
      const up = Math.max(0, 100 - inc*0.25).toFixed(2);
      if(score > best){ best = score; store.set('cp-bg-best', best); $('#bg-best').textContent = best; }
      msg(`Shift over. Score ${score}, ${inc} incident${inc === 1 ? '' : 's'}, ${up}% uptime. ` + (inc <= 2 ? 'Quiet shift. Nice.' : inc <= 6 ? 'A normal on-call week.' : 'Time for a postmortem.'));
      $('#bg-start').textContent = 'Start another shift';
    } else if(was){ msg('Paused. Start a new shift when you’re ready.'); $('#bg-start').textContent = 'Start a 40-second shift'; }
  }
  $('#bg-start').addEventListener('click', start);
  document.addEventListener('visibilitychange', () => { if(document.hidden) stop(false); });
  return {stop};
})();
