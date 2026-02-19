/* Color utility functions — HSL/RGB conversion, color naming, WCAG contrast */

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

/* Relative luminance (WCAG 2.x) */
function relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1, rgb2) {
    const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/* Color blindness simulation matrices (Brettel/Vienot) */
const CVD_MATRICES = {
    protanopia: [
        0.56667, 0.43333, 0.00000,
        0.55833, 0.44167, 0.00000,
        0.00000, 0.24167, 0.75833
    ],
    deuteranopia: [
        0.62500, 0.37500, 0.00000,
        0.70000, 0.30000, 0.00000,
        0.00000, 0.30000, 0.70000
    ],
    tritanopia: [
        0.95000, 0.05000, 0.00000,
        0.00000, 0.43333, 0.56667,
        0.00000, 0.47500, 0.52500
    ]
};

function simulateCVD(r, g, b, type) {
    const m = CVD_MATRICES[type];
    return {
        r: Math.round(Math.min(255, Math.max(0, m[0]*r + m[1]*g + m[2]*b))),
        g: Math.round(Math.min(255, Math.max(0, m[3]*r + m[4]*g + m[5]*b))),
        b: Math.round(Math.min(255, Math.max(0, m[6]*r + m[7]*g + m[8]*b)))
    };
}

/* Color naming — nearest-neighbor on a curated list */
const COLOR_NAMES = [
    { name: 'Black', r: 0, g: 0, b: 0 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Lime', r: 0, g: 255, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Cyan', r: 0, g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0, b: 255 },
    { name: 'Silver', r: 192, g: 192, b: 192 },
    { name: 'Gray', r: 128, g: 128, b: 128 },
    { name: 'Maroon', r: 128, g: 0, b: 0 },
    { name: 'Olive', r: 128, g: 128, b: 0 },
    { name: 'Green', r: 0, g: 128, b: 0 },
    { name: 'Purple', r: 128, g: 0, b: 128 },
    { name: 'Teal', r: 0, g: 128, b: 128 },
    { name: 'Navy', r: 0, g: 0, b: 128 },
    { name: 'Orange', r: 255, g: 165, b: 0 },
    { name: 'Coral', r: 255, g: 127, b: 80 },
    { name: 'Salmon', r: 250, g: 128, b: 114 },
    { name: 'Tomato', r: 255, g: 99, b: 71 },
    { name: 'Crimson', r: 220, g: 20, b: 60 },
    { name: 'Hot Pink', r: 255, g: 105, b: 180 },
    { name: 'Deep Pink', r: 255, g: 20, b: 147 },
    { name: 'Pink', r: 255, g: 192, b: 203 },
    { name: 'Orchid', r: 218, g: 112, b: 214 },
    { name: 'Plum', r: 221, g: 160, b: 221 },
    { name: 'Violet', r: 238, g: 130, b: 238 },
    { name: 'Indigo', r: 75, g: 0, b: 130 },
    { name: 'Slate Blue', r: 106, g: 90, b: 205 },
    { name: 'Royal Blue', r: 65, g: 105, b: 225 },
    { name: 'Dodger Blue', r: 30, g: 144, b: 255 },
    { name: 'Sky Blue', r: 135, g: 206, b: 235 },
    { name: 'Steel Blue', r: 70, g: 130, b: 180 },
    { name: 'Turquoise', r: 64, g: 224, b: 208 },
    { name: 'Aquamarine', r: 127, g: 255, b: 212 },
    { name: 'Spring Green', r: 0, g: 255, b: 127 },
    { name: 'Sea Green', r: 46, g: 139, b: 87 },
    { name: 'Forest Green', r: 34, g: 139, b: 34 },
    { name: 'Chartreuse', r: 127, g: 255, b: 0 },
    { name: 'Lawn Green', r: 124, g: 252, b: 0 },
    { name: 'Gold', r: 255, g: 215, b: 0 },
    { name: 'Goldenrod', r: 218, g: 165, b: 32 },
    { name: 'Khaki', r: 240, g: 230, b: 140 },
    { name: 'Peru', r: 205, g: 133, b: 63 },
    { name: 'Chocolate', r: 210, g: 105, b: 30 },
    { name: 'Sienna', r: 160, g: 82, b: 45 },
    { name: 'Brown', r: 139, g: 69, b: 19 },
    { name: 'Tan', r: 210, g: 180, b: 140 },
    { name: 'Wheat', r: 245, g: 222, b: 179 },
    { name: 'Beige', r: 245, g: 245, b: 220 },
    { name: 'Ivory', r: 255, g: 255, b: 240 },
    { name: 'Lavender', r: 230, g: 230, b: 250 },
    { name: 'Misty Rose', r: 255, g: 228, b: 225 },
    { name: 'Lemon', r: 255, g: 247, b: 0 },
    { name: 'Peach', r: 255, g: 218, b: 185 },
    { name: 'Mint', r: 189, g: 252, b: 201 },
    { name: 'Rose', r: 255, g: 0, b: 127 },
    { name: 'Rust', r: 183, g: 65, b: 14 },
    { name: 'Burgundy', r: 128, g: 0, b: 32 },
    { name: 'Mauve', r: 224, g: 176, b: 255 },
    { name: 'Lilac', r: 200, g: 162, b: 200 },
    { name: 'Cobalt', r: 0, g: 71, b: 171 },
    { name: 'Azure', r: 0, g: 127, b: 255 },
    { name: 'Cerulean', r: 0, g: 123, b: 167 },
    { name: 'Sapphire', r: 15, g: 82, b: 186 },
    { name: 'Emerald', r: 80, g: 200, b: 120 },
    { name: 'Jade', r: 0, g: 168, b: 107 },
    { name: 'Amber', r: 255, g: 191, b: 0 },
    { name: 'Copper', r: 184, g: 115, b: 51 },
    { name: 'Bronze', r: 205, g: 127, b: 50 },
    { name: 'Charcoal', r: 54, g: 69, b: 79 },
    { name: 'Ash', r: 178, g: 190, b: 181 },
    { name: 'Slate', r: 112, g: 128, b: 144 },
    { name: 'Midnight', r: 25, g: 25, b: 112 },
    { name: 'Wine', r: 114, g: 47, b: 55 },
    { name: 'Scarlet', r: 255, g: 36, b: 0 },
    { name: 'Tangerine', r: 255, g: 159, b: 0 },
    { name: 'Apricot', r: 251, g: 206, b: 177 },
    { name: 'Sand', r: 194, g: 178, b: 128 }
];

function nearestColorName(r, g, b) {
    let minDist = Infinity;
    let name = 'Unknown';
    for (const c of COLOR_NAMES) {
        const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
        if (d < minDist) {
            minDist = d;
            name = c.name;
        }
    }
    return name;
}

function rgbToCmyk(r, g, b) {
    if (r === 0 && g === 0 && b === 0) return { c: 0, m: 0, y: 0, k: 100 };
    const rp = r / 255, gp = g / 255, bp = b / 255;
    const k = 1 - Math.max(rp, gp, bp);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
        c: Math.round(((1 - rp - k) / (1 - k)) * 100),
        m: Math.round(((1 - gp - k) / (1 - k)) * 100),
        y: Math.round(((1 - bp - k) / (1 - k)) * 100),
        k: Math.round(k * 100)
    };
}

/* Harmony generation */
function generateHarmony(h, s, l, type) {
    const wrap = deg => ((deg % 360) + 360) % 360;
    const colors = [{ h, s, l }];

    switch (type) {
        case 'complementary':
            colors.push({ h: wrap(h + 180), s, l });
            break;
        case 'analogous':
            colors.push({ h: wrap(h + 30), s, l });
            colors.push({ h: wrap(h - 30), s, l });
            colors.push({ h: wrap(h + 60), s, l });
            colors.push({ h: wrap(h - 60), s, l });
            break;
        case 'triadic':
            colors.push({ h: wrap(h + 120), s, l });
            colors.push({ h: wrap(h + 240), s, l });
            break;
        case 'split-complementary':
            colors.push({ h: wrap(h + 150), s, l });
            colors.push({ h: wrap(h + 210), s, l });
            break;
    }
    return colors;
}
