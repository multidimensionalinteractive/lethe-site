const RESEND_API_KEY = String(process.env.LETHE_RESEND_API_KEY || "").trim();
const MAIL_FROM = String(process.env.LETHE_MAIL_FROM || "LETHE Field Notes <feldpost@youarestillinsideit.com>").trim();
const SMTP_HOST = String(process.env.LETHE_SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.LETHE_SMTP_PORT || 587);
const SMTP_USER = String(process.env.LETHE_SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.LETHE_SMTP_PASS || "").trim();
const SMTP_SECURE = String(process.env.LETHE_SMTP_SECURE || "false").toLowerCase() === "true";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function sendMail(recipients, subject, text, html) {
    const list = Array.isArray(recipients) ? recipients.filter(Boolean) : [recipients].filter(Boolean);
    if (!list.length) return;

    if (RESEND_API_KEY) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: MAIL_FROM,
                to: list,
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
            to: list.join(", "),
            subject,
            text,
            html
        });
        return;
    }

    console.warn("Email skipped: configure LETHE_RESEND_API_KEY or LETHE_SMTP_*.");
}

module.exports = {
    escapeHtml,
    sendMail,
    MAIL_FROM
};
