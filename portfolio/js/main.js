/* staś szpineta — .PORTFOLIO* */

const $ = (sel) => document.querySelector(sel);

/* ---------- index projektów: 1 rok / 2 rok / poza school of form ---------- */

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function projectLink(p, i, onOpen) {
  const li = document.createElement('li');
  li.style.setProperty('--i', i);
  const a = document.createElement('a');
  a.href = p.href || '#' + p.slug;
  const meta = p.pages
    ? '<b>' + p.pages.length + '</b> ' + (p.pages.some((f) => f.endsWith('.mp4')) ? 'film.' : 'str') + ' &middot; ' + p.course
    : p.course + (p.href ? ' &middot; <b>otwórz</b>' : '');
  a.innerHTML = '<span class="project-title">' + p.title + '</span><span class="project-meta">' + meta + '</span>';
  if (!p.href) {
    a.addEventListener('click', (e) => { e.preventDefault(); onOpen(); });
  }
  li.appendChild(a);
  return li;
}

/* 1 rok: lista z podziałem na semestry */
const listEl = $('#projectList');
let lastSem = null;
let n1 = 0;
PROJECTS.forEach((p, i) => {
  if (p.sem && p.sem !== lastSem) {
    lastSem = p.sem;
    const sep = document.createElement('li');
    sep.className = 'sem-divider';
    sep.style.setProperty('--i', n1++);
    sep.innerHTML = '<span>[' + p.sem + ']</span>';
    listEl.appendChild(sep);
  }
  listEl.appendChild(projectLink(p, n1++, () => openViewer(PROJECTS, i)));
});

/* 2 rok: warsztaty mistrzowskie */
const year2 = $('#year2');
YEAR2.forEach((p, i) => {
  const a = document.createElement('a');
  a.className = 'feature';
  a.href = p.href;
  a.style.setProperty('--i', i);
  a.innerHTML =
    '<div class="feature-media">' +
      (p.video
        ? '<video src="' + p.video + '" poster="' + p.poster + '" muted loop playsinline autoplay preload="metadata" aria-label="' + p.title + ': model 3d"></video>'
        : '<img src="' + p.poster + '" alt="">') +
    '</div>' +
    '<div class="feature-text">' +
      '<p class="feature-kicker">[' + p.course + ']</p>' +
      '<h3 class="feature-title">' + p.title + '</h3>' +
      '<p class="feature-kind">' + p.kind + '</p>' +
      '<p class="feature-desc">' + p.text + '</p>' +
      '<span class="feature-go">otwórz projekt &rarr;</span>' +
    '</div>';
  year2.appendChild(a);
});

/* poza school of form */
const privateEl = $('#privateList');
PRIVATE.forEach((p, i) => {
  privateEl.appendChild(projectLink(p, i, () => openViewer(PRIVATE, i)));
});

/* zakładki */
const tabs = Array.from(document.querySelectorAll('.year-tab'));
const ink = $('.years-ink');
const SCRAMBLE = '~||-_^+*.';

function scramble(el) {
  const word = el.dataset.word;
  if (reduceMotion) { el.textContent = word; return; }
  let frame = 0;
  const total = 9;
  clearInterval(el._t);
  el._t = setInterval(() => {
    frame++;
    el.textContent = word.split('').map((c, k) =>
      c === ' ' || k < (frame / total) * word.length ? c : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
    ).join('');
    if (frame >= total) { clearInterval(el._t); el.textContent = word; }
  }, 38);
}

function moveInk(tab) {
  if (!ink || !tab) return;
  const box = tab.parentElement.getBoundingClientRect();
  const r = tab.getBoundingClientRect();
  ink.style.width = r.width + 'px';
  /* pod wybraną zakładką, także gdy na telefonie zakładki łamią się na dwa rzędy */
  ink.style.transform = 'translate(' + (r.left - box.left) + 'px,' + (r.bottom - box.top + 9) + 'px)';
}

function selectTab(key, opts) {
  const tab = tabs.find((t) => t.dataset.key === key) || tabs[1];
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.dataset.key);
    panel.hidden = !on;
    if (on) {
      panel.classList.remove('enter');
      void panel.offsetWidth;
      panel.classList.add('enter');
    }
  });
  moveInk(tab);
  scramble(tab.querySelector('.yt-word'));
  if (!opts || !opts.silent) history.replaceState(null, '', '#' + tab.dataset.key);
}

tabs.forEach((t, k) => {
  t.addEventListener('click', () => selectTab(t.dataset.key));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(k + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    selectTab(next.dataset.key);
  });
});
window.addEventListener('resize', () => moveInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));

/* ---------- viewer ---------- */

const viewer = $('#viewer');
const track = $('#viewerTrack');
const label = $('#viewerLabel');
const countEl = $('#viewerCount');
const pageEl = $('#viewerPage');

let current = null;
let slideCount = 0;
let lastFocus = null;

function slideHTML(p, f, n) {
  const src = '/portfolio/assets/' + p.slug + '/' + f;
  if (f.endsWith('.mp4')) {
    return '<div class="viewer-slide"><video src="' + src + '" poster="' + src.replace(/\.mp4$/, '.jpg') +
      '" muted loop playsinline autoplay preload="metadata" aria-label="' + p.title + ' — film ' + (n + 1) + '"></video></div>';
  }
  return '<div class="viewer-slide"><img loading="' + (n < 2 ? 'eager' : 'lazy') +
    '" src="' + src + '" alt="' + p.title + ' — strona ' + (n + 1) + '"></div>';
}

function openViewer(list, i) {
  const p = list[i];
  current = p;
  slideCount = p.pages.length;
  track.innerHTML = p.pages.map((f, n) => slideHTML(p, f, n)).join('');
  label.innerHTML = '<b>' + p.title + '</b>&nbsp;<i>' + String(i + 1).padStart(2, '0') + '</i>';
  lastFocus = document.activeElement;
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  track.scrollLeft = 0;
  history.replaceState(null, '', '#' + p.slug);
  updateCount(0);
  $('#viewerClose').focus();
}

function closeViewer() {
  track.querySelectorAll('video').forEach((v) => v.pause());
  viewer.hidden = true;
  document.body.style.overflow = '';
  current = null;
  const tab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  history.replaceState(null, '', '#' + (tab ? tab.dataset.key : 'projekty'));
  if (lastFocus) lastFocus.focus();
}

function stride() {
  const s = track.children;
  return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : track.clientWidth;
}

function slideIndex() {
  return Math.round(track.scrollLeft / stride());
}

function goTo(n) {
  const clamped = Math.max(0, Math.min(slideCount - 1, n));
  track.scrollTo({ left: clamped * stride(), behavior: 'smooth' });
}

function updateCount(n) {
  countEl.innerHTML = (n + 1) + ' / ' + slideCount;
  pageEl.textContent = n + 1;
}

track.addEventListener('scroll', () => updateCount(slideIndex()), { passive: true });
$('#prevBtn').addEventListener('click', () => goTo(slideIndex() - 1));
$('#nextBtn').addEventListener('click', () => goTo(slideIndex() + 1));
$('#viewerClose').addEventListener('click', closeViewer);

document.addEventListener('keydown', (e) => {
  if (viewer.hidden) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowRight') goTo(slideIndex() + 1);
  if (e.key === 'ArrowLeft') goTo(slideIndex() - 1);
});

/* deep-link: #rok-1 / #rok-2 / #poza wybiera zakładkę, #slug otwiera projekt */
function openFromHash() {
  const h = location.hash.slice(1);
  if (tabs.some((t) => t.dataset.key === h)) { selectTab(h, { silent: true }); return; }
  const i1 = PROJECTS.findIndex((p) => p.slug === h);
  if (i1 >= 0) { selectTab('rok-1', { silent: true }); if (!current || current.slug !== h) openViewer(PROJECTS, i1); return; }
  const ip = PRIVATE.findIndex((p) => p.slug === h && p.pages);
  if (ip >= 0) { selectTab('poza', { silent: true }); if (!current || current.slug !== h) openViewer(PRIVATE, ip); return; }
  selectTab('rok-2', { silent: true });
}
window.addEventListener('hashchange', openFromHash);
openFromHash();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));

/* ---------- scroll hint ---------- */

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector(btn.dataset.goto).scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- why: słowa reagujące na hover ---------- */

document.querySelectorAll('#whyWords p').forEach((p) => {
  p.innerHTML = p.textContent
    .split(' ')
    .map((w) => '<span>' + w + '</span>')
    .join(' ');
});

/* ---------- cover: tytuł rozsypuje się po kliknięciu ---------- */

const bigTitle = $('#bigTitle');
bigTitle.addEventListener('click', () => {
  const chars = '.PORTFOLIO*'.split('');
  bigTitle.innerHTML = chars
    .map((c) => {
      const r = (Math.random() * 24 - 12).toFixed(1);
      const y = (Math.random() * 16 - 8).toFixed(1);
      return '<span style="display:inline-block;transform:rotate(' + r + 'deg) translateY(' + y + 'px);transition:transform .5s">' + c + '</span>';
    })
    .join('');
  setTimeout(() => (bigTitle.textContent = '.PORTFOLIO*'), 900);
});

/* ---------- ascii linia lekko żyje ---------- */

const asciiLine = $('#asciiLine');
const glyphs = '~+_/*^-"„';
setInterval(() => {
  const t = asciiLine.textContent.split('');
  const i = Math.floor(Math.random() * t.length);
  t[i] = glyphs[Math.floor(Math.random() * glyphs.length)];
  asciiLine.textContent = t.join('');
}, 700);
