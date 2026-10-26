// What every playground shares: the light or dark look (one choice for all
// of them, kept in the browser), the theme button, and SilverBullet's
// notifications (editor.flashNotification) in short.

const THEME_KEY = "silverwarePlayground.theme";

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A private window: the choice holds for this visit
  }
}

function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  save(THEME_KEY, theme);
}

/** The look as last chosen (else the system's), and the header's #theme button switching it */
export function setUpTheme(): void {
  applyTheme(load(THEME_KEY) ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  document.querySelector("#theme")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}

/** A notification under the top bar (#flash), for a few seconds; as SilverBullet's, `timeout` 0 keeps it until it is clicked */
export function flash(message: string, type: "info" | "error" = "info", options: { readonly timeout?: number } = {}): void {
  const note = document.createElement("div");
  note.textContent = message;
  if (type === "error") note.className = "error";
  document.querySelector("#flash")?.append(note);
  if (options.timeout === 0) note.addEventListener("click", () => note.remove());
  else window.setTimeout(() => note.remove(), options.timeout ?? 3000);
}
