const test = require("node:test");
const assert = require("node:assert/strict");
const { getPasteAppOrigin } = require("../../server/pasteAppConfig");

test("normalizes a secure Paste Vault URL to its origin", () => {
  assert.equal(
    getPasteAppOrigin("https://paste-vault.example/workspace?source=dashboard"),
    "https://paste-vault.example"
  );
});

test("allows HTTP only for local development hosts", () => {
  assert.equal(getPasteAppOrigin("http://localhost:5173"), "http://localhost:5173");
  assert.equal(getPasteAppOrigin("http://127.0.0.1:4173/path"), "http://127.0.0.1:4173");
  assert.equal(getPasteAppOrigin("http://paste-vault.example"), null);
});

test("rejects invalid URLs and embedded credentials", () => {
  assert.equal(getPasteAppOrigin(""), null);
  assert.equal(getPasteAppOrigin("not a URL"), null);
  assert.equal(getPasteAppOrigin("javascript:alert(1)"), null);
  assert.equal(getPasteAppOrigin("https://user:password@paste-vault.example"), null);
});
