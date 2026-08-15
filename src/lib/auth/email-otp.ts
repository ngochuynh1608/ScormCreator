import { randomInt, randomUUID } from "crypto";
import { z } from "zod";
import { COLLECTIONS, getDocumentStore, type DocumentStore } from "../store";
import { sendOtpEmail } from "../email/resend";
import { isRedisConfigured, getRedisConnection } from "../jobs/connection";
import { hashPassword, verifyPassword } from "./password";
import {
  defaultRateLimitBackend,
  type RateLimitBackend,
} from "./rate-limit";
import type { AuthUser } from "./types";
import { findUserByEmail, markEmailVerified as persistEmailVerified } from "./users";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_REQUEST_MAX = 5;
export const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const OTP_VERIFY_MAX = 10;
export const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
export const OTP_REQUEST_IP_MAX = 20;
export const OTP_VERIFY_IP_MAX = 40;

export const OTP_REQUEST_MESSAGE =
  "If this email is eligible, a verification code has been sent.";
export const OTP_INVALID_MESSAGE = "Invalid or expired verification code.";
export const OTP_RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";
export const OTP_GENERIC_ERROR = "Something went wrong. Please try again later.";

const emailSchema = z.string().trim().email();
const otpSchema = z.string().regex(/^\d{6}$/);

export type EmailVerificationCode = {
  id: string;
  userId: string | null;
  email: string;
  codeHash: string | null;
  expiresAt: string;
  usedAt: string | null;
  attemptCount: number;
  createdAt: string;
  sendTimestamps: string[];
};

export type AuthLogger = {
  error: (message: string, extra?: unknown) => void;
};

export type EmailOtpDeps = {
  store?: DocumentStore;
  now?: () => number;
  sendEmail?: (to: string, otp: string) => Promise<void>;
  hashOtp?: (otp: string) => Promise<string>;
  compareOtp?: (otp: string, hash: string) => Promise<boolean>;
  randomOtp?: () => string;
  rateLimit?: RateLimitBackend;
  findUser?: (email: string) => Promise<AuthUser | null>;
  markEmailVerified?: (userId: string) => Promise<AuthUser>;
  logger?: AuthLogger;
  skipDistributedLock?: boolean;
};

type JsonBody = Record<string, unknown>;

export type OtpActionResult = {
  status: number;
  body: JsonBody;
  sessionUser?: AuthUser;
};

const keyLocks = new Map<string, Promise<unknown>>();
let dummyHashPromise: Promise<string> | null = null;

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeAuthLog(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? "");
  return raw
    .replace(/\b\d{6}\b/g, "[redacted]")
    .replace(/SMTP password[^\n]*/gi, "SMTP credentials [redacted]")
    .replace(/RESEND_API_KEY[^\n]*/gi, "API key [redacted]");
}

function defaultLogger(): AuthLogger {
  return {
    error(message, extra) {
      if (extra === undefined) {
        console.error(message);
        return;
      }
      console.error(message, sanitizeAuthLog(extra));
    },
  };
}

async function dummyOtpHash(hashOtp: (otp: string) => Promise<string>) {
  dummyHashPromise ??= hashOtp("000000");
  return dummyHashPromise;
}

async function withKeyLock<T>(
  key: string,
  fn: () => Promise<T>,
  distributed = true,
): Promise<T> {
  const previous = keyLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(
    () => current,
    () => current,
  );
  keyLocks.set(key, chained);
  await previous.catch(() => undefined);
  try {
    if (!distributed || !isRedisConfigured()) {
      return await fn();
    }
    try {
      const redis = getRedisConnection();
      const token = randomUUID();
      const lockKey = `lock:${key}`;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const ok = await redis.set(lockKey, token, "PX", 8000, "NX");
        if (ok === "OK") {
          try {
            return await fn();
          } finally {
            const owned = await redis.get(lockKey);
            if (owned === token) await redis.del(lockKey);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    } catch {
      // Redis unavailable — fall through to in-process lock only.
    }
    return await fn();
  } finally {
    release();
    if (keyLocks.get(key) === chained) {
      keyLocks.delete(key);
    }
  }
}

async function resolveDeps(partial?: EmailOtpDeps) {
  const store = partial?.store ?? (await getDocumentStore());
  return {
    store,
    now: partial?.now ?? Date.now,
    sendEmail: partial?.sendEmail ?? sendOtpEmail,
    hashOtp: partial?.hashOtp ?? hashPassword,
    compareOtp: partial?.compareOtp ?? verifyPassword,
    randomOtp: partial?.randomOtp ?? generateOtp,
    rateLimit: partial?.rateLimit ?? defaultRateLimitBackend(),
    findUser: partial?.findUser ?? findUserByEmail,
    markEmailVerified: partial?.markEmailVerified ?? persistEmailVerified,
    logger: partial?.logger ?? defaultLogger(),
    skipDistributedLock: Boolean(partial?.skipDistributedLock),
  };
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function parseTimes(values: string[] | undefined, now: number, windowMs: number) {
  return (values || []).filter((value) => {
    const t = Date.parse(value);
    return Number.isFinite(t) && now - t < windowMs;
  });
}

function emptyCode(email: string, now: number): EmailVerificationCode {
  return {
    id: email,
    userId: null,
    email,
    codeHash: null,
    expiresAt: iso(now),
    usedAt: iso(now),
    attemptCount: 0,
    createdAt: iso(now),
    sendTimestamps: [],
  };
}

export async function cleanupExpiredEmailOtps(deps?: EmailOtpDeps) {
  const { store, now } = await resolveDeps(deps);
  const current = now();
  const rows = await store.list<EmailVerificationCode>(
    COLLECTIONS.emailVerificationCodes,
  );
  for (const row of rows) {
    const sends = parseTimes(row.sendTimestamps, current, OTP_REQUEST_WINDOW_MS);
    const expired = Date.parse(row.expiresAt) <= current;
    const used = Boolean(row.usedAt);
    const inactive = !row.codeHash || expired || used;
    if (sends.length === 0 && inactive) {
      await store.delete(COLLECTIONS.emailVerificationCodes, row.id);
    }
  }
}

async function loadCode(
  store: DocumentStore,
  email: string,
): Promise<EmailVerificationCode | null> {
  return store.get<EmailVerificationCode>(
    COLLECTIONS.emailVerificationCodes,
    email,
  );
}

async function saveCode(store: DocumentStore, row: EmailVerificationCode) {
  await store.put(COLLECTIONS.emailVerificationCodes, row);
}

function rateLimited(): OtpActionResult {
  return {
    status: 429,
    body: { success: false, message: OTP_RATE_LIMIT_MESSAGE },
  };
}

function genericError(): OtpActionResult {
  return {
    status: 500,
    body: { success: false, message: OTP_GENERIC_ERROR },
  };
}

export async function requestOtpAction(
  input: unknown,
  ctx: { ip: string },
  deps?: EmailOtpDeps,
): Promise<OtpActionResult> {
  const resolved = await resolveDeps(deps);
  let emailRaw: string;
  try {
    const parsed = z.object({ email: emailSchema }).parse(input);
    emailRaw = parsed.email;
  } catch {
    return {
      status: 400,
      body: { success: false, message: "Invalid request." },
    };
  }

  const email = normalizeEmail(emailRaw);
  const ip = ctx.ip || "unknown";

  try {
    const emailHits = await resolved.rateLimit.hit(
      `otp:req:email:${email}`,
      OTP_REQUEST_MAX,
      OTP_REQUEST_WINDOW_MS,
      resolved.now(),
    );
    const ipHits = await resolved.rateLimit.hit(
      `otp:req:ip:${ip}`,
      OTP_REQUEST_IP_MAX,
      OTP_REQUEST_WINDOW_MS,
      resolved.now(),
    );
    const cooldown = await resolved.rateLimit.acquireCooldown(
      `otp:req:cd:${email}`,
      OTP_RESEND_COOLDOWN_MS,
      resolved.now(),
    );
    if (!emailHits.allowed || !ipHits.allowed || !cooldown) {
      return rateLimited();
    }

    return await withKeyLock(
      `otp:${email}`,
      async () => {
      await cleanupExpiredEmailOtps(resolved);
      const now = resolved.now();
      const existing = (await loadCode(resolved.store, email)) || emptyCode(email, now);
      const sends = parseTimes(existing.sendTimestamps, now, OTP_REQUEST_WINDOW_MS);
      const lastSend = sends.length ? Date.parse(sends[sends.length - 1]) : 0;
      if (sends.length >= OTP_REQUEST_MAX) {
        return rateLimited();
      }
      if (lastSend && now - lastSend < OTP_RESEND_COOLDOWN_MS) {
        return rateLimited();
      }

      const user = await resolved.findUser(email);
      const eligible = Boolean(user && !user.locked);
      sends.push(iso(now));

      if (!user || !eligible) {
        existing.sendTimestamps = sends;
        existing.email = email;
        await saveCode(resolved.store, existing);
        await dummyOtpHash(resolved.hashOtp);
        return {
          status: 200,
          body: { success: true, message: OTP_REQUEST_MESSAGE },
        };
      }

      const otp = resolved.randomOtp();
      if (!/^\d{6}$/.test(otp)) {
        throw new Error("OTP generator produced an invalid code");
      }
      const codeHash = await resolved.hashOtp(otp);
      const next: EmailVerificationCode = {
        id: email,
        userId: user.id,
        email,
        codeHash,
        expiresAt: iso(now + OTP_TTL_MS),
        usedAt: null,
        attemptCount: 0,
        createdAt: iso(now),
        sendTimestamps: sends,
      };
      await saveCode(resolved.store, next);

      try {
        await resolved.sendEmail(email, otp);
      } catch (err) {
        next.usedAt = iso(now);
        next.codeHash = null;
        await saveCode(resolved.store, next);
        resolved.logger.error("email otp send failed", err);
        return genericError();
      }

      return {
        status: 200,
        body: { success: true, message: OTP_REQUEST_MESSAGE },
      };
    },
      !resolved.skipDistributedLock,
    );
  } catch (err) {
    resolved.logger.error("email otp request failed", err);
    return genericError();
  }
}

export async function verifyOtpAction(
  input: unknown,
  ctx: { ip: string },
  deps?: EmailOtpDeps,
): Promise<OtpActionResult> {
  const resolved = await resolveDeps(deps);
  const parsed = z
    .object({
      email: emailSchema,
      otp: z.string(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        verified: false,
        message: OTP_INVALID_MESSAGE,
      },
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const otp = parsed.data.otp.trim();
  const ip = ctx.ip || "unknown";
  const invalid = (): OtpActionResult => ({
    status: 200,
    body: {
      success: false,
      verified: false,
      message: OTP_INVALID_MESSAGE,
    },
  });

  try {
    const emailHits = await resolved.rateLimit.hit(
      `otp:ver:email:${email}`,
      OTP_VERIFY_MAX,
      OTP_VERIFY_WINDOW_MS,
      resolved.now(),
    );
    const ipHits = await resolved.rateLimit.hit(
      `otp:ver:ip:${ip}`,
      OTP_VERIFY_IP_MAX,
      OTP_VERIFY_WINDOW_MS,
      resolved.now(),
    );
    if (!emailHits.allowed || !ipHits.allowed) {
      return rateLimited();
    }

    if (!otpSchema.safeParse(otp).success) {
      await dummyOtpHash(resolved.hashOtp);
      return invalid();
    }

    return await withKeyLock(
      `otp:${email}`,
      async () => {
      const now = resolved.now();
      const row = await loadCode(resolved.store, email);
      const dummy = await dummyOtpHash(resolved.hashOtp);

      if (
        !row ||
        !row.codeHash ||
        row.usedAt ||
        Date.parse(row.expiresAt) <= now ||
        row.attemptCount >= OTP_MAX_ATTEMPTS
      ) {
        await resolved.compareOtp(otp, dummy);
        return invalid();
      }

      const ok = await resolved.compareOtp(otp, row.codeHash);
      if (!ok) {
        row.attemptCount += 1;
        if (row.attemptCount >= OTP_MAX_ATTEMPTS) {
          row.usedAt = iso(now);
        }
        await saveCode(resolved.store, row);
        return invalid();
      }

      row.usedAt = iso(now);
      await saveCode(resolved.store, row);

      const user = await resolved.findUser(email);
      if (!user || user.locked) {
        return invalid();
      }

      const verifiedUser = await resolved.markEmailVerified(user.id);
      return {
        status: 200,
        body: { success: true, verified: true },
        sessionUser: verifiedUser,
      };
    },
      !resolved.skipDistributedLock,
    );
  } catch (err) {
    resolved.logger.error("email otp verify failed", err);
    return genericError();
  }
}

