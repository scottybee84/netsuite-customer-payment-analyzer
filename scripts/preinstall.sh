#!/usr/bin/env bash
set -euo pipefail

#!/usr/bin/env bash
set -euo pipefail

# Automated preinstall flow:
# - If AUTO_REINSTALL=1, allow install to continue (this is used when we re-run install
#   after switching Node).
# - Otherwise, try Volta then nvm to switch to Node 20, then re-run the install via
#   AUTO_REINSTALL=1 in a new subshell so the child npm process uses the new node.

if [ "${AUTO_REINSTALL:-}" = "1" ]; then
  # We're already in the re-run; allow normal install to proceed.
  exit 0
fi

echo "🔍 preinstall: ensuring Node 20 for native modules..."

need_switch=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node --version | sed -E 's/v([0-9]+).*/\1/') || NODE_MAJOR=0
  if [ "${NODE_MAJOR}" != "20" ]; then
    need_switch=1
  fi
else
  need_switch=1
fi

if [ "$need_switch" -eq 0 ]; then
  echo "✅ Node ${NODE_MAJOR} detected — continuing with normal install."
  exit 0
fi

echo "⚠️  Node ${NODE_MAJOR:-unknown} detected — attempting automatic switch to Node 20..."

# Try Volta first (no subshell required)
if command -v volta >/dev/null 2>&1; then
  echo "🔧 Trying Volta to pin Node 20..."
  if volta install node@20 >/dev/null 2>&1; then
    echo "🔧 Volta set Node 20. Re-running install under Volta..."
    AUTO_REINSTALL=1 npm run reinstall
    exit $?
  else
    echo "⚠️ Volta present but failed to install Node 20; falling back to nvm..."
  fi
fi

# Try to source nvm and use it in a bash subshell so we can switch Node for the child process
NVM_RUNTIME=""
if [ -s "$NVM_DIR/nvm.sh" ]; then
  NVM_RUNTIME="$NVM_DIR/nvm.sh"
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  NVM_RUNTIME="$HOME/.nvm/nvm.sh"
elif [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
  NVM_RUNTIME="/opt/homebrew/opt/nvm/nvm.sh"
elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
  NVM_RUNTIME="/usr/local/opt/nvm/nvm.sh"
fi

if [ -n "$NVM_RUNTIME" ]; then
  echo "🔧 Sourcing nvm from: $NVM_RUNTIME"
  # Run the reinstall inside a new bash -lc so the nvm 'use' affects the child npm process
  bash -lc "export NVM_DIR=\"$HOME/.nvm\"; . \"$NVM_RUNTIME\"; nvm install 20 && nvm use 20 && export AUTO_REINSTALL=1 && npm run reinstall"
  exit $?
fi

echo "ERROR: Could not find Volta or nvm to switch Node. Please install nvm or Volta and run: nvm install 20 && nvm use 20 && npm install" 1>&2
exit 1
