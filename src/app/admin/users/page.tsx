"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUser, SubscriptionPlan } from "@/lib/auth/types";
import type { CreditSnapshot } from "@/lib/credits/types";

type Draft = {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
  planId: string;
  locked: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  email: "",
  password: "",
  role: "user",
  planId: "",
  locked: false,
});

export default function AdminUsersPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [credits, setCredits] = useState<Record<string, CreditSnapshot>>({});
  const [grantUser, setGrantUser] = useState<PublicUser | null>(null);
  const [grantAmount, setGrantAmount] = useState("100");
  const [grantNote, setGrantNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, pRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/plans"),
      ]);
      const uData = await uRes.json();
      const pData = await pRes.json();
      if (!uRes.ok) throw new Error(uData.error || "Không tải được users");
      if (!pRes.ok) throw new Error(pData.error || "Không tải được gói");
      setUsers(uData.users || []);
      setCredits(uData.credits || {});
      setPlans(pData.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function planName(id: string | null) {
    if (!id) return "—";
    return plans.find((p) => p.id === id)?.name || id;
  }

  async function create() {
    setBusyId("new");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          password: draft.password,
          role: draft.role,
          planId: draft.planId || null,
          locked: draft.locked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo thất bại");
      setCreating(false);
      setDraft(emptyDraft());
      setMessage("Đã thêm người dùng.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(userId: string) {
    setBusyId(userId);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        userId,
        name: draft.name,
        email: draft.email,
        role: draft.role,
        planId: draft.planId || null,
        locked: draft.locked,
      };
      if (draft.password.trim()) body.password = draft.password;
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setEditingId(null);
      setDraft(emptyDraft());
      setMessage("Đã cập nhật người dùng.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleLock(u: PublicUser) {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, locked: !u.locked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, locked: !u.locked } : x)),
      );
      setMessage(u.locked ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: PublicUser) {
    if (!window.confirm(`Xóa người dùng ${u.email}?`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setMessage("Đã xóa người dùng.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(u: PublicUser) {
    setCreating(false);
    setEditingId(u.id);
    setDraft({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      planId: u.planId || "",
      locked: u.locked,
    });
  }

  async function grant() {
    if (!grantUser) return;
    setBusyId(grantUser.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "grant",
          userId: grantUser.id,
          amount: Number(grantAmount),
          note: grantNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cộng credit thất bại");
      if (data.wallet) {
        setCredits((prev) => ({ ...prev, [grantUser.id]: data.wallet }));
      }
      setMessage(
        `Đã cộng ${Number(grantAmount).toLocaleString("vi-VN")} credit cho ${grantUser.email}.`,
      );
      setGrantUser(null);
      setGrantAmount("100");
      setGrantNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cộng credit thất bại");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Người dùng</h1>
          <p className="admin-desc">
            Thêm, sửa, khóa tài khoản và gán gói đăng ký.
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
          + Thêm người dùng
        </button>
      </div>

      {loading ? <p className="admin-muted">Đang tải…</p> : null}
      {error ? <p className="admin-alert-error">{error}</p> : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      {(creating || editingId) && (
        <div className="admin-form-grid">
          <Field
            label="Tên"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
          />
          <Field
            label="Email"
            value={draft.email}
            onChange={(v) => setDraft({ ...draft, email: v })}
          />
          <Field
            label={editingId ? "Mật khẩu mới (để trống nếu giữ)" : "Mật khẩu"}
            type="password"
            value={draft.password}
            onChange={(v) => setDraft({ ...draft, password: v })}
          />
          <label className="admin-label">
            Role
            <select
              value={draft.role}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  role: e.target.value as "user" | "admin",
                })
              }
              className="admin-select"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="admin-label">
            Gói đăng ký
            <select
              value={draft.planId}
              onChange={(e) => setDraft({ ...draft, planId: e.target.value })}
              className="admin-select"
            >
              <option value="">— Không gán —</option>
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
          <label className="admin-check">
            <input
              type="checkbox"
              checked={draft.locked}
              onChange={(e) =>
                setDraft({ ...draft, locked: e.target.checked })
              }
            />
            Khóa tài khoản
          </label>
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
              <th>Email</th>
              <th>Role</th>
              <th>Gói</th>
              <th>Credit còn</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="admin-cell-strong">{u.name}</td>
                <td className="admin-cell-muted">{u.email}</td>
                <td>
                  <span
                    className={`admin-badge ${
                      u.role === "admin"
                        ? "admin-badge-admin"
                        : "admin-badge-neutral"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="admin-cell-muted">
                  {planName(u.planId)}
                  {u.planExpiresAt ? (
                    <span className="block text-xs">
                      Hết hạn {new Date(u.planExpiresAt).toLocaleDateString("vi-VN")}
                    </span>
                  ) : null}
                </td>
                <td className="admin-cell-muted">
                  {(credits[u.id]?.available ?? 0).toLocaleString("vi-VN")}
                </td>
                <td>
                  {u.locked ? (
                    <span className="admin-badge admin-badge-warn">Đã khóa</span>
                  ) : (
                    <span className="admin-badge admin-badge-ok">Hoạt động</span>
                  )}
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => {
                        setGrantUser(u);
                        setGrantAmount("100");
                        setGrantNote("");
                      }}
                      className="admin-link"
                    >
                      Cộng credit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => startEdit(u)}
                      className="admin-link"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void toggleLock(u)}
                      className="admin-link admin-link-warn"
                    >
                      {u.locked ? "Mở khóa" : "Khóa"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void remove(u)}
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

      {grantUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2a36]/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !busyId && setGrantUser(null)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="brand-font text-xl font-semibold text-[#0f2a36]">
              Cộng credit
            </h2>
            <p className="mt-1 text-sm text-[#5b6b7c]">
              {grantUser.name} · {grantUser.email}. Hiện còn{" "}
              {(credits[grantUser.id]?.available ?? 0).toLocaleString("vi-VN")}{" "}
              credit.
            </p>
            <label className="admin-label mt-4">
              Số credit
              <input
                type="text"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className="admin-input"
              />
            </label>
            <label className="admin-label mt-3">
              Ghi chú (tuỳ chọn)
              <input
                type="text"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                className="admin-input"
              />
            </label>
            <div className="admin-form-actions mt-4">
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => void grant()}
                className="admin-btn-dark"
              >
                {busyId ? "Đang cộng…" : "Cộng credit"}
              </button>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => setGrantUser(null)}
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

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="admin-label">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input"
      />
    </label>
  );
}
