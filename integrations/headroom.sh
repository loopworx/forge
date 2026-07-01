#!/usr/bin/env bash
set -euo pipefail

echo "=== Headroom Integration Installer ==="
echo ""

echo "1. Headroom is an MCP server that compresses tool outputs to save"
echo "   context window space (60-90% reduction)."
echo ""
echo "2. Installing headroom MCP server..."
if command -v headroom &>/dev/null; then
  echo "   headroom already installed"
else
  echo "   Installing headroom..."
  if command -v cargo &>/dev/null; then
    cargo install headroom 2>/dev/null || echo "   Manual install needed: cargo install headroom"
  elif command -v npm &>/dev/null; then
    npm install -g headroom 2>/dev/null || echo "   Manual install needed"
  else
    echo "   Install Rust or Node.js, then: cargo install headroom OR npm i -g headroom"
  fi
fi

echo ""
echo "3. Configuring opencode..."
OCPATH="${PWD}/opencode.json"
if [ -f "$OCPATH" ]; then
  echo "   Add to opencode.json mcp section:"
  echo '   "headroom": {'
  echo '     "type": "local",'
  echo '     "command": ["headroom", "mcp", "serve"],'
  echo '     "enabled": true'
  echo '   }'
else
  echo "   opencode.json not found. Run 'forge init' first."
fi

echo ""
echo "4. Headroom provides:"
echo "   - headroom_compress: compress large outputs"
echo "   - headroom_retrieve: retrieve compressed content"
echo "   - RTK (Rust Token Killer): optimized shell commands"
echo ""
echo "=== Headroom installation complete ==="
