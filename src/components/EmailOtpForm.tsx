"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
};

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatMmSs(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function EmailOtpForm({
  nextPath = "/dashboard",
  redirectOnSuccess = true,
  onSuccess,
  compact = false,
  embedded = false,
  initialEmail = "",
  initialStep = "email",
  lockEmail = false,
  variant = "login",
  onBack,
}: {
  nextPath?: string;
  redirectOnSuccess?: boolean;
  onSuccess?: (user: PublicUser) => void | Promise<void>;
  compact?: boolean;
  embedded?: boolean;
  initialEmail?: string;
  initialStep?: "email" | "otp";
  lockEmail?: boolean;
  variant?: "login" | "signup";
  onBack?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"email" | "otp">(initialStep);
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    initialStep === "otp"
      ? "If this email is eligible, a verification code has been sent."
      : null,
  );
  const [expiresIn, setExpiresIn] = useState(OTP_TTL_SECONDS);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (step !== "otp") return;
    window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    const id = window.setInterval(() => {
      setExpiresIn((value) => Math.max(0, value - 1));
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step]);

  async function requestCode(isResend = false) {
    setBusy(true);
    setError(null);
    if (!isResend) setInfo(null);
    try {
      const res = await fetch("/api/auth/email/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
      };
      if (res.status === 429) {
        throw new Error(data.message || "Too many requests. Please try again later.");
      }
      if (!res.ok) {
        throw new Error(data.message || "Không gửi được mã xác thực.");
      }
      setStep("otp");
      setDigits(Array(OTP_LENGTH).fill(""));
      submittedRef.current = false;
      setExpiresIn(OTP_TTL_SECONDS);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setInfo(
        data.message ||
          "If this email is eligible, a verification code has been sent.",
      );
      window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được mã xác thực.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(code: string) {
    if (submittedRef.current || code.length !== OTP_LENGTH) return;
    submittedRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        verified?: boolean;
        message?: string;
      };
      if (res.status === 429) {
        submittedRef.current = false;
        throw new Error(data.message || "Too many requests. Please try again later.");
      }
      if (!res.ok || !data.verified) {
        submittedRef.current = false;
        throw new Error(
          data.message || "Invalid or expired verification code.",
        );
      }

      const meRes = await fetch("/api/auth/me");
      const me = (await meRes.json()) as { user?: PublicUser | null };
      if (!me.user) {
        throw new Error("Invalid or expired verification code.");
      }

      if (!redirectOnSuccess) {
        await onSuccess?.(me.user);
        return;
      }
      const destination =
        me.user.role === "admin" ? "/admin" : nextPath || "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực thất bại.");
      setDigits(Array(OTP_LENGTH).fill(""));
      window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } finally {
      setBusy(false);
    }
  }

  function updateDigits(next: string[]) {
    setDigits(next);
    const code = next.join("");
    if (code.length === OTP_LENGTH && next.every((d) => d !== "")) {
      void verifyCode(code);
    }
  }

  function onDigitChange(index: number, value: string) {
    const digit = onlyDigits(value).slice(-1);
    const next = [...digits];
    next[index] = digit;
    updateDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function onDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = onlyDigits(e.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (text.length < 2) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < text.length; i += 1) next[i] = text[i];
    updateDigits(next);
    const focusAt = Math.min(text.length, OTP_LENGTH - 1);
    inputRefs.current[focusAt]?.focus();
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    await requestCode(false);
  }

  const inner = (
    <>
      {!embedded ? (
        <>
          <p className="brand-font text-2xl font-semibold tracking-tight text-[#0a1f28]">
            {variant === "signup"
              ? "Xác thực email"
              : "Đăng nhập bằng mã email"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#3d5a66]">
            {variant === "signup"
              ? "Nhập mã 6 số đã gửi đến email của bạn. Mã hết hạn sau 5 phút."
              : "Nhập email để nhận mã xác thực 6 số. Mã hết hạn sau 5 phút."}
          </p>
        </>
      ) : null}

      {step === "email" ? (
        <form
          className={embedded ? "space-y-3.5" : "mt-6 space-y-3.5"}
          onSubmit={(e) => void onEmailSubmit(e)}
        >
          <label className="auth-label" htmlFor="otp-email">
            Email
            <input
              id="otp-email"
              required
              type="email"
              autoComplete="email"
              placeholder="ban@congty.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </label>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className="auth-submit">
            {busy ? "Đang gửi…" : "Gửi mã xác thực"}
          </button>
        </form>
      ) : (
        <form
          className={embedded ? "space-y-3.5" : "mt-6 space-y-3.5"}
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode(digits.join(""));
          }}
        >
          {info ? (
            <p className="text-sm leading-relaxed text-[#3d5a66]">{info}</p>
          ) : null}
          <fieldset className="min-w-0">
            <legend className="auth-label mb-2">Nhập mã xác thực</legend>
            <div className="auth-otp-grid">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className="auth-otp-digit"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  pattern="[0-9]*"
                  maxLength={1}
                  aria-label={`Chữ số ${index + 1} của mã xác thực`}
                  value={digit}
                  disabled={busy}
                  onChange={(e) => onDigitChange(index, e.target.value)}
                  onKeyDown={(e) => onDigitKeyDown(index, e)}
                  onPaste={onPaste}
                />
              ))}
            </div>
          </fieldset>
          <p className="auth-otp-meta">
            Code expires in {formatMmSs(expiresIn)}
          </p>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || digits.join("").length !== OTP_LENGTH}
            className="auth-submit"
          >
            {busy ? "Đang xác thực…" : "Xác thực"}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="auth-otp-meta">Didn&apos;t receive the code?</p>
            <button
              type="button"
              className="auth-text-btn"
              disabled={busy || resendIn > 0}
              onClick={() => void requestCode(true)}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </div>
          {!lockEmail ? (
          <button
            type="button"
            className="auth-text-btn"
            disabled={busy}
            onClick={() => {
              setStep("email");
              setDigits(Array(OTP_LENGTH).fill(""));
              setError(null);
              setInfo(null);
            }}
          >
            Dùng email khác
          </button>
          ) : null}
        </form>
      )}

      {onBack && variant !== "signup" ? (
        <p className="mt-5 text-center text-sm text-[#3d5a66]">
          <button type="button" className="auth-text-btn" onClick={onBack}>
            Đăng nhập bằng mật khẩu
          </button>
        </p>
      ) : null}
    </>
  );

  if (embedded) return inner;

  return (
    <div
      className={`auth-card w-full ${
        compact ? "auth-card-compact p-5" : "p-6 md:p-8"
      }`}
    >
      {inner}
    </div>
  );
}
