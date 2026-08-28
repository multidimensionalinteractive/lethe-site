const API_BASE = "https://mdi.io/lethe-dashboard";
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const promptEl = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const accessRow = document.getElementById("access-row");
const accessCode = document.getElementById("access-code");
const saveCode = document.getElementById("save-code");
const rememberRow = document.getElementById("remember-row");
const rememberAccess = document.getElementById("remember-access");
const sessionRow = document.getElementById("session-row");
const lockDashboard = document.getElementById("lock-dashboard");
const clearChat = document.getElementById("clear-chat");
const generatePreview = document.getElementById("generate-preview");
const pushProposal = document.getElementById("push-proposal");
const proposalPanel = document.getElementById("proposal-panel");
const pushStatus = document.getElementById("push-status");
const proposalSummary = document.getElementById("proposal-summary");
const proposalPreview = document.getElementById("proposal-preview");
const imageUpload = document.getElementById("image-upload");
const uploadPreview = document.getElementById("upload-preview");
const refreshVisits = document.getElementById("refresh-visits");
const visitsTotal = document.getElementById("visits-total");
const visitsCountries = document.getElementById("visits-countries");
const countryList = document.getElementById("country-list");
const visitorMapDots = document.getElementById("visitor-map-dots");
const visitorMapEmpty = document.getElementById("visitor-map-empty");
const visitorMapDetail = document.getElementById("visitor-map-detail");
const mapDetailTitle = document.getElementById("map-detail-title");
const mapDetailBody = document.getElementById("map-detail-body");
const mapDetailClose = document.getElementById("map-detail-close");
const entriesPanel = document.getElementById("entries-panel");
const commentsPanel = document.getElementById("comments-panel");
const commentsList = document.getElementById("comments-list");
const commentsStatus = document.getElementById("comments-status");
const commentsPendingBadge = document.getElementById("comments-pending-badge");
const refreshComments = document.getElementById("refresh-comments");
const newsletterPanel = document.getElementById("newsletter-panel");
const newsletterStats = document.getElementById("newsletter-stats");
const newsletterSubject = document.getElementById("newsletter-subject");
const newsletterBody = document.getElementById("newsletter-body");
const newsletterTestEmail = document.getElementById("newsletter-test-email");
const newsletterTestSend = document.getElementById("newsletter-test-send");
const newsletterSendAll = document.getElementById("newsletter-send-all");
const newsletterStatus = document.getElementById("newsletter-status");
const newsletterIssues = document.getElementById("newsletter-issues");
const newsletterSubscribers = document.getElementById("newsletter-subscribers");
const newsletterConfirmedBadge = document.getElementById("newsletter-confirmed-badge");
const refreshNewsletter = document.getElementById("refresh-newsletter");
const newEntry = document.getElementById("new-entry");
const entryType = document.getElementById("entry-type");
const entryTitle = document.getElementById("entry-title");
const entryKicker = document.getElementById("entry-kicker");
const entrySlug = document.getElementById("entry-slug");
const entryDeck = document.getElementById("entry-deck");
const entryByline = document.getElementById("entry-byline");
const entryExcerpt = document.getElementById("entry-excerpt");
const entryContent = document.getElementById("entry-content");
const entryFigures = document.getElementById("entry-figures");
const entryFiguresGrid = document.getElementById("entry-figures-grid");
const entryFiguresNote = document.getElementById("entry-figures-note");
const entryDraftPreview = document.getElementById("entry-draft-preview");
const entryDraftPreviewBody = document.getElementById("entry-draft-preview-body");
const saveEntryDraft = document.getElementById("save-entry-draft");
const publishEntry = document.getElementById("publish-entry");
const viewEntry = document.getElementById("view-entry");
const deleteEntry = document.getElementById("delete-entry");
const entryStatus = document.getElementById("entry-status");
const draftEntryList = document.getElementById("draft-entry-list");
const publishedEntryList = document.getElementById("published-entry-list");

const rememberedAccess = (localStorage.getItem("letheDashboardAccess") || sessionStorage.getItem("letheDashboardAccess") || "").trim();

const countryCoordinates = {
    "United States": [-98, 39], US: [-98, 39],
    Canada: [-106, 56], CA: [-106, 56],
    Mexico: [-102, 23], MX: [-102, 23],
    Brazil: [-52, -10], BR: [-52, -10],
    Argentina: [-64, -34], AR: [-64, -34],
    "United Kingdom": [-2, 54], GB: [-2, 54], UK: [-2, 54],
    Ireland: [-8, 53], IE: [-8, 53],
    France: [2, 46], FR: [2, 46],
    Germany: [10, 51], DE: [10, 51],
    Netherlands: [5, 52], NL: [5, 52],
    Spain: [-4, 40], ES: [-4, 40],
    Italy: [12, 43], IT: [12, 43],
    Poland: [19, 52], PL: [19, 52],
    Ukraine: [31, 49], UA: [31, 49],
    Russia: [90, 61], RU: [90, 61],
    Turkey: [35, 39], TR: [35, 39],
    Israel: [35, 31], IL: [35, 31],
    India: [78, 22], IN: [78, 22],
    China: [104, 35], CN: [104, 35],
    Japan: [138, 37], JP: [138, 37],
    "South Korea": [128, 36], KR: [128, 36],
    Australia: [134, -25], AU: [134, -25],
    "New Zealand": [172, -42], NZ: [172, -42],
    "South Africa": [24, -29], ZA: [24, -29],
    Nigeria: [8, 9], NG: [8, 9],
    Egypt: [30, 27], EG: [30, 27]
};

const state = {
    messages: [],
    accessCode: rememberedAccess,
    latestRequest: "",
    proposalId: "",
    uploadedImage: null,
    countries: [],
    entries: [],
    selectedEntryId: "",
    selectedFigures: []
};

const mapCountryByKey = new Map();

function setDashboardUnlocked(isUnlocked) {
    accessRow.hidden = isUnlocked;
    rememberRow.hidden = isUnlocked;
    sessionRow.hidden = !isUnlocked;
    composer.hidden = !isUnlocked;
    proposalPanel.hidden = !isUnlocked;
    entriesPanel.hidden = !isUnlocked;
    commentsPanel.hidden = !isUnlocked;
    newsletterPanel.hidden = !isUnlocked;
    uploadPreview.hidden = !isUnlocked || !state.uploadedImage;
}

setDashboardUnlocked(false);

function addMessage(role, text, isError = false) {
    state.messages.push({ role, content: text });
    const article = document.createElement("article");
    article.className = `message ${role}${isError ? " error" : ""}`;
    text.split("\n\n").forEach((part) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = part;
        article.appendChild(paragraph);
    });
    messagesEl.appendChild(article);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBusy(isBusy) {
    sendButton.disabled = isBusy;
    promptEl.disabled = isBusy;
    sendButton.textContent = isBusy ? "Thinking" : "Send";
}

function setPushStatus(text, type = "") {
    pushStatus.textContent = text;
    pushStatus.className = `push-status ${type}`.trim();
}

function setEntryStatus(text, type = "") {
    entryStatus.textContent = text;
    entryStatus.className = `push-status ${type}`.trim();
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72);
}

function liveUrlForEntry(entry) {
    if (!entry) return "#";
    if (entry.livePath) {
        return `https://youarestillinsideit.com/${entry.livePath.replace(/index\.html$/, "")}`;
    }
    if (entry.type === "field-observation") return `https://youarestillinsideit.com/field-observations/${entry.slug}/`;
    if (entry.type === "interview") return `https://youarestillinsideit.com/interview/`;
    return `https://youarestillinsideit.com/dispatches/${entry.slug}/`;
}

function typeLabel(type) {
    if (type === "field-observation") return "Field Observation";
    if (type === "interview") return "Interview";
    return "Dispatch";
}

function contentBlocks(text = entryContent.value) {
    return String(text || "")
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);
}

function figurePreviewUrl(src) {
    const value = String(src || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    const cleaned = value.replace(/^(\.\.\/)+/, "").replace(/^\//, "");
    return `https://youarestillinsideit.com/${cleaned}`;
}

function blockLabel(block, index) {
    const plain = String(block || "").replace(/^##\s+/, "").replace(/\s+/g, " ").trim();
    const snippet = plain.length > 72 ? `${plain.slice(0, 69)}…` : plain;
    return snippet ? `After ¶${index + 1}: ${snippet}` : `After ¶${index + 1}`;
}

function renderFiguresPanel() {
    const figures = Array.isArray(state.selectedFigures) ? state.selectedFigures : [];
    const blocks = contentBlocks();
    entryFiguresGrid.innerHTML = "";

    if (!figures.length) {
        entryFigures.hidden = true;
        entryDraftPreview.hidden = true;
        entryDraftPreviewBody.innerHTML = "";
        return;
    }

    entryFigures.hidden = false;
    const stale = figures.some((figure) => {
        const after = Number.isInteger(figure.afterIndex) ? figure.afterIndex : -1;
        return after >= blocks.length;
    });
    entryFiguresNote.textContent = stale
        ? `${figures.length} image${figures.length === 1 ? "" : "s"} attached. One or more placements are past the end of the text — edit carefully before Publish.`
        : `${figures.length} image${figures.length === 1 ? "" : "s"} attached separately from the text box. They stay with Save / Publish.`;

    figures.forEach((figure, figureIndex) => {
        const after = Number.isInteger(figure.afterIndex) ? figure.afterIndex : -1;
        const card = document.createElement("article");
        card.className = "entry-figure-card";
        if (after >= blocks.length) card.classList.add("is-stale");

        const img = document.createElement("img");
        img.src = figurePreviewUrl(figure.src);
        img.alt = figure.alt || figure.caption || `Figure ${figureIndex + 1}`;
        img.loading = "lazy";

        const meta = document.createElement("div");
        meta.className = "entry-figure-meta";

        const caption = document.createElement("strong");
        caption.textContent = figure.caption || figure.alt || `Figure ${figureIndex + 1}`;

        const placement = document.createElement("span");
        if (after < 0) {
            placement.textContent = "Before first paragraph";
        } else if (after >= blocks.length) {
            placement.textContent = `After ¶${after + 1} (missing — text shorter now)`;
        } else {
            placement.textContent = blockLabel(blocks[after], after);
        }

        meta.append(caption, placement);
        card.append(img, meta);
        entryFiguresGrid.appendChild(card);
    });

    renderDraftPreview(blocks, figures);
}

function renderDraftPreview(blocks = contentBlocks(), figures = state.selectedFigures) {
    entryDraftPreviewBody.innerHTML = "";
    if (!figures.length && !blocks.length) {
        entryDraftPreview.hidden = true;
        return;
    }

    entryDraftPreview.hidden = false;
    const byAfter = new Map();
    figures.forEach((figure) => {
        const key = Number.isInteger(figure.afterIndex) ? figure.afterIndex : -1;
        if (!byAfter.has(key)) byAfter.set(key, []);
        byAfter.get(key).push(figure);
    });

    const appendFigures = (key) => {
        (byAfter.get(key) || []).forEach((figure) => {
            const figureEl = document.createElement("figure");
            const img = document.createElement("img");
            img.src = figurePreviewUrl(figure.src);
            img.alt = figure.alt || "";
            img.loading = "lazy";
            const caption = document.createElement("figcaption");
            caption.textContent = figure.caption || figure.alt || "";
            figureEl.append(img, caption);
            entryDraftPreviewBody.appendChild(figureEl);
        });
    };

    appendFigures(-1);
    blocks.forEach((block, index) => {
        if (block.startsWith("## ")) {
            const heading = document.createElement("h4");
            heading.textContent = block.slice(3).trim();
            entryDraftPreviewBody.appendChild(heading);
        } else {
            const paragraph = document.createElement("p");
            paragraph.textContent = block;
            entryDraftPreviewBody.appendChild(paragraph);
        }
        appendFigures(index);
    });
}

function currentEntryPayload() {
    return {
        id: state.selectedEntryId,
        type: entryType.value,
        title: entryTitle.value.trim(),
        kicker: entryKicker.value.trim(),
        slug: entrySlug.value.trim() || slugify(entryTitle.value),
        deck: entryDeck.value.trim(),
        byline: entryByline.value.trim(),
        excerpt: entryExcerpt.value.trim(),
        content: entryContent.value.trim(),
        figures: state.selectedFigures
    };
}

function clearEntryEditor() {
    state.selectedEntryId = "";
    state.selectedFigures = [];
    entryType.value = "field-observation";
    entryTitle.value = "";
    entryKicker.value = "";
    entrySlug.value = "";
    entryDeck.value = "";
    entryByline.value = "";
    entryExcerpt.value = "";
    entryContent.value = "";
    deleteEntry.disabled = true;
    viewEntry.hidden = true;
    setEntryStatus("");
    renderFiguresPanel();
    entryTitle.focus();
}

function selectEntry(entry) {
    state.selectedEntryId = entry.id;
    state.selectedFigures = Array.isArray(entry.figures) ? entry.figures.map((figure) => ({ ...figure })) : [];
    entryType.value = entry.type || "dispatch";
    entryTitle.value = entry.title || "";
    entryKicker.value = entry.kicker || "";
    entrySlug.value = entry.slug || "";
    entryDeck.value = entry.deck || "";
    entryByline.value = entry.byline || "";
    entryExcerpt.value = entry.excerpt || "";
    entryContent.value = entry.content || "";
    deleteEntry.disabled = false;
    viewEntry.hidden = entry.status !== "published";
    viewEntry.href = liveUrlForEntry(entry);
    const figureCount = state.selectedFigures.length;
    setEntryStatus(
        `${typeLabel(entry.type)} · ${entry.status === "published" ? "Published" : "Draft"} loaded`
        + (figureCount ? ` · ${figureCount} inline image${figureCount === 1 ? "" : "s"}` : "")
        + "."
    );
    renderFiguresPanel();
}

function formatEntryDate(value) {
    if (!value) return "not published";
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function renderEntryList(container, entries, emptyText) {
    container.innerHTML = "";
    if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "entry-list-empty";
        empty.textContent = emptyText;
        container.appendChild(empty);
        return;
    }

    entries.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        const title = document.createElement("strong");
        title.textContent = entry.title;
        const meta = document.createElement("span");
        const figureCount = Array.isArray(entry.figures) ? entry.figures.length : 0;
        const figureNote = figureCount ? ` · ${figureCount} img` : "";
        meta.textContent = `${typeLabel(entry.type)} · /${entry.slug || "draft"}/${figureNote} · ${entry.status === "published" ? formatEntryDate(entry.publishedAt) : `updated ${formatEntryDate(entry.updatedAt)}`}`;
        button.append(title, meta);
        button.addEventListener("click", () => selectEntry(entry));
        container.appendChild(button);
    });
}

function renderEntries(entries) {
    state.entries = Array.isArray(entries) ? entries : [];
    renderEntryList(
        draftEntryList,
        state.entries.filter((entry) => entry.status !== "published"),
        "No draft posts yet."
    );
    renderEntryList(
        publishedEntryList,
        state.entries.filter((entry) => entry.status === "published"),
        "No published posts yet. Seeded Field Observations appear after unlock."
    );
}

async function entriesRequest(path, payload = null) {
    const options = {
        headers: { "X-Lethe-Access": state.accessCode }
    };
    if (payload) {
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
    }

    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Entry request failed.");
    return data;
}

function setCommentsStatus(text, type = "") {
    commentsStatus.textContent = text;
    commentsStatus.className = `push-status ${type}`.trim();
}

function formatCommentDate(value) {
    if (!value) return "unknown date";
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function renderCommentsModeration(comments, summary) {
    commentsList.innerHTML = "";
    const pendingCount = summary?.pendingCount || 0;
    if (pendingCount > 0) {
        commentsPendingBadge.hidden = false;
        commentsPendingBadge.textContent = `${pendingCount} pending`;
    } else {
        commentsPendingBadge.hidden = true;
        commentsPendingBadge.textContent = "";
    }

    const pending = (comments || []).filter((comment) => comment.status === "pending");
    const others = (comments || []).filter((comment) => comment.status !== "pending").slice(0, 8);
    const visible = [...pending, ...others];

    if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "comments-empty";
        empty.textContent = "No comments yet.";
        commentsList.appendChild(empty);
        return;
    }

    visible.forEach((comment) => {
        const card = document.createElement("article");
        card.className = `comment-card comment-${comment.status}`;

        const title = document.createElement("strong");
        title.textContent = comment.postTitle || comment.postSlug;

        const meta = document.createElement("span");
        meta.className = "comment-card-meta";
        meta.textContent = `${comment.authorName} · ${comment.authorEmail} · ${comment.status} · ${formatCommentDate(comment.createdAt)}`;

        const body = document.createElement("p");
        body.className = "comment-card-body";
        body.textContent = comment.body;

        const actions = document.createElement("div");
        actions.className = "comment-card-actions";

        if (comment.status === "pending") {
            actions.append(
                createCommentActionButton("Approve", "approve", comment.id),
                createCommentActionButton("Reject", "reject", comment.id),
                createCommentActionButton("Spam", "spam", comment.id)
            );
        } else {
            actions.append(createCommentActionButton("Delete", "delete", comment.id));
        }

        if (comment.postUrl) {
            const link = document.createElement("a");
            link.className = "ghost-button compact-button";
            link.href = comment.postUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View post";
            actions.appendChild(link);
        }

        card.append(title, meta, body, actions);
        commentsList.appendChild(card);
    });
}

function createCommentActionButton(label, action, id) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action === "approve" ? "" : "ghost-button";
    button.textContent = label;
    button.addEventListener("click", () => moderateComment(id, action));
    return button;
}

async function commentsRequest(path, payload = null) {
    const options = {
        headers: { "X-Lethe-Access": state.accessCode }
    };
    if (payload) {
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
    }
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Comment request failed.");
    }
    return data;
}

async function loadCommentsModeration() {
    if (!state.accessCode) return;
    setCommentsStatus("Loading comments…");
    try {
        const [summary, moderation] = await Promise.all([
            commentsRequest("/api/comments/summary"),
            commentsRequest("/api/comments/moderation")
        ]);
        renderCommentsModeration(moderation.comments, summary);
        if (summary.pendingCount > 0) {
            setCommentsStatus(`${summary.pendingCount} comment${summary.pendingCount === 1 ? "" : "s"} waiting for review.`, "success");
        } else {
            setCommentsStatus("No pending comments.", "success");
        }
    } catch (error) {
        setCommentsStatus(error.message, "error");
    }
}

async function moderateComment(id, action) {
    setCommentsStatus(`${action === "approve" ? "Approving" : "Updating"} comment…`);
    try {
        const data = await commentsRequest("/api/comments/moderate", { id, action });
        renderCommentsModeration(data.comments, data.summary);
        const pending = data.summary?.pendingCount || 0;
        setCommentsStatus(
            pending > 0 ? `${pending} comment${pending === 1 ? "" : "s"} still pending.` : "Comment updated.",
            "success"
        );
    } catch (error) {
        setCommentsStatus(error.message, "error");
    }
}

async function newsletterRequest(path, payload = null) {
    const options = {
        headers: { "X-Lethe-Access": state.accessCode }
    };
    if (payload) {
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
    }
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Newsletter request failed.");
    }
    return data;
}

function setNewsletterStatus(text, type = "") {
    newsletterStatus.textContent = text;
    newsletterStatus.className = `push-status ${type}`.trim();
}

function renderNewsletterSummary(summary) {
    const confirmed = summary?.confirmedCount || 0;
    newsletterConfirmedBadge.textContent = `${confirmed} confirmed`;
    newsletterStats.innerHTML = "";
    [
        ["Confirmed", summary?.confirmedCount || 0],
        ["Pending confirmation", summary?.pendingCount || 0],
        ["Unsubscribed", summary?.unsubscribedCount || 0],
        ["Issues sent", summary?.issuesSent || 0]
    ].forEach(([label, value]) => {
        const item = document.createElement("span");
        item.textContent = `${label}: ${value}`;
        newsletterStats.appendChild(item);
    });
    if (summary?.lastSentAt) {
        const last = document.createElement("span");
        last.textContent = `Last sent: ${formatCommentDate(summary.lastSentAt)}`;
        newsletterStats.appendChild(last);
    }
}

function renderNewsletterIssues(issues) {
    newsletterIssues.innerHTML = "";
    if (!issues?.length) {
        const empty = document.createElement("p");
        empty.className = "newsletter-empty";
        empty.textContent = "No issues sent yet.";
        newsletterIssues.appendChild(empty);
        return;
    }

    issues.forEach((issue) => {
        const card = document.createElement("article");
        card.className = "newsletter-issue-card";
        const title = document.createElement("strong");
        title.textContent = issue.subject;
        const meta = document.createElement("span");
        meta.textContent = `${issue.status} · ${issue.recipientCount || 0} recipient${issue.recipientCount === 1 ? "" : "s"} · ${formatCommentDate(issue.sentAt || issue.createdAt)}`;
        card.append(title, document.createElement("br"), meta);
        newsletterIssues.appendChild(card);
    });
}

function renderNewsletterSubscribers(subscribers) {
    newsletterSubscribers.innerHTML = "";
    if (!subscribers?.length) {
        const empty = document.createElement("p");
        empty.className = "newsletter-empty";
        empty.textContent = "No subscribers yet.";
        newsletterSubscribers.appendChild(empty);
        return;
    }

    subscribers.forEach((subscriber) => {
        const row = document.createElement("div");
        row.className = "newsletter-subscriber-row";
        const line = document.createElement("span");
        line.textContent = `${subscriber.email}${subscriber.name ? ` · ${subscriber.name}` : ""}`;
        const meta = document.createElement("span");
        meta.textContent = `${subscriber.status} · ${formatCommentDate(subscriber.updatedAt || subscriber.createdAt)}`;
        row.append(line, meta);
        newsletterSubscribers.appendChild(row);
    });
}

async function loadNewsletterPanel() {
    if (!state.accessCode) return;
    setNewsletterStatus("Loading newsletter…");
    try {
        const [summary, subscribersData, issuesData] = await Promise.all([
            newsletterRequest("/api/newsletter/summary"),
            newsletterRequest("/api/newsletter/subscribers"),
            newsletterRequest("/api/newsletter/issues")
        ]);
        renderNewsletterSummary(summary);
        renderNewsletterSubscribers(subscribersData.subscribers);
        renderNewsletterIssues(issuesData.issues);
        setNewsletterStatus(`${summary.confirmedCount || 0} confirmed subscriber${summary.confirmedCount === 1 ? "" : "s"}.`, "success");
    } catch (error) {
        setNewsletterStatus(error.message, "error");
    }
}

function currentNewsletterPayload(testEmail = "") {
    return {
        subject: newsletterSubject.value.trim(),
        body: newsletterBody.value.trim(),
        testEmail: testEmail.trim()
    };
}

async function sendNewsletterTest() {
    const testEmail = newsletterTestEmail.value.trim();
    if (!testEmail) {
        setNewsletterStatus("Enter a test email address first.", "error");
        newsletterTestEmail.focus();
        return;
    }
    newsletterTestSend.disabled = true;
    setNewsletterStatus("Sending test…");
    try {
        const data = await newsletterRequest("/api/newsletter/send", currentNewsletterPayload(testEmail));
        setNewsletterStatus(data.message || "Test sent.", "success");
        await loadNewsletterPanel();
    } catch (error) {
        setNewsletterStatus(error.message, "error");
    } finally {
        newsletterTestSend.disabled = false;
    }
}

async function sendNewsletterToAll() {
    const payload = currentNewsletterPayload();
    if (!payload.subject || payload.body.length < 20) {
        setNewsletterStatus("Subject and body (at least 20 characters) are required.", "error");
        return;
    }
    const countMatch = newsletterConfirmedBadge.textContent.match(/(\d+)/);
    const recipientCount = countMatch ? Number(countMatch[1]) : 0;
    const confirmedText = recipientCount === 1 ? "1 subscriber" : `${recipientCount} subscribers`;
    const proceed = window.confirm(`Send "${payload.subject}" to ${confirmedText}? This cannot be undone.`);
    if (!proceed) return;

    newsletterSendAll.disabled = true;
    setNewsletterStatus("Sending newsletter…");
    try {
        const data = await newsletterRequest("/api/newsletter/send", payload);
        setNewsletterStatus(data.message || "Newsletter sent.", "success");
        await loadNewsletterPanel();
    } catch (error) {
        setNewsletterStatus(error.message, "error");
    } finally {
        newsletterSendAll.disabled = false;
    }
}

async function loadEntries() {
    if (!state.accessCode) return;

    try {
        const data = await entriesRequest("/api/entries");
        renderEntries(data.entries);
    } catch (error) {
        setEntryStatus(error.message, "error");
    }
}

async function submitEntry(action) {
    if (!state.accessCode) {
        setEntryStatus("Enter the access code first.", "error");
        accessCode.focus();
        return;
    }

    const payload = currentEntryPayload();
    if (!payload.title) {
        setEntryStatus("Entry title is required.", "error");
        entryTitle.focus();
        return;
    }

    const button = action === "publish" ? publishEntry : saveEntryDraft;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = action === "publish" ? "Publishing" : "Saving";
    setEntryStatus(action === "publish" ? "Publishing Dispatches to GitHub..." : "Saving draft Entry...");

    try {
        const data = await entriesRequest(action === "publish" ? "/api/entries/publish" : "/api/entries/save", payload);
        renderEntries(data.entries);
        selectEntry(data.entry);
        const suffix = data.commit ? ` Commit ${data.commit}.` : "";
        setEntryStatus(action === "publish" ? `Published Dispatch.${suffix}` : "Draft Entry saved.", "success");
    } catch (error) {
        setEntryStatus(error.message, "error");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function removeSelectedEntry() {
    if (!state.selectedEntryId) return;
    const entry = state.entries.find((candidate) => candidate.id === state.selectedEntryId);
    const confirmed = window.confirm(`Delete "${entry?.title || "this Entry"}"? Published Dispatches will be regenerated.`);
    if (!confirmed) return;

    deleteEntry.disabled = true;
    setEntryStatus("Deleting Entry...");
    try {
        const data = await entriesRequest("/api/entries/delete", { id: state.selectedEntryId });
        renderEntries(data.entries);
        clearEntryEditor();
        const suffix = data.commit ? ` Commit ${data.commit}.` : "";
        setEntryStatus(`Entry deleted.${suffix}`, "success");
    } catch (error) {
        deleteEntry.disabled = false;
        setEntryStatus(error.message, "error");
    }
}

function renderUploadedImage() {
    uploadPreview.innerHTML = "";
    if (!state.uploadedImage) {
        uploadPreview.hidden = true;
        return;
    }

    const image = document.createElement("img");
    image.src = state.uploadedImage.dataUrl;
    image.alt = "";
    const label = document.createElement("span");
    label.textContent = `Attached: ${state.uploadedImage.name}`;
    uploadPreview.append(image, label);
    uploadPreview.hidden = false;
}

async function unlockDashboard(code, { silent = false } = {}) {
    const cleanCode = String(code || "").trim();
    const response = await fetch(`${API_BASE}/api/visits`, {
        headers: { "X-Lethe-Access": cleanCode }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Access code did not work.");

    state.accessCode = cleanCode;
    if (rememberAccess.checked) {
        localStorage.setItem("letheDashboardAccess", state.accessCode);
        sessionStorage.removeItem("letheDashboardAccess");
    } else {
        sessionStorage.setItem("letheDashboardAccess", state.accessCode);
        localStorage.removeItem("letheDashboardAccess");
    }
    setDashboardUnlocked(true);
    renderVisits(data);
    await loadEntries();
    await loadCommentsModeration();
    await loadNewsletterPanel();
    if (!silent) promptEl.focus();
}

function lockSession() {
    sessionStorage.removeItem("letheDashboardAccess");
    localStorage.removeItem("letheDashboardAccess");
    state.accessCode = "";
    accessCode.value = "";
    setDashboardUnlocked(false);
    clearEntryEditor();
    renderEntries([]);
}

saveCode.addEventListener("click", async () => {
    const code = accessCode.value.trim();
    if (!code) return;

    saveCode.disabled = true;
    saveCode.textContent = "Checking";

    try {
        await unlockDashboard(code);
    } catch (error) {
        lockSession();
        addMessage("assistant", error.message, true);
        accessCode.focus();
    } finally {
        saveCode.disabled = false;
        saveCode.textContent = "Unlock";
    }
});

lockDashboard.addEventListener("click", () => {
    lockSession();
    addMessage("assistant", "Locked. Enter the access code to continue.");
});

clearChat.addEventListener("click", () => {
    state.messages = [];
    messagesEl.innerHTML = "";
    addMessage("assistant", "Fresh page. What change should we shape next?");
});

entryContent.addEventListener("input", () => {
    if (state.selectedFigures.length) renderFiguresPanel();
});

newEntry.addEventListener("click", clearEntryEditor);

entryTitle.addEventListener("input", () => {
    if (!state.selectedEntryId || !entrySlug.value.trim()) {
        entrySlug.value = slugify(entryTitle.value);
    }
});

saveEntryDraft.addEventListener("click", () => submitEntry("draft"));
publishEntry.addEventListener("click", () => submitEntry("publish"));
deleteEntry.addEventListener("click", removeSelectedEntry);

imageUpload.addEventListener("change", () => {
    const file = imageUpload.files[0];
    state.uploadedImage = null;

    if (!file) {
        renderUploadedImage();
        return;
    }

    if (!file.type.startsWith("image/")) {
        setPushStatus("Attach an image file: JPG, PNG, WEBP, or GIF.", "error");
        imageUpload.value = "";
        renderUploadedImage();
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setPushStatus("Use an image under 5 MB for now.", "error");
        imageUpload.value = "";
        renderUploadedImage();
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
        state.uploadedImage = {
            name: file.name,
            type: file.type,
            dataUrl: reader.result
        };
        renderUploadedImage();
        setPushStatus("Image attached. Describe where it should go, then Generate Preview.", "success");
    });
    reader.readAsDataURL(file);
});

composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = promptEl.value.trim();
    if (!prompt) return;

    if (!state.accessCode) {
        addMessage("assistant", "Enter the access code first, then send the note again.", true);
        accessCode.focus();
        return;
    }

    promptEl.value = "";
    state.latestRequest = prompt;
    addMessage("user", prompt);
    setBusy(true);

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({ messages: state.messages.slice(-12) })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "The dashboard service did not answer.");
        }

        addMessage("assistant", data.reply);
    } catch (error) {
        addMessage("assistant", error.message, true);
    } finally {
        setBusy(false);
        promptEl.focus();
    }
});

generatePreview.addEventListener("click", async () => {
    if (!state.accessCode) {
        setPushStatus("Enter the access code first.", "error");
        accessCode.focus();
        return;
    }

    const request = state.latestRequest || promptEl.value.trim();
    if (!request) {
        setPushStatus("Send or type a change request first.", "error");
        return;
    }

    generatePreview.disabled = true;
    pushProposal.disabled = true;
    generatePreview.textContent = "Generating";
    state.proposalId = "";
    setPushStatus("Generating a preview from the latest request...");

    try {
        const response = await fetch(`${API_BASE}/api/propose`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({
                request,
                uploadedImage: state.uploadedImage
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Could not generate preview.");
        }

        state.proposalId = data.id;
        proposalSummary.innerHTML = "";
        const heading = document.createElement("strong");
        heading.textContent = data.summary;
        const list = document.createElement("ul");
        data.operations.forEach((operation) => {
            const item = document.createElement("li");
            item.textContent = operation;
            list.appendChild(item);
        });
        proposalSummary.append(heading, list);
        proposalPreview.srcdoc = data.previewHtml;
        pushProposal.disabled = false;
        setPushStatus("Preview ready. Review it, then push that exact draft live.", "success");
    } catch (error) {
        setPushStatus(error.message, "error");
    } finally {
        generatePreview.disabled = false;
        generatePreview.textContent = "Generate Preview";
    }
});

pushProposal.addEventListener("click", async () => {
    if (!state.proposalId) {
        setPushStatus("Generate a preview first.", "error");
        return;
    }

    pushProposal.disabled = true;
    setPushStatus("Committing the preview to GitHub...");

    try {
        const response = await fetch(`${API_BASE}/api/push-proposal`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({ proposalId: state.proposalId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Push failed.");
        setPushStatus(`Pushed preview live. Commit ${data.commit}. Hostinger will deploy it shortly.`, "success");
        addMessage("assistant", `I pushed the reviewed preview live. Commit: ${data.commit}.`);
        state.proposalId = "";
    } catch (error) {
        setPushStatus(error.message, "error");
        pushProposal.disabled = false;
    }
});

async function loadVisits() {
    if (!state.accessCode) return;

    try {
        const response = await fetch(`${API_BASE}/api/visits`, {
            headers: { "X-Lethe-Access": state.accessCode }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load visits.");

        renderVisits(data);
    } catch (error) {
        countryList.innerHTML = "";
        const row = document.createElement("div");
        row.className = "country-row";
        row.textContent = error.message;
        countryList.appendChild(row);
    }
}

function renderVisits(data) {
    visitsTotal.textContent = data.totalVisits;
    visitsCountries.textContent = data.countries.length;
    countryList.innerHTML = "";
    state.countries = data.countries;
    renderVisitorMap(data.countries);

    if (!data.countries.length) {
        const empty = document.createElement("div");
        empty.className = "country-row";
        empty.textContent = "No visits recorded yet.";
        countryList.appendChild(empty);
        return;
    }

    data.countries.slice(0, 8).forEach((country) => {
        const row = document.createElement("div");
        row.className = "country-row";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `Show details for ${country.country}`);
        const name = document.createElement("span");
        name.textContent = country.country;
        const count = document.createElement("span");
        count.textContent = country.count;
        row.append(name, count);
        row.addEventListener("click", () => showCountryDetail(country));
        row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showCountryDetail(country);
            }
        });
        countryList.appendChild(row);
    });
}

function coordinateToPoint(lon, lat) {
    return {
        x: ((lon + 180) / 360) * 960,
        y: ((90 - lat) / 180) * 500
    };
}

function getCountryCoordinate(country) {
    const name = country.country || "";
    if (Number.isFinite(country.longitude) && Number.isFinite(country.latitude)) {
        return [country.longitude, country.latitude];
    }
    return countryCoordinates[name] || countryCoordinates[name.toUpperCase()] || countryCoordinates[country.countryCode] || null;
}

function renderVisitorMap(countries) {
    visitorMapDots.innerHTML = "";
    mapCountryByKey.clear();
    const mapped = countries
        .map((country) => ({ ...country, coordinate: getCountryCoordinate(country) }))
        .filter((country) => country.coordinate);

    visitorMapEmpty.hidden = mapped.length > 0;

    if (!mapped.length) return;

    const maxCount = Math.max(...mapped.map((country) => country.count));
    mapped.slice(0, 24).forEach((country) => {
        const [lon, lat] = country.coordinate;
        const point = coordinateToPoint(lon, lat);
        const radius = 5 + Math.sqrt(country.count / maxCount) * 14;
        const countryKey = country.countryCode || country.country;
        mapCountryByKey.set(countryKey, country);

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("class", "visitor-marker");
        group.setAttribute("tabindex", "0");
        group.setAttribute("role", "button");
        group.setAttribute("aria-label", `Show visitor details for ${country.country}`);
        group.setAttribute("data-country-key", countryKey);
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${country.country}: ${country.count} visits`;

        const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        halo.setAttribute("class", "visitor-halo");
        halo.setAttribute("cx", point.x);
        halo.setAttribute("cy", point.y);
        halo.setAttribute("r", radius * 1.9);

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("class", "visitor-dot");
        dot.setAttribute("cx", point.x);
        dot.setAttribute("cy", point.y);
        dot.setAttribute("r", radius);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "visitor-label");
        label.setAttribute("x", point.x + radius + 5);
        label.setAttribute("y", point.y + 4);
        label.textContent = country.country.length > 14 ? country.country.slice(0, 12) : country.country;

        group.append(title, halo, dot, label);
        group.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showCountryDetail(country);
            }
        });
        visitorMapDots.appendChild(group);
    });
}

visitorMapDots.addEventListener("click", (event) => {
    const marker = event.target.closest(".visitor-marker");
    if (!marker) return;
    const country = mapCountryByKey.get(marker.getAttribute("data-country-key"));
    if (country) showCountryDetail(country);
});

function formatLocation(entry) {
    return [entry.city, entry.region].filter(Boolean).join(", ") || "Unknown town/region";
}

function formatVisitTime(value) {
    if (!value) return "Unknown time";
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function createDetailSection(title, items, emptyText) {
    const section = document.createElement("section");
    section.className = "map-detail-section";
    const heading = document.createElement("h5");
    heading.textContent = title;
    section.appendChild(heading);

    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "map-detail-note";
        empty.textContent = emptyText;
        section.appendChild(empty);
        return section;
    }

    items.forEach((item) => section.appendChild(item));
    return section;
}

function showCountryDetail(country) {
    mapDetailTitle.textContent = `${country.country} / ${country.count} visit${country.count === 1 ? "" : "s"}`;
    mapDetailBody.innerHTML = "";

    const cityRows = (country.cities || []).slice(0, 10).map((city) => {
        const row = document.createElement("div");
        row.className = "map-detail-row";
        const name = document.createElement("span");
        name.textContent = formatLocation(city);
        const count = document.createElement("span");
        count.textContent = city.count;
        row.append(name, count);
        return row;
    });

    const visitRows = (country.recent || []).slice(0, 8).map((visit) => {
        const row = document.createElement("div");
        row.className = "map-detail-visit";
        const title = document.createElement("strong");
        title.textContent = `${formatVisitTime(visit.ts)} / ${formatLocation(visit)}`;
        const path = document.createElement("span");
        path.textContent = `Page: ${visit.path || "/"}`;
        const source = document.createElement("span");
        source.textContent = `Source: ${visit.referrer || "direct / unknown"}`;
        const device = document.createElement("span");
        device.textContent = `Device: ${visit.device || "unknown"}${visit.browser ? ` / ${visit.browser}` : ""}`;
        const locale = document.createElement("span");
        locale.textContent = `Locale: ${[visit.language, visit.timezone].filter(Boolean).join(" / ") || "unknown"}`;
        row.append(title, path, source, device, locale);
        return row;
    });

    const note = document.createElement("p");
    note.className = "map-detail-note";
    note.textContent = "Gender, identity, names, and exact locations are not provided by browsers and are not collected here.";

    mapDetailBody.append(
        createDetailSection("Towns / regions", cityRows, "Town and region details will appear for visits recorded after the enriched tracking update."),
        createDetailSection("Recent visits", visitRows, "Recent visit details will appear after new traffic is recorded."),
        note
    );
    visitorMapDetail.hidden = false;
    visitorMapDetail.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

mapDetailClose.addEventListener("click", () => {
    visitorMapDetail.hidden = true;
});

refreshVisits.addEventListener("click", loadVisits);
refreshComments.addEventListener("click", loadCommentsModeration);
refreshNewsletter.addEventListener("click", loadNewsletterPanel);
newsletterTestSend.addEventListener("click", sendNewsletterTest);
newsletterSendAll.addEventListener("click", sendNewsletterToAll);

if (state.accessCode) {
    accessCode.value = state.accessCode;
    unlockDashboard(state.accessCode, { silent: true }).catch(() => {
        sessionStorage.removeItem("letheDashboardAccess");
        localStorage.removeItem("letheDashboardAccess");
        state.accessCode = "";
        accessCode.value = "";
        setDashboardUnlocked(false);
    });
}
