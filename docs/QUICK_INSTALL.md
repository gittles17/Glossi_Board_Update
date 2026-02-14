# Quick Install Instructions

## ❌ Automatic Installation Failed

I cannot install Node.js automatically because it requires administrator privileges (your password).

## ✅ What I've Already Done

1. ✅ Added MCP browser server configuration to Cursor settings
2. ✅ Created installation scripts
3. ✅ Prepared everything for you

## 🚀 One Command to Complete Setup

Open your **Terminal** app and run this ONE command:

```bash
cd ~/Desktop/Glossi_Invest_CheatSheet && ./install-nodejs-mcp.sh
```

**You will be prompted for your password** - this is normal and safe. It's needed to install Homebrew and Node.js.

### What This Command Does:

1. Installs Homebrew (package manager for macOS)
2. Installs Node.js via Homebrew
3. Installs MCP browser server
4. Verifies everything works

**Time:** About 3-5 minutes

## After Running the Command:

1. **Quit Cursor** completely (Cmd + Q)
2. **Reopen Cursor**
3. Done! MCP browser automation will work

## Alternative: Manual Download (No Terminal Required)

If you prefer not to use Terminal:

1. Visit: **https://nodejs.org/**
2. Click **"Download Node.js (LTS)"**
3. Open the downloaded `.pkg` file
4. Follow the installer
5. **Quit and restart Cursor**

Then the MCP server will automatically install on first use.

## Testing It Works

After restarting Cursor, ask me:
> "Test the news hooks at http://localhost:3005/pr.html"

I'll automatically navigate, test, and report results!

---

**Why This Happens**: System software requires admin privileges to install. I've automated everything I can, but the actual installation needs your permission.
