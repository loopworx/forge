# running-desk-checks — Handoffs

## On APPROVED

**Routes to:** developer-agent
**Action:** Post to Linear: "Desk check AC-[N]: APPROVED ✓"
**Effect:** Developer continues to next AC in `running-atdd-sessions`

## On FAILED

**Routes to:** developer-agent
**Action:** Post to Linear with failure reason, expected vs actual
**Effect:** Story stays in `in-dev`; developer fixes and re-triggers desk check for same AC
**Important:** Developer does NOT move to next AC until this AC's desk check is APPROVED
