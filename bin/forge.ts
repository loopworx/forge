const command = Bun.argv[2] ?? "";

if (command === "init") {
  console.log("forge init — not yet implemented in v0.3");
} else if (command === "setup") {
  console.log("forge setup — not yet implemented in v0.3");
} else {
  console.log("Usage: forge <init|setup>");
}
