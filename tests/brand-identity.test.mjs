import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = relative => readFile(new URL(`../${relative}`, import.meta.url));
const text = async relative => (await read(relative)).toString("utf8");

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("restores the exact Sites v12 Replay Method mark without a play triangle", async () => {
  const [favicon, css, source] = await Promise.all([
    text("public/favicon.svg"),
    text("app/globals.css"),
    text("brand/replay-method-v12-source.html")
  ]);
  for (const value of [favicon, css, source]) {
    assert.match(value, /↻/);
    assert.match(value, /linear-gradient\(140deg,#a248ff,#5449ff\)/i);
    assert.doesNotMatch(value, /<polygon|m28 24 13 8-13 8|play-triangle/i);
  }
  assert.match(source, /900f6c1cee00d7e57f795c4367c6a971396f7a48/);
});

test("publishes complete favicon, manifest, profile and social-preview surfaces", async () => {
  const expected = [
    ["public/brand/replay-method-mark-v12-16.png", 16, 16],
    ["public/brand/replay-method-mark-v12-32.png", 32, 32],
    ["public/brand/replay-method-mark-v12-48.png", 48, 48],
    ["public/brand/replay-method-apple-touch-v12-180.png", 180, 180],
    ["public/brand/replay-method-mark-v12-192.png", 192, 192],
    ["public/brand/replay-method-mark-v12-512.png", 512, 512],
    ["public/brand/og-replay-method-v12-1200x630.png", 1200, 630],
    ["brand/profile-pack-v12/replay-method-canonical-2048.png", 2048, 2048],
    ["brand/profile-pack-v12/replay-method-tiktok-1080.png", 1080, 1080],
    ["brand/profile-pack-v12/replay-method-instagram-1080.png", 1080, 1080],
    ["brand/profile-pack-v12/replay-method-discord-1024.png", 1024, 1024],
    ["brand/profile-pack-v12/replay-method-youtube-800.png", 800, 800],
    ["brand/profile-pack-v12/replay-method-reddit-1000.png", 1000, 1000]
  ];
  for (const [file, width, height] of expected) assert.deepEqual(pngDimensions(await read(file)), [width, height], file);

  const [layout, manifest, readme] = await Promise.all([
    text("app/layout.tsx"), text("app/manifest.ts"), text("brand/profile-pack-v12/README.md")
  ]);
  assert.match(layout, /og-replay-method-v12-1200x630\.png/);
  assert.match(layout, /apple-touch-v12-180\.png/);
  assert.match(manifest, /mark-v12-192\.png/);
  assert.match(manifest, /mark-v12-512\.png/);
  assert.match(readme, /Sites version: 12/);
});
