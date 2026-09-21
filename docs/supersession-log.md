# Supersession log

Every earlier test or rule changed by Task 4, with the old assertion, the new one and the reason (pack section 1, TC-463).

| Date | Test or rule | Old assertion | New assertion | Reason |
|---|---|---|---|---|
| 2026-09-21 | Task 3 `test_tc322_missing_secret_stops_startup_and_names_the_variable` | The startup error names `SECRET_KEY` | The startup error names `JWT_SECRET` (both variables are unset first) | ADR-418, the pack's variable name. Not one of S1 to S8; recorded as a deviation. |
| 2026-09-21 | Task 3 test settings helper and `test_fr321_the_seed_command_refuses_production_and_an_unconfirmed_reset` | Production settings needed no AI settings | Production settings name a live provider, key and model | FR-427: production refuses the fake provider. The tests still prove what they proved before. |
