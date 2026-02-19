/* Image Color Extractor — upload a photo, extract dominant colors via pixel bucketing */

const ImageExtractor = (() => {
    const SAMPLE_SIZE = 100;   // resize image to 100×100 for fast sampling
    const NUM_COLORS  = 6;     // how many dominant colors to show
    const BUCKET_DIV  = 32;    // bucket size per RGB channel (256/32 = 8 levels → 512 buckets)
    const MIN_DIST_SQ = 40 * 40; // min squared distance to avoid near-duplicates

    let _onColorPick = null;

    function init() {
        const dropZone  = document.getElementById('image-drop-zone');
        const fileInput = document.getElementById('image-file-input');

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', e => {
            if (e.target.files[0]) loadFile(e.target.files[0]);
        });

        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
        });
    }

    function loadFile(file) {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            // Show preview
            const preview = document.getElementById('image-preview');
            preview.src = url;
            document.getElementById('image-workspace').classList.remove('hidden');

            // Sample pixels
            const canvas = document.getElementById('image-canvas');
            const ctx    = canvas.getContext('2d');
            canvas.width  = SAMPLE_SIZE;
            canvas.height = SAMPLE_SIZE;
            ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

            const data   = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
            const colors = extractDominant(data);
            renderColors(colors);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    function extractDominant(data) {
        // Bucket pixels by quantised RGB
        const buckets = {};
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue; // skip transparent
            const r = Math.round(data[i]     / BUCKET_DIV) * BUCKET_DIV;
            const g = Math.round(data[i + 1] / BUCKET_DIV) * BUCKET_DIV;
            const b = Math.round(data[i + 2] / BUCKET_DIV) * BUCKET_DIV;
            const key = `${r},${g},${b}`;
            buckets[key] = (buckets[key] || 0) + 1;
        }

        // Sort by frequency, pick top N that are visually distinct
        const sorted = Object.entries(buckets)
            .sort((a, b) => b[1] - a[1])
            .map(([key]) => {
                const [r, g, b] = key.split(',').map(Number);
                return { r, g, b };
            });

        const result = [];
        for (const c of sorted) {
            if (result.length >= NUM_COLORS) break;
            const tooClose = result.some(ex => {
                const dr = c.r - ex.r, dg = c.g - ex.g, db = c.b - ex.b;
                return dr * dr + dg * dg + db * db < MIN_DIST_SQ;
            });
            if (!tooClose) result.push(c);
        }
        return result;
    }

    function renderColors(colors) {
        const container = document.getElementById('image-colors');
        container.innerHTML = '';

        colors.forEach(c => {
            const hex  = rgbToHex(c.r, c.g, c.b);
            const name = nearestColorName(c.r, c.g, c.b);

            const card = document.createElement('div');
            card.className = 'img-color-card';
            card.title = `${hex} — click to use in Explorer`;
            card.innerHTML = `
                <div class="img-color-swatch" style="background:${hex}"></div>
                <span class="img-color-hex">${hex}</span>
                <span class="img-color-name">${name}</span>
            `;
            card.addEventListener('click', () => {
                if (_onColorPick) _onColorPick(c);
                copyToClipboard(hex);
            });
            container.appendChild(card);
        });
    }

    function setOnColorPick(cb) {
        _onColorPick = cb;
    }

    return { init, setOnColorPick };
})();
