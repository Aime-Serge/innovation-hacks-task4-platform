import { Theme } from "@/schemas";

export const THEME_KEY = "devdash_theme";

/**
 * Runs before first paint (NFR-13): sets data-theme from the stored choice or
 * the OS preference so there is no flash of the wrong theme. Inlined in the
 * <head> with the CSP nonce.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var d=s==="dark"||((s===null||s==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export const readTheme = (): Theme => {
  try {
    const parsed = Theme.safeParse(window.localStorage.getItem(THEME_KEY));
    return parsed.success ? parsed.data : "system";
  } catch {
    return "system";
  }
};

export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;
