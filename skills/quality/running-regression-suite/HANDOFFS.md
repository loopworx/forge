# running-regression-suite — Handoffs

## On PASS

**Action:** Move story to `ready-for-acceptance` in Linear
**Skill:** `approving-stories`
**Agent:** po-agent
**Trigger:** Story appears in `ready-for-acceptance`
**Artifact passed:** Regression suite results; story in test environment

## On FAIL

**Action:** Move story back to `ready-for-dev` in Linear
**Routes to:** developer-agent (pull model — developer sees story in ready-for-dev and pulls)
**Post to Linear:** Failure reason with exact repro steps
