import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = relative => readFile(new URL(`../${relative}`, import.meta.url));
const text = async relative => (await read(relative)).toString("utf8");

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("publishes the original v13 Replay Method wave-and-return mark", async () => {
  const [favicon, component, source] = await Promise.all([
    text("public/favicon.svg"),
    text("app/components/ReplayMark.tsx"),
    text("public/brand/replay-method-mark-v13.svg")
  ]);
  for (const value of [favicon, component, source]) {
    assert.match(value, /M4\.5 23\.75|M64 338/);
    assert.match(value, /stroke-linecap="round"|strokeLinecap="round"/);
    assert.doesNotMatch(value, /<polygon|m28 24 13 8-13 8|play-triangle/i);
  }
  assert.match(source, /#F4F4F0/);
  assert.match(source, /#061A2E/);
});

test("publishes complete favicon, manifest, profile and social-preview surfaces", async () => {
  const expected = [
    ["public/brand/replay-method-mark-v13-16.png", 16, 16],
    ["public/brand/replay-method-mark-v13-32.png", 32, 32],
    ["public/brand/replay-method-mark-v13-48.png", 48, 48],
    ["public/brand/replay-method-apple-touch-v13-180.png", 180, 180],
    ["public/brand/replay-method-mark-v13-192.png", 192, 192],
    ["public/brand/replay-method-mark-v13-512.png", 512, 512],
    ["public/brand/og-replay-method-v13-1200x630.png", 1200, 630],
    ["public/social/tiktok-200.png", 200, 200],
    ["public/social/instagram-320.png", 320, 320],
    ["public/social/discord-512.png", 512, 512],
    ["public/social/youtube-800.png", 800, 800],
    ["public/social/reddit-256.png", 256, 256]
  ];
  for (const [file, width, height] of expected) assert.deepEqual(pngDimensions(await read(file)), [width, height], file);

  const [layout, manifest, generator] = await Promise.all([
    text("app/layout.tsx"), text("app/manifest.ts"), text("scripts/generate-brand-assets-v13.mjs")
  ]);
  assert.match(layout, /og-replay-method-v13-1200x630\.png/);
  assert.match(layout, /apple-touch-v13-180\.png/);
  assert.match(manifest, /mark-v13-192\.png/);
  assert.match(manifest, /mark-v13-512\.png/);
  assert.match(generator, /public", "social/);
});
