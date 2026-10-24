/* ─────────────────────────────────────────────────────────────
   gate-title.js  ~||-_^+*.
   chmura lawendy ze strony startowej (pointcloud.bin, te same znaczki
   i odcienie) kondensuje się i układa w gruby tytuł „~||-_^+*.” w 3D.
   potem kamera leniwie dryfuje wokół napisu. na wpisywany kod reaguje
   WYŁĄCZNIE kamera: każdy znaczek = nowe ujęcie na jego odpowiednik
   w tytule; zły kod = kamera się cofa; dobry = przelot przez napis.

   API (window.GateTitle):
     init({ canvas, reduced, camera?, hold? })  → Promise (po zbudowaniu)
        camera = { theta, phi, r } ze strony startowej (ta sama poza, więc
        podmiana silnika jest niewidoczna); hold = true trzyma roślinę
        do wywołania morph()
     morph()                        roślina → tytuł
     active()                       czy silnik już działa
     pulse(glyph, index, count)     wpisany znaczek (ujęcie kamery)
     fail()                         zły kod (kamera się cofa)
     enter(onDone)                  przelot do wierszy
   wymaga three.js; bez niego init zwraca false.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TITLE = '"~||-_^+*.';
  var GLYPHS = ['_', '-', '~', '"', '|', ',', '*', '^', ':', ';', '.', '+', '=', '`', "'", '!'];
  /* odcienie jak na starcie (index.html); tytuł tylko z lawendy */
  var LAV = [[158, 128, 218], [180, 155, 232], [208, 188, 244], [138, 105, 202]];
  var GRN = [[55, 142, 65], [80, 165, 82], [108, 182, 92], [38, 120, 50]];

  var S = {
    canvas: null, renderer: null, scene: null, camera: null,
    reduced: false, running: false, t0: 0, last: 0,
    n: 0, glyphOf: null, from: null, to: null, col0: null, col1: null, groups: [],
    morph: { t: -1, delay: null },
    cam: {
      theta: 0.5, phi: 0.9, r: 7.2, roll: 0,
      lookX: 0, lookY: 0, lookTarget: 0,
      focusX: 0, focusSide: 1, focusT: 0, pull: 0,
    },
    mode: 'idle', enterT: 0, onEnter: null,
    titleW: 7, charX: [],
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  var _col = null;
  function lin(c) {
    if (!_col) _col = new THREE.Color();
    _col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255).convertSRGBToLinear();
    return [_col.r, _col.g, _col.b];
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

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

  /* tytuł rasteryzowany grubo (Inter 800 + obrys) → komórki z tuszem = cele punktów;
     przy okazji środek każdego znaku, żeby kamera umiała na niego spojrzeć */
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
    var scale = S.titleW / (maxX - minX);
    var cx = (minX + maxX) / 2, cy = H / 2;
    /* środki znaków w świecie */
    var total = x.measureText(TITLE).width;
    var startX = W / 2 - total / 2;
    S.charX = [];
    for (var k = 0; k < TITLE.length; k += 1) {
      var pre = x.measureText(TITLE.slice(0, k)).width;
      var cw = x.measureText(TITLE[k]).width;
      S.charX.push({ ch: TITLE[k], x: (startX + pre + cw / 2 - cx) * scale });
    }
    var out = new Float32Array(wanted * 3);
    for (var i = 0; i < wanted; i += 1) {
      var cell = cells[Math.floor(Math.random() * cells.length)];
      out[i * 3] = (cell[0] - cx) * scale + rnd(-2.2, 2.2) * scale;
      out[i * 3 + 1] = -(cell[1] - cy) * scale + rnd(-2.2, 2.2) * scale;
      out[i * 3 + 2] = rnd(-0.12, 0.12);
    }
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
    return { pos: out, order: idx };
  }

  function build(ab) {
    var view = new DataView(ab);
    var count = view.getUint32(0, true);
    var mobile = window.innerWidth < 640;
    var step = mobile ? 3 : 1;
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
      var sh = lin((stalk ? GRN : LAV)[Math.floor(Math.random() * 4)]);
      col0[k * 3] = sh[0]; col0[k * 3 + 1] = sh[1]; col0[k * 3 + 2] = sh[2];
      k += 1;
    }
    n = k;
    S.n = n;
    /* rank po x z obu stron: punkt i-ty od lewej rośliny trafia w i-ty cel od lewej */
    var fs = sortByX(from, n);
    var to = titleTargets(n);
    var ts = to ? sortByX(to, n) : fs;
    S.from = fs.pos;
    S.to = ts.pos;
    S.col0 = new Float32Array(n * 3);
    S.col1 = new Float32Array(n * 3);
    for (i = 0; i < n; i += 1) {
      var src = fs.order[i];
      S.col0[i * 3] = col0[src * 3]; S.col0[i * 3 + 1] = col0[src * 3 + 1]; S.col0[i * 3 + 2] = col0[src * 3 + 2];
      var t1 = lin(LAV[Math.floor(Math.random() * 4)]);
      S.col1[i * 3] = t1[0]; S.col1[i * 3 + 1] = t1[1]; S.col1[i * 3 + 2] = t1[2];
    }
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
    var size = mobile ? 0.12 : 0.1;
    S.groups = [];
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
      S.groups.push({ ids: ids, pos: pos, cols: cols, geo: geo });
    }
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

  function lerpTo(cur, target, rate) { return cur + (target - cur) * Math.min(1, rate); }

  function frame(now) {
    if (!S.running) return;
    var dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000));
    S.last = now;
    var t = (now - S.t0) / 1000;
    var i;

    /* ── morf: roślina → tytuł; każdy punkt leci łukiem z własnym opóźnieniem ── */
    var m = S.morph;
    if (m.t >= 0 && m.t < 1) m.t = Math.min(1, m.t + dt / (S.reduced ? 0.01 : 2.6));
    var held = m.t < 0;
    var morphing = m.t >= 0 && m.t < 1;

    for (var g = 0; g < S.groups.length; g += 1) {
      var G = S.groups[g];
      var ids = G.ids;
      for (var j = 0; j < ids.length; j += 1) {
        i = ids[j];
        var p = held ? 0 : (m.t >= 1 ? 1 : easeInOut(Math.max(0, Math.min(1, (m.t - m.delay[i] * 0.6) / 0.42))));
        var arc = Math.sin(p * Math.PI) * 0.9;
        var breath = (m.t >= 1 && !S.reduced) ? Math.sin(t * 0.9 + i * 0.37) * 0.012 : 0;
        G.pos[j * 3] = S.from[i * 3] + (S.to[i * 3] - S.from[i * 3]) * p;
        G.pos[j * 3 + 1] = S.from[i * 3 + 1] + (S.to[i * 3 + 1] - S.from[i * 3 + 1]) * p + arc + breath;
        G.pos[j * 3 + 2] = S.from[i * 3 + 2] + (S.to[i * 3 + 2] - S.from[i * 3 + 2]) * p + breath * 2;
        G.cols[j * 3] = S.col0[i * 3] + (S.col1[i * 3] - S.col0[i * 3]) * p;
        G.cols[j * 3 + 1] = S.col0[i * 3 + 1] + (S.col1[i * 3 + 1] - S.col0[i * 3 + 1]) * p;
        G.cols[j * 3 + 2] = S.col0[i * 3 + 2] + (S.col1[i * 3 + 2] - S.col0[i * 3 + 2]) * p;
      }
      G.geo.attributes.position.needsUpdate = true;
      G.geo.attributes.color.needsUpdate = true;
    }

    /* ── kamera ── */
    var C = S.cam;
    var baseR = aspectRadius();
    var cam = S.camera;
    if (S.mode === 'enter') {
      S.enterT += dt / 1.15;
      var e = easeInOut(Math.min(1, S.enterT));
      C.theta = lerpTo(C.theta, Math.PI / 2, dt * 4);
      C.phi = lerpTo(C.phi, Math.PI / 2, dt * 4);
      C.roll = lerpTo(C.roll, 0, dt * 4);
      C.lookX = lerpTo(C.lookX, 0, dt * 4);
      C.r = C.r + (-1.2 - C.r) * e * 0.9;
      S.canvas.style.opacity = String(Math.max(0, 1 - Math.max(0, S.enterT - 0.55) / 0.45));
      if (S.enterT >= 1) { S.running = false; var cb = S.onEnter; S.onEnter = null; if (cb) cb(); return; }
    } else if (held) {
      /* roślina jak na starcie: powolny obrót, ta sama poza co tam */
      if (!S.reduced) C.theta += dt * 0.10;
      C.lookX = 0; C.lookY = 0;
    } else if (morphing) {
      C.theta = lerpTo(C.theta, Math.PI / 2, dt * 1.1);
      C.phi = lerpTo(C.phi, Math.PI / 2, dt * 1.1);
      C.r = lerpTo(C.r, baseR, dt * 1.1);
      C.roll = lerpTo(C.roll, 0, dt * 1.1);
      C.lookX = lerpTo(C.lookX, 0, dt * 1.1);
      C.lookY = C.lookTarget * easeInOut(Math.min(1, m.t));
    } else if (!S.reduced) {
      /* dryf wokół różnych osi + ujęcie na wpisany znaczek (focus) + cofnięcie po błędzie (pull) */
      var f = C.focusT;
      var pull = C.pull;
      var thetaT = Math.PI / 2 + Math.sin(t * 0.09) * 0.42 - C.focusSide * 0.3 * f;
      var phiT = Math.PI / 2 + Math.sin(t * 0.067 + 1.3) * 0.26 - 0.1 * f + 0.2 * pull;
      var rT = baseR * (1 + Math.sin(t * 0.05 + 0.6) * 0.14) * (1 - 0.2 * f) * (1 + 0.32 * pull);
      var rollT = Math.sin(t * 0.058 + 2.1) * 0.14 + C.focusSide * 0.05 * f;
      var rate = dt * (0.6 + 2.4 * f + 1.6 * pull);
      C.theta = lerpTo(C.theta, thetaT, rate);
      C.phi = lerpTo(C.phi, phiT, rate);
      C.r = lerpTo(C.r, rT, rate);
      C.roll = lerpTo(C.roll, rollT, rate);
      C.lookX = lerpTo(C.lookX, C.focusX * f, rate);
      C.lookY = C.lookTarget;
      C.focusT = Math.max(0, f - dt / 2.6);
      C.pull = Math.max(0, pull - dt / 1.8);
    } else {
      C.theta = Math.PI / 2; C.phi = Math.PI / 2; C.r = baseR; C.roll = 0; C.lookX = 0; C.lookY = C.lookTarget;
    }
    cam.position.set(
      C.r * Math.sin(C.phi) * Math.cos(C.theta),
      C.r * Math.cos(C.phi),
      C.r * Math.sin(C.phi) * Math.sin(C.theta)
    );
    cam.up.set(Math.sin(C.roll), Math.cos(C.roll), 0);
    cam.lookAt(C.lookX, C.lookY, 0);
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
      if (S.running) return Promise.resolve();
      S.canvas = opts.canvas;
      S.reduced = Boolean(opts.reduced);
      S.scene = new THREE.Scene();
      S.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      S.renderer = new THREE.WebGLRenderer({ canvas: S.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      S.renderer.setClearColor(0x000000, 0);
      resize();
      if (opts.camera) {
        S.cam.theta = opts.camera.theta; S.cam.phi = opts.camera.phi; S.cam.r = opts.camera.r;
      }
      S.morph.t = opts.hold ? -1 : 0;
      var rt = null;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 120); });
      var ready = (document.fonts && document.fonts.load) ? document.fonts.load('800 300px Inter').catch(function () {}) : Promise.resolve();
      return Promise.all([fetch('/pointcloud.bin').then(function (r) { if (!r.ok) throw new Error('bin'); return r.arrayBuffer(); }), ready])
        .then(function (res) { build(res[0]); })
        .catch(function (err) { S.canvas.style.display = 'none'; throw err; });
    },
    morph: function () { if (S.morph.t < 0) S.morph.t = 0; },
    setCamera: function (c) { if (c) { S.cam.theta = c.theta; S.cam.phi = c.phi; S.cam.r = c.r; } },
    active: function () { return S.running; },
    /* wpisany znaczek: kamera robi ujęcie na jego odpowiednik w tytule (najbliższy miejscu pola) */
    pulse: function (glyph, index, count) {
      if (!S.n || S.reduced) return;
      var expect = ((index + 0.5) / Math.max(1, count) - 0.5) * S.titleW;
      var best = null, bestD = Infinity;
      for (var k = 0; k < S.charX.length; k += 1) {
        var c = S.charX[k];
        var d = Math.abs(c.x - expect) + (c.ch === glyph ? 0 : 100);
        if (d < bestD) { bestD = d; best = c; }
      }
      var x = best ? best.x : expect;
      S.cam.focusX = x * 0.5;
      S.cam.focusSide = x < 0 ? -1 : 1;
      S.cam.focusT = 1;
      S.cam.pull = 0;
    },
    fail: function () {
      if (!S.n || S.reduced) return;
      S.cam.pull = 1;
      S.cam.focusT = 0;
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
