"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/users", label: "Quản lý người dùng" },
  { href: "/admin/plans", label: "Gói đăng ký" },
  { href: "/admin/tts", label: "Cài đặt giọng đọc AI" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-1">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-[#0f2a36] text-white"
                : "bg-white text-[#0f2a36] hover:bg-[#e8eef2]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
