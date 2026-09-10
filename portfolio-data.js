'use strict';

async function loadPortfolioData() {
    const response = await fetch('/api/portfolio', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Portfolio API returned ${response.status}`);
    return response.json();
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value ?? '';
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function renderTimeline(container, items, titleKey, orgKey) {
    if (!container) return;
    container.replaceChildren();
    items.forEach(item => {
        const wrapper = createEl('div', 'timeline-item');
        wrapper.append(createEl('div', 'timeline-dot'));
        const content = createEl('div', 'timeline-content');
        content.append(createEl('span', 'timeline-date', item.date));
        content.append(createEl('h3', 'timeline-role', item[titleKey]));
        content.append(createEl('h4', 'timeline-org', item[orgKey]));
        content.append(createEl('p', '', item.desc));
        wrapper.append(content);
        container.append(wrapper);
    });
}

function renderPortfolio(data) {
    if (!data) return;
    setText('.name', data.personal?.name);
    const titleTyping = document.querySelector('.typing-text');
    if (titleTyping && data.personal?.title) titleTyping.dataset.adminTitle = data.personal.title;
    setText('.bio', data.personal?.bio);
    setText('.location-value', data.personal?.location);
    setText('.footer-phone', `Phone: ${data.personal?.phone || ''}`);
    setText('.contact-heading', data.contact?.heading);
    setText('.contact-desc', data.contact?.desc);
    setText('.about-text p:nth-of-type(1)', data.about?.para1);
    setText('.about-text p:nth-of-type(2)', data.about?.para2);

    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        link.href = data.personal?.email ? `mailto:${data.personal.email}` : '#contact';
    });

    const hello = document.querySelector('.contact-content .btn.primary.lg');
    if (hello) hello.href = data.personal?.email ? `mailto:${data.personal.email}` : '#contact';

    const social = document.querySelectorAll('.social-links a');
    if (social[0]) social[0].href = data.social?.github || '#';
    if (social[1]) social[1].href = data.social?.linkedin || '#';

    renderTimeline(document.querySelector('#experience .timeline'), data.experience || [], 'role', 'org');
    renderTimeline(document.querySelector('#education .timeline'), data.education || [], 'title', 'institution');
    renderCertifications(data.certifications || []);
    renderSkills(data.skills || []);
    renderProjects(data.projects || []);
}

function renderCertifications(items) {
    const grid = document.querySelector('#certifications .cert-grid');
    if (!grid) return;
    grid.replaceChildren();
    const summary = document.querySelector('.cert-summary strong');
    if (summary) summary.textContent = String(items.length).padStart(2, '0');

    items.forEach(cert => {
        const card = createEl('article', 'cert-card');
        const media = createEl('button', 'cert-img');
        media.type = 'button';
        media.setAttribute('aria-label', `View ${cert.name} certificate`);
        const img = document.createElement('img');
        img.alt = `${cert.name} Certificate`;
        const rawImage = String(cert.image || '').trim();
        const imageSrc = rawImage ? (rawImage.startsWith('/') ? rawImage : `/${rawImage}`) : 'certs/certificate-placeholder.svg';
        const hasImage = rawImage.length > 0;
        img.src = imageSrc;
        img.loading = 'lazy';
        img.addEventListener('error', () => {
            img.src = 'certs/certificate-placeholder.svg';
            media.disabled = true;
            media.setAttribute('aria-label', `${cert.name} certificate image unavailable`);
            overlay.textContent = 'Certificate image unavailable';
        }, { once: true });
        media.append(img);
        const overlay = createEl('span', 'cert-img-overlay-text', hasImage ? 'View Certificate' : 'Certificate image unavailable');
        media.append(overlay);
        media.disabled = !hasImage;
        media.addEventListener('click', () => { if (hasImage) openCertModal(media); });
        card.append(media);

        const info = createEl('div', 'cert-info');
        const meta = createEl('div', 'cert-meta');
        const progress = /progress|current/i.test(cert.date || '');
        meta.append(createEl('span', `cert-status${progress ? ' is-progress' : ''}`, progress ? 'In progress' : 'Completed'));
        meta.append(createEl('span', 'cert-date', progress ? 'Current' : cert.date));
        info.append(meta, createEl('h3', '', cert.name), createEl('h4', '', cert.issuer));
        card.append(info);
        grid.append(card);
    });
}

function renderSkills(items) {
    const grid = document.querySelector('#skills .skills-grid');
    if (!grid) return;
    grid.replaceChildren();
    items.forEach(skill => {
        const card = createEl('article', 'skill-category');
        card.append(createEl('h3', '', skill.category));
        const tags = createEl('div', 'skill-tags');
        (skill.tags || []).forEach(tag => tags.append(createEl('span', 'tag', tag)));
        card.append(tags);
        grid.append(card);
    });
}

function renderProjects(items) {
    const grid = document.querySelector('#projects .projects-grid');
    if (!grid) return;
    grid.replaceChildren();
    items.forEach(project => {
        const card = createEl('article', 'project-card');
        const content = createEl('div', 'project-content');
        const header = createEl('div', 'project-header');
        header.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
        content.append(header, createEl('h3', 'project-title', project.title), createEl('p', 'project-desc', project.desc));
        const tags = createEl('div', 'project-tags');
        (project.tags || []).forEach(tag => tags.append(createEl('span', '', tag)));
        content.append(tags);
        card.append(content);
        grid.append(card);
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    if (document.body.classList.contains('admin-page')) return;
    try {
        const data = await loadPortfolioData();
        renderPortfolio(data);
    } catch (error) {
        console.error('Unable to load portfolio data:', error);
    }
});

window.renderPortfolio = renderPortfolio;
