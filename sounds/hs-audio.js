/* =====================================================================================
   HIRNSCHMALZ-ARENA - gemeinsames Audio-System (Musik + Soundeffekte)
   -------------------------------------------------------------------------------------
   Einbinden:  <script src="sounds/hs-audio.js"></script>   (vor den Spiel-Skripten)

   - Jede Seite bekommt unten links einen kleinen Lautsprecher-Knopf (Musik / Effekte
     getrennt regelbar, wird pro Gerät gespeichert).
   - Welcher Sound wo läuft, steht unten in SLOTS. Im Fragen-Editor (Reiter "Sounds")
     kann man jeden Slot auf eine andere Datei umstellen - das wird in Firebase unter
     "soundConfig" gespeichert und gilt dann für alle Geräte.
   - Browser erlauben Ton erst nach dem ersten Tippen/Klicken auf der Seite. Bis dahin
     blinkt der Knopf; danach startet die Musik von selbst.
   ===================================================================================== */
(function () {
  if (window.HSAudio) return;

  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : 'sounds/';
  })();
  const DB_URL = 'https://play-ground-82b46-default-rtdb.firebaseio.com';

  // ---------------------------------------------------------------------------------
  // DATEIEN (Name -> Beschreibung). Quelle aller Dateien: freesound.org, siehe CREDITS.md
  // ---------------------------------------------------------------------------------
  const FILES = {
    // Musik
    'musik-lobby-piano':        'Musik: ruhiges Klavier am Lagerfeuer (4:34)',
    'musik-quiz-loop':          'Musik: klassischer Quiz-Loop, 90 BPM',
    'musik-bereit':             'Musik: fröhlich, "I\'m Ready" (Spiele-Stil)',
    'musik-news-countdown':     'Musik: Nachrichten-Countdown mit Ticken',
    'musik-unheimlich-loop':    'Musik: unheimlich-schön, 90 BPM',
    'musik-sphaere-loop':       'Musik: schwebende Fläche, leicht glitchig',
    'musik-herzschlag':         'Musik: Herzschlag (Spannung)',
    'musik-beat-112':           'Musik: elektronischer Beat, 112 BPM',
    'musik-bass':               'Musik: UK-Bass, wuchtig',
    'musik-festlich':           'Musik: indisch-festlich',
    'musik-kampf-hafen':        'Musik: Kampfmusik (kurzer Loop)',
    'musik-kampf-start':        'Musik: "Battle starts" Lead-Loop',
    'musik-kampf-kaefig':       'Musik: Dark-Metal-Kampf-Loop, 155 BPM',
    'musik-kampf-finale':       'Musik: Metal mit Gitarrensolo',
    'musik-orchester-hoffnung': 'Musik: Orchester, hoffnungsvoll-feierlich',
    'atmo-lagerfeuer':          'Atmosphäre: knisterndes Lagerfeuer',
    'atmo-regen-gasse':         'Atmosphäre: Regennacht in der Gasse',
    // Jingles
    'fanfare-grand-prix':       'Fanfare: Grand-Prix-Blech (kurz)',
    'fanfare-mittelalter':      'Fanfare: mittelalterlich',
    'fanfare-lustig':           'Fanfare: lustig',
    'fanfare-sieg':             'Fanfare: Sieg',
    'fanfare-sieg-gross':       'Fanfare: großer Sieg, orchestral (29 s)',
    'sting-sieg':               'Jingle: kurzer Sieg-Sting',
    'jingle-gewinner-groovy':   'Jingle: groovy Gewinner',
    'jingle-ende-news':         'Jingle: Nachrichten-Abspann',
    'jingle-piano-schnoerkel':  'Jingle: Klavier-Schnörkel',
    'sieg-gitarre-1':           'Jingle: Gitarren-Sieg 1',
    'sieg-gitarre-2':           'Jingle: Gitarren-Sieg 2',
    'sieg-gitarre-3':           'Jingle: Gitarren-Sieg 3',
    // Antworten
    'richtig':                  'Antwort: richtig (Gewinn-Pling)',
    'falsch-fehler':            'Antwort: falsch (Fehler-Ton)',
    'falsch-stimme':            'Antwort: falsch (Stimme "Wrong! No!")',
    'falsch-affe':              'Antwort: falsch ("Oh Monkey")',
    'falsch-posaune':           'Antwort: falsch (traurige Posaune)',
    'trommelwirbel':            'Trommelwirbel mit Schlag',
    // Effekte
    'explosion':                'Effekt: Explosion',
    'explosion-boeller':        'Effekt: Böller-Explosion',
    'wumms':                    'Effekt: Kino-Wumms',
    'schrotflinte':             'Effekt: Schrotflinte',
    'laser':                    'Effekt: Laserschuss',
    'aufprall-1':               'Effekt: Aufprall kurz',
    'aufprall-2':               'Effekt: Aufprall mittel',
    'aufprall-3':               'Effekt: Aufprall lang',
  };
  for (let i = 1; i <= 8; i++) FILES['schlag-' + i] = 'Kampf: Schlag/Tritt ' + i;
  for (let i = 1; i <= 10; i++) FILES['schmerz-' + i] = 'Kampf: Schmerzlaut ' + i;
  for (let i = 1; i <= 4; i++) FILES['schrei-ko-' + i] = 'Kampf: K.O.-Schrei ' + i;
  const range = (p, n) => Array.from({ length: n }, (_, i) => p + (i + 1));

  // ---------------------------------------------------------------------------------
  // SLOTS: wofür welcher Sound benutzt wird. file = Datei oder Liste (Zufall), vol = 0..1
  // group nur für die Anzeige im Editor.
  // ---------------------------------------------------------------------------------
  const SLOTS = {
    // Allgemein
    lobby:          { group: 'Allgemein', label: 'Lobby-Musik',                       file: 'musik-lobby-piano',        vol: 0.55, music: true },
    spiel_start:    { group: 'Allgemein', label: 'Spiel beginnt',                     file: 'fanfare-grand-prix',       vol: 0.8, duck: true },
    neue_frage:     { group: 'Allgemein', label: 'Neue Frage / neue Runde',           file: 'jingle-piano-schnoerkel',  vol: 0.6 },
    aufloesung:     { group: 'Allgemein', label: 'Auflösung (Trommelwirbel)',         file: 'trommelwirbel',            vol: 0.8, duck: true },
    richtig:        { group: 'Allgemein', label: 'Richtige Antwort',                  file: 'richtig',                  vol: 0.9 },
    richtig_gross:  { group: 'Allgemein', label: 'Richtig - großer Treffer',          file: 'jingle-gewinner-groovy',   vol: 0.8, duck: true },
    falsch:         { group: 'Allgemein', label: 'Falsche Antwort',                   file: ['falsch-posaune', 'falsch-stimme', 'falsch-affe', 'falsch-fehler'], vol: 0.85 },
    punkte_plus:    { group: 'Allgemein', label: 'Punkte bekommen',                   file: 'richtig',                  vol: 0.8 },
    punkte_minus:   { group: 'Allgemein', label: 'Punkte abgezogen',                  file: 'falsch-affe',              vol: 0.8 },
    buzzer:         { group: 'Allgemein', label: 'Buzzer gedrückt',                   file: 'aufprall-1',               vol: 0.9 },
    spiel_ende:     { group: 'Allgemein', label: 'Spiel vorbei',                      file: 'jingle-ende-news',         vol: 0.7, duck: true },
    // Musik je Spiel
    musik_spiel1:   { group: 'Musik je Spiel', label: 'Spiel 1 Kreuzverhör',          file: 'musik-news-countdown',     vol: 0.45, music: true },
    musik_spiel2:   { group: 'Musik je Spiel', label: 'Spiel 2 Rätselfeuer',          file: 'musik-unheimlich-loop',    vol: 0.5,  music: true },
    atmo_spiel2:    { group: 'Musik je Spiel', label: 'Spiel 2 Atmosphäre',           file: 'atmo-lagerfeuer',          vol: 0.7,  music: true },
    musik_spiel3:   { group: 'Musik je Spiel', label: 'Spiel 3 Schaf oder Wolf?',     file: 'musik-herzschlag',         vol: 0.55, music: true },
    musik_spiel4:   { group: 'Musik je Spiel', label: 'Spiel 4 Pi mal Daumen',        file: 'musik-quiz-loop',          vol: 0.45, music: true },
    musik_spiel5:   { group: 'Musik je Spiel', label: 'Spiel 5 Verpixelt!',           file: 'musik-sphaere-loop',       vol: 0.45, music: true },
    musik_spiel6:   { group: 'Musik je Spiel', label: 'Spiel 6 Film-Zündschnur (pausiert während der Clips)', file: 'musik-bereit', vol: 0.4, music: true },
    musik_spiel7:   { group: 'Musik je Spiel', label: 'Spiel 7 Mythos-Check',         file: 'musik-sphaere-loop',       vol: 0.4,  music: true },
    atmo_spiel7:    { group: 'Musik je Spiel', label: 'Spiel 7 Atmosphäre',           file: 'atmo-regen-gasse',         vol: 0.6,  music: true },
    musik_spiel8:   { group: 'Musik je Spiel', label: 'Spiel 8 Schriftzug-Salat',     file: 'musik-quiz-loop',          vol: 0.45, music: true },
    musik_spiel9:   { group: 'Musik je Spiel', label: 'Spiel 9 Zeitreise',            file: 'musik-news-countdown',     vol: 0.45, music: true },
    musik_spiel10:  { group: 'Musik je Spiel', label: 'Spiel 10',                     file: 'musik-news-countdown',     vol: 0.45, music: true },
    // Nebenspiele
    musik_snake:    { group: 'Nebenspiele', label: 'Snake - Musik',                   file: 'musik-beat-112',           vol: 0.45, music: true },
    musik_goldregen:{ group: 'Nebenspiele', label: 'Goldregen - Musik',               file: 'musik-beat-112',           vol: 0.45, music: true },
    musik_vier:     { group: 'Nebenspiele', label: 'Vier Gewinnt - Musik',            file: 'musik-bereit',             vol: 0.4,  music: true },
    musik_panzer:   { group: 'Nebenspiele', label: 'Panzerschlacht - Musik',          file: 'musik-bass',               vol: 0.45, music: true },
    musik_burstpipe:{ group: 'Nebenspiele', label: 'Burst Pipe - Musik',              file: 'musik-unheimlich-loop',    vol: 0.45, music: true },
    musik_ochs:     { group: 'Nebenspiele', label: 'Ochs vorm Berg - Musik (stoppt bei Rot)', file: 'musik-festlich',   vol: 0.55, music: true },
    musik_ccc:      { group: 'Nebenspiele', label: 'CCC Rechner - Musik',             file: 'musik-herzschlag',         vol: 0.4,  music: true },
    explosion:      { group: 'Nebenspiele', label: 'Explosion',                       file: ['explosion', 'explosion-boeller'], vol: 0.8 },
    schuss:         { group: 'Nebenspiele', label: 'Schuss',                          file: 'schrotflinte',             vol: 0.55 },
    aufprall:       { group: 'Nebenspiele', label: 'Aufprall / Stein fällt',          file: ['aufprall-1', 'aufprall-2'], vol: 0.6 },
    sieg_klein:     { group: 'Nebenspiele', label: 'Gewonnen (Nebenspiel)',           file: range('sieg-gitarre-', 3),  vol: 0.8, duck: true },
    verloren:       { group: 'Nebenspiele', label: 'Verloren / ausgeschieden',        file: ['falsch-posaune', 'falsch-affe'], vol: 0.8 },
    // Siegerehrung
    intro_normal:   { group: 'Intro / Ladebildschirm', label: 'Intro: Jungs hauen Zombies um', file: 'musik-kampf-start',   vol: 0.6 },
    intro_zwin:     { group: 'Intro / Ladebildschirm', label: 'Intro: Zombies gewinnen',        file: 'musik-unheimlich-loop', vol: 0.65 },
    intro_drop:     { group: 'Intro / Ladebildschirm', label: 'Intro: Jungs fallen vom Himmel', file: 'fanfare-lustig',      vol: 0.7 },
    musik_siegerehrung: { group: 'Siegerehrung', label: 'Hintergrundmusik',           file: 'musik-orchester-hoffnung', vol: 0.45, music: true },
    platz1:         { group: 'Siegerehrung', label: 'Platz 1 wird enthüllt',          file: 'fanfare-sieg-gross',       vol: 0.9, duck: true },
    platz2:         { group: 'Siegerehrung', label: 'Platz 2 wird enthüllt',          file: 'fanfare-sieg',             vol: 0.85, duck: true },
    platz3:         { group: 'Siegerehrung', label: 'Platz 3 wird enthüllt',          file: 'fanfare-mittelalter',      vol: 0.85, duck: true },
    platz_rest:     { group: 'Siegerehrung', label: 'Weitere Plätze',                 file: ['sting-sieg', 'fanfare-lustig'], vol: 0.75, duck: true },
    // Hirnschmalz-Fighter
    f_musik_pause:  { group: 'Hirnschmalz-Fighter', label: 'Musik Turnierplan / Pause', file: 'musik-kampf-start',      vol: 0.45, music: true },
    f_musik_hafen:  { group: 'Hirnschmalz-Fighter', label: 'Musik Hafen-Arena',       file: 'musik-kampf-hafen',        vol: 0.5,  music: true },
    f_atmo_hafen:   { group: 'Hirnschmalz-Fighter', label: 'Atmosphäre Hafen-Arena',  file: 'atmo-regen-gasse',         vol: 0.45, music: true },
    f_musik_kaefig: { group: 'Hirnschmalz-Fighter', label: 'Musik Käfig (Playoffs)',  file: 'musik-kampf-kaefig',       vol: 0.5,  music: true },
    f_musik_finale: { group: 'Hirnschmalz-Fighter', label: 'Musik Grand Finale',      file: 'musik-kampf-finale',       vol: 0.5,  music: true },
    f_schlag:       { group: 'Hirnschmalz-Fighter', label: 'Treffer',                 file: range('schlag-', 8),        vol: 0.9 },
    f_schmerz:      { group: 'Hirnschmalz-Fighter', label: 'Schmerzlaut (bei harten Treffern)', file: range('schmerz-', 10), vol: 0.75 },
    f_ko:           { group: 'Hirnschmalz-Fighter', label: 'K.O.-Schrei',             file: range('schrei-ko-', 4),     vol: 0.9 },
    f_ko_wumms:     { group: 'Hirnschmalz-Fighter', label: 'K.O.-Wumms',              file: 'wumms',                    vol: 0.9 },
    f_laser:        { group: 'Hirnschmalz-Fighter', label: 'Spezialangriff Laser',    file: 'laser',                    vol: 0.7 },
    f_feuerball:    { group: 'Hirnschmalz-Fighter', label: 'Spezialangriff Feuerball',file: 'explosion-boeller',        vol: 0.6 },
    f_superkraft:   { group: 'Hirnschmalz-Fighter', label: 'Superkraft aktiviert',    file: 'aufprall-3',               vol: 0.8 },
    f_kampfsieg:    { group: 'Hirnschmalz-Fighter', label: 'Kampf gewonnen',          file: 'sting-sieg',               vol: 0.85, duck: true },
    f_champion:     { group: 'Hirnschmalz-Fighter', label: 'Grand Champion',          file: 'fanfare-sieg-gross',       vol: 0.9, duck: true },
  };

  // ---------------------------------------------------------------------------------
  // WAS PASSIERT AUF WELCHER SEITE
  //   music:  Musik-Slot der Seite      atmo: zweite Spur (Geräusche)
  //   active: in diesen Spielphasen läuft die Musik voll, sonst leiser
  //   silent: in diesen Phasen ist die Musik ganz aus (z.B. Filmclips)
  //   on:     Phase -> Effekt-Slot, der beim Wechsel in diese Phase einmal spielt
  // ---------------------------------------------------------------------------------
  const QUIZ_ON = { question_shown: 'neue_frage', result: 'aufloesung', finished: 'spiel_ende' };
  const PAGES = {
    index:          { music: 'lobby' },
    cockpit:        {},   // bewusst ohne Musik
    'admin-cockpit':{},
    spiel1:  { music: 'musik_spiel1', active: ['options_shown'], on: QUIZ_ON, start: true },
    spiel2:  { music: 'musik_spiel2', atmo: 'atmo_spiel2', active: ['in_progress', 'story_shown', 'rolling', 'order_set'],
               on: { story_shown: 'neue_frage', solved: 'richtig_gross', evaluation: 'aufloesung' }, start: true },
    spiel3:  { music: 'musik_spiel3', active: ['options_shown'], on: QUIZ_ON, start: true },
    spiel4:  { music: 'musik_spiel4', active: ['input'], on: { input: 'neue_frage', result: 'aufloesung', finished: 'spiel_ende' }, start: true },
    spiel5:  { music: 'musik_spiel5', active: ['revealing'], on: { revealing: 'neue_frage', finished: 'spiel_ende' }, start: true },
    spiel6:  { music: 'musik_spiel6', silent: ['movie_playing'], on: { movie_result: 'aufloesung', movie_all_done: 'spiel_ende' }, start: true },
    spiel7:  { music: 'musik_spiel7', atmo: 'atmo_spiel7', active: ['options_shown'], on: QUIZ_ON, start: true },
    spiel8:  { music: 'musik_spiel8', active: ['guessing'], on: { guessing: 'neue_frage', evaluation: 'aufloesung', result: 'aufloesung' }, start: true },
    spiel9:  { music: 'musik_spiel9', active: ['input'], on: { input: 'neue_frage', result: 'aufloesung', finished: 'spiel_ende' }, start: true },
    spiel10: { music: 'musik_spiel10', active: ['input'], on: { input: 'neue_frage', result: 'aufloesung', finished: 'spiel_ende' }, start: true },
    snake:          { music: 'musik_snake' },
    goldregen:      { music: 'musik_goldregen' },
    'vier-gewinnt': { music: 'musik_vier' },
    panzer:         { music: 'musik_panzer' },
    ochsvormberg:   { music: 'musik_ochs' },
    'ccc-rechner':  { music: 'musik_ccc' },
    burstpipe:      { music: 'musik_burstpipe' },
    siegerehrung:   { music: 'musik_siegerehrung' },
    fighter:        { widget: false },   // Fighter hat eigene Ton-Knöpfe
    editor:         { widget: false },
    ueberwachung:   { widget: false },
  };

  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index';
  const PAGE = PAGES[page] || {};

  // ---------------------------------------------------------------------------------
  // EINSTELLUNGEN (pro Gerät)
  // ---------------------------------------------------------------------------------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  let musicVol = parseFloat(LS.get('hs_music_vol', '0.6'));
  let sfxVol = parseFloat(LS.get('hs_sfx_vol', '0.85'));
  let muted = LS.get('hs_muted', '0') === '1';
  let overrides = {};      // aus Firebase soundConfig/slots
  let volOverrides = {};   // aus Firebase soundConfig/vol

  function slotFiles(slot) {
    const o = overrides[slot];
    if (o === '-') return [];                       // im Editor ausgeschaltet
    const f = (o && FILES[o]) ? o : (SLOTS[slot] && SLOTS[slot].file);
    return !f ? [] : Array.isArray(f) ? f : [f];
  }
  function slotVol(slot) {
    const v = volOverrides[slot];
    return typeof v === 'number' ? v : ((SLOTS[slot] && SLOTS[slot].vol) || 0.8);
  }
  const url = (file) => BASE + file + '.mp3';

  // ---------------------------------------------------------------------------------
  // AUDIO-GRUNDGERÜST
  // ---------------------------------------------------------------------------------
  let AC = null, sfxBus = null, musicBus = null, unlocked = false;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) {
      AC = new C();
      sfxBus = AC.createGain(); sfxBus.connect(AC.destination);
      musicBus = AC.createGain(); musicBus.connect(AC.destination);
    }
  } catch (e) { AC = null; }
  function applyBus() {
    if (!AC) return;
    const t = AC.currentTime;
    sfxBus.gain.setTargetAtTime(muted ? 0 : sfxVol, t, 0.05);
    musicBus.gain.setTargetAtTime(muted ? 0 : musicVol, t, 0.05);
  }
  applyBus();

  function unlock() {
    if (unlocked) return;
    try { if (AC && AC.state === 'suspended') AC.resume(); } catch (e) {}
    const ok = !AC || AC.state === 'running';
    // Musik-Elemente brauchen einen eigenen play()-Aufruf innerhalb der Nutzer-Geste
    tracks.forEach(tr => { if (tr && tr.want) tr.el.play().catch(() => {}); });
    if (ok) { unlocked = true; updateWidget(); }
  }
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach(ev => window.addEventListener(ev, unlock, { capture: true }));
  if (AC) AC.onstatechange = () => { if (AC.state === 'running') { unlocked = true; updateWidget(); tracks.forEach(tr => tr && tr.want && tr.el.play().catch(() => {})); } };

  // ---------------------------------------------------------------------------------
  // EFFEKTE: kleine Dateien, vorab dekodiert
  // ---------------------------------------------------------------------------------
  const buffers = {}, loading = {};
  function loadBuf(file) {
    if (!AC) return Promise.reject();
    if (buffers[file]) return Promise.resolve(buffers[file]);
    if (!loading[file]) {
      loading[file] = fetch(url(file)).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(ab => new Promise((res, rej) => AC.decodeAudioData(ab, res, rej)))
        .then(b => (buffers[file] = b))
        .catch(e => { delete loading[file]; throw e; });
    }
    return loading[file];
  }
  const lastPick = {};
  function pick(slot) {
    const list = slotFiles(slot);
    if (list.length <= 1) return list[0];
    let i; do { i = Math.floor(Math.random() * list.length); } while (list.length > 2 && i === lastPick[slot]);
    lastPick[slot] = i; return list[i];
  }
  // Antwort-/Punkte-Töne warten, bis der Trommelwirbel seinen Schlag hatte
  const AFTER_REVEAL = ['richtig', 'richtig_gross', 'falsch', 'punkte_plus', 'punkte_minus'];
  let revealAt = 0;
  function play(slot, opt) {
    opt = opt || {};
    if (muted || sfxVol <= 0) return;
    if (slot === 'spiel_start' && introActive) return;   // das Intro hat seinen eigenen Jingle
    if (slot === 'aufloesung') revealAt = Date.now();
    const wait = AFTER_REVEAL.includes(slot) ? revealAt + 1700 - Date.now() : 0;
    if (wait > 0 && !opt._waited) { setTimeout(() => play(slot, Object.assign({}, opt, { _waited: true })), wait); return; }
    const file = pick(slot); if (!file) return;
    const asked = Date.now();
    if (!AC) { try { const a = new Audio(url(file)); a.volume = Math.min(1, slotVol(slot) * sfxVol * (opt.vol || 1)); a.play().catch(() => {}); } catch (e) {} return; }
    loadBuf(file).then(buf => {
      if (Date.now() - asked > (opt.maxDelay || 1500)) return;   // zu spät - lieber gar nicht
      if (AC.state !== 'running') return;
      const src = AC.createBufferSource(); src.buffer = buf;
      if (opt.rate) src.playbackRate.value = opt.rate;
      const g = AC.createGain(); g.gain.value = slotVol(slot) * (opt.vol || 1);
      src.connect(g); g.connect(sfxBus); src.start();
      if (opt.duck !== false && (opt.duck || (SLOTS[slot] && SLOTS[slot].duck))) duck(Math.min(buf.duration, 12));
    }).catch(() => {});
  }
  // Intro-Jingle für den Ladebildschirm (game-intro.js): läuft so lange wie das Intro, die
  // Spielmusik wird solange leiser gedreht. Ist der Ton noch gesperrt (Browser erlaubt Ton erst
  // nach dem ersten Klick auf der Seite), startet der Jingle beim ersten Klick nachträglich.
  let introActive = false;
  function introJingle(slot, ms) {
    const file = pick(slot);
    const st = { src: null, g: null, stopped: false, until: Date.now() + (ms || 9000) };
    if (!file || !AC) return { stop() {} };
    introActive = true;
    const start = () => {
      if (st.stopped || st.src || muted || sfxVol <= 0 || AC.state !== 'running') return;
      const left = st.until - Date.now();
      if (left < 800) return;
      loadBuf(file).then(buf => {
        if (st.stopped || st.src || AC.state !== 'running') return;
        const src = AC.createBufferSource(); src.buffer = buf;
        const g = AC.createGain(); const t = AC.currentTime, vol = slotVol(slot);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.15);
        const end = Math.min(buf.duration, (st.until - Date.now()) / 1000);
        g.gain.setValueAtTime(vol, t + Math.max(0.2, end - 0.7)); g.gain.linearRampToValueAtTime(0.0001, t + end);
        src.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + end + 0.05);
        st.src = src; st.g = g;
        duck(end);
      }).catch(() => {});
    };
    loadBuf(file).then(start).catch(() => {});
    const onUnlock = () => setTimeout(start, 60);
    ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, onUnlock, { capture: true }));
    st.stop = () => {
      if (st.stopped) return; st.stopped = true; introActive = false;
      ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.removeEventListener(ev, onUnlock, { capture: true }));
      if (st.src) { try { const t = AC.currentTime; st.g.gain.cancelScheduledValues(t); st.g.gain.setValueAtTime(st.g.gain.value, t); st.g.gain.linearRampToValueAtTime(0.0001, t + 0.5); st.src.stop(t + 0.55); } catch (e) {} }
      duckUntil = 0; refreshTracks(1.2);
    };
    return st;
  }

  // Kleine, live erzeugte Töne (für Dinge, die sehr oft passieren: Münze, Futter, Stein)
  function synth(kind, vol) {
    if (!AC || muted || sfxVol <= 0 || AC.state !== 'running') return;
    const t = AC.currentTime + 0.005, v = vol == null ? 1 : vol;
    const tone = (f, at, dur, type, g, f1) => {
      const o = AC.createOscillator(), gn = AC.createGain(); o.type = type || 'square';
      o.frequency.setValueAtTime(f, t + at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      gn.gain.setValueAtTime(0.0001, t + at); gn.gain.exponentialRampToValueAtTime(g * v, t + at + 0.005);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(gn); gn.connect(sfxBus); o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    if (kind === 'coin') { tone(988, 0, 0.08, 'square', 0.12); tone(1319, 0.075, 0.35, 'square', 0.12); }
    else if (kind === 'blip') { tone(660, 0, 0.09, 'square', 0.1, 1320); }
    else if (kind === 'drop') { tone(220, 0, 0.18, 'triangle', 0.35, 70); tone(1400, 0, 0.03, 'square', 0.05); }
    else if (kind === 'tick') { tone(1000, 0, 0.05, 'square', 0.08); }
    else if (kind === 'shot' || kind === 'boom') {
      // kurzer Knall aus Rauschen (Schuss) bzw. etwas tiefer/länger (Treffer-Explosion)
      const big = kind === 'boom', len = big ? 0.28 : 0.12;
      const n = Math.floor(AC.sampleRate * len), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, big ? 2.2 : 3.5);
      const src = AC.createBufferSource(); src.buffer = buf;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(big ? 1800 : 3800, t); lp.frequency.exponentialRampToValueAtTime(big ? 200 : 600, t + len);
      const g = AC.createGain(); g.gain.value = (big ? 0.55 : 0.32) * v;
      src.connect(lp); lp.connect(g); g.connect(sfxBus); src.start(t);
      if (big) tone(140, 0, 0.18, 'sine', 0.35, 50);
    }
  }
  function preload(slots) { slots.forEach(s => { const sl = SLOTS[s]; if (sl && !sl.music) slotFiles(s).forEach(f => loadBuf(f).catch(() => {})); }); }

  // ---------------------------------------------------------------------------------
  // MUSIK: zwei Spuren (Musik + Atmosphäre), gestreamt, mit Überblendung
  // ---------------------------------------------------------------------------------
  const tracks = [null, null];   // [musik, atmo]
  let level = 1, duckUntil = 0, duckTimer = null;
  function trackGainTarget(tr) {
    if (!tr) return 0;
    const d = Date.now() < duckUntil ? 0.3 : 1;
    return slotVol(tr.slot) * level * d * (tr.lvl || 1);
  }
  function setTrackGain(tr, target, time) {
    if (!tr) return;
    if (tr.g) { const t = AC.currentTime; tr.g.gain.cancelScheduledValues(t); tr.g.gain.setValueAtTime(tr.g.gain.value, t); tr.g.gain.linearRampToValueAtTime(target, t + (time || 0.6)); }
    else tr.el.volume = Math.max(0, Math.min(1, target * (muted ? 0 : musicVol)));
  }
  function setTrack(i, slot, opt) {
    opt = opt || {};
    const cur = tracks[i];
    const file = slot ? slotFiles(slot)[0] : null;
    if (cur && cur.slot === slot && cur.file === file) { cur.lvl = opt.lvl || 1; setTrackGain(cur, trackGainTarget(cur), opt.fade); return; }
    if (cur) {
      cur.want = false; tracks[i] = null;
      setTrackGain(cur, 0, opt.fade || 0.8);
      setTimeout(() => { try { cur.el.pause(); cur.el.removeAttribute('src'); cur.el.load(); } catch (e) {} }, ((opt.fade || 0.8) + 0.1) * 1000);
    }
    if (!file) return;
    const el = new Audio(); el.loop = true; el.preload = 'auto'; el.src = url(file);
    const tr = { slot, file, el, g: null, want: true, lvl: opt.lvl || 1 };
    if (AC) {
      try { const s = AC.createMediaElementSource(el); tr.g = AC.createGain(); tr.g.gain.value = 0; s.connect(tr.g); tr.g.connect(musicBus); }
      catch (e) { tr.g = null; }
    }
    if (!tr.g) el.volume = 0;
    tracks[i] = tr;
    el.play().catch(() => {});
    setTrackGain(tr, trackGainTarget(tr), opt.fade || 1.2);
  }
  function refreshTracks(t) { tracks.forEach(tr => setTrackGain(tr, trackGainTarget(tr), t)); }
  function duck(sec) {
    duckUntil = Math.max(duckUntil, Date.now() + sec * 1000);
    refreshTracks(0.25);
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => refreshTracks(1.5), duckUntil - Date.now() + 50);
  }
  function setLevel(l, t) { level = l; refreshTracks(t || 1); }

  // ---------------------------------------------------------------------------------
  // SPIELPHASEN: aus dem Firebase-Zustand der Spiele
  // ---------------------------------------------------------------------------------
  let lastStage, lastKey, stageInit = false, startPlayed = false;
  function stage(st, key) {
    if (st === undefined || st === null) st = 'waiting';
    const k = st + '|' + (key === undefined ? '' : key);
    const changed = stageInit && k !== lastKey;
    const first = !stageInit;
    stageInit = true; lastKey = k;
    const prev = lastStage; lastStage = st;
    // Musikpegel je Phase
    if (PAGE.silent && PAGE.silent.includes(st)) setLevel(0, 0.6);
    else if (PAGE.active) setLevel(PAGE.active.includes(st) ? 1 : 0.45, 1.2);
    else if (level !== 1) setLevel(1, 1.2);
    // Effekte nur bei echtem Wechsel (nicht beim Laden mitten im Spiel)
    if (first && PAGE.start && !startPlayed && ['waiting', 'intro'].includes(st)) { startPlayed = true; play('spiel_start'); }
    if (changed && st !== prev && PAGE.on && PAGE.on[st]) play(PAGE.on[st]);
  }
  const onceSet = new Set();
  function once(id, fn) { if (onceSet.has(id)) return; onceSet.add(id); try { fn(); } catch (e) {} }
  let explicitAt = 0;
  function result(ok, big) { explicitAt = Date.now(); play(ok ? (big ? 'richtig_gross' : 'richtig') : 'falsch'); }

  // Eigener Punktestand: steigt -> Pling, sinkt -> Abzug (wenn das Spiel nicht schon selbst was gespielt hat)
  function watchScore() {
    const pid = LS.get('quiz_player_id', null);
    if (!pid || !window.EventSource || ['editor', 'ueberwachung', 'admin-cockpit', 'fighter', 'siegerehrung'].includes(page)) return;
    let last = null;
    try {
      const es = new EventSource(DB_URL + '/players/' + encodeURIComponent(pid) + '/score.json');
      es.addEventListener('put', (ev) => {
        let v; try { v = JSON.parse(ev.data).data; } catch (e) { return; }
        if (typeof v !== 'number') return;
        if (last !== null && Date.now() - explicitAt > 5000) {
          if (v > last) play('punkte_plus'); else if (v < last) play('punkte_minus');
        }
        last = v;
      });
      es.onerror = () => { if (es.readyState === 2) es.close(); };
    } catch (e) {}
  }

  // Zuordnung aus dem Editor laden (falls die Datenbank das ohne Login erlaubt)
  function loadConfig() {
    return fetch(DB_URL + '/soundConfig.json').then(r => r.ok ? r.json() : null).then(cfg => {
      if (!cfg) return;
      overrides = cfg.slots || {}; volOverrides = cfg.vol || {};
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------------
  // LAUTSPRECHER-KNOPF
  // ---------------------------------------------------------------------------------
  let btn = null, panel = null;
  function updateWidget() {
    if (!btn) return;
    btn.textContent = muted ? '🔇' : (musicVol <= 0 && sfxVol <= 0 ? '🔈' : '🔊');
    btn.classList.toggle('hs-locked', !unlocked && !muted);
    btn.title = !unlocked ? 'Tippen, um den Ton einzuschalten' : 'Ton-Einstellungen';
  }
  function buildWidget() {
    if (PAGE.widget === false || btn) return;
    const css = document.createElement('style');
    css.textContent = `
      #hs-audio-btn{position:fixed;left:12px;bottom:12px;z-index:99990;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.6);
        background:rgba(20,16,40,.82);color:#fff;font-size:20px;line-height:40px;text-align:center;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35);padding:0}
      #hs-audio-btn.hs-locked{animation:hsPulse 1.4s ease-in-out infinite}
      @keyframes hsPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,210,63,.7)}50%{transform:scale(1.08);box-shadow:0 0 0 10px rgba(255,210,63,0)}}
      #hs-audio-panel{position:fixed;left:12px;bottom:64px;z-index:99991;background:rgba(20,16,40,.95);color:#fff;border-radius:14px;padding:12px 14px;
        font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45);min-width:210px;display:none}
      #hs-audio-panel label{display:block;margin:6px 0 2px;font-weight:600}
      #hs-audio-panel input[type=range]{width:100%}
      #hs-audio-panel button{margin-top:8px;width:100%;padding:6px;border-radius:8px;border:0;background:#ffd23f;color:#1a1a2e;font-weight:700;cursor:pointer}`;
    document.head.appendChild(css);
    btn = document.createElement('button'); btn.id = 'hs-audio-btn'; btn.type = 'button';
    panel = document.createElement('div'); panel.id = 'hs-audio-panel';
    panel.innerHTML = `<div style="font-weight:800;margin-bottom:4px">🔊 Ton</div>
      <label>🎵 Musik</label><input type="range" min="0" max="1" step="0.05" id="hs-mv">
      <label>💥 Effekte</label><input type="range" min="0" max="1" step="0.05" id="hs-sv">
      <button type="button" id="hs-mute"></button>`;
    document.body.appendChild(panel); document.body.appendChild(btn);
    const mv = panel.querySelector('#hs-mv'), sv = panel.querySelector('#hs-sv'), mb = panel.querySelector('#hs-mute');
    const sync = () => { mv.value = musicVol; sv.value = sfxVol; mb.textContent = muted ? 'Ton einschalten' : 'Alles stumm'; updateWidget(); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      unlock();
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; sync();
    });
    document.addEventListener('click', (e) => { if (panel.style.display === 'block' && !panel.contains(e.target) && e.target !== btn) panel.style.display = 'none'; });
    mv.addEventListener('input', () => { musicVol = +mv.value; LS.set('hs_music_vol', musicVol); applyBus(); refreshTracks(0.1); updateWidget(); });
    sv.addEventListener('input', () => { sfxVol = +sv.value; LS.set('hs_sfx_vol', sfxVol); applyBus(); updateWidget(); });
    sv.addEventListener('change', () => play('richtig'));
    mb.addEventListener('click', () => { muted = !muted; LS.set('hs_muted', muted ? '1' : '0'); applyBus(); refreshTracks(0.1); sync(); });
    sync();
  }

  // ---------------------------------------------------------------------------------
  // START
  // ---------------------------------------------------------------------------------
  function init() {
    buildWidget();
    loadConfig().then(() => {
      if (PAGE.music) setTrack(0, PAGE.music);
      if (PAGE.atmo) setTrack(1, PAGE.atmo);
      const pre = ['richtig', 'falsch', 'punkte_plus', 'punkte_minus'];
      if (PAGE.start) pre.push('spiel_start');
      if (PAGE.on) Object.values(PAGE.on).forEach(s => pre.push(s));
      preload(pre);
    });
    watchScore();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.HSAudio = {
    FILES, SLOTS, PAGES, page, url,
    play, preload, result, stage, duck, once, synth, introJingle,
    music: (slot, opt) => setTrack(0, slot, opt),
    atmo: (slot, opt) => setTrack(1, slot, opt),
    level: setLevel,
    sfxOn: () => !muted && sfxVol > 0,
    sfxVolume: () => (muted ? 0 : sfxVol),
    musicOn: () => !muted && musicVol > 0,
    isUnlocked: () => unlocked,
    _debug: () => ({ bus: AC ? { music: +musicBus.gain.value.toFixed(2), sfx: +sfxBus.gain.value.toFixed(2), state: AC.state } : null, level, muted, musicVol, sfxVol, tracks: tracks.map(t => t && { slot: t.slot, file: t.file, paused: t.el.paused, time: +t.el.currentTime.toFixed(1), gain: t.g ? +t.g.gain.value.toFixed(2) : t.el.volume }) }),
    setMuted(m) { muted = !!m; LS.set('hs_muted', muted ? '1' : '0'); applyBus(); refreshTracks(0.1); updateWidget(); },
    setOverrides(slots, vols) { overrides = slots || {}; volOverrides = vols || {}; },
    previewFile(file, vol) {          // für den Editor: Datei kurz anhören
      unlock();
      try { if (HSAudio._prev) HSAudio._prev.pause(); } catch (e) {}
      const a = new Audio(url(file)); a.volume = Math.max(0, Math.min(1, vol == null ? 0.8 : vol)); a.play().catch(() => {});
      HSAudio._prev = a; return a;
    },
    stopPreview() { try { if (HSAudio._prev) HSAudio._prev.pause(); } catch (e) {} },
  };
})();
