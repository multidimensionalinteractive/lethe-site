(function () {
    const API_BASE = "https://mdi.io/lethe-dashboard";
    const section = document.querySelector(".field-comments[data-post-id]");
    if (!section) return;

    const postId = section.dataset.postId || "";
    const listEl = section.querySelector("[data-comment-list]");
    const form = section.querySelector("[data-comment-form]");
    const statusEl = section.querySelector("[data-comment-status]");
    const turnstileMount = section.querySelector("[data-turnstile]");
    let turnstileSiteKey = section.dataset.turnstileSiteKey || "";
    let turnstileWidgetId = null;

    function setStatus(message, type) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = "field-comments-status" + (type ? ` ${type}` : "");
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(new Date(value));
        } catch {
            return value;
        }
    }

    function renderComments(comments) {
        if (!listEl) return;
        listEl.innerHTML = "";
        if (!comments.length) {
            const empty = document.createElement("p");
            empty.className = "field-comments-empty";
            empty.textContent = "No responses yet.";
            listEl.appendChild(empty);
            return;
        }

        comments.forEach((comment) => {
            const article = document.createElement("article");
            article.className = "field-comment";
            const meta = document.createElement("p");
            meta.className = "field-comment-meta";
            meta.textContent = `${comment.authorName} · ${formatDate(comment.approvedAt || comment.createdAt)}`;
            const body = document.createElement("p");
            body.className = "field-comment-body";
            body.textContent = comment.body;
            article.append(meta, body);
            listEl.appendChild(article);
        });
    }

    async function loadConfig() {
        const response = await fetch(`${API_BASE}/api/comments/config`);
        if (!response.ok) throw new Error("Comments are unavailable right now.");
        const data = await response.json();
        turnstileSiteKey = data.turnstileSiteKey || turnstileSiteKey;
        if (!data.commentsEnabled) {
            setStatus("Responses are temporarily unavailable.", "error");
            if (form) form.hidden = true;
            return false;
        }
        return true;
    }

    async function loadComments() {
        const response = await fetch(`${API_BASE}/api/comments?postId=${encodeURIComponent(postId)}`);
        if (!response.ok) throw new Error("Could not load responses.");
        const data = await response.json();
        renderComments(Array.isArray(data.comments) ? data.comments : []);
    }

    function mountTurnstile() {
        if (!turnstileMount || !turnstileSiteKey || !window.turnstile) return;
        if (turnstileWidgetId !== null) {
            window.turnstile.remove(turnstileWidgetId);
            turnstileWidgetId = null;
        }
        turnstileWidgetId = window.turnstile.render(turnstileMount, {
            sitekey: turnstileSiteKey,
            theme: "dark"
        });
    }

    async function submitComment(event) {
        event.preventDefault();
        if (!form) return;

        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const payload = {
            postId,
            postSlug: section.dataset.postSlug || "",
            postTitle: section.dataset.postTitle || "",
            postUrl: section.dataset.postUrl || window.location.href,
            authorName: String(formData.get("authorName") || "").trim(),
            authorEmail: String(formData.get("authorEmail") || "").trim(),
            body: String(formData.get("body") || "").trim(),
            website: String(formData.get("website") || "").trim(),
            turnstileToken: window.turnstile && turnstileWidgetId !== null
                ? window.turnstile.getResponse(turnstileWidgetId)
                : ""
        };

        submitButton.disabled = true;
        setStatus("Sending…");

        try {
            const response = await fetch(`${API_BASE}/api/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Could not send your note.");
            }
            form.reset();
            mountTurnstile();
            setStatus(data.message || "Thank you. Your note was received.", "success");
        } catch (error) {
            setStatus(error.message || "Could not send your note.", "error");
            mountTurnstile();
        } finally {
            submitButton.disabled = false;
        }
    }

    async function init() {
        try {
            const enabled = await loadConfig();
            await loadComments();
            if (!enabled || !form) return;

            if (turnstileSiteKey) {
                if (window.turnstile) {
                    mountTurnstile();
                } else {
                    window.addEventListener("load", mountTurnstile, { once: true });
                }
            }

            form.addEventListener("submit", submitComment);
        } catch (error) {
            setStatus(error.message || "Responses are unavailable right now.", "error");
            if (form) form.hidden = true;
        }
    }

    init();
})();
