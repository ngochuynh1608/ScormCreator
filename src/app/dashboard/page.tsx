"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProjectCard } from "@/components/ProjectCard";
import { UploadZone } from "@/components/UploadZone";
import { UserMenu } from "@/components/UserMenu";
import type { Project } from "@/lib/types";

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [meRes, listRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/projects"),
        ]);
        const me = await meRes.json();
        const list = await listRes.json();
        if (!me.user) {
          window.location.href = "/login?next=/dashboard";
          return;
        }
        if (me.user.role === "admin") {
          window.location.href = "/admin";
          return;
        }
        setUser(me.user);
        if (!listRes.ok) throw new Error(list.error || "Không tải được danh sách");
        setProjects(list.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi tải dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9d8e2] bg-white/75 px-4 py-4 backdrop-blur md:px-8">
        <div>
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
          >
            ScormCreator
          </Link>
          <p className="brand-font text-xl font-semibold text-[#0f2a36]">
            Trình chiếu của tôi
          </p>
          {user ? (
            <p className="text-sm text-[#5b6b7c]">
              Xin chào, {user.name} · {user.email}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="rounded-full bg-[#2bb673] px-4 py-2 text-sm font-bold text-[#083024]"
          >
            {showUpload ? "Đóng upload" : "+ Tạo trình chiếu"}
          </button>
          {user ? <UserMenu user={user} /> : null}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {showUpload ? (
          <div className="mb-8 rounded-[28px] border border-[#d5e1ea] bg-white/80 p-6 shadow-sm">
            <p className="brand-font text-lg font-semibold text-[#0f2a36]">
              Tạo trình chiếu mới
            </p>
            <p className="mt-1 text-sm text-[#5b6b7c]">
              Tải PPTX hoặc tạo trống — dự án thuộc tài khoản của bạn và hiện
              trong danh sách bên dưới.
            </p>
            <div className="mt-4">
              <UploadZone />
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#5b6b7c]">Đang tải danh sách…</p>
        ) : null}
        {error ? (
          <p className="text-sm font-medium text-[#c45c26]">{error}</p>
        ) : null}

        {!loading && !error && projects.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#9bb4c2] bg-white/60 px-6 py-16 text-center">
            <p className="brand-font text-2xl font-semibold text-[#0f2a36]">
              Chưa có trình chiếu nào
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#5b6b7c]">
              Tải PowerPoint hoặc tạo trình chiếu trống để bắt đầu bài giảng
              SCORM.
            </p>
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="mt-6 rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024]"
            >
              + Tạo trình chiếu
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDeleted={(id) =>
                setProjects((prev) => prev.filter((x) => x.id !== id))
              }
              onRenamed={(id, title) =>
                setProjects((prev) =>
                  prev.map((x) =>
                    x.id === id
                      ? { ...x, title, updatedAt: new Date().toISOString() }
                      : x,
                  ),
                )
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}
