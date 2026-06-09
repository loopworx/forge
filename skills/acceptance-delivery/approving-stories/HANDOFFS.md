# approving-stories — Handoffs

## On PASS

**Action:** Move story to `ready-to-deploy` in Linear
**Next:** HUMAN reviews and approves flag flip
**Skill:** `finishing-stories`
**Agent:** po-agent + devops-agent
**Trigger:** Human explicitly approves production release

## On FAIL

**Action:** Move story back to `ready-for-dev` in Linear
**Routes to:** developer-agent (pull model)
**Post to Linear:** Specific reason — which AC failed, what was expected vs observed
