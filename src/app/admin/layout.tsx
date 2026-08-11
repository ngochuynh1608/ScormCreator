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
    <main className="min-h-screen bg-[#f3f6f9]">
      <header className="border-b border-[#c9d8e2] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div>
            <Link
              href="/admin/users"
              className="text-xs font-bold uppercase tracking-wider text-[#8a98a8]"
            >
              ScormCreator
            </Link>
            <p className="brand-font text-xl font-semibold text-[#0f2a36]">
              Bảng điều khiển Admin
            </p>
          </div>
          <UserMenu user={publicUser} />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr] md:px-8">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
