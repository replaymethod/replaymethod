import assert from "node:assert/strict";
import test from "node:test";

const socialImageMeta =
  /<meta(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']https:\/\/replaymethod\.xyz\/brand\/og-replay-method-v16-1200x630\.png["'])[^>]*>/i;

test("renders production social metadata and the fail-closed product-first path", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, socialImageMeta);
  assert.match(html, /Replay Method — Stop losing for the same reason/i);
  assert.match(html, /type="file"[^>]*multiple/i);
  assert.match(html, /Drop 10 original \.replay files/i);
  assert.match(html, /Stop losing for.*the same reason/i);
  assert.match(html, /No signal, no guess/i);
  assert.doesNotMatch(html, /Your private report is ready|10 matches compared/i);
  assert.doesNotMatch(html, /Choose my game|Contribute one replay/i);
  assert.match(html, /Analyze my replays/i);
  assert.match(html, /Premium · planned/i);
  assert.match(html, /Track the fix/i);
});
