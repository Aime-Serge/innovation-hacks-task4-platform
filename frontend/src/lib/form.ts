/** A text field from a submitted form; missing or file values read as "". */
export function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
