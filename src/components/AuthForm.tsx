"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Mode = "login" | "signup";

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
};

export function AuthForm({
  mode: initialMode = "signup",
  nextPath = "/dashboard",
  redirectOnSuccess = true,
  onSuccess,
  compact = false,
}: {
  mode?: Mode;
  nextPath?: string;
  /** When false, call onSuccess instead of navigating away. */
  redirectOnSuccess?: boolean;
  onSuccess?: (user: PublicUser) => void | Promise<void>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setGoogleEnabled(Boolean(d.googleEnabled));
        if (d.user && redirectOnSuccess) {
          const destination =
            d.user.role === "admin" ? "/admin" : nextPath || "/dashboard";
          router.replace(destination);
        }
      })
      .catch(() => undefined);
  }, [router, nextPath, redirectOnSuccess]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "login"
              ? { email, password }
              : { name, email, password },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thất bại");

      if (!redirectOnSuccess) {
        await onSuccess?.(data.user);
        return;
      }

      const destination =
        data.user?.role === "admin" ? "/admin" : nextPath || "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`auth-card w-full ${
        compact ? "auth-card-compact p-5" : "p-6 md:p-8"
      }`}
    >
      {!compact ? (
        <>
          <p className="brand-font text-2xl font-semibold tracking-tight text-[#0a1f28]">
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#3d5a66]">
            {mode === "login"
              ? "Nhập email và mật khẩu để tiếp tục làm việc với bài giảng của bạn."
              : "Chỉ cần vài thông tin — sau đó bạn có thể tải file và xuất SCORM ngay."}
          </p>
        </>
      ) : (
        <>
          <p className="brand-font text-xl font-semibold tracking-tight text-[#0a1f28]">
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#3d5a66]">
            Đăng nhập hoặc tạo tài khoản để lưu trình chiếu vào workspace của bạn.
          </p>
        </>
      )}

      <form className="mt-6 space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
        {mode === "signup" ? (
          <label className="auth-label">
            Họ tên
            <input
              required
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
            />
          </label>
        ) : null}
        <label className="auth-label">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="ban@congty.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
        </label>
        <label className="auth-label">
          Mật khẩu
          <input
            required
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={6}
            placeholder={mode === "signup" ? "Tối thiểu 6 ký tự" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
        </label>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" disabled={busy} className="auth-submit">
          {busy
            ? "Đang xử lý…"
            : mode === "login"
              ? compact
                ? "Đăng nhập & tiếp tục"
                : "Đăng nhập"
              : compact
                ? "Tạo tài khoản & tiếp tục"
                : "Tạo tài khoản"}
        </button>
      </form>

      {!compact && googleEnabled ? (
        <>
          <div className="auth-divider">
            <span />
            <em>hoặc</em>
            <span />
          </div>
          <a href="/api/auth/google" className="auth-google">
            <GoogleIcon />
            Tiếp tục với Google
          </a>
        </>
      ) : null}

      <p className="mt-6 text-center text-sm text-[#3d5a66]">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            {compact ? (
              <button
                type="button"
                className="font-semibold text-[#0a1f28] underline decoration-[#1aa86b] underline-offset-2"
                onClick={() => setMode("signup")}
              >
                Đăng ký
              </button>
            ) : (
              <Link
                href="/signup"
                className="font-semibold text-[#0a1f28] underline decoration-[#1aa86b] underline-offset-2"
              >
                Đăng ký
              </Link>
            )}
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            {compact ? (
              <button
                type="button"
                className="font-semibold text-[#0a1f28] underline decoration-[#1aa86b] underline-offset-2"
                onClick={() => setMode("login")}
              >
                Đăng nhập
              </button>
            ) : (
              <Link
                href="/login"
                className="font-semibold text-[#0a1f28] underline decoration-[#1aa86b] underline-offset-2"
              >
                Đăng nhập
              </Link>
            )}
          </>
        )}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.7 0 2.9.7 3.6 1.3l2.4-2.4C16.7 3.8 14.5 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
      />
    </svg>
  );
}
