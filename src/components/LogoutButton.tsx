"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => {
        void fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/");
          router.refresh();
        });
      }}
    >
      Đăng xuất
    </button>
  );
}
