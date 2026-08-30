import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { env } from "./env.js";

const COOKIE = "monitor_session";
const SESSION_HOURS = 8;

/** Hash format: scrypt:<saltHex>:<hashHex>.
 *
 *  The separator is ":" and not "$" on purpose. Docker Compose interpolates variables inside
 *  .env values, so a hash containing "$" arrives truncated in the container — observed in
 *  practice, where the value became just "scrypt" and every login failed. */
export function hashPassword(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const computed = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  // timingSafeEqual requires equal lengths; the length comes from the stored hash itself.
  return timingSafeEqual(expected, computed);
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

function issueToken(user: string): string {
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${user}.${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function validateToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  const payload = Buffer.from(payloadB64, "base64url").toString();
  const expectedSig = Buffer.from(sign(payload));
  const receivedSig = Buffer.from(signature);
  if (expectedSig.length !== receivedSig.length || !timingSafeEqual(expectedSig, receivedSig))
    return null;
  const [user, expiresAt] = payload.split(".");
  if (!user || Number(expiresAt) < Date.now()) return null;
  return user;
}

// Simple per-IP rate limit. It does not replace a WAF; it exists so a brute-force attempt
// against the portal's single credential cannot run at thousands of tries per second.
const attempts = new Map<string, { n: number; ate: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function isBlocked(ip: string): boolean {
  const t = attempts.get(ip);
  if (!t) return false;
  if (Date.now() > t.ate) {
    attempts.delete(ip);
    return false;
  }
  return t.n >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const t = attempts.get(ip);
  if (!t || Date.now() > t.ate) {
    attempts.set(ip, { n: 1, ate: Date.now() + WINDOW_MS });
    return;
  }
  t.n += 1;
}

/** Routes reachable without a session. Everything else under /api/v1 requires login. */
const PUBLIC_ROUTES = new Set(["/health", "/ready", "/api/v1/auth/login", "/api/v1/auth/me"]);

export function registerGuard(app: FastifyInstance): void {
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split("?")[0];
    if (!path.startsWith("/api/")) return; // portal static assets
    if (PUBLIC_ROUTES.has(path)) return;
    if (!validateToken(req.cookies?.[COOKIE])) {
      reply.code(401).send({ error: "not authenticated" });
    }
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const ip = req.ip;
    if (isBlocked(ip)) {
      return reply.code(429).send({ error: "too many attempts, try again in a few minutes" });
    }
    const { user, password } = (req.body ?? {}) as { user?: string; password?: string };
    const okUser = user === env.adminUser;
    const okPassword =
      Boolean(password) && env.adminHash !== null && verifyPassword(password!, env.adminHash);
    if (!okUser || !okPassword) {
      recordFailure(ip);
      req.log.warn({ ip, user }, "login attempt rejected");
      // One generic message, so the response never reveals whether the user exists.
      return reply.code(401).send({ error: "invalid user or password" });
    }
    attempts.delete(ip);
    reply
      .setCookie(COOKIE, issueToken(user!), {
        httpOnly: true,
        sameSite: "lax",
        secure: env.cookieSecure,
        path: "/",
        maxAge: SESSION_HOURS * 60 * 60,
      })
      .send({ user });
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: "/" }).send({ ok: true });
  });

  app.get("/auth/me", async (req, reply) => {
    const user = validateToken(req.cookies?.[COOKIE]);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    reply.send({ user });
  });
}
