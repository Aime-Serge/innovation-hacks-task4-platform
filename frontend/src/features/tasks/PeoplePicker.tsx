"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DISCIPLINES } from "@/generated/profile-lists";
import { t, tCount } from "@/i18n";
import type { User } from "@/schemas";
import { Avatar } from "@/ui/Avatar";
import { Icon } from "@/ui/Icon";
import { usePeopleSearch } from "../data/hooks";

function summaryOf(user: User): string | null {
  const p = user.profile;
  if (p === null) return null;
  const discipline = DISCIPLINES.find((d) => d.value === p.discipline)?.label ?? p.discipline;
  return p.companyName !== null ? `${discipline} · ${p.companyName}` : discipline;
}

export type PeoplePickerProps = {
  id: string;
  value: string | null;
  /** So the current value has a name to show without waiting on a search. */
  knownUsers: readonly User[];
  onChange: (id: string | null) => void;
};

/** MF-11: a keyboard-operable combobox; results respect the privacy switch (server-side). */
export function PeoplePicker({ id, value, knownUsers, onChange }: PeoplePickerProps) {
  const selected = value === null ? null : (knownUsers.find((u) => u.id === value) ?? null);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [debounced, setDebounced] = useState(query);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const search = usePeopleSearch(debounced);
  const results = useMemo(() => search.data ?? [], [search.data]);

  useEffect(() => {
    function onClickAway(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const choose = (user: User) => {
    onChange(user.id);
    setQuery(user.name);
    setOpen(false);
    setActiveIndex(-1);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const chosen = results[activeIndex];
      if (open && chosen !== undefined) {
        event.preventDefault();
        choose(chosen);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  const showHint = debounced.trim().length < 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          className="touch-target h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-fg"
          placeholder={t("people.picker.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value !== null && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("people.picker.clear")}
            className="touch-target rounded-md border border-line-strong px-2"
          >
            <Icon name="x" />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{showHint ? t("people.picker.hint") : null}</p>
      <div aria-live="polite" className="sr-only">
        {!showHint && !search.isPending
          ? results.length === 0
            ? t("people.picker.noResults")
            : tCount("people.picker.resultsCount", results.length)
          : null}
      </div>
      {open && !showHint && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t("people.picker.label")}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface shadow-md"
        >
          {results.length === 0 && !search.isPending ? (
            <li className="px-3 py-2 text-sm text-muted">{t("people.picker.noResults")}</li>
          ) : (
            results.map((user, index) => (
              <li
                key={user.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(user);
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                  index === activeIndex ? "bg-subtle" : ""
                }`}
              >
                <Avatar name={user.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate">{user.name}</span>
                  {summaryOf(user) !== null && (
                    <span className="block truncate text-xs text-muted">{summaryOf(user)}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
