# running-atdd-sessions — Loop

The L1-RIGID outer ATDD loop for the developer-agent. Runs
Acceptance Test-Driven Development for a story: write the outer
Acceptance Test first, drive it to RED, then run TDD inner loops
(FE + BE) one sub-slice at a time until the outer test is GREEN.
No implementation code before the outer test is RED. No skipping
sub-slices. No batching FE then BE. This skill overrides everything.

Before each iteration of this loop, `guarding-loops` pre-flight is
REQUIRED.

## Entry Conditions

- A story is in `in-dev` and assigned to the developer-agent (claimed
  via `using-forge` Step 3).
- A feature flag has been created via `managing-feature-flags` and is
  confirmed OFF in test and production.
- The outer Acceptance Test file exists (even if as a skeleton) and is
  RED. If GREEN unexpectedly → STOP, post to Linear, await human.
- `guarding-loops` pre-flight has cleared
  (`stories/[STORY-ID].loop.md` is readable and within budget).

## Loop State Schema

Per-story loop-state file at `stories/[STORY-ID].loop.md`:

- `current_loop` — `delivery`.
- `current_ac` — `AC-[N]` being worked on.
- `current_subslice` — `SS-[M]` being worked on (or `null`).
- `fe_status`, `be_status` — `pending` | `in-progress` | `done`.
- `stall_counter`, `iteration_counter` — integers for budget tracking.
- `last_proof_result` — `pass` | `fail` | `null`.
- `guardian_check` — array of `{ ts, outcome, reason }`.

Story snapshot at `stories/[STORY-ID].md` records sub-slice status
per AC.

## Single Iteration Step

1. Run `guarding-loops` pre-flight (L1-RIGID prerequisite — do not skip).
2. Read `stories/[STORY-ID].loop.md` and `stories/[STORY-ID].md`.
3. For the next AC in order:
   a. Write or update the outer Acceptance Test for this AC; confirm RED.
   b. For each sub-slice in this AC, in order:
      - **FE inner loop:** run `running-tdd-loops` for the FE component
        (component test RED → minimum FE GREEN → refactor GREEN).
      - **BE inner loop:** run `running-tdd-loops` for the BE CDC contract
        (CDC test RED → minimum BE GREEN → refactor GREEN).
      - Update `stories/[STORY-ID].md` sub-slice status to `done` only
        after both FE and BE are GREEN.
      - Do not start the next sub-slice until the current is fully GREEN.
   c. When all sub-slices for this AC are GREEN → outer AT for this AC
      is GREEN.
   d. Commit and push: `git add -A && git commit -m "feat({STORY-ID}): AC{n} — {summary}" && git push`
   e. Trigger `running-desk-checks` (qa-agent); WAIT for desk-check
      approval before the next AC.
4. When all ACs and all desk checks are approved → move story to
   `ready-for-qa` in Linear; commit story snapshot update.
5. Run the iteration completion check from `using-forge`.

## Proof of Progress

- Each iteration produces a recorded outcome on the loop-state file:
  - outer AT for the AC became GREEN, OR
  - a sub-slice FE+BE both became GREEN, OR
  - a git commit was produced for the completed AC, OR
  - a desk-check signal was received and acted on, OR
  - a `guarding-loops` `halted-*` was raised.
- `stories/[STORY-ID].md` sub-slice statuses match the loop-state file.
- `git log --oneline` shows a commit for the current AC.

## State Transition Rule

transition ready-for-dev → in-dev
  trigger story claimed by developer-agent
  handoff managing-feature-flags to devops-agent

transition in-dev → in-dev
  trigger sub-slice work needed
  handoff running-tdd-loops to developer-agent

transition in-dev → ready-for-deskcheck
  trigger outer acceptance test green for current AC
  handoff running-desk-checks to qa-agent

transition in-dev → in-deskcheck
  trigger developer requests QA review per AC
  handoff running-desk-checks to qa-agent

transition in-dev → in-dev
  trigger architecture decision needed
  handoff deciding-architecture to architect-agent

transition ready-for-deskcheck → ready-for-qa
  trigger all ACs and desk checks done
  handoff running-regression-suite to qa-agent

## Halt Conditions

- `guarding-loops` reports `halted-stall`, `halted-iteration-budget`,
  `halted-wall-clock`, `halted-cost`, `halted-human-gate`, or
  `halted-unsafe` → stop; do not advance state.
- Git commit or push fails (e.g., pre-commit hook rejects, network
  error) → halt; fix the issue before continuing.
- Outer AT is unexpectedly GREEN → stop; post to Linear for human
  review; do not proceed.
- An architecture decision is needed mid-sub-slice → stop; post
  `"Architecture decision needed"`; pause the loop until ADR is
  accepted.
- Desk check fails twice on the same AC → halt; raise human gate.
- Feature flag is not OFF → halt; the story is not safely shippable.

## Handoff Target

- Outer AT GREEN for an AC → `running-desk-checks` (qa-agent); returns
  here on approval, routes to fix-and-redo on failure.
- Sub-slice work → `running-tdd-loops` (developer-agent); always
  returns to this loop.
- Architecture decision needed → `deciding-architecture`
  (architect-agent); returns to this loop on ADR accepted.
- All ACs done + all desk checks approved → `running-regression-suite`
  (qa-agent) when story is in `in-qa`.
- Iteration complete → return to `using-forge` Step 3 (Pull next
  story).
