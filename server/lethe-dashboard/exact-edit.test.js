const test = require("node:test");
const assert = require("node:assert/strict");

const { applyExactReplacement, validatePushPayload } = require("./exact-edit");

test("applyExactReplacement replaces one exact match", () => {
    const result = applyExactReplacement("Alpha Eastern Front Omega", "Eastern Front", "front line");

    assert.equal(result.content, "Alpha front line Omega");
    assert.equal(result.replacements, 1);
});

test("applyExactReplacement rejects missing source text", () => {
    assert.throws(
        () => applyExactReplacement("Alpha", "Eastern Front", "front line"),
        /Text to replace was not found/
    );
});

test("applyExactReplacement rejects ambiguous source text", () => {
    assert.throws(
        () => applyExactReplacement("LETHE LETHE", "LETHE", "Lethe"),
        /appears more than once/
    );
});

test("validatePushPayload accepts only known editable files", () => {
    assert.deepEqual(
        validatePushPayload({
            file: "index.html",
            find: "old",
            replace: "new",
            message: "Update line"
        }),
        {
            file: "index.html",
            find: "old",
            replace: "new",
            message: "Update line"
        }
    );

    assert.throws(
        () => validatePushPayload({ file: "server.js", find: "old", replace: "new" }),
        /File is not editable/
    );
});
