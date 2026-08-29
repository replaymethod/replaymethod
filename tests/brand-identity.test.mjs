import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = relative => readFile(new URL(`../${relative}`, import.meta.url));
const text = async relative => (await read(relative)).toString("utf8");

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("publishes the v16 Replay Method balanced-soft anchor mark", async () => {
  const [favicon, component, source] = await Promise.all([
    text("public/favicon.svg"),
    text("app/components/ReplayMark.tsx"),
    text("public/brand/replay-method-mark-v16.svg")
  ]);
  for (const value of [favicon, component, source]) {
    assert.match(value, /M18 10H36/);
    assert.match(value, /M28 19\.5H46/);
    assert.match(value, /M32\.55 28\.5C33\.45 28\.5/);
    assert.match(value, /M44\.55 28\.5C45\.45 28\.5/);
    assert.match(value, /mask/);
  }
  assert.match(source, /#091729/i);
  assert.doesNotMatch(source, /stroke|circle|polygon/i);
});

test("publishes complete favicon, manifest, profile and social-preview surfaces", async () => {
  const expected = [
    ["public/brand/replay-method-mark-v16-16.png", 16, 16],
    ["public/brand/replay-method-mark-v16-32.png", 32, 32],
    ["public/brand/replay-method-mark-v16-48.png", 48, 48],
    ["public/brand/replay-method-apple-touch-v16-180.png", 180, 180],
    ["public/brand/replay-method-mark-v16-192.png", 192, 192],
    ["public/brand/replay-method-mark-v16-512.png", 512, 512],
    ["public/brand/og-replay-method-v16-1200x630.png", 1200, 630],
    ["public/social/bluesky-400.png", 400, 400],
    ["public/social/tiktok-200.png", 200, 200],
    ["public/social/instagram-320.png", 320, 320],
    ["public/social/discord-512.png", 512, 512],
    ["public/social/youtube-800.png", 800, 800],
    ["public/social/reddit-256.png", 256, 256],
    ["public/social/facebook-320.png", 320, 320],
    ["public/social/linkedin-400.png", 400, 400],
    ["public/social/threads-320.png", 320, 320],
    ["public/social/twitch-256.png", 256, 256],
    ["public/social/x-400.png", 400, 400],
    ["public/social/universal-2048.png", 2048, 2048],
    ["public/social/symbol-white-transparent-2048.png", 2048, 2048]
  ];
  for (const [file, width, height] of expected) assert.deepEqual(pngDimensions(await read(file)), [width, height], file);

  const [layout, manifest, generator] = await Promise.all([
    text("app/layout.tsx"), text("app/manifest.ts"), text("scripts/generate-brand-assets-v16.mjs")
  ]);
  assert.match(layout, /og-replay-method-v16-1200x630\.png/);
  assert.match(layout, /apple-touch-v16-180\.png/);
  assert.match(manifest, /mark-v16-192\.png/);
  assert.match(manifest, /mark-v16-512\.png/);
  assert.match(generator, /public", "social/);
  assert.match(generator, /const scale = 4/);
  assert.match(generator, /sharp\.kernel\.lanczos3/);
});
