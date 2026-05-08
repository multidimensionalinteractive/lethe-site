const test = require("node:test");
const assert = require("node:assert/strict");

const { applyProposalToFiles, buildPreviewHtml, extractJsonObject, summarizeOperations } = require("./proposal-engine");

test("extractJsonObject parses fenced proposal JSON", () => {
    const parsed = extractJsonObject("Sure.\n```json\n{\"summary\":\"Change hero\",\"operations\":[]}\n```");
    assert.equal(parsed.summary, "Change hero");
});

test("applyProposalToFiles applies exact replacements and image swaps", () => {
    const files = {
        "index.html": '<p>The Eastern Front never closed.</p><img src="assets/viktor.jpg">',
        "styles.css": "body { color: white; }"
    };
    const proposal = {
        summary: "Adjust text and image",
        operations: [
            {
                type: "replace_text",
                file: "index.html",
                find: "The Eastern Front never closed.",
                replace: "The front has never closed."
            },
            {
                type: "replace_image",
                file: "index.html",
                currentSrc: "assets/viktor.jpg",
                newSrc: "assets/favicon-lethe.jpg"
            }
        ]
    };

    const result = applyProposalToFiles(files, proposal);
    assert.equal(result.files["index.html"], '<p>The front has never closed.</p><img src="assets/favicon-lethe.jpg">');
    assert.equal(result.changedFiles.length, 1);
});

test("applyProposalToFiles rejects operations outside editable files", () => {
    assert.throws(
        () => applyProposalToFiles({ "index.html": "x" }, {
            operations: [{ type: "replace_text", file: "server.js", find: "x", replace: "y" }]
        }),
        /not editable/
    );
});

test("applyProposalToFiles rejects image swaps to unavailable assets", () => {
    assert.throws(
        () => applyProposalToFiles(
            { "index.html": '<img src="assets/current.jpg">' },
            { operations: [{ type: "replace_image", file: "index.html", currentSrc: "assets/current.jpg", newSrc: "assets/missing.jpg" }] },
            { allowedAssets: ["assets/current.jpg"] }
        ),
        /unavailable asset/
    );
});

test("applyProposalToFiles inserts HTML around exact text anchors", () => {
    const result = applyProposalToFiles(
        { "index.html": "<section><p>The Eastern Front never closed.</p></section>" },
        {
            operations: [{
                type: "insert_before_text",
                file: "index.html",
                anchor: "<p>The Eastern Front never closed.</p>",
                html: '<figure><img src="assets/upload.jpg" alt=""></figure>'
            }]
        }
    );

    assert.equal(
        result.files["index.html"],
        '<section><figure><img src="assets/upload.jpg" alt=""></figure>\n<p>The Eastern Front never closed.</p></section>'
    );
});

test("summarizeOperations creates concise labels", () => {
    const summary = summarizeOperations([
        { type: "replace_text", file: "index.html", find: "old text that is long", replace: "new text" },
        { type: "replace_image", file: "index.html", currentSrc: "a.jpg", newSrc: "b.jpg" },
        { type: "insert_before_text", file: "index.html", anchor: "anchor text", html: "<div></div>" }
    ]);

    assert.deepEqual(summary, [
        "Replace text in index.html: old text that is long",
        "Swap image in index.html: a.jpg -> b.jpg",
        "Insert content before text in index.html: anchor text"
    ]);
});

test("buildPreviewHtml injects base and inline styles", () => {
    const preview = buildPreviewHtml({
        "index.html": '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body>Hi</body></html>',
        "styles.css": "body { color: red; }"
    });

    assert.match(preview, /<base href="https:\/\/youarestillinsideit.com\/">/);
    assert.match(preview, /<style>\nbody \{ color: red; \}\n<\/style>/);
});

test("buildPreviewHtml inlines uploaded asset data urls", () => {
    const preview = buildPreviewHtml(
        {
            "index.html": '<!doctype html><html><head></head><body><img src="assets/upload.jpg"></body></html>',
            "styles.css": ""
        },
        { assetDataUrls: { "assets/upload.jpg": "data:image/jpeg;base64,abc" } }
    );

    assert.match(preview, /src="data:image\/jpeg;base64,abc"/);
});
