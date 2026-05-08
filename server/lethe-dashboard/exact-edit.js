const EDITABLE_FILES = new Set(["index.html", "styles.css", "script.js"]);

function applyExactReplacement(content, find, replace) {
    if (!find) {
        throw new Error("Text to replace is required.");
    }

    const firstIndex = content.indexOf(find);
    if (firstIndex === -1) {
        throw new Error("Text to replace was not found.");
    }

    if (content.indexOf(find, firstIndex + find.length) !== -1) {
        throw new Error("Text to replace appears more than once. Use a longer exact snippet.");
    }

    return {
        content: content.slice(0, firstIndex) + replace + content.slice(firstIndex + find.length),
        replacements: 1
    };
}

function validatePushPayload(payload) {
    const file = String(payload?.file || "").trim();
    const find = String(payload?.find || "");
    const replace = String(payload?.replace || "");
    const message = String(payload?.message || "Update Lethe site copy").trim();

    if (!EDITABLE_FILES.has(file)) {
        throw new Error("File is not editable from the dashboard.");
    }

    if (!find.trim()) {
        throw new Error("Text to replace is required.");
    }

    return {
        file,
        find,
        replace,
        message: message.slice(0, 120) || "Update Lethe site copy"
    };
}

module.exports = {
    EDITABLE_FILES,
    applyExactReplacement,
    validatePushPayload
};
