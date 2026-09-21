# ADR-324: a window count returns a page and its total in one query

**Status:** Accepted.

The pack counts a list's total with a second query. With the token's user lookup that makes four queries for a project list (user, page, count, progress), and NFR-304 allows three. `count(*) OVER ()` returns the total with every row, so a list costs one query. Only a page past the end has no row to carry it, and then a count query runs. A test counts the statements for every list endpoint at page sizes 1, 20 and 100 and requires the same number, at most three, each time (TC-392).
