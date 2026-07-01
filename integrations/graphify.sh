#!/usr/bin/env bash
set -euo pipefail

echo "=== Graphify Integration Installer ==="
echo ""

OPENCODE_DIR="${HOME}/.config/opencode"

if [ ! -d "$OPENCODE_DIR" ]; then
  echo "Error: opencode config directory not found at $OPENCODE_DIR"
  echo "Install opencode first: https://opencode.ai"
  exit 1
fi

PLUGINS_DIR="${OPENCODE_DIR}/plugins"

mkdir -p "$PLUGINS_DIR"

echo "1. Installing graphify plugin..."
if [ -f ".opencode/plugins/graphify.js" ]; then
  echo "   graphify.js already installed in .opencode/plugins/"
else
  echo "   Installing graphify.js..."
  if command -v npx &>/dev/null; then
    npx graphify init 2>/dev/null || echo "   Run 'npx graphify init' manually"
  else
    echo "   npx not found. Install Node.js/Bun first."
    echo "   Then run: npx graphify init"
  fi
fi

echo ""
echo "2. Graphify provides:"
echo "   - Knowledge graph from code (AST-based, no API cost)"
echo "   - graphify query '<question>' for scoped subgraphs"
echo "   - graphify path '<A>' '<B>' for relationship tracing"
echo "   - graphify explain '<concept>' for focused concepts"
echo ""
echo "3. Used by: developer-agent, architect-agent"
echo "   - Codebase navigation during development"
echo "   - Module structure visualization during architecture"
echo ""
echo "=== Graphify installation complete ==="
echo "Next: Run '/forge new project'. Graphify runs automatically during analysis."
