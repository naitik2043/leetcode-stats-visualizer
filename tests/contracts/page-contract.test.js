const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const pagesRoot = path.join(root, "pages");
const htmlFiles = fs.readdirSync(pagesRoot)
  .filter((name) => name.endsWith(".html"))
  .sort();

function resolvePublicAsset(reference) {
  const cleanPath = reference.split(/[?#]/, 1)[0];
  if (!cleanPath || cleanPath === "/") return path.join(pagesRoot, "index.html");
  if (cleanPath === "/favicon.svg") return path.join(root, "assets/images/favicon.svg");
  if (cleanPath === "/preview.png") return path.join(root, "assets/images/preview.png");

  const pageName = cleanPath.replace(/^\/+/, "");
  if (/^[a-z0-9-]+\.html$/i.test(pageName)) {
    return path.join(pagesRoot, pageName);
  }
  return path.join(root, cleanPath.replace(/^\/+/, ""));
}

function localReferenceExists(htmlPath, reference) {
  const withoutSuffix = reference.split(/[?#]/, 1)[0];
  if (!withoutSuffix || withoutSuffix.startsWith("#") ||
      /^(?:https?:)?\/\//i.test(withoutSuffix) ||
      /^(?:data|mailto|tel):/i.test(withoutSuffix)) {
    return true;
  }
  const target = withoutSuffix.startsWith("/")
    ? resolvePublicAsset(withoutSuffix)
    : path.resolve(root, path.dirname(htmlPath), withoutSuffix);
  return fs.existsSync(target);
}

test("every public page has a title, main landmark and unique IDs", () => {
  assert.ok(htmlFiles.length > 0, "expected public HTML pages in pages/");
  for (const filename of htmlFiles) {
    const relativePath = path.join("pages", filename);
    const source = fs.readFileSync(path.join(pagesRoot, filename), "utf8");
    assert.match(source, /<title>[^<]+<\/title>/i, relativePath + " needs a document title");
    assert.match(source, /<main\b/i, relativePath + " needs a main landmark");
    const ids = Array.from(source.matchAll(/\bid=["']([^"']+)["']/gi), (match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], relativePath + " contains duplicate IDs");
  }
});

test("page script and stylesheet references resolve to committed assets", () => {
  for (const filename of htmlFiles) {
    const relativePath = path.join("pages", filename);
    const source = fs.readFileSync(path.join(pagesRoot, filename), "utf8");
    const scripts = Array.from(source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    const styles = Array.from(source.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    for (const reference of [...scripts, ...styles]) {
      assert.equal(localReferenceExists(relativePath, reference), true, relativePath + " has a missing local asset: " + reference);
    }
  }
});

test("all labels with a for attribute target a control on the same page", () => {
  for (const filename of htmlFiles) {
    const source = fs.readFileSync(path.join(pagesRoot, filename), "utf8");
    const ids = new Set(Array.from(source.matchAll(/\bid=["']([^"']+)["']/gi), (match) => match[1]));
    const labels = Array.from(source.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    for (const id of labels) {
      assert.equal(ids.has(id), true, filename + " has a label targeting missing id: " + id);
    }
  }
});
