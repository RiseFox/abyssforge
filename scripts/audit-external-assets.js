const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "assets", "external", "manifest.json");
const LOCK_PATH = path.join(ROOT, "assets", "external", "asset-lock.json");
const THIRD_PARTY_DOC = path.join(ROOT, "docs", "THIRD_PARTY_ASSETS.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const manifest = readJson(MANIFEST_PATH);
const lock = readJson(LOCK_PATH);
const doc = fs.readFileSync(THIRD_PARTY_DOC, "utf8");
const allowed = new Set(manifest.policy?.allowedLicenses || []);
const sourceIds = new Set();

for (const source of manifest.sources || []) {
  sourceIds.add(source.id);
  if (!source.id || !source.title || !source.author || !source.license || !source.sourceUrl || !source.licenseUrl) {
    fail(`Source metadata incomplete: ${source.id || "(missing id)"}`);
  }
  if (!allowed.has(source.license)) fail(`Disallowed license: ${source.id} -> ${source.license}`);
  if (!doc.includes(source.title) && !doc.includes(source.id)) fail(`Third-party doc does not mention ${source.id}`);
}

for (const asset of lock.downloads || []) {
  if (!sourceIds.has(asset.sourceId)) fail(`Lock references unknown source ${asset.sourceId}`);
  const localPath = path.join(ROOT, asset.localPath);
  if (!fs.existsSync(localPath)) {
    fail(`Missing asset file: ${asset.localPath}`);
    continue;
  }
  const data = fs.readFileSync(localPath);
  const actual = sha256(data);
  if (actual !== asset.sha256) fail(`Hash mismatch: ${asset.localPath}`);
  if (data.length !== asset.bytes) fail(`Size mismatch: ${asset.localPath}`);
}

if (!Array.isArray(lock.downloads) || lock.downloads.length < 20) {
  fail("Expected at least 20 downloaded candidate assets");
}

if (!process.exitCode) {
  console.log(JSON.stringify({
    sources: sourceIds.size,
    downloaded: lock.downloads.length,
    status: "ok"
  }, null, 2));
}
