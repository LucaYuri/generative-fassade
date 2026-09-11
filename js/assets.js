/* =========================================================
   assets.js — Bausteine der Fassade + Standard-Layout
   Die Pfade stammen 1:1 aus /Assets/*.svg
   ========================================================= */
window.GF = window.GF || {};

GF.CANVAS = { W: 1160, H: 800 };

/* Alle Assets erscheinen auf 64% ihrer Originalgrösse — so wie in der Vorlage. */
GF.BASE_SCALE = 0.64;

GF.SHAPES = {
  fenster_1: {
    name: 'Fenster 1', nw: 359, nh: 531,
    paths: ['M0 0H359V78H0V0Z', 'M0 98H359V531H0V98Z']
  },
  fenster_2: {
    name: 'Fenster 2', nw: 359, nh: 531,
    paths: ['M0 0H359V78H0V0Z', 'M0 98H359V531H0V98Z']
  },
  tuer: {
    name: 'Tür', nw: 168, nh: 638,
    paths: ['M0 0H168V78H0V0Z', 'M0 98H168V176H0V98Z', 'M0 196H168V638H0V196Z']
  },
  rotebank: {
    name: 'Rote Bank', nw: 399, nh: 104,
    paths: ['M0 0H399V20H0V0Z', 'M0 28H399V48H0V28Z', 'M0 56H399V76H0V56Z', 'M0 84H399V104H0V84Z']
  },
  velo: {
    name: 'Velo', nw: 342, nh: 148,
    paths: [
      'M342 74C342 114.869 308.869 148 268 148C227.131 148 194 114.869 194 74C194 33.1309 227.131 0 268 0C308.869 0 342 33.1309 342 74Z',
      'M148 74C148 114.869 114.869 148 74 148C33.1309 148 0 114.869 0 74C0 33.1309 33.1309 0 74 0C114.869 0 148 33.1309 148 74Z'
    ]
  }
};

/* Anzeigegrösse eines Bausteins (unrotiert) */
GF.shapeSize = function (type) {
  const s = GF.SHAPES[type];
  if (!s) return { w: 100, h: 100 };
  return { w: s.nw * GF.BASE_SCALE, h: s.nh * GF.BASE_SCALE };
};

/* Bounding-Box nach Rotation (Drehung immer um den Elementmittelpunkt) */
GF.bbox = function (el) {
  if (el.type === 'text') {
    const m = GF.textMetrics(el);
    return { x: el.x, y: el.y - m.ascent, w: m.w, h: m.h };
  }
  const s = GF.shapeSize(el.type);
  const swap = ((el.rot % 180) + 180) % 180 === 90;
  const w = swap ? s.h : s.w;
  const h = swap ? s.w : s.h;
  return { x: el.x + s.w / 2 - w / 2, y: el.y + s.h / 2 - h / 2, w: w, h: h };
};

/* Grobe Textmasse (nur für Kollisionen & Auswahlrahmen) */
GF.textMetrics = function (el) {
  const size = el.size || (el.style === 'head' ? 115 : 13.5);
  const lines = String(el.text || '').split('\n');
  const maxLen = lines.reduce((a, l) => Math.max(a, l.length), 0);
  const factor = el.style === 'head' ? 0.545 : 0.52;
  const lh = size * 1.32;
  return {
    w: maxLen * size * factor,
    h: (lines.length - 1) * lh + size,
    ascent: size * 0.76,
    lh: lh,
    size: size
  };
};

/* Die grosse Typo sitzt in jedem Layout an derselben Stelle und wird nicht
   bewegt — sie ist der ruhende Pol, um den herum sich die Fassade umbaut. */
/* Linke untere Ecke, 24 px Rand. y ist die Grundlinie — die Unterlänge des
   „g“ reicht 39 px darunter, darum sitzt die Grundlinie auf 737 und nicht
   weiter unten: sonst schneidet der Blattrand sie ab. */
GF.FIXED = {
  hd: { x: 24, y: 737, size: 126.5 }
};
GF.isFixed = function (id) { return Object.prototype.hasOwnProperty.call(GF.FIXED, id); };

/* Fester Satz: jedes Element gibt es genau einmal pro Layout.
   Die id ist die Identität — daran hängt auch die Animation zwischen Layouts. */
GF.ROSTER_NAMES = {
  f1: 'Fenster 1',
  tu: 'Tür',
  f2: 'Fenster 2',
  ve: 'Velo',
  rb: 'Rote Bank',
  ad: 'Adresse',
  em: 'E-Mail',
  hd: 'Headline'
};

GF.elName = function (el) {
  return GF.ROSTER_NAMES[el.id] || (GF.SHAPES[el.type] ? GF.SHAPES[el.type].name : 'Text');
};

/* Ein Element in seinem Ausgangszustand (aus der Vorlage) */
GF.rosterElement = function (id) {
  const e = GF.defaultLayout().els.find((x) => x.id === id);
  return e ? JSON.parse(JSON.stringify(e)) : null;
};

/* ---------------------------------------------------------
   Standard-Layout — exakt nach der Vorlage
   x/y = linke obere Ecke (Formen) bzw. linke Grundlinie (Text)
   cap = kleine Typo, capOff = Versatz ab Bounding-Box-Ecke
   --------------------------------------------------------- */
GF.defaultLayout = function () {
  return {
    id: 'vorlage',
    name: 'Vorlage',
    els: [
      { id: 'f1', type: 'fenster_1', x: 52,  y: 27,  rot: 0 },
      { id: 'tu', type: 'tuer',      x: 317, y: 27,  rot: 0 },
      { id: 'f2', type: 'fenster_2', x: 460, y: 27,  rot: 0, cap: 'Das Büro Spreng', capOff: [234, 75] },
      { id: 've', type: 'velo',      x: 8,   y: 388, rot: 0, cap: 'Irgendein Velo',  capOff: [195, 99] },
      { id: 'rb', type: 'rotebank',  x: 484, y: 386, rot: 0, cap: 'Rote Bank',       capOff: [263, 67] },

      { id: 'ad', type: 'text', x: 980, y: 434, rot: 0, style: 'small', text: 'Birsigstrasse 90\nCH-4054 Basel' },
      { id: 'em', type: 'text', x: 980, y: 563, rot: 0, style: 'small', text: 'spreng@buerospreng.ch' },
      { id: 'hd', type: 'text', x: GF.FIXED.hd.x, y: GF.FIXED.hd.y, rot: 0,
        style: 'head', size: GF.FIXED.hd.size, text: 'Rahmen gesprengt.' }
    ]
  };
};
