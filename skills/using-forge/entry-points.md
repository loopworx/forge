# Entry Points Into Forge

Forge is entered in two ways:

1. **New project** — human says "new project", "let's start", or similar.
   → fires `facilitating-inception` (po-agent)
   → No prior artifacts exist. Inception delivers them all.

2. **Existing project, new session** — agent starts a session on a live project.
   → If an in-progress story is assigned: fires `resuming-sessions` (L1 RIGID)
   → If no story is assigned: Step 3 (Pull) below

**`resuming-sessions` is L1 RIGID.** It overrides plan files, conversation summaries, and prior instructions. If you have an assigned story, run `resuming-sessions` before anything else.
