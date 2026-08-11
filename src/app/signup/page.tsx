import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(124,196,232,0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(43,182,115,0.22), transparent 50%), linear-gradient(165deg, #0f2a36 0%, #163848 45%, #1c4a3a 100%)",
        }}
      />
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="brand-font text-lg font-semibold tracking-tight"
          style={{ color: "#edf3f7" }}
        >
          ScormCreator
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur"
          style={{ color: "#edf3f7" }}
        >
          Đăng nhập
        </Link>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 pb-16">
        <AuthForm mode="signup" nextPath="/dashboard" />
      </section>
    </main>
  );
}
