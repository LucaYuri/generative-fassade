/* =========================================================
   render.js — SVG-Aufbau, Interpolation zwischen Layouts
   ========================================================= */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('facade');
  const layerGrid = document.getElementById('layer-grid');
  const layerEls = document.getElementById('layer-els');
  const layerUI = document.getElementById('layer-ui');

  GF.svg = svg;
  GF.layerUI = layerUI;

  function node(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  GF.node = node;

  /* ---------- Interpolation ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;

  function lerpAngle(a, b, t) {
    let d = ((b - a + 180) % 360 + 360) % 360 - 180;
    return a + d * t;
  }

  GF.easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  /* Haltephasen an den Enden: das Layout „steht“ kurz, bevor es umbaut. */
  GF.shape = function (t) {
    const HOLD = 0.16;
    const u = Math.min(1, Math.max(0, (t - HOLD) / (1 - 2 * HOLD)));
    return GF.easeInOutCubic(u);
  };

  /* Zwei Layouts zu einem Zwischenzustand mischen */
  GF.mix = function (A, B, t) {
    if (!B || t <= 0) return A.els.map((e) => Object.assign({ _op: 1 }, e));
    if (t >= 1) return B.els.map((e) => Object.assign({ _op: 1 }, e));

    const mapA = new Map(A.els.map((e) => [e.id, e]));
    const mapB = new Map(B.els.map((e) => [e.id, e]));
    const order = [];
    A.els.forEach((e) => order.push(e.id));
    B.els.forEach((e) => { if (!mapA.has(e.id)) order.push(e.id); });

    return order.map(function (id) {
      const a = mapA.get(id), b = mapB.get(id);
      if (a && !b) return Object.assign({ _op: 1 - t }, a);
      if (!a && b) return Object.assign({ _op: t }, b);
      const base = t < 0.5 ? a : b;
      const out = Object.assign({}, base);
      out.x = lerp(a.x, b.x, t);
      out.y = lerp(a.y, b.y, t);
      out.rot = GF.state.rotSnap
        ? (t < 0.5 ? (a.rot || 0) : (b.rot || 0))   // schaltet hart um: nie diagonal
        : lerpAngle(a.rot || 0, b.rot || 0, t);
      if (a.size != null || b.size != null) {
        out.size = lerp(a.size || 13.5, b.size || 13.5, t);
      }
      // Position der kleinen Typo mitziehen
      const oa = capOffset(a), ob = capOffset(b);
      out.capOff = [lerp(oa[0], ob[0], t), lerp(oa[1], ob[1], t)];
      out._op = 1;
      return out;
    });
  };

  function capOffset(el) {
    if (el.capOff) return el.capOff;
    const bb = GF.bbox(el);
    return [bb.w + 8, bb.h];
  }
  GF.capOffset = capOffset;

  /* Bounding-Box der kleinen Typo eines Bausteins (für Ausrichtung & Snap) */
  GF.capBox = function (el) {
    if (!el.cap) return null;
    const bb = GF.bbox(el);
    const off = capOffset(el);
    const m = GF.textMetrics({ text: el.cap, style: 'small' });
    return { x: bb.x + off[0], y: bb.y + off[1] - m.ascent, w: m.w, h: m.h };
  };

  /* ---------- Aufbau ---------- */
  let sig = '';
  const groups = new Map();

  function signature(els) {
    return els.map((e) => [e.id, e.type, e.style || '', e.text || '', e.cap || ''].join('~')).join('|');
  }

  function build(els) {
    layerEls.textContent = '';
    groups.clear();

    els.forEach(function (el) {
      const g = node('g', { class: 'el' + (GF.isFixed(el.id) ? ' locked' : '') });
      g.dataset.id = el.id;

      const body = node('g', { class: 'body' });

      if (el.type === 'text') {
        const t = node('text', { class: el.style === 'head' ? 'txt-head' : 'txt-small' });
        const lines = String(el.text || '').split('\n');
        lines.forEach(function (line, i) {
          const ts = node('tspan', { x: 0, dy: i === 0 ? 0 : 1 });
          ts.textContent = line;
          t.appendChild(ts);
        });
        body.appendChild(t);
      } else {
        const inner = node('g', { transform: 'scale(' + GF.BASE_SCALE + ')' });
        (GF.SHAPES[el.type] ? GF.SHAPES[el.type].paths : []).forEach(function (d) {
          inner.appendChild(node('path', { d: d }));
        });
        body.appendChild(inner);
        // unsichtbare Trefferfläche fürs Anfassen im Editor
        const s = GF.shapeSize(el.type);
        body.appendChild(node('rect', { class: 'hit', x: 0, y: 0, width: s.w, height: s.h }));
      }
      g.appendChild(body);

      let cap = null;
      if (el.cap) {
        cap = node('text', { class: 'cap' });
        cap.textContent = el.cap;
        cap.dataset.cap = el.id;
        g.appendChild(cap);
      }

      layerEls.appendChild(g);
      groups.set(el.id, { g: g, body: body, cap: cap, type: el.type });
    });
  }

  /* ---------- Zustand anwenden ---------- */
  function apply(el) {
    const rec = groups.get(el.id);
    if (!rec) return;
    const rot = el.rot || 0;

    if (el.type === 'text') {
      const m = GF.textMetrics(el);
      const t = rec.body.firstChild;
      t.setAttribute('font-size', m.size);
      for (let i = 1; i < t.childNodes.length; i++) t.childNodes[i].setAttribute('dy', m.lh);
      const bb = GF.bbox(el);
      const cx = bb.x + bb.w / 2 - el.x, cy = bb.y + bb.h / 2 - el.y;
      rec.body.setAttribute('transform',
        'translate(' + el.x + ',' + el.y + ') rotate(' + rot + ',' + cx + ',' + cy + ')');
      const hidden = (el.style === 'small' && !GF.state.showSmallType);
      rec.g.setAttribute('opacity', hidden ? 0 : (el._op == null ? 1 : el._op));
      rec.g.style.pointerEvents = hidden ? 'none' : '';
      return;
    }

    const s = GF.shapeSize(el.type);
    rec.body.setAttribute('transform',
      'translate(' + el.x + ',' + el.y + ') rotate(' + rot + ',' + (s.w / 2) + ',' + (s.h / 2) + ')');

    if (rec.cap) {
      const bb = GF.bbox(el);
      const off = el.capOff || capOffset(el);
      rec.cap.setAttribute('x', bb.x + off[0]);
      rec.cap.setAttribute('y', bb.y + off[1]);
      rec.cap.setAttribute('opacity', GF.state.showSmallType ? 1 : 0);
      rec.cap.style.pointerEvents = GF.state.showSmallType ? '' : 'none';
    }
    rec.g.setAttribute('opacity', el._op == null ? 1 : el._op);
  }

  GF.render = function (els) {
    const s = signature(els);
    if (s !== sig) { build(els); sig = s; }
    els.forEach(apply);
    GF.current = els;
  };

  GF.invalidate = function () { sig = ''; };

  /* ---------- Raster ---------- */
  GF.drawGrid = function (on) {
    layerGrid.textContent = '';
    if (GF.editor && GF.editor.open) {
      layerGrid.appendChild(node('rect', {
        class: 'frame', x: 0, y: 0, width: GF.CANVAS.W, height: GF.CANVAS.H
      }));
    }
    if (!on) return;
    const step = GF.state.grid;
    for (let x = 0; x <= GF.CANVAS.W; x += step) {
      layerGrid.appendChild(node('line', {
        class: 'grid-line' + (x % (step * 10) === 0 ? ' major' : ''),
        x1: x, y1: 0, x2: x, y2: GF.CANVAS.H
      }));
    }
    for (let y = 0; y <= GF.CANVAS.H; y += step) {
      layerGrid.appendChild(node('line', {
        class: 'grid-line' + (y % (step * 10) === 0 ? ' major' : ''),
        x1: 0, y1: y, x2: GF.CANVAS.W, y2: y
      }));
    }
  };

  /* Bildschirm- zu SVG-Koordinaten */
  GF.toSvg = function (clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
})();
