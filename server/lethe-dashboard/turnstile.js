const TURNSTILE_SECRET = String(process.env.LETHE_TURNSTILE_SECRET_KEY || "").trim();
const TURNSTILE_SITE_KEY = String(process.env.LETHE_TURNSTILE_SITE_KEY || "").trim();

async function verifyTurnstile(token, ip) {
    if (!TURNSTILE_SECRET) {
        const error = new Error("Verification is not configured yet.");
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

function getTurnstilePublicConfig() {
    return {
        turnstileSiteKey: TURNSTILE_SITE_KEY,
        enabled: Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET)
    };
}

module.exports = {
    verifyTurnstile,
    getTurnstilePublicConfig
};
