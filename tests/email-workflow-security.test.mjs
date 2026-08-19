import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const emailPath = new URL("../lib/email.ts", import.meta.url);
const pipelinePath = new URL("../lib/core/pipeline.ts", import.meta.url);
const schemaPath = new URL("../db/schema.ts", import.meta.url);

test("uses provider idempotency and bounded retry without coupling to marketing", async () => {
  const source = await readFile(emailPath, "utf8");
  assert.match(source, /"Idempotency-Key": idempotencyKey/);
  assert.match(source, /maxAttempts/);
  assert.match(source, /status = 'retry'/);
  assert.match(source, /provider_not_configured/);
  assert.doesNotMatch(source, /waitlist|marketingConsent|updatesConsent/);
});

test("suppresses report-ready email unless persisted report state is ready", async () => {
  const source = await readFile(emailPath, "utf8");
  assert.match(source, /report\?\.status !== "ready"/);
  assert.match(source, /analysis\.status !== "ready"/);
  const pipeline = await readFile(pipelinePath, "utf8");
  assert.ok(pipeline.indexOf("UPDATE analysis_requests SET status = 'ready'") < pipeline.indexOf("await sendAnalysisReady"));
});

test("persists delivery metadata without rendered bodies or private URLs", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const deliveryTable = schema.slice(schema.indexOf('sqliteTable("email_deliveries"'), schema.indexOf('sqliteTable("game_accounts"'));
  assert.match(deliveryTable, /idempotencyKey/);
  assert.match(deliveryTable, /providerMessageId/);
  assert.doesNotMatch(deliveryTable, /html|textBody|rendered|recipientEmail|privateUrl|claimToken/i);
});
