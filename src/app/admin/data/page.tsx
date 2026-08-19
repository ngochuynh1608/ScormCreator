"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBytes } from "@/lib/format";

type OrphanReason = "unassigned" | "missing-user";

type DataProject = {
  id: string;
  title: string;
  originalFileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string | null;
  sizeBytes: number;
  reason: OrphanReason;
};

function reasonLabel(reason: OrphanReason) {
  if (reason === "missing-user") return "User đã xóa";
  return "Chưa gán user";
}

function statusLabel(status: string) {
  if (status === "ready") return "Sẵn sàng";
  if (status === "processing") return "Đang xử lý";
  if (status === "error") return "Lỗi";
  return status;
}

function formatTime(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("vi-VN");
}

export default function AdminDataPage() {
  const [projects, setProjects] = useState<DataProject[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được dữ liệu");
      setProjects(data.projects || []);
      setTotalBytes(Number(data.totalBytes) || 0);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const selectedBytes = useMemo(
    () =>
      projects
        .filter((p) => selected.has(p.id))
        .reduce((sum, p) => sum + p.sizeBytes, 0),
    [projects, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allIds.length > 0 && allIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(allIds);
    });
  }

  async function remove(ids: string[]) {
    if (ids.length === 0) return;
    const ok = window.confirm(
      ids.length === 1
        ? "Xóa bài giảng này? Không hoàn tác được."
        : `Xóa ${ids.length} bài giảng chưa gán user? Không hoàn tác được.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      const freed = formatBytes(Number(data.freedBytes) || 0);
      setMessage(`Đã xóa ${data.deleted || 0} bài giảng, giải phóng ${freed}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Quản lý dữ liệu</h1>
          <p className="admin-desc">
            Bài giảng chưa gán người dùng (hoặc user đã bị xóa). Xóa để giải
            phóng dung lượng trên hệ thống.
          </p>
        </div>
        <div className="admin-row-actions">
          <button
            type="button"
            className="admin-btn-muted"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Tải lại
          </button>
          <button
            type="button"
            className="admin-btn-dark"
            disabled={busy || selected.size === 0}
            onClick={() => void remove([...selected])}
          >
            {busy ? "Đang xóa…" : `Xóa đã chọn (${selected.size})`}
          </button>
        </div>
      </div>

      <p className="admin-muted">
        {loading
          ? "Đang tải…"
          : `${projects.length} bài giảng · ${formatBytes(totalBytes)}${
              selected.size
                ? ` · đã chọn ${formatBytes(selectedBytes)}`
                : ""
            }`}
      </p>
      {error ? (
        <p className="admin-alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={projects.length === 0 || busy}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả"
                />
              </th>
              <th>Bài giảng</th>
              <th>Trạng thái</th>
              <th>Lý do</th>
              <th>Dung lượng</th>
              <th>Cập nhật</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="admin-cell-muted">
                  Không có bài giảng chưa gán user.
                </td>
              </tr>
            ) : null}
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    disabled={busy}
                    onChange={() => toggle(p.id)}
                    aria-label={`Chọn ${p.title}`}
                  />
                </td>
                <td>
                  <div className="admin-cell-strong">{p.title}</div>
                  <div className="admin-cell-muted">
                    {p.originalFileName || p.id}
                  </div>
                </td>
                <td className="admin-cell-muted">{statusLabel(p.status)}</td>
                <td>
                  <span
                    className={
                      p.reason === "missing-user"
                        ? "admin-badge admin-badge-warn"
                        : "admin-badge admin-badge-neutral"
                    }
                  >
                    {reasonLabel(p.reason)}
                  </span>
                </td>
                <td className="admin-cell-muted">{formatBytes(p.sizeBytes)}</td>
                <td className="admin-cell-muted">{formatTime(p.updatedAt)}</td>
                <td>
                  <button
                    type="button"
                    className="admin-link admin-link-danger"
                    disabled={busy}
                    onClick={() => void remove([p.id])}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
