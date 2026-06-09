# facilitating-inception — Handoffs

## Phase transitions (internal)

| From | To | Trigger | Agent |
|---|---|---|---|
| Phase 1 (Lean Canvas) | Phase 2 (Empathy Map) | Human approves `docs/lean-canvas.md` | ux-agent |
| Phase 2 (Empathy Map) | Phase 3 (Trade-off Sliders) | Human approves `docs/empathy-map.md` | po-agent |
| Phase 3 (Trade-off Sliders) | Phase 4 (Event Storming) | `project.constraints.yaml` committed | po-agent + ux-agent |
| Phase 4 (Event Storming) | Phase 5 (Story Writing) | `CONTEXT.md` + `docs/event-storm.yaml` committed and human-approved | po-agent |
| Phase 5 (Story Writing) | Phase 6 (Iteration Map) | All stories pass four-gate review and are in Linear | po-agent |

## Outbound handoff

**Skill:** `building-iteration-map`
**Agent:** po-agent
**Trigger:** All stories refined, Phase 6 begins
**Artifact passed:** All stories in Linear in `in-analysis`; `docs/event-storm.yaml`; `CONTEXT.md`
