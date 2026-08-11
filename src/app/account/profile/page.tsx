"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setName(data.user.name || "");
        setEmail(data.user.email || "");
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu thất bại");
      setName(data.user.name);
      setMessage("Đã lưu hồ sơ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
      <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">Hồ sơ</h1>
      <p className="mt-1 text-sm text-[#5b6b7c]">
        Thông tin cơ bản của tài khoản của bạn.
      </p>

      <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
        Email
        <input
          value={email}
          disabled
          className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-[#f3f6f9] px-3 py-2.5 text-sm text-[#5b6b7c]"
        />
      </label>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
        Tên hiển thị
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-[#f7f9fb] px-3 py-2.5 text-sm font-medium text-[#0f2a36] outline-none focus:border-[#2bb673]"
        />
      </label>

      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => void save()}
        className="mt-6 rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024] disabled:opacity-50"
      >
        {busy ? "Đang lưu…" : "Lưu hồ sơ"}
      </button>
      {message ? (
        <p className="mt-3 text-sm font-medium text-[#1f7a4d]">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-medium text-[#c45c26]">{error}</p>
      ) : null}
    </section>
  );
}
