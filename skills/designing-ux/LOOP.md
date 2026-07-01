# designing-ux — Loop

The L2-GUIDED UX design loop. Transforms event storming output and
empathy maps into a concrete design system. Produces
`design-system/MASTER.md` as the single source of truth for all visual
and interaction decisions.

## Entry Conditions

- Inception Phase 5 is active (after event storming, before story
  writing).
- `docs/empathy-map.md` exists and is human-approved.
- `docs/event-storm.yaml` exists and contains UI stickies.
- `CONTEXT.md` and `project.constraints.yaml` are readable.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Local file state:

- `ui_stickies_extracted` — list of UI surfaces from event storm.
- `color_palette_defined` — boolean.
- `typography_defined` — boolean.
- `component_patterns_count` — integer.
- `accessibility_checked` — boolean.
- `priorities` — copied from `project.constraints.yaml`.

## Single Iteration Step

1. Extract UI stickies from `docs/event-storm.yaml`. Each sticky is a
   screen or component requirement.
2. Read `docs/empathy-map.md`. Choose a visual language that matches
   the user's emotional context (frustrated → calm, excited → vibrant,
   professional → conservative).
3. Read `project.constraints.yaml`. If `ux` outranks `cost`, invest in
   rich interactions. If `cost` outranks `ux`, keep it minimal.
4. Define the color palette: primary, secondary, accent, neutral,
   semantic (success/warning/error/info). Each with hex values and
   contrast ratios.
5. Define typography: font families, size scale, line heights, font
   weights.
6. Define spacing scale (base unit + multipliers).
7. Define component patterns: buttons (4 variants × 4 states), forms
   (inputs, selects, validation), cards, modals, toasts, empty states,
   navigation.
8. Define interaction states: loading skeletons, error boundaries,
   success confirmations, empty states.
9. Verify accessibility: WCAG AA contrast on all text, minimum touch
   targets, focus ring specification.
10. Write `design-system/MASTER.md` with all sections.
11. Post summary to Linear on the inception story.

## Proof of Progress

- `design-system/MASTER.md` exists with all sections populated.
- Every color has a hex value (no named colors).
- Every size is in pixels or rem (no vague descriptors).
- WCAG AA contrast verified on all text/background combinations.
- At least [N] component patterns defined (one per UI sticky from event
  storm).

## State Transition Rule

```
transition inception-phase-4 → inception-phase-5
  trigger event storm YAML + CONTEXT.md committed
  handoff designing-ux to ux-agent

transition inception-phase-5 → inception-phase-6
  trigger design-system/MASTER.md committed
  handoff writing-stories to po-agent
```

## Halt Conditions

- `docs/empathy-map.md` missing → halt; route back to Phase 2.
- `docs/event-storm.yaml` missing → halt; route back to Phase 4.
- `project.constraints.yaml` priorities missing → halt; route back to
  Phase 3.
- A `guarding-loops` `halted-*` report → stop; do not modify design
  system.
- UI sticky count is zero (no UI in this project) → skip this phase;
  proceed to Phase 6.

## Handoff Target

- Design system complete → `writing-stories` (po-agent) begins Phase 6.
  Every UI story produced must reference `design-system/MASTER.md`.
- If `ui-ux-pro-max` integration is enabled, use it to generate
  component scaffolding from the design system.
