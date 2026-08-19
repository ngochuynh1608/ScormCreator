"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditBalanceButton } from "@/components/CreditBalanceButton";
import { formatBytes } from "@/lib/format";
import { ProjectCard, ProjectCardSkeleton } from "@/components/ProjectCard";
import { UploadZone } from "@/components/UploadZone";
import { UserMenu } from "@/components/UserMenu";
import type { Project } from "@/lib/types";

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
};

type UsageInfo = {
  presentationsUsed: number;
  presentationsLimit: number;
  creditsAvailable: number;
  storageUsedBytes: number;
  storageRemainingBytes: number;
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [meRes, listRes, subRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/projects"),
          fetch("/api/account/subscription"),
        ]);
        const me = await meRes.json();
        const list = await listRes.json();
        const sub = await subRes.json();
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
        if (subRes.ok && sub.usage) {
          setUsage({
            presentationsUsed: Number(sub.usage.presentationsUsed || 0),
            presentationsLimit: Number(sub.usage.presentationsLimit || 0),
            creditsAvailable: Number(sub.usage.creditsAvailable || 0),
            storageUsedBytes: Number(sub.usage.storageUsedBytes || 0),
            storageRemainingBytes: Number(sub.usage.storageRemainingBytes || 0),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi tải dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const atPresentationLimit = Boolean(
    usage && usage.presentationsUsed >= usage.presentationsLimit,
  );

  function requestCreate() {
    if (atPresentationLimit) {
      setShowUpload(false);
      setUpgradeOpen(true);
      return;
    }
    setShowUpload((v) => !v);
  }

  const usagePills = usage ? (
    <>
      <CreditBalanceButton creditsAvailable={usage.creditsAvailable} />
      <span className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-[#c9d8e2] bg-white px-3 text-sm font-bold leading-none text-[#0f2a36]">
        Trình chiếu {usage.presentationsUsed.toLocaleString("vi-VN")}
        <span className="font-bold text-[#8a98a8]">
          {" "}
          / {usage.presentationsLimit.toLocaleString("vi-VN")}
        </span>
      </span>
      <span className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-[#c9d8e2] bg-white px-3 text-sm font-bold leading-none text-[#0f2a36]">
        Dữ liệu {formatBytes(usage.storageUsedBytes)}
        <span className="font-bold text-[#8a98a8]">
          {" "}
          · còn {formatBytes(usage.storageRemainingBytes)}
        </span>
      </span>
    </>
  ) : null;

  return (
    <main className="min-h-screen">
      <header className="relative z-50 border-b border-[#c9d8e2] bg-white/75 px-4 py-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {usage ? (
              <>
                <CreditBalanceButton
                  compact
                  creditsAvailable={usage.creditsAvailable}
                />
                <span className="inline-flex h-9 min-w-0 items-center truncate whitespace-nowrap rounded-full border border-[#c9d8e2] bg-white px-2.5 text-xs font-bold leading-none text-[#0f2a36]">
                  <span className="max-[340px]:hidden">Trình chiếu </span>
                  {usage.presentationsUsed.toLocaleString("vi-VN")}
                  <span className="font-bold text-[#8a98a8]">
                    {" "}
                    / {usage.presentationsLimit.toLocaleString("vi-VN")}
                  </span>
                </span>
                <span className="inline-flex h-9 min-w-0 items-center truncate whitespace-nowrap rounded-full border border-[#c9d8e2] bg-white px-2.5 text-xs font-bold leading-none text-[#0f2a36]">
                  <span className="max-[340px]:hidden">Dữ liệu </span>
                  {formatBytes(usage.storageUsedBytes)}
                  <span className="font-bold text-[#8a98a8]">
                    {" "}
                    · còn {formatBytes(usage.storageRemainingBytes)}
                  </span>
                </span>
              </>
            ) : null}
          </div>
          {user ? (
            <div className="shrink-0">
              <UserMenu user={user} />
            </div>
          ) : null}
        </div>
        {user ? (
          <p className="mt-1.5 min-w-0 truncate text-sm text-[#5b6b7c] md:hidden">
            Xin chào, {user.name}
          </p>
        ) : null}

        <div className="mt-3 flex flex-col gap-3 md:mt-0 md:flex-row md:flex-wrap md:items-center md:justify-between">
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
              <p className="mt-1 hidden text-sm text-[#5b6b7c] md:block">
                Xin chào, {user.name}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {usagePills}
            </div>
            <button
              type="button"
              onClick={requestCreate}
              aria-disabled={atPresentationLimit && !showUpload}
              title={
                atPresentationLimit
                  ? "Đã đạt hạn mức trình chiếu của gói. Nâng cấp để tạo thêm."
                  : undefined
              }
              className={`min-h-11 w-full rounded-full px-4 py-2 text-sm font-bold md:min-h-0 md:w-auto ${
                atPresentationLimit && !showUpload
                  ? "cursor-pointer bg-[#d5dee6] text-[#6b7c8d]"
                  : "cursor-pointer bg-[#2bb673] text-[#083024]"
              }`}
            >
              {showUpload ? "Đóng upload" : "+ Tạo trình chiếu"}
            </button>
            {user ? (
              <div className="hidden shrink-0 md:block">
                <UserMenu user={user} />
              </div>
            ) : null}
          </div>
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

        {error ? (
          <p className="text-sm font-medium text-[#c45c26]">{error}</p>
        ) : null}

        {loading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Đang tải danh sách trình chiếu"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
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
              onClick={requestCreate}
              className={`mt-6 rounded-full px-5 py-2.5 text-sm font-bold ${
                atPresentationLimit
                  ? "cursor-pointer bg-[#d5dee6] text-[#6b7c8d]"
                  : "cursor-pointer bg-[#2bb673] text-[#083024]"
              }`}
            >
              + Tạo trình chiếu
            </button>
          </div>
        ) : null}

        {!loading && !error && projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                priority={i < 3}
                onDeleted={(id) => {
                  setProjects((prev) => prev.filter((x) => x.id !== id));
                  setUsage((prev) =>
                    prev
                      ? {
                          ...prev,
                          presentationsUsed: Math.max(
                            0,
                            prev.presentationsUsed - 1,
                          ),
                        }
                      : prev,
                  );
                }}
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
        ) : null}
      </div>

      {upgradeOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-limit-title"
          onClick={() => setUpgradeOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="upgrade-limit-title"
              className="brand-font text-xl font-semibold text-[#0f2a36]"
            >
              Đã đạt hạn mức trình chiếu
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
              Gói hiện tại cho phép{" "}
              <span className="font-semibold text-[#0f2a36]">
                {usage?.presentationsLimit.toLocaleString("vi-VN")} trình chiếu
              </span>
              {usage
                ? ` (đang dùng ${usage.presentationsUsed.toLocaleString("vi-VN")})`
                : ""}
              . Nâng cấp gói để tạo thêm bài giảng.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUpgradeOpen(false)}
                className="cursor-pointer rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330]"
              >
                Đóng
              </button>
              <Link
                href="/account/subscription"
                className="cursor-pointer rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024]"
              >
                Nâng cấp gói
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
