const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "assets", "external", "manifest.json");
const LOCK_PATH = path.join(ROOT, "assets", "external", "asset-lock.json");
const THIRD_PARTY_DOC = path.join(ROOT, "docs", "THIRD_PARTY_ASSETS.md");
const RUNTIME_DATA_PATH = path.join(ROOT, "js", "asset-data.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "";
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function parseRuntimeAssetData(source) {
  const marker = "window.ML.EXTERNAL_ASSET_DATA = Object.freeze(";
  const start = source.indexOf(marker);
  const end = source.lastIndexOf(");");
  if (start < 0 || end < start) return {};
  try {
    return JSON.parse(source.slice(start + marker.length, end));
  } catch (error) {
    fail(`Runtime asset data is not valid JSON: ${error.message}`);
    return {};
  }
}

const manifest = readJson(MANIFEST_PATH);
const lock = readJson(LOCK_PATH);
const doc = fs.readFileSync(THIRD_PARTY_DOC, "utf8");
const runtimeData = fs.existsSync(RUNTIME_DATA_PATH) ? fs.readFileSync(RUNTIME_DATA_PATH, "utf8") : "";
const runtimeAssetData = parseRuntimeAssetData(runtimeData);
const allowed = new Set(manifest.policy?.allowedLicenses || []);
const sourceIds = new Set();
let pngDownloads = 0;

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
  if (/\.png$/i.test(asset.localPath)) {
    pngDownloads += 1;
    const externalPath = asset.localPath.replace(/^assets\/external\//, "");
    const dataUrl = runtimeAssetData[externalPath];
    const mime = mimeFor(asset.localPath);
    const prefix = `data:${mime};base64,`;
    if (!dataUrl) {
      fail(`Runtime asset data missing ${externalPath}`);
    } else if (!dataUrl.startsWith(prefix)) {
      fail(`Runtime asset data has wrong MIME for ${externalPath}`);
    } else {
      const runtimeBytes = Buffer.from(dataUrl.slice(prefix.length), "base64");
      if (sha256(runtimeBytes) !== actual) fail(`Runtime asset data hash mismatch: ${externalPath}`);
    }
  }
}

if (!Array.isArray(lock.downloads) || lock.downloads.length < 20) {
  fail("Expected at least 20 downloaded candidate assets");
}

if (pngDownloads < 20) fail("Expected at least 20 packed PNG runtime assets");

if (!process.exitCode) {
  console.log(JSON.stringify({
    sources: sourceIds.size,
    downloaded: lock.downloads.length,
    status: "ok"
  }, null, 2));
}
