"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { replaceUrl } from "@/lib/navigation";

/** Create-dialog state that also opens from ?new=1 (the header "+" menu); closing drops the flag. */
export function useCreateIntent() {
  const params = useSearchParams();
  const pathname = usePathname();
  const requested = params.get("new") === "1";
  const [local, setLocal] = useState(false);
  const serialized = params.toString();

  const setCreating = useCallback(
    (open: boolean) => {
      setLocal(open);
      if (open || !requested) return;
      const next = new URLSearchParams(serialized);
      next.delete("new");
      const query = next.toString();
      replaceUrl(query === "" ? pathname : `${pathname}?${query}`);
    },
    [requested, serialized, pathname],
  );

  return [local || requested, setCreating] as const;
}
