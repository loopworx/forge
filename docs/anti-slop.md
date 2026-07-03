# How Forge Removes AI Slop

Forge is an attempt to create the perfect product team — a team of agents with
enforced roles, gated handoffs, and a feedback loop where every piece of work
is verifiable, gated, and recoverable. The result is that AI slop —
untested code, hallucinated progress, silent state drift, role confusion,
skipped reviews — cannot accumulate silently. Each failure mode below is
matched to the skill or plugin mechanism that blocks it.

The 20 mechanisms are ordered by where they fire in the delivery lifecycle,
from inception (before any code is written) through acceptance and release,
followed by cross-cutting state-integrity and process guardrails that run
throughout.

---

## Inception (before any code)

| # | Mechanism | Slop it kills | Enforced by |
|---|---|---|---|
| 1 | 8-phase inception before any code is written (lean canvas → empathy map → trade-off sliders → event storm → UX → stories → tech stack → iteration map) | AI starts coding before understanding the problem | `facilitating-inception` — each phase produces an artifact and requires human approval before the next opens |
| 2 | Ubiquitous language in `CONTEXT.md`; propose new terms instead of inventing synonyms | AI uses 20 words for one thing, or one word for two things → subtle bugs and miscommunication | `establishing-ubiquitous-language` — agents must STOP on undefined terms and wait for po-agent to update `CONTEXT.md` |

## Story refinement

| # | Mechanism | Slop it kills | Enforced by |
|---|---|---|---|
| 3 | Four-gate story review: PO draft → UX value → developer feasibility → QA testability | AI builds the wrong thing from a vague prompt | `writing-stories` — any gate failure returns the story to Gate 1 |
| 4 | Threat modeling injects security ACs before development; SAST/DAST gates in CI | AI ships insecure code with no security review | `modeling-threats` + `securing-pipeline` — security is visible ACs, not a hidden checklist; stories return to `in-analysis` if they cannot be made safe |

## Development

| # | Mechanism | Slop it kills | Enforced by |
|---|---|---|---|
| 5 | Outer acceptance test goes RED before any implementation code is written | AI generates code that may or may not work | `running-atdd-sessions` (L1-RIGID) — "I know it will be RED" is not sufficient; run it, see it fail |
| 6 | TDD inner loops drive each sub-slice green, FE then BE, one at a time | AI writes a pile of code then claims it's done | `running-atdd-sessions` + `running-tdd-loops` — no batching, no moving on until the current sub-slice is fully GREEN |
| 7 | Commit-per-AC pushed before desk check | AI claims done but nothing is in the repo | `running-atdd-sessions` + `guarding-loops` — Guardian verifies the `feat({STORY-ID}): AC{n}` commit exists via `git log` |
| 8 | Loop pre-flight on every iteration: re-read Linear, check stall counters, budget limits, commit presence | AI loops forever, runs unsafe, or drifts | `guarding-loops` (L1-RIGID) — halts with an explicit reason on any failure; no rationalization, no overrides |
| 9 | Test reality over plan files on resume | AI hallucinates progress from conversation summaries | `resuming-sessions` (L1-RIGID) — "Only the test suite reflects reality. Everything else lies." Outer AT runs first; if unexpectedly GREEN, halt for human review |
| 10 | Seven agents with enforced role boundaries (developer can't make architecture decisions; architect can't write production code) | AI does everything poorly instead of one thing well | `using-forge` — "If you are asked to act outside your role, stop and hand off" |
| 11 | L1-RIGID skill precedence overrides plan files, conversation summaries, and "just this once" | AI talks itself into skipping the rules | `using-forge` — "No rationalization, no exceptions, no 'just this once'" |
| 12 | Feature flags + trunk-based CD; no story branches | AI creates long-lived branches that diverge and rot | `managing-feature-flags` — everything on trunk, unfinished behind flags |

## QA

| # | Mechanism | Slop it kills | Enforced by |
|---|---|---|---|
| 13 | Desk check per AC through the UI as a customer would (local + test env, UI only, no DB/API inspection) | AI says it's done but nobody verified | `running-desk-checks` — developer is blocked from the next AC until approved; on failure, story returns to `in-dev` |
| 14 | Scoped regression suite (story + adjacent flows + security-sensitive) with exact repro steps on failure | AI ships a feature that breaks adjacent flows | `running-regression-suite` — failures return the story to `ready-for-dev` with repro steps |

## Acceptance & release

| # | Mechanism | Slop it kills | Enforced by |
|---|---|---|---|
| 15 | PO acceptance verifies shipped behavior against original story intent, through the UI on the test environment | AI solves a different problem than asked | `approving-stories` — every AC must behave as written; fail → back to `ready-for-dev` |
| 16 | Human gates at every phase (inception phases, story gates, desk checks, PO acceptance, release approval) | AI runs unchecked end-to-end | `facilitating-inception` / `writing-stories` / `running-desk-checks` / `approving-stories` — each gate delivers an artifact before the next opens |

## Cross-cutting (state integrity + process guardrails)

| # | Mechanism | Slop it kills | Enforced by |
|---|---|---|---|
| 17 | Linear as the visible state spine — "Linear is truth; if your plan file and Linear disagree, Linear wins" | AI state is invisible to humans | `using-forge` — all story state lives in Linear, visible in the UI; plan files are corrected, not trusted |
| 18 | Failsafe auto-advance + `halted-ambiguous` on idle | AI silently loses state between sessions | `plugin.ts` `handleFailsafe` — reads the last Linear comment; auto-advances on a handoff within 2 min, halts as `halted-ambiguous` if none |
| 19 | Crash recovery on startup re-claims orphaned sessions | AI crash = lost or duplicated work | `plugin.ts` `recoverOrphanedSessions` — reads `.forge/sessions.json`, reconciles against opencode sessions, re-claims or marks done |
| 20 | loopkit static analyzer validates all 24 skill contracts on every push (state transitions, enforced states, handoff references, desk-check patterns, bug feedback loops, naming, terminology) | The process itself drifts into slop over time | CI — `loopkit .` runs on every push; 24 skills checked, 0 errors tolerated |

---

## The feedback loop in one paragraph

The outer acceptance test goes RED → TDD inner loops drive each sub-slice
green → the developer commits and pushes per AC → QA desk-checks the AC
through the UI → regression guards adjacent flows → PO accepts against
original intent → release. Every transition is recorded in Linear; every
resume re-runs the test suite, not the plan file; every loop iteration is
pre-flighted; every crash is recovered. The loop is closed, observable, and
self-correcting — which is what makes it a product team rather than a
collection of agents.
