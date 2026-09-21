"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";
import { Input } from "@/ui/Input";

const TYPING = /^(input|textarea|select)$/i;

/** Header search: "/" focuses it from anywhere; Enter searches the task list. */
export function HeaderSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target !== null && (TYPING.test(target.tagName) || target.isContentEditable)) return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const q = value.trim();
    router.push(q === "" ? "/tasks" : `/tasks?q=${encodeURIComponent(q)}`);
  };

  return (
    <form role="search" onSubmit={submit} className="relative hidden md:block">
      <Icon
        name="search"
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
      <Input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={t("layout.search")}
        placeholder={t("layout.searchPlaceholder")}
        className="h-9 w-56 pl-8 lg:w-72"
      />
    </form>
  );
}
