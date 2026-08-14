"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlanIcon, ProfileIcon, TopUpIcon } from "./account-icons";

const NAV = [
  { href: "/account/profile", label: "Hồ sơ", icon: ProfileIcon },
  { href: "/account/subscription", label: "Gói đăng ký & Credit", icon: PlanIcon },
  { href: "/account/payments", label: "Nạp credit", icon: TopUpIcon },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-2 overflow-x-auto md:flex-col">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              active
                ? "bg-white text-[#0f2a36] shadow-sm"
                : "text-[#0f2a36] hover:bg-white"
            }`}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
