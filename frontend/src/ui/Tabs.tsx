"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tab = { id: string; label: string; content: ReactNode };

type TabsProps = { tabs: Tab[]; active: string; onChange: (id: string) => void; label: string };

/** MF-12: a small, fully keyboard-operable tab list (arrow keys move focus and selection). */
export function Tabs({ tabs, active, onChange, label }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (from: number, delta: number) => {
    const next = tabs[(from + delta + tabs.length) % tabs.length];
    if (next === undefined) return;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-4 flex gap-1 border-b border-line">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") move(index, 1);
              else if (event.key === "ArrowLeft") move(index, -1);
              else return;
              event.preventDefault();
            }}
            className={cn(
              "touch-target border-b-2 px-3 text-sm font-medium",
              tab.id === active
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.id === active && tab.content}
        </div>
      ))}
    </div>
  );
}
