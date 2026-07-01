---
name: designing-ux
level: L2-GUIDED
owner: ux-agent
trigger: inception Phase 5; after event storming produces UI stickies
metadata:
  category: discovery
  description: Generates the design system from event storming output — colors, typography, patterns, components
---

# designing-ux

## Description

Transforms event storming output into a concrete design system. Reads the empathy map, event storm, and CONTEXT.md to produce `design-system/MASTER.md` — a single source of truth for colors, typography, spacing, component patterns, and interaction states. Every UI story produced later must reference this design system.

---

## When This Skill Fires

Run this skill when:
- Inception Phase 5 is active (after event storming, before story writing)
- The event storm YAML contains UI stickies
- `docs/empathy-map.md` and `docs/event-storm.yaml` exist

Do NOT run this skill for:
- Backend-only stories with no UI component
- Re-skinnning existing design systems (use a dedicated refactoring story instead)

---

## Input Artifacts

Read these before starting:
1. `docs/empathy-map.md` — user pains, gains, emotions
2. `docs/event-storm.yaml` — UI stickies, command/query boundaries
3. `CONTEXT.md` — ubiquitous language
4. `project.constraints.yaml` — priority ranking (UX vs cost vs quality)

---

## Output

`design-system/MASTER.md` containing:

### Color Palette
- Primary, secondary, accent, neutral, semantic (success/warning/error/info)
- Hex values for each, with accessibility contrast ratios noted
- Dark mode variants if applicable

### Typography
- Font families (headings, body, mono)
- Size scale (xs, sm, base, lg, xl, 2xl, 3xl)
- Line heights and letter spacing
- Font weights

### Spacing
- Base unit (e.g., 4px or 8px)
- Scale (0, 1, 2, 3, 4, 6, 8, 12, 16)

### Component Patterns
- Buttons (primary, secondary, ghost, destructive) with states (hover, active, disabled, loading)
- Forms (inputs, selects, checkboxes, radio) with validation states
- Cards, modals, toast notifications, empty states
- Navigation patterns (sidebar, breadcrumb, tabs)

### Interaction States
- Loading skeletons
- Error boundaries
- Success confirmations
- Empty states (no data yet)

### Accessibility
- Minimum touch target sizes
- Focus ring specification
- Color contrast requirements (WCAG AA minimum)
- Screen reader announcements for dynamic content

---

## Decision Protocol

### Step 1 — Extract UI surfaces from event storm
Scan `docs/event-storm.yaml` for UI stickies. Each UI sticky becomes a screen or component requirement. List them.

### Step 2 — Map empathy to visual language
Read `docs/empathy-map.md`. Choose colors and typography that match the user's emotional context:
- Frustrated users → calm, muted palette, clear hierarchy, minimal clutter
- Excited users → vibrant accent colors, energetic spacing
- Professional users → conservative palette, dense information display

### Step 3 — Check constraints
Read `project.constraints.yaml`. If `ux` is ranked highest, invest in rich interactions and animations. If `cost` is highest, keep it simple — fewer assets, standard components.

### Step 4 — Write the design system
Produce `design-system/MASTER.md` with all sections above. Every value must be concrete (hex codes, pixel values, font names) — no vague descriptors like "blue-ish" or "medium large".

### Step 5 — Post summary to Linear
Post a comment on the inception story:
> "Design system complete. design-system/MASTER.md committed. [N] component patterns defined. Color palette: [primary hex]. Typography: [font family]."

---

## State Model

This skill runs during inception Phase 5.

- `design-system/MASTER.md` — Phase 5 artifact
- Stories with UI components reference this file

For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Every color must have a hex value — no named colors ("blue", "light gray").
2. Every size must be in pixels or rem — no vague descriptors.
3. Accessibility is non-negotiable — WCAG AA minimum contrast on all text.
4. The design system must cover all UI stickies from the event storm.
5. If `ui-ux-pro-max` integration is enabled, use it to generate component scaffolding.
6. If `project.constraints.yaml` ranks `cost` above `ux`, keep the system minimal.
