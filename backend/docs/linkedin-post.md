# LinkedIn post draft: Task 2

Post this once the demo video is recorded. Tag Innovation Hacks with LinkedIn's own @-mention: typed
text does not create a real tag. Select their page from the dropdown, and confirm it is their
official page first.

## Post copy

> Task 2 of my Full Stack Development Internship with @Innovation Hacks: a REST API for users, projects and tasks, built to an engineering standards pack instead of "it works on my machine".
>
> What I'm proud of:
> - Business rules live on the server: a task can't skip from To Do to Done, a project with tasks can't be deleted, the last lead can't be removed. Each rule has a test that names it.
> - One error shape for everything, including 404s and bad JSON, with a request id you can trace in the logs.
> - The architecture is enforced by a tool (import-linter): routers can't touch storage and services can't import FastAPI. The build fails if someone tries.
> - Contract tested with Schemathesis across all 23 operations, plus a Postman collection under Newman. Testing them found real bugs: a schema that promised inputs the server rejected, and a 405 that hid half the allowed methods.
> - Load tested with Locust on 500 tasks: worst p95 89 ms on my machine, no failed requests.
>
> What I'm being straight about: data is in memory and resets on restart, and the rate limiter is per process. Both are written up in the README, and Task 3 adds the database.
>
> Stack: Python 3.12, FastAPI, Pydantic v2, argon2, JWT, mypy strict, pytest, Schemathesis, Locust, Docker.
>
> Repo and demo in the comments. #FullStackDevelopment #FastAPI #Python #BackendDevelopment #InnovationHacks #Internship

## Before you post

- [ ] Demo video recorded (see `DEMO_SCRIPT.md`) and attached
- [ ] Re-run `make gate` and edit any number above to what you saw (the p95 figure is from one run)
- [ ] Repo pushed; add the repo and live links as the first comment
- [ ] Innovation Hacks tagged through the mention dropdown

## First comment

Repo: _add the GitHub link_
Live docs: https://ih-task2-api.onrender.com/docs (the demo instance is seeded and resets on restart)
Demo: _add after recording_
