import { createCliRenderer } from "@opentui/core";

export async function createForgeRenderer() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
    targetFps: 30,
    backgroundColor: "transparent",
  });
  return renderer;
}
