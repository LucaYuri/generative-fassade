/* =========================================================
   state.js — Datenmodell, Speicherung, generative Regeln
   ========================================================= */
(function () {
  const KEY = 'gf.fassade.v1';

  GF.state = {
    layouts: [GF.defaultLayout()],
    showSmallType: true,
    showGrid: false,
    grid: 10,
    snap: false,
    rotSnap: false
  };

  GF.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(GF.state)); } catch (e) {}
  };

  GF.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.layouts) || !d.layouts.length) return false;
      GF.state = Object.assign(GF.state, d);
      GF.normalizeLayouts();
      return true;
    } catch (e) { return false; }
  };

  /* Sorgt dafür, dass jedes Layout die fixen Elemente hat — und zwar an
     ihrer festen Position. Läuft nach dem Laden und nach jedem Import. */
  GF.normalizeLayouts = function () {
    const order = GF.defaultLayout().els.map((e) => e.id);
    GF.state.layouts.forEach(function (L) {
      if (!Array.isArray(L.els)) L.els = [];
      Object.keys(GF.FIXED).forEach(function (id) {
        let el = L.els.find((e) => e.id === id);
        if (!el) { el = GF.rosterElement(id); L.els.push(el); }
        el.x = GF.FIXED[id].x;
        el.y = GF.FIXED[id].y;
        el.rot = 0;
      });
      L.els.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    });
  };

  GF.resetDefault = function () {
    GF.state.layouts = [GF.defaultLayout()];
    GF.state.showSmallType = true;
    GF.save();
  };

  GF.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  GF.uid = function (p) {
    return (p || 'x') + Math.random().toString(36).slice(2, 7);
  };

  /* ---------- Zufallsgenerator (seeded, damit reproduzierbar) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function overlaps(a, b, gap) {
    return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x ||
             a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);
  }

  /* ---------------------------------------------------------
     Generative Regeln
     · Rotation ausschliesslich in 90°-Schritten (keine Diagonalen)
     · Positionen auf 4-px-Raster
     · Bausteine überlappen sich nicht (Mindestabstand)
     · Headline bleibt unten, Infotexte bleiben in der rechten Spalte
     --------------------------------------------------------- */
  GF.generateLayout = function (seed, index) {
    const rnd = mulberry32(seed >>> 0);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const snap4 = (v) => Math.round(v / 4) * 4;

    const W = GF.CANVAS.W;
    const AREA = { x0: 4, y0: 20, x1: W - 4, y1: 630 };   // Spielfeld der Bausteine

    const parts = [
      { id: 'f1', type: 'fenster_1' },
      { id: 'tu', type: 'tuer' },
      { id: 'f2', type: 'fenster_2', cap: 'Das Büro Spreng' },
      { id: 've', type: 'velo',      cap: 'Irgendein Velo' },
      { id: 'rb', type: 'rotebank',  cap: 'Rote Bank' }
    ];

    const adText = 'Birsigstrasse 90\nCH-4054 Basel';
    const emText = 'spreng@buerospreng.ch';
    const wInfo = Math.max(
      GF.textMetrics({ text: adText, style: 'small' }).w,
      GF.textMetrics({ text: emText, style: 'small' }).w
    );

    /* Ein Platzierungsversuch mit gegebenem Mindestabstand */
    function attempt(gap) {
      const els = [];
      const taken = [];

      /* Infotexte: rechte Spalte */
      const infoX = Math.min(snap4(880 + rnd() * 120), snap4(W - 24 - wInfo));
      const adY = snap4(360 + rnd() * 170);
      const emY = Math.min(snap4(adY + 90 + rnd() * 90), 660);
      const ad = { id: 'ad', type: 'text', x: infoX, y: adY, rot: 0, style: 'small', text: adText };
      const em = { id: 'em', type: 'text', x: infoX, y: emY, rot: 0, style: 'small', text: emText };
      els.push(ad, em);
      taken.push(GF.bbox(ad), GF.bbox(em));

      /* Bausteine: Position + Rotation in 90°-Schritten */
      for (let n = 0; n < parts.length; n++) {
        const p = parts[n];
        const el = { id: p.id, type: p.type, x: 0, y: 0, rot: 0 };
        if (p.cap) el.cap = p.cap;    // capOff bleibt offen -> Label rückt automatisch an die Ecke
        const capW = p.cap ? GF.textMetrics({ text: p.cap, style: 'small' }).w + 16 : 0;

        let placed = false;
        for (let tries = 0; tries < 600 && !placed; tries++) {
          el.rot = pick([0, 90, 180, 270]);
          const bb0 = GF.bbox(Object.assign({}, el, { x: 0, y: 0 }));

          const maxX = AREA.x1 - bb0.w - capW;
          const maxY = AREA.y1 - bb0.h;
          if (maxX <= AREA.x0 || maxY <= AREA.y0) continue;

          const bx = snap4(AREA.x0 + rnd() * (maxX - AREA.x0));
          const by = snap4(AREA.y0 + rnd() * (maxY - AREA.y0));
          const box = { x: bx, y: by, w: bb0.w, h: bb0.h };
          const test = capW ? { x: bx, y: by, w: bb0.w + capW, h: bb0.h + 8 } : box;

          if (taken.some((t) => overlaps(test, t, gap))) continue;

          el.x = bx - bb0.x;          // bb0.x/y = Versatz Ursprung -> Bounding-Box
          el.y = by - bb0.y;
          taken.push(test);
          placed = true;
        }
        if (!placed) return null;     // dieser Versuch ist gescheitert
        els.push(el);
      }

      /* Headline: in jedem Layout an derselben Stelle */
      els.push(GF.rosterElement('hd'));

      /* Reihenfolge wie in der Vorlage, damit die Typo oben liegt */
      const order = ['f1', 'tu', 'f2', 've', 'rb', 'ad', 'em', 'hd'];
      els.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      return els;
    }

    let els = null;
    for (const gap of [16, 16, 16, 16, 16, 16, 16, 16, 10, 10, 6, 6, 2, 2]) {
      els = attempt(gap);
      if (els) break;
    }
    if (!els) els = GF.defaultLayout().els;   // sollte praktisch nie vorkommen

    const n = (index == null ? GF.state.layouts.length : index) + 1;
    return {
      id: GF.uid('l'),
      name: 'Generativ ' + String(n).padStart(2, '0'),
      seed: seed >>> 0,
      els: els
    };
  };

  GF.addGenerated = function (count) {
    for (let i = 0; i < (count || 1); i++) {
      GF.state.layouts.push(GF.generateLayout((Math.random() * 4294967296) >>> 0));
    }
    GF.save();
  };

  GF.emptyLayout = function () {
    return {
      id: GF.uid('l'),
      name: 'Layout ' + String(GF.state.layouts.length + 1).padStart(2, '0'),
      els: [{ id: 'hd', type: 'text', x: GF.FIXED.hd.x, y: GF.FIXED.hd.y, rot: 0,
              style: 'head', size: 115, text: 'Rahmen gesprengt.' }]
    };
  };
})();
