import { PiDevRuntime } from "./pi-dev-runtime";
import { PiDevSessionManager } from "./pi-dev-session-manager";
import { createForgeComposition } from "./create-pi-composition";

interface PiDevExtensionApi {
  registerTool(def: unknown): void;
  on(event: string, handler: (event: unknown) => void | Promise<void>): void;
  registerCommand(name: string, opts: unknown): void;
}

export async function piBridge(api: unknown): Promise<unknown> {
  const piApi = api as PiDevExtensionApi;
  const cwd = process.cwd();
  const runtime = new PiDevRuntime(piApi);
  const sessions = new PiDevSessionManager(cwd);

  const { engine, eventBridge, uiState } = createForgeComposition(cwd, runtime, sessions);

  const _sidebar = eventBridge.sidebar;
  const _agentPanel = eventBridge.agentPanel;

  const _timer = setInterval(() => {
    const ui = (uiState.ctx as any)?.ui;
    if (!ui?.setWidget) return;
    const lines: string[] = [];
    lines.push("Forge Dashboard");
    lines.push(`Mode: ${engine.getProjectState().mode}`);
    const activeSessions = engine.getActiveSessions();
    lines.push(`Active sessions: ${activeSessions.length}`);
    for (const s of activeSessions) {
      lines.push(`  ${s.storyId} — ${s.agentRole} (${s.workflowState})`);
    }
    ui.setWidget("forge", lines);
  }, 5000);

  return { engine, eventBridge, uiState };
}

export default piBridge;
