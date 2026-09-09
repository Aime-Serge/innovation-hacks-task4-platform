"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export function ProfileMenu() {
  const { user, status, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2" aria-busy="true" aria-label="Loading profile">
        <span className="h-8 w-8 animate-pulse rounded-full bg-surface" />
        <span className="hidden h-3 w-20 animate-pulse rounded bg-surface sm:block" />
      </div>
    );
  }

  if (!user) return null;

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
          {user.initials}
        </span>
        <span className="hidden text-sm font-medium text-text-primary sm:block">
          {user.name}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute right-0 top-full mt-2 w-56 rounded border border-border-hairline bg-surface p-1 shadow-none"
        >
          <div className="px-3 py-2 border-b border-border-hairline">
            <p className="text-sm font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-secondary">{user.email}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            disabled={loggingOut}
            onClick={handleSignOut}
            className="w-full rounded px-3 py-2 text-left text-sm text-text-secondary hover:bg-canvas hover:text-text-primary disabled:opacity-60"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
