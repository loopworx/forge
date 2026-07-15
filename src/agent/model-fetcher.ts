export interface FetchedModel {
  id: string;
  name: string;
}

export async function fetchModels(baseUrl: string, apiKey: string): Promise<FetchedModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const json = await response.json();
    const models = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(models)) return [];
    return models
      .filter((m: any) => m && typeof m.id === "string")
      .map((m: any) => ({ id: m.id as string, name: (m.name ?? m.id) as string }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
