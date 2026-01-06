// 1. Inject Footer on every page
document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
        <div class="newsletter">
            <h3 data-key="news_title">Join the Inner Circle</h3>
            <p data-key="news_text">Be the first to know about secret venues.</p>
            <form class="newsletter-form">
                <input type="email" placeholder="Email...">
                <button type="submit" data-key="btn_signup">Sign Up</button>
            </form>
        </div>
        
        <div class="social-icons">
            <a href="https://www.facebook.com/YOUR_PAGE" target="_blank"><i class="fab fa-facebook-f"></i></a>
            <a href="https://www.instagram.com/YOUR_PAGE" target="_blank"><i class="fab fa-instagram"></i></a>
            <a href="https://www.youtube.com/YOUR_CHANNEL" target="_blank"><i class="fab fa-youtube"></i></a>
        </div>

        <div class="copyright">
            &copy; 2026 Koncertna udruga Gramophone. Buje, Istria.
        </div>
    `;

    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = footerHTML;
    } else {
        // If it's the home page (which has a footer tag already), we append inside
        const existingFooter = document.querySelector("footer");
        if(existingFooter && !existingFooter.innerHTML.includes("social-icons")) {
             // Logic for home page if needed, but home page structure is slightly different
             // For simplicity, let's keep home page footer in index.html, 
             // but add the social links there manually or via this script.
             
             // Let's rely on the pages having id="footer-placeholder"
        }
    }
    
    // Load Language
    const savedLang = localStorage.getItem('preferredLang') || 'hr';
    setLanguage(savedLang);

    // Mobile hamburger toggle
    const hamb = document.querySelector('.hamburger');
    const navEl = document.querySelector('nav');
    if(hamb && navEl) {
        hamb.addEventListener('click', function() {
            const isOpen = navEl.classList.toggle('open');
            hamb.setAttribute('aria-expanded', String(!!isOpen));
        });
        // Close menu when a navigation link is clicked
        document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', function(){
            navEl.classList.remove('open');
            hamb.setAttribute('aria-expanded','false');
        }));
    }
});

// 2. Language Logic
function setLanguage(lang) {
    // Update Text
    const elements = document.querySelectorAll('[data-key]');
    elements.forEach(element => {
        const key = element.getAttribute('data-key');
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    // Update Buttons
    const buttons = document.querySelectorAll('.lang-switch span');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.getElementById('btn-' + lang);
    if(activeBtn) activeBtn.classList.add('active');

    localStorage.setItem('preferredLang', lang);
}

// ===== Events manager (CRUD) =====
document.addEventListener('DOMContentLoaded', function() {
    initEventsManager();
});

function initEventsManager() {
    const addBtn = document.getElementById('btn-add-concert');
    const eventsList = document.getElementById('events-list');
    if(!eventsList) return;

    // Admin UI elements
    const btnAdmin = document.getElementById('btn-admin');
    const btnLogout = document.getElementById('btn-logout');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginClose = document.getElementById('login-close');
    const loginCancel = document.getElementById('login-cancel');
    const loginMessage = document.getElementById('login-message');

    // Modal elements
    const infoModal = document.getElementById('info-modal');
    const infoBody = document.getElementById('info-body');
    const infoClose = document.getElementById('info-close');
    const formModal = document.getElementById('form-modal');
    const formClose = document.getElementById('form-close');
    const formCancel = document.getElementById('form-cancel');
    const concertForm = document.getElementById('concert-form');

    // Utilities: hashing and simple session (client-side only)
    async function hashPassword(pw) {
        const enc = new TextEncoder();
        const data = enc.encode(pw);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

    function setAdminHash(hash) { localStorage.setItem('adminHash', hash); }
    function getAdminHash() { return localStorage.getItem('adminHash'); }

    function setAdminSession() {
        const expiry = Date.now() + 1000 * 60 * 60 * 24; // 24h
        localStorage.setItem('adminSessionExpiry', String(expiry));
    }
    function clearAdminSession() { localStorage.removeItem('adminSessionExpiry'); }
    function isAdmin() {
        const exp = Number(localStorage.getItem('adminSessionExpiry') || '0');
        return exp && exp > Date.now();
    }

    async function handleLogin(password) {
        const h = await hashPassword(password);
        const stored = getAdminHash();
        if(!stored) {
            // first-time setup: save
            setAdminHash(h);
            setAdminSession();
            return { ok:true, created:true };
        }
        if(h === stored) { setAdminSession(); return { ok:true }; }
        return { ok:false };
    }

    function updateAdminUI() {
        const show = isAdmin();
        document.querySelectorAll('.admin-only').forEach(el => {
            if(show) el.classList.add('show'); else el.classList.remove('show');
        });
        if(btnLogout) btnLogout.style.display = show ? '' : 'none';
        if(btnAdmin) btnAdmin.style.display = show ? 'none' : '';
        if(addBtn) addBtn.style.display = show ? '' : 'none';
    }

    // Wire admin controls
    btnAdmin && btnAdmin.addEventListener('click', () => {
        loginMessage.textContent = getAdminHash() ? 'Enter admin password.' : 'Create admin password (first-time setup).';
        showModal(loginModal);
    });
    btnLogout && btnLogout.addEventListener('click', () => { clearAdminSession(); updateAdminUI(); renderConcerts(); });
    loginClose && loginClose.addEventListener('click', () => hideModal(loginModal));
    loginCancel && loginCancel.addEventListener('click', () => hideModal(loginModal));
    loginForm && loginForm.addEventListener('submit', async function(e){
        e.preventDefault();
        const pw = new FormData(loginForm).get('password');
        const res = await handleLogin(pw);
        if(res.ok) {
            hideModal(loginModal);
            updateAdminUI();
            renderConcerts();
            return;
        }
        alert('Invalid password');
    });

    // Standard modal wiring
    addBtn && addBtn.addEventListener('click', () => openFormModal());
    infoClose && infoClose.addEventListener('click', () => hideModal(infoModal));
    formClose && formClose.addEventListener('click', () => hideModal(formModal));
    formCancel && formCancel.addEventListener('click', () => hideModal(formModal));

    concertForm && concertForm.addEventListener('submit', function(e){
        e.preventDefault();
        const fd = new FormData(concertForm);
        const data = {
            id: concertForm.dataset.editId || Date.now().toString(),
            day: fd.get('day'),
            month: fd.get('month'),
            time: fd.get('time'),
            title: fd.get('title'),
            location: fd.get('location'),
            description: fd.get('description')
        };
        saveConcert(data);
        hideModal(formModal);
        renderConcerts();
    });

    // Render initially
    updateAdminUI();
    renderConcerts();

    function getConcerts() {
        const raw = localStorage.getItem('concerts');
        if(!raw) {
            const lang = localStorage.getItem('preferredLang') || 'hr';
            const sample = [{
                id: 'sample-1', day: '14', month: 'FEB', time: '20:00',
                title: (translations && translations[lang] && translations[lang].event_1_title) || 'Baroque Nights',
                location: (translations && translations[lang] && translations[lang].event_1_loc) || 'St. Servulus Church | 20:00',
                description: ''
            }];
            localStorage.setItem('concerts', JSON.stringify(sample));
            return sample;
        }
        try { return JSON.parse(raw); } catch(e){ return []; }
    }

    function saveConcert(concert) {
        const list = getConcerts().filter(c => c.id !== concert.id);
        list.push(concert);
        localStorage.setItem('concerts', JSON.stringify(list));
    }

    function deleteConcert(id) {
        const list = getConcerts().filter(c => c.id !== id);
        localStorage.setItem('concerts', JSON.stringify(list));
        renderConcerts();
    }

    function renderConcerts() {
        const list = getConcerts();
        eventsList.innerHTML = '';
        list.sort((a,b) => a.id.localeCompare(b.id));
        const admin = isAdmin();
        list.forEach(concert => {
            const card = document.createElement('div');
            card.className = 'event-card';

            const dateBox = document.createElement('div');
            dateBox.className = 'date-box';
            dateBox.innerHTML = `<span class="day">${concert.day}</span><span class="month">${concert.month}</span>`;

            const details = document.createElement('div');
            details.className = 'event-details';
            details.innerHTML = `<h3>${concert.title}</h3><span>${concert.location} ${concert.time ? '| ' + concert.time : ''}</span><br>`;

            const mapLink = document.createElement('a');
            mapLink.className = 'map-link';
            mapLink.href = 'https://maps.google.com/?q=Buje';
            mapLink.target = '_blank';
            mapLink.textContent = 'View Map';
            details.appendChild(mapLink);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';

            const infoBtn = document.createElement('button');
            infoBtn.className = 'btn btn-primary';
            infoBtn.textContent = 'Info';
            infoBtn.addEventListener('click', () => openInfoModal(concert));

            actions.appendChild(infoBtn);

            if(admin) {
                const editBtn = document.createElement('button');
                editBtn.className = 'btn';
                editBtn.textContent = 'Edit';
                editBtn.addEventListener('click', () => openFormModal(concert));

                const delBtn = document.createElement('button');
                delBtn.className = 'btn';
                delBtn.textContent = 'Delete';
                delBtn.addEventListener('click', () => {
                    if(confirm('Delete this concert?')) deleteConcert(concert.id);
                });

                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
            }

            card.appendChild(dateBox);
            card.appendChild(details);
            card.appendChild(actions);

            eventsList.appendChild(card);
        });
    }

    function openInfoModal(concert) {
        infoBody.innerHTML = `
            <h2>${concert.title}</h2>
            <p><strong>Date:</strong> ${concert.day} ${concert.month} ${concert.time ? '| ' + concert.time : ''}</p>
            <p><strong>Location:</strong> ${concert.location}</p>
            <p>${concert.description || ''}</p>
        `;
        showModal(infoModal);
    }

    function openFormModal(concert) {
        if(!isAdmin()) { alert('Admin only'); return; }
        concertForm.reset();
        concertForm.dataset.editId = '';
        document.getElementById('form-title').textContent = concert ? 'Edit Concert' : 'Add Concert';
        if(concert) {
            concertForm.day.value = concert.day || '';
            concertForm.month.value = concert.month || '';
            concertForm.time.value = concert.time || '';
            concertForm.title.value = concert.title || '';
            concertForm.location.value = concert.location || '';
            concertForm.description.value = concert.description || '';
            concertForm.dataset.editId = concert.id;
        }
        showModal(formModal);
    }

    function showModal(el) { if(!el) return; el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); }
    function hideModal(el) { if(!el) return; el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); }
}