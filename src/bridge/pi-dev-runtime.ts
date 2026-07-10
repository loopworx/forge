import type { AgentRuntime, ToolDefinition, ToolResult, EventHandler, CommandHandler, DashboardComponent } from "../engine/interfaces";

interface PiDevApi {
  registerTool(def: unknown): void;
  on(event: string, handler: (event: unknown) => void | Promise<void>): void;
  registerCommand(name: string, opts: unknown): void;
}

export class PiDevRuntime implements AgentRuntime {
  constructor(private api: PiDevApi) {}

  registerTool(definition: ToolDefinition): void {
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
        return definition.execute(toolCallId, params);
      },
    });
  }

  on(event: string, handler: EventHandler): void {
    this.api.on(event, async (piEvent: unknown) => {
      const e = piEvent as { type: string; sessionId: string; delta?: string; toolName?: string; isError?: boolean };
      await handler(e, { sessionId: e.sessionId, cwd: "" });
    });
  }

  registerCommand(name: string, _handler: CommandHandler): void {
    this.api.registerCommand(name, {});
  }

  setStatus(_key: string, _text: string | undefined): void {}

  renderDashboard(_component: DashboardComponent): void {}

  closeDashboard(): void {}
}
