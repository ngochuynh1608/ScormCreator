"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Tổng quan", hint: "Số liệu & hoạt động" },
  { href: "/admin/users", label: "Người dùng", hint: "Học viên & gói" },
  { href: "/admin/accounts", label: "Tài khoản", hint: "Quản trị hệ thống" },
  { href: "/admin/plans", label: "Gói đăng ký", hint: "Hạn mức & giá" },
  { href: "/admin/credits", label: "Credit", hint: "Gói nạp & PayOS" },
  { href: "/admin/transactions", label: "Lịch sử giao dịch", hint: "Đơn nạp & nâng cấp" },
  { href: "/admin/data", label: "Quản lý dữ liệu", hint: "Project không chủ" },
  { href: "/admin/faq", label: "FAQ", hint: "Câu hỏi thường gặp" },
  { href: "/admin/tts", label: "Giọng đọc AI", hint: "API & mặc định" },
  { href: "/admin/email", label: "Email OTP", hint: "Resend API" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Menu admin">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
