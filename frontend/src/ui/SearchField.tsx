"use client";

import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { Icon } from "./Icon";

type SearchFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
};

/** FR-10 / TC-007: the parent sees the value 250ms after typing stops. */
export function SearchField({ id, label, value, onChange, debounceMs = 250 }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);

  // Adopt an external change (e.g. "Clear filters") without an effect.
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(timer);
  }, [draft, value, onChange, debounceMs]);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
      <input
        id={id}
        type="search"
        value={draft}
        placeholder={t("common.search")}
        onChange={(event) => setDraft(event.target.value)}
        className="touch-target h-10 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-sm"
      />
    </div>
  );
}
