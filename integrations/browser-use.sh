#!/usr/bin/env bash
set -euo pipefail

echo "=== Browser Use Integration Installer ==="
echo ""

echo "1. Browser Use is an MCP server providing direct CDP browser control"
echo "   for web interaction: automation, scraping, testing, screenshots."
echo ""
echo "2. Installing browser-use..."
if command -v browser-use &>/dev/null; then
  echo "   browser-use already installed"
else
  echo "   Installing browser-use..."
  if command -v pip &>/dev/null; then
    pip install browser-use 2>/dev/null || echo "   Manual install: pip install browser-use"
  elif command -v uv &>/dev/null; then
    uv tool install browser-use 2>/dev/null || echo "   Manual install: uv tool install browser-use"
  else
    echo "   Install Python 3.12+, then: pip install browser-use"
  fi
fi

echo ""
echo "3. Configuring opencode..."
OCPATH="${PWD}/opencode.json"
if [ -f "$OCPATH" ]; then
  echo "   Add to opencode.json mcp section:"
  echo '   "browser-use": {'
  echo '     "type": "local",'
  echo '     "command": ["browser-use", "mcp"],'
  echo '     "enabled": true'
  echo '   }'
else
  echo "   opencode.json not found. Run 'forge init' first."
fi

echo ""
echo "4. Browser Use provides:"
echo "   - CDP browser control (navigate, click, type, screenshot)"
echo "   - Used by: qa-agent for desk checks and regression testing"
echo "   - Used by: ux-agent for design verification"
echo ""
echo "=== Browser Use installation complete ==="
