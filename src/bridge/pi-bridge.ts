import { PiDevRuntime } from "./pi-dev-runtime";
import { PiDevSessionManager } from "./pi-dev-session-manager";
import { createForgeComposition } from "./create-pi-composition";

function log(tag: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.error(`[forge ${ts}] ${tag}: ${msg}`, ...args.length ? args : []);
}

interface PiDevExtensionApi {
  registerTool(def: unknown): void;
  on(event: string, handler: (event: unknown) => void | Promise<void>): void;
  registerCommand(name: string, opts: unknown): void;
  sendUserMessage(content: string | unknown[], options?: unknown): void;
}

export async function piBridge(api: unknown): Promise<unknown> {
  if (process.env.FORGE_SUBSESSION === "1") {
    log("bridge", "skipping forge extension in sub-session (FORGE_SUBSESSION=1)");
    return;
  }
  log("bridge", `piBridge entry (cwd=${process.cwd()})`);
  const piApi = api as PiDevExtensionApi;
  const cwd = process.cwd();
  const runtime = new PiDevRuntime(piApi);
  const sessions = new PiDevSessionManager(cwd);
  const sendUserMessage = (content: string) => piApi.sendUserMessage(content);

  log("bridge", "calling createForgeComposition");
  const { engine, uiState } = createForgeComposition(cwd, runtime, sessions, sendUserMessage);
  log("bridge", "createForgeComposition done", {
    projectMode: engine.getProjectState().mode,
    activeSessions: engine.activeSessionCount,
  });

  log("bridge", "piBridge complete — returning");
  return { engine, uiState };
}

export default piBridge;
