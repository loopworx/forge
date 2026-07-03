---
description: Start Forge — begin inception (8 phases) then transition to development mode
---

The Forge plugin has already handled Linear setup (team discovery + workflow state creation)
and started Inception Phase 1 in a separate po-agent session.

Your only job: confirm the result to the user and tell them to switch to the po-agent session.

Do NOT:
- Query Linear for teams or states
- Create workflow states
- Read plugin source code (forge.ts, plugin.ts, mcp-client.ts)
- Try to start inception yourself

If the plugin's hook output indicates inception was started, simply tell the user:
"Inception Phase 1 has been started in the po-agent session. Switch to that session."

If inception was already complete, tell the user:
"Inception is already complete. Forge is running in development mode."
