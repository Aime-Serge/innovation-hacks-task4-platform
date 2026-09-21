import { en } from "./en";

// NFR-21: every user-facing string lives in the dictionary; components call
// t(). ESLint (react/jsx-no-literals) fails the build on literal JSX text.

export type MessageKey = keyof typeof en;
type Params = Record<string, string | number>;
type PluralBase = { [K in MessageKey]: K extends `${infer B}.one` ? B : never }[MessageKey];

export function t(key: MessageKey, params?: Params): string {
  const template: string = en[key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Picks `<base>.one` or `<base>.other` and fills in `{count}`. */
export function tCount(base: PluralBase, count: number, params?: Params): string {
  const key = `${base}.${count === 1 ? "one" : "other"}` as MessageKey;
  return t(key, { ...params, count });
}
