const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { applyExactReplacement, validatePushPayload } = require("./exact-edit");

const PORT = Number(process.env.PORT || 8787);
const ACCESS_CODE = process.env.LETHE_DASHBOARD_ACCESS || "";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_URL = process.env.LETHE_REPO_URL || "https://github.com/multidimensionalinteractive/lethe-site.git";
const WORKTREE = process.env.LETHE_WORKTREE || "/opt/lethe-site-work";
const REPO_BRANCH = process.env.LETHE_REPO_BRANCH || "master";
const VISITS_FILE = process.env.LETHE_VISITS_FILE || "/var/lib/lethe-dashboard/visits.jsonl";
const COUNTRY_CACHE_FILE = process.env.LETHE_COUNTRY_CACHE_FILE || "/var/lib/lethe-dashboard/country-cache.json";
const ALLOWED_ORIGINS = new Set([
    "https://youarestillinsideit.com",
    "https://www.youarestillinsideit.com",
    "http://127.0.0.1:4173",
    "http://localhost:4173"
]);

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
- When a request is ready for implementation, summarize exact changes Matt/Codex should apply.
- If Chanel wants to push live, tell her to use the Push Live panel with exact text to replace and exact replacement text.
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

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 64_000) {
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

async function lookupCountry(ip, requestCountry) {
    if (requestCountry !== "Unknown") return requestCountry;
    if (!isPublicIp(ip)) return "Unknown";

    const cacheKey = ip.replace(/(\d+\.\d+)\.\d+\.\d+$/, "$1.0.0");
    const cache = await readCountryCache();
    if (cache[cacheKey]) return cache[cacheKey];

    try {
        const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`);
        const data = await response.json();
        const country = data?.status === "success" && data?.country ? data.country : "Unknown";
        cache[cacheKey] = country;
        await writeCountryCache(cache);
        return country;
    } catch {
        return "Unknown";
    }
}

async function trackVisit(request, payload) {
    const ip = getClientIp(request);
    const country = await lookupCountry(ip, getCountry(request));
    const entry = {
        ts: new Date().toISOString(),
        country,
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
            const country = visit.country || "Unknown";
            countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
        } catch {
            // Ignore malformed historical rows.
        }
    }

    const countries = [...countryCounts.entries()]
        .map(([country, count]) => ({ country, count }))
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
        return sendJson(response, 200, { ok: true, model: OLLAMA_MODEL }, allowedOrigin);
    }

    if (request.url === "/api/visits" && request.method === "GET") {
        if (!ACCESS_CODE || request.headers["x-lethe-access"] !== ACCESS_CODE) {
            return sendJson(response, 401, { error: "Access code required." }, allowedOrigin);
        }
        try {
            return sendJson(response, 200, await getVisitSummary(), allowedOrigin);
        } catch (error) {
            return sendJson(response, 500, { error: error.message || "Could not load visits." }, allowedOrigin);
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

    if (!["/api/chat", "/api/push-live"].includes(request.url) || request.method !== "POST") {
        return sendJson(response, 404, { error: "Not found." }, allowedOrigin);
    }

    if (!ACCESS_CODE || request.headers["x-lethe-access"] !== ACCESS_CODE) {
        return sendJson(response, 401, { error: "Access code required." }, allowedOrigin);
    }

    try {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");

        if (request.url === "/api/push-live") {
            const result = await pushExactEdit(payload);
            return sendJson(response, 200, result, allowedOrigin);
        }

        const messages = normalizeMessages(payload.messages);
        if (!messages.length) {
            return sendJson(response, 400, { error: "Send a message first." }, allowedOrigin);
        }

        const reply = await askOllama(messages);
        return sendJson(response, 200, { reply }, allowedOrigin);
    } catch (error) {
        return sendJson(response, 500, { error: error.message || "The assistant failed to answer." }, allowedOrigin);
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`LETHE dashboard API listening on 127.0.0.1:${PORT}`);
});
