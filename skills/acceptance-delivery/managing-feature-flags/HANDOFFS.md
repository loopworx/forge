# managing-feature-flags — Handoffs

## This skill has no pipeline outbound

`managing-feature-flags` is a lifecycle protocol, not a pipeline step.
It is called at specific moments by other skills. It does not hand off to a next skill.

---

## When it is called

| Moment | Caller | Action |
|---|---|---|
| Story pulled into `in-dev` | `running-atdd-sessions` (developer-agent) | Create flag; confirm OFF |
| Story deployed to test env | `bootstrapping-project` / devops-agent | Verify flag OFF in test env |
| Story in `ready-to-deploy` | `finishing-stories` (po-agent + devops-agent) | Flag remains OFF in prod |
| Human approves go-live | `finishing-stories` | Flip flag ON in prod |
| Smoke test fail | `finishing-stories` | Flip flag OFF immediately |
| Post-soak cleanup | New cleanup story | Remove stale flag from codebase |

---

## Flag naming

`story-[story-id]-[capability-slug]`
Example: `story-bs01-book-save`

The flag name is defined in the story at `ready-for-dev` lock time and does not change.
