/* Mood Board — assign palette colors to UI zones, preview live */

const MoodBoard = (() => {
    const ZONES = [
        { id: 'page-bg',        label: 'Page Background', type: 'bg',   defaultColor: '#1a1a24' },
        { id: 'navbar',         label: 'Navbar',          type: 'bg',   defaultColor: '#0f0f14' },
        { id: 'card-bg',        label: 'Card Background', type: 'bg',   defaultColor: '#24243a' },
        { id: 'heading',        label: 'Heading',         type: 'text', defaultColor: '#ffffff' },
        { id: 'body-text',      label: 'Body Text',       type: 'text', defaultColor: '#cccccc' },
        { id: 'primary-btn',    label: 'Primary Button',  type: 'btn',  defaultColor: '#7b5cf0' },
        { id: 'secondary-btn',  label: 'Secondary Button',type: 'btn',  defaultColor: '#374151' },
        { id: 'accent',         label: 'Accent / Link',   type: 'text', defaultColor: '#7b5cf0' }
    ];

    let assignments = {};
    let selectedZone = null;
    let availableColors = [];

    // Initialize with default colors
    ZONES.forEach(z => { assignments[z.id] = z.defaultColor; });

    function init() {
        renderMockUI();
        renderZoneList();
        renderSwatches();

        document.getElementById('mb-export-btn').addEventListener('click', exportCSS);
        document.getElementById('mb-clear-btn').addEventListener('click', () => {
            ZONES.forEach(z => { assignments[z.id] = z.defaultColor; });
            selectedZone = null;
            renderMockUI();
            renderZoneList();
            renderSwatches();
        });
    }

    function setColors(colors) {
        availableColors = colors;
        renderSwatches();
    }

    function selectZone(zoneId) {
        selectedZone = zoneId;
        // Highlight in mock UI
        document.querySelectorAll('.mock-zone').forEach(el => el.classList.remove('zone-selected'));
        const el = document.getElementById('mz-' + zoneId);
        if (el) el.classList.add('zone-selected');
        // Highlight in zone list
        document.querySelectorAll('.mb-zone-row').forEach(r => r.classList.remove('zone-row-active'));
        const row = document.querySelector(`.mb-zone-row[data-zone="${zoneId}"]`);
        if (row) row.classList.add('zone-row-active');
        renderSwatches();
    }

    function assignColor(hex) {
        if (!selectedZone) return;
        assignments[selectedZone] = hex;
        renderMockUI();
        renderZoneList();
        renderSwatches();
    }

    function autoTextColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#111111' : '#f5f5f5';
    }

    function renderMockUI() {
        const container = document.getElementById('mock-ui');
        if (!container) return;

        const pageBg    = assignments['page-bg']       || '#1a1a24';
        const navBg     = assignments['navbar']         || '#0f0f14';
        const cardBg    = assignments['card-bg']        || '#24243a';
        const headingC  = assignments['heading']        || '#ffffff';
        const bodyC     = assignments['body-text']      || '#cccccc';
        const primBg    = assignments['primary-btn']    || '#7b5cf0';
        const secBg     = assignments['secondary-btn']  || '#374151';
        const accentC   = assignments['accent']         || '#7b5cf0';

        container.innerHTML = `
            <div class="mock-zone mock-page" id="mz-page-bg" data-zone="page-bg"
                 style="background:${pageBg}" title="Page Background">
                <div class="mock-zone-hint">Page Background</div>

                <div class="mock-zone mock-navbar" id="mz-navbar" data-zone="navbar"
                     style="background:${navBg}" title="Navbar">
                    <div class="mock-zone-hint">Navbar</div>
                    <span class="mock-logo" style="color:${autoTextColor(navBg)}">● Logo</span>
                    <nav class="mock-nav" style="color:${autoTextColor(navBg)}">
                        <span>Home</span><span>About</span><span>Work</span>
                    </nav>
                </div>

                <div class="mock-content">
                    <h2 class="mock-zone mock-heading" id="mz-heading" data-zone="heading"
                        style="color:${headingC}" title="Heading">
                        <span class="mock-zone-hint small">Heading</span>
                        Page Title Goes Here
                    </h2>
                    <p class="mock-zone mock-body" id="mz-body-text" data-zone="body-text"
                       style="color:${bodyC}" title="Body Text">
                        <span class="mock-zone-hint small">Body Text</span>
                        This is a paragraph of body text. It describes the content of the page in a readable and clear way.
                    </p>
                    <div class="mock-buttons">
                        <button class="mock-zone mock-btn-primary" id="mz-primary-btn" data-zone="primary-btn"
                                style="background:${primBg};color:${autoTextColor(primBg)}" title="Primary Button">
                            <span class="mock-zone-hint small">Primary</span>
                            Get Started
                        </button>
                        <button class="mock-zone mock-btn-secondary" id="mz-secondary-btn" data-zone="secondary-btn"
                                style="background:${secBg};color:${autoTextColor(secBg)}" title="Secondary Button">
                            <span class="mock-zone-hint small">Secondary</span>
                            Learn More
                        </button>
                    </div>

                    <div class="mock-zone mock-card" id="mz-card-bg" data-zone="card-bg"
                         style="background:${cardBg}" title="Card Background">
                        <div class="mock-zone-hint">Card</div>
                        <p style="color:${autoTextColor(cardBg)};margin:0.3rem 0 0.5rem;font-size:0.8rem">
                            Card content block with a short description.
                        </p>
                        <span class="mock-zone mock-accent" id="mz-accent" data-zone="accent"
                              style="color:${accentC}" title="Accent / Link">
                            <span class="mock-zone-hint small">Accent</span>
                            Read more →
                        </span>
                    </div>
                </div>
            </div>
        `;

        // Wire zone click events
        container.querySelectorAll('.mock-zone').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                const zone = el.dataset.zone;
                if (zone) selectZone(zone);
            });
        });

        // Re-apply selected highlight
        if (selectedZone) {
            const el = document.getElementById('mz-' + selectedZone);
            if (el) el.classList.add('zone-selected');
        }
    }

    function renderZoneList() {
        const list = document.getElementById('mb-zone-list');
        if (!list) return;
        list.innerHTML = '';
        ZONES.forEach(z => {
            const hex = assignments[z.id] || z.defaultColor;
            const row = document.createElement('div');
            row.className = 'mb-zone-row' + (selectedZone === z.id ? ' zone-row-active' : '');
            row.dataset.zone = z.id;

            const dot = document.createElement('div');
            dot.className = 'mb-zone-dot';
            dot.style.backgroundColor = hex;

            const label = document.createElement('span');
            label.className = 'mb-zone-label';
            label.textContent = z.label;

            const hexEl = document.createElement('span');
            hexEl.className = 'mb-zone-hex';
            hexEl.textContent = hex;

            const typeBadge = document.createElement('span');
            typeBadge.className = 'mb-type-badge mb-type-' + z.type;
            typeBadge.textContent = z.type === 'bg' ? 'bg' : z.type === 'text' ? 'txt' : 'btn';

            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(typeBadge);
            row.appendChild(hexEl);
            row.addEventListener('click', () => selectZone(z.id));
            list.appendChild(row);
        });
    }

    function renderSwatches() {
        const container = document.getElementById('mb-swatches');
        if (!container) return;

        const selected = ZONES.find(z => z.id === selectedZone);
        const hint = document.getElementById('mb-hint');
        if (hint) {
            hint.textContent = selected
                ? `Assigning to: ${selected.label}`
                : 'Click a zone to select it, then pick a color below';
            hint.classList.toggle('has-selection', !!selected);
        }

        container.innerHTML = '';
        availableColors.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'mb-color-swatch' + (!selectedZone ? ' dimmed' : '');
            swatch.style.backgroundColor = c.hex;
            swatch.title = `${c.label}: ${c.hex}`;

            const label = document.createElement('span');
            label.className = 'mb-swatch-label';
            label.textContent = c.label;

            swatch.appendChild(label);
            swatch.addEventListener('click', () => {
                if (selectedZone) assignColor(c.hex);
            });
            container.appendChild(swatch);
        });
    }

    function exportCSS() {
        const lines = [':root {'];
        ZONES.forEach(z => {
            const hex = assignments[z.id] || z.defaultColor;
            lines.push(`  --mb-${z.id}: ${hex};`);
        });
        lines.push('}');
        const css = lines.join('\n');

        const output = document.getElementById('mb-export-output');
        if (output) {
            output.textContent = css;
            output.classList.remove('hidden');
        }

        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(css);
        }

        // Show toast
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = 'CSS variables copied!';
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('show'), 1800);
    }

    return { init, setColors };
})();
