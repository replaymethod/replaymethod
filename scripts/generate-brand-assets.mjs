import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packDir = path.join(root, "brand", "profile-pack-v12");
const publicBrandDir = path.join(root, "public", "brand");
const publicSocialDir = path.join(root, "public", "social");
const canonicalPath = path.join(packDir, "replay-method-canonical-2048.png");
const transparentPath = path.join(packDir, "replay-method-symbol-transparent-2048.png");
const sourceCommit = "900f6c1cee00d7e57f795c4367c6a971396f7a48";
const sitesArchiveHash = "sha256:a67fe4e5c3229a5296f2e0de8400307aa2e7b3fdebec18fb5a410f45cf42b8ae";

const markCss = (size, transparent = false) => `
  html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent}
  .mark{display:grid;place-items:center;width:${size}px;height:${size}px;${transparent ? "" : `border-radius:${size * 11 / 37}px;background:linear-gradient(140deg,#a248ff,#5449ff);`}color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:${size * 22 / 37}px;font-weight:900;line-height:normal}
`;

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="2048" height="2048" viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replay Method">
  <foreignObject width="37" height="37">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:grid;place-items:center;width:37px;height:37px;border-radius:11px;background:linear-gradient(140deg,#a248ff,#5449ff);color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;line-height:normal">↻</div>
  </foreignObject>
</svg>
`;

const sha256 = async file => createHash("sha256").update(await readFile(file)).digest("hex");

async function renderMark(page, file, size, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>${markCss(size, transparent)}</style><div class="mark">↻</div>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
}

async function resize(source, destination, size) {
  await sharp(source).resize(size, size, { kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toFile(destination);
}

async function renderOg(page) {
  const width = 1200;
  const height = 630;
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><style>
    *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#fff}
    body{position:relative;padding:58px 74px;background:radial-gradient(680px 520px at 8% 88%,rgba(117,62,255,.42),transparent 67%),radial-gradient(600px 500px at 94% 20%,rgba(37,229,255,.22),transparent 70%),#03040a}
    body:after{content:"";position:absolute;inset:28px;border:1px solid rgba(255,255,255,.1);border-radius:26px;pointer-events:none}
    .brand{display:flex;align-items:center;gap:22px}.mark{display:grid;place-items:center;width:82px;height:82px;border-radius:${82 * 11 / 37}px;background:linear-gradient(140deg,#a248ff,#5449ff);box-shadow:0 0 52px rgba(117,62,255,.5);font-size:${82 * 22 / 37}px;font-weight:900;line-height:normal}
    .word{font-size:34px;font-weight:900;letter-spacing:-1.6px}.word span{color:#25e5ff}.eyebrow{margin-top:52px;color:#baff3c;font-size:15px;font-weight:900;letter-spacing:3px}.hero{max-width:970px;margin:16px 0 22px;font-size:70px;line-height:.96;letter-spacing:-5px}.hero span{background:linear-gradient(90deg,#b252ff,#655cff 48%,#24ddff);-webkit-background-clip:text;color:transparent}.sub{max-width:820px;color:#b2b8ca;font-size:25px;line-height:1.45}.proof{position:absolute;left:74px;bottom:52px;color:#d7dbea;font-size:16px;font-weight:800;letter-spacing:1.3px}.proof b{color:#25e5ff}
  </style><div class="brand"><div class="mark">↻</div><div class="word">replay<span>method</span></div></div><div class="eyebrow">EARLY ACCESS BETA · EVIDENCE BEFORE ADVICE</div><h1 class="hero">Stop grinding blind.<br><span>Fix one decision next.</span></h1><p class="sub">Rocket League replay → one focus → one next-match rule.</p><div class="proof"><b>REPLAY</b> → REVEAL → PRACTICE → PROVE</div>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(publicBrandDir, "og-replay-method-v12-1200x630.png") });
}

async function buildSmallSizeSheet() {
  const sizes = [16, 32, 48, 64, 128];
  const width = 1600;
  const height = 560;
  const composites = [];
  for (const [index, size] of sizes.entries()) {
    const file = path.join(packDir, `replay-method-small-${size}.png`);
    const enlargedSize = Math.min(size * 4, 256);
    const enlarged = await sharp(file).resize(enlargedSize, enlargedSize, { kernel: sharp.kernel.nearest }).png().toBuffer();
    const left = 70 + index * 305;
    composites.push({ input: await readFile(file), left: left + 128 - Math.floor(size / 2), top: 72 });
    composites.push({ input: enlarged, left: left + 128 - Math.floor(enlargedSize / 2), top: 210 });
    composites.push({ input: Buffer.from(`<svg width="256" height="58"><text x="128" y="38" text-anchor="middle" fill="#f8f9ff" font-family="Arial" font-size="24" font-weight="700">${size} × ${size}</text></svg>`), left, top: 485 });
  }
  await sharp({ create: { width, height, channels: 4, background: "#0b0e1b" } }).composite(composites).png().toFile(path.join(packDir, "replay-method-small-size-validation.png"));
}

async function buildCircularCropSheet() {
  const items = [
    ["TikTok", "replay-method-tiktok-1080.png"],
    ["Instagram", "replay-method-instagram-1080.png"],
    ["Discord", "replay-method-discord-1024.png"],
    ["YouTube", "replay-method-youtube-800.png"],
    ["Reddit", "replay-method-reddit-1000.png"]
  ];
  const width = 1600;
  const height = 720;
  const composites = [];
  const circle = Buffer.from(`<svg width="256" height="256"><circle cx="128" cy="128" r="128" fill="#fff"/></svg>`);
  for (const [index, [label, filename]] of items.entries()) {
    const icon = await sharp(path.join(packDir, filename)).resize(256, 256).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const left = 72 + index * 305;
    composites.push({ input: icon, left, top: 82 });
    composites.push({ input: icon, left, top: 402 });
    composites.push({ input: Buffer.from(`<svg width="256" height="50"><text x="128" y="34" text-anchor="middle" fill="#f8f9ff" font-family="Arial" font-size="22" font-weight="700">${label}</text></svg>`), left, top: 25 });
  }
  const dark = await sharp({ create: { width, height: 360, channels: 4, background: "#03040a" } }).png().toBuffer();
  const light = await sharp({ create: { width, height: 360, channels: 4, background: "#f4f3fa" } }).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: "#03040a" } }).composite([{ input: dark, left: 0, top: 0 }, { input: light, left: 0, top: 360 }, ...composites]).png().toFile(path.join(packDir, "replay-method-circular-crop-validation.png"));
}

async function main() {
  await rm(packDir, { recursive: true, force: true });
  await mkdir(packDir, { recursive: true });
  await mkdir(publicBrandDir, { recursive: true });
  await mkdir(publicSocialDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2048, height: 2048 }, deviceScaleFactor: 1 });
  await renderMark(page, canonicalPath, 2048);
  await renderMark(page, transparentPath, 2048, true);
  await renderOg(page);
  await browser.close();

  await writeFile(path.join(packDir, "replay-method-mark-v12.svg"), markSvg);
  const platformSizes = [
    ["replay-method-tiktok-1080.png", 1080],
    ["replay-method-instagram-1080.png", 1080],
    ["replay-method-discord-1024.png", 1024],
    ["replay-method-youtube-800.png", 800],
    ["replay-method-reddit-1000.png", 1000]
  ];
  for (const [filename, size] of platformSizes) await resize(canonicalPath, path.join(packDir, filename), size);
  for (const size of [16, 32, 48, 64, 128]) await resize(canonicalPath, path.join(packDir, `replay-method-small-${size}.png`), size);

  for (const size of [16, 32, 48, 180, 192, 512]) {
    const filename = size === 180 ? "replay-method-apple-touch-v12-180.png" : `replay-method-mark-v12-${size}.png`;
    await resize(canonicalPath, path.join(publicBrandDir, filename), size);
  }
  const legacySocial = [
    ["discord-512.png", 512], ["facebook-320.png", 320], ["instagram-320.png", 320], ["reddit-256.png", 256],
    ["tiktok-200.png", 200], ["twitch-256.png", 256], ["x-400.png", 400], ["youtube-800.png", 800]
  ];
  for (const [filename, size] of legacySocial) await resize(canonicalPath, path.join(publicSocialDir, filename), size);

  await buildSmallSizeSheet();
  await buildCircularCropSheet();

  const fontPath = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
  const fontHash = await sha256(fontPath).catch(() => "unavailable");
  const sourceHash = await sha256(path.join(root, "brand", "replay-method-v12-source.html"));
  const readme = `# Replay Method profile image pack — historical identity v12\n\nThis pack is generated without redrawing or AI synthesis from the exact first Replay Method identity.\n\n- Sites version: 12\n- Git source: \`${sourceCommit}\` (\`Rebrand product as Replay Method\`)\n- Sites archive: \`${sitesArchiveHash}\`\n- Source file SHA-256: \`${sourceHash}\`\n- Historical source: white Unicode \`↻\`, Arial/Helvetica sans-serif at weight 900 and 22/37 tile scale; 11/37 corner radius; CSS \`linear-gradient(140deg,#a248ff,#5449ff)\`.\n- Raster font in this execution: \`${fontPath}\`, SHA-256 \`${fontHash}\`. The font is not redistributed.\n- The contextual historical glow is used in the website header; clean profile exports omit the external shadow so circular crops remain stable.\n\n## Files\n\n- \`replay-method-canonical-2048.png\` — canonical lossless square master.\n- \`replay-method-mark-v12.svg\` — scalable exact CSS/vector source.\n- \`replay-method-symbol-transparent-2048.png\` — white symbol on transparency.\n- \`replay-method-tiktok-1080.png\` — TikTok profile source.\n- \`replay-method-instagram-1080.png\` — Instagram profile source.\n- \`replay-method-discord-1024.png\` — Discord profile source.\n- \`replay-method-youtube-800.png\` — YouTube profile source.\n- \`replay-method-reddit-1000.png\` — Reddit profile source.\n- \`replay-method-small-{16,32,48,64,128}.png\` — small-size exports.\n- \`replay-method-small-size-validation.png\` — actual-size and nearest-neighbour inspection sheet.\n- \`replay-method-circular-crop-validation.png\` — dark/light circular crop sheet.\n- \`SHA256SUMS\` — hashes for every deliverable in the pack.\n\nExternal account avatars are not changed by this package.\n`;
  await writeFile(path.join(packDir, "README.md"), readme);

  const names = (await readdir(packDir)).filter(item => item !== "SHA256SUMS").sort();
  const sums = [];
  for (const name of names) sums.push(`${await sha256(path.join(packDir, name))}  ${name}`);
  await writeFile(path.join(packDir, "SHA256SUMS"), `${sums.join("\n")}\n`);
}

await main();
