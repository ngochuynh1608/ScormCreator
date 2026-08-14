"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function CreditBalanceButton({
  creditsAvailable,
}: {
  creditsAvailable: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  function place() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (tipRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      place();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const tip =
    open && pos
      ? createPortal(
          <div
            ref={tipRef}
            role="dialog"
            aria-labelledby="credit-tip-title"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-[100] w-[220px] overflow-hidden rounded-2xl border border-[#dfe7ef] bg-white p-3.5 shadow-lg"
          >
            <p
              id="credit-tip-title"
              className="text-sm font-semibold leading-5 text-[#0f2a36]"
            >
              Credit dùng để tạo giọng đọc AI
            </p>
            <Link
              href="/account/payments"
              className="mt-3 inline-flex h-8 items-center justify-center rounded-full bg-[#2bb673] px-3.5 text-xs font-bold text-[#083024]"
              onClick={() => setOpen(false)}
            >
              Nạp thêm
            </Link>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[#c9d8e2] bg-white px-3 text-sm font-bold leading-none text-[#0f2a36]"
      >
        <CreditCoinIcon />
        {creditsAvailable.toLocaleString("vi-VN")}
      </button>
      {tip}
    </div>
  );
}

function CreditCoinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="text-[#2bb673]"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.2 8.6c-.5-.4-1.2-.6-2.2-.6-1.8 0-3 1-3 2.3 0 1.1.8 1.8 2.6 2.2l.8.2c1.2.3 1.6.6 1.6 1.2 0 .7-.7 1.2-1.9 1.2-1 0-1.7-.3-2.3-.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 7.2v1.4M12 15.4v1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
