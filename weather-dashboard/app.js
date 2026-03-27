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
  <g fill="none" stroke="#FFF176" stroke-width="5.5" stroke-linecap="round">
    <line x1="52" y1="3"  x2="52" y2="13"/>
    <line x1="52" y1="59" x2="52" y2="69"/>
    <line x1="16" y1="36" x2="26" y2="36"/>
    <line x1="78" y1="36" x2="88" y2="36"/>
    <line x1="26" y1="11" x2="33" y2="18"/>
    <line x1="78" y1="11" x2="71" y2="18"/>
    <line x1="26" y1="61" x2="33" y2="54"/>
    <line x1="78" y1="61" x2="71" y2="54"/>
  </g>
  <circle cx="52" cy="36" r="19" fill="#FFF176" stroke="#FFE000" stroke-width="1.5"/>
  <circle cx="30" cy="76" r="13" fill="#c8d8ea"/>
  <circle cx="49" cy="68" r="17" fill="#c8d8ea"/>
  <circle cx="67" cy="74" r="12" fill="#c8d8ea"/>
  <rect x="17" y="76" width="62" height="14" fill="#c8d8ea"/>
</svg>`;
const PARTLY_SUNNY_URL = 'data:image/svg+xml,' + encodeURIComponent(PARTLY_SUNNY_SVG);

const ICON_URL = icon => {
    if (icon.startsWith('01')) return SUN_ICON_URL;
    if (icon.startsWith('02')) return PARTLY_SUNNY_URL;
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
const cityInput      = document.getElementById('city-input');
const searchBtn      = document.getElementById('search-btn');
const geoBtn         = document.getElementById('geo-btn');
const errorMsg       = document.getElementById('error-msg');
const loader         = document.getElementById('loader');
const currentCard    = document.getElementById('current-card');
const forecastSection= document.getElementById('forecast-section');
const historyRow     = document.getElementById('history-row');

// current-card fields
const cityNameEl  = document.getElementById('city-name');
const weatherDesc = document.getElementById('weather-desc');
const weatherIcon = document.getElementById('weather-icon');
const temperature = document.getElementById('temperature');
const feelsLike   = document.getElementById('feels-like');
const humidityEl  = document.getElementById('humidity');
const windEl      = document.getElementById('wind');
const pressureEl  = document.getElementById('pressure');
const visibilityEl= document.getElementById('visibility');
const sunriseEl   = document.getElementById('sunrise');
const sunsetEl    = document.getElementById('sunset');

const forecastCards = document.getElementById('forecast-cards');
const modeToggleBtn = document.getElementById('mode-toggle');
const aqiStat       = document.getElementById('aqi-stat');
const aqiValueEl    = document.getElementById('aqi-value');
const aqiWordEl     = document.getElementById('aqi-word');
const aqiBar        = document.getElementById('aqi-bar');

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
        `<button class="history-pill" data-city="${city}">${city}</button>`
    ).join('');
    historyRow.querySelectorAll('.history-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            cityInput.value = btn.dataset.city;
            fetchByCity(btn.dataset.city);
        });
    });
}

// ── Render functions ───────────────────────────────────────────────
function renderCurrent(data) {
    const sym  = unitSymbol();
    const wSym = windUnit();

    cityNameEl.textContent  = `${data.name}, ${data.sys.country}`;
    weatherDesc.textContent = data.weather[0].description;
    const iconCode = data.weather[0].icon;
    weatherIcon.src         = ICON_URL(iconCode);
    weatherIcon.alt         = data.weather[0].description;
    weatherIcon.dataset.custom = iconCode.startsWith('01') || iconCode.startsWith('02') ? 'sun' : '';
    temperature.textContent = `${Math.round(data.main.temp)}${sym}`;
    feelsLike.textContent   = `Feels like ${Math.round(data.main.feels_like)}${sym}`;

    humidityEl.textContent  = `${data.main.humidity}%`;
    windEl.textContent      = `${Math.round(data.wind.speed)} ${wSym}`;
    pressureEl.textContent  = `${data.main.pressure} hPa`;
    visibilityEl.textContent= data.visibility
        ? `${(data.visibility / 1000).toFixed(1)} km`
        : '—';
    sunriseEl.textContent   = formatTime(data.sys.sunrise, data.timezone);
    sunsetEl.textContent    = formatTime(data.sys.sunset,  data.timezone);

    applyWeatherBg(data.weather[0].id);
    currentCard.hidden = false;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderForecast(data) {
    const sym = unitSymbol();

    // Group list by day (calendar date), pick the entry closest to noon
    const byDay = {};
    data.list.forEach(item => {
        const date = item.dt_txt.slice(0, 10);
        if (!byDay[date]) byDay[date] = [];
        byDay[date].push(item);
    });

    // Skip today, take up to 5 following days
    const todayStr = new Date().toISOString().slice(0, 10);
    const days = Object.keys(byDay).filter(d => d !== todayStr).slice(0, 5);

    forecastCards.innerHTML = days.map(date => {
        const entries = byDay[date];
        // Pick noon slot if available, else middle entry
        const noon = entries.find(e => e.dt_txt.includes('12:00:00')) || entries[Math.floor(entries.length / 2)];
        const tempMax = Math.round(Math.max(...entries.map(e => e.main.temp_max)));
        const tempMin = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
        const dayName = DAY_NAMES[new Date(date + 'T12:00:00').getDay()];

        const maxPop = Math.round(Math.max(...entries.map(e => (e.pop || 0))) * 100);

        return `
        <div class="fc-card">
            <div class="fc-day">${dayName}</div>
            <img class="fc-icon" src="${ICON_URL(noon.weather[0].icon)}" alt="${noon.weather[0].description}" data-custom="${noon.weather[0].icon.startsWith('01') || noon.weather[0].icon.startsWith('02') ? 'sun' : ''}" />
            <div class="fc-desc">${noon.weather[0].description}</div>
            <div class="fc-temp">${Math.round(noon.main.temp)}${sym}</div>
            <div class="fc-range">${tempMax}° / ${tempMin}°</div>
            <div class="fc-pop">💧 ${maxPop}%</div>
        </div>`;
    }).join('');

    forecastSection.hidden = false;
}

// ── API calls ──────────────────────────────────────────────────────
async function fetchByCity(city) {
    clearError();
    currentCard.hidden = true;
    forecastSection.hidden = true;
    aqiStat.hidden = true;
    setLoading(true);

    const units = getUnits();
    // Support "City, CC" format — normalize spacing around comma so the API matches correctly
    const q = city.replace(/\s*,\s*/, ',').trim();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`),
            fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`)
        ]);

        if (!currentRes.ok) {
            const err = await currentRes.json();
            throw new Error(err.message || 'City not found.');
        }

        const [currentData, forecastData] = await Promise.all([
            currentRes.json(),
            forecastRes.json()
        ]);

        renderCurrent(currentData);
        renderForecast(forecastData);
        saveHistory(currentData.name);

        // AQI — non-blocking, coords come from weather response
        const { lat, lon } = currentData.coord;
        fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) renderAQI(d.list[0].main.aqi); })
            .catch(() => {});

    } catch (err) {
        showError(`Could not fetch weather: ${err.message}`);
    } finally {
        setLoading(false);
    }
}

async function fetchByCoords(lat, lon) {
    clearError();
    currentCard.hidden = true;
    forecastSection.hidden = true;
    aqiStat.hidden = true;
    setLoading(true);

    const units = getUnits();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`),
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`)
        ]);

        if (!currentRes.ok) throw new Error('Location lookup failed.');

        const [currentData, forecastData] = await Promise.all([
            currentRes.json(),
            forecastRes.json()
        ]);

        cityInput.value = currentData.name;
        renderCurrent(currentData);
        renderForecast(forecastData);
        saveHistory(currentData.name);

        // AQI — non-blocking
        fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) renderAQI(d.list[0].main.aqi); })
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
    navigator.geolocation.getCurrentPosition(
        pos => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
        ()  => showError('Location access denied. Please search by city name.')
    );
});

// Re-fetch with new units when toggled (if a result is already showing)
document.querySelectorAll('input[name="units"]').forEach(radio => {
    radio.addEventListener('change', () => {
        localStorage.setItem(UNIT_KEY, getUnits());
        const typed = cityInput.value.trim();
        const city  = typed || cityNameEl.textContent.split(',')[0].trim();
        if (city) fetchByCity(city);
    });
});

// ── Theme ───────────────────────────────────────────────────────────
const VALID_THEMES = new Set(['cyber','ember','aurora','verdant','crimson','blush','sky','sage','lavender']);

function setTheme(name) {
    if (!VALID_THEMES.has(name)) return;
    document.body.dataset.theme = name;
    localStorage.setItem(THEME_KEY, name);
    document.querySelectorAll('.theme-dot').forEach(d =>
        d.classList.toggle('active', d.dataset.theme === name)
    );
}

document.querySelectorAll('.theme-dot').forEach(dot =>
    dot.addEventListener('click', () => setTheme(dot.dataset.theme))
);

// ── Init ───────────────────────────────────────────────────────────
renderHistory();

// Restore saved theme
setTheme(localStorage.getItem(THEME_KEY) || 'cyber');

// Restore saved mode
setMode(localStorage.getItem(MODE_KEY) || 'dark');

// Restore saved unit
const savedUnit = localStorage.getItem(UNIT_KEY);
if (savedUnit) {
    const radio = document.querySelector(`input[name="units"][value="${savedUnit}"]`);
    if (radio) radio.checked = true;
}

// ── Canvas rain effect ────────────────────────────────────────────
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');
let rainDrops  = [];
let currentWeatherId = null;

function isRainCondition(id) {
    return id >= 200 && id < 600;
}

function rainCount(id) {
    if (id >= 200 && id < 300) return 200; // thunderstorm — heavy
    if (id >= 300 && id < 400) return 80;  // drizzle — light
    return 150;                             // rain — moderate
}

function resizeBg() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    initRain();
}

function setWeatherEffect(id) {
    currentWeatherId = id;
    initRain();
}

function initRain() {
    if (!currentWeatherId || !isRainCondition(currentWeatherId)) {
        rainDrops = [];
        return;
    }
    const count = rainCount(currentWeatherId);
    rainDrops = Array.from({ length: count }, () => ({
        x:     Math.random() * bgCanvas.width,
        y:     Math.random() * bgCanvas.height,
        len:   Math.random() * 14 + 8,
        speed: Math.random() * 5 + 9,
        op:    Math.random() * 0.2 + 0.08,
    }));
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

    requestAnimationFrame(drawBg);
}

window.addEventListener('resize', resizeBg);

resizeBg();
drawBg();
