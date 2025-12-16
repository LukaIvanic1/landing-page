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

// Font select element (exists in HTML)
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

// Countdown / progress functions (unchanged) --------------------------------
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

function updateProgress(now) {
    const startDate = new Date('2025-12-03T00:00:00');
    const total = targetDate - startDate;
    const elapsed = now - startDate;
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
        percent = (targetDate <= startDate) ? 100 : 0;
    }

    progressFill.style.width = percent + '%';
    if (progressPercentEl) progressPercentEl.textContent = formatPercent(percent) + '%';
}

function formatPercent(value) {
  const v = Number(value);
  return Number.isFinite(v) ? v.toFixed(5) : "0.00000";
}

// Cookie helpers (unchanged)
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

// Fonts: discover /fonts/ entries and populate dropdown ----------------------
const FONT_DIR = '/fonts/';
const FONT_EXTS = ['.woff2', '.woff', '.ttf', '.otf'];

function sanitizeName(filename) {
    return filename.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/[^a-z0-9 ]+/ig, '').trim();
}

function guessFormat(url) {
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    if (ext === 'woff2') return 'woff2';
    if (ext === 'woff') return 'woff';
    if (ext === 'ttf') return 'truetype';
    if (ext === 'otf') return 'opentype';
    return 'truetype';
}

async function injectFontFace(url, family) {
    const format = guessFormat(url);
    const rule = `@font-face {
  font-family: "${family}";
  src: url("${url}") format("${format}");
  font-display: swap;
}`;
    const style = document.createElement('style');
    style.setAttribute('data-font-src', url);
    style.textContent = rule;
    document.head.appendChild(style);
    try {
        await document.fonts.load(`1em "${family}"`);
    } catch (e) {
        // ignore load errors; still attempt to apply
    }
}

async function discoverFontsInDir() {
    // Try to fetch the /fonts/ directory HTML and parse anchors (works on many static servers)
    try {
        const res = await fetch(FONT_DIR, {cache: 'no-store'});
        if (!res.ok) return [];
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a'));
        const links = anchors.map(a => a.getAttribute('href')).filter(Boolean);
        const files = links
            .filter(l => FONT_EXTS.some(ext => l.toLowerCase().endsWith(ext)))
            .map(l => (l.startsWith('http') || l.startsWith('/')) ? l : (FONT_DIR + l));
        // dedupe
        return Array.from(new Map(files.map(f => [f, f])).values());
    } catch (e) {
        return [];
    }
}

async function initFontDropdown() {
    if (!fontSelect) return;

    // start with System Default option
    fontSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'System Default';
    fontSelect.appendChild(defaultOpt);

    // Attempt to discover fonts in /fonts/
    const files = await discoverFontsInDir();

    // If discovery failed or yielded nothing, as a fallback we still try to offer VCR_OSD_MONO if present
    const fallbackCandidates = ['VCR_OSD_MONO.ttf', 'VCR_OSD_MONO.woff2', 'VCR_OSD_MONO.woff'];
    const candidates = files.length ? files : fallbackCandidates.map(n => FONT_DIR + n);

    const added = new Set();
    candidates.forEach(url => {
        try {
            const filename = url.split('/').pop().split('?')[0];
            if (!FONT_EXTS.some(ext => filename.toLowerCase().endsWith(ext))) return;
            if (added.has(filename)) return;
            added.add(filename);
            const name = sanitizeName(filename);
            const opt = document.createElement('option');
            opt.value = name;
            opt.dataset.url = url;
            opt.textContent = `${name} — ${filename}`;
            fontSelect.appendChild(opt);
        } catch (e) {
            // ignore malformed entries
        }
    });

    // Restore saved font
    const saved = getCookie('countdownFont');
    if (saved === '' || saved === null) {
        // system default or nothing — select default
        fontSelect.value = '';
        // ensure default font variable is set to fallback
        document.documentElement.style.setProperty('--app-font', "'Helvetica Neue', sans-serif");
        document.body.style.fontFamily = '';
    } else {
        // find matching option
        const matchOpt = Array.from(fontSelect.options).find(o => o.value === saved);
        if (matchOpt) {
            fontSelect.value = saved;
            const url = matchOpt.dataset.url;
            if (url) {
                await injectFontFace(url, saved);
                const ff = `"${saved}", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
                document.documentElement.style.setProperty('--app-font', ff);
                document.body.style.fontFamily = ff;
            }
        } else {
            // saved font not in options -> select system default
            fontSelect.value = '';
        }
    }

    // change handler
    fontSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (!val) {
            // system default
            setCookie('countdownFont', '', 365);
            document.documentElement.style.setProperty('--app-font', "'Helvetica Neue', sans-serif");
            document.body.style.fontFamily = '';
            return;
        }
        const sel = e.target.selectedOptions[0];
        const url = sel && sel.dataset ? sel.dataset.url : null;
        if (!url) {
            // no URL available for this option
            return;
        }
        await injectFontFace(url, val);
        const ff = `"${val}", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        document.documentElement.style.setProperty('--app-font', ff);
        document.body.style.fontFamily = ff;
        setCookie('countdownFont', val, 365);
    });
}

// Initialize font dropdown (best-effort)
initFontDropdown().catch(err => console.error('Font dropdown init error:', err));

// Run countdown
setInterval(updateCountdown, 1000);
updateCountdown();

