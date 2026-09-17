"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  changePassword,
  deleteAccount,
  deleteAvatar,
  updateProfile,
  uploadAvatar,
} from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { FormField } from "@/components/shared/FormField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Avatar } from "@/components/nav/ProfileMenu";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-border-hairline bg-surface p-5">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AvatarSection() {
  const { user: maybeUser, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!maybeUser) return null;
  const user = maybeUser;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadAvatar(user.id, file);
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError(null);
    try {
      const updated = await deleteAvatar(user.id);
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SectionCard title="Avatar" description="PNG, JPEG, or WebP, up to 500 KB.">
      <div className="flex items-center gap-4">
        <Avatar userId={user.id} hasAvatar={user.hasAvatar} initials={user.initials} size={64} />
        <div className="flex flex-col gap-2">
          {error && <p className="text-sm text-status-blocked">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload new"}
            </button>
            {user.hasAvatar && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-status-blocked hover:border-status-blocked disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload avatar"
        />
      </div>
    </SectionCard>
  );
}

function ProfileSection() {
  const { user: maybeUser, setUser } = useAuth();
  const [name, setName] = useState(maybeUser?.name ?? "");
  const [email, setEmail] = useState(maybeUser?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!maybeUser) return null;
  const user = maybeUser;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile(user.id, { name, email });
      setUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Profile">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="text-sm text-status-blocked">{error}</p>}
        {saved && !error && <p className="text-sm text-status-done">Saved.</p>}
        <FormField id="settings-name" label="Name" value={name} onChange={setName} required />
        <FormField
          id="settings-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <div>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            className="rounded bg-interactive px-4 py-2 text-sm font-medium text-canvas disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

function ChangePasswordSection() {
  const { user: maybeUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!maybeUser) return null;
  const user = maybeUser;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(user.id, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Change password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="text-sm text-status-blocked">{error}</p>}
        {saved && !error && <p className="text-sm text-status-done">Password changed.</p>}
        <FormField
          id="current-password"
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          required
          autoComplete="current-password"
        />
        <FormField
          id="new-password"
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <FormField
          id="confirm-new-password"
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          autoComplete="new-password"
        />
        <div>
          <button
            type="submit"
            disabled={submitting || !currentPassword || !newPassword}
            className="rounded bg-interactive px-4 py-2 text-sm font-medium text-canvas disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

function DeleteAccountSection() {
  const { user: maybeUser, logout } = useAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  if (!maybeUser) return null;
  const user = maybeUser;

  return (
    <SectionCard
      title="Delete account"
      description="Permanently deletes your account, projects, and tasks. This can't be undone."
    >
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-status-blocked px-3 py-1.5 text-sm font-medium text-status-blocked hover:bg-status-blocked/10"
      >
        Delete my account
      </button>

      {confirming && (
        <ConfirmDialog
          title="Delete account"
          message={`Delete your account "${user.email}" and everything in it? This can't be undone.`}
          confirmLabel="Delete account"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await deleteAccount(user.id);
            // The session cookie now names a user that no longer exists —
            // clear client state and land on login rather than relying on
            // the next authenticated request to discover that itself.
            await logout().catch(() => undefined);
            router.push("/login");
          }}
        />
      )}
    </SectionCard>
  );
}

export function SettingsView() {
  // Gate on auth status rather than letting each section handle "user
  // is still null" itself: AuthProvider's fetchCurrentUser() is async,
  // so on a fresh page load these sections would otherwise mount once
  // with user === null before it resolves. That's fine for sections
  // with no local state seeded from user, but ProfileSection's
  // useState(user.name) initializer only runs on a component's *first*
  // mount — if that first mount happens while user is still null, the
  // name/email fields would stay stuck empty forever, even after the
  // real user data arrives moments later. Mounting these sections only
  // once status is "authenticated" guarantees their first mount already
  // has real data.
  const { status } = useAuth();

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading settings">
        <div className="h-8 w-32 animate-pulse rounded bg-surface" />
        <div className="mt-6 flex flex-col gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded border border-border-hairline bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
      <p className="mt-1 text-sm text-text-secondary">Manage your profile and account.</p>
      <div className="mt-6 flex flex-col gap-5">
        <AvatarSection />
        <ProfileSection />
        <ChangePasswordSection />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
