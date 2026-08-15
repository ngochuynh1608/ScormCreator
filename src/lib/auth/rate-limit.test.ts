import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRateLimitBackend } from "./rate-limit";

describe("memory rate limit backend", () => {
  it("allows hits up to the limit then blocks", async () => {
    const backend = createMemoryRateLimitBackend();
    const now = 1_000;
    const a = await backend.hit("k", 2, 1_000, now);
    const b = await backend.hit("k", 2, 1_000, now);
    const c = await backend.hit("k", 2, 1_000, now);
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, true);
    assert.equal(c.allowed, false);
  });

  it("resets after the window", async () => {
    const backend = createMemoryRateLimitBackend();
    await backend.hit("k", 1, 1_000, 1_000);
    const blocked = await backend.hit("k", 1, 1_000, 1_000);
    const reset = await backend.hit("k", 1, 1_000, 2_001);
    assert.equal(blocked.allowed, false);
    assert.equal(reset.allowed, true);
  });

  it("enforces cooldown with acquireCooldown", async () => {
    const backend = createMemoryRateLimitBackend();
    const first = await backend.acquireCooldown("cd", 60_000, 1_000);
    const second = await backend.acquireCooldown("cd", 60_000, 1_000);
    const later = await backend.acquireCooldown("cd", 60_000, 61_001);
    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(later, true);
  });
});
