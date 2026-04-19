let events = [];
let filteredEvents = [];
let activeCarouselPage = 0;
const rowsPerCarouselPage = 3;

const els = {
  totalCount: document.getElementById('totalCount'),
  resultsCount: document.getElementById('resultsCount'),
  resultsHeading: document.getElementById('resultsHeading'),
  searchInput: document.getElementById('searchInput'),
  yearFilter: document.getElementById('yearFilter'),
  artistMessage: document.getElementById('artistMessage'),
  results: document.getElementById('results'),
  dayFeature: document.getElementById('dayFeature'),
  weekFeature: document.getElementById('weekFeature'),
  upcomingFeature: document.getElementById('upcomingFeature'),
  carouselDots: document.getElementById('carouselDots'),
  carouselPrev: document.getElementById('carouselPrev'),
  carouselNext: document.getElementById('carouselNext')
};

function normalize(v) { return String(v || '').toLowerCase().trim(); }

function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  const m = s.match(/^(\d{1,2})(\d{1,2})(\d{4})$/);
  if (m) {
    d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    if (!isNaN(d.getTime())) return d;
  }

  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function formatDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
}

function getYear(value) {
  const d = parseDate(value);
  return d ? String(d.getFullYear()) : '';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pick(...vals) { return vals.find(v => v && String(v).trim()) || ''; }

function inferRow(row) {
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  return {
    ...row,
    date: pick(lower.date, lower.showdate, lower.show_date, lower.datetime),
    artist: pick(lower.artist, lower.band, lower.performer, lower.name, lower.title, lower.event),
    venue: pick(lower.venue, lower.location, lower.place),
    note: pick(lower.note, lower.notes, lower.memo),
    type: pick(lower.type, lower.category)
  };
}

function eventTitle(ev) { return ev.artist || ev.event || ev.title || ev.name || 'Untitled event'; }
function eventVenue(ev) { return ev.venue || ev.location || ''; }
function sortByDateDesc(a, b) { return (parseDate(b.date) || 0) - (parseDate(a.date) || 0); }
function sortByDateAsc(a, b) { return (parseDate(a.date) || 0) - (parseDate(b.date) || 0); }

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function buildYearOptions(list) {
  const years = [...new Set(list.map(e => getYear(e.date)).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  els.yearFilter.innerHTML = '<option value="all">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function matchesSearch(ev, q) {
  if (!q) return true;
  const hay = [eventTitle(ev), eventVenue(ev), ev.note, ev.type, ev.year, ev.date, ev.city, ev.tags].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function applyFilters() {
  const q = normalize(els.searchInput.value);
  const year = els.yearFilter.value;
  filteredEvents = events.filter(ev => {
    if (year !== 'all' && getYear(ev.date) !== year) return false;
    return matchesSearch(ev, q);
  });
  els.resultsHeading.textContent = year === 'all' ? 'All events' : `Events in ${year}`;
  els.resultsCount.textContent = `${filteredEvents.length} found`;
  els.artistMessage.textContent = q ? `Showing results for "${els.searchInput.value.trim()}"` : '';
  renderResults();
  renderCarousel();
}

function renderResults() {
  const items = filteredEvents.slice().sort(sortByDateDesc);
  if (!items.length) {
    els.results.innerHTML = `<div class="empty">No events match your search.</div>`;
    return;
  }
  els.results.innerHTML = items.map(ev => {
    const title = escapeHtml(eventTitle(ev));
    const date = escapeHtml(formatDate(ev.date));
    const venue = escapeHtml(eventVenue(ev));
    const note = escapeHtml(ev.note || '');
    return `<article class="card"><div class="card-date">${date}</div><div class="card-header"><div class="card-main"><h3>${title}</h3>${venue ? `<p>${venue}</p>` : ''}${note ? `<p>${note}</p>` : ''}</div></div></article>`;
  }).join('');
}

function renderPagedList(container, items, pageIndex) {
  const pages = chunk(items, rowsPerCarouselPage);
  const totalPages = Math.max(1, pages.length);
  const safeIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const pageItems = pages[safeIndex] || [];
  if (!items.length) {
    container.innerHTML = `<div class="empty">Nothing to show yet.</div>`;
    return totalPages;
  }
  container.innerHTML = `<div class="feature-page">${pageItems.map(ev => {
    const title = escapeHtml(eventTitle(ev));
    const date = escapeHtml(formatDate(ev.date));
    const venue = escapeHtml(eventVenue(ev));
    return `<div class="feature-row"><strong>${title}</strong><div class="small">${date}${venue ? ` · ${venue}` : ''}</div></div>`;
  }).join('')}</div>`;
  return totalPages;
}

function renderPager(totalPages) {
  els.carouselDots.innerHTML = '';
  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `carousel-dot${i === activeCarouselPage ? ' active' : ''}`;
    dot.setAttribute('aria-label', `Page ${i + 1} of ${totalPages}`);
    dot.textContent = `${i + 1}/${totalPages}`;
    dot.addEventListener('click', () => {
      activeCarouselPage = i;
      renderCarousel();
    });
    els.carouselDots.appendChild(dot);
  }
  els.carouselPrev.disabled = activeCarouselPage === 0;
  els.carouselNext.disabled = activeCarouselPage >= totalPages - 1;
  els.carouselPrev.setAttribute('aria-label', `Previous page ${Math.max(1, activeCarouselPage)}/${totalPages}`);
  els.carouselNext.setAttribute('aria-label', `Next page ${Math.min(totalPages, activeCarouselPage + 2)}/${totalPages}`);
}

function renderCarousel() {
  const now = new Date();
  const dayItems = events.filter(ev => {
    const d = parseDate(ev.date);
    return d && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).sort(sortByDateDesc);

  const weekItems = events.filter(ev => {
    const d = parseDate(ev.date);
    return d && Math.abs((d - now) / 86400000) <= 7;
  }).sort(sortByDateDesc);

  const upcomingItems = events.filter(ev => {
    const d = parseDate(ev.date);
    return d && d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }).sort(sortByDateAsc);

  const maxPages = Math.max(
    chunk(dayItems, rowsPerCarouselPage).length,
    chunk(weekItems, rowsPerCarouselPage).length,
    chunk(upcomingItems, rowsPerCarouselPage).length,
    1
  );

  activeCarouselPage = Math.min(activeCarouselPage, maxPages - 1);
  renderPagedList(els.dayFeature, dayItems, activeCarouselPage);
  renderPagedList(els.weekFeature, weekItems, activeCarouselPage);
  renderPagedList(els.upcomingFeature, upcomingItems, activeCarouselPage);
  renderPager(maxPages);
}

function prevPage() {
  if (activeCarouselPage > 0) {
    activeCarouselPage -= 1;
    renderCarousel();
  }
}

function nextPage() {
  activeCarouselPage += 1;
  renderCarousel();
}

function loadData() {
  Papa.parse('Events_Database.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = (results.data || []).map(inferRow).filter(r => r.date || r.artist || r.title || r.event || r.venue);
      events = rows;
      filteredEvents = rows.slice();
      els.totalCount.textContent = `${events.length} concerts`;
      buildYearOptions(events);
      applyFilters();
    },
    error: () => { els.results.innerHTML = `<div class="empty">Could not load the data file.</div>`; }
  });
}

els.searchInput.addEventListener('input', applyFilters);
els.yearFilter.addEventListener('change', applyFilters);
els.carouselPrev.addEventListener('click', prevPage);
els.carouselNext.addEventListener('click', nextPage);
loadData();
