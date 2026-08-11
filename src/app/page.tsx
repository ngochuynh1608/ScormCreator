import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { HomeUploadHero } from "@/components/HomeUploadHero";
import { getSession } from "@/lib/auth/session";
import { findUserById, toPublicUser } from "@/lib/auth/users";

export default async function HomePage() {
  const session = await getSession();
  const authUser = session ? await findUserById(session.userId) : null;
  const user = authUser ? toPublicUser(authUser) : null;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="home-hero-bg pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="home-hero-orb home-hero-orb-a" />
      <div aria-hidden className="home-hero-orb home-hero-orb-b" />
      <div aria-hidden className="home-hero-orb home-hero-orb-c" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <p className="brand-font text-lg font-semibold tracking-tight text-white">
          ScormCreator
        </p>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                >
                  Bảng điều khiển
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                >
                  Trình chiếu của tôi
                </Link>
              )}
              <UserMenu user={user} tone="dark" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
              >
                Đăng nhập
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[#ffd36a] px-4 py-2 text-sm font-bold text-[#3a2a00] transition hover:bg-[#ffe08a]"
              >
                Tạo tài khoản
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-20 pt-6 md:px-10">
        <div className="max-w-3xl">
          <p className="home-hero-brand brand-font mb-4 text-5xl font-semibold leading-[0.95] text-white md:text-7xl">
            ScormCreator
          </p>
          <h1 className="home-hero-line max-w-2xl text-lg font-medium leading-relaxed text-[#fff6df] md:text-2xl">
            Biến PowerPoint &amp; PDF thành bài giảng SCORM có giọng đọc và câu
            hỏi tương tác.
          </h1>
          <HomeUploadHero />
        </div>
      </section>
    </main>
  );
}
