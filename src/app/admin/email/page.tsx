"use client";

import { useEffect, useState } from "react";

type EmailPublic = {
  configured: boolean;
  source: "admin" | "env" | "none";
  apiKeyPreview: string;
  from: string;
};

export default function AdminEmailPage() {
  const [email, setEmail] = useState<EmailPublic | null>(null);
  const [draft, setDraft] = useState({ apiKey: "", from: "" });
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/admin/email");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error || "Không tải được cấu hình email");
        }
        const next = data.email as EmailPublic;
        setEmail(next);
        setDraft({ apiKey: "", from: next.from || "" });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: draft.apiKey.trim() || undefined,
          from: draft.from.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu Resend thất bại");
      const next = data.email as EmailPublic;
      setEmail(next);
      setDraft({ apiKey: "", from: next.from || "" });
      setMessage("Đã lưu cấu hình Resend.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu Resend thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          to: testTo.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi email thử thất bại");
      setMessage(data.message || "Đã gửi email thử.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi email thử thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearKey: true,
          from: draft.from.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa key Resend thất bại");
      const next = data.email as EmailPublic;
      setEmail(next);
      setDraft({ apiKey: "", from: next.from || "" });
      setMessage(
        "Đã xóa API key đã lưu. Hệ thống dùng biến môi trường nếu có.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa key Resend thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-stack">
      <div className="admin-panel pb-4">
        <h1 className="brand-font admin-title">Email OTP</h1>
        <p className="admin-desc">
          Cấu hình Resend để gửi mã xác thực đăng ký và đăng nhập. Lấy API key tại{" "}
          <a
            href="https://resend.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-link"
          >
            resend.com/api-keys
          </a>
          . Ô API key trống khi lưu sẽ giữ key hiện có. Key không hiện đầy đủ sau
          khi lưu.
        </p>
      </div>

      {loading ? <p className="admin-muted">Đang tải…</p> : null}
      {error ? <p className="admin-alert-error">{error}</p> : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      <div className="admin-form-grid">
        <label className="admin-label">
          RESEND_API_KEY
          <input
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            placeholder={email?.apiKeyPreview || "re_••••"}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            className="admin-input"
          />
        </label>
        <label className="admin-label">
          EMAIL_FROM
          <input
            type="text"
            autoComplete="off"
            value={draft.from}
            placeholder="ScormCreator &lt;noreply@your-domain.com&gt;"
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="admin-input"
          />
        </label>
        <p className="admin-muted" style={{ gridColumn: "1 / -1" }}>
          Trạng thái:{" "}
          {email?.configured
            ? email.source === "admin"
              ? "Đã cấu hình (admin)"
              : "Đã cấu hình (file .env)"
            : email?.apiKeyPreview
              ? "Chưa gửi được — thiếu EMAIL_FROM (domain đã xác thực trên Resend)"
              : "Chưa cấu hình"}
        </p>
        <div className="admin-form-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="admin-btn-dark"
          >
            {busy ? "Đang lưu…" : "Lưu Resend"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void clearKey()}
            className="admin-btn-muted"
          >
            Xóa key đã lưu
          </button>
        </div>
        <label className="admin-label" style={{ gridColumn: "1 / -1" }}>
          Gửi email thử tới
          <input
            type="email"
            autoComplete="off"
            value={testTo}
            placeholder="you@example.com"
            onChange={(e) => setTestTo(e.target.value)}
            className="admin-input"
          />
        </label>
        <div className="admin-form-actions">
          <button
            type="button"
            disabled={busy || !testTo.trim()}
            onClick={() => void sendTest()}
            className="admin-btn-dark"
          >
            {busy ? "Đang gửi…" : "Gửi email thử"}
          </button>
        </div>
      </div>
    </section>
  );
}
