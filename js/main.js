/* =========================================================
   main.js — Landing Page: Scrollen morpht die Layouts
   ========================================================= */
(function () {
  const spacer = document.getElementById('spacer');
  const counter = document.getElementById('counter');
  const cCur = document.getElementById('counter-cur');
  const cMax = document.getElementById('counter-max');
  const infoBtn = document.getElementById('info-btn');
  const infoFig = document.getElementById('info-fig');

  let target = 0;      // Position in der Schlaufe, 0..n (Layout-Index als Kommazahl)
  let smooth = 0;      // nachlaufender Wert -> weiche Bewegung
  let lastKey = '';

  /* Die Seite ist eine Schlaufe. Dafür liegt oben und unten je ein Bildschirm
     Reserve (PAD). Verlässt die Position die Runde um mehr als SLACK, wird die
     Scrollposition um genau eine Runde versetzt — unsichtbar, weil Anfang und
     Ende derselbe Zustand sind. Der Rest der Reserve ist Luft, damit ein
     schneller Wisch nicht vorher an den Anschlag des Dokuments läuft. */
  const PAD = 1;
  const SLACK = 0.5;

  const L = GF.landing = {};

  const count = () => GF.state.layouts.length;
  const vh = () => Math.max(1, window.innerHeight);
  const looping = () => count() > 1;
  const band = () => ({ lo: PAD * vh(), hi: (count() + PAD) * vh() });
  const slack = () => SLACK * vh();

  L.resync = function () {
    const n = count();
    spacer.style.height = ((looping() ? n + 2 * PAD + 1 : 1) * vh()) + 'px';
    cMax.textContent = String(n).padStart(2, '0');
    counter.style.display = n > 1 ? '' : 'none';
    GF.invalidate();
    inBand();
    read();
    smooth = target;
    draw(true);
  };

  /* Der nächstgelegene Layout-Index — auch der Editor fragt danach */
  L.index = function () {
    const n = count();
    return ((Math.round(smooth) % n) + n) % n;
  };

  /* Ohne Animation an ein Layout springen */
  L.scrollToIndex = function (i) {
    window.scrollTo(0, (i + (looping() ? PAD : 0)) * vh());
  };

  /* Beim Start und nach Grössenänderungen: in die Bahn holen, ohne zu wickeln */
  function inBand() {
    if (!looping()) return;
    const b = band();
    if (window.scrollY < b.lo) window.scrollTo(0, b.lo);
    else if (window.scrollY > b.hi) window.scrollTo(0, b.hi);
  }

  /* Läuft man in die Reserve, eine ganze Runde versetzen */
  function wrap() {
    if (!looping()) return;
    const b = band(), span = count() * vh(), sl = slack();
    let sy = window.scrollY, d = 0;
    while (sy > b.hi + sl) { sy -= span; d -= count(); }
    while (sy < b.lo - sl) { sy += span; d += count(); }
    if (d) { window.scrollTo(0, sy); smooth += d; }
  }

  function read() {
    if (!looping()) { target = 0; return; }
    target = window.scrollY / vh() - PAD;
  }

  function draw(force) {
    const n = count();
    const u = ((smooth % n) + n) % n;          // 0..n, zyklisch
    const i = Math.min(n - 1, Math.floor(u));
    const t = GF.shape(u - i);

    const A = GF.state.layouts[i];
    const B = looping() ? GF.state.layouts[(i + 1) % n] : null;

    GF.render(GF.mix(A, B, B ? t : 0));

    const cur = (Math.round(u) % n) + 1;
    const key = String(cur);
    if (key !== lastKey) { cCur.textContent = key.padStart(2, '0'); lastKey = key; }
  }

  function loop() {
    if (!GF.editor.open) {
      wrap();
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
    const at = smooth;        // Position merken: eine Grössenänderung soll nicht
    spacer.style.height = ((looping() ? count() + 2 * PAD + 1 : 1) * vh()) + 'px';
    if (looping()) window.scrollTo(0, (at + PAD) * vh());   // aufs andere Layout rutschen
    inBand();
    fitScale();
  });

  /* ---------- Klick blättert weiter ----------
     Nicht selber animieren: es wird an die Scrollposition des nächsten
     Layouts gefahren, den Rest macht dieselbe Mechanik wie beim Scrollen.
     Nach dem letzten Layout geht es zurück auf das erste. */
  let clickGoal = null, clickAt = 0;

  L.next = function () {
    const n = count();
    if (n < 2) return;
    const now = performance.now();
    // schnelle Klicks hintereinander sollen weiterzählen, nicht stehenbleiben
    const from = (clickGoal != null && now - clickAt < 900) ? clickGoal : Math.round(smooth);
    let to = from + 1;
    if (to > n) {
      // über die Naht hinaus: vorher eine Runde zurücksetzen (unsichtbar,
      // die Position landet dabei innerhalb der Reserve)
      window.scrollTo(0, window.scrollY - n * vh());
      smooth -= n;
      to -= n;
      clickGoal = null;
    }
    clickGoal = to;
    clickAt = now;
    window.scrollTo({ top: (to + PAD) * vh(), behavior: 'smooth' });
  };

  document.addEventListener('click', function (e) {
    if (GF.editor.open) return;
    if (e.target.closest && e.target.closest('#hud')) return;   // „i“ und Vorlage
    if (infoJustClosed) { infoJustClosed = false; return; }     // der Klick hat nur das Bild weggenommen
    L.next();
  });

  /* ---------- „i“: die Vorlage einblenden ----------
     Sie bleibt nur stehen, solange man sie anschaut — ein Klick daneben,
     Scrollen oder ESC nimmt sie wieder weg. */
  function showInfo(on) {
    infoFig.hidden = !on;
    infoBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  infoBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    showInfo(infoFig.hidden);
  });

  let infoJustClosed = false;

  document.addEventListener('pointerdown', function (e) {
    if (infoFig.hidden) return;
    if (e.target === infoBtn || infoFig.contains(e.target)) return;   // aufs Bild darf man klicken
    showInfo(false);
    infoJustClosed = true;
  });

  window.addEventListener('scroll', function () {
    if (!infoFig.hidden) showInfo(false);
  }, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (infoFig.hidden) return;
    if (e.key === 'Escape') showInfo(false);
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
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.fonts && document.fonts.ready.then(() => draw(true));
    L.resync();
    requestAnimationFrame(loop);

    // #edit im URL öffnet den Editor — der einzige Weg hinein
    if (location.hash === '#edit') GF.editor.enter();
    window.addEventListener('hashchange', function () {
      if (location.hash === '#edit') GF.editor.enter();
    });
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
