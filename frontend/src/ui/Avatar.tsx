import { useState } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

type AvatarProps = {
  name: string;
  avatarUrl?: string | null | undefined;
  size?: keyof typeof SIZES;
};

/**
 * The person's photo when they have one, otherwise their initials. Decorative either way: the
 * name is always shown in text next to it. A plain `<img>`, not `next/image` (ADR-426, mirroring
 * Task 1's ADR-018): the source is an https link or an uploaded photo already read to a `data:`
 * URL, and next/image's optimizer cannot be pre-configured for either — a link's host is not
 * known in advance, and a `data:` source is not a remote asset to optimize at all. A photo that
 * fails to load (a dead link, a corrupt upload) falls back to initials instead of a broken-image
 * icon.
 */
export function Avatar({ name, avatarUrl, size = "md" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = typeof avatarUrl === "string" && avatarUrl !== "" && !failed;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        "bg-accent-subtle font-semibold text-accent-fg",
        SIZES[size],
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- ADR-426: https/data: sources.
        <img
          src={avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
