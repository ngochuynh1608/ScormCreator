import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractFromEmail,
  isValidEmailFrom,
  maskResendKey,
} from "./settings";

describe("Resend settings helpers", () => {
  it("masks API keys without exposing the full secret", () => {
    assert.equal(maskResendKey(""), "");
    assert.equal(maskResendKey("short"), "••••••••");
    const masked = maskResendKey("re_1234567890abcdef");
    assert.equal(masked.includes("re_1234567890"), false);
    assert.match(masked, /cdef$/);
  });

  it("accepts plain and display-name from addresses", () => {
    assert.equal(isValidEmailFrom("noreply@example.com"), true);
    assert.equal(
      isValidEmailFrom("ScormCreator <noreply@example.com>"),
      true,
    );
    assert.equal(extractFromEmail("ScormCreator <noreply@example.com>"), "noreply@example.com");
    assert.equal(isValidEmailFrom("not-an-email"), false);
    assert.equal(isValidEmailFrom("Name <bad>"), false);
  });
});
