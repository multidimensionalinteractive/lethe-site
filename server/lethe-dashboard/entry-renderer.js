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
    const type = ["field-observation", "dispatch", "interview"].includes(input?.type || existing.type)
        ? (input?.type || existing.type)
        : "dispatch";
    const figures = Array.isArray(input?.figures)
        ? input.figures
        : (Array.isArray(existing.figures) ? existing.figures : []);

    if (!title) throw new Error("Entry title is required.");
    if (status === "published" && !content) throw new Error("Published entries need body content.");

    return {
        id: String(input?.id || existing.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
        type,
        title,
        slug: slugify(requestedSlug || title),
        kicker: String(input?.kicker ?? existing.kicker ?? "").trim(),
        deck: String(input?.deck ?? existing.deck ?? excerpt).trim(),
        byline: String(input?.byline ?? existing.byline ?? "").trim(),
        excerpt,
        content,
        figures,
        status,
        livePath: String(input?.livePath || existing.livePath || "").trim(),
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

function renderFigure(figure) {
    const src = escapeHtml(figure.src || "");
    const alt = escapeHtml(figure.alt || "");
    const caption = escapeHtml(figure.caption || "field archive");
    return `<figure class="entry-inline-figure">
                <img src="${src}" alt="${alt}">
                <figcaption>${caption}</figcaption>
            </figure>`;
}

function renderProseWithFigures(content, figures = []) {
    const blocks = String(content || "")
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);

    const byAfter = new Map();
    for (const figure of figures) {
        const key = Number.isInteger(figure.afterIndex) ? figure.afterIndex : -1;
        if (!byAfter.has(key)) byAfter.set(key, []);
        byAfter.get(key).push(figure);
    }

    const parts = [];
    if (byAfter.has(-1)) {
        for (const figure of byAfter.get(-1)) parts.push(renderFigure(figure));
    }

    blocks.forEach((block, index) => {
        if (block.startsWith("## ")) {
            parts.push(`<h2>${escapeHtml(block.slice(3).trim())}</h2>`);
        } else {
            parts.push(`<p>${block.split("\n").map((line) => escapeHtml(line.trim())).join("<br>")}</p>`);
        }
        if (byAfter.has(index)) {
            for (const figure of byAfter.get(index)) parts.push(renderFigure(figure));
        }
    });

    return parts.join("\n\n            ") || "<p>Entry text forthcoming.</p>";
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

function renderHead({ title, description, canonical, prefix, type = "website", stylesheet = "styles-v1.css", imagePath = DEFAULT_IMAGE, cache = "dashboard-entries-20260811" }) {
    const image = `https://youarestillinsideit.com/${imagePath.replace(/^\//, "")}`;
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
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">
    <link rel="icon" type="image/jpeg" href="${prefix}assets/favicon-lethe.jpg">
    <link rel="apple-touch-icon" href="${prefix}assets/favicon-lethe.jpg">
    <link rel="stylesheet" href="${prefix}${stylesheet}?v=${cache}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap" rel="stylesheet">
</head>`;
}

function renderDispatchIndex(entries) {
    const published = entries.filter((entry) => entry.status === "published" && entry.type !== "field-observation" && entry.type !== "interview");
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
    prefix: "../",
    stylesheet: "styles-v1.css"
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

    <script src="../script-v1.js?v=dashboard-entries-20260811"></script>
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
    type: "article",
    stylesheet: "styles-v1.css"
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

    <script src="../../script-v1.js?v=dashboard-entries-20260811"></script>
</body>
</html>`;
}

function renderDispatchFiles(entries) {
    const files = new Map();
    const published = entries
        .filter((entry) => entry.status === "published" && entry.type !== "field-observation" && entry.type !== "interview")
        .sort((a, b) => String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt)));

    files.set("dispatches/index.html", renderDispatchIndex(published));
    for (const entry of published) {
        files.set(`dispatches/${entry.slug}/index.html`, renderDispatchEntry(entry));
    }

    return files;
}

function firstFigureImage(entry) {
    const figure = (entry.figures || [])[0];
    if (!figure?.src) return DEFAULT_IMAGE;
    return String(figure.src)
        .replace(/^\.\.\/\.\.\//, "")
        .replace(/^\.\.\//, "")
        .replace(/\?.*$/, "");
}

function renderFieldCommentsSection(entry) {
    const postId = String(entry.id || `field-obs-${entry.slug || slugify(entry.title)}`);
    const postSlug = entry.slug || slugify(entry.title);
    const postTitle = entry.title || "Field Observation";
    const postUrl = `https://youarestillinsideit.com/field-observations/${postSlug}/`;

    return `
    <section class="field-comments" data-post-id="${escapeHtml(postId)}" data-post-slug="${escapeHtml(postSlug)}" data-post-title="${escapeHtml(postTitle)}" data-post-url="${escapeHtml(postUrl)}" aria-label="Field notes responses">
        <div class="field-comments-inner">
            <p class="kicker">field notes / responses</p>
            <h2 class="field-comments-title">RESPONSES</h2>
            <p class="field-comments-intro">Leave a note after reading. Comments appear once reviewed.</p>
            <div class="field-comments-list" data-comment-list aria-live="polite"></div>
            <form class="field-comments-form" data-comment-form novalidate>
                <label>
                    <span>Name</span>
                    <input type="text" name="authorName" maxlength="80" autocomplete="name" placeholder="Your name or pseudonym">
                </label>
                <label>
                    <span>Email</span>
                    <input type="email" name="authorEmail" maxlength="160" required autocomplete="email" placeholder="you@example.com">
                </label>
                <label>
                    <span>Response</span>
                    <textarea name="body" rows="5" maxlength="4000" required placeholder="Your note"></textarea>
                </label>
                <label class="field-comments-honeypot" aria-hidden="true">
                    <span>Website</span>
                    <input type="text" name="website" tabindex="-1" autocomplete="off">
                </label>
                <div class="field-comments-turnstile" data-turnstile></div>
                <button type="submit">Send note</button>
                <p class="field-comments-status" data-comment-status></p>
            </form>
        </div>
    </section>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <script src="../../field-comments.js?v=field-comments-20260827"></script>`;
}

function renderFieldObservationEntry(entry) {
    const kicker = entry.kicker || "FIELD OBSERVATIONS";
    const deck = entry.deck || entry.excerpt || plainSummary(entry.content);
    const byline = entry.byline || "Written by Lethe";
    const description = `${kicker}. ${deck}`.slice(0, 220);
    const imagePath = firstFigureImage(entry);

    return `<!DOCTYPE html>
<html lang="en">
${renderHead({
    title: `${entry.title} | ${SITE_TITLE}`,
    description,
    canonical: `https://youarestillinsideit.com/field-observations/${entry.slug}/`,
    prefix: "../../",
    type: "article",
    stylesheet: "styles-v1.css",
    imagePath
})}
<body class="observations-page observation-entry-page">
    ${renderNav("../../")}

    <header class="entry-hero interior-front-hero field-archive-august-hero">
        <div>
            <p class="kicker">${escapeHtml(kicker)}</p>
            <h1>${escapeHtml(entry.title)}</h1>
            <p class="entry-deck">${escapeHtml(deck)}</p>
            <p class="entry-byline">${escapeHtml(byline)}</p>
        </div>
    </header>

    <main class="entry-layout">
        <aside class="entry-meta" aria-label="Entry metadata">
            <span>001</span>
            <p>${escapeHtml(formatDate(entry.publishedAt))}</p>
            <p>${escapeHtml(kicker)}</p>
            <p>Edited from the LETHE dashboard.</p>
        </aside>

        <article class="entry-prose">
            ${renderProseWithFigures(entry.content, entry.figures)}
        </article>
    </main>

    ${renderFieldCommentsSection(entry)}

    <footer class="site-footer">
        <span>${SITE_TITLE}</span>
        <span>${escapeHtml(kicker)}</span>
        <strong>THE FRONT NEVER ENDED.</strong>
    </footer>

    <script src="../../script-v1.js?v=dashboard-entries-20260811"></script>
</body>
</html>`;
}

function renderInterviewEntry(entry) {
    const kicker = entry.kicker || "conversation / interview";
    const deck = entry.deck || entry.excerpt || plainSummary(entry.content);
    const description = deck.slice(0, 220);
    const imagePath = firstFigureImage(entry);

    return `<!DOCTYPE html>
<html lang="en">
${renderHead({
    title: `${entry.title} | ${SITE_TITLE}`,
    description,
    canonical: "https://youarestillinsideit.com/interview/",
    prefix: "../",
    type: "article",
    stylesheet: "styles-v1.css",
    imagePath
})}
<body class="observations-page observation-entry-page">
    ${renderNav("../")}

    <header class="entry-hero">
        <div>
            <p class="kicker">${escapeHtml(kicker)}</p>
            <h1>${escapeHtml(entry.title)}</h1>
            <p class="entry-deck">${escapeHtml(deck)}</p>
            <p class="entry-byline">${escapeHtml(entry.byline || "LETHE — ALEXANDRIA CHANEL — 2026")}</p>
        </div>
    </header>

    <main class="entry-layout">
        <aside class="entry-meta" aria-label="Entry metadata">
            <span>Interview</span>
            <p>Conversation</p>
            <p>${escapeHtml(kicker)}</p>
            <p>Edited from the LETHE dashboard.</p>
        </aside>

        <article class="entry-prose">
            ${renderProseWithFigures(entry.content, entry.figures)}
        </article>
    </main>

    <footer class="site-footer">
        <span>${SITE_TITLE}</span>
        <span>${escapeHtml(entry.title)}</span>
        <strong>THE FRONT NEVER ENDED.</strong>
    </footer>

    <script src="../script-v1.js?v=dashboard-entries-20260811"></script>
</body>
</html>`;
}

function renderFieldObservationFiles(entries) {
    const files = new Map();
    const published = entries.filter((entry) => entry.status === "published" && (entry.type === "field-observation" || entry.type === "interview"));

    for (const entry of published) {
        const livePath = entry.livePath || `field-observations/${entry.slug}/index.html`;
        if (entry.type === "interview") {
            files.set(livePath, renderInterviewEntry(entry));
        } else {
            files.set(livePath, renderFieldObservationEntry(entry));
        }
    }

    return files;
}

function decodeEntities(value) {
    return String(value || "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&#x2600;&#xFE0E;|☀︎/g, "☀︎");
}

function htmlToPlainBlock(html) {
    return decodeEntities(String(html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\r/g, "")
        .trim());
}

function extractSeedFromFieldObservationHtml(html, meta) {
    const kickerMatch = html.match(/<p class="kicker">([\s\S]*?)<\/p>/i);
    const titleMatch = html.match(/<h1>([\s\S]*?)<\/h1>/i);
    const deckMatch = html.match(/<p class="entry-deck">([\s\S]*?)<\/p>/i);
    const bylineMatch = html.match(/<p class="entry-byline">([\s\S]*?)<\/p>/i);
    const articleMatch = html.match(/<article class="entry-prose">([\s\S]*?)<\/article>/i);
    const article = articleMatch ? articleMatch[1] : "";

    const figures = [];
    const blocks = [];
    const tokenRe = /<(h2|p|figure)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let match;
    let paragraphIndex = -1;

    while ((match = tokenRe.exec(article)) !== null) {
        const tag = match[1].toLowerCase();
        if (tag === "figure") {
            const srcMatch = match[0].match(/src="([^"]+)"/i);
            const altMatch = match[0].match(/alt="([^"]*)"/i);
            const captionMatch = match[0].match(/<figcaption>([\s\S]*?)<\/figcaption>/i);
            figures.push({
                src: srcMatch ? srcMatch[1] : "",
                alt: altMatch ? decodeEntities(altMatch[1]) : "",
                caption: captionMatch ? htmlToPlainBlock(captionMatch[1]) : "",
                afterIndex: paragraphIndex
            });
            continue;
        }

        if (tag === "h2") {
            blocks.push(`## ${htmlToPlainBlock(match[3])}`);
            paragraphIndex = blocks.length - 1;
            continue;
        }

        const text = htmlToPlainBlock(match[3]);
        if (!text || text === "—" || text === "—") continue;
        if (match[0].includes("<hr")) continue;
        blocks.push(text);
        paragraphIndex = blocks.length - 1;
    }

    // Drop lone hr artifacts already skipped; keep prose.
    return {
        ...meta,
        title: htmlToPlainBlock(titleMatch?.[1] || meta.title),
        kicker: htmlToPlainBlock(kickerMatch?.[1] || meta.kicker || ""),
        deck: htmlToPlainBlock(deckMatch?.[1] || meta.deck || ""),
        byline: htmlToPlainBlock(bylineMatch?.[1] || meta.byline || ""),
        content: blocks.join("\n\n"),
        figures,
        excerpt: htmlToPlainBlock(deckMatch?.[1] || meta.excerpt || "").slice(0, 220)
    };
}

function extractSeedFromInterviewHtml(html, meta) {
    const kickerMatch = html.match(/<p class="kicker">([\s\S]*?)<\/p>/i);
    const titleMatch = html.match(/<h1>([\s\S]*?)<\/h1>/i);
    const deckMatch = html.match(/<p class="(?:interview-deck|entry-deck)">([\s\S]*?)<\/p>/i);
    const bylineMatch = html.match(/<p class="(?:interview-meta|entry-byline)">([\s\S]*?)<\/p>/i);
    const articleMatch = html.match(/<article class="(?:interview-prose|entry-prose)">([\s\S]*?)<\/article>/i);
    const article = articleMatch ? articleMatch[1] : "";

    const figures = [];
    const blocks = [];
    const tokenRe = /<(h2|p|figure)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let match;
    let paragraphIndex = -1;
    while ((match = tokenRe.exec(article)) !== null) {
        if (match[0].includes("interview-signoff") || match[0].includes("section-actions")) continue;
        const tag = match[1].toLowerCase();
        if (tag === "figure") {
            const srcMatch = match[0].match(/src="([^"]+)"/i);
            const altMatch = match[0].match(/alt="([^"]*)"/i);
            const captionMatch = match[0].match(/<figcaption>([\s\S]*?)<\/figcaption>/i);
            figures.push({
                src: srcMatch ? srcMatch[1] : "",
                alt: altMatch ? decodeEntities(altMatch[1]) : "",
                caption: captionMatch ? htmlToPlainBlock(captionMatch[1]) : "",
                afterIndex: paragraphIndex
            });
            continue;
        }
        if (tag === "h2") {
            blocks.push(`## ${htmlToPlainBlock(match[3])}`);
            paragraphIndex = blocks.length - 1;
            continue;
        }
        const text = htmlToPlainBlock(match[3]);
        if (text) {
            blocks.push(text);
            paragraphIndex = blocks.length - 1;
        }
    }

    return {
        ...meta,
        title: htmlToPlainBlock(titleMatch?.[1] || meta.title),
        kicker: htmlToPlainBlock(kickerMatch?.[1] || meta.kicker || "interview"),
        deck: htmlToPlainBlock(deckMatch?.[1] || meta.deck || ""),
        byline: htmlToPlainBlock(bylineMatch?.[1] || meta.byline || ""),
        content: blocks.join("\n\n"),
        excerpt: htmlToPlainBlock(deckMatch?.[1] || meta.excerpt || "").slice(0, 220),
        figures
    };
}

module.exports = {
    normalizeEntry,
    renderDispatchFiles,
    renderFieldObservationFiles,
    extractSeedFromFieldObservationHtml,
    extractSeedFromInterviewHtml,
    renderFieldCommentsSection,
    slugify
};
