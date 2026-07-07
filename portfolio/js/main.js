/* staś szpineta — .PORTFOLIO* */

const $ = (sel) => document.querySelector(sel);

/* ---------- index projektów ---------- */

const listEl = $('#projectList');

let lastSem = null;
PROJECTS.forEach((p, i) => {
  if (p.sem && p.sem !== lastSem) {
    lastSem = p.sem;
    const sep = document.createElement('li');
    sep.className = 'sem-divider';
    sep.innerHTML = '<span>[' + p.sem + ']</span>';
    listEl.appendChild(sep);
  }
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = '#' + p.slug;
  a.innerHTML =
    '<span class="project-title">' + p.title + '</span>' +
    '<span class="project-meta"><b>' + p.pages.length + '</b> str &middot; ' + p.course + '</span>';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openViewer(i);
  });
  li.appendChild(a);
  listEl.appendChild(li);
});

/* ---------- viewer ---------- */

const viewer = $('#viewer');
const track = $('#viewerTrack');
const label = $('#viewerLabel');
const countEl = $('#viewerCount');
const pageEl = $('#viewerPage');

let current = -1;
let slideCount = 0;
let lastFocus = null;

function openViewer(i) {
  const p = PROJECTS[i];
  current = i;
  slideCount = p.pages.length;
  track.innerHTML = p.pages
    .map((f, n) =>
      '<div class="viewer-slide"><img loading="' + (n < 2 ? 'eager' : 'lazy') +
      '" src="assets/' + p.slug + '/' + f + '" alt="' + p.title + ' — strona ' + (n + 1) + '"></div>')
    .join('');
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
  viewer.hidden = true;
  document.body.style.overflow = '';
  history.replaceState(null, '', '#projekty');
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
  countEl.innerHTML = (n + 1) + ' / ' + slideCount;
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

/* deep-link: #slug otwiera projekt (przy wejściu i przy zmianie hasha) */
function openFromHash() {
  const idx = PROJECTS.findIndex((p) => p.slug === location.hash.slice(1));
  if (idx >= 0 && idx !== current) openViewer(idx);
}
window.addEventListener('hashchange', openFromHash);
openFromHash();

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
