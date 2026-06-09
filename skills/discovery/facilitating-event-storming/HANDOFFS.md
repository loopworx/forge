# facilitating-event-storming — Handoffs

## Phase transitions (internal)

| Phase | Produces | Gate |
|---|---|---|
| 1–5 (exploration → UI mapping) | `docs/event-storm.yaml` draft | Human reviews completeness |
| 6 (Ubiquitous Language) | `CONTEXT.md` | Human approves before story writing |

## Outbound handoff

**Skill:** `establishing-ubiquitous-language`
**Agent:** po-agent
**Trigger:** Phases 1–5 complete; entering Phase 6
**Artifact passed:** `docs/event-storm.yaml` with all aggregates, events, commands, policies, and story candidates

**Then:**
**Skill:** `writing-stories`
**Agent:** po-agent
**Trigger:** `CONTEXT.md` committed and human-approved
**Artifact passed:** `CONTEXT.md`; story candidates from `docs/event-storm.yaml`
