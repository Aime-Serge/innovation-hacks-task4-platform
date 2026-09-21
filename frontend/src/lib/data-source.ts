// Which adapter serves the app (S8, ADR-401). The real one, through the server layer, is the
// default and the only one production builds use; "mock" is kept for tests and the Task 1 scenarios.
export type DataSource = "http" | "mock";

export function dataSource(): DataSource {
  return process.env["NEXT_PUBLIC_DATA_SOURCE"] === "mock" ? "mock" : "http";
}
