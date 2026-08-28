const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const COMMENTS_FILE = process.env.LETHE_COMMENTS_FILE || "/var/lib/lethe-dashboard/comments.json";
const RATE_FILE = process.env.LETHE_COMMENT_RATE_FILE || "/var/lib/lethe-dashboard/comment-rate.json";
const TURNSTILE_SECRET = String(process.env.LETHE_TURNSTILE_SECRET_KEY || "").trim();
const TURNSTILE_SITE_KEY = String(process.env.LETHE_TURNSTILE_SITE_KEY || "").trim();
const NOTIFY_EMAILS = String(process.env.LETHE_COMMENT_NOTIFY_EMAILS || "feldpost@youarestillinsideit.com,matthaydon@gmail.com")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
const RESEND_API_KEY = String(process.env.LETHE_RESEND_API_KEY || "").trim();
const MAIL_FROM = String(process.env.LETHE_MAIL_FROM || "LETHE Field Notes <feldpost@youarestillinsideit.com>").trim();
const SMTP_HOST = String(process.env.LETHE_SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.LETHE_SMTP_PORT || 587);
const SMTP_USER = String(process.env.LETHE_SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.LETHE_SMTP_PASS || "").trim();
const SMTP_SECURE = String(process.env.LETHE_SMTP_SECURE || "false").toLowerCase() === "true";

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_IP = 3;
const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_BODY = 4000;

function hashIp(ip) {
    return crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 24);
}

function newId() {
    return crypto.randomBytes(12).toString("hex");
}

function sanitizeText(value, max) {
    return String(value || "")
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, max);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJson(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === "ENOENT") return fallback;
        throw error;
    }
}

async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function readCommentsStore() {
    const data = await readJson(COMMENTS_FILE, { comments: [] });
    return Array.isArray(data.comments) ? data.comments : [];
}

async function writeCommentsStore(comments) {
    await writeJson(COMMENTS_FILE, { comments });
}

async function readRateStore() {
    const data = await readJson(RATE_FILE, { hits: {} });
    return data.hits && typeof data.hits === "object" ? data.hits : {};
}

async function writeRateStore(hits) {
    await writeJson(RATE_FILE, { hits });
}

async function enforceRateLimit(ip) {
    const key = hashIp(ip);
    const now = Date.now();
    const hits = await readRateStore();
    const recent = (hits[key] || []).filter((ts) => now - ts < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_PER_IP) {
        const error = new Error("Too many comments from this connection. Try again later.");
        error.statusCode = 429;
        throw error;
    }
    recent.push(now);
    hits[key] = recent;
    await writeRateStore(hits);
}

async function verifyTurnstile(token, ip) {
    if (!TURNSTILE_SECRET) {
        const error = new Error("Comment verification is not configured yet.");
        error.statusCode = 503;
        throw error;
    }
    if (!token) {
        const error = new Error("Complete the verification challenge.");
        error.statusCode = 400;
        throw error;
    }

    const body = new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip || ""
    });

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    const data = await response.json().catch(() => ({}));
    if (!data.success) {
        const error = new Error("Verification failed. Please try again.");
        error.statusCode = 400;
        throw error;
    }
}

async function sendMail(recipients, subject, text, html) {
    if (RESEND_API_KEY) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: MAIL_FROM,
                to: recipients,
                subject,
                text,
                html
            })
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(`Resend error (${response.status}): ${detail.slice(0, 200)}`);
        }
        return;
    }

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        let nodemailer;
        try {
            nodemailer = require("nodemailer");
        } catch {
            throw new Error("SMTP configured but nodemailer is not installed on the server.");
        }
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });
        await transporter.sendMail({
            from: MAIL_FROM,
            to: recipients.join(", "),
            subject,
            text,
            html
        });
        return;
    }

    console.warn("Comment notification email skipped: configure LETHE_RESEND_API_KEY or LETHE_SMTP_*.");
}

async function notifyModerators(comment) {
    const subject = `[LETHE] New Field Notes comment awaiting review`;
    const dashboardUrl = "https://youarestillinsideit.com/dashboard/";
    const postUrl = comment.postUrl || `https://youarestillinsideit.com/field-observations/${comment.postSlug}/`;
    const text = [
        "A new Field Notes comment is waiting for moderation.",
        "",
        `Post: ${comment.postTitle}`,
        `URL: ${postUrl}`,
        `Name: ${comment.authorName}`,
        `Email: ${comment.authorEmail}`,
        "",
        comment.body,
        "",
        `Review in dashboard: ${dashboardUrl}`
    ].join("\n");
    const html = `
        <p>A new Field Notes comment is waiting for moderation.</p>
        <p><strong>Post:</strong> ${escapeHtml(comment.postTitle)}<br>
        <strong>URL:</strong> <a href="${escapeHtml(postUrl)}">${escapeHtml(postUrl)}</a><br>
        <strong>Name:</strong> ${escapeHtml(comment.authorName)}<br>
        <strong>Email:</strong> ${escapeHtml(comment.authorEmail)}</p>
        <blockquote style="margin:1rem 0;padding:0.75rem 1rem;border-left:3px solid #8F3428;background:#1C1916;color:#C4B8A8;">
            ${escapeHtml(comment.body).replace(/\n/g, "<br>")}
        </blockquote>
        <p><a href="${escapeHtml(dashboardUrl)}">Open LETHE dashboard</a></p>
    `;

    try {
        await sendMail(NOTIFY_EMAILS, subject, text, html);
    } catch (error) {
        console.error("Comment notification email failed:", error.message || error);
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function publicComment(comment) {
    return {
        id: comment.id,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt,
        approvedAt: comment.approvedAt || ""
    };
}

function moderationComment(comment) {
    return {
        id: comment.id,
        postId: comment.postId,
        postSlug: comment.postSlug,
        postTitle: comment.postTitle,
        postUrl: comment.postUrl,
        authorName: comment.authorName,
        authorEmail: comment.authorEmail,
        body: comment.body,
        status: comment.status,
        createdAt: comment.createdAt,
        approvedAt: comment.approvedAt || "",
        rejectedAt: comment.rejectedAt || ""
    };
}

function getConfig() {
    return {
        turnstileSiteKey: TURNSTILE_SITE_KEY,
        commentsEnabled: Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET)
    };
}

async function listApprovedComments(postId) {
    const comments = await readCommentsStore();
    return comments
        .filter((comment) => comment.postId === postId && comment.status === "approved")
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .map(publicComment);
}

async function listModerationComments() {
    const comments = await readCommentsStore();
    return comments
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(moderationComment);
}

async function getModerationSummary() {
    const comments = await readCommentsStore();
    const pending = comments.filter((comment) => comment.status === "pending");
    return {
        pendingCount: pending.length,
        pending: pending
            .slice()
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 12)
            .map(moderationComment)
    };
}

async function submitComment(payload, requestMeta) {
    const honeypot = sanitizeText(payload.website, 120);
    if (honeypot) {
        const error = new Error("Comment rejected.");
        error.statusCode = 400;
        throw error;
    }

    const postId = sanitizeText(payload.postId, 120);
    const postSlug = sanitizeText(payload.postSlug, 80);
    const postTitle = sanitizeText(payload.postTitle, 200);
    const postUrl = sanitizeText(payload.postUrl, 240);
    const authorName = sanitizeText(payload.authorName, MAX_NAME) || "Anonymous";
    const authorEmail = sanitizeText(payload.authorEmail, MAX_EMAIL).toLowerCase();
    const body = sanitizeText(payload.body, MAX_BODY);
    const turnstileToken = sanitizeText(payload.turnstileToken, 4000);

    if (!postId || !postSlug || !postTitle) {
        const error = new Error("Missing post context.");
        error.statusCode = 400;
        throw error;
    }
    if (!isValidEmail(authorEmail)) {
        const error = new Error("A valid email address is required.");
        error.statusCode = 400;
        throw error;
    }
    if (body.length < 8) {
        const error = new Error("Write a little more before submitting.");
        error.statusCode = 400;
        throw error;
    }

    await enforceRateLimit(requestMeta.ip);
    await verifyTurnstile(turnstileToken, requestMeta.ip);

    const now = new Date().toISOString();
    const comment = {
        id: newId(),
        postId,
        postSlug,
        postTitle,
        postUrl: postUrl || `https://youarestillinsideit.com/field-observations/${postSlug}/`,
        authorName,
        authorEmail,
        body,
        status: "pending",
        createdAt: now,
        approvedAt: "",
        rejectedAt: "",
        ipHash: hashIp(requestMeta.ip),
        userAgent: sanitizeText(requestMeta.userAgent, 240)
    };

    const comments = await readCommentsStore();
    comments.push(comment);
    await writeCommentsStore(comments);
    await notifyModerators(comment);

    return {
        ok: true,
        message: "Thank you. Your note was received and will appear after review."
    };
}

async function moderateComment(payload) {
    const id = sanitizeText(payload.id, 80);
    const action = sanitizeText(payload.action, 20);
    if (!id || !["approve", "reject", "spam", "delete"].includes(action)) {
        const error = new Error("Invalid moderation action.");
        error.statusCode = 400;
        throw error;
    }

    const comments = await readCommentsStore();
    const index = comments.findIndex((comment) => comment.id === id);
    if (index === -1) {
        const error = new Error("Comment not found.");
        error.statusCode = 404;
        throw error;
    }

    const now = new Date().toISOString();
    if (action === "delete") {
        comments.splice(index, 1);
    } else if (action === "approve") {
        comments[index] = {
            ...comments[index],
            status: "approved",
            approvedAt: now,
            rejectedAt: ""
        };
    } else if (action === "reject") {
        comments[index] = {
            ...comments[index],
            status: "rejected",
            rejectedAt: now
        };
    } else if (action === "spam") {
        comments[index] = {
            ...comments[index],
            status: "spam",
            rejectedAt: now
        };
    }

    await writeCommentsStore(comments);
    return {
        ok: true,
        summary: await getModerationSummary(),
        comments: await listModerationComments()
    };
}

module.exports = {
    getConfig,
    listApprovedComments,
    listModerationComments,
    getModerationSummary,
    submitComment,
    moderateComment
};
