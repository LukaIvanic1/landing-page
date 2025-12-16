// Default target date
let targetDate = new Date('2025-12-18T20:40:00');

// Load from cookie if exists
const savedDate = getCookie("countdownTarget");
if (savedDate) {
    const parsedSaved = new Date(savedDate);
    if (!isNaN(parsedSaved)) {
        targetDate = parsedSaved;
    } else {
        console.warn('Invalid saved countdown date in cookie, clearing it:', savedDate);
        // delete cookie
        document.cookie = 'countdownTarget=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
}

// Elements
const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const progressFill = document.getElementById('progressFill');
const dateInput = document.getElementById('dateInput');
const saveBtn = document.getElementById('saveBtn');
const progressPercentEl = document.getElementById('progressPercent');

// NEW: Font select element
const fontSelect = document.getElementById('fontSelect');

// Set initial input value if targetDate is valid
if (!isNaN(targetDate)) {
    // use local representation for datetime-local (no timezone indicator)
    const tzOffset = targetDate.getTimezoneOffset() * 60000; // offset in ms
    const localISO = new Date(targetDate - tzOffset).toISOString().slice(0,16);
    dateInput.value = localISO;
} else {
    console.warn('targetDate is invalid:', targetDate);
}

// Countdown function
function updateCountdown() {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
        daysEl.textContent = hoursEl.textContent = minutesEl.textContent = secondsEl.textContent = 0;
        progressFill.style.width = '100%';
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    daysEl.textContent = days;
    hoursEl.textContent = hours;
    minutesEl.textContent = minutes;
    secondsEl.textContent = seconds;

    updateProgress(now);
}

// Progress bar from Dec 3rd midnight
function updateProgress(now) {
    const startDate = new Date('2025-12-03T00:00:00');
    const total = targetDate - startDate;
    const elapsed = now - startDate;
    // Handle edge cases where dates could make `total` zero/negative
    // or `now` is before the `startDate`.
    let percent = 0;
    if (total > 0) {
        if (elapsed <= 0) {
            percent = 0;
        } else {
            percent = (elapsed / total) * 100;
            if (!isFinite(percent) || isNaN(percent)) percent = 0;
            percent = Math.min(Math.max(percent, 0), 100);
        }
    } else {
        // If total is zero or negative, fall back to a sensible value:
        // - if the target is already at-or-before the start, consider progress complete
        // - otherwise, show 0% to avoid the bar stuck at full
        percent = (targetDate <= startDate) ? 100 : 0;
    }

    progressFill.style.width = percent + '%';
    if (progressPercentEl) progressPercentEl.textContent = formatPercent(percent) + '%';

    console.debug('Progress debug:', {
        startDate: startDate.toISOString(),
        targetDate: isNaN(targetDate) ? targetDate : targetDate.toISOString(),
        total,
        elapsed,
        percent
    });
}

function formatPercent(value) {
  const v = Number(value);
  return Number.isFinite(v) ? v.toFixed(5) : "0.00000";
}

// Cookie helpers
function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days*24*60*60*1000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
}

// Save new date
saveBtn.addEventListener('click', () => {
    const newDate = new Date(dateInput.value);
    if (!isNaN(newDate)) {
        targetDate = newDate;
        setCookie('countdownTarget', targetDate.toISOString(), 365);
        updateCountdown();
    }
});

// Font discovery & loading --------------------------------------------------
async function discoverFonts() {
    const base = '/fonts/';
    let files = [];

    // 1) Try manifest.json (array of filenames)
    try {
        const res = await fetch(base + 'manifest.json', {cache: 'no-store'});
        if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
                files = list.map(f => (f.startsWith('/') ? f : base + f));
            }
        }
    } catch (e) {
        // manifest not found or invalid, continue to fallback
    }

    // 2) Fallback: try fetching directory listing HTML and parse anchor hrefs
    if (files.length === 0) {
        try {
            const res = await fetch(base, {cache: 'no-store'});
            if (res.ok) {
                const text = await res.text();
                const doc = new DOMParser().parseFromString(text, 'text/html');
                const anchors = Array.from(doc.querySelectorAll('a'));
                const exts = ['.woff2', '.woff', '.ttf', '.otf'];
                const links = anchors.map(a => a.getAttribute('href')).filter(Boolean);
                files = links
                    .filter(l => exts.some(ext => l.toLowerCase().endsWith(ext)))
                    .map(l => (l.startsWith('http') || l.startsWith('/')) ? l : base + l);
            }
        } catch (e) {
            // directory listing not available -> nothing to do
        }
    }

    // Deduplicate and map to { url, filename, fontName }
    const seen = new Set();
    const fonts = files
        .map(u => {
            // normalize url
            const url = u;
            const filename = url.split('/').pop().split('?')[0];
            const name = filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/ig, '_');
            return { url, filename, fontName: name };
        })
        .filter(f => {
            if (seen.has(f.url)) return false;
            seen.add(f.url);
            return true;
        });

    return fonts;
}

function guessFormat(url) {
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    if (ext === 'woff2') return 'woff2';
    if (ext === 'woff') return 'woff';
    if (ext === 'ttf') return 'truetype';
    if (ext === 'otf') return 'opentype';
    return '';
}

async function loadFontFace(font) {
    // font: { url, fontName }
    try {
        const format = guessFormat(font.url);
        const rule = `@font-face {
  font-family: "${font.fontName}";
  src: url("${font.url}") format("${format}");
  font-display: swap;
}`;
        const style = document.createElement('style');
        style.setAttribute('data-font-src', font.url);
        style.textContent = rule;
        document.head.appendChild(style);

        // Wait for font to be available
        try {
            await document.fonts.load(`1em "${font.fontName}"`);
            return true;
        } catch (e) {
            // still proceed; some fonts might not resolve via document.fonts
            return true;
        }
    } catch (e) {
        console.error('Failed to load font', font, e);
        return false;
    }
}

function applyFont(fontName) {
    const ff = `"${fontName}", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    // set CSS variable and body style to ensure immediate effect
    document.documentElement.style.setProperty('--app-font', ff);
    document.body.style.fontFamily = ff;
}

// Populate dropdown and wire events
async function initFontSelector() {
    fontSelect.innerHTML = '<option>Searching for fonts...</option>';
    const fonts = await discoverFonts();

    fontSelect.innerHTML = '';
    if (!fonts.length) {
        const opt = document.createElement('option');
        opt.textContent = 'No fonts found in /fonts/';
        opt.disabled = true;
        fontSelect.appendChild(opt);
        return;
    }

    // Populate options
    fonts.forEach(f => {
        const o = document.createElement('option');
        o.value = f.fontName;
        o.dataset.url = f.url;
        o.textContent = `${f.fontName} — ${f.filename}`;
        fontSelect.appendChild(o);
    });

    // Restore saved font if exists
    const savedFont = getCookie('countdownFont');
    if (savedFont) {
        const match = Array.from(fontSelect.options).find(o => o.value === savedFont);
        if (match) {
            fontSelect.value = savedFont;
            // ensure font is loaded then applied
            await loadFontFace({ url: match.dataset.url, fontName: match.value });
            applyFont(match.value);
        }
    }

    // Wire change handler
    fontSelect.addEventListener('change', async (e) => {
        const sel = e.target.selectedOptions[0];
        if (!sel) return;
        const url = sel.dataset.url;
        const name = sel.value;
        if (url && name) {
            await loadFontFace({ url, fontName: name });
            applyFont(name);
            // persist selection for 365 days
            setCookie('countdownFont', name, 365);
        }
    });
}

// Initialize font selector (best-effort)
initFontSelector().catch(err => console.error('Font selector init error:', err));

// Run countdown every second
setInterval(updateCountdown, 1000);
updateCountdown();

