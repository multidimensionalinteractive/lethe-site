// LETHE Site Script
// Refined Visual Direction - Art Basel-Inspired Dark Gallery

// Intersection Observer for scroll animations
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe all chapters
document.querySelectorAll('.chapter').forEach(chapter => {
    observer.observe(chapter);
});

// Hero parallax effect
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            const heroContent = document.querySelector('.hero-content');
            const heroBackground = document.querySelector('.hero-background');
            
            if (heroContent && scrollY < window.innerHeight) {
                heroContent.style.transform = `translateY(${scrollY * 0.3}px)`;
                heroContent.style.opacity = 1 - (scrollY / window.innerHeight);
                
                if (heroBackground) {
                    heroBackground.style.transform = `translateY(${scrollY * 0.2}px)`;
                }
            }
            
            // Parallax for chapter images
            document.querySelectorAll('.chapter-image').forEach(image => {
                const rect = image.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    const offset = (rect.top - window.innerHeight / 2) * 0.02;
                    image.style.transform = `scale(${1 + Math.abs(offset) * 0.01})`;
                }
            });
            
            ticking = false;
        });
        ticking = true;
    }
});

// Smooth reveal on page load
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
    
    // Trigger initial chapter animations for visible sections
    setTimeout(() => {
        document.querySelectorAll('.chapter').forEach(chapter => {
            const rect = chapter.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
                chapter.classList.add('visible');
            }
        });
    }, 100);
});

// Anonymous visit signal for the private dashboard
if (window.location.pathname !== '/dashboard/' && !window.location.pathname.startsWith('/dashboard/')) {
    fetch('https://hermes-web.mdi.io/lethe-dashboard/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer.slice(0, 300)
        }),
        keepalive: true
    }).catch(() => {});
}

// Navigation scroll effect
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        nav.style.background = 'rgba(10, 10, 10, 0.98)';
        nav.style.padding = '1rem 4rem';
    } else {
        nav.style.background = 'linear-gradient(to bottom, rgba(10, 10, 10, 0.95), transparent)';
        nav.style.padding = '2rem 4rem';
    }
});

// Image hover lightbox effect (enhanced)
document.querySelectorAll('.chapter-image').forEach(image => {
    image.addEventListener('mouseenter', function() {
        this.style.boxShadow = '0 0 40px rgba(139, 115, 85, 0.2)';
    });
    
    image.addEventListener('mouseleave', function() {
        this.style.boxShadow = 'none';
    });
});

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close any modals if implemented
    }
});

// Mouse cursor trail effect (subtle)
let mouseX = 0;
let mouseY = 0;
let trailX = 0;
let trailY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function updateTrail() {
    trailX += (mouseX - trailX) * 0.05;
    trailY += (mouseY - trailY) * 0.05;
    
    requestAnimationFrame(updateTrail);
}

updateTrail();

// Console Easter egg
console.log('%c LETHE ', 'background: #8B7355; color: #0a0a0a; font-size: 20px; padding: 5px 20px; font-family: serif;');
console.log('%c You are still inside it. ', 'color: #666; font-style: italic;');
