---
name: running-desk-checks
level: L2-GUIDED
owner: qa-agent
trigger: developer-agent completes all sub-slices for an AC and signals desk check ready
description: Inspects a completed AC against its acceptance criteria through the UI exactly as a customer would
---

# running-desk-checks

## Description

Inspects a completed AC against its acceptance criteria through the UI — exactly as an outside customer would. Writes a desk check artifact. The developer agent may not proceed to the next AC until the desk check is approved. This is a human-visible checkpoint, not a rubber stamp.

---

## Protocol

### Step 1 — Inspect locally
```
1. Pull the branch (trunk — there are no feature branches)
2. Run the outer Acceptance Test for this AC → must be GREEN
3. Open the application locally
4. Execute each step of the AC manually, as a customer would:
   - Use only the UI
   - No database inspection
   - No API calls
   - No internal state verification
5. For each AC step: does the UI behave exactly as the AC states?
```

### Step 2 — Inspect on test environment
```
1. Ensure story is deployed to test environment (devops-agent ensures)
2. Repeat Step 1 on the test environment URL
3. Ensure feature flag is OFF on test environment (story not yet accepted)
```

### Step 3 — Write desk check artifact

Update `stories/[STORY-ID].md` AC section:
```yaml
ac:
  - id: AC-1
    desk_check:
      status: approved          # or: failed
      checked_by: qa-agent
      checked_at: YYYY-MM-DDTHH:MM:SSZ  # timestamp of desk check
      environment: local + test
      notes: ""
      # if failed:
      failure_reason: ""
      failure_screenshot: ""
```

### Step 4 — Signal result

**If approved:**
```
Post to Linear story comment: "Desk check AC-[N]: APPROVED ✓"
Update story snapshot
Notify developer-agent: proceed to next AC
```

**If failed:**
```
Post to Linear story comment:
  "Desk check AC-[N]: FAILED
   Reason: [specific description]
   Expected: [what AC says]
   Actual: [what UI shows]"
Move story back to `in-dev`
Developer agent must fix and re-trigger desk check — do not move to next AC
```

---

## What a Desk Check Is Not

- Not a code review
- Not a performance test
- Not a security audit
- Not a regression test (that's running-regression-suite)

A desk check is: does this AC work, right now, through the UI, as a customer would use it.

## State Model

This skill gates an AC before the developer proceeds to the next AC.

Story states this skill owns:
- `ready-for-deskcheck` — developer finished an AC; awaiting QA pull
- `in-deskcheck` — QA pulled and is inspecting the AC

Per-AC state: pending, in-progress, `in-deskcheck`, `approved`

## Rules

1. Inspect the AC locally first, then on the test environment.
2. Use only the UI; no database inspection, API calls, or internal state inspection.
3. Write or update the desk-check artifact in `stories/[STORY-ID].md` with status, time, and notes.
4. On approval, notify the developer-agent to proceed to the next AC.
5. On failure, post specific expected vs actual details and keep the story in `in-dev`.
6. The developer may not move to the next AC until the current desk check is approved.
