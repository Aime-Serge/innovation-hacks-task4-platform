"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { avatarUrl } from "@/lib/auth";

export function Avatar({
  userId,
  hasAvatar,
  initials,
  size = 32,
}: {
  userId: string;
  hasAvatar: boolean;
  initials: string;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = hasAvatar && !imageFailed;
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-mono text-xs font-semibold text-text-primary"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {showImage ? (
        // Plain <img>, not next/image — the source is a cross-origin
        // backend URL in production, which would need remote-pattern
        // config for zero real benefit on an image this small.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl(userId)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

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
        <Avatar userId={user.id} hasAvatar={user.hasAvatar} initials={user.initials} />
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
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="block w-full rounded px-3 py-2 text-left text-sm text-text-secondary hover:bg-canvas hover:text-text-primary"
          >
            Settings
          </Link>
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
