---
name: building-iteration-map
level: L3-MECH
owner: po-agent
trigger: Phase 6 of facilitating-inception; all stories have passed four-gate review
description: Topologically sorts stories by dependency, creates Linear Projects per iteration, and sets parallel tracks
---

# building-iteration-map

## Description

Builds the iteration map from the dependency graph of all refined stories. Uses topological sort to assign stories to iterations — stories with no dependencies go first, stories depending on them go next. Creates Linear Projects (one per iteration) and an active Cycle for Iteration 0. This is mechanical execution — no decisions, just the algorithm.

---

## Algorithm

```
1. Collect all stories that passed gate review (status: in-analysis)
2. For each story, identify dependencies (stories that must complete first)
3. Topological sort:
   Iteration 1 = stories with no dependencies
   Iteration 2 = stories whose only dependencies are in Iteration 1
   Iteration N = stories whose dependencies are all in Iterations 1..N-1
4. Flag stories with circular dependencies as hotspots — do not assign
5. Within each iteration, identify parallel tracks:
   stories with no inter-story dependencies within the iteration = parallel
```

---

## Linear Actions

```
For each iteration N:
  → Create Linear Project: "Iteration N"
  → Add all stories assigned to iteration N to the project
  → Set story dependencies in Linear

Create Iteration 0 Cycle:
  → Add Iteration 0 infrastructure stories
  → Set all to `in-analysis`

Post iteration summary comment on the project milestone:
  "Iteration N: [X] stories, [Y] can run in parallel, [Z] total ACs"
```

---

## Iteration Scoping Reference

| Concept | Forge equivalent |
|---|---|
| Story points | AC count (1 AC ≈ 1 ATDD loop) |
| Team velocity | Max parallel agents (from project.constraints.yaml) |
| Sprint length | Variable — iteration ends when all stories reach done |
| Scope cut | Split stories with >5 ACs before iteration starts |

---

## Completion Criteria

This skill is done when:
- [ ] All stories are assigned to an iteration in Linear
- [ ] Linear Projects exist for all iterations
- [ ] Iteration 0 Cycle is active
- [ ] Dependency graph has no unresolved circular dependencies
- [ ] Human has confirmed the iteration map

## State Model

This skill assigns refined stories to iterations using the dependency graph.

- `in-analysis` — refined stories awaiting iteration assignment
- Linear Project per iteration
- Iteration 0 Cycle — active infrastructure cycle
- `ready-for-dev` (future) — stories unlocked once iteration 0 is complete

## Rules

1. Use topological sort to assign stories to iterations based on dependencies.
2. Flag circular dependencies as hotspots; do not assign them.
3. Create one Linear Project per iteration and set story dependencies.
4. Create the Iteration 0 Cycle with infrastructure stories.
5. Split any story with more than five ACs before iteration starts.
6. Obtain human confirmation on the iteration map before completion.
