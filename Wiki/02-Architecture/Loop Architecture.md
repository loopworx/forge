# Loop Architecture

#architecture

## The Perfect Loop

Forge aims for a uniform loop contract across all skills:

1. **Entry Conditions**
2. **Loop State Schema**
3. **Single Iteration Step**
4. **Proof of Progress**
5. **State Transition Rule**
6. **Halt Conditions**
7. **Handoff Target**

## Nested Loop Stack

| Loop | Scope | Primary Owner |
|---|---|---|
| Iteration Board Loop | Whole project across iterations | po-agent / main conductor |
| Inception Loop | New project setup | po-agent + ux-agent |
| Event Storming Loop | Discovery inside inception | po-agent + ux-agent |
| Story Writing Loop | Per story candidate | po-agent |
| Iteration Mapping Loop | Dependency planning | po-agent |
| Delivery Loop | Per story through release | developer / qa / po agents |

## Operational State Files

- `docs/inception.loop.md`
- `docs/iteration-board.loop.md`
- `stories/[STORY-ID].loop.md`

## State Machine

```
in-analysis → ready-for-dev → in-dev → ready-for-deskcheck → in-deskcheck
→ ready-for-qa → in-qa → ready-for-acceptance → in-acceptance → ready-to-deploy → done
```

See [[State Transition Protocol]] for rules.
