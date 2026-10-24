/* ─────────────────────────────────────────────────────────────
   gate-title.js  ~||-_^+*.
   tło bramki: chmura lawendy ze strony startowej (pointcloud.bin, te same
   znaczki i odcienie) kondensuje się i układa w tytuł „~||-_^+*.” w 3D.
   kamera leniwie dryfuje wokół napisu; każdy wpisany znaczek rozświetla
   swoje odpowiedniki w tytule i puszcza przez niego falę; zły kod = dreszcz,
   dobry = przelot kamery przez napis.

   API (window.GateTitle):
     init({ canvas, reduced })
     pulse(glyph, index, count)   wpisany znaczek
     fail()                       zły kod
     enter(onDone)                przelot do wierszy
   wymaga three.js (ładowane w gate.html); bez niego — nic.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TITLE = '"~||-_^+*.';
  var GLYPHS = ['_', '-', '~', '"', '|', ',', '*', '^', ':', ';', '.', '+', '=', '`', "'", '!'];
  /* odcienie jak na starcie (index.html) */
  var LAV = [[158, 128, 218], [180, 155, 232], [208, 188, 244], [138, 105, 202]];
  var GRN = [[55, 142, 65], [80, 165, 82], [108, 182, 92], [38, 120, 50]];
  var INK = [13, 13, 13];

  var S = {
    canvas: null, renderer: null, scene: null, camera: null,
    reduced: false, running: false, t0: 0, last: 0,
    n: 0, glyphOf: null, from: null, to: null, col0: null, col1: null, col: null,
    disp: null, vel: null, groups: [], posAttrs: [], colAttrs: [],
    morph: { t: -1, delay: null },
    cam: { theta: 0.5, phi: 0.9, r: 7.2, roll: 0, kick: 0, lookY: 0, baseR: 7, shake: 0 },
    glow: null, glowT: null, dim: 0, mode: 'idle', enterT: 0, onEnter: null,
    titleW: 7, titleX0: -3.5,
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function glyphTexture(ch) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.font = '800 ' + Math.round(size * 0.58) + 'px Inter, system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(ch, size / 2, size / 2);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  /* tytuł rasteryzowany tym samym krojem co na starcie → komórki z tuszem = cele punktów */
  function titleTargets(wanted) {
    var W = 2400, H = 520;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = '#000';
    x.font = '800 300px Inter, system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(TITLE, W / 2, H / 2 + 10);
    /* dodatkowo obrys: jeszcze grubsze kreski */
    x.lineWidth = 18;
    x.strokeStyle = '#000';
    x.lineJoin = 'round';
    x.strokeText(TITLE, W / 2, H / 2 + 10);
    var data = x.getImageData(0, 0, W, H).data;
    var cells = [];
    var step = 5;
    var minX = W, maxX = 0;
    for (var py = 0; py < H; py += step) {
      for (var px = 0; px < W; px += step) {
        if (data[(py * W + px) * 4 + 3] > 90) {
          cells.push([px, py]);
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
        }
      }
    }
    if (!cells.length) return null;
    var width = maxX - minX;
    var scale = S.titleW / width;
    var cx = (minX + maxX) / 2, cy = H / 2;
    /* wiele punktów na komórkę, z rozrzutem — litery gęste jak kwiatostan; sortowane po x,
       żeby roślina zwijała się w napis od lewej do prawej */
    var out = new Float32Array(wanted * 3);
    for (var i = 0; i < wanted; i += 1) {
      var cell = cells[Math.floor(Math.random() * cells.length)];
      out[i * 3] = (cell[0] - cx) * scale + rnd(-2.2, 2.2) * scale;
      out[i * 3 + 1] = -(cell[1] - cy) * scale + rnd(-2.2, 2.2) * scale;
      out[i * 3 + 2] = rnd(-0.12, 0.12);
    }
    S.titleX0 = -S.titleW / 2;
    return out;
  }

  function sortByX(arr, n) {
    var idx = new Array(n);
    for (var i = 0; i < n; i += 1) idx[i] = i;
    idx.sort(function (a, b) { return arr[a * 3] - arr[b * 3]; });
    var out = new Float32Array(n * 3);
    for (var k = 0; k < n; k += 1) {
      out[k * 3] = arr[idx[k] * 3]; out[k * 3 + 1] = arr[idx[k] * 3 + 1]; out[k * 3 + 2] = arr[idx[k] * 3 + 2];
    }
    return out;
  }

  function build(ab) {
    var view = new DataView(ab);
    var count = view.getUint32(0, true);
    var mobile = window.innerWidth < 640;
    var step = mobile ? 2 : 1;
    var n = Math.ceil(count / step);
    var from = new Float32Array(n * 3);
    var col0 = new Float32Array(n * 3);
    var k = 0;
    for (var i = 0; i < count; i += step) {
      var off = 4 + i * 14;
      /* STL ma Z do góry; na starcie grupa obrócona o -90° wokół X → (x, z, -y) */
      from[k * 3] = view.getFloat32(off, true);
      from[k * 3 + 1] = view.getFloat32(off + 8, true);
      from[k * 3 + 2] = -view.getFloat32(off + 4, true);
      var stalk = view.getUint8(off + 12) === 1;
      var sh = (stalk ? GRN : LAV)[Math.floor(Math.random() * 4)];
      col0[k * 3] = sh[0] / 255; col0[k * 3 + 1] = sh[1] / 255; col0[k * 3 + 2] = sh[2] / 255;
      k += 1;
    }
    n = k;
    S.n = n;
    /* rank po x z obu stron: punkt i-ty od lewej rośliny trafia w i-ty cel od lewej */
    var fromSorted = sortByX(from, n);
    var order = new Array(n);
    for (i = 0; i < n; i += 1) order[i] = i;
    order.sort(function (a, b) { return from[a * 3] - from[b * 3]; });
    var to = titleTargets(n);
    var toSorted = to ? sortByX(to, n) : fromSorted;
    S.from = new Float32Array(n * 3);
    S.to = new Float32Array(n * 3);
    S.col0 = new Float32Array(n * 3);
    S.col1 = new Float32Array(n * 3);
    for (i = 0; i < n; i += 1) {
      var src = order[i];
      S.from[i * 3] = fromSorted[i * 3]; S.from[i * 3 + 1] = fromSorted[i * 3 + 1]; S.from[i * 3 + 2] = fromSorted[i * 3 + 2];
      S.to[i * 3] = toSorted[i * 3]; S.to[i * 3 + 1] = toSorted[i * 3 + 1]; S.to[i * 3 + 2] = toSorted[i * 3 + 2];
      S.col0[i * 3] = col0[src * 3]; S.col0[i * 3 + 1] = col0[src * 3 + 1]; S.col0[i * 3 + 2] = col0[src * 3 + 2];
      /* tytuł: lawenda, co dwudziesty znaczek tuszem — jak na starcie */
      var t1 = Math.random() < 0.14 ? INK : LAV[Math.floor(Math.random() * 4)];
      S.col1[i * 3] = t1[0] / 255; S.col1[i * 3 + 1] = t1[1] / 255; S.col1[i * 3 + 2] = t1[2] / 255;
    }
    S.col = new Float32Array(S.col0);
    S.disp = new Float32Array(n * 3);
    S.vel = new Float32Array(n * 3);
    S.glow = new Float32Array(n);
    S.glyphOf = new Uint8Array(n);
    S.morph.delay = new Float32Array(n);
    for (i = 0; i < n; i += 1) {
      S.glyphOf[i] = Math.floor(Math.random() * GLYPHS.length);
      S.morph.delay[i] = (i / n) * 0.55 + Math.random() * 0.12;
    }

    /* jeden THREE.Points na znaczek; kolor z atrybutu, więc tekstura jest biała */
    var byGlyph = [];
    for (var g = 0; g < GLYPHS.length; g += 1) byGlyph.push([]);
    for (i = 0; i < n; i += 1) byGlyph[S.glyphOf[i]].push(i);
    var size = mobile ? 0.16 : 0.082;
    S.groups = []; S.posAttrs = []; S.colAttrs = [];
    for (g = 0; g < GLYPHS.length; g += 1) {
      var ids = byGlyph[g];
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(ids.length * 3);
      var cols = new Float32Array(ids.length * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      var mat = new THREE.PointsMaterial({
        map: glyphTexture(GLYPHS[g]), size: size, sizeAttenuation: true,
        vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.08,
      });
      var pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      S.scene.add(pts);
      S.groups.push({ ids: ids, pos: pos, cols: cols, geo: geo, mat: mat, size: size });
    }
    S.morph.t = 0;
    S.running = true;
    S.t0 = performance.now();
    S.last = S.t0;
    requestAnimationFrame(frame);
  }

  function aspectRadius() {
    var aspect = window.innerWidth / window.innerHeight;
    var halfW = S.titleW * 0.5 * 1.3;
    var r = halfW / (Math.tan(Math.PI / 6) * aspect);
    return Math.max(5.5, Math.min(15, r));
  }

  function frame(now) {
    if (!S.running) return;
    var dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000));
    S.last = now;
    var t = (now - S.t0) / 1000;
    var n = S.n;
    var i;

    /* ── morf: roślina → tytuł; każdy punkt leci łukiem z własnym opóźnieniem ── */
    var m = S.morph;
    if (m.t >= 0 && m.t < 1) {
      m.t = Math.min(1, m.t + dt / (S.reduced ? 0.01 : 2.6));
    }
    var morphing = m.t >= 0 && m.t <= 1;

    /* ── fizyka: sprężyna do bazy + impulsy ── */
    var k = 9, c = 3.2;
    for (i = 0; i < n * 3; i += 1) {
      var d = S.disp[i], v = S.vel[i];
      v += (-k * d - c * v) * dt;
      d += v * dt;
      S.disp[i] = d; S.vel[i] = v;
    }
    if (S.cam.shake > 0) S.cam.shake = Math.max(0, S.cam.shake - dt * 2.2);

    for (var g = 0; g < S.groups.length; g += 1) {
      var G = S.groups[g];
      var ids = G.ids;
      for (var j = 0; j < ids.length; j += 1) {
        i = ids[j];
        var p = m.t >= 1 ? 1 : (m.t < 0 ? 0 : easeInOut(Math.max(0, Math.min(1, (m.t - m.delay[i] * 0.6) / 0.42))));
        var arc = Math.sin(p * Math.PI) * 0.9;
        var bx = S.from[i * 3] + (S.to[i * 3] - S.from[i * 3]) * p;
        var by = S.from[i * 3 + 1] + (S.to[i * 3 + 1] - S.from[i * 3 + 1]) * p + arc;
        var bz = S.from[i * 3 + 2] + (S.to[i * 3 + 2] - S.from[i * 3 + 2]) * p;
        var breath = (m.t >= 1 && !S.reduced) ? Math.sin(t * 0.9 + i * 0.37) * 0.012 : 0;
        G.pos[j * 3] = bx + S.disp[i * 3];
        G.pos[j * 3 + 1] = by + S.disp[i * 3 + 1] + breath;
        G.pos[j * 3 + 2] = bz + S.disp[i * 3 + 2] + breath * 2;
        /* kolor: łodyga/kwiat → lawenda tytułu; błysk po wpisanym znaczku; przygaszenie po błędzie */
        var gl = S.glow[i];
        if (gl > 0) S.glow[i] = gl = Math.max(0, gl - dt * 1.6);
        var r0 = S.col0[i * 3] + (S.col1[i * 3] - S.col0[i * 3]) * p;
        var g0 = S.col0[i * 3 + 1] + (S.col1[i * 3 + 1] - S.col0[i * 3 + 1]) * p;
        var b0 = S.col0[i * 3 + 2] + (S.col1[i * 3 + 2] - S.col0[i * 3 + 2]) * p;
        if (gl > 0) { r0 += (0.05 - r0) * gl; g0 += (0.05 - g0) * gl; b0 += (0.05 - b0) * gl; }
        if (S.dim > 0) { var gr = 0.8; r0 += (gr - r0) * S.dim; g0 += (gr - g0) * S.dim; b0 += (gr - b0) * S.dim; }
        G.cols[j * 3] = r0; G.cols[j * 3 + 1] = g0; G.cols[j * 3 + 2] = b0;
      }
      G.geo.attributes.position.needsUpdate = true;
      G.geo.attributes.color.needsUpdate = true;
    }
    if (S.dim > 0) S.dim = Math.max(0, S.dim - dt * 1.4);

    /* ── kamera: podczas morfu dojeżdża na wprost napisu, potem dryfuje wokół różnych osi ── */
    var C = S.cam;
    var baseR = aspectRadius();
    var thetaT, phiT, rT, rollT;
    if (S.mode === 'enter') {
      S.enterT += dt / 1.15;
      var e = easeInOut(Math.min(1, S.enterT));
      thetaT = Math.PI / 2; phiT = Math.PI / 2; rollT = 0;
      rT = C.r + (-1.2 - C.r) * e * 0.9;
      C.theta += (thetaT - C.theta) * Math.min(1, dt * 4);
      C.phi += (phiT - C.phi) * Math.min(1, dt * 4);
      C.r = rT;
      S.canvas.style.opacity = String(Math.max(0, 1 - Math.max(0, S.enterT - 0.55) / 0.45));
      if (S.enterT >= 1) { S.running = false; var cb = S.onEnter; S.onEnter = null; if (cb) cb(); return; }
    } else if (morphing && m.t < 1) {
      thetaT = Math.PI / 2; phiT = Math.PI / 2; rT = baseR; rollT = 0;
      C.theta += (thetaT - C.theta) * Math.min(1, dt * 1.1);
      C.phi += (phiT - C.phi) * Math.min(1, dt * 1.1);
      C.r += (rT - C.r) * Math.min(1, dt * 1.1);
      C.roll += (rollT - C.roll) * Math.min(1, dt * 1.1);
    } else if (!S.reduced) {
      thetaT = Math.PI / 2 + Math.sin(t * 0.09) * 0.42 + C.kick;
      phiT = Math.PI / 2 + Math.sin(t * 0.067 + 1.3) * 0.26;
      rT = baseR * (1 + Math.sin(t * 0.05 + 0.6) * 0.14);
      rollT = Math.sin(t * 0.058 + 2.1) * 0.14;
      C.kick *= Math.max(0, 1 - dt * 1.4);
      C.theta += (thetaT - C.theta) * Math.min(1, dt * 0.6);
      C.phi += (phiT - C.phi) * Math.min(1, dt * 0.6);
      C.r += (rT - C.r) * Math.min(1, dt * 0.5);
      C.roll += (rollT - C.roll) * Math.min(1, dt * 0.5);
    } else {
      C.theta = Math.PI / 2; C.phi = Math.PI / 2; C.r = baseR; C.roll = 0;
    }
    C.lookY = (C.lookTarget || 0) * (m.t < 0 ? 0 : easeInOut(Math.min(1, m.t)));
    var sh = C.shake;
    var cam = S.camera;
    cam.position.set(
      C.r * Math.sin(C.phi) * Math.cos(C.theta) + rnd(-sh, sh) * 0.12,
      C.r * Math.cos(C.phi) + rnd(-sh, sh) * 0.12,
      C.r * Math.sin(C.phi) * Math.sin(C.theta)
    );
    cam.up.set(Math.sin(C.roll), Math.cos(C.roll), 0);
    cam.lookAt(0, C.lookY, 0);
    S.renderer.render(S.scene, cam);
    requestAnimationFrame(frame);
  }

  function resize() {
    if (!S.renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    S.camera.aspect = w / h;
    S.camera.updateProjectionMatrix();
    S.renderer.setSize(w, h);
    /* napis siedzi w górnej części ekranu, nad polami kodu */
    S.cam.lookTarget = w < 640 ? -2.9 : -1.75;
  }

  var GateTitle = {
    init: function (opts) {
      if (typeof THREE === 'undefined' || !opts || !opts.canvas) return false;
      S.canvas = opts.canvas;
      S.reduced = Boolean(opts.reduced);
      S.scene = new THREE.Scene();
      S.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      S.renderer = new THREE.WebGLRenderer({ canvas: S.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      S.renderer.setClearColor(0x000000, 0);
      resize();
      var rt = null;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 120); });
      var ready = (document.fonts && document.fonts.load) ? document.fonts.load('800 300px Inter').catch(function () {}) : Promise.resolve();
      Promise.all([fetch('/pointcloud.bin').then(function (r) { if (!r.ok) throw new Error('bin'); return r.arrayBuffer(); }), ready])
        .then(function (res) { build(res[0]); })
        .catch(function () { S.canvas.style.display = 'none'; });
      return true;
    },
    /* wpisany znaczek: jego odpowiedniki w napisie błyskają tuszem, fala idzie od miejsca pola, kamera drga */
    pulse: function (glyph, index, count) {
      if (!S.n) return;
      var gi = GLYPHS.indexOf(glyph);
      var ox = S.titleX0 + ((index + 0.5) / Math.max(1, count)) * S.titleW;
      var R = 1.9;
      for (var i = 0; i < S.n; i += 1) {
        if (gi >= 0 && S.glyphOf[i] === gi) S.glow[i] = 1;
        var dx = S.to[i * 3] - ox, dy = S.to[i * 3 + 1];
        var d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          var d = Math.sqrt(d2) || 0.001;
          var f = (1 - d / R) * (S.reduced ? 0 : 2.6);
          S.vel[i * 3] += (dx / d) * f * 0.5;
          S.vel[i * 3 + 1] += (dy / d) * f * 0.5;
          S.vel[i * 3 + 2] += f * 1.3;
        }
      }
      S.cam.kick += (Math.random() < 0.5 ? -1 : 1) * 0.09;
    },
    fail: function () {
      if (!S.n || S.reduced) return;
      for (var i = 0; i < S.n * 3; i += 1) S.vel[i] += rnd(-1.1, 1.1);
      S.cam.shake = 1;
      S.dim = 1;
    },
    enter: function (onDone) {
      if (!S.n) { if (onDone) onDone(); return; }
      S.mode = 'enter'; S.enterT = 0; S.onEnter = onDone || null;
      if (!S.running) { S.running = true; S.last = performance.now(); requestAnimationFrame(frame); }
    },
  };

  GateTitle._S = S;
  window.GateTitle = GateTitle;
})();
