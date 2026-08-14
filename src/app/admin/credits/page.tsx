"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreditBankSettings, CreditPack } from "@/lib/credits/types";

type PackDraft = {
  name: string;
  credits: string;
  priceVnd: string;
  active: boolean;
};

type PayosPublic = {
  configured: boolean;
  source: "admin" | "env" | "none";
  clientIdPreview: string;
  apiKeyPreview: string;
  checksumKeyPreview: string;
  returnBaseUrl: string;
  webhookUrl: string;
};

const emptyPack = (): PackDraft => ({
  name: "",
  credits: "100",
  priceVnd: "50000",
  active: true,
});

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

export default function AdminCreditsPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [bank, setBank] = useState<CreditBankSettings>({
    bankName: "",
    accountNumber: "",
    accountName: "",
    transferNoteTemplate: "NAP {orderCode}",
  });
  const [payos, setPayos] = useState<PayosPublic | null>(null);
  const [payosDraft, setPayosDraft] = useState({
    clientId: "",
    apiKey: "",
    checksumKey: "",
    returnBaseUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PackDraft>(emptyPack());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/credits");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được credit");
      setPacks(data.packs || []);
      if (data.bank) setBank(data.bank);
      if (data.payos) {
        setPayos(data.payos as PayosPublic);
        setPayosDraft({
          clientId: "",
          apiKey: "",
          checksumKey: "",
          returnBaseUrl: data.payos.returnBaseUrl || "",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePayos() {
    setBusyId("payos");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "payos",
          clientId: payosDraft.clientId.trim() || undefined,
          apiKey: payosDraft.apiKey.trim() || undefined,
          checksumKey: payosDraft.checksumKey.trim() || undefined,
          returnBaseUrl: payosDraft.returnBaseUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu PayOS thất bại");
      setPayos(data.payos);
      setPayosDraft({
        clientId: "",
        apiKey: "",
        checksumKey: "",
        returnBaseUrl: data.payos.returnBaseUrl || "",
      });
      setMessage("Đã lưu cấu hình PayOS.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu PayOS thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function clearPayosKeys() {
    setBusyId("payos");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "payos",
          clearKeys: true,
          returnBaseUrl: payosDraft.returnBaseUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa key PayOS thất bại");
      setPayos(data.payos);
      setPayosDraft({
        clientId: "",
        apiKey: "",
        checksumKey: "",
        returnBaseUrl: data.payos.returnBaseUrl || "",
      });
      setMessage("Đã xóa key PayOS đã lưu. Hệ thống dùng biến môi trường nếu có.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa key PayOS thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function saveBank() {
    setBusyId("bank");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "bank", ...bank }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu STK thất bại");
      setBank(data.bank);
      setMessage("Đã lưu thông tin chuyển khoản.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu STK thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function savePack() {
    setBusyId(editingId || "new");
    setError(null);
    setMessage(null);
    try {
      const payload = {
        kind: "pack" as const,
        name: draft.name.trim(),
        credits: Number(draft.credits),
        priceVnd: Number(draft.priceVnd),
        active: draft.active,
      };
      const res = await fetch("/api/admin/credits", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload,
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu gói thất bại");
      setCreating(false);
      setEditingId(null);
      setDraft(emptyPack());
      setMessage(editingId ? "Đã cập nhật gói." : "Đã thêm gói credit.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu gói thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function removePack(p: CreditPack) {
    if (!window.confirm(`Xóa gói "${p.name}"?`)) return;
    setBusyId(p.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pack", id: p.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setMessage("Đã xóa gói.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Credit TTS</h1>
          <p className="admin-desc">
            Cấu hình PayOS, gói nạp credit, và STK dự phòng. Đơn giao dịch xem
            tại Lịch sử giao dịch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
            setDraft(emptyPack());
          }}
          className="admin-btn-primary"
        >
          + Thêm gói nạp
        </button>
      </div>

      {loading ? <p className="admin-muted">Đang tải…</p> : null}
      {error ? <p className="admin-alert-error">{error}</p> : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      <h2 className="brand-font admin-title mt-2">PayOS</h2>
      <p className="admin-desc">
        Lấy Client ID, API Key, Checksum Key tại{" "}
        <a
          href="https://my.payos.vn"
          target="_blank"
          rel="noopener noreferrer"
          className="admin-link"
        >
          my.payos.vn
        </a>
        . Ô trống khi lưu sẽ giữ key hiện có. Key không hiện đầy đủ sau khi lưu.
      </p>
      <div className="admin-form-grid">
        <Field
          label="PAYOS_CLIENT_ID"
          value={payosDraft.clientId}
          onChange={(v) => setPayosDraft({ ...payosDraft, clientId: v })}
          placeholder={payos?.clientIdPreview || "Client ID"}
          secret
        />
        <Field
          label="PAYOS_API_KEY"
          value={payosDraft.apiKey}
          onChange={(v) => setPayosDraft({ ...payosDraft, apiKey: v })}
          placeholder={payos?.apiKeyPreview || "API Key"}
          secret
        />
        <Field
          label="PAYOS_CHECKSUM_KEY"
          value={payosDraft.checksumKey}
          onChange={(v) => setPayosDraft({ ...payosDraft, checksumKey: v })}
          placeholder={payos?.checksumKeyPreview || "Checksum Key"}
          secret
        />
        <Field
          label="PAYOS_RETURN_BASE_URL"
          value={payosDraft.returnBaseUrl}
          onChange={(v) => setPayosDraft({ ...payosDraft, returnBaseUrl: v })}
          placeholder="http://localhost:3000"
        />
        <p className="admin-muted" style={{ gridColumn: "1 / -1" }}>
          Trạng thái:{" "}
          {payos?.configured
            ? payos.source === "admin"
              ? "Đã cấu hình (admin)"
              : "Đã cấu hình (file .env)"
            : "Chưa cấu hình"}
          {payos?.webhookUrl ? (
            <>
              {" · "}Webhook: <code>{payos.webhookUrl}</code>
            </>
          ) : null}
        </p>
        <div className="admin-form-actions">
          <button
            type="button"
            disabled={busyId === "payos"}
            onClick={() => void savePayos()}
            className="admin-btn-dark"
          >
            {busyId === "payos" ? "Đang lưu…" : "Lưu PayOS"}
          </button>
          <button
            type="button"
            disabled={busyId === "payos"}
            onClick={() => void clearPayosKeys()}
            className="admin-btn-muted"
          >
            Xóa key đã lưu
          </button>
        </div>
      </div>

      <h2 className="brand-font admin-title mt-8">Tài khoản ngân hàng (dự phòng)</h2>
      <div className="admin-form-grid">
        <Field
          label="Ngân hàng"
          value={bank.bankName}
          onChange={(v) => setBank({ ...bank, bankName: v })}
        />
        <Field
          label="Số tài khoản"
          value={bank.accountNumber}
          onChange={(v) => setBank({ ...bank, accountNumber: v })}
        />
        <Field
          label="Chủ tài khoản"
          value={bank.accountName}
          onChange={(v) => setBank({ ...bank, accountName: v })}
        />
        <Field
          label="Mẫu nội dung CK (dùng {orderCode})"
          value={bank.transferNoteTemplate}
          onChange={(v) => setBank({ ...bank, transferNoteTemplate: v })}
        />
        <div className="admin-form-actions">
          <button
            type="button"
            disabled={busyId === "bank"}
            onClick={() => void saveBank()}
            className="admin-btn-dark"
          >
            {busyId === "bank" ? "Đang lưu…" : "Lưu STK"}
          </button>
        </div>
      </div>

      {(creating || editingId) && (
        <div className="admin-form-grid">
          <Field
            label="Tên gói"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
          />
          <Field
            label="Số credit"
            value={draft.credits}
            onChange={(v) => setDraft({ ...draft, credits: v })}
          />
          <Field
            label="Giá (VNĐ)"
            value={draft.priceVnd}
            onChange={(v) => setDraft({ ...draft, priceVnd: v })}
          />
          <label className="admin-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) =>
                setDraft({ ...draft, active: e.target.checked })
              }
            />
            Đang bán
          </label>
          <div className="admin-form-actions">
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void savePack()}
              className="admin-btn-dark"
            >
              {busyId ? "Đang lưu…" : "Lưu gói"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
                setDraft(emptyPack());
              }}
              className="admin-btn-muted"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Gói nạp</th>
              <th>Credit</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id}>
                <td className="admin-cell-strong">{p.name}</td>
                <td className="admin-cell-muted">
                  {p.credits.toLocaleString("vi-VN")}
                </td>
                <td className="admin-cell-muted">{formatVnd(p.priceVnd)}</td>
                <td>
                  {p.active ? (
                    <span className="admin-badge admin-badge-ok">Đang bán</span>
                  ) : (
                    <span className="admin-badge admin-badge-neutral">Ẩn</span>
                  )}
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => {
                        setCreating(false);
                        setEditingId(p.id);
                        setDraft({
                          name: p.name,
                          credits: String(p.credits),
                          priceVnd: String(p.priceVnd),
                          active: p.active,
                        });
                      }}
                      className="admin-link"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void removePack(p)}
                      className="admin-link admin-link-danger"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <label className="admin-label">
      {label}
      <input
        type={secret ? "password" : "text"}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input"
      />
    </label>
  );
}
