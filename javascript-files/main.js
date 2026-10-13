const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
    });
}

document.getElementById('learnMoreBtn')?.addEventListener('click', () => {
    scrollToSection('aboutMe');
});

const skipLink = document.querySelector('.skip-link');
const mainContent = document.getElementById('main-content');

skipLink?.addEventListener('click', event => {
    event.preventDefault();
    if (!mainContent) return;
    mainContent.focus({ preventScroll: true });
    scrollToSection('main-content');
});

document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach(anchor => {
    anchor.addEventListener('click', event => {
        event.preventDefault();
        scrollToSection(anchor.getAttribute('href').slice(1));
    });
});

const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.getElementById('primary-navigation');
const navbarElement = document.querySelector('.navbar');

function setNavigationOpen(open, { returnFocus = false } = {}) {
    if (!navToggle || !navLinks) return;

    navLinks.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');

    const icon = navToggle.querySelector('i');
    icon?.classList.toggle('fa-bars', !open);
    icon?.classList.toggle('fa-xmark', open);

    if (returnFocus) navToggle.focus();
}

navToggle?.addEventListener('click', () => {
    setNavigationOpen(navToggle.getAttribute('aria-expanded') !== 'true');
});

navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setNavigationOpen(false));
});

document.addEventListener('click', event => {
    if (navToggle?.getAttribute('aria-expanded') !== 'true') return;
    if (!navbarElement?.contains(event.target)) setNavigationOpen(false);
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navToggle?.getAttribute('aria-expanded') === 'true') {
        setNavigationOpen(false, { returnFocus: true });
    }
});

window.matchMedia('(min-width: 1001px)').addEventListener('change', event => {
    if (event.matches) setNavigationOpen(false);
});

const navbar = document.querySelector('.navbar');
let navbarFrame = null;
function updateNavbar() {
    if (!navbar) return;
    navbar.style.background = window.scrollY > 50
        ? 'rgba(0, 0, 0, 0.9)'
        : 'rgba(0, 0, 0, 0.8)';
    navbarFrame = null;
}
window.addEventListener('scroll', () => {
    if (navbarFrame === null) navbarFrame = window.requestAnimationFrame(updateNavbar);
}, { passive: true });
updateNavbar();

const animatedElements = document.querySelectorAll('.detail-item, .skill-category, .contact-item');
animatedElements.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
});

if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const element = entry.target;
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
            observer.unobserve(element);
        });
    }, { rootMargin: '0px 0px -8% 0px' });
    animatedElements.forEach(element => revealObserver.observe(element));
} else {
    animatedElements.forEach(element => {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    });
}

const projectDisclosures = [...document.querySelectorAll('.project-disclosure')];
const projectDetailsToggle = document.getElementById('toggleProjectDetails');

function syncProjectDetailsToggle() {
    if (!projectDetailsToggle || !projectDisclosures.length) return;
    const allOpen = projectDisclosures.every(disclosure => disclosure.open);
    projectDetailsToggle.setAttribute('aria-pressed', String(allOpen));
    projectDetailsToggle.innerHTML = allOpen
        ? 'Collapse all details <i class="fas fa-minus" aria-hidden="true"></i>'
        : 'Expand all details <i class="fas fa-plus" aria-hidden="true"></i>';
}

projectDetailsToggle?.addEventListener('click', () => {
    const open = !projectDisclosures.every(disclosure => disclosure.open);
    projectDisclosures.forEach(disclosure => { disclosure.open = open; });
    syncProjectDetailsToggle();
});

projectDisclosures.forEach(disclosure => {
    disclosure.addEventListener('toggle', syncProjectDetailsToggle);
});

const tagline = document.querySelector('.tagline');
if (tagline && !prefersReducedMotion) {
    const text = tagline.textContent;
    tagline.textContent = '';

    [...text].forEach((character, index) => {
        window.setTimeout(() => {
            tagline.textContent += character;
        }, index * 35);
    });
}

document.querySelectorAll('.project-card .card-inner').forEach((inner, index) => {
    const card = inner.closest('.project-card');
    const front = inner.querySelector('.card-front');
    const back = inner.querySelector('.card-back');
    if (!card || !front || !back) return;

    const title = front.querySelector('h3')?.textContent?.trim() || `project ${index + 1}`;
    const backId = `project-details-${index + 1}`;
    back.id = backId;

    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.className = 'flip-btn';
    detailsButton.setAttribute('aria-controls', backId);
    detailsButton.setAttribute('aria-expanded', 'false');
    detailsButton.innerHTML = 'View details <i class="fas fa-arrow-right" aria-hidden="true"></i>';

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'flip-btn flip-btn--back';
    backButton.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i> Back';
    backButton.setAttribute('aria-label', `Return to ${title}`);

    front.append(detailsButton);
    back.prepend(backButton);

    function setCardFlipped(flipped, focusTarget) {
        card.classList.toggle('is-flipped', flipped);
        detailsButton.setAttribute('aria-expanded', String(flipped));

        if (flipped) {
            back.inert = false;
            back.setAttribute('aria-hidden', 'false');
            focusTarget?.focus();
            front.inert = true;
            front.setAttribute('aria-hidden', 'true');
        } else {
            front.inert = false;
            front.setAttribute('aria-hidden', 'false');
            focusTarget?.focus();
            back.inert = true;
            back.setAttribute('aria-hidden', 'true');
        }
    }

    detailsButton.addEventListener('click', event => {
        event.stopPropagation();
        setCardFlipped(true, backButton);
    });

    backButton.addEventListener('click', event => {
        event.stopPropagation();
        setCardFlipped(false, detailsButton);
    });

    card.addEventListener('keydown', event => {
        if (event.key === 'Escape' && card.classList.contains('is-flipped')) {
            event.stopPropagation();
            setCardFlipped(false, detailsButton);
        }
    });

    setCardFlipped(false);
});

document.querySelectorAll('.screenshot-gallery').forEach(gallery => {
    const images = [...gallery.querySelectorAll('img')];
    if (!images.length) return;

    const prevBtn = gallery.parentElement.querySelector('.prev-btn');
    const nextBtn = gallery.parentElement.querySelector('.next-btn');
    let currentIndex = 0;

    function showImage(index) {
        images.forEach(image => image.classList.remove('active'));
        images[index].classList.add('active');
    }

    function nextImage(event) {
        event?.preventDefault();
        event?.stopPropagation();
        currentIndex = (currentIndex + 1) % images.length;
        showImage(currentIndex);
    }

    function prevImage(event) {
        event?.preventDefault();
        event?.stopPropagation();
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        showImage(currentIndex);
    }

    prevBtn?.addEventListener('click', prevImage);
    nextBtn?.addEventListener('click', nextImage);

    if (!prefersReducedMotion) {
        window.setInterval(nextImage, 5000);
    }
});

const modal = document.getElementById('comingSoonModal');
const closeModalButton = document.querySelector('.close-modal');
let lastModalTrigger = null;

function openPrivateRepoModal(event) {
    if (!modal) return;
    lastModalTrigger = event?.currentTarget || document.activeElement;
    modal.hidden = false;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    closeModalButton?.focus();
}

function closePrivateRepoModal() {
    if (!modal || modal.hidden) return;
    modal.style.display = 'none';
    modal.hidden = true;
    document.body.style.overflow = '';
    lastModalTrigger?.focus();
}

document.querySelectorAll('[data-modal-trigger]').forEach(trigger => {
    trigger.addEventListener('click', openPrivateRepoModal);
});

closeModalButton?.addEventListener('click', closePrivateRepoModal);

window.addEventListener('click', event => {
    if (event.target === modal) {
        closePrivateRepoModal();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal && !modal.hidden) {
        closePrivateRepoModal();
    }
});

modal?.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;

    const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});
