import Link from "next/link";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { getSession } from "@/lib/auth/session";
import { findUserById, toPublicUser } from "@/lib/auth/users";

const NAV = [
  { href: "/account/profile", label: "Hồ sơ" },
  { href: "/account/subscription", label: "Gói đăng ký" },
  { href: "/account/payments", label: "Lịch sử thanh toán" },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/profile");
  const authUser = await findUserById(session.userId);
  if (!authUser) redirect("/login?next=/account/profile");
  const user = toPublicUser(authUser);

  const homeHref = user.role === "admin" ? "/admin" : "/dashboard";
  const homeLabel = user.role === "admin" ? "Bảng điều khiển" : "Trình chiếu";

  return (
    <main className="min-h-screen bg-[#f3f6f9]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9d8e2] bg-white/75 px-4 py-4 backdrop-blur md:px-8">
        <div>
          <Link
            href={homeHref}
            className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
          >
            ScormCreator
          </Link>
          <p className="brand-font text-xl font-semibold text-[#0f2a36]">
            Tài khoản
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="rounded-full border border-[#c9d8e2] bg-white px-4 py-2 text-sm font-semibold text-[#0f2a36]"
          >
            {homeLabel}
          </Link>
          <UserMenu user={user} />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[200px_1fr] md:px-8">
        <nav className="flex flex-row gap-2 overflow-x-auto md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-[#0f2a36] hover:bg-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </main>
  );
}
