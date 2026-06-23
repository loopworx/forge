# State Transition Protocol

#process

## Rules

1. Every external state transition must be **atomic** when the tool allows it.
2. No agent may act on remembered state; re-read Linear before a transition.
3. If Linear and a loop file disagree, Linear wins and the loop file is repaired.
4. Every transition must write a matching loop-state update in the same iteration step.
5. A handoff is incomplete unless it includes state change, artifact reference, and environment reference where applicable.

## Human Gates

1. Inception start
2. Iteration map approval
3. Iteration start
4. Ready to deploy to production
5. Iteration completion / retrospective
6. Unexpected state or crash
7. Unsafe feature discovered during threat modeling
