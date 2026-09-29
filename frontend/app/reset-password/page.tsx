import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-text-primary">Choose a new password</h1>
      <div className="mt-6">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
