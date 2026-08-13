import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="auth-page min-h-screen">
      <div className="auth-atmosphere" aria-hidden />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10">
        <Link
          href="/"
          className="brand-font text-[15px] font-semibold tracking-tight text-[#0a1f28]"
        >
          ScormCreator
        </Link>
        <Link href="/login" className="auth-nav-link">
          Đăng nhập
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-[1100px] flex-1 items-center gap-10 px-5 pb-16 pt-4 md:px-10 lg:grid-cols-2 lg:gap-16 lg:pb-20">
        <div className="auth-aside hidden lg:block">
          <p className="brand-font text-4xl font-semibold leading-[1.05] tracking-tight text-[#0a1f28] xl:text-5xl">
            Bắt đầu tạo bài giảng SCORM.
          </p>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-[#3d5a66]">
            Tạo tài khoản miễn phí — tải PPTX hoặc PDF, thêm giọng AI và câu hỏi,
            rồi xuất gói sẵn cho LMS.
          </p>
          <ul className="auth-aside-list mt-8">
            <li>Upload PPTX / PDF trong vài phút</li>
            <li>Giọng đọc AI + quiz tương tác</li>
            <li>Xuất SCORM đưa thẳng lên LMS</li>
          </ul>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <p className="mb-4 brand-font text-2xl font-semibold tracking-tight text-[#0a1f28] lg:hidden">
            Tạo tài khoản
          </p>
          <AuthForm mode="signup" nextPath="/dashboard" />
        </div>
      </section>
    </main>
  );
}
