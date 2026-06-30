import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "portfolio_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

const loginAttempts = new Map<string, { failures: number; blockedUntil: number }>();
const LOGIN_BLOCK_CAP_MS = 5 * 60 * 1000;

export function readAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

export function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "";
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest();
}

export function secureEqual(left: string, right: string) {
  return timingSafeEqual(hashValue(left), hashValue(right));
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

type SessionPayload = {
  exp: number;
  nonce: string;
};

export function createAdminSessionToken(now = Date.now()) {
  const secret = getSessionSecret();
  if (!secret) return "";

  const payload: SessionPayload = {
    exp: now + ADMIN_SESSION_TTL_SECONDS * 1000,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string, now = Date.now()) {
  const secret = getSessionSecret();
  if (!secret) return false;

  const [encodedPayload, receivedSignature] = token.split(".");
  if (!encodedPayload || !receivedSignature) return false;

  const expectedSignature = sign(encodedPayload, secret);
  if (!secureEqual(receivedSignature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    return Number.isFinite(parsed.exp) && parsed.exp > now;
  } catch {
    return false;
  }
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_SESSION_TTL_SECONDS,
};

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return "local";
  return forwardedFor.split(",")[0]?.trim() || "local";
}

function getBlockDurationMs(failures: number) {
  const base = 1000;
  return Math.min(base * 2 ** Math.max(0, failures - 1), LOGIN_BLOCK_CAP_MS);
}

export function getLoginThrottle(ip: string, now = Date.now()) {
  const state = loginAttempts.get(ip);
  if (!state) return 0;
  if (state.blockedUntil <= now) return 0;
  return state.blockedUntil - now;
}

export function recordFailedLogin(ip: string, now = Date.now()) {
  const previous = loginAttempts.get(ip);
  const failures = (previous?.failures ?? 0) + 1;
  const blockedUntil = now + getBlockDurationMs(failures);
  loginAttempts.set(ip, { failures, blockedUntil });
  return blockedUntil - now;
}

export function clearLoginThrottle(ip: string) {
  loginAttempts.delete(ip);
}
