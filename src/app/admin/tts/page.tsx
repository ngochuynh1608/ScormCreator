import { AdminSettings } from "@/components/AdminSettings";

export default function AdminTtsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">
          Cài đặt giọng đọc AI
        </h1>
        <p className="mt-1 text-sm text-[#5b6b7c]">
          Cấu hình API key EverAI, model và giọng đọc mặc định.
        </p>
      </div>
      <AdminSettings />
    </section>
  );
}
