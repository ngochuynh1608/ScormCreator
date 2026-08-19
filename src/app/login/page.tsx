import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next || "/dashboard";

  return (
    <main className="auth-page min-h-screen">
      <div className="auth-atmosphere" aria-hidden />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10">
        <Link
          href="/"
          className="brand-font text-[15px] font-semibold tracking-tight text-[#0a1f28]"
        >
          Scorm Pro
        </Link>
        <Link href="/signup" className="auth-nav-link">
          Tạo tài khoản
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-[1100px] flex-1 items-center gap-10 px-5 pb-16 pt-4 md:px-10 lg:grid-cols-2 lg:gap-16 lg:pb-20">
        <div className="auth-aside hidden lg:block">
          <p className="brand-font text-4xl font-semibold leading-[1.05] tracking-tight text-[#0a1f28] xl:text-5xl">
            Chào mừng trở lại.
          </p>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-[#3d5a66]">
            Đăng nhập để mở trình chiếu, gắn giọng đọc AI và xuất gói SCORM cho
            LMS.
          </p>
          <ul className="auth-aside-list mt-8">
            <li>Lưu và quản lý nhiều bài giảng</li>
            <li>Xuất SCORM 1.2 &amp; 2004</li>
            <li>Chia sẻ link xem trước</li>
          </ul>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <p className="mb-4 brand-font text-2xl font-semibold tracking-tight text-[#0a1f28] lg:hidden">
            Đăng nhập
          </p>
          {params.error ? (
            <p className="mb-4 rounded-xl border border-[#f0d2c0] bg-[#fff7f1] px-4 py-3 text-sm font-medium text-[#8a3d12]">
              {params.error}
            </p>
          ) : null}
          <AuthForm mode="login" nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
