"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/users", label: "Người dùng", hint: "Tài khoản & gói" },
  { href: "/admin/plans", label: "Gói đăng ký", hint: "Hạn mức & giá" },
  { href: "/admin/tts", label: "Giọng đọc AI", hint: "API & mặc định" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Menu admin">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-item ${active ? "is-active" : ""}`}
          >
            <span className="admin-nav-label">{item.label}</span>
            <span className="admin-nav-hint">{item.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
