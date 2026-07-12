import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ModelResolver } from "../../src/agent/model-resolver";

const TEST_DIR = join(import.meta.dir, "..", ".test-model-resolver");

describe("ModelResolver", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("registers a provider from config", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("test-provider", {
      baseUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      api: "openai-responses",
    });
    expect(resolver.hasProvider("test-provider")).toBe(true);
  });

  it("resolves agent model from agentModels config", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("synthetic", {
      baseUrl: "https://api.synthetic.dev/v1",
      apiKey: "test-key",
      api: "openai-responses",
    });
    resolver.addModel("synthetic", {
      id: "glm-5.2",
      name: "GLM 5.2",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0 },
      contextWindow: 1000000,
      maxTokens: 16384,
    });
    const result = resolver.resolveAgentModel("po-agent", {
      "po-agent": { model: "synthetic/glm-5.2", thinkingLevel: "high" },
    });
    expect(result.model.id).toBe("glm-5.2");
    expect(result.thinkingLevel).toBe("high");
  });

  it("falls back to default model when agent not in agentModels", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("synthetic", {
      baseUrl: "https://api.synthetic.dev/v1",
      apiKey: "test-key",
      api: "openai-responses",
    });
    resolver.addModel("synthetic", {
      id: "glm-5.2", name: "GLM 5.2", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0 }, contextWindow: 1000000, maxTokens: 16384,
    });
    const result = resolver.resolveAgentModel("architect-agent", {}, "synthetic/glm-5.2", "medium");
    expect(result.model.id).toBe("glm-5.2");
    expect(result.thinkingLevel).toBe("medium");
  });

  it("parses provider/modelId format", () => {
    const resolver = new ModelResolver(TEST_DIR);
    const { providerName, modelId } = resolver.parseModelRef("synthetic/glm-5.2");
    expect(providerName).toBe("synthetic");
    expect(modelId).toBe("glm-5.2");
  });

  it("lists available models as provider/modelId", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("synthetic", { baseUrl: "x", apiKey: "y", api: "openai-responses" });
    resolver.addModel("synthetic", { id: "glm-5.2", name: "GLM 5.2", reasoning: false, input: ["text"], cost: { input: 0, output: 0 }, contextWindow: 1000000, maxTokens: 16384 });
    resolver.addModel("synthetic", { id: "glm-4.5", name: "GLM 4.5", reasoning: false, input: ["text"], cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 8192 });
    const models = resolver.getAvailableModels();
    expect(models).toContain("synthetic/glm-5.2");
    expect(models).toContain("synthetic/glm-4.5");
  });

  it("throws when provider not registered", () => {
    const resolver = new ModelResolver(TEST_DIR);
    expect(() => resolver.resolveAgentModel("po-agent", { "po-agent": { model: "unknown/glm", thinkingLevel: "high" } })).toThrow();
  });
});
