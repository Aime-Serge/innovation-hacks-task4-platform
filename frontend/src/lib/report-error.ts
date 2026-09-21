// NFR-20: every client error goes through this one function, so the sink can
// be swapped (Sentry, an API endpoint) without touching call sites. Details go
// here, never onto the screen (TH-07).

export type ErrorReport = {
  error: unknown;
  context: string;
};

export type ErrorReporter = (report: ErrorReport) => void;

const consoleReporter: ErrorReporter = ({ error, context }) => {
  console.error(`[${context}]`, error);
};

let reporter: ErrorReporter = consoleReporter;

export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

export function reportError(error: unknown, context: string): void {
  reporter({ error, context });
}
