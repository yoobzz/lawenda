// deck.js: plansze 1600x1000 skalowane do okna, nawigacja klawiszami i przyciskami
(function () {
  const W = 1600;
  const H = 1000;
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counter = document.getElementById('counter');
  let current = 0;

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    document.documentElement.style.setProperty('--s', String(s));
  }

  function mountSlide(slide) {
    if (slide.dataset.mounted) return;
    slide.dataset.mounted = '1';
    const name = slide.dataset.dc;
    if (!name) return;
    const tpl = document.getElementById('tpl-' + name);
    const code = document.getElementById('code-' + name);
    if (!tpl || !code) return;
    window.DCMini.mount(slide.querySelector('.stage'), tpl.textContent, code.textContent, {});
  }

  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => s.classList.toggle('is-on', k === current));
    mountSlide(slides[current]);
    if (slides[current + 1]) mountSlide(slides[current + 1]);
    counter.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    const hash = '#' + (current + 1);
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function fromHash() {
    const n = parseInt(location.hash.slice(1), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  document.getElementById('prev').addEventListener('click', () => show(current - 1));
  document.getElementById('next').addEventListener('click', () => show(current + 1));
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(current + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(current - 1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => show(fromHash()));

  fit();
  show(fromHash());
})();
