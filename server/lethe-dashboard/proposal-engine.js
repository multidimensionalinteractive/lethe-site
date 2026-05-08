const crypto = require("node:crypto");

const EDITABLE_FILES = new Set(["index.html", "styles.css", "script.js"]);

function extractJsonObject(text) {
    const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : String(text).slice(String(text).indexOf("{"));
    return JSON.parse(candidate);
}

function ensureEditableFile(file) {
    if (!EDITABLE_FILES.has(file)) {
        throw new Error(`${file || "File"} is not editable from generated proposals.`);
    }
}

function replaceOnce(content, find, replace) {
    if (!find) throw new Error("Proposal operation is missing text to replace.");
    const first = content.indexOf(find);
    if (first === -1) throw new Error(`Could not find proposal text: ${find.slice(0, 80)}`);
    if (content.indexOf(find, first + find.length) !== -1) {
        throw new Error(`Proposal text appears more than once: ${find.slice(0, 80)}`);
    }
    return content.slice(0, first) + replace + content.slice(first + find.length);
}

function applyProposalToFiles(files, proposal, options = {}) {
    const nextFiles = { ...files };
    const changed = new Set();
    const operations = Array.isArray(proposal?.operations) ? proposal.operations : [];
    const allowedAssets = options.allowedAssets ? new Set(options.allowedAssets) : null;

    if (!operations.length) {
        throw new Error("Proposal did not include any operations.");
    }

    for (const operation of operations) {
        const file = String(operation.file || "index.html");
        ensureEditableFile(file);

        if (typeof nextFiles[file] !== "string") {
            throw new Error(`Editable file is missing: ${file}`);
        }

        if (operation.type === "replace_text") {
            nextFiles[file] = replaceOnce(nextFiles[file], String(operation.find || ""), String(operation.replace || ""));
            changed.add(file);
            continue;
        }

        if (operation.type === "insert_before_text" || operation.type === "insert_after_text") {
            const anchor = String(operation.anchor || "");
            const html = String(operation.html || "");
            if (!anchor) throw new Error("Insert proposal is missing anchor text.");
            if (!html) throw new Error("Insert proposal is missing HTML.");
            const replacement = operation.type === "insert_before_text"
                ? `${html}\n${anchor}`
                : `${anchor}\n${html}`;
            nextFiles[file] = replaceOnce(nextFiles[file], anchor, replacement);
            changed.add(file);
            continue;
        }

        if (operation.type === "replace_image") {
            const currentSrc = String(operation.currentSrc || "");
            const newSrc = String(operation.newSrc || "");
            if (!newSrc.startsWith("assets/")) throw new Error("Image proposals must use an existing assets/ path.");
            if (allowedAssets && !allowedAssets.has(newSrc)) {
                throw new Error(`Image proposal used an unavailable asset: ${newSrc}`);
            }
            nextFiles[file] = replaceOnce(nextFiles[file], currentSrc, newSrc);
            changed.add(file);
            continue;
        }

        throw new Error(`Unsupported proposal operation: ${operation.type}`);
    }

    return {
        files: nextFiles,
        changedFiles: [...changed],
        operations
    };
}

function buildPreviewHtml(files, options = {}) {
    const html = files["index.html"];
    const css = files["styles.css"];
    if (!html) throw new Error("Preview requires index.html.");

    let preview = html.replace("<head>", '<head>\n    <base href="https://youarestillinsideit.com/">');
    for (const [assetPath, dataUrl] of Object.entries(options.assetDataUrls || {})) {
        preview = preview.replaceAll(assetPath, dataUrl);
    }
    if (!css) return preview;

    return preview.replace(
        /<link rel="stylesheet" href="styles\.css">/,
        `<style>\n${css}\n</style>`
    );
}

function summarizeOperations(operations) {
    return operations.map((operation) => {
        const file = operation.file || "index.html";
        if (operation.type === "replace_image") {
            return `Swap image in ${file}: ${operation.currentSrc} -> ${operation.newSrc}`;
        }
        if (operation.type === "insert_before_text") {
            return `Insert content before text in ${file}: ${String(operation.anchor || "").slice(0, 80)}`;
        }
        if (operation.type === "insert_after_text") {
            return `Insert content after text in ${file}: ${String(operation.anchor || "").slice(0, 80)}`;
        }
        return `Replace text in ${file}: ${String(operation.find || "").slice(0, 80)}`;
    });
}

function createProposalId() {
    return crypto.randomBytes(12).toString("hex");
}

module.exports = {
    applyProposalToFiles,
    buildPreviewHtml,
    createProposalId,
    extractJsonObject,
    summarizeOperations
};
