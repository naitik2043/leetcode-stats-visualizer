const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith(".html"));

function localReferenceExists(htmlPath, reference) {
  const withoutSuffix = reference.split(/[?#]/, 1)[0];
  if (!withoutSuffix || withoutSuffix.startsWith("#") || /^(?:https?:)?\/\//i.test(withoutSuffix) || /^(?:data|mailto|tel):/i.test(withoutSuffix)) {
    return true;
  }
  const target = withoutSuffix.startsWith("/")
    ? path.join(root, withoutSuffix.slice(1))
    : path.resolve(root, path.dirname(htmlPath), withoutSuffix);
  return fs.existsSync(target);
}

test("every static HTML page has a title, main landmark and unique IDs", () => {
  assert.ok(htmlFiles.length > 0, "expected static pages in the project root");
  for (const filename of htmlFiles) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    assert.match(source, /<title>[^<]+<\/title>/i, filename + " needs a document title");
    assert.match(source, /<main\b/i, filename + " needs a main landmark");
    const ids = Array.from(source.matchAll(/\bid=["']([^"']+)["']/gi), (match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], filename + " contains duplicate IDs");
  }
});

test("local scripts and stylesheet references resolve to committed files", () => {
  for (const filename of htmlFiles) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    const scripts = Array.from(source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    const styles = Array.from(source.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    for (const reference of [...scripts, ...styles]) {
      assert.equal(localReferenceExists(filename, reference), true, filename + " has a missing local asset: " + reference);
    }
  }
});

test("every label with a for attribute targets a control on the same page", () => {
  for (const filename of htmlFiles) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    const ids = new Set(Array.from(source.matchAll(/\bid=["']([^"']+)["']/gi), (match) => match[1]));
    const labels = Array.from(source.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    for (const id of labels) {
      assert.equal(ids.has(id), true, filename + " has a label targeting missing id: " + id);
    }
  }
});
