# establishing-architecture — Loop

The L2-GUIDED code architecture loop. Defines service boundaries,
module structure, folder layout, integration patterns, and data flow.
Produces `docs/adr/ADR-002-code-architecture.md` as the code structure
blueprint that all developers follow.

## Entry Conditions

- Inception Phase 7 is active (immediately after `selecting-tech-stack`
  in the same session).
- `docs/adr/ADR-001-platform.md` exists with Status: Accepted.
- `docs/event-storm.yaml` exists with bounded contexts identified.
- `project.constraints.yaml` is readable.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Local file state:

- `bounded_contexts_mapped` — list of contexts from event storm.
- `monolith_vs_microservices_decided` — boolean.
- `modules_defined` — list of module names with responsibilities.
- `integration_patterns_chosen` — list of integration types.
- `testing_strategy_defined` — boolean.
- `priorities` — copied from `project.constraints.yaml`.

## Single Iteration Step

1. Read `docs/adr/ADR-001-platform.md`. Record language, framework,
   database choices.
2. Read `docs/event-storm.yaml`. Extract all bounded contexts. Each
   context becomes a module (monolith) or service (microservices).
3. Decide monolith vs microservices. Default: modular monolith.
   Define microservices only with explicit justification (3+ contexts
   with different scalability needs, multiple teams, async patterns).
4. For each bounded context, design the module:
   - Entry point (controller/resolver)
   - Domain logic (aggregates, entities, value objects)
   - Infrastructure (repository implementations, external clients)
   - Public API (what other modules can import)
5. Define integration patterns for each external integration:
   HTTP client with retry+circuit breaker, or message queue, or webhook.
6. Define database strategy: migration approach, read model strategy.
7. Define frontend architecture (if UI project): state management, API
   client layer, component organization, routing.
8. Define testing strategy: unit (domain logic), integration (module
   level), E2E (critical journeys), contract (if multi-service).
9. Write `docs/adr/ADR-002-code-architecture.md` with all sections.
10. Post summary to Linear on the inception story.

## Proof of Progress

- `docs/adr/ADR-002-code-architecture.md` exists with all sections.
- Every module boundary traces to a bounded context in the event storm.
- Folder layout has concrete paths (e.g., `src/modules/orders/`).
- Testing strategy defines what to test at each level.
- All choices are compatible with ADR-001.
- ADR status is "Accepted".

## State Transition Rule

```
transition inception-phase-7 → inception-phase-7
  trigger selecting-tech-stack ADR-001 accepted
  handoff establishing-architecture to architect-agent (same session)

transition inception-phase-7 → inception-phase-8
  trigger both ADR-001 + ADR-002 committed
  handoff building-iteration-map to po-agent
```

## Halt Conditions

- ADR-001 missing or not accepted → halt; run `selecting-tech-stack`
  first.
- `docs/event-storm.yaml` missing or has no bounded contexts → halt;
  route back to Phase 4.
- `project.constraints.yaml` priorities missing → halt; route back to
  Phase 3.
- A `guarding-loops` `halted-*` report → stop; do not write ADR.
- Module boundary cannot be traced to a bounded context → halt; the
  event storm is incomplete.

## Handoff Target

- Code architecture ADR accepted → `building-iteration-map`
  (po-agent) begins Phase 8, mapping stories to iterations with full
  knowledge of the technology platform and code structure.
- During development: `deciding-architecture` (architect-agent) handles
  individual architectural decisions that arise, always compatible with
  ADR-001 and ADR-002.
