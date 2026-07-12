export class StatusBar {
  private agent = "";
  private model = "";
  private provider = "";
  private thinking = "";
  private tokens = 0;
  private maxTokens = 1;
  private mode = "";

  setInfo(agent: string, model: string, provider: string, thinking: string, tokens: number, maxTokens: number, mode: string): void {
    this.agent = agent;
    this.model = model;
    this.provider = provider;
    this.thinking = thinking;
    this.tokens = tokens;
    this.maxTokens = maxTokens;
    this.mode = mode;
  }

  getText(): string {
    const pct = this.maxTokens > 0 ? (this.tokens / this.maxTokens * 100).toFixed(1) : "0.0";
    const tokensFormatted = this.tokens >= 1000 ? `${Math.floor(this.tokens / 1000)}k` : `${this.tokens}`;
    const maxFormatted = this.maxTokens >= 1000000 ? `${this.maxTokens / 1000000}M` : `${this.maxTokens}`;
    return `${this.agent} · ${this.model} ${this.provider} · ${this.thinking} · ${tokensFormatted}/${maxFormatted} (${pct}%) · ${this.mode}`;
  }
}
