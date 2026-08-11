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
      className={`w-full rounded-[28px] bg-white/95 shadow-xl backdrop-blur ${
        compact ? "p-5" : "max-w-md p-6 md:p-8"
      }`}
    >
      <p className="brand-font text-2xl font-semibold text-[#0f2a36]">
        {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
        {compact
          ? "Đăng nhập hoặc tạo tài khoản để mở editor và lưu trình chiếu."
          : mode === "login"
            ? "Đăng nhập để tiếp tục — admin vào bảng điều khiển, user vào trình chiếu."
            : "Mở tài khoản để tạo và quản lý nhiều bài giảng SCORM."}
      </p>

      <form className="mt-6 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        {mode === "signup" ? (
          <label className="block text-xs font-semibold text-[#5b6b7c]">
            Họ tên
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36] outline-none focus:border-[#2bb673]"
            />
          </label>
        ) : null}
        <label className="block text-xs font-semibold text-[#5b6b7c]">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36] outline-none focus:border-[#2bb673]"
          />
        </label>
        <label className="block text-xs font-semibold text-[#5b6b7c]">
          Mật khẩu
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36] outline-none focus:border-[#2bb673]"
          />
        </label>
        {error ? (
          <p className="text-sm font-medium text-[#c45c26]">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-[#2bb673] px-4 py-3 text-sm font-bold text-[#083024] disabled:opacity-50"
        >
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
          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#8a98a8]">
            <span className="h-px flex-1 bg-[#e2e8ef]" />
            hoặc
            <span className="h-px flex-1 bg-[#e2e8ef]" />
          </div>
          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d5e1ea] bg-white px-4 py-3 text-sm font-semibold text-[#0f2a36] hover:bg-[#f7f9fb]"
          >
            <GoogleIcon />
            Tiếp tục với Google
          </a>
        </>
      ) : null}

      <p className="mt-5 text-center text-sm text-[#5b6b7c]">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            {compact ? (
              <button
                type="button"
                className="font-semibold text-[#0f2a36] underline"
                onClick={() => setMode("signup")}
              >
                Đăng ký
              </button>
            ) : (
              <Link href="/signup" className="font-semibold text-[#0f2a36]">
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
                className="font-semibold text-[#0f2a36] underline"
                onClick={() => setMode("login")}
              >
                Đăng nhập
              </button>
            ) : (
              <Link href="/login" className="font-semibold text-[#0f2a36]">
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
