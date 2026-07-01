---
name: establishing-architecture
level: L2-GUIDED
owner: architect-agent
trigger: inception Phase 7 (after selecting-tech-stack); new bounded context discovered; service boundary needs defining
metadata:
  category: architecture
  description: Decides code architecture — service boundaries, module structure, integration patterns, folder layout
---

# establishing-architecture

## Description

Defines the code-level architecture for the project. Reads the platform ADR (ADR-001) and event storm to decide service boundaries, module structure, folder layout, integration patterns, and data flow. Produces `docs/adr/ADR-002-code-architecture.md` — the code structure blueprint that all developers follow.

---

## When This Skill Fires

Run this skill when:
- Inception Phase 7 is active (immediately after `selecting-tech-stack`)
- ADR-001 (platform) has been accepted
- A new bounded context is discovered during development
- Service boundaries need to be redefined

Do NOT run this skill for:
- Individual component decisions (use `deciding-architecture` instead)
- Choosing a library (write a specific ADR)
- Refactoring within an established architecture

---

## Input Artifacts

Read these before starting:
1. `docs/adr/ADR-001-platform.md` — platform decisions (language, framework, database)
2. `docs/event-storm.yaml` — bounded contexts, aggregates, commands, queries
3. `project.constraints.yaml` — priority ranking
4. `design-system/MASTER.md` — frontend component requirements (if UI project)
5. Linear stories — to understand scope and complexity

---

## Output

`docs/adr/ADR-002-code-architecture.md` containing:

### Service Boundaries
- Monolith vs microservices decision
- If monolith: modular monolith with clear module boundaries
- If microservices: service list with responsibilities
- Justification tied to event storm bounded contexts

### Module Structure
- Top-level folder layout (e.g., `src/modules/`, `src/shared/`, `src/infrastructure/`)
- Module internal structure (e.g., `controller/`, `service/`, `repository/`, `domain/`)
- Shared kernel definition (what's common across modules)

### Data Flow
- Request → controller → service → repository → database
- Event flow (if event-driven): command → aggregate → domain event → projector → read model
- Integration flow: external API → adapter → service → domain

### Integration Patterns
- Synchronous (HTTP/gRPC) vs asynchronous (queue/pub-sub)
- API client patterns (retry, circuit breaker, timeout)
- Webhook handling (if applicable)

### Database Strategy
- Single database vs database-per-service
- Migration approach (versioned, expand-contract)
- Read model strategy (if CQRS)

### Frontend Architecture (if UI project)
- State management approach
- API client layer
- Component organization (feature-based vs type-based)
- Routing strategy

### Testing Strategy
- Unit test boundaries (domain logic, not framework code)
- Integration test scope (module level, not full system)
- E2E test scope (critical user journeys only)
- Contract test approach (if multi-service)

---

## Decision Protocol

### Step 1 — Map bounded contexts
Read `docs/event-storm.yaml`. Extract all bounded contexts. Each context becomes a module (in a monolith) or a service (in microservices).

### Step 2 — Decide monolith vs microservices
Default: modular monolith. Choose microservices only if:
- 3+ bounded contexts with different scalability needs
- Multiple teams will work on different contexts simultaneously
- The event storm shows clear async communication patterns

### Step 3 — Design module structure
For each bounded context, define:
- Entry point (controller/resolver)
- Domain logic (aggregates, entities, value objects)
- Infrastructure (repository implementations, external clients)
- Public API (what other modules can import)

### Step 4 — Choose integration patterns
For each external integration in the event storm:
- HTTP client with retry + circuit breaker
- Or message queue consumer/producer
- Or webhook handler

### Step 5 — Write ADR-002
Produce `docs/adr/ADR-002-code-architecture.md` with all sections. Each decision must reference ADR-001 for technology choices.

### Step 6 — Post to Linear
Post a comment on the inception story:
> "Code architecture ADR accepted: ADR-002. [Monolith/microservices]. [N] modules defined. Folder layout committed. Testing strategy: [unit/integration/E2E]."

---

## State Model

This skill runs during inception Phase 7 (after `selecting-tech-stack`).

- `docs/adr/ADR-002-code-architecture.md` — Phase 7 artifact
- All development stories reference this ADR for code structure

For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Default to modular monolith — microservices only with explicit justification.
2. Every module boundary must trace to a bounded context in the event storm.
3. Folder layout must be concrete — actual paths, not "src/modules/...".
4. Testing strategy must define WHAT to test at each level, not just "write tests".
5. All choices must be compatible with ADR-001 (platform).
6. If `graphify` integration is enabled, use it to visualize the module structure.
