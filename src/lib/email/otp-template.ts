const OTP_PATTERN = /^\d{6}$/;

export function renderOtpEmailHtml(otp: string): string {
  if (!OTP_PATTERN.test(otp)) {
    throw new Error("Invalid verification code payload.");
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background:#f2f7fa;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:440px;border-collapse:collapse;background:#ffffff;border-radius:16px;border:1px solid #d5e1ea;">
          <tr>
            <td style="padding:32px 24px;">
              <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0a1f28;">Your verification code</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#3d5a66;">Your verification code is:</p>
              <p style="margin:0 0 20px;font-size:32px;line-height:1.2;letter-spacing:0.35em;font-weight:700;color:#0a1f28;">${otp}</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#3d5a66;">This code will expire in 5 minutes.</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#5f7b88;">If you did not request this code, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderOtpEmailText(otp: string): string {
  if (!OTP_PATTERN.test(otp)) {
    throw new Error("Invalid verification code payload.");
  }
  return [
    "Your verification code",
    "",
    "Your verification code is:",
    "",
    otp,
    "",
    "This code will expire in 5 minutes.",
    "",
    "If you did not request this code, you can safely ignore this email.",
  ].join("\n");
}
