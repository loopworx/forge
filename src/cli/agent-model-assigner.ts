import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";

export interface AgentProfile {
  role: string;
  name: string;
  description: string;
}

export function loadAgentProfiles(templatesDir: string): AgentProfile[] {
  const agentsDir = join(templatesDir, "agents");
  if (!existsSync(agentsDir)) return [];

  const profiles: AgentProfile[] = [];
  for (const file of readdirSync(agentsDir)) {
    if (!file.endsWith(".md")) continue;
    const content = readFileSync(join(agentsDir, file), "utf-8");
    const roleMatch = content.match(/^role:\s*(.+)$/m);
    const role = roleMatch?.[1]?.trim() ?? file.replace(".md", "");
    const name = role.charAt(0).toUpperCase() + role.slice(1).replace("-", " ");
    const bodyLines = content.split("---\n").filter(s => s.trim().length > 0);
    const body = bodyLines[bodyLines.length - 1] ?? "";
    const firstLine = body.split("\n").find(l => l.trim().length > 0) ?? "";
    const description = firstLine.trim();
    profiles.push({ role, name, description });
  }
  return profiles;
}

export function buildAgentModelChoices(
  profiles: AgentProfile[],
  models: Array<{ providerId: string; modelId: string; name: string }>,
): Record<string, Array<{ name: string; value: string }>> {
  const result: Record<string, Array<{ name: string; value: string }>> = {};
  for (const profile of profiles) {
    result[profile.role] = models.map(m => ({
      name: `${m.providerId} / ${m.modelId} (${m.name})`,
      value: `${m.providerId}/${m.modelId}`,
    }));
  }
  return result;
}

export function formatAgentModelsYaml(
  assignments: Record<string, { model: string; thinkingLevel: string }>,
): string {
  return stringify({ agentModels: assignments });
}
