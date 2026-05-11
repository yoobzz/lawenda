'use strict';

const chatEl = document.getElementById('chat');
const actionsEl = document.getElementById('actions');
const cameraArea = document.getElementById('camera-area');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraCancel = document.getElementById('camera-cancel');
const scanSymbolsEl = document.getElementById('scan-symbols');
const manualScanHintEl = document.getElementById('manual-scan-hint');
const scanFlashEl = document.getElementById('scan-flash');
let scanPrototypeStageEl = document.getElementById('scan-prototype-stage');
let scanPrototypeGridEl = document.getElementById('scan-prototype-grid');
let scanPrototypeSeedEl = document.getElementById('scan-prototype-seed');
let scanPrototypeStarEl = document.getElementById('scan-prototype-star');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pageOut(href) {
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f9f9f8;opacity:0;pointer-events:none;transition:opacity 0.55s ease;';
  document.body.appendChild(veil);
  requestAnimationFrame(() => requestAnimationFrame(() => { veil.style.opacity = '1'; }));
  setTimeout(() => { window.location.href = href; }, 560);
}
const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;
const SCAN_PROTO_SEED = '+_**++~+_+~/„-„*+*^_^*++~__';
const SCAN_PROTO_RANDOM_POOL = ['<', '_', '>', '.', ',', '!', '^', '*', '|', '\\', '~', '`', ':', ';', '=', '+'];
const SCAN_PROTO_QR_POOL = ['*', '+', '=', '^', '|', '~', ':', ';'];
const SCAN_PROTO_FRAME_MARGIN_PX = 102;
const SCAN_PROTO_FRAME_LINES = ['znaczy znaczek', 'swoje znajdki', 'tak oddaje', 'przeznaczenie'];
const SCAN_PROTO_FRAME_ROTATE_MS = 1000;
const SCAN_PROTO_QR_GLYPH_FONT_SIZE = '102%';
const SCAN_PROTO_QR_SIZE_SCALE = 0.78;
const SCAN_PROTO_GLITCH_POOL = ['<', '>', '|', '/', '\\', '_', '^', ':', ';', '*', '+', '='];
const SCAN_PROTO_NOISE_OPACITY = '0.86';
const SCAN_PROTO_NOISE_COLOR = 'rgba(13,13,13,0.4)';
const SCAN_PROTO_WORD_COLOR = 'rgba(13,13,13,0.96)';
const SCAN_PROTO_WORDS_BY_CONTEXT = {
  code: ['znajdka', 'warszawa', 'klucz'],
  index: ['znajdka', 'warszawa', 'klucz'],
  tamed: ['znajdka', 'twoim', 'kluczem', 'lawendy', 'nie', 'chcesz', 'zostaw'],
};
const protoParams = new URLSearchParams(window.location.search);
const FORCE_SCAN_PROTO = protoParams.get('proto') === '1';

function getScanPrototypePool() {
  return SCAN_PROTO_RANDOM_POOL;
}

function getRandomScanChar() {
  const pool = getScanPrototypePool();
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomQrChar() {
  return SCAN_PROTO_QR_POOL[Math.floor(Math.random() * SCAN_PROTO_QR_POOL.length)];
}

function getRealQrMatrix() {
  if (cachedQrMatrix) return cachedQrMatrix;
  if (typeof qrcode === 'undefined') return null;
  try {
    const qr = qrcode(0, 'M');
    qr.addData('szpineta.com');
    qr.make();
    const n = qr.getModuleCount();
    const matrix = [];
    for (let r = 0; r < n; r += 1) {
      const row = [];
      for (let c = 0; c < n; c += 1) row.push(qr.isDark(r, c));
      matrix.push(row);
    }
    cachedQrMatrix = matrix;
    return matrix;
  } catch {
    return null;
  }
}

function isZnajdkaTamed() {
  if (protoParams.get('tamed') === '1') return true;
  try {
    return localStorage.getItem('znajdka_oswojona') === '1';
  } catch {
    return false;
  }
}

function detectPrototypeSource() {
  const forcedSource = protoParams.get('source');
  if (forcedSource === 'code' || forcedSource === 'index') return forcedSource;

  if (getCodeFromUrl()) return 'code';

  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === window.location.origin) {
      if (ref.pathname === '/' || ref.pathname === '/index.html') return 'index';
    }
  } catch {
    // ignore referrer parse failures
  }
  return 'index';
}

function getScanPrototypeWords() {
  if (isZnajdkaTamed()) return SCAN_PROTO_WORDS_BY_CONTEXT.tamed;
  const source = detectPrototypeSource();
  return SCAN_PROTO_WORDS_BY_CONTEXT[source] || SCAN_PROTO_WORDS_BY_CONTEXT.index;
}

let scanPrototypeMutationTimer = null;
let scanPrototypeActive = false;
let scanPrototypeWordRevealStarted = false;
let scanPrototypeWordLockedIndexes = new Set();
let scanPrototypeQrLockedIndexes = new Set();
let scanPrototypeGridCols = 0;
let scanPrototypeGridRows = 0;
let scanPrototypeCellSize = 12;
let scanPrototypeCellsPerMod = 1;
let cachedQrMatrix = null;
let scanPrototypeFrameEl = null;
let scanPrototypeTopTextTimer = null;
let scanPrototypeTremorTimeouts = [];
let scanPrototypeLastQrViewportRect = null;
let cameraOverlayRect = null;
let cameraOverlayFrameEl = null;
let cameraOverlayFrameTimer = null;

function buildQrLikeRevealOrder(rows, cols) {
  const total = rows * cols;
  const side = Math.max(24, Math.floor(Math.min(rows, cols) * 0.62));
  const startRow = Math.floor((rows - side) / 2);
  const startCol = Math.floor((cols - side) / 2);
  const qrSet = new Set();

  function addModule(r, c) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    qrSet.add(r * cols + c);
  }

  function drawFinder(top, left) {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const edge = r === 0 || c === 0 || r === 6 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (edge || core) addModule(top + r, left + c);
      }
    }
  }

  function drawAlignment(centerR, centerC) {
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        const rr = centerR + r;
        const cc = centerC + c;
        const edge = Math.abs(r) === 2 || Math.abs(c) === 2;
        const core = r === 0 && c === 0;
        if (edge || core) addModule(rr, cc);
      }
    }
  }

  // Border of the QR silhouette.
  for (let i = 0; i < side; i += 1) {
    addModule(startRow, startCol + i);
    addModule(startRow + side - 1, startCol + i);
    addModule(startRow + i, startCol);
    addModule(startRow + i, startCol + side - 1);
  }

  // Finder patterns.
  drawFinder(startRow + 1, startCol + 1);
  drawFinder(startRow + 1, startCol + side - 8);
  drawFinder(startRow + side - 8, startCol + 1);
  drawAlignment(startRow + side - 7, startCol + side - 7);

  // Timing lines.
  const timingRow = startRow + 6;
  const timingCol = startCol + 6;
  for (let i = 8; i < side - 8; i += 1) {
    if (i % 2 === 0) {
      addModule(timingRow, startCol + i);
      addModule(startRow + i, timingCol);
    }
  }

  // Deterministic data-like texture.
  for (let r = startRow + 8; r < startRow + side - 2; r += 1) {
    for (let c = startCol + 8; c < startCol + side - 2; c += 1) {
      if (Math.abs(r - (startRow + Math.floor(side / 2))) < 2 && Math.abs(c - (startCol + Math.floor(side / 2))) < 2) continue;
      if ((r * 19 + c * 11 + side) % 6 === 0 || ((r + c) % 4 === 0)) addModule(r, c);
    }
  }

  const centerR = startRow + Math.floor(side / 2);
  const centerC = startCol + Math.floor(side / 2);
  const qrOrder = Array.from(qrSet).sort((a, b) => {
    const ar = Math.floor(a / cols);
    const ac = a % cols;
    const br = Math.floor(b / cols);
    const bc = b % cols;
    const da = Math.max(Math.abs(ar - centerR), Math.abs(ac - centerC));
    const db = Math.max(Math.abs(br - centerR), Math.abs(bc - centerC));
    if (da !== db) return da - db;
    return Math.abs(ar - centerR) + Math.abs(ac - centerC) - (Math.abs(br - centerR) + Math.abs(bc - centerC));
  });

  const remainingByRing = new Map();
  for (let i = 0; i < total; i += 1) {
    if (qrSet.has(i)) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const dr = r < startRow ? startRow - r : (r > startRow + side - 1 ? r - (startRow + side - 1) : 0);
    const dc = c < startCol ? startCol - c : (c > startCol + side - 1 ? c - (startCol + side - 1) : 0);
    const ring = Math.max(dr, dc);
    if (!remainingByRing.has(ring)) remainingByRing.set(ring, []);
    remainingByRing.get(ring).push(i);
  }

  const remaining = [];
  const rings = Array.from(remainingByRing.keys()).sort((a, b) => a - b);
  for (const ring of rings) {
    const bucket = remainingByRing.get(ring);
    for (let i = bucket.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    remaining.push(...bucket);
  }

  return { order: [...qrOrder, ...remaining], qrCount: qrOrder.length, startRow, startCol, side };
}

function buildRealQrRevealOrder(rows, cols, matrix) {
  const qrN = matrix.length;
  const cellsPerMod = scanPrototypeCellsPerMod;
  const side = qrN * cellsPerMod;
  const startRow = Math.floor((rows - side) / 2);
  const startCol = Math.floor((cols - side) / 2);
  const total = rows * cols;

  const qrDarkSet = new Set();
  const qrAllSet = new Set();

  for (let mr = 0; mr < qrN; mr += 1) {
    for (let mc = 0; mc < qrN; mc += 1) {
      const isDark = matrix[mr][mc];
      for (let dr = 0; dr < cellsPerMod; dr += 1) {
        for (let dc = 0; dc < cellsPerMod; dc += 1) {
          const gr = startRow + mr * cellsPerMod + dr;
          const gc = startCol + mc * cellsPerMod + dc;
          if (gr < 0 || gc < 0 || gr >= rows || gc >= cols) continue;
          const idx = gr * cols + gc;
          qrAllSet.add(idx);
          if (isDark) qrDarkSet.add(idx);
        }
      }
    }
  }

  const centerR = startRow + Math.floor(side / 2);
  const centerC = startCol + Math.floor(side / 2);

  // Sort all dark cells by distance from center to find the nearest ones for fly animation
  const sortedByDist = Array.from(qrDarkSet).sort((a, b) => {
    const ar = Math.floor(a / cols), ac = a % cols;
    const br = Math.floor(b / cols), bc = b % cols;
    return Math.max(Math.abs(ar - centerR), Math.abs(ac - centerC))
      - Math.max(Math.abs(br - centerR), Math.abs(bc - centerC));
  });
  // Keep nearest cells for fly animation, shuffle the rest so QR fills randomly (not in rings)
  const FLY_RESERVE = 28;
  const flyPart = sortedByDist.slice(0, FLY_RESERVE);
  const restPart = sortedByDist.slice(FLY_RESERVE);
  for (let i = restPart.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [restPart[i], restPart[j]] = [restPart[j], restPart[i]];
  }
  const qrOrder = [...flyPart, ...restPart];

  const remainingByRing = new Map();
  for (let i = 0; i < total; i += 1) {
    if (qrAllSet.has(i)) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const dr = r < startRow ? startRow - r : (r >= startRow + side ? r - (startRow + side - 1) : 0);
    const dc = c < startCol ? startCol - c : (c >= startCol + side ? c - (startCol + side - 1) : 0);
    const ring = Math.max(dr, dc);
    if (!remainingByRing.has(ring)) remainingByRing.set(ring, []);
    remainingByRing.get(ring).push(i);
  }

  const remaining = [];
  for (const ring of Array.from(remainingByRing.keys()).sort((a, b) => a - b)) {
    const bucket = remainingByRing.get(ring);
    for (let i = bucket.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    remaining.push(...bucket);
  }

  return { order: [...qrOrder, ...remaining], qrCount: qrOrder.length, qrAllSet, startRow, startCol, side };
}

async function revealWordsInGrid(cells, qrOrder) {
  if (scanPrototypeWordRevealStarted) return;
  scanPrototypeWordRevealStarted = true;
  const words = getScanPrototypeWords();
  const qrSlots = (qrOrder || []).filter(idx => !scanPrototypeWordLockedIndexes.has(idx));
  let cursor = 0;

  for (const word of words) {
    const slots = [];
    while (slots.length < word.length && cursor < qrSlots.length) {
      const idx = qrSlots[cursor++];
      if (!scanPrototypeQrLockedIndexes.has(idx)) continue;
      slots.push(idx);
    }
    if (slots.length < word.length) break;

    for (let step = 0; step < 2; step += 1) {
      for (const idx of slots) {
        const c = cells[idx];
        if (!c) continue;
        c.textContent = getRandomQrChar();
        c.style.background = 'transparent';
        c.style.color = 'rgba(0,0,0,0.9)';
      }
      await sleep(46 + Math.floor(Math.random() * 46));
    }

    for (let i = 0; i < word.length; i += 1) {
      const idx = slots[i];
      const c = cells[idx];
      if (!c) continue;
      c.textContent = word[i];
      c.style.background = 'transparent';
      c.style.color = SCAN_PROTO_WORD_COLOR;
      c.style.opacity = '1';
      c.style.fontWeight = '800';
      c.style.letterSpacing = '0';
      scanPrototypeWordLockedIndexes.add(idx);
      await sleep(30 + Math.floor(Math.random() * 35));
    }
    await sleep(260 + Math.floor(Math.random() * 240));
  }
}

function clearFlowingQrFrame() {
  if (scanPrototypeTopTextTimer) {
    clearInterval(scanPrototypeTopTextTimer);
    scanPrototypeTopTextTimer = null;
  }
  if (scanPrototypeTremorTimeouts.length) {
    for (const timeoutId of scanPrototypeTremorTimeouts) clearTimeout(timeoutId);
    scanPrototypeTremorTimeouts = [];
  }
  if (scanPrototypeFrameEl && scanPrototypeFrameEl.parentNode) {
    scanPrototypeFrameEl.parentNode.removeChild(scanPrototypeFrameEl);
  }
  scanPrototypeFrameEl = null;
}

function hideScanPrototypeStage() {
  setProtoStatus('');
  hideProtoManualInput();
  const protoCloseBtn = document.getElementById('proto-close');
  if (protoCloseBtn) protoCloseBtn.style.display = 'none';
  scanPrototypeActive = false;
  clearFlowingQrFrame();
  if (scanPrototypeStarEl) scanPrototypeStarEl.classList.remove('show');
  if (scanPrototypeStageEl) {
    scanPrototypeStageEl.style.display = 'none';
    scanPrototypeStageEl.style.opacity = '';
    scanPrototypeStageEl.classList.remove('active', 'camera-mode');
  }
}

function setProtoStatus(text) {
  const el = document.getElementById('proto-status');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('show', Boolean(text));
}

function showProtoManualInput({ prompt = '', onSubmit, onCancel }) {
  if (scanPrototypeStageEl) {
    scanPrototypeStageEl.style.display = 'block';
    scanPrototypeStageEl.classList.add('active');
    scanPrototypeStageEl.style.opacity = '1';
  }
  const container = document.getElementById('proto-manual');
  const promptEl   = document.getElementById('proto-manual-prompt');
  const inputEl    = document.getElementById('proto-manual-input');
  const submitEl   = document.getElementById('proto-manual-submit');
  const errorEl    = document.getElementById('proto-manual-error');
  const cancelEl   = document.getElementById('proto-manual-cancel');
  if (!container || !inputEl) return;

  promptEl.textContent = prompt;
  inputEl.value = '';
  errorEl.textContent = '';
  container.classList.add('show');

  function cleanup() {
    container.classList.remove('show');
    submitEl.onclick = null;
    cancelEl.onclick = null;
    inputEl.onkeydown = null;
    inputEl.oninput = null;
  }
  function doSubmit() {
    const value = inputEl.value.trim().toUpperCase();
    if (!CODE_RE.test(value)) { errorEl.textContent = GATE_CONFIG.manualInputErrorInvalid; return; }
    errorEl.textContent = '';
    cleanup();
    onSubmit(value);
  }
  inputEl.oninput = () => {
    inputEl.value = inputEl.value.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTVWXYZ23456789]/g, '').slice(0, 4);
    errorEl.textContent = '';
  };
  inputEl.onkeydown = e => { if (e.key === 'Enter') doSubmit(); };
  submitEl.onclick = doSubmit;
  cancelEl.onclick = () => { cleanup(); onCancel(); };
  setTimeout(() => inputEl.focus(), 40);
}

function hideProtoManualInput() {
  const el = document.getElementById('proto-manual');
  if (el) el.classList.remove('show');
}

function getScanPrototypeQrViewportRect(startRow, startCol, side) {
  if (!scanPrototypeGridEl) return null;
  const gridRect = scanPrototypeGridEl.getBoundingClientRect();
  const size = side * scanPrototypeCellSize;
  const left = gridRect.left + startCol * scanPrototypeCellSize;
  const top = gridRect.top + startRow * scanPrototypeCellSize;
  return { x: left, y: top, w: size, h: size };
}

function positionScanPrototypeStar(startRow, startCol, side) {
  if (!scanPrototypeStarEl || !scanPrototypeStageEl || !scanPrototypeGridEl) return;
  const gridRect = scanPrototypeGridEl.getBoundingClientRect();
  const stageRect = scanPrototypeStageEl.getBoundingClientRect();
  const centerX = (startCol + side / 2) * scanPrototypeCellSize;
  const centerY = (startRow + side / 2) * scanPrototypeCellSize;
  const left = Math.round(gridRect.left - stageRect.left + centerX);
  const top = Math.round(gridRect.top - stageRect.top + centerY);
  scanPrototypeStarEl.style.left = `${left}px`;
  scanPrototypeStarEl.style.top = `${top}px`;
  scanPrototypeStarEl.dataset.baseLeft = String(left);
  scanPrototypeStarEl.dataset.baseTop = String(top);
  scanPrototypeStarEl.style.bottom = 'auto';
  scanPrototypeStarEl.style.transform = 'translate(-50%, -50%)';
}

function animateScanPrototypeStarCover(qrRect) {
  if (!scanPrototypeStageEl) return Promise.resolve();
  if (scanPrototypeStarEl) {
    scanPrototypeStarEl.style.animation = 'none';
    scanPrototypeStarEl.style.pointerEvents = 'none';
  }
  const stageRect = scanPrototypeStageEl.getBoundingClientRect();
  const defaultSize = Math.min(window.innerWidth, window.innerHeight) * 0.26;
  const size = qrRect ? Math.min(qrRect.w, qrRect.h) : defaultSize;
  const cx = qrRect ? (qrRect.x - stageRect.left + qrRect.w / 2) : stageRect.width / 2;
  const cy = qrRect ? (qrRect.y - stageRect.top + qrRect.h / 2) : stageRect.height / 2;
  const transitionBox = document.createElement('div');
  transitionBox.style.position = 'absolute';
  transitionBox.style.left = `${cx}px`;
  transitionBox.style.top = `${cy}px`;
  transitionBox.style.width = `${Math.max(22, size)}px`;
  transitionBox.style.height = `${Math.max(22, size)}px`;
  transitionBox.style.pointerEvents = 'none';
  transitionBox.style.zIndex = '6';
  transitionBox.style.transform = 'translate(-50%, -50%)';
  transitionBox.style.overflow = 'hidden';

  const scrambleLayer = document.createElement('div');
  const tiles = Math.max(13, Math.round(size / Math.max(8, scanPrototypeCellSize)));
  scrambleLayer.style.position = 'absolute';
  scrambleLayer.style.inset = '0';
  scrambleLayer.style.display = 'grid';
  scrambleLayer.style.gridTemplateColumns = `repeat(${tiles}, 1fr)`;
  scrambleLayer.style.gridTemplateRows = `repeat(${tiles}, 1fr)`;
  scrambleLayer.style.fontFamily = "'ABC Diatype Rounded','Inter',sans-serif";
  scrambleLayer.style.fontWeight = '700';
  scrambleLayer.style.fontSize = `${Math.max(9, Math.floor(size / (tiles * 1.03)))}px`;
  scrambleLayer.style.color = 'rgba(13,13,13,0.92)';
  scrambleLayer.style.opacity = '0.95';
  scrambleLayer.style.willChange = 'transform, opacity, filter';

  const chars = [];
  for (let i = 0; i < tiles * tiles; i += 1) {
    const el = document.createElement('span');
    el.textContent = getRandomQrChar();
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    chars.push(el);
    scrambleLayer.appendChild(el);
  }
  transitionBox.appendChild(scrambleLayer);
  scanPrototypeStageEl.appendChild(transitionBox);

  return new Promise(resolve => {
    if (typeof gsap === 'undefined') {
      if (scanPrototypeStarEl) scanPrototypeStarEl.style.opacity = '0';
      setTimeout(() => {
        if (transitionBox.parentNode) transitionBox.parentNode.removeChild(transitionBox);
        resolve();
      }, 460);
      return;
    }

    const scrambleBursts = 5;
    for (let burst = 0; burst < scrambleBursts; burst += 1) {
      const timeoutMs = 40 + burst * 55 + Math.floor(Math.random() * 26);
      const timeoutId = setTimeout(() => {
        const flips = Math.max(8, Math.floor(chars.length * (0.18 + Math.random() * 0.16)));
        for (let i = 0; i < flips; i += 1) {
          const idx = Math.floor(Math.random() * chars.length);
          chars[idx].textContent = getRandomQrChar();
        }
      }, timeoutMs);
      scanPrototypeTremorTimeouts.push(timeoutId);
    }

    gsap.timeline({
      onComplete: () => {
        if (transitionBox.parentNode) transitionBox.parentNode.removeChild(transitionBox);
        resolve();
      },
    })
      .to(scrambleLayer, {
        scale: 1.015,
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
        duration: 0.18,
        ease: 'steps(2)',
      })
      .to(scrambleLayer, {
        x: 0,
        y: 0,
        scale: 1,
        filter: 'blur(0.8px)',
        opacity: 0,
        duration: 0.28,
        ease: 'power2.out',
      }, '>-0.01')
      .to(transitionBox, { opacity: 0, duration: 0.08, ease: 'none' }, '>-0.02');
    if (scanPrototypeStarEl) {
      gsap.to(scanPrototypeStarEl, { opacity: 0, duration: 0.16, ease: 'power1.out' });
    }
  });
}

function resetScanPrototypeStarShape() {
  if (!scanPrototypeStarEl) return;
  scanPrototypeStarEl.style.animation = '';
  scanPrototypeStarEl.style.opacity = '';
  scanPrototypeStarEl.style.rotate = '';
  scanPrototypeStarEl.style.width = '';
  scanPrototypeStarEl.style.height = '';
  scanPrototypeStarEl.style.transform = 'translate(-50%, -50%)';
  scanPrototypeStarEl.style.filter = '';
  scanPrototypeStarEl.style.clipPath = '';
}

function applyCameraOverlayRect(rect) {
  cameraOverlayRect = rect || null;
  if (!cameraOverlayRect) {
    cameraArea.classList.remove('qr-overlay');
    cameraArea.style.removeProperty('--camera-overlay-x');
    cameraArea.style.removeProperty('--camera-overlay-y');
    cameraArea.style.removeProperty('--camera-overlay-size');
    cameraArea.style.removeProperty('--camera-overlay-cx');
    cameraArea.style.removeProperty('--camera-overlay-cy');
    cameraArea.style.removeProperty('--camera-overlay-right');
    cameraArea.style.removeProperty('--camera-overlay-bottom');
    clearCameraOverlayFrame();
    return;
  }
  const size = Math.round(Math.min(cameraOverlayRect.w, cameraOverlayRect.h));
  const targetX = Math.round(cameraOverlayRect.x + (cameraOverlayRect.w - size) / 2);
  const targetY = Math.round(cameraOverlayRect.y + (cameraOverlayRect.h - size) / 2);
  const x = Math.max(0, Math.min(window.innerWidth - size, targetX));
  const y = Math.max(0, Math.min(window.innerHeight - size, targetY));
  const cx = Math.round(x + size / 2);
  const cy = Math.round(y + size / 2);
  cameraArea.style.setProperty('--camera-overlay-x', `${x}px`);
  cameraArea.style.setProperty('--camera-overlay-y', `${y}px`);
  cameraArea.style.setProperty('--camera-overlay-size', `${size}px`);
  cameraArea.style.setProperty('--camera-overlay-cx', `${cx}px`);
  cameraArea.style.setProperty('--camera-overlay-cy', `${cy}px`);
  // compute right/bottom in JS — CSS 100vh on iOS includes browser chrome and is wrong
  cameraArea.style.setProperty('--camera-overlay-right', `${window.innerWidth - x - size}px`);
  cameraArea.style.setProperty('--camera-overlay-bottom', `${window.innerHeight - y - size}px`);
  cameraArea.classList.add('qr-overlay');
}

function clearCameraOverlayFrame() {
  if (cameraOverlayFrameTimer) {
    clearInterval(cameraOverlayFrameTimer);
    cameraOverlayFrameTimer = null;
  }
  if (cameraOverlayFrameEl && cameraOverlayFrameEl.parentNode) {
    cameraOverlayFrameEl.parentNode.removeChild(cameraOverlayFrameEl);
  }
  cameraOverlayFrameEl = null;
}

function createCameraOverlayFrame() {
  clearCameraOverlayFrame();
  if (!cameraOverlayRect || !cameraArea) return;

  const size = Math.round(Math.min(cameraOverlayRect.w, cameraOverlayRect.h));
  const x = Math.round(cameraOverlayRect.x + (cameraOverlayRect.w - size) / 2);
  const y = Math.round(cameraOverlayRect.y + (cameraOverlayRect.h - size) / 2);
  const cornerPad = 12;
  const edgeLen = Math.max(30, size - cornerPad * 2);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = `${x}px`;
  wrapper.style.top = `${y}px`;
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '5';
  wrapper.style.fontFamily = "'Helvetica Neue', 'Arial', sans-serif";
  wrapper.style.fontWeight = '700';
  wrapper.style.fontSize = '12px';
  wrapper.style.letterSpacing = '1px';
  wrapper.style.color = 'rgba(255,255,255,0.86)';

  const top = document.createElement('div');
  const right = document.createElement('div');
  const bottom = document.createElement('div');
  const left = document.createElement('div');
  const edges = [top, right, bottom, left];

  for (const edge of edges) {
    edge.style.position = 'absolute';
    edge.style.whiteSpace = 'nowrap';
    edge.style.overflow = 'hidden';
    edge.style.display = 'flex';
    edge.style.alignItems = 'center';
    edge.style.justifyContent = 'center';
    edge.style.lineHeight = '1';
  }

  top.style.left = `${cornerPad}px`;
  top.style.top = '0';
  top.style.width = `calc(100% - ${cornerPad * 2}px)`;
  top.style.height = '16px';

  bottom.style.left = `${cornerPad}px`;
  bottom.style.bottom = '0';
  bottom.style.width = `calc(100% - ${cornerPad * 2}px)`;
  bottom.style.height = '16px';
  bottom.style.transform = 'rotate(180deg)';
  bottom.style.transformOrigin = 'center';

  left.style.left = '0';
  left.style.top = `${cornerPad}px`;
  left.style.width = '16px';
  left.style.height = `calc(100% - ${cornerPad * 2}px)`;
  left.style.writingMode = 'vertical-rl';
  left.style.textOrientation = 'mixed';

  right.style.right = '0';
  right.style.top = `${cornerPad}px`;
  right.style.width = '16px';
  right.style.height = `calc(100% - ${cornerPad * 2}px)`;
  right.style.writingMode = 'vertical-rl';
  right.style.textOrientation = 'mixed';
  right.style.transform = 'rotate(180deg)';
  right.style.transformOrigin = 'center';

  function setStretched(node, text, px, vertical = false) {
    node.textContent = text;
    const fontPx = 12;
    const glyphPx = vertical ? fontPx : fontPx * 0.62;
    const chars = Math.max(1, text.length - 1);
    const spacing = (px - text.length * glyphPx) / chars;
    node.style.letterSpacing = `${Math.max(0.4, Math.min(7.2, spacing)).toFixed(2)}px`;
  }

  function applyTexts(offset) {
    for (let i = 0; i < edges.length; i += 1) {
      const phrase = SCAN_PROTO_FRAME_LINES[(offset + i) % SCAN_PROTO_FRAME_LINES.length];
      setStretched(edges[i], phrase, edgeLen, i % 2 === 1);
    }
  }

  let offset = 0;
  applyTexts(offset);
  cameraOverlayFrameTimer = setInterval(() => {
    offset = (offset + 1) % SCAN_PROTO_FRAME_LINES.length;
    applyTexts(offset);
  }, SCAN_PROTO_FRAME_ROTATE_MS);

  wrapper.appendChild(top);
  wrapper.appendChild(right);
  wrapper.appendChild(bottom);
  wrapper.appendChild(left);
  cameraArea.appendChild(wrapper);
  cameraOverlayFrameEl = wrapper;
}

function applyCameraOverlayVisuals(rect) {
  applyCameraOverlayRect(rect);
  createCameraOverlayFrame();
}

function tremorQrChars(cells, opts = {}) {
  if (!scanPrototypeActive || !cells?.length || scanPrototypeQrLockedIndexes.size === 0) return;
  const { strong = false } = opts;
  const locked = Array.from(scanPrototypeQrLockedIndexes);
  for (let i = locked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [locked[i], locked[j]] = [locked[j], locked[i]];
  }
  const ratio = strong
    ? 0.52 + Math.random() * 0.26
    : 0.24 + Math.random() * 0.28;
  const subsetSize = Math.min(locked.length, Math.max(14, Math.floor(locked.length * ratio)));
  const subset = locked.slice(0, subsetSize);
  const waves = strong
    ? 4 + Math.floor(Math.random() * 3)
    : 2 + Math.floor(Math.random() * 3);
  let delayAcc = 0;

  for (let wave = 0; wave < waves; wave += 1) {
    delayAcc += 18 + Math.floor(Math.random() * 34);
    const timeoutId = setTimeout(() => {
      if (!scanPrototypeActive) return;
      const shift = strong ? 2.2 : 1.35;
      const rotRange = strong ? 8.5 : 5.5;
      for (const idx of subset) {
        const cell = cells[idx];
        if (!cell) continue;
        const dx = (Math.random() - 0.5) * shift;
        const dy = (Math.random() - 0.5) * shift;
        const rot = (Math.random() - 0.5) * rotRange;
        cell.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
      }
      if (scanPrototypeStarEl) {
        const baseLeft = Number(scanPrototypeStarEl.dataset.baseLeft || scanPrototypeStarEl.style.left.replace('px', ''));
        const baseTop = Number(scanPrototypeStarEl.dataset.baseTop || scanPrototypeStarEl.style.top.replace('px', ''));
        if (Number.isFinite(baseLeft) && Number.isFinite(baseTop)) {
          const starShift = strong ? 2.6 : 1.6;
          const sx = (Math.random() - 0.5) * starShift;
          const sy = (Math.random() - 0.5) * starShift;
          scanPrototypeStarEl.style.left = `${(baseLeft + sx).toFixed(2)}px`;
          scanPrototypeStarEl.style.top = `${(baseTop + sy).toFixed(2)}px`;
        }
      }
    }, delayAcc);
    scanPrototypeTremorTimeouts.push(timeoutId);
  }

  const clearTimeoutId = setTimeout(() => {
    for (const idx of subset) {
      const cell = cells[idx];
      if (!cell) continue;
      cell.style.transform = '';
    }
    if (scanPrototypeStarEl) {
      const baseLeft = Number(scanPrototypeStarEl.dataset.baseLeft || scanPrototypeStarEl.style.left.replace('px', ''));
      const baseTop = Number(scanPrototypeStarEl.dataset.baseTop || scanPrototypeStarEl.style.top.replace('px', ''));
      if (Number.isFinite(baseLeft)) scanPrototypeStarEl.style.left = `${baseLeft}px`;
      if (Number.isFinite(baseTop)) scanPrototypeStarEl.style.top = `${baseTop}px`;
    }
  }, delayAcc + 90 + Math.floor(Math.random() * 70));
  scanPrototypeTremorTimeouts.push(clearTimeoutId);
}

function createFlowingQrFrame(startRow, startCol, side, cells) {
  clearFlowingQrFrame();
  const margin = SCAN_PROTO_FRAME_MARGIN_PX;
  const gridW = scanPrototypeGridCols * scanPrototypeCellSize;
  const gridH = scanPrototypeGridRows * scanPrototypeCellSize;
  const qrLeft = startCol * scanPrototypeCellSize;
  const qrTop = startRow * scanPrototypeCellSize;
  const qrSize = side * scanPrototypeCellSize;

  const frameLeft = Math.max(0, qrLeft - margin);
  const frameTop = Math.max(0, qrTop - margin);
  const frameRight = Math.min(gridW, qrLeft + qrSize + margin);
  const frameBottom = Math.min(gridH, qrTop + qrSize + margin);
  const frameW = Math.max(40, frameRight - frameLeft);
  const frameH = Math.max(40, frameBottom - frameTop);

  const baseColor = 'rgba(0,0,0,0.9)';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = `${frameLeft}px`;
  wrapper.style.top = `${frameTop}px`;
  wrapper.style.width = `${frameW}px`;
  wrapper.style.height = `${frameH}px`;
  wrapper.style.pointerEvents = 'auto';
  wrapper.style.zIndex = '3';
  wrapper.style.fontFamily = "'Helvetica Neue', 'Arial', sans-serif";
  wrapper.style.fontWeight = '700';
  wrapper.style.fontSize = '12px';
  wrapper.style.letterSpacing = '1.1px';
  wrapper.style.color = baseColor;

  const top = document.createElement('div');
  const right = document.createElement('div');
  const bottom = document.createElement('div');
  const left = document.createElement('div');
  const edgeNodes = [top, right, bottom, left];
  const cornerPad = Math.max(12, Math.round(scanPrototypeCellSize * 1.35));

  for (const edge of edgeNodes) {
    edge.style.position = 'absolute';
    edge.style.whiteSpace = 'nowrap';
    edge.style.overflow = 'hidden';
    edge.style.pointerEvents = 'none';
    edge.style.userSelect = 'none';
    edge.style.color = baseColor;
    edge.style.display = 'flex';
    edge.style.alignItems = 'center';
    edge.style.justifyContent = 'center';
    edge.style.lineHeight = '1';
  }

  top.style.left = `${cornerPad}px`;
  top.style.top = '0';
  top.style.width = `calc(100% - ${cornerPad * 2}px)`;
  top.style.height = '16px';
  top.style.textAlign = 'center';

  bottom.style.left = `${cornerPad}px`;
  bottom.style.bottom = '0';
  bottom.style.width = `calc(100% - ${cornerPad * 2}px)`;
  bottom.style.height = '16px';
  bottom.style.transform = 'rotate(180deg)';
  bottom.style.transformOrigin = 'center';
  bottom.style.textAlign = 'center';

  left.style.left = '0';
  left.style.top = `${cornerPad}px`;
  left.style.height = `calc(100% - ${cornerPad * 2}px)`;
  left.style.width = '16px';
  left.style.writingMode = 'vertical-rl';
  left.style.textOrientation = 'mixed';
  left.style.textAlign = 'center';

  right.style.right = '0';
  right.style.top = `${cornerPad}px`;
  right.style.height = `calc(100% - ${cornerPad * 2}px)`;
  right.style.width = '16px';
  right.style.writingMode = 'vertical-rl';
  right.style.textOrientation = 'mixed';
  right.style.transform = 'rotate(180deg)';
  right.style.transformOrigin = 'center';
  right.style.textAlign = 'center';

  function setStretchedEdgeText(node, text, edgePx, isVertical = false) {
    node.textContent = text;
    const fontPx = 12;
    const glyphPx = isVertical ? fontPx : fontPx * 0.62;
    const chars = Math.max(1, text.length - 1);
    const spacing = (edgePx - text.length * glyphPx) / chars;
    node.style.letterSpacing = `${Math.max(0.4, Math.min(7.2, spacing)).toFixed(2)}px`;
  }

  const topEdgePx = frameW - cornerPad * 2;
  const sideEdgePx = frameH - cornerPad * 2;
  const edges = [top, right, bottom, left];
  const edgeLens = [topEdgePx, sideEdgePx, topEdgePx, sideEdgePx];
  const edgeVertical = [false, true, false, true];

  function applyRotatingEdgeTexts(offset) {
    for (let i = 0; i < edges.length; i += 1) {
      const phrase = SCAN_PROTO_FRAME_LINES[(offset + i) % SCAN_PROTO_FRAME_LINES.length];
      setStretchedEdgeText(edges[i], phrase, edgeLens[i], edgeVertical[i]);
    }
  }

  let rotateOffset = 0;
  applyRotatingEdgeTexts(rotateOffset);
  scanPrototypeTopTextTimer = setInterval(() => {
    if (!scanPrototypeFrameEl || !scanPrototypeFrameEl.isConnected) return;
    rotateOffset = (rotateOffset + 1) % SCAN_PROTO_FRAME_LINES.length;
    applyRotatingEdgeTexts(rotateOffset);
    tremorQrChars(cells, { strong: false });
  }, SCAN_PROTO_FRAME_ROTATE_MS);

  function makeCorner(x, y) {
    const c = document.createElement('div');
    c.textContent = '+';
    c.style.position = 'absolute';
    c.style.left = x;
    c.style.top = y;
    c.style.width = '16px';
    c.style.height = '16px';
    c.style.display = 'flex';
    c.style.alignItems = 'center';
    c.style.justifyContent = 'center';
    c.style.color = baseColor;
    c.style.fontFamily = "'Helvetica Neue', 'Arial', sans-serif";
    c.style.fontWeight = '700';
    c.style.fontSize = '12px';
    c.style.lineHeight = '1';
    c.style.pointerEvents = 'none';
    return c;
  }

  const cornerNodes = [
    makeCorner('0', '0'),
    makeCorner('calc(100% - 16px)', '0'),
    makeCorner('0', 'calc(100% - 16px)'),
    makeCorner('calc(100% - 16px)', 'calc(100% - 16px)'),
  ];

  wrapper.appendChild(top);
  wrapper.appendChild(right);
  wrapper.appendChild(bottom);
  wrapper.appendChild(left);
  cornerNodes.forEach(node => wrapper.appendChild(node));
  scanPrototypeGridEl.appendChild(wrapper);
  scanPrototypeFrameEl = wrapper;

  wrapper.addEventListener('mouseenter', () => {
    edgeNodes.forEach(n => { n.style.color = 'rgba(0,0,0,1)'; });
    cornerNodes.forEach(n => { n.style.color = 'rgba(0,0,0,1)'; });
  });
  wrapper.addEventListener('mouseleave', () => {
    edgeNodes.forEach(n => { n.style.color = baseColor; });
    cornerNodes.forEach(n => { n.style.color = baseColor; });
  });
  wrapper.addEventListener('click', () => {
    for (const node of edgeNodes) {
      const base = node.textContent;
      const arr = Array.from(base);
      const flips = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < flips; i += 1) {
        const idx = Math.floor(Math.random() * arr.length);
        if (arr[idx] === ' ') continue;
        arr[idx] = SCAN_PROTO_GLITCH_POOL[Math.floor(Math.random() * SCAN_PROTO_GLITCH_POOL.length)];
      }
      node.textContent = arr.join('');
      setTimeout(() => { node.textContent = base; }, 150);
    }
  });
}

function ensureScanPrototypeDom() {
  if (!scanPrototypeStageEl) {
    scanPrototypeStageEl = document.createElement('div');
    scanPrototypeStageEl.id = 'scan-prototype-stage';
    document.body.appendChild(scanPrototypeStageEl);
  }
  if (!scanPrototypeGridEl) {
    scanPrototypeGridEl = document.createElement('div');
    scanPrototypeGridEl.id = 'scan-prototype-grid';
    scanPrototypeStageEl.appendChild(scanPrototypeGridEl);
  }
  if (!scanPrototypeSeedEl) {
    scanPrototypeSeedEl = document.createElement('div');
    scanPrototypeSeedEl.id = 'scan-prototype-seed';
    scanPrototypeStageEl.appendChild(scanPrototypeSeedEl);
  }
  if (!scanPrototypeStarEl) {
    scanPrototypeStarEl = document.createElement('button');
    scanPrototypeStarEl.id = 'scan-prototype-star';
    scanPrototypeStarEl.type = 'button';
    scanPrototypeStarEl.setAttribute('aria-label', 'przejdź do skanowania');
    scanPrototypeStageEl.appendChild(scanPrototypeStarEl);
  }

  scanPrototypeStageEl.style.display = 'none';
  scanPrototypeStageEl.style.position = 'fixed';
  scanPrototypeStageEl.style.inset = '0';
  scanPrototypeStageEl.style.zIndex = '9999';
  scanPrototypeStageEl.style.background = '#fff';
  scanPrototypeStageEl.style.overflow = 'hidden';
  scanPrototypeStageEl.style.pointerEvents = 'auto';
  scanPrototypeStageEl.style.cursor = 'default';

  scanPrototypeGridEl.style.position = 'absolute';
  scanPrototypeGridEl.style.inset = '0';
  scanPrototypeGridEl.style.display = 'grid';
  scanPrototypeGridEl.style.fontFamily = "'ABC Diatype Rounded','Inter',sans-serif";
  scanPrototypeGridEl.style.fontSize = 'clamp(0.78rem, 1.6vw, 1.02rem)';
  scanPrototypeGridEl.style.fontWeight = '300';
  scanPrototypeGridEl.style.letterSpacing = '0.1em';
  scanPrototypeGridEl.style.color = SCAN_PROTO_NOISE_COLOR;
  scanPrototypeGridEl.style.userSelect = 'none';
  scanPrototypeGridEl.style.pointerEvents = 'auto';
  scanPrototypeGridEl.style.justifyItems = 'center';
  scanPrototypeGridEl.style.alignItems = 'center';

  scanPrototypeSeedEl.style.position = 'absolute';
  scanPrototypeSeedEl.style.left = '50%';
  scanPrototypeSeedEl.style.top = '50%';
  scanPrototypeSeedEl.style.transform = 'translate(-50%, -50%)';
  scanPrototypeSeedEl.style.fontFamily = "'ABC Diatype Rounded','Inter',sans-serif";
  scanPrototypeSeedEl.style.fontSize = 'clamp(1.2rem, 3vw, 1.8rem)';
  scanPrototypeSeedEl.style.fontWeight = '300';
  scanPrototypeSeedEl.style.letterSpacing = '0.16em';
  scanPrototypeSeedEl.style.color = 'rgba(13,13,13,0.92)';
  scanPrototypeSeedEl.style.whiteSpace = 'pre';
  scanPrototypeSeedEl.style.userSelect = 'none';
  scanPrototypeSeedEl.style.pointerEvents = 'none';
  scanPrototypeSeedEl.style.transition = 'none';
}

function stopScanPrototypeMutation() {
  if (scanPrototypeMutationTimer) {
    clearInterval(scanPrototypeMutationTimer);
    scanPrototypeMutationTimer = null;
  }
}

function buildScanPrototypeGrid(qrMatrix) {
  scanPrototypeGridEl.innerHTML = '';
  const pool = getScanPrototypePool();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let gridWidthPx = vw;
  let gridHeightPx = vh;
  let cellSize;
  if (qrMatrix) {
    const qrN = qrMatrix.length;
    const raw = Math.floor(Math.min(vw, vh) * 0.70 / (qrN * 2));
    scanPrototypeCellsPerMod = raw >= 8 ? 2 : 1;
    const baseCellSize = raw * (scanPrototypeCellsPerMod === 1 ? 2 : 1);
    cellSize = Math.max(8, Math.min(20, Math.floor(baseCellSize * SCAN_PROTO_QR_SIZE_SCALE)));
    const qrSideCells = qrN * scanPrototypeCellsPerMod;
    const paddingCells = Math.max(6, Math.floor(qrSideCells * 0.16));
    const plannedCols = qrSideCells + paddingCells * 2;
    const plannedRows = qrSideCells + paddingCells * 2;
    gridWidthPx = Math.min(vw, plannedCols * cellSize);
    gridHeightPx = Math.min(vh, plannedRows * cellSize);
  } else {
    scanPrototypeCellsPerMod = 1;
    cellSize = Math.max(14, Math.min(20, Math.floor(vw / 64)));
  }
  const cols = Math.max(16, Math.floor(gridWidthPx / cellSize));
  const rows = Math.max(16, Math.floor(gridHeightPx / cellSize));
  scanPrototypeCellSize = cellSize;
  scanPrototypeGridCols = cols;
  scanPrototypeGridRows = rows;

  scanPrototypeGridEl.style.inset = 'auto';
  scanPrototypeGridEl.style.left = '50%';
  scanPrototypeGridEl.style.top = '50%';
  scanPrototypeGridEl.style.transform = 'translate(-50%, -50%)';
  scanPrototypeGridEl.style.width = `${Math.max(1, cols * cellSize)}px`;
  scanPrototypeGridEl.style.height = `${Math.max(1, rows * cellSize)}px`;
  scanPrototypeGridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  scanPrototypeGridEl.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  scanPrototypeGridEl.style.fontSize = Math.max(9, Math.floor(cellSize * 1.02)) + 'px';

  const cells = [];
  const total = rows * cols;
  for (let i = 0; i < total; i += 1) {
    const span = document.createElement('span');
    span.className = 'scan-prototype-cell';
    span.textContent = pool[i % pool.length];
    span.style.opacity = '0';
    span.style.color = SCAN_PROTO_NOISE_COLOR;
    span.style.display = 'flex';
    span.style.alignItems = 'center';
    span.style.justifyContent = 'center';
    span.style.transition = 'none';
    span.style.width = '100%';
    span.style.height = '100%';
    span.style.minWidth = '0';
    span.style.whiteSpace = 'nowrap';
    span.style.lineHeight = '1';
    span.style.pointerEvents = 'none';
    span.style.fontWeight = '100';
    span.style.letterSpacing = '0.14em';
    scanPrototypeGridEl.appendChild(span);
    cells.push(span);
  }
  return cells;
}

async function runScanPrototypeStage() {
  ensureScanPrototypeDom();
  if (!scanPrototypeStageEl || !scanPrototypeGridEl || !scanPrototypeSeedEl) return;
  stopScanPrototypeMutation();
  scanPrototypeActive = true;
  scanPrototypeWordRevealStarted = false;
  scanPrototypeWordLockedIndexes = new Set();
  scanPrototypeQrLockedIndexes = new Set();
  clearFlowingQrFrame();

  scanPrototypeSeedEl.textContent = '';
  scanPrototypeSeedEl.style.opacity = '1';
  resetScanPrototypeStarShape();
  if (scanPrototypeStarEl) scanPrototypeStarEl.classList.remove('show');
  scanPrototypeGridEl.innerHTML = '';
  scanPrototypeStageEl.classList.add('active');
  scanPrototypeStageEl.style.display = 'block';
  scanPrototypeStageEl.style.opacity = '1';

  // faza 1: wpisywanie seed w centrum
  for (const ch of Array.from(SCAN_PROTO_SEED)) {
    if (!scanPrototypeActive) return;
    scanPrototypeSeedEl.textContent += ch;
    const delay = Math.random() < 0.22
      ? 110 + Math.floor(Math.random() * 120)
      : 25 + Math.floor(Math.random() * 85);
    await sleep(delay);
  }

  await sleep(180);
  if (!scanPrototypeActive) return;

  // faza 2: budujemy ukryty grid, czekamy na layout
  const qrMatrix = getRealQrMatrix();
  const cells = buildScanPrototypeGrid(qrMatrix);
  const _qrReveal = qrMatrix
    ? buildRealQrRevealOrder(scanPrototypeGridRows, scanPrototypeGridCols, qrMatrix)
    : buildQrLikeRevealOrder(scanPrototypeGridRows, scanPrototypeGridCols);
  const { order, qrCount, startRow: qrStartRow, startCol: qrStartCol, side: qrSide } = _qrReveal;
  if (_qrReveal.qrAllSet) for (const idx of _qrReveal.qrAllSet) scanPrototypeQrLockedIndexes.add(idx);
  await sleep(80);
  if (!scanPrototypeActive) return;

  // wcześniejsza ramka — pojawia się przed lotem charów
  scanPrototypeLastQrViewportRect = getScanPrototypeQrViewportRect(qrStartRow, qrStartCol, qrSide);
  createFlowingQrFrame(qrStartRow, qrStartCol, qrSide, cells);
  positionScanPrototypeStar(qrStartRow, qrStartCol, qrSide);
  await sleep(680);
  if (!scanPrototypeActive) return;

  // faza 3: znaczki lecą z centrum na pozycje QR
  const seedArr = Array.from(SCAN_PROTO_SEED);
  const qrOrder = order.slice(0, qrCount);
  const flyCount = Math.min(seedArr.length, qrOrder.length);

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  gsap.to(scanPrototypeSeedEl, { opacity: 0, duration: 0.25 });

  const flyLayer = document.createElement('div');
  flyLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  scanPrototypeStageEl.appendChild(flyLayer);

  const flyPromises = [];
  for (let i = 0; i < flyCount; i += 1) {
    const cellIdx = qrOrder[i];
    const cell = cells[cellIdx];
    const r = cell.getBoundingClientRect();
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height / 2;

    const span = document.createElement('span');
    span.textContent = seedArr[i];
    span.style.cssText = [
      'position:absolute',
      `left:${cx}px`,
      `top:${cy}px`,
      'transform:translate(-50%,-50%)',
      "font-family:'ABC Diatype Rounded','Inter',sans-serif",
      'font-size:clamp(0.7rem,1.6vw,1rem)',
      'font-weight:700',
      'color:rgba(13,13,13,0.92)',
      'opacity:0',
      'pointer-events:none',
      'line-height:1',
      'letter-spacing:0',
      'white-space:nowrap',
    ].join(';');
    flyLayer.appendChild(span);

    flyPromises.push(new Promise(res => {
      gsap.to(span, {
        left: tx,
        top: ty,
        opacity: 1,
        duration: 0.52 + Math.random() * 0.32,
        delay: i * 0.028 + Math.random() * 0.06,
        ease: 'power2.out',
        onComplete: () => {
          cell.textContent = getRandomQrChar();
          cell.style.background = 'transparent';
          cell.style.color = 'rgba(0,0,0,0.95)';
          cell.style.opacity = '1';
          cell.style.fontWeight = '700';
          cell.style.letterSpacing = '0';
          cell.style.fontSize = SCAN_PROTO_QR_GLYPH_FONT_SIZE;
          cell.style.lineHeight = '1';
          cell.style.overflow = 'hidden';
          cell.style.textShadow = 'none';
          scanPrototypeQrLockedIndexes.add(cellIdx);
          gsap.to(span, { opacity: 0, duration: 0.12, onComplete: res });
        },
      });
    }));
  }

  await Promise.all(flyPromises);
  flyLayer.remove();
  if (!scanPrototypeActive) return;

  // faza 4: pozostałe komórki QR pojawiają się szybko
  for (let i = flyCount; i < qrOrder.length; i += 1) {
    if (!scanPrototypeActive) return;
    const idx = qrOrder[i];
    const cell = cells[idx];
    cell.textContent = getRandomQrChar();
    cell.style.background = 'transparent';
    cell.style.color = 'rgba(0,0,0,0.95)';
    cell.style.opacity = '1';
    cell.style.fontWeight = '700';
    cell.style.letterSpacing = '0';
    cell.style.fontSize = SCAN_PROTO_QR_GLYPH_FONT_SIZE;
    cell.style.lineHeight = '1';
    cell.style.overflow = 'hidden';
    cell.style.textShadow = 'none';
    scanPrototypeQrLockedIndexes.add(idx);
    if (i % 5 === 0) await sleep(6);
  }

  await sleep(220);
  if (!scanPrototypeActive) return;
  scanPrototypeSeedEl.style.opacity = '0';
  scanPrototypeSeedEl.textContent = '';

  await sleep(620);
  if (!scanPrototypeActive) return;
  tremorQrChars(cells, { strong: true });
  await sleep(1500);
  if (!scanPrototypeActive) return;
  if (scanPrototypeStarEl) scanPrototypeStarEl.classList.add('show');

  return await new Promise(resolve => {
    if (!scanPrototypeStarEl) {
      resolve({ choice: 'scan', qrRect: scanPrototypeLastQrViewportRect });
      return;
    }
    const onStar = async () => {
      scanPrototypeStarEl.removeEventListener('click', onStar);
      await animateScanPrototypeStarCover(scanPrototypeLastQrViewportRect);
      resolve({ choice: 'scan', qrRect: scanPrototypeLastQrViewportRect });
    };
    scanPrototypeStarEl.addEventListener('click', onStar);
  });
}

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
let manualHintTimer = null;
let currentScanToken = 0;

function clearScanTimers() {
  if (manualHintTimer) clearTimeout(manualHintTimer);
  manualHintTimer = null;
}

function initScanSymbols() {
  scanSymbolsEl.innerHTML = '';
  const chars = ['_', '-', '~', '"', '*', '^', '|', ',', '.', '+', '=', '`', "'", '!'];
  const N = 16;

  function place(xPct, yPct) {
    const s = document.createElement('span');
    s.className = 'scan-symbol';
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    s.style.left = xPct + '%';
    s.style.top = yPct + '%';
    s.style.setProperty('--pd', '-' + (Math.random() * 2.2).toFixed(2) + 's');
    scanSymbolsEl.appendChild(s);
  }

  for (let i = 0; i <= N; i += 1) {
    const t = (i / N) * 100;
    place(t, 0);
    place(100, t);
    place(100 - t, 100);
    place(0, 100 - t);
  }
}

function convertVideoRectToViewport(meta) {
  if (!meta || !meta.videoWidth || !meta.videoHeight) return null;
  const videoRect = cameraVideo.getBoundingClientRect();
  const vw = Math.max(1, videoRect.width);
  const vh = Math.max(1, videoRect.height);
  const scale = Math.max(vw / meta.videoWidth, vh / meta.videoHeight);
  const drawW = meta.videoWidth * scale;
  const drawH = meta.videoHeight * scale;
  const offsetX = (vw - drawW) / 2;
  const offsetY = (vh - drawH) / 2;
  return {
    x: videoRect.left + offsetX + meta.x * scale,
    y: videoRect.top + offsetY + meta.y * scale,
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
        opacity: 1,
        duration: 0.55 + Math.random() * 0.5,
        delay: i * 0.018,
        ease: 'power2.in',
      });
    });
    gsap.to(scanFlashEl, {
      opacity: 0.68,
      duration: 0.45,
      delay: 0.6,
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
    cameraArea.classList.add('active');
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play().catch(() => {});
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      await new Promise(resolve => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          cameraVideo.removeEventListener('loadedmetadata', finish);
          resolve();
        };
        cameraVideo.addEventListener('loadedmetadata', finish, { once: true });
        setTimeout(finish, 900);
      });
    }
    manualScanHintEl.classList.remove('show');
    initScanSymbols();
    manualHintTimer = setTimeout(() => {
      manualScanHintEl.classList.add('show');
    }, 30000);
    return true;
  } catch {
    cameraArea.classList.remove('active');
    clearCameraOverlayFrame();
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
  cameraCanvas.style.display = 'none';
  cameraArea.classList.remove('active');
  applyCameraOverlayRect(null);
  clearCameraOverlayFrame();
}

async function scanQR(onCode, scanToken) {
  scanActive = true;
  const offscreen = document.createElement('canvas');
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  const SCAN_SIZE = 600;

  let detector = null;
  if ('BarcodeDetector' in window) {
    try {
      const supported = await BarcodeDetector.getSupportedFormats().catch(() => ['qr_code']);
      if (supported.includes('qr_code')) {
        detector = new BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch { detector = null; }
  }

  // compute the portion of the raw video frame that maps to the overlay window
  function getVideoCropRect(vw, vh) {
    if (!cameraOverlayRect) return null;
    const cW = window.innerWidth;
    const cH = window.innerHeight;
    // object-fit: cover scale factor
    const s = Math.max(cW / vw, cH / vh);
    const dx = (cW - vw * s) / 2;
    const dy = (cH - vh * s) / 2;
    const r = cameraOverlayRect;
    const cx = Math.max(0, (r.x - dx) / s);
    const cy = Math.max(0, (r.y - dy) / s);
    const cw = Math.min(vw - cx, r.w / s);
    const ch = Math.min(vh - cy, r.h / s);
    if (cw < 20 || ch < 20) return null;
    return { cx, cy, cw, ch };
  }

  function tryJsQR(w, h) {
    if (!window.jsQR) return null;
    const img = ctx.getImageData(0, 0, w, h);
    return jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
  }

  let intervalId = null;
  let ticking = false;

  async function tick() {
    if (ticking) return;
    if (!scanActive || scanToken !== currentScanToken) {
      if (intervalId) clearInterval(intervalId);
      return;
    }
    if (cameraVideo.readyState < 2) return;
    const vw = cameraVideo.videoWidth;
    const vh = cameraVideo.videoHeight;
    if (!vw || !vh) return;

    ticking = true;
    try {
      let raw = null;
      let meta = null;

      // 1) BarcodeDetector on live video (Chrome/Android only)
      if (detector) {
        try {
          const rs = await detector.detect(cameraVideo);
          if (rs.length) {
            raw = rs[0].rawValue || null;
            const bb = rs[0].boundingBox;
            if (bb) meta = { x: bb.x, y: bb.y, w: bb.width, h: bb.height, videoWidth: vw, videoHeight: vh };
          }
        } catch { raw = null; }
      }

      // 2) jsQR on the cropped overlay-window region (fills entire canvas → bigger QR pixels)
      if (!raw) {
        const crop = getVideoCropRect(vw, vh);
        if (crop) {
          const sz = SCAN_SIZE;
          offscreen.width = sz;
          offscreen.height = sz;
          ctx.drawImage(cameraVideo, crop.cx, crop.cy, crop.cw, crop.ch, 0, 0, sz, sz);
          const qr = tryJsQR(sz, sz);
          if (qr) {
            raw = qr.data;
            const scaleInv = crop.cw / sz;
            const xs = [qr.location.topLeftCorner.x, qr.location.topRightCorner.x, qr.location.bottomLeftCorner.x, qr.location.bottomRightCorner.x];
            const ys = [qr.location.topLeftCorner.y, qr.location.topRightCorner.y, qr.location.bottomLeftCorner.y, qr.location.bottomRightCorner.y];
            meta = {
              x: crop.cx + Math.min(...xs) * scaleInv,
              y: crop.cy + Math.min(...ys) * scaleInv,
              w: (Math.max(...xs) - Math.min(...xs)) * scaleInv,
              h: (Math.max(...ys) - Math.min(...ys)) * scaleInv,
              videoWidth: vw,
              videoHeight: vh,
            };
          }
        }
      }

      // 3) jsQR on full frame (fallback when no overlay rect)
      if (!raw) {
        const scale = SCAN_SIZE / Math.max(vw, vh);
        const sw = Math.round(vw * scale);
        const sh = Math.round(vh * scale);
        offscreen.width = sw;
        offscreen.height = sh;
        ctx.drawImage(cameraVideo, 0, 0, sw, sh);
        const qr = tryJsQR(sw, sh);
        if (qr) {
          raw = qr.data;
          const scaleInv = 1 / scale;
          const xs = [qr.location.topLeftCorner.x, qr.location.topRightCorner.x, qr.location.bottomLeftCorner.x, qr.location.bottomRightCorner.x];
          const ys = [qr.location.topLeftCorner.y, qr.location.topRightCorner.y, qr.location.bottomLeftCorner.y, qr.location.bottomRightCorner.y];
          meta = {
            x: Math.min(...xs) * scaleInv,
            y: Math.min(...ys) * scaleInv,
            w: (Math.max(...xs) - Math.min(...xs)) * scaleInv,
            h: (Math.max(...ys) - Math.min(...ys)) * scaleInv,
            videoWidth: vw,
            videoHeight: vh,
          };
        }
      }

      if (raw) {
        const m = raw.match(/\/g\/([A-Za-z0-9]{4})(?:[/?#]|$)/i);
        const code = (m ? m[1] : raw.trim()).toUpperCase();
        if (CODE_RE.test(code)) {
          if (intervalId) clearInterval(intervalId);
          scanActive = false;
          cameraCanvas.style.display = 'block';
          await animatePullToQr(meta);
          await sleep(550);
          await stopCamera();
          onCode(code);
        }
      }
    } finally {
      ticking = false;
    }
  }

  intervalId = setInterval(tick, 180);
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

async function apiLogGps(gps) {
  if (!gps) return;
  fetch('/api/gate/gps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gps }),
  }).catch(() => {});
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
let gpsPermissionAsked = false;
let cachedGps = null;

async function requestGps() {
  if (gpsPermissionAsked) return cachedGps;
  gpsPermissionAsked = true;
  if (!navigator.geolocation) return null;
  await runChat(GATE_CONFIG.locationConsent, { clear: false });
  const granted = await new Promise(resolve => {
    clearActions();
    addBtn(GATE_CONFIG.buttons.locationAllow, '', () => resolve(true));
    addBtn(GATE_CONFIG.buttons.locationSkip, 'soft', () => resolve(false));
    showActions();
  });
  hideActions();
  if (!granted) return null;
  cachedGps = await new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 5000 },
    );
  });
  return cachedGps;
}

const gateEl = document.getElementById('gate');
const nocodeLanding = document.getElementById('nocode-landing');
const nocodeLine1 = document.getElementById('nocode-line1');
const nocodeLine2 = document.getElementById('nocode-line2');
const nocodeSubtitle = document.getElementById('nocode-subtitle');
const nocodeBtns = document.getElementById('nocode-btns');

function showGateMode() {
  gateEl.style.display = '';
  nocodeLanding.classList.remove('active');
}

function showLandingMode() {
  gateEl.style.display = 'none';
  nocodeLanding.classList.add('active');
}

async function stateNoAccess() {
  return statePreGateNoCode();
}

async function stateVerifyProto(code, backState) {
  hideScanPrototypeStage();
  showGateMode();
  hideActions();
  await quickLine('sprawdzam...');
  let result;
  try { result = await apiScan(code, fingerprint); } catch { result = null; }

  if (result && (result.state === 'first' || result.state === 'known')) {
    const welcome = result.state === 'first' ? GATE_CONFIG.welcomeFirst : GATE_CONFIG.welcomeReturning;
    await runChat(welcome, { clear: false });
    const gps = await requestGps();
    apiLogGps(gps);
    clearActions();
    addBtn(GATE_CONFIG.activateLabel || GATE_CONFIG.buttons.read, '', () => pageOut('/poems.html'));
    showActions();
    return;
  }

  if (result && result.state === 'transfer') {
    await runChat(GATE_CONFIG.transferFlow, { clear: false });
    clearActions();
    addBtn(GATE_CONFIG.transferConfirm || GATE_CONFIG.buttons.transfer, '', () => stateTransfer(result.transferToken, backState));
    addBtn(GATE_CONFIG.buttons.cancel, 'soft', () => backState());
    showActions();
    return;
  }

  if (result && result.error === 'code not found') {
    await runChat(GATE_CONFIG.notFound, { clear: false });
    addManualInput({
      onSubmit: newCode => stateVerifyProto(newCode, backState),
      onCancel: () => backState(),
    });
    return;
  }

  if (result && (result.error === 'no access' || result.error === 'no session')) {
    statePreGateNoCode();
    return;
  }

  await runChat(GATE_CONFIG.error, { clear: false });
  clearActions();
  addBtn(GATE_CONFIG.buttons.retry, '', () => backState());
  showActions();
}

function addNocodeZnaczki() {
  nocodeLanding.querySelectorAll('.nocode-deco-char').forEach(el => el.remove());
  const chars = ['_', '-', '~', '*', '^', '|', ',', '.', '+', '=', '"', "'", '!'];
  const positions = [
    { x: 4 + Math.random() * 14, y: 8 + Math.random() * 35 },
    { x: 4 + Math.random() * 14, y: 55 + Math.random() * 30 },
    { x: 82 + Math.random() * 14, y: 8 + Math.random() * 35 },
    { x: 82 + Math.random() * 14, y: 55 + Math.random() * 30 },
    { x: 25 + Math.random() * 50, y: 4 + Math.random() * 10 },
    { x: 25 + Math.random() * 50, y: 86 + Math.random() * 10 },
    { x: 6 + Math.random() * 8, y: 44 + Math.random() * 12 },
    { x: 86 + Math.random() * 8, y: 44 + Math.random() * 12 },
  ];
  positions.forEach((pos, i) => {
    const s = document.createElement('span');
    s.className = 'nocode-deco-char';
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    s.style.left = pos.x.toFixed(1) + '%';
    s.style.top = pos.y.toFixed(1) + '%';
    nocodeLanding.appendChild(s);
    setTimeout(() => s.classList.add('visible'), 80 + i * 60);
  });
}

async function animateLine(el, text) {
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'nocode-char';
    s.textContent = ch;
    s.style.opacity = '0';
    s.style.transform = 'translateY(5px)';
    el.appendChild(s);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      s.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      s.style.opacity = '1';
      s.style.transform = 'translateY(0)';
    }));
    await sleep(58 + Math.floor(Math.random() * 24));
  }
}

async function statePreGateNoCode() {
  await stateCameraScan({
    returnState: statePreGateNoCode,
    fallbackManualState: () => stateManualInput(statePreGateNoCode),
  });
}

async function statePreGateWithCode(code) {
  showGateMode();
  await runScanPrototypeStage();
  // proto stage stays visible — verify URL code directly, no camera
  await stateVerifyProto(code, () => statePreGateWithCode(code));
}

async function stateManualInput(backState) {
  showProtoManualInput({
    prompt: GATE_CONFIG.manualInputPrompt,
    onSubmit: code => {
      hideProtoManualInput();
      stateVerifyProto(code, backState);
    },
    onCancel: () => {
      hideProtoManualInput();
      hideScanPrototypeStage();
      backState();
    },
  });
}

async function stateCameraScan({ returnState, fallbackManualState }) {
  hideActions();
  clearChat();
  await stopCamera();
  showGateMode();
  const protoResult = await runScanPrototypeStage();
  // nie chowamy proto stage — zostaje jako tło podczas skanowania
  const protoChoice = typeof protoResult === 'string' ? protoResult : protoResult?.choice;
  if (protoChoice === 'manual') { hideScanPrototypeStage(); fallbackManualState(); return; }
  const desiredOverlayRect = typeof protoResult === 'object' ? protoResult.qrRect : scanPrototypeLastQrViewportRect;
  let scanClosed = false;
  currentScanToken += 1;
  const thisToken = currentScanToken;
  const closeXBtn = document.getElementById('camera-close-x');
  if (closeXBtn) closeXBtn.style.display = '';

  const ok = await startCamera();
  if (!ok) {
    if (closeXBtn) closeXBtn.style.display = 'none';
    setProtoStatus('kamera niedostępna');
    await sleep(1200);
    setProtoStatus('');
    hideScanPrototypeStage();
    fallbackManualState();
    return;
  }

  applyCameraOverlayVisuals(desiredOverlayRect);

  function exitCamera(next) {
    if (scanClosed) return;
    scanClosed = true;
    if (closeXBtn) closeXBtn.style.display = 'none';
    stopCamera().then(next);
  }

  if (closeXBtn) {
    closeXBtn.onclick = () => exitCamera(() => { hideScanPrototypeStage(); returnState(); });
  }
  cameraCancel.onclick = null;
  manualScanHintEl.onclick = null;

  scanQR(code => {
    if (scanClosed) return;
    scanClosed = true;
    if (closeXBtn) closeXBtn.style.display = 'none';
    stopCamera();
    stateVerifyProto(code, returnState).catch(() => {
      hideScanPrototypeStage();
      returnState();
    });
  }, thisToken).catch(async () => {
    if (closeXBtn) closeXBtn.style.display = 'none';
    await stopCamera();
    setProtoStatus('błąd skanowania');
    await sleep(1300);
    setProtoStatus('');
    hideScanPrototypeStage();
    returnState();
  });
}

async function stateVerify(code, backState) {
  await stopCamera();
  showGateMode();
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
    const gps = await requestGps();
    apiLogGps(gps);
    clearActions();
    addBtn(GATE_CONFIG.activateLabel || GATE_CONFIG.buttons.read, '', () => {
      pageOut('/poems.html');
    });
    showActions();
    return;
  }

  if (result.state === 'known') {
    await runChat(GATE_CONFIG.welcomeReturning);
    const gps = await requestGps();
    apiLogGps(gps);
    clearActions();
    addBtn(GATE_CONFIG.buttons.read, '', () => {
      pageOut('/poems.html');
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
      pageOut('/poems.html');
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
  if (FORCE_SCAN_PROTO) {
    const protoResult = await runScanPrototypeStage();
    hideScanPrototypeStage();
    const protoChoice = typeof protoResult === 'string' ? protoResult : protoResult?.choice;
    if (protoChoice !== 'scan') return;
    const desiredOverlayRect = typeof protoResult === 'object' ? protoResult.qrRect : scanPrototypeLastQrViewportRect;
    const ok = await startCamera();
    if (!ok) return;
    applyCameraOverlayVisuals(desiredOverlayRect);
    cameraCancel.onclick = async () => {
      await stopCamera();
    };
    manualScanHintEl.onclick = async () => {
      await stopCamera();
    };
    return;
  }
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
