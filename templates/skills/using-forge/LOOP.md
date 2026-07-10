# using-forge — Loop

This is the L1-RIGID conductor loop. It runs every session start, before any
other skill may fire, and governs session-wide precedence, agent role
boundaries, the pull protocol, and the iteration completion check.
Before each iteration of this loop, `guarding-loops` pre-flight is REQUIRED.

## Entry Conditions

- A Forge session has started (new session, new project, or resumed session).
- The agent has not yet read plan files or conversation summaries.
- `guarding-loops` pre-flight has cleared the current iteration.

## Loop State Schema

Operational state read from:

- `docs/inception.loop.md` (kind: `inception`, fields: `current_phase`,
  `completed_artifacts`, `pending_approvals`, `next_allowed_phase`).
- `docs/iteration-board.loop.md` (kind: `iteration_board`, fields:
  `active_iteration`, `iteration_0_status`, `awaiting_human_gate`,
  `all_stories_done`).
- `stories/[STORY-ID].loop.md` for any in-flight story (delivery loop).

Additional session-level fields:

- `agent_role` (po-agent | ux-agent | architect-agent | developer-agent |
  qa-agent | devops-agent | secops-agent | all-agents).
- `assigned_story_state` (`in-dev` | `in-qa` | `in-acceptance` | `none`).

## Single Iteration Step

1. Run `guarding-loops` pre-flight (L1-RIGID prerequisite — do not skip).
2. Determine entry point:
   - Human says "new project" → fire `facilitating-inception`.
   - Human says "resume" / session restarts with assigned story → fire
     `resuming-sessions`.
   - Otherwise → Step 3 (Pull).
3. Pull protocol (per role):
   - developer-agent: claim oldest story from `ready-for-dev` in active Cycle
     (atomic: move to `in-dev` + self-assign), create feature flag
     (`managing-feature-flags`), then fire `running-atdd-sessions`.
   - qa-agent: claim oldest story from `ready-for-qa`, move to `in-qa`,
     then fire `running-regression-suite`.
   - po-agent: claim oldest story from `ready-for-acceptance`, move to
     `in-acceptance`, then fire `approving-stories`.
4. Read `CONTEXT.md`, `project.constraints.yaml`, and any relevant ADR.
5. Begin the role-appropriate skill (Step 5 of the SKILL.md protocol).
6. After completing the story, run the iteration completion check; if all
   stories in the active Cycle are `done`, post notice and idle.

## Proof of Progress

Proof that the loop has advanced this iteration:

- Linear state changed (story claimed, moved, or remains in `none`) AND
- A skill was fired (or an explicit no-op was logged) AND
- `guarding-loops` recorded `guardian_check` with timestamp and outcome.

The story snapshot at `stories/[STORY-ID].md` (or the inception /
iteration-board loop-state file) reflects the new state.

## State Transition Rule

transition in-analysis → in-analysis
  trigger new project cold start
  handoff facilitating-inception to po-agent

transition in-analysis → in-dev
  trigger developer-agent claims story from ready-for-dev
  handoff running-atdd-sessions to developer-agent

transition in-analysis → in-qa
  trigger qa-agent claims story from ready-for-qa
  handoff running-regression-suite to qa-agent

transition in-analysis → in-acceptance
  trigger po-agent claims story from ready-for-acceptance
  handoff approving-stories to po-agent

## Halt Conditions

- `guarding-loops` reports `halted-stall`, `halted-iteration-budget`,
  `halted-wall-clock`, `halted-cost`, `halted-human-gate`, or
  `halted-unsafe` → stop; do not advance state.
- An L1-RIGID skill is in effect and overrides the plan file (resuming,
  ATDD, TDD) — full stop, follow the L1 skill, no exceptions.
- The active iteration's `iteration_0_status` is `blocked` or
  `awaiting_human_gate` is set → idle and wait for human.
- Agent is asked to act outside its role → refuse and hand off to the
  correct agent.

## Handoff Target

- `guarding-loops` is invoked at the start of every iteration. On `cleared`
  control returns to `using-forge`. On `halted-*`, the session ends with a
  Linear post.
- Once the role-appropriate entry step is complete, hand off to:
  - `running-atdd-sessions` (developer-agent, from `in-dev`)
  - `running-regression-suite` (qa-agent, from `in-qa`)
  - `approving-stories` (po-agent, from `in-acceptance`)
  - `facilitating-inception` (po-agent, on new project)
  - `resuming-sessions` (all-agents, on resume)
- After `done`, run iteration completion check; if all stories are `done`
  in the active Cycle, idle and await human gate.
