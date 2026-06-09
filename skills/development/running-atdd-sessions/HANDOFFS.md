# running-atdd-sessions — Handoffs

## Per-AC outbound (intra-story)

**After each AC → outer AT GREEN:**
**Skill:** `running-desk-checks`
**Agent:** qa-agent
**Trigger:** Developer posts to Linear: "Desk check ready: AC-[N] [STORY-ID]"
**Artifact passed:** Updated `stories/[STORY-ID].md` with sub-slice statuses; deployed test environment URL

**On desk check APPROVED:**
Return to `running-atdd-sessions` for next AC.

**On desk check FAILED:**
Remain in `running-atdd-sessions`; fix the specific failure; re-trigger desk check.

## Architecture blocked (mid-story)

**Skill:** `deciding-architecture`
**Agent:** architect-agent
**Trigger:** Developer cannot proceed without an architectural decision
**Action:** Post to Linear; pause ATDD session; wait for ADR

## Story complete outbound

**After all ACs done + all desk checks approved:**
Move story to `ready-for-qa` in Linear
**Skill:** `running-regression-suite`
**Agent:** qa-agent
**Trigger:** Story appears in `ready-for-qa`
**Artifact passed:** Completed `stories/[STORY-ID].md`; story deployed to test environment

## Post-story
Run iteration completion check (see `using-forge` session start protocol).
If iteration complete → post notice and idle.
If not complete → pull next story from `ready-for-dev`.
