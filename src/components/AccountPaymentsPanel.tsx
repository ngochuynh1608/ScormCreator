"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BankTransferCard } from "@/components/BankTransferCard";
import { PayosCheckoutCard } from "@/components/PayosCheckoutCard";
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
  payosConfigured?: boolean;
  error?: string;
};

type CheckoutStep = "review" | "transfer";
type ListTab = "orders" | "history";

const PAGE_SIZE = 10;

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function orderStatus(o: CreditOrder) {
  if (o.status === "paid") return "Đã cộng credit";
  if (o.status === "rejected") return "Đã từ chối";
  if (o.status === "cancelled") return "Đã hủy";
  if (o.checkoutUrl) return "Chờ thanh toán";
  if (o.transferConfirmedAt) return "Đã báo chuyển khoản";
  return "Chờ chuyển khoản";
}

function txLabel(t: CreditTransaction) {
  if (t.type === "purchase") return t.note || "Nạp credit";
  if (t.type === "admin_grant") return t.note || "Admin cộng credit";
  return t.note || "Tạo audio TTS";
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
  const [orderPage, setOrderPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [listTab, setListTab] = useState<ListTab>("orders");
  const returnHandled = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/account/credits");
      const json = (await res.json()) as Payload;
      if (!res.ok) throw new Error(json.error || "Không tải được credit");
      setData(json);
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
      return null;
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
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPack, checkoutOrder]);

  function closeCheckout() {
    setSelectedPack(null);
    setCheckoutOrder(null);
    setCheckoutStep("review");
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

  async function syncOrder(orderId: string) {
    const res = await fetch("/api/account/credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action: "sync" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Không kiểm tra được thanh toán");
    const order = json.order as CreditOrder;
    setCheckoutOrder((cur) => (cur?.id === order.id ? order : cur));
    return order;
  }

  useEffect(() => {
    if (!data || returnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");
    if (!orderId) return;
    returnHandled.current = true;
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return;
    setSelectedPack(null);
    setCheckoutOrder(order);
    setCheckoutStep("transfer");
    if (order.status !== "pending") {
      if (order.status === "paid") {
        setMessage("Thanh toán thành công. Credit đã được cộng.");
      }
      return;
    }
    void (async () => {
      try {
        const next = await syncOrder(order.id);
        const json = await load();
        const fresh = json?.orders.find((o) => o.id === order.id) || next;
        setCheckoutOrder(fresh);
        if (fresh.status === "paid") {
          setMessage("Thanh toán thành công. Credit đã được cộng.");
          closeCheckout();
        } else if (fresh.status === "cancelled") {
          setMessage("Đơn thanh toán đã hủy.");
          closeCheckout();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không kiểm tra được thanh toán");
      }
    })();
  }, [data, load]);

  useEffect(() => {
    if (!checkoutOrder || checkoutOrder.status !== "pending") return;
    const orderId = checkoutOrder.id;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await syncOrder(orderId);
          if (next.status === "paid") {
            setMessage("Thanh toán thành công. Credit đã được cộng.");
            closeCheckout();
            await load();
          } else if (next.status === "cancelled") {
            setMessage("Đơn thanh toán đã hủy.");
            closeCheckout();
            await load();
          }
        } catch {
          // keep polling
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [checkoutOrder?.id, checkoutOrder?.status, load]);

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

  const orders = data?.orders || [];
  const transactions = data?.transactions || [];
  const orderPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const txPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));

  useEffect(() => {
    setOrderPage((p) => Math.min(Math.max(1, p), orderPages));
  }, [orderPages]);
  useEffect(() => {
    setTxPage((p) => Math.min(Math.max(1, p), txPages));
  }, [txPages]);

  const pagedOrders = useMemo(
    () => orders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE),
    [orders, orderPage],
  );
  const pagedTransactions = useMemo(
    () => transactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE),
    [transactions, txPage],
  );

  if (loading) {
    return (
      <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5b6b7c]">Đang tải thông tin nạp credit…</p>
      </section>
    );
  }

  const wallet = data?.wallet;
  const bank = data?.bank;
  const payosConfigured = Boolean(data?.payosConfigured);
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
        Chọn gói, thanh toán qua PayOS (QR hoặc trang thanh toán). Credit được
        cộng tự động khi giao dịch thành công.
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
                disabled={busy || !payosConfigured}
                onClick={() => openPack(p)}
                className="mt-3 cursor-pointer rounded-full bg-[#0f2a36] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mua gói này
              </button>
              {!payosConfigured ? (
                <p className="mt-2 text-xs text-[#c45c26]">
                  Thanh toán PayOS chưa được cấu hình.
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-8 flex gap-1 border-b border-[#e8eef2]">
        <button
          type="button"
          onClick={() => setListTab("orders")}
          className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold ${
            listTab === "orders"
              ? "border-[#0f2a36] text-[#0f2a36]"
              : "border-transparent text-[#8a98a8] hover:text-[#0f2a36]"
          }`}
        >
          <OrdersTabIcon />
          Đơn nạp
        </button>
        <button
          type="button"
          onClick={() => setListTab("history")}
          className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold ${
            listTab === "history"
              ? "border-[#0f2a36] text-[#0f2a36]"
              : "border-transparent text-[#8a98a8] hover:text-[#0f2a36]"
          }`}
        >
          <HistoryTabIcon />
          Lịch sử
        </button>
      </div>

      {listTab === "orders" ? (
      <div className="mt-3 overflow-x-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-[#8a98a8]">Chưa có đơn nạp.</p>
        ) : (
          <>
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
                {pagedOrders.map((o) => (
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
                            Thanh toán
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
            <TablePager
              page={orderPage}
              pages={orderPages}
              total={orders.length}
              onPage={setOrderPage}
            />
          </>
        )}
      </div>
      ) : (
      <div className="mt-3 overflow-x-auto">
        {transactions.length === 0 ? (
          <p className="text-sm text-[#8a98a8]">Chưa có giao dịch.</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#8a98a8]">
                  <th className="py-2">Thời gian</th>
                  <th>Nội dung</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {pagedTransactions.map((t) => (
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
            <TablePager
              page={txPage}
              pages={txPages}
              total={transactions.length}
              onPage={setTxPage}
            />
          </>
        )}
      </div>
      )}

      {selectedPack || checkoutOrder ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={() => !busy && closeCheckout()}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white p-6 shadow-xl"
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
                    disabled={busy || !payosConfigured}
                    onClick={() => void startPayment()}
                    className="cursor-pointer rounded-full bg-[#0f2a36] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Đang tạo đơn…" : "Thanh toán"}
                  </button>
                </div>
              </>
            ) : checkoutOrder ? (
              <>
                <h2
                  id="checkout-title"
                  className="text-base font-semibold text-[#0f2a36]"
                >
                  Thanh toán đơn {checkoutOrder.orderCode}
                </h2>
                <p className="mt-1 text-sm text-[#5b6b7c]">
                  {checkoutPack
                    ? `${checkoutPack.name} · ${checkoutOrder.credits.toLocaleString("vi-VN")} credit`
                    : `${checkoutOrder.credits.toLocaleString("vi-VN")} credit`}
                </p>
                <div className="mt-4">
                  {checkoutOrder.checkoutUrl ? (
                    <PayosCheckoutCard
                      orderCode={checkoutOrder.orderCode}
                      amountVnd={checkoutOrder.priceVnd}
                      qrCode={checkoutOrder.qrCode}
                      transferContent={checkoutOrder.transferContent}
                      payosBin={checkoutOrder.payosBin}
                      payosAccountNumber={checkoutOrder.payosAccountNumber}
                      payosAccountName={checkoutOrder.payosAccountName}
                      payosDescription={checkoutOrder.payosDescription}
                    />
                  ) : bank ? (
                    <BankTransferCard
                      orderCode={checkoutOrder.orderCode}
                      bank={bank}
                      amountVnd={checkoutOrder.priceVnd}
                      transferContent={checkoutOrder.transferContent}
                    />
                  ) : null}
                </div>
                {checkoutOrder.checkoutUrl ? (
                  <p className="mt-4 text-sm text-[#5b6b7c]">
                    Trang này tự kiểm tra thanh toán. Bạn có thể đóng và quay lại
                    sau.
                  </p>
                ) : checkoutOrder.transferConfirmedAt ? (
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
                  {!checkoutOrder.checkoutUrl &&
                  !checkoutOrder.transferConfirmedAt ? (
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

function pageItems(current: number, total: number): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: Array<number | "..."> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("...");
  for (let n = start; n <= end; n++) items.push(n);
  if (end < total - 1) items.push("...");
  items.push(total);
  return items;
}

function TablePager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
      <p className="mr-auto text-xs text-[#8a98a8]">{total} mục</p>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="cursor-pointer px-2 py-1 text-xs font-semibold text-[#0f2a36] disabled:cursor-not-allowed disabled:opacity-35"
      >
        Trước
      </button>
      {pageItems(page, pages).map((item, i) =>
        item === "..." ? (
          <span key={`e${i}`} className="px-1 text-xs text-[#8a98a8]">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            className={`min-w-6 cursor-pointer px-1.5 py-1 text-xs ${
              item === page
                ? "font-bold text-[#0f2a36]"
                : "font-medium text-[#8a98a8] hover:text-[#0f2a36]"
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="cursor-pointer px-2 py-1 text-xs font-semibold text-[#0f2a36] disabled:cursor-not-allowed disabled:opacity-35"
      >
        Sau
      </button>
    </div>
  );
}

function OrdersTabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.75h7.2L19.25 9v11.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M14.25 3.9V9h5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 13h6M9 16.5h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HistoryTabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.75V12l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
