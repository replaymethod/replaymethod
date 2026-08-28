const COOKIE_NAME = "rm_local_review_session";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function binding(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function base64UrlEncode(value) {
  let binary = "";
  for (const byte of encoder.encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return decoder.decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function equalSecrets(left, right) {
  if (!left || !right) return false;
  return equalBytes(await digest(left), await digest(right));
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return [...signature].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function requestHost(headers) {
  return (headers.get("host") || "").split(",")[0].trim().toLowerCase();
}

export function isLoopbackReviewRequest(headers) {
  const host = requestHost(headers);
  return /^localhost(?::\d+)?$/u.test(host)
    || /^127(?:\.\d{1,3}){3}(?::\d+)?$/u.test(host)
    || /^\[::1\](?::\d+)?$/u.test(host);
}

export function localReviewAvailable(env, headers) {
  const ownerToken = binding(env, "RL_LOCAL_REVIEW_OWNER_TOKEN");
  const reviewerToken = binding(env, "RL_LOCAL_REVIEWER_TOKEN");
  return binding(env, "RL_LOCAL_REVIEW_ENABLED") === "true"
    && ownerToken.length >= 32
    && reviewerToken.length >= 32
    && ownerToken !== reviewerToken
    && isLoopbackReviewRequest(headers);
}

function validEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? email : null;
}

function boundedName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, 120) : "";
}

async function stableUserId(role, email) {
  const value = await digest(`${role}:${email}`);
  return `local-review-${role}-${[...value].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24)}`;
}

export async function createLocalReviewSession(env, headers, input, now = Date.now()) {
  if (!localReviewAvailable(env, headers)) return null;
  const accessCode = typeof input?.accessCode === "string" ? input.accessCode : "";
  const ownerToken = binding(env, "RL_LOCAL_REVIEW_OWNER_TOKEN");
  const reviewerToken = binding(env, "RL_LOCAL_REVIEWER_TOKEN");
  const role = await equalSecrets(accessCode, ownerToken) ? "owner"
    : await equalSecrets(accessCode, reviewerToken) ? "reviewer"
      : null;
  const email = validEmail(input?.email);
  const displayName = boundedName(input?.displayName);
  if (!role || !email || !displayName) return null;

  const payload = {
    version: 1,
    role,
    email,
    displayName,
    userId: await stableUserId(role, email),
    expiresAt: now + SESSION_SECONDS * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(ownerToken, encoded);
  return {
    role,
    user: { id: payload.userId, email, displayName, fullName: displayName, localRole: role },
    cookie: `${COOKIE_NAME}=${encoded}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}`,
  };
}

function cookieValue(headers) {
  const cookies = (headers.get("cookie") || "").split(";");
  for (const cookie of cookies) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

export async function readLocalReviewSession(env, headers, now = Date.now()) {
  if (!localReviewAvailable(env, headers)) return null;
  const value = cookieValue(headers);
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = await sign(binding(env, "RL_LOCAL_REVIEW_OWNER_TOKEN"), encoded);
  if (!(await equalSecrets(signature, expected))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (payload?.version !== 1
      || (payload.role !== "owner" && payload.role !== "reviewer")
      || !validEmail(payload.email)
      || !boundedName(payload.displayName)
      || typeof payload.userId !== "string"
      || !payload.userId.startsWith(`local-review-${payload.role}-`)
      || !Number.isFinite(payload.expiresAt)
      || payload.expiresAt <= now) return null;
    return {
      id: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
      fullName: payload.displayName,
      localRole: payload.role,
    };
  } catch {
    return null;
  }
}

export function clearLocalReviewSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export const LOCAL_REVIEW_SESSION_COOKIE = COOKIE_NAME;
