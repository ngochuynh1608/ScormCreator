"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreditBankSettings, CreditOrder, CreditPack } from "@/lib/credits/types";
import type { PlanOrder } from "@/lib/subscription/types";

type AdminOrder = CreditOrder & { userEmail?: string; userName?: string };
type AdminPlanOrder = PlanOrder & { userEmail?: string; userName?: string };

type PackDraft = {
  name: string;
  credits: string;
  priceVnd: string;
  active: boolean;
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

function statusLabel(s: CreditOrder["status"]) {
  if (s === "pending") return "Chờ xác nhận";
  if (s === "paid") return "Đã cộng";
  if (s === "rejected") return "Từ chối";
  return "Đã hủy";
}

export default function AdminCreditsPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [planOrders, setPlanOrders] = useState<AdminPlanOrder[]>([]);
  const [bank, setBank] = useState<CreditBankSettings>({
    bankName: "",
    accountNumber: "",
    accountName: "",
    transferNoteTemplate: "NAP {orderCode}",
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
      setOrders(data.orders || []);
      setPlanOrders(data.planOrders || []);
      if (data.bank) setBank(data.bank);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function review(order: AdminOrder, action: "confirm" | "reject") {
    const verb = action === "confirm" ? "xác nhận cộng credit" : "từ chối";
    if (!window.confirm(`${verb} đơn ${order.orderCode}?`)) return;
    setBusyId(order.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "order", id: order.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật đơn thất bại");
      setMessage(
        action === "confirm"
          ? `Đã cộng ${order.credits.toLocaleString("vi-VN")} credit.`
          : "Đã từ chối đơn.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật đơn thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewPlan(order: AdminPlanOrder, action: "confirm" | "reject") {
    const verb = action === "confirm" ? "kích hoạt gói" : "từ chối";
    if (!window.confirm(`${verb} đơn ${order.orderCode}?`)) return;
    setBusyId(order.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan-order", id: order.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật đơn thất bại");
      setMessage(
        action === "confirm"
          ? `Đã kích hoạt ${order.planName} (${order.months} tháng).`
          : "Đã từ chối đơn nâng cấp.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật đơn thất bại");
    } finally {
      setBusyId(null);
    }
  }

  const pending = orders
    .filter((o) => o.status === "pending")
    .sort((a, b) => {
      const ac = a.transferConfirmedAt ? 1 : 0;
      const bc = b.transferConfirmedAt ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  const pendingPlan = planOrders
    .filter((o) => o.status === "pending")
    .sort((a, b) => {
      const ac = a.transferConfirmedAt ? 1 : 0;
      const bc = b.transferConfirmedAt ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  const others = orders.filter((o) => o.status !== "pending");

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Credit TTS</h1>
          <p className="admin-desc">
            Gói nạp, tài khoản ngân hàng và xác nhận chuyển khoản.
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

      <h2 className="brand-font admin-title mt-8">Đơn nâng cấp gói</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Người dùng</th>
              <th>Gói</th>
              <th>Tháng</th>
              <th>Số tiền</th>
              <th>Nội dung CK</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pendingPlan.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-cell-muted">
                  Không có đơn nâng cấp chờ.
                </td>
              </tr>
            ) : (
              pendingPlan.map((o) => (
                <tr key={o.id}>
                  <td className="admin-cell-strong">{o.orderCode}</td>
                  <td className="admin-cell-muted">
                    {o.userEmail || o.userId}
                  </td>
                  <td className="admin-cell-muted">{o.planName}</td>
                  <td className="admin-cell-muted">{o.months}</td>
                  <td className="admin-cell-muted">{formatVnd(o.priceVnd)}</td>
                  <td className="admin-cell-muted">{o.transferContent}</td>
                  <td>
                    <div className="admin-row-actions">
                      {o.transferConfirmedAt ? (
                        <span className="admin-badge admin-badge-ok">
                          Đã CK
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge-neutral">
                          Chưa CK
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void reviewPlan(o, "confirm")}
                        className="admin-link"
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void reviewPlan(o, "reject")}
                        className="admin-link admin-link-danger"
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="brand-font admin-title mt-8">Đơn nạp chờ xác nhận</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Người dùng</th>
              <th>Gói</th>
              <th>Credit</th>
              <th>Số tiền</th>
              <th>Nội dung CK</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-cell-muted">
                  Không có đơn chờ.
                </td>
              </tr>
            ) : (
              pending.map((o) => (
                <tr key={o.id}>
                  <td className="admin-cell-strong">{o.orderCode}</td>
                  <td className="admin-cell-muted">
                    {o.userEmail || o.userId}
                  </td>
                  <td className="admin-cell-muted">{o.packName}</td>
                  <td className="admin-cell-muted">
                    {o.credits.toLocaleString("vi-VN")}
                  </td>
                  <td className="admin-cell-muted">{formatVnd(o.priceVnd)}</td>
                  <td className="admin-cell-muted">{o.transferContent}</td>
                  <td>
                    <div className="admin-row-actions">
                      {o.transferConfirmedAt ? (
                        <span className="admin-badge admin-badge-ok">
                          Đã CK
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge-neutral">
                          Chưa CK
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void review(o, "confirm")}
                        className="admin-link"
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void review(o, "reject")}
                        className="admin-link admin-link-danger"
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {others.length > 0 ? (
        <>
          <h2 className="brand-font admin-title mt-8">Đơn đã xử lý</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Gói</th>
                  <th>Credit</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {others.slice(0, 30).map((o) => (
                  <tr key={o.id}>
                    <td className="admin-cell-strong">{o.orderCode}</td>
                    <td className="admin-cell-muted">{o.packName}</td>
                    <td className="admin-cell-muted">
                      {o.credits.toLocaleString("vi-VN")}
                    </td>
                    <td className="admin-cell-muted">{statusLabel(o.status)}</td>
                    <td className="admin-cell-muted">
                      {new Date(o.updatedAt).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="admin-label">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input"
      />
    </label>
  );
}
