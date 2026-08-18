import assert from "node:assert/strict";
import test from "node:test";

const socialImageMeta =
  /<meta(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']https:\/\/replaymethod\.xyz\/og\.png["'])[^>]*>/i;

test("renders production social metadata and the evidence-first promise", async () => {
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
  assert.match(html, /Stop losing for the same reason\./i);
  assert.match(html, /Drop your \.replay here/i);
  assert.match(html, /Upload first, email last/i);
});
