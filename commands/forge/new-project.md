---
description: Start Forge — begin inception (8 phases) then transition to development mode
---

Call the `forge_start` tool to begin Forge inception. Report the returned result to the user.

Do NOT:
- Query Linear for teams or states
- Create workflow states
- Read plugin source code (forge.ts, plugin.ts, mcp-client.ts)
- Try to start inception yourself — the tool does everything

The tool will:
- Discover your Linear team
- Create or verify Forge workflow states
- Start Inception Phase 1 in a po-agent session
- Return verification details (team name, state counts, session ID)
