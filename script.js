const CSV_PATH = 'Events_Database.csv';
const els = {
  search: document.getElementById('searchInput'),
  clear: document.getElementById('clearBtn'),
  type: document.getElementById('typeFilter'),
  year: document.getElementById('yearFilter'),
  total: document.getElementById('totalCount'),
  results: document.getElementById('results'),
  resultsCount: document.getElementById('resultsCount'),
  resultsHeading: document.getElementById('resultsHeading'),
  dayFeature: document.getElementById('dayFeature'),
  weekFeature: document.getElementById('weekFeature'),
  upcomingFeature: document.getElementById('upcomingFeature'),
  artistMessage: document.getElementById('artistMessage')
};

let rows = [];

const norm = v => (v ?? '').toString().trim();
const lower = v => norm(v).toLowerCase();

function parseFlexibleDate(v) {
  const s = norm(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const mm = digits.slice(0, 2), dd = digits.slice(2, 4), yyyy = digits.slice(4);
    let d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
    d = new Date(`${yyyy}-${dd}-${mm}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const yearOf = r => {
  const d = parseFlexibleDate(r.Date);
  return d ? String(d.getFullYear()) : '';
};

const displayDate = v => {
  const d = parseFlexibleDate(v);
  if (Number.isNaN(d?.getTime?.())) return norm(v);
  if (!d) return norm(v);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function fillSelect(select, values, label) {
  select.innerHTML = `<option value="all">All ${label}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function escapeHtml(str) {
  return norm(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getFiltered() {
  const q = lower(els.search.value);
  const type = norm(els.type.value);
  const year = norm(els.year.value);

  return rows.filter(r => {
    if (type !== 'all' && norm(r.Type) !== type) return false;
    if (year !== 'all' && yearOf(r) !== year) return false;
    if (!q) return true;
    const blob = [r.Date, r.Artist, r.Venue, r.Note, r.Setlist, r.Festival, r.Type].map(lower).join(' | ');
    return blob.includes(q);
  });
}

function cardHtml(r) {
  const setlist = norm(r.Setlist) ? `<a href="${escapeHtml(r.Setlist)}" target="_blank" rel="noreferrer">Setlist.fm</a>` : '';
  const note = norm(r.Note) ? `<p>${escapeHtml(r.Note)}</p>` : '';

  return `
    <article class="card">
      <div class="card-main">
        <div class="card-date">${escapeHtml(displayDate(r.Date))}</div>
        <h3>${escapeHtml(r.Artist)}</h3>
        <p>${escapeHtml(r.Venue)}</p>
        ${note}
        ${setlist ? `<div class="meta-line">${setlist}</div>` : ''}
      </div>
    </article>
  `;
}

function render() {
  const filtered = getFiltered();
  els.results.innerHTML = filtered.length ? filtered.map(cardHtml).join('') : '<div class="empty">No events matched your search.</div>';
  els.resultsCount.textContent = `${filtered.length} found`;
  const active = [els.type.value !== 'all' ? els.type.value : '', els.year.value !== 'all' ? els.year.value : ''].filter(Boolean);
  els.resultsHeading.textContent = active.length ? 'Filtered events' : 'All events';
}

function updateArtistMessage() {
  const query = lower(els.search.value);
  if (!query) {
    els.artistMessage.textContent = '';
    return;
  }

  const matches = rows.filter(r => lower(r.Artist).includes(query));
  if (!matches.length) {
    els.artistMessage.textContent = "Hmm...don't think you've seen them yet! Bummer...";
    return;
  }

  matches.sort((a, b) => (parseFlexibleDate(b.Date)?.getTime() || 0) - (parseFlexibleDate(a.Date)?.getTime() || 0));
  const latest = matches[0];
  const count = matches.length;
  const countText = count === 1 ? 'once' : `${count} times`;
  els.artistMessage.textContent = `You've seen ${latest.Artist} ${countText}! The last time was on ${displayDate(latest.Date)} at ${latest.Venue}.`;
}

function featureCard(r) {
  return `
    <div class="small" style="padding:8px 0;border-bottom:1px solid rgba(220,226,238,0.7)">
      <strong>${escapeHtml(r.Artist)}</strong><br>
      ${escapeHtml(displayDate(r.Date))} · ${escapeHtml(r.Venue)}
      ${norm(r.Festival) ? `<br><span class="badge" style="margin-top:6px">${escapeHtml(r.Festival)}</span>` : ''}
    </div>
  `;
}

function buildFeatures() {
  const now = new Date();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const todayWeek = Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);

  const dayMatches = rows.filter(r => {
    const d = parseFlexibleDate(r.Date);
    return d && d.getMonth() === todayMonth && d.getDate() === todayDay;
  }).slice(0, 3);

  const weekMatches = rows.filter(r => String(r['Week Number']) === String(todayWeek)).slice(0, 3);

  const upcomingMatches = rows
    .map(r => ({ ...r, _date: parseFlexibleDate(r.Date) }))
    .filter(r => r._date && r._date > now)
    .sort((a, b) => a._date - b._date)
    .slice(0, 3);

  els.dayFeature.innerHTML = dayMatches.length ? dayMatches.map(featureCard).join('') : 'No historical matches for today yet. Go to more concerts!';
  els.weekFeature.innerHTML = weekMatches.length ? weekMatches.map(featureCard).join('') : 'No historical matches for this week yet.';
  els.upcomingFeature.innerHTML = upcomingMatches.length ? upcomingMatches.map(featureCard).join('') : 'No upcoming events found.';
}

function initFilters() {
  fillSelect(els.type, uniqueSorted(rows.map(r => norm(r.Type))), 'Types');
  fillSelect(els.year, uniqueSorted(rows.map(yearOf)), 'Years');
}

function attachEvents() {
  [els.search, els.type, els.year].forEach(el => el.addEventListener('input', () => {
    render();
    updateArtistMessage();
  }));
  els.clear.addEventListener('click', () => {
    els.search.value = '';
    els.type.value = 'all';
    els.year.value = 'all';
    render();
    updateArtistMessage();
  });
}

async function main() {
  const response = await fetch(CSV_PATH);
  const text = await response.text();
  rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  rows = rows.filter(r => norm(r.Date) && norm(r.Artist));
  els.total.textContent = `${rows.length.toLocaleString()} concerts since 2004`;
  initFilters();
  buildFeatures();
  attachEvents();
  render();
  updateArtistMessage();
}

main().catch(err => {
  els.results.innerHTML = `<div class="empty">Could not load CSV. Make sure <strong>Events_Database.csv</strong> is in the repo root.</div>`;
  els.resultsCount.textContent = '0 found';
  console.error(err);
});
