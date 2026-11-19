// ==== PUNKTE-BALANCE für die Hirnschmalz-Arena ====
// Jedes Wissensspiel ist gleich viel wert: wer ALLES richtig hat, holt höchstens
// QUIZ_BUDGET Punkte - egal ob das Spiel 4 oder 18 Fragen hat. Die Punkte, die im
// Editor pro Frage stehen, bleiben als Gewichtung erhalten (eine 300er-Frage zählt
// doppelt so viel wie eine 150er), werden aber auf dieses Budget umgerechnet.
// Actionspiele (Snake, Goldregen, Panzer, Fighter ...) sind so eingestellt, dass der
// Sieger etwa 300 Punkte bekommt - also ungefähr so viel wie ein sehr guter Quizspieler.
window.HSBalance = {
  QUIZ_BUDGET: 600,
  round5(x) { return Math.max(5, Math.round(x / 5) * 5); },
  // Rechnet die "points" einer Fragen-/Rundenliste auf das Budget um. Gibt den Faktor zurück.
  scaleList(list, budget, fallback) {
    if (!Array.isArray(list) || !list.length) return 1;
    budget = budget || this.QUIZ_BUDGET;
    const pts = list.map(q => (q && Number(q.points)) || fallback || 150);
    const sum = pts.reduce((a, b) => a + b, 0);
    const f = budget / sum;
    list.forEach((q, i) => { if (q) { q.points = this.round5(pts[i] * f); q._balanced = true; } });
    return f;
  }
};
