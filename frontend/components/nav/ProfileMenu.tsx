"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCurrentUser } from "@/lib/mock-data";
import { useAsync } from "@/lib/useAsync";

export function ProfileMenu() {
  const { status, data: user } = useAsync(() => fetchCurrentUser(), []);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, close]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2" aria-busy="true" aria-label="Loading profile">
        <span className="h-8 w-8 animate-pulse rounded-full bg-surface" />
        <span className="hidden h-3 w-20 animate-pulse rounded bg-surface sm:block" />
      </div>
    );
  }

  const initials = status === "success" && user ? user.initials : "?";
  const displayName = status === "success" && user ? user.name : "Unknown user";
  const role = status === "success" && user ? user.role : "—";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-surface"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface font-mono text-xs font-semibold text-text-primary"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="hidden text-sm font-medium text-text-primary sm:block">
          {displayName}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute right-0 top-full mt-2 w-56 rounded border border-border-hairline bg-surface p-1 shadow-none"
        >
          <div className="px-3 py-2 border-b border-border-hairline">
            <p className="text-sm font-medium text-text-primary">{displayName}</p>
            <p className="text-xs text-text-secondary">{role}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            className="w-full rounded px-3 py-2 text-left text-sm text-text-secondary hover:bg-canvas hover:text-text-primary"
          >
            Settings
          </button>
          <button
            role="menuitem"
            type="button"
            className="w-full rounded px-3 py-2 text-left text-sm text-text-secondary hover:bg-canvas hover:text-text-primary"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
