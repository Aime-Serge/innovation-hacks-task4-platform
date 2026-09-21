# AI evaluation (NFR-401, NFR-417, NFR-418, TC-447)

**Status: not yet run.** No live evaluation has been made, so there are no results to report. The numbers below stay empty until you run `make ai-eval` with your provider key.

## How to run it

```bash
export LLM_PROVIDER=gemini LLM_API_KEY=<set-me> LLM_MODEL=<set-me>   # in your shell, never in a file
make ai-eval
```

The harness runs 10 sample projects (a clear brief, a vague brief, two non-English briefs, a project with 50 tasks, an empty project, an adversarial description, an adversarial brief, a mixed-status project and a long description), 50 runs in all, through the real pipeline. Each answer is checked automatically: schema valid, count in range, titles unique against the project, lengths and `dueInDays` in range, latency recorded. It then writes the record below and `docs/ai-evaluation-ratings.csv`.

## Human rating

Open the CSV and score every suggestion from 1 to 5 on relevance, actionability, specificity, sensible priority and no invented facts. The mean of all scores must be 4 or higher (NFR-418). Record the mean in the table, with any defect you found and any change you made to a prompt (a prompt change bumps its version and reruns the AI suites).

## Record

<!-- RESULTS START -->
| Element | Result |
|---|---|
| Date | not yet run |
| Provider and model | not yet run |
| Prompt version | not yet run |
| Runs | not yet run |
| Structured-output validity | not yet run (target 98% or more, NFR-417) |
| Latency p50 / p95 | not yet run (target p95 of 10 s or less, NFR-401) |
| Defects found | not yet run |
| Mean human rating (1 to 5) | not yet run (target 4 or more, NFR-418) |
| Changes made | none |
<!-- RESULTS END -->
