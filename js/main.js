/* =========================================================
   main.js — Landing Page: Scrollen morpht die Layouts
   ========================================================= */
(function () {
  const spacer = document.getElementById('spacer');
  const counter = document.getElementById('counter');
  const cCur = document.getElementById('counter-cur');
  const cMax = document.getElementById('counter-max');

  let target = 0;      // Scroll-Position als Layout-Index (float)
  let smooth = 0;      // nachlaufender Wert -> weiche Bewegung
  let lastKey = '';

  const L = GF.landing = {};

  L.resync = function () {
    const n = GF.state.layouts.length;
    spacer.style.height = (n * window.innerHeight) + 'px';
    cMax.textContent = String(n).padStart(2, '0');
    counter.style.display = n > 1 ? '' : 'none';
    GF.invalidate();
    read();
    smooth = target;
    draw(true);
  };

  /* Direkt zu einer Position springen (Index als Kommazahl) */
  L.goto = function (v) {
    const n = GF.state.layouts.length;
    smooth = target = Math.max(0, Math.min(n - 1, v));
    window.scrollTo(0, smooth * window.innerHeight);
    draw(true);
  };

  function read() {
    const n = GF.state.layouts.length;
    const p = window.scrollY / Math.max(1, window.innerHeight);
    target = Math.max(0, Math.min(n - 1, p));
  }

  function draw(force) {
    const n = GF.state.layouts.length;
    const i = Math.min(n - 1, Math.floor(smooth));
    const raw = smooth - i;
    const t = GF.shape(raw);

    const A = GF.state.layouts[i];
    const B = GF.state.layouts[i + 1] || null;

    GF.render(GF.mix(A, B, B ? t : 0));

    const cur = Math.min(n, Math.round(smooth) + 1);
    const key = String(cur);
    if (key !== lastKey) { cCur.textContent = key.padStart(2, '0'); lastKey = key; }
  }

  function loop() {
    if (!GF.editor.open) {
      read();
      const d = target - smooth;
      if (Math.abs(d) > 0.0002) {
        smooth += d * 0.14;
        draw();
      }
    }
    requestAnimationFrame(loop);
  }

  /* Das SVG skaliert mit dem Fenster (viewBox 1160x800, „meet“). Derselbe
     Faktor geht an die CSS-Variable, damit der Zähler exakt so gross
     erscheint wie die kleine Typo im Blatt. */
  function fitScale() {
    const s = Math.min(window.innerWidth / GF.CANVAS.W, window.innerHeight / GF.CANVAS.H);
    document.documentElement.style.setProperty('--gf-scale', s);
  }

  window.addEventListener('resize', function () {
    const n = GF.state.layouts.length;
    spacer.style.height = (n * window.innerHeight) + 'px';
    fitScale();
  });

  /* Auf der Landing Page: T blendet die kleine Typo aus/ein */
  window.addEventListener('keydown', function (e) {
    if (GF.editor.open) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key === 't' || e.key === 'T') {
      GF.state.showSmallType = !GF.state.showSmallType;
      GF.save();
      draw(true);
    }
  });

  /* ---------- Start ----------
     Der eigene Browser merkt sich die Layouts im localStorage. Wer die Seite
     zum ersten Mal öffnet, hat dort nichts — darum liegt daneben eine
     layouts.json: das ist der Stand, den Besucher zu sehen bekommen.
     Erzeugt wird sie im Editor mit „Export“ (Datei neben index.html legen).
     Fehlt sie, gilt die Vorlage aus assets.js. */
  function start() {
    GF.normalizeLayouts();
    fitScale();
    document.fonts && document.fonts.ready.then(() => draw(true));
    L.resync();
    requestAnimationFrame(loop);

    // #edit im URL öffnet den Editor direkt (praktisch zum Verlinken)
    if (location.hash === '#edit') GF.editor.enter();
  }

  if (GF.load()) {
    start();
  } else {
    fetch('layouts.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(function (d) {
        if (d && Array.isArray(d.layouts) && d.layouts.length) {
          GF.state = Object.assign(GF.state, d);
        }
      })
      .catch(function () {})
      .then(start);
  }
})();
