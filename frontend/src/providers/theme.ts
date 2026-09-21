import { Theme } from "@/schemas";

export const THEME_KEY = "devdash_theme";

/**
 * Runs before first paint (NFR-13): sets data-theme from the stored choice (dark by
 * default) so there is no flash of the wrong theme. Inlined in the
 * <head> with the CSP nonce.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=s==="light"?"light":"dark";}catch(e){}})();`;

export const readTheme = (): Theme => {
  try {
    const parsed = Theme.safeParse(window.localStorage.getItem(THEME_KEY));
    return parsed.success && parsed.data !== "system" ? parsed.data : "dark";
  } catch {
    return "dark";
  }
};

export const resolveTheme = (theme: Theme): "light" | "dark" => (theme === "light" ? "light" : "dark");

/** The two themes a person can pick; "system" stays in the API schema only. */
export const THEME_CHOICES = ["light", "dark"] as const;
