---
name: managing-feature-flags
level: L3-MECH
owner: developer-agent, devops-agent
trigger: story creation; story completion; production release
category: acceptance-delivery
description: Manages feature flags throughout the story lifecycle — creation, toggling, and retirement
---

# managing-feature-flags

## Description

Defines the lifecycle of feature flags for every story. Every unfinished story is protected by a flag on trunk. Flags are created early, default OFF, tested in controlled environments, and only enabled in production after PO acceptance and human approval.

---

## Naming

Use stable, descriptive names:
`story-[story-id]-[capability-slug]`

Example:
`story-123-order-shipped`

---

## Lifecycle

1. **Story created** → reserve flag name in Linear
2. **Story enters in-dev** → ensure code paths are guarded by flag
3. **Story in test environment** → verify OFF by default, verify ON when needed
4. **Story ready-to-deploy** → flag remains OFF in production
5. **Human approval** → flip ON in production
6. **After soak period** → remove stale flag in a cleanup story

---

## Rules

- No unfinished behavior exposed without a flag
- Flag defaults OFF unless explicitly approved otherwise
- Flags are temporary delivery mechanisms, not permanent product configuration
- Create cleanup stories for long-lived flags

## State Model

This skill manages the lifecycle state of each story's feature flag.

- Story created → flag name reserved in Linear
- Story in `in-dev` → flag created and OFF
- Story in test environment → flag verified OFF by default, verified ON
- Story in `ready-to-deploy` → flag remains OFF in production
- Human approves go-live → flag flipped ON in production
- After soak period → flag retired via cleanup story

