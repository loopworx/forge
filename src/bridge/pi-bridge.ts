import { PiDevRuntime } from "./pi-dev-runtime";
import { PiDevSessionManager } from "./pi-dev-session-manager";
import { createForgeComposition } from "./create-pi-composition";
import { SplitLayout } from "../dashboard/split-layout";
import { ForgeChatBar } from "../dashboard/forge-chat-bar";
import { ForgeLayout } from "../dashboard/forge-layout";

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

  const { engine, eventBridge } = createForgeComposition(cwd, runtime, sessions);

  const sidebar = eventBridge.sidebar;
  const agentPanel = eventBridge.agentPanel;
  const chatBar = new ForgeChatBar();
  const splitLayout = new SplitLayout({ sidebar, agentPanel, chatBar });
  const forgeLayout = new ForgeLayout(splitLayout, eventBridge, agentPanel);
  forgeLayout.startCycling(5000);

  return { engine, forgeLayout, eventBridge };
}
