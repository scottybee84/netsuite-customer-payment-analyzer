#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Running project setup: ensure Node 20 and install dependencies"

# Try helper installer (tries Volta then nvm)
if [ -x "$(pwd)/scripts/install.sh" ]; then
  bash ./scripts/install.sh || true
fi

# Run the project's reinstall flow under the AUTO_REINSTALL guard
export AUTO_REINSTALL=1
npm run reinstall

echo "✅ Setup complete."
