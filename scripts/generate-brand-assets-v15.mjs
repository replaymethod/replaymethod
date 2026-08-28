import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");
const socialDir = path.join(root, "public", "social");
const mark = path.join(brandDir, "replay-method-mark-v15.svg");
const appIcon = path.join(brandDir, "replay-method-app-v15.svg");
const og = path.join(brandDir, "og-replay-method-v15.svg");

await mkdir(brandDir, { recursive: true });
await mkdir(socialDir, { recursive: true });

for (const size of [16, 32, 48]) {
  await sharp(mark).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(brandDir, `replay-method-mark-v15-${size}.png`));
}

for (const size of [180, 192, 512]) {
  const name = size === 180 ? "replay-method-apple-touch-v15-180.png" : `replay-method-mark-v15-${size}.png`;
  await sharp(appIcon).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(brandDir, name));
}

await sharp(og).resize(1200, 630).png({ compressionLevel: 9 }).toFile(path.join(brandDir, "og-replay-method-v15-1200x630.png"));

const social = [
  ["discord-512.png", 512], ["facebook-320.png", 320], ["instagram-320.png", 320], ["reddit-256.png", 256],
  ["tiktok-200.png", 200], ["twitch-256.png", 256], ["x-400.png", 400], ["youtube-800.png", 800],
];
for (const [name, size] of social) await sharp(appIcon).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(socialDir, name));
