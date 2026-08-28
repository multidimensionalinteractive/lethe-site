(function () {
    const API_BASE = "https://mdi.io/lethe-dashboard";
    const DISMISS_KEY = "letheNewsletterDismissedUntil";
    const DISMISS_DAYS = 30;

    const strip = document.getElementById("newsletter-strip");
    if (!strip) return;

    const form = strip.querySelector("[data-newsletter-form]");
    const statusEl = strip.querySelector("[data-newsletter-status]");
    const turnstileMount = strip.querySelector("[data-turnstile]");
    const closeButton = strip.querySelector("[data-newsletter-close]");
    let turnstileSiteKey = "";
    let turnstileWidgetId = null;

    function setStatus(message, type) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = "newsletter-strip-status" + (type ? ` ${type}` : "");
    }

    function isDismissed() {
        const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
        return until > Date.now();
    }

    function dismissStrip() {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
        strip.hidden = true;
        document.documentElement.style.setProperty("--newsletter-strip-height", "0px");
    }

    function showStrip() {
        strip.hidden = false;
        const height = strip.offsetHeight;
        document.documentElement.style.setProperty("--newsletter-strip-height", `${height}px`);
    }

    function mountTurnstile() {
        if (!turnstileMount || !turnstileSiteKey || !window.turnstile) return;
        if (turnstileWidgetId !== null) {
            window.turnstile.remove(turnstileWidgetId);
            turnstileWidgetId = null;
        }
        turnstileWidgetId = window.turnstile.render(turnstileMount, {
            sitekey: turnstileSiteKey,
            theme: "dark",
            size: "compact"
        });
    }

    async function init() {
        if (isDismissed()) {
            strip.hidden = true;
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/newsletter/config`);
            const data = await response.json();
            if (!data.enabled) {
                strip.hidden = true;
                return;
            }
            turnstileSiteKey = data.turnstileSiteKey || "";
            const kicker = strip.querySelector("[data-newsletter-kicker]");
            const copy = strip.querySelector("[data-newsletter-copy]");
            if (kicker && data.kicker) kicker.textContent = data.kicker;
            if (copy && data.copy) copy.textContent = data.copy;
            showStrip();
            if (turnstileSiteKey) {
                if (window.turnstile) mountTurnstile();
                else window.addEventListener("load", mountTurnstile, { once: true });
            }
        } catch {
            strip.hidden = true;
        }
    }

    async function submitForm(event) {
        event.preventDefault();
        if (!form) return;
        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const payload = {
            email: String(formData.get("email") || "").trim(),
            name: String(formData.get("name") || "").trim(),
            website: String(formData.get("website") || "").trim(),
            turnstileToken: window.turnstile && turnstileWidgetId !== null
                ? window.turnstile.getResponse(turnstileWidgetId)
                : ""
        };

        submitButton.disabled = true;
        setStatus("Sending…");

        try {
            const response = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Could not subscribe.");
            form.reset();
            mountTurnstile();
            setStatus(data.message || "Check your email to confirm.", "success");
        } catch (error) {
            setStatus(error.message || "Could not subscribe.", "error");
            mountTurnstile();
        } finally {
            submitButton.disabled = false;
        }
    }

    closeButton?.addEventListener("click", dismissStrip);
    form?.addEventListener("submit", submitForm);
    window.addEventListener("resize", () => {
        if (!strip.hidden) showStrip();
    });
    init();
})();
