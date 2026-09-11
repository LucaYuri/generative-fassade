/* =========================================================
   editor.js — versteckter Editor (nur über #edit, zurück mit ESC)
   ========================================================= */
(function () {
  const dom = {
    editor:  document.getElementById('editor'),
    panel:   document.getElementById('ed-panel'),
    layList: document.getElementById('lay-list'),
    insp:    document.getElementById('insp'),
    palette: document.getElementById('palette'),
    btnSmall:document.getElementById('btn-small'),
    btnGrid: document.getElementById('btn-grid'),
    btnRot:  document.getElementById('btn-rot'),
    fileIn:  document.getElementById('file-in')
  };

  const ED = GF.editor = {
    open: false,
    index: 0,
    selection: []              // ids der gewählten Elemente (Mehrfachauswahl)
  };

  const layout = () => GF.state.layouts[ED.index];

  /* Die gewählten Elemente, in der Reihenfolge des Layouts */
  function selAll() {
    return layout().els.filter((e) => ED.selection.indexOf(e.id) >= 0);
  }
  /* Das erste gewählte Element — für die Einzelfelder im Inspector */
  const sel = () => selAll()[0] || null;

  function setSelection(ids) {
    ED.selection = (ids || []).filter((id) => !GF.isFixed(id));
  }
  function isSelected(id) { return ED.selection.indexOf(id) >= 0; }

  /* Umschliessende Box mehrerer Elemente */
  function groupBox(els) {
    const b = els.map(GF.bbox);
    const x0 = Math.min.apply(null, b.map((o) => o.x));
    const y0 = Math.min.apply(null, b.map((o) => o.y));
    const x1 = Math.max.apply(null, b.map((o) => o.x + o.w));
    const y1 = Math.max.apply(null, b.map((o) => o.y + o.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------------- Öffnen / Schliessen ----------------
     Wichtig: das Blatt darf beim Öffnen nicht springen. Wird die Seite auf
     overflow:hidden gestellt, verschwindet die Scrollbar und der Viewport
     wird um deren Breite breiter — das SVG skaliert neu und alles rutscht.
     Darum messen wir die Breite und halten die Bühne exakt gleich gross. */
  function lockScroll(on) {
    const root = document.documentElement;
    if (on) {
      const sbw = window.innerWidth - root.clientWidth;
      root.style.setProperty('--sbw', sbw + 'px');
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
      root.style.setProperty('--sbw', '0px');
    }
  }

  ED.enter = function () {
    if (ED.open) return;
    ED.open = true;
    /* Der Editor öffnet das Layout, das gerade auf dem Schirm steht —
       sonst springt die Fassade beim Öffnen auf Layout 01 zurück. */
    ED.index = Math.min(GF.state.layouts.length - 1, GF.landing.index());
    dom.editor.hidden = false;
    dom.editor.classList.remove('ui-hidden');
    lockScroll(true);
    document.body.classList.add('edit-mode');
    document.getElementById('counter').classList.add('hide');
    GF.drawGrid(GF.state.showGrid);
    ED.refresh();
  };

  ED.exit = function () {
    if (!ED.open) return;
    ED.open = false;
    ED.selection = [];
    dom.editor.hidden = true;
    document.body.classList.remove('edit-mode');
    lockScroll(false);
    document.getElementById('counter').classList.remove('hide');
    GF.drawGrid(false);
    drawSelection();
    GF.save();
    GF.landing.scrollToIndex(ED.index);
    GF.landing.resync();
  };

  /* ---------------- Zeichnen ---------------- */
  ED.refresh = function () {
    GF.render(GF.clone(layout().els));
    drawSelection();
    buildLayoutList();
    buildInspector();
    buildPalette();
    dom.btnSmall.classList.toggle('on', GF.state.showSmallType);
    dom.btnGrid.classList.toggle('on', GF.state.showGrid);
    dom.btnRot.classList.toggle('on', GF.state.rotSnap);
  };

  function drawSelection(guides) {
    GF.layerUI.textContent = '';
    if (!ED.open) return;

    (guides || []).forEach(function (g) {
      GF.layerUI.appendChild(GF.node('line', {
        class: 'guide', x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2
      }));
    });

    const els = selAll();

    els.forEach(function (el) {
      const bb = GF.bbox(el);
      GF.layerUI.appendChild(GF.node('rect', {
        class: 'sel-box', x: bb.x - 4, y: bb.y - 4, width: bb.w + 8, height: bb.h + 8
      }));
      if (els.length === 1) dots(bb, 4);
    });

    /* Bei mehreren Elementen zeigt die äussere Box, was zusammen bewegt
       und gedreht wird — sie ist auch die Drehachse. */
    if (els.length > 1) {
      const gb = groupBox(els);
      GF.layerUI.appendChild(GF.node('rect', {
        class: 'sel-group', x: gb.x - 9, y: gb.y - 9, width: gb.w + 18, height: gb.h + 18
      }));
      dots(gb, 9);
    }

    if (marquee) {
      GF.layerUI.appendChild(GF.node('rect', {
        class: 'marquee', x: marquee.x, y: marquee.y, width: marquee.w, height: marquee.h
      }));
    }

    function dots(bb, pad) {
      [[bb.x - pad, bb.y - pad], [bb.x + bb.w + pad, bb.y - pad],
       [bb.x - pad, bb.y + bb.h + pad], [bb.x + bb.w + pad, bb.y + bb.h + pad]]
        .forEach(function (p) {
          GF.layerUI.appendChild(GF.node('rect', { class: 'sel-dot', x: p[0] - 2.5, y: p[1] - 2.5, width: 5, height: 5 }));
        });
    }
  }

  /* ---------------- Layout-Liste ---------------- */
  function buildLayoutList() {
    dom.layList.textContent = '';
    GF.state.layouts.forEach(function (L, i) {
      const li = document.createElement('li');
      li.className = 'lay-item' + (i === ED.index ? ' active' : '');

      const idx = document.createElement('span');
      idx.className = 'lay-idx';
      idx.textContent = String(i + 1).padStart(2, '0');
      li.appendChild(idx);

      const name = document.createElement('input');
      name.className = 'lay-name';
      name.value = L.name;
      name.addEventListener('input', () => { L.name = name.value; GF.save(); });
      name.addEventListener('focus', () => selectLayout(i));
      li.appendChild(name);

      // Achtung: die Liste wird bei jeder Auswahl neu gebaut. Darum erst auf
      // 'click' reagieren und Klicks auf die Knöpfe hier durchlassen —
      // sonst ist der Knopf weg, bevor sein eigener Klick ankommt.
      li.addEventListener('click', function (e) {
        if (e.target === name || e.target.closest('button')) return;
        selectLayout(i);
      });

      mini(li, '↑', 'Nach oben', function (e) { e.stopPropagation(); move(i, -1); });
      mini(li, '↓', 'Nach unten', function (e) { e.stopPropagation(); move(i, 1); });
      mini(li, '✕', 'Layout löschen', function (e) { e.stopPropagation(); removeLayout(i); });

      dom.layList.appendChild(li);
    });
  }

  function mini(parent, label, title, fn) {
    const b = document.createElement('button');
    b.className = 'btn sm';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', fn);
    parent.appendChild(b);
  }

  function selectLayout(i) {
    ED.index = i;
    setSelection([]);
    GF.invalidate();
    ED.refresh();
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= GF.state.layouts.length) return;
    const a = GF.state.layouts;
    [a[i], a[j]] = [a[j], a[i]];
    ED.index = j;
    GF.save(); ED.refresh();
  }

  function removeLayout(i) {
    if (GF.state.layouts.length === 1) return;
    GF.state.layouts.splice(i, 1);
    ED.index = Math.max(0, Math.min(ED.index, GF.state.layouts.length - 1));
    setSelection([]);
    GF.invalidate(); GF.save(); ED.refresh();
  }

  /* ---------------- Inspector ---------------- */
  function buildInspector() {
    dom.insp.textContent = '';
    const els = selAll();

    if (!els.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Kein Element gewählt. Klick auf einen Baustein, oder mit der Maus ' +
                      'ein Feld aufziehen für mehrere. ⇧-Klick nimmt einzelne dazu.';
      dom.insp.appendChild(p);
      return;
    }

    if (els.length > 1) { multiInspector(els); return; }

    const el = els[0];

    const kind = document.createElement('div');
    kind.className = 'kind';
    kind.textContent = GF.elName(el);
    dom.insp.appendChild(kind);

    num('X', el.x, (v) => { el.x = v; commit(); });
    num('Y', el.y, (v) => { el.y = v; commit(); });

    const rotRow = row();
    const lab = document.createElement('label');
    lab.textContent = String(norm(el.rot)) + '°';
    rotRow.appendChild(lab);
    const grp = document.createElement('div');
    grp.className = 'grp';
    btn(grp, '↺ 90°', () => rotate(-90));
    btn(grp, '↻ 90°', () => rotate(90));
    rotRow.appendChild(grp);
    dom.insp.appendChild(rotRow);

    if (el.type === 'text') {
      txt('Text', el.text, (v) => { el.text = v; GF.invalidate(); commit(); }, true);
      num('Grösse', el.size || 13.5, (v) => { el.size = v; commit(); });
    } else {
      txt('Label', el.cap || '', function (v) {
        if (v.trim()) el.cap = v; else delete el.cap;
        GF.invalidate(); commit();
      });
      if (el.cap) {
        const off = GF.capOffset(el);
        num('L-X', Math.round(off[0]), (v) => { el.capOff = [v, GF.capOffset(el)[1]]; commit(); });
        num('L-Y', Math.round(off[1]), (v) => { el.capOff = [GF.capOffset(el)[0], v]; commit(); });
        const r = row();
        btn(r, 'Label zurücksetzen', () => { delete el.capOff; commit(); });
        dom.insp.appendChild(r);
      }
    }

    const r1 = row();
    btn(r1, 'Nach vorn', () => reorder(1));
    btn(r1, 'Nach hinten', () => reorder(-1));
    dom.insp.appendChild(r1);

    const r2 = row();
    btn(r2, '✕ Löschen', deleteEl);
    dom.insp.appendChild(r2);

    /* Mehrere Elemente: X / Y verschieben die ganze Gruppe, die Drehung
       dreht sie um ihre gemeinsame Mitte. */
    function multiInspector(list) {
      const gb = groupBox(list);

      const k = document.createElement('div');
      k.className = 'kind';
      k.textContent = list.length + ' Elemente';
      dom.insp.appendChild(k);

      const names = document.createElement('p');
      names.className = 'empty';
      names.textContent = list.map(GF.elName).join(', ');
      dom.insp.appendChild(names);

      num('X', gb.x, (v) => { moveBy(v - gb.x, 0); });
      num('Y', gb.y, (v) => { moveBy(0, v - gb.y); });

      const rr = row();
      const rl = document.createElement('label');
      rl.textContent = 'Dreh';
      rr.appendChild(rl);
      const rg = document.createElement('div');
      rg.className = 'grp';
      btn(rg, '↺ 90°', () => rotate(-90));
      btn(rg, '↻ 90°', () => rotate(90));
      rr.appendChild(rg);
      dom.insp.appendChild(rr);

      const rd = row();
      btn(rd, '✕ Löschen', deleteEl);
      dom.insp.appendChild(rd);
    }

    function row() { const d = document.createElement('div'); d.className = 'field'; return d; }
    function btn(p, label, fn) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = label;
      b.addEventListener('click', fn); p.appendChild(b); return b;
    }
    function num(label, val, fn) {
      const d = row();
      const l = document.createElement('label'); l.textContent = label; d.appendChild(l);
      const i = document.createElement('input');
      i.type = 'number'; i.value = Math.round(val * 10) / 10; i.step = 1;
      i.addEventListener('change', () => fn(parseFloat(i.value) || 0));
      d.appendChild(i); dom.insp.appendChild(d);
    }
    function txt(label, val, fn, multi) {
      const d = row();
      const l = document.createElement('label'); l.textContent = label; d.appendChild(l);
      const i = document.createElement('input');
      i.type = 'text';
      i.value = multi ? String(val).replace(/\n/g, ' ⏎ ') : val;
      i.addEventListener('change', function () {
        fn(multi ? i.value.replace(/\s*⏎\s*/g, '\n') : i.value);
      });
      d.appendChild(i); dom.insp.appendChild(d);
    }
  }

  const norm = (r) => ((Math.round(r || 0) % 360) + 360) % 360;

  function commit() {
    GF.save();
    ED.refresh();
  }

  /* ---------------- Element-Aktionen ----------------
     Alles arbeitet auf der ganzen Auswahl. Bei einem Element ist die
     Gruppenmitte die Elementmitte — dann kommt genau das Alte heraus. */

  /* Mitte der Bounding-Box setzen (unabhängig von der Drehung) */
  function setCenter(el, cx, cy) {
    const bb = GF.bbox(el);
    el.x += cx - (bb.x + bb.w / 2);
    el.y += cy - (bb.y + bb.h / 2);
  }

  function rotate(delta) {
    const els = selAll().filter((e) => !GF.isFixed(e.id));
    if (!els.length) return;
    const gb = groupBox(els);
    const cx = gb.x + gb.w / 2, cy = gb.y + gb.h / 2;
    const cw = delta > 0;                      // im Uhrzeigersinn?

    els.forEach(function (el) {
      const bb = GF.bbox(el);
      const dx = bb.x + bb.w / 2 - cx, dy = bb.y + bb.h / 2 - cy;
      el.rot = norm((el.rot || 0) + delta);    // immer 90°-Schritte, nie diagonal
      delete el.capOff;                        // Label rückt an die neue Ecke
      // Die Mitte wandert mit um die Gruppenmitte (y zeigt nach unten)
      setCenter(el, cw ? cx - dy : cx + dy, cw ? cy + dx : cy - dx);
    });
    commit();
  }

  function moveBy(dx, dy) {
    const els = selAll().filter((e) => !GF.isFixed(e.id));
    if (!els.length) return;
    els.forEach(function (el) { el.x += dx; el.y += dy; });
    commit();
  }

  function nudge(dx, dy) { moveBy(dx, dy); }

  function deleteEl() {
    const els = selAll().filter((e) => !GF.isFixed(e.id));
    if (!els.length) return;
    const list = layout().els;
    els.forEach(function (el) { list.splice(list.indexOf(el), 1); });
    setSelection([]);
    GF.invalidate(); commit();
  }

  function reorder(dir) {
    const el = sel(); if (!el || ED.selection.length !== 1) return;
    const els = layout().els;
    const i = els.indexOf(el), j = i + dir;
    if (j < 0 || j >= els.length) return;
    [els[i], els[j]] = [els[j], els[i]];
    GF.invalidate(); commit();
  }

  function addElement(id) {
    if (layout().els.some((e) => e.id === id)) return;   // gibt es schon
    const el = GF.rosterElement(id);
    if (!el) return;
    layout().els.push(el);
    sortEls();
    setSelection([el.id]);
    GF.invalidate(); commit();
  }

  /* Reihenfolge wie in der Vorlage halten, damit die Typo oben liegt */
  function sortEls() {
    const order = GF.defaultLayout().els.map((e) => e.id);
    layout().els.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }

  function buildPalette() {
    dom.palette.textContent = '';
    const present = new Set(layout().els.map((e) => e.id));
    GF.defaultLayout().els.forEach(function (r) {
      if (GF.isFixed(r.id)) return;              // sitzt fest, kein Einsetzen nötig
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = (present.has(r.id) ? '· ' : '+ ') + GF.elName(r);
      b.disabled = present.has(r.id);
      b.title = present.has(r.id) ? 'Ist bereits im Layout' : 'Ins Layout einsetzen';
      b.addEventListener('click', () => addElement(r.id));
      dom.palette.appendChild(b);
    });
  }

  /* ---------------- Ausrichten an den anderen Elementen ----------------
     Fanglinien sind: bei Bausteinen die Kanten und die Mitte, bei Typo die
     linke Kante und die Grundlinie (die einzigen exakten Werte — die Breite
     von Text ist nur geschätzt), dazu Rand und Mitte des Blattes.
     ⌥ beim Ziehen schaltet das Ausrichten aus.                            */
  const SNAP_PX = 6;

  /* Fangpunkte eines Elements: xs / ys sind die Linien, box dient der Länge
     der eingeblendeten Hilfslinie. */
  function anchors(box, isText) {
    return isText
      ? { xs: [box.x], ys: [box.base], box: box }
      : { xs: [box.x, box.x + box.w / 2, box.x + box.w],
          ys: [box.y, box.y + box.h / 2, box.y + box.h], box: box };
  }

  function textBox(el) {                       // Textelement: y = Grundlinie
    const b = GF.bbox(el);
    return { x: b.x, y: b.y, w: b.w, h: b.h, base: el.y };
  }

  function labelBox(el) {                      // kleine Typo an einem Baustein
    const b = GF.capBox(el);
    const bb = GF.bbox(el);
    b.base = bb.y + GF.capOffset(el)[1];
    return b;
  }

  /* skipBox / skipCap: Mengen von ids, die nicht als Ziel gelten —
     alles, was gerade selber mitwandert. */
  function snapTargets(skipBox, skipCap) {
    const out = [];
    const inBox = (id) => skipBox && skipBox.has(id);
    const inCap = (id) => skipCap && skipCap.has(id);
    layout().els.forEach(function (o) {
      const hidden = o.type === 'text' && o.style === 'small' && !GF.state.showSmallType;
      if (!hidden && !inBox(o.id)) {
        out.push(o.type === 'text' ? anchors(textBox(o), true) : anchors(GF.bbox(o), false));
      }
      if (o.cap && GF.state.showSmallType && !inCap(o.id)) {
        out.push(anchors(labelBox(o), true));
      }
    });
    out.push(anchors({ x: 0, y: 0, w: GF.CANVAS.W, h: GF.CANVAS.H }, false));   // Blatt
    return out;
  }

  /* mov = Fangpunkte an der rohen Mausposition. Liefert Versatz + Hilfslinien. */
  function alignSnap(mov, skipBox, skipCap) {
    const targets = snapTargets(skipBox, skipCap);
    let bx = null, by = null;

    targets.forEach(function (t) {
      t.xs.forEach(function (v) {
        mov.xs.forEach(function (m) {
          const d = v - m;
          if (Math.abs(d) <= SNAP_PX && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d: d, pos: v, t: t.box };
        });
      });
      t.ys.forEach(function (v) {
        mov.ys.forEach(function (m) {
          const d = v - m;
          if (Math.abs(d) <= SNAP_PX && (!by || Math.abs(d) < Math.abs(by.d))) by = { d: d, pos: v, t: t.box };
        });
      });
    });

    const dx = bx ? bx.d : 0;
    const dy = by ? by.d : 0;
    const b = mov.box;
    const guides = [];
    if (bx) {
      guides.push({
        x1: bx.pos, x2: bx.pos,
        y1: Math.min(b.y + dy, bx.t.y) - 12,
        y2: Math.max(b.y + b.h + dy, bx.t.y + bx.t.h) + 12
      });
    }
    if (by) {
      guides.push({
        y1: by.pos, y2: by.pos,
        x1: Math.min(b.x + dx, by.t.x) - 12,
        x2: Math.max(b.x + b.w + dx, by.t.x + by.t.w) + 12
      });
    }
    return { dx: dx, dy: dy, hitX: !!bx, hitY: !!by, guides: guides };
  }

  /* ---------------- Ziehen auf der Fassade ---------------- */
  let drag = null;
  let marquee = null;

  /* Alles, was der Auswahlrahmen berührt (Festes und Unsichtbares nicht) */
  function marqueeHits(r) {
    return layout().els.filter(function (el) {
      if (GF.isFixed(el.id)) return false;
      if (el.type === 'text' && el.style === 'small' && !GF.state.showSmallType) return false;
      const b = GF.bbox(el);
      return !(b.x > r.x + r.w || b.x + b.w < r.x || b.y > r.y + r.h || b.y + b.h < r.y);
    }).map((e) => e.id);
  }

  function unique(a) { return a.filter((v, i) => a.indexOf(v) === i); }

  GF.svg.addEventListener('pointerdown', function (e) {
    if (!ED.open || e.button !== 0) return;
    const g = e.target.closest ? e.target.closest('.el') : null;
    const p = GF.toSvg(e.clientX, e.clientY);

    /* Leere Fläche (oder die feste Headline): Auswahlrahmen aufziehen.
       ⇧ nimmt das Gefundene zur bestehenden Auswahl dazu. */
    if (!g || GF.isFixed(g.dataset.id)) {
      marquee = { x0: p.x, y0: p.y, x: p.x, y: p.y, w: 0, h: 0,
                  base: e.shiftKey ? ED.selection.slice() : [] };
      setSelection(marquee.base);
      try { GF.svg.setPointerCapture(e.pointerId); } catch (err) {}
      ED.refresh();
      e.preventDefault();
      return;
    }

    const id = g.dataset.id;
    const isCap = !!(e.target.dataset && e.target.dataset.cap);

    if (e.shiftKey && !isCap) {
      setSelection(isSelected(id) ? ED.selection.filter((x) => x !== id) : ED.selection.concat(id));
    } else if (isCap || !isSelected(id)) {
      setSelection([id]);                    // sonst bleibt die Gruppe stehen
    }

    const el = layout().els.find((x) => x.id === id);
    if (!el || !isSelected(id)) { ED.refresh(); return; }

    if (isCap) {
      const bb = GF.bbox(el);
      const off = GF.capOffset(el);
      drag = { mode: 'cap', id: id, ox: p.x - (bb.x + off[0]), oy: p.y - (bb.y + off[1]) };
    } else {
      const start = {};
      selAll().forEach(function (o) { start[o.id] = { x: o.x, y: o.y }; });
      drag = { mode: 'el', id: id, ox: p.x - el.x, oy: p.y - el.y, start: start };
    }
    try { GF.svg.setPointerCapture(e.pointerId); } catch (err) {}
    ED.refresh();
    e.preventDefault();
  });

  GF.svg.addEventListener('pointermove', function (e) {
    if (!ED.open) return;
    const p = GF.toSvg(e.clientX, e.clientY);

    if (marquee) {
      marquee.x = Math.min(marquee.x0, p.x);
      marquee.y = Math.min(marquee.y0, p.y);
      marquee.w = Math.abs(p.x - marquee.x0);
      marquee.h = Math.abs(p.y - marquee.y0);
      const was = ED.selection.length;
      setSelection(unique(marquee.base.concat(marqueeHits(marquee))));
      drawSelection();
      if (ED.selection.length !== was) buildInspector();   // Panel zählt mit
      return;
    }

    if (!drag) return;
    const el = layout().els.find((x) => x.id === drag.id); if (!el) return;
    const q = (GF.state.snap || GF.state.showGrid) ? GF.state.grid : 1;
    const grid = (v) => Math.round(v / q) * q;

    let guides = [];

    if (drag.mode === 'cap') {
      const bb = GF.bbox(el);
      let cx = p.x - drag.ox, cy = p.y - drag.oy;          // Grundlinie links, absolut
      const m = GF.textMetrics({ text: el.cap, style: 'small' });
      const box = { x: cx, y: cy - m.ascent, w: m.w, h: m.h, base: cy };
      const s = e.altKey ? null : alignSnap(anchors(box, true), null, new Set([el.id]));
      if (s && s.hitX) cx += s.dx; else cx = grid(cx);
      if (s && s.hitY) cy += s.dy; else cy = grid(cy);
      if (s) guides = s.guides;
      el.capOff = [cx - bb.x, cy - bb.y];
    } else {
      /* Das angefasste Element bestimmt Raster und Ausrichtung,
         die übrige Auswahl wandert um denselben Betrag mit. */
      let x = p.x - drag.ox, y = p.y - drag.oy;
      const moved = Object.assign({}, el, { x: x, y: y });
      const isText = el.type === 'text';
      const box = isText ? textBox(moved) : GF.bbox(moved);
      const skip = new Set(Object.keys(drag.start));
      const s = e.altKey ? null : alignSnap(anchors(box, isText), skip, skip);
      if (s && s.hitX) x += s.dx; else x = grid(x);
      if (s && s.hitY) y += s.dy; else y = grid(y);
      if (s) guides = s.guides;

      const dx = x - drag.start[el.id].x, dy = y - drag.start[el.id].y;
      layout().els.forEach(function (o) {
        const st = drag.start[o.id];
        if (!st || GF.isFixed(o.id)) return;
        o.x = st.x + dx;
        o.y = st.y + dy;
      });
    }

    GF.render(GF.clone(layout().els));
    drawSelection(guides);
  });

  function endDrag(e) {
    if (marquee) {
      marquee = null;
      drawSelection();
      buildInspector();
      return;
    }
    if (!drag) return;
    drag = null;
    GF.save();
    drawSelection();          // Hilfslinien weg
    buildInspector();
  }
  GF.svg.addEventListener('pointerup', endDrag);
  GF.svg.addEventListener('pointercancel', endDrag);

  /* ---------------- Bedienleiste ---------------- */
  document.getElementById('editor').addEventListener('click', function (e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;

    if (act === 'close') ED.exit();
    if (act === 'hide-ui') dom.editor.classList.add('ui-hidden');
    if (act === 'show-ui') dom.editor.classList.remove('ui-hidden');
    if (act === 'toggle-small') { GF.state.showSmallType = !GF.state.showSmallType; commit(); }
    if (act === 'toggle-grid') { GF.state.showGrid = !GF.state.showGrid; GF.drawGrid(GF.state.showGrid); commit(); }
    if (act === 'toggle-rot') { GF.state.rotSnap = !GF.state.rotSnap; commit(); }
    if (act === 'layout-new') {
      GF.state.layouts.splice(ED.index + 1, 0, GF.emptyLayout());
      GF.normalizeLayouts();
      selectLayout(ED.index + 1); GF.save();
    }
    if (act === 'layout-dup') {
      const c = GF.clone(layout());
      c.id = GF.uid('l'); c.name = layout().name + ' Kopie';
      GF.state.layouts.splice(ED.index + 1, 0, c);
      selectLayout(ED.index + 1); GF.save();
    }
    if (act === 'gen-one') { GF.addGenerated(1); selectLayout(GF.state.layouts.length - 1); }
    if (act === 'gen-three') { GF.addGenerated(3); selectLayout(GF.state.layouts.length - 1); }
    if (act === 'export') exportJSON();
    if (act === 'import') dom.fileIn.click();
    if (act === 'reset') {
      if (confirm('Alle Layouts verwerfen und die Vorlage wiederherstellen?')) {
        GF.resetDefault(); ED.index = 0; setSelection([]); GF.invalidate(); ED.refresh();
      }
    }
  });

  function exportJSON() {
    const blob = new Blob([JSON.stringify(GF.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fassade-layouts.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  dom.fileIn.addEventListener('change', function () {
    const f = dom.fileIn.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function () {
      try {
        const d = JSON.parse(r.result);
        if (!d.layouts || !d.layouts.length) throw new Error('kein Layout');
        GF.state = Object.assign(GF.state, d);
        GF.normalizeLayouts();
        ED.index = 0; setSelection([]);
        GF.invalidate(); GF.save(); ED.refresh();
      } catch (err) { alert('Datei konnte nicht gelesen werden.'); }
    };
    r.readAsText(f);
    dom.fileIn.value = '';
  });

  /* ---------------- Tastatur ---------------- */
  window.addEventListener('keydown', function (e) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    // Der Editor ist nicht über die Tastatur erreichbar — nur über #edit.
    if (!ED.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (typing) { document.activeElement.blur(); return; }
      if (ED.selection.length) { setSelection([]); ED.refresh(); return; }   // erst Auswahl weg
      ED.exit();
      return;
    }
    if (typing) return;

    /* ⌘A / Ctrl+A wählt alles Bewegliche */
    if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      setSelection(layout().els.filter(function (el) {
        return !(el.type === 'text' && el.style === 'small' && !GF.state.showSmallType);
      }).map((el) => el.id));
      ED.refresh();
      return;
    }
    if (e.metaKey || e.ctrlKey) return;

    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); nudge(-step, 0); break;
      case 'ArrowRight': e.preventDefault(); nudge(step, 0); break;
      case 'ArrowUp':    e.preventDefault(); nudge(0, -step); break;
      case 'ArrowDown':  e.preventDefault(); nudge(0, step); break;
      case 'r': case 'R': e.preventDefault(); rotate(e.shiftKey ? -90 : 90); break;
      case 'Backspace': case 'Delete': e.preventDefault(); deleteEl(); break;
      case 'g': case 'G': GF.state.showGrid = !GF.state.showGrid; GF.drawGrid(GF.state.showGrid); commit(); break;
      case 'h': case 'H': dom.editor.classList.toggle('ui-hidden'); break;
      case 't': case 'T': GF.state.showSmallType = !GF.state.showSmallType; commit(); break;
    }
  });

})();
