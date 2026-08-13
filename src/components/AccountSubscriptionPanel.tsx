"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubscriptionPlan } from "@/lib/auth/types";
import type { PlanOrder } from "@/lib/subscription/types";
import { planExpiryFromMonths, isPlanExpired } from "@/lib/auth/plan-expiry";
import { BankTransferCard } from "@/components/BankTransferCard";

type Usage = {
  presentationsUsed: number;
  presentationsLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  creditsExtra?: number;
  creditsReserved?: number;
  creditsAvailable?: number;
  creditsCeiling?: number;
  studentsUsed: number;
  studentsLimit: number;
};

type BankInfo = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  configured?: boolean;
};

type SubResponse = {
  plan: SubscriptionPlan;
  plans: SubscriptionPlan[];
  planExpiresAt?: string | null;
  bank?: BankInfo;
  planOrders?: PlanOrder[];
  usage: Usage;
  notice?: string;
  error?: string;
};

type CheckoutStep = "list" | "review" | "transfer";

const MONTH_OPTIONS = [1, 2, 3, 6, 12];

function formatPrice(n: number) {
  if (n === 0) return "Miễn phí";
  return `${n.toLocaleString("vi-VN")}đ/tháng`;
}

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

function ratioLabel(used: number, limit: number) {
  return `${used.toLocaleString("vi-VN")} / ${limit.toLocaleString("vi-VN")}`;
}

function barPercent(used: number, limit: number) {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function orderStatus(o: PlanOrder) {
  if (o.status === "paid") return "Đã kích hoạt";
  if (o.status === "rejected") return "Đã từ chối";
  if (o.status === "cancelled") return "Đã hủy";
  if (o.transferConfirmedAt) return "Đã báo chuyển khoản";
  return "Chờ chuyển khoản";
}

export function AccountSubscriptionPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [bank, setBank] = useState<BankInfo | null>(null);
  const [planOrders, setPlanOrders] = useState<PlanOrder[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("list");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [months, setMonths] = useState(1);
  const [checkoutOrder, setCheckoutOrder] = useState<PlanOrder | null>(null);
  const [renewing, setRenewing] = useState(false);

  const apply = useCallback((data: SubResponse) => {
    setPlan(data.plan);
    setPlans(data.plans || []);
    setUsage(data.usage);
    setPlanExpiresAt(data.planExpiresAt || null);
    if (data.bank) setBank(data.bank);
    setPlanOrders(data.planOrders || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/subscription");
      const data = (await res.json()) as SubResponse;
      if (!res.ok) throw new Error(data.error || "Không tải được gói");
      apply(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải gói");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  function closeUpgrade() {
    setUpgradeOpen(false);
    setStep("list");
    setSelectedPlan(null);
    setCheckoutOrder(null);
    setMonths(1);
    setRenewing(false);
  }

  function openRenew() {
    if (!plan) return;
    setError(null);
    setMessage(null);
    if (plan.monthlyPrice <= 0) {
      setMessage("Gói miễn phí không cần gia hạn. Hãy chọn gói trả phí để nâng cấp.");
      setStep("list");
      setRenewing(false);
      setUpgradeOpen(true);
      return;
    }
    setSelectedPlan(plan);
    setMonths(1);
    setCheckoutOrder(null);
    setRenewing(true);
    setStep("review");
    setUpgradeOpen(true);
  }

  async function selectFreePlan(planId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/account/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await res.json()) as SubResponse;
      if (!res.ok) throw new Error(data.error || "Đổi gói thất bại");
      apply(data);
      setMessage(data.notice || "Đã cập nhật gói.");
      closeUpgrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi gói thất bại");
    } finally {
      setBusy(false);
    }
  }

  function choosePaidPlan(p: SubscriptionPlan) {
    setSelectedPlan(p);
    setMonths(1);
    setCheckoutOrder(null);
    setRenewing(p.id === plan?.id);
    setStep("review");
  }

  async function startPayment() {
    if (!selectedPlan) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/account/plan-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id, months }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Tạo đơn thất bại");
      setCheckoutOrder(json.order as PlanOrder);
      if (json.bank) setBank({ ...json.bank, configured: true });
      setStep("transfer");
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
      const res = await fetch("/api/account/plan-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkoutOrder.id,
          action: "confirm-transfer",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xác nhận thất bại");
      closeUpgrade();
      setMessage(
        "Đã ghi nhận chuyển khoản. Gói sẽ được kích hoạt sau khi admin xác nhận.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác nhận thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(orderId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/plan-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "cancel" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Hủy đơn thất bại");
      if (checkoutOrder?.id === orderId) closeUpgrade();
      setMessage("Đã hủy đơn nâng cấp.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hủy đơn thất bại");
    } finally {
      setBusy(false);
    }
  }

  function openExistingOrder(order: PlanOrder) {
    if (order.status !== "pending") return;
    const found = plans.find((p) => p.id === order.planId) || null;
    setSelectedPlan(found);
    setCheckoutOrder(order);
    setMonths(order.months);
    setStep("transfer");
    setUpgradeOpen(true);
  }

  const previewExpiry = useMemo(() => {
    const from =
      renewing && planExpiresAt && !isPlanExpired(planExpiresAt)
        ? planExpiresAt
        : new Date().toISOString();
    return formatDate(planExpiryFromMonths(from, months));
  }, [months, renewing, planExpiresAt]);

  if (loading) {
    return (
      <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5b6b7c]">Đang tải gói đăng ký…</p>
      </section>
    );
  }

  if (!plan || !usage) {
    return (
      <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-[#c45c26]">
          {error || "Không có dữ liệu gói."}
        </p>
      </section>
    );
  }

  const available =
    usage.creditsAvailable ??
    Math.max(
      0,
      usage.creditsLimit +
        (usage.creditsExtra || 0) -
        usage.creditsUsed -
        (usage.creditsReserved || 0),
    );
  const ceiling =
    usage.creditsCeiling ?? usage.creditsLimit + (usage.creditsExtra || 0);
  const stats = [
    {
      label: "Số trình chiếu",
      detail: "Đã sử dụng / Giới hạn",
      value: ratioLabel(usage.presentationsUsed, usage.presentationsLimit),
      percent: barPercent(usage.presentationsUsed, usage.presentationsLimit),
    },
    {
      label: "Credit TTS",
      detail: "Còn lại / Tổng (gói + nạp)",
      value: ratioLabel(available, ceiling),
      percent: barPercent(ceiling - available, ceiling),
    },
    {
      label: "Số lượng học viên",
      detail: "Đã sử dụng / Giới hạn",
      value: ratioLabel(usage.studentsUsed, usage.studentsLimit),
      percent: barPercent(usage.studentsUsed, usage.studentsLimit),
    },
  ];

  return (
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">
            Gói đăng ký
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
            Theo dõi mức sử dụng và nâng cấp gói khi cần thêm hạn mức.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openRenew}
            className="cursor-pointer rounded-full border border-[#c9d8e2] bg-white px-5 py-2.5 text-sm font-bold text-[#0f2a36]"
          >
            Gia hạn
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("list");
              setUpgradeOpen(true);
            }}
            className="cursor-pointer rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024]"
          >
            Nâng cấp gói
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-[#c45c26]">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm font-medium text-[#1f7a4d]">{message}</p>
      ) : null}

      <div className="mt-6 rounded-[24px] border border-[#e2e8ef] bg-[#f7f9fb] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
              Gói hiện tại
            </p>
            <p className="brand-font mt-1 text-xl font-semibold text-[#0f2a36]">
              {plan.name}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#5b6b7c]">
              {formatPrice(plan.monthlyPrice)}
            </p>
            {plan.monthlyPrice > 0 && planExpiresAt ? (
              <p className="mt-1 text-xs text-[#5b6b7c]">
                Hết hạn {formatDate(planExpiresAt)}
              </p>
            ) : null}
          </div>
          {plan.monthlyPrice === 0 ? (
            <span className="rounded-full bg-[#e5f6ee] px-3 py-1 text-xs font-bold text-[#1f7a4d]">
              Miễn phí
            </span>
          ) : (
            <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs font-bold text-[#0f2a36]">
              Trả phí
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[#e2e8ef] bg-white px-4 py-4"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
                {s.label}
              </p>
              <p className="mt-2 text-lg font-semibold text-[#0f2a36]">
                {s.value}
              </p>
              <p className="mt-0.5 text-xs text-[#8a98a8]">{s.detail}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8eef2]">
                <div
                  className="h-full rounded-full bg-[#2bb673]"
                  style={{ width: `${s.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {planOrders.length > 0 ? (
        <div className="mt-6">
          <h2 className="brand-font text-lg font-semibold text-[#0f2a36]">
            Đơn nâng cấp
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#8a98a8]">
                  <th className="py-2">Mã</th>
                  <th>Gói</th>
                  <th>Thời hạn</th>
                  <th>Tiền</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {planOrders.map((o) => (
                  <tr key={o.id} className="border-t border-[#e8eef2]">
                    <td className="py-2 font-semibold text-[#0f2a36]">
                      {o.orderCode}
                    </td>
                    <td className="text-[#5b6b7c]">{o.planName}</td>
                    <td className="text-[#5b6b7c]">{o.months} tháng</td>
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
                            onClick={() => void cancelOrder(o.id)}
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
          </div>
        </div>
      ) : null}

      {upgradeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2a36]/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-title"
          onClick={() => !busy && closeUpgrade()}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "list" ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2
                      id="upgrade-title"
                      className="brand-font text-xl font-semibold text-[#0f2a36]"
                    >
                      Nâng cấp gói
                    </h2>
                    <p className="mt-1 text-sm text-[#5b6b7c]">
                      Chọn gói, rồi chuyển khoản. Gói chỉ kích hoạt sau khi
                      admin xác nhận.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeUpgrade}
                    className="cursor-pointer rounded-full bg-[#e8eef5] px-3 py-1.5 text-sm font-semibold text-[#0f2a36]"
                  >
                    Đóng
                  </button>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  {plans.map((p) => {
                    const current = p.id === plan.id;
                    const paid = p.monthlyPrice > 0;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border px-4 py-4 ${
                          current
                            ? "border-[#2bb673] bg-[#eefaf4]"
                            : "border-[#e2e8ef] bg-[#f7f9fb]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#0f2a36]">
                              {p.name}
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-[#5b6b7c]">
                              {formatPrice(p.monthlyPrice)}
                            </p>
                          </div>
                          {current && !paid ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1f7a4d]">
                              Đang dùng
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                paid
                                  ? choosePaidPlan(p)
                                  : void selectFreePlan(p.id)
                              }
                              className="cursor-pointer rounded-full bg-[#0f2a36] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {current && paid ? "Gia hạn" : "Chọn gói"}
                            </button>
                          )}
                        </div>
                        <ul className="mt-3 grid gap-1 text-xs text-[#5b6b7c] sm:grid-cols-3">
                          <li>{p.maxPresentations} trình chiếu</li>
                          <li>
                            {p.everaiCredits.toLocaleString("vi-VN")} credit
                          </li>
                          <li>{p.maxStudents} học viên</li>
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {step === "review" && selectedPlan ? (
              <>
                <h2
                  id="upgrade-title"
                  className="brand-font text-xl font-semibold text-[#0f2a36]"
                >
                  {renewing ? "Gia hạn gói" : "Thông tin gói"}
                </h2>
                <p className="mt-1 text-sm text-[#5b6b7c]">
                  {renewing
                    ? "Gia hạn gói hiện tại. Chọn số tháng, thanh toán, rồi chờ admin xác nhận."
                    : "Chọn số tháng cần mua. Hạn dùng tính từ ngày admin kích hoạt, mỗi tháng = 30 ngày."}
                </p>
                <div className="mt-5 rounded-2xl border border-[#e2e8ef] bg-[#f7f9fb] px-4 py-4">
                  <p className="font-semibold text-[#0f2a36]">
                    {selectedPlan.name}
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm text-[#5b6b7c] sm:grid-cols-3">
                    <li>{selectedPlan.maxPresentations} trình chiếu</li>
                    <li>
                      {selectedPlan.everaiCredits.toLocaleString("vi-VN")}{" "}
                      credit
                    </li>
                    <li>{selectedPlan.maxStudents} học viên</li>
                  </ul>
                  <p className="mt-3 text-sm font-semibold text-[#0f2a36]">
                    {formatPrice(selectedPlan.monthlyPrice)}
                  </p>
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
                  Số tháng
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MONTH_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMonths(n)}
                      className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold ${
                        months === n
                          ? "bg-[#0f2a36] text-white"
                          : "bg-[#e8eef5] text-[#0f2a36]"
                      }`}
                    >
                      {n} tháng
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-[#5b6b7c]">
                  Thành tiền{" "}
                  <span className="font-semibold text-[#0f2a36]">
                    {formatVnd(selectedPlan.monthlyPrice * months)}
                  </span>
                  {" · "}
                  hết hạn dự kiến {previewExpiry}
                  {renewing && planExpiresAt && !isPlanExpired(planExpiresAt)
                    ? " (cộng thêm từ hạn hiện tại)"
                    : ""}
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      renewing ? closeUpgrade() : setStep("list")
                    }
                    className="cursor-pointer rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330]"
                  >
                    Quay lại
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
                {!bank?.configured ? (
                  <p className="mt-3 text-xs text-[#c45c26]">
                    Admin chưa cấu hình tài khoản nhận tiền.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === "transfer" && checkoutOrder && bank ? (
              <>
                <h2
                  id="upgrade-title"
                  className="brand-font text-xl font-semibold text-[#0f2a36]"
                >
                  Thanh toán
                </h2>
                <p className="mt-1 text-sm text-[#5b6b7c]">
                  {checkoutOrder.planName} · {checkoutOrder.months} tháng
                </p>
                <div className="mt-4">
                  <BankTransferCard
                    orderCode={checkoutOrder.orderCode}
                    bank={bank}
                    amountVnd={checkoutOrder.priceVnd}
                    transferContent={checkoutOrder.transferContent}
                  />
                </div>
                {checkoutOrder.transferConfirmedAt ? (
                  <p className="mt-4 text-sm font-medium text-[#1f7a4d]">
                    Bạn đã báo đã chuyển khoản. Đợi admin kích hoạt gói.
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
                    onClick={closeUpgrade}
                    className="cursor-pointer rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330]"
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
