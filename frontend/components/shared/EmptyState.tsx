export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded border border-dashed border-border-hairline px-4 py-8 text-center">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
