import { detectHarness } from "./harness-detector";

type BridgeFn = (api: unknown) => Promise<unknown>;
type BridgeRegistry = Record<string, BridgeFn>;

export async function forgeBridge(api: unknown, bridges?: BridgeRegistry): Promise<void> {
  const harness = detectHarness();

  if (bridges && bridges[harness]) {
    await bridges[harness](api);
    return;
  }

  const lazy: Record<string, () => Promise<BridgeFn>> = {
    "pi.dev": async () => (await import("./pi-bridge")).piBridge,
    "claude-code": async () => (await import("./claude-bridge")).claudeBridge,
    "opencode": async () => (await import("./opencode-bridge")).opencodeBridge,
  };

  const loader = lazy[harness];
  if (loader) {
    const bridge = await loader();
    await bridge(api);
  }
}

export default forgeBridge;
