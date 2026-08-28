const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { escapeHtml, sendMail, MAIL_FROM } = require("./mail");
const { verifyTurnstile, getTurnstilePublicConfig } = require("./turnstile");

const SUBSCRIBERS_FILE = process.env.LETHE_NEWSLETTER_SUBSCRIBERS_FILE || "/var/lib/lethe-dashboard/newsletter-subscribers.json";
const ISSUES_FILE = process.env.LETHE_NEWSLETTER_ISSUES_FILE || "/var/lib/lethe-dashboard/newsletter-issues.json";
const RATE_FILE = process.env.LETHE_NEWSLETTER_RATE_FILE || "/var/lib/lethe-dashboard/newsletter-rate.json";
const SITE_URL = String(process.env.LETHE_SITE_URL || "https://youarestillinsideit.com").replace(/\/$/, "");
const NOTIFY_EMAILS = String(process.env.LETHE_COMMENT_NOTIFY_EMAILS || "feldpost@youarestillinsideit.com,matthaydon@gmail.com")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_IP = 5;
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_SUBJECT = 200;
const MAX_BODY = 12000;

function hashIp(ip) {
    return crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 24);
}

function hashToken(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function newToken() {
    return crypto.randomBytes(32).toString("hex");
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

function normalizeEmail(email) {
    return sanitizeText(email, MAX_EMAIL).toLowerCase();
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

async function readSubscribers() {
    const data = await readJson(SUBSCRIBERS_FILE, { subscribers: [] });
    return Array.isArray(data.subscribers) ? data.subscribers : [];
}

async function writeSubscribers(subscribers) {
    await writeJson(SUBSCRIBERS_FILE, { subscribers });
}

async function readIssues() {
    const data = await readJson(ISSUES_FILE, { issues: [] });
    return Array.isArray(data.issues) ? data.issues : [];
}

async function writeIssues(issues) {
    await writeJson(ISSUES_FILE, { issues });
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
        const error = new Error("Too many attempts. Try again later.");
        error.statusCode = 429;
        throw error;
    }
    recent.push(now);
    hits[key] = recent;
    await writeRateStore(hits);
}

function getPublicConfig() {
    const turnstile = getTurnstilePublicConfig();
    return {
        enabled: turnstile.enabled,
        turnstileSiteKey: turnstile.turnstileSiteKey,
        kicker: "Field correspondence",
        copy: "Weekly notes from the archive — new work, field observations, and studio correspondence."
    };
}

function subscriberSummary(subscribers) {
    const confirmed = subscribers.filter((s) => s.status === "confirmed");
    const pending = subscribers.filter((s) => s.status === "pending");
    const unsubscribed = subscribers.filter((s) => s.status === "unsubscribed");
    return {
        total: subscribers.length,
        confirmedCount: confirmed.length,
        pendingCount: pending.length,
        unsubscribedCount: unsubscribed.length
    };
}

function publicSubscriber(subscriber) {
    return {
        id: subscriber.id,
        email: subscriber.email,
        name: subscriber.name || "",
        status: subscriber.status,
        createdAt: subscriber.createdAt,
        confirmedAt: subscriber.confirmedAt || "",
        unsubscribedAt: subscriber.unsubscribedAt || ""
    };
}

async function sendConfirmEmail(subscriber, confirmToken) {
    const confirmUrl = `${SITE_URL}/newsletter/confirm/?token=${encodeURIComponent(confirmToken)}`;
    const subject = "Confirm your subscription — YOU ARE STILL INSIDE IT";
    const text = [
        "Thank you for subscribing to field correspondence from YOU ARE STILL INSIDE IT.",
        "",
        "Confirm your email to receive weekly notes from the archive:",
        confirmUrl,
        "",
        "If you did not request this, you can ignore this message."
    ].join("\n");
    const html = `
        <p>Thank you for subscribing to field correspondence from <strong>YOU ARE STILL INSIDE IT</strong>.</p>
        <p><a href="${escapeHtml(confirmUrl)}">Confirm your email</a> to receive weekly notes from the archive.</p>
        <p>If you did not request this, you can ignore this message.</p>
    `;
    await sendMail([subscriber.email], subject, text, html);
}

async function notifyNewSubscriber(subscriber) {
    const subject = "[LETHE] New newsletter signup (pending confirmation)";
    const text = `New signup pending confirmation:\n\n${subscriber.name || "Anonymous"}\n${subscriber.email}`;
    const html = `<p>New signup pending confirmation:</p><p><strong>${escapeHtml(subscriber.name || "Anonymous")}</strong><br>${escapeHtml(subscriber.email)}</p>`;
    try {
        await sendMail(NOTIFY_EMAILS, subject, text, html);
    } catch (error) {
        console.error("Newsletter signup notify failed:", error.message || error);
    }
}

async function subscribe(payload, requestMeta) {
    const honeypot = sanitizeText(payload.website, 120);
    if (honeypot) {
        const error = new Error("Subscription rejected.");
        error.statusCode = 400;
        throw error;
    }

    const email = normalizeEmail(payload.email);
    const name = sanitizeText(payload.name, MAX_NAME);
    const turnstileToken = sanitizeText(payload.turnstileToken, 4000);

    if (!isValidEmail(email)) {
        const error = new Error("A valid email address is required.");
        error.statusCode = 400;
        throw error;
    }

    await enforceRateLimit(requestMeta.ip);
    await verifyTurnstile(turnstileToken, requestMeta.ip);

    const subscribers = await readSubscribers();
    const existing = subscribers.find((s) => s.email === email);
    const now = new Date().toISOString();
    const confirmToken = newToken();
    const unsubscribeToken = newToken();

    if (existing && existing.status === "confirmed") {
        return {
            ok: true,
            message: "You are already subscribed."
        };
    }

    const record = existing || {
        id: newId(),
        email,
        createdAt: now
    };

    Object.assign(record, {
        email,
        name: name || record.name || "",
        status: "pending",
        confirmTokenHash: hashToken(confirmToken),
        confirmExpiresAt: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(),
        unsubscribeToken: record.unsubscribeToken || unsubscribeToken,
        confirmedAt: "",
        unsubscribedAt: "",
        ipHash: hashIp(requestMeta.ip),
        updatedAt: now
    });

    if (!existing) {
        subscribers.push(record);
    }

    await writeSubscribers(subscribers);
    await sendConfirmEmail(record, confirmToken);
    await notifyNewSubscriber(record);

    return {
        ok: true,
        message: "Check your email to confirm your subscription."
    };
}

async function confirmSubscription(token) {
    const tokenHash = hashToken(sanitizeText(token, 128));
    const subscribers = await readSubscribers();
    const index = subscribers.findIndex((s) => s.confirmTokenHash === tokenHash && s.status === "pending");
    if (index === -1) {
        const error = new Error("This confirmation link is invalid or already used.");
        error.statusCode = 404;
        throw error;
    }

    const subscriber = subscribers[index];
    if (subscriber.confirmExpiresAt && Date.now() > Date.parse(subscriber.confirmExpiresAt)) {
        const error = new Error("This confirmation link has expired. Please subscribe again.");
        error.statusCode = 410;
        throw error;
    }

    subscribers[index] = {
        ...subscriber,
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        confirmTokenHash: "",
        confirmExpiresAt: "",
        updatedAt: new Date().toISOString()
    };
    await writeSubscribers(subscribers);

    return {
        ok: true,
        message: "Subscription confirmed. You will receive field correspondence from the archive."
    };
}

async function unsubscribe(token) {
    const clean = sanitizeText(token, 128);
    const subscribers = await readSubscribers();
    const index = subscribers.findIndex((s) => s.unsubscribeToken === clean);
    if (index === -1) {
        const error = new Error("This unsubscribe link is invalid.");
        error.statusCode = 404;
        throw error;
    }

    subscribers[index] = {
        ...subscribers[index],
        status: "unsubscribed",
        unsubscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await writeSubscribers(subscribers);

    return {
        ok: true,
        message: "You have been unsubscribed."
    };
}

async function getDashboardSummary() {
    const subscribers = await readSubscribers();
    const issues = await readIssues();
    return {
        ...subscriberSummary(subscribers),
        issuesSent: issues.filter((issue) => issue.status === "sent").length,
        lastSentAt: issues.find((issue) => issue.status === "sent")?.sentAt || ""
    };
}

async function listSubscribersForDashboard() {
    const subscribers = await readSubscribers();
    return subscribers
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
        .map(publicSubscriber);
}

async function listIssuesForDashboard() {
    const issues = await readIssues();
    return issues
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
        .slice(0, 24)
        .map((issue) => ({
            id: issue.id,
            subject: issue.subject,
            status: issue.status,
            recipientCount: issue.recipientCount || 0,
            createdAt: issue.createdAt,
            sentAt: issue.sentAt || ""
        }));
}

function renderIssueHtml(issue, unsubscribeUrl) {
    const bodyHtml = escapeHtml(issue.body).replace(/\n/g, "<br>");
    return `
        <div style="font-family:Georgia,serif;color:#2a2420;max-width:640px;line-height:1.65;">
            <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8F3428;">YOU ARE STILL INSIDE IT — field correspondence</p>
            <h1 style="font-family:Arial,sans-serif;font-size:22px;color:#5C1518;">${escapeHtml(issue.subject)}</h1>
            <div>${bodyHtml}</div>
            <p style="margin-top:2rem;font-family:Arial,sans-serif;font-size:12px;color:#666;">
                <a href="${escapeHtml(SITE_URL)}">youarestillinsideit.com</a><br>
                <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>
            </p>
        </div>
    `;
}

async function sendNewsletterIssue(payload) {
    const subject = sanitizeText(payload.subject, MAX_SUBJECT);
    const body = sanitizeText(payload.body, MAX_BODY);
    const testEmail = normalizeEmail(payload.testEmail || "");

    if (!subject || body.length < 20) {
        const error = new Error("Subject and body (at least 20 characters) are required.");
        error.statusCode = 400;
        throw error;
    }

    const subscribers = await readSubscribers();
    const confirmed = subscribers.filter((s) => s.status === "confirmed");

    if (testEmail) {
        if (!isValidEmail(testEmail)) {
            const error = new Error("Test email address is invalid.");
            error.statusCode = 400;
            throw error;
        }
        const issue = {
            id: newId(),
            subject,
            body,
            status: "test",
            recipientCount: 1,
            createdAt: new Date().toISOString(),
            sentAt: new Date().toISOString()
        };
        const testUnsub = `${SITE_URL}/newsletter/unsubscribe/`;
        await sendMail(
            [testEmail],
            `[TEST] ${subject}`,
            `${body}\n\n—\n${SITE_URL}\n`,
            renderIssueHtml(issue, testUnsub)
        );
        return { ok: true, message: `Test sent to ${testEmail}.`, issue };
    }

    if (!confirmed.length) {
        const error = new Error("No confirmed subscribers yet.");
        error.statusCode = 400;
        throw error;
    }

    const issue = {
        id: newId(),
        subject,
        body,
        status: "sent",
        recipientCount: 0,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString()
    };

    let sent = 0;
    for (const subscriber of confirmed) {
        if (!subscriber.unsubscribeToken) continue;
        const unsubscribeUrl = `${SITE_URL}/newsletter/unsubscribe/?token=${encodeURIComponent(subscriber.unsubscribeToken)}`;
        const text = `${body}\n\n—\n${SITE_URL}\nUnsubscribe: ${unsubscribeUrl}\n`;
        try {
            await sendMail(
                [subscriber.email],
                subject,
                text,
                renderIssueHtml(issue, unsubscribeUrl)
            );
            sent += 1;
        } catch (error) {
            console.error(`Newsletter send failed for ${subscriber.email}:`, error.message || error);
        }
    }

    issue.recipientCount = sent;
    const issues = await readIssues();
    issues.unshift(issue);
    await writeIssues(issues.slice(0, 100));

    return {
        ok: true,
        message: `Sent to ${sent} subscriber${sent === 1 ? "" : "s"}.`,
        issue: {
            id: issue.id,
            subject: issue.subject,
            status: issue.status,
            recipientCount: issue.recipientCount,
            sentAt: issue.sentAt
        },
        summary: await getDashboardSummary()
    };
}

module.exports = {
    getPublicConfig,
    subscribe,
    confirmSubscription,
    unsubscribe,
    getDashboardSummary,
    listSubscribersForDashboard,
    listIssuesForDashboard,
    sendNewsletterIssue
};
