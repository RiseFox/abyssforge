const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "assets", "external", "manifest.json");
const OUT_DIR = path.join(ROOT, "assets", "external");
const LOCK_PATH = path.join(OUT_DIR, "asset-lock.json");

function encodePathForUrl(assetPath) {
  return assetPath.split("/").map(encodeURIComponent).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function download(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AbyssForge asset intake"
    }
  });
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  const allowed = new Set(manifest.policy?.allowedLicenses || []);
  const maxBytes = manifest.policy?.maxDownloadBytes || 20 * 1024 * 1024;
  const downloads = [];

  for (const source of manifest.sources || []) {
    if (!allowed.has(source.license)) {
      throw new Error(`Source ${source.id} uses disallowed license ${source.license}`);
    }
    if (!Array.isArray(source.selected)) continue;

    for (const asset of source.selected) {
      if (!asset.sourceUrl && !source.rawBaseUrl) {
        throw new Error(`Asset ${source.id}/${asset.id} has no sourceUrl or rawBaseUrl`);
      }
      if (!asset.sourceUrl && !asset.sourcePath) {
        throw new Error(`Asset ${source.id}/${asset.id} has no sourcePath`);
      }
      const url = asset.sourceUrl || source.rawBaseUrl + encodePathForUrl(asset.sourcePath);
      const localPath = path.join(OUT_DIR, asset.localPath);
      const data = await download(url);
      if (data.length > maxBytes) {
        throw new Error(`Asset ${source.id}/${asset.id} is too large: ${data.length} bytes`);
      }
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, data);
      downloads.push({
        sourceId: source.id,
        assetId: asset.id,
        role: asset.role,
        license: source.license,
        sourceUrl: url,
        localPath: path.relative(ROOT, localPath).replace(/\\/g, "/"),
        bytes: data.length,
        sha256: sha256(data)
      });
      console.log(`asset ${source.id}/${asset.id} -> ${path.relative(ROOT, localPath)}`);
    }
  }

  const lock = {
    generatedAt: new Date().toISOString(),
    manifestVersion: manifest.version,
    downloads
  };
  await fs.writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`downloaded ${downloads.length} assets`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
