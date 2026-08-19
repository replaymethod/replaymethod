import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlayerToken,
  hashPlayerToken,
  PLAYER_SESSION_COOKIE,
  playerSessionCookie,
  playerTokenPattern,
  readCookie
} from "../lib/player-identity.mjs";

test("creates unpredictable URL-safe 256-bit player tokens", () => {
  const first = createPlayerToken();
  const second = createPlayerToken();
  assert.match(first, playerTokenPattern);
  assert.match(second, playerTokenPattern);
  assert.notEqual(first, second);
});

test("hashes ownership tokens without storing the credential", async () => {
  const token = createPlayerToken();
  const hash = await hashPlayerToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, await hashPlayerToken(token));
  assert.notEqual(hash, token);
});

test("serializes and reads an essential locked-down player session cookie", () => {
  const token = createPlayerToken();
  const cookie = playerSessionCookie(token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /^__Host-rm_player_session=/);
  assert.equal(readCookie(`other=value; ${cookie}`, PLAYER_SESSION_COOKIE), token);
  assert.equal(readCookie("broken", PLAYER_SESSION_COOKIE), "");
});
