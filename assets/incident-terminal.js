"use strict";
/* =========================================================
   GAME 3: INCIDENT TERMINAL
   ========================================================= */
const TM = (() => {
  const out = $('#tm-out'), form = $('#tm-form'), input = $('#tm-input');
  const N = {
    start:{lines:[['alert','PAGE  prod-us-west  p99 latency above 9s'],['','Error rate 18% and climbing. Tonight is launch night for the new recommendations panel.']],
      opts:[['Open the dashboards','dash',2],['Restart every app pod','restart',12],['Post in #incident and wait for someone','wait',20]]},
    restart:{lines:[['','All pods restart. Latency drops for about 90 seconds, then climbs right back.'],['sys','Whatever this is, it is not inside our pods.']],
      opts:[['Open the dashboards','dash',2],['Post in #incident and wait','wait',20]]},
    wait:{lines:[['','Twenty minutes pass. Two enterprise customers open support tickets.'],['sys','Nobody in the channel knows more than you do.']],
      opts:[['Open the dashboards','dash',2]]},
    dash:{lines:[['','New Relic: throughput is normal for a launch, around 27k requests a minute.'],['','Slowest transaction: GET /api/feed'],['alert','Outbound call from /api/feed to recommendations-service: avg 8.7s (timeout 10s)']],
      opts:[['Trace a slow request by correlation ID','logs',3],['Raise the client timeout to 30s','timeout',6],['Double the app pods','scale',8]]},
    timeout:{lines:[['','Requests now wait up to 30 seconds. Worker threads fill up, and pages that never touch recommendations start timing out too.'],['alert','Error rate 41%. You revert the change.']],
      opts:[['Trace a slow request by correlation ID','logs',3],['Double the app pods','scale',8]]},
    scale:{lines:[['','Twice the pods means twice the calls to recommendations-service.'],['alert','It stops answering entirely. You scale back down.']],
      opts:[['Trace a slow request by correlation ID','logs',3],['Raise the client timeout to 30s','timeout',6]]},
    logs:{lines:[['','Every slow request is waiting on recommendations-service. Another team owns it.'],['alert','Their dashboard: 100× normal load since the launch. It is falling over.'],['sys','You remember the cache fallback you shipped with this feature. It is behind a flag, switched off.']],
      opts:[['Turn on the cache fallback flag','fallback',2],['Ask the other team to scale up, and wait','askteam',30],['Turn the new feature off for everyone','disable',4]]},
    askteam:{lines:[['','They are adding capacity as fast as they can. Thirty minutes later the service is still drowning at 100× load.']],
      opts:[['Turn on the cache fallback flag','fallback',2],['Turn the new feature off for everyone','disable',4]]},
    disable:{end:'partial', lines:[['','The panel disappears for every customer. Latency recovers.'],['sys','The launch is effectively cancelled, and the product team is not happy.']]},
    fallback:{mitigated:true, lines:[['good','Flag on. The platform serves recommendations from cache and refreshes in the background.'],['','Calls to recommendations-service drop to about 10× normal. Within the hour it fully recovers.'],['good','p99 back to 850 ms. Error rate 0.6%.']],
      opts:[['Write the postmortem','post',5],['Close the incident and go to bed','close',0]]},
    post:{end:'good', lines:[['good','Postmortem filed: keep the fallback on permanently, add a circuit breaker on the call, and log latency on every outbound request.'],['sys','Next time a dependency slows down, the logs will name it in minutes.']]},
    close:{end:'ok', lines:[['','You sleep well. It happens again next Tuesday, and you write the postmortem then.']]}
  };
  let node, mins, mitigatedAt, booted = false, busy = false, visited;
  function line(cls, text){ const d = document.createElement('div'); if(cls) d.className = cls; d.textContent = text; out.appendChild(d); out.scrollTop = out.scrollHeight; return d; }
  function clock(){
    const t = 14 + mins, h = 2 + Math.floor(t/60), m = t % 60;
    $('#tm-clock').textContent = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    $('#tm-min').textContent = mins;
  }
  function printLines(arr, done){
    if(reduced){ arr.forEach(([c,t]) => line(c,t)); done(); return; }
    busy = true; let i = 0;
    const next = () => { if(i >= arr.length){ busy = false; done(); return; } const [c,t] = arr[i++]; line(c,t); setTimeout(next, 260); };
    next();
  }
  function show(id){
    node = N[id]; visited.add(id);
    if(node.mitigated && mitigatedAt == null) mitigatedAt = mins;
    if(id === 'disable' && mitigatedAt == null) mitigatedAt = mins;
    line('sys', '');
    printLines(node.lines, () => {
      if(node.end){ finish(node.end); return; }
      node.opts.forEach((o, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
        b.textContent = `[${k+1}] ${o[0]}`;
        b.addEventListener('click', () => choose(k));
        out.appendChild(b);
      });
      out.scrollTop = out.scrollHeight;
    });
  }
  function choose(k){
    if(busy || !node || node.end || !node.opts) return;
    const o = node.opts[k]; if(!o) { line('sys', 'Pick one of the numbered options.'); return; }
    out.querySelectorAll('.opt').forEach(b => b.disabled = true);
    line('you', '> ' + o[0]);
    mins += o[2]; clock();
    show(o[1]);
  }
  function finish(kind){
    const m = mitigatedAt == null ? mins : mitigatedAt;
    line('sys', '');
    line('sys', '──────── INCIDENT CLOSED ────────');
    line('', `Time to mitigate: ${m} minutes`);
    let verdict;
    if(kind === 'good') verdict = m <= 9 ? 'Textbook. That is the real fix, on close to the real timeline.' : 'You got there. The fallback saved the launch.';
    else if(kind === 'ok') verdict = 'Mitigated, but without a postmortem it will happen again.';
    else verdict = 'Stable, at the cost of the launch. There was a way to keep the feature up.';
    line(kind === 'partial' ? 'alert' : 'good', verdict);
    line('sys', 'Based on a real launch. The full story is the first case study at prabhanshu.me.');
    line('sys', 'Type "restart" to run it again.');
  }
  function reset(){
    out.innerHTML = ''; mins = 0; mitigatedAt = null; visited = new Set(); clock();
    line('sys', 'codepandit incident simulator · type "help" for commands');
    show('start');
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim().toLowerCase(); input.value = '';
    if(!v) return;
    if(/^\d+$/.test(v)){ if(node && node.end){ line('you','> '+v); line('sys','The incident is closed. Type "restart" to play again.'); return; } choose(+v - 1); return; }
    line('you', '> ' + v);
    if(v === 'help') line('sys', 'Commands: 1/2/3 choose an option · status · restart · clear · whoami');
    else if(v === 'restart') reset();
    else if(v === 'clear'){ out.innerHTML = ''; if(node && !node.end) show(Object.keys(N).find(k => N[k] === node)); }
    else if(v === 'status') line('', `Elapsed ${mins} min. ${mitigatedAt == null ? 'Not mitigated yet.' : 'Mitigated at ' + mitigatedAt + ' min.'}`);
    else if(v === 'whoami') line('', 'prabhanshu · backend engineer · designs for failure first');
    else if(v.startsWith('sudo')) line('alert', 'Nice try. Production changes go through review.');
    else line('sys', `Unknown command: ${v}. Type "help".`);
  });
  function boot(){ if(!booted){ booted = true; reset(); } }
  return {boot};
})();

TM.boot();
