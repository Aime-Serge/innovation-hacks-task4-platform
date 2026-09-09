export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded border border-status-blocked/40 bg-status-blocked/10 px-4 py-3"
    >
      <p className="text-sm text-text-primary">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive"
      >
        Retry
      </button>
    </div>
  );
}
