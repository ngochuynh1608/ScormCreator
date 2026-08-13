"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaqItem } from "@/lib/faq/types";
import { AdminActionsMenu } from "@/components/AdminActionsMenu";

type Draft = {
  question: string;
  answer: string;
  sortOrder: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({
  question: "",
  answer: "",
  sortOrder: "",
  active: true,
});

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
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
      const res = await fetch("/api/admin/faqs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được FAQ");
      setFaqs(data.faqs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusyId(editingId || "new");
    setMessage(null);
    setError(null);
    try {
      const sortRaw = draft.sortOrder.trim();
      const payload: Record<string, unknown> = {
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        active: draft.active,
      };
      if (sortRaw) {
        const n = Number(sortRaw);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Thứ tự phải là số ≥ 0.");
        }
        payload.sortOrder = Math.floor(n);
      }
      const res = await fetch("/api/admin/faqs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload,
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu thất bại");
      setCreating(false);
      setEditingId(null);
      setDraft(emptyDraft());
      setMessage(editingId ? "Đã cập nhật câu hỏi." : "Đã thêm câu hỏi.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item: FaqItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/faqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: !item.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setFaqs((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, active: !item.active } : x)),
      );
      setMessage(item.active ? "Đã ẩn trên trang chủ." : "Đã hiện trên trang chủ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: FaqItem) {
    if (!window.confirm(`Xóa câu hỏi:\n"${item.question}"?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/faqs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setMessage("Đã xóa câu hỏi.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(item: FaqItem) {
    setCreating(false);
    setEditingId(item.id);
    setDraft({
      question: item.question,
      answer: item.answer,
      sortOrder: String(item.sortOrder),
      active: item.active,
    });
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setDraft(emptyDraft());
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">FAQ</h1>
          <p className="admin-desc">
            Quản lý các câu hỏi thường gặp hiển thị trên trang chủ.
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
          + Thêm câu hỏi
        </button>
      </div>

      {loading ? <p className="admin-muted">Đang tải…</p> : null}
      {error ? <p className="admin-alert-error">{error}</p> : null}
      {message ? <p className="admin-alert-ok">{message}</p> : null}

      {creating || editingId ? (
        <div className="admin-form-grid">
          <label className="admin-label" style={{ gridColumn: "1 / -1" }}>
            Câu hỏi
            <input
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              className="admin-input"
              maxLength={300}
            />
          </label>
          <label className="admin-label" style={{ gridColumn: "1 / -1" }}>
            Câu trả lời
            <textarea
              value={draft.answer}
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              className="admin-input"
              rows={5}
              maxLength={4000}
            />
          </label>
          <label className="admin-label">
            Thứ tự
            <input
              type="number"
              min={0}
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
              className="admin-input"
              placeholder="Tự động"
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Hiện trên trang chủ
          </label>
          <div className="admin-form-actions">
            <button
              type="button"
              disabled={Boolean(busyId) || !draft.question.trim() || !draft.answer.trim()}
              onClick={() => void save()}
              className="admin-btn-dark"
            >
              {busyId ? "Đang lưu…" : editingId ? "Lưu" : "Thêm"}
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={cancelForm}
              className="admin-btn-muted"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Thứ tự</th>
              <th>Câu hỏi</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map((item) => (
              <tr key={item.id}>
                <td className="admin-cell-muted">{item.sortOrder}</td>
                <td>
                  <div className="admin-cell-strong">{item.question}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-[#5b7380]">
                    {item.answer}
                  </p>
                </td>
                <td>
                  {item.active ? (
                    <span className="admin-badge admin-badge-ok">Hiện</span>
                  ) : (
                    <span className="admin-badge admin-badge-neutral">Ẩn</span>
                  )}
                </td>
                <td>
                  <AdminActionsMenu busy={busyId === item.id}>
                    {(close) => (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="admin-actions-item"
                          onClick={() => {
                            close();
                            startEdit(item);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="admin-actions-item is-warn"
                          onClick={() => {
                            close();
                            void toggleActive(item);
                          }}
                        >
                          {item.active ? "Ẩn" : "Hiện"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="admin-actions-item is-danger"
                          onClick={() => {
                            close();
                            void remove(item);
                          }}
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </AdminActionsMenu>
                </td>
              </tr>
            ))}
            {!loading && faqs.length === 0 ? (
              <tr>
                <td colSpan={4} className="admin-muted py-8 text-center">
                  Chưa có câu hỏi nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
