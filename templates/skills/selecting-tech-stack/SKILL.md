---
name: selecting-tech-stack
level: L2-GUIDED
owner: architect-agent
trigger: inception Phase 7; after story writing, before iteration mapping
metadata:
  category: architecture
description: Decides the platform — cloud provider, CI/CD, languages, frameworks, databases, observability
---

# selecting-tech-stack

## Description

Selects the concrete technology platform for the project. Reads the Lean Canvas, trade-off sliders, event storm, and story list to make informed decisions about cloud provider, programming languages, frameworks, databases, CI/CD platform, and observability tools. Produces `docs/adr/ADR-001-platform.md` — the foundational ADR that all subsequent architecture decisions build upon.

---

## When This Skill Fires

Run this skill when:
- Inception Phase 7 is active (after story writing, before iteration mapping)
- Stories exist in Linear and have been reviewed
- `project.constraints.yaml` exists with priority rankings

Do NOT run this skill for:
- Adding a library to an existing stack (use `deciding-architecture` instead)
- Changing one component in an established platform (produce a specific ADR)
- Frontend component choices (those belong in the design system)

---

## Input Artifacts

Read these before starting:
1. `docs/lean-canvas.md` — problem, solution, cost structure
2. `project.constraints.yaml` — priority ranking (quality, security, ux, cost)
3. `docs/event-storm.yaml` — bounded contexts, command/query patterns
4. `design-system/MASTER.md` — frontend requirements (if UI project)
5. Linear stories — count, complexity, type (UI/API/integration)

---

## Output

`docs/adr/ADR-001-platform.md` containing decisions for:

### Cloud Provider
- Provider (AWS, GCP, Azure, Fly.io, Railway, self-hosted)
- Region(s)
- Justification tied to cost structure and constraints

### Backend Language + Framework
- Language (TypeScript, Python, Go, Rust, etc.)
- Framework (Hono, Fastify, FastAPI, Gin, Axum, etc.)
- Justification tied to team capability and story complexity

### Frontend Framework (if UI project)
- Framework (React, Vue, Svelte, etc.)
- Rendering strategy (SPA, SSR, SSG)
- Meta-framework (Next.js, Nuxt, SvelteKit, etc.) if applicable

### Database
- Primary database (PostgreSQL, MySQL, SQLite, DynamoDB, etc.)
- Cache layer (Redis, in-memory, none) if needed
- Justification tied to data patterns from event storm

### CI/CD
- Platform (GitHub Actions, GitLab CI, CircleCI, etc.)
- Pipeline stages (lint → test → build → deploy)
- Environment strategy (dev/staging/prod or feature-branch deploys)

### Observability
- Logging (structured JSON, provider)
- Metrics (Prometheus, CloudWatch, etc.)
- Tracing (OpenTelemetry, etc.)
- Error tracking (Sentry, Bugsnag, etc.)

### Secret Management
- Approach (env vars, vault, cloud secrets manager)
- Rotation strategy

---

## Decision Protocol

### Step 1 — Read constraints
Read `project.constraints.yaml`. The priority ranking is the primary filter:
- `cost` highest → choose managed platforms (Fly.io, Railway), serverless, SQLite
- `quality` highest → choose proven stacks with strong typing (TypeScript + Hono, Python + FastAPI)
- `security` highest → choose cloud-native with managed secrets, VPC, RBAC
- `ux` highest → invest in SSR/meta-framework for fast initial load

### Step 2 — Analyze story patterns
Read stories from Linear. Count:
- UI stories → need frontend framework
- API stories → need backend framework + database
- Integration stories → need queue/webhook/external API support
- Data-heavy stories → need strong ORM/migration tooling

### Step 3 — Check event storm
Read `docs/event-storm.yaml`. Identify:
- Bounded contexts → may need separate services or modules
- Command/query split → may need CQRS or read replicas
- External integrations → need HTTP client, retry, circuit breaker

### Step 4 — Produce ADR-001
Produce `docs/adr/ADR-001-platform.md` with all sections above. Each choice must include:
- What was chosen (concrete name + version if relevant)
- Why (tied to constraints, stories, or event storm)
- What alternatives were rejected and why

### Step 5 — Post to Linear
Post a comment on the inception story:
> "Platform ADR accepted: ADR-001. [Cloud] + [Language/Framework] + [Database] + [CI/CD]. Stories may proceed to development."

---

## State Model

This skill runs during inception Phase 7.

- `docs/adr/ADR-001-platform.md` — Phase 7 artifact
- All development stories reference this ADR for technology choices

For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Every choice must be concrete — no "TBD" or "team preference".
2. Every choice must tie back to `project.constraints.yaml` priorities.
3. The ADR must cover all 7 sections (cloud, backend, frontend, database, CI/CD, observability, secrets).
4. Alternatives must be listed with rejection reasons — not just "we chose X".
5. If `graphify` integration is enabled, use it to analyze the event storm structure.
6. This ADR is foundational — all subsequent ADRs must be compatible with it.
