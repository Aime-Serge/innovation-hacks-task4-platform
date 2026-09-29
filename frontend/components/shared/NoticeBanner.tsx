export function NoticeBanner({ message }: { message: string }) {
  return (
    <p className="rounded border border-border-hairline bg-canvas px-3 py-2 text-xs text-text-secondary">
      {message}
    </p>
  );
}
