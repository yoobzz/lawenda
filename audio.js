// global lightweight ambient audio controller (file-based)
// usage: place a button with id="audioToggle" on the page; include this script.

(function(){
  // Lista plików audio - możesz dodać więcej plików tutaj
  const AUDIO_FILES = [
    'kaziu mergedfinal tylko ja.wav',
    // Dodaj tutaj kolejne pliki audio, np.:
    // 'drugi-plik-audio.wav',
    // 'trzeci-plik-audio.mp3',
  ];

  let audioCtx = null;
  let audioGain = null;
  let audioStarted = false;
  let isOn = false;
  let audioEl = null;
  let mediaSource = null;
  let currentAudioIndex = 0;

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0.0;
    audioGain.connect(audioCtx.destination);

    loadAudioFile(currentAudioIndex);
  }

  function loadAudioFile(index) {
    if (index < 0 || index >= AUDIO_FILES.length) return;
    
    // Jeśli już istnieje audio element, odłącz go
    if (mediaSource) {
      try {
        mediaSource.disconnect();
      } catch(e) {}
    }
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.src = '';
      } catch(e) {}
    }

    currentAudioIndex = index;
    const AUDIO_URL = AUDIO_FILES[index];

    // html audio element as source (looped)
    audioEl = new Audio(encodeURI(AUDIO_URL));
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.crossOrigin = 'anonymous';

    mediaSource = audioCtx.createMediaElementSource(audioEl);
    mediaSource.connect(audioGain);

    // Jeśli audio było włączone, odtwórz nowy plik
    if (isOn && audioCtx) {
      if (audioCtx.state !== 'running') {
        audioCtx.resume().catch(()=>{});
      }
      audioEl.play().catch(()=>{});
    }
  }

  function switchToNextAudio() {
    if (AUDIO_FILES.length <= 1) return;
    const nextIndex = (currentAudioIndex + 1) % AUDIO_FILES.length;
    loadAudioFile(nextIndex);
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
    // Użyj różnych znaków dla włączonego/wyłączonego
    // Wyłączony: ||, Włączony: >>
    btn.textContent = isOn ? '>>' : '||';
  }

  function setupButton(){
    const btn = document.getElementById('audioToggle');
    if (!btn) return;

    let saved = null;
    try { 
      saved = localStorage.getItem('audioOn');
      const savedIndex = localStorage.getItem('audioIndex');
      if (savedIndex !== null) {
        const idx = parseInt(savedIndex, 10);
        if (!isNaN(idx) && idx >= 0 && idx < AUDIO_FILES.length) {
          currentAudioIndex = idx;
        }
      }
    } catch(e) {}
    isOn = saved === '1';
    updateButton(btn);

    const toggle = () => {
      ensurePrime();
      isOn = !isOn;
      updateButton(btn);
      setOn(isOn);
      try { localStorage.setItem('audioOn', isOn ? '1' : '0'); } catch(e) {}
    };

    // Kliknięcie lewym przyciskiem - włącz/wyłącz
    btn.addEventListener('click', (e)=>{ 
      if (e.button === 0 || e.button === undefined) {
        e.preventDefault(); 
        e.stopPropagation(); 
        toggle(); 
      }
    });
    
    // Kliknięcie prawym przyciskiem lub długie naciśnięcie - zmień plik
    btn.addEventListener('contextmenu', (e)=>{ 
      e.preventDefault(); 
      e.stopPropagation();
      if (AUDIO_FILES.length > 1) {
        ensurePrime();
        switchToNextAudio();
        updateButton(btn);
        try { localStorage.setItem('audioIndex', currentAudioIndex.toString()); } catch(e) {}
      }
    });

    // Długie naciśnięcie na urządzeniach dotykowych
    let longPressTimer = null;
    btn.addEventListener('touchstart', (e)=>{ 
      longPressTimer = setTimeout(() => {
        if (AUDIO_FILES.length > 1) {
          ensurePrime();
          switchToNextAudio();
          updateButton(btn);
          try { localStorage.setItem('audioIndex', currentAudioIndex.toString()); } catch(e) {}
        }
        longPressTimer = null;
      }, 500);
    }, { passive: true });
    
    btn.addEventListener('touchend', (e)=>{ 
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        e.preventDefault(); 
        e.stopPropagation(); 
        toggle(); 
      }
    }, { passive: false });

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


