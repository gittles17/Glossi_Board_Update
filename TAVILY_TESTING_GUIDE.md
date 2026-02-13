# Tavily News Hooks Testing Guide

Quick reference for testing the Tavily search functionality.

## Quick Start

Run all tests at once:
```bash
./run-tavily-tests.sh
```

Or run individual tests:
```bash
# Test 1: Tavily search only (no API key needed)
node test-tavily-news-hooks.js

# Test 2: Full flow with Claude analysis (requires API key)
export ANTHROPIC_API_KEY="your-key"
node test-news-hooks-full.js

# Test 3: Test actual endpoint (requires server running)
node server.js  # In one terminal
node test-news-hooks-endpoint.js  # In another terminal
```

## Test Scripts

| Script | What it tests | Requirements |
|--------|---------------|--------------|
| `test-tavily-news-hooks.js` | Tavily search only | None (uses hardcoded key) |
| `test-news-hooks-full.js` | Tavily + Claude analysis | ANTHROPIC_API_KEY |
| `test-news-hooks-endpoint.js` | Full API endpoint | Running server |
| `run-tavily-tests.sh` | All tests | None (skips unavailable) |

## Expected Results

### Test 1: Tavily Search
- ✓ 20-25 articles found
- ✓ From 7+ different sources
- ✓ Within last 7 days
- ✓ Completes in ~7 seconds

### Test 2: Full Flow
- ✓ Tavily search: ~7 seconds
- ✓ Claude analysis: ~5-10 seconds
- ✓ 10-15 relevant articles returned
- ✓ All fields populated correctly

### Test 3: Endpoint
- ✓ HTTP 200 response
- ✓ Articles stored in database
- ✓ All quality checks pass
- ✓ No example/placeholder data

## Troubleshooting

### "Cannot find module"
```bash
rm -rf node_modules
npm install
```

### "ANTHROPIC_API_KEY not found"
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### "Server not running"
```bash
# Start server first
node server.js

# Then run test in another terminal
node test-news-hooks-endpoint.js
```

### "No articles found"
- Check Tavily API key validity
- Check network connectivity
- Try again (may be temporary API issue)

## API Keys

The Tavily API key is hardcoded in the scripts as a fallback:
```javascript
const tavilyKey = process.env.TAVILY_API_KEY || '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';
```

For Claude, set environment variable:
```bash
export ANTHROPIC_API_KEY="your-key"
```

## Current Status

✅ **Test 1 (Tavily Search): PASSED**
- Tested on February 12, 2026
- 25 unique articles found
- 7 sources represented
- Performance: 7.3 seconds

⏳ **Test 2 (Full Flow): Requires ANTHROPIC_API_KEY**

⏳ **Test 3 (Endpoint): Requires running server**

See `TAVILY_TEST_RESULTS.md` for detailed results.
