/** Exhaustiveness check for unions: a new member becomes a compile error. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(value)}`);
}
