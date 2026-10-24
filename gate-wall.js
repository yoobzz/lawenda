/* ─────────────────────────────────────────────────────────────
   gate-wall.js  ~||-_^+*.
   ściana ze znaczków między czytelnikiem a wierszami.
   gęsta siatka drobnych lawendowych znaczków (jak chmura na starcie);
   pośrodku szczelina na kod, która rozdziera się z każdym znaczkiem,
   ściana rozstępuje się pod kursorem i palcem, przy dobrym kodzie
   rozlatuje się poza ekran, przy złym zarasta z powrotem.

   API (window.GateWall):
     init({ canvas, openingEl, keepClear: [el, ...], reduced })
     setOpening(level)      0 = szczelina, 1 = pełna rama (płynnie)
     burst(onDone)          rozerwanie ściany, onDone po zniknięciu
     heal()                 powrót do szczeliny
     stop()
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var GLYPHS = ['"', "'", ';', '.', ',', '/', '\\', '|', '~', '*', '^', '!', '=', '+', '-', '_'];
  /* odcienie jak chmura lawendy na starcie: lawenda, trochę zieleni łodyg, odrobina tuszu */
  var SHADES = [
    'rgba(158,128,218,0.88)', 'rgba(180,155,232,0.84)', 'rgba(208,188,244,0.80)', 'rgba(138,105,202,0.92)',
    'rgba(158,128,218,0.88)', 'rgba(180,155,232,0.84)',
    'rgba(106,132,96,0.70)', 'rgba(126,150,116,0.62)',
    'rgba(13,13,13,0.55)',
  ];
  var FONT_FAMILY = "'ABC Diatype Rounded', 'Inter', system-ui, sans-serif";

  var W = {
    canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
    cell: 15, glyphPx: 12,
    parts: [], sprites: {},
    opening: null, keep: [], reduced: false,
    level: 0, levelShown: 0,
    center: { x: 0, y: 0 }, r0: { x: 0, y: 0 }, r1: { x: 0, y: 0 },
    pointer: { x: -9999, y: -9999, on: false },
    mode: 'wall', burstAt: 0, onBurstDone: null, alpha: 1,
    raf: 0, t0: 0, running: false, resizeTimer: null,
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* sprite dla każdej pary znaczek × odcień: drawImage jest wielokrotnie szybsze od fillText */
  function buildSprites() {
    W.sprites = {};
    var size = Math.round(W.glyphPx * 1.6 * W.dpr);
    for (var g = 0; g < GLYPHS.length; g += 1) {
      for (var s = 0; s < SHADES.length; s += 1) {
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var x = c.getContext('2d');
        x.font = '300 ' + (W.glyphPx * W.dpr) + 'px ' + FONT_FAMILY;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = SHADES[s];
        x.fillText(GLYPHS[g], size / 2, size / 2);
        W.sprites[g + ':' + s] = c;
      }
    }
    W.spriteSize = size;
  }

  function buildParts() {
    var parts = [];
    var cols = Math.ceil(W.w / W.cell) + 2;
    var rows = Math.ceil(W.h / W.cell) + 2;
    for (var r = -1; r < rows; r += 1) {
      for (var c = -1; c < cols; c += 1) {
        var hx = c * W.cell + W.cell / 2 + rnd(-5, 5);
        var hy = r * W.cell + W.cell / 2 + rnd(-5, 5);
        parts.push({
          hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0,
          g: Math.floor(Math.random() * GLYPHS.length),
          s: Math.floor(Math.random() * SHADES.length),
          sc: rnd(0.8, 1.25), ph: rnd(0, Math.PI * 2), sw: rnd(0.6, 1.4),
          tx: hx, ty: hy, a: 1,
        });
      }
    }
    W.parts = parts;
  }

  function measure() {
    if (!W.opening) return;
    var r = W.opening.getBoundingClientRect();
    W.center.x = r.left + r.width / 2;
    W.center.y = r.top + r.height / 2;
    /* szczelina: tylko linia kodu z podpisem; pełna rama: cała przestrzeń słów */
    W.r0.x = r.width / 2 + 22;
    W.r0.y = r.height / 2 + 14;
    var frame = W.opening.parentElement ? W.opening.parentElement.getBoundingClientRect() : r;
    W.r1.x = frame.width / 2 + 36;
    W.r1.y = frame.height / 2 + 28;
    /* prześwity pod klawiaturą i napisami w rogach: elipsy, żeby brzeg był miękki jak szczelina;
       element schowany (visibility: hidden) przestaje odpychać i ściana nad nim zarasta */
    W.keepRects = W.keep.filter(function (el) {
      return el && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    }).map(function (el) {
      var k = el.getBoundingClientRect();
      return { cx: k.left + k.width / 2, cy: k.top + k.height / 2, rx: k.width / 2 + 56, ry: k.height / 2 + 18 };
    });
  }

  function resize() {
    W.dpr = Math.min(window.devicePixelRatio || 1, 2);
    W.w = window.innerWidth;
    W.h = window.innerHeight;
    var mobile = W.w < 600;
    W.cell = mobile ? 16 : 15;
    W.glyphPx = mobile ? 12 : 12;
    W.canvas.width = Math.round(W.w * W.dpr);
    W.canvas.height = Math.round(W.h * W.dpr);
    W.canvas.style.width = W.w + 'px';
    W.canvas.style.height = W.h + 'px';
    buildSprites();
    buildParts();
    measure();
    /* po zmianie rozmiaru ściana od razu w docelowym kształcie */
    W.levelShown = W.level;
    settleTargets(true);
  }

  /* cel każdego znaczka: dom, brzeg szczeliny albo poza prześwitem klawiatury */
  function settleTargets(snap) {
    var lv = ease(W.levelShown);
    var rx = W.r0.x + (W.r1.x - W.r0.x) * lv;
    var ry = W.r0.y + (W.r1.y - W.r0.y) * lv;
    var cx = W.center.x, cy = W.center.y;
    for (var i = 0; i < W.parts.length; i += 1) {
      var p = W.parts[i];
      var dx = p.hx - cx, dy = p.hy - cy;
      var n = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      var tx = p.hx, ty = p.hy;
      if (n < 1) {
        /* w szczelinie: na brzeg, wzdłuż promienia — brzeg gęstnieje jak rozdarty papier */
        var k = 1 / Math.sqrt(Math.max(n, 0.0004));
        var edge = 1 + (p.sc - 0.8) * 0.12;
        tx = cx + dx * k * edge + (p.ph - 3) * 1.2;
        ty = cy + dy * k * edge + (p.sw - 1) * 6;
      } else {
        for (var j = 0; j < W.keepRects.length; j += 1) {
          var q = W.keepRects[j];
          var qx = p.hx - q.cx, qy = p.hy - q.cy;
          var qn = (qx * qx) / (q.rx * q.rx) + (qy * qy) / (q.ry * q.ry);
          if (qn < 1) {
            var qk = 1 / Math.sqrt(Math.max(qn, 0.0004));
            tx = q.cx + qx * qk + (p.ph - 3) * 0.8;
            ty = q.cy + qy * qk + (p.sw - 1) * 4;
            break;
          }
        }
      }
      p.tx = tx; p.ty = ty;
      if (snap) { p.x = tx; p.y = ty; p.vx = 0; p.vy = 0; }
    }
  }

  function step(now) {
    if (!W.running) return;
    var t = now - W.t0;
    var ctx = W.ctx;
    var moved = Math.abs(W.level - W.levelShown) > 0.001;
    if (moved) {
      W.levelShown += (W.level - W.levelShown) * (W.reduced ? 1 : 0.08);
      if (Math.abs(W.level - W.levelShown) < 0.002) W.levelShown = W.level;
      settleTargets(false);
    }
    var px = W.pointer.x, py = W.pointer.y, pon = W.pointer.on && !W.reduced;
    var R = 96, R2 = R * R;
    var burst = W.mode === 'burst';
    if (burst) {
      var bt = (now - W.burstAt) / (W.reduced ? 220 : 900);
      W.alpha = Math.max(0, 1 - bt);
      if (bt >= 1) {
        W.running = false;
        ctx.clearRect(0, 0, W.canvas.width, W.canvas.height);
        if (W.onBurstDone) { var cb = W.onBurstDone; W.onBurstDone = null; cb(); }
        return;
      }
    }

    ctx.clearRect(0, 0, W.canvas.width, W.canvas.height);
    ctx.globalAlpha = W.alpha;
    var S = W.spriteSize, dpr = W.dpr;
    for (var i = 0; i < W.parts.length; i += 1) {
      var p = W.parts[i];
      if (burst) {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 1.015; p.vy *= 1.015;
      } else {
        var sx = W.reduced ? 0 : Math.sin(t * 0.0007 * p.sw + p.ph) * 2;
        var sy = W.reduced ? 0 : Math.cos(t * 0.0005 * p.sw + p.ph) * 2;
        var ax = (p.tx + sx - p.x) * 0.075;
        var ay = (p.ty + sy - p.y) * 0.075;
        if (pon) {
          var ddx = p.x - px, ddy = p.y - py;
          var d2 = ddx * ddx + ddy * ddy;
          if (d2 < R2 && d2 > 0.01) {
            var d = Math.sqrt(d2);
            var f = (1 - d / R) * 3.2;
            ax += (ddx / d) * f;
            ay += (ddy / d) * f;
          }
        }
        p.vx = (p.vx + ax) * 0.8;
        p.vy = (p.vy + ay) * 0.8;
        p.x += p.vx; p.y += p.vy;
      }
      var sz = S * p.sc;
      ctx.drawImage(W.sprites[p.g + ':' + p.s], p.x * dpr - sz / 2, p.y * dpr - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    W.raf = requestAnimationFrame(step);
  }

  function onPointerMove(e) {
    var pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    W.pointer.x = pt.clientX; W.pointer.y = pt.clientY; W.pointer.on = true;
  }
  function onPointerOff() { W.pointer.on = false; }

  var GateWall = {
    init: function (opts) {
      W.canvas = opts.canvas;
      W.ctx = W.canvas.getContext('2d');
      W.opening = opts.openingEl;
      W.keep = opts.keepClear || [];
      W.reduced = Boolean(opts.reduced);
      W.mode = 'wall'; W.alpha = 1; W.level = 0; W.levelShown = 0;
      resize();
      window.addEventListener('resize', function () {
        clearTimeout(W.resizeTimer);
        W.resizeTimer = setTimeout(function () { if (W.running && W.mode === 'wall') resize(); }, 120);
      });
      document.addEventListener('mousemove', onPointerMove, { passive: true });
      document.addEventListener('touchstart', onPointerMove, { passive: true });
      document.addEventListener('touchmove', onPointerMove, { passive: true });
      document.addEventListener('mouseleave', onPointerOff);
      document.addEventListener('touchend', onPointerOff);
      W.running = true;
      W.t0 = performance.now();
      W.raf = requestAnimationFrame(step);
    },
    /* po zmianie układu (np. przełączenie na 4 pola) — przelicz szczelinę */
    remeasure: function () { measure(); settleTargets(false); },
    setOpening: function (level) {
      W.level = Math.max(0, Math.min(1, level));
      if (W.reduced) { W.levelShown = W.level; settleTargets(true); }
    },
    burst: function (onDone) {
      if (W.mode === 'burst') return;
      W.mode = 'burst';
      W.burstAt = performance.now();
      W.onBurstDone = onDone || null;
      var cx = W.center.x, cy = W.center.y;
      for (var i = 0; i < W.parts.length; i += 1) {
        var p = W.parts[i];
        var dx = p.x - cx, dy = p.y - cy;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var sp = W.reduced ? 0 : rnd(6, 16) * (0.5 + 300 / (d + 120));
        p.vx = (dx / d) * sp + rnd(-1.5, 1.5);
        p.vy = (dy / d) * sp + rnd(-1.5, 1.5);
      }
      if (!W.running) { W.running = true; W.raf = requestAnimationFrame(step); }
    },
    heal: function () {
      W.mode = 'wall'; W.alpha = 1;
      W.level = 0;
      if (!W.running) { W.running = true; W.raf = requestAnimationFrame(step); }
    },
    stop: function () { W.running = false; cancelAnimationFrame(W.raf); },
  };

  window.GateWall = GateWall;
})();
