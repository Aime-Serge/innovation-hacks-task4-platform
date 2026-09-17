import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-text-primary">Reset your password</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Enter your account&rsquo;s email and we&rsquo;ll get you a reset link.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
