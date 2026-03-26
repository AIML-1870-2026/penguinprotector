const API_KEY = '83301ee6bbb55308cf3054fe3afc3ee3';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ICON_URL = icon => `https://openweathermap.org/img/wn/${icon}@2x.png`;
const HISTORY_KEY = 'wx_history';
const MAX_HISTORY = 5;

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
    weatherIcon.src         = ICON_URL(data.weather[0].icon);
    weatherIcon.alt         = data.weather[0].description;
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

    // Skip today (first key), take up to 5 following days
    const days = Object.keys(byDay).slice(1, 6);

    forecastCards.innerHTML = days.map(date => {
        const entries = byDay[date];
        // Pick noon slot if available, else middle entry
        const noon = entries.find(e => e.dt_txt.includes('12:00:00')) || entries[Math.floor(entries.length / 2)];
        const tempMax = Math.round(Math.max(...entries.map(e => e.main.temp_max)));
        const tempMin = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
        const dayName = DAY_NAMES[new Date(date + 'T12:00:00').getDay()];

        return `
        <div class="fc-card">
            <div class="fc-day">${dayName}</div>
            <img class="fc-icon" src="${ICON_URL(noon.weather[0].icon)}" alt="${noon.weather[0].description}" />
            <div class="fc-desc">${noon.weather[0].description}</div>
            <div class="fc-temp">${Math.round(noon.main.temp)}${sym}</div>
            <div class="fc-range">${tempMax}° / ${tempMin}°</div>
        </div>`;
    }).join('');

    forecastSection.hidden = false;
}

// ── API calls ──────────────────────────────────────────────────────
async function fetchByCity(city) {
    clearError();
    currentCard.hidden = true;
    forecastSection.hidden = true;
    setLoading(true);

    const units = getUnits();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${units}`),
            fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${units}`)
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
        const city = cityNameEl.textContent.split(',')[0].trim();
        if (city) fetchByCity(city);
    });
});

// ── Init ───────────────────────────────────────────────────────────
renderHistory();

// ── Canvas constellation background ───────────────────────────────
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');
let particles  = [];
const mouse    = { x: -9999, y: -9999 };

function resizeBg() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    initParticles();
}

function initParticles() {
    const count = Math.min(Math.floor((bgCanvas.width * bgCanvas.height) / 16000), 72);
    particles = Array.from({ length: count }, () => ({
        x:  Math.random() * bgCanvas.width,
        y:  Math.random() * bgCanvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r:  Math.random() * 1.2 + 0.4,
        op: Math.random() * 0.35 + 0.2,
    }));
}

function drawBg() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    const r = 0, g = 210, b = 255;
    const maxDist = 130;

    particles.forEach(p => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 200 && d > 0) {
            p.vx += (dx / d) * 0.022;
            p.vy += (dy / d) * 0.022;
        }
        p.vx *= 0.98; p.vy *= 0.98;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 1.8) { p.vx = p.vx / spd * 1.8; p.vy = p.vy / spd * 1.8; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x += bgCanvas.width;  if (p.x > bgCanvas.width)  p.x -= bgCanvas.width;
        if (p.y < 0) p.y += bgCanvas.height; if (p.y > bgCanvas.height) p.y -= bgCanvas.height;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(${r},${g},${b},${p.op})`;
        bgCtx.fill();
    });

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < maxDist) {
                bgCtx.beginPath();
                bgCtx.moveTo(particles[i].x, particles[i].y);
                bgCtx.lineTo(particles[j].x, particles[j].y);
                bgCtx.strokeStyle = `rgba(${r},${g},${b},${(1 - d / maxDist) * 0.12})`;
                bgCtx.lineWidth = 0.5;
                bgCtx.stroke();
            }
        }
    }

    requestAnimationFrame(drawBg);
}

window.addEventListener('resize', resizeBg);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('touchmove', e => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
}, { passive: true });

resizeBg();
drawBg();
