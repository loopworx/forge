import { describe, expect, it, afterEach, mock } from "bun:test";
import { parse } from "yaml";
import {
  buildProviderList,
  buildSelectChoices,
  testApiKey,
  mergeConfig,
  configToYaml,
  type ModelChoice,
  type ProviderEntry,
  type ConfigYaml,
  type SelectChoice,
} from "../../src/cli/setup-wizard";

const mockProviders = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com" },
  { id: "opencode-go", name: "OpenCode Zen Go", baseUrl: undefined },
];

type RawProvider = { id: string; name: string; baseUrl?: string };

describe("buildProviderList", () => {
  const getModels = (id: string): { id: string; name: string }[] => {
    if (id === "openai") return [{ id: "gpt-4", name: "GPT-4" }, { id: "gpt-3.5", name: "GPT-3.5" }];
    if (id === "anthropic") return [{ id: "claude-3", name: "Claude 3" }];
    return [];
  };

  it("returns only providers with baseUrl set (plus the custom option)", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    const ids = result.map((o) => o.id);
    expect(ids).toContain("openai");
    expect(ids).toContain("anthropic");
  });

  it("builds an option per provider with correct id/name/baseUrl/api", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    const openai = result.find((o) => o.id === "openai")!;
    expect(openai.id).toBe("openai");
    expect(openai.name).toBe("OpenAI");
    expect(openai.baseUrl).toBe("https://api.openai.com/v1");
    expect(openai.modelCount).toBe(2);
    const anthropic = result.find((o) => o.id === "anthropic")!;
    expect(anthropic.baseUrl).toBe("https://api.anthropic.com");
  });

  it("appends a Custom Provider option as the last entry", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    expect(result[result.length - 1]).toEqual({
      id: "custom",
      name: "Custom Provider",
      baseUrl: "",
      api: undefined,
      modelCount: 0,
    });
  });

  it("includes opencode-go with correct baseUrl even when SDK has undefined baseUrl", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    const opencodeGo = result.find((o) => o.id === "opencode-go");
    expect(opencodeGo).toBeDefined();
    expect(opencodeGo!.baseUrl).toBe("https://opencode.ai/zen/go/v1");
    expect(opencodeGo!.api).toBe("openai-responses");
  });

  it("includes synthetic provider with correct baseUrl", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    const synthetic = result.find((o) => o.id === "synthetic");
    expect(synthetic).toBeDefined();
    expect(synthetic!.baseUrl).toBe("https://api.synthetic.dev/v1");
    expect(synthetic!.api).toBe("openai-responses");
  });

  it("includes opencode-zen provider with correct baseUrl", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    const opencodeZen = result.find((o) => o.id === "opencode-zen");
    expect(opencodeZen).toBeDefined();
    expect(opencodeZen!.baseUrl).toBe("https://opencode.ai/zen/v1");
    expect(opencodeZen!.api).toBe("openai-responses");
  });

  it("places opencode-go, opencode-zen, and synthetic before Custom Provider", () => {
    const result = buildProviderList(mockProviders as RawProvider[], getModels);
    const ids = result.map((o) => o.id);
    const customIdx = ids.indexOf("custom");
    const goIdx = ids.indexOf("opencode-go");
    const zenIdx = ids.indexOf("opencode-zen");
    const synIdx = ids.indexOf("synthetic");
    expect(goIdx).toBeLessThan(customIdx);
    expect(zenIdx).toBeLessThan(customIdx);
    expect(synIdx).toBeLessThan(customIdx);
  });

  it("sets api on built-in providers from first model's api field", () => {
    const providersWithApi: RawProvider[] = [
      { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
      { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com" },
    ];
    const getModelsWithApi = (id: string): { id: string; name: string; api: string }[] => {
      if (id === "openai") return [{ id: "gpt-4", name: "GPT-4", api: "openai-responses" }];
      if (id === "anthropic") return [{ id: "claude-3", name: "Claude 3", api: "anthropic-messages" }];
      return [];
    };
    const result = buildProviderList(providersWithApi, getModelsWithApi);
    const openai = result.find((o) => o.id === "openai");
    expect(openai!.api).toBe("openai-responses");
    const anthropic = result.find((o) => o.id === "anthropic");
    expect(anthropic!.api).toBe("anthropic-messages");
  });
});

describe("buildSelectChoices", () => {
  const options = [
    { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", modelCount: 45 },
    { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com", modelCount: 14 },
    { id: "custom", name: "Custom Provider", baseUrl: "", modelCount: 0 },
  ];

  it("produces choices without model counts in names", () => {
    const choices = buildSelectChoices(options);
    expect(choices).toHaveLength(4);
    expect(choices[0]).toEqual({ name: "OpenAI", value: "openai" });
    expect(choices[1]).toEqual({ name: "Anthropic", value: "anthropic" });
    expect(choices[2]).toEqual({ type: "separator" });
    expect(choices[3]).toEqual({ name: "Custom Provider", value: "custom" });
  });

  it("does not show model count for any provider", () => {
    const choices = buildSelectChoices(options);
    expect((choices[0] as SelectChoice).name).not.toContain("45");
    expect((choices[1] as SelectChoice).name).not.toContain("14");
  });

  it("returns enough items for a large pageSize", () => {
    const bigOptions = Array.from({ length: 30 }, (_, i) => ({
      id: `provider-${i}`,
      name: `Provider ${i}`,
      baseUrl: `https://api.${i}.com`,
      modelCount: i,
    }));
    bigOptions.push({ id: "custom", name: "Custom Provider", baseUrl: "", modelCount: 0 });
    const choices = buildSelectChoices(bigOptions);
    // 30 providers + separator + custom = 32
    expect(choices.length).toBe(32);
  });

  it("inserts a separator before the Custom Provider option", () => {
    const choices = buildSelectChoices(options);
    // Should be: [openai, anthropic, separator, custom]
    expect(choices).toHaveLength(4);
    expect(choices[0]).toEqual({ name: "OpenAI", value: "openai" });
    expect(choices[1]).toEqual({ name: "Anthropic", value: "anthropic" });
    expect(choices[2]).toEqual({ type: "separator" });
    expect(choices[3]).toEqual({ name: "Custom Provider", value: "custom" });
  });

  it("places separator before custom even with many providers", () => {
    const bigOptions = Array.from({ length: 28 }, (_, i) => ({
      id: `provider-${i}`,
      name: `Provider ${i}`,
      baseUrl: `https://api.${i}.com`,
      modelCount: i,
    }));
    bigOptions.push({ id: "custom", name: "Custom Provider", baseUrl: "", modelCount: 0 });
    const choices = buildSelectChoices(bigOptions);
    // 28 providers + separator + custom = 30
    expect(choices).toHaveLength(30);
    expect(choices[27]).toEqual({ name: "Provider 27", value: "provider-27" });
    expect(choices[28]).toEqual({ type: "separator" });
    expect(choices[29]).toEqual({ name: "Custom Provider", value: "custom" });
  });
});

const originalFetch = globalThis.fetch;

const catalogModels: ModelChoice[] = [
  { id: "gpt-4o", name: "GPT-4o", providerId: "openai", api: "openai-responses" },
  { id: "o1", name: "o1", providerId: "openai", api: "openai-responses" },
];

const getBuiltinCatalog = (id: string): ModelChoice[] =>
  id === "openai" ? catalogModels : [];

describe("testApiKey", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns success + models when fetchModels returns models", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ id: "gpt-4", name: "GPT-4" }] }),
      } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await testApiKey("https://api.openai.com/v1", "test-key");

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].id).toBe("gpt-4");
    expect(result.error).toBeUndefined();
  });

  it("falls back to the built-in catalog when fetchModels is empty for a known provider", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await testApiKey(
      "https://api.openai.com/v1",
      "test-key",
      "openai",
      getBuiltinCatalog,
    );

    expect(result.success).toBe(true);
    expect(result.models).toEqual(catalogModels);
    expect(result.error).toBeUndefined();
  });

  it("returns failure with an error message when empty and no built-in fallback", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await testApiKey("https://custom.example.com/v1", "test-key");

    expect(result.success).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toBe("No models found. Check your API key.");
  });

  it("falls back to the built-in catalog when fetch throws a network error", async () => {
    const fetchMock = mock(() => Promise.reject(new Error("network down")));
    globalThis.fetch = fetchMock as any;

    const result = await testApiKey(
      "https://api.openai.com/v1",
      "test-key",
      "openai",
      getBuiltinCatalog,
    );

    expect(result.success).toBe(true);
    expect(result.models).toEqual(catalogModels);
  });

  it("returns failure with an error message when fetch throws and there is no fallback", async () => {
    const fetchMock = mock(() => Promise.reject(new Error("network down")));
    globalThis.fetch = fetchMock as any;

    const result = await testApiKey("https://custom.example.com/v1", "test-key");

    expect(result.success).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toBe("No models found. Check your API key.");
  });
});

const openaiEntry: ProviderEntry = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-openai",
  api: "openai-responses",
};

const anthropicEntry: ProviderEntry = {
  baseUrl: "https://api.anthropic.com",
  apiKey: "sk-anthropic",
  api: "anthropic-messages",
};

describe("mergeConfig", () => {
  it("creates a fresh config when existing is null", () => {
    const result = mergeConfig(null, { openai: openaiEntry }, "openai/gpt-4", "high");

    expect(result).toEqual({
      providers: { openai: openaiEntry },
      defaultModel: "openai/gpt-4",
      defaultThinkingLevel: "high",
    });
  });

  it("preserves existing providers and adds new ones", () => {
    const existing: ConfigYaml = {
      providers: { openai: openaiEntry },
      defaultModel: "openai/gpt-4",
      defaultThinkingLevel: "medium",
    };

    const result = mergeConfig(existing, { anthropic: anthropicEntry }, "anthropic/claude-3", "high");

    expect(result.providers).toEqual({
      openai: openaiEntry,
      anthropic: anthropicEntry,
    });
  });

  it("overwrites an existing provider with the same name", () => {
    const updatedOpenai: ProviderEntry = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-new-key",
      api: "openai-responses",
    };
    const existing: ConfigYaml = {
      providers: { openai: openaiEntry },
      defaultModel: "openai/gpt-4",
      defaultThinkingLevel: "medium",
    };

    const result = mergeConfig(existing, { openai: updatedOpenai }, "openai/gpt-4o", "high");

    expect(result.providers.openai).toEqual(updatedOpenai);
    expect(Object.keys(result.providers)).toHaveLength(1);
  });

  it("sets defaultModel and defaultThinkingLevel from the arguments", () => {
    const result = mergeConfig(null, { openai: openaiEntry }, "openai/gpt-4o", "high");

    expect(result.defaultModel).toBe("openai/gpt-4o");
    expect(result.defaultThinkingLevel).toBe("high");
  });
});

const sampleConfig: ConfigYaml = {
  providers: {
    openai: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-key",
      api: "openai-responses",
    },
  },
  defaultModel: "openai/gpt-4",
  defaultThinkingLevel: "high",
};

describe("configToYaml", () => {
  it("produces a string containing providers, defaultModel, and defaultThinkingLevel keys", () => {
    const yaml = configToYaml(sampleConfig);

    expect(yaml).toContain("providers:");
    expect(yaml).toContain("defaultModel:");
    expect(yaml).toContain("defaultThinkingLevel:");
  });

  it("contains each provider's baseUrl, apiKey, and api values", () => {
    const yaml = configToYaml(sampleConfig);

    expect(yaml).toContain("https://api.openai.com/v1");
    expect(yaml).toContain("sk-test-key");
    expect(yaml).toContain("openai-responses");
  });

  it("does not contain commented-out example blocks", () => {
    const yaml = configToYaml(sampleConfig);

    expect(yaml).not.toContain("# Example");
    expect(yaml).not.toContain("# providers:");
    expect(yaml).not.toContain("# defaultModel:");
    expect(yaml).not.toContain("# agentModels:");
  });

  it("produces YAML parseable by parse() from the yaml package", () => {
    const yaml = configToYaml(sampleConfig);
    const parsed = parse(yaml) as ConfigYaml;

    expect(parsed.providers.openai.baseUrl).toBe("https://api.openai.com/v1");
    expect(parsed.providers.openai.apiKey).toBe("sk-test-key");
    expect(parsed.providers.openai.api).toBe("openai-responses");
    expect(parsed.defaultModel).toBe("openai/gpt-4");
    expect(parsed.defaultThinkingLevel).toBe("high");
  });
});
