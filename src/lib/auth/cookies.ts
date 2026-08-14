/**
 * Whether auth cookies should use the Secure flag.
 *
 * Production + HTTP (no TLS yet) must set COOKIE_SECURE=false, otherwise
 * browsers drop guest/session cookies and APIs return 401.
 *
 * Priority: COOKIE_SECURE env → NEXT_PUBLIC_APP_URL scheme → NODE_ENV.
 */
export function cookieSecureFlag(): boolean {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "0" || explicit === "false" || explicit === "no") {
    return false;
  }
  if (explicit === "1" || explicit === "true" || explicit === "yes") {
    return true;
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().toLowerCase();
  if (appUrl.startsWith("http://")) return false;
  if (appUrl.startsWith("https://")) return true;
  return process.env.NODE_ENV === "production";
}
