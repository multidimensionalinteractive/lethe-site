const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
        }
    });
}, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

document.querySelectorAll(".section, .featured, .works-head, .archive-head, .work, .reference-study, .marker-grid, .archive-item, .correspondence-panel").forEach((section) => {
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
    imageLightbox.setAttribute("aria-label", "Image preview");
    imageLightbox.setAttribute("aria-hidden", "true");

    const closeButton = document.createElement("button");
    closeButton.className = "image-lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close image preview");
    closeButton.textContent = "X";

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
    const caption = figure?.querySelector("figcaption")?.textContent?.trim() || image.alt || "Selected work";
    const fullSrc = image.getAttribute("data-full-src");
    lightboxImage.src = fullSrc || image.currentSrc || image.src;
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
    image.setAttribute("aria-label", `Open image preview: ${image.alt || "selected work"}`);
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

const nav = document.querySelector(".site-nav");
const heroImage = document.querySelector(".hero-image");
let bgParallaxTicking = false;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function updateBgParallax() {
    bgParallaxTicking = false;
    if (prefersReducedMotion) return;
    const y = window.scrollY || 0;
    // Background map stays static (revision spec). Light hero depth only.
    if (heroImage) {
        const hero = heroImage.closest(".hero");
        const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;
        if (y < heroBottom) {
            heroImage.style.transform = `translate3d(0, ${y * 0.28}px, 0) scale(1.04)`;
        }
    }
}

window.addEventListener("scroll", () => {
    if (nav) {
        nav.classList.toggle("is-scrolled", window.scrollY > 80);
    }
    if (!bgParallaxTicking) {
        bgParallaxTicking = true;
        requestAnimationFrame(updateBgParallax);
    }
}, { passive: true });

if (!prefersReducedMotion) {
    updateBgParallax();
}

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
