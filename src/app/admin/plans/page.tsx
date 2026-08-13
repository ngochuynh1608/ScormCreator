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
  const [signupPlanId, setSignupPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [signupDraft, setSignupDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được gói");
      setPlans(data.plans || []);
      const nextSignup = typeof data.signupPlanId === "string" ? data.signupPlanId : "";
      setSignupPlanId(nextSignup);
      setSignupDraft(nextSignup);
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

  async function saveSignupPlan() {
    if (!signupDraft) return;
    setBusyId("signup");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupPlanId: signupDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu thất bại");
      setSignupPlanId(data.signupPlanId || signupDraft);
      setMessage("Đã lưu gói gán khi tạo tài khoản.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
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
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Gói đăng ký</h1>
          <p className="admin-desc">
            Số trình chiếu, credit AI, học viên và giá tháng (0 = miễn phí).
            Gói gán khi tạo tài khoản không tính thời gian hết hạn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
            setDraft(emptyDraft());
          }}
          className="admin-btn-primary"
        >
          + Thêm gói
        </button>
      </div>

      {loading ? <p className="admin-muted">Đang tải…</p> : null}
      {error ? <p className="admin-alert-error">{error}</p> : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      {!loading && plans.length > 0 ? (
        <div className="admin-form-grid">
          <label className="admin-label" style={{ gridColumn: "1 / -1" }}>
            Gói gán khi tạo người dùng
            <select
              value={signupDraft}
              onChange={(e) => setSignupDraft(e.target.value)}
              className="admin-select"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.monthlyPrice === 0
                    ? " (Miễn phí)"
                    : ` · ${p.monthlyPrice.toLocaleString("vi-VN")}đ/tháng`}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-form-actions">
            <button
              type="button"
              disabled={Boolean(busyId) || !signupDraft || signupDraft === signupPlanId}
              onClick={() => void saveSignupPlan()}
              className="admin-btn-dark"
            >
              {busyId === "signup" ? "Đang lưu…" : "Lưu gói mặc định"}
            </button>
          </div>
        </div>
      ) : null}

      {(creating || editingId) && (
        <div className="admin-form-grid">
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
            label="Credit AI"
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
          <div className="admin-form-actions">
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() =>
                void (creating ? create() : editingId && saveEdit(editingId))
              }
              className="admin-btn-dark"
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
              <th>Tên</th>
              <th>Trình chiếu</th>
              <th>Credit</th>
              <th>Học viên</th>
              <th>Giá / tháng</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="admin-cell-strong">
                  {p.name}
                  {p.id === signupPlanId ? (
                    <span className="admin-cell-muted"> · mặc định tạo TK</span>
                  ) : null}
                </td>
                <td className="admin-cell-muted">{p.maxPresentations}</td>
                <td className="admin-cell-muted">{p.everaiCredits}</td>
                <td className="admin-cell-muted">{p.maxStudents}</td>
                <td className="admin-cell-muted">
                  {p.monthlyPrice === 0
                    ? "Miễn phí"
                    : `${p.monthlyPrice.toLocaleString("vi-VN")}đ`}
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => {
                        setCreating(false);
                        setEditingId(p.id);
                        setDraft(fromPlan(p));
                      }}
                      className="admin-link"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void remove(p)}
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
