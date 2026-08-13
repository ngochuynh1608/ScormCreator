"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreditBankSettings,
  CreditOrder,
  CreditPack,
  CreditSnapshot,
  CreditTransaction,
} from "@/lib/credits/types";

type Payload = {
  wallet: CreditSnapshot;
  packs: CreditPack[];
  bank: CreditBankSettings & { configured?: boolean };
  orders: CreditOrder[];
  transactions: CreditTransaction[];
  error?: string;
};

type CheckoutStep = "review" | "transfer";

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function orderStatus(o: CreditOrder) {
  if (o.status === "paid") return "Đã cộng credit";
  if (o.status === "rejected") return "Đã từ chối";
  if (o.status === "cancelled") return "Đã hủy";
  if (o.transferConfirmedAt) return "Đã báo chuyển khoản";
  return "Chờ chuyển khoản";
}

function txLabel(t: CreditTransaction) {
  if (t.type === "purchase") return t.note || "Nạp credit";
  if (t.type === "admin_grant") return t.note || "Admin cộng credit";
  return t.note || "Tạo audio TTS";
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function AccountPaymentsPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("review");
  const [checkoutOrder, setCheckoutOrder] = useState<CreditOrder | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/credits");
      const json = (await res.json()) as Payload;
      if (!res.ok) throw new Error(json.error || "Không tải được credit");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedPack && !checkoutOrder) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setSelectedPack(null);
      setCheckoutOrder(null);
      setCheckoutStep("review");
      setCopiedKey(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPack, checkoutOrder]);

  function closeCheckout() {
    setSelectedPack(null);
    setCheckoutOrder(null);
    setCheckoutStep("review");
    setCopiedKey(null);
  }

  function openPack(pack: CreditPack) {
    setError(null);
    setMessage(null);
    setSelectedPack(pack);
    setCheckoutOrder(null);
    setCheckoutStep("review");
  }

  function openExistingOrder(order: CreditOrder) {
    if (order.status !== "pending") return;
    setError(null);
    setMessage(null);
    setSelectedPack(null);
    setCheckoutOrder(order);
    setCheckoutStep("transfer");
  }

  async function startPayment() {
    if (!selectedPack) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/account/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Tạo đơn thất bại");
      setCheckoutOrder(json.order as CreditOrder);
      setCheckoutStep("transfer");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo đơn thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function markTransferred() {
    if (!checkoutOrder) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkoutOrder.id,
          action: "confirm-transfer",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xác nhận thất bại");
      closeCheckout();
      setMessage(
        "Đã ghi nhận chuyển khoản. Credit sẽ được cộng sau khi admin xác nhận.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác nhận thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(orderId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "cancel" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Hủy đơn thất bại");
      if (checkoutOrder?.id === orderId) closeCheckout();
      setMessage("Đã hủy đơn nạp.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hủy đơn thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(key: string, value: string) {
    const ok = await copyText(value);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((cur) => (cur === key ? null : cur));
    }, 1500);
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5b6b7c]">Đang tải thông tin nạp credit…</p>
      </section>
    );
  }

  const wallet = data?.wallet;
  const bank = data?.bank;
  const checkoutPack =
    selectedPack ||
    data?.packs.find((p) => p.id === checkoutOrder?.packId) ||
    null;

  return (
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
      <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">
        Nạp credit TTS
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
        Chọn gói, chuyển khoản đúng nội dung, rồi bấm Đã chuyển khoản để admin
        đối soát.
      </p>

      {error ? (
        <p className="mt-4 text-sm font-medium text-[#c45c26]">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm font-medium text-[#1f7a4d]">{message}</p>
      ) : null}

      {wallet ? (
        <div className="mt-5 rounded-[24px] border border-[#e2e8ef] bg-[#f7f9fb] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
            Credit còn lại
          </p>
          <p className="brand-font mt-1 text-2xl font-semibold text-[#0f2a36]">
            {wallet.available.toLocaleString("vi-VN")}
          </p>
          <p className="mt-1 text-xs text-[#8a98a8]">
            Gói {wallet.planLimit.toLocaleString("vi-VN")} + nạp{" "}
            {wallet.extraCredits.toLocaleString("vi-VN")} − đã dùng{" "}
            {wallet.creditsUsed.toLocaleString("vi-VN")}
            {wallet.reserved
              ? ` − đang giữ ${wallet.reserved.toLocaleString("vi-VN")}`
              : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(data?.packs || []).length === 0 ? (
          <p className="text-sm text-[#8a98a8]">
            Chưa có gói nạp. Liên hệ admin để cấu hình giá credit.
          </p>
        ) : (
          (data?.packs || []).map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-[#e2e8ef] bg-[#f7f9fb] px-4 py-4"
            >
              <p className="font-semibold text-[#0f2a36]">{p.name}</p>
              <p className="mt-1 text-sm text-[#5b6b7c]">
                {p.credits.toLocaleString("vi-VN")} credit
              </p>
              <p className="mt-1 text-lg font-semibold text-[#0f2a36]">
                {formatVnd(p.priceVnd)}
              </p>
              <button
                type="button"
                disabled={busy || !bank?.configured}
                onClick={() => openPack(p)}
                className="mt-3 cursor-pointer rounded-full bg-[#0f2a36] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mua gói này
              </button>
              {!bank?.configured ? (
                <p className="mt-2 text-xs text-[#c45c26]">
                  Admin chưa cấu hình tài khoản nhận tiền.
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <h2 className="brand-font mt-8 text-lg font-semibold text-[#0f2a36]">
        Đơn nạp
      </h2>
      <div className="mt-3 overflow-x-auto">
        {(data?.orders || []).length === 0 ? (
          <p className="text-sm text-[#8a98a8]">Chưa có đơn nạp.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[#8a98a8]">
                <th className="py-2">Mã</th>
                <th>Gói</th>
                <th>Tiền</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.orders || []).map((o) => (
                <tr key={o.id} className="border-t border-[#e8eef2]">
                  <td className="py-2 font-semibold text-[#0f2a36]">
                    {o.orderCode}
                  </td>
                  <td className="text-[#5b6b7c]">{o.packName}</td>
                  <td className="text-[#5b6b7c]">{formatVnd(o.priceVnd)}</td>
                  <td className="text-[#5b6b7c]">{orderStatus(o)}</td>
                  <td className="whitespace-nowrap">
                    {o.status === "pending" ? (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openExistingOrder(o)}
                          className="cursor-pointer text-xs font-semibold text-[#0f2a36]"
                        >
                          Xem STK
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancel(o.id)}
                          className="cursor-pointer text-xs font-semibold text-[#c45c26]"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="brand-font mt-8 text-lg font-semibold text-[#0f2a36]">
        Lịch sử
      </h2>
      <div className="mt-3 overflow-x-auto">
        {(data?.transactions || []).length === 0 ? (
          <p className="text-sm text-[#8a98a8]">Chưa có giao dịch.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[#8a98a8]">
                <th className="py-2">Thời gian</th>
                <th>Nội dung</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {(data?.transactions || []).map((t) => (
                <tr key={t.id} className="border-t border-[#e8eef2]">
                  <td className="py-2 text-[#5b6b7c]">
                    {new Date(t.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="text-[#0f2a36]">{txLabel(t)}</td>
                  <td
                    className={
                      t.amount >= 0
                        ? "font-semibold text-[#1f7a4d]"
                        : "font-semibold text-[#c45c26]"
                    }
                  >
                    {t.amount > 0 ? "+" : ""}
                    {t.amount.toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedPack || checkoutOrder ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={() => !busy && closeCheckout()}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {checkoutStep === "review" && checkoutPack ? (
              <>
                <h2
                  id="checkout-title"
                  className="brand-font text-xl font-semibold text-[#0f2a36]"
                >
                  Xác nhận gói nạp
                </h2>
                <p className="mt-1 text-sm text-[#5b6b7c]">
                  Kiểm tra thông tin gói trước khi thanh toán.
                </p>
                <div className="mt-5 rounded-2xl border border-[#e2e8ef] bg-[#f7f9fb] px-4 py-4">
                  <p className="font-semibold text-[#0f2a36]">
                    {checkoutPack.name}
                  </p>
                  <p className="mt-1 text-sm text-[#5b6b7c]">
                    {checkoutPack.credits.toLocaleString("vi-VN")} credit
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[#0f2a36]">
                    {formatVnd(checkoutPack.priceVnd)}
                  </p>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeCheckout}
                    className="cursor-pointer rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330] disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={busy || !bank?.configured}
                    onClick={() => void startPayment()}
                    className="cursor-pointer rounded-full bg-[#0f2a36] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Đang tạo đơn…" : "Thanh toán"}
                  </button>
                </div>
              </>
            ) : checkoutOrder && bank ? (
              <>
                <h2
                  id="checkout-title"
                  className="text-base font-semibold text-[#0f2a36]"
                >
                  Chuyển khoản đơn {checkoutOrder.orderCode}
                </h2>
                <p className="mt-1 text-sm text-[#5b6b7c]">
                  {checkoutPack
                    ? `${checkoutPack.name} · ${checkoutOrder.credits.toLocaleString("vi-VN")} credit`
                    : `${checkoutOrder.credits.toLocaleString("vi-VN")} credit`}
                </p>
                <div className="mt-4 rounded-[24px] border border-[#2bb673] bg-[#eefaf4] p-5">
                  <dl className="grid gap-3 text-sm text-[#0f2a36] sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
                        Ngân hàng
                      </dt>
                      <dd className="mt-0.5">{bank.bankName || "—"}</dd>
                    </div>
                    <CopyRow
                      label="Số tài khoản"
                      value={bank.accountNumber}
                      copied={copiedKey === "account"}
                      onCopy={() =>
                        void handleCopy("account", bank.accountNumber)
                      }
                    />
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
                        Chủ tài khoản
                      </dt>
                      <dd className="mt-0.5">{bank.accountName || "—"}</dd>
                    </div>
                    <CopyRow
                      label="Số tiền"
                      value={formatVnd(checkoutOrder.priceVnd)}
                      copied={copiedKey === "amount"}
                      onCopy={() =>
                        void handleCopy("amount", String(checkoutOrder.priceVnd))
                      }
                    />
                    <CopyRow
                      label="Nội dung chuyển khoản"
                      value={checkoutOrder.transferContent}
                      copied={copiedKey === "content"}
                      onCopy={() =>
                        void handleCopy(
                          "content",
                          checkoutOrder.transferContent,
                        )
                      }
                      wide
                    />
                  </dl>
                </div>
                {checkoutOrder.transferConfirmedAt ? (
                  <p className="mt-4 text-sm font-medium text-[#1f7a4d]">
                    Bạn đã báo đã chuyển khoản. Đợi admin cộng credit.
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-[#5b6b7c]">
                    Chuyển đúng số tiền và nội dung, rồi bấm xác nhận bên dưới.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeCheckout}
                    className="cursor-pointer rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330] disabled:opacity-50"
                  >
                    Đóng
                  </button>
                  {!checkoutOrder.transferConfirmedAt ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markTransferred()}
                      className="cursor-pointer rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024] disabled:opacity-50"
                    >
                      {busy ? "Đang gửi…" : "Đã chuyển khoản"}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  wide,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-2 font-semibold">
        <span className="min-w-0 break-all">{value || "—"}</span>
        {value ? (
          <button
            type="button"
            onClick={onCopy}
            title={copied ? "Đã copy" : `Copy ${label.toLowerCase()}`}
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#1a5c40] hover:bg-white/80"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 9.5 17 19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
