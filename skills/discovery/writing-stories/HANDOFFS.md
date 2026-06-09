# writing-stories — Handoffs

## Gate failure handoffs (internal)

| Gate | Failure routes to |
|---|---|
| Gate 2 (UX) | Back to Gate 1 — po-agent rewrites |
| Gate 3 (Developer) | Back to Gate 1 — may need new ADR first |
| Gate 4 (QA) | Back to Gate 1 — ACs must be rewritten |

## Outbound handoffs

**On gate pass:**
**Skill:** `threat-modeling`
**Agent:** secops-agent
**Trigger:** Story touches auth, payments, PII, or permissions
**When:** Before story moves to `ready-for-dev`

**On gate pass (no security surface):**
Story created in Linear as `in-analysis` → flows into `building-iteration-map`

**After all stories written:**
**Skill:** `building-iteration-map`
**Agent:** po-agent
**Trigger:** All stories for the iteration have passed gate review
