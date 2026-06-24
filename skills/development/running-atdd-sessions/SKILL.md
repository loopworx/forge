---
name: running-atdd-sessions
level: L1-RIGID
owner: developer-agent
trigger: story is in `in-dev`; this is the ONLY thing a developer agent does when in-dev
description: Runs the outer ATDD loop for a story as L1-RIGID — write outer acceptance test, drive sub-slices FE+BE TDD until all ACs are green
---

# running-atdd-sessions

## Description

The L1 RIGID skill for developer agents. Runs the ATDD (Acceptance Test-Driven Development) loop for a story: write the outer Acceptance Test first, drive it to RED, then run TDD inner loops (FE + BE) one sub-slice at a time until the outer test is GREEN. No implementation code before the outer test is RED. No skipping sub-slices. No batching FE then BE. This skill overrides everything. The explicit feedback cycle is: make test RED → implement until GREEN → inspect → fix and refactor → repeat for each sub-slice.

---

## The Loop

```
═══════════════════════════════════════════════
 ATDD SESSION — ONE STORY
═══════════════════════════════════════════════

PRECONDITION:
  outer Acceptance Test file exists (even if skeleton)
  outer Acceptance Test is RED
  If GREEN: STOP — post to Linear, wait for human

FOR EACH AC in the story (in order):

  Write/update outer Acceptance Test for this AC → ensure RED

  FOR EACH sub-slice in this AC:

    ┌─────────────────────────────────────┐
    │  FE INNER LOOP                      │
    │  1. Write component test → RED      │
    │  2. Write minimum FE code → GREEN   │
    │  3. Refactor → still GREEN          │
    │  ✓ sub-slice FE done                │
    └─────────────────────────────────────┘
    ┌─────────────────────────────────────┐
    │  BE INNER LOOP                      │
    │  1. Write CDC contract test → RED   │
    │  2. Write minimum BE code → GREEN   │
    │  3. Refactor → still GREEN          │
    │  ✓ sub-slice BE done                │
    └─────────────────────────────────────┘

    Update story snapshot: sub-slice status → done
    NEVER move to next sub-slice until current is fully GREEN

  All sub-slices for this AC done:
    → outer Acceptance Test for this AC → GREEN
    → trigger running-desk-checks skill
    → WAIT for desk check approval before next AC

All ACs done + all desk checks approved:
  → move story to `ready-for-qa` in Linear
  → commit story snapshot update
  → inspect iteration completion (using-forge protocol)
```

## Rules

1. The outer Acceptance Test file is the first file written or edited for an AC.
2. No implementation code may be written before the outer AT is RED and has been seen failing.
3. Run the FE inner loop and BE inner loop sequentially per sub-slice.
4. Complete one sub-slice fully before starting the next.
5. Trigger and await a desk check after every AC, before starting the next AC.
6. Stop and hand off to the architect-agent when an architecture decision is needed.
7. Update the story snapshot after each completed sub-slice.

## Entry Conditions

- Story is in `in-dev` and assigned to the developer-agent, either on fresh pull or on resume with a RED outer AT.
- The feature flag for the story exists and is OFF.

## Halt Conditions

- The outer AT is unexpectedly GREEN at the start of the session; stop and post to Linear.
- An architecture decision blocks the story; pause for ADR.
- All ACs are GREEN and all desk checks are approved; move story to `ready-for-qa` and hand off to `running-regression-suite`.

---

## Rules That Cannot Be Broken

1. **The outer Acceptance Test file is the first file you write or edit. No exceptions.**

2. **No implementation code before outer AT is RED and you have seen it fail.**
   "I know it will be RED" is not sufficient. Run it. See it fail.

3. **FE loop and BE loop for each sub-slice run sequentially, not in parallel.**
   FE first, then BE. Never batch all FE loops, then all BE loops.

4. **One sub-slice at a time.** Complete it fully (FE + BE, both GREEN) before starting the next.

5. **Desk check after every AC, not after the whole story.**
   Move to the next AC only after the desk check is approved.

6. **No architecture decisions.** If you find you need to make one, stop.
   Post to Linear: "Architecture decision needed: [description]. @architect-agent"
   Wait for an ADR before continuing.

---

## Sub-slice Identification

A sub-slice is the smallest vertical unit within an AC: one UI interaction + its backend response.

Example AC: "Given a logged-in user, when they submit the order form, then they see an order acknowledgment with an order number."

Sub-slices:
1. Render order form with submit button (FE only, no BE)
2. Submit calls POST /orders endpoint (FE calls BE, BE returns stub)
3. Display order number from response (FE renders BE response)
4. POST /orders persists to database (BE fully implemented)

Each sub-slice is a complete FE+BE loop.

---

## Story Snapshot Update

After each sub-slice completes, update `stories/[STORY-ID].md`:

```yaml
ac:
  - id: AC-1
    status: in-progress
    sub_slices:
      - id: SS-1
        description: Render order form
        fe_status: done
        be_status: done
        completed_at: YYYY-MM-DDTHH:MM:SSZ  # timestamp of sub-slice completion
      - id: SS-2
        description: Submit calls POST /orders
        fe_status: in-progress
        be_status: pending
```
