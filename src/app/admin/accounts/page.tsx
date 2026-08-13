"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUser } from "@/lib/auth/types";
import { AdminActionsMenu } from "@/components/AdminActionsMenu";

type Draft = {
  name: string;
  email: string;
  password: string;
  locked: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  email: "",
  password: "",
  locked: false,
});

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<PublicUser[]>([]);
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
      const res = await fetch("/api/admin/accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được tài khoản");
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusyId("new");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          password: draft.password,
          locked: draft.locked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo thất bại");
      setCreating(false);
      setDraft(emptyDraft());
      setMessage("Đã thêm tài khoản quản trị.");
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
        locked: draft.locked,
      };
      if (draft.password.trim()) body.password = draft.password;
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setEditingId(null);
      setDraft(emptyDraft());
      setMessage("Đã cập nhật tài khoản quản trị.");
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
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, locked: !u.locked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setAccounts((prev) =>
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
    if (!window.confirm(`Xóa tài khoản quản trị ${u.email}?`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setMessage("Đã xóa tài khoản quản trị.");
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
      locked: u.locked,
    });
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Tài khoản</h1>
          <p className="admin-desc">
            Tạo và quản lý tài khoản quản trị hệ thống. Không hiện trong danh
            sách Người dùng.
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
          + Thêm quản trị viên
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
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((u) => (
              <tr key={u.id}>
                <td className="admin-cell-strong">{u.name}</td>
                <td className="admin-cell-muted">{u.email}</td>
                <td>
                  <span className="admin-badge admin-badge-admin">admin</span>
                </td>
                <td>
                  {u.locked ? (
                    <span className="admin-badge admin-badge-warn">Đã khóa</span>
                  ) : (
                    <span className="admin-badge admin-badge-ok">Hoạt động</span>
                  )}
                </td>
                <td>
                  <AccountActionsMenu
                    user={u}
                    busy={busyId === u.id}
                    onEdit={() => startEdit(u)}
                    onToggleLock={() => void toggleLock(u)}
                    onDelete={() => void remove(u)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && accounts.length === 0 ? (
          <p className="admin-muted px-3 py-4">Chưa có tài khoản quản trị.</p>
        ) : null}
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

function AccountActionsMenu({
  user,
  busy,
  onEdit,
  onToggleLock,
  onDelete,
}: {
  user: PublicUser;
  busy: boolean;
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
