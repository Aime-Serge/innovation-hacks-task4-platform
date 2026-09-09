"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { FormField } from "@/components/shared/FormField";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.push(searchParams.get("next") || "/");
    } catch (err) {
      // Deliberately generic — matches the backend's constant-shape 401,
      // never says which of email/password was wrong.
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
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
      <FormField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        required
        autoComplete="current-password"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-interactive px-4 py-2 text-sm font-medium text-canvas disabled:opacity-60"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>
      <p className="text-sm text-text-secondary">
        No account?{" "}
        <Link href="/register" className="text-interactive hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
