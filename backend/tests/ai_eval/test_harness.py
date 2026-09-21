"""TC-447: the evaluation harness works, and never passes off the fake provider as a result."""

import asyncio
import csv
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import ai_eval


def suggestion(title: str = "Do it", description: str = "", due: int | None = 3) -> SimpleNamespace:
    return SimpleNamespace(title=title, description=description, due_in_days=due)


def test_tc447_the_checks_catch_every_defect_they_name() -> None:
    assert ai_eval.check([suggestion("A"), suggestion("B")], 5, set()) == []
    assert "count 0 outside 1 to 5" in ai_eval.check([], 5, set())
    assert any(
        "outside" in p for p in ai_eval.check([suggestion(f"T{n}") for n in range(6)], 5, set())
    )
    assert "duplicate titles in the answer" in ai_eval.check(
        [suggestion("A"), suggestion(" a ")], 5, set()
    )
    assert "a title repeats an existing task" in ai_eval.check([suggestion("Ship")], 5, {"ship"})
    assert "a length is out of range" in ai_eval.check([suggestion("x" * 121)], 5, set())
    assert "a length is out of range" in ai_eval.check([suggestion("A", "d" * 501)], 5, set())
    assert "dueInDays out of range" in ai_eval.check([suggestion("A", due=91)], 5, set())
    assert "dueInDays out of range" in ai_eval.check([suggestion("A", due=-1)], 5, set())


def test_tc447_the_sample_set_covers_what_the_pack_asks_for() -> None:
    keys = {s.key for s in ai_eval.SAMPLES}
    assert len(ai_eval.SAMPLES) == 10
    assert {"vague", "french", "empty", "fifty-tasks"} <= keys
    assert any(k.startswith("adversarial") for k in keys)
    assert len(next(s for s in ai_eval.SAMPLES if s.key == "fifty-tasks").existing) == 50


def test_tc447_a_fake_run_validates_the_harness_and_writes_nothing(
    capsys: pytest.CaptureFixture[str],
) -> None:
    before = ai_eval.DOC.read_bytes()
    assert ai_eval.main(["--provider", "fake", "--runs", "10"]) == 0
    assert "validates the harness only" in capsys.readouterr().out
    assert ai_eval.DOC.read_bytes() == before


def test_tc447_every_sample_runs_and_the_summary_is_computed() -> None:
    results, settings = asyncio.run(ai_eval.evaluate("fake", 20, 5))
    assert {r.sample for r in results} == {s.key for s in ai_eval.SAMPLES}
    summary = ai_eval.summarise(results)
    assert (summary["runs"], summary["valid"], summary["validity"]) == (20, 20, 100.0)
    assert summary["p95"] >= summary["p50"] >= 0
    assert settings.llm_provider == "fake"


def test_tc447_a_written_record_keeps_the_rating_open(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    doc, ratings = tmp_path / "eval.md", tmp_path / "ratings.csv"
    doc.write_text(f"intro\n{ai_eval.START}\nold\n{ai_eval.END}\nkeep me\n")
    monkeypatch.setattr(ai_eval, "DOC", doc)
    monkeypatch.setattr(ai_eval, "RATINGS", ratings)
    results, settings = asyncio.run(ai_eval.evaluate("fake", 10, 3))
    ai_eval.write_outputs(ai_eval.summarise(results), settings, results)
    text = doc.read_text()
    assert text.startswith("intro")
    assert text.endswith("keep me\n")
    assert "not yet rated" in text  # the human rating is never invented
    assert "10 of 10" in text
    assert "old" not in text
    rows = list(csv.reader(ratings.open()))
    assert rows[0][:3] == ["sample", "run", "title"]
    assert all(r[3:] == ["", "", "", "", ""] for r in rows[1:])
    assert len(rows) > 10


def test_tc447_the_committed_record_says_not_yet_run_until_a_live_run_replaces_it() -> None:
    text = ai_eval.DOC.read_text()
    assert ai_eval.START in text
    assert ai_eval.END in text
    inside = text.split(ai_eval.START)[1].split(ai_eval.END)[0]
    assert "not yet run" in inside or "Structured-output validity | " in inside
    if "not yet run" in inside:
        assert "Structured-output validity | not yet run" in inside  # no invented figure
