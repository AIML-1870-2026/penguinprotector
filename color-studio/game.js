/* Color Match Game — guess the target RGB color with sliders */

const ColorGame = (() => {
    let target = { r: 0, g: 0, b: 0 };
    let attempts = 0;

    function init() {
        document.getElementById('game-new-btn').addEventListener('click', newChallenge);
        document.getElementById('game-check-btn').addEventListener('click', checkMatch);

        ['r', 'g', 'b'].forEach(ch => {
            const slider = document.getElementById(`game-slider-${ch}`);
            const valEl  = document.getElementById(`game-val-${ch}`);
            slider.addEventListener('input', () => {
                valEl.textContent = slider.value;
                updateSliderFill(ch, parseInt(slider.value));
                updateGuessSwatch();
            });
        });

        newChallenge();
    }

    function newChallenge() {
        target = {
            r: Math.floor(Math.random() * 256),
            g: Math.floor(Math.random() * 256),
            b: Math.floor(Math.random() * 256)
        };
        document.getElementById('game-target-swatch').style.backgroundColor =
            `rgb(${target.r}, ${target.g}, ${target.b})`;

        ['r', 'g', 'b'].forEach(ch => {
            const slider = document.getElementById(`game-slider-${ch}`);
            slider.value = 128;
            document.getElementById(`game-val-${ch}`).textContent = '128';
            updateSliderFill(ch, 128);
        });

        updateGuessSwatch();
        document.getElementById('game-score').innerHTML = '';
        document.getElementById('game-reveal').innerHTML = '';
        attempts = 0;
    }

    function updateGuessSwatch() {
        const r = parseInt(document.getElementById('game-slider-r').value);
        const g = parseInt(document.getElementById('game-slider-g').value);
        const b = parseInt(document.getElementById('game-slider-b').value);
        document.getElementById('game-guess-swatch').style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }

    function updateSliderFill(ch, val) {
        const slider = document.getElementById(`game-slider-${ch}`);
        const pct = (val / 255) * 100;
        const colorMap = {
            r: `rgb(${val},0,0)`,
            g: `rgb(0,${val},0)`,
            b: `rgb(0,0,${val})`
        };
        slider.style.background =
            `linear-gradient(to right, ${colorMap[ch]} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
    }

    function checkMatch() {
        const r = parseInt(document.getElementById('game-slider-r').value);
        const g = parseInt(document.getElementById('game-slider-g').value);
        const b = parseInt(document.getElementById('game-slider-b').value);

        const dist = Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2);
        const maxDist = Math.sqrt(3 * 255 * 255);
        const score = Math.round((1 - dist / maxDist) * 100);
        attempts++;

        let message, emoji;
        if      (score >= 97) { message = 'Perfect match!';   emoji = '🎉'; }
        else if (score >= 88) { message = 'Incredible!';       emoji = '✨'; }
        else if (score >= 75) { message = 'So close!';         emoji = '🌟'; }
        else if (score >= 55) { message = 'Getting warmer...'; emoji = '🔥'; }
        else                  { message = 'Keep mixing!';      emoji = '🎨'; }

        document.getElementById('game-score').innerHTML = `
            <span class="game-score-number">${score}%</span>
            <span class="game-score-label">${emoji} ${message}</span>
            <span class="game-score-attempts">Attempt ${attempts}</span>
        `;

        document.getElementById('game-reveal').textContent =
            `Target: rgb(${target.r}, ${target.g}, ${target.b})  ·  You: rgb(${r}, ${g}, ${b})`;

        if (score >= 97) {
            const rect = document.getElementById('game-guess-swatch').getBoundingClientRect();
            spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
    }

    return { init };
})();
