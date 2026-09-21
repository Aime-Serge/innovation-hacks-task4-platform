# ADR-323: text sorts compare code points, not the database locale

**Status:** Accepted.

Task 2 sorts by `name.lower()` and `title.lower()`, which compares Unicode code points. PostgreSQL's default collation compares by locale rules, so the same data would sort differently. Sorts on names, titles and emails use `lower(x) COLLATE "C"`, which is code-point order, and a differential test (TC-340) compares 200 random queries across both backends.
