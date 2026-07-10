# Forge

[![Pipeline](https://github.com/loopworx/forge/actions/workflows/pipeline.yml/badge.svg)](https://github.com/loopworx/forge/actions/workflows/pipeline.yml)
[![npm version](https://img.shields.io/npm/v/@loopworx/forge.svg)](https://www.npmjs.com/package/@loopworx/forge)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![lint: oxlint](https://img.shields.io/badge/lint-oxlint-4B9CD3.svg)](https://oxc.rs)

**Forge** is an AI-driven software delivery orchestrator that coordinates seven specialized AI agents through a lean delivery pipeline — from inception to production. It uses Linear as the single source of truth and runs as a [pi.dev](https://pi.dev) extension with a deterministic workflow engine.

---

## Why Forge — Removing AI Slop

Forge is an attempt to create the perfect product team — a team of agents with
enforced roles, gated handoffs, and a feedback loop where every piece of work
is verifiable, gated, and recoverable. Seven agents — PO, UX, Architect,
Developer, QA, DevOps, SecOps — each own a defined slice of the delivery
pipeline and are blocked from operating outside it.

The outer acceptance test goes RED before any implementation code is written;
TDD inner loops drive each sub-slice green (FE then BE); a QA desk check
inspects every acceptance criterion through the UI exactly as a customer would;
a scoped regression suite guards adjacent flows; and PO acceptance verifies
shipped behavior against the original story intent. State lives in Linear —
visible and human-readable — never in plan files or conversation summaries,
which "lie." Loop pre-flights, failsafe auto-advance, crash recovery, and
commit-per-AC guarantee nothing is silently lost.

---

## How It Works

Forge is a pi.dev extension that registers custom tools (`forge_claim_story`,
`forge_complete_ac`, `forge_handoff`, `forge_create_artifact`,
`forge_log_progress`) callable by the LLM. A deterministic workflow engine
validates every state transition, serializes via FIFO queue, and writes to
Linear — ensuring agents can never skip steps or operate out of order.

1. **Install** — `forge init` drops the pi.dev extension, 7 agent profiles, 24 skills, and configures Linear auth
2. **Start** — Run `pi` in your project — the extension auto-loads, registers forge tools, and starts polling Linear
3. **Deliver** — The engine polls Linear for stories, claims them, creates agent sessions, and coordinates the delivery pipeline

There is no separate process or daemon. The extension loads when you start `pi`
and stops when you exit.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    pi.dev runtime                    │
│                                                      │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │  LLM Agent   │───▶│   Forge Extension (TS)    │  │
│  │  (glm-5.2)   │    │                            │  │
│  │              │◀───│  ┌──────────────────────┐ │  │
│  │  Calls forge │    │  │  Workflow Engine      │ │  │
│  │  tools       │    │  │  • State machine     │ │  │
│  └──────────────┘    │  │  • Claim queue (FIFO) │ │  │
│                      │  │  • Git proof validator│ │  │
│                      │  │  • Session manager    │ │  │
│                      │  └──────────┬───────────┘ │  │
│                      └─────────────┼─────────────┘  │
│                                    │                 │
│                      ┌─────────────▼─────────────┐  │
│                      │    Linear (GraphQL API)    │  │
│                      │    Stories, states, docs   │  │
│                      └───────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### The Seven Agents

| Agent | Owns |
|---|---|
| **po-agent** | Inception, story writing, backlog, story acceptance |
| **ux-agent** | Empathy mapping, UX specs, design system |
| **architect-agent** | Architecture Decision Records, service boundaries, tech debt |
| **developer-agent** | ATDD loops, TDD inner loops, contract tests, feature flags |
| **qa-agent** | Acceptance test authoring, desk checks, regression suite |
| **devops-agent** | CI/CD, environments, feature flags, deployments |
| **secops-agent** | Threat modeling, security ACs, SAST/DAST pipeline gates |

Each agent loads its assigned skills at session start. Roles are enforced by
the workflow engine — the developer agent doesn't make architecture decisions,
and the architect agent doesn't write production code.

### Forge Tools

The extension registers five tools callable by the LLM:

| Tool | Purpose |
|------|---------|
| `forge_claim_story` | Pull and claim the next available story for an agent role |
| `forge_complete_ac` | Mark an acceptance criterion as complete with git proof |
| `forge_handoff` | Hand off a story to the next stage with context summary |
| `forge_create_artifact` | Create a document artifact in Linear |
| `forge_log_progress` | Log progress on the current story |

---

## Installation

### Prerequisites

- [pi.dev](https://pi.dev) v0.80+ installed (`curl -fsSL https://pi.dev/install | sh`)
- [Bun](https://bun.sh) runtime
- A [Linear](https://linear.app) account with API access

### Quick Start

```bash
# Install globally
bun add -g @loopworx/forge
# or: npm install -g @loopworx/forge

# Initialize in your project
cd my-project
forge init

# Start pi.dev — the forge extension auto-loads
pi
```

### What `forge init` installs

| Path | Contents |
|------|----------|
| `.pi/extensions/forge.ts` | Forge extension entry point (imports from dist/) |
| `.forge/` | Persistence directory (sessions.json, auth.json) |
| `templates/agents/` | 7 agent profile definitions with skill assignments |
| `templates/skills/` | 24 skills (SKILL.md + LOOP.md each) |
| `templates/forge.yaml` | Config template — poll interval, concurrency, states |
| `forge.yaml` | Project config (created from template) |

### Configuration

`forge.yaml` supports both camelCase and snake_case:

```yaml
# Polling
pollInterval: 30        # seconds between Linear polls
pullStates:             # states to pull stories from
  - ready-for-dev
  - ready-for-qa

# Concurrency
maxConcurrentStories: 3

# Linear
linear:
  teamId: "team-abc123"
  teamName: "Engineering"

# Workflow states (all 14)
states:
  unstarted: unstarted
  inAnalysis: in-analysis
  readyForDev: ready-for-dev
  # ... etc
```

---

## Delivery Pipeline

Stories flow through Linear workflow states:

```
in-analysis → ready-for-dev → in-dev → ready-for-qa → in-qa
  → ready-for-acceptance → in-acceptance → ready-to-deploy → done
```

- **Stories are pulled, not assigned** — the engine polls for stories in pull states, claims them (pull → active), and creates agent sessions
- **Handoff comments** — agents post compact summaries to Linear; the next agent reads them as context
- **Failsafe** — if an agent forgets to update Linear state but posted a handoff comment, the engine auto-advances; if no comment, it halts as `halted-ambiguous`
- **Crash recovery** — on startup, the engine checks `.forge/sessions.json` for orphaned sessions and re-claims active ones
- **Commit per AC** — after each acceptance criterion goes green, the developer agent commits with `feat({STORY-ID}): AC{n} — {summary}` before desk check

### Delivery Lifecycle

1. **Inception** (8 phases) — PO, UX, and Architect agents facilitate structured discovery
2. **Story Refinement** — Four-gate review: PO drafts → UX value gate → developer feasibility → QA testability
3. **Iteration Zero** — CI/CD, environments, test harness scaffold, feature flags
4. **ATDD Loops** — Outer Acceptance Test RED → sub-slice TDD (FE + BE) → GREEN → desk check
5. **Kanban Flow** — Stories move through the Linear state machine independently
6. **Feature Flags + Trunk-Based CD** — Everything on trunk; unfinished stories behind flags

---

## Skills Library (24 skills)

**Meta**
- `using-forge` — precedence rules, agent roles, session start protocol
- `resuming-sessions` — query Linear + read CONTEXT.md before anything else

**Discovery** (8-phase inception)
- `facilitating-inception`, `facilitating-event-storming`, `establishing-ubiquitous-language`, `designing-ux`, `writing-stories`, `building-iteration-map`

**Architecture**
- `selecting-tech-stack`, `establishing-architecture`, `deciding-architecture`

**Iteration Zero**
- `bootstrapping-project`, `validating-test-harness`

**Development (L1 Rigid)**
- `running-atdd-sessions`, `running-tdd-loops`, `managing-feature-flags`

**Quality & Acceptance**
- `running-desk-checks`, `writing-acceptance-tests`, `running-regression-suite`
- `approving-stories`, `finishing-stories`

**Security**
- `modeling-threats`, `securing-pipeline`, `guarding-loops`

Each skill has a `SKILL.md` (instructions) and `LOOP.md` (loop protocol). All 24 are validated by 10 template tests.

---

## Development

```bash
# Clone
git clone https://github.com/loopworx/forge
cd forge
bun install

# Checks
bun run lint       # oxlint — 0 warnings, 0 errors
bun run typecheck  # tsc --noEmit
bun test           # 217 tests, 591 expect calls
bun run build      # bundle → dist/pi-bridge.js + dist/forge-bridge.js

# Test forge init locally
mkdir /tmp/forge-test && cd /tmp/forge-test
bun run /path/to/forge/bin/forge.ts init
```

### Project Structure

```
src/
├── engine/          # Deterministic workflow engine
│   ├── types.ts         # All types (WorkflowState, AgentRole, Story, etc.)
│   ├── interfaces.ts    # 13 interfaces (StoryRepository, AgentRuntime, etc.)
│   ├── events.ts        # EngineEventBus + 11 event types
│   ├── state-machine.ts # 14-state Linear workflow state machine
│   ├── claim-queue.ts   # FIFO serialization for concurrent claims
│   ├── workflow-engine.ts  # Main engine: claimStory, completeAc, handoff
│   ├── file-persistence.ts # .forge/ state persistence
│   ├── memory-persistence.ts
│   ├── system-clock.ts / fake-clock.ts
│   ├── config-loader.ts    # YAML config with camelCase/snake_case
│   ├── session-manager.ts
│   └── git-proof-validator.ts
├── bridge/          # pi.dev bridge layer
│   ├── pi-bridge.ts           # Main extension entry point
│   ├── forge-bridge.ts        # opencode bridge (alternative runtime)
│   ├── pi-dev-runtime.ts      # AgentRuntime impl wrapping ExtensionAPI
│   ├── pi-dev-session-manager.ts
│   ├── create-pi-composition.ts  # Dependency wire-up + tool registration
│   ├── harness-detector.ts
│   ├── claude-bridge.ts       # Claude bridge (stub)
│   └── opencode-bridge.ts     # opencode bridge (stub)
├── linear/          # Linear integration
│   ├── linear-story-repository.ts    # GraphQL + OAuth
│   └── linear-document-repository.ts
├── dashboard/       # TUI dashboard components
│   ├── forge-layout.ts       # Orchestrator with auto-cycling
│   ├── split-layout.ts       # SplitLayout + Sidebar + AgentPanel
│   ├── forge-sidebar.ts
│   ├── forge-agent-panel.ts
│   ├── forge-chat-bar.ts
│   └── dashboard-event-bridge.ts
├── config/          # Config management
│   └── config-loader.ts
├── prompts/         # Agent prompt builder
│   └── prompt-builder.ts
└── cli/             # CLI commands
    └── project-initializer.ts
```

### Pipeline

Every push to main runs a single sequential pipeline:

```
build → (typecheck ‖ lint) → test → release
```

The release job auto-increments the npm version, publishes, creates a git tag,
and generates a GitHub Release with commit history as release notes.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Ensure `bun run lint && bun run typecheck && bun test && bun run build` pass
4. Submit a PR

---

## License

MIT — see [LICENSE](LICENSE).
