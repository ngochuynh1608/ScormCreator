import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { HomeUploadHero } from "@/components/HomeUploadHero";
import { getSession } from "@/lib/auth/session";
import { findUserById, toPublicUser } from "@/lib/auth/users";
import { listPlans } from "@/lib/auth/plans";
import { listActiveFaqs } from "@/lib/faq";

export default async function HomePage() {
  const session = await getSession();
  const authUser = session ? await findUserById(session.userId) : null;
  const user = authUser ? toPublicUser(authUser) : null;
  const [plans, faqs] = await Promise.all([listPlans(), listActiveFaqs()]);

  return (
    <main className="home-page min-h-screen">
      <header className="home-nav relative z-20 flex items-center justify-between px-5 py-5 md:px-10 lg:px-14">
        <Link
          href="/"
          className="brand-font shrink-0 text-[15px] font-semibold tracking-tight text-[#0a1f28]"
        >
          ScormCreator
        </Link>

        <nav
          className="home-nav-menu absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
          aria-label="Menu chính"
        >
          <a href="#bang-gia" className="home-nav-menu-link">
            Bảng giá
          </a>
          <a href="#tinh-nang" className="home-nav-menu-link">
            Tính năng
          </a>
          <a href="#faq" className="home-nav-menu-link">
            Các câu hỏi thường gặp
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {user.role === "admin" ? (
                <Link href="/admin" className="home-nav-link">
                  Bảng điều khiển
                </Link>
              ) : (
                <Link href="/dashboard" className="home-nav-link">
                  Trình chiếu của tôi
                </Link>
              )}
              <UserMenu user={user} tone="light" />
            </>
          ) : (
            <>
              <Link href="/login" className="home-nav-link">
                Đăng nhập
              </Link>
              <Link href="/signup" className="home-nav-cta">
                Tạo tài khoản
              </Link>
            </>
          )}
        </div>
      </header>

      <nav
        className="relative z-20 flex gap-1 overflow-x-auto border-b border-[#d5e4ea]/70 px-5 pb-3 md:hidden"
        aria-label="Menu trang"
      >
        <a href="#bang-gia" className="home-nav-menu-link shrink-0">
          Bảng giá
        </a>
        <a href="#tinh-nang" className="home-nav-menu-link shrink-0">
          Tính năng
        </a>
        <a href="#faq" className="home-nav-menu-link shrink-0">
          FAQ
        </a>
      </nav>

      <section className="home-hero relative isolate overflow-hidden">
        <div className="home-hero-atmosphere" aria-hidden />
        <div className="home-hero-stage" aria-hidden>
          <div className="home-ed">
            <header className="home-ed-top">
              <div className="home-ed-top-left">
                <span className="home-ed-brand">SCORMCREATOR</span>
                <span className="home-ed-title">Bài giảng hội nhập</span>
              </div>
              <div className="home-ed-top-actions">
                <span className="home-ed-btn">Xem trước</span>
                <span className="home-ed-btn">Chia sẻ</span>
                <span className="home-ed-btn home-ed-btn-primary">Xuất SCORM</span>
              </div>
            </header>

            <div className="home-ed-body">
              <aside className="home-ed-thumbs">
                <div className="home-ed-thumb is-active">
                  <div className="home-ed-thumb-media home-ed-thumb-a" />
                  <p>
                    <strong>#1</strong> Mở đầu
                  </p>
                </div>
                <div className="home-ed-thumb">
                  <div className="home-ed-thumb-media home-ed-thumb-b" />
                  <p>
                    <strong>#2</strong> Nội dung
                  </p>
                </div>
                <div className="home-ed-thumb">
                  <div className="home-ed-thumb-media home-ed-thumb-c" />
                  <p>
                    <strong>#3</strong> Quiz
                  </p>
                </div>
              </aside>

              <section className="home-ed-main">
                <div className="home-ed-stage">
                  <div className="home-ed-stage-bg" />
                  <div className="home-ed-stage-copy">
                    <span className="home-ed-stage-heading">
                      Chương trình đào tạo
                    </span>
                  </div>
                </div>
                <div className="home-ed-field">
                  <span>Tiêu đề</span>
                  <span className="home-ed-field-value">
                    CHƯƠNG TRÌNH ĐÀO TẠO
                  </span>
                </div>
              </section>

              <aside className="home-ed-side">
                <div className="home-ed-side-row">
                  <span className="home-ed-chip">Giọng đọc AI</span>
                </div>
                <div className="home-ed-select">Thùy Trang · Miền Bắc</div>
                <div className="home-ed-script">
                  Chào mừng bạn đến chương trình hội nhập. Trong phần này chúng
                  ta sẽ tìm hiểu chính sách lương thưởng…
                </div>
                <div className="home-ed-meta">
                  <span>0s</span>
                  <span>Chưa gắn audio</span>
                </div>
                <div className="home-ed-generate">Tạo giọng đọc AI</div>
              </aside>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-5.5rem)] max-w-[1200px] flex-col justify-center px-5 pb-16 pt-6 md:px-10 lg:px-14">
          <div className="home-hero-copy max-w-md lg:max-w-lg">
            <p className="home-hero-brand brand-font text-[clamp(2.75rem,8vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-[#0a1f28]">
              ScormCreator
            </p>
            <h1 className="home-hero-line mt-6 max-w-xl text-[clamp(1.35rem,3.2vw,2rem)] font-semibold leading-snug tracking-tight text-[#0a1f28]">
              PowerPoint thành bài giảng SCORM trong vài phút.
            </h1>
            <p className="home-hero-sub mt-4 max-w-md text-base leading-relaxed text-[#3d5a66] md:text-lg">
              Thêm giọng đọc AI, câu hỏi tương tác, rồi xuất gói sẵn cho LMS.
            </p>
            <HomeUploadHero />
          </div>
        </div>
      </section>

      <section
        id="tinh-nang"
        className="home-steps relative scroll-mt-24 border-t border-[#d5e4ea] bg-[#f3f7f9] px-5 py-20 md:px-10 lg:px-14"
      >
        <div className="mx-auto max-w-[1200px]">
          <h2 className="brand-font max-w-md text-3xl font-semibold tracking-tight text-[#0a1f28] md:text-4xl">
            Tính năng
          </h2>
          <p className="mt-3 max-w-lg text-base text-[#3d5a66]">
            Từ file trình chiếu đến gói SCORM — đủ công cụ để hoàn thiện bài học.
          </p>
          <ol className="home-steps-list mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <li className="home-step">
              <span className="home-step-num">01</span>
              <h3 className="mt-4 text-lg font-semibold text-[#0a1f28]">
                Tải PPTX hoặc PDF
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3d5a66]">
                Hệ thống tách slide, ảnh và ghi chú thành dự án có thể chỉnh sửa.
              </p>
            </li>
            <li className="home-step">
              <span className="home-step-num">02</span>
              <h3 className="mt-4 text-lg font-semibold text-[#0a1f28]">
                Giọng đọc AI &amp; quiz
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3d5a66]">
                Tạo audio theo kịch bản, chèn câu hỏi trắc nghiệm hoặc đúng/sai.
              </p>
            </li>
            <li className="home-step">
              <span className="home-step-num">03</span>
              <h3 className="mt-4 text-lg font-semibold text-[#0a1f28]">
                Xuất SCORM
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3d5a66]">
                Tải gói 1.2 hoặc 2004, đưa thẳng lên LMS của tổ chức bạn.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section
        id="bang-gia"
        className="relative scroll-mt-24 border-t border-[#d5e4ea] bg-white px-5 py-20 md:px-10 lg:px-14"
      >
        <div className="mx-auto max-w-[1200px]">
          <h2 className="brand-font max-w-md text-3xl font-semibold tracking-tight text-[#0a1f28] md:text-4xl">
            Bảng giá
          </h2>
          <p className="mt-3 max-w-lg text-base text-[#3d5a66]">
            Chọn gói phù hợp — nâng cấp bất cứ lúc nào từ tài khoản của bạn.
          </p>
          <div className="home-pricing mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className="home-price-card">
                <h3 className="text-lg font-semibold text-[#0a1f28]">
                  {plan.name}
                </h3>
                <p className="mt-3 brand-font text-3xl font-semibold tracking-tight text-[#0a1f28]">
                  {plan.monthlyPrice === 0
                    ? "Miễn phí"
                    : `${plan.monthlyPrice.toLocaleString("vi-VN")}đ`}
                  {plan.monthlyPrice > 0 ? (
                    <span className="ml-1 text-sm font-medium text-[#5b7380]">
                      /tháng
                    </span>
                  ) : null}
                </p>
                <ul className="mt-5 space-y-2 text-sm text-[#3d5a66]">
                  <li>{plan.maxPresentations} trình chiếu</li>
                  <li>{plan.everaiCredits.toLocaleString("vi-VN")} credit AI</li>
                  <li>{plan.maxStudents} học viên</li>
                </ul>
                <Link
                  href={user ? "/account/subscription" : "/signup"}
                  className="home-price-cta"
                >
                  {plan.monthlyPrice === 0 ? "Bắt đầu miễn phí" : "Chọn gói này"}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="relative scroll-mt-24 border-t border-[#d5e4ea] bg-[#f3f7f9] px-5 py-20 md:px-10 lg:px-14"
      >
        <div className="mx-auto max-w-[800px]">
          <h2 className="brand-font text-3xl font-semibold tracking-tight text-[#0a1f28] md:text-4xl">
            Các câu hỏi thường gặp
          </h2>
          <p className="mt-3 text-base text-[#3d5a66]">
            Những câu hỏi hay gặp khi chuyển PPTX thành bài giảng SCORM.
          </p>
          <div className="home-faq mt-10 space-y-3">
            {faqs.map((item, index) => (
              <details
                key={item.id}
                className="home-faq-item"
                open={index === 0}
              >
                <summary>{item.question}</summary>
                <p className="whitespace-pre-wrap">{item.answer}</p>
              </details>
            ))}
            {faqs.length === 0 ? (
              <p className="text-sm text-[#5b7380]">
                Chưa có câu hỏi thường gặp.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d5e4ea] bg-white px-5 py-8 md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="brand-font text-sm font-semibold text-[#0a1f28]">
            ScormCreator
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-[#5b7380]">
            <a href="#bang-gia" className="hover:text-[#0a1f28]">
              Bảng giá
            </a>
            <a href="#tinh-nang" className="hover:text-[#0a1f28]">
              Tính năng
            </a>
            <a href="#faq" className="hover:text-[#0a1f28]">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
