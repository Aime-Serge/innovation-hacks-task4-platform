"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { FormField } from "@/components/shared/FormField";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div
        role="alert"
        className="rounded border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-sm text-text-primary"
      >
        This link is missing its reset token. Request a new one from{" "}
        <Link href="/forgot-password" className="underline hover:no-underline">
          the forgot-password page
        </Link>
        .
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Your password has been reset. You can log in with it now.
        </p>
        <Link
          href="/login"
          className="rounded bg-interactive px-4 py-2 text-center text-sm font-medium text-canvas"
        >
          Log in
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? "This reset link is invalid or has expired. Request a new one below."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && (
        <div className="flex flex-col gap-2">
          <div
            role="alert"
            className="rounded border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-sm text-text-primary"
          >
            {error}
          </div>
          <Link href="/forgot-password" className="text-sm text-interactive underline hover:no-underline">
            Request a new reset link
          </Link>
        </div>
      )}
      <FormField
        id="password"
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        error={passwordError ?? undefined}
      />
      <FormField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        required
        autoComplete="new-password"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-interactive px-4 py-2 text-sm font-medium text-canvas disabled:opacity-60"
      >
        {submitting ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
