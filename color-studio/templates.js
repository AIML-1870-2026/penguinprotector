/* Color Scheme Templates — 12 hand-crafted palettes */

const ColorTemplates = (() => {
    const TEMPLATES = [
        {
            name: 'Sunset',
            description: 'Warm oranges melting into deep violet and blue',
            category: 'Warm',
            colors: ['#FF6B35', '#F7931E', '#FFCA3A', '#6A4C93', '#1982C4']
        },
        {
            name: 'Ocean',
            description: 'Deep navy to soft aqua like sunlit sea water',
            category: 'Cool',
            colors: ['#03045E', '#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8']
        },
        {
            name: 'Forest',
            description: 'Rich emerald greens and soft sage highlights',
            category: 'Natural',
            colors: ['#1B4332', '#2D6A4F', '#52B788', '#B7E4C7', '#D8F3DC']
        },
        {
            name: 'Midnight',
            description: 'Deep purples and luminous violet on black',
            category: 'Dark',
            colors: ['#10002B', '#3C096C', '#7B2FBE', '#C77DFF', '#E0AAFF']
        },
        {
            name: 'Rose Garden',
            description: 'Bold crimson accents with cool slate neutrals',
            category: 'Vibrant',
            colors: ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429']
        },
        {
            name: 'Cotton Candy',
            description: 'Soft pastel rainbow — playful and light',
            category: 'Pastel',
            colors: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF']
        },
        {
            name: 'Coffee',
            description: 'Rich espresso browns to warm cream tones',
            category: 'Neutral',
            colors: ['#3E2723', '#5D4037', '#8D6E63', '#BCAAA4', '#EFEBE9']
        },
        {
            name: 'Neon Nights',
            description: 'Electric neons on near-black for a cyberpunk vibe',
            category: 'Dark',
            colors: ['#0D0D0D', '#FF0080', '#00FFFF', '#7FFF00', '#FF4500']
        },
        {
            name: 'Arctic',
            description: 'Icy pale blues fading into deep cold navy',
            category: 'Cool',
            colors: ['#CAF0F8', '#90E0EF', '#00B4D8', '#2E4A6E', '#0A1628']
        },
        {
            name: 'Wildflower',
            description: 'Bold saturated primaries — energetic and maximalist',
            category: 'Vibrant',
            colors: ['#FFBE0B', '#FB5607', '#FF006E', '#8338EC', '#3A86FF']
        },
        {
            name: 'Sage & Stone',
            description: 'Earthy greens and warm terracotta neutrals',
            category: 'Natural',
            colors: ['#606C38', '#283618', '#FEFAE0', '#DDA15E', '#BC6C25']
        },
        {
            name: 'Candy Pop',
            description: 'Bright pastel mix — fun, retro, and sweet',
            category: 'Pastel',
            colors: ['#FF70A6', '#FF9770', '#FFD670', '#70D6FF', '#E9FF70']
        }
    ];

    const CATEGORY_COLORS = {
        'Warm':    '#FF6B35',
        'Cool':    '#00B4D8',
        'Natural': '#52B788',
        'Dark':    '#7B2FBE',
        'Vibrant': '#FF006E',
        'Pastel':  '#FFD6A5',
        'Neutral': '#8D6E63'
    };

    let onLoad = null;

    function init(loadCallback) {
        onLoad = loadCallback;
        render();
    }

    function render() {
        const grid = document.getElementById('templates-grid');
        if (!grid) return;
        grid.innerHTML = '';
        TEMPLATES.forEach(t => {
            const card = document.createElement('div');
            card.className = 'template-card';

            const header = document.createElement('div');
            header.className = 'template-card-header';

            const name = document.createElement('span');
            name.className = 'template-name';
            name.textContent = t.name;

            const badge = document.createElement('span');
            badge.className = 'template-category-badge';
            badge.textContent = t.category;
            badge.style.backgroundColor = CATEGORY_COLORS[t.category] + '33';
            badge.style.color = CATEGORY_COLORS[t.category];

            header.appendChild(name);
            header.appendChild(badge);

            const strip = document.createElement('div');
            strip.className = 'template-strip';
            t.colors.forEach(hex => {
                const swatch = document.createElement('div');
                swatch.style.backgroundColor = hex;
                swatch.title = hex;
                strip.appendChild(swatch);
            });

            const desc = document.createElement('p');
            desc.className = 'template-desc';
            desc.textContent = t.description;

            const btn = document.createElement('button');
            btn.className = 'template-load-btn';
            btn.textContent = 'Load Palette';
            btn.addEventListener('click', () => {
                if (onLoad) onLoad(t.colors);
                showToast(`Loaded "${t.name}"`);
            });

            card.appendChild(header);
            card.appendChild(strip);
            card.appendChild(desc);
            card.appendChild(btn);
            grid.appendChild(card);
        });
    }

    function showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('show'), 1800);
    }

    return { init };
})();
