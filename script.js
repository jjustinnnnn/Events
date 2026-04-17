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
  artistMessage: document.getElementById('artistMessage'),
  carouselTrack: document.getElementById('carouselTrack'),
  carouselViewport: document.getElementById('carouselViewport'),
  carouselDots: document.getElementById('carouselDots'),
  carouselPrev: document.getElementById('carouselPrev'),
  carouselNext: document.getElementById('carouselNext')
};

let rows = [];
let carouselIndex = 0;
let carouselSlides = [];
let featurePageState = {
  day: 0,
  week: 0,
  upcoming: 0
};

const PAGE_SIZE = 5;

const norm = v => (v ?? '').toString().trim();
const lower = v => norm(v).toLowerCase();

function parseFlexibleDate(v) {
  const s = norm(v);
  if (!s) return null;

  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4);

    let d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;

    d = new Date(`${yyyy}-${dd}-${mm}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isPastOrToday(v) {
  const d = parseFlexibleDate(v);
  if (!d) return false;
  return startOfDay(d).getTime() <= startOfToday().getTime();
}

function getWeekOfYear(date) {
  const d = startOfDay(date);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
}

const yearOf = r => {
  const d = parseFlexibleDate(r.Date);
  return d ? String(d.getFullYear()) : '';
};

const displayDate = v => {
  const d = parseFlexibleDate(v);
  if (Number.isNaN(d?.getTime?.())) return norm(v);
  if (!d) return norm(v);

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function fillSelect(select, values, label) {
  select.innerHTML =
    `<option value="all">All ${label}</option>` +
    values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
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
    if (!isPastOrToday(r.Date)) return false;
    if (type !== 'all' && norm(r.Type) !== type) return false;
    if (year !== 'all' && yearOf(r) !== year) return false;
    if (!q) return true;

    const blob = [
      r.Date,
      r.Artist,
      r.Venue,
      r.Note,
      r.Setlist,
      r.Festival,
      r.Type
    ].map(lower).join(' | ');

    return blob.includes(q);
  });
}

function cardHtml(r) {
  const setlist = norm(r.Setlist)
    ? `<a href="${escapeHtml(r.Setlist)}" target="_blank" rel="noreferrer">Setlist.fm</a>`
    : '';
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

  els.results.innerHTML = filtered.length
    ? filtered.map(cardHtml).join('')
    : '<div class="empty">No events matched your search.</div>';

  els.resultsCount.textContent = `${filtered.length} found`;

  const active = [
    els.type.value !== 'all' ? els.type.value : '',
    els.year.value !== 'all' ? els.year.value : ''
  ].filter(Boolean);

  els.resultsHeading.textContent = active.length ? 'Filtered events' : 'All events';
}

function updateArtistMessage() {
  const query = lower(els.search.value);

  if (!query) {
    els.artistMessage.textContent = '';
    return;
  }

  const matches = rows.filter(
    r => isPastOrToday(r.Date) && lower(r.Artist).includes(query)
  );

  if (!matches.length) {
    els.artistMessage.textContent = "Hmm...don't think you've seen them yet! Bummer...";
    return;
  }

  matches.sort(
    (a, b) =>
      (parseFlexibleDate(b.Date)?.getTime() || 0) -
      (parseFlexibleDate(a.Date)?.getTime() || 0)
  );

  const latest = matches[0];
  const count = matches.length;
  const countText = count === 1 ? 'once' : `${count} times`;

  els.artistMessage.textContent =
    `You've seen ${latest.Artist} ${countText}! The last time was on ${displayDate(latest.Date)} at ${latest.Venue}.`;
}

function featureCard(r) {
  return `
    <div class="small feature-row">
      <div class="feature-text">
        <strong>${escapeHtml(r.Artist)}</strong><br>
        ${escapeHtml(displayDate(r.Date))} · ${escapeHtml(r.Venue)}
        ${norm(r.Festival) ? `<br><span class="badge" style="margin-top:6px">${escapeHtml(r.Festival)}</span>` : ''}
      </div>
    </div>
  `;
}

function getFeaturePages(items) {
  const pages = [];
  for (let i = 0; i < items.length; i += PAGE_SIZE) {
    pages.push(items.slice(i, i + PAGE_SIZE));
  }
  return pages;
}

function renderPagedFeature(el, items, key, emptyText) {
  const pages = getFeaturePages(items);
  const pageIndex = featurePageState[key] || 0;
  const visible = pages[pageIndex] || [];
  const hasMore = pageIndex < pages.length - 1;
  const hasPrevious = pageIndex > 0;

  el.innerHTML = `
    <div class="feature-page">
      ${visible.length ? visible.map(featureCard).join('') : `<div class="empty">${emptyText}</div>`}
    </div>
    <div class="feature-actions">
      ${hasPrevious ? `<button type="button" class="see-more-btn" data-feature="${key}" data-action="less">Show less</button>` : ''}
      ${hasMore ? `<button type="button" class="see-more-btn" data-feature="${key}" data-action="more">See more</button>` : ''}
    </div>
  `;
}

function buildFeatures() {
  const now = new Date();
  const today = startOfToday();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const todayWeek = getWeekOfYear(now);
  const currentYear = now.getFullYear();

  const dayMatches = rows
    .filter(r => {
      const d = parseFlexibleDate(r.Date);
      return (
        d &&
        d.getFullYear() !== currentYear &&
        startOfDay(d).getTime() <= today.getTime() &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDay
      );
    })
    .sort(
      (a, b) =>
        (parseFlexibleDate(b.Date)?.getTime() || 0) -
        (parseFlexibleDate(a.Date)?.getTime() || 0)
    );

  const weekMatches = rows
    .filter(r => {
      const d = parseFlexibleDate(r.Date);
      return (
        d &&
        d.getFullYear() !== currentYear &&
        startOfDay(d).getTime() <= today.getTime() &&
        getWeekOfYear(d) === todayWeek
      );
    })
    .sort(
      (a, b) =>
        (parseFlexibleDate(b.Date)?.getTime() || 0) -
        (parseFlexibleDate(a.Date)?.getTime() || 0)
    );

  const upcomingMatches = rows
    .map(r => ({ ...r, _date: parseFlexibleDate(r.Date) }))
    .filter(r => r._date && startOfDay(r._date).getTime() > today.getTime())
    .sort((a, b) => a._date - b._date);

  renderPagedFeature(els.dayFeature, dayMatches, 'day', 'No historical matches for today yet. Go to more concerts!');
  renderPagedFeature(els.weekFeature, weekMatches, 'week', 'No historical matches for this week yet.');
  renderPagedFeature(els.upcomingFeature, upcomingMatches, 'upcoming', 'No upcoming events found.');
}

function initFilters() {
  fillSelect(els.type, uniqueSorted(rows.map(r => norm(r.Type))), 'Types');
  fillSelect(els.year, uniqueSorted(rows.map(yearOf)), 'Years');
}

function updateFeaturePage(key, action) {
  if (action === 'more') {
    featurePageState[key] = (featurePageState[key] || 0) + 1;
  } else {
    featurePageState[key] = Math.max(0, (featurePageState[key] || 0) - 1);
  }
  buildFeatures();
  bindFeatureButtons();
}

function bindFeatureButtons() {
  document.querySelectorAll('.see-more-btn').forEach(btn => {
    btn.onclick = () => {
      updateFeaturePage(btn.dataset.feature, btn.dataset.action);
    };
  });
}

function updateCarousel() {
  if (!els.carouselTrack) return;
  const slides = carouselSlides.length || 3;
  carouselIndex = Math.max(0, Math.min(carouselIndex, slides - 1));
  els.carouselTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;

  if (els.carouselDots) {
    [...els.carouselDots.querySelectorAll('.carousel-dot')].forEach((dot, i) => {
      dot.classList.toggle('active', i === carouselIndex);
      dot.setAttribute('aria-current', i === carouselIndex ? 'true' : 'false');
    });
  }
}

function buildCarousel() {
  carouselSlides = [...document.querySelectorAll('.carousel-slide')];

  if (!els.carouselDots) return;

  els.carouselDots.innerHTML = carouselSlides
    .map((_, i) => `<button class="carousel-dot${i === 0 ? ' active' : ''}" type="button" aria-label="Go to feature ${i + 1}" data-index="${i}"></button>`)
    .join('');

  els.carouselDots.addEventListener('click', e => {
    const btn = e.target.closest('.carousel-dot');
    if (!btn) return;
    carouselIndex = Number(btn.dataset.index);
    updateCarousel();
  });

  els.carouselPrev?.addEventListener('click', () => {
    carouselIndex = (carouselIndex - 1 + carouselSlides.length) % carouselSlides.length;
    updateCarousel();
  });

  els.carouselNext?.addEventListener('click', () => {
    carouselIndex = (carouselIndex + 1) % carouselSlides.length;
    updateCarousel();
  });

  let startX = 0;
  let currentX = 0;
  let dragging = false;

  if (els.carouselViewport) {
    els.carouselViewport.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      dragging = true;
    }, { passive: true });

    els.carouselViewport.addEventListener('touchmove', e => {
      if (!dragging) return;
      currentX = e.touches[0].clientX;
    }, { passive: true });

    els.carouselViewport.addEventListener('touchend', () => {
      if (!dragging) return;
      const delta = currentX - startX;
      if (Math.abs(delta) > 40) {
        carouselIndex = delta > 0
          ? (carouselIndex - 1 + carouselSlides.length) % carouselSlides.length
          : (carouselIndex + 1) % carouselSlides.length;
        updateCarousel();
      }
      dragging = false;
      startX = 0;
      currentX = 0;
    });
  }

  window.addEventListener('resize', updateCarousel);
  updateCarousel();
}

function attachEvents() {
  [els.search, els.type, els.year].forEach(el =>
    el.addEventListener('input', () => {
      render();
      updateArtistMessage();
    })
  );

  els.clear.addEventListener('click', () => {
    els.search.value = '';
    els.type.value = 'all';
    els.year.value = 'all';
    render();
    updateArtistMessage();
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.see-more-btn');
    if (!btn) return;
    updateFeaturePage(btn.dataset.feature, btn.dataset.action);
  });
}

async function main() {
  const response = await fetch(CSV_PATH);
  const text = await response.text();

  rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  rows = rows.filter(r => norm(r.Date) && norm(r.Artist));

  const pastOrTodayCount = rows.filter(r => isPastOrToday(r.Date)).length;
  els.total.textContent = `${pastOrTodayCount.toLocaleString()} concerts since 2004`;

  initFilters();
  buildFeatures();
  buildCarousel();
  attachEvents();
  render();
  updateArtistMessage();
}

main().catch(err => {
  els.results.innerHTML = `<div class="empty">Could not load CSV. Make sure <strong>Events_Database.csv</strong> is in the repo root.</div>`;
  els.resultsCount.textContent = '0 found';
  console.error(err);
});
