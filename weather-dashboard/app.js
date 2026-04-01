const API_KEY = '83301ee6bbb55308cf3054fe3afc3ee3';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

const SUN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="none" stroke="#FFF176" stroke-width="5.5" stroke-linecap="round">
    <line x1="50" y1="4"  x2="50" y2="20"/>
    <line x1="50" y1="80" x2="50" y2="96"/>
    <line x1="4"  y1="50" x2="20" y2="50"/>
    <line x1="80" y1="50" x2="96" y2="50"/>
    <line x1="15.6" y1="15.6" x2="26.9" y2="26.9"/>
    <line x1="73.1" y1="73.1" x2="84.4" y2="84.4"/>
    <line x1="84.4" y1="15.6" x2="73.1" y2="26.9"/>
    <line x1="15.6" y1="84.4" x2="26.9" y2="73.1"/>
  </g>
  <circle cx="50" cy="50" r="22" fill="#FFF176" stroke="#FFE000" stroke-width="1.5"/>
</svg>`;
const SUN_ICON_URL = 'data:image/svg+xml,' + encodeURIComponent(SUN_ICON_SVG);

const PARTLY_SUNNY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="none" stroke="#FFF176" stroke-width="4.5" stroke-linecap="round">
    <line x1="68" y1="18" x2="68" y2="11"/>
    <line x1="79" y1="23" x2="84" y2="18"/>
    <line x1="84" y1="34" x2="91" y2="34"/>
    <line x1="57" y1="23" x2="52" y2="18"/>
  </g>
  <circle cx="68" cy="34" r="13" fill="#FFF176" stroke="#FFE000" stroke-width="1.5"/>
  <circle cx="26" cy="68" r="12" fill="#c8d8ea"/>
  <circle cx="44" cy="59" r="16" fill="#c8d8ea"/>
  <circle cx="62" cy="53" r="14" fill="#c8d8ea"/>
  <rect x="14" y="68" width="58" height="14" fill="#c8d8ea"/>
</svg>`;
const PARTLY_SUNNY_URL = 'data:image/svg+xml,' + encodeURIComponent(PARTLY_SUNNY_SVG);

const RAIN_SUNNY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="none" stroke="#FFF176" stroke-width="4.5" stroke-linecap="round">
    <line x1="68" y1="20" x2="68" y2="12"/>
    <line x1="79" y1="25" x2="85" y2="19"/>
    <line x1="84" y1="36" x2="92" y2="36"/>
    <line x1="57" y1="25" x2="51" y2="19"/>
  </g>
  <circle cx="68" cy="36" r="12" fill="#FFF176" stroke="#FFE000" stroke-width="1.5"/>
  <circle cx="26" cy="66" r="12" fill="#c8d8ea"/>
  <circle cx="44" cy="57" r="16" fill="#c8d8ea"/>
  <circle cx="62" cy="52" r="14" fill="#c8d8ea"/>
  <rect x="14" y="66" width="58" height="12" fill="#c8d8ea"/>
  <g stroke="#6ab4f5" stroke-width="2.5" stroke-linecap="round">
    <line x1="27" y1="79" x2="24" y2="90"/>
    <line x1="43" y1="79" x2="40" y2="90"/>
    <line x1="59" y1="79" x2="56" y2="90"/>
  </g>
</svg>`;
const RAIN_SUNNY_URL = 'data:image/svg+xml,' + encodeURIComponent(RAIN_SUNNY_SVG);

const ICON_URL = icon => {
    if (icon === '01d') return SUN_ICON_URL;
    if (icon === '02d') return PARTLY_SUNNY_URL;
    if (icon === '10d') return RAIN_SUNNY_URL;
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
};

const HISTORY_KEY = 'wx_history';
const MAX_HISTORY = 5;
const THEME_KEY   = 'wx_theme';
const UNIT_KEY    = 'wx_units';
const MODE_KEY    = 'wx_mode';

const AQI_LABELS = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];

const WEATHER_GRADIENTS = {
    thunderstorm: 'radial-gradient(ellipse at 20% 5%, rgba(80,20,160,0.55) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30,0,80,0.4) 0%, transparent 55%)',
    drizzle:      'radial-gradient(ellipse at 50% 0%, rgba(80,120,180,0.45) 0%, transparent 60%)',
    rain:         'radial-gradient(ellipse at 30% 0%, rgba(40,80,160,0.5) 0%, transparent 58%), radial-gradient(ellipse at 75% 95%, rgba(20,50,120,0.35) 0%, transparent 55%)',
    snow:         'radial-gradient(ellipse at 50% 0%, rgba(180,210,255,0.35) 0%, transparent 65%)',
    fog:          'radial-gradient(ellipse at 50% 30%, rgba(150,135,115,0.3) 0%, transparent 65%)',
    clear:        'radial-gradient(ellipse at 72% 8%, rgba(255,195,70,0.28) 0%, transparent 52%)',
    clouds:       'radial-gradient(ellipse at 40% 0%, rgba(90,110,140,0.3) 0%, transparent 60%)',
};

// ── Weather background ─────────────────────────────────────────────
const weatherBg = document.getElementById('weather-bg');

function applyWeatherBg(id) {
    let key;
    if      (id >= 200 && id < 300) key = 'thunderstorm';
    else if (id >= 300 && id < 400) key = 'drizzle';
    else if (id >= 500 && id < 600) key = 'rain';
    else if (id >= 600 && id < 700) key = 'snow';
    else if (id >= 700 && id < 800) key = 'fog';
    else if (id === 800)            key = 'clear';
    else                            key = 'clouds';
    weatherBg.style.background = WEATHER_GRADIENTS[key];
    weatherBg.style.opacity    = '1';
    setWeatherEffect(id);
}

// ── DOM refs ───────────────────────────────────────────────────────
const mainEl          = document.getElementById('main-content');
const cityInput       = document.getElementById('city-input');
const searchBtn       = document.getElementById('search-btn');
const geoBtn          = document.getElementById('geo-btn');
const errorMsg        = document.getElementById('error-msg');
const loader          = document.getElementById('loader');
const currentCard     = document.getElementById('current-card');
const forecastSection = document.getElementById('forecast-section');
const historyRow      = document.getElementById('history-row');
const hourlySection   = document.getElementById('hourly-section');
const hourlyStrip     = document.getElementById('hourly-strip');
const compareToggleBtn = document.getElementById('compare-toggle');
const compareRow      = document.getElementById('compare-row');
const compareInput    = document.getElementById('compare-input');
const compareBtn      = document.getElementById('compare-btn');
const compareCard     = document.getElementById('compare-card');

// current-card fields
const cityNameEl    = document.getElementById('city-name');
const weatherDesc   = document.getElementById('weather-desc');
const weatherIcon   = document.getElementById('weather-icon');
const temperature   = document.getElementById('temperature');
const feelsLikeEl   = document.getElementById('feels-like');
const humidityEl    = document.getElementById('humidity');
const windEl        = document.getElementById('wind');
const pressureEl    = document.getElementById('pressure');
const visibilityEl  = document.getElementById('visibility');
const sunriseEl     = document.getElementById('sunrise');
const sunsetEl      = document.getElementById('sunset');
const cloudCoverEl  = document.getElementById('cloud-cover');
const precipValEl   = document.getElementById('precip-val');
const precipLabelEl = document.getElementById('precip-label');
const precipStat    = document.getElementById('precip-stat');
const flTooltip     = document.getElementById('fl-tooltip');

const forecastCards = document.getElementById('forecast-cards');
const modeToggleBtn = document.getElementById('mode-toggle');
const windDirEl     = document.getElementById('wind-dir');
const moonStat      = document.getElementById('moon-stat');
const moonEmojiEl   = document.getElementById('moon-emoji');
const moonNameEl    = document.getElementById('moon-phase-name');
const refreshRow    = document.getElementById('refresh-row');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshBtn    = document.getElementById('refresh-btn');
const aqiStat       = document.getElementById('aqi-stat');
const aqiValueEl    = document.getElementById('aqi-value');
const aqiWordEl     = document.getElementById('aqi-word');
const aqiBar        = document.getElementById('aqi-bar');
const uviStat       = document.getElementById('uvi-stat');
const uviValueEl    = document.getElementById('uvi-value');
const uviWordEl     = document.getElementById('uvi-word');
const uviBar        = document.getElementById('uvi-bar');
const localTimeEl   = document.getElementById('local-time');
const tempRangeEl   = document.getElementById('temp-range');

// Compare state
let compareActive   = false;
let lastCompareCity = null;

// Hourly chart state (for theme redraws)
let lastHourlyEntries = null;
let lastHourlySym     = null;

// Local clock state
let clockTimer    = null;
let clockTimezone = null;

function startClock(tzOffsetSec) {
    clockTimezone = tzOffsetSec;
    if (clockTimer) clearInterval(clockTimer);
    const tick = () => {
        localTimeEl.textContent = 'Local: ' + formatTime(Math.floor(Date.now() / 1000), clockTimezone);
    };
    tick();
    clockTimer = setInterval(tick, 1000);
}

function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    clockTimezone = null;
    localTimeEl.textContent = '';
}

// ── Auto-refresh ────────────────────────────────────────────────────
let lastFetchedCity  = null;
let lastFetchTime    = null;
let autoRefreshTimer = null;
let updateAgeTimer   = null;
const AUTO_REFRESH_MS = 10 * 60 * 1000;

function updateLastUpdatedLabel() {
    if (!lastFetchTime) return;
    const mins = Math.round((Date.now() - lastFetchTime) / 60000);
    lastUpdatedEl.textContent = mins === 0 ? 'Updated just now' : `Updated ${mins} min ago`;
}

function startAutoRefresh(city) {
    lastFetchedCity = city;
    lastFetchTime   = Date.now();
    refreshRow.hidden = false;
    updateLastUpdatedLabel();
    clearInterval(updateAgeTimer);
    updateAgeTimer = setInterval(updateLastUpdatedLabel, 60000);
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = setTimeout(function doRefresh() {
        if (lastFetchedCity) fetchByCity(lastFetchedCity);
    }, AUTO_REFRESH_MS);
}

// ── UV Index ────────────────────────────────────────────────────────
const UVI_LEVELS = [
    { max: 2,  word: 'Low',       cls: 'uvi-low'   },
    { max: 5,  word: 'Moderate',  cls: 'uvi-mod'   },
    { max: 7,  word: 'High',      cls: 'uvi-high'  },
    { max: 10, word: 'Very High', cls: 'uvi-vhigh' },
    { max: Infinity, word: 'Extreme', cls: 'uvi-ext' },
];

function uviLevel(v) {
    return UVI_LEVELS.find(l => v <= l.max);
}

function renderUVI(value) {
    const v   = Math.round(value);
    const lvl = uviLevel(v);
    uviValueEl.textContent = v;
    uviValueEl.className   = `uvi-num ${lvl.cls}`;
    uviWordEl.textContent  = lvl.word;
    uviWordEl.className    = `uvi-word ${lvl.cls}`;
    // light up segments: Low=1, Mod=2, High=3, VHigh=4, Ext=5
    const segIndex = UVI_LEVELS.indexOf(lvl) + 1;
    uviBar.querySelectorAll('.uvi-seg').forEach(seg => {
        const i = +seg.dataset.i;
        seg.className = `uvi-seg uvi-seg-${i}${i <= segIndex ? ' active' : ''}`;
    });
    uviStat.hidden = false;
}

// ── Moon phase ──────────────────────────────────────────────────────
function getMoonPhase() {
    const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
    const synodicMs    = 29.53059 * 86400000;
    const age   = ((Date.now() - knownNewMoon) % synodicMs + synodicMs) % synodicMs;
    const phase = age / synodicMs;

    if (phase < 0.0339) return { name: 'New Moon',        emoji: '🌑' };
    if (phase < 0.25)   return { name: 'Waxing Crescent', emoji: '🌒' };
    if (phase < 0.2661) return { name: 'First Quarter',   emoji: '🌓' };
    if (phase < 0.5)    return { name: 'Waxing Gibbous',  emoji: '🌔' };
    if (phase < 0.5339) return { name: 'Full Moon',       emoji: '🌕' };
    if (phase < 0.75)   return { name: 'Waning Gibbous',  emoji: '🌖' };
    if (phase < 0.7661) return { name: 'Last Quarter',    emoji: '🌗' };
    return                     { name: 'Waning Crescent', emoji: '🌘' };
}

function renderMoonPhase() {
    const { name, emoji } = getMoonPhase();
    moonEmojiEl.textContent = emoji;
    moonNameEl.textContent  = name;
    moonStat.hidden = false;
}

// ── Helpers ────────────────────────────────────────────────────────
function getUnits() {
    return document.querySelector('input[name="units"]:checked').value;
}
function unitSymbol() {
    return getUnits() === 'metric' ? '°C' : '°F';
}
function windUnit() {
    return getUnits() === 'metric' ? 'm/s' : 'mph';
}
function windDirText(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}
function formatTime(unixSec, tzOffsetSec) {
    const d = new Date((unixSec + tzOffsetSec) * 1000);
    const h = d.getUTCHours();
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    return `${h % 12 || 12}:${m} ${ampm}`;
}
function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
}
function clearError() {
    errorMsg.textContent = '';
    errorMsg.hidden = true;
}
function setLoading(on) {
    loader.hidden = !on;
    searchBtn.disabled = on;
    geoBtn.disabled = on;
}

function fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ── Dark / Light mode ──────────────────────────────────────────────
function setMode(mode) {
    document.body.dataset.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
    if (mode === 'light') {
        modeToggleBtn.textContent = '🌙';
        modeToggleBtn.title = 'Switch to dark mode';
    } else {
        modeToggleBtn.textContent = '☀';
        modeToggleBtn.title = 'Switch to light mode';
    }
}
modeToggleBtn.addEventListener('click', () => {
    setMode(document.body.dataset.mode === 'light' ? 'dark' : 'light');
});

// ── Feels-like tooltip (click/tap for touch devices) ────────────────
document.querySelector('.fl-tip-icon').addEventListener('click', e => {
    e.stopPropagation();
    flTooltip.classList.toggle('visible');
});
document.addEventListener('click', e => {
    if (!e.target.closest('.feels-like-wrap')) flTooltip.classList.remove('visible');
});

// ── AQI ────────────────────────────────────────────────────────────
function renderAQI(aqi) {
    aqiValueEl.textContent = aqi;
    aqiValueEl.className   = `aqi-num aqi-${aqi}`;
    aqiWordEl.textContent  = AQI_LABELS[aqi] || '—';
    aqiWordEl.className    = `aqi-word aqi-${aqi}`;
    aqiBar.querySelectorAll('.aqi-seg').forEach(seg => {
        const i = +seg.dataset.i;
        seg.className = `aqi-seg aqi-seg-${i}${i <= aqi ? ' active' : ''}`;
    });
    aqiStat.hidden = false;
}

// ── Helpers ────────────────────────────────────────────────────────
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Search history ─────────────────────────────────────────────────
function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}
function saveHistory(city) {
    let hist = loadHistory().filter(c => c.toLowerCase() !== city.toLowerCase());
    hist.unshift(city);
    if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    renderHistory();
}
function renderHistory() {
    const hist = loadHistory();
    if (!hist.length) { historyRow.hidden = true; return; }
    historyRow.hidden = false;
    historyRow.innerHTML = hist.map(city =>
        `<button class="history-pill" data-city="${escapeHtml(city)}">${escapeHtml(city)}</button>`
    ).join('');
    historyRow.querySelectorAll('.history-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            cityInput.value = btn.dataset.city;
            fetchByCity(btn.dataset.city);
        });
    });
}

// ── Feels-like tooltip ─────────────────────────────────────────────
function feelsLikeExplanation(data) {
    const tempC    = getUnits() === 'metric' ? data.main.temp : (data.main.temp - 32) * 5 / 9;
    const humidity = data.main.humidity;
    const windKph  = getUnits() === 'metric' ? data.wind.speed * 3.6 : data.wind.speed * 1.609;
    if (tempC > 27 && humidity > 50) {
        return 'Heat index — high humidity reduces evaporative cooling, making it feel hotter than the actual temperature.';
    } else if (tempC < 10 && windKph > 10) {
        return 'Wind chill — moving air strips heat from exposed skin faster, making it feel colder than the actual temperature.';
    }
    return 'Apparent temperature — a combined measure of air temp, humidity, and wind speed as felt on skin.';
}

// ── Render: current ────────────────────────────────────────────────
function renderCurrent(data) {
    const sym  = unitSymbol();
    const wSym = windUnit();

    cityNameEl.textContent  = `${data.name}, ${data.sys.country}`;
    startClock(data.timezone);
    weatherDesc.textContent = data.weather[0].description;
    tempRangeEl.textContent = `H: ${Math.round(data.main.temp_max)}${sym}  ·  L: ${Math.round(data.main.temp_min)}${sym}`;
    const iconCode = data.weather[0].icon;
    weatherIcon.src         = ICON_URL(iconCode);
    weatherIcon.alt         = data.weather[0].description;
    weatherIcon.dataset.custom = (iconCode === '01d' || iconCode === '02d' || iconCode === '10d') ? 'sun' : '';
    weatherIcon.classList.remove('icon-spin', 'icon-bob');
    weatherIcon.classList.add(iconCode === '01d' ? 'icon-spin' : 'icon-bob');
    temperature.textContent = `${Math.round(data.main.temp)}${sym}`;
    feelsLikeEl.textContent = `Feels like ${Math.round(data.main.feels_like)}${sym}`;
    flTooltip.textContent   = feelsLikeExplanation(data);

    humidityEl.textContent  = `${data.main.humidity}%`;
    document.getElementById('humidity-stat').style.setProperty('--bar-pct', `${data.main.humidity}%`);

    windEl.textContent = `${Math.round(data.wind.speed)} ${wSym}`;
    const windMax = getUnits() === 'metric' ? 28 : 60;
    const windPct = Math.min(100, Math.round(data.wind.speed / windMax * 100));
    document.getElementById('wind-stat').style.setProperty('--bar-pct', `${windPct}%`);
    const windDeg = data.wind.deg ?? null;
    const compass = document.getElementById('wind-compass');
    if (windDeg !== null) {
        compass.style.transform = `rotate(${windDeg}deg)`;
        compass.title = `Wind from ${windDeg}°`;
        compass.hidden = false;
        windDirEl.textContent = windDirText(windDeg);
    } else {
        compass.hidden = true;
        windDirEl.textContent = '';
    }

    pressureEl.textContent   = `${data.main.pressure} hPa`;
    visibilityEl.textContent = data.visibility
        ? `${(data.visibility / 1000).toFixed(1)} km`
        : '—';
    const visPct = data.visibility ? Math.min(100, Math.round(data.visibility / 100)) : 0;
    document.getElementById('visibility-stat').style.setProperty('--bar-pct', `${visPct}%`);

    // Cloud cover
    const cloudPct = data.clouds ? data.clouds.all : 0;
    cloudCoverEl.textContent = `${cloudPct}%`;
    document.getElementById('cloud-stat').style.setProperty('--bar-pct', `${cloudPct}%`);

    // Rain / snow accumulation
    const rainMm = data.rain && data.rain['1h'] != null ? data.rain['1h'] : null;
    const snowMm = data.snow && data.snow['1h'] != null ? data.snow['1h'] : null;
    if (rainMm !== null) {
        precipLabelEl.textContent = 'Recent Rain';
        precipValEl.textContent   = `${rainMm.toFixed(1)} mm`;
        precipStat.hidden = false;
    } else if (snowMm !== null) {
        precipLabelEl.textContent = 'Recent Snow';
        precipValEl.textContent   = `${snowMm.toFixed(1)} mm`;
        precipStat.hidden = false;
    } else {
        precipStat.hidden = true;
    }

    const riseFmt = formatTime(data.sys.sunrise, data.timezone);
    const setFmt  = formatTime(data.sys.sunset,  data.timezone);
    sunriseEl.textContent = riseFmt;
    sunsetEl.textContent  = setFmt;
    document.getElementById('sun-rise-label').textContent = riseFmt;
    document.getElementById('sun-set-label').textContent  = setFmt;
    const nowSec = Math.floor(Date.now() / 1000);
    const sunPct = Math.max(0, Math.min(100,
        ((nowSec - data.sys.sunrise) / (data.sys.sunset - data.sys.sunrise)) * 100
    ));
    document.getElementById('sun-progress-fill').style.width = `${sunPct}%`;
    document.getElementById('sun-progress-dot').style.left   = `${sunPct}%`;

    renderMoonPhase();
    applyWeatherBg(data.weather[0].id);
    currentCard.hidden = false;
}

// ── Render: hourly ─────────────────────────────────────────────────
function renderHourly(data) {
    const sym     = unitSymbol();
    const tz      = data.city.timezone;
    const entries = data.list.slice(0, 8);

    hourlyStrip.innerHTML = entries.map(e => {
        const pop = Math.round((e.pop || 0) * 100);
        return `
        <div class="hr-cell">
            <div class="hr-time">${formatTime(e.dt, tz)}</div>
            <img class="hr-icon" src="${ICON_URL(e.weather[0].icon)}" alt="${e.weather[0].description}" />
            <div class="hr-temp">${Math.round(e.main.temp)}${sym}</div>
            <div class="hr-pop">${pop > 0 ? '💧' + pop + '%' : ''}</div>
        </div>`;
    }).join('');

    hourlySection.hidden = false;
    lastHourlyEntries = entries;
    lastHourlySym     = sym;
    requestAnimationFrame(() => renderHourlyChart(entries, sym));
}

function renderHourlyChart(entries, sym) {
    const canvas = document.getElementById('hourly-chart');
    if (!canvas) return;
    const W   = Math.max(200, hourlySection.clientWidth - 48);
    const H   = 68;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const style   = getComputedStyle(document.body);
    const cyanRgb = style.getPropertyValue('--cyan').trim() || '0,243,255';

    const temps = entries.map(e => e.main.temp);
    const minT  = Math.min(...temps);
    const maxT  = Math.max(...temps);
    const span  = maxT - minT || 1;

    const padL = 8, padR = 8, padT = 18, padB = 6;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const pts = entries.map((e, i) => ({
        x: padL + (i / (entries.length - 1)) * chartW,
        y: padT + chartH - ((e.main.temp - minT) / span) * chartH,
    }));

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, H);
    grad.addColorStop(0, `rgba(${cyanRgb},0.22)`);
    grad.addColorStop(1, `rgba(${cyanRgb},0)`);

    function drawCurve() {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i].x + pts[i + 1].x) / 2;
            const my = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }

    ctx.beginPath();
    drawCurve();
    ctx.lineTo(pts[pts.length - 1].x, H - padB);
    ctx.lineTo(pts[0].x, H - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    drawCurve();
    ctx.strokeStyle = `rgba(${cyanRgb},0.75)`;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    ctx.font      = `11px 'EB Garamond', serif`;
    ctx.textAlign = 'center';
    pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${cyanRgb})`;
        ctx.fill();
        ctx.fillStyle = `rgba(${cyanRgb},0.7)`;
        ctx.fillText(`${Math.round(entries[i].main.temp)}${sym}`, p.x, p.y - 5);
    });
}

// ── Render: 5-day forecast ─────────────────────────────────────────
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderForecast(data) {
    const sym = unitSymbol();

    const byDay = {};
    data.list.forEach(item => {
        const date = item.dt_txt.slice(0, 10);
        if (!byDay[date]) byDay[date] = [];
        byDay[date].push(item);
    });

    const cityNow = new Date(Date.now() + data.city.timezone * 1000);
    const todayStr = `${cityNow.getUTCFullYear()}-${String(cityNow.getUTCMonth()+1).padStart(2,'0')}-${String(cityNow.getUTCDate()).padStart(2,'0')}`;
    const days = Object.keys(byDay).filter(d => d !== todayStr).slice(0, 5);

    // Pre-compute per-day stats so we can find the global range for the bar
    const dayStats = days.map(date => {
        const entries = byDay[date];
        const noon    = entries.find(e => e.dt_txt.includes('12:00:00')) || entries[Math.floor(entries.length / 2)];
        const tempMax = Math.round(Math.max(...entries.map(e => e.main.temp_max)));
        const tempMin = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
        const dayName = DAY_NAMES[new Date(date + 'T12:00:00').getDay()];
        const maxPop  = Math.round(Math.max(...entries.map(e => (e.pop || 0))) * 100);
        const feelsNoon = Math.round(noon.main.feels_like);
        return { noon, tempMax, tempMin, dayName, maxPop, feelsNoon };
    });

    const globalMin  = Math.min(...dayStats.map(d => d.tempMin));
    const globalMax  = Math.max(...dayStats.map(d => d.tempMax));
    const globalSpan = globalMax - globalMin || 1;

    forecastCards.innerHTML = dayStats.map(({ noon, tempMax, tempMin, dayName, maxPop, feelsNoon }) => {
        const barLeft  = Math.round((tempMin - globalMin) / globalSpan * 100);
        const barWidth = Math.max(8, Math.round((tempMax - tempMin) / globalSpan * 100));
        return `
        <div class="fc-card">
            <div class="fc-day">${dayName}</div>
            <img class="fc-icon" src="${ICON_URL(noon.weather[0].icon)}" alt="${noon.weather[0].description}" data-custom="${noon.weather[0].icon === '01d' || noon.weather[0].icon === '02d' || noon.weather[0].icon === '10d' ? 'sun' : ''}" />
            <div class="fc-desc">${noon.weather[0].description}</div>
            <div class="fc-temp">${Math.round(noon.main.temp)}${sym}</div>
            <div class="fc-feels">Feels like ${feelsNoon}${sym}</div>
            <div class="fc-range">
                <span class="fc-range-lo">${tempMin}°</span>
                <div class="fc-range-track">
                    <div class="fc-range-fill" style="left:${barLeft}%;width:${barWidth}%"></div>
                </div>
                <span class="fc-range-hi">${tempMax}°</span>
            </div>
            <div class="fc-pop-wrap">
                <span class="fc-pop-label">💧 ${maxPop}%</span>
                <div class="fc-pop-track"><div class="fc-pop-fill" style="width:${maxPop}%"></div></div>
            </div>
        </div>`;
    }).join('');

    forecastSection.hidden = false;
    renderHourly(data);
}

// ── Render: compare card ───────────────────────────────────────────
function renderCompare(data) {
    const sym  = unitSymbol();
    const wSym = windUnit();
    const iconCode = data.weather[0].icon;
    const cloudPct = data.clouds ? data.clouds.all : null;
    const rainMm   = data.rain && data.rain['1h'] != null ? data.rain['1h'] : null;
    const snowMm   = data.snow && data.snow['1h'] != null ? data.snow['1h'] : null;

    compareCard.innerHTML = `
        <div class="compare-badge">⊞ Comparing</div>
        <div class="current-top">
            <div class="current-left">
                <div class="city-name compare-city-name">${data.name}, ${data.sys.country}</div>
                <div class="weather-desc">${data.weather[0].description}</div>
                <div class="temp-row">
                    <img class="weather-icon" src="${ICON_URL(iconCode)}" alt="${data.weather[0].description}" data-custom="${iconCode === '01d' || iconCode === '02d' || iconCode === '10d' ? 'sun' : ''}" />
                    <span class="temperature">${Math.round(data.main.temp)}${sym}</span>
                </div>
                <div class="feels-like">Feels like ${Math.round(data.main.feels_like)}${sym}</div>
            </div>
            <div class="current-right">
                <div class="stat-grid compare-stat-grid">
                    <div class="stat" style="--bar-pct: ${data.main.humidity}%">
                        <span class="stat-label">Humidity</span>
                        <span class="stat-value">${data.main.humidity}%</span>
                        <div class="stat-bar-track"><div class="stat-bar-fill"></div></div>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Wind</span>
                        <span class="stat-value">${Math.round(data.wind.speed)} ${wSym}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Pressure</span>
                        <span class="stat-value">${data.main.pressure} hPa</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Visibility</span>
                        <span class="stat-value">${data.visibility ? (data.visibility / 1000).toFixed(1) + ' km' : '—'}</span>
                    </div>
                    ${cloudPct !== null ? `
                    <div class="stat" style="--bar-pct: ${cloudPct}%">
                        <span class="stat-label">Cloud Cover</span>
                        <span class="stat-value">${cloudPct}%</span>
                        <div class="stat-bar-track"><div class="stat-bar-fill"></div></div>
                    </div>` : ''}
                    ${rainMm !== null ? `
                    <div class="stat">
                        <span class="stat-label">Recent Rain</span>
                        <span class="stat-value">${rainMm.toFixed(1)} mm</span>
                    </div>` : ''}
                    ${snowMm !== null ? `
                    <div class="stat">
                        <span class="stat-label">Recent Snow</span>
                        <span class="stat-value">${snowMm.toFixed(1)} mm</span>
                    </div>` : ''}
                    <div class="stat">
                        <span class="stat-label">Sunrise</span>
                        <span class="stat-value">${formatTime(data.sys.sunrise, data.timezone)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Sunset</span>
                        <span class="stat-value">${formatTime(data.sys.sunset, data.timezone)}</span>
                    </div>
                </div>
            </div>
        </div>`;
    compareCard.hidden = false;
    mainEl.classList.add('compare-active');
}

async function fetchCompare(city) {
    const units = getUnits();
    const q = city.replace(/\s*,\s*/, ',').trim();
    compareBtn.disabled = true;
    compareBtn.textContent = '…';
    try {
        const res = await fetchWithTimeout(`${BASE_URL}/weather?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`);
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'City not found.'); }
        const data = await res.json();
        lastCompareCity = data.name;
        renderCompare(data);
    } catch (err) {
        showError(`Compare failed: ${err.message}`);
    } finally {
        compareBtn.disabled = false;
        compareBtn.textContent = 'Compare';
    }
}

// ── API calls ──────────────────────────────────────────────────────
async function fetchByCity(city) {
    clearError();
    currentCard.hidden    = true;
    forecastSection.hidden = true;
    hourlySection.hidden  = true;
    compareCard.hidden    = true;
    mainEl.classList.remove('compare-active');
    aqiStat.hidden = true;
    uviStat.hidden = true;
    stopClock();
    setLoading(true);

    const units = getUnits();
    const q = city.replace(/\s*,\s*/, ',').trim();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetchWithTimeout(`${BASE_URL}/weather?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`),
            fetchWithTimeout(`${BASE_URL}/forecast?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`)
        ]);

        if (!currentRes.ok) {
            const err = await currentRes.json();
            throw new Error(err.message || 'City not found.');
        }
        if (!forecastRes.ok) throw new Error('Forecast data unavailable.');

        const [currentData, forecastData] = await Promise.all([
            currentRes.json(),
            forecastRes.json()
        ]);

        renderCurrent(currentData);
        renderForecast(forecastData);
        saveHistory(currentData.name);
        startAutoRefresh(currentData.name);

        if (compareActive && lastCompareCity) fetchCompare(lastCompareCity);

        const { lat, lon } = currentData.coord || {};
        if (lat == null || lon == null) throw new Error('Location coordinates missing.');
        fetchWithTimeout(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) renderAQI(d.list[0].main.aqi); })
            .catch(() => {});
        fetchWithTimeout(`${BASE_URL}/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&appid=${API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d && d.current && d.current.uvi != null) renderUVI(d.current.uvi); })
            .catch(() => {});

    } catch (err) {
        showError(`Could not fetch weather: ${err.message}`);
    } finally {
        setLoading(false);
    }
}

async function fetchByCoords(lat, lon) {
    clearError();
    currentCard.hidden    = true;
    forecastSection.hidden = true;
    hourlySection.hidden  = true;
    compareCard.hidden    = true;
    mainEl.classList.remove('compare-active');
    aqiStat.hidden = true;
    uviStat.hidden = true;
    stopClock();
    setLoading(true);

    const units = getUnits();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetchWithTimeout(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`),
            fetchWithTimeout(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`)
        ]);

        if (!currentRes.ok) throw new Error('Location lookup failed.');
        if (!forecastRes.ok) throw new Error('Forecast data unavailable.');

        const [currentData, forecastData] = await Promise.all([
            currentRes.json(),
            forecastRes.json()
        ]);

        cityInput.value = currentData.name;
        renderCurrent(currentData);
        renderForecast(forecastData);
        saveHistory(currentData.name);
        startAutoRefresh(currentData.name);

        if (compareActive && lastCompareCity) fetchCompare(lastCompareCity);

        fetchWithTimeout(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) renderAQI(d.list[0].main.aqi); })
            .catch(() => {});
        fetchWithTimeout(`${BASE_URL}/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&appid=${API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d && d.current && d.current.uvi != null) renderUVI(d.current.uvi); })
            .catch(() => {});

    } catch (err) {
        showError(`Could not fetch weather: ${err.message}`);
    } finally {
        setLoading(false);
    }
}

// ── Event listeners ────────────────────────────────────────────────
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (!city) { showError('Please enter a city name.'); return; }
    fetchByCity(city);
});

cityInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
});

geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }
    geoBtn.disabled = true;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
        pos => {
            setLoading(false);
            fetchByCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
            geoBtn.disabled = false;
            setLoading(false);
            showError('Location access denied. Please search by city name.');
        },
        { timeout: 10000 }
    );
});

document.querySelectorAll('input[name="units"]').forEach(radio => {
    radio.addEventListener('change', () => {
        localStorage.setItem(UNIT_KEY, getUnits());
        const typed = cityInput.value.trim();
        const city  = typed || cityNameEl.textContent.split(',')[0].trim();
        if (city) fetchByCity(city);
    });
});

// ── Compare ────────────────────────────────────────────────────────
compareToggleBtn.addEventListener('click', () => {
    compareActive = !compareActive;
    compareToggleBtn.classList.toggle('active', compareActive);
    compareRow.hidden = !compareActive;
    if (!compareActive) {
        compareCard.hidden = true;
        compareCard.innerHTML = '';
        lastCompareCity = null;
        mainEl.classList.remove('compare-active');
    } else {
        compareInput.focus();
    }
});

compareBtn.addEventListener('click', () => {
    const city = compareInput.value.trim();
    if (!city) return;
    fetchCompare(city);
});

compareInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') compareBtn.click();
});

refreshBtn.addEventListener('click', () => {
    if (lastFetchedCity) fetchByCity(lastFetchedCity);
});

// ── Theme ──────────────────────────────────────────────────────────
const VALID_THEMES = new Set(['cyber','ember','aurora','verdant','crimson','blush','sky','sage','lavender']);

function setTheme(name) {
    if (!VALID_THEMES.has(name)) return;
    document.body.dataset.theme = name;
    localStorage.setItem(THEME_KEY, name);
    document.querySelectorAll('.theme-dot').forEach(d =>
        d.classList.toggle('active', d.dataset.theme === name)
    );
    if (lastHourlyEntries && lastHourlySym) {
        requestAnimationFrame(() => renderHourlyChart(lastHourlyEntries, lastHourlySym));
    }
}

document.querySelectorAll('.theme-dot').forEach(dot =>
    dot.addEventListener('click', () => setTheme(dot.dataset.theme))
);

// ── Init ───────────────────────────────────────────────────────────
renderHistory();
setTheme(localStorage.getItem(THEME_KEY) || 'cyber');
setMode(localStorage.getItem(MODE_KEY) || 'dark');

const savedUnit = localStorage.getItem(UNIT_KEY);
if (savedUnit) {
    const radio = document.querySelector(`input[name="units"][value="${savedUnit}"]`);
    if (radio) radio.checked = true;
}

// ── Canvas weather effects ─────────────────────────────────────────
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');
let rainDrops      = [];
let snowFlakes     = [];
let fogParticles   = [];
let currentWeatherId = null;

// ── Lightning ──────────────────────────────────────────────────────
const lightningFlash = document.getElementById('lightning-flash');
let lightningTimer = null;

function scheduleLightning() {
    const delay = 1500 + Math.random() * 4000;
    lightningTimer = setTimeout(() => {
        if (currentWeatherId >= 200 && currentWeatherId < 300) {
            lightningFlash.classList.add('flash');
            const dur = 70 + Math.random() * 100;
            setTimeout(() => {
                lightningFlash.classList.remove('flash');
                if (Math.random() < 0.4) {
                    setTimeout(() => {
                        lightningFlash.classList.add('flash');
                        setTimeout(() => lightningFlash.classList.remove('flash'), 60);
                    }, 180);
                }
            }, dur);
            scheduleLightning();
        }
    }, delay);
}

function startLightning() {
    stopLightning();
    scheduleLightning();
}

function stopLightning() {
    clearTimeout(lightningTimer);
    lightningTimer = null;
    lightningFlash.classList.remove('flash');
}

// ── Rain ───────────────────────────────────────────────────────────
function rainCount(id) {
    if (id >= 200 && id < 300) return 200;
    if (id >= 300 && id < 400) return 80;
    return 150;
}

function initRain(id) {
    const count = rainCount(id);
    rainDrops = Array.from({ length: count }, () => ({
        x:     Math.random() * bgCanvas.width,
        y:     Math.random() * bgCanvas.height,
        len:   Math.random() * 14 + 8,
        speed: Math.random() * 5 + 9,
        op:    Math.random() * 0.2 + 0.08,
    }));
}

// ── Snow ───────────────────────────────────────────────────────────
function initSnow() {
    snowFlakes = Array.from({ length: 90 }, () => ({
        x:     Math.random() * bgCanvas.width,
        y:     Math.random() * bgCanvas.height,
        r:     Math.random() * 2.5 + 0.8,
        speed: Math.random() * 1.2 + 0.4,
        drift: (Math.random() - 0.5) * 0.6,
        op:    Math.random() * 0.45 + 0.15,
    }));
}

// ── Fog ─────────────────────────────────────────────────────────────
function initFog() {
    fogParticles = Array.from({ length: 14 }, () => ({
        x:     Math.random() * bgCanvas.width,
        y:     bgCanvas.height * 0.1 + Math.random() * bgCanvas.height * 0.75,
        w:     260 + Math.random() * 280,
        h:     70  + Math.random() * 80,
        speed: 0.10 + Math.random() * 0.22,
        op:    0.035 + Math.random() * 0.05,
    }));
}

// ── Set weather effect ─────────────────────────────────────────────
function setWeatherEffect(id) {
    currentWeatherId = id;
    stopLightning();
    rainDrops    = [];
    snowFlakes   = [];
    fogParticles = [];

    if (id >= 200 && id < 300) {
        initRain(id);
        startLightning();
        bgAnimating = false; startBgAnim();
    } else if (id >= 300 && id < 600) {
        initRain(id);
        bgAnimating = false; startBgAnim();
    } else if (id >= 600 && id < 700) {
        initSnow();
        bgAnimating = false; startBgAnim();
    } else if (id >= 700 && id < 800) {
        initFog();
        bgAnimating = false; startBgAnim();
    }
}

function resizeBg() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    if (rainDrops.length > 0 && currentWeatherId)  initRain(currentWeatherId);
    if (snowFlakes.length > 0)                      initSnow();
    if (fogParticles.length > 0)                    initFog();
}

function drawBg() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    if (rainDrops.length > 0) {
        bgCtx.lineWidth = 1;
        rainDrops.forEach(drop => {
            bgCtx.globalAlpha = drop.op;
            bgCtx.strokeStyle = 'rgba(170, 210, 255, 1)';
            bgCtx.beginPath();
            bgCtx.moveTo(drop.x, drop.y);
            bgCtx.lineTo(drop.x - drop.len * 0.18, drop.y + drop.len);
            bgCtx.stroke();
            drop.y += drop.speed;
            drop.x -= drop.speed * 0.18;
            if (drop.y > bgCanvas.height) {
                drop.y = -drop.len;
                drop.x = Math.random() * (bgCanvas.width + 100);
            }
            if (drop.x < -20) drop.x = bgCanvas.width + Math.random() * 80;
        });
        bgCtx.globalAlpha = 1;
    }

    if (snowFlakes.length > 0) {
        snowFlakes.forEach(flake => {
            bgCtx.globalAlpha = flake.op;
            bgCtx.fillStyle = 'rgba(220, 235, 255, 1)';
            bgCtx.beginPath();
            bgCtx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
            bgCtx.fill();
            flake.y += flake.speed;
            flake.x += flake.drift;
            if (flake.y > bgCanvas.height) {
                flake.y = -flake.r * 2;
                flake.x = Math.random() * bgCanvas.width;
            }
            if (flake.x > bgCanvas.width) flake.x = 0;
            if (flake.x < 0)             flake.x = bgCanvas.width;
        });
        bgCtx.globalAlpha = 1;
    }

    if (fogParticles.length > 0) {
        fogParticles.forEach(p => {
            const grad = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w / 2);
            grad.addColorStop(0, `rgba(190,205,218,${p.op})`);
            grad.addColorStop(1, 'rgba(190,205,218,0)');
            bgCtx.fillStyle = grad;
            bgCtx.beginPath();
            bgCtx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
            bgCtx.fill();
            p.x += p.speed;
            if (p.x - p.w / 2 > bgCanvas.width) {
                p.x = -p.w / 2;
                p.y = bgCanvas.height * 0.1 + Math.random() * bgCanvas.height * 0.75;
            }
        });
    }

    if (rainDrops.length > 0 || snowFlakes.length > 0 || fogParticles.length > 0) {
        requestAnimationFrame(drawBg);
    } else {
        bgAnimating = false;
    }
}

let bgAnimating = false;
function startBgAnim() {
    if (bgAnimating) return;
    bgAnimating = true;
    drawBg();
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeBg, 150);
});
resizeBg();
