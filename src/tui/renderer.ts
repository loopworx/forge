import { createCliRenderer } from "@opentui/core";

export async function createForgeRenderer() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
    targetFps: 30,
    backgroundColor: "#1a1a1a",
  });
  return renderer;
}
