import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  OTP_GENERIC_ERROR,
  OTP_INVALID_MESSAGE,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_LIMIT_MESSAGE,
  OTP_REQUEST_MAX,
  OTP_REQUEST_MESSAGE,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OTP_VERIFY_MAX,
  cleanupExpiredEmailOtps,
  generateOtp,
  requestOtpAction,
  sanitizeAuthLog,
  verifyOtpAction,
  type EmailOtpDeps,
  type EmailVerificationCode,
} from "./email-otp";
import { createMemoryRateLimitBackend } from "./rate-limit";
import type { DocumentStore } from "../store";
import type { AuthUser } from "./types";

function createMemoryStore(): DocumentStore {
  const collections = new Map<string, Map<string, { id: string }>>();
  const meta = new Map<string, string>();
  function col(name: string) {
    let map = collections.get(name);
    if (!map) {
      map = new Map();
      collections.set(name, map);
    }
    return map;
  }
  return {
    async list(collection) {
      return [...col(collection).values()] as never;
    },
    async get(collection, id) {
      return (col(collection).get(id) as never) ?? null;
    },
    async put(collection, doc) {
      col(collection).set(doc.id, doc);
      return doc;
    },
    async putMany(collection, docs) {
      for (const doc of docs) col(collection).set(doc.id, doc);
    },
    async delete(collection, id) {
      return col(collection).delete(id);
    },
    async replaceAll(collection, docs) {
      const map = new Map<string, { id: string }>();
      for (const doc of docs) map.set(doc.id, doc);
      collections.set(collection, map);
    },
    async getMeta(key) {
      return meta.get(key) ?? null;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function testUser(email = "user@example.com"): AuthUser {
  return {
    id: "user-1",
    email,
    name: "Test User",
    passwordHash: "x",
    googleId: null,
    createdAt: new Date().toISOString(),
    role: "user",
    locked: false,
  };
}

function makeDeps(overrides: Partial<EmailOtpDeps> = {}) {
  let now = 1_700_000_000_000;
  const logs: string[] = [];
  const sent: Array<{ to: string; otp: string }> = [];
  const store = overrides.store ?? createMemoryStore();
  const users = new Map<string, AuthUser>();
  const deps: EmailOtpDeps & {
    advance: (ms: number) => void;
    logs: string[];
    sent: Array<{ to: string; otp: string }>;
    users: Map<string, AuthUser>;
    store: DocumentStore;
  } = {
    now: () => now,
    sendEmail: async (to, otp) => {
      sent.push({ to, otp });
    },
    hashOtp: async (otp) => sha256(otp),
    compareOtp: async (otp, hash) => sha256(otp) === hash,
    randomOtp: () => "123456",
    rateLimit: createMemoryRateLimitBackend(),
    findUser: async (email) => users.get(email) ?? null,
    markEmailVerified: async (userId) => {
      for (const [email, user] of users) {
        if (user.id === userId) {
          const next = {
            ...user,
            emailVerifiedAt: new Date(now).toISOString(),
          };
          users.set(email, next);
          return next;
        }
      }
      throw new Error("missing user");
    },
    skipDistributedLock: true,
    logger: {
      error(message, extra) {
        logs.push(`${message} ${extra === undefined ? "" : String(extra)}`);
      },
    },
    ...overrides,
    advance(ms: number) {
      now += ms;
    },
    logs,
    sent,
    users,
    store,
  };
  return deps;
}

describe("generateOtp", () => {
  it("creates a 6-digit code without Math.random", () => {
    for (let i = 0; i < 40; i += 1) {
      const otp = generateOtp();
      assert.match(otp, /^\d{6}$/);
      assert.ok(Number(otp) >= 100000);
      assert.ok(Number(otp) <= 999999);
    }
  });
});

describe("request OTP", () => {
  it("sends a hashed OTP for a valid existing email and hides existence", async () => {
    const deps = makeDeps();
    deps.users.set("user@example.com", testUser());
    const res = await requestOtpAction(
      { email: "  User@Example.com " },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, OTP_REQUEST_MESSAGE);
    assert.equal(JSON.stringify(res.body).includes("123456"), false);
    assert.equal(deps.sent.length, 1);
    assert.equal(deps.sent[0]?.otp, "123456");
    const stored = await deps.store.get<EmailVerificationCode>(
      "emailVerificationCodes",
      "user@example.com",
    );
    assert.ok(stored);
    assert.equal(stored?.codeHash, sha256("123456"));
    assert.equal(JSON.stringify(stored).includes("123456"), false);
  });

  it("returns the same success payload for an unknown email and does not send", async () => {
    const deps = makeDeps();
    const res = await requestOtpAction(
      { email: "missing@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, OTP_REQUEST_MESSAGE);
    assert.equal(deps.sent.length, 0);
    assert.doesNotMatch(JSON.stringify(res.body), /not found|does not exist/i);
  });

  it("rejects invalid email", async () => {
    const deps = makeDeps();
    const res = await requestOtpAction(
      { email: "not-an-email" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("enforces resend cooldown", async () => {
    const deps = makeDeps();
    deps.users.set("user@example.com", testUser());
    const first = await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    const second = await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.body.message, OTP_RATE_LIMIT_MESSAGE);
    assert.equal(deps.sent.length, 1);
  });

  it("enforces 5 OTP requests per 15 minutes", async () => {
    const deps = makeDeps();
    deps.users.set("user@example.com", testUser());
    for (let i = 0; i < OTP_REQUEST_MAX; i += 1) {
      const res = await requestOtpAction(
        { email: "user@example.com" },
        { ip: "1.1.1.1" },
        deps,
      );
      assert.equal(res.status, 200);
      deps.advance(OTP_RESEND_COOLDOWN_MS + 1);
    }
    const limited = await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(limited.status, 429);
  });

  it("applies cooldown even when the email does not exist", async () => {
    const deps = makeDeps();
    const first = await requestOtpAction(
      { email: "ghost@example.com" },
      { ip: "2.2.2.2" },
      deps,
    );
    const second = await requestOtpAction(
      { email: "ghost@example.com" },
      { ip: "2.2.2.2" },
      deps,
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
  });

  it("returns a generic error when email sending fails and invalidates the OTP", async () => {
    const deps = makeDeps({
      sendEmail: async () => {
        throw new Error("SMTP password hunter2");
      },
    });
    deps.users.set("user@example.com", testUser());
    const res = await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 500);
    assert.equal(res.body.message, OTP_GENERIC_ERROR);
    assert.doesNotMatch(JSON.stringify(res.body), /SMTP|hunter2|123456/);
    const stored = await deps.store.get<EmailVerificationCode>(
      "emailVerificationCodes",
      "user@example.com",
    );
    assert.equal(stored?.codeHash, null);
    assert.ok(stored?.usedAt);
  });

  it("returns a generic error on database failure", async () => {
    const store = createMemoryStore();
    store.put = async () => {
      throw new Error("Database error: connection refused");
    };
    const deps = makeDeps({ store });
    deps.users.set("user@example.com", testUser());
    const res = await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 500);
    assert.equal(res.body.message, OTP_GENERIC_ERROR);
    assert.doesNotMatch(JSON.stringify(res.body), /Database error/);
  });
});

describe("verify OTP", () => {
  async function seedValidOtp(deps: ReturnType<typeof makeDeps>) {
    deps.users.set("user@example.com", testUser());
    const res = await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 200);
  }

  it("accepts the correct OTP once", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    const res = await verifyOtpAction(
      { email: "user@example.com", otp: "123456" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, verified: true });
    assert.equal(res.sessionUser?.email, "user@example.com");
    assert.ok(res.sessionUser?.emailVerifiedAt);
    const stored = await deps.store.get<EmailVerificationCode>(
      "emailVerificationCodes",
      "user@example.com",
    );
    assert.ok(stored?.usedAt);
  });

  it("rejects a wrong OTP with a generic message", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    const res = await verifyOtpAction(
      { email: "user@example.com", otp: "000000" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.body.success, false);
    assert.equal(res.body.verified, false);
    assert.equal(res.body.message, OTP_INVALID_MESSAGE);
    assert.doesNotMatch(JSON.stringify(res.body), /incorrect|not found|does not exist/i);
  });

  it("rejects an expired OTP", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    deps.advance(OTP_TTL_MS + 1);
    const res = await verifyOtpAction(
      { email: "user@example.com", otp: "123456" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.body.verified, false);
    assert.equal(res.body.message, OTP_INVALID_MESSAGE);
  });

  it("rejects an already used OTP", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    const first = await verifyOtpAction(
      { email: "user@example.com", otp: "123456" },
      { ip: "1.1.1.1" },
      deps,
    );
    const second = await verifyOtpAction(
      { email: "user@example.com", otp: "123456" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(first.body.verified, true);
    assert.equal(second.body.verified, false);
    assert.equal(second.body.message, OTP_INVALID_MESSAGE);
  });

  it("invalidates the OTP after maximum failed attempts", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
      const res = await verifyOtpAction(
        { email: "user@example.com", otp: "000000" },
        { ip: "9.9.9.9" },
        deps,
      );
      assert.equal(res.body.verified, false);
    }
    const last = await verifyOtpAction(
      { email: "user@example.com", otp: "123456" },
      { ip: "9.9.9.9" },
      deps,
    );
    assert.equal(last.body.verified, false);
  });

  it("rejects an invalid OTP format", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    const res = await verifyOtpAction(
      { email: "user@example.com", otp: "12ab" },
      { ip: "1.1.1.1" },
      deps,
    );
    assert.equal(res.body.verified, false);
    assert.equal(res.body.message, OTP_INVALID_MESSAGE);
  });

  it("allows only one concurrent verification to succeed", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    const [a, b] = await Promise.all([
      verifyOtpAction(
        { email: "user@example.com", otp: "123456" },
        { ip: "1.1.1.1" },
        deps,
      ),
      verifyOtpAction(
        { email: "user@example.com", otp: "123456" },
        { ip: "1.1.1.1" },
        deps,
      ),
    ]);
    const wins = [a, b].filter((r) => r.body.verified === true);
    const losses = [a, b].filter((r) => r.body.verified !== true);
    assert.equal(wins.length, 1);
    assert.equal(losses.length, 1);
  });

  it("rate limits verify attempts", async () => {
    const deps = makeDeps();
    await seedValidOtp(deps);
    let limited = false;
    for (let i = 0; i < OTP_VERIFY_MAX + 2; i += 1) {
      const res = await verifyOtpAction(
        { email: "user@example.com", otp: "000000" },
        { ip: "8.8.8.8" },
        deps,
      );
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    assert.equal(limited, true);
  });
});

describe("security", () => {
  it("never puts OTP in API responses or logs", async () => {
    const captured: string[] = [];
    const original = {
      error: console.error,
      info: console.info,
      log: console.log,
      warn: console.warn,
    };
    console.error = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
    console.info = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
    console.warn = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
    try {
      const deps = makeDeps();
      deps.users.set("user@example.com", testUser());
      const req = await requestOtpAction(
        { email: "user@example.com" },
        { ip: "1.1.1.1" },
        deps,
      );
      const ver = await verifyOtpAction(
        { email: "user@example.com", otp: "123456" },
        { ip: "1.1.1.1" },
        deps,
      );
      const blob = `${JSON.stringify(req.body)}\n${JSON.stringify(ver.body)}\n${deps.logs.join("\n")}\n${captured.join("\n")}`;
      assert.equal(blob.includes("123456"), false);
    } finally {
      console.error = original.error;
      console.info = original.info;
      console.log = original.log;
      console.warn = original.warn;
    }
  });

  it("redacts OTP-like values from log sanitization", () => {
    assert.equal(sanitizeAuthLog("code 123456 failed"), "code [redacted] failed");
    assert.match(sanitizeAuthLog("SMTP password hunter2"), /redacted/i);
  });

  it("cleans up expired OTP rows outside the rate-limit window", async () => {
    const deps = makeDeps();
    deps.users.set("user@example.com", testUser());
    await requestOtpAction(
      { email: "user@example.com" },
      { ip: "1.1.1.1" },
      deps,
    );
    deps.advance(OTP_TTL_MS + 16 * 60 * 1000);
    await cleanupExpiredEmailOtps(deps);
    const stored = await deps.store.get<EmailVerificationCode>(
      "emailVerificationCodes",
      "user@example.com",
    );
    assert.equal(stored, null);
  });
});
