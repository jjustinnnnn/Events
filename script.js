let events = [];
let filteredEvents = [];
let currentCarouselPage = 0;
const rowsPerCarouselPage = 3;
let carouselPages = [];

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
  carouselTrack: document.getElementById('carouselTrack'),
  carouselDots: document.getElementById('carouselDots'),
  carouselPrev: document.getElementById('carouselPrev'),
  carouselNext: document.getElementById('carouselNext'),
  carouselViewport: document.getElementById('carouselViewport')
};

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = parseDate(value);
  if (!d) return 'Unknown date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalize(str) {
  return String(str || '').toLowerCase().trim();
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

function eventTitle(ev) {
  return ev.artist || ev.event || ev.title || 'Untitled event';
}

function eventVenue(ev) {
  return ev.venue || ev.location || '';
}

function sortByDateAsc(a, b) {
  const da = parseDate(a.date) || new Date(0);
  const db = parseDate(b.date) || new Date(0);
  return da - db;
}

function sortByDateDesc(a, b) {
  const da = parseDate(a.date) || new Date(0);
  const db = parseDate(b.date) || new Date(0);
  return db - da;
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

  els.results.innerHTML = filteredEvents
    .sort(sortByDateDesc)
    .map(ev => {
      const title = escapeHtml(eventTitle(ev));
      const date = escapeHtml(formatDate(ev.date));
      const venue = escapeHtml(eventVenue(ev));
      const note = escapeHtml(ev.note || ev.notes || '');
      return `
        <article class="card">
          <div class="card-date">${date}</div>
          <div class="card-header">
            <div class="card-main">
              <h3>${title}</h3>
              ${venue ? `<p>${venue}</p>` : ''}
              ${note ? `<p>${note}</p>` : ''}
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function renderPagedList(container, items, pageIndex) {
  const pages = chunk(items, rowsPerCarouselPage);
  carouselPages = pages;
  const totalPages = Math.max(1, pages.length);
  const safeIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
  currentCarouselPage = safeIndex;

  if (!items.length) {
    container.innerHTML = `<div class="empty">Loading…</div>`;
    return;
  }

  const pageItems = pages[safeIndex] || [];
  const rowsHtml = pageItems.map(ev => {
    const title = escapeHtml(eventTitle(ev));
    const date = escapeHtml(formatDate(ev.date));
    const venue = escapeHtml(eventVenue(ev));
    return `
      <div class="feature-row">
        <strong>${title}</strong>
        <div class="small">${date}${venue ? ` · ${venue}` : ''}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="feature-page">
      ${rowsHtml}
    </div>
  `;

  return totalPages;
}

function renderFeaturePagination(totalPages) {
  els.carouselDots.innerHTML = '';
  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `carousel-dot${i === currentCarouselPage ? ' active' : ''}`;
    dot.setAttribute('aria-label', `Page ${i + 1} of ${totalPages}`);
    dot.addEventListener('click', () => {
      currentCarouselPage = i;
      renderCarousel();
    });
    els.carouselDots.appendChild(dot);
  }

  els.carouselPrev.disabled = currentCarouselPage === 0;
  els.carouselNext.disabled = currentCarouselPage >= totalPages - 1;
  els.carouselPrev.setAttribute('aria-label', `Previous page, ${Math.max(1, currentCarouselPage)} of ${totalPages}`);
  els.carouselNext.setAttribute('aria-label', `Next page, ${Math.min(totalPages, currentCarouselPage + 2)} of ${totalPages}`);
  els.carouselPrev.textContent = '▲';
  els.carouselNext.textContent = '▼';
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

  const upcomingItems = events
    .filter(ev => {
      const d = parseDate(ev.date);
      return d && d >= new Date();
    })
    .sort(sortByDateAsc);

  const lists = [
    { el: els.dayFeature, items: dayItems },
    { el: els.weekFeature, items: weekItems },
    { el: els.upcomingFeature, items: upcomingItems }
  ];

  let totalPages = 1;
  lists.forEach(({ el, items }) => {
    totalPages = Math.max(totalPages, renderPagedList(el, items, currentCarouselPage));
  });

  const maxPages = Math.max(
    chunk(dayItems, rowsPerCarouselPage).length,
    chunk(weekItems, rowsPerCarouselPage).length,
    chunk(upcomingItems, rowsPerCarouselPage).length,
    1
  );

  const safePage = Math.min(currentCarouselPage, maxPages - 1);
  currentCarouselPage = safePage;

  renderPagedList(els.dayFeature, dayItems, safePage);
  renderPagedList(els.weekFeature, weekItems, safePage);
  renderPagedList(els.upcomingFeature, upcomingItems, safePage);

  els.carouselTrack.style.transform = `translateX(${-safePage * 100}%)`;
  renderFeaturePagination(maxPages);
}

function prevPage() {
  if (currentCarouselPage > 0) {
    currentCarouselPage -= 1;
    renderCarousel();
  }
}

function nextPage() {
  const maxPages = carouselPages.length || 1;
  if (currentCarouselPage < maxPages - 1) {
    currentCarouselPage += 1;
    renderCarousel();
  }
}

function inferFields(row) {
  const lowerKeys = Object.keys(row).reduce((acc, k) => {
    acc[k.toLowerCase()] = row[k];
    return acc;
  }, {});
  return {
    date: lowerKeys.date || lowerKeys.showdate || lowerKeys.show_date || lowerKeys.datetime || '',
    artist: lowerKeys.artist || lowerKeys.band || lowerKeys.performer || lowerKeys.name || '',
    venue: lowerKeys.venue || lowerKeys.location || lowerKeys.place || '',
    city: lowerKeys.city || '',
    note: lowerKeys.note || lowerKeys.notes || lowerKeys.memo || '',
    year: lowerKeys.year || '',
    title: lowerKeys.title || lowerKeys.event || ''
  };
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
