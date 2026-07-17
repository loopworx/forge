import { stringify } from "yaml";
import { fetchModels } from "../agent/model-fetcher";

export interface ProviderOption {
  id: string;
  name: string;
  baseUrl: string;
  api?: string;
  modelCount: number;
}

export interface ModelChoice {
  id: string;
  name: string;
  providerId: string;
  api?: string;
}

export interface ProviderEntry {
  baseUrl: string;
  apiKey: string;
  api: string;
}

export interface ConfigYaml {
  providers: Record<string, ProviderEntry>;
  defaultModel: string;
  defaultThinkingLevel: string;
}

type RawProvider = { id: string; name: string; baseUrl?: string };

const KNOWN_EXTRA_PROVIDERS: Record<string, { baseUrl: string; api: string; name: string }> = {
  "opencode-go": { baseUrl: "https://opencode.ai/zen/go/v1", api: "openai-responses", name: "OpenCode Zen Go" },
  "opencode-zen": { baseUrl: "https://opencode.ai/zen/v1", api: "openai-responses", name: "OpenCode Zen" },
  "synthetic": { baseUrl: "https://api.synthetic.dev/v1", api: "openai-responses", name: "Synthetic" },
};

export function buildProviderList(
  providers: RawProvider[],
  getModels: (id: string) => unknown[],
): ProviderOption[] {
  const seen = new Set<string>();
  const options: ProviderOption[] = [];

  for (const p of providers) {
    if (!p.baseUrl) {
      const extra = KNOWN_EXTRA_PROVIDERS[p.id];
      if (extra) {
        options.push({
          id: p.id,
          name: p.name,
          baseUrl: extra.baseUrl,
          api: extra.api,
          modelCount: getModels(p.id).length,
        });
        seen.add(p.id);
      }
      continue;
    }
    const models = getModels(p.id);
    const firstModel = models[0] as { api?: string } | undefined;
    options.push({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      api: firstModel?.api,
      modelCount: models.length,
    });
    seen.add(p.id);
  }

  for (const [id, extra] of Object.entries(KNOWN_EXTRA_PROVIDERS)) {
    if (!seen.has(id)) {
      options.push({
        id,
        name: extra.name,
        baseUrl: extra.baseUrl,
        api: extra.api,
        modelCount: 0,
      });
    }
  }

  options.push({ id: "custom", name: "Custom Provider", baseUrl: "", modelCount: 0 });
  return options;
}

export interface SelectChoice {
  name: string;
  value: string;
}

export type SelectItem = SelectChoice | { type: "separator" };

export function buildSelectChoices(options: ProviderOption[]): SelectItem[] {
  const items: SelectItem[] = [];
  for (const o of options) {
    if (o.id === "custom") {
      items.push({ type: "separator" });
    }
    items.push({
      name: o.name,
      value: o.id,
    });
  }
  return items;
}

export interface TestApiKeyResult {
  success: boolean;
  models: ModelChoice[];
  error?: string;
}

export async function testApiKey(
  baseUrl: string,
  apiKey: string,
  providerId?: string,
  getBuiltinModels?: (id: string) => ModelChoice[],
): Promise<TestApiKeyResult> {
  const fetched = await fetchModels(baseUrl, apiKey);
  if (fetched.length > 0) {
    const models: ModelChoice[] = fetched.map((m) => ({
      id: m.id,
      name: m.name,
      providerId: providerId ?? "",
    }));
    return { success: true, models };
  }
  if (providerId && getBuiltinModels) {
    const catalog = getBuiltinModels(providerId);
    return { success: true, models: catalog };
  }
  return { success: false, models: [], error: "No models found. Check your API key." };
}

export function mergeConfig(
  existing: ConfigYaml | null,
  newProviders: Record<string, ProviderEntry>,
  defaultModel: string,
  thinkingLevel: string,
): ConfigYaml {
  const providers = { ...existing?.providers };
  for (const [name, entry] of Object.entries(newProviders)) {
    providers[name] = entry;
  }
  return {
    providers,
    defaultModel,
    defaultThinkingLevel: thinkingLevel,
  };
}

const CONFIG_HEADER = "# ~/.config/forge/forge.yaml — Global Forge Configuration";

export function configToYaml(config: ConfigYaml): string {
  const body = stringify({
    providers: config.providers,
    defaultModel: config.defaultModel,
    defaultThinkingLevel: config.defaultThinkingLevel,
  });
  return `${CONFIG_HEADER}\n${body}`;
}
