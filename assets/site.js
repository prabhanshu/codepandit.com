/* codepandit.com shared helpers: query, safe localStorage, theme toggle, theme colours for canvas. */
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- theme toggle ---------- */
const modes = ['auto','light','dark'];
const modeName = {auto:'Auto', light:'Light', dark:'Dark'};
let mode = store.get('cp-theme') || 'auto';
function applyMode(){
  if(mode === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  $('#theme-btn').textContent = modeName[mode];
}
$('#theme-btn').addEventListener('click', () => { mode = modes[(modes.indexOf(mode)+1)%3]; store.set('cp-theme', mode); applyMode(); });
applyMode();

function colors(){
  const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
  return {paper:g('--paper'), panel:g('--paper-2'), ink:g('--ink'), muted:g('--ink-2'), line:g('--line'), soft:g('--line-soft'), red:g('--red'), amber:g('--amber'), ok:g('--ok'), mono:g('--f-mono'), disp:g('--f-display')};
}
