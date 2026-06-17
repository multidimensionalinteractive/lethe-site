const SITE_TITLE = "YOU ARE STILL INSIDE IT";
const DEFAULT_IMAGE = "assets/barikardy-factory-november-1942.jpg";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72) || "untitled-entry";
}

function plainSummary(value, fallback = "") {
    return String(value || fallback || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 220);
}

function normalizeEntry(input, existing = {}) {
    const now = new Date().toISOString();
    const title = String(input?.title || existing.title || "").trim();
    const content = String(input?.content || existing.content || "").trim();
    const excerpt = String(input?.excerpt || existing.excerpt || plainSummary(content)).trim();
    const requestedSlug = String(input?.slug || existing.slug || title || "").trim();
    const status = input?.status === "published" ? "published" : "draft";

    if (!title) throw new Error("Entry title is required.");
    if (status === "published" && !content) throw new Error("Published entries need body content.");

    return {
        id: String(input?.id || existing.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
        title,
        slug: slugify(requestedSlug || title),
        excerpt,
        content,
        status,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        publishedAt: status === "published" ? (existing.publishedAt || now) : (existing.publishedAt || "")
    };
}

function formatDate(value) {
    if (!value) return "Draft";
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function renderRichText(text) {
    const blocks = String(text || "")
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);

    if (!blocks.length) return "<p>Entry text forthcoming.</p>";

    return blocks.map((block) => {
        if (block.startsWith("## ")) {
            return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
        }

        if (block.startsWith("### ")) {
            return `<h3>${escapeHtml(block.slice(4).trim())}</h3>`;
        }

        const listItems = block
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => /^[-*]\s+/.test(line));
        if (listItems.length && listItems.length === block.split("\n").filter(Boolean).length) {
            return `<ul class="text-list">${listItems.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
        }

        return `<p>${block.split("\n").map((line) => escapeHtml(line.trim())).join("<br>")}</p>`;
    }).join("\n");
}

function renderNav(prefix) {
    return `<nav class="site-nav" aria-label="Primary navigation">
        <a class="nav-mark" href="${prefix}">
            <img src="${prefix}assets/favicon-lethe.jpg" alt="" aria-hidden="true">
            <span>${SITE_TITLE}</span>
        </a>
        <div class="nav-links">
            <a href="${prefix}#statement">Statement</a>
            <a href="${prefix}#witnesses">Witnesses</a>
            <a href="${prefix}#archive">Archive</a>
            <a href="${prefix}field-observations/">Field Observations</a>
            <a href="${prefix}dispatches/">Dispatches</a>
            <a href="${prefix}#contact">Contact</a>
        </div>
    </nav>`;
}

function renderHead({ title, description, canonical, prefix, type = "website" }) {
    const image = `https://youarestillinsideit.com/${DEFAULT_IMAGE}`;
    return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:site_name" content="${SITE_TITLE}">
    <meta property="og:type" content="${type}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1280">
    <meta property="og:image:height" content="631">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">
    <link rel="icon" type="image/jpeg" href="${prefix}assets/favicon-lethe.jpg">
    <link rel="apple-touch-icon" href="${prefix}assets/favicon-lethe.jpg">
    <link rel="stylesheet" href="${prefix}styles.css?v=dispatches-marker-lightbox-20260616">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap" rel="stylesheet">
</head>`;
}

function renderDispatchIndex(entries) {
    const published = entries.filter((entry) => entry.status === "published");
    const cards = published.length ? published.map((entry, index) => `<a class="dispatch-card" href="${escapeHtml(entry.slug)}/">
                <span class="dispatch-number">${String(index + 1).padStart(3, "0")}</span>
                <div>
                    <p class="dispatch-date">${escapeHtml(formatDate(entry.publishedAt))}</p>
                    <h2>${escapeHtml(entry.title)}</h2>
                    <p>${escapeHtml(entry.excerpt || plainSummary(entry.content))}</p>
                </div>
                <span class="dispatch-status">posted</span>
            </a>`).join("\n") : `<article class="dispatch-empty">
                <p class="kicker">entries forthcoming</p>
                <h2>No Dispatches posted yet.</h2>
                <p>Published entries from the private dashboard will appear here.</p>
            </article>`;

    return `<!DOCTYPE html>
<html lang="en">
${renderHead({
    title: `Dispatches | ${SITE_TITLE}`,
    description: "Dispatches, studio notes, and published entries from the YOU ARE STILL INSIDE IT archive.",
    canonical: "https://youarestillinsideit.com/dispatches/",
    prefix: "../"
})}
<body class="dispatches-page">
    ${renderNav("../")}

    <header class="observations-hero dispatches-hero">
        <div class="observations-hero-inner">
            <p class="kicker">dispatches / entries</p>
            <h1>DISPATCHES</h1>
            <div class="observations-intro">
                <p>Published entries from the ongoing archive: studio notes, field records, research fragments, and process transmissions.</p>
            </div>
        </div>
    </header>

    <main class="dispatches-index">
        <div class="dispatch-list" aria-label="Published Dispatches">
            ${cards}
        </div>
    </main>

    <footer class="site-footer">
        <span>${SITE_TITLE}</span>
        <span>Dispatches from the ongoing archive.</span>
        <strong>THE FRONT NEVER ENDED.</strong>
    </footer>

    <script src="../script.js?v=marker-lightbox-20260616"></script>
</body>
</html>`;
}

function renderDispatchEntry(entry) {
    const title = `${entry.title} | ${SITE_TITLE}`;
    const description = entry.excerpt || plainSummary(entry.content);

    return `<!DOCTYPE html>
<html lang="en">
${renderHead({
    title,
    description,
    canonical: `https://youarestillinsideit.com/dispatches/${entry.slug}/`,
    prefix: "../../",
    type: "article"
})}
<body class="dispatches-page dispatch-entry-page">
    ${renderNav("../../")}

    <header class="entry-hero dispatch-entry-hero">
        <div>
            <p class="kicker">dispatch / published entry</p>
            <h1>${escapeHtml(entry.title)}</h1>
            <p class="entry-deck">${escapeHtml(description)}</p>
        </div>
    </header>

    <main class="entry-layout dispatch-entry-layout">
        <aside class="entry-meta" aria-label="Entry metadata">
            <span>Entry</span>
            <p>${escapeHtml(formatDate(entry.publishedAt))}</p>
            <p>Dispatches</p>
            <p>Published from the LETHE dashboard.</p>
        </aside>

        <article class="entry-prose">
            ${renderRichText(entry.content)}
        </article>
    </main>

    <footer class="site-footer">
        <span>${SITE_TITLE}</span>
        <span>${escapeHtml(entry.title)}</span>
        <strong>THE FRONT NEVER ENDED.</strong>
    </footer>

    <script src="../../script.js?v=marker-lightbox-20260616"></script>
</body>
</html>`;
}

function renderDispatchFiles(entries) {
    const files = new Map();
    const published = entries
        .filter((entry) => entry.status === "published")
        .sort((a, b) => String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt)));

    files.set("dispatches/index.html", renderDispatchIndex(published));
    for (const entry of published) {
        files.set(`dispatches/${entry.slug}/index.html`, renderDispatchEntry(entry));
    }

    return files;
}

module.exports = {
    normalizeEntry,
    renderDispatchFiles,
    slugify
};
