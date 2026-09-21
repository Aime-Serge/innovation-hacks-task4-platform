"use client";

import { useTheme } from "@/providers/ThemeProvider";
import { resolveTheme } from "@/providers/theme";
import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";
import { IconButton } from "@/ui/IconButton";

/** Flips between light and dark from the header; the label names the theme it switches to. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = resolveTheme(theme) === "dark";
  return (
    <IconButton
      label={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon name={isDark ? "sun" : "moon"} />
    </IconButton>
  );
}
