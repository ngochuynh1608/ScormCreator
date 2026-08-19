import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/AccountNav";
import { UserMenu } from "@/components/UserMenu";
import { getSession } from "@/lib/auth/session";
import { findUserById, toPublicUser } from "@/lib/auth/users";

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
      <header className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-[#c9d8e2] bg-white/75 px-4 py-4 backdrop-blur md:px-8">
        <div>
          <Link
            href={homeHref}
            className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
          >
            Scorm Pro
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

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[240px_1fr] md:px-8">
        <AccountNav />
        <div>{children}</div>
      </div>
    </main>
  );
}
