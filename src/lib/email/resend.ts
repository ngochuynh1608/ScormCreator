import { Resend } from "resend";
import { renderOtpEmailHtml, renderOtpEmailText } from "./otp-template";
import { resolveResendSettings } from "./settings";

export function getEmailEnv() {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || "",
    from: process.env.EMAIL_FROM?.trim() || "",
  };
}

export async function assertEmailConfigured() {
  const { apiKey, from } = await resolveResendSettings();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!from) {
    throw new Error("EMAIL_FROM is not set");
  }
  return { apiKey, from };
}

let client: Resend | null = null;
let clientKey: string | null = null;

function getResend(apiKey: string) {
  if (!client || clientKey !== apiKey) {
    client = new Resend(apiKey);
    clientKey = apiKey;
  }
  return client;
}

export async function sendOtpEmail(to: string, otp: string) {
  const { apiKey, from } = await assertEmailConfigured();
  const resend = getResend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: "Your verification code",
    html: renderOtpEmailHtml(otp),
    text: renderOtpEmailText(otp),
  });
  if (result.error) {
    throw new Error(result.error.message || "Failed to send email");
  }
}

export async function sendTestEmail(to: string) {
  const { apiKey, from } = await assertEmailConfigured();
  const resend = getResend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: "ScormCreator email test",
    text: "Resend is configured. This is a test message from ScormCreator. You can ignore this email.",
    html: `<p style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0a1f28;">Resend is configured. This is a test message from ScormCreator. You can ignore this email.</p>`,
  });
  if (result.error) {
    throw new Error(result.error.message || "Failed to send email");
  }
  return { id: result.data?.id || null };
}

export function resetResendClient() {
  client = null;
  clientKey = null;
}
