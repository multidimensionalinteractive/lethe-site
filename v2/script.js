const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
        }
    });
}, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });

document.querySelectorAll(".section, .art-section, .bibliography, .drawer, .contact").forEach((section) => {
    revealObserver.observe(section);
});

const lightboxImages = Array.from(document.querySelectorAll("main img"));
let imageLightbox;
let lightboxImage;
let lightboxCaption;

function closeImageLightbox() {
    if (!imageLightbox) return;
    imageLightbox.classList.remove("is-open");
    imageLightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function ensureImageLightbox() {
    if (imageLightbox) return;

    imageLightbox = document.createElement("div");
    imageLightbox.className = "image-lightbox";
    imageLightbox.setAttribute("role", "dialog");
    imageLightbox.setAttribute("aria-modal", "true");
    imageLightbox.setAttribute("aria-label", "Object preview");
    imageLightbox.setAttribute("aria-hidden", "true");

    const closeButton = document.createElement("button");
    closeButton.className = "image-lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close object preview");
    closeButton.textContent = "CLOSE";

    const inner = document.createElement("div");
    inner.className = "image-lightbox-inner";
    lightboxImage = document.createElement("img");
    lightboxImage.alt = "";
    lightboxCaption = document.createElement("p");
    lightboxCaption.className = "image-lightbox-caption";
    inner.append(lightboxImage, lightboxCaption);
    imageLightbox.append(closeButton, inner);
    document.body.appendChild(imageLightbox);

    closeButton.addEventListener("click", closeImageLightbox);
    imageLightbox.addEventListener("click", (event) => {
        if (event.target === imageLightbox) closeImageLightbox();
    });
}

function openImageLightbox(image) {
    ensureImageLightbox();
    const figure = image.closest("figure");
    const caption = figure?.querySelector("figcaption")?.textContent?.trim() || image.alt || "Selected object";
    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt || caption;
    lightboxCaption.textContent = caption;
    imageLightbox.classList.add("is-open");
    imageLightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    imageLightbox.querySelector(".image-lightbox-close").focus();
}

lightboxImages.forEach((image) => {
    image.classList.add("lightbox-source");
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `Open object preview: ${image.alt || "selected work"}`);
    image.addEventListener("click", () => openImageLightbox(image));
    image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openImageLightbox(image);
        }
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeImageLightbox();
});

let ticking = false;
const settleTimers = new WeakMap();
let heroTitleWarmTimer;

function settleFadeTarget(target) {
    if (!target) return;
    target.classList.remove("is-scrolling");
    target.style.opacity = "1";
}

function applyScrollFade(target, progress, transform, settleDelay = 420) {
    if (!target) return;
    target.classList.add("is-scrolling");
    if (transform) {
        target.style.transform = transform;
    }
    target.style.opacity = String(Math.max(0.42, 1 - progress * 0.75));
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
        const nav = document.querySelector(".site-nav");

        if (heroContent && scrollY < window.innerHeight) {
            applyScrollFade(heroContent, scrollY / window.innerHeight, `translateY(${scrollY * 0.08}px)`, 520);
        } else {
            settleFadeTarget(heroContent);
        }

        if (heroImage && scrollY < window.innerHeight) {
            heroImage.style.transform = `scale(1.03) translateY(${scrollY * 0.05}px)`;
        }

        if (nav) {
            nav.classList.toggle("is-scrolled", scrollY > 60);
        }

        if (heroTitle && scrollY < window.innerHeight) {
            heroTitle.classList.add("is-warming");
            window.clearTimeout(heroTitleWarmTimer);
            heroTitleWarmTimer = window.setTimeout(() => {
                heroTitle.classList.remove("is-warming");
            }, 1400);
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
            referrer: document.referrer.slice(0, 300),
            language: navigator.language || "",
            languages: Array.isArray(navigator.languages) ? navigator.languages.slice(0, 5) : [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            screen: window.screen ? `${window.screen.width}x${window.screen.height}` : ""
        }),
        keepalive: true
    }).catch(() => {});
}
