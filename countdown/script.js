// Default target date
let targetDate = new Date('2025-12-18T20:40:00');

// Load from cookie if exists
const savedDate = getCookie("countdownTarget");
if (savedDate) {
    targetDate = new Date(savedDate);
}

// Elements
const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const progressFill = document.getElementById('progressFill');
const dateInput = document.getElementById('dateInput');
const saveBtn = document.getElementById('saveBtn');

// Set initial input value
dateInput.value = targetDate.toISOString().slice(0,16);

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

// Run countdown every second
setInterval(updateCountdown, 1000);
updateCountdown();

