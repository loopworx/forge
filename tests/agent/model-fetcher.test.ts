import { describe, expect, it, afterEach, mock } from "bun:test";
import { fetchModels } from "../../src/agent/model-fetcher";

describe("fetchModels", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses OpenAI-compatible response", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            { id: "glm-5.2", name: "GLM 5.2" },
            { id: "glm-4.5", name: "GLM 4.5" },
          ],
        }),
      } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await fetchModels("https://api.test.com/v1", "test-key");

    expect(result).toEqual([
      { id: "glm-5.2", name: "GLM 5.2" },
      { id: "glm-4.5", name: "GLM 4.5" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://api.test.com/v1/models");
  });

  it("returns empty array on 404", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({ ok: false, status: 404 } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await fetchModels("https://api.test.com/v1", "test-key");

    expect(result).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    const fetchMock = mock(() => Promise.reject(new Error("network")));
    globalThis.fetch = fetchMock as any;

    const result = await fetchModels("https://api.test.com/v1", "test-key");

    expect(result).toEqual([]);
  });

  it("returns empty array on malformed JSON", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => {
          throw new SyntaxError("bad json");
        },
      } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await fetchModels("https://api.test.com/v1", "test-key");

    expect(result).toEqual([]);
  });

  it("handles bare array response", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => [{ id: "claude-3" }],
      } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await fetchModels("https://api.test.com/v1", "test-key");

    expect(result).toEqual([{ id: "claude-3", name: "claude-3" }]);
  });

  it("filters out entries without id", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ id: "good" }, { noId: true }, { id: "also-good" }],
        }),
      } as any),
    );
    globalThis.fetch = fetchMock as any;

    const result = await fetchModels("https://api.test.com/v1", "test-key");

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["good", "also-good"]);
  });
});
