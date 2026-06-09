# building-iteration-map — Handoffs

## Outbound handoff

**Skill:** `bootstrapping-project`
**Agent:** devops-agent
**Trigger:** Iteration map complete; Linear Projects created; Iteration 0 Cycle active
**Artifact passed:** Linear board structure; `project.constraints.yaml`

**Concurrent handoff:**
**Skill:** `deciding-architecture`
**Agent:** architect-agent
**Trigger:** Simultaneously with bootstrapping-project; architect-agent writes ADRs for Iteration 1 stories
**Artifact passed:** Iteration 1 story list from Linear
