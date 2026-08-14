"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HistoryIcon,
  LogoutIcon,
  PlanIcon,
  ProfileIcon,
} from "./account-icons";

export type UserMenuUser = {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
};

function initials(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export function UserMenu({
  user,
  tone = "light",
}: {
  user: UserMenuUser;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function placeMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    placeMenu();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      placeMenu();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const isDark = tone === "dark";

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, right: menuPos.right }}
            className={`fixed z-[100] w-64 overflow-hidden rounded-2xl border py-1 shadow-lg ${
              isDark
                ? "border-white/15 bg-[#123040] text-[#edf3f7]"
                : "border-[#dfe7ef] bg-white text-[#0f2a36]"
            }`}
          >
            <div
              className={`border-b px-4 py-3 ${
                isDark ? "border-white/10" : "border-[#eef2f6]"
              }`}
            >
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p
                className={`truncate text-xs ${
                  isDark ? "text-white/65" : "text-[#5b6b7c]"
                }`}
              >
                {user.email}
              </p>
            </div>
            <Link
              role="menuitem"
              href="/account/profile"
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold ${
                isDark ? "hover:bg-white/10" : "hover:bg-[#f3f7fa]"
              }`}
              onClick={() => setOpen(false)}
            >
              <ProfileIcon />
              Hồ sơ
            </Link>
            <Link
              role="menuitem"
              href="/account/subscription"
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold ${
                isDark ? "hover:bg-white/10" : "hover:bg-[#f3f7fa]"
              }`}
              onClick={() => setOpen(false)}
            >
              <PlanIcon />
              Gói đăng ký & Credit
            </Link>
            <Link
              role="menuitem"
              href="/account/payments"
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold ${
                isDark ? "hover:bg-white/10" : "hover:bg-[#f3f7fa]"
              }`}
              onClick={() => setOpen(false)}
            >
              <HistoryIcon />
              Lịch sử thanh toán
            </Link>
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2.5 border-t px-4 py-2.5 text-left text-sm font-semibold ${
                isDark
                  ? "border-white/10 text-[#ffb4a2] hover:bg-white/10"
                  : "border-[#eef2f6] text-[#c45c26] hover:bg-[#fff4ef]"
              }`}
              onClick={() => {
                setOpen(false);
                void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  router.push("/");
                  router.refresh();
                });
              }}
            >
              <LogoutIcon />
              Đăng xuất
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative z-[60]">
      <button
        ref={btnRef}
        type="button"
        title={user.name || user.email}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tracking-wide transition ${
          isDark
            ? "bg-white/15 text-[#edf3f7] hover:bg-white/25"
            : "border border-[#c9d8e2] bg-[#e8f3ee] text-[#0f2a36] hover:bg-[#dceee4]"
        }`}
      >
        {initials(user.name, user.email)}
      </button>
      {menu}
    </div>
  );
}
