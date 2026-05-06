'use strict';

// ── DOM ───────────────────────────────────────────────────────────────────────
const chatEl      = document.getElementById('chat');
const cursorEl    = document.getElementById('cursor');
const actionsEl   = document.getElementById('actions');
const cameraArea  = document.getElementById('camera-area');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas= document.getElementById('camera-canvas');

// ── Util ──────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getCodeFromUrl() {
    const m = window.location.pathname.match(/\/g\/([A-Za-z0-9]{4})(?:[/?#]|$)/);
    return m ? m[1].toUpperCase() : null;
}

async function generateFingerprint() {
    try {
        const cv = document.createElement('canvas');
        cv.width = 240; cv.height = 60;
        const ctx = cv.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f0f'; ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069'; ctx.fillText('szpineta.fp', 2, 15);
        ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.fillText('szpineta.fp', 4, 17);
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
        return Array.from(new Uint8Array(buf)).slice(0, 12)
            .map(b => b.toString(16).padStart(2, '0')).join('');
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

// ── Znaczki (ported from index.html) ─────────────────────────────────────────
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
        for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
    }

    for (let i = 0; i < count; i++) {
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

    container.addEventListener('mouseenter', e => {
        const p = e.target.closest('.star-particle');
        if (p) p.textContent = randStr(2, 4);
    }, true);
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function clearMessages() {
    chatEl.querySelectorAll('.gate-msg').forEach(el => el.remove());
}

function showCursor() { cursorEl.classList.add('show'); }
function hideCursor() { cursorEl.classList.remove('show'); }

function addMsg(text) {
    const el = document.createElement('div');
    el.className = 'gate-msg';
    el.textContent = text;
    chatEl.insertBefore(el, cursorEl);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
}

async function showMessages(msgs, { clear = true } = {}) {
    if (clear) clearMessages();
    hideActions();
    for (const msg of msgs) {
        showCursor();
        await sleep(msg.delay);
        hideCursor();
        addMsg(msg.text);
        await sleep(260);
    }
}

// ── Actions ───────────────────────────────────────────────────────────────────
function clearActions() { actionsEl.innerHTML = ''; }

function hideActions() {
    actionsEl.classList.remove('show');
    clearActions();
}

function showActions() {
    requestAnimationFrame(() => requestAnimationFrame(() => actionsEl.classList.add('show')));
}

function addBtn(label, cls, onClick) {
    const btn = document.createElement('button');
    btn.className = 'gate-btn' + (cls ? ' ' + cls : '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    actionsEl.appendChild(btn);
    return btn;
}

// ── Camera ────────────────────────────────────────────────────────────────────
let cameraStream = null;
let scanActive = false;

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
        });
        cameraVideo.srcObject = cameraStream;
        await cameraVideo.play();
        cameraArea.classList.add('active');
        return true;
    } catch {
        return false;
    }
}

function stopCamera() {
    scanActive = false;
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    cameraArea.classList.remove('active');
}

async function scanQR(onCode) {
    scanActive = true;
    const ctx = cameraCanvas.getContext('2d', { willReadFrequently: true });
    let detector = null;
    if ('BarcodeDetector' in window) {
        try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch {}
    }

    async function tick() {
        if (!scanActive) return;
        if (cameraVideo.readyState < cameraVideo.HAVE_ENOUGH_DATA) { requestAnimationFrame(tick); return; }
        const w = cameraVideo.videoWidth, h = cameraVideo.videoHeight;
        cameraCanvas.width = w; cameraCanvas.height = h;
        ctx.drawImage(cameraVideo, 0, 0, w, h);

        let raw = null;
        if (detector) {
            try { const r = await detector.detect(cameraVideo); if (r.length) raw = r[0].rawValue; } catch {}
        }
        if (!raw && window.jsQR) {
            const img = ctx.getImageData(0, 0, w, h);
            const qr = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
            if (qr) raw = qr.data;
        }

        if (raw) {
            const m = raw.match(/\/g\/([A-Za-z0-9]{4})(?:[/?#]|$)/i);
            const code = (m ? m[1] : raw.trim()).toUpperCase();
            if (/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/.test(code)) {
                stopCamera(); onCode(code); return;
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiScan(code, fp) {
    const r = await fetch('/api/gate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fingerprint: fp }),
    });
    return r.json();
}

async function apiTransfer(token, fp) {
    const r = await fetch('/api/gate/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferToken: token, fingerprint: fp }),
    });
    return r.json();
}

// ── States ────────────────────────────────────────────────────────────────────
let fingerprint = null;
let codeFromUrl = null;

async function statePreScan(code) {
    await showMessages(GATE_CONFIG.chat.preScan);
    clearActions();
    addBtn(GATE_CONFIG.buttons.activate, '', () => stateVerify(code));
    showActions();
}

async function stateNoCode() {
    await showMessages(GATE_CONFIG.chat.noCode);
    clearActions();
    addBtn(GATE_CONFIG.buttons.scan, '', () => stateCameraScan());
    showActions();
}

async function stateCameraScan() {
    hideActions();
    clearMessages();
    const ok = await startCamera();
    if (!ok) {
        await showMessages(GATE_CONFIG.chat.cameraError);
        clearActions();
        addBtn(GATE_CONFIG.buttons.retry, '', stateCameraScan);
        showActions();
        return;
    }
    await showMessages(GATE_CONFIG.chat.scanning, { clear: false });
    document.getElementById('camera-cancel').onclick = () => {
        stopCamera(); clearMessages(); stateNoCode();
    };
    scanQR(code => stateVerify(code));
}

async function stateVerify(code) {
    stopCamera();
    clearActions();
    await showMessages(GATE_CONFIG.chat.verifying, { clear: true });

    let result;
    try { result = await apiScan(code, fingerprint); }
    catch { result = null; }

    if (!result || result.error) {
        const isNotFound = result && result.error === 'code not found';
        await showMessages(isNotFound ? GATE_CONFIG.chat.notFound : GATE_CONFIG.chat.error, { clear: true });
        if (!isNotFound) {
            clearActions();
            addBtn(GATE_CONFIG.buttons.retry, '', () => codeFromUrl ? statePreScan(codeFromUrl) : stateNoCode());
            showActions();
        }
        return;
    }

    if (result.state === 'first') {
        await showMessages(GATE_CONFIG.chat.successFirst, { clear: true });
        clearActions();
        addBtn(GATE_CONFIG.buttons.read, '', () => { window.location.href = '/poems.html'; });
        showActions();
    } else if (result.state === 'known') {
        await showMessages(GATE_CONFIG.chat.successKnown, { clear: true });
        clearActions();
        addBtn(GATE_CONFIG.buttons.read, '', () => { window.location.href = '/poems.html'; });
        showActions();
    } else if (result.state === 'transfer') {
        await showMessages(GATE_CONFIG.chat.transfer, { clear: true });
        clearActions();
        addBtn(GATE_CONFIG.buttons.transfer, '', () => stateTransfer(result.transferToken));
        addBtn(GATE_CONFIG.buttons.cancel, 'muted', () => {
            clearMessages(); codeFromUrl ? statePreScan(codeFromUrl) : stateNoCode();
        });
        showActions();
    } else {
        await showMessages(GATE_CONFIG.chat.error, { clear: true });
    }
}

async function stateTransfer(token) {
    hideActions();
    await showMessages(GATE_CONFIG.chat.verifying, { clear: true });

    let result;
    try { result = await apiTransfer(token, fingerprint); }
    catch { result = null; }

    if (result && result.state === 'success') {
        await showMessages(GATE_CONFIG.chat.transferDone, { clear: true });
        clearActions();
        addBtn(GATE_CONFIG.buttons.read, '', () => { window.location.href = '/poems.html'; });
        showActions();
    } else {
        await showMessages(GATE_CONFIG.chat.error, { clear: true });
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    initZnaczki();
    fingerprint = await generateFingerprint();
    codeFromUrl = getCodeFromUrl();
    if (codeFromUrl) {
        await statePreScan(codeFromUrl);
    } else {
        await stateNoCode();
    }
}

init().catch(err => {
    console.error('gate init error:', err);
    hideCursor();
    addMsg('błąd ładowania — odśwież stronę');
});
