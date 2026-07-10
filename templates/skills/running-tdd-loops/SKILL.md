---
name: running-tdd-loops
level: L1-RIGID
owner: developer-agent
trigger: within running-atdd-sessions, for each sub-slice
metadata:
  category: development
description: Runs TDD inner loops for FE components and BE CDC contracts within an ATDD session
---

# running-tdd-loops

## Description

The inner TDD loop within an ATDD session. Runs RED-GREEN-REFACTOR for both the FE component loop and the BE CDC contract loop for a single sub-slice. Called by running-atdd-sessions — do not call directly.

---

## FE Component Loop

```
1. Identify the smallest UI component change this sub-slice requires
2. Write a component test (React Testing Library / Vue Test Utils / etc.)
   Test must: render the component, simulate the interaction, assert the outcome
   Test must: fail RIGHT NOW — run it, see RED
3. Write the minimum component code to make it pass
   No extra props. No future-proofing. No "while I'm here".
4. Run the test → GREEN
5. Refactor: remove duplication, improve naming
   Run the test again → still GREEN
6. FE sub-slice done
```

**Minimum means minimum.** If the test passes with a hardcoded value, that's fine for now — the BE loop and later sub-slices will force it to be real.

---

## BE CDC Contract Loop

```
1. Identify the API contract this sub-slice requires
   (endpoint, request shape, response shape)
2. Write a CDC (Consumer-Driven Contract) test
   The FE is the consumer. The test asserts the contract from the FE's perspective.
   Test must: fail RIGHT NOW — run it, see RED
3. Write the minimum BE handler/service/repo to satisfy the contract
   No extra fields. No speculative generality.
4. Run the test → GREEN
5. Refactor: clean up the handler, extract service layer if needed
   Run the test again → still GREEN
6. BE sub-slice done
```

---

## Refactor Rules

- Refactor means: improve the code without changing behaviour
- The test must stay GREEN throughout refactoring
- If you find yourself adding new behaviour during refactor: STOP
  That's a new sub-slice. Add it to the story snapshot and continue the loop.
- DRY applies. YAGNI applies. "Clever" code does not.

## State Model

This skill operates on a single sub-slice while the story is `in-dev`.

- `in-dev` — parent story state
- Sub-slice status: pending, in-progress, `done`
- Component test state: RED → GREEN → REFACTOR
- CDC contract test state: RED → GREEN → REFACTOR


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Write the smallest possible test that fails (RED).
2. Write the minimum production code needed to pass (GREEN).
3. Refactor only while the test stays GREEN.
4. FE loop runs before BE loop for each sub-slice.
5. Stop refactoring if new behaviour appears and add it as a new sub-slice.
6. Return to `running-atdd-sessions` after each FE and BE loop completes.

## Entry Conditions

- Called by `running-atdd-sessions` for a sub-slice.
- Parent outer Acceptance Test is RED.

## Halt Conditions

- FE inner loop (RED → GREEN → REFACTOR) is complete and returns to caller.
- BE inner loop (RED → GREEN → REFACTOR) is complete and returns to caller.
- New behaviour is discovered during refactor; new sub-slice is recorded and skill returns to caller.
