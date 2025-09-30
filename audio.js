// global lightweight ambient audio controller (file-based)
// usage: place a button with id="audioToggle" on the page; include this script.

(function(){
  const AUDIO_URL = 'kaziu mergedfinal tylko ja.wav';

  let audioCtx = null;
  let audioGain = null;
  let audioStarted = false;
  let isOn = false;
  let audioEl = null;
  let mediaSource = null;

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0.0;
    audioGain.connect(audioCtx.destination);

    // html audio element as source (looped)
    audioEl = new Audio(encodeURI(AUDIO_URL));
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.crossOrigin = 'anonymous';

    mediaSource = audioCtx.createMediaElementSource(audioEl);
    mediaSource.connect(audioGain);
  }

  function setOn(on){
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const target = on ? 0.12 : 0.0;
    audioGain.gain.cancelScheduledValues(now);
    audioGain.gain.linearRampToValueAtTime(target, now + 1.0);

    if (on) {
      // ensure context running and play element
      if (audioCtx.state !== 'running') {
        audioCtx.resume().catch(()=>{});
      }
      if (audioEl && audioEl.paused) {
        audioEl.play().catch(()=>{});
      }
    } else {
      // after fade-out, pause element to save battery
      if (audioEl && !audioEl.paused) {
        setTimeout(() => { try { audioEl.pause(); } catch(e) {} }, 1100);
      }
    }

    isOn = on;
    try { localStorage.setItem('audioOn', on ? '1' : '0'); } catch(e) {}
  }

  function ensurePrime(){
    if (audioStarted) return;
    initAudio();
    audioStarted = true;
  }

  function updateButton(btn){
    if (!btn) return;
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    btn.textContent = isOn ? 'dźwięk: on' : 'dźwięk: off';
  }

  function setupButton(){
    const btn = document.getElementById('audioToggle');
    if (!btn) return;

    let saved = null;
    try { saved = localStorage.getItem('audioOn'); } catch(e) {}
    isOn = saved === '1';
    updateButton(btn);

    const toggle = () => {
      ensurePrime();
      isOn = !isOn;
      updateButton(btn);
      setOn(isOn);
    };

    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
    btn.addEventListener('touchend', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); }, { passive: false });

    // global first interaction primes audio; if saved on, fade in and play
    const prime = () => {
      ensurePrime();
      if (isOn) setOn(true);
      document.removeEventListener('click', prime);
      document.removeEventListener('touchend', prime);
    };
    document.addEventListener('click', prime, { once: true });
    document.addEventListener('touchend', prime, { once: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButton);
  } else {
    setupButton();
  }
})();


