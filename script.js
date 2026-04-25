const CSV_PATH = 'Events_Database.csv';
const els = {
  search: document.getElementById('searchInput'),
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
  carouselNext: document.getElementById('carouselNext'),
  topArtistsList: document.getElementById('topArtistsList'),
  topVenuesList: document.getElementById('topVenuesList'),
  highlightsPanel: document.getElementById('highlightsPanel'),
  eventsPanel: document.getElementById('eventsPanel'),
  toggleHighlights: document.getElementById('toggleHighlights'),
  toggleEvents: document.getElementById('toggleEvents'),
  toggleTrack: document.getElementById('toggleTrack'),
  scrubberCanvas: document.getElementById('scrubberCanvas'),
  scrubberLabel: document.getElementById('scrubberLabel'),
  scrubberReset: document.getElementById('scrubberReset')
};

let rows = [];
let sortOrder = 'newest';
let scrubberYear = null;
let scrubberData = {}; // { year: count }
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

  return rows.filter(r => {
    if (!isPastOrToday(r.Date)) return false;
    if (scrubberYear && yearOf(r) !== String(scrubberYear)) return false;
    if (!q) return true;

    const blob = [
      r.Date, r.Artist, r.Venue, r.Note, r.Setlist, r.Festival, r.Type
    ].map(lower).join(' | ');

    return blob.includes(q);
  });
}

// When a search query matches rows that are predominantly one artist,
// collapse them into a single artist card showing the timeline.
// Non-artist matches (venue, note, year) stay as individual cards.
function getDisplayRows(filtered, query) {
  if (!query) return { rows: filtered, dedupedArtists: new Set() };

  const byArtist = {};
  filtered.forEach(r => {
    const a = norm(r.Artist);
    if (!byArtist[a]) byArtist[a] = [];
    byArtist[a].push(r);
  });

  const dedupedArtists = new Set();
  const displayRows = [];
  const seen = new Set();

  filtered.forEach(r => {
    const a = norm(r.Artist);
    const artistRows = byArtist[a];

    // Artist name matches the query and they have multiple shows → one card
    if (lower(r.Artist).includes(query) && artistRows.length > 1) {
      if (!seen.has(a)) {
        seen.add(a);
        dedupedArtists.add(a);
        const sorted = [...artistRows].sort(
          (x, y) => (parseFlexibleDate(y.Date)?.getTime() || 0) - (parseFlexibleDate(x.Date)?.getTime() || 0)
        );
        displayRows.push(sorted[0]);
      }
    } else {
      // Non-artist match (venue, note, etc.) — individual cards, no dedup
      const key = a + '|' + norm(r.Date);
      if (!seen.has(key)) {
        seen.add(key);
        displayRows.push(r);
      }
    }
  });

  return { rows: displayRows, dedupedArtists };
}

function exactArtistCount(artist) {
  const target = norm(artist);
  return rows.filter(r => norm(r.Artist) === target && isPastOrToday(r.Date)).length;
}

function artistTimelineHtml(artist) {
  const shows = rows
    .filter(r => norm(r.Artist) === norm(artist) && isPastOrToday(r.Date))
    .sort((a, b) => (parseFlexibleDate(a.Date)?.getTime() || 0) - (parseFlexibleDate(b.Date)?.getTime() || 0));

  if (!shows.length) return '';

  const items = shows.map((show, i) => {
    const isLast = i === shows.length - 1;
    const setlistLink = norm(show.Setlist)
      ? ` · <a href="${escapeHtml(show.Setlist)}" target="_blank" rel="noreferrer">Setlist</a>`
      : '';
    const festivalTag = norm(show.Festival)
      ? ` <span class="tl-festival">${escapeHtml(show.Festival)}</span>`
      : '';
    return `
      <li class="tl-item${isLast ? ' tl-item--last' : ''}">
        <div class="tl-dot"></div>
        <div class="tl-body">
          <span class="tl-date">${escapeHtml(displayDate(show.Date))}</span>
          <span class="tl-venue">${escapeHtml(show.Venue)}${setlistLink}</span>
          ${festivalTag}
        </div>
      </li>`;
  }).join('');

  return `
    <div class="tl-header">Seen ${shows.length} time${shows.length !== 1 ? 's' : ''}</div>
    <ul class="tl-list">${items}</ul>
  `;
}

function cardHtml(r, index, isDeduped = false) {
  const detailsId = `details-${index}`;
  const setlist = norm(r.Setlist)
    ? `<a href="${escapeHtml(r.Setlist)}" target="_blank" rel="noreferrer">Setlist.fm</a>`
    : '';
  const note = norm(r.Note) ? `<p>${escapeHtml(r.Note)}</p>` : '';
  const timeline = artistTimelineHtml(r.Artist);
  const showCount = exactArtistCount(r.Artist);
  const hasTimeline = showCount > 1;

  // Deduped artist card: show count instead of single date, omit venue/note/setlist
  const headerContent = isDeduped
    ? `<div class="card-date">${showCount} shows · most recently ${escapeHtml(displayDate(r.Date))}</div>
       <h3>${escapeHtml(r.Artist)}</h3>
       <p>${escapeHtml(r.Venue)}</p>`
    : `<div class="card-date">${escapeHtml(displayDate(r.Date))}</div>
       <h3>${escapeHtml(r.Artist)}</h3>
       <p>${escapeHtml(r.Venue)}</p>
       ${note}
       ${setlist ? `<div class="meta-line">${setlist}</div>` : ''}`;

  return `
    <article class="card" data-artist="${escapeHtml(r.Artist)}">
      <div class="card-header">
        <div class="card-main">
          ${headerContent}
        </div>
        ${hasTimeline ? `
        <button
          type="button"
          class="card-toggle"
          aria-expanded="false"
          aria-controls="${detailsId}"
          aria-label="Show all shows for ${escapeHtml(r.Artist)}"
        >
          <span class="chev">⌄</span>
        </button>` : ''}
      </div>
      ${hasTimeline ? `
      <div class="details-panel" id="${detailsId}" hidden>
        <div class="details-content">
          ${timeline}
        </div>
      </div>` : ''}
    </article>
  `;
}

function sortRows(filtered) {
  const copy = [...filtered];
  if (sortOrder === 'newest') {
    return copy.sort((a, b) => (parseFlexibleDate(b.Date)?.getTime() || 0) - (parseFlexibleDate(a.Date)?.getTime() || 0));
  }
  if (sortOrder === 'oldest') {
    return copy.sort((a, b) => (parseFlexibleDate(a.Date)?.getTime() || 0) - (parseFlexibleDate(b.Date)?.getTime() || 0));
  }
  if (sortOrder === 'az') {
    return copy.sort((a, b) => norm(a.Artist).localeCompare(norm(b.Artist)));
  }
  return copy;
}

function render() {
  const filtered = getFiltered();
  const sorted = sortRows(filtered);
  const query = lower(els.search.value);
  const { rows: displayRows, dedupedArtists } = getDisplayRows(sorted, query);

  els.results.innerHTML = displayRows.length
    ? displayRows.map((r, i) => cardHtml(r, i, dedupedArtists.has(norm(r.Artist)))).join('')
    : '<div class="empty">No events matched your search.</div>';

  const isFiltered = query || scrubberYear;
  els.resultsCount.textContent = isFiltered ? `${filtered.length} found` : '';
  els.resultsHeading.textContent = scrubberYear ? String(scrubberYear) : query ? 'Filtered events' : 'All events';
  bindDisclosureButtons();
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

function yearsAgoLabel(dateVal) {
  const d = parseFlexibleDate(dateVal);
  if (!d) return '';
  const diff = new Date().getFullYear() - d.getFullYear();
  if (diff <= 0) return '';
  return diff === 1 ? '1 year ago' : `${diff} years ago`;
}

function featureCard(r) {
  const ago = yearsAgoLabel(r.Date);
  return `
    <div class="small feature-row">
      <div class="feature-text">
        <strong>${escapeHtml(r.Artist)}</strong>
        ${ago ? `<span class="ago-badge">${escapeHtml(ago)}</span>` : ''}
        <br>
        ${escapeHtml(displayDate(r.Date))} · ${escapeHtml(r.Venue)}
        ${norm(r.Festival) ? `<br><span class="badge" style="margin-top:6px">${escapeHtml(r.Festival)}</span>` : ''}
      </div>
    </div>
  `;
}

function upcomingFeatureCard(r) {
  const today = startOfToday();
  const showDay = startOfDay(r._date);
  const diffMs = showDay.getTime() - today.getTime();
  const daysAway = Math.round(diffMs / 86400000);

  let countdownText;
  if (daysAway === 0) countdownText = 'Today';
  else if (daysAway === 1) countdownText = 'Tomorrow';
  else countdownText = `${daysAway} days away`;

  return `
    <div class="small feature-row upcoming-row">
      <div class="feature-text">
        <strong>${escapeHtml(r.Artist)}</strong>
        <span class="countdown-badge">${escapeHtml(countdownText)}</span>
        <br>
        ${escapeHtml(displayDate(r.Date))} · ${escapeHtml(r.Venue)}
        ${norm(r.Festival) ? `<br><span class="badge" style="margin-top:6px">${escapeHtml(r.Festival)}</span>` : ''}
      </div>
    </div>
  `;
}

function renderPagedFeatureUpcoming(el, items) {
  const pages = getFeaturePages(items);
  const pageIndex = featurePageState['upcoming'] || 0;
  const visible = pages[pageIndex] || [];
  const hasPrevious = pageIndex > 0;
  const btnText = hasPrevious ? 'Show less' : 'See more';

  el.innerHTML = `
    <div class="feature-page">
      ${visible.length
        ? visible.map(upcomingFeatureCard).join('')
        : `<div class="empty">No upcoming events found.</div>`}
    </div>
    ${pages.length > 1 ? `<div class="feature-actions"><button type="button" class="see-more-btn" data-feature="upcoming" data-action="${hasPrevious ? 'less' : 'more'}">${btnText}</button></div>` : ''}
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
  const hasPrevious = pageIndex > 0;
  const btnText = hasPrevious ? 'Show less' : 'See more';

  el.innerHTML = `
    <div class="feature-page">
      ${visible.length ? visible.map(featureCard).join('') : `<div class="empty">${emptyText}</div>`}
    </div>
    ${pages.length > 1 ? `<div class="feature-actions"><button type="button" class="see-more-btn" data-feature="${key}" data-action="${hasPrevious ? 'less' : 'more'}">${btnText}</button></div>` : ''}
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
    .sort((a, b) => (parseFlexibleDate(b.Date)?.getTime() || 0) - (parseFlexibleDate(a.Date)?.getTime() || 0));

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
    .sort((a, b) => (parseFlexibleDate(b.Date)?.getTime() || 0) - (parseFlexibleDate(a.Date)?.getTime() || 0));

  const upcomingMatches = rows
    .map(r => ({ ...r, _date: parseFlexibleDate(r.Date) }))
    .filter(r => r._date && startOfDay(r._date).getTime() > today.getTime())
    .sort((a, b) => a._date - b._date);

  renderPagedFeature(els.dayFeature, dayMatches, 'day', 'No shows on this date — yet. Go make a memory.');
  renderPagedFeature(els.weekFeature, weekMatches, 'week', 'A quiet week historically. Time to fix that.');
  renderPagedFeatureUpcoming(els.upcomingFeature, upcomingMatches);
  bindFeatureButtons();
}

function initFilters() {
  fillSelect(els.year, uniqueSorted(rows.map(yearOf)), 'Years');
}

function drawScrubber() {
  const canvas = els.scrubberCanvas;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.offsetWidth;
  if (!cssWidth) return;
  const cssHeight = 80;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const years = Object.keys(scrubberData).map(Number).sort((a, b) => a - b);
  const counts = years.map(y => scrubberData[y]);
  const max = Math.max(...counts);
  const n = years.length;
  const barAreaH = 56;
  const labelH = 14;
  const gap = 3;
  const totalGaps = (n - 1) * gap;
  const barW = Math.max(2, (cssWidth - totalGaps) / n);
  const radius = Math.min(barW / 2, 3);

  // Colors matching stats panel
  const accent    = '#4353ff';       // active bar — same as stats-bar-fill
  const barIdle   = '#dce2ee';       // unselected bar — same as var(--line) track
  const barDimmed = '#eef0f6';       // dimmed when another year selected
  const labelColor  = '#667085';     // var(--muted)
  const labelActive = '#4353ff';     // var(--accent)

  years.forEach((yr, i) => {
    const x = i * (barW + gap);
    const barH = Math.max(3, Math.round((scrubberData[yr] / max) * barAreaH));
    const y = barAreaH - barH;
    const isActive = scrubberYear === yr;
    const isDimmed = scrubberYear !== null && !isActive;

    // Draw full-height track (like stats-bar-track)
    ctx.fillStyle = isDimmed ? barDimmed : barIdle;
    ctx.beginPath();
    ctx.roundRect(x, 0, barW, barAreaH, radius);
    ctx.fill();

    // Draw filled portion on top (like stats-bar-fill)
    ctx.fillStyle = isActive ? accent : isDimmed ? barDimmed : accent;
    ctx.globalAlpha = isActive ? 1 : isDimmed ? 0.3 : 0.35;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, radius);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Labels
  ctx.textAlign = 'center';
  const minGap = 4;
  let lastLabelRight = -Infinity;
  const labelFont     = '10px system-ui';
  const labelFontBold = 'bold 10px system-ui';

  if (scrubberYear !== null) {
    const i = years.indexOf(scrubberYear);
    if (i !== -1) {
      const x = i * (barW + gap) + barW / 2;
      ctx.font = labelFontBold;
      ctx.fillStyle = labelActive;
      ctx.fillText(String(scrubberYear), x, barAreaH + labelH);
    }
  } else {
    const candidates = years.filter((yr, i) =>
      i === 0 || i === n - 1 || yr % 3 === 0
    );
    ctx.font = labelFont;
    ctx.fillStyle = labelColor;
    candidates.forEach(yr => {
      const i = years.indexOf(yr);
      const cx = i * (barW + gap) + barW / 2;
      const text = String(yr);
      const textW = ctx.measureText(text).width;
      const left  = cx - textW / 2;
      const right = cx + textW / 2;
      if (left > lastLabelRight + minGap) {
        ctx.fillText(text, cx, barAreaH + labelH);
        lastLabelRight = right;
      }
    });
  }
}

function yearFromClick(clientX) {
  const canvas = els.scrubberCanvas;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const years = Object.keys(scrubberData).map(Number).sort((a, b) => a - b);
  const n = years.length;
  const gap = 2;
  const totalGaps = (n - 1) * gap;
  const barW = (rect.width - totalGaps) / n;
  const i = Math.floor(x / (barW + gap));
  return years[Math.max(0, Math.min(i, n - 1))] ?? null;
}

function selectScrubberYear(yr) {
  scrubberYear = yr;
  if (els.scrubberLabel) els.scrubberLabel.textContent = yr ? String(yr) : 'All years';
  if (els.scrubberReset) els.scrubberReset.hidden = yr === null;
  drawScrubber();
  render();
  updateArtistMessage();
}

function buildScrubber() {
  const past = rows.filter(r => isPastOrToday(r.Date));
  scrubberData = {};
  past.forEach(r => {
    const y = yearOf(r);
    if (y) scrubberData[y] = (scrubberData[y] || 0) + 1;
  });

  const canvas = els.scrubberCanvas;
  if (!canvas) return;

  window.addEventListener('resize', drawScrubber);

  canvas.addEventListener('click', e => {
    const yr = yearFromClick(e.clientX);
    if (yr !== null) selectScrubberYear(scrubberYear === yr ? null : yr);
  });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const yr = yearFromClick(touch.clientX);
    if (yr !== null) selectScrubberYear(scrubberYear === yr ? null : yr);
  }, { passive: false });

  els.scrubberReset?.addEventListener('click', () => selectScrubberYear(null));
}

function buildStats() {
  const past = rows.filter(r => isPastOrToday(r.Date));

  const artistCount = {};
  const venueCount = {};
  const venueDaySeen = new Set();
  past.forEach(r => {
    const a = norm(r.Artist);
    const v = norm(r.Venue);
    if (a) artistCount[a] = (artistCount[a] || 0) + 1;
    if (v && !norm(r.Festival)) {
      const dayKey = v + '|' + norm(r.Date);
      if (!venueDaySeen.has(dayKey)) {
        venueDaySeen.add(dayKey);
        venueCount[v] = (venueCount[v] || 0) + 1;
      }
    }
  });

  const topArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topVenues  = Object.entries(venueCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxA = topArtists[0]?.[1] || 1;
  const maxV = topVenues[0]?.[1] || 1;

  function listHtml(items, max) {
    return items.map(([name, count], i) => `
      <li class="stats-item">
        <span class="stats-rank">${i + 1}</span>
        <div class="stats-bar-wrap">
          <div class="stats-name">${escapeHtml(name)}</div>
          <div class="stats-bar-track">
            <div class="stats-bar-fill" style="width:${Math.round((count / max) * 100)}%"></div>
          </div>
        </div>
        <span class="stats-count">${count}</span>
      </li>`).join('');
  }

  if (els.topArtistsList) els.topArtistsList.innerHTML = listHtml(topArtists, maxA);
  if (els.topVenuesList)  els.topVenuesList.innerHTML  = listHtml(topVenues, maxV);
}

function updateFeaturePage(key, action) {
  if (action === 'more') {
    featurePageState[key] = (featurePageState[key] || 0) + 1;
  } else {
    featurePageState[key] = Math.max(0, (featurePageState[key] || 0) - 1);
  }
  buildFeatures();
}

function bindFeatureButtons() {
  document.querySelectorAll('.see-more-btn').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      updateFeaturePage(btn.dataset.feature, btn.dataset.action);
    };
  });
}

function bindDisclosureButtons() {
  document.querySelectorAll('.card-toggle').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      const open = btn.getAttribute('aria-expanded') === 'true';

      btn.setAttribute('aria-expanded', String(!open));
      if (panel) {
        panel.hidden = open;
        panel.classList.toggle('open', !open);
      }
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
      if (e.target.closest('.card-toggle') || e.target.closest('.see-more-btn') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dot')) return;
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

function setView(view) {
  const showHighlights = view === 'highlights';
  els.highlightsPanel.style.display = showHighlights ? '' : 'none';
  els.eventsPanel.style.display = showHighlights ? 'none' : '';
  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel) statsPanel.style.display = showHighlights ? '' : 'none';
  els.toggleHighlights.classList.toggle('active', showHighlights);
  els.toggleEvents.classList.toggle('active', !showHighlights);
  els.toggleTrack?.classList.toggle('right', !showHighlights);
  if (!showHighlights) requestAnimationFrame(drawScrubber);
}

function buildToggle() {
  els.toggleHighlights?.addEventListener('click', () => setView('highlights'));
  els.toggleEvents?.addEventListener('click', () => setView('events'));
  els.toggleTrack?.addEventListener('click', () => {
    const isHighlights = els.highlightsPanel.style.display !== 'none';
    setView(isHighlights ? 'events' : 'highlights');
  });
}

function attachEvents() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sortOrder = btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
  });

  els.search.addEventListener('input', () => {
    render();
    updateArtistMessage();
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.see-more-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    updateFeaturePage(btn.dataset.feature, btn.dataset.action);
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.card-toggle');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') === 'true';

    btn.setAttribute('aria-expanded', String(!open));
    if (panel) {
      panel.hidden = open;
      panel.classList.toggle('open', !open);
    }
  });
}

async function main() {
  const response = await fetch(CSV_PATH);
  const text = await response.text();

  rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  rows = rows.filter(r => norm(r.Date) && norm(r.Artist) && lower(r.Type) !== 'broadway');

  const pastRows = rows.filter(r => isPastOrToday(r.Date));
  const pastOrTodayCount = pastRows.length;

  // Build rotating hero stats
  const uniqueArtists = new Set(pastRows.map(r => norm(r.Artist))).size;
  const uniqueVenues = new Set(
    pastRows.filter(r => !norm(r.Festival) && norm(r.Venue)).map(r => norm(r.Venue))
  ).size;

  const byYear = {};
  pastRows.forEach(r => {
    const y = yearOf(r);
    if (y) byYear[y] = (byYear[y] || 0) + 1;
  });
  const topYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];

  const byMonth = {};
  pastRows.forEach(r => {
    const d = parseFlexibleDate(r.Date);
    if (!d) return;
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    byMonth[key] = (byMonth[key] || 0) + 1;
  });
  const topMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
  const topMonthLabel = topMonth ? (() => {
    const [y, m] = topMonth[0].split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })() : '';

  const heroStats = [
    { value: pastOrTodayCount.toLocaleString(), label: 'total performances' },
    { value: uniqueArtists.toLocaleString(), label: 'artists' },
    { value: uniqueVenues.toLocaleString(), label: 'venues visited' },
    { value: topYear ? topYear[1].toLocaleString() : '', label: topYear ? `shows in ${topYear[0]}` : '' },
    { value: topMonth ? topMonth[1].toLocaleString() : '', label: `shows in ${topMonthLabel}` },
  ].filter(s => s.value);

  const heroStatEl = document.getElementById('totalCount');
  const heroLabelEl = document.getElementById('heroStatLabel');
  let heroIndex = 0;

  function showHeroStat(idx) {
    const stat = heroStats[idx % heroStats.length];
    heroStatEl.classList.add('fading');
    heroLabelEl.classList.add('fading');
    setTimeout(() => {
      heroStatEl.textContent = stat.value;
      heroLabelEl.textContent = stat.label;
      heroStatEl.classList.remove('fading');
      heroLabelEl.classList.remove('fading');
    }, 300);
  }

  showHeroStat(0);
  setInterval(() => { heroIndex++; showHeroStat(heroIndex); }, 4000);

  // Search clear button
  const searchClear = document.getElementById('searchClear');
  if (searchClear && els.search) {
    els.search.addEventListener('input', () => {
      searchClear.hidden = !els.search.value;
    });
    searchClear.addEventListener('click', () => {
      els.search.value = '';
      searchClear.hidden = true;
      render();
      updateArtistMessage();
    });
  }

  buildScrubber();
  buildStats();
  buildFeatures();
  buildCarousel();
  buildToggle();
  attachEvents();
  render();
  updateArtistMessage();
}

main().catch(err => {
  els.results.innerHTML = `<div class="empty">Could not load CSV. Make sure <strong>Events_Database.csv</strong> is in the repo root.</div>`;
  els.resultsCount.textContent = '0 found';
  console.error(err);
});
