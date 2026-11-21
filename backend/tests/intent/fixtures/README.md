# Synthetic intent fixtures

These two JSON files are **synthetic test fixtures**, not real `encode/httpx`
history.

They exist only to exercise the intent-extraction and evaluation pipeline with
a small, exact corpus. The PR numbers, commit SHAs, dates, authors and bodies
in these files were invented for that test harness. Several of them do not
match the real records they appear to name. Do not cite them in a demo, a
report or any user-facing answer.

The judge-facing retrieval demo has its own corpus in
`backend/app/retrieval/demo/data.py`, which is grounded in real `encode/httpx`
records and is covered by `backend/tests/retrieval/test_demo.py`.

The fixture cases in `app/intent/evaluation/golden/decisions.jsonl` with
`corpus: "fixture"` are therefore labelled synthetic in the documentation and
must not be mixed with the public `encode/httpx` golden cases.
