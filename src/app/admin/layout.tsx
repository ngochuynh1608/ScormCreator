import { redirect } from "next/navigation";
import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { AdminNav } from "@/components/AdminNav";
import { findUserById, resolveUserRole, toPublicUser } from "@/lib/auth/users";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  const user = await findUserById(session.userId);
  if (!user || resolveUserRole(user) !== "admin") {
    redirect("/dashboard");
  }
  const publicUser = toPublicUser(user);

  return (
    <main className="admin-shell min-h-screen">
      <div className="admin-atmosphere" aria-hidden />
      <header className="admin-header relative z-10">
        <div className="admin-header-inner">
          <div className="min-w-0">
            <Link href="/admin/users" className="admin-brand">
              ScormCreator
            </Link>
            <p className="brand-font mt-0.5 text-lg font-semibold tracking-tight text-[#0a1f28] md:text-xl">
              Bảng điều khiển
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="admin-ghost-link">
              Trang chủ
            </Link>
            <UserMenu user={publicUser} />
          </div>
        </div>
      </header>

      <div className="admin-body relative z-10">
        <AdminNav />
        <div className="admin-content min-w-0">{children}</div>
      </div>
    </main>
  );
}
