"use client";

import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";
import { IconButton } from "@/ui/IconButton";

/** Cycles system -> light -> dark; the label names the current choice. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const icon = theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor";
  return (
    <IconButton
      label={t("theme.toggle", { current: t(`theme.${theme}`), next: t(`theme.${next}`) })}
      onClick={() => setTheme(next)}
    >
      <Icon name={icon} />
    </IconButton>
  );
}
