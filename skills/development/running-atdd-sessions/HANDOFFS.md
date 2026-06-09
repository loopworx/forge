# running-atdd-sessions — Handoffs

## Inbound

Triggered by `using-forge` Step 5 when Linear status is `in-dev`.
Also triggered on resume via `resuming-sessions` → outer AT is RED → continue ATDD loop.

---

## Feature flag (on story start)

**Skill:** `managing-feature-flags`
**Agent:** developer-agent
**Trigger:** Immediately when story enters `in-dev` for the first time (not on resume)
**Action:** Create the feature flag named in the story; confirm it is OFF
**Then:** Begin the ATDD loop

---

## Inner loop: per sub-slice

**Skill:** `running-tdd-loops`
**Agent:** developer-agent
**Trigger:** For each sub-slice within an AC
**Returns to:** `running-atdd-sessions` after each FE and BE loop
See `running-tdd-loops/HANDOFFS.md` for the return protocol.

---

## Per-AC outbound: desk check

**After each AC → outer AT GREEN:**
**Skill:** `running-desk-checks`
**Agent:** qa-agent
**Trigger:** Developer posts to Linear: "Desk check ready: AC-[N] [STORY-ID]"
**Artifact passed:** Updated `stories/[STORY-ID].md` with sub-slice statuses; deployed test environment URL

**On desk check APPROVED:**
Return to `running-atdd-sessions` for next AC.

**On desk check FAILED:**
Remain in `running-atdd-sessions`; fix the specific failure; re-trigger desk check for the same AC.
Do NOT move to the next AC.

---

## Architecture blocked (mid-story)

**Skill:** `deciding-architecture`
**Agent:** architect-agent
**Trigger:** Developer cannot proceed without an architectural decision
**Action:** Post to Linear; pause ATDD session; wait for ADR
**Returns to:** `running-atdd-sessions` when ADR is accepted

---

## Story complete outbound

**After all ACs done + all desk checks approved:**
Move story to `ready-for-qa` in Linear
**Skill:** `running-regression-suite`
**Agent:** qa-agent
**Trigger:** Story appears in `ready-for-qa`
**Artifact passed:** Completed `stories/[STORY-ID].md`; story deployed to test environment

---

## Post-story

Run iteration completion check (see `using-forge` Iteration Completion Check section).
- If iteration complete → post notice and idle
- If not complete → pull next story from `ready-for-dev` (back to `using-forge` Step 3)
