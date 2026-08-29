/**
 * Gera ícones Android e splash a partir de frontend/rei-da-pelada-logo.svg
 * Uso: node scripts/generate-brand-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgBase = fs.readFileSync(path.join(root, "frontend/rei-da-pelada-logo.svg"), "utf8");
const svgWhite = svgBase.replace(/#000000/gi, "#FFFFFF");
const androidRes = path.join(root, "android/app/src/main/res");
const BRAND_GREEN = { r: 11, g: 61, b: 46, alpha: 1 }; // #0b3d2e

const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const launcherSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const splashes = {
  "drawable/splash.png": [480, 320],
  "drawable-port-mdpi/splash.png": [320, 480],
  "drawable-port-hdpi/splash.png": [480, 800],
  "drawable-port-xhdpi/splash.png": [720, 1280],
  "drawable-port-xxhdpi/splash.png": [960, 1600],
  "drawable-port-xxxhdpi/splash.png": [1280, 1920],
  "drawable-land-mdpi/splash.png": [480, 320],
  "drawable-land-hdpi/splash.png": [800, 480],
  "drawable-land-xhdpi/splash.png": [1280, 720],
  "drawable-land-xxhdpi/splash.png": [1600, 960],
  "drawable-land-xxxhdpi/splash.png": [1920, 1280],
};

async function logoPng(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size, { fit: "contain" }).png().toBuffer();
}

async function writeForeground(folder, size) {
  const pad = Math.round(size * 0.14);
  const inner = size - pad * 2;
  const logo = await logoPng(svgWhite, inner);
  const out = path.join(androidRes, folder, "ic_launcher_foreground.png");
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function writeLauncher(folder, size) {
  const logoSize = Math.round(size * 0.62);
  const logo = await logoPng(svgWhite, logoSize);
  const out = path.join(androidRes, folder, "ic_launcher.png");
  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_GREEN },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  const outRound = path.join(androidRes, folder, "ic_launcher_round.png");
  await fs.promises.copyFile(out, outRound);
  console.log("wrote", out, "+ round");
}

async function writeSplash(rel, [w, h]) {
  const logoSize = Math.round(Math.min(w, h) * 0.28);
  const logo = await logoPng(svgWhite, logoSize);
  const out = path.join(androidRes, rel);
  await sharp({
    create: { width: w, height: h, channels: 3, background: BRAND_GREEN },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

for (const [folder, size] of Object.entries(foregroundSizes)) {
  await writeForeground(folder, size);
}
for (const [folder, size] of Object.entries(launcherSizes)) {
  await writeLauncher(folder, size);
}
for (const [rel, dim] of Object.entries(splashes)) {
  await writeSplash(rel, dim);
}

console.log("Ícones e splash gerados.");
