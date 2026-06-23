# Forge Perfect Loop Plan

## Objective

This plan revises the earlier proposal so Forge has a **single, easy-to-follow loop architecture** that covers the whole system: inception, story refinement, iteration planning, delivery, verification, release, and resume behavior. The current repository already defines the main skill hierarchy, phase gates, handoff graph, shared language file, and inner ATDD/TDD process structure.[cite:27][cite:28][cite:31][cite:32][cite:33][cite:34]

The missing piece is not process intent but **loop ergonomics**: every agent should be able to answer the same five questions at any moment — where am I, what is the next allowed action, what proves success, what updates state, and when must I stop.[cite:27][cite:28][file:15]

## Design Principles

The revised design uses one common loop contract across all skills. Every loop, whether human-guided or mechanical, should declare: entry conditions, loop state, allowed actions, proof command or proof artifact, state transition rule, halt conditions, and handoff target.[cite:27][cite:28][cite:31][cite:33]

The core rule is **test reality over plan reality**. In delivery loops, the proof must come from executable acceptance tests, component tests, CDC contract tests, smoke tests, and regression results; in discovery loops, the proof comes from committed artifacts plus explicit human approval at the required gates.[cite:22][cite:27][cite:31][cite:32][file:15]

## Loop Stack

Forge should explicitly document six nested loops so agents can orient themselves immediately.[cite:27][cite:28][cite:31][cite:32][cite:33][cite:34]

| Loop | Scope | Current basis | Required proof | Primary owner |
|---|---|---|---|---|
| Iteration Board Loop | Whole project across iterations | `using-forge` session protocol and iteration completion check [cite:27] | All stories in active Cycle done; human opens next iteration [cite:27][file:15] | po-agent / main conductor |
| Inception Loop | New project setup | `facilitating-inception` 6 phases [cite:31] | Phase artifact committed and human-approved [cite:31] | po-agent + ux-agent |
| Event Storming Loop | Discovery inside inception | `facilitating-event-storming` 6 phases [cite:32] | `docs/event-storm.yaml` and `CONTEXT.md` complete and approved [cite:32] | po-agent + ux-agent |
| Story Writing Loop | Per story candidate | `writing-stories` four-gate review [cite:34] | Passes all 4 gates and is created in Linear as `in-analysis` [cite:34] | po-agent |
| Iteration Mapping Loop | Dependency planning | `building-iteration-map` algorithm [cite:33] | All stories assigned, no unresolved circular deps, human confirms map [cite:33] | po-agent |
| Delivery Loop | Per story through release | `using-forge` + `running-atdd-sessions` + QA/PO handoffs [cite:27][cite:28] | Acceptance, regression, approval, smoke checks [cite:28] | developer-agent / qa-agent / po-agent |

Inside the Delivery Loop, Forge should continue to model the ATDD Loop per AC and the TDD Loop per sub-slice, but those should now be documented as standard sub-loops using the same loop contract as the higher-level loops.[cite:22][cite:23][cite:28]

## The Standard Loop Contract

Every loop-capable skill should gain a `LOOP.md` file beside `SKILL.md` and `HANDOFFS.md`. This file should be short, rigid, and machine-oriented so agents can follow it without interpretation drift.[cite:22][cite:23][cite:27][cite:28]

Each `LOOP.md` should contain exactly these sections:

1. **Entry conditions** — what must already be true.
2. **Loop state schema** — what fields must be recorded externally.
3. **Single iteration step** — the allowed action sequence.
4. **Proof of progress** — executable command or approval artifact.
5. **State transition rule** — exactly how status changes are written.
6. **Halt conditions** — stall, ambiguity, budget, unsafe state, or human gate.
7. **Handoff target** — what loop or skill owns the next move.

This one template makes the system easier for all agents because they stop learning special cases and start recognizing one repeated pattern everywhere.

## State Model

Forge currently relies on Linear as truth, story snapshot files, handoffs, and `CONTEXT.md`, but it does not yet define a per-loop state ledger.[cite:17][cite:27][cite:28][file:15] The revised design should add three persistent state files.

### 1. `stories/[STORY-ID].loop.md`

This is the operational state for any story in motion. It should record:

- Current loop: delivery / ATDD / desk check / regression / acceptance
- Current AC and sub-slice
- Last executed proof command
- Last proof result summary
- Iteration counter
- Stall counter
- Last Linear state seen
- Last handoff artifact references
- Resume cursor

This file becomes the first source for `resuming-sessions`, while Linear remains the authority if there is a disagreement.[cite:27][cite:28][file:15]

### 2. `docs/inception.loop.md`

This tracks the phase of inception across Lean Canvas, empathy map, trade-off sliders, event storming, story writing, and iteration mapping. It should record the current phase, completed artifacts, pending human approvals, and next allowed phase.[cite:31][cite:32][cite:33][cite:34]

### 3. `docs/iteration-board.loop.md`

This tracks which iteration is open, which projects are active, whether Iteration 0 infrastructure is complete, whether the next iteration is waiting on a human gate, and whether all stories in the current Cycle are done.[cite:27][cite:33][cite:35]

## Consistent State Changes

Your requirement that state changes remain consistent should become a first-class protocol. Add a `State Transition Protocol` section to `skills/meta/using-forge/SKILL.md` and reference it from all loop files.[cite:27]

Required rules:

- Every external state transition must be **atomic** when the tool allows it: move state plus assign or unassign in one operation.[cite:27][file:15]
- No agent may act on remembered state; it must re-read Linear before a transition.[cite:27]
- If Linear and a loop file disagree, Linear wins and the loop file must be repaired immediately.[cite:27]
- Every transition must write a matching loop-state update in the same iteration step.
- A handoff is incomplete unless it includes state change, artifact reference, and environment reference where applicable.[file:15]

Also update `HANDOFFS.md` to fully encode the desk check states discussed in the design session: `ready-for-deskcheck` and `in-deskcheck`, including assignment persistence behavior for the developer-agent.[file:15]

## Proof Model

Forge should split proof into two forms so every loop can self-verify appropriately.

### Artifact Proof

Used by inception, event storming, story writing, and iteration mapping. Progress is real only when the required artifact exists in the defined path or Linear object, and any required human gate is explicitly approved.[cite:31][cite:32][cite:33][cite:34]

### Executable Proof

Used by delivery and release loops. Progress is real only when the declared command runs and returns the expected result, for example:

- Outer AT command per AC [cite:27][cite:28]
- FE component test command [cite:22]
- BE CDC contract test command [cite:22]
- Regression suite command [cite:28]
- Smoke test command after flag flip [cite:28]

Add a `loop:` block to `project.constraints.yaml` so every project defines canonical commands and budgets. Example fields:

```yaml
loop:
  outer_at_command: "npm run test:acceptance -- --story $STORY_ID --ac $AC_ID"
  component_test_command: "npm test -- component"
  cdc_test_command: "npm test -- contract"
  regression_command: "npm run test:regression"
  smoke_command: "npm run test:smoke"
  max_iterations_per_subslice: 5
  max_no_progress_retries: 2
  max_story_loop_minutes: 45
  max_story_loop_cost_usd: 2.00
```

That converts “done” from an opinion into a reproducible exit condition.

## Loop Guardian

Add a new L1-RIGID meta skill: `skills/meta/loop-guardian/`. It should run before every loop iteration, not just at session start.[cite:27]

Responsibilities:

- Re-read current external state.
- Read the relevant loop-state file.
- Check proof prerequisites.
- Check stall counters and no-progress conditions.
- Check whether a human gate is pending.
- Check whether the loop is in an unsafe or ambiguous state.
- Either clear the loop to proceed or halt it with an explicit reason.

This gives every agent one obvious pre-flight check and removes the need to re-interpret whether a loop should continue.

## Human Gates

The session notes define seven human gates and explicitly state that asking outside those gates is a process violation.[file:15] The revised plan should make that visible in one canonical place and reference it everywhere.

The main gates are:

1. Inception start.
2. Iteration map approval.
3. Iteration start.
4. Ready to deploy to production.
5. Iteration completion / retrospective.
6. Unexpected state or crash.
7. Unsafe feature discovered during threat modeling.[file:15]

These gates should be represented in loop-state files as `awaiting-human` states with a specific gate number, required artifact, and unblock condition. That prevents ambiguous “waiting” language and makes session end vs. human pause explicit.[file:15]

## Revised Delivery Loop

The delivery loop is already the strongest part of Forge, but it needs clearer machine support.[cite:22][cite:23][cite:27][cite:28]

### Delivery Loop Steps

1. `loop-guardian` validates that the story can be worked.
2. `using-forge` atomically claims the story into `in-dev`.[cite:27]
3. `resuming-sessions` reads `stories/[STORY-ID].loop.md`, then re-runs the last proof command to confirm reality before continuing.[cite:23][file:15]
4. `running-atdd-sessions` selects the current AC and asserts the outer Acceptance Test is RED before code changes begin.[cite:27][cite:28]
5. For each sub-slice, `running-tdd-loops` executes FE RED → GREEN → REFACTOR, then BE CDC RED → GREEN → REFACTOR, returning control after each sub-slice.[cite:22][cite:23]
6. After the outer AT goes GREEN for the AC, the story moves to `ready-for-deskcheck`, the developer session ends, and the qa-agent later claims `in-deskcheck` atomically.[file:15]
7. Desk check result returns the story to `in-dev`, preserving the developer assignment, and the next session resumes from real state.[file:15]
8. After all ACs pass with completed desk checks, QA runs regression, PO runs acceptance, and finishing-stories handles flag flip and smoke proof before `done`.[cite:28]

### Inner Checker

Add a dedicated sub-agent skill for inner verification, for example `skills/quality/checking-sub-slices/`. Its only job is to compare the sub-slice objective, diff, and test output, and then decide whether the proof is sufficient. This should be called after each GREEN and before the sub-slice is marked done.[cite:22]

That strengthens the maker-checker split already implicit in Forge’s role boundaries.[cite:27]

## Revised Inception and Planning Loops

The earlier plan underweighted the upper loops. The revised system should give them the same structure as delivery.

### Inception Loop

- Entry condition: explicit new-project start.[cite:31]
- Loop state file: `docs/inception.loop.md`.
- Progress proof: required artifact exists and gate approved.[cite:31]
- Halt conditions: unclear product definition, missing approval, undefined term for `CONTEXT.md`, unsafe redesign decision.[cite:17][cite:31][file:15]

### Event Storming Loop

Each phase should update `docs/inception.loop.md` with current phase number, resolved hotspots, unresolved ambiguities, and candidate story count. Phase 6 should explicitly block forward motion until `CONTEXT.md` is generated and approved, because the repo says all agents rely on it at session start.[cite:17][cite:32]

### Story Writing Loop

Add `docs/story-writing.loop.md` or a per-candidate state section inside `docs/inception.loop.md`. Each story candidate should track current gate, last failing reason, ADR dependency, empathy trace, and whether the story was split because it exceeded 5 ACs.[cite:34]

### Iteration Mapping Loop

This loop should track unresolved circular dependencies separately from normal dependencies so the system knows whether it is blocked algorithmically or awaiting human prioritization. The final state should be `awaiting-human gate-2` until the iteration map is approved.[cite:33][file:15]

### Iteration Board Loop

This should become an explicit skill or at minimum an explicit loop file referenced by `using-forge`. It is the outer governance loop that says whether the system is still in inception, in Iteration 0, in delivery for Iteration N, awaiting deployment approval, or awaiting retrospective sign-off.[cite:27][cite:35][file:15]

## Easy-Follow Rules for Agents

To make the system simple for all agents, put these rules near the top of `using-forge/SKILL.md` and mirror them in every `LOOP.md`.

1. Read `using-forge` first, always.[cite:27]
2. Run `loop-guardian` before any loop step.
3. Re-read external truth before acting.
4. Update the loop-state file every time you change external state.
5. Proof first, then progress; never the reverse.
6. If proof fails, do not reinterpret; stay in the loop or halt.
7. If state is ambiguous, stop and raise human gate 6.[file:15]
8. If a required term is missing from `CONTEXT.md`, stop and propose it before continuing.[cite:17]
9. Never “wait”; either continue, hand off, end session, or raise a human gate.[file:15]
10. If a loop file, handoff map, and Linear disagree, resolve in this order: Linear, executable/artifact proof, then repair local files.[cite:27][file:15]

## Concrete Repo Changes

### Add new files

- `skills/meta/loop-guardian/SKILL.md`
- `skills/meta/loop-guardian/HANDOFFS.md`
- `skills/meta/using-forge/LOOP.md`
- `skills/discovery/facilitating-inception/LOOP.md`
- `skills/discovery/facilitating-event-storming/LOOP.md`
- `skills/discovery/writing-stories/LOOP.md`
- `skills/discovery/building-iteration-map/LOOP.md`
- `skills/development/running-atdd-sessions/LOOP.md`
- `skills/development/running-tdd-loops/LOOP.md`
- `skills/quality/checking-sub-slices/SKILL.md`
- `docs/inception.loop.md`
- `docs/iteration-board.loop.md`
- `stories/[STORY-ID].loop.md` template

### Update existing files

- `skills/meta/using-forge/SKILL.md` — add State Transition Protocol, Human Gates, no “pause and wait” language, conductor model.[cite:27][file:15]
- `skills/meta/using-forge/HANDOFFS.md` — add explicit desk check states and persistence model.[cite:28][file:15]
- `skills/development/running-atdd-sessions/SKILL.md` — encode desk check session-end behavior.[file:15]
- `skills/meta/resuming-sessions/*` — make resume proof-driven from loop-state plus re-run commands.[cite:23][file:15]
- `project.constraints.yaml` — add canonical loop commands and budgets.[cite:31]

## Implementation Order

### Phase 1 — Make loops visible

1. Add all `LOOP.md` files.
2. Add the three loop-state file formats.
3. Update `using-forge` with the shared loop contract.

### Phase 2 — Make state reliable

4. Add atomic transition rules.
5. Add desk check states to handoffs and ATDD flow.
6. Upgrade `resuming-sessions` to re-run proof commands.

### Phase 3 — Make proof mechanical

7. Add `loop:` commands to `project.constraints.yaml`.
8. Add inner checker skill.
9. Add smoke/regression/acceptance proof conventions.

### Phase 4 — Make loops safe

10. Add `loop-guardian`.
11. Add stall counters and budget brakes.
12. Add explicit human gate representation in loop-state files.

## Target End State

Forge becomes a system where every agent follows the same rhythm:

- identify the active loop,
- read the loop-state file,
- verify external truth,
- execute one legal iteration step,
- prove progress,
- write state,
- hand off or halt.

That is the “perfect loop” for Forge: not one giant autonomous workflow, but a **uniform contract** that makes every loop — discovery, planning, delivery, and release — feel the same to the agents using it. The repository already contains most of the domain process; this plan turns it into a coherent loop operating system.[cite:27][cite:28][cite:31][cite:32][cite:33][cite:34][file:15]

---

## Appendix A — Accuracy Review & Gap Analysis

This section records the result of comparing the plan against the actual repository state. It confirms what the plan got right, corrects what it got wrong, and fills gaps the original plan missed.

### A.1 What the Plan Got Right

| Claim | Status | Evidence |
|---|---|---|
| No `LOOP.md` files exist anywhere | ✅ Accurate | 21 skills have `SKILL.md`, 20 have `HANDOFFS.md`, zero have `LOOP.md` |
| `skills/meta/loop-guardian/` is missing | ✅ Accurate | Directory does not exist |
| `skills/quality/checking-sub-slices/` is missing | ✅ Accurate | Directory does not exist |
| `docs/inception.loop.md` missing | ✅ Accurate | `docs/` only contains `adr/` and `.gitkeep` |
| `docs/iteration-board.loop.md` missing | ✅ Accurate | Same as above |
| `stories/*.loop.md` template missing | ✅ Accurate | `stories/` exists but only has `.gitkeep`; no `.loop.md` anywhere |
| `project.constraints.yaml` lacks `loop:` block | ✅ Accurate | File has priorities, max_parallel_developer_agents, feature_flags, environments — no loop commands or budgets |
| `using-forge/SKILL.md` lacks State Transition Protocol | ✅ Accurate | No such section exists |
| `using-forge/HANDOFFS.md` lacks explicit desk check states | ✅ Accurate | Only has “desk check approved” and “all ACs + desk checks done” as graph edges |
| `resuming-sessions` has no `HANDOFFS.md` | ✅ Accurate | Only `SKILL.md` exists |
| Delivery loop is strongest part | ✅ Accurate | `running-atdd-sessions`, `running-tdd-loops`, `running-desk-checks` are well-defined |

### A.2 What the Plan Got Wrong or Understated

| Claim/Issue | Correction | Evidence |
|---|---|---|
| `skills/quality/finishing-stories/` path | Wrong path. Actual path is `skills/acceptance-delivery/finishing-stories/` | Repo structure shows `acceptance-delivery/` category, not `quality/` |
| `skills/quality/checking-sub-slices/` as new skill | May be redundant. Inner verification is already covered by `running-desk-checks` (L2-GUIDED, qa-agent) and the ATDD session's own sub-slice completion rules | `running-desk-checks/SKILL.md` already verifies AC completion through UI |
| Plan lists only 6 loops in Loop Stack | Undercounts. There are 21 skills, many of which are loops | See full skill inventory below |
| `writing-acceptance-tests` not mentioned as loop-worthy | Missing. This is a critical pre-delivery loop that creates the executable outer AT | `writing-acceptance-tests/SKILL.md` exists, L2-GUIDED, qa-agent owned |
| `bootstrapping-project`, `validating-test-harness`, `securing-pipeline` | Iteration 0 bootstrap phase is significant but barely mentioned | Three skills handle Iteration 0; they deserve loop documentation |
| `resuming-sessions` upgrade plan | Plan says “make resume proof-driven” but `resuming-sessions` already re-runs the outer AT first. What it lacks is `*.loop.md` integration and `HANDOFFS.md` | Current protocol already runs outer AT before reading anything else |
| Relationship between `stories/[STORY-ID].md` and proposed `.loop.md` | Unclear in plan. Existing snapshot has AC/sub-slice status. Loop file should either extend it or be separate | `running-atdd-sessions/SKILL.md` already updates snapshot after each sub-slice |
| `managing-feature-flags` not treated as loop | Feature flags have a lifecycle: create at story pull, confirm OFF at start, flip ON at finish, OFF on fail. This is a loop | `managing-feature-flags` exists under `acceptance-delivery/` |

### A.3 Missing Loops That Should Be Added to the Loop Stack

The original Loop Stack table underweights several skills that have clear loop structure. Here is the corrected and expanded Loop Stack:

| Loop | Scope | Current basis | Required proof | Primary owner |
|---|---|---|---|---|
| **Iteration Board Loop** | Whole project across iterations | `using-forge` session protocol and iteration completion check [cite:27] | All stories in active Cycle done; human opens next iteration [cite:27][file:15] | po-agent / main conductor |
| **Inception Loop** | New project setup | `facilitating-inception` 6 phases [cite:31] | Phase artifact committed and human-approved [cite:31] | po-agent + ux-agent |
| **Event Storming Loop** | Discovery inside inception | `facilitating-event-storming` 6 phases [cite:32] | `docs/event-storm.yaml` and `CONTEXT.md` complete and approved [cite:32] | po-agent + ux-agent |
| **Ubiquitous Language Loop** | Shared language definition | `establishing-ubiquitous-language` | `CONTEXT.md` committed; unblocks all agents | po-agent |
| **Story Writing Loop** | Per story candidate | `writing-stories` four-gate review [cite:34] | Passes all 4 gates and is created in Linear as `in-analysis` [cite:34] | po-agent |
| **Threat Modeling Loop** | Security review per story | `threat-modeling` | Security ACs injected or story rejected [cite:34] | secops-agent |
| **Iteration Mapping Loop** | Dependency planning | `building-iteration-map` algorithm [cite:33] | All stories assigned, no unresolved circular deps, human confirms map [cite:33] | po-agent |
| **Architecture Decision Loop** | ADR creation | `deciding-architecture` | ADR accepted; may pause or redirect delivery | architect-agent |
| **Iteration 0 Bootstrap Loop** | Project setup | `bootstrapping-project` + `securing-pipeline` + `validating-test-harness` | Test harness passes; iteration 1 opens | devops-agent + qa-agent + secops-agent |
| **Acceptance Test Writing Loop** | Per story outer AT | `writing-acceptance-tests` | Outer AT written and confirmed RED | qa-agent |
| **Delivery Loop** | Per story through release | `using-forge` + `running-atdd-sessions` + `running-tdd-loops` + `running-desk-checks` + QA/PO handoffs [cite:27][cite:28] | Acceptance, regression, approval, smoke checks [cite:28] | developer-agent / qa-agent / po-agent |
| **Desk Check Loop** | Per AC verification | `running-desk-checks` | Desk check artifact approved | qa-agent |
| **Regression Loop** | Per story regression | `running-regression-suite` | Regression suite passes | qa-agent |
| **PO Acceptance Loop** | Per story final approval | `approving-stories` | PO verifies through UI, passes or fails | po-agent |
| **Release Loop** | Per story deployment | `finishing-stories` + `managing-feature-flags` | Smoke test passes after flag flip | po-agent + devops-agent |
| **Feature Flag Lifecycle Loop** | Flag creation to retirement | `managing-feature-flags` | Flag exists, is OFF before dev, ON after acceptance, OFF on fail | devops-agent |
| **Session Resume Loop** | Crash/window recovery | `resuming-sessions` | Outer AT re-run confirms reality | all-agents |

**Inside the Delivery Loop**, the following sub-loops already exist and should gain `LOOP.md` files:
- **ATDD Loop** per AC (`running-atdd-sessions`)
- **TDD FE Loop** per sub-slice (`running-tdd-loops` FE component loop)
- **TDD BE Loop** per sub-slice (`running-tdd-loops` BE CDC contract loop)

### A.4 Corrected Concrete Repo Changes

#### Add new files (corrected and expanded)

- `skills/meta/loop-guardian/SKILL.md`
- `skills/meta/loop-guardian/HANDOFFS.md`
- `skills/meta/resuming-sessions/HANDOFFS.md` *(plan missed this)*
- `skills/meta/using-forge/LOOP.md`
- `skills/discovery/facilitating-inception/LOOP.md`
- `skills/discovery/facilitating-event-storming/LOOP.md`
- `skills/discovery/establishing-ubiquitous-language/LOOP.md` *(plan missed this)*
- `skills/discovery/writing-stories/LOOP.md`
- `skills/discovery/building-iteration-map/LOOP.md`
- `skills/architecture/deciding-architecture/LOOP.md` *(plan missed this)*
- `skills/iteration-zero/bootstrapping-project/LOOP.md` *(plan missed this)*
- `skills/iteration-zero/validating-test-harness/LOOP.md` *(plan missed this)*
- `skills/development/running-atdd-sessions/LOOP.md`
- `skills/development/running-tdd-loops/LOOP.md`
- `skills/quality/writing-acceptance-tests/LOOP.md` *(plan missed this)*
- `skills/quality/running-desk-checks/LOOP.md` *(plan missed this)*
- `skills/quality/running-regression-suite/LOOP.md` *(plan missed this)*
- `skills/acceptance-delivery/approving-stories/LOOP.md` *(plan missed this)*
- `skills/acceptance-delivery/finishing-stories/LOOP.md` *(plan missed this)*
- `skills/acceptance-delivery/managing-feature-flags/LOOP.md` *(plan missed this)*
- `skills/acceptance-delivery/securing-pipeline/LOOP.md` *(plan missed this)*
- `skills/acceptance-delivery/threat-modeling/LOOP.md` *(plan missed this)*
- `docs/inception.loop.md`
- `docs/iteration-board.loop.md`
- `stories/[STORY-ID].loop.md` template

#### Update existing files (expanded)

- `skills/meta/using-forge/SKILL.md` — add State Transition Protocol, Human Gates, no “pause and wait” language, conductor model, **explicit Iteration 0 protocol** [cite:27][file:15]
- `skills/meta/using-forge/HANDOFFS.md` — add explicit desk check states and persistence model, **add Iteration 0 handoff graph** [cite:28][file:15]
- `skills/development/running-atdd-sessions/SKILL.md` — encode desk check session-end behavior, **clarify sub-slice completion proof** [file:15]
- `skills/meta/resuming-sessions/SKILL.md` — make resume proof-driven from loop-state plus re-run commands, **add HANDOFFS.md** [cite:23][file:15]
- `skills/quality/running-desk-checks/SKILL.md` — **add explicit `ready-for-deskcheck` and `in-deskcheck` states** [file:15]
- `project.constraints.yaml` — add canonical loop commands and budgets, **add Iteration 0 completion criteria** [cite:31]

### A.5 Relationship Between Story Snapshot and Loop State

The repository already has `stories/[STORY-ID].md` as a story snapshot with AC and sub-slice status. The plan's proposed `stories/[STORY-ID].loop.md` should be designed as an **operational overlay**, not a replacement.

**Proposed design:**
- `stories/[STORY-ID].md` remains the **human-readable story contract** (snapshot of ACs, sub-slices, empathy trace)
- `stories/[STORY-ID].loop.md` becomes the **machine-readable loop state** (current loop, last proof command, stall counter, resume cursor, handoff references)
- Both are updated atomically on state transitions
- If they disagree, the snapshot determines “what should be done” and the loop file determines “where we are in doing it”

### A.6 Missing Considerations for Implementation

1. **`securing-pipeline` is described as “terminal — setup skill; gates run automatically on every push after configuration”** — this is actually a **continuous compliance loop**, not a one-time setup. Its `LOOP.md` should document: entry (first config), loop state (pipeline health), proof (CI gate results), halt (security vulnerability found).

2. **`threat-modeling` can loop back to `writing-stories` Gate 1 or inject security ACs** — this is a conditional loop with two exit paths. Its `LOOP.md` must document both.

3. **`deciding-architecture` can pause `running-atdd-sessions` and resume later** — the loop state must capture “paused for ADR” with a resume reference.

4. **`resuming-sessions` already re-runs the outer AT before reading anything** — the plan's claim that it needs to become “proof-driven” is partially satisfied. What it actually needs is: (a) `HANDOFFS.md`, (b) reading the loop-state file, (c) re-running the *last executed proof command* (which may be component test or CDC test, not just outer AT).

5. **`managing-feature-flags` has no `HANDOFFS.md` outbound edges** in the master handoff graph — it is a lifecycle service. Its `LOOP.md` should document flag state transitions: created→off→on→retired.

6. **`checking-sub-slices` as a new skill may be unnecessary** — the verification after each TDD GREEN is already implicit in `running-tdd-loops` (step 4: run test → GREEN, step 5: refactor, run again → still GREEN). The explicit verification happens at desk check (`running-desk-checks`). If an inner checker is needed, consider making it a **sub-agent call within `running-tdd-loops`** rather than a standalone skill.

7. **`writing-acceptance-tests` currently triggers when “story enters `in-dev`; AC exists and is UI-testable”** — but `running-atdd-sessions` also says “outer Acceptance Test file exists (even if skeleton)”. The loop contract must clarify: who writes the outer AT (qa-agent via `writing-acceptance-tests`) and when it must be RED before `running-atdd-sessions` begins.

8. **Iteration 0 is a special global state** not well-captured. The `docs/iteration-board.loop.md` should have an explicit `phase: iteration-0` state with sub-states: `bootstrapping`, `securing-pipeline`, `validating-test-harness`, `awaiting-iteration-1-open`.

9. **The `loop-guardian` should also guard L2 and L3 loops**, not just L1. Inception phases, story writing gates, and iteration mapping all benefit from pre-flight checks.

10. **`CONTEXT.md` updates are themselves a loop** — when agents discover missing terms, they must propose additions. `establishing-ubiquitous-language` or `using-forge` should document how CONTEXT.md amendments flow back into the loop state.
