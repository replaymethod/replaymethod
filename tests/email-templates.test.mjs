import assert from "node:assert/strict";
import test from "node:test";
import { analysisReadyEmail, analysisReceivedEmail, escapeEmailHtml } from "../lib/email-templates.mjs";

test("escapes untrusted report content in transactional HTML", () => {
  const escaped = escapeEmailHtml(`<script>alert("x")</script>`);
  assert.equal(escaped, "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");

  const ready = analysisReadyEmail({
    gameLabel: "Rocket League",
    mistake: `<img src=x onerror="alert(1)">`,
    url: `https://replaymethod.xyz/report/abc?next=" onclick="alert(1)`,
  });
  assert.doesNotMatch(ready.html, /<img|onclick="alert|onerror="alert/);
  assert.match(ready.html, /&lt;img/);
  assert.match(ready.html, /&quot;/);
});

test("renders useful plain-text and HTML versions for a received analysis", () => {
  const message = analysisReceivedEmail({
    gameLabel: "VALORANT",
    url: "https://replaymethod.xyz/access/private-token",
  });
  assert.match(message.subject, /VALORANT/);
  assert.match(message.text, /https:\/\/replaymethod\.xyz\/access\/private-token/);
  assert.match(message.text, /transactional message is separate/i);
  assert.match(message.html, /one-time link/i);
  assert.match(message.html, /contact@replaymethod\.xyz/);
});

test("report-ready template identifies the focus without making a rank claim", () => {
  const message = analysisReadyEmail({
    gameLabel: "League of Legends",
    mistake: "You contest river before your side wave is secured.",
    url: "https://replaymethod.xyz/report/private",
  });
  assert.match(message.text, /highest-impact mistake/i);
  assert.match(message.text, /side wave is secured/);
  assert.doesNotMatch(`${message.subject} ${message.text}`, /guarantee|rank up/i);
});
