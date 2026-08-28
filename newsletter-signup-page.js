(function () {
    const API_BASE = "https://mdi.io/lethe-dashboard";
    const form = document.getElementById("newsletter-page-form");
    const statusEl = document.getElementById("newsletter-page-status");
    const turnstileMount = document.querySelector("[data-turnstile]");
    let turnstileSiteKey = "";
    let turnstileWidgetId = null;

    if (!form) return;

    function setStatus(message, type) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = "newsletter-page-status" + (type ? ` ${type}` : "");
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
            size: "normal",
            callback: () => {},
            "expired-callback": () => {}
        });
    }

    async function init() {
        try {
            const response = await fetch(`${API_BASE}/api/newsletter/config`);
            const data = await response.json();
            if (!data.enabled) {
                setStatus("Subscriptions are not available at the moment.", "error");
                form.querySelector("button[type='submit']").disabled = true;
                return;
            }
            turnstileSiteKey = data.turnstileSiteKey || "";
            if (turnstileSiteKey) {
                if (window.turnstile) mountTurnstile();
                else window.addEventListener("load", mountTurnstile, { once: true });
            }
        } catch {
            setStatus("Could not load the subscription form.", "error");
        }
    }

    async function submitForm(event) {
        event.preventDefault();
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
            setStatus(data.message || "Check your email to confirm your subscription.", "success");
        } catch (error) {
            setStatus(error.message || "Could not subscribe.", "error");
            mountTurnstile();
        } finally {
            submitButton.disabled = false;
        }
    }

    form.addEventListener("submit", submitForm);
    init();
})();
