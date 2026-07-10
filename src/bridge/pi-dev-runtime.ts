import type { AgentRuntime, ToolDefinition, ToolResult, EventHandler, CommandHandler, DashboardComponent } from "../engine/interfaces";

function log(tag: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.error(`[forge ${ts}] ${tag}: ${msg}`, ...args.length ? args : []);
}

interface PiDevApi {
  registerTool(def: unknown): void;
  on(event: string, handler: (event: unknown) => void | Promise<void>): void;
  registerCommand(name: string, opts: unknown): void;
}

export class PiDevRuntime implements AgentRuntime {
  constructor(private api: PiDevApi) {
    log("runtime", "PiDevRuntime constructed");
  }

  registerTool(definition: ToolDefinition): void {
    log("runtime", `registerTool: ${definition.name}`);
    this.api.registerTool({
      name: definition.name,
      label: definition.label,
      description: definition.description,
      parameters: definition.parameters,
      execute: async (
        toolCallId: string,
        params: unknown,
        _signal: unknown,
        _onUpdate: unknown,
        _ctx: unknown,
      ): Promise<ToolResult> => {
        log("tool", `${definition.name} called`, { toolCallId, params });
        try {
          const result = await definition.execute(toolCallId, params);
          log("tool", `${definition.name} result`, { isError: result.isError });
          return result;
        } catch (err) {
          log("tool", `${definition.name} ERROR: ${(err as Error).message}`);
          throw err;
        }
      },
    });
  }

  on(event: string, handler: EventHandler): void {
    log("runtime", `on: subscribing to "${event}"`);
    this.api.on(event, async (piEvent: unknown, ctx?: unknown) => {
      const e = piEvent as { type: string; sessionId?: string; delta?: string; toolName?: string; isError?: boolean };
      const c = ctx as { cwd?: string; ui?: unknown } | undefined;
      log("event", `"${event}" received`, { type: e?.type, sessionId: e?.sessionId });
      try {
        await handler(e as any, {
          sessionId: e?.sessionId ?? "",
          cwd: c?.cwd ?? process.cwd(),
          ui: c?.ui,
        });
      } catch (err) {
        log("event", `"${event}" handler ERROR: ${(err as Error).message}`);
      }
    });
  }

  registerCommand(name: string, handler: CommandHandler): void {
    log("runtime", `registerCommand: /${name}`);
    this.api.registerCommand(name, {
      description: name,
      handler: async (args: string, ctx: any) => {
        log("command", `/${name} invoked`, { args, cwd: ctx?.cwd });
        try {
          await handler(args, { cwd: ctx?.cwd ?? process.cwd(), model: ctx?.model, ui: ctx?.ui });
          log("command", `/${name} completed`);
        } catch (err) {
          const msg = (err as Error).message;
          log("command", `/${name} ERROR: ${msg}`);
          ctx?.ui?.notify?.(`Command ${name} error: ${msg}`, "error");
          console.error(`[forge] command ${name} error:`, err);
        }
      },
    });
  }

  setStatus(_key: string, _text: string | undefined): void {}

  renderDashboard(_component: DashboardComponent): void {}

  closeDashboard(): void {}
}
