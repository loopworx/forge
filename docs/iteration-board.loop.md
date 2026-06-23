---
kind: iteration_board
active_iteration: 0
iteration_0_status: pending
awaiting_human_gate: null
all_stories_done: false
---

# Iteration Board Loop State

Operational state for the iteration board loop. Updated by po-agent on every
iteration completion. Read by `loop-guardian` and `using-forge` to determine
whether agents may continue pulling work.

## Fields

| Field | Meaning |
|---|---|
| `active_iteration` | Numeric iteration currently open (0 = Iteration Zero, 1+ = delivery iterations). |
| `iteration_0_status` | One of: `pending`, `in_progress`, `complete`, `blocked`. |
| `awaiting_human_gate` | ID of the human gate currently blocking the loop, or `null` if none. |
| `all_stories_done` | `true` when every story in the active iteration has reached `done`. |

## State transitions

```
pending
  └→ bootstrap starts → in_progress
in_progress
  └→ harness validated → complete
complete
  └→ Iteration 1 opens → active_iteration = 1
```

## Iteration completion

When `all_stories_done` becomes `true`:

1. po-agent posts completion notice on the Linear milestone
2. All agents idle
3. Human reviews
4. Human triggers next iteration by activating the next Cycle
