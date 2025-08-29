#!/usr/bin/env bash
set -euo pipefail

# Helper: try Volta, then nvm to install/switch Node 20 and run reinstall.

if command -v volta >/dev/null 2>&1; then
  echo "🔧 Installing Node 20 via Volta..."
  volta install node@20
  exit 0
fi

if command -v nvm >/dev/null 2>&1; then
  echo "🔧 Installing/using Node 20 via nvm..."
  nvm install 20
  nvm use 20
  exit 0
fi

if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  echo "🔧 Sourcing nvm and installing Node 20..."
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm install 20
  nvm use 20
  exit 0
fi

echo "ERROR: Could not auto-install Node 20. Run: nvm install 20 && nvm use 20"
exit 1
