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

document.getElementById('viewProjectsBtn')?.addEventListener('click', () => {
    scrollToSection('projects');
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
        event.preventDefault();
        scrollToSection(anchor.getAttribute('href').slice(1));
    });
});

const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (!navbar) return;
    navbar.style.background = window.scrollY > 50
        ? 'rgba(0, 0, 0, 0.9)'
        : 'rgba(0, 0, 0, 0.8)';
});

const animatedElements = document.querySelectorAll('.detail-item, .skill-category, .contact-item');
animatedElements.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
});

function animateOnScroll() {
    animatedElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }
    });
}

window.addEventListener('scroll', animateOnScroll);
animateOnScroll();

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

function openPrivateRepoModal() {
    if (!modal) return;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    closeModalButton?.focus();
}

function closePrivateRepoModal() {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
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
    if (event.key === 'Escape') {
        closePrivateRepoModal();
    }
});
