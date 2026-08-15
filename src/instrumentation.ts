export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { resolveResendSettings } = await import("./lib/email/settings");
    const { apiKey, from } = await resolveResendSettings();
    if (!apiKey || !from) {
      console.warn(
        "[email] OTP is not configured. Set Resend in Admin → Email OTP, or RESEND_API_KEY and EMAIL_FROM. The rest of the app will keep running.",
      );
    }
  } catch {
    console.warn(
      "[email] Could not read Resend settings at startup. Configure Admin → Email OTP or environment variables.",
    );
  }
}
