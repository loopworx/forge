# resuming-sessions — Handoffs

This is the session resume entry point. It fires before any other delivery skill
when a session starts with an in-progress story already assigned to the agent.

---

## Inbound

- `<<human: new session, story already assigned to me>>`
- Pre-requisite: `loop-guardian` pre-flight must clear this iteration.

---

## Outbound by current state

### `in-dev` → continue ATDD loop

```
resuming-sessions
  └→ outer AT RED, story still assigned and in-dev → running-atdd-sessions (developer-agent) [in-dev → in-dev]
```

### `in-qa` → continue QA regression path

```
resuming-sessions
  └→ outer AT RED, story still assigned and in-qa → running-regression-suite (qa-agent) [in-qa → in-qa]
```

### `in-acceptance` → continue PO acceptance path

```
resuming-sessions
  └→ outer AT RED, story still assigned and in-acceptance → approving-stories (po-agent) [in-acceptance → in-acceptance]
```

### Story no longer assigned / no longer in progress → fallback pull

```
resuming-sessions
  └→ story unassigned or not in-progress → using-forge (any-agent) [in-dev → ready-for-dev]
  └→ story unassigned or not in-progress → using-forge (any-agent) [in-qa → ready-for-dev]
  └→ story unassigned or not in-progress → using-forge (any-agent) [in-acceptance → ready-for-dev]
```

### Unexpected GREEN on resume → human gate

```
resuming-sessions
  └→ outer AT unexpectedly GREEN → STOP; post to Linear; await human
```

---

## Return protocol

If the agent is called back into `resuming-sessions` after a handoff, re-run the
same protocol from the top: query Linear, run outer AT, route based on state.
