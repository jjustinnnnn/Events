let events = [];
let filteredEvents = [];
const els = {
  totalCount: document.getElementById('totalCount'),
  resultsCount: document.getElementById('resultsCount'),
  resultsHeading: document.getElementById('resultsHeading'),
  searchInput: document.getElementById('searchInput'),
  yearFilter: document.getElementById('yearFilter'),
  artistMessage: document.getElementById('artistMessage'),
  results: document.getElementById('results'),
  dayFeature: document.getElementById('dayFeature'),
  carouselTrack: document.getElementById('carouselTrack'),
  carouselDots: document.getElementById('carouselDots'),
  tabOnThisDay: document.getElementById('tabOnThisDay'),
  tabAllEvents: document.getElementById('tabAllEvents'),
  panelOnThisDay: document.getElementById('panelOnThisDay'),
  panelAllEvents: document.getElementById('panelAllEvents')
};

function normalize(v) { return String(v || '').toLowerCase().trim(); }
function parseDate(value) { if (!value) return null; const d = new Date(value); return isNaN(d.getTime()) ? null : d; }
function formatDate(value) { const d = parseDate(value); return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date'; }
function getYear(value) { const d = parseDate(value); return d ? String(d.getFullYear()) : ''; }
function escapeHtml(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
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

function renderList(container, items) {
  if (!items.length) {
    container.innerHTML = `<div class="empty">Loading…</div>`;
    return;
  }
  container.innerHTML = items.slice(0, 3).map(ev => {
    const title = escapeHtml(eventTitle(ev));
    const date = escapeHtml(formatDate(ev.date));
    const venue = escapeHtml(eventVenue(ev));
    return `<div class="feature-row"><strong>${title}</strong><div class="small">${date}${venue ? ` · ${venue}` : ''}</div></div>`;
  }).join('');
}

function renderCarousel() {
  const now = new Date();
  const dayItems = events.filter(ev => {
    const d = parseDate(ev.date);
    return d && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).sort(sortByDateDesc);

  renderList(els.dayFeature, dayItems);
  els.carouselTrack.style.transform = 'translateX(0)';
  els.carouselDots.innerHTML = '';
}

function setTab(tab) {
  const onDay = tab === 'day';
  els.tabOnThisDay.classList.toggle('active', onDay);
  els.tabAllEvents.classList.toggle('active', !onDay);
  els.tabOnThisDay.setAttribute('aria-selected', String(onDay));
  els.tabAllEvents.setAttribute('aria-selected', String(!onDay));
  els.panelOnThisDay.hidden = !onDay;
  els.panelAllEvents.hidden = onDay;
  els.panelOnThisDay.classList.toggle('active-section', onDay);
  els.panelAllEvents.classList.toggle('active-section', !onDay);
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
      setTab('day');
    },
    error: () => {
      els.results.innerHTML = `<div class="empty">Could not load the data file.</div>`;
    }
  });
}

els.searchInput.addEventListener('input', applyFilters);
els.yearFilter.addEventListener('change', applyFilters);
els.tabOnThisDay.addEventListener('click', () => setTab('day'));
els.tabAllEvents.addEventListener('click', () => setTab('all'));

loadData();
