const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll(".section, .art-section, .bibliography, .image-band, .contact").forEach((section) => {
    revealObserver.observe(section);
});

let ticking = false;
const settleTimers = new WeakMap();
let heroTitleWarmTimer;

function settleFadeTarget(target) {
    if (!target) return;
    target.classList.remove("is-scrolling");
    target.style.opacity = "1";
}

function applyScrollFade(target, progress, transform, settleDelay = 260) {
    if (!target) return;
    target.classList.add("is-scrolling");
    if (transform) {
        target.style.transform = transform;
    }
    target.style.opacity = String(Math.max(0.3, 1 - progress));
    window.clearTimeout(settleTimers.get(target));
    settleTimers.set(target, window.setTimeout(() => settleFadeTarget(target), settleDelay));
}

window.addEventListener("scroll", () => {
    if (ticking) return;

    requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const heroContent = document.querySelector(".hero-content");
        const heroTitle = document.querySelector(".hero-title");
        const heroImage = document.querySelector(".hero-image");
        const witnessSection = document.querySelector(".witness-section");
        const nav = document.querySelector(".site-nav");

        if (heroContent && scrollY < window.innerHeight) {
            applyScrollFade(heroContent, scrollY / window.innerHeight, `translateY(${scrollY * 0.12}px)`);
        } else {
            settleFadeTarget(heroContent);
        }

        if (heroImage && scrollY < window.innerHeight) {
            heroImage.style.transform = `scale(1.04) translateY(${scrollY * 0.08}px)`;
        }

        if (witnessSection) {
            const rect = witnessSection.getBoundingClientRect();
            const isWitnessInView = rect.top < window.innerHeight && rect.bottom > 0;
            if (isWitnessInView) {
                const viewportCenter = window.innerHeight / 2;
                const sectionCenter = rect.top + (rect.height / 2);
                const distance = Math.abs(sectionCenter - viewportCenter);
                const progress = Math.min(0.7, distance / window.innerHeight);
                applyScrollFade(witnessSection, progress, null, 760);
            } else {
                settleFadeTarget(witnessSection);
            }
        }

        if (nav) {
            nav.classList.toggle("is-scrolled", scrollY > 80);
        }

        if (heroTitle && scrollY < window.innerHeight) {
            heroTitle.classList.add("is-warming");
            window.clearTimeout(heroTitleWarmTimer);
            heroTitleWarmTimer = window.setTimeout(() => {
                heroTitle.classList.remove("is-warming");
            }, 1100);
        }

        ticking = false;
    });

    ticking = true;
});

if (window.location.pathname !== "/dashboard/" && !window.location.pathname.startsWith("/dashboard/")) {
    fetch("https://hermes-web.mdi.io/lethe-dashboard/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer.slice(0, 300)
        }),
        keepalive: true
    }).catch(() => {});
}
