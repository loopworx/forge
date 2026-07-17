import { createCliRenderer } from "@opentui/core";
import { THEME } from "./theme";

export async function createForgeRenderer() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
    targetFps: 30,
    backgroundColor: THEME.background,
  });
  return renderer;
}
