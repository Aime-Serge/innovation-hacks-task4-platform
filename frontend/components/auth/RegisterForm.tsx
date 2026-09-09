"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { FormField } from "@/components/shared/FormField";

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function validate(): boolean {
    let ok = true;
    setPasswordError(null);
    setEmailError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      ok = false;
    } else if (password !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      ok = false;
    }
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register(name, email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEmailError("An account with this email already exists.");
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-sm text-text-primary"
        >
          {formError}
        </div>
      )}
      <FormField id="name" label="Name" value={name} onChange={setName} required autoComplete="name" />
      <FormField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        required
        autoComplete="email"
        error={emailError ?? undefined}
      />
      {emailError && (
        <p className="text-xs text-text-secondary">
          <Link href="/login" className="text-interactive hover:underline">
            Log in instead?
          </Link>
        </p>
      )}
      <FormField
        id="password"
        label="Password"
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
        label="Confirm password"
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
        {submitting ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="text-interactive hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
