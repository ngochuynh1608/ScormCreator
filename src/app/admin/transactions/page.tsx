"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreditOrder } from "@/lib/credits/types";
import type { PlanOrder } from "@/lib/subscription/types";

type AdminCreditOrder = CreditOrder & { userEmail?: string; userName?: string };
type AdminPlanOrder = PlanOrder & { userEmail?: string; userName?: string };
type Tab = "credit" | "plan";
type ReviewKind = "order" | "plan-order";
type ReviewAction = "confirm" | "reject";

type ReviewPrompt = {
  kind: ReviewKind;
  action: ReviewAction;
  id: string;
  orderCode: string;
  type: string;
  packName: string;
  credits?: string;
  user: string;
  amount: string;
};

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN");
}

function userLabel(o: { userEmail?: string; userName?: string; userId: string }) {
  if (o.userName && o.userEmail) return `${o.userName} · ${o.userEmail}`;
  return o.userEmail || o.userName || o.userId;
}

function statusLabel(s: CreditOrder["status"] | PlanOrder["status"]) {
  if (s === "pending") return "Chờ duyệt";
  if (s === "paid") return "Đã duyệt";
  if (s === "rejected") return "Từ chối";
  return "Đã hủy";
}

function sortPending<T extends { transferConfirmedAt?: string; createdAt: string }>(
  rows: T[],
) {
  return [...rows].sort((a, b) => {
    const ac = a.transferConfirmedAt ? 1 : 0;
    const bc = b.transferConfirmedAt ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function sortDone<T extends { updatedAt: string }>(rows: T[]) {
  return [...rows].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function orderRef(o: { payosReference?: string; transferContent?: string }) {
  return o.payosReference || o.transferContent || "—";
}

function pendingNote(o: {
  note?: string;
  reviewedBy?: string;
  transferConfirmedAt?: string;
  checkoutUrl?: string;
}) {
  if (o.note?.trim()) return o.note.trim();
  if (o.reviewedBy === "payos") return "PayOS";
  if (o.transferConfirmedAt) return "Đã báo chuyển khoản";
  if (o.checkoutUrl) return "Chờ PayOS";
  return "—";
}

function doneNote(o: { note?: string; reviewedBy?: string }) {
  if (o.note?.trim()) return o.note.trim();
  if (o.reviewedBy === "payos") return "PayOS tự duyệt";
  return "—";
}

export default function AdminTransactionsPage() {
  const [tab, setTab] = useState<Tab>("credit");
  const [orders, setOrders] = useState<AdminCreditOrder[]>([]);
  const [planOrders, setPlanOrders] = useState<AdminPlanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<ReviewPrompt | null>(null);
  const [promptNote, setPromptNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/credits");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được giao dịch");
      setOrders(data.orders || []);
      setPlanOrders(data.planOrders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openReview(next: ReviewPrompt) {
    setPrompt(next);
    setPromptNote("");
    setError(null);
  }

  function closePrompt() {
    if (busyId) return;
    setPrompt(null);
    setPromptNote("");
  }

  async function submitReview() {
    if (!prompt) return;
    setBusyId(prompt.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: prompt.kind,
          id: prompt.id,
          action: prompt.action,
          note: promptNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật đơn thất bại");
      setMessage(
        prompt.action === "confirm"
          ? prompt.kind === "plan-order"
            ? "Đã kích hoạt gói."
            : "Đã cộng credit."
          : "Đã từ chối đơn.",
      );
      setPrompt(null);
      setPromptNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật đơn thất bại");
    } finally {
      setBusyId(null);
    }
  }

  const creditPending = useMemo(
    () => sortPending(orders.filter((o) => o.status === "pending")),
    [orders],
  );
  const creditDone = useMemo(
    () => sortDone(orders.filter((o) => o.status !== "pending")),
    [orders],
  );
  const planPending = useMemo(
    () => sortPending(planOrders.filter((o) => o.status === "pending")),
    [planOrders],
  );
  const planDone = useMemo(
    () => sortDone(planOrders.filter((o) => o.status !== "pending")),
    [planOrders],
  );

  const promptTitle =
    prompt?.action === "confirm"
      ? prompt.kind === "plan-order"
        ? "Xác nhận kích hoạt gói"
        : "Xác nhận cộng credit"
      : "Từ chối đơn";
  const promptConfirmLabel =
    prompt?.action === "confirm"
      ? prompt.kind === "plan-order"
        ? "Kích hoạt gói"
        : "Cộng credit"
      : "Từ chối đơn";

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Lịch sử giao dịch</h1>
          <p className="admin-desc">
            Đơn nạp credit và nâng cấp gói qua PayOS — tự duyệt khi thanh toán
            thành công. Vẫn có thể xác nhận/từ chối tay khi webhook lệch.
          </p>
        </div>
      </div>

      {loading ? <p className="admin-muted">Đang tải…</p> : null}
      {error ? <p className="admin-alert-error">{error}</p> : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("credit")}
          className={`rounded-full px-4 py-2 text-sm font-bold ${
            tab === "credit"
              ? "bg-[#0f2a36] text-white"
              : "bg-[#e8eef5] text-[#0f2a36]"
          }`}
        >
          Đơn nạp credit
        </button>
        <button
          type="button"
          onClick={() => setTab("plan")}
          className={`rounded-full px-4 py-2 text-sm font-bold ${
            tab === "plan"
              ? "bg-[#0f2a36] text-white"
              : "bg-[#e8eef5] text-[#0f2a36]"
          }`}
        >
          Đơn nâng cấp gói
        </button>
      </div>

      {tab === "credit" ? (
        <>
          <OrderSection
            title="Đơn chờ duyệt"
            empty="Không có đơn nạp credit chờ duyệt."
            showCredits
            pending
            rows={creditPending.map((o) => ({
              id: o.id,
              orderCode: o.orderCode,
              type: "Mua credit",
              packName: o.packName,
              credits: o.credits.toLocaleString("vi-VN"),
              user: userLabel(o),
              amount: formatVnd(o.priceVnd),
              ref: orderRef(o),
              status: statusLabel(o.status),
              time: formatTime(o.createdAt),
              note: pendingNote(o),
              transferred: Boolean(o.transferConfirmedAt || o.payosReference),
              payos: Boolean(o.checkoutUrl || o.payosOrderCode),
            }))}
            busyId={busyId}
            onConfirm={(row) =>
              openReview({
                kind: "order",
                action: "confirm",
                id: row.id,
                orderCode: row.orderCode,
                type: row.type,
                packName: row.packName,
                credits: row.credits,
                user: row.user,
                amount: row.amount,
              })
            }
            onReject={(row) =>
              openReview({
                kind: "order",
                action: "reject",
                id: row.id,
                orderCode: row.orderCode,
                type: row.type,
                packName: row.packName,
                credits: row.credits,
                user: row.user,
                amount: row.amount,
              })
            }
          />
          <OrderSection
            title="Đơn hoàn thành"
            empty="Chưa có đơn nạp credit hoàn thành."
            showCredits
            rows={creditDone.map((o) => ({
              id: o.id,
              orderCode: o.orderCode,
              type: "Mua credit",
              packName: o.packName,
              credits: o.credits.toLocaleString("vi-VN"),
              user: userLabel(o),
              amount: formatVnd(o.priceVnd),
              ref: orderRef(o),
              status: statusLabel(o.status),
              time: formatTime(o.updatedAt),
              note: doneNote(o),
            }))}
          />
        </>
      ) : (
        <>
          <OrderSection
            title="Đơn chờ duyệt"
            empty="Không có đơn nâng cấp chờ duyệt."
            pending
            rows={planPending.map((o) => ({
              id: o.id,
              orderCode: o.orderCode,
              type: "Nâng cấp",
              packName: `${o.planName} · ${o.months} tháng`,
              user: userLabel(o),
              amount: formatVnd(o.priceVnd),
              ref: orderRef(o),
              status: statusLabel(o.status),
              time: formatTime(o.createdAt),
              note: pendingNote(o),
              transferred: Boolean(o.transferConfirmedAt || o.payosReference),
              payos: Boolean(o.checkoutUrl || o.payosOrderCode),
            }))}
            busyId={busyId}
            onConfirm={(row) =>
              openReview({
                kind: "plan-order",
                action: "confirm",
                id: row.id,
                orderCode: row.orderCode,
                type: row.type,
                packName: row.packName,
                user: row.user,
                amount: row.amount,
              })
            }
            onReject={(row) =>
              openReview({
                kind: "plan-order",
                action: "reject",
                id: row.id,
                orderCode: row.orderCode,
                type: row.type,
                packName: row.packName,
                user: row.user,
                amount: row.amount,
              })
            }
          />
          <OrderSection
            title="Đơn hoàn thành"
            empty="Chưa có đơn nâng cấp hoàn thành."
            rows={planDone.map((o) => ({
              id: o.id,
              orderCode: o.orderCode,
              type: "Nâng cấp",
              packName: `${o.planName} · ${o.months} tháng`,
              user: userLabel(o),
              amount: formatVnd(o.priceVnd),
              ref: orderRef(o),
              status: statusLabel(o.status),
              time: formatTime(o.updatedAt),
              note: doneNote(o),
            }))}
          />
        </>
      )}

      {prompt ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2a36]/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-order-title"
          onClick={closePrompt}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="review-order-title"
              className="brand-font text-xl font-semibold text-[#0f2a36]"
            >
              {promptTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
              {prompt.action === "confirm"
                ? "Kiểm tra thông tin đơn trước khi duyệt."
                : "Đơn sẽ bị từ chối và không cộng quyền lợi."}
            </p>

            <dl className="mt-4 space-y-2 rounded-2xl border border-[#e2e8ef] bg-[#f7f9fb] px-4 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a98a8]">Mã đơn</dt>
                <dd className="font-semibold text-[#0f2a36]">{prompt.orderCode}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a98a8]">Loại</dt>
                <dd className="text-[#0f2a36]">{prompt.type}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a98a8]">Tên gói</dt>
                <dd className="text-right text-[#0f2a36]">{prompt.packName}</dd>
              </div>
              {prompt.credits ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a98a8]">Số credit</dt>
                  <dd className="font-semibold text-[#0f2a36]">{prompt.credits}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a98a8]">Người dùng</dt>
                <dd className="text-right text-[#0f2a36]">{prompt.user}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a98a8]">Số tiền</dt>
                <dd className="font-semibold text-[#0f2a36]">{prompt.amount}</dd>
              </div>
            </dl>

            <label className="admin-label mt-4">
              Ghi chú (tuỳ chọn)
              <input
                type="text"
                value={promptNote}
                onChange={(e) => setPromptNote(e.target.value)}
                className="admin-input"
                placeholder={
                  prompt.action === "reject"
                    ? "Lý do từ chối…"
                    : "Ghi chú nội bộ…"
                }
              />
            </label>

            <div className="admin-form-actions mt-5">
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => void submitReview()}
                className="admin-btn-dark"
                style={
                  prompt.action === "reject"
                    ? { background: "#c45c26" }
                    : undefined
                }
              >
                {busyId ? "Đang xử lý…" : promptConfirmLabel}
              </button>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={closePrompt}
                className="admin-btn-muted"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type Row = {
  id: string;
  orderCode: string;
  type: string;
  packName: string;
  credits?: string;
  user: string;
  amount: string;
  ref: string;
  status: string;
  time: string;
  note: string;
  transferred?: boolean;
  payos?: boolean;
};

function OrderSection({
  title,
  empty,
  rows,
  pending,
  showCredits,
  busyId,
  onConfirm,
  onReject,
}: {
  title: string;
  empty: string;
  rows: Row[];
  pending?: boolean;
  showCredits?: boolean;
  busyId?: string | null;
  onConfirm?: (row: Row) => void;
  onReject?: (row: Row) => void;
}) {
  const cols = 8 + (showCredits ? 1 : 0) + (pending ? 1 : 0);
  return (
    <>
      <h2 className="brand-font admin-title mt-8">{title}</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Loại</th>
              <th>Tên gói</th>
              {showCredits ? <th>Số credit</th> : null}
              <th>Người dùng</th>
              <th>Số tiền</th>
              <th>Mã giao dịch tham chiếu</th>
              <th>Trạng thái</th>
              <th>Thời gian</th>
              <th>Ghi chú</th>
              {pending ? <th>Thao tác</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="admin-cell-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id}>
                  <td className="admin-cell-strong">{o.orderCode}</td>
                  <td className="admin-cell-muted">{o.type}</td>
                  <td className="admin-cell-muted">{o.packName}</td>
                  {showCredits ? (
                    <td className="admin-cell-muted">{o.credits || "—"}</td>
                  ) : null}
                  <td className="admin-cell-muted">{o.user}</td>
                  <td className="admin-cell-muted">{o.amount}</td>
                  <td className="admin-cell-muted">{o.ref}</td>
                  <td className="admin-cell-muted">{o.status}</td>
                  <td className="admin-cell-muted">{o.time}</td>
                  <td className="admin-cell-muted">{o.note}</td>
                  {pending ? (
                    <td>
                      <div className="admin-row-actions">
                        {o.payos ? (
                          <span className="admin-badge admin-badge-ok">PayOS</span>
                        ) : o.transferred ? (
                          <span className="admin-badge admin-badge-ok">Đã CK</span>
                        ) : (
                          <span className="admin-badge admin-badge-neutral">
                            Chưa CK
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => onConfirm?.(o)}
                          className="admin-link"
                        >
                          Xác nhận
                        </button>
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => onReject?.(o)}
                          className="admin-link admin-link-danger"
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
