import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-text-primary">Create your account</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Start tracking projects and tasks.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </div>
  );
}
