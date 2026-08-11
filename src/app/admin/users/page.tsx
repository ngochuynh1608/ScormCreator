"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUser, SubscriptionPlan } from "@/lib/auth/types";

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

  return (
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">
            Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-[#5b6b7c]">
            Thêm, sửa, xóa, khóa / mở khóa tài khoản và gán gói đăng ký.
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
          + Thêm người dùng
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
          <label className="block text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
            Role
            <select
              value={draft.role}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  role: e.target.value as "user" | "admin",
                })
              }
              className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36]"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
            Gói đăng ký
            <select
              value={draft.planId}
              onChange={(e) => setDraft({ ...draft, planId: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36]"
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
          <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-[#0f2a36]">
            <input
              type="checkbox"
              checked={draft.locked}
              onChange={(e) =>
                setDraft({ ...draft, locked: e.target.checked })
              }
            />
            Khóa tài khoản
          </label>
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
              <th className="py-2 pr-3 font-bold">Email</th>
              <th className="py-2 pr-3 font-bold">Role</th>
              <th className="py-2 pr-3 font-bold">Gói</th>
              <th className="py-2 pr-3 font-bold">Trạng thái</th>
              <th className="py-2 font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#eef2f6]">
                <td className="py-3 pr-3 font-semibold text-[#0f2a36]">
                  {u.name}
                </td>
                <td className="py-3 pr-3 text-[#5b6b7c]">{u.email}</td>
                <td className="py-3 pr-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      u.role === "admin"
                        ? "bg-[#e5f6ee] text-[#1f7a4d]"
                        : "bg-[#eef3f8] text-[#5b6b7c]"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3 pr-3 text-[#5b6b7c]">{planName(u.planId)}</td>
                <td className="py-3 pr-3">
                  {u.locked ? (
                    <span className="rounded-full bg-[#fff4ef] px-2.5 py-1 text-xs font-bold text-[#c45c26]">
                      Đã khóa
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#e5f6ee] px-2.5 py-1 text-xs font-bold text-[#1f7a4d]">
                      Hoạt động
                    </span>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => startEdit(u)}
                      className="text-sm font-semibold text-[#0f2a36] disabled:opacity-50"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void toggleLock(u)}
                      className="text-sm font-semibold text-[#8a5a00] disabled:opacity-50"
                    >
                      {u.locked ? "Mở khóa" : "Khóa"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void remove(u)}
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#0f2a36] outline-none focus:border-[#2bb673]"
      />
    </label>
  );
}
