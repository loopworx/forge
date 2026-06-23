---
kind: inception
current_phase: lean-canvas
completed_artifacts: []
pending_approvals: []
next_allowed_phase: lean-canvas
---

# Inception Loop State

Operational state for the inception loop. Updated by po-agent and ux-agent as
phases complete. Read by `loop-guardian` before every inception iteration.

## Fields

| Field | Meaning |
|---|---|
| `current_phase` | One of: `lean-canvas`, `empathy-map`, `trade-off-sliders`, `event-storming`, `story-writing`, `iteration-mapping`, `complete`. |
| `completed_artifacts` | Paths of artifacts already approved (e.g., `docs/lean-canvas.md`, `docs/empathy-map.md`). |
| `pending_approvals` | Artifacts submitted but not yet approved by the human gate. |
| `next_allowed_phase` | Phase the loop may advance to once the current artifact is approved. |

## Phase transitions

```
lean-canvas
  └→ approved → empathy-map
empathy-map
  └→ approved → trade-off-sliders
trade-off-sliders
  └→ constraints committed → event-storming
event-storming
  └→ event-storm.yaml + CONTEXT.md approved → story-writing
story-writing
  └→ all stories pass four-gate review → iteration-mapping
iteration-mapping
  └→ map approved by human → complete
```

## Halt conditions

- Unclear product definition
- Missing human approval for an artifact
- Undefined term that must be in `CONTEXT.md`
- Unsafe redesign decision
