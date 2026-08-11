"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionPlan } from "@/lib/auth/types";

type Draft = {
  name: string;
  maxPresentations: string;
  everaiCredits: string;
  maxStudents: string;
  monthlyPrice: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  maxPresentations: "5",
  everaiCredits: "1000",
  maxStudents: "50",
  monthlyPrice: "0",
});

function fromPlan(p: SubscriptionPlan): Draft {
  return {
    name: p.name,
    maxPresentations: String(p.maxPresentations),
    everaiCredits: String(p.everaiCredits),
    maxStudents: String(p.maxStudents),
    monthlyPrice: String(p.monthlyPrice),
  };
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được gói");
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function payload() {
    return {
      name: draft.name.trim(),
      maxPresentations: Number(draft.maxPresentations),
      everaiCredits: Number(draft.everaiCredits),
      maxStudents: Number(draft.maxStudents),
      monthlyPrice: Number(draft.monthlyPrice),
    };
  }

  async function create() {
    setBusyId("new");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo thất bại");
      setCreating(false);
      setDraft(emptyDraft());
      setMessage("Đã thêm gói đăng ký.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(planId: string) {
    setBusyId(planId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: planId, ...payload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setEditingId(null);
      setDraft(emptyDraft());
      setMessage("Đã cập nhật gói.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: SubscriptionPlan) {
    if (!window.confirm(`Xóa gói "${p.name}"?`)) return;
    setBusyId(p.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
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
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">
            Gói đăng ký
          </h1>
          <p className="mt-1 text-sm text-[#5b6b7c]">
            Số trình chiếu, credit EverAI, học viên và giá tháng (0 = miễn phí).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
            setDraft(emptyDraft());
          }}
          className="rounded-full bg-[#2bb673] px-4 py-2 text-sm font-bold text-[#083024]"
        >
          + Thêm gói
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-[#5b6b7c]">Đang tải…</p> : null}
      {error ? (
        <p className="mt-4 text-sm font-medium text-[#c45c26]">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm font-medium text-[#1f7a4d]">{message}</p>
      ) : null}

      {(creating || editingId) && (
        <div className="mt-5 grid gap-3 rounded-2xl border border-[#e2e8ef] bg-[#f7f9fb] p-4 sm:grid-cols-2">
          <Field
            label="Tên gói"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
          />
          <Field
            label="Số trình chiếu"
            value={draft.maxPresentations}
            onChange={(v) => setDraft({ ...draft, maxPresentations: v })}
          />
          <Field
            label="Credit EverAI"
            value={draft.everaiCredits}
            onChange={(v) => setDraft({ ...draft, everaiCredits: v })}
          />
          <Field
            label="Số học viên"
            value={draft.maxStudents}
            onChange={(v) => setDraft({ ...draft, maxStudents: v })}
          />
          <Field
            label="Giá / tháng (VNĐ, 0 = miễn phí)"
            value={draft.monthlyPrice}
            onChange={(v) => setDraft({ ...draft, monthlyPrice: v })}
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() =>
                void (creating ? create() : editingId && saveEdit(editingId))
              }
              className="rounded-full bg-[#0f2a36] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busyId ? "Đang lưu…" : "Lưu"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
                setDraft(emptyDraft());
              }}
              className="rounded-full bg-[#e8eef5] px-4 py-2 text-sm font-semibold text-[#0f2a36]"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#e2e8ef] text-xs uppercase tracking-wide text-[#8a98a8]">
              <th className="py-2 pr-3 font-bold">Tên</th>
              <th className="py-2 pr-3 font-bold">Trình chiếu</th>
              <th className="py-2 pr-3 font-bold">Credit</th>
              <th className="py-2 pr-3 font-bold">Học viên</th>
              <th className="py-2 pr-3 font-bold">Giá / tháng</th>
              <th className="py-2 font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-[#eef2f6]">
                <td className="py-3 pr-3 font-semibold text-[#0f2a36]">
                  {p.name}
                </td>
                <td className="py-3 pr-3 text-[#5b6b7c]">
                  {p.maxPresentations}
                </td>
                <td className="py-3 pr-3 text-[#5b6b7c]">{p.everaiCredits}</td>
                <td className="py-3 pr-3 text-[#5b6b7c]">{p.maxStudents}</td>
                <td className="py-3 pr-3 text-[#5b6b7c]">
                  {p.monthlyPrice === 0
                    ? "Miễn phí"
                    : `${p.monthlyPrice.toLocaleString("vi-VN")}đ`}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => {
                        setCreating(false);
                        setEditingId(p.id);
                        setDraft(fromPlan(p));
                      }}
                      className="text-sm font-semibold text-[#0f2a36] disabled:opacity-50"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void remove(p)}
                      className="text-sm font-semibold text-[#c45c26] disabled:opacity-50"
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36] outline-none focus:border-[#2bb673]"
      />
    </label>
  );
}
