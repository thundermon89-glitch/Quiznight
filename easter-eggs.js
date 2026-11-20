/* =====================================================================================
   HIRNSCHMALZ-ARENA - Easter Eggs: Stefan & die Goldene Ente
   -------------------------------------------------------------------------------------
   Einbinden: <script src="easter-eggs.js"></script> (auf allen Spieler-Seiten)

   - Bei jedem Spieler taucht irgendwann im Laufe des Abends Stefan auf und schlendert
     über den Bildschirm (bleibt kurz stehen und isst einen Snack). Wer ihn 3x anklickt,
     bekommt +50 Punkte.
   - Genauso die Goldene Ente: sie taucht an einer zufälligen Stelle auf, schwimmt/wippt
     und hüpft nach jedem Klick weiter. 3 Treffer = +50 Punkte.
   - Jedes Ei gibt es pro Spieler einmal pro Tag. Wird es verpasst, kommt es später wieder.
   - Admin/Host sieht keine Eier. Auf Lobby, Editor und Admin-Seiten erscheinen sie nicht.
   - DER ADMIN: Wird es am Rechner eines Spielers ruhig (eine Weile keine Maus/Tastatur),
     schlurft der Admin vorbei (höchstens 2-3x pro Abend) und macht irgendeinen Quatsch (Bier, Rülpser, Tanz, am PC
     hocken ...). Wer ihn wegklickt, kassiert eine Uppercut und -25 Punkte.
   ===================================================================================== */
(function () {
  if (window.HSEggs) return;
  const DB_URL = 'https://play-ground-82b46-default-rtdb.firebaseio.com';
  const POINTS = 50, CLICKS = 3;
  const FIRST_MIN = 4, FIRST_MAX = 70;     // erster Auftritt: 4 bis 70 Minuten nach dem ersten Laden am Tag
  const RETRY_MIN = 6, RETRY_MAX = 20;     // verpasst? dann 6 bis 20 Minuten später nochmal
  const BASE = (function () { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, '') : ''; })();
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index';
  const SKIP = ['index', 'editor', 'admin-cockpit', 'ueberwachung'];
  const pid = (() => { try { return localStorage.getItem('quiz_player_id'); } catch (e) { return null; } })();
  if (SKIP.includes(page) || !pid) return;

  const today = new Date().toISOString().slice(0, 10);
  const LS = 'hsegg:' + today + ':';
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(LS + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} }
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sfx = (k, v) => { try { window.HSAudio && HSAudio.synth(k, v); } catch (e) {} };

  // ---- Firebase per REST (die Seiten haben ihre eigene Firebase-Instanz) ----
  const api = (path, opt) => fetch(DB_URL + '/' + path + '.json', opt).then(r => (r.ok ? r.json() : null)).catch(() => null);
  async function award(egg) {
    const me = await api('players/' + pid);
    if (!me || !me.name) return;
    const score = (me.score || 0) + POINTS;
    await api('players/' + pid + '/score', { method: 'PUT', body: JSON.stringify(score) });
    const text = egg === 'stefan'
      ? '🥪 ' + me.name + ' hat Stefan erwischt: +' + POINTS + ' Punkte'
      : '🦆 ' + me.name + ' hat die Goldene Ente gefunden: +' + POINTS + ' Punkte';
    await api('gameLog', { method: 'POST', body: JSON.stringify({ text, at: Date.now() }) });
  }

  // ---- Styles ----
  function style() {
    if (document.getElementById('hsegg-style')) return;
    const st = document.createElement('style'); st.id = 'hsegg-style';
    st.textContent = `
      .hsegg { position: fixed; z-index: 2147483600; cursor: pointer; image-rendering: pixelated; background-repeat: no-repeat;
        user-select: none; }
      .hsegg-bubble { position: fixed; z-index: 2147483601; pointer-events: none; transform: translate(-50%, -100%);
        background: #fff; color: #1a1a2e; border: 3px solid #1a1a2e; border-radius: 14px; padding: 4px 10px;
        font: 800 15px 'Baloo 2', system-ui, sans-serif; white-space: nowrap; box-shadow: 3px 3px 0 #1a1a2e; }
      .hsegg-pop { position: fixed; z-index: 2147483602; pointer-events: none; transform: translate(-50%, -50%);
        font: 800 30px 'Baloo 2', system-ui, sans-serif; color: #ffd23f; -webkit-text-stroke: 2px #1a1a2e;
        animation: hseggPop 1.4s ease-out forwards; }
      .hsegg-toast { position: fixed; left: 50%; top: 18px; transform: translateX(-50%); z-index: 2147483603; pointer-events: none;
        background: #ffd23f; color: #1a1a2e; border: 3px solid #1a1a2e; border-radius: 16px; padding: 10px 18px;
        font: 800 18px 'Baloo 2', system-ui, sans-serif; box-shadow: 4px 4px 0 #1a1a2e; animation: hseggToast 3.2s ease forwards; }
      @keyframes hseggPop { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.5); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); }
        100% { opacity: 0; transform: translate(-50%, -160%) scale(1); } }
      @keyframes hseggToast { 0% { opacity: 0; transform: translate(-50%, -20px); } 10%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -20px); } }
      @keyframes hseggShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px) rotate(-6deg); } 75% { transform: translateX(6px) rotate(6deg); } }
    `;
    document.head.appendChild(st);
  }
  function pop(x, y, text, color) {
    const el = document.createElement('div'); el.className = 'hsegg-pop'; el.textContent = text;
    if (color) el.style.color = color;
    el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1500);
  }
  function toast(text) {
    const el = document.createElement('div'); el.className = 'hsegg-toast'; el.textContent = text;
    document.body.appendChild(el); setTimeout(() => el.remove(), 3300);
  }
  function bubble(owner, text, ms) {
    if (owner._bubble) owner._bubble.remove();
    const b = document.createElement('div'); b.className = 'hsegg-bubble'; b.textContent = text;
    document.body.appendChild(b); owner._bubble = b; owner._bubbleUntil = performance.now() + (ms || 1400);
  }
  function placeBubble(owner, x, y) {
    if (!owner._bubble) return;
    if (performance.now() > owner._bubbleUntil) { owner._bubble.remove(); owner._bubble = null; return; }
    owner._bubble.style.left = x + 'px'; owner._bubble.style.top = y + 'px';
  }

  // =====================================================================================
  // STEFAN: schlendert von links nach rechts, bleibt in der Mitte stehen und isst
  // =====================================================================================
  function runStefan(done) {
    const H = Math.max(110, Math.min(190, window.innerHeight * 0.24));   // Darstellungshöhe
    const S = H / 160, FW = 160 * S;
    const el = document.createElement('div'); el.className = 'hsegg';
    el.style.width = FW + 'px'; el.style.height = H + 'px'; el.style.bottom = '6px';
    el.style.backgroundImage = `url('${BASE}eggs/stefan_walk.png')`; el.style.backgroundSize = `${6 * FW}px ${H}px`;
    document.body.appendChild(el);
    const W = () => window.innerWidth;
    let x = -FW, state = 'walk', t0 = performance.now(), clicks = 0, last = t0, speed = 55, eatUntil = 0, ended = false, disturbed = false;
    const stopAt = W() * rnd(0.3, 0.6);
    const STARE_MS = 9000;   // in Ruhe gelassen: so lange steht er da, starrt dich an und isst
    const LINES = ['Na?', 'Hm, lecker.', 'Was guckst du?', 'Ich bin gar nicht da.', 'Snack?'];
    const HIT = ['Hey!', 'Lass das!', 'Mein Snack!'];
    function frame(now) {
      if (ended) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (state === 'walk') {
        x += speed * dt;
        el.style.backgroundImage = `url('${BASE}eggs/stefan_walk.png')`; el.style.backgroundSize = `${6 * FW}px ${H}px`;
        el.style.backgroundPosition = `-${(Math.floor(now / 140) % 6) * FW}px 0`;
        if (!eatUntil && x >= stopAt) { state = 'eat'; eatUntil = now + STARE_MS; setTimeout(() => { if (state === 'eat' && !disturbed) bubble(el, LINES[Math.floor(Math.random() * LINES.length)], 2000); }, 3500); }
        if (x > W() + 20) return finish(false);
      } else if (state === 'eat') {
        el.style.backgroundImage = `url('${BASE}eggs/stefan_eat.png')`; el.style.backgroundSize = `${9 * FW}px ${H}px`;
        el.style.backgroundPosition = `-${(Math.floor(now / 220) % 9) * FW}px 0`;   // gemütlich kauen
        if (now > eatUntil) { state = 'walk'; }
      }
      el.style.left = x + 'px';
      placeBubble(el, x + FW / 2, window.innerHeight - H - 4);
      requestAnimationFrame(frame);
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ended) return;
      clicks++;
      sfx('blip', 0.8);
      el.style.animation = 'hseggShake .25s'; setTimeout(() => (el.style.animation = ''), 260);
      if (clicks >= CLICKS) {
        pop(e.clientX, e.clientY, '+' + POINTS, '#7ed957'); sfx('coin', 1);
        bubble(el, 'Na gut, du hast mich.', 1600);
        toast('🥪 Stefan erwischt! +' + POINTS + ' Punkte');
        award('stefan'); ls.set('stefan', { found: true });
        state = 'walk'; speed = 260; eatUntil = 1;   // haut ab
        setTimeout(() => finish(true), 2600);
      } else {
        pop(e.clientX, e.clientY, clicks + '/' + CLICKS);
        bubble(el, HIT[clicks - 1] || 'Hey!', 1100);
        disturbed = true; state = 'walk'; eatUntil = eatUntil || 1; speed = 120 + clicks * 60;   // gestört: läuft weiter, wird schneller
      }
    });
    function finish(found) {
      if (ended) return; ended = true;
      el.remove(); if (el._bubble) el._bubble.remove();
      done(found);
    }
    requestAnimationFrame(frame);
  }

  // =====================================================================================
  // GOLDENE ENTE: taucht an einer Stelle auf, wippt, hüpft nach jedem Klick weiter
  // =====================================================================================
  function runDuck(done) {
    const D = Math.max(64, Math.min(104, window.innerHeight * 0.13));
    const el = document.createElement('div'); el.className = 'hsegg';
    el.style.width = D + 'px'; el.style.height = D + 'px';
    el.style.backgroundImage = `url('${BASE}eggs/duck.png')`; el.style.backgroundSize = `${9 * D}px ${D}px`;
    el.style.transition = 'left .35s cubic-bezier(.3,1.6,.6,1), top .35s cubic-bezier(.3,1.6,.6,1), opacity .4s';
    document.body.appendChild(el);
    let clicks = 0, ended = false;
    const spot = () => {
      const m = 12, w = window.innerWidth - D - m * 2, h = window.innerHeight - D - m * 2;
      // bevorzugt Ränder und Ecken - da sucht man nicht zuerst
      const edge = Math.floor(Math.random() * 4);
      let x = m + Math.random() * w, y = m + Math.random() * h;
      if (edge === 0) y = m + Math.random() * h * 0.15; else if (edge === 1) y = m + h * (0.85 + Math.random() * 0.15);
      else if (edge === 2) x = m + Math.random() * w * 0.12; else x = m + w * (0.88 + Math.random() * 0.12);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    spot();
    el.style.opacity = '0'; requestAnimationFrame(() => (el.style.opacity = '1'));
    const t0 = performance.now();
    let stayUntil = t0 + 9000;          // ohne Klick verschwindet sie nach 9 s
    function frame(now) {
      if (ended) return;
      el.style.backgroundPosition = `-${(Math.floor(now / 120) % 9) * D}px 0`;
      if (now > stayUntil) return finish(false);
      requestAnimationFrame(frame);
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ended) return;
      clicks++;
      sfx('blip', 1);
      if (clicks >= CLICKS) {
        pop(e.clientX, e.clientY, '+' + POINTS, '#7ed957'); sfx('coin', 1);
        toast('🦆 Goldene Ente gefunden! +' + POINTS + ' Punkte');
        award('duck'); ls.set('duck', { found: true });
        el.style.opacity = '0'; setTimeout(() => finish(true), 450);
      } else {
        pop(e.clientX, e.clientY, 'Quak! ' + clicks + '/' + CLICKS);
        spot(); stayUntil = performance.now() + 6000;    // hüpft weg
      }
    });
    function finish(found) { if (ended) return; ended = true; el.remove(); done(found); }
    requestAnimationFrame(frame);
  }

  // =====================================================================================
  // DER ADMIN: kommt, wenn Ruhe ist. Wegklicken wird bestraft.
  // =====================================================================================
  const ADMIN_PENALTY = 25;
  const QUIET_MS = 45000;                 // so lange keine Eingabe = "Ruhe"
  const ADMIN_COOLDOWN = [15, 30];        // Minuten bis zum nächsten möglichen Besuch
  const ADMIN_MAX_VISITS = [2, 3];        // pro Spieler und Abend höchstens 2-3 Besuche, damit er nicht nervt
  const ADM = { walk: 17, drink: 6, burp: 11, cheers: 11, dance: 9, facepalm: 13, button: 13, scratch: 13, type: 15, rage: 13, sleep: 15, uppercut: 7, flip: 6 };
  const ADM_ACTS = [
    ['drink', 'Ruhe hier? Dann trink ich halt eins.'], ['burp', 'Tschuldigung.'], ['cheers', 'Prost, ihr Schnarchnasen!'],
    ['dance', 'Keiner guckt? Perfekt.'], ['facepalm', 'Was ist DAS denn für eine Antwort?!'], ['button', 'Nächstes Spiel! … ach nee, noch nicht.'],
    ['scratch', 'Hm. Was wollte ich hier?'], ['type', 'Kurz mit Claude was basteln …'], ['rage', 'WARUM GEHT DAS NICHT?!'], ['sleep', 'Nur kurz die Augen zu …']
  ];
  let lastInput = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));

  async function penalize() {
    const me = await api('players/' + pid);
    if (!me || !me.name) return;
    await api('players/' + pid + '/score', { method: 'PUT', body: JSON.stringify((me.score || 0) - ADMIN_PENALTY) });
    await api('gameLog', { method: 'POST', body: JSON.stringify({ text: '👊 ' + me.name + ' wollte den Admin wegklicken: -' + ADMIN_PENALTY + ' Punkte', at: Date.now() }) });
  }

  function runAdmin(done) {
    const T = Math.round(Math.max(260, Math.min(420, window.innerHeight * 0.46)));   // Kachel (Figur ~40 % davon)
    const el = document.createElement('div'); el.className = 'hsegg';
    el.style.width = T + 'px'; el.style.height = T + 'px'; el.style.bottom = (-T * 0.07) + 'px';
    document.body.appendChild(el);
    const W = () => window.innerWidth;
    let anim = null, frame0 = 0, fps = 9, x = -T * 0.7, last = performance.now(), ended = false, hit = false;
    let phase = 'in', acts = [], actEnd = 0, flipX = false;
    const stopAt = W() * rnd(0.25, 0.55) - T / 2;
    const pool = ADM_ACTS.slice().sort(() => Math.random() - 0.5); acts = pool.slice(0, 2 + Math.floor(Math.random() * 2));
    function play(name, f, now) {
      anim = name; fps = f; frame0 = now;
      el.style.backgroundImage = `url('${BASE}eggs/admin_${name}.png')`; el.style.backgroundSize = `${ADM[name] * T}px ${T}px`;
    }
    function nextAct(now) {
      const a = acts.shift();
      if (!a) { phase = 'out'; play('walk', 11, now); return; }
      play(a[0], a[0] === 'sleep' || a[0] === 'type' ? 7 : 9, now);
      // jede Aktion läuft einmal durch (Schlafen/Tippen zweimal) plus kurze Pause
      const loops = (a[0] === 'sleep' || a[0] === 'type') ? 2 : 1;
      actEnd = now + (ADM[a[0]] / fps) * 1000 * loops + 500;
      bubble(el, a[1], 2600);
    }
    play('walk', 11, last);
    function tickF(now) {
      if (ended) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      let f = Math.floor((now - frame0) / 1000 * fps);
      const n = ADM[anim];
      if (phase === 'in') { x += 95 * dt; if (x >= stopAt) { phase = 'acts'; nextAct(now); } }
      else if (phase === 'acts') { if (now > actEnd) nextAct(now); }
      else if (phase === 'out') { x += 80 * dt; if (x > W() + 20) return finish(); }
      else if (phase === 'punch') { f = Math.min(f, n - 1); if (now > actEnd) { phase = 'flee'; play('flip', 10, now); actEnd = now + 600; } }
      else if (phase === 'flee') { x += 520 * dt; if (now > actEnd) play('walk', 22, now), actEnd = Infinity; if (x > W() + 20) return finish(); }
      el.style.backgroundPosition = `-${(f % n) * T}px 0`;
      el.style.transform = flipX ? 'scaleX(-1)' : '';
      el.style.left = x + 'px';
      placeBubble(el, x + T / 2, window.innerHeight - T * 0.62);
      requestAnimationFrame(tickF);
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ended || hit) return;
      hit = true;
      const now = performance.now();
      phase = 'punch'; play('uppercut', 11, now); actEnd = now + (ADM.uppercut / 11) * 1000 + 250;
      bubble(el, ['WEGKLICKEN?! Na warte!', 'Mich klickt man nicht weg!', 'Das gibt Abzug, Freundchen!'][Math.floor(Math.random() * 3)], 2400);
      sfx('drop', 1);
      setTimeout(() => {
        sfx('boom', 0.8);
        document.body.style.animation = 'hseggShake .35s';
        setTimeout(() => (document.body.style.animation = ''), 380);
        pop(e.clientX, e.clientY, '-' + ADMIN_PENALTY, '#ff2e93');
        toast('👊 Den Admin wegklicken? Kostet ' + ADMIN_PENALTY + ' Punkte!');
        penalize();
      }, 350);
    });
    function finish() {
      if (ended) return; ended = true;
      el.remove(); if (el._bubble) el._bubble.remove();
      done();
    }
    requestAnimationFrame(tickF);
  }

  let adminNextOk = Date.now() + 60000;     // frühestens 1 Minute nach dem Laden
  function adminTick() {
    if (busy || document.hidden) return;
    if (Date.now() < adminNextOk || Date.now() - lastInput < QUIET_MS) return;
    let quota = ls.get('admin');
    if (!quota) { quota = { max: ADMIN_MAX_VISITS[0] + Math.floor(Math.random() * (ADMIN_MAX_VISITS[1] - ADMIN_MAX_VISITS[0] + 1)), seen: 0 }; ls.set('admin', quota); }
    if (quota.seen >= quota.max) return;
    quota.seen++; ls.set('admin', quota);
    busy = true; style();
    runAdmin(() => { busy = false; adminNextOk = Date.now() + rnd(ADMIN_COOLDOWN[0], ADMIN_COOLDOWN[1]) * 60000; });
  }

  // =====================================================================================
  // ZEITPLAN: je Ei ein zufälliger Zeitpunkt pro Tag, gespeichert im Browser
  // =====================================================================================
  const RUN = { stefan: runStefan, duck: runDuck };
  let busy = false;
  function plan(egg) {
    let p = ls.get(egg);
    if (!p) { p = { at: Date.now() + rnd(FIRST_MIN, FIRST_MAX) * 60000 }; ls.set(egg, p); }
    return p;
  }
  function tick() {
    if (busy || document.hidden) return;
    for (const egg of Object.keys(RUN)) {
      const p = plan(egg);
      if (p.found || Date.now() < p.at) continue;
      busy = true; style();
      RUN[egg]((found) => {
        busy = false;
        if (!found) ls.set(egg, { at: Date.now() + rnd(RETRY_MIN, RETRY_MAX) * 60000 });
      });
      return;
    }
  }
  async function start() {
    // Admin/Host bekommt keine Eier
    const me = await api('players/' + pid);
    if (!me || !me.name || /Host|Admin/.test(me.name)) return;
    Object.keys(RUN).forEach(plan);
    setInterval(tick, 5000);
    setTimeout(tick, 1500);
    setInterval(adminTick, 3000);
  }
  // Zum Testen: HSEggs.show('stefan') / HSEggs.show('duck')
  window.HSEggs = { show: (egg) => { style(); (egg === 'admin' ? runAdmin : RUN[egg])(() => {}); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
