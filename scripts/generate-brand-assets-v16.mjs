import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");
const socialDir = path.join(root, "public", "social");
const mark = path.join(brandDir, "replay-method-mark-v16.svg");
const inverseMark = path.join(brandDir, "replay-method-mark-v16-inverse.svg");
const appIcon = path.join(brandDir, "replay-method-app-v16.svg");
const socialIcon = path.join(brandDir, "replay-method-social-v16.svg");
const og = path.join(brandDir, "og-replay-method-v16.svg");

await mkdir(brandDir, { recursive: true });
await mkdir(socialDir, { recursive: true });

async function renderPng(source, output, width, height = width) {
  const scale = 4;
  const oversampled = await sharp(source)
    .resize(width * scale, height * scale, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(oversampled)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(output);
}

for (const size of [16, 32, 48, 64, 1024]) {
  await renderPng(mark, path.join(brandDir, `replay-method-mark-v16-${size}.png`), size);
}

for (const size of [180, 192, 512]) {
  const name = size === 180 ? "replay-method-apple-touch-v16-180.png" : `replay-method-mark-v16-${size}.png`;
  await renderPng(appIcon, path.join(brandDir, name), size);
}

await renderPng(og, path.join(brandDir, "og-replay-method-v16-1200x630.png"), 1200, 630);

const social = [
  ["bluesky-400.png", 400],
  ["discord-512.png", 512],
  ["facebook-320.png", 320],
  ["instagram-320.png", 320],
  ["linkedin-400.png", 400],
  ["reddit-256.png", 256],
  ["threads-320.png", 320],
  ["tiktok-200.png", 200],
  ["twitch-256.png", 256],
  ["x-400.png", 400],
  ["youtube-800.png", 800],
];

for (const [name, size] of social) {
  await renderPng(socialIcon, path.join(socialDir, name), size);
}

await renderPng(socialIcon, path.join(socialDir, "universal-2048.png"), 2048);
await renderPng(inverseMark, path.join(socialDir, "symbol-white-transparent-2048.png"), 2048);
