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
    <main className="home-page min-h-screen">
      <header className="home-nav relative z-20 flex items-center justify-between px-5 py-5 md:px-10 lg:px-14">
        <p className="brand-font text-[15px] font-semibold tracking-tight text-[#0a1f28]">
          ScormCreator
        </p>
        <nav className="flex items-center gap-2 sm:gap-3">
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
        </nav>
      </header>

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

      <section className="home-steps relative border-t border-[#d5e4ea] bg-[#f3f7f9] px-5 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="brand-font max-w-md text-3xl font-semibold tracking-tight text-[#0a1f28] md:text-4xl">
            Ba bước. Xong bài học.
          </h2>
          <p className="mt-3 max-w-lg text-base text-[#3d5a66]">
            Không cần công cụ tác giả phức tạp — bắt đầu từ file bạn đã có.
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
                Gắn giọng đọc &amp; quiz
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3d5a66]">
                Tạo audio AI theo kịch bản, chèn câu hỏi trắc nghiệm hoặc đúng/sai.
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

      <footer className="border-t border-[#d5e4ea] bg-white px-5 py-8 md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="brand-font text-sm font-semibold text-[#0a1f28]">
            ScormCreator
          </p>
          <p className="text-sm text-[#5b7380]">
            PPTX &amp; PDF → SCORM có audio và quiz.
          </p>
        </div>
      </footer>
    </main>
  );
}
