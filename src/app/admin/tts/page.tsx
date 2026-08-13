import { AdminSettings } from "@/components/AdminSettings";

export default function AdminTtsPage() {
  return (
    <section className="admin-stack">
      <div className="admin-panel pb-4">
        <h1 className="brand-font admin-title">Giọng đọc AI</h1>
        <p className="admin-desc">
          Cấu hình API key, model và giọng mặc định dùng chung cho toàn hệ thống.
        </p>
      </div>
      <AdminSettings />
    </section>
  );
}
