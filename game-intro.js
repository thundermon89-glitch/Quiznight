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
    snake: 'Snake',
    goldregen: 'Goldregen',
    'vier-gewinnt': 'Vier Gewinnt',
    panzer: 'Panzerschlacht',
    ochsvormberg: 'Ochs vorm Berg',
    burstpipe: 'Burst Pipe',
    'ccc-rechner': 'CCC Rechner',
    fighter: 'Hirnschmalz-Fighter'
  };

  // Standard-Hintergründe im Repo (intros/<seite>.jpg) - gelten, solange im Editor kein eigenes Bild gesetzt ist
  const DEFAULT_IMAGES = ['spiel1', 'spiel2', 'spiel3', 'spiel4', 'spiel5', 'spiel6', 'spiel7', 'spiel8', 'spiel9', 'spiel10',
    'snake', 'goldregen', 'vier-gewinnt', 'panzer', 'ochsvormberg', 'ccc-rechner', 'burstpipe', 'fighter'];
  const defaultImage = (p) => DEFAULT_IMAGES.includes(p) ? BASE + 'intros/' + p + '.jpg' : '';

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
  // Eigene Gegenstände (props/<name>.png) - fehlt eine Datei, wird die Form selbst gezeichnet
  const PROP_NAMES = ['banana', 'zombie_head', 'wrench', 'bottle', 'cowbell', 'fireball', 'mustache', 'shell',
    // Intro-Gags (fehlt eine Datei, zeichnet der Code eine einfache Ersatzform)
    'tank', 'sheep', 'clapperboard', 'portal', 'traffic_red', 'traffic_green', 'old_pc', 'coin', 'disc_red', 'disc_yellow'];
  let props = null;
  function loadProps() {
    if (props) return props;
    props = {};
    PROP_NAMES.forEach(n => { const img = new Image(); img.src = BASE + 'props/' + n + '.png'; props[n] = img; });
    return props;
  }
  const propReady = (n) => { const i = props && props[n]; return i && i.complete && i.naturalWidth ? i : null; };
  // Bild mittig zeichnen, Breite w (Höhe nach Seitenverhältnis)
  function drawPropBottom(ctx, img, x, bottom, w) { const h = w * img.naturalHeight / img.naturalWidth; ctx.drawImage(img, x - w / 2, bottom - h, w, h); return h; }
  function drawPropImg(ctx, img, w) { const h = w * img.naturalHeight / img.naturalWidth; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
  // Zombie-Sprites aus PixelLab (zombies/basis_<anim>.png, Frames je 172 x 172, Blick nach links)
  // Fehlen sie, werden die kleinen Pixel-Zombies selbst gezeichnet.
  const ZF = 172, Z_FOOT = 148, Z_FIG = 123, Z_CX = 86;
  const Z_DEFBOX = { x: 40, y: 25, w: 90, h: 123, head: { x0: 50, x1: 105, y0: 25, y1: 62 }, hand: { x: 22, y: 85 } };
  // Zombie-Typen: Grund-Zombie, Zombie-Frau, dicke Zombie-Frau (zombies/<typ>_<anim>.png)
  const ZCHARS = {
    basis: ['walk', 'grab', 'talk', 'hit', 'fly', 'ko', 'burn', 'eat', 'run'],
    frau: ['walk', 'run', 'getup'],
    dicke: ['walk', 'getup', 'ko', 'hit']
  };
  let zimgs = null;
  const zbox = {};   // "typ:anim" -> [ {x,y,w,h,head,hand} je Frame ] (sichtbarer Bereich, für Zubehör)
  function loadZombies() {
    if (zimgs) return zimgs;
    zimgs = {};
    Object.keys(ZCHARS).forEach(ch => ZCHARS[ch].forEach(a => {
      const key = ch + ':' + a;
      const img = new Image();
      img.onload = () => {
        try {
          const n = Math.floor(img.naturalWidth / ZF), c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = ZF; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, ZF).data, boxes = [];
          const op = (f, x, y) => d[(y * c.width + f * ZF + x) * 4 + 3] > 40;
          for (let f = 0; f < n; f++) {
            let x0 = ZF, y0 = ZF, x1 = 0, y1 = 0;
            for (let y = 0; y < ZF; y += 2) for (let x = 0; x < ZF; x += 2) {
              if (op(f, x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            }
            if (x1 <= x0) { boxes.push(Z_DEFBOX); continue; }
            const b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
            // Kopf = oberstes knappes Drittel, Hand = am weitesten links in Brusthöhe
            let hx0 = ZF, hx1 = 0; const hy1 = Math.round(y0 + b.h * 0.3);
            for (let y = y0; y <= hy1; y += 2) for (let x = 0; x < ZF; x += 2) if (op(f, x, y)) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
            let ax = ZF, ay = Math.round(y0 + b.h * 0.5);
            for (let y = Math.round(y0 + b.h * 0.35); y <= y0 + b.h * 0.58; y += 2) for (let x = 0; x < ax; x += 2) if (op(f, x, y)) { ax = x; ay = y; break; }
            b.head = { x0: hx0, x1: hx1, y0, y1: hy1 }; b.hand = { x: ax, y: ay };
            boxes.push(b);
          }
          zbox[key] = boxes;
        } catch (e) {}
      };
      img.src = BASE + 'zombies/' + ch + '_' + a + '.png';
      zimgs[key] = img;
    }));
    return zimgs;
  }
  const zReady = (ch, a) => { const i = zimgs && zimgs[ch + ':' + a]; return i && i.complete && i.naturalWidth ? i : null; };
  // Welche Animation zeigt dieser Typ für einen Zustand? (fehlende werden innerhalb desselben Typs ersetzt)
  function zResolve(ch, a) {
    if (zReady(ch, a)) return { a, rev: false };
    if (a === 'ko' && zReady(ch, 'getup')) return { a: 'getup', rev: true };   // Aufstehen rückwärts = Hinfallen
    if (a === 'burn' && zReady(ch, 'run')) return { a: 'run', rev: false };
    return { a: 'walk', rev: false, still: a !== 'eat' };
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
  const stats = { revives: 0 };   // nur zum Testen
  function play(cfg) {
    cfg = cfg || {};
    if (running) running.stop(true);
    injectStyle();
    loadSprites();
    loadProps();
    loadZombies();
    const root = cover || document.createElement('div');
    cover = null;
    root.id = 'hsintro';
    root.classList.remove('hsi-out');
    const title = cfg.title || GAMES[cfg.page] || (document.title || '').replace(/^Hirnschmalz-Arena\s*-\s*/, '');
    const img = cfg.image || defaultImage(cfg.page);
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
    // Rollen: vorne 3 Kämpfer, dahinter Mitläufer - einer davon dreht manchmal ab der Hälfte um
    const roles = ['fighter', 'fighter', 'fighter', 'tail', 'tail', Math.random() < 0.6 ? 'turn' : 'tail'];
    const heroes = order.map((f, i) => ({
      f, x: -FH * 0.5 - i * gap, y: 0, state: 'walk', anim: 'walk', t0: 0, dur: 0, at: 0, rev: false,
      hitDone: false, target: null, rolled: new Set(), bubble: null,
      role: roles[i] || 'tail', dir: 1, turnAt: rnd(0.42, 0.58) * DURATION
    }));
    // ---- Zombies ----
    const zCount = W < 700 ? 4 : 5;
    const zombies = [];
    let theme = {};                       // Spiel-Thema (wird weiter unten gesetzt)
    function newZombie(x) {
      const z = { x, y: 0, vi: Math.floor(Math.random() * Z_VARIANTS.length),
        state: 'walk', claimed: null, rot: 0, vx: 0, vy: 0, vr: 0, alpha: 1, ph: Math.random() * 6, bubble: null, jumped: new Set() };
      const r = Math.random();
      z.ch = r < 0.5 ? 'basis' : r < 0.75 ? 'frau' : 'dicke';
      if (theme.initZombie) theme.initZombie(z);
      return z;
    }
    for (let i = 0; i < zCount; i++) zombies.push(newZombie(W * (0.38 + i * (0.95 / zCount)) + rnd(-FH * 0.3, FH * 0.3)));
    const zSpeed = () => FH * 0.26;
    function spawnZombie() { zombies.push(newZombie(W + FH * rnd(0.5, 1.2))); }
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
    let frozen = false, timeScale = 1, animT = 0, realNow = 0;   // für Zeitlupe / Standbild / Erstarren
    const zAlive = (z) => z.state === 'walk' || z.state === 'grab';
    const onScreen = (z) => zAlive(z) && z.x > FH * 0.5 && z.x < W - FH * 0.3;

    function say(who, text, ms) { who.bubble = { text, until: now + (ms || 1300) }; }
    function word(x, y, text, color, big) { words.push({ x, y, text, color: color || theme.wordColor || '#ffd23f', t: 0, rot: rnd(-0.25, 0.25), big: big || 1, life: big ? 1.3 : 0.9 }); }
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
      if (theme.preKill && theme.preKill(z, how)) return false;    // z.B. geblockt
      z.claimed = null; z.kx = z.x; z.killAt = now;
      const zx = z.x, zy = GY - FH * 0.55;
      sfx('boom', 0.7);
      word(zx, GY - FH * 1.35, pick(theme.words || HIT_WORDS));
      if (theme.onKill && theme.onKill(z, how, dir)) return true;
      if (how === 'squash') { blood(zx, GY - FH * 0.1, 10, 1); z.state = 'squash'; z.sy = 1; return true; }
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
      punch: { anim: 'punch', dur: 600, peak: 0.55, reach: 0.55, how: 'fly' },
      kick: { anim: 'kick', dur: 720, peak: 0.6, reach: 0.68, how: 'head' },
      sweep: { anim: 'sweep', dur: 760, peak: 0.55, reach: 0.68, how: 'sweep' },
      jkick: { anim: 'jkick', dur: 860, peak: 0.6, reach: 0.95, how: 'fly', air: 0.75, move: 1.2 },
      special: { anim: 'special', dur: 1000, peak: 0.72, reach: 99, how: 'proj' },
      jump: { anim: 'jump', dur: 900, air: 1.0, move: 1.8 }
    };
    function startAct(h, kind, z) {
      const a = ACT[kind];
      h.state = kind; h.anim = a.anim; h.t0 = now; h.dur = a.dur; h.hitDone = false; h.target = z || null; h.rev = false;
      if (kind === 'jump') { sfx('blip', 0.6); if (Math.random() < 0.5) say(h, pick(['Hopp!', 'Tschüss!', 'Nö.']), 900); }
    }

    let now = 0, startAt = 0, raf = 0, ended = false, last = 0;
    function lead() { return heroes.reduce((m, h) => (h.x > m.x ? h : m), heroes[0]); }
    function bigText(txt, y, col, k) {
      const fs = clamp(FH * 0.55, 34, 110) * (k || 1);
      ctx.save(); ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#1a1a2e'; ctx.strokeText(txt, W / 2, y);
      ctx.fillStyle = col || '#fff'; ctx.fillText(txt, W / 2, y); ctx.restore();
    }

    // =================================================================================
    // SPIEL-THEMEN: in jedem Spiel passiert mit den Zombies etwas anderes
    //   lines/words: Sprüche der Zombies / Treffer-Wörter      acc: Zubehör am Zombie
    //   init/initZombie/tick/onKill/preKill/onLand: Ablauf     drawBack/drawMid/drawFront: Extras
    // =================================================================================
    const T = {};
    const THEMES = {
      // Kreuzverhör: Sträflinge in Handschellen, einer kommt ins Verhör-Scheinwerferlicht
      spiel1: {
        lines: ["Ich war's nicht!", 'Ich sag nix ohne Anwalt!', 'Ich hab ein Alibi …', 'Hiiirn? Nie gehört!'],
        words: ['ÜBERFÜHRT!', 'GESTÄNDNIS!', 'ABGEFÜHRT!', 'BONK!'],
        acc(g, z, b) {
          g.fillStyle = 'rgba(15,15,15,.85)'; for (let y = 11; y < 21; y += 3) g.fillRect(8, y + b, 8, 1);
          g.strokeStyle = '#c0c6cc'; g.lineWidth = 0.8; g.beginPath(); g.arc(1, 14 + b, 1.4, 0, 7); g.stroke();
        },
        tick() {
          if (!T.z && now > DURATION * 0.25) {
            const z = zombies.find(z => onScreen(z) && !z.claimed && z.x > W * 0.5);
            if (z) { T.z = z; z.hold = now + 1900; say(z, "Ich war's nicht!", 1700); sfx('tick'); }
          }
          if (T.z && !T.said && now > T.z.hold - 800) { T.said = true; say(lead(), pick(['Lüge!', 'Gestehe!', 'Wo warst du um acht?']), 1200); }
        },
        drawBack() {
          const z = T.z; if (!z || !zAlive(z) || now > z.hold + 300) return;
          ctx.save(); const gr = ctx.createLinearGradient(0, 0, 0, GY);
          gr.addColorStop(0, 'rgba(255,246,176,.6)'); gr.addColorStop(1, 'rgba(255,246,176,.15)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(z.x - FH * 0.1, 0); ctx.lineTo(z.x + FH * 0.1, 0);
          ctx.lineTo(z.x + FH * 0.6, GY + 4); ctx.lineTo(z.x - FH * 0.6, GY + 4); ctx.fill();
          ctx.fillStyle = '#222'; ctx.fillRect(z.x - FH * 0.15, 0, FH * 0.3, FH * 0.1); ctx.restore();
        }
      },
      // Rätselfeuer: Zombies mit Marshmallow-Spieß - getroffen rennen sie brennend davon
      spiel2: {
        lines: ['Erzähl mir eine Gruselgeschichte …', 'Wer bin ich?', 'Marshmallow …', 'Rätsel? Hiiirn!'],
        words: ['HEISS!', 'ZISCH!', 'AUTSCH!', 'BONK!'],
        acc(g, z, b) {
          g.strokeStyle = '#6b4a2a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1, 13 + b); g.lineTo(-4, 5 + b); g.stroke();
          g.fillStyle = '#fff8e8'; g.fillRect(-5.5, 2.8 + b, 2.4, 2.8); g.fillStyle = '#c98a3a'; g.fillRect(-5.5, 2.8 + b, 2.4, 0.9);
        },
        onKill(z, how) { if (how === 'burst' || how === 'squash') return false; z.state = 'burn'; z.bt = 0; say(z, pick(['HEISS!', 'Aaah!', 'Feuer!']), 900); return true; }
      },
      // Schaf oder Wolf: Zombies im Schafspelz, dazwischen ein echtes Schaf
      spiel3: {
        lines: ['Mäh …', 'Ich bin ein Schaf. Ehrlich.', 'Määäh … Hiiirn!', 'Hier gibt es keine Wölfe.'],
        words: ['WOLF!', 'ENTLARVT!', 'MÄH!', 'BONK!'],
        acc(g, z, b) {
          g.fillStyle = '#f4f4f0';
          [[9, 12], [12, 11], [15, 12], [9, 15.5], [12.5, 15], [15.5, 15.5], [10, 18.5], [14, 18.5], [10, 1], [13, 0], [15.5, 1]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + b, 2.2, 0, 7); g.fill(); });
          g.fillStyle = '#2b2b2b'; g.fillRect(15.5, 3 + b, 2, 3);
        },
        onKill(z) {
          for (let i = 0; i < 14; i++) parts.push({ x: z.x, y: GY - FH * rnd(0.3, 0.8), vx: rnd(-1, 1) * FH * 2.5, vy: -rnd(0.5, 1.5) * FH * 2, s: rnd(0.08, 0.14) * FH, c: '#f4f4f0', life: rnd(0.8, 1.4), round: true, grav: 0.25 });
          return false;
        },
        init() { T.sheep = { x: W + FH * 0.6 }; },
        tick(dt) { const s = T.sheep; if (!frozen) s.x -= FH * 0.9 * dt; if (!T.bub && s.x < W * 0.8) T.bub = now + 1600; },
        drawMid() {
          const s = T.sheep; if (s.x < -FH) return;
          const simg = propReady('sheep');
          if (simg) {
            const hop2 = Math.abs(Math.sin(now / 180)) * FH * 0.05;
            const sh = drawPropBottom(ctx, simg, s.x, GY + 2 - hop2, FH * 0.95);
            if (T.bub && now < T.bub) bubble(s.x, GY - sh - FH * 0.05, 'Mäh! Ich bin echt!');
            return;
          }
          const y = GY - FH * 0.32, hop = Math.abs(Math.sin(now / 140)) * FH * 0.04;
          ctx.fillStyle = '#1a1a1a'; [-0.15, -0.05, 0.08, 0.18].forEach(o => ctx.fillRect(s.x + o * FH, y + FH * 0.1, FH * 0.04, FH * 0.22));
          ctx.fillStyle = '#f4f4f0'; ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(s.x, y - hop, FH * 0.3, FH * 0.19, 0, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(s.x - FH * 0.3, y - FH * 0.08 - hop, FH * 0.09, FH * 0.07, -0.3, 0, 7); ctx.fill();
          if (T.bub && now < T.bub) bubble(s.x, y - FH * 0.25, 'Mäh! Ich bin echt!');
        }
      },
      // Pi mal Daumen: jeder Flug wird vermessen
      spiel4: {
        lines: ['Ungefähr Hirn …', 'Pi mal Hiiirn …', 'Schätz mal!'],
        words: ['PI MAL DAUMEN!', 'WEIT!', 'BONK!'],
        acc(g, z, b) { g.fillStyle = '#ffd23f'; g.fillRect(-4, 12 + b, 6, 1.3); g.fillStyle = '#1a1a2e'; for (let i = -4; i < 2; i += 1.5) g.fillRect(i, 12 + b, 0.3, 0.7); },
        onLand(z) { const m = Math.abs(z.x - z.kx) / FH * 1.8; (T.marks = T.marks || []).push({ a: z.kx, b: z.x, t: now, txt: '≈ ' + m.toFixed(2).replace('.', ',') + ' m' }); },
        drawBack() {
          (T.marks || []).forEach(mk => {
            const age = (now - mk.t) / 1000; if (age > 1.8) return;
            const y = GY - FH * 0.12; ctx.save(); ctx.globalAlpha = Math.min(1, (1.8 - age) * 2);
            ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
            ctx.beginPath(); ctx.moveTo(mk.a, y); ctx.lineTo(mk.b, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(mk.a, y - 8); ctx.lineTo(mk.a, y + 8); ctx.moveTo(mk.b, y - 8); ctx.lineTo(mk.b, y + 8); ctx.stroke();
            const fs = clamp(FH * 0.2, 14, 30); ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`; ctx.textAlign = 'center';
            ctx.lineWidth = fs * 0.18; ctx.strokeStyle = '#1a1a2e'; ctx.strokeText(mk.txt, (mk.a + mk.b) / 2, y - 12);
            ctx.fillStyle = '#ffd23f'; ctx.fillText(mk.txt, (mk.a + mk.b) / 2, y - 12); ctx.restore();
          });
        }
      },
      // Verpixelt: manche Zombies sind verpixelt, umgehauene bekommen einen Zensurbalken
      spiel5: {
        lines: ['Wer bin ich?', 'Erkennst du mich?', '*verpixeltes Stöhnen*'],
        words: ['ENTPIXELT!', 'BONK!', 'ZACK!'],
        initZombie(z) { z.pixel = Math.random() < 0.65; },
        onKill(z) { if (z.pixel) { z.pixel = false; word(z.x, GY - FH * 1.75, pick(['Ach, DER!', 'Erkannt!', 'Der schon wieder!']), '#7ed957'); } return false; },
        drawFront() {
          zombies.forEach(z => {
            if (!['fly', 'fall', 'dead'].includes(z.state)) return;
            ctx.save(); ctx.globalAlpha = Math.max(0, z.alpha);
            ctx.translate(z.x, GY + z.y - (z.state === 'dead' ? 9 : 15) * U); ctx.rotate(z.rot);
            ctx.fillStyle = '#000'; ctx.fillRect(-8 * U, -14 * U, 14 * U, 4 * U);
            ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(7, 2.6 * U)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('ZENSIERT', -U, -12 * U); ctx.restore();
          });
        }
      },
      // Film-Zündschnur: Popcorn-Zombies - und mittendrin: Standbild in Schwarzweiß, "Klappe!"
      spiel6: {
        zWalk: 'eat',
        lines: ['Popcorn …', 'Pssst, der Film läuft!', 'Spoiler: Hiiirn!'],
        words: ['CUT!', 'ACTION!', 'BONK!'],
        acc(g, z, b) {
          g.fillStyle = '#fffbe6'; [[-1.5, 11.5], [0.5, 11], [2.2, 11.6]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + b, 1.3, 0, 7); g.fill(); });
          g.fillStyle = '#e63946'; g.fillRect(-2.5, 12 + b, 5.5, 5); g.fillStyle = '#fff'; g.fillRect(-1.2, 12 + b, 1, 5); g.fillRect(1, 12 + b, 1, 5);
        },
        onKill(z) { for (let i = 0; i < 16; i++) parts.push({ x: z.x - FH * 0.25, y: GY - FH * 0.55, vx: rnd(-1, 1) * FH * 2.2, vy: -rnd(0.8, 1.8) * FH * 2.2, s: rnd(0.05, 0.09) * FH, c: pick(['#fffbe6', '#ffe9a8', '#ffffff']), round: true, life: rnd(1, 1.5), grav: 0.8 }); return false; },
        tick() {
          if (!T.done && now > DURATION * 0.45) { T.done = true; T.until = realNow + 1200; timeScale = 0; root.style.filter = 'grayscale(1) contrast(1.15)'; sfx('tick'); }
          if (T.until && realNow > T.until) { T.until = 0; timeScale = 1; root.style.filter = ''; sfx('blip'); }
        },
        drawFront() {
          if (!T.until) return;
          const cw = clamp(FH * 1.8, 150, 320), ch = cw * 0.62, x = W / 2 - cw / 2, y = H * 0.38;
          const open = (T.until - realNow) > 500 ? -0.35 : 0;
          const cimg = propReady('clapperboard');
          if (cimg) {
            ctx.save(); ctx.translate(W / 2, y + ch / 2); ctx.rotate(open ? -0.08 : 0.04); drawPropImg(ctx, cimg, cw); ctx.restore();
            if (open === 0) bigText('KLAPPE!', y - ch * 0.35, '#fff', 0.8);
            return;
          }
          ctx.save(); ctx.fillStyle = '#111'; ctx.fillRect(x, y, cw, ch);
          ctx.fillStyle = '#fff'; ctx.font = `800 ${ch * 0.2}px 'Baloo 2', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('SZENE 1', W / 2, y + ch * 0.38); ctx.fillText('TAKE 2', W / 2, y + ch * 0.7);
          ctx.translate(x, y); ctx.rotate(open);
          ctx.fillStyle = '#111'; ctx.fillRect(0, -ch * 0.22, cw, ch * 0.2);
          ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * cw / 6 + cw * 0.04, -ch * 0.22); ctx.lineTo(i * cw / 6 + cw * 0.11, -ch * 0.22); ctx.lineTo(i * cw / 6 + cw * 0.07, -ch * 0.02); ctx.lineTo(i * cw / 6, -ch * 0.02); ctx.fill(); }
          ctx.restore();
          if (open === 0) bigText('KLAPPE!', y - ch * 0.35, '#fff', 0.8);
        }
      },
      // Mythos-Check: Zombies mit Hörnerhelm - der Helm fliegt, Stempel "MYTHOS!"
      spiel7: {
        lines: ['Wir nutzen nur 10 % vom Hirn!', 'Wikinger hatten Hörner!', 'Goldfische vergessen alles …', 'Blitze schlagen nie zweimal ein!'],
        words: ['MYTHOS!', 'WIDERLEGT!', 'FAKE!'], wordColor: '#ff2e93',
        acc(g, z, b) { if (!z.noAcc) helmet(g, b); },
        onKill(z) { z.noAcc = true; return false; }
      },
      // Schriftzug-Salat: Zombies zerfallen in Buchstaben, Treffer-Wörter sind verdreht
      spiel8: {
        lines: ['Hrin …', 'Shcmlaz …', 'Iirhn!', 'Fargen …'],
        words: ['KNOB!', 'TSCHKLAP!', 'MUWMS!', 'CAKZ!'],
        onKill(z) {
          const L = 'HIRNSCHMALZ';
          for (let i = 0; i < 11; i++) parts.push({ x: z.x, y: GY - FH * rnd(0.2, 0.9), vx: rnd(-1, 1) * FH * 2.5, vy: -rnd(0.6, 1.6) * FH * 2.4, ch: L[i],
            c: pick(['#ffd23f', '#7ed957', '#3ecbff', '#ff2e93', '#ffffff']), s: FH * rnd(0.16, 0.26), life: rnd(1, 1.5), rot: 0, vr: rnd(-8, 8) });
          blood(z.x, GY - FH * 0.5, 6, 1); z.state = 'gone'; return true;
        }
      },
      // Zeitreise: getroffene Zombies werden ins Zeitportal gesaugt
      spiel9: {
        lines: ['Welches Jahr haben wir?', 'Ich komm aus 1999!', 'Moorhuhn?', 'Hiiirn … von gestern.'],
        words: ['WUSCH!', 'ZACK!', 'BONK!'],
        acc(g, z, b) { g.fillStyle = '#111'; g.fillRect(6.5, 3 + b, 5, 1.7); g.fillStyle = '#ff2e93'; g.fillRect(7, 3.3 + b, 1.5, 0.8); },
        onKill(z, how) {
          if (how === 'squash') return false;
          z.state = 'portal'; z.scale = 1; z.tx = W * 0.86; z.ty = H * 0.42 - GY + 15 * U;
          word(z.x, GY - FH * 1.75, '→ ' + pick([1983, 1987, 1991, 1996, 1999, 2004, 1885, 3000]) + '!', '#3ecbff');
          return true;
        },
        drawBack() {
          const x = W * 0.86, y = H * 0.42, r = FH * 0.65;
          const pimg = propReady('portal');
          if (pimg) { ctx.save(); ctx.translate(x, y); ctx.rotate(now / 600); drawPropImg(ctx, pimg, r * 2.6); ctx.restore(); return; }
          ctx.save(); ctx.translate(x, y);
          for (let i = 0; i < 5; i++) {
            ctx.rotate(now / 400 + i); ctx.strokeStyle = ['#3ecbff', '#7017c9', '#ff2e93', '#ffd23f', '#ffffff'][i]; ctx.lineWidth = r * 0.12;
            ctx.beginPath(); ctx.arc(0, 0, r * (1 - i * 0.17), 0, Math.PI * 1.3); ctx.stroke();
          }
          ctx.restore();
        }
      },
      // Zeitreise 2: beim ersten Treffer läuft alles in Zeitlupe
      spiel10: {
        lines: ['Wie spät ist es?', 'Tick … tack … Hiiirn …', 'Noch fünf Minuten!'],
        words: ['ZACK!', 'BONK!', 'WUMMS!'],
        acc(g, z, b) {
          g.fillStyle = '#c9a227'; g.fillRect(-2.5, 10 + b, 5, 0.9); g.fillRect(-2.5, 16 + b, 5, 0.9);
          g.fillStyle = '#f4e3b0'; g.beginPath(); g.moveTo(-2, 11 + b); g.lineTo(2, 11 + b); g.lineTo(0, 13 + b); g.lineTo(2, 16 + b); g.lineTo(-2, 16 + b); g.lineTo(0, 13 + b); g.fill();
        },
        onKill() { if (!T.done && now > DURATION * 0.22) { T.done = true; T.until = realNow + 1500; timeScale = 0.2; } return false; },
        tick() { if (T.until && realNow > T.until) { T.until = 0; timeScale = 1; } },
        drawFront() {
          if (!T.until) return;
          ctx.save(); ctx.fillStyle = 'rgba(60,140,255,.12)'; ctx.fillRect(0, 0, W, H); ctx.restore();
          bigText('Z E I T L U P E', H * 0.45, '#3ecbff', 0.7 + Math.sin(realNow / 120) * 0.04);
        }
      },
      // Snake: die Zombies kommen als Polonaise-Schlange
      snake: {
        lines: ['Ssss …', 'Hiiirnsss …', 'Polonaise!'],
        words: ['+1', 'HAPPS!', 'BONK!'], wordColor: '#7ed957',
        queue: true, noSpawn: true,
        init() { zombies.length = 0; const n = W < 700 ? 6 : 8; for (let i = 0; i < n; i++) { const z = newZombie(W * 0.6 + i * FH * 0.42); z.conga = i; zombies.push(z); } },
        zombieY(z) { return -Math.abs(Math.sin(now / 170 + z.conga * 0.7)) * FH * 0.12; },
        acc(g, z, b) {
          if (z.conga !== 0) return;
          g.fillStyle = '#39ff8c'; g.fillRect(7, -1.5 + b, 9, 2); g.fillRect(8, -3 + b, 2, 1.5); g.fillRect(11, -3 + b, 2, 1.5); g.fillRect(14, -3 + b, 2, 1.5);
          g.fillStyle = '#ff2e93'; g.fillRect(4.5, 6 + b, 3, 0.7); g.fillRect(4, 5.5 + b, 1, 0.7); g.fillRect(4, 6.7 + b, 1, 0.7);
        }
      },
      // Goldregen: aus jedem Zombie platzen Münzen
      goldregen: {
        lines: ['Gold … Hiiirn …', 'Meins!', 'Ich bin reich!'],
        words: ['+10', 'KLING!', 'JACKPOT!'], wordColor: '#ffd23f',
        acc(g, z, b) { g.fillStyle = '#a0763a'; g.beginPath(); g.arc(-0.5, 16 + b, 2.6, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(-1.5, 13 + b, 2, 1); },
        onKill(z) {
          for (let i = 0; i < 16; i++) parts.push({ x: z.x, y: GY - FH * rnd(0.3, 0.9), vx: rnd(-1, 1) * FH * 2.4, vy: -rnd(0.8, 1.8) * FH * 2.4, s: FH * rnd(0.07, 0.1), c: '#ffd23f', round: true, coin: true, life: rnd(1.2, 1.8), bounce: 2 });
          sfx('coin', 0.8); return false;
        }
      },
      // Vier Gewinnt: Spielsteine fallen den Zombies auf den Kopf
      'vier-gewinnt': {
        lines: ['Rot oder Gelb?', 'Ich bin dran!', 'Vier … Hiiirne!'],
        words: ['PLONK!', 'VIER GEWINNT!', 'BONK!'],
        initZombie(z) { z.dc = Math.random() < 0.5 ? '#e63946' : '#ffd23f'; },
        acc(g, z, b) { g.fillStyle = '#1a1a2e'; g.beginPath(); g.ellipse(11.5, -0.3 + b, 5.6, 2, 0, 0, 7); g.fill(); g.fillStyle = z.dc; g.beginPath(); g.ellipse(11.5, -0.6 + b, 5, 1.5, 0, 0, 7); g.fill(); },
        tick(dt) {
          if (!T.discs && now > DURATION * 0.3) {
            T.discs = zombies.filter(onScreen).slice(0, 3).map((z, i) => ({ x: z.x, y: -FH * (0.5 + i * 0.9), vy: 0, z, c: i % 2 ? '#ffd23f' : '#e63946' }));
          }
          (T.discs || []).forEach(d => {
            if (d.landed) return;
            d.vy += FH * 14 * dt; d.y += d.vy * dt; if (zAlive(d.z)) d.x = d.z.x;
            if (zAlive(d.z) && d.y >= GY - FH * 0.95) killZombie(d.z, 'squash', 1);
            if (d.y >= GY - FH * 0.14) { d.y = GY - FH * 0.14; d.landed = true; sfx('drop', 1); }
          });
        },
        drawMid() {
          (T.discs || []).forEach(d => {
            const r = FH * 0.28;
            const dimg = propReady(d.c === '#e63946' ? 'disc_red' : 'disc_yellow');
            if (dimg) { ctx.save(); ctx.translate(d.x, d.y); if (d.landed) ctx.scale(1, 0.45); drawPropImg(ctx, dimg, r * 2.1); ctx.restore(); return; }
            ctx.save(); ctx.translate(d.x, d.y);
            if (d.landed) ctx.scale(1, 0.45);
            ctx.fillStyle = d.c; ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, 7); ctx.stroke(); ctx.restore();
          });
        }
      },
      // Panzerschlacht: ein Panzer rollt durch und macht die Zombies platt
      panzer: {
        lines: ['Was rattert da?', 'Hiiirn … Panzer?!', 'Deckung!'],
        words: ['PLATT!', 'KAWUMM!', 'BONK!'],
        acc(g, z, b) { g.fillStyle = '#4b5d2f'; g.fillRect(6.5, -1 + b, 10.5, 3); g.fillRect(5.5, 1.5 + b, 12.5, 1); },
        tick(dt) {
          if (!T.tank && now > DURATION * 0.36) { T.tank = { x: -FH * 1.2 }; sfx('boom', 0.4); }
          const tk = T.tank; if (!tk) return;
          tk.x += speed * 1.9 * dt;
          const front = tk.x + (propReady('tank') ? FH * 1.1 : FH * 0.35);
          zombies.forEach(z => { if (zAlive(z) && Math.abs(z.x - front) < FH * 0.3) killZombie(z, 'squash', 1); });
          if (!tk.shot && tk.x > W * 0.25) {
            tk.shot = true; tk.shotAt = now; sfx('shot', 1); word(tk.x + FH * 1.2, GY - FH * 1.0, 'FEUER!', '#ff7a1a');
            projs.push({ type: 'shell', x: tk.x + FH * 1.35, y: GY - FH * (propReady('tank') ? 0.85 : 0.42), vx: FH * 8, r: 0, from: {} });
          }
          if (Math.random() < 0.35) parts.push({ x: tk.x - FH * (propReady('tank') ? 1.0 : 0.45), y: GY - FH * 0.2, vx: -FH * 0.5, vy: -FH * 0.6, s: FH * rnd(0.08, 0.14), c: 'rgba(120,120,120,.6)', round: true, life: 0.7, grav: -0.05 });
        },
        drawLane() {
          const tk = T.tank; if (!tk || tk.x > W + FH * 2) return;
          const timg = propReady('tank');
          if (timg) {
            // echter Panzer: wippt beim Fahren, ruckt beim Schuss zurück, Mündungsfeuer
            const recoil = tk.shotAt ? Math.max(0, 1 - (now - tk.shotAt) / 260) : 0;
            const tw = FH * 2.3, bob = Math.round(Math.sin(now / 70) * 1.5);
            ctx.save(); ctx.translate(tk.x - recoil * FH * 0.12, 0); ctx.rotate(-recoil * 0.04);
            const th = drawPropBottom(ctx, timg, FH * 0.15, GY + 3 + bob, tw);
            if (recoil > 0.3) {
              const mx = FH * 0.15 + tw / 2 + FH * 0.05, my = GY - th * 0.78;
              ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(mx, my, FH * 0.16 * recoil, 0, 7); ctx.fill();
              ctx.fillStyle = '#fff6c4'; ctx.beginPath(); ctx.arc(mx, my, FH * 0.08 * recoil, 0, 7); ctx.fill();
            }
            ctx.restore(); return;
          }
          const x = tk.x, y = GY, u = FH / 10;
          ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-5 * u, -2.2 * u, 10 * u, 2.2 * u, u); else ctx.rect(-5 * u, -2.2 * u, 10 * u, 2.2 * u); ctx.fill();
          ctx.fillStyle = '#555'; for (let i = -4; i <= 4; i += 2) { ctx.beginPath(); ctx.arc(i * u, -1.1 * u, 0.75 * u, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#5d7136'; ctx.fillRect(-4.6 * u, -4 * u, 9.2 * u, 2 * u);
          ctx.fillStyle = '#4b5d2f'; ctx.fillRect(-2 * u, -5.6 * u, 4.4 * u, 1.8 * u); ctx.fillRect(2 * u, -5 * u, 5 * u, 0.7 * u);
          ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.strokeRect(-4.6 * u, -4 * u, 9.2 * u, 2 * u); ctx.strokeRect(-2 * u, -5.6 * u, 4.4 * u, 1.8 * u);
          ctx.restore();
        }
      },
      // Ochs vorm Berg: Ampel springt auf Rot - alle erstarren, ein Zombie schummelt
      ochsvormberg: {
        lines: ['Ich bewege mich nicht …', 'Psst …', 'Ochs vorm Hiiirn!'],
        words: ['BONK!', 'ZACK!', 'WUMMS!'],
        tick() {
          if (!T.red && now > DURATION * 0.35) {
            T.red = now; frozen = true; sfx('tick');
            say(lead(), 'STOPP!', 1200);
            const c = zombies.filter(z => onScreen(z) && !z.claimed); if (c.length) { T.cheat = pick(c); T.cheat.cheat = true; say(T.cheat, 'Hehe …', 1300); }
          }
          if (T.red && frozen && now - T.red > 1600) {
            frozen = false;
            if (T.cheat && zAlive(T.cheat)) { T.cheat.cheat = false; T.zap = now; T.zapX = T.cheat.x; word(T.cheat.x, GY - FH * 1.7, 'ERWISCHT!', '#ff2e93', 1.2); killZombie(T.cheat, 'burst', 1); }
          }
        },
        drawBack() {
          if (!T.zap || now - T.zap > 250) return;
          ctx.save(); ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(W - FH * 0.6, H * 0.3);
          ctx.lineTo(T.zapX + FH * 0.3, GY - FH * 1.2); ctx.lineTo(T.zapX - FH * 0.1, GY - FH * 0.9); ctx.lineTo(T.zapX, GY - FH * 0.4); ctx.stroke(); ctx.restore();
        },
        drawFront() {
          const red = frozen, x = W - FH * 0.6, y = H * 0.3, r = clamp(FH * 0.16, 12, 28);
          const aimg = propReady(red ? 'traffic_red' : 'traffic_green');
          if (aimg) { drawPropBottom(ctx, aimg, x, y + r * 5.6, r * 3.4); return; }
          ctx.save(); ctx.fillStyle = '#1a1a2e'; ctx.fillRect(x - r * 1.4, y - r * 2.6, r * 2.8, r * 5.2); ctx.fillRect(x - r * 0.2, y + r * 2.6, r * 0.4, r * 3);
          ctx.fillStyle = red ? '#ff2e2e' : '#4a1010'; if (red) { ctx.shadowColor = '#ff2e2e'; ctx.shadowBlur = 24; } ctx.beginPath(); ctx.arc(x, y - r * 1.2, r, 0, 7); ctx.fill();
          ctx.shadowBlur = 0; ctx.fillStyle = red ? '#103a1a' : '#39ff8c'; if (!red) { ctx.shadowColor = '#39ff8c'; ctx.shadowBlur = 24; } ctx.beginPath(); ctx.arc(x, y + r * 1.2, r, 0, 7); ctx.fill();
          ctx.restore();
        }
      },
      // CCC Rechner: ein Zombie schleppt einen uralten PC, der überhitzt - Countdown - KABUMM
      'ccc-rechner': {
        lines: ['Läuft das auf Windows 95?', 'Mehr RAM …', 'Hast du es schon mit Neustarten versucht?', 'Treiber … Hiiirn …'],
        words: ['BLUESCREEN!', 'ABGESTÜRZT!', 'STRG+ALT+ENTF!', 'BONK!'],
        init() { const z = zombies[1] || zombies[0]; if (z) z.bomber = true; },
        acc(g, z, b) {
          if (!z.bomber) return;
          // beiger Röhrenmonitor über dem Kopf, raucht und flackert
          g.fillStyle = '#d8cfb4'; g.fillRect(7, -9 + b, 10, 7.5); g.fillStyle = '#b8ae92'; g.fillRect(7, -2 + b, 10, 0.8);
          g.fillStyle = Math.floor(now / 120) % 2 ? '#1f4fd1' : '#2a64ff'; g.fillRect(8.2, -8 + b, 7.6, 5);
          g.fillStyle = '#fff'; g.fillRect(9, -7 + b, 3, 0.6); g.fillRect(9, -5.8 + b, 5, 0.6);
          g.fillStyle = 'rgba(120,120,120,.8)'; g.beginPath(); g.arc(15 + Math.sin(now / 200), -11 + b, 1.3, 0, 7); g.fill();
          g.fillStyle = '#8fbf6a'; g.fillRect(8, -2 + b, 1.5, 4); g.fillRect(14.5, -2 + b, 1.5, 4);
        },
        tick() { zombies.forEach(z => { if (!z.bomber || !zAlive(z)) return; if (!z.fuseAt && z.x < W - FH * 0.5) z.fuseAt = now + 2700; if (z.fuseAt && now > z.fuseAt) bombBoom(z); }); },
        onKill(z) { if (z.bomber) { bombBoom(z); return true; } return false; },
        drawBack() { if (T.flash && now - T.flash < 220) { ctx.fillStyle = 'rgba(255,240,200,' + (1 - (now - T.flash) / 220) * 0.8 + ')'; ctx.fillRect(0, 0, W, H); } },
        drawFront() {
          const pc = propReady('old_pc');
          if (pc) zombies.forEach(z => {
            if (!z.bomber || !zAlive(z)) return;
            const wob = Math.sin(now / 120) * 0.05;
            ctx.save(); ctx.translate(z.x, GY + z.y - FH * 1.12); ctx.rotate(wob); drawPropImg(ctx, pc, FH * 0.62); ctx.restore();
            if (Math.random() < 0.15) parts.push({ x: z.x + rnd(-0.1, 0.1) * FH, y: GY - FH * 1.3, vx: rnd(-0.2, 0.2) * FH, vy: -FH * 0.6, s: FH * rnd(0.06, 0.1), c: 'rgba(130,130,130,.6)', round: true, life: 0.8, grav: -0.05 });
          });
          zombies.forEach(z => {
            if (!z.bomber || !z.fuseAt || !zAlive(z)) return;
            const n = Math.max(1, Math.ceil((z.fuseAt - now) / 1000)), fs = clamp(FH * 0.32, 20, 48);
            ctx.save(); ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`; ctx.textAlign = 'center';
            ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#1a1a2e'; ctx.strokeText(n, z.x + U * 0.5, GY - FH * 1.45);
            ctx.fillStyle = '#ff2e2e'; ctx.fillText(n, z.x + U * 0.5, GY - FH * 1.45); ctx.restore();
          });
        }
      },
      // Burst Pipe: Säure-Zombies - getroffen zerlaufen sie zu grüner Pampe, der Boden blubbert
      burstpipe: {
        lines: ['Steigt das schon wieder?', 'Ätzend hier …', 'Wer hat das Rohr kaputt gemacht?', 'Hiiirn … glüht …'],
        words: ['ÄTZEND!', 'BLUBB!', 'ZISCH!', 'BONK!'], wordColor: '#7dff3a',
        acc(g, z, b) { g.fillStyle = '#ffd23f'; g.fillRect(7, -1 + b, 10, 2.5); g.fillRect(6, 1 + b, 12, 0.8); g.fillStyle = '#1a1a1a'; g.fillRect(11, -0.6 + b, 2, 1.6); },
        onKill(z) {
          for (let i = 0; i < 18; i++) parts.push({ x: z.x, y: GY - FH * rnd(0.2, 0.9), vx: rnd(-1, 1) * FH * 2, vy: -rnd(0.5, 1.5) * FH * 2.2, s: rnd(0.06, 0.12) * FH, c: pick(['#7dff3a', '#4fd11c', '#b8ff6a']), round: true, life: rnd(0.8, 1.3), splat: true });
          return false;
        },
        drawBack() {
          ctx.save(); ctx.fillStyle = 'rgba(125,255,58,.18)'; ctx.fillRect(0, GY - 2, W, H - GY + 2);
          for (let i = 0; i < 9; i++) { const x = ((i * 137 + now * 0.05) % W), r = FH * (0.03 + 0.03 * Math.abs(Math.sin(now / 300 + i))); ctx.fillStyle = 'rgba(160,255,90,.55)'; ctx.beginPath(); ctx.arc(x, GY + 4, r, 0, 7); ctx.fill(); }
          ctx.restore();
        }
      },
      // Hirnschmalz-Fighter: "Runde 1 - FIGHT!", ein Zombie blockt, am Ende "PERFECT!"
      fighter: {
        lines: ['Ich kann Karate!', 'Komm her!', 'Hiiirn … FIGHT!'],
        words: ['K.O.!', 'COMBO!', 'VOLLTREFFER!', 'BONK!'],
        acc(g, z, b) { g.fillStyle = '#e63946'; g.fillRect(7, 2 + b, 9, 1.4); g.fillRect(16, 2.4 + b, 3, 0.8); g.fillRect(17, 3.5 + b, 2.5, 0.8); },
        init() { T.blocker = zombies[0]; },
        preKill(z) {
          if (z !== T.blocker || T.blocked) return false;
          T.blocked = true; z.claimed = null; z.x += FH * 0.4;
          word(z.x, GY - FH * 1.5, 'GEBLOCKT!', '#3ecbff'); say(z, 'Haha!', 900); sfx('blip', 1);
          return true;
        },
        drawFront() {
          if (now < 1800) bigText(now < 950 ? 'RUNDE 1' : 'FIGHT!', H * 0.5, now < 950 ? '#fff' : '#ff2e93', 0.8 + Math.min(0.3, ((now % 950) / 950) * 0.3));
          if (now > DURATION * 0.84 && now < DURATION * 0.97) bigText('PERFECT!', H * 0.5, '#ffd23f', 0.9);
        }
      }
    };
    function helmet(g, b) {
      g.fillStyle = '#8a8f98'; g.fillRect(7, -1 + b, 10, 3); g.fillStyle = '#6a6f78'; g.fillRect(7, 1 + b, 10, 1);
      g.fillStyle = '#f1ead2'; g.fillRect(5, -3 + b, 2, 3); g.fillRect(4, -5 + b, 2, 2); g.fillRect(17, -3 + b, 2, 3); g.fillRect(18, -5 + b, 2, 2);
    }
    function bombBoom(z) {
      z.bomber = false; z.state = 'gone'; T.flash = now;
      sfx('boom', 1); setTimeout(() => sfx('boom', 1), 90);
      gore(z.x, GY, z.vi, 30); blood(z.x, GY - FH * 0.6, 20, 1);
      word(z.x, GY - FH * 1.6, pick(['KABUMM!', 'BLUESCREEN!']), '#ff7a1a', 1.5);
      zombies.forEach(o => { if (o !== z && zAlive(o) && Math.abs(o.x - z.x) < FH * 2.6) killZombie(o, 'fly', o.x >= z.x ? 1 : -1); });
      heroes.forEach(h => { if (h.state === 'walk' && Math.abs(h.x - z.x) < FH * 1.6) { h.state = 'slip'; h.anim = 'ko'; h.t0 = now; h.dur = 1500; say(h, pick(['Hust!', 'Meine Haare!', 'Das war das Netzteil!', 'Garantie futsch!']), 1300); } });
    }
    theme = THEMES[cfg.page] || {};
    if (theme.initZombie) zombies.forEach(theme.initZombie);
    if (theme.init) theme.init();

    function update(dt) {
      const t = now;
      // Ladebalken-Text wechseln
      if (t - loadLineAt > 1700) { loadLineAt = t; loadLine = pick(LOAD_LINES); }

      // Nachschub von rechts
      if (theme.tick) theme.tick(dt);
      if (!theme.noSpawn && t > nextSpawn && t < DURATION * 0.72) { spawnZombie(); if (Math.random() < 0.3) spawnZombie(); nextSpawn = t + rnd(1100, 1900); }

      // Zombie sagt etwas
      if (gags.zombieTalk && t > gags.zombieTalk) {
        const z = zombies.find(z => z.state === 'walk' && z.x < W * 0.95 && z.x > W * 0.2);
        if (z) say(z, pick(theme.lines || ZOMBIE_LINES), 1500);
        gags.zombieTalk = Math.random() < 0.6 ? t + rnd(1800, 2800) : 0;
      }

      // Tanz-Gag
      if (gags.dance && !gags.dance.done && t > gags.dance.at) {
        const cands = heroes.filter(h => h.state === 'walk' && h.x > FH && h.x < W - FH && h !== lead());
        if (cands.length) { const h = pick(cands); h.state = 'dance'; h.anim = 'win'; h.t0 = t; h.dur = 1400; say(h, pick(DANCE_LINES), 1400); gags.dance.done = true; }
      }

      if (!frozen) animT += dt * 1000;
      if (!frozen) heroes.forEach(h => {
        const el = t - h.t0, p = h.dur ? clamp(el / h.dur, 0, 1) : 0;
        if (h.state === 'walk') {
          h.anim = 'walk'; h.y = 0;
          // Umdreher: ab der Hälfte in die andere Richtung
          if (h.role === 'turn' && h.dir === 1 && t > h.turnAt && h.x > FH && h.x < W - FH) { h.dir = -1; say(h, pick(['Ach, vergessen …', 'Ich geh mal Pizza holen.', 'Nee, ohne mich.']), 1500); }
          h.x += speed * dt * h.dir * (h.role === 'fighter' ? 1 : 0.92);
          if (h.role !== 'fighter') {
            // Mitläufer kämpfen nicht - steht ein Zombie im Weg, hüpfen sie drüber
            const z = h.dir > 0 && zombies.find(z => zAlive(z) && !z.jumped.has(h) && z.x - h.x > 0 && z.x - h.x < FH * 0.55);
            if (z) { z.jumped.add(h); startAct(h, 'jump', null); }
            return;
          }
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
          if (a.move) h.x += speed * a.move * dt * 0.7 * h.dir;
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
          let stop = near || (frozen && !z.cheat) || (z.hold && now < z.hold);
          if (!stop && theme.queue) stop = zombies.some(o => o !== z && zAlive(o) && o.x < z.x && o.x > z.x - FH * 0.4);
          if (!stop) { z.x -= zSpeed() * dt; z.ph += dt * 5; }
          if (theme.zombieY) z.y = theme.zombieY(z);
          if (z.x < -FH * 2) z.state = 'gone';
        } else if (z.state === 'fly' || z.state === 'fall') {
          z.x += z.vx * dt; z.vy += FH * 12 * dt; z.y += z.vy * dt; z.rot += z.vr * dt;
          if (z.state === 'fall') { z.rot = Math.min(z.rot, Math.PI / 2); z.y = 0; if (z.rot >= Math.PI / 2) { z.state = 'dead'; z.deadAt = now; } }
          else if (z.y >= 0 && z.vy > 0) { z.y = 0; z.state = 'dead'; z.deadAt = now; z.rot = Math.PI / 2 * (z.vx >= 0 ? 1 : -1); splats.push({ x: z.x, r: FH * 0.28, a: 0.8 }); if (theme.onLand) theme.onLand(z); }
        } else if (z.state === 'squash') {
          z.sy = Math.max(0.16, z.sy - dt * 7); z.alpha -= dt * 0.45; if (z.alpha <= 0) z.state = 'gone';
        } else if (z.state === 'portal') {
          const k = Math.min(1, dt * 3); z.x += (z.tx - z.x) * k; z.y += (z.ty - z.y) * k; z.scale -= dt * 0.9; z.rot += dt * 12;
          if (z.scale <= 0.05) z.state = 'gone';
        } else if (z.state === 'burn') {
          z.x += FH * 2.6 * dt; z.ph += dt * 12; z.bt += dt;
          for (let i = 0; i < 2; i++) parts.push({ x: z.x + rnd(-0.2, 0.2) * FH, y: GY - FH * rnd(0.15, 0.95), vx: rnd(-0.3, 0.3) * FH, vy: -FH * rnd(0.6, 1.3), s: rnd(0.06, 0.12) * FH, c: pick(['#ff7a1a', '#ffd23f', '#ff3b1a']), round: true, life: rnd(0.25, 0.5), grav: -0.1 });
          if (z.bt > 0.9) { z.state = 'ash'; z.alpha = 1; }
        } else if (z.state === 'ash') {
          z.alpha -= dt * 0.5; if (z.alpha <= 0) z.state = 'gone';
        } else if (z.state === 'dead') {
          // Manche Zombie-Frauen stehen noch mal auf
          if (z.reviveAt == null) z.reviveAt = (!z.revived && z.ch !== 'basis' && !z.headless && zReady(z.ch, 'getup') && z.x > FH && z.x < W - FH * 0.6 && Math.random() < 0.5 && now < DURATION * 0.75) ? now + 700 : 0;
          if (z.reviveAt && now > z.reviveAt) { z.state = 'getup'; z.t0 = now; z.rot = 0; z.alpha = 1; z.reviveAt = 0; z.revived = true; stats.revives++; say(z, pick(['Noch nicht fertig!', 'War das alles?', 'Ich bin wieder da!', 'Hiiirn … Runde 2!']), 1400); }
          else if (!z.reviveAt) { z.alpha -= dt * 0.6; if (z.alpha <= 0) z.state = 'gone'; }
        } else if (z.state === 'getup') {
          if (now - z.t0 > 750) { z.state = 'walk'; z.claimed = null; z.jumped = new Set(); z.reviveAt = 0; }
        }
      });

      // Projektile
      projs.forEach(p => {
        p.x += p.vx * dt; p.r += dt * 14;
        const z = zombies.find(z => (z.state === 'walk' || z.state === 'grab') && Math.abs(z.x - p.x) < FH * 0.3);
        if (z) { killZombie(z, 'burst', 1); p.dead = true; if (p.from && p.from.target === z) p.from.target = null; }
        if (p.x > W + FH) p.dead = true;
      });
      for (let i = projs.length - 1; i >= 0; i--) if (projs[i].dead) projs.splice(i, 1);

      // Partikel
      parts.forEach(q => {
        q.vy += FH * 11 * dt * (q.grav == null ? 1 : q.grav); q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
        if (q.vr) q.rot += q.vr * dt;
        if (q.y > GY) {
          if (q.bounce > 0) { q.y = GY; q.vy *= -0.45; q.vx *= 0.6; q.vr *= 0.6; q.bounce--; }
          else { if (q.splat) splats.push({ x: q.x, r: q.s * 1.6, a: 0.7 }); q.life = 0; }
        }
      });
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      splats.forEach(s => s.a -= dt * 0.12);
      for (let i = splats.length - 1; i >= 0; i--) if (splats[i].a <= 0) splats.splice(i, 1);
      words.forEach(w => w.t += dt);
      for (let i = words.length - 1; i >= 0; i--) if (words[i].t > words[i].life) words.splice(i, 1);
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
      if (h.state === 'walk') fi = Math.floor(animT / 1000 * clamp(speed / FH * 3.5, 6, 10)) % n;
      else if (h.state === 'dance') fi = Math.floor(el / 1000 * 7) % n;
      else if (h.state === 'slip') {
        // hinfallen (0,55 s) - liegen bleiben - wieder aufstehen (rückwärts)
        const down = 550, lie = 650, up = h.dur - down - lie;
        const p = el < down ? el / down : el < down + lie ? 1 : 1 - (el - down - lie) / up;
        fi = Math.round(clamp(p, 0, 1) * (n - 1));
      } else fi = Math.min(n - 1, Math.floor(clamp(el / h.dur, 0, 1) * n));
      const dw = FRAME_W * S, dh = FRAME_H * S;
      const x = h.dir < 0 ? -dw / 2 : h.x - dw / 2, y = GY - h.y - FEET_Y * S;
      // Schatten
      ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - Math.min(0.25, h.y / FH * 0.3)) + ')';
      ctx.beginPath(); ctx.ellipse(h.x, GY + 2, FH * 0.24, FH * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      if (h.dir < 0) { ctx.save(); ctx.translate(h.x, 0); ctx.scale(-1, 1); ctx.drawImage(img, fi * FRAME_W, 0, FRAME_W, FRAME_H, x, y, dw, dh); ctx.restore(); }
      else ctx.drawImage(img, fi * FRAME_W, 0, FRAME_W, FRAME_H, x, y, dw, dh);
    }
    const pixCanvas = document.createElement('canvas'); pixCanvas.width = 6; pixCanvas.height = 8;
    // Sprite-Zombie zeichnen (gibt false zurück, wenn die Sprites noch fehlen)
    function drawZombieSprite(z) {
      if (!zReady('basis', 'walk')) return false;
      const ch = zReady(z.ch || 'basis', 'walk') ? (z.ch || 'basis') : 'basis';
      const s = FH * 0.98 / Z_FIG;            // Skalierung: gleiche Größe wie die Fighter
      const alive = zAlive(z);
      let anim = 'walk', fi = 0, flip = false, rot = 0, lying = false, rev = false, still = false;
      const pick = (a) => { const r = zResolve(ch, a); rev = r.rev; still = !!r.still; return r.a; };
      const nOf = (a) => Math.max(1, Math.floor(zimgs[ch + ':' + a].naturalWidth / ZF));
      if (z.state === 'walk') {
        anim = pick((z.hold && now < z.hold) || (frozen && !z.cheat) ? 'talk' : (theme.zWalk || 'walk'));
        fi = anim === 'talk' ? Math.floor(now / 170) : Math.floor(z.ph * 1.0);
      } else if (z.state === 'grab') { anim = pick('grab'); fi = Math.floor(now / 140); }
      else if (z.state === 'fly' || z.state === 'portal') { anim = pick('fly'); fi = Math.floor((now - (z.killAt || 0)) / 70); rot = z.rot * 0.35; }
      else if (z.state === 'fall') { anim = pick('ko'); fi = Math.floor(Math.min(1, z.rot / (Math.PI / 2)) * (nOf(anim) - 1)); }
      else if (z.state === 'dead') { anim = pick('ko'); const n = nOf(anim); fi = Math.min(n - 1, Math.floor(n / 2) + Math.floor((now - (z.deadAt || 0)) / 50)); lying = true; }
      else if (z.state === 'burn') { anim = pick('burn'); fi = Math.floor(z.ph * 1.2); flip = true; }
      else if (z.state === 'squash') { anim = pick('hit'); fi = nOf(anim) - 1; }
      else if (z.state === 'getup') { anim = pick('getup'); rev = false; fi = Math.floor((now - z.t0) / 150); }
      const img = zimgs[ch + ':' + anim], n = nOf(anim);
      const loop = ['walk', 'grab', 'talk', 'burn', 'eat', 'run'].includes(anim) && !(still && (z.state === 'fly' || z.state === 'portal' || z.state === 'squash'));
      fi = loop ? ((fi % n) + n) % n : Math.min(n - 1, Math.max(0, fi));
      if (still && anim === 'walk' && (z.state === 'grab')) fi = Math.floor(now / 160) % n;   // Ersatz: langsam weiterwackeln
      if (rev) fi = n - 1 - fi;
      let src = img, sx = fi * ZF;
      if (z.pixel && alive) {   // Verpixelt: grob runterrechnen
        const pg = pixCanvas.getContext('2d'); pixCanvas.width = 12; pixCanvas.height = 12; pg.imageSmoothingEnabled = true;
        pg.clearRect(0, 0, 12, 12); pg.drawImage(img, sx, 0, ZF, ZF, 0, 0, 12, 12); src = pixCanvas; sx = -1;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, z.alpha);
      if (alive) { ctx.fillStyle = 'rgba(0,0,0,.33)'; ctx.beginPath(); ctx.ellipse(z.x, GY + 2, FH * 0.24, FH * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.translate(z.x, GY + z.y);
      if (z.state === 'squash') ctx.scale(1 + (1 - z.sy) * 0.7, z.sy);
      if (z.scale != null) { ctx.translate(0, -Z_FIG * s / 2); ctx.scale(Math.max(0, z.scale), Math.max(0, z.scale)); ctx.translate(0, Z_FIG * s / 2); }
      if (rot) { ctx.translate(0, -Z_FIG * s / 2); ctx.rotate(rot); ctx.translate(0, Z_FIG * s / 2); }
      if (z.state === 'grab') ctx.rotate(Math.sin(now / 90) * 0.03);
      if (flip) ctx.scale(-1, 1);
      const bk = zbox[ch + ':' + anim];
      const box = (bk && bk[fi]) || Z_DEFBOX;
      if (z.headless && !lying) {   // Kopf ist weggeflogen: oberes Drittel abschneiden
        ctx.beginPath(); ctx.rect(-ZF * s, (box.y + box.h * 0.36 - Z_FOOT) * s, ZF * 2 * s, ZF * s); ctx.clip();
      }
      if (sx < 0) ctx.drawImage(src, 0, 0, 12, 12, -Z_CX * s, -Z_FOOT * s, ZF * s, ZF * s);
      else ctx.drawImage(src, sx, 0, ZF, ZF, -Z_CX * s, -Z_FOOT * s, ZF * s, ZF * s);
      // Zubehör des Spiel-Themas: das 22 x 32 Raster der Pixel-Zombies wird in drei Bereichen
      // auf Kopf, Körper und Hand des Sprites gelegt (pro Frame ermittelt)
      if (theme.acc && z.bomber && !propReady('old_pc') && !(z.pixel && alive) && !lying && z.state !== 'squash' && z.state !== 'getup' && box.head) {   // nur der PC über dem Kopf
        const hd = box.head, hs = (hd.x1 - hd.x0) / 9;           // Pixel pro Rasterfeld am Kopf
        const regions = [
          { clip: [[-60, -60], [60, -60], [60, 9.5], [6, 9.5], [6, 2], [-60, 2]], tx: hd.x0 - 7 * hs, ty: hd.y0 + (hd.y1 - hd.y0) * 0.55, sx: hs, sy: (hd.y1 - hd.y0) / 9 },   // etwas tiefer: die Haare stehen hoch
          { clip: [[6, 9.5], [60, 9.5], [60, 80], [6, 80]], tx: (hd.x0 + hd.x1) / 2 - 12 * hs * 1.2, ty: hd.y1 - 10 * hs * 1.15, sx: hs * 1.2, sy: hs * 1.15 },
          { clip: [[-60, 2], [6, 2], [6, 80], [-60, 80]], tx: box.hand.x - 0.5 * hs, ty: box.hand.y - 13 * hs, sx: hs, sy: hs }
        ];
        regions.forEach(r => {
          ctx.save();
          ctx.translate((r.tx - Z_CX) * s, (r.ty - Z_FOOT) * s); ctx.scale(r.sx * s, r.sy * s);
          ctx.beginPath(); r.clip.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
          theme.acc(ctx, z, 0);
          ctx.restore();
        });
      }
      ctx.restore();
      return true;
    }
    function drawZombie(z) {
      if (z.state !== 'ash' && drawZombieSprite(z)) return;
      const frame = (z.state === 'walk' || z.state === 'burn') ? (Math.floor(z.ph) % 2) : (z.state === 'grab' ? Math.floor(now / 160) % 2 : 0);
      let spr = zombieSprite(z.vi, frame, z.headless ? 'body' : 'all');
      const w = Z_W * U, h = Z_H * U;
      ctx.save();
      ctx.globalAlpha = Math.max(0, z.alpha);
      if (z.state === 'ash') {
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.ellipse(z.x, GY, FH * 0.22, FH * 0.08, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#777'; ctx.fillRect(z.x - FH * 0.05, GY - FH * 0.12, FH * 0.04, FH * 0.04); ctx.restore(); return;
      }
      if (z.state === 'squash') {
        ctx.translate(z.x, GY + 2 * U); ctx.scale(1 + (1 - z.sy) * 0.7, z.sy); ctx.drawImage(spr, -w / 2, -h, w, h); ctx.restore(); return;
      }
      if (z.pixel && zAlive(z)) {   // grob verpixeln
        const pg = pixCanvas.getContext('2d'); pg.imageSmoothingEnabled = true; pg.clearRect(0, 0, 6, 8); pg.drawImage(spr, 0, 0, 6, 8); spr = pixCanvas;
      }
      if (z.state === 'walk' || z.state === 'grab') {
        ctx.fillStyle = 'rgba(0,0,0,.33)';
        ctx.beginPath(); ctx.ellipse(z.x, GY + 2, FH * 0.22, FH * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.translate(z.x, GY + z.y - (z.state === 'dead' ? 9 : 15) * U);
      ctx.rotate(z.rot);
      if (z.state === 'grab') ctx.rotate(Math.sin(now / 90) * 0.05);
      if (z.scale != null) ctx.scale(Math.max(0, z.scale), Math.max(0, z.scale));
      ctx.drawImage(spr, -w / 2, -h / 2, w, h);
      if (theme.acc && !(z.pixel && zAlive(z))) {
        ctx.translate(-w / 2, -h / 2); ctx.scale(U, U);
        theme.acc(ctx, z, (zAlive(z) || z.state === 'burn') ? frame : 0);
      }
      ctx.restore();
    }
    function drawProj(p) {
      ctx.save(); ctx.translate(p.x, p.y);
      const s = FH * 0.12;
      const pimg = propReady(p.type);
      if (pimg) {
        if (p.type !== 'fireball' && p.type !== 'shell') ctx.rotate(p.r);
        drawPropImg(ctx, pimg, FH * (p.type === 'fireball' ? 0.55 : 0.42));
        ctx.restore(); return;
      }
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
        else if (p.type === 'shell') { ctx.rotate(-p.r); ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
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
      if (theme.drawBack) theme.drawBack();
      // Bananenschale
      const b = gags.banana;
      if (b) {
        const bx = b.fly ? b.fly.x : b.x, byy = b.fly ? b.fly.y : GY;
        ctx.save(); ctx.translate(bx, byy - FH * 0.04); ctx.rotate(b.fly ? b.fly.r : 0);
        const bimg = propReady('banana');
        if (bimg) { ctx.translate(0, -FH * 0.03); drawPropImg(ctx, bimg, FH * 0.34); ctx.restore(); }
        else {
        const s = FH * 0.09; ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-s * 0.9, -s * 0.3, s * 0.8, s * 0.3, -0.7, 0, Math.PI * 2); ctx.ellipse(s * 0.9, -s * 0.3, s * 0.8, s * 0.3, 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-s * 0.15, -s * 0.6, s * 0.3, s * 0.4);
        ctx.restore();
        }
      }
      zombies.forEach(z => { if (z.state !== 'gone') drawZombie(z); });
      if (theme.drawLane) theme.drawLane();   // zwischen Zombies und Fightern (z. B. der Panzer)
      heroes.slice().sort((a, c) => a.x - c.x).forEach(drawHero);
      if (theme.drawMid) theme.drawMid();
      projs.forEach(drawProj);
      // Partikel (Blut, Zombie-Stücke, fliegende Köpfe)
      parts.forEach(q => {
        if (q.head != null && propReady('zombie_head')) {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); drawPropImg(ctx, propReady('zombie_head'), FH * 0.42); ctx.restore();
        } else if (q.head != null) {
          const spr = zombieSprite(q.head, 0, 'head');
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.drawImage(spr, -11.5 * U, -5 * U, Z_W * U, Z_H * U); // nur der Kopf ist gefüllt, Mitte ca. (11.5|5)
          ctx.restore();
        } else if (q.draw) {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot || 0); q.draw(ctx, q); ctx.restore();
        } else if (q.ch) {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot || 0); ctx.font = `800 ${q.s}px 'Baloo 2', system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = q.s * 0.18; ctx.strokeStyle = '#1a1a2e'; ctx.strokeText(q.ch, 0, 0);
          ctx.fillStyle = q.c; ctx.fillText(q.ch, 0, 0); ctx.restore();
        } else if (q.coin && propReady('coin')) {
          ctx.save(); ctx.translate(q.x, q.y); ctx.scale(Math.abs(Math.cos(now / 120 + q.s)) * 0.8 + 0.2, 1); drawPropImg(ctx, propReady('coin'), q.s * 1.6); ctx.restore();
        } else if (q.round) {
          ctx.save(); if (q.grav != null && q.grav < 0) ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2.5));
          ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s / 2, 0, Math.PI * 2); ctx.fill();
          if (q.coin) { ctx.strokeStyle = '#b8860b'; ctx.lineWidth = Math.max(1, q.s * 0.15); ctx.stroke(); }
          ctx.restore();
        } else { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      });
      drawBar(progress());
      // Sprechblasen
      heroes.forEach(h => { if (h.bubble && now < h.bubble.until) bubble(h.x, GY - h.y - FH * 1.08, h.bubble.text); });
      zombies.forEach(z => { if (z.bubble && now < z.bubble.until && (z.state === 'walk' || z.state === 'grab' || z.state === 'getup')) bubble(z.x, GY - FH * 1.05, z.bubble.text); });
      // Comic-Wörter
      words.forEach(w => {
        const k = Math.min(1, w.t / 0.12), fs = clamp(FH * 0.32, 20, 54) * (0.6 + 0.6 * k) * w.big;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (w.t - (w.life - 0.35)) / 0.35));
        ctx.translate(w.x, w.y - w.t * FH * 0.4); ctx.rotate(w.rot);
        ctx.font = `800 ${fs}px 'Baloo 2', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#1a1a2e'; ctx.lineJoin = 'round'; ctx.strokeText(w.text, 0, 0);
        ctx.fillStyle = w.color; ctx.fillText(w.text, 0, 0);
        ctx.restore();
      });
      if (theme.drawFront) theme.drawFront();
    }

    // Bilder kurz vorladen (max. 1,5 s), damit die Figuren nicht mitten im Intro den Stil wechseln
    const allImgs = () => [].concat(...Object.values(sprites).map(o => Object.values(o)), Object.values(zimgs), Object.values(props));
    let waitFrom = 0;
    function frame(ts) {
      if (ended) return;
      if (!startAt) {
        if (!waitFrom) waitFrom = ts;
        if (ts - waitFrom < 1500 && allImgs().some(i => !i.complete)) { raf = requestAnimationFrame(frame); return; }
        startAt = ts; last = ts;
      }
      const rdt = Math.min(0.05, (ts - last) / 1000); last = ts;
      realNow = ts - startAt;
      const dt = rdt * timeScale;
      now += dt * 1000;
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
      root.style.filter = '';
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
    loadSprites(); loadZombies(); loadProps();   // schon mal laden, während die Einstellungen kommen
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

  window.HSIntro = { GAMES, DURATION, play, preview, getConfig, defaultImage, stats };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto, { once: true });
  else auto();
})();
