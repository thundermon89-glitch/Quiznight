/* =====================================================================================
   GIFs weiterlaufen lassen
   -------------------------------------------------------------------------------------
   Viele Spiele bauen ihre Karten bei jeder Änderung (z.B. wenn jemand antwortet) per
   innerHTML komplett neu auf. Verschwindet dabei kurz das letzte Bild mit dieser
   Quelle aus der Seite, setzt der Browser die GIF-Animation zurück - bei häufigen
   Updates wirkt das GIF dann eingefroren.
   Lösung: Für jedes animierte Bild bleibt ein 1-Pixel-"Anker" mit derselben Quelle
   dauerhaft sichtbar in der linken oberen Ecke (der Browser animiert nur sichtbare
   Bilder, deshalb nicht ganz unsichtbar). Dadurch läuft die Animation durchgehend
   weiter, egal wie oft die Karte neu gebaut wird.
   Einbinden: <script src="gif-keep.js"></script>
   ===================================================================================== */
(function () {
  if (window.__gifKeep || !window.MutationObserver) return;
  window.__gifKeep = true;

  const isAnimCandidate = (src) => !!src && (src.startsWith('data:image/gif') || src.startsWith('data:image/webp') || /\.(gif|webp)(\?|#|$)/i.test(src));
  const anchors = new Map();   // src -> anker-img
  let box = null;
  const MAX = 40;

  function anchor(src) {
    if (anchors.has(src) || !document.body) return;
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:absolute;left:0;top:' + (window.scrollY || 0) + 'px;width:1px;height:1px;overflow:hidden;pointer-events:none;z-index:2147483647';
      document.body.appendChild(box);
      // mitwandern, damit der Anker beim Scrollen im sichtbaren Bereich bleibt
      const follow = () => { box.style.top = (window.scrollY || 0) + 'px'; };
      window.addEventListener('scroll', follow, { passive: true });
    }
    if (anchors.size >= MAX) { const [k, el] = anchors.entries().next().value; el.remove(); anchors.delete(k); }
    const a = document.createElement('img');
    a.alt = ''; a.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;pointer-events:none';
    a.src = src;
    box.appendChild(a);
    anchors.set(src, a);
  }

  function scan(node) {
    if (node.nodeType !== 1 || node === box || (box && box.contains(node))) return;
    if (node.tagName === 'IMG') { const s = node.getAttribute('src'); if (isAnimCandidate(s)) anchor(s); return; }
    if (node.getElementsByTagName) for (const img of node.getElementsByTagName('img')) { const s = img.getAttribute('src'); if (isAnimCandidate(s)) anchor(s); }
  }

  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { if (r.target.tagName === 'IMG') scan(r.target); continue; }
      for (const n of r.addedNodes) scan(n);
    }
  });
  const start = () => {
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    if (document.body) scan(document.body);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
