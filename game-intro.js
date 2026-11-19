/* =====================================================================================
   HIRNSCHMALZ-ARENA - Spiel-Intro mit Ladebalken
   -------------------------------------------------------------------------------------
   Einbinden:  <script src="game-intro.js"></script>   (im <head> jeder Spielseite)

   - Startet der Admin ein Spiel, sieht jeder Spieler beim Betreten der Seite einmal ein
     Intro: eigenes Bild (Vollbild), Spielname, Spruch - und unten ein Ladebalken, über
     den unsere Fighter-Figuren von links nach rechts laufen und dabei Zombies umhauen,
     auf Bananenschalen ausrutschen, tanzen usw. (jedes Mal etwas anders).
   - Bild, Titel und Spruch je Spiel stellt man im Fragen-Editor unter "Intros" ein.
     Gespeichert wird in Firebase unter introConfig/<seite>, z.B. introConfig/spiel1:
       { image: "https://... oder data:...", title: "", subtitle: "", fit: "cover"|"contain", off: false }
   - Nach einem Neuladen der Seite während des Spiels kommt das Intro nicht noch einmal.
   - Figuren: die Sprite-Streifen aus fighter/ (je Frame 200 x 170 Pixel).
   ===================================================================================== */
(function () {
  if (window.HSIntro) return;

  const DB_URL = 'https://play-ground-82b46-default-rtdb.firebaseio.com';
  const DURATION = 9000;           // Länge des Intros in ms (Snake/Goldregen warten so lange mit dem Start)
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : '';
  })();

  // Seiten mit Intro (Seitenname -> Standard-Titel)
  const GAMES = {
    spiel1: 'Spiel 1: Kreuzverhör',
    spiel2: 'Spiel 2: Rätselfeuer',
    spiel3: 'Spiel 3: Schaf oder Wolf?',
    spiel4: 'Spiel 4: Pi mal Daumen',
    spiel5: 'Spiel 5: Verpixelt!',
    spiel6: 'Spiel 6: Film-Zündschnur',
    spiel7: 'Spiel 7: Mythos-Check',
    spiel8: 'Spiel 8: Schriftzug-Salat',
    spiel9: 'Spiel 9: Zeitreise',
    spiel10: 'Spiel 10: Zeitreise 2',
    sekwars: 'Sekwars',
    snake: 'Snake',
    goldregen: 'Goldregen',
    'vier-gewinnt': 'Vier Gewinnt',
    panzer: 'Panzerschlacht',
    ochsvormberg: 'Ochs vorm Berg',
    bombtick: 'Bomb is ticking',
    fighter: 'Hirnschmalz-Fighter'
  };

  // Figuren (Dateipräfix in fighter/ + Spezialwurf aus dem Fighter-Spiel)
  const FIGHTERS = [
    { key: 'ccc', name: 'cCc', proj: 'wrench' },
    { key: 'soern', name: 'Sörn1989', proj: 'bottle' },
    { key: 'santax', name: 'Santax', proj: 'cowbell' },
    { key: 'holzkohle', name: 'Holzkohle', proj: 'fireball' },
    { key: 'breeki', name: 'breekibree', proj: 'mustache' },
    { key: 'sky', name: 'skywalker161', proj: 'laser' }
  ];
  const ANIMS = ['walk', 'punch', 'kick', 'sweep', 'special', 'jump', 'jkick', 'ko', 'win'];
  const FRAME_W = 200, FRAME_H = 170, FEET_Y = 158, FIG_H = 103; // Maße im Sprite-Frame

  const LOAD_LINES = [
    'Hirne werden vorgewärmt …', 'Schmalz wird nachgefüllt …', 'Zombies werden einsortiert …',
    'Fragen werden geschüttelt …', 'Punkte werden poliert …', 'Würfel werden gezinkt …',
    'Gehirnzellen werden gezählt …', 'Joker werden versteckt …', 'Schummelzettel werden eingesammelt …'
  ];
  const HIT_WORDS = ['BONK!', 'KLATSCH!', 'WUMMS!', 'ZACK!', 'PATSCH!', 'KAWUMM!', 'BÄM!'];
  const ZOMBIE_LINES = ['Hiiirn …', 'Schmaaalz …', 'Fraaagen …', 'Punkte …', 'Hirnschmaaalz …'];
  const DANCE_LINES = ['Läuft bei mir!', 'Hirnschmalz-Power!', 'Ich bin bereit!', 'Zu leicht!', 'Kommt nur her!'];
  const SLIP_LINES = ['Uff!', 'Wer war das?!', 'Mein Rücken …', 'Autsch!'];

  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sfx = (k, v) => { try { window.HSAudio && HSAudio.synth(k, v); } catch (e) {} };

  // ---------------------------------------------------------------------------------
  // Sprites laden (einmal, für alle Intros)
  // ---------------------------------------------------------------------------------
  let sprites = null;
  function loadSprites() {
    if (sprites) return sprites;
    sprites = {};
    FIGHTERS.forEach(f => {
      sprites[f.key] = {};
      ANIMS.forEach(a => {
        const img = new Image();
        img.src = BASE + 'fighter/' + f.key + '_' + a + '.png';
        sprites[f.key][a] = img;
      });
    });
    return sprites;
  }
  const framesOf = (img) => (img && img.complete && img.naturalWidth) ? Math.max(1, Math.floor(img.naturalWidth / FRAME_W)) : 0;

  // ---------------------------------------------------------------------------------
  // Pixel-Zombies (werden selbst gezeichnet, 22 x 32 Pixel, Blick nach links)
  // ---------------------------------------------------------------------------------
  const Z_W = 22, Z_H = 32;
  const Z_VARIANTS = [
    { skin: '#8fbf6a', skinD: '#5f8f46', hair: '#2b2b2b', shirt: '#6d4c8f', shirtD: '#4b3363', pants: '#3b4a6b', pantsD: '#28334a' },
    { skin: '#9ccf8a', skinD: '#6a9a5a', hair: '#5a3a1a', shirt: '#b5473a', shirtD: '#7f2f26', pants: '#4a4a4a', pantsD: '#2f2f2f' },
    { skin: '#7fb58a', skinD: '#55855f', hair: '#c9b27a', shirt: '#3a7ab5', shirtD: '#285580', pants: '#5a4632', pantsD: '#3b2e21' },
    { skin: '#a3c46b', skinD: '#738f44', hair: '#7a2a2a', shirt: '#d9d2bf', shirtD: '#a39d8c', pants: '#2d4a2d', pantsD: '#1d311d' }
  ];
  const zCache = {};
  function zombieSprite(vi, frame, part) {
    const k = vi + ':' + frame + ':' + (part || 'all');
    if (zCache[k]) return zCache[k];
    const v = Z_VARIANTS[vi];
    const c = document.createElement('canvas'); c.width = Z_W; c.height = Z_H;
    const g = c.getContext('2d');
    const bob = frame ? 1 : 0;           // Oberkörper wippt
    const shapes = [];
    const R = (x, y, w, h, col) => shapes.push([x, y, w, h, col]);
    const head = part !== 'body', body = part !== 'head';
    if (body) {
      // hinterer Arm, Beine, Füße
      R(3, 12 + bob, 7, 2, v.skinD);
      if (frame) { R(9, 21, 3, 8, v.pantsD); R(12, 21, 3, 8, v.pants); R(7, 28, 5, 2, '#222'); R(12, 28, 4, 2, '#222'); }
      else { R(7, 21, 3, 8, v.pants); R(13, 21, 3, 8, v.pantsD); R(5, 28, 5, 2, '#222'); R(13, 28, 5, 2, '#222'); }
      // Körper (zerrissenes Hemd)
      R(8, 10 + bob, 8, 11, v.shirt);
      R(14, 10 + bob, 2, 11, v.shirtD);
      // vorderer Arm nach vorne gestreckt
      R(7, 12 + bob, 4, 3, v.shirt);
      R(1, 12 + bob, 7, 2, v.skin);
      R(0, 12 + bob, 2, 3, v.skin);
    }
    if (head) {
      R(10, 9 + bob, 3, 2, v.skinD);             // Hals
      R(7, 1 + bob, 9, 8, v.skin);               // Kopf
      R(14, 1 + bob, 2, 8, v.skinD);
      R(8, 0 + bob, 8, 2, v.hair); R(13, 2 + bob, 3, 2, v.hair); R(15, 4 + bob, 1, 2, v.hair);
    }
    // 1. Durchgang: dunkle Umrandung, 2. Durchgang: Farben
    g.fillStyle = '#141414';
    shapes.forEach(([x, y, w, h]) => g.fillRect(x - 1, y - 1, w + 2, h + 2));
    shapes.forEach(([x, y, w, h, col]) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
    if (head) {
      g.fillStyle = '#fff'; g.fillRect(8, 3 + bob, 2, 2);
      g.fillStyle = '#d0101a'; g.fillRect(8, 4 + bob, 1, 1);
      g.fillStyle = '#5a0a0a'; g.fillRect(7, 6 + bob, 4, 1);
      g.fillStyle = '#fff'; g.fillRect(9, 6 + bob, 1, 1);
      g.fillStyle = '#8a1010'; g.fillRect(12, 2 + bob, 1, 2);   // Wunde
    }
    if (body) {
      g.fillStyle = '#8a1010'; g.fillRect(11, 13 + bob, 2, 2); g.fillRect(9, 17 + bob, 1, 2);
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(9, 20, 1, 1); g.clearRect(12, 20, 2, 1);
    }
    zCache[k] = c;
    return c;
  }

  // ---------------------------------------------------------------------------------
  // Overlay / DOM
  // ---------------------------------------------------------------------------------
  function injectStyle() {
    if (document.getElementById('hsintro-style')) return;
    const st = document.createElement('style');
    st.id = 'hsintro-style';
    st.textContent = `
      #hsintro { position: fixed; inset: 0; z-index: 2147483000; background: #12081f; overflow: hidden;
        font-family: 'Baloo 2', 'Inter', system-ui, sans-serif; color: #fff; opacity: 1; transition: opacity .55s ease; user-select: none; }
      #hsintro.hsi-out { opacity: 0; pointer-events: none; }
      #hsintro .hsi-bg { position: absolute; inset: -2%; background-position: center; background-repeat: no-repeat; background-size: cover; }
      #hsintro .hsi-bg.hsi-zoom { animation: hsiZoom ${DURATION}ms ease-out forwards; }
      #hsintro .hsi-blur { position: absolute; inset: -6%; background-position: center; background-size: cover; filter: blur(22px) brightness(.55); }
      #hsintro .hsi-fallback { position: absolute; inset: 0; background: linear-gradient(120deg, #2b0f54, #7017c9, #ff2e93, #ff8a3d); background-size: 300% 300%; animation: hsiGrad 9s ease infinite; }
      #hsintro .hsi-shade { position: absolute; inset: 0; background:
        linear-gradient(to bottom, rgba(10,4,20,.65) 0%, rgba(10,4,20,0) 34%, rgba(10,4,20,0) 58%, rgba(10,4,20,.82) 100%); }
      #hsintro canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
      #hsintro .hsi-head { position: absolute; left: 0; right: 0; top: max(6%, 54px); text-align: center; padding: 0 5%; }
      #hsintro .hsi-title { font-weight: 800; line-height: 1.02; font-size: clamp(30px, 7vw, 86px);
        text-shadow: 4px 4px 0 #1a1a2e, -2px -2px 0 #1a1a2e, 2px -2px 0 #1a1a2e, -2px 2px 0 #1a1a2e, 0 0 26px rgba(255,46,147,.55);
        animation: hsiPop .7s cubic-bezier(.34,1.56,.64,1) both; }
      #hsintro .hsi-sub { margin-top: .35em; font-weight: 700; font-size: clamp(15px, 2.6vw, 28px); color: #ffd23f;
        text-shadow: 2px 2px 0 #1a1a2e, -1px -1px 0 #1a1a2e, 1px -1px 0 #1a1a2e, -1px 1px 0 #1a1a2e; animation: hsiPop .7s .35s cubic-bezier(.34,1.56,.64,1) both; }
      #hsintro .hsi-skip { position: absolute; top: 12px; right: 12px; background: rgba(26,26,46,.75); color: #fff; border: 2px solid rgba(255,255,255,.6);
        border-radius: 999px; padding: 6px 14px; font: 700 13px 'Baloo 2', system-ui, sans-serif; cursor: pointer; z-index: 2; }
      #hsintro .hsi-skip:hover { background: #ff2e93; }
      @keyframes hsiZoom { from { transform: scale(1); } to { transform: scale(1.08); } }
      @keyframes hsiGrad { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      @keyframes hsiPop { from { transform: scale(.4) rotate(-4deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
    `;
    document.head.appendChild(st);
  }

  let cover = null;
  function showCover() {
    if (cover || !document.body) return;
    injectStyle();
    cover = document.createElement('div');
    cover.id = 'hsintro';
    document.body.appendChild(cover);
  }
  function dropCover() {
    if (!cover) return;
    const c = cover; cover = null;
    c.classList.add('hsi-out');
    setTimeout(() => c.remove(), 600);
  }

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  // ---------------------------------------------------------------------------------
  // Intro abspielen
  // ---------------------------------------------------------------------------------
  let running = null;
  function play(cfg) {
    cfg = cfg || {};
    if (running) running.stop(true);
    injectStyle();
    loadSprites();
    const root = cover || document.createElement('div');
    cover = null;
    root.id = 'hsintro';
    root.classList.remove('hsi-out');
    const title = cfg.title || GAMES[cfg.page] || (document.title || '').replace(/^Hirnschmalz-Arena\s*-\s*/, '');
    const img = cfg.image || '';
    const fit = cfg.fit === 'contain' ? 'contain' : 'cover';
    root.innerHTML = `
      ${img ? (fit === 'contain' ? `<div class="hsi-blur" style="background-image:url('${esc(img)}')"></div>` : '')
            + `<div class="hsi-bg hsi-zoom" style="background-image:url('${esc(img)}');background-size:${fit}"></div>`
            : '<div class="hsi-fallback"></div>'}
      <div class="hsi-shade"></div>
      <canvas></canvas>
      <div class="hsi-head"><div class="hsi-title">${esc(title)}</div>${cfg.subtitle ? `<div class="hsi-sub">${esc(cfg.subtitle)}</div>` : ''}</div>
      <button type="button" class="hsi-skip">Überspringen ▸</button>`;
    if (!root.parentNode) document.body.appendChild(root);

    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = 1, FH = 100, GY = 0, S = 1, U = 1, gap = 60, speed = 100;
    function layout() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = root.clientWidth || window.innerWidth; H = root.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      FH = clamp(Math.min(H * 0.19, W * 0.21), 66, 190);   // Figurenhöhe in px
      GY = H - Math.max(46, FH * 0.42);                    // Bodenlinie (Füße)
      S = FH / FIG_H;                                      // Sprite-Skalierung
      U = FH * 0.95 / 31;                                  // Zombie-Pixelgröße
      gap = FH * 0.62;
      speed = (W + FIGHTERS.length * gap + FH) / (DURATION * 0.97 / 1000);
    }
    layout();
    window.addEventListener('resize', layout);

    // ---- Spielfiguren ----
    const order = FIGHTERS.slice().sort(() => Math.random() - 0.5);
    const heroes = order.map((f, i) => ({
      f, x: -FH * 0.5 - i * gap, y: 0, state: 'walk', anim: 'walk', t0: 0, dur: 0, at: 0, rev: false,
      hitDone: false, target: null, rolled: new Set(), bubble: null
    }));
    // ---- Zombies ----
    const zCount = W < 700 ? 4 : 5;
    const zombies = [];
    for (let i = 0; i < zCount; i++) {
      zombies.push({ x: W * (0.38 + i * (0.95 / zCount)) + rnd(-FH * 0.3, FH * 0.3), y: 0, vi: Math.floor(Math.random() * Z_VARIANTS.length),
        state: 'walk', claimed: null, rot: 0, vx: 0, vy: 0, vr: 0, alpha: 1, ph: Math.random() * 6, bubble: null, jumped: new Set() });
    }
    const zSpeed = () => FH * 0.32;
    function spawnZombie() {
      zombies.push({ x: W + FH * rnd(0.5, 1.2), y: 0, vi: Math.floor(Math.random() * Z_VARIANTS.length),
        state: 'walk', claimed: null, rot: 0, vx: 0, vy: 0, vr: 0, alpha: 1, ph: Math.random() * 6, bubble: null, jumped: new Set() });
    }
    let nextSpawn = rnd(1800, 2600);
    // ---- Effekte ----
    const parts = [], splats = [], words = [], projs = [];
    const gags = {
      banana: Math.random() < 0.6 ? { x: W * rnd(0.3, 0.6), used: false, fly: null } : null,
      dance: Math.random() < 0.65 ? { at: rnd(0.28, 0.55) * DURATION, done: false } : null,
      stuck: Math.random() < 0.55,
      zombieTalk: rnd(0.15, 0.4) * DURATION
    };
    let loadLine = pick(LOAD_LINES), loadLineAt = 0, barShake = 0, barKicked = false;

    function say(who, text, ms) { who.bubble = { text, until: now + (ms || 1300) }; }
    function word(x, y, text, color) { words.push({ x, y, text, color: color || '#ffd23f', t: 0, rot: rnd(-0.25, 0.25) }); }
    function blood(x, y, n, dir) {
      for (let i = 0; i < n; i++) parts.push({ x, y, vx: (dir || 1) * rnd(0.2, 1) * FH * 3 + rnd(-1, 1) * FH, vy: -rnd(0.5, 1.6) * FH * 2.4,
        s: rnd(0.035, 0.07) * FH, c: Math.random() < 0.7 ? '#b3001b' : '#e0182d', life: rnd(0.7, 1.3), splat: true });
    }
    function gore(x, y, vi, n) {
      const v = Z_VARIANTS[vi];
      for (let i = 0; i < n; i++) parts.push({ x: x + rnd(-0.2, 0.2) * FH, y: y - rnd(0.1, 0.8) * FH, vx: rnd(-1, 1) * FH * 3, vy: -rnd(0.6, 1.8) * FH * 2.6,
        s: rnd(0.05, 0.11) * FH, c: pick([v.skin, v.skinD, v.shirt, '#b3001b', '#b3001b', v.pants]), life: rnd(0.8, 1.4), splat: Math.random() < 0.4 });
    }
    function killZombie(z, how, dir) {
      if (z.state !== 'walk' && z.state !== 'grab') return false;
      z.claimed = null;
      const zx = z.x, zy = GY - FH * 0.55;
      sfx('boom', 0.7);
      word(zx, GY - FH * 1.35, pick(HIT_WORDS));
      if (how === 'burst') { gore(zx, GY, z.vi, 26); blood(zx, zy, 14, dir); z.state = 'gone'; return true; }
      blood(zx, zy, 12, dir);
      if (how === 'head') {      // Kopf fliegt weg, Körper kippt um
        parts.push({ x: zx, y: GY - FH * 0.8, vx: FH * rnd(2.5, 3.5), vy: -FH * rnd(3.5, 4.5), s: 0, head: z.vi, rot: 0, vr: rnd(8, 14), life: 2, bounce: 1 });
        z.headless = true; z.state = 'fall'; z.vr = 3.2; z.vx = FH * 0.3; z.vy = 0; return true;
      }
      if (how === 'sweep') { z.state = 'fly'; z.vx = FH * 0.8; z.vy = -FH * 3.2; z.vr = 6; return true; }
      z.state = 'fly'; z.vx = FH * rnd(3, 4.5) * (dir || 1); z.vy = -FH * rnd(3, 4.2); z.vr = rnd(7, 12) * (dir || 1); return true;
    }

    // Aktionen der Figuren
    const ACT = {
      punch: { anim: 'punch', dur: 420, peak: 0.55, reach: 0.55, how: 'fly' },
      kick: { anim: 'kick', dur: 520, peak: 0.6, reach: 0.68, how: 'head' },
      sweep: { anim: 'sweep', dur: 560, peak: 0.55, reach: 0.68, how: 'sweep' },
      jkick: { anim: 'jkick', dur: 640, peak: 0.6, reach: 0.95, how: 'fly', air: 0.75, move: 1.5 },
      special: { anim: 'special', dur: 760, peak: 0.72, reach: 99, how: 'proj' },
      jump: { anim: 'jump', dur: 680, air: 1.0, move: 2.3 }
    };
    function startAct(h, kind, z) {
      const a = ACT[kind];
      h.state = kind; h.anim = a.anim; h.t0 = now; h.dur = a.dur; h.hitDone = false; h.target = z || null; h.rev = false;
      if (kind === 'jump') { sfx('blip', 0.6); if (Math.random() < 0.5) say(h, pick(['Hopp!', 'Tschüss!', 'Nö.']), 900); }
    }

    let now = 0, startAt = 0, raf = 0, ended = false, last = 0;
    function lead() { return heroes.reduce((m, h) => (h.x > m.x ? h : m), heroes[0]); }

    function update(dt) {
      const t = now;
      // Ladebalken-Text wechseln
      if (t - loadLineAt > 1700) { loadLineAt = t; loadLine = pick(LOAD_LINES); }

      // Nachschub von rechts
      if (t > nextSpawn && t < DURATION * 0.72) { spawnZombie(); if (Math.random() < 0.3) spawnZombie(); nextSpawn = t + rnd(1100, 1900); }

      // Zombie sagt etwas
      if (gags.zombieTalk && t > gags.zombieTalk) {
        const z = zombies.find(z => z.state === 'walk' && z.x < W * 0.95 && z.x > W * 0.2);
        if (z) say(z, pick(ZOMBIE_LINES), 1500);
        gags.zombieTalk = Math.random() < 0.6 ? t + rnd(1800, 2800) : 0;
      }

      // Tanz-Gag
      if (gags.dance && !gags.dance.done && t > gags.dance.at) {
        const cands = heroes.filter(h => h.state === 'walk' && h.x > FH && h.x < W - FH && h !== lead());
        if (cands.length) { const h = pick(cands); h.state = 'dance'; h.anim = 'win'; h.t0 = t; h.dur = 1400; say(h, pick(DANCE_LINES), 1400); gags.dance.done = true; }
      }

      heroes.forEach(h => {
        const el = t - h.t0, p = h.dur ? clamp(el / h.dur, 0, 1) : 0;
        if (h.state === 'walk') {
          h.anim = 'walk'; h.y = 0;
          h.x += speed * dt;
          // Bananenschale
          const b = gags.banana;
          if (b && !b.used && Math.abs(h.x - b.x) < FH * 0.12) {
            b.used = true; b.fly = { x: b.x, y: GY, vx: FH * 2.5, vy: -FH * 3, r: 0 };
            h.state = 'slip'; h.anim = 'ko'; h.t0 = t; h.dur = 1700; sfx('drop', 1); say(h, pick(SLIP_LINES), 1500);
            return;
          }
          // Zombies vor mir?
          let best = null, bd = 1e9;
          zombies.forEach(z => {
            if (z.state !== 'walk' && z.state !== 'grab') return;
            if (z.claimed && z.claimed !== h) return;
            if (z.jumped.has(h)) return;
            const d = z.x - h.x;
            if (d > -FH * 0.1 && d < bd) { bd = d; best = z; }
          });
          if (best) {
            // aus der Ferne: Spezialwurf
            if (bd < FH * 2.6 && bd > FH * 1.4 && !h.rolled.has(best) && !best.claimed) {
              h.rolled.add(best);
              if (Math.random() < 0.22) { best.claimed = h; startAct(h, 'special', best); return; }
            }
            if (bd < FH * 0.62) {
              best.claimed = h;
              const r = Math.random();
              const kind = r < 0.28 ? 'punch' : r < 0.53 ? 'kick' : r < 0.68 ? 'sweep' : r < 0.84 ? 'jkick' : 'jump';
              if (kind === 'jump') { best.claimed = null; best.jumped.add(h); }
              startAct(h, kind, best);
            }
          }
        } else if (ACT[h.state]) {
          const a = ACT[h.state];
          if (a.move) h.x += speed * a.move * dt * 0.7;
          h.y = a.air ? Math.sin(p * Math.PI) * FH * 0.85 * a.air : 0;
          if (!h.hitDone && a.peak && p >= a.peak) {
            h.hitDone = true;
            if (a.how === 'proj') {
              projs.push({ type: h.f.proj, x: h.x + FH * 0.35, y: GY - FH * 0.62, vx: FH * 6.5, r: 0, from: h });
              sfx('shot', 0.8);
            } else if (h.target && Math.abs(h.target.x - h.x) < FH * (a.reach + 0.35)) {
              killZombie(h.target, a.how, 1);
            } else if (h.target) { h.target.claimed = null; }
          }
          if (p >= 1) { if (h.target && h.target.claimed === h) h.target.claimed = null; h.state = 'walk'; h.target = null; h.y = 0; }
        } else if (h.state === 'slip') {
          if (el > h.dur) { h.state = 'walk'; h.rev = false; }
        } else if (h.state === 'dance') {
          if (el > h.dur) h.state = 'walk';
        }
      });

      // Zombies
      zombies.forEach(z => {
        if (z.state === 'walk' || z.state === 'grab') {
          const h = z.claimed;
          const near = h && Math.abs(z.x - h.x) < FH * 0.75;
          z.state = near ? 'grab' : 'walk';
          if (!near) z.x -= zSpeed() * dt;
          z.ph += dt * 5;
          if (z.x < -FH * 2) z.state = 'gone';
        } else if (z.state === 'fly' || z.state === 'fall') {
          z.x += z.vx * dt; z.vy += FH * 12 * dt; z.y += z.vy * dt; z.rot += z.vr * dt;
          if (z.state === 'fall') { z.rot = Math.min(z.rot, Math.PI / 2); z.y = 0; if (z.rot >= Math.PI / 2) z.state = 'dead'; }
          else if (z.y >= 0 && z.vy > 0) { z.y = 0; z.state = 'dead'; z.rot = Math.PI / 2 * (z.vx >= 0 ? 1 : -1); splats.push({ x: z.x, r: FH * 0.28, a: 0.8 }); }
        } else if (z.state === 'dead') {
          z.alpha -= dt * 0.6; if (z.alpha <= 0) z.state = 'gone';
        }
      });

      // Projektile
      projs.forEach(p => {
        p.x += p.vx * dt; p.r += dt * 14;
        const z = zombies.find(z => (z.state === 'walk' || z.state === 'grab') && Math.abs(z.x - p.x) < FH * 0.3);
        if (z) { killZombie(z, 'burst', 1); p.dead = true; if (p.from.target === z) p.from.target = null; }
        if (p.x > W + FH) p.dead = true;
      });
      for (let i = projs.length - 1; i >= 0; i--) if (projs[i].dead) projs.splice(i, 1);

      // Partikel
      parts.forEach(q => {
        q.vy += FH * 11 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
        if (q.head != null) q.rot += q.vr * dt;
        if (q.y > GY) {
          if (q.head != null && q.bounce > 0) { q.y = GY; q.vy *= -0.45; q.vx *= 0.6; q.vr *= 0.6; q.bounce--; }
          else { if (q.splat) splats.push({ x: q.x, r: q.s * 1.6, a: 0.7 }); q.life = 0; }
        }
      });
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      splats.forEach(s => s.a -= dt * 0.12);
      for (let i = splats.length - 1; i >= 0; i--) if (splats[i].a <= 0) splats.splice(i, 1);
      words.forEach(w => w.t += dt);
      for (let i = words.length - 1; i >= 0; i--) if (words[i].t > 0.9) words.splice(i, 1);
      if (gags.banana && gags.banana.fly) { const f = gags.banana.fly; f.vy += FH * 10 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += dt * 12; if (f.y > H + 50) gags.banana = null; }
      barShake = Math.max(0, barShake - dt * 3);
    }

    // Fortschritt des Ladebalkens (0..1)
    function progress() {
      const r = now / DURATION;
      if (gags.stuck) {
        if (r < 0.9) return Math.min(0.99, r / 0.8);
        if (!barKicked) {
          barKicked = true; barShake = 1; sfx('boom', 1);
          const vis = heroes.filter(h => h.state === 'walk' && h.x > FH * 0.3 && h.x < W - FH * 0.3);
          if (vis.length) { const h = vis.reduce((m, h) => (h.x > m.x ? h : m)); startAct(h, 'kick', null); say(h, pick(['Na also!', 'Geht doch!', 'Technik!']), 1200); }
          word(W * 0.9, GY - FH * 0.2, 'BONK!');
        }
        return 1;
      }
      return Math.min(1, r / 0.93);
    }

    // ------------------------------- Zeichnen ---------------------------------------
    function drawHero(h) {
      const imgs = sprites[h.f.key];
      let img = imgs[h.anim];
      let n = framesOf(img);
      if (!n) { img = imgs.walk; n = framesOf(img); if (!n) return; }
      const el = now - h.t0;
      let fi;
      if (h.state === 'walk') fi = Math.floor(now / 1000 * clamp(speed / FH * 5.5, 10, 20)) % n;
      else if (h.state === 'dance') fi = Math.floor(el / 1000 * 10) % n;
      else if (h.state === 'slip') {
        // hinfallen (0,55 s) - liegen bleiben - wieder aufstehen (rückwärts)
        const down = 550, lie = 650, up = h.dur - down - lie;
        const p = el < down ? el / down : el < down + lie ? 1 : 1 - (el - down - lie) / up;
        fi = Math.round(clamp(p, 0, 1) * (n - 1));
      } else fi = Math.min(n - 1, Math.floor(clamp(el / h.dur, 0, 1) * n));
      const dw = FRAME_W * S, dh = FRAME_H * S;
      const x = h.x - dw / 2, y = GY - h.y - FEET_Y * S;
      // Schatten
      ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - Math.min(0.25, h.y / FH * 0.3)) + ')';
      ctx.beginPath(); ctx.ellipse(h.x, GY + 2, FH * 0.24, FH * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(img, fi * FRAME_W, 0, FRAME_W, FRAME_H, x, y, dw, dh);
    }
    function drawZombie(z) {
      const frame = z.state === 'walk' ? (Math.floor(z.ph) % 2) : (z.state === 'grab' ? Math.floor(now / 160) % 2 : 0);
      const spr = zombieSprite(z.vi, frame, z.headless ? 'body' : 'all');
      const w = Z_W * U, h = Z_H * U;
      ctx.save();
      ctx.globalAlpha = Math.max(0, z.alpha);
      if (z.state === 'walk' || z.state === 'grab') {
        ctx.fillStyle = 'rgba(0,0,0,.33)';
        ctx.beginPath(); ctx.ellipse(z.x, GY + 2, FH * 0.22, FH * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.translate(z.x, GY + z.y - (z.state === 'dead' ? 9 : 15) * U);
      ctx.rotate(z.rot);
      if (z.state === 'grab') ctx.rotate(Math.sin(now / 90) * 0.05);
      ctx.drawImage(spr, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    function drawProj(p) {
      ctx.save(); ctx.translate(p.x, p.y);
      const s = FH * 0.12;
      if (p.type === 'laser') {
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 14; ctx.fillStyle = '#bff0ff'; ctx.fillRect(-s * 2.5, -s * 0.18, s * 5, s * 0.36);
      } else if (p.type === 'fireball') {
        ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 22; ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(s * 0.2, 0, s * 0.45, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.rotate(p.r);
        if (p.type === 'wrench') { ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-s * 1.2, -s * 0.18, s * 2.4, s * 0.36); ctx.fillRect(s * 0.9, -s * 0.5, s * 0.4, s); }
        else if (p.type === 'bottle') { ctx.fillStyle = '#6b3a12'; ctx.fillRect(-s * 0.9, -s * 0.35, s * 1.4, s * 0.7); ctx.fillRect(s * 0.5, -s * 0.15, s * 0.6, s * 0.3); }
        else if (p.type === 'cowbell') { ctx.fillStyle = '#e8b923'; ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.7); ctx.lineTo(s * 0.5, -s * 0.7); ctx.lineTo(s * 0.8, s * 0.6); ctx.lineTo(-s * 0.8, s * 0.6); ctx.closePath(); ctx.fill(); }
        else if (p.type === 'mustache') { ctx.fillStyle = '#3b2412'; ctx.beginPath(); ctx.ellipse(-s * 0.55, 0, s * 0.65, s * 0.25, 0.3, 0, Math.PI * 2); ctx.ellipse(s * 0.55, 0, s * 0.65, s * 0.25, -0.3, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillStyle = '#ff2e93'; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
    function bubble(x, y, text) {
      const fs = clamp(FH * 0.17, 12, 24);
      ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`;
      const tw = ctx.measureText(text).width, pw = tw + fs * 1.1, ph = fs * 1.7;
      const bx = clamp(x - pw / 2, 6, W - pw - 6), by = y - ph - fs * 0.6;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = Math.max(2, fs * 0.14);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, pw, ph, ph / 2); else ctx.rect(bx, by, pw, ph);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - fs * 0.3, by + ph - 1); ctx.lineTo(x, by + ph + fs * 0.55); ctx.lineTo(x + fs * 0.25, by + ph - 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - fs * 0.3, by + ph); ctx.lineTo(x, by + ph + fs * 0.55); ctx.lineTo(x + fs * 0.25, by + ph); ctx.stroke();
      ctx.fillStyle = '#1a1a2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + pw / 2, by + ph / 2 + 1);
    }
    function drawBar(p) {
      const mx = W * 0.05, bw = W - mx * 2, bh = clamp(FH * 0.13, 12, 22);
      const by = GY + Math.max(10, FH * 0.1);
      const sx = barShake ? Math.sin(now / 18) * barShake * 8 : 0;
      ctx.save(); ctx.translate(sx, 0);
      ctx.fillStyle = 'rgba(26,26,46,.85)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(mx, by, bw, bh, bh / 2); else ctx.rect(mx, by, bw, bh); ctx.fill(); ctx.stroke();
      if (p > 0) {
        const gr = ctx.createLinearGradient(mx, 0, mx + bw, 0);
        gr.addColorStop(0, '#7ed957'); gr.addColorStop(0.5, '#ffd23f'); gr.addColorStop(1, '#ff2e93');
        ctx.fillStyle = gr;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(mx + 3, by + 3, Math.max(bh - 6, (bw - 6) * p), bh - 6, (bh - 6) / 2); else ctx.rect(mx + 3, by + 3, (bw - 6) * p, bh - 6); ctx.fill();
        // Streifen
        ctx.save(); ctx.beginPath(); ctx.rect(mx + 3, by + 3, (bw - 6) * p, bh - 6); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        for (let i = -1; i < bw / 18 + 1; i++) { const ox = mx + i * 18 + (now / 25) % 18; ctx.beginPath(); ctx.moveTo(ox, by + bh); ctx.lineTo(ox + 9, by + bh); ctx.lineTo(ox + 18, by); ctx.lineTo(ox + 9, by); ctx.fill(); }
        ctx.restore();
      }
      const fs = clamp(FH * 0.14, 11, 18);
      ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`; ctx.textBaseline = 'top';
      const pct = Math.floor(p * 100);
      const label = p >= 1 ? "LOS GEHT'S!" : (gags.stuck && pct >= 99 ? '99 % … klemmt' : pct + ' %');
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.fillText(p >= 1 ? '' : loadLine, mx + 4, by + bh + 4);
      ctx.textAlign = 'right'; ctx.fillStyle = p >= 1 ? '#7ed957' : '#ffd23f';
      ctx.fillText(label, mx + bw - 4, by + bh + 4);
      ctx.restore();
    }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      // Blutflecken auf dem Boden
      splats.forEach(s => { ctx.fillStyle = 'rgba(150,0,20,' + Math.max(0, s.a) + ')'; ctx.beginPath(); ctx.ellipse(s.x, GY + 3, s.r, s.r * 0.28, 0, 0, Math.PI * 2); ctx.fill(); });
      // Bananenschale
      const b = gags.banana;
      if (b) {
        const bx = b.fly ? b.fly.x : b.x, byy = b.fly ? b.fly.y : GY;
        ctx.save(); ctx.translate(bx, byy - FH * 0.04); ctx.rotate(b.fly ? b.fly.r : 0);
        const s = FH * 0.09; ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-s * 0.9, -s * 0.3, s * 0.8, s * 0.3, -0.7, 0, Math.PI * 2); ctx.ellipse(s * 0.9, -s * 0.3, s * 0.8, s * 0.3, 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-s * 0.15, -s * 0.6, s * 0.3, s * 0.4);
        ctx.restore();
      }
      zombies.forEach(z => { if (z.state !== 'gone') drawZombie(z); });
      heroes.slice().sort((a, c) => a.x - c.x).forEach(drawHero);
      projs.forEach(drawProj);
      // Partikel (Blut, Zombie-Stücke, fliegende Köpfe)
      parts.forEach(q => {
        if (q.head != null) {
          const spr = zombieSprite(q.head, 0, 'head');
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.drawImage(spr, -11.5 * U, -5 * U, Z_W * U, Z_H * U); // nur der Kopf ist gefüllt, Mitte ca. (11.5|5)
          ctx.restore();
        } else { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      });
      drawBar(progress());
      // Sprechblasen
      heroes.forEach(h => { if (h.bubble && now < h.bubble.until) bubble(h.x, GY - h.y - FH * 1.08, h.bubble.text); });
      zombies.forEach(z => { if (z.bubble && now < z.bubble.until && (z.state === 'walk' || z.state === 'grab')) bubble(z.x, GY - FH * 1.05, z.bubble.text); });
      // Comic-Wörter
      words.forEach(w => {
        const k = Math.min(1, w.t / 0.12), fs = clamp(FH * 0.32, 20, 54) * (0.6 + 0.6 * k);
        ctx.save(); ctx.globalAlpha = 1 - Math.max(0, (w.t - 0.55) / 0.35);
        ctx.translate(w.x, w.y - w.t * FH * 0.4); ctx.rotate(w.rot);
        ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#1a1a2e'; ctx.lineJoin = 'round'; ctx.strokeText(w.text, 0, 0);
        ctx.fillStyle = w.color; ctx.fillText(w.text, 0, 0);
        ctx.restore();
      });
    }

    function frame(ts) {
      if (ended) return;
      if (!startAt) { startAt = ts; last = ts; }
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      now = ts - startAt;
      update(dt);
      draw();
      if (now >= DURATION) { finish(false); return; }
      raf = requestAnimationFrame(frame);
    }

    function finish(instant) {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      if (!instant) sfx('coin', 0.8);
      root.classList.add('hsi-out');
      setTimeout(() => { root.remove(); }, instant ? 0 : 600);
      running = null;
      try { window.dispatchEvent(new CustomEvent('hsintro:done', { detail: { page: cfg.page } })); } catch (e) {}
    }
    root.querySelector('.hsi-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(false); });

    running = { stop: finish };
    raf = requestAnimationFrame(frame);
    return running;
  }

  // ---------------------------------------------------------------------------------
  // Konfiguration aus Firebase holen
  // ---------------------------------------------------------------------------------
  function fetchJson(path) {
    return fetch(DB_URL + '/' + path + '.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
  }
  function getConfig(p) {
    return fetchJson('introConfig/' + encodeURIComponent(p)).then(c => c || {});
  }

  // Für den Editor: Vorschau eines Intros
  function preview(p, override) {
    return getConfig(p).then(c => play(Object.assign({ page: p }, c, override || {})));
  }

  // Automatischer Start auf Spielseiten
  function auto() {
    if (!GAMES[page]) return;
    showCover();
    Promise.all([fetchJson('gameState'), getConfig(page)]).then(([gs, c]) => {
      const st = gs && gs.startTime;
      const isThis = gs && gs.status === 'in_game' && String(gs.activeGame || '').replace(/\.html?$/, '') === page;
      const fresh = st && (Date.now() - st) < 3 * 60 * 1000;
      const key = 'hsintro:' + page;
      let seen = null; try { seen = sessionStorage.getItem(key); } catch (e) {}
      if (!isThis || !fresh || c.off || String(seen) === String(st)) { dropCover(); return; }
      try { sessionStorage.setItem(key, String(st)); } catch (e) {}
      play(Object.assign({ page }, c));
    }).catch(dropCover);
  }

  window.HSIntro = { GAMES, DURATION, play, preview, getConfig };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto, { once: true });
  else auto();
})();
