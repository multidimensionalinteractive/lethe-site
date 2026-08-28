const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { applyExactReplacement, validatePushPayload } = require("./exact-edit");
const {
    applyProposalToFiles,
    buildPreviewHtml,
    createProposalId,
    extractJsonObject,
    summarizeOperations
} = require("./proposal-engine");
const {
    normalizeEntry,
    renderDispatchFiles,
    renderFieldObservationFiles,
    extractSeedFromFieldObservationHtml,
    extractSeedFromInterviewHtml,
    renderFieldCommentsSection
} = require("./entry-renderer");
const {
    getConfig,
    listApprovedComments,
    listModerationComments,
    getModerationSummary,
    submitComment,
    moderateComment
} = require("./comments");
const {
    getPublicConfig: getNewsletterPublicConfig,
    subscribe: subscribeNewsletter,
    confirmSubscription,
    unsubscribe: unsubscribeNewsletter,
    getDashboardSummary: getNewsletterSummary,
    listSubscribersForDashboard,
    listIssuesForDashboard,
    sendNewsletterIssue
} = require("./newsletter");

const PORT = Number(process.env.PORT || 8787);
const ACCESS_CODE = String(process.env.LETHE_DASHBOARD_ACCESS || "").trim();
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.1";
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "low";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_URL = process.env.LETHE_REPO_URL || "https://github.com/multidimensionalinteractive/lethe-site.git";
const WORKTREE = process.env.LETHE_WORKTREE || "/opt/lethe-site-work";
const REPO_BRANCH = process.env.LETHE_REPO_BRANCH || "master";
const VISITS_FILE = process.env.LETHE_VISITS_FILE || "/var/lib/lethe-dashboard/visits.jsonl";
const COUNTRY_CACHE_FILE = process.env.LETHE_COUNTRY_CACHE_FILE || "/var/lib/lethe-dashboard/country-cache.json";
const PROPOSALS_DIR = process.env.LETHE_PROPOSALS_DIR || "/var/lib/lethe-dashboard/proposals";
const ENTRIES_FILE = process.env.LETHE_ENTRIES_FILE || "/var/lib/lethe-dashboard/entries.json";
const ALLOWED_ORIGINS = new Set([
    "https://youarestillinsideit.com",
    "https://www.youarestillinsideit.com",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:4174",
    "http://localhost:4174"
]);

const COUNTRY_NAMES = {
    US: "United States",
    CA: "Canada",
    MX: "Mexico",
    BR: "Brazil",
    AR: "Argentina",
    GB: "United Kingdom",
    UK: "United Kingdom",
    IE: "Ireland",
    FR: "France",
    DE: "Germany",
    NL: "Netherlands",
    ES: "Spain",
    IT: "Italy",
    PL: "Poland",
    UA: "Ukraine",
    RU: "Russia",
    TR: "Turkey",
    IL: "Israel",
    IN: "India",
    CN: "China",
    JP: "Japan",
    KR: "South Korea",
    AU: "Australia",
    NZ: "New Zealand",
    ZA: "South Africa",
    NG: "Nigeria",
    EG: "Egypt"
};

const systemPrompt = `You are a careful website editing assistant for Chanel's art site, YOU ARE STILL INSIDE IT - LETHE.

Site context:
- The public site is a dark, literary, gallery-like static site for Chanel's LETHE / You Are Still Inside It body of work.
- Current sections include the hero, featured Viktor artwork, Eastern Front text, Stalingrad, Lethe, Presence Emerges, Enclosure Holds, process, final text, and a contact email.
- The contact email is feldpost@youarestillinsideit.com.
- The site is edited by Matt/Codex through GitHub and deployed by Hostinger.

Your role:
- Help Chanel shape site edits: copy, image placement, section structure, mood, and concise implementation notes.
- Do not claim you directly changed the live site.
- Speak directly to Chanel, not to Matt.
- Do not invent current images, sections, or facts. If you are unsure what is currently on the page, say what you would check and give a conditional suggestion.
- When a request is ready for implementation, tell Chanel to use Generate Preview, review the page preview, and then use Push Preview Live if it looks right.
- Keep the tone warm, direct, and art-literate. Avoid generic marketing language.`;

function sendJson(response, status, payload, origin) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": origin || "https://youarestillinsideit.com",
        "Access-Control-Allow-Headers": "Content-Type, X-Lethe-Access",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Vary": "Origin"
    });
    response.end(JSON.stringify(payload));
}

function clientIp(request) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return forwarded || request.socket.remoteAddress || "";
}

function parseRequestUrl(request) {
    return new URL(request.url || "/", "http://localhost");
}

async function handlePublicComments(request, response, allowedOrigin) {
    const url = parseRequestUrl(request);

    if (url.pathname === "/api/comments/config" && request.method === "GET") {
        return sendJson(response, 200, getConfig(), allowedOrigin);
    }

    if (url.pathname === "/api/comments" && request.method === "GET") {
        const postId = String(url.searchParams.get("postId") || "").trim();
        if (!postId) {
            return sendJson(response, 400, { error: "postId is required." }, allowedOrigin);
        }
        const comments = await listApprovedComments(postId);
        return sendJson(response, 200, { comments }, allowedOrigin);
    }

    if (url.pathname === "/api/comments" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await submitComment(payload, {
            ip: clientIp(request),
            userAgent: request.headers["user-agent"] || ""
        });
        return sendJson(response, 201, result, allowedOrigin);
    }

    return null;
}

async function handleProtectedComments(request, response, allowedOrigin) {
    const url = parseRequestUrl(request);

    if (url.pathname === "/api/comments/summary" && request.method === "GET") {
        return sendJson(response, 200, await getModerationSummary(), allowedOrigin);
    }

    if (url.pathname === "/api/comments/moderation" && request.method === "GET") {
        return sendJson(response, 200, { comments: await listModerationComments() }, allowedOrigin);
    }

    if (url.pathname === "/api/comments/moderate" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await moderateComment(payload);
        return sendJson(response, 200, result, allowedOrigin);
    }

    return null;
}

async function handlePublicNewsletter(request, response, allowedOrigin) {
    const url = parseRequestUrl(request);

    if (url.pathname === "/api/newsletter/config" && request.method === "GET") {
        return sendJson(response, 200, getNewsletterPublicConfig(), allowedOrigin);
    }

    if (url.pathname === "/api/newsletter/subscribe" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await subscribeNewsletter(payload, {
            ip: clientIp(request),
            userAgent: request.headers["user-agent"] || ""
        });
        return sendJson(response, 201, result, allowedOrigin);
    }

    if (url.pathname === "/api/newsletter/confirm" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await confirmSubscription(payload.token);
        return sendJson(response, 200, result, allowedOrigin);
    }

    if (url.pathname === "/api/newsletter/unsubscribe" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await unsubscribeNewsletter(payload.token);
        return sendJson(response, 200, result, allowedOrigin);
    }

    return null;
}

async function handleProtectedNewsletter(request, response, allowedOrigin) {
    const url = parseRequestUrl(request);

    if (url.pathname === "/api/newsletter/summary" && request.method === "GET") {
        return sendJson(response, 200, await getNewsletterSummary(), allowedOrigin);
    }

    if (url.pathname === "/api/newsletter/subscribers" && request.method === "GET") {
        return sendJson(response, 200, { subscribers: await listSubscribersForDashboard() }, allowedOrigin);
    }

    if (url.pathname === "/api/newsletter/issues" && request.method === "GET") {
        return sendJson(response, 200, { issues: await listIssuesForDashboard() }, allowedOrigin);
    }

    if (url.pathname === "/api/newsletter/send" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const result = await sendNewsletterIssue(payload);
        return sendJson(response, 200, result, allowedOrigin);
    }

    return null;
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 8_000_000) {
                request.destroy();
                reject(new Error("Request is too large."));
            }
        });
        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

function normalizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
        .filter((message) => message && typeof message.content === "string")
        .map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content.slice(0, 4000)
        }))
        .slice(-12);
}

async function askOllama(messages) {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Local model error (${response.status}).`);
    }

    const data = await response.json();
    return data?.message?.content?.trim() || "I could not form a reply from the local model.";
}

async function askOpenAI(messages) {
    const input = [
        {
            role: "system",
            content: systemPrompt
        },
        ...messages.map((message) => ({
            role: message.role,
            content: message.content
        }))
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            reasoning: {
                effort: OPENAI_REASONING_EFFORT
            },
            input
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error?.message || `OpenAI model error (${response.status}).`);
    }

    if (typeof data.output_text === "string" && data.output_text.trim()) {
        return data.output_text.trim();
    }

    const textParts = [];
    for (const item of data.output || []) {
        if (item.type === "message") {
            for (const content of item.content || []) {
                if (content.type === "output_text" && content.text) {
                    textParts.push(content.text);
                }
            }
        }
    }

    return textParts.join("\n").trim() || "I could not form a reply from the OpenAI model.";
}

async function askAssistant(messages) {
    if (OPENAI_API_KEY) {
        return askOpenAI(messages);
    }

    return askOllama(messages);
}

async function readEditableFilesFromWorktree() {
    await ensureWorktree();
    return {
        "index.html": await fs.readFile(path.join(WORKTREE, "index.html"), "utf8"),
        "styles.css": await fs.readFile(path.join(WORKTREE, "styles.css"), "utf8"),
        "script.js": await fs.readFile(path.join(WORKTREE, "script.js"), "utf8")
    };
}

function runGit(args, options = {}) {
    return promisify(execFile)("git", args, {
        cwd: options.cwd,
        env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0"
        },
        maxBuffer: 1024 * 1024
    });
}

async function ensureWorktree() {
    if (!GITHUB_TOKEN) {
        throw new Error("GitHub push credentials are not configured on the dashboard server.");
    }

    const authedRepoUrl = REPO_URL.replace("https://", `https://x-access-token:${GITHUB_TOKEN}@`);

    try {
        await fs.access(path.join(WORKTREE, ".git"));
    } catch {
        await fs.rm(WORKTREE, { recursive: true, force: true });
        await runGit(["clone", "--branch", REPO_BRANCH, authedRepoUrl, WORKTREE]);
    }

    await runGit(["remote", "set-url", "origin", authedRepoUrl], { cwd: WORKTREE });
    await runGit(["fetch", "origin", REPO_BRANCH], { cwd: WORKTREE });
    await runGit(["checkout", REPO_BRANCH], { cwd: WORKTREE });
    await runGit(["reset", "--hard", `origin/${REPO_BRANCH}`], { cwd: WORKTREE });
}

async function pushExactEdit(payload) {
    const edit = validatePushPayload(payload);
    await ensureWorktree();

    const filePath = path.join(WORKTREE, edit.file);
    const original = await fs.readFile(filePath, "utf8");
    const result = applyExactReplacement(original, edit.find, edit.replace);

    await fs.writeFile(filePath, result.content);
    const status = await runGit(["status", "--porcelain", "--", edit.file], { cwd: WORKTREE });
    if (!status.stdout.trim()) {
        throw new Error("Replacement produced no file change.");
    }

    await runGit(["add", edit.file], { cwd: WORKTREE });
    await runGit(["commit", "-m", edit.message], { cwd: WORKTREE });
    const commit = await runGit(["rev-parse", "--short", "HEAD"], { cwd: WORKTREE });
    await runGit(["push", "origin", REPO_BRANCH], { cwd: WORKTREE });

    return {
        ok: true,
        file: edit.file,
        replacements: result.replacements,
        commit: commit.stdout.trim(),
        message: edit.message
    };
}

async function writeProposal(proposalRecord) {
    await fs.mkdir(PROPOSALS_DIR, { recursive: true });
    await fs.writeFile(
        path.join(PROPOSALS_DIR, `${proposalRecord.id}.json`),
        JSON.stringify(proposalRecord, null, 2)
    );
}

async function readProposal(id) {
    const safeId = String(id || "").replace(/[^a-f0-9]/g, "");
    if (!safeId) throw new Error("Proposal ID is required.");
    return JSON.parse(await fs.readFile(path.join(PROPOSALS_DIR, `${safeId}.json`), "utf8"));
}

function prepareUploadedImage(uploadedImage) {
    if (!uploadedImage) return null;

    const name = String(uploadedImage.name || "upload").toLowerCase();
    const type = String(uploadedImage.type || "");
    const dataUrl = String(uploadedImage.dataUrl || "");
    const extensionByType = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif"
    };
    const extension = extensionByType[type] || path.extname(name).replace(/[^.\w]/g, "");

    if (!extension || !Object.values(extensionByType).includes(extension)) {
        throw new Error("Uploaded image must be JPG, PNG, WEBP, or GIF.");
    }

    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1] !== type) {
        throw new Error("Uploaded image data is invalid.");
    }

    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        throw new Error("Uploaded image must be under 5 MB.");
    }

    const base = path.basename(name, path.extname(name)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "upload";
    const file = `assets/${Date.now()}-${base}${extension}`;
    return {
        file,
        type,
        dataUrl,
        base64: buffer.toString("base64")
    };
}

async function generateProposal(payload) {
    const request = String(payload?.request || "").trim();
    if (!request) throw new Error("Describe the change first.");

    const files = await readEditableFilesFromWorktree();
    const assets = await fs.readdir(path.join(WORKTREE, "assets")).catch(() => []);
    const uploadedAsset = prepareUploadedImage(payload?.uploadedImage);
    const assetPaths = assets.map((asset) => `assets/${asset}`);
    if (uploadedAsset) assetPaths.push(uploadedAsset.file);
    const currentImageRefs = [...files["index.html"].matchAll(/(?:src|href)="(assets\/[^"]+)"/g)]
        .map((match) => match[1])
        .filter((src, index, list) => list.indexOf(src) === index);
    const currentText = [
        "Hero subtitle: THE FRONT IS FORMING.",
        "Hero title: YOU ARE STILL INSIDE IT",
        "Hero tagline: — LETHE —",
        "Opening: The Eastern Front never closed.",
        "Opening detail: We live inside its elements still — a sealed historical interior, a parallel psychic architecture.",
        "Contact heading: IF THE PULL IS FAMILIAR",
        "Contact subtext: For private views and correspondence.",
        "Contact email: feldpost@youarestillinsideit.com",
        "Footer year: — 2026 —"
    ].join("\n");
    const prompt = [
        {
            role: "user",
            content: `Create a safe website edit proposal for Chanel's static LETHE site.

Return ONLY JSON, no markdown. Schema:
{
  "summary": "short human summary",
  "commitMessage": "short git commit message",
  "operations": [
    {"type":"replace_text","file":"index.html","find":"exact existing text","replace":"new text"},
    {"type":"replace_image","file":"index.html","currentSrc":"assets/current.jpg","newSrc":"assets/existing-asset.jpg"},
    {"type":"insert_before_text","file":"index.html","anchor":"exact existing text or HTML","html":"HTML to insert"},
    {"type":"insert_after_text","file":"index.html","anchor":"exact existing text or HTML","html":"HTML to insert"}
  ]
}

Rules:
- Only edit index.html, styles.css, or script.js.
- Use exact existing snippets from the current files.
- For images, current page references are: ${currentImageRefs.join(", ") || "none"}.
- For images, only choose from existing assets. Available assets: ${assetPaths.join(", ")}.
- Uploaded image for this request: ${uploadedAsset ? uploadedAsset.file : "none"}.
- If Chanel asks to use the attached image, use the uploaded image path as the newSrc.
- To place an uploaded image near a section, use insert_before_text or insert_after_text with clean figure HTML and one exact anchor from Useful HTML anchors.
- If Chanel asks for an image below the hero or above the Eastern Front text, insert before the featured-artwork section anchor.
- Do not insert content immediately after an opening section tag such as <section class="hero">.
- Prefer 1 to 3 operations.
- If the request is vague, make the smallest tasteful change.
- Do not invent new uploaded image files.
- For text changes, use one of the exact current text strings listed below as "find".

Current editable text:
${currentText}

Useful HTML anchors:
${currentImageRefs.includes("assets/viktor.jpg") ? '<section class="featured-artwork" aria-label="Featured artwork">' : ""}
<p class="chapter-text">The Eastern Front never closed.</p>
<section class="newsletter" id="contact">

Chanel's request:
${request}`
        }
    ];

    const raw = await askAssistant(prompt);
    const proposal = extractJsonObject(raw);
    const applied = applyProposalToFiles(files, proposal, { allowedAssets: assetPaths });
    const id = createProposalId();
    const usedUploadedAsset = uploadedAsset && applied.files["index.html"].includes(uploadedAsset.file);
    const record = {
        id,
        createdAt: new Date().toISOString(),
        request,
        summary: String(proposal.summary || "Site edit proposal").slice(0, 300),
        commitMessage: String(proposal.commitMessage || "Update Lethe site").slice(0, 120),
        operations: applied.operations,
        operationSummary: summarizeOperations(applied.operations),
        changedFiles: applied.changedFiles,
        assets: usedUploadedAsset ? [uploadedAsset] : [],
        files: applied.files,
        previewHtml: buildPreviewHtml(applied.files, {
            assetDataUrls: usedUploadedAsset ? { [uploadedAsset.file]: uploadedAsset.dataUrl } : {}
        })
    };

    await writeProposal(record);
    return {
        id: record.id,
        summary: record.summary,
        commitMessage: record.commitMessage,
        operations: record.operationSummary,
        changedFiles: record.changedFiles,
        previewHtml: record.previewHtml
    };
}

async function pushProposal(payload) {
    const proposal = await readProposal(payload?.proposalId);
    await ensureWorktree();

    for (const file of proposal.changedFiles) {
        await fs.writeFile(path.join(WORKTREE, file), proposal.files[file]);
    }

    for (const asset of proposal.assets || []) {
        await fs.mkdir(path.dirname(path.join(WORKTREE, asset.file)), { recursive: true });
        await fs.writeFile(path.join(WORKTREE, asset.file), Buffer.from(asset.base64, "base64"));
    }

    const proposalFiles = [...proposal.changedFiles, ...(proposal.assets || []).map((asset) => asset.file)];
    const status = await runGit(["status", "--porcelain", "--", ...proposalFiles], { cwd: WORKTREE });
    if (!status.stdout.trim()) {
        throw new Error("Proposal produced no file changes.");
    }

    await runGit(["add", ...proposalFiles], { cwd: WORKTREE });
    await runGit(["commit", "-m", proposal.commitMessage || "Update Lethe site"], { cwd: WORKTREE });
    const commit = await runGit(["rev-parse", "--short", "HEAD"], { cwd: WORKTREE });
    await runGit(["push", "origin", REPO_BRANCH], { cwd: WORKTREE });

    return {
        ok: true,
        proposalId: proposal.id,
        commit: commit.stdout.trim(),
        changedFiles: proposalFiles
    };
}

function accessHeader(request) {
    return String(request.headers["x-lethe-access"] || "").trim();
}

function assertAccess(request) {
    if (!ACCESS_CODE) {
        const error = new Error("Dashboard access is not configured.");
        error.statusCode = 500;
        throw error;
    }
    if (accessHeader(request) !== ACCESS_CODE) {
        const error = new Error("Access code required.");
        error.statusCode = 401;
        throw error;
    }
}

async function readEntriesRaw() {
    try {
        const raw = await fs.readFile(ENTRIES_FILE, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

async function seedKnownPosts(existing) {
    const byId = new Map(existing.map((entry) => [entry.id, entry]));
    const seeds = [];

    const augustPath = path.join(WORKTREE, "field-observations", "the-interior-front", "index.html");
    try {
        const html = await fs.readFile(augustPath, "utf8");
        const seeded = extractSeedFromFieldObservationHtml(html, {
            id: "field-obs-the-interior-front",
            type: "field-observation",
            slug: "the-interior-front",
            status: "published",
            livePath: "field-observations/the-interior-front/index.html",
            publishedAt: "2026-08-09T00:00:00.000Z"
        });
        seeds.push(normalizeEntry(seeded, byId.get(seeded.id) || {}));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    const interviewPath = path.join(WORKTREE, "interview", "index.html");
    try {
        const html = await fs.readFile(interviewPath, "utf8");
        const seeded = extractSeedFromInterviewHtml(html, {
            id: "interview-on-war-memory",
            type: "interview",
            slug: "interview",
            status: "published",
            livePath: "interview/index.html",
            publishedAt: "2026-08-09T00:00:00.000Z"
        });
        seeds.push(normalizeEntry(seeded, byId.get(seeded.id) || {}));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    let changed = false;
    const merged = existing.slice();
    for (const seed of seeds) {
        const index = merged.findIndex((entry) => entry.id === seed.id || (entry.slug === seed.slug && entry.type === seed.type));
        if (index === -1) {
            merged.push(seed);
            changed = true;
        } else {
            const current = merged[index];
            const currentFigures = Array.isArray(current.figures) ? current.figures : [];
            const seedFigures = Array.isArray(seed.figures) ? seed.figures : [];
            const missingFigures = seedFigures.length > 0 && currentFigures.length === 0;
            const mojibakeContent = /Ã.|â€|Ã¼|Ã¤|Ã¶|Ã„|Ãœ|Ã–/.test(String(current.content || ""));
            const interviewTitleFix = seed.type === "interview"
                && !String(current.title || "").includes("Ricochet")
                && String(seed.title || "").includes("Ricochet");
            if (
                !current.content
                || current.livePath !== seed.livePath
                || missingFigures
                || mojibakeContent
                || interviewTitleFix
            ) {
                merged[index] = {
                    ...current,
                    ...seed,
                    id: current.id || seed.id,
                    createdAt: current.createdAt || seed.createdAt
                };
                changed = true;
            }
        }
    }

    if (changed) await writeEntries(merged);
    return merged;
}

async function readEntries() {
    const existing = await readEntriesRaw();
    try {
        try {
            await ensureWorktree();
        } catch (error) {
            // Worktree may already be present; continue seeding from disk.
            console.error("ensureWorktree during seed:", error.message || error);
        }
        return await seedKnownPosts(existing);
    } catch (error) {
        console.error("seedKnownPosts:", error.message || error);
        return existing;
    }
}

async function writeEntries(entries) {
    await fs.mkdir(path.dirname(ENTRIES_FILE), { recursive: true });
    await fs.writeFile(ENTRIES_FILE, JSON.stringify({ entries }, null, 2));
}

function listEntries(entries) {
    return entries
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

async function saveEntry(payload, forcedStatus = "draft") {
    const entries = await readEntries();
    const existing = entries.find((entry) => entry.id === payload?.id) || {};
    const entry = normalizeEntry({ ...payload, status: forcedStatus }, existing);
    const slugConflict = entries.find((candidate) => candidate.slug === entry.slug && candidate.id !== entry.id);
    if (slugConflict) {
        throw new Error(`Another entry already uses the slug: ${entry.slug}`);
    }

    const nextEntries = entries.some((candidate) => candidate.id === entry.id)
        ? entries.map((candidate) => candidate.id === entry.id ? entry : candidate)
        : [entry, ...entries];

    await writeEntries(nextEntries);
    return { entry, entries: listEntries(nextEntries) };
}

async function writeSiteFiles(entries, pathsToStage, commitMessage) {
    await ensureWorktree();

    const dispatchEntries = entries.filter((entry) => entry.type !== "field-observation" && entry.type !== "interview");
    const publishedDispatchSlugs = new Set(
        dispatchEntries.filter((entry) => entry.status === "published").map((entry) => entry.slug)
    );
    const dispatchRoot = path.join(WORKTREE, "dispatches");
    await fs.mkdir(dispatchRoot, { recursive: true });

    const currentChildren = await fs.readdir(dispatchRoot, { withFileTypes: true }).catch(() => []);
    for (const child of currentChildren) {
        if (child.isDirectory() && !publishedDispatchSlugs.has(child.name)) {
            await fs.rm(path.join(dispatchRoot, child.name), { recursive: true, force: true });
        }
    }

    const files = new Map([
        ...renderDispatchFiles(entries),
        ...renderFieldObservationFiles(entries)
    ]);

    for (const [file, content] of files.entries()) {
        const filePath = path.join(WORKTREE, file);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf8");
    }

    const stagePaths = pathsToStage?.length ? pathsToStage : ["dispatches", "field-observations", "interview"];
    await runGit(["add", "-A", ...stagePaths], { cwd: WORKTREE });
    const status = await runGit(["status", "--porcelain", "--", ...stagePaths], { cwd: WORKTREE });
    if (!status.stdout.trim()) {
        return { commit: "", changedFiles: [] };
    }

    await runGit(["commit", "-m", commitMessage], { cwd: WORKTREE });
    const commit = await runGit(["rev-parse", "--short", "HEAD"], { cwd: WORKTREE });
    await runGit(["push", "origin", REPO_BRANCH], { cwd: WORKTREE });

    return {
        commit: commit.stdout.trim(),
        changedFiles: [...files.keys()]
    };
}

async function publishEntry(payload) {
    const saved = await saveEntry(payload, "published");
    const entry = saved.entry;
    const stagePaths = entry.type === "interview"
        ? ["interview"]
        : entry.type === "field-observation"
            ? ["field-observations"]
            : ["dispatches"];
    const message = entry.type === "field-observation"
        ? `Update Field Observation: ${entry.title}`
        : entry.type === "interview"
            ? `Update interview: ${entry.title}`
            : "Update Lethe dispatches";
    const push = await writeSiteFiles(saved.entries, stagePaths, message);
    return { ...saved, ...push };
}

async function deleteEntry(payload) {
    const id = String(payload?.id || "");
    if (!id) throw new Error("Entry ID is required.");

    const entries = await readEntries();
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) throw new Error("Entry not found.");

    const nextEntries = entries.filter((candidate) => candidate.id !== id);
    await writeEntries(nextEntries);

    const push = entry.status === "published"
        ? await writeSiteFiles(nextEntries, undefined, "Update Lethe posts after delete")
        : { commit: "", changedFiles: [] };

    return { deletedId: id, entries: listEntries(nextEntries), ...push };
}

function getClientIp(request) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return (forwarded || request.socket.remoteAddress || "").replace(/^::ffff:/, "");
}

function getCountry(request) {
    const cfCountry = String(request.headers["cf-ipcountry"] || "").trim();
    const nginxCountry = String(request.headers["x-country-code"] || "").trim();
    const country = cfCountry || nginxCountry;
    return country && country !== "XX" ? country.toUpperCase() : "Unknown";
}

function countryNameFromCode(code) {
    return COUNTRY_NAMES[String(code || "").toUpperCase()] || "";
}

function sanitizeText(value, maxLength = 200) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function summarizeUserAgent(userAgent) {
    const ua = String(userAgent || "");
    const browser = /Edg\//.test(ua) ? "Edge"
        : /Chrome\//.test(ua) ? "Chrome"
        : /Firefox\//.test(ua) ? "Firefox"
        : /Safari\//.test(ua) ? "Safari"
        : "Unknown browser";
    const platform = /Windows/.test(ua) ? "Windows"
        : /Mac OS X|Macintosh/.test(ua) ? "macOS"
        : /Android/.test(ua) ? "Android"
        : /iPhone|iPad/.test(ua) ? "iOS"
        : /Linux/.test(ua) ? "Linux"
        : "Unknown platform";
    const device = /Mobi|Android|iPhone|iPad/.test(ua) ? "mobile/tablet" : "desktop";
    return { browser, platform, device };
}

function isPublicIp(ip) {
    if (!ip || ip === "::1" || ip === "127.0.0.1") return false;
    if (/^(10|127)\./.test(ip)) return false;
    if (/^192\.168\./.test(ip)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

async function readCountryCache() {
    try {
        return JSON.parse(await fs.readFile(COUNTRY_CACHE_FILE, "utf8"));
    } catch {
        return {};
    }
}

async function writeCountryCache(cache) {
    await fs.mkdir(path.dirname(COUNTRY_CACHE_FILE), { recursive: true });
    await fs.writeFile(COUNTRY_CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function lookupGeo(ip, requestCountry) {
    const requestCountryCode = requestCountry !== "Unknown" ? requestCountry : "";
    const requestCountryName = countryNameFromCode(requestCountryCode) || requestCountryCode || "Unknown";
    if (!isPublicIp(ip)) {
        return {
            country: requestCountryName,
            countryCode: requestCountryCode,
            region: "",
            city: "",
            latitude: null,
            longitude: null,
            timezone: ""
        };
    }

    const cacheKey = ip.replace(/(\d+\.\d+)\.\d+\.\d+$/, "$1.0.0");
    const cache = await readCountryCache();
    if (cache[cacheKey]) {
        if (typeof cache[cacheKey] === "string") {
            return {
                country: countryNameFromCode(cache[cacheKey]) || cache[cacheKey],
                countryCode: COUNTRY_NAMES[cache[cacheKey]] ? cache[cacheKey] : "",
                region: "",
                city: "",
                latitude: null,
                longitude: null,
                timezone: ""
            };
        }
        return cache[cacheKey];
    }

    try {
        const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,timezone`);
        const data = await response.json();
        const geo = data?.status === "success" ? {
            country: data.country || requestCountryName,
            countryCode: data.countryCode || requestCountryCode,
            region: data.regionName || "",
            city: data.city || "",
            latitude: Number.isFinite(data.lat) ? data.lat : null,
            longitude: Number.isFinite(data.lon) ? data.lon : null,
            timezone: data.timezone || ""
        } : {
            country: requestCountryName,
            countryCode: requestCountryCode,
            region: "",
            city: "",
            latitude: null,
            longitude: null,
            timezone: ""
        };
        cache[cacheKey] = geo;
        await writeCountryCache(cache);
        return geo;
    } catch {
        return {
            country: requestCountryName,
            countryCode: requestCountryCode,
            region: "",
            city: "",
            latitude: null,
            longitude: null,
            timezone: ""
        };
    }
}

async function trackVisit(request, payload) {
    const ip = getClientIp(request);
    const geo = await lookupGeo(ip, getCountry(request));
    const agent = summarizeUserAgent(request.headers["user-agent"]);
    const entry = {
        ts: new Date().toISOString(),
        country: geo.country || "Unknown",
        countryCode: geo.countryCode || "",
        region: sanitizeText(geo.region, 120),
        city: sanitizeText(geo.city, 120),
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: sanitizeText(payload?.timezone || geo.timezone, 120),
        language: sanitizeText(payload?.language || request.headers["accept-language"], 120),
        languages: Array.isArray(payload?.languages) ? payload.languages.slice(0, 5).map((language) => sanitizeText(language, 40)) : [],
        viewport: sanitizeText(payload?.viewport, 40),
        screen: sanitizeText(payload?.screen, 40),
        browser: agent.browser,
        platform: agent.platform,
        device: agent.device,
        path: String(payload?.path || "/").slice(0, 200),
        referrer: String(payload?.referrer || "").slice(0, 300),
        ipPrefix: ip.replace(/(\d+\.\d+)\.\d+\.\d+$/, "$1.0.0")
    };

    await fs.mkdir(path.dirname(VISITS_FILE), { recursive: true });
    await fs.appendFile(VISITS_FILE, `${JSON.stringify(entry)}\n`);
    return { ok: true };
}

async function getVisitSummary() {
    let raw = "";
    try {
        raw = await fs.readFile(VISITS_FILE, "utf8");
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    const countryCounts = new Map();
    let totalVisits = 0;
    for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
            const visit = JSON.parse(line);
            totalVisits += 1;
            const countryCode = sanitizeText(visit.countryCode, 12).toUpperCase();
            const country = sanitizeText(countryNameFromCode(countryCode) || visit.country || "Unknown", 80);
            const countryKey = countryCode || country;
            const current = countryCounts.get(countryKey) || {
                country,
                countryCode,
                count: 0,
                cities: new Map(),
                recent: [],
                latitude: null,
                longitude: null
            };
            current.count += 1;
            if (Number.isFinite(visit.latitude) && Number.isFinite(visit.longitude) && current.latitude === null) {
                current.latitude = visit.latitude;
                current.longitude = visit.longitude;
            }

            const city = sanitizeText(visit.city, 100);
            const region = sanitizeText(visit.region, 100);
            const cityKey = city || region || "Unknown area";
            const cityCurrent = current.cities.get(cityKey) || { city, region, count: 0, latest: "" };
            cityCurrent.count += 1;
            cityCurrent.latest = visit.ts || cityCurrent.latest;
            current.cities.set(cityKey, cityCurrent);

            current.recent.push({
                ts: visit.ts || "",
                city,
                region,
                path: sanitizeText(visit.path || "/", 200),
                referrer: sanitizeText(visit.referrer, 160),
                browser: sanitizeText(visit.browser, 80),
                platform: sanitizeText(visit.platform, 80),
                device: sanitizeText(visit.device, 80),
                language: sanitizeText(visit.language, 80),
                timezone: sanitizeText(visit.timezone, 80)
            });
            if (current.recent.length > 25) current.recent.shift();
            countryCounts.set(countryKey, current);
        } catch {
            // Ignore malformed historical rows.
        }
    }

    const countries = [...countryCounts.values()]
        .map((country) => ({
            country: country.country,
            countryCode: country.countryCode,
            count: country.count,
            latitude: country.latitude,
            longitude: country.longitude,
            cities: [...country.cities.values()]
                .sort((a, b) => b.count - a.count || `${a.city}${a.region}`.localeCompare(`${b.city}${b.region}`))
                .slice(0, 12),
            recent: country.recent
                .slice()
                .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
                .slice(0, 12)
        }))
        .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

    return { totalVisits, countries };
}

const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://youarestillinsideit.com";

    if (request.method === "OPTIONS") {
        return sendJson(response, 204, {}, allowedOrigin);
    }

    if (request.url === "/health" && request.method === "GET") {
        return sendJson(response, 200, {
            ok: true,
            provider: OPENAI_API_KEY ? "openai" : "ollama",
            model: OPENAI_API_KEY ? OPENAI_MODEL : OLLAMA_MODEL,
            reasoningEffort: OPENAI_API_KEY ? OPENAI_REASONING_EFFORT : null
        }, allowedOrigin);
    }

    if (request.url === "/api/visits" && request.method === "GET") {
        try {
            assertAccess(request);
            return sendJson(response, 200, await getVisitSummary(), allowedOrigin);
        } catch (error) {
            const status = error.statusCode || 500;
            return sendJson(response, status, { error: error.message || "Could not load visits." }, allowedOrigin);
        }
    }

    if (request.url === "/api/track" && request.method === "POST") {
        try {
            const body = await readBody(request);
            const payload = JSON.parse(body || "{}");
            return sendJson(response, 200, await trackVisit(request, payload), allowedOrigin);
        } catch (error) {
            return sendJson(response, 200, { ok: false }, allowedOrigin);
        }
    }

    try {
        const publicComments = await handlePublicComments(request, response, allowedOrigin);
        if (publicComments !== null) return publicComments;
        const publicNewsletter = await handlePublicNewsletter(request, response, allowedOrigin);
        if (publicNewsletter !== null) return publicNewsletter;
    } catch (error) {
        const status = error.statusCode || 500;
        return sendJson(response, status, { error: error.message || "Could not process request." }, allowedOrigin);
    }

    try {
        assertAccess(request);
    } catch (error) {
        return sendJson(response, error.statusCode || 401, { error: error.message || "Access code required." }, allowedOrigin);
    }

    try {
        const protectedComments = await handleProtectedComments(request, response, allowedOrigin);
        if (protectedComments !== null) return protectedComments;
        const protectedNewsletter = await handleProtectedNewsletter(request, response, allowedOrigin);
        if (protectedNewsletter !== null) return protectedNewsletter;

        if (request.url === "/api/entries" && request.method === "GET") {
            return sendJson(response, 200, { entries: listEntries(await readEntries()) }, allowedOrigin);
        }

        if (request.method !== "POST") {
            return sendJson(response, 404, { error: "Not found." }, allowedOrigin);
        }

        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");

        if (request.url === "/api/push-live") {
            const result = await pushExactEdit(payload);
            return sendJson(response, 200, result, allowedOrigin);
        }

        if (request.url === "/api/propose") {
            return sendJson(response, 200, await generateProposal(payload), allowedOrigin);
        }

        if (request.url === "/api/push-proposal") {
            return sendJson(response, 200, await pushProposal(payload), allowedOrigin);
        }

        if (request.url === "/api/entries/save") {
            return sendJson(response, 200, await saveEntry(payload, "draft"), allowedOrigin);
        }

        if (request.url === "/api/entries/publish") {
            return sendJson(response, 200, await publishEntry(payload), allowedOrigin);
        }

        if (request.url === "/api/entries/delete") {
            return sendJson(response, 200, await deleteEntry(payload), allowedOrigin);
        }

        const messages = normalizeMessages(payload.messages);
        if (!messages.length) {
            return sendJson(response, 400, { error: "Send a message first." }, allowedOrigin);
        }

        const reply = await askAssistant(messages);
        return sendJson(response, 200, { reply }, allowedOrigin);
    } catch (error) {
        return sendJson(response, 500, { error: error.message || "The assistant failed to answer." }, allowedOrigin);
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`LETHE dashboard API listening on 127.0.0.1:${PORT}`);
});
