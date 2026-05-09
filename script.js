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
let heroSettleTimer;

function settleHeroText() {
    const heroContent = document.querySelector(".hero-content");
    if (!heroContent) return;
    heroContent.classList.remove("is-scrolling");
    heroContent.style.opacity = "1";
}

window.addEventListener("scroll", () => {
    if (ticking) return;

    requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const heroContent = document.querySelector(".hero-content");
        const heroImage = document.querySelector(".hero-image");
        const nav = document.querySelector(".site-nav");

        if (heroContent && scrollY < window.innerHeight) {
            heroContent.classList.add("is-scrolling");
            heroContent.style.transform = `translateY(${scrollY * 0.12}px)`;
            heroContent.style.opacity = String(Math.max(0.3, 1 - (scrollY / window.innerHeight)));
            window.clearTimeout(heroSettleTimer);
            heroSettleTimer = window.setTimeout(settleHeroText, 260);
        } else {
            settleHeroText();
        }

        if (heroImage && scrollY < window.innerHeight) {
            heroImage.style.transform = `scale(1.04) translateY(${scrollY * 0.08}px)`;
        }

        if (nav) {
            nav.classList.toggle("is-scrolled", scrollY > 80);
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
