#!/bin/bash

# Universal SuiteScript Runtime Launcher
# Cross-platform launcher for any NetSuite SuiteScript project using mock-netsuite
# Automatically detects available scripts and provides interactive selection
# Usage: ./run-suitescript.sh [script-name]

set -e

# Get the real directory where this script is located (resolve symlinks)
if [ -L "${BASH_SOURCE[0]}" ]; then
    # Script is a symlink, get the real path
    SCRIPT_REAL_PATH="$(readlink "${BASH_SOURCE[0]}")"
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_REAL_PATH")" && pwd)"
else
    # Script is not a symlink
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
cd "$SCRIPT_DIR"

echo "🚀 Starting NetSuite SuiteScript Runtime..."
echo "📁 Working directory: $SCRIPT_DIR"

# If node_modules is missing or empty, attempt automated reinstall first so `npm install` isn't required manually.
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "⚠️  node_modules missing or empty. Running automated reinstall..."
    AUTO_REINSTALL=1 npm run reinstall || {
        echo "❌ Automated reinstall failed. Please run: AUTO_REINSTALL=1 npm run reinstall" >&2
        exit 1
    }
    echo "✅ Dependencies installed via automated reinstall. Continuing..."
fi

# Check if we're in the right directory (should have src/suitescript folder)
if [ ! -d "src/suitescript" ]; then
    echo "❌ src/suitescript folder not found. Building from TypeScript sources..."
    if [ ! -d "ts_src/suitescript" ]; then
        echo "❌ ts_src/suitescript folder not found. Make sure you're in the correct directory."
        exit 1
    fi
    echo "🔧 Building SuiteScript files..."
    npm run build
fi

# Clean up any existing processes first
echo "🧹 Cleaning up existing processes..."
pkill -f "mock-netsuite" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true

# Function to show available scripts
show_scripts() {
    echo ""
    echo "📝 Available Suitelet Scripts:"
    echo "==============================="
    local count=1
    for script in src/suitescript/sl_*.js; do
        if [ -f "$script" ]; then
            local basename=$(basename "$script" .js)
            echo "$count) $basename (Suitelet)"
            count=$((count + 1))
        fi
    done
    echo ""
}

# Function to select script interactively
select_script() {
    show_scripts
    
    # Create array of scripts (only Suitelets)
    local scripts=()
    for script in src/suitescript/sl_*.js; do
        if [ -f "$script" ]; then
            scripts+=($(basename "$script" .js))
        fi
    done
    
    if [ ${#scripts[@]} -eq 0 ]; then
        echo "❌ No Suitelet scripts found in src/suitescript/ folder"
        exit 1
    fi
    
    # Use first Suitelet as default
    local default_script="${scripts[0]}"
    
    echo -n "🎯 Select a script to run (1-${#scripts[@]}) or press Enter for default ($default_script): "
    
    # Make sure we read from terminal, not from any piped input
    if [ -t 0 ]; then
        # Standard input is a terminal
        read choice
    else
        # Standard input is not a terminal (piped input)
        read choice < /dev/tty
    fi
    
    if [[ -n "$choice" && "$choice" =~ ^[0-9]+$ && "$choice" -ge 1 && "$choice" -le ${#scripts[@]} ]]; then
        selected_script="${scripts[$((choice-1))]}"
        echo "✅ Selected: $selected_script"
        echo ""
    else
        selected_script="$default_script"
        echo "✅ Using default: $selected_script"
        echo ""
    fi
}

# Check if script name was provided as argument
if [ -n "$1" ]; then
    if [ -f "src/suitescript/$1.js" ]; then
        selected_script="$1"
        echo "✅ Running specific script: $selected_script"
    else
        echo "❌ Script '$1.js' not found in src/suitescript/ folder"
        show_scripts
        exit 1
    fi
else
    # Interactive selection FIRST - no server running yet
    select_script
fi

# Now that selection is made, set up Node.js environment
echo ""
echo "🔧 Setting up Node.js environment..."

# Ensure node is installed; prefer Node 20 but don't require nvm.
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version 2>/dev/null || echo "v0")
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed -E 's/v([0-9]+).*/\1/')
else
    echo "❌ Node.js not found. Please install Node.js (>=20) and rerun."
    exit 1
fi

if [ "$NODE_MAJOR" -ne 20 ]; then
    # Try to use nvm if available to switch to Node 20, otherwise warn and continue.
    if command -v nvm >/dev/null 2>&1 || [ -f "$HOME/.nvm/nvm.sh" ]; then
        echo "🔄 Attempting to switch to Node 20 with nvm..."
        if ! command -v nvm >/dev/null 2>&1; then
            # source nvm if installed but not loaded
            source "$HOME/.nvm/nvm.sh" || true
        fi
        if command -v nvm >/dev/null 2>&1; then
            nvm use 20 || echo "⚠️  nvm failed to switch to Node 20; continuing with installed Node $NODE_VERSION"
            NODE_VERSION=$(node --version 2>/dev/null || echo "$NODE_VERSION")
        else
            echo "⚠️  nvm not available to switch Node versions. Current Node: $NODE_VERSION"
        fi
    else
        echo "⚠️  Node major version is $NODE_MAJOR (expected 20). Please install Node 20 or proceed with current Node: $NODE_VERSION"
    fi
fi

echo "✅ Using Node.js $NODE_VERSION"

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "🔧 Loading environment variables from .env file..."
    # Export non-comment, non-empty lines (KEY=VALUE)
    export $(grep -v '^#' .env | xargs) 2>/dev/null || true
fi

# Check for API keys or important environment variables (generic)
if [ -f ".env" ] && grep -q "API_KEY" .env; then
    echo "✅ Environment variables loaded successfully"
elif [ -f ".env.example" ] && grep -q "API_KEY" .env.example; then
    echo "⚠️  API keys may not be set. Check your .env file."
    echo "💡 You can copy .env.example to .env and set your API keys:" 
    echo "   cp .env.example .env"
    echo "   # Then edit .env and set your API keys"
    echo ""
fi

# Gemini API key specific checks
if [ -f ".env" ]; then
    # Check whether the .env file contains a GEMINI_API_KEY entry (even if empty)
    if grep -qE '^\s*GEMINI_API_KEY\s*=' .env; then
        # If environment variable was exported successfully and is non-empty, it's fine
        if [ -n "$GEMINI_API_KEY" ]; then
            echo "✅ GEMINI_API_KEY is set - AI analysis will work!"
        else
            echo "⚠️  .env contains GEMINI_API_KEY but it's empty. Add your API key to .env to enable AI features." 
            echo "💡 Example: GEMINI_API_KEY=\"your_api_key_here\""
        fi
    else
        echo "⚠️  .env found but GEMINI_API_KEY is missing. AI functionality will be disabled until you add it." 
        echo "💡 Add a line like: GEMINI_API_KEY=\"your_api_key_here\" to .env"
    fi
else
    echo "⚠️  .env file not found. GEMINI_API_KEY is not set — AI functionality will be disabled." 
    echo "💡 Create a .env file (copy .env.example) and add GEMINI_API_KEY to enable AI features." 
fi
echo ""
echo ""

# Kill any existing processes on port 3001 (SuiteScript runtime server)
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start the mock-netsuite server
echo ""
echo "🚀 Starting Mock NetSuite Server..."

# Setup database before starting server
echo "🗄️ Setting up database..."
npm run setup-db

# Function to recover from npm/runtime errors
recover_from_error() {
    echo "⚠️  Error detected. Attempting comprehensive recovery..."
    
    # Setup Node.js environment with NVM
    echo "🔧 Setting up Node.js environment..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    
    echo "🔄 Installing/switching to Node 20..."
    nvm install 20
    nvm use 20
    
    echo "📋 Node version: $(node --version)"
    
    echo "🧹 Removing node_modules..."
    rm -rf node_modules
    
    echo "📦 Performing clean npm install..."
    npm ci
    
    echo "📋 Checking mock-netsuite package..."
    npm list @scottybee84/mock-netsuite --depth=0 || echo "Package not found, but continuing..."
    
    echo "🏗️ Building project..."
    npm run build
    
    echo "🗄️ Setting up database..."
    npm run setup-db
    
    echo "✅ Recovery complete. Retrying..."
}

# Start the selected script
echo "🚀 Starting selected script: $selected_script..."
script_path="$(pwd)/src/suitescript/$selected_script.js"
target_url="http://localhost:3001/suitelet/$selected_script?id=1"

# Run with automatic recovery on failure
attempt=1
max_attempts=2

while [ $attempt -le $max_attempts ]; do
    echo "🎯 Attempt $attempt of $max_attempts"

    # Precompute runtime entry and CLI availability
    RUNTIME_ENTRY="$(pwd)/node_modules/@scottybee84/mock-netsuite/suitescript-runtime.js"
    NPX_AVAILABLE=0
    if command -v npx >/dev/null 2>&1; then NPX_AVAILABLE=1; fi

    SERVER_PID=""

    # FIRST: try starting the direct runtime (deterministic)
    if [ -f "$RUNTIME_ENTRY" ]; then
        echo "🟢 Starting direct runtime first: $RUNTIME_ENTRY"
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        SUITELET_SCRIPT_PATH="$script_path" SUITELET_SCRIPT_NAME="$selected_script" node "$RUNTIME_ENTRY" &
        RUNTIME_PID=$!
        sleep 2

        # Check listener and health
        if lsof -ti:3001 >/dev/null 2>&1; then
            # Poll the suitelet a few times to ensure it's serving the expected content
            HEALTH_OK=0
            for i in $(seq 1 6); do
                HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$target_url" || echo "000")
                if [ "$HTTP_CODE" = "200" ]; then HEALTH_OK=1; break; fi
                if [ "$HTTP_CODE" = "404" ]; then break; fi
                sleep 1
            done

            if [ $HEALTH_OK -eq 1 ]; then
                echo "✅ Direct runtime is healthy and serving the suitelet"
                SERVER_PID=$RUNTIME_PID
                break
            else
                echo "⚠️ Direct runtime started but suitelet healthcheck failed or returned 404. Will try CLI fallback..."
                kill -9 "$RUNTIME_PID" 2>/dev/null || true
            fi
        else
            echo "⚠️ Direct runtime failed to bind port 3001"
            kill -9 "$RUNTIME_PID" 2>/dev/null || true
        fi
    else
        echo "❌ Runtime entrypoint not found at: $RUNTIME_ENTRY"
    fi

    # If direct runtime didn't start/serve correctly, try the package CLI via npx as a fallback
    if [ $NPX_AVAILABLE -eq 1 ]; then
        echo "🔁 Attempting fallback: start package CLI via npx"
        npx @scottybee84/mock-netsuite --runtime --suitelet "$script_path" &
        SERVER_PID=$!
        sleep 1

        # Poll to see if the CLI started and the suitelet is available
        HEALTH_OK=0
        for i in $(seq 1 8); do
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$target_url" || echo "000")
            if [ "$HTTP_CODE" = "200" ]; then HEALTH_OK=1; break; fi
            if [ "$HTTP_CODE" = "404" ]; then break; fi
            sleep 1
        done

        if [ $HEALTH_OK -eq 1 ]; then
            echo "✅ CLI started and suitelet is serving"
            break
        else
            echo "⚠️ CLI started but did not serve the suitelet (or returned 404)."
            # leave the CLI process running for inspection, but try recovery if needed
        fi
    else
        echo "❌ npx is not available for CLI fallback"
    fi

    echo "❌ Attempt $attempt failed"

    if [ $attempt -lt $max_attempts ]; then
        recover_from_error
        attempt=$((attempt + 1))
    else
        echo "💥 All attempts failed. Manual intervention required."
        exit 1
    fi
done

# Wait a moment for server to start
echo "⏳ Waiting for server to start..."
sleep 5

echo "🧪 SuiteScript Runtime Server running on http://localhost:3001"
echo "🎯 Opening: $target_url"

# Open in browser automatically
echo "🌐 Opening browser..."
if command -v open &> /dev/null; then
    # macOS
    open "$target_url"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$target_url"
elif command -v start &> /dev/null; then
    # Windows
    start "$target_url"
else
    echo "⚠️  Could not auto-open browser. Please visit: $target_url"
fi

echo ""
echo "🎮 Server is running! Press Ctrl+C to stop the server."
echo "📱 You can also visit: http://localhost:3001/ for server info"
echo ""

# Keep the script running and wait for the background server
wait $SERVER_PID
