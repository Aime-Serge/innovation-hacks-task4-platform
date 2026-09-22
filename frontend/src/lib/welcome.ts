// MF-05: a session-only flag (no secrets) so the dashboard shows the welcome banner exactly
// once, right after registration signs the person in.
export const WELCOME_FLAG = "devdash_show_welcome";

export function consumeWelcomeFlag(): boolean {
  try {
    const shown = window.sessionStorage.getItem(WELCOME_FLAG) === "1";
    if (shown) window.sessionStorage.removeItem(WELCOME_FLAG);
    return shown;
  } catch {
    return false;
  }
}

export function setWelcomeFlag(): void {
  try {
    window.sessionStorage.setItem(WELCOME_FLAG, "1");
  } catch {
    // Storage blocked: the banner simply will not show once. Not a failure of registration.
  }
}
