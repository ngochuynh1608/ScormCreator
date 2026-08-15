import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderOtpEmailHtml, renderOtpEmailText } from "./otp-template";

describe("OTP email template", () => {
  it("renders the required copy without extra sensitive fields", () => {
    const html = renderOtpEmailHtml("847291");
    const text = renderOtpEmailText("847291");
    assert.match(html, /Your verification code/);
    assert.match(html, /847291/);
    assert.match(html, /expire in 5 minutes/);
    assert.match(html, /safely ignore this email/);
    assert.match(html, /viewport/);
    assert.doesNotMatch(html, /password|token|secret/i);
    assert.match(text, /Your verification code is:/);
    assert.match(text, /847291/);
  });

  it("rejects non-OTP payloads", () => {
    assert.throws(() => renderOtpEmailHtml("12"));
    assert.throws(() => renderOtpEmailText("abcdef"));
  });
});
