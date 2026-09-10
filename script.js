'use strict';

document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.toggle('admin-route', document.body.classList.contains('admin-page'));
    initTyping();
    initNavigation();
    initAnimations();
    initCertificateModal();
    if (document.body.classList.contains('admin-page')) initAdmin();
});

function initTyping() {
    const element = document.querySelector('.typing-text');
    if (!element) return;
    const fallbackTexts = ['Penetration Testing Intern', 'Cybersecurity Student', 'Security Enthusiast'];
    let textIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer;

    const type = () => {
        const text = textIndex === 0 ? (element.dataset.adminTitle || fallbackTexts[0]) : fallbackTexts[textIndex];
        charIndex += deleting ? -1 : 1;
        element.textContent = text.slice(0, charIndex);
        let delay = deleting ? 45 : 90;
        if (!deleting && charIndex === text.length) { deleting = true; delay = 1800; }
        if (deleting && charIndex === 0) { deleting = false; textIndex = (textIndex + 1) % fallbackTexts.length; delay = 450; }
        timer = window.setTimeout(type, delay);
    };
    timer = window.setTimeout(type, 700);
    window.addEventListener('beforeunload', () => clearTimeout(timer), { once: true });
}

function initNavigation() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const links = document.querySelectorAll('.nav-links a');
    const updateNavbar = () => navbar?.classList.toggle('scrolled', window.scrollY > 40);
    updateNavbar();
    window.addEventListener('scroll', updateNavbar, { passive: true });

    hamburger?.addEventListener('click', () => {
        const open = !navLinks.classList.contains('active');
        hamburger.classList.toggle('active', open);
        navLinks.classList.toggle('active', open);
        hamburger.setAttribute('aria-expanded', String(open));
    });
    links.forEach(link => link.addEventListener('click', () => {
        hamburger?.classList.remove('active');
        navLinks?.classList.remove('active');
        hamburger?.setAttribute('aria-expanded', 'false');
    }));
}

function initAnimations() {
    const elements = document.querySelectorAll('.fade-up');
    if (!('IntersectionObserver' in window)) {
        elements.forEach(el => el.classList.add('visible'));
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    elements.forEach(el => observer.observe(el));
}

function initCertificateModal() {
    const modal = document.getElementById('certModal');
    const close = modal?.querySelector('.cert-modal-close');
    if (!modal || !close) return;
    const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };
    close.addEventListener('click', closeModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('active')) closeModal(); });
}

function openCertModal(button) {
    const modal = document.getElementById('certModal');
    const modalImg = document.getElementById('certModalImg');
    const img = button?.querySelector('img');
    if (!modal || !modalImg || !img) return;
    modalImg.src = img.currentSrc || img.src;
    modalImg.alt = img.alt || 'Certificate';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    modal.querySelector('.cert-modal-close')?.focus();
}
window.openCertModal = openCertModal;

async function initAdmin() {
    const login = document.getElementById('admin-login');
    const layout = document.getElementById('admin-layout');
    const form = document.getElementById('admin-login-form');
    if (!login || !layout || !form) return;

    let data = await getPortfolioData();
    if (!data) return;

    const showDashboard = () => { login.hidden = true; layout.hidden = false; renderAdmin(data); };
    const session = await fetch('/api/admin/session').then(r => r.ok ? r.json() : { authenticated: false }).catch(() => ({ authenticated: false }));
    if (session.authenticated) showDashboard();

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const password = document.getElementById('admin-password').value;
        const error = document.getElementById('admin-login-error');
        error.hidden = true;
        try {
            const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ password }) });
            if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Login failed.');
            document.getElementById('admin-password').value = '';
            data = await getPortfolioData();
            showDashboard();
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        }
    });
}

async function getPortfolioData() {
    try {
        const response = await fetch('/api/portfolio', { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load portfolio data.');
        return await response.json();
    } catch (error) {
        console.error(error);
        const message = document.getElementById('admin-login-error');
        if (message) { message.textContent = error.message; message.hidden = false; }
        return null;
    }
}

const ADMIN_FIELDS = {
    experience: [['date', 'Date range'], ['role', 'Role'], ['org', 'Organization'], ['desc', 'Description']],
    education: [['date', 'Date range'], ['title', 'Degree / title'], ['institution', 'Institution'], ['desc', 'Description']],
    certifications: [['date', 'Date'], ['name', 'Certificate name'], ['issuer', 'Issuer']],
    skills: [['category', 'Category'], ['tags', 'Tags (comma separated)']],
    projects: [['title', 'Project title'], ['desc', 'Description'], ['tags', 'Tags (comma separated)']]
};
const ADMIN_DEFAULTS = {
    experience: { date: '', role: '', org: '', desc: '' },
    education: { date: '', title: '', institution: '', desc: '' },
    certifications: { date: '', name: '', issuer: '', image: '' },
    skills: { category: '', tags: [] },
    projects: { title: '', desc: '', tags: [] }
};

function renderAdmin(data) {
    const fields = {
        'p-name': data.personal?.name, 'p-title': data.personal?.title, 'p-bio': data.personal?.bio, 'p-email': data.personal?.email, 'p-phone': data.personal?.phone, 'p-location': data.personal?.location,
        'a-para1': data.about?.para1, 'a-para2': data.about?.para2, 'c-heading': data.contact?.heading, 'c-desc': data.contact?.desc, 's-github': data.social?.github, 's-linkedin': data.social?.linkedin
    };
    Object.entries(fields).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value || ''; });
    ['experience', 'education', 'certifications', 'skills', 'projects'].forEach(type => renderAdminList(data, type));
    initAdminInteractions(data);
}

function inputFor(name, value) {
    const input = document.createElement('input');
    input.dataset.field = name;
    input.value = Array.isArray(value) ? value.join(', ') : value || '';
    return input;
}

function renderAdminList(data, type) {
    const list = document.getElementById(`${type}-list`);
    if (!list) return;
    list.replaceChildren();
    (data[type] || []).forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'admin-item';
        wrapper.dataset.index = String(index);
        wrapper.dataset.image = String(item.image || '');
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'btn secondary remove-item'; remove.dataset.type = type; remove.dataset.index = String(index); remove.textContent = 'Remove';
        wrapper.append(remove);
        ADMIN_FIELDS[type].forEach(([name, labelText]) => {
            const field = document.createElement('div'); field.className = 'admin-field';
            const label = document.createElement('label'); label.textContent = labelText; field.append(label);
            const control = name === 'desc' ? document.createElement('textarea') : inputFor(name, item[name]);
            if (name === 'desc') { control.dataset.field = name; control.value = item[name] || ''; }
            if (name === 'date' || name === 'issuer' || name === 'name' || name === 'category' || name === 'role' || name === 'org' || name === 'title' || name === 'institution') control.maxLength = 180;
            field.append(control); wrapper.append(field);
        });
        if (type === 'certifications') {
            const field = document.createElement('div'); field.className = 'admin-field';
            const label = document.createElement('label'); label.textContent = 'Certificate image'; field.append(label);
            const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.dataset.file = 'true'; field.append(file);
            if (item.image && !item.image.startsWith('data:')) {
                const preview = document.createElement('div');
                preview.className = 'admin-cert-preview';
                const img = document.createElement('img');
                img.className = 'admin-preview';
                img.src = item.image.startsWith('/') ? item.image : `/${item.image}`;
                img.alt = `${item.name || 'Certificate'} preview`;
                img.loading = 'lazy';
                img.addEventListener('error', () => {
                    preview.dataset.error = 'true';
                    preview.textContent = 'Image file not found. Upload the certificate again.';
                }, { once: true });
                preview.append(img);
                field.append(preview);
            }
            wrapper.append(field);
        }
        list.append(wrapper);
    });
}

let adminInteractionsReady = false;
function initAdminInteractions(data) {
    if (adminInteractionsReady) return;
    adminInteractionsReady = true;
    document.querySelectorAll('.admin-nav button').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav button, .admin-panel').forEach(el => el.classList.remove('active'));
        button.classList.add('active'); document.querySelector(`[data-section="${button.dataset.panel}"]`)?.classList.add('active');
    }));
    document.querySelectorAll('.add-list').forEach(button => button.addEventListener('click', () => {
        const type = button.dataset.type;
        collectAdminList(data, type);
        data[type].push(JSON.parse(JSON.stringify(ADMIN_DEFAULTS[type])));
        renderAdminList(data, type);
    }));
    document.addEventListener('click', event => {
        const remove = event.target.closest('.remove-item');
        if (!remove) return;
        const type = remove.dataset.type; collectAdminList(data, type);
        data[type].splice(Number(remove.dataset.index), 1); renderAdminList(data, type);
    });
    document.addEventListener('change', event => {
        if (!event.target.matches('[data-file]')) return;
        const row = event.target.closest('.admin-item');
        const index = Number(row.dataset.index);
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            event.target.value = ''; alert('Please choose a PNG, JPEG, or WebP image up to 5 MB.'); return;
        }
        const rowButton = row.querySelector('.remove-item');
        const previousText = event.target.dataset.uploadingLabel || 'Upload image';
        event.target.disabled = true;
        if (rowButton) rowButton.disabled = true;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const response = await fetch('/api/admin/certificate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ image: reader.result })
                });
                const body = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(body.error || 'Certificate upload failed.');
                if (!body.image || typeof body.image !== 'string' || !/^\/certs\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(body.image)) {
                    throw new Error('Server returned an invalid certificate image path.');
                }
                data.certifications[index].image = body.image;
                row.dataset.image = body.image;
                const existingPreview = row.querySelector('.admin-cert-preview');
                if (existingPreview) existingPreview.remove();
                const preview = document.createElement('div');
                preview.className = 'admin-cert-preview';
                const img = document.createElement('img');
                img.className = 'admin-preview';
                img.alt = `${data.certifications[index].name || 'Certificate'} preview`;
                img.src = body.image;
                img.loading = 'lazy';
                preview.append(img);
                event.target.closest('.admin-field')?.append(preview);
            } catch (error) {
                event.target.value = '';
                alert(error.message);
            } finally {
                event.target.disabled = false;
                if (rowButton) rowButton.disabled = false;
                event.target.dataset.uploadingLabel = previousText;
            }
        };
        reader.onerror = () => {
            event.target.disabled = false;
            if (rowButton) rowButton.disabled = false;
            event.target.value = '';
            alert('Unable to read the selected image.');
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('save-admin')?.addEventListener('click', () => saveAdminData(data));
    document.getElementById('logout-admin')?.addEventListener('click', async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
        window.location.href = '/';
    });
}

function collectAdminList(data, type) {
    document.querySelectorAll(`#${type}-list .admin-item`).forEach((item, index) => {
        if (!data[type][index]) return;
        item.querySelectorAll('[data-field]').forEach(input => {
            const name = input.dataset.field;
            data[type][index][name] = name === 'tags' ? input.value.split(',').map(v => v.trim()).filter(Boolean) : input.value.trim();
        });
        if (type === 'certifications') {
            // The image is uploaded separately. Keep its server path attached to the row
            // so collecting text fields can never accidentally erase it before Save.
            data[type][index].image = item.dataset.image || data[type][index].image || '';
        }
    });
}

async function saveAdminData(data) {
    ['experience', 'education', 'certifications', 'skills', 'projects'].forEach(type => collectAdminList(data, type));
    const get = id => document.getElementById(id)?.value.trim() || '';
    data.personal = { name: get('p-name'), title: get('p-title'), bio: get('p-bio'), email: get('p-email'), phone: get('p-phone'), location: get('p-location') };
    data.about = { para1: get('a-para1'), para2: get('a-para2') };
    data.contact = { heading: get('c-heading'), desc: get('c-desc') };
    data.social = { github: get('s-github'), linkedin: get('s-linkedin') };
    const status = document.getElementById('admin-message');
    try {
        const response = await fetch('/api/admin/portfolio', { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Unable to save changes.');
        Object.assign(data, body);
        renderAdminList(data, 'certifications');
        status.textContent = 'Changes saved successfully. Certificate images are now linked to the saved records.'; status.hidden = false; status.style.color = 'var(--admin-accent)';
        setTimeout(() => { status.hidden = true; }, 3500);
    } catch (error) {
        status.textContent = error.message; status.hidden = false; status.style.color = 'var(--admin-danger)';
    }
}
