# Forge

[![CI](https://github.com/loopworx/forge/actions/workflows/ci.yml/badge.svg)](https://github.com/loopworx/forge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@loopworx/forge.svg)](https://www.npmjs.com/package/@loopworx/forge)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Forge** is a lean software delivery framework for AI agents — from inception to production.

Where other agent frameworks hand you a coding assistant, Forge gives you an autonomous engineering organization: seven specialized agents, a shared delivery state machine, and a strict ATDD-first process built on battle-tested XP and Lean delivery practices.

Your agents don't just write code. They run discovery workshops, write INVEST-compliant user stories, make architecture decisions, implement vertical slices test-first, desk check each acceptance criterion, manage feature flags, and ship — continuously, to production, without you babysitting them.

---

## The Big Idea

Most agent frameworks start at "write code". Forge starts at "what are we building and why".

Every story in Forge traces back to a customer pain identified in an empathy map. Every acceptance criterion is testable through the UI alone — no backdoors, no database queries, no internal system access. Every feature ships behind a feature flag on trunk. Nothing goes to production that a QA agent and a PO agent haven't independently verified against the original acceptance criteria.

This is how high-performing software teams actually work. Forge encodes it as agent skills.

---

## The Seven Agents

| Agent | Owns |
|---|---|
| **po-agent** | Inception, story writing, backlog management, story acceptance |
| **ux-agent** | Empathy mapping, UX specs, frontend acceptance criteria |
| **architect-agent** | Architecture Decision Records, service boundaries, tech debt |
| **developer-agent** | ATDD loops, TDD inner loops, contract tests, feature flag code |
| **qa-agent** | Acceptance test authoring, desk checks, regression suite |
| **devops-agent** | CI/CD, environments, Unleash feature flags, deployments |
| **secops-agent** | Threat modeling, security ACs, SAST/DAST pipeline gates |

Each agent has a defined role, a default skill set, and a strict boundary. The developer agent doesn't make architecture decisions. The architect agent doesn't write production code. Roles are enforced, not suggested.

---

## The Delivery Lifecycle

### 1. Inception
The po-agent, ux-agent, and architect-agent facilitate an 8-phase structured discovery process:
1. **Lean Canvas** — problem, solution, unique value proposition
2. **Empathy Mapping** — understand the customer before writing a single requirement
3. **Trade-off Sliders** — team-wide prioritization: quality vs. cost vs. UX vs. security (no ties allowed)
4. **Event Storming** — interactive back-and-forth conversation mapping domain events, commands, policies, and UI elements. UI stickies become user stories. Policies and commands become acceptance criteria. The final phase produces `CONTEXT.md` — the project's ubiquitous language.
5. **UX/UI Design** — transforms event storm UI stickies and empathy map into a concrete design system (`design-system/MASTER.md`)
6. **Story Writing** — INVEST-compliant stories written to Linear as ready-for-dev
7. **Tech Stack + Architecture** — architect-agent produces ADR-001 (platform) and ADR-002 (code architecture) in sequence
8. **Iteration Mapping** — dependency graph → topological sort → iteration layers → Linear Projects + Cycles

### 2. Story Refinement
Every story passes a four-gate review before it's playable:
1. **PO drafts** — persona, customer value, rough acceptance criteria
2. **UX gate** — is this valuable? traces to empathy map pain point?
3. **Developer gate** — is this technically feasible? cost signal? estimable?
4. **QA gate** — is every AC testable through the UI alone, as an outside customer would test it?

Stories that fail any gate go back to the PO. Stories that pass land in their iteration's Linear Project as ready-for-dev.

All stories follow the **INVEST principle** and Mike Cohn's *User Stories Applied* — no technical detail in stories. Backend shape, API design, database schema all live in ADRs, not stories.

### 3. Iteration Zero
Before story 1 starts:
- architect-agent writes ADRs for iteration 1 stories
- devops-agent provisions CI/CD pipeline, test environment, and Unleash feature flag server
- qa-agent authors the acceptance test scaffold — first dummy Acceptance Test must be green on CI
- secops-agent wires SAST/DAST and secret scanning into the pipeline

Iteration 1 cannot start until the acceptance test scaffold is green on CI and a test environment is live.

### 4. Iteration N — The ATDD (Acceptance Test-Driven Development) Loop

ATDD is a collaborative practice where acceptance criteria are expressed as executable tests *before* any implementation begins. The outer Acceptance Test is the sole definition of done — everything else serves it.

For each story, the developer agent runs a strict process:

```
Outer Acceptance Test → RED

  For each sub-slice in the AC:
    FE inner loop: component test RED → GREEN → REFACTOR
    BE inner loop: CDC contract test RED → GREEN → REFACTOR
    Sub-slice complete ✓  (never batch FE loops then BE loops)

Outer Acceptance Test → GREEN
Desk check with QA (local first, then deployed environment)
```

One sub-slice at a time. One AC at a time. No implementation code before the outer Acceptance Test is RED and visible. No moving to the next sub-slice until the current one is fully green.

### 5. The Kanban Stages

Linear is the delivery state machine. There are two boards:

**Board 1 — Iteration Map (Linear Roadmap/Projects)**
One Project per iteration. Stories are assigned to iterations based on a topological sort of their dependency graph — stories with no dependencies go into Iteration 1, stories depending on Iteration 1 go into Iteration 2, and so on. This board is the backlog. Stories with no iteration assignment are unscoped.

**Board 2 — Delivery Board (Linear Cycle)**
The active iteration's stories move through the delivery state machine:

```
in-analysis          → story refinement (all four gates)
ready-for-dev        → any developer agent can pull (first available wins)
in-dev               → ATDD loop + desk check per AC
ready-for-qa         → story deployed to test environment; QA agent pulls
in-qa                → QA full regression suite
ready-for-acceptance → PO agent pulls
in-acceptance        → PO smoke tests all ACs
ready-to-deploy      → HUMAN approves flag flip
(done)               → feature flag on, Linear card closed
```

Bug cards found in in-qa or in-acceptance go directly to ready-for-dev — no refinement needed.

**Stories are pulled, not assigned.** The Forge plugin coordinator polls Linear for stories in pull states. When it finds one, it claims the story (moves it to the active state) and creates an agent session. Agents move stories forward when done and post handoff comments via Linear MCP for the next agent's context. If an agent forgets to update Linear state, the plugin's failsafe checks for a recent handoff comment — if one exists, it auto-advances with a warning; if not, it halts as `halted-ambiguous`.

**Iteration completion.** After completing a story, every agent checks: *"are all stories in this iteration done?"* If yes, the po-agent posts a completion notice on the Linear milestone and idles. A human PO reviews, then triggers the next iteration by activating the next Cycle. Iterations are variable duration — they end when done, not on a fixed date.

### 6. Iteration Scoping

Forge replaces velocity-based sprint planning with **dependency-driven iteration scoping**:

| Human team concept | Forge equivalent |
|---|---|
| Story points | AC count (1 AC ≈ 1 ATDD loop) |
| Team velocity | Max concurrent agents (human sets this) |
| Fixed-length sprint | Variable duration — iteration ends when all stories reach `done` |
| Planning poker | Architect agent flags stories with >5 ACs as split candidates |
| Sprint planning | Topological sort of dependency graph → iteration layers |

Parallel execution within an iteration is determined by story independence — stories in the same layer with no inter-story dependencies run simultaneously with separate developer agents.

### 7. Trunk-Based Continuous Deployment
No feature branches. Every push goes to production if CI is green — but unfinished stories are feature-flagged off via [Unleash](https://www.getunleash.io/) (self-hosted, open source). When a story is accepted, the human PO approves the flag flip and the feature is live.

---

## Ubiquitous Language

> *"With a ubiquitous language, conversations among developers and expressions of the code are all derived from the same domain model."*
> — Eric Evans, Domain-Driven Design

Agents dropped into a project with no shared vocabulary use 20 words where 1 will do. Forge solves this by generating `CONTEXT.md` as the final phase of every event storming session.

`CONTEXT.md` defines:
- **Domain terms** — canonical names for every entity, event, command, and policy discovered during event storming, with explicit "avoid" aliases
- **Bounded context boundaries** — which terms belong to which service/domain
- **Agent communication protocol** — the shared vocabulary of the delivery process itself (e.g. "outer Acceptance Test" not "E2E test", "desk check" not "demo", "sub-slice" not "partial implementation")
- **Flagged ambiguities** — terms that look like synonyms but aren't

`CONTEXT.md` lives in the repo root and is a **mandatory read for every agent at session start**. Any agent that encounters a term not in `CONTEXT.md` must stop and propose an addition before using it. The po-agent owns it; all agents can propose updates.

---

## Agent Session Start Protocol

Every agent, every session, in this order:

```
1. The Forge plugin coordinator polls Linear for stories in pull states
   (ready-for-dev, ready-for-qa, ready-for-acceptance, ready-to-deploy)
2. When a story is found, the plugin:
   a. Claims it (moves to active state: in-dev, in-qa, in-acceptance)
   b. Reads the last handoff comment from Linear
   c. Creates an agent session with a prompt that includes:
      - Story details + Linear state
      - Handoff comment from previous agent (if any)
      - Skill to load
      - Loop contract (LOOP.md content)
      - Cost tracking budget
      - Handoff protocol instructions
3. Agent works, then:
   a. Updates Linear state via MCP (linear_save_issue)
   b. Posts a compact handoff comment via MCP (linear_save_comment)
   c. Session ends → plugin reads new state → creates next agent session
```

No handoff notes. No plan files. No conversation summaries. State lives in Linear and the repo — not in context windows.

### Failsafe

If an agent ends its session without updating the Linear state:
1. Plugin checks for a recent handoff comment (posted during the session)
2. If comment exists → auto-advance story to next pull state with a warning
3. If no comment → halt story as `halted-ambiguous`

### Crash Recovery

If opencode crashes while sessions are active:
1. Plugin reads `.forge/sessions.json` on restart
2. Calls `client.session.list()` to find dead sessions
3. Checks Linear state for orphaned stories
4. Creates recovery sessions for stories still in active states

---

## Project Artifacts

Two files live in the repo root and are read by all agents:

```
CONTEXT.md                  # ubiquitous language — generated from event storming
project.constraints.yaml    # trade-off slider output — team priorities
```

Story content lives in Linear. A snapshot is committed to `stories/` when a story moves to ready-for-dev — at that point the story is locked and the snapshot never drifts.

---

## Skill Precedence

Forge uses an explicit three-level skill hierarchy to prevent the most common agent failure mode: rationalization over process.

```
L1 RIGID    → running-atdd-sessions, running-tdd-loops
              (these override everything; no exceptions)
L2 GUIDED   → writing-stories, facilitating-inception, deciding-architecture
              (structured process with human gates)
L3 MECH     → finishing-stories, managing-feature-flags
              (mechanical execution after L1/L2 complete)
```

An agent cannot rationalize "I'll just wire the handler first" — `running-atdd-sessions` is L1 and wins over plan files, conversation summaries, and implementation suggestions without exception.

---

## Verified by Loopkit

All 24 Forge skills are continuously verified by [loopkit](https://github.com/loopworx/loopkit) — a static analysis tool for agent skill contracts. Every SKILL.md, LOOP.md, and `.loopkit.yaml` passes **0 errors, 0 warnings** across all validators:

```bash
cargo install loopkit
loopkit . --verbose
# 24 skills checked. 0 error(s), 0 warning(s).
```

Loopkit validates state transitions, enforced states, handoff references, desk check patterns, bug feedback loops, progressive disclosure, naming conventions, terminology, and 10 other dimensions of skill quality.

---

## Skills Library

**Meta**
- `using-forge` — precedence rules, agent roles, session start protocol
- `resuming-sessions` — query Linear + read CONTEXT.md before anything else

**Discovery**
- `facilitating-inception` — 8-phase inception: lean canvas → empathy map → trade-off sliders → event storming → UX design → story writing → tech stack + architecture → iteration map
- `facilitating-event-storming` — interactive domain event discovery; final phase produces `CONTEXT.md`
- `establishing-ubiquitous-language` — generates and maintains `CONTEXT.md` from event storming output
- `designing-ux` — transforms event storm UI stickies + empathy map into a design system (`design-system/MASTER.md`)
- `writing-stories` — INVEST-compliant story writing with four-gate review
- `building-iteration-map` — topological sort of dependencies → Linear Projects + Cycles via MCP

**Architecture**
- `selecting-tech-stack` — decides platform (cloud, language, framework, database, CI/CD, observability) → ADR-001
- `establishing-architecture` — decides code structure (service boundaries, modules, folder layout, testing strategy) → ADR-002
- `deciding-architecture` — ADR authoring for individual decisions during development

**Iteration Zero**
- `bootstrapping-project` — CI/CD, repos, environments, Unleash setup
- `validating-test-harness` — gate skill: blocks iteration 1 until scaffold is green

**Development (L1 Rigid)**
- `running-atdd-sessions` — outer Acceptance Test RED → sub-slice loops → GREEN
- `running-tdd-loops` — FE component loop and BE CDC contract loop (CDC contracts live inside this loop)
- `managing-feature-flags` — Unleash REST API integration (lifecycle protocol called from delivery loops)

**Quality**
- `running-desk-checks` — per-AC verification, generates desk-check artifact, pauses for human
- `writing-acceptance-tests` — Playwright/Cypress, UI-interactions only, no backdoors
- `running-regression-suite` — full suite on test environment

**Acceptance & Delivery**
- `approving-stories` — PO smoke test against ACs
- `finishing-stories` — flag flip + Linear update + post-deploy security check
- `modeling-threats` — security ACs injected per story from project.constraints.yaml
- `securing-pipeline` — SAST/DAST/secret scanning gates

---

## Installation

### Quick Start (npm/bun)

```bash
# Install Forge globally
bun add -g @loopworx/forge
# or: npm install -g @loopworx/forge

# Initialize Forge in your project
cd my-project
forge init

# Configure Linear
# 1. Edit forge.yaml — add your Linear team_key and api_key
# 2. Authenticate with Linear MCP:
opencode mcp auth linear

# 3. Open opencode and run:
/forge new project
```

### From Source (development)

```bash
git clone https://github.com/loopworx/forge
cd forge
bun install
bun run bin/forge.ts init
```

### What `forge init` installs

| Path | Contents |
|------|----------|
| `.opencode/plugins/forge.ts` | The Forge plugin (coordinator) |
| `.opencode/agents/` | 7 agent definitions with skill permissions |
| `.opencode/skills/` | 24 skills (SKILL.md + LOOP.md) |
| `.opencode/commands/forge/` | Slash commands (`/forge new project`, `/forge.stop`, `/forge.status`, `/forge.approve`) |
| `forge.yaml` | PM configuration (Linear credentials, agent config, inception phases) |
| `opencode.json` | Linear MCP server config + plugin registration |

### Optional: External Tool Integrations

```bash
# UX design generation (used by ux-agent during Phase 5)
bash integrations/ui-ux-pro-max.sh

# Codebase knowledge graph (used by dev + architect agents)
bash integrations/graphify.sh

# Context compression MCP server
bash integrations/headroom.sh

# CDP browser control (used by qa-agent for desk checks)
bash integrations/browser-use.sh
```

---

## CI/CD

Forge has two GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`) — runs on every push/PR: typecheck → test → build → verify `forge init`
- **Release** (`.github/workflows/release.yml`) — runs on `v*` tags: typecheck → test → build → publish to npm → GitHub Release

```bash
# Run checks locally
bun run typecheck    # tsc --noEmit
bun test              # 87 tests
bun run build         # compile plugin to dist/
```

---

## Philosophy

- **Customer value first** — every story traces to an empathy map pain point; no story is written without it
- **Shared language** — agents and humans speak from the same domain model; `CONTEXT.md` is generated before the first story is written
- **INVEST or bust** — stories with technical detail, untestable ACs, or no clear customer value never reach the backlog
- **Test-first is non-negotiable** — the first file edit in any session is always a test file; implementation code is forbidden until the outer Acceptance Test is RED
- **Vertical slices** — every story is deployable end-to-end; no frontend-only or backend-only stories
- **Pull, don't push** — agents pull work when ready; no assignment, no queue management, no orchestrator
- **Trunk over branches** — feature flags make branches unnecessary; continuous deployment makes them dangerous
- **Agents have roles** — a developer agent that makes architecture decisions is a liability; role separation is enforced by skill design
- **State over memory** — agents query Linear and read repo artifacts; delivery state survives context windows

---

## Contributing

Forge skills follow [Anthropic's agent skill best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):
- Description field is the primary selection mechanism — write it first
- SKILL.md stays under 500 lines — use linked reference files for detail
- Add deterministic contract tests for the skill's state machine and handoff routes
- Skills are state machines with explicit gates, not knowledge documents

### Development Workflow

```bash
# Clone and install
git clone https://github.com/loopworx/forge
cd forge
bun install

# Make changes to src/, skills/, agents/, etc.

# Run checks (same as CI)
bun run typecheck    # tsc --noEmit (src/ + bin/)
bun test              # 87 tests across 4 files
bun run build         # compile plugin to dist/plugin.js

# Test forge init locally
mkdir /tmp/forge-test && cd /tmp/forge-test
bun run /path/to/forge/bin/forge.ts init
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make changes — ensure `bun run typecheck && bun test && bun run build` all pass
4. Submit a PR — CI will run the same checks

### Publishing a Release

Releases are automated via GitHub Actions:

```bash
# Tag a release
git tag v0.2.0
git push origin v0.2.0

# Release workflow runs: typecheck → test → build → npm publish → GitHub Release
```

The `NPM_TOKEN` secret must be set in GitHub repo settings for npm publishing.

---

## License

MIT — see LICENSE file.

---

*Forge is inspired by XP and Lean delivery practices, Eric Evans'* Domain-Driven Design, *Mike Cohn's* User Stories Applied, *and the hard lessons learned from watching AI agents skip the outer RED.*
