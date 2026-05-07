'use strict';

const chatEl = document.getElementById('chat');
const actionsEl = document.getElementById('actions');
const cameraArea = document.getElementById('camera-area');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraCancel = document.getElementById('camera-cancel');
const scanSymbolsEl = document.getElementById('scan-symbols');
const scanStatusEl = document.getElementById('scan-status');
const manualScanHintEl = document.getElementById('manual-scan-hint');
const scanFlashEl = document.getElementById('scan-flash');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;

function getCodeFromUrl() {
  const fromPath = window.location.pathname.match(/\/g\/([A-Za-z0-9]{4})(?:[/?#]|$)/);
  if (fromPath && CODE_RE.test(fromPath[1].toUpperCase())) return fromPath[1].toUpperCase();
  const qsCode = new URLSearchParams(window.location.search).get('code');
  if (qsCode && CODE_RE.test(qsCode.toUpperCase())) return qsCode.toUpperCase();
  return null;
}

async function generateFingerprint() {
  try {
    const cv = document.createElement('canvas');
    cv.width = 240;
    cv.height = 60;
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f0f';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('szpineta.fp', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('szpineta.fp', 4, 17);
    const parts = [
      cv.toDataURL(),
      navigator.language || '',
      navigator.platform || '',
      (screen.width || 0) + 'x' + (screen.height || 0),
      String(screen.colorDepth || 0),
      String(new Date().getTimezoneOffset()),
      String(navigator.hardwareConcurrency || 0),
    ].join('§');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts));
    return Array.from(new Uint8Array(buf))
      .slice(0, 12)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    const key = 'szp_fp';
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const rand = crypto.getRandomValues(new Uint8Array(12));
    const fp = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(key, fp);
    return fp;
  }
}

function initZnaczki() {
  const container = document.getElementById('starContainer');
  const chars = ['_', '-', '~', '"', '|', ',', '*', '^', ':', ';', '.', '+', '=', '`', "'", '!'];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const count = isTouch ? 60 : 150;

  function randStr(min, max) {
    const len = Math.floor(Math.random() * (max - min + 1)) + min;
    let s = '';
    for (let i = 0; i < len; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('div');
    p.className = 'star-particle';
    p.textContent = randStr(2, 4);
    p.style.left = Math.random() * window.innerWidth + 'px';
    p.style.top = Math.random() * window.innerHeight + 'px';
    p.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
    p.style.animationDuration = (9 + Math.random() * 6).toFixed(2) + 's';
    container.appendChild(p);
  }

  container.querySelectorAll('.star-particle').forEach((p, i) => {
    const delay = Math.min(i * 12 + Math.random() * 200, 2500);
    const rx = (Math.random() - 0.5) * 30;
    const ry = (Math.random() - 0.5) * 30;
    p.style.setProperty('--appear-x', rx + 'px');
    p.style.setProperty('--appear-y', ry + 'px');
    setTimeout(() => p.classList.add('typing-in'), delay);
  });
}

function clearChat() {
  chatEl.innerHTML = '';
}

function createTypingBubble() {
  const typing = document.createElement('div');
  typing.className = 'typing-bubble';
  typing.innerHTML = '<span class="typing-dot">_</span><span class="typing-dot">_</span><span class="typing-dot">_</span>';
  chatEl.appendChild(typing);
  requestAnimationFrame(() => typing.classList.add('show'));
  return typing;
}

function createBubble(text) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  chatEl.appendChild(bubble);
  requestAnimationFrame(() => bubble.classList.add('show'));
  return bubble;
}

async function typeIntoBubble(el, text, speed = 17) {
  el.textContent = '';
  for (let i = 0; i < text.length; i += 1) {
    el.textContent += text[i];
    await sleep(speed + Math.floor(Math.random() * 18));
  }
}

async function runChat(items, { clear = true } = {}) {
  if (clear) clearChat();
  hideActions();
  for (const msg of items) {
    const typing = createTypingBubble();
    await sleep(msg.delay || 700);
    typing.remove();
    const bubble = createBubble('');
    await typeIntoBubble(bubble, msg.text || '');
    await sleep(220);
  }
}

async function quickLine(text) {
  await runChat([{ text, delay: 350 }], { clear: false });
}

function clearActions() {
  actionsEl.innerHTML = '';
}

function hideActions() {
  actionsEl.classList.remove('show');
  clearActions();
}

function showActions() {
  requestAnimationFrame(() => actionsEl.classList.add('show'));
}

function addBtn(label, cls, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gate-btn' + (cls ? ' ' + cls : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  actionsEl.appendChild(btn);
  return btn;
}

function addManualInput({ onSubmit, onCancel } = {}) {
  clearActions();
  const row = document.createElement('div');
  row.className = 'manual-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 4;
  input.placeholder = 'A1B2';
  input.autocomplete = 'off';
  input.spellcheck = false;
  row.appendChild(input);

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'gate-btn';
  submit.textContent = GATE_CONFIG.buttons.manualSubmit;
  row.appendChild(submit);

  const err = document.createElement('div');
  err.className = 'manual-error';
  err.style.display = 'none';

  function setError(text) {
    err.textContent = text;
    err.style.display = 'block';
  }

  function submitValue() {
    const value = input.value.trim().toUpperCase();
    if (!CODE_RE.test(value)) {
      setError(GATE_CONFIG.manualInputErrorInvalid);
      return;
    }
    err.style.display = 'none';
    onSubmit(value);
  }

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTVWXYZ23456789]/g, '').slice(0, 4);
    if (err.style.display === 'block') err.style.display = 'none';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitValue();
  });
  submit.addEventListener('click', submitValue);

  actionsEl.appendChild(row);
  actionsEl.appendChild(err);
  addBtn(GATE_CONFIG.noCodeReturnLabel, 'soft', onCancel);
  showActions();
  setTimeout(() => input.focus(), 40);
}

let cameraStream = null;
let scanActive = false;
let scanStatusTimer = null;
let manualHintTimer = null;
let symbolJitterTimer = null;
let currentScanToken = 0;

function clearScanTimers() {
  if (scanStatusTimer) clearInterval(scanStatusTimer);
  if (manualHintTimer) clearTimeout(manualHintTimer);
  if (symbolJitterTimer) clearInterval(symbolJitterTimer);
  scanStatusTimer = null;
  manualHintTimer = null;
  symbolJitterTimer = null;
}

function initScanSymbols() {
  scanSymbolsEl.innerHTML = '';
  const atoms = ['~', '||', '-', '_', '^', '+', '*.'];
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const s = document.createElement('span');
    s.className = 'scan-symbol';
    s.textContent = atoms[i % atoms.length];
    s.style.left = 24 + Math.random() * 52 + '%';
    s.style.top = 24 + Math.random() * 52 + '%';
    scanSymbolsEl.appendChild(s);
  }
}

function startSymbolJitter() {
  symbolJitterTimer = setInterval(() => {
    scanSymbolsEl.querySelectorAll('.scan-symbol').forEach((s, i) => {
      gsap.to(s, {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
        opacity: 0.5 + Math.random() * 0.4,
        duration: 0.11 + i * 0.001,
        ease: 'sine.out',
      });
    });
  }, 100);
}

function startScanStatusLoop() {
  const sequence = [
    '...',
    GATE_CONFIG.scanStatuses.searching,
    '...',
    GATE_CONFIG.scanStatuses.detected,
    '...',
    GATE_CONFIG.scanStatuses.opening,
  ];
  let idx = 0;
  scanStatusEl.textContent = sequence[0];
  scanStatusTimer = setInterval(() => {
    idx = (idx + 1) % sequence.length;
    scanStatusEl.textContent = sequence[idx];
  }, 1200);
}

function stopScanStatusLoop(finalText) {
  if (scanStatusTimer) clearInterval(scanStatusTimer);
  scanStatusTimer = null;
  if (finalText) scanStatusEl.textContent = finalText;
}

function convertVideoRectToViewport(meta) {
  if (!meta || !meta.videoWidth || !meta.videoHeight) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(vw / meta.videoWidth, vh / meta.videoHeight);
  const drawW = meta.videoWidth * scale;
  const drawH = meta.videoHeight * scale;
  const offsetX = (vw - drawW) / 2;
  const offsetY = (vh - drawH) / 2;
  return {
    x: offsetX + meta.x * scale,
    y: offsetY + meta.y * scale,
    w: meta.w * scale,
    h: meta.h * scale,
  };
}

function animatePullToQr(meta) {
  const rect = convertVideoRectToViewport(meta);
  const targetX = rect ? rect.x + rect.w / 2 : window.innerWidth / 2;
  const targetY = rect ? rect.y + rect.h / 2 : window.innerHeight / 2;
  const symbols = Array.from(scanSymbolsEl.querySelectorAll('.scan-symbol'));
  return new Promise(resolve => {
    symbols.forEach((s, i) => {
      const b = s.getBoundingClientRect();
      gsap.to(s, {
        x: targetX - (b.left + b.width / 2),
        y: targetY - (b.top + b.height / 2),
        opacity: 0.95,
        duration: 0.34 + Math.random() * 0.3,
        delay: i * 0.015,
        ease: 'power2.in',
      });
    });
    gsap.to(scanFlashEl, {
      opacity: 0.85,
      duration: 0.24,
      delay: 0.34,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        scanFlashEl.style.opacity = '0';
        resolve();
      },
    });
  });
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    cameraArea.classList.add('active');
    manualScanHintEl.classList.remove('show');
    initScanSymbols();
    startSymbolJitter();
    startScanStatusLoop();
    manualHintTimer = setTimeout(() => {
      manualScanHintEl.classList.add('show');
    }, 30000);
    return true;
  } catch {
    return false;
  }
}

async function stopCamera() {
  scanActive = false;
  clearScanTimers();
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  manualScanHintEl.classList.remove('show');
  cameraArea.classList.remove('active');
}

async function scanQR(onCode, scanToken) {
  scanActive = true;
  const ctx = cameraCanvas.getContext('2d', { willReadFrequently: true });
  let detector = null;
  if ('BarcodeDetector' in window) {
    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      detector = null;
    }
  }

  async function tick() {
    if (!scanActive || scanToken !== currentScanToken) return;
    if (cameraVideo.readyState < cameraVideo.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(tick);
      return;
    }
    const w = cameraVideo.videoWidth;
    const h = cameraVideo.videoHeight;
    cameraCanvas.width = w;
    cameraCanvas.height = h;
    ctx.drawImage(cameraVideo, 0, 0, w, h);

    let raw = null;
    let meta = null;

    if (detector) {
      try {
        const rs = await detector.detect(cameraVideo);
        if (rs.length) {
          raw = rs[0].rawValue || null;
          const bb = rs[0].boundingBox;
          if (bb) meta = { x: bb.x, y: bb.y, w: bb.width, h: bb.height, videoWidth: w, videoHeight: h };
        }
      } catch {
        raw = null;
      }
    }

    if (!raw && window.jsQR) {
      const img = ctx.getImageData(0, 0, w, h);
      const qr = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (qr) {
        raw = qr.data;
        const xs = [qr.location.topLeftCorner.x, qr.location.topRightCorner.x, qr.location.bottomLeftCorner.x, qr.location.bottomRightCorner.x];
        const ys = [qr.location.topLeftCorner.y, qr.location.topRightCorner.y, qr.location.bottomLeftCorner.y, qr.location.bottomRightCorner.y];
        meta = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
          videoWidth: w,
          videoHeight: h,
        };
      }
    }

    if (raw) {
      const m = raw.match(/\/g\/([A-Za-z0-9]{4})(?:[/?#]|$)/i);
      const code = (m ? m[1] : raw.trim()).toUpperCase();
      if (CODE_RE.test(code)) {
        scanActive = false;
        stopScanStatusLoop(GATE_CONFIG.scanStatuses.opening);
        await animatePullToQr(meta);
        await stopCamera();
        onCode(code);
        return;
      }
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

async function apiScan(code, fp) {
  const r = await fetch('/api/gate/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, fingerprint: fp }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok && !data) throw new Error('scan request failed');
  return data;
}

async function apiTransfer(token, fp) {
  const r = await fetch('/api/gate/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transferToken: token, fingerprint: fp }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok && !data) throw new Error('transfer request failed');
  return data;
}

let fingerprint = null;
let codeFromUrl = null;

async function stateNoAccess() {
  await runChat([{ text: GATE_CONFIG.intro, delay: 450 }, ...GATE_CONFIG.noAccess]);
  clearActions();
  addBtn(GATE_CONFIG.noCodeManualInputLabel, '', () => stateManualInput(statePreGateNoCode));
  addBtn(GATE_CONFIG.noCodeReturnLabel, 'soft', () => {
    window.location.href = '/';
  });
  showActions();
}

async function statePreGateNoCode() {
  await runChat([{ text: GATE_CONFIG.intro, delay: 450 }, ...GATE_CONFIG.noCodeIntro]);
  clearActions();
  addBtn(GATE_CONFIG.noCodeScanLabel, '', () => stateCameraScan({
    returnState: statePreGateNoCode,
    fallbackManualState: () => stateManualInput(statePreGateNoCode),
  }));
  addBtn(GATE_CONFIG.noCodeManualInputLabel, 'soft', () => stateManualInput(statePreGateNoCode));
  addBtn(GATE_CONFIG.noCodeReturnLabel, 'soft', () => {
    window.location.href = '/';
  });
  showActions();
}

async function statePreGateWithCode(code) {
  await runChat([{ text: GATE_CONFIG.intro, delay: 450 }, ...GATE_CONFIG.withCodeConfirm]);
  clearActions();
  addBtn(GATE_CONFIG.withCodeActivateLabel, '', () => stateCameraScan({
    returnState: () => statePreGateWithCode(code),
    fallbackManualState: () => stateManualInput(() => statePreGateWithCode(code)),
  }));
  addBtn(GATE_CONFIG.noCodeManualInputLabel, 'soft', () => stateManualInput(() => statePreGateWithCode(code)));
  addBtn(GATE_CONFIG.noCodeReturnLabel, 'soft', () => {
    window.location.href = '/';
  });
  showActions();
}

async function stateManualInput(backState) {
  await runChat([{ text: GATE_CONFIG.manualInputPrompt, delay: 380 }]);
  addManualInput({
    onSubmit: code => stateVerify(code, backState),
    onCancel: () => backState(),
  });
}

async function stateCameraScan({ returnState, fallbackManualState }) {
  hideActions();
  clearChat();
  let scanClosed = false;
  currentScanToken += 1;
  const thisToken = currentScanToken;
  const ok = await startCamera();
  if (!ok) {
    await stopCamera();
    await runChat([{ text: GATE_CONFIG.cameraUnavailable, delay: 500 }]);
    clearActions();
    addBtn(GATE_CONFIG.noCodeManualInputLabel, '', fallbackManualState);
    addBtn(GATE_CONFIG.buttons.retry, 'soft', () => stateCameraScan({ returnState, fallbackManualState }));
    showActions();
    return;
  }

  cameraCancel.onclick = async () => {
    try {
      if (scanClosed) return;
      scanClosed = true;
      await stopCamera();
      returnState();
    } catch {
      await runChat(GATE_CONFIG.error);
    }
  };

  manualScanHintEl.onclick = async () => {
    try {
      if (scanClosed) return;
      scanClosed = true;
      await stopCamera();
      fallbackManualState();
    } catch {
      await runChat(GATE_CONFIG.error);
    }
  };

  scanQR(code => {
    if (scanClosed) return;
    scanClosed = true;
    stateVerify(code, returnState);
  }, thisToken).catch(async () => {
    await stopCamera();
    await runChat(GATE_CONFIG.error);
    clearActions();
    addBtn(GATE_CONFIG.buttons.retry, '', () => stateCameraScan({ returnState, fallbackManualState }));
    showActions();
  });
}

async function stateVerify(code, backState) {
  await stopCamera();
  hideActions();
  await quickLine('sprawdzam...');
  let result;
  try {
    result = await apiScan(code, fingerprint);
  } catch {
    result = null;
  }

  if (!result || result.error) {
    if (result && result.error === 'code not found') {
      await runChat(GATE_CONFIG.notFound);
      addManualInput({
        onSubmit: newCode => stateVerify(newCode, backState),
        onCancel: () => backState(),
      });
      return;
    }
    if (result && (result.error === 'no access' || result.error === 'no session')) {
      await stateNoAccess();
      return;
    }
    await runChat(GATE_CONFIG.error);
    clearActions();
    addBtn(GATE_CONFIG.buttons.retry, '', () => backState());
    showActions();
    return;
  }

  if (result.state === 'first') {
    await runChat(GATE_CONFIG.welcomeFirst);
    clearActions();
    addBtn(GATE_CONFIG.activateLabel || GATE_CONFIG.buttons.read, '', () => {
      window.location.href = '/poems.html';
    });
    showActions();
    return;
  }

  if (result.state === 'known') {
    await runChat(GATE_CONFIG.welcomeReturning);
    clearActions();
    addBtn(GATE_CONFIG.buttons.read, '', () => {
      window.location.href = '/poems.html';
    });
    showActions();
    return;
  }

  if (result.state === 'transfer') {
    await runChat(GATE_CONFIG.transferFlow);
    clearActions();
    addBtn(GATE_CONFIG.transferConfirm || GATE_CONFIG.buttons.transfer, '', () => stateTransfer(result.transferToken, backState));
    addBtn(GATE_CONFIG.buttons.cancel, 'soft', () => backState());
    showActions();
    return;
  }

  await runChat(GATE_CONFIG.error);
  clearActions();
  addBtn(GATE_CONFIG.buttons.retry, '', () => backState());
  showActions();
}

async function stateTransfer(token, backState) {
  hideActions();
  await quickLine('sprawdzam...');
  let result;
  try {
    result = await apiTransfer(token, fingerprint);
  } catch {
    result = null;
  }

  if (result && result.state === 'success') {
    await runChat(GATE_CONFIG.welcomeTransferred);
    clearActions();
    addBtn(GATE_CONFIG.buttons.read, '', () => {
      window.location.href = '/poems.html';
    });
    showActions();
    return;
  }

  await runChat(GATE_CONFIG.error);
  clearActions();
  addBtn(GATE_CONFIG.buttons.retry, '', () => stateTransfer(token, backState));
  addBtn(GATE_CONFIG.buttons.cancel, 'soft', () => backState());
  showActions();
}

async function init() {
  initZnaczki();
  fingerprint = await generateFingerprint();
  codeFromUrl = getCodeFromUrl();
  if (codeFromUrl) {
    await statePreGateWithCode(codeFromUrl);
  } else {
    await statePreGateNoCode();
  }
}

init().catch(err => {
  console.error('gate init error:', err);
  clearChat();
  createBubble('błąd ładowania — odśwież stronę');
});
