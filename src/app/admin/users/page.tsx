"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUser, SubscriptionPlan } from "@/lib/auth/types";
import type { CreditSnapshot } from "@/lib/credits/types";
import type { StorageSnapshot } from "@/lib/auth/quota";
import { formatBytes } from "@/lib/format";
import { AdminActionsMenu } from "@/components/AdminActionsMenu";

type Draft = {
  name: string;
  email: string;
  password: string;
  planId: string;
  planExpiresAt: string;
  locked: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  email: "",
  password: "",
  planId: "",
  planExpiresAt: "",
  locked: false,
});

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const d = new Date(`${raw}T23:59:59.999`);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [signupPlanId, setSignupPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [credits, setCredits] = useState<Record<string, CreditSnapshot>>({});
  const [storage, setStorage] = useState<Record<string, StorageSnapshot>>({});
  const [grantUser, setGrantUser] = useState<PublicUser | null>(null);
  const [grantAmount, setGrantAmount] = useState("100");
  const [grantNote, setGrantNote] = useState("");
  const [storageUser, setStorageUser] = useState<PublicUser | null>(null);
  const [storageAmount, setStorageAmount] = useState("100");

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
      setStorage(uData.storage || {});
      setPlans(pData.plans || []);
      setSignupPlanId(
        typeof pData.signupPlanId === "string" ? pData.signupPlanId : "",
      );
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
          role: "user",
          planId: draft.planId || undefined,
          planExpiresAt: dateInputToIso(draft.planExpiresAt),
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
        role: "user",
        planId: draft.planId || null,
        planExpiresAt: dateInputToIso(draft.planExpiresAt),
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
      planId: u.planId || "",
      planExpiresAt: toDateInput(u.planExpiresAt),
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

  async function grantStorage() {
    if (!storageUser) return;
    setBusyId(storageUser.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: storageUser.id,
          grantStorageMb: Number(storageAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cộng dung lượng thất bại");
      if (data.storage) {
        setStorage((prev) => ({ ...prev, [storageUser.id]: data.storage }));
      }
      setMessage(
        `Đã cộng ${Number(storageAmount).toLocaleString("vi-VN")} MB dữ liệu cho ${storageUser.email}.`,
      );
      setStorageUser(null);
      setStorageAmount("100");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cộng dung lượng thất bại");
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
            Thêm, sửa, khóa tài khoản học viên và gán gói đăng ký. Tài khoản
            quản trị nằm ở mục Tài khoản.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
            setDraft({ ...emptyDraft(), planId: signupPlanId });
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
            Gói đăng ký
            <select
              value={draft.planId}
              onChange={(e) => setDraft({ ...draft, planId: e.target.value })}
              className="admin-select"
            >
              <option value="">
                {creating ? "Gói mặc định khi tạo tài khoản" : "— Không gán —"}
              </option>
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
          <label className="admin-label">
            Hết hạn gói
            <input
              type="date"
              value={draft.planExpiresAt}
              onChange={(e) =>
                setDraft({ ...draft, planExpiresAt: e.target.value })
              }
              className="admin-input"
            />
            <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-[#8a98a8]">
              Để trống = không hết hạn. Sau ngày này gói trả phí hạ về miễn phí.
            </span>
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
              <th>Gói</th>
              <th>Credit còn</th>
              <th>Dữ liệu</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="admin-cell-strong">{u.name}</td>
                <td className="admin-cell-muted">{u.email}</td>
                <td className="admin-cell-muted">
                  {planName(u.planId)}
                  {u.planExpiresAt ? (
                    <span
                      className={`block text-xs ${
                        new Date(u.planExpiresAt).getTime() <= Date.now()
                          ? "font-semibold text-[#c45c26]"
                          : ""
                      }`}
                    >
                      {new Date(u.planExpiresAt).getTime() <= Date.now()
                        ? "Đã hết hạn "
                        : "Hết hạn "}
                      {new Date(u.planExpiresAt).toLocaleDateString("vi-VN")}
                    </span>
                  ) : (
                    <span className="block text-xs">Không hết hạn</span>
                  )}
                </td>
                <td className="admin-cell-muted">
                  {(credits[u.id]?.available ?? 0).toLocaleString("vi-VN")}
                </td>
                <td className="admin-cell-muted">
                  {formatBytes(storage[u.id]?.usedBytes || 0)}
                  <span className="block text-xs">
                    còn {formatBytes(storage[u.id]?.remainingBytes || 0)}
                    {storage[u.id]?.extraMb
                      ? ` · +${storage[u.id].extraMb.toLocaleString("vi-VN")} MB`
                      : ""}
                  </span>
                </td>
                <td>
                  {u.locked ? (
                    <span className="admin-badge admin-badge-warn">Đã khóa</span>
                  ) : (
                    <span className="admin-badge admin-badge-ok">Hoạt động</span>
                  )}
                </td>
                <td>
                  <UserActionsMenu
                    user={u}
                    busy={busyId === u.id}
                    onGrant={() => {
                      setGrantUser(u);
                      setGrantAmount("100");
                      setGrantNote("");
                    }}
                    onGrantStorage={() => {
                      setStorageUser(u);
                      setStorageAmount("100");
                    }}
                    onEdit={() => startEdit(u)}
                    onToggleLock={() => void toggleLock(u)}
                    onDelete={() => void remove(u)}
                  />
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

      {storageUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2a36]/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !busyId && setStorageUser(null)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="brand-font text-xl font-semibold text-[#0f2a36]">
              Cộng dung lượng
            </h2>
            <p className="mt-1 text-sm text-[#5b6b7c]">
              {storageUser.name} · {storageUser.email}. Đã dùng{" "}
              {formatBytes(storage[storageUser.id]?.usedBytes || 0)}, còn{" "}
              {formatBytes(storage[storageUser.id]?.remainingBytes || 0)}
              {storage[storageUser.id]?.extraMb
                ? ` (đã cộng thêm ${storage[storageUser.id].extraMb.toLocaleString("vi-VN")} MB)`
                : ""}
              .
            </p>
            <label className="admin-label mt-4">
              Số MB cộng thêm
              <input
                type="text"
                value={storageAmount}
                onChange={(e) => setStorageAmount(e.target.value)}
                className="admin-input"
              />
            </label>
            <div className="admin-form-actions mt-4">
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => void grantStorage()}
                className="admin-btn-dark"
              >
                {busyId ? "Đang cộng…" : "Cộng dung lượng"}
              </button>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => setStorageUser(null)}
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

function UserActionsMenu({
  user,
  busy,
  onGrant,
  onGrantStorage,
  onEdit,
  onToggleLock,
  onDelete,
}: {
  user: PublicUser;
  busy: boolean;
  onGrant: () => void;
  onGrantStorage: () => void;
  onEdit: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}) {
  return (
    <AdminActionsMenu busy={busy}>
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            className="admin-actions-item"
            onClick={() => {
              close();
              onGrant();
            }}
          >
            <CreditIcon />
            Cộng credit
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-actions-item"
            onClick={() => {
              close();
              onGrantStorage();
            }}
          >
            <StorageIcon />
            Cộng dung lượng
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-actions-item"
            onClick={() => {
              close();
              onEdit();
            }}
          >
            <EditIcon />
            Sửa
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-actions-item is-warn"
            onClick={() => {
              close();
              onToggleLock();
            }}
          >
            {user.locked ? <UnlockIcon /> : <LockIcon />}
            {user.locked ? "Mở khóa" : "Khóa"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-actions-item is-danger"
            onClick={() => {
              close();
              onDelete();
            }}
          >
            <TrashIcon />
            Xóa
          </button>
        </>
      )}
    </AdminActionsMenu>
  );
}

function CreditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v8M9.5 10.5c.6-1 1.5-1.5 2.5-1.5s2 .6 2 1.6c0 2.2-4.5 1.2-4.5 3.6 0 1 .9 1.8 2.5 1.8s1.9-.5 2.5-1.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="4"
        y="14"
        width="16"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="8" cy="7" r="1" fill="currentColor" />
      <circle cx="8" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8L17.6 4.8a2 2 0 0 0-2.8 0L4 15.8V20z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 11V8a4 4 0 0 1 7.5-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
