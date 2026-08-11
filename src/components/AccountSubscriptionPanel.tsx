"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionPlan } from "@/lib/auth/types";

type Usage = {
  presentationsUsed: number;
  presentationsLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  studentsUsed: number;
  studentsLimit: number;
};

type SubResponse = {
  plan: SubscriptionPlan;
  plans: SubscriptionPlan[];
  usage: Usage;
  notice?: string;
  error?: string;
};

function formatPrice(n: number) {
  if (n === 0) return "Miễn phí";
  return `${n.toLocaleString("vi-VN")}đ/tháng`;
}

function ratioLabel(used: number, limit: number) {
  return `${used.toLocaleString("vi-VN")} / ${limit.toLocaleString("vi-VN")}`;
}

function barPercent(used: number, limit: number) {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function AccountSubscriptionPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const apply = useCallback((data: SubResponse) => {
    setPlan(data.plan);
    setPlans(data.plans || []);
    setUsage(data.usage);
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

  async function selectPlan(planId: string) {
    if (planId === plan?.id) {
      setUpgradeOpen(false);
      return;
    }
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
      setUpgradeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi gói thất bại");
    } finally {
      setBusy(false);
    }
  }

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

  const stats = [
    {
      label: "Số trình chiếu",
      detail: "Đã sử dụng / Giới hạn",
      value: ratioLabel(usage.presentationsUsed, usage.presentationsLimit),
      percent: barPercent(usage.presentationsUsed, usage.presentationsLimit),
    },
    {
      label: "Credit EverAI",
      detail: "Đã sử dụng / Giới hạn",
      value: ratioLabel(usage.creditsUsed, usage.creditsLimit),
      percent: barPercent(usage.creditsUsed, usage.creditsLimit),
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
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024]"
        >
          Nâng cấp gói
        </button>
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

      {upgradeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2a36]/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-title"
          onClick={() => !busy && setUpgradeOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="upgrade-title"
                  className="brand-font text-xl font-semibold text-[#0f2a36]"
                >
                  Nâng cấp gói
                </h2>
                <p className="mt-1 text-sm text-[#5b6b7c]">
                  Chọn gói phù hợp. Thanh toán sẽ được bổ sung sau.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setUpgradeOpen(false)}
                className="rounded-full bg-[#e8eef5] px-3 py-1.5 text-sm font-semibold text-[#0f2a36]"
              >
                Đóng
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {plans.map((p) => {
                const current = p.id === plan.id;
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
                        <p className="font-semibold text-[#0f2a36]">{p.name}</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#5b6b7c]">
                          {formatPrice(p.monthlyPrice)}
                        </p>
                      </div>
                      {current ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1f7a4d]">
                          Đang dùng
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void selectPlan(p.id)}
                          className="rounded-full bg-[#0f2a36] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busy ? "…" : "Chọn gói"}
                        </button>
                      )}
                    </div>
                    <ul className="mt-3 grid gap-1 text-xs text-[#5b6b7c] sm:grid-cols-3">
                      <li>{p.maxPresentations} trình chiếu</li>
                      <li>{p.everaiCredits.toLocaleString("vi-VN")} credit</li>
                      <li>{p.maxStudents} học viên</li>
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
