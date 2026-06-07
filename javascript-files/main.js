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

document.querySelectorAll('[data-video-story]').forEach(story => {
    const scenes = [...story.querySelectorAll('.video-scene')];
    if (!scenes.length) return;

    let sceneIndex = 0;
    let isPlaying = !prefersReducedMotion;
    let intervalId = null;
    const container = story.closest('.gpu-story-box');
    const label = container?.querySelector('[data-story-label]');
    const toggleButton = container?.querySelector('[data-story-toggle]');
    const prevButton = container?.querySelector('[data-story-prev]');
    const nextButton = container?.querySelector('[data-story-next]');

    const showScene = index => {
        sceneIndex = (index + scenes.length) % scenes.length;
        scenes.forEach((scene, currentIndex) => {
            scene.classList.toggle('is-active', currentIndex === sceneIndex);
        });
        if (label) {
            label.textContent = scenes[sceneIndex].dataset.sceneLabel || `Scene ${sceneIndex + 1}`;
        }
    };

    const updateToggleIcon = () => {
        if (!toggleButton) return;
        toggleButton.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        toggleButton.setAttribute('aria-label', isPlaying ? 'Pause story' : 'Play story');
    };

    const stopPlayback = () => {
        if (intervalId) {
            window.clearInterval(intervalId);
            intervalId = null;
        }
    };

    const startPlayback = () => {
        stopPlayback();
        if (!isPlaying || prefersReducedMotion) return;
        intervalId = window.setInterval(() => {
            showScene(sceneIndex + 1);
        }, 5000);
    };

    showScene(sceneIndex);
    updateToggleIcon();
    startPlayback();

    prevButton?.addEventListener('click', () => {
        showScene(sceneIndex - 1);
        startPlayback();
    });

    nextButton?.addEventListener('click', () => {
        showScene(sceneIndex + 1);
        startPlayback();
    });

    toggleButton?.addEventListener('click', () => {
        isPlaying = !isPlaying;
        updateToggleIcon();
        startPlayback();
    });
});
