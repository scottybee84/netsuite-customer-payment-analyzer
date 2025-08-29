## 📋 About This Project

Payment Analytics for NetSuite — SuiteScript examples that analyze customer payment behavior and receivables.

What the scripts do (concise):

- Suitelet `sl_payment_analytics` (server-side):

  - Renders a Payment Analytics dashboard form with a customer selector and action buttons.
  - Handles POST actions from the client: `getPaymentAnalytics`, `getTopRiskCustomers`, and `getCashFlowForecast`.
  - Runs NetSuite searches to fetch customer records and invoices, computes a payment score, risk assessment, recommendations, and a short-term cash flow forecast.
  - Returns JSON responses consumed by the client script.

- Client Script `cl_payment_analytics` (browser-side):
  - Initializes the dashboard UI, wires the Analyze / Risk / Forecast buttons, and performs fetch POSTs to the Suitelet.
  - Renders the returned JSON into a dashboard UI: payment score, risk list, invoice table, cash flow cards, and recommendations.
  - Shows loading states, error messages, and formats numbers/dates for display.

Key behaviors and features:

- Calculates a payment score and grade based on overdue rate and outstanding amounts.
- Produces a ranked list of high-risk customers using balance, credit utilization and simple heuristics.
- Generates a cash flow forecast bucketed by due date ranges (7/30/60/90 days) and overdue totals.
- Designed for local development with the `@scottybee84/mock-netsuite` runtime (no real NetSuite account required).

## 🎯 Out-of-the-Box Ready

This project works **immediately** on Windows, macOS, and Linux. Just install Node.js and run one command!

## Features

- **🔧 Mock NetSuite Environment**: Uses `@scottybee84/mock-netsuite` for testing without a real NetSuite account
- **📜 SuiteScript Implementation**: Includes both Suitelet (server-side) and Client Script components
- **🔷 TypeScript Support**: Written in TypeScript with proper NetSuite type definitions
- **🌍 Cross-Platform**: Works on Windows, macOS, and Linux with automatic platform detection

## 🚀 Quick Start

### One-line start

If you already have the prerequisites (Node.js 20 recommended and npm), you can get everything running with a single command from the project root:

```bash
npm run suitescript
```

This command will detect your OS, build the project if necessary, install dependencies (it will attempt to auto-switch to Node 20 using nvm or Volta if available), and start the mock NetSuite server with an interactive menu to pick a Suitelet.

### Option A: With Git (Recommended)

1. **Install Node.js 20** (if you don't have it)
2. **Clone and install**:
   ```bash
   git clone <repository-url>
   cd <project-folder>
   ```
3. **Run the application** (no separate `npm install` needed):
   ```bash
   npm run suitescript
   ```
4. **Select a script** from the interactive menu
5. **Done!** Your browser will open with the SuiteScript application

### Option B: Without Git

1. **Download the project**:
   - Go to the project repository
   - Click the green **"Code"** button → **"Download ZIP"**
   - Extract the ZIP file to a folder
2. **Open terminal/command prompt** in the extracted folder
3. **Install Node.js 20** (if you don't have it)
4. **Install dependencies**:
   ```bash
   # no manual `npm install` required — run the launcher below and it will install deps if needed
   ```
5. **Run the application**:
   ```bash
   npm run suitescript
   ```
6. **Select a script** from the interactive menu
7. **Done!** Your browser will open with the SuiteScript application

## Prerequisites

- **Node.js 18, 20, or 22** (recommended: 20)
  - Windows: Download from [nodejs.org](https://nodejs.org/)
  - macOS: Download from [nodejs.org](https://nodejs.org/) or use `brew install node`
  - Linux: Use your package manager or download from [nodejs.org](https://nodejs.org/)
- **npm** (included with Node.js)
- **Google Gemini API key** (for AI analysis - get one at [ai.google.dev](https://ai.google.dev/))

### Installing Node.js

If you don't already have Node.js installed, the recommended ways to install Node 20 are below. Pick the option that matches your OS and preferences.

- Official installer (all OS) — simple and reliable:

```bash
# Download and run the installer from:
# https://nodejs.org/
# Choose the LTS/20.x installer for your platform and follow the prompts.
```

- macOS / Linux using nvm (recommended for multiple Node versions):

```bash
# Install nvm (if you don't have it):
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
# Then open a new shell or source your profile, and install/use Node 20:
nvm install 20
nvm use 20
```

- Using Volta (cross-platform, fast, recommended for reproducible CLI tools):

```bash
# Install Volta (one-time):
curl https://get.volta.sh | bash
# Then install and pin Node 20:
volta install node@20
```

- Windows (native GUI or nvm-windows / Volta):

```text
# Use the official Windows installer from https://nodejs.org/ OR
# Install Volta (recommended) via the website above, OR
# Use nvm-windows (https://github.com/coreybutler/nvm-windows) and then:
# nvm install 20
# nvm use 20
```

After installation, verify Node and npm are available and show a 20.x.x version:

```bash
node --version   # should show v20.x.x
npm --version    # npm v10+ is expected with Node 20
```

## System Compatibility

✅ **Windows** - PowerShell 5.1+ or PowerShell Core 6+  
✅ **macOS** - Built-in bash or zsh  
✅ **Linux** - bash shell

The project automatically detects your operating system and uses the appropriate launcher.

## Installation

1. Clone or download this repository
2. Install / prepare dependencies

   ```bash
   # No manual `npm install` required. Run the launcher which will install deps if needed:
   npm run suitescript

   # Optional: perform a one-shot setup (installs Node 20 via nvm/Volta if available and reinstalls deps):
   npm run setup

   # Advanced troubleshooting: force a clean reinstall of dependencies and rebuild native modules:
   npm run reinstall
   ```

## Configuration

Set your Google Gemini API key. You have two options:

### Option 1: Environment File (Recommended)

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your API key:
   ```bash
   GEMINI_API_KEY="your_actual_api_key_here"
   ```

### Option 2: Environment Variable

```bash
export GEMINI_API_KEY="your_api_key_here"
```

## Usage

### 🚀 Quick Start (Cross-Platform)

The fastest way to run the project on **any operating system**:

```bash
npm run suitescript
```

This command will:

- **Automatically detect your operating system** (Windows, macOS, or Linux)
- **Show an interactive menu** to select which script to run
- **Build TypeScript files** if needed
- **Set up the correct Node.js version** (18-22, recommended: 20)
- **Start the mock NetSuite server** with your selected SuiteScript
- **Open the application** in your browser
- **Handle all environment setup** and error checking

### Platform-Specific Launchers

If you prefer to use the platform-specific scripts directly:

**macOS/Linux:**

```bash
./run-suitescript.sh
```

**Windows:**

```powershell
.\run-suitescript.ps1
```

Both launchers provide the same interactive experience with script selection menus.

## 🔧 Development Guide

### Choose Your Development Mode

This project supports both **TypeScript** (recommended) and **JavaScript** development:

**Current mode:** Run `npm run mode` to check your current setting

#### TypeScript Mode (Default - Recommended)

- **Edit**: `ts_src/suitescript/*.ts` files
- **Benefits**: IDE autocomplete, type checking, modern features
- **Workflow**: Edit TS → `npm run build` → Test

#### JavaScript Mode (Beginner-Friendly)

- **Edit**: `src/suitescript/*.js` files directly
- **Benefits**: No compilation step, immediate changes
- **Workflow**: Edit JS → Test (no build needed)

**Switch Development Modes:**

```bash
# Switch to JavaScript mode (beginner-friendly)
npm run switch:javascript

# Switch back to TypeScript mode (recommended)
npm run switch:typescript

# Check current mode
npm run mode
```

### Important: Choose One Approach

**⚠️ Don't mix modes!** Pick either TypeScript OR JavaScript development:

- **TypeScript Mode**: Always edit files in `ts_src/` directory, not `src/`
- **JavaScript Mode**: Always edit files in `src/` directory, not `ts_src/`

### 📝 Script Naming Convention

**Important:** When creating new SuiteScript files, follow these naming conventions:

- **Suitelet files**: Must start with `sl_` (e.g., `sl_customer_analyzer.ts`, `sl_my_report.js`)
- **Client Script files**: Must start with `cl_` (e.g., `cl_customer_analyzer.ts`, `cl_my_form.js`)

The launcher scripts automatically detect and display **only Suitelet files** (`sl_*`) in the selection menu, as these can run standalone. Client scripts are typically loaded automatically by their associated Suitelets.

**✅ Good Examples:**

- `sl_customer_dashboard.ts` - Will appear in launcher menu
- `sl_invoice_processor.js` - Will appear in launcher menu
- `cl_form_helper.ts` - Won't appear in menu (loaded by Suitelet)

**❌ Avoid These:**

- `customer_analyzer.ts` - Won't be detected by launcher
- `my_suitelet.js` - Won't be detected by launcher

### Manual Development

For advanced users who want more control:

1. Build the TypeScript files:

   ```bash
   npm run build
   ```

2. Start the mock NetSuite server:

   ```bash
   npm start
   ```

3. Open your browser to view the SuiteScript interface

## Project Structure

```
ts_src/
└── suitescript/
    ├── sl_*.ts                       # Suitelet files (server-side logic) - SHOWN IN LAUNCHER
    └── cl_*.ts                       # Client Script files (browser-side logic)
src/
└── suitescript/
    ├── sl_*.js                       # Compiled Suitelet files - SHOWN IN LAUNCHER
    └── cl_*.js                       # Compiled Client Script files
```

**🎯 Launcher Behavior:**

- **Only `sl_*` (Suitelet) files** appear in the interactive script selection menu
- **`cl_*` (Client Script) files** are automatically loaded by their associated Suitelets
- **Other naming patterns** will not be detected by the launcher scripts

## How It Works

1. **Suitelet**: Server-side SuiteScripts that create web interfaces and handle backend logic
2. **Client Script**: Browser-side SuiteScripts that handle frontend interactions and user experience
3. **Mock NetSuite Environment**: Provides a local development environment that simulates NetSuite APIs

## AI Analysis Output

The AI provides:

- **Risk Level**: High/Medium/Low assessment

## 🚀 Deploying to Real NetSuite

Once you've tested the scripts locally, you can deploy them to your actual NetSuite environment:

### Step 1: Build the Production Scripts

```bash
npm run build
```

This creates the final JavaScript files in the `src/suitescript/` folder.

### Step 2: Upload to NetSuite

#### For Suitelet Scripts (sl\_\*.js):

1. **Go to** Customization → Scripting → Scripts → New
2. **Select** "SuiteScript"
3. **Choose** "Suitelet" as script type
4. **Upload** your Suitelet file from `src/suitescript/`
5. **Set Script ID**: `_sl_your_script_name`
6. **Configure**:
   - **Name**: Your Script Name
   - **Function**: `onRequest`
7. **Save & Deploy**:
   - **Applies To**: All Roles (or specific roles)
   - **Status**: Released
   - **Log Level**: Debug (for initial testing)

#### For Client Script Files (cl\_\*.js):

1. **Go to** Documents → Files → File Cabinet
2. **Navigate to** SuiteScripts folder (or create one if it doesn't exist)
3. **Upload** your Client Script file from `src/suitescript/`
4. **Note the file path** (e.g., `/SuiteScripts/cl_your_script.js`)

#### Link Client Script to Suitelet:

In your Suitelet code, make sure it references the client script file:

```javascript
form.clientScriptFileId = "path/to/cl_your_script.js"; // Use the File Cabinet path
// OR if using the file ID:
form.clientScriptModulePath = "./cl_your_script.js"; // Relative to the Suitelet file
```

The client script will automatically load when the Suitelet form is displayed.

### Step 3: Set Up Environment Variables in NetSuite

You'll need to modify the scripts to use NetSuite's secure credential storage instead of environment variables:

1. **Go to** Setup → Company → General Preferences
2. **Add your API keys** to custom fields or use NetSuite's credential management
3. **Update the script** to retrieve credentials from NetSuite instead of `process.env`

### Step 4: Test in NetSuite

1. **Access the Suitelet** via the URL provided in the deployment
2. **Test the functionality** and user interactions
3. **Check script logs** in Customization → Scripting → Script Deployments for any issues

### Important Notes for Production:

- **⚠️ Remove debug logging** before production deployment
- **🔒 Secure your API keys** using NetSuite's credential management
- **🧪 Test thoroughly** with real customer data
- **📊 Monitor script usage** to stay within governance limits
- **🔄 Consider adding error handling** for API failures

## 🔧 Troubleshooting

### Common Issues and Solutions

#### "Node.js not found" or version issues:

- **Install Node.js 20**: Download from [nodejs.org](https://nodejs.org/)
- **Check version**: `node --version` should show v20.x.x
- **Use nvm** (recommended): Allows switching Node.js versions easily

#### "npm command not found":

- **npm comes with Node.js** - reinstall Node.js
- **Check PATH**: Ensure Node.js is in your system PATH

#### "PowerShell execution policy" errors (Windows):

- **Run as Administrator**: `Set-ExecutionPolicy RemoteSigned`
- **Or use bypass**: `powershell -ExecutionPolicy Bypass -File .\run-suitescript.ps1`

#### "Permission denied" errors (macOS/Linux):

- **Make executable**: `chmod +x ./run-suitescript.sh`
- **Or use npm**: `npm run suitescript` (doesn't require executable permissions)

#### "API key not working":

- **Check .env file**: Ensure your API keys are properly formatted with no spaces
- **Get valid keys**: Obtain API keys from the appropriate service providers
- **Test keys**: The mock environment will show API errors in the console

#### "Port 3001 already in use":

- **Kill existing process**: The scripts do this automatically
- **Use different port**: Modify the PORT in the scripts if needed
- **Check browser**: Close any open localhost:3001 tabs

#### "better-sqlite3" errors:

- **Node version**: Must be 18, 20, or 22 (native module compatibility)
- **Rebuild**: `npm rebuild` if you switched Node versions
- **Clean install**: `rm -rf node_modules && npm run reinstall`

### Getting Help

- **Check the logs**: The mock server shows detailed debug information
- **NetSuite Documentation**: For production deployment questions

## Dependencies

- `@scottybee84/mock-netsuite`: Mock NetSuite environment for development and testing
- `typescript`: TypeScript compiler
- `@types/node`: Node.js type definitions

## License

This project is provided as part of a commercial course with attribution requirements.

**Students may:**

- Use this code in their own NetSuite implementations
- Modify the code for their business needs
- Use the code commercially in their projects
- Share within their organization

**Requirements:** Attribution must be maintained - "Originally from NetSuite AI Customer AR Analysis Course by Scott Brown"

**Restrictions:** Course materials cannot be redistributed or used to create competing courses.

For course enrollment and licensing questions, please contact the course instructor.

---
