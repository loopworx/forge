# building-iteration-map — Loop

The L3-MECH iteration-mapping loop. Mechanical execution of a topological
sort over the dependency graph of all refined stories. Produces Linear
Projects (one per iteration) and an active Cycle for Iteration 0. No
decisions, no creativity — just the algorithm.

## Entry Conditions

- All stories for the iteration have passed four-gate review and are in
  Linear with status `in-analysis`.
- `docs/inception.loop.md` `current_phase` is `iteration-mapping`.
- `project.constraints.yaml` exists with `max_parallel_developer_agents`
  and feature flag platform configuration.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Read from `docs/inception.loop.md`, Linear, and `project.constraints.yaml`:

- `stories_in_analysis` — list of `[STORY-ID]` to be assigned.
- `dependency_graph` — adjacency map of story → set of prerequisite
  stories (from Linear dependencies).
- `circular_dependencies` — list of cycles detected (must be empty
  before assignment).
- `iterations_planned` — list of `{ iteration: N, stories: [...] }`
  (built incrementally).
- `active_iteration` — copied from `docs/iteration-board.loop.md` (starts
  at 0).
- `parallel_tracks_per_iteration` — list of `{ iteration: N, max_parallel:
  K }` derived from `max_parallel_developer_agents`.

## Single Iteration Step

1. Read all `in-analysis` stories from Linear and their dependencies.
2. Run a topological sort:
   - Iteration 1 = stories with no dependencies.
   - Iteration N = stories whose dependencies are all in Iterations 1..N−1.
3. Detect circular dependencies; flag as hotspots; do not assign them.
4. For each iteration, compute parallel tracks: stories with no
   inter-story dependencies within the iteration can run in parallel,
   bounded by `max_parallel_developer_agents`.
5. Create one Linear Project per iteration; add stories to their
  iteration's Project; set story dependencies in Linear.
6. Create the Iteration 0 Cycle and add Iteration 0 infrastructure
   stories; set them to `in-analysis`.
7. Post the iteration summary comment on the project milestone:
   `"Iteration N: [X] stories, [Y] can run in parallel, [Z] total ACs"`.
8. Require human confirmation of the iteration map.

## Proof of Progress

- Linear Projects exist for every planned iteration.
- Every non-circular story is assigned to exactly one iteration Project.
- `docs/inception.loop.md` `completed_artifacts` includes the iteration
  map summary (post-on-milestone link or commit reference).
- `docs/iteration-board.loop.md` `iteration_0_status` may transition to
  `in_progress` after the iteration map is approved and
  `bootstrapping-project` starts.

## State Transition Rule

transition in-analysis → in-analysis
  trigger iteration map complete and Linear projects created
  handoff bootstrapping-project to devops-agent

transition in-analysis → in-analysis
  trigger iteration map complete
  handoff deciding-architecture to architect-agent

## Halt Conditions

- A circular dependency is detected → halt; route back to
  `writing-stories` for the affected stories to remove the cycle.
- A story depends on a story that has not yet passed gate review → halt;
  wait for the prerequisite story.
- A `guarding-loops` `halted-*` report → stop; do not modify Linear
  Project structure.
- Human declines the iteration map → halt; re-run the algorithm with
  corrections.

## Handoff Target

- Iteration map complete + human-approved → `bootstrapping-project`
  (devops-agent) to start Iteration 0.
- Concurrent: `deciding-architecture` (architect-agent) writes ADRs for
  Iteration 1 stories in parallel.
- `docs/inception.loop.md` `current_phase` becomes `complete`; return to
  `facilitating-inception` (which terminates with `complete`).
