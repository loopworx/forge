# Linear Board State — Bookshelve Iteration 1

> Snapshot at: mid-delivery, story BS-01 in-dev
> Produced by: `using-forge` pull protocol

---

## Cycle: Iteration 1

| Story | Title | Status | Assigned | ACs | Notes |
|---|---|---|---|---|---|
| BS-01 | Save a book from search results | in-dev | developer-agent-1 | 4 | AC-1 done, AC-2 in-progress |
| BS-02 | View reading list | ready-for-dev | — | 3 | Depends on BS-01 |
| BS-03 | Mark a book as read | ready-for-dev | — | 2 | Depends on BS-02 |

## Kanban Stage Reference

| Stage | Meaning | Who acts |
|---|---|---|
| `in-analysis` | Story drafted, not yet refined | po-agent |
| `ready-for-dev` | Locked, ready to pull | developer-agent (pull) |
| `in-dev` | ATDD loop running | developer-agent |
| `ready-for-qa` | All ACs + desk checks done | qa-agent (pull) |
| `in-qa` | Regression suite running | qa-agent |
| `ready-for-acceptance` | QA passed | po-agent (pull) |
| `in-acceptance` | PO verifying | po-agent |
| `ready-to-deploy` | PO approved, awaiting human | Human gate |
| `done` | Deployed, flag live | — |

---

## Two Linear Boards

**Board 1 — Roadmap/Projects**
One Project per iteration. Shows the iteration map: what's in scope, dependencies, parallel tracks.

```
Project: Iteration 1
  ├ BS-01: Save a book (no dependencies)
  ├ BS-02: View reading list (depends on BS-01)
  └ BS-03: Mark as read (depends on BS-02)

Project: Iteration 2
  ├ BS-04: Remove a book from list
  └ BS-05: View read shelf
```

**Board 2 — Cycle (active delivery)**
All active stories across all agents as a Kanban. This is what agents query at session start to find their state.
