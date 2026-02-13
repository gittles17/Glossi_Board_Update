# Node.js and MCP Browser Server Setup Guide

## Status

✅ **Cursor MCP Configuration**: Already added to settings.json
⏳ **Node.js Installation**: Required (not yet installed)
⏳ **Restart Cursor**: Required after Node.js installation

## Step 1: Install Node.js

You need Node.js installed to run the MCP browser server and your local development server.

### Option A: Install via Homebrew (Recommended)

1. Install Homebrew first (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Install Node.js:
   ```bash
   brew install node
   ```

### Option B: Direct Download from Node.js

1. Visit: https://nodejs.org/
2. Download the **LTS version** (Long Term Support) for macOS
3. Run the downloaded `.pkg` installer
4. Follow the installation wizard

### Verify Installation

After installing Node.js via either method, verify in Terminal:
```bash
node --version   # Should show v20.x.x or similar
npm --version    # Should show 10.x.x or similar
npx --version    # Should show 10.x.x or similar
```

## Step 2: Install MCP Browser Server (Automatic)

The MCP browser server will be installed automatically when Cursor starts (thanks to the `-y` flag in the configuration). 

Alternatively, you can pre-install it manually:
```bash
npm install -g @modelcontextprotocol/server-cursor-ide-browser
```

## Step 3: Restart Cursor

1. **Save all your work**
2. **Quit Cursor completely**: Press `Cmd + Q` (not just close the window)
3. **Reopen Cursor**
4. Wait a few seconds for the MCP server to initialize

## Step 4: Verify MCP is Working

After restarting Cursor:

1. Open this project
2. Ask the AI to test the browser
3. The AI should be able to:
   - Navigate to URLs
   - Take screenshots
   - Interact with page elements
   - Read console errors

## What This Enables

Once set up, you'll have automated browser testing:
- ✅ Test news hooks are showing recent articles
- ✅ Verify no UI artifacts in Media section
- ✅ Capture screenshots of issues
- ✅ Monitor console errors automatically
- ✅ Test interactions and workflows

## Troubleshooting

### If MCP still doesn't work after restart:

1. Check Node.js is installed:
   ```bash
   which node
   which npx
   ```

2. Manually test the MCP server:
   ```bash
   npx -y @modelcontextprotocol/server-cursor-ide-browser
   ```

3. Check Cursor settings are correct:
   ```bash
   cat ~/Library/Application\ Support/Cursor/User/settings.json
   ```

4. Check Cursor logs for errors (in Cursor: Help > Toggle Developer Tools > Console)

## Current Settings Configuration

Your Cursor settings have been updated to:
```json
{
    "window.commandCenter": true,
    "git.ignoreMissingGitWarning": true,
    "liveServer.settings.donotShowInfoMsg": true,
    "mcp.servers": {
        "cursor-ide-browser": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-cursor-ide-browser"]
        }
    }
}
```

## Quick Start After Setup

Once Node.js is installed and Cursor is restarted:

1. Ask AI: "Test the news hooks on http://localhost:3005/pr.html"
2. AI will automatically navigate, check dates, and take screenshots
3. No manual testing required!

---

**Next Steps**: Install Node.js using Option A or B above, then restart Cursor.
