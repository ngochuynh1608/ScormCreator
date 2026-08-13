"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** Kebab menu portaled to body so overflow on table wrappers cannot clip it. */
export function AdminActionsMenu({
  busy = false,
  children,
}: {
  busy?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function placeMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  function close() {
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    placeMenu();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      placeMenu();
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

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, right: menuPos.right }}
            className="admin-actions-panel is-portal"
          >
            {children(close)}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="admin-actions-menu">
      <button
        type="button"
        ref={btnRef}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Thao tác"
        className="admin-actions-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <KebabIcon />
      </button>
      {menu}
    </div>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
