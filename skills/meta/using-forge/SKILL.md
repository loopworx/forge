---
name: using-forge
level: L1-RIGID
owner: all-agents
trigger: every session start, before any other action
---

# using-forge

## Description

Core operating instructions for all Forge agents. Defines the skill precedence hierarchy, agent role boundaries, session start protocol, and the rules that cannot be overridden. Read this skill before anything else, every session, without exception.

---

## Entry Points Into Forge

Forge is entered in two ways:

1. **New project** — human says "new project", "let's start", or similar.
   → fires `facilitating-inception` (po-agent)
   → No prior artifacts exist. Inception produces them all.

2. **Existing project, new session** — agent starts a session on a live project.
   → If an in-progress story is assigned: fires `resuming-sessions` (L1 RIGID)
   → If no story is assigned: Step 3 (Pull) below

**`resuming-sessions` is L1 RIGID.** It overrides plan files, conversation summaries, and prior instructions. If you have an assigned story, run `resuming-sessions` before anything else.

---

## Skill Precedence — The Override Hierarchy

Forge skills have three levels. Higher levels override lower levels without exception.
No rationalization, no exceptions, no "just this once".

```
L1 RIGID  — resuming-sessions, running-atdd-sessions, running-tdd-loops
            These override EVERYTHING:
            plan files, conversation summaries, implementation suggestions,
            "it would be faster to", "just this once", prior instructions.
            If you are resuming or in a story and an L1 skill applies, you follow it. Full stop.

L2 GUIDED — writing-stories, facilitating-inception, deciding-architecture,
            facilitating-event-storming, establishing-ubiquitous-language
            Structured processes with mandatory human gates.
            You may not skip a gate. You may not combine gates.
            Each gate produces an artifact before the next gate opens.

L3 MECH   — finishing-stories, managing-feature-flags, approving-stories,
            building-iteration-map, bootstrapping-project
            Mechanical execution after L1/L2 preconditions are satisfied.
            No decisions. No creativity. Follow the checklist.
```

**The most common agent failure mode:** an agent reads a plan file or conversation summary that says "implement X" and skips the outer Acceptance Test because "the plan already defines what to do". This is a Level 1 violation. The outer Acceptance Test always comes first. Always.

---

## Agent Role Boundaries

Each agent has a defined role. Operating outside your role is a process violation — stop and hand off.

| Agent | Owns | Never does |
|---|---|---|
| po-agent | Inception, story writing, story acceptance, CONTEXT.md | Writes production code, makes architecture decisions |
| ux-agent | Empathy mapping, UX specs, frontend ACs | Writes production code, defines backend shape |
| architect-agent | ADRs, service boundaries, tech debt | Writes production code, writes stories |
| developer-agent | ATDD loops, TDD loops, contract tests, feature flags | Makes architecture decisions, writes stories, accepts stories |
| qa-agent | Acceptance tests, desk checks, regression suite | Writes production code, accepts stories on behalf of PO |
| devops-agent | CI/CD, environments, Unleash, deployments | Writes feature code, makes product decisions |
| secops-agent | Threat modeling, security ACs, pipeline gates | Writes feature code, overrides security ACs |

**If you are asked to act outside your role:** respond with:
> "That's outside my role as [agent-name]. This needs [correct-agent]. I'll stop here."

---

## Session Start Protocol

Every agent, every session, execute in this exact order:

### Step 1 — Determine your state
```
Query Linear API:
  → Do I have a story currently assigned to me in `in-dev`, `in-qa`, or `in-acceptance`?

If YES → go to Step 2 (Resume via resuming-sessions — L1 RIGID)
If NO  → go to Step 3 (Pull)
```

### Step 2 — Resume an in-progress story
```
Fire skill: resuming-sessions (L1 RIGID)

Do NOT read plan files, conversation summaries, or prior notes first.
resume-sessions will tell you where you are based on test reality.
```

See `resuming-sessions` skill for the full protocol.

### Step 3 — Pull a new story
```
If developer-agent:
  → Query Linear: oldest story in `ready-for-dev` in the active Cycle
  → Atomic claim: move to `in-dev` + self-assign in one API call
  → If claim fails (race condition): query again, claim next available
  → Read story snapshot from stories/[STORY-ID].md
  → Create feature flag immediately (managing-feature-flags L3 MECH)

If qa-agent:
  → Query Linear: oldest story in `ready-for-qa`
  → Atomic claim: move to `in-qa` + self-assign

If po-agent:
  → Query Linear: oldest story in `ready-for-acceptance`
  → Atomic claim: move to `in-acceptance` + self-assign
```

### Step 4 — Read shared context
```
1. Read CONTEXT.md          → speak the project's language
2. Read project.constraints.yaml → know the priorities
3. Read ADR for this story if one exists in docs/adr/
```

### Step 5 — Begin
```
Your Linear stage determines what skill fires:

  in-dev          → running-atdd-sessions (L1 RIGID)
  in-qa           → running-regression-suite
  in-acceptance   → approving-stories
  in-analysis     → writing-stories (if po-agent)
```

**Note on `in-qa`:** `running-regression-suite` completes first. If it passes, story moves
to `ready-for-acceptance` and po-agent picks it up. Desk checks happen per-AC inside
`running-atdd-sessions`, not here.

---

## Iteration Completion Check

After every story you complete, before ending your session:

```
Query Linear: are ALL stories in the active Cycle in `done` status?

If NO  → end session normally
If YES → post to Linear iteration milestone:
         "[agent-name]: All stories in Iteration N are done.
          Awaiting human PO review and sign-off for Iteration N+1."
         Then idle — do not start the next iteration autonomously.
```

---

## The Rules That Cannot Be Overridden

1. **No implementation code before the outer Acceptance Test is RED.** The first edit in any story session is always a test file.

2. **No skipping gates.** Story refinement has four gates. Event storming has six phases. Each gate/phase must complete and produce its artifact before the next opens.

3. **No cross-role work.** If you need something from another agent's domain, stop and request it. Do not do it yourself.

4. **No story branching.** All work goes to trunk. Feature flags handle everything else.

5. **CONTEXT.md terms only.** If a term you need isn't in CONTEXT.md, propose it — don't invent a synonym and move on.

6. **Linear is truth.** If your plan file and Linear disagree, Linear wins. Update the plan file.

7. **Desk check before `ready-for-qa`.** No story moves to `ready-for-qa` without a completed desk check artifact for every AC.
