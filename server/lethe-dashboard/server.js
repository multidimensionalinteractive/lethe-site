const http = require("node:http");

const PORT = Number(process.env.PORT || 8787);
const ACCESS_CODE = process.env.LETHE_DASHBOARD_ACCESS || "";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
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

const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://youarestillinsideit.com";

    if (request.method === "OPTIONS") {
        return sendJson(response, 204, {}, allowedOrigin);
    }

    if (request.url === "/health" && request.method === "GET") {
        return sendJson(response, 200, { ok: true, model: OLLAMA_MODEL }, allowedOrigin);
    }

    if (request.url !== "/api/chat" || request.method !== "POST") {
        return sendJson(response, 404, { error: "Not found." }, allowedOrigin);
    }

    if (!ACCESS_CODE || request.headers["x-lethe-access"] !== ACCESS_CODE) {
        return sendJson(response, 401, { error: "Access code required." }, allowedOrigin);
    }

    try {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
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
