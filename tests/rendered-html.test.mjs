import assert from "node:assert/strict";
import test from "node:test";

const socialImageMeta =
  /<meta(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']https:\/\/replaymethod\.xyz\/og-takeover\.png["'])[^>]*>/i;

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
  assert.match(html, /Stop guessing why you(?:’|&#x27;)re stuck/i);
  assert.match(html, /START HERE/i);
  assert.match(html, /Join the replay beta/i);
  assert.doesNotMatch(html, /Drop your \.replay here/i);
  assert.match(html, /Choose my game/i);
  assert.match(html, /THREE STEPS · ONE RED THREAD/i);
});
