import type { CommandHandler } from "../engine/interfaces";

export class CommandRegistry {
  private commands = new Map<string, CommandHandler>();

  register(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
  }

  get(name: string): CommandHandler | undefined {
    return this.commands.get(name);
  }

  getAll(): string[] {
    return [...this.commands.keys()];
  }

  filterByPrefix(prefix: string): string[] {
    const lower = prefix.toLowerCase();
    return [...this.commands.keys()].filter(name => name.toLowerCase().startsWith(lower));
  }
}
