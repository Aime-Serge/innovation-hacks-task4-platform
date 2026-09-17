"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { FormField } from "@/components/shared/FormField";
import { NoticeBanner } from "@/components/shared/NoticeBanner";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; devResetUrl: string | null } | null>(
    null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await forgotPassword(email);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{result.message}</p>
        {result.devResetUrl ? (
          <NoticeBanner message="Dev mode: this build has no email provider wired up, so here's the reset link directly instead of emailing it." />
        ) : null}
        {result.devResetUrl && (
          <Link
            href={result.devResetUrl.replace(/^https?:\/\/[^/]+/, "")}
            className="break-all rounded border border-border-hairline bg-surface px-3 py-2 text-sm text-interactive underline hover:no-underline"
          >
            {result.devResetUrl}
          </Link>
        )}
        <p className="text-sm text-text-secondary">
          <Link href="/login" className="text-interactive underline hover:no-underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-sm text-text-primary"
        >
          {error}
        </div>
      )}
      <FormField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        required
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="rounded bg-interactive px-4 py-2 text-sm font-medium text-canvas disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-sm text-text-secondary">
        <Link href="/login" className="text-interactive underline hover:no-underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
