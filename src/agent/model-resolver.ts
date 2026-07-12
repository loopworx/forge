import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost: { input: number; output: number };
  contextWindow: number;
  maxTokens: number;
}

export interface ResolvedModel {
  model: ModelInfo;
  thinkingLevel: string;
  providerName: string;
  apiKey: string;
  baseUrl: string;
  api: string;
}

export class ModelResolver {
  private providers = new Map<string, ProviderConfig>();
  private modelsByProvider = new Map<string, ModelInfo[]>();

  constructor(private agentDir: string) {
    if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
    this.loadCachedModels();
  }

  registerProvider(name: string, config: ProviderConfig): void {
    this.providers.set(name, config);
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  addModel(providerName: string, model: ModelInfo): void {
    if (!this.modelsByProvider.has(providerName)) {
      this.modelsByProvider.set(providerName, []);
    }
    this.modelsByProvider.get(providerName)!.push(model);
    this.saveCachedModels();
  }

  parseModelRef(ref: string): { providerName: string; modelId: string } {
    const slashIndex = ref.indexOf("/");
    if (slashIndex < 0) return { providerName: "", modelId: ref };
    return { providerName: ref.slice(0, slashIndex), modelId: ref.slice(slashIndex + 1) };
  }

  resolveAgentModel(
    role: string,
    agentModels: Record<string, { model: string; thinkingLevel: string }>,
    defaultModelRef?: string,
    defaultThinkingLevel?: string,
  ): ResolvedModel {
    const agentConfig = agentModels[role];
    const modelRef = agentConfig?.model ?? defaultModelRef ?? "";
    const thinkingLevel = agentConfig?.thinkingLevel ?? defaultThinkingLevel ?? "medium";
    const { providerName, modelId } = this.parseModelRef(modelRef);
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Provider "${providerName}" not registered`);
    const models = this.modelsByProvider.get(providerName) ?? [];
    const model = models.find(m => m.id === modelId);
    if (!model) throw new Error(`Model "${modelId}" not found for provider "${providerName}"`);
    return { model, thinkingLevel, providerName, apiKey: provider.apiKey, baseUrl: provider.baseUrl, api: provider.api };
  }

  getAvailableModels(): string[] {
    const result: string[] = [];
    for (const [providerName, models] of this.modelsByProvider) {
      for (const model of models) {
        result.push(`${providerName}/${model.id}`);
      }
    }
    return result;
  }

  private loadCachedModels(): void {
    const cachePath = join(this.agentDir, "models.json");
    if (!existsSync(cachePath)) return;
    try {
      const data = JSON.parse(readFileSync(cachePath, "utf-8"));
      if (data.modelsByProvider) {
        for (const [name, models] of Object.entries(data.modelsByProvider)) {
          this.modelsByProvider.set(name, models as ModelInfo[]);
        }
      }
    } catch {}
  }

  private saveCachedModels(): void {
    const cachePath = join(this.agentDir, "models.json");
    const data: Record<string, unknown> = {};
    for (const [name, models] of this.modelsByProvider) {
      data[name] = models;
    }
    writeFileSync(cachePath, JSON.stringify({ modelsByProvider: data }, null, 2));
  }
}
