/* scroll strażnik w przeglądarce.
   Oryginał: Python + YOLO na Macu, kamera Tapo, serwer na 127.0.0.1:8911.
   Tu: kamera odwiedzającego + wykrywanie osoby i telefonu w przeglądarce
   (MediaPipe, EfficientDet-Lite2, te same klasy COCO co YOLO). Obraz nie wychodzi z przeglądarki.
   Strona to oryginalny kod panelu — ten plik udaje jego serwer (/api/*) i podgląd z kamery.
   Bez kamery jest tryb demo: ta sama logika, tylko wykrycia z gotowego scenariusza. */
(function () {
  "use strict";

  const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";
  const MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite";

  /* jak w ustawienia.py: jaka część klatek z ostatnich sekund musi mieć telefon (wejście),
     jak mała, żeby uznać, że przestałeś (wyjście), i minimalna pewność wykrycia telefonu */
  const CZULOSC = {
    ostrozna: { wejscie: 0.45, wyjscie: 0.20, pewnosc_tel: 0.35 },
    normalna: { wejscie: 0.30, wyjscie: 0.12, pewnosc_tel: 0.25 },
    czula: { wejscie: 0.18, wyjscie: 0.07, pewnosc_tel: 0.18 },
  };
  const ANALIZ_NA_S = 3;          /* jak w straznik.py */
  const OKNO_S = 6;               /* z ilu ostatnich sekund liczy się udział klatek z telefonem */
  const PEWNOSC_OSOBY = 0.4;
  const DEMO_TEMPO = +(new URLSearchParams(location.search).get("t")) || 6;   /* w demo czas płynie 6× szybciej */

  /* na stronie krótsze czasy niż na Macu, żeby dało się to zobaczyć od razu */
  const ust = { zrodlo: "kamera przeglądarki", esp: "", limit_s: 60, kara_s: 60, przerwa_s: 15, czulosc: "normalna", czuwanie: true };

  const st = {
    tryb: "start",                 /* start | kamera | demo */
    kamera: "kliknij „włącz kamerę” na podglądzie",
    seria: 0, przerwa: 0, kara: 0, scrolluje: false,
    okno: [], udzial: 0,
    osoby: [], telefon: null, powody: [],
    analiza_ms: null, blad: "", odc: {},
    klatkaT: 0,
  };

  let video = null, strumien = null, detektor = null, ladujeModel = null;

  /* ---------------- ocena: licznik, przerwa, kara ---------------- */

  function ocen(maTelefon, dt) {
    const p = CZULOSC[ust.czulosc];
    st.okno.push(maTelefon ? 1 : 0);
    const n = OKNO_S * ANALIZ_NA_S;
    while (st.okno.length > n) st.okno.shift();
    st.udzial = st.okno.reduce((a, b) => a + b, 0) / st.okno.length;

    if (st.kara > 0) {
      st.kara = Math.max(0, st.kara - dt);
      st.scrolluje = false;
      if (st.kara === 0) { st.seria = 0; st.przerwa = 0; st.okno = []; st.udzial = 0; }
      return;
    }
    if (!st.scrolluje && st.udzial >= p.wejscie) st.scrolluje = true;
    else if (st.scrolluje && st.udzial <= p.wyjscie) st.scrolluje = false;

    if (st.scrolluje) {
      st.seria += dt;
      st.przerwa = 0;
      if (st.seria >= ust.limit_s && ust.czuwanie) odetnij(ust.kara_s);
    } else if (st.seria > 0) {
      st.przerwa += dt;
      if (st.przerwa >= ust.przerwa_s) { st.seria = 0; st.przerwa = 0; }
    }
  }

  function odetnij(s) {
    st.kara = s;
    st.scrolluje = false;
    st.odc = { co: "odcięcie na " + s + " s", wynik: "tryb próbny — brak adresu ESP, nic nie odcięto", ok: true, kiedy: Date.now() / 1000 };
  }

  /* ---------------- wykrywanie z kamery ---------------- */

  async function zaladujModel() {
    const { FilesetResolver, ObjectDetector } = await import(MP + "/vision_bundle.mjs");
    const pliki = await FilesetResolver.forVisionTasks(MP + "/wasm");
    const opcje = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "VIDEO",
      scoreThreshold: 0.15,
      maxResults: 12,
      categoryAllowlist: ["person", "cell phone"],
    });
    try { return await ObjectDetector.createFromOptions(pliki, opcje("GPU")); }
    catch (e) { return await ObjectDetector.createFromOptions(pliki, opcje("CPU")); }
  }

  /* telefon należy do osoby, jeśli jego środek leży w jej ramce (z małym luzem na boki) */
  function przypisz(osoby, telefony) {
    osoby.forEach((o) => { o.tel = null; });
    telefony.forEach((t) => {
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      let kto = null;
      osoby.forEach((o) => {
        const luz = o.w * 0.15;
        if (cx > o.x - luz && cx < o.x + o.w + luz && cy > o.y - o.h * 0.05 && cy < o.y + o.h) {
          if (!kto || o.s > kto.s) kto = o;
        }
      });
      if (kto && (!kto.tel || t.s > kto.tel.s)) kto.tel = t;
    });
  }

  function analizujKlatke() {
    if (!detektor || !video || video.readyState < 2) return null;
    const t0 = performance.now();
    const wynik = detektor.detectForVideo(video, t0);
    st.analiza_ms = Math.round(performance.now() - t0);
    st.klatkaT = Date.now();
    const p = CZULOSC[ust.czulosc];
    const osoby = [], telefony = [];
    (wynik.detections || []).forEach((d) => {
      const c = d.categories[0], b = d.boundingBox;
      const ramka = { x: b.originX, y: b.originY, w: b.width, h: b.height, s: c.score };
      if (c.categoryName === "person" && c.score >= PEWNOSC_OSOBY) osoby.push(ramka);
      else if (c.categoryName === "cell phone" && c.score >= p.pewnosc_tel) telefony.push(ramka);
    });
    przypisz(osoby, telefony);
    st.osoby = osoby;
    const z = osoby.filter((o) => o.tel);
    st.telefon = z.length ? +Math.max(...z.map((o) => o.tel.s)).toFixed(2) : null;
    st.powody = osoby.length
      ? osoby.map((o) => (o.tel ? "telefon w ręce " + o.tel.s.toFixed(2) : "brak telefonu"))
      : telefony.length ? ["telefon bez osoby — pomijam"] : [];
    return z.length > 0;
  }

  async function wlaczKamere() {
    pokazStart(false);
    st.tryb = "kamera";
    st.blad = "";
    st.kamera = "proszę o dostęp do kamery…";
    try {
      strumien = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
    } catch (e) {
      st.tryb = "start";
      st.kamera = e && e.name === "NotAllowedError" ? "kamera zablokowana w przeglądarce" : "nie mogę włączyć kamery";
      pokazStart(true, st.kamera + " — możesz zobaczyć demo");
      return;
    }
    video.srcObject = strumien;
    try { await video.play(); } catch (e) { /* autoplay bez dźwięku zwykle przechodzi */ }
    zresetuj();
    if (!detektor) {
      st.kamera = "ładuję model wykrywania (ok. 12 MB)…";
      try {
        ladujeModel = ladujeModel || zaladujModel();
        detektor = await ladujeModel;
      } catch (e) {
        ladujeModel = null;
        st.kamera = "nie udało się załadować modelu";
        st.blad = "model: " + (e && e.message ? e.message : e);
        return;
      }
    }
    st.kamera = "ok";
    ustawPrzycisk();
  }

  function wylaczKamere() {
    if (strumien) strumien.getTracks().forEach((t) => t.stop());
    strumien = null;
    if (video) video.srcObject = null;
  }

  function wlaczDemo() {
    wylaczKamere();
    pokazStart(false);
    st.tryb = "demo";
    st.kamera = "ok (demo, bez kamery)";
    st.blad = "";
    zresetuj();
    demoKrok = 0; demoZostalo = DEMO[0][0];
    ustawPrzycisk();
  }

  function zresetuj() {
    st.seria = 0; st.przerwa = 0; st.kara = 0; st.scrolluje = false;
    st.okno = []; st.udzial = 0; st.osoby = []; st.telefon = null; st.powody = [];
  }

  /* ---------------- demo: scenariusz zamiast kamery ---------------- */

  const DEMO = [[24, false], [72, true], [30, false], [999, true]];   /* [sekundy demo, telefon w ręce] */
  let demoKrok = 0, demoZostalo = DEMO[0][0];

  function krokDemo(dt) {
    demoZostalo -= dt;
    if (demoZostalo <= 0) { demoKrok = (demoKrok + 1) % DEMO.length; demoZostalo = DEMO[demoKrok][0]; }
    const tel = DEMO[demoKrok][1] && st.kara === 0;
    const s = 0.78 + Math.random() * 0.15;
    st.osoby = [{ demo: true, tel: tel ? { s } : null, s: 0.9 }];
    st.telefon = tel ? +s.toFixed(2) : null;
    st.powody = [tel ? "telefon w ręce " + s.toFixed(2) : "brak telefonu"];
    st.analiza_ms = 38 + Math.round(Math.random() * 12);
    st.klatkaT = Date.now();
    if (st.kara > 0 && st.kara - dt <= 0) { demoKrok = 0; demoZostalo = DEMO[0][0]; }
    return tel;
  }

  /* ---------------- pętla analizy ---------------- */

  let ostatnio = performance.now();
  setInterval(() => {
    const teraz = performance.now();
    const dt = Math.min(2, (teraz - ostatnio) / 1000);
    ostatnio = teraz;
    try {
      if (st.tryb === "demo") {
        ocen(krokDemo(dt * DEMO_TEMPO), dt * DEMO_TEMPO);
      } else if (st.tryb === "kamera" && detektor) {
        const maTel = analizujKlatke();
        if (maTel !== null) ocen(maTel, dt);
      } else if (st.kara > 0) {
        st.kara = Math.max(0, st.kara - dt);
      }
    } catch (e) {
      st.blad = "analiza: " + (e && e.message ? e.message : e);
    }
  }, 1000 / ANALIZ_NA_S);

  /* ---------------- udawany serwer: /api/* ---------------- */

  function stan() {
    const obrazOk = st.tryb === "demo" || (st.tryb === "kamera" && !!detektor && Date.now() - st.klatkaT < 5000);
    return {
      scrolluje: st.scrolluje, scrollujacych: st.scrolluje ? 1 : 0,
      seria_s: +st.seria.toFixed(1), przerwa_s: +st.przerwa.toFixed(1), udzial: +st.udzial.toFixed(2),
      kara_zostalo_s: Math.ceil(st.kara), obraz_ok: obrazOk, kamera: st.kamera,
      osoby: obrazOk ? st.osoby.length : 0, telefon: obrazOk ? st.telefon : null,
      powody: obrazOk ? st.powody : [], analiza_ms: obrazOk ? st.analiza_ms : null,
      blad: st.blad, odciecie: st.odc, ustawienia: Object.assign({}, ust),
    };
  }

  const json = (d, kod) => new Response(JSON.stringify(d), { status: kod || 200, headers: { "Content-Type": "application/json" } });
  const prawdziwyFetch = window.fetch.bind(window);
  window.fetch = async function (url, opt) {
    const u = String(url);
    if (u.startsWith("/api/stan")) return json(stan());
    if (u.startsWith("/api/test-odciecia")) { odetnij(20); return json({ ok: true }); }
    if (u.startsWith("/api/ustawienia")) {
      let z;
      try { z = JSON.parse((opt && opt.body) || "{}"); } catch (e) { return json({ blad: "ustawienia muszą być obiektem JSON" }, 400); }
      const czas = (k, lo, hi) => {
        if (!(k in z)) return;
        const v = Number(z[k]);
        if (!Number.isFinite(v)) throw new Error("czasy muszą być liczbami sekund");
        ust[k] = Math.max(lo, Math.min(hi, Math.round(v)));
      };
      try {
        czas("limit_s", 10, 14400); czas("kara_s", 10, 14400); czas("przerwa_s", 5, 600);
        if ("czulosc" in z) {
          if (!CZULOSC[z.czulosc]) throw new Error("czułość: jedna z ostrozna, normalna, czula");
          ust.czulosc = z.czulosc;
        }
        if ("czuwanie" in z) ust.czuwanie = !!z.czuwanie;
        if ("esp" in z) ust.esp = String(z.esp).trim().slice(0, 60);
        if ("zrodlo" in z) ust.zrodlo = String(z.zrodlo).trim().slice(0, 200);
      } catch (e) { return json({ blad: e.message }, 400); }
      return json(Object.assign({}, ust));
    }
    return prawdziwyFetch(url, opt);
  };
  window.confirm = () => true;   /* na stronie odcięcie i tak jest tylko na ekranie */

  /* ---------------- podgląd: kamera + ramki, jak rysuj.py ---------------- */

  const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const MONO = "ui-monospace, Menlo, monospace";

  function etykieta(g, tekst, x, y, tlo, kolor, rozmiar) {
    g.font = "700 " + rozmiar + "px " + MONO;
    const w = g.measureText(tekst).width + 16;
    g.fillStyle = tlo; g.fillRect(x, y - rozmiar - 10, w, rozmiar + 12);
    g.fillStyle = kolor; g.fillText(tekst, x + 8, y - 6);
  }

  function plansza(g, W, H, napis, podpis) {
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#f2efe8"; g.textAlign = "center";
    g.font = "900 " + Math.round(W / 13) + "px Helvetica Neue, Helvetica, Arial, sans-serif";
    g.fillText(napis, W / 2, H / 2);
    if (podpis) { g.font = "600 " + Math.round(W / 32) + "px " + MONO; g.fillStyle = "#a09c93"; g.fillText(podpis, W / 2, H / 2 + W / 18); }
    g.textAlign = "left";
  }

  function rysujKamere(g, W, H) {
    g.save(); g.translate(W, 0); g.scale(-1, 1);              /* lustro, jak w selfie */
    g.drawImage(video, 0, 0, W, H);
    g.restore();
    const sx = W / video.videoWidth, sy = H / video.videoHeight;
    g.lineWidth = 4; g.textAlign = "left";
    st.osoby.forEach((o, i) => {
      const x = W - (o.x + o.w) * sx, y = o.y * sy, w = o.w * sx, h = o.h * sy;
      const kol = o.tel && st.scrolluje ? "#ff3b30" : o.tel ? "#ff9f0a" : "#30d158";
      g.strokeStyle = kol; g.strokeRect(x, y, w, h);
      etykieta(g, "osoba " + (i + 1) + " · " + mmss(st.seria) + " / " + mmss(ust.limit_s), x - 2, Math.max(30, y), kol, "#fff", 20);
      if (o.tel) {
        const t = o.tel, tx = W - (t.x + t.w) * sx, ty = t.y * sy;
        g.strokeStyle = "#ffd60a"; g.strokeRect(tx, ty, t.w * sx, t.h * sy);
        etykieta(g, "telefon " + t.s.toFixed(2), tx - 2, Math.max(30, ty), "#ffd60a", "#111", 16);
      }
    });
  }

  function rysujDemo(g, W, H, t) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#3a3732"); bg.addColorStop(1, "#1d1b18");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "#2a2723"; g.fillRect(0, H * 0.72, W, H * 0.28);
    g.fillStyle = "#4a443c"; g.fillRect(W * 0.32, H * 0.5, W * 0.36, H * 0.12);
    g.fillRect(W * 0.3, H * 0.4, W * 0.05, H * 0.24); g.fillRect(W * 0.65, H * 0.4, W * 0.05, H * 0.24);
    const o = st.osoby[0] || {};
    const ph = !!o.tel, bob = Math.sin(t * 1.3) * 3;
    const cx = W * 0.5, hy = H * 0.26 + bob + (ph ? 18 : 0);
    const P = {
      glowa: [cx + (ph ? 6 : 0), hy], szyja: [cx, hy + 46], lb: [cx - 70, hy + 70], pb: [cx + 70, hy + 70],
      ll: [cx - 95, hy + 165], pl: [cx + (ph ? 55 : 95), hy + (ph ? 140 : 165)],
      ld: [cx - (ph ? 10 : 70), hy + (ph ? 175 : 240)], pd: [cx + (ph ? 20 : 80), hy + (ph ? 160 : 240)],
      lbio: [cx - 50, hy + 230], pbio: [cx + 50, hy + 230], lk: [cx - 70, hy + 300], pk: [cx + 70, hy + 300],
    };
    const kosci = [["glowa", "szyja"], ["szyja", "lb"], ["szyja", "pb"], ["lb", "ll"], ["ll", "ld"], ["pb", "pl"], ["pl", "pd"], ["lb", "lbio"], ["pb", "pbio"], ["lbio", "pbio"], ["lbio", "lk"], ["pbio", "pk"]];
    g.strokeStyle = "rgba(140,220,255,.85)"; g.lineWidth = 4;
    kosci.forEach(([a, b]) => { g.beginPath(); g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); g.stroke(); });
    g.fillStyle = "#8cdcff";
    Object.values(P).forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); });
    g.beginPath(); g.arc(P.glowa[0], P.glowa[1] - 4, 26, 0, 7); g.stroke();
    const kol = ph && st.scrolluje ? "#ff3b30" : ph ? "#ff9f0a" : "#30d158";
    g.strokeStyle = kol; g.strokeRect(cx - 150, hy - 50, 300, 380);
    etykieta(g, "osoba 1 · " + mmss(st.seria) + " / " + mmss(ust.limit_s), cx - 152, hy - 50, kol, "#fff", 22);
    if (ph) {
      const tx = (P.ld[0] + P.pd[0]) / 2 - 18, ty = (P.ld[1] + P.pd[1]) / 2 - 34;
      g.fillStyle = "#111"; g.fillRect(tx, ty, 36, 62);
      g.fillStyle = "#cfe8ff"; g.fillRect(tx + 4, ty + 6, 28, 48);
      g.strokeStyle = "#ffd60a"; g.lineWidth = 3; g.strokeRect(tx - 10, ty - 10, 56, 82);
      etykieta(g, "telefon " + o.tel.s.toFixed(2), tx - 11, ty - 10, "#ffd60a", "#111", 18);
    }
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = "600 18px " + MONO;
    g.fillText("DEMO · scenariusz zamiast kamery", 24, 36);
  }

  function petlaPodgladu() {
    const c = document.getElementById("demo-podglad");
    if (c) {
      const g = c.getContext("2d");
      if (st.tryb === "kamera" && video && video.videoWidth && (c.width !== video.videoWidth || c.height !== video.videoHeight)) {
        c.width = video.videoWidth; c.height = video.videoHeight;
      }
      const W = c.width, H = c.height;
      if (st.kara > 0) plansza(g, W, H, "INTERNET ODCIETY", "wraca za " + mmss(st.kara));
      else if (st.tryb === "kamera" && video && video.readyState >= 2) rysujKamere(g, W, H);
      else if (st.tryb === "demo") rysujDemo(g, W, H, performance.now() / 1000);
      else { g.fillStyle = "#111"; g.fillRect(0, 0, W, H); }
    }
    requestAnimationFrame(petlaPodgladu);
  }

  /* ---------------- start: włącz kamerę albo demo ---------------- */

  function pokazStart(widac, info) {
    const s = document.getElementById("start");
    if (!s) return;
    s.hidden = !widac;
    if (info) document.getElementById("start-info").textContent = info;
  }

  function ustawPrzycisk() {
    const b = document.getElementById("tryb");
    if (!b) return;
    b.hidden = st.tryb === "start";
    b.textContent = st.tryb === "kamera" ? "demo zamiast kamery" : "włącz kamerę";
  }

  document.addEventListener("DOMContentLoaded", () => {
    video = document.createElement("video");
    video.muted = true; video.playsInline = true;
    video.setAttribute("playsinline", "");
    document.getElementById("wlacz").onclick = wlaczKamere;
    document.getElementById("demo").onclick = wlaczDemo;
    document.getElementById("tryb").onclick = () => (st.tryb === "kamera" ? wlaczDemo() : wlaczKamere());
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      pokazStart(true, "ta przeglądarka nie daje dostępu do kamery — możesz zobaczyć demo");
      document.getElementById("wlacz").hidden = true;
    }
    if (/[?&]demo\b/.test(location.search)) wlaczDemo();
    requestAnimationFrame(petlaPodgladu);
  });
})();
