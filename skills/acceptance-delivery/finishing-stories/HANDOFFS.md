# finishing-stories — Handoffs

## On smoke test PASS

**Action:** Story moves to `done` in Linear
**Post-story:** Run iteration completion check (see `using-forge`)
- If iteration complete → po-agent posts completion notice; all agents idle
- If not complete → agents continue pulling from `ready-for-dev` / `ready-for-qa` / `ready-for-acceptance`

## On smoke test FAIL

**Immediate action:** Flip feature flag OFF
**Action:** Post incident note in Linear
**Routes to:** developer-agent (story returns to `ready-for-dev`)
**Human notification required:** Do not retry without human review
