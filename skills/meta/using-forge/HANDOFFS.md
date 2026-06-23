# using-forge — Handoff Map

This is the master handoff reference. Every skill transition in the delivery process is listed here.

Phase numbers in parentheses refer to the internal phase numbering of the named skill, not a global sequence.
Read each skill's SKILL.md to see its phases defined.

---

## Entry Points

```
<<human: new project>>
  └→ facilitating-inception (po-agent)

<<human: new session, story already assigned to me>>
  └→ resuming-sessions (any-agent) — L1 RIGID — fires before anything else

<<human: new session, no story assigned>>
  └→ using-forge pull protocol (Step 3 below)
```

---

## Pull Protocol (Step 3)

```
developer-agent:
  └→ story claimed from ready-for-dev [ready-for-dev → in-dev]
       └→ managing-feature-flags (create flag; confirm OFF)
       └→ running-atdd-sessions (L1 RIGID)

qa-agent:
  └→ story claimed from ready-for-qa [ready-for-qa → in-qa]
       └→ running-regression-suite

po-agent:
  └→ story claimed from ready-for-acceptance [ready-for-acceptance → in-acceptance]
       └→ approving-stories
```

---

## Full Skill Graph

```
facilitating-inception
  └→ inception Phase 4 (Event Storming)    → facilitating-event-storming (po-agent + ux-agent)
  └→ inception Phase 5 (Story Writing)     → writing-stories (po-agent)
  └→ inception Phase 6 (Iteration Mapping) → building-iteration-map (po-agent)

facilitating-event-storming
  └→ event-storming Phase 6 (Ubiquitous Language) → establishing-ubiquitous-language (po-agent)
  └→ on complete (all 6 phases done)               → writing-stories (po-agent)

establishing-ubiquitous-language
  └→ on complete → CONTEXT.md committed; unblocks all agents

writing-stories
  └→ all 4 gates pass, no security surface → building-iteration-map (po-agent)
  └→ any gate fails                         → back to Gate 1 (same skill, po-agent)
  └→ story has security surface             → threat-modeling (secops-agent) before ready-for-dev

threat-modeling
  └→ security ACs injected  → writing-stories Gate 4 (po-agent)
  └→ story cannot be safe   → writing-stories back to in-analysis (po-agent)

building-iteration-map
  └→ on complete  → bootstrapping-project (devops-agent) [Iteration 0]
  └→ concurrent   → deciding-architecture (architect-agent) [Iteration 1 ADRs]

bootstrapping-project
  └→ concurrent on start      → securing-pipeline (secops-agent + devops-agent)
  └→ checklist complete       → validating-test-harness (qa-agent)

securing-pipeline
  [terminal — setup skill; gates run automatically on every push after configuration]

validating-test-harness
  └→ concurrent in Iter 0  → writing-acceptance-tests (qa-agent) [dummy harness test]
  └→ PASS                  → Iteration 1 opens; developer-agents pull via using-forge Step 3
  └→ FAIL                  → bootstrapping-project (devops-agent)

writing-acceptance-tests
  └→ outer AT written + RED → running-atdd-sessions (developer-agent)

deciding-architecture
  └→ ADR accepted           → running-atdd-sessions resumes (developer-agent)
  └→ ADR changes story scope → writing-stories back to in-analysis (po-agent)

resuming-sessions
  └→ outer AT RED on resume        → running-atdd-sessions (developer-agent)
  └→ outer AT GREEN unexpectedly   → STOP; post to Linear; await human

running-atdd-sessions
  └→ each sub-slice               → running-tdd-loops (developer-agent) [returns to caller]
  └→ each AC outer AT GREEN       → running-desk-checks (qa-agent) [in-dev → ready-for-deskcheck]
  └→ desk check approved          → next AC (same skill, loop)
  └→ all ACs + desk checks done   → running-regression-suite (qa-agent) [story → ready-for-qa] [in-dev → ready-for-qa]
  └→ architecture decision needed → deciding-architecture (architect-agent) [pauses]

running-tdd-loops
  [returns to running-atdd-sessions — never exits to a different pipeline skill]

running-desk-checks
  └→ APPROVED → running-atdd-sessions (developer-agent) [ready-for-deskcheck → in-deskcheck → in-dev]
  └→ FAILED   → running-atdd-sessions (developer-agent) [fix + re-trigger same AC]

running-regression-suite
  └→ PASS → approving-stories (po-agent) [story → ready-for-acceptance] [in-qa → ready-for-acceptance]
  └→ FAIL → story → ready-for-dev; developer-agent pulls via using-forge Step 3

approving-stories
  └→ PASS → finishing-stories (po-agent + devops-agent) [story → ready-to-deploy; HUMAN gate] [in-acceptance → ready-to-deploy]
  └→ FAIL → story → ready-for-dev; developer-agent pulls via using-forge Step 3

finishing-stories
  └→ flag flip + smoke PASS → story → done; iteration completion check [ready-to-deploy → done]
  └→ smoke FAIL             → flag OFF; story → ready-for-dev; developer-agent pulls via using-forge Step 3
  └→ all stories done       → STOP; post iteration completion notice; await human

managing-feature-flags
  [lifecycle protocol — called at story pull, finishing-stories; no pipeline outbound]
```
