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

export function buildProviderList(
  providers: RawProvider[],
  getModels: (id: string) => unknown[],
): ProviderOption[] {
  const options: ProviderOption[] = providers
    .filter((p) => p.baseUrl)
    .map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl as string,
      modelCount: getModels(p.id).length,
    }));
  options.push({ id: "custom", name: "Custom Provider", baseUrl: "", modelCount: 0 });
  return options;
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
