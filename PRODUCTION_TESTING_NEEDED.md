# Production Testing Required

**Date:** 2026-02-12  
**Status:** Unable to locate production URL

---

## ISSUE: Production URL Not Found

I searched the codebase extensively for:
- Railway deployment URLs
- Production domain names
- Environment configuration files
- Deployment scripts

**No production URL was found in the codebase.**

---

## TESTING REQUIREMENTS

### Issue #1: News Hooks (400+ Day Old Articles)

**Test Steps:**
1. Navigate to PR page on production site
2. Look for "News Hooks" section (should be in LEFT panel, not a tab)
3. Click refresh button (↻) if needed
4. Check article dates displayed
5. Verify articles are recent (not 400+ days old)
6. Look for "Old" badges on articles >7 days old

**Expected Behavior:**
- Articles should be from last 30 days maximum
- Articles >7 days show "Old" badge
- Dates display as "Today", "Yesterday", or "Xd ago"
- Auto-refresh triggers if all articles >7 days old

**Screenshots Needed:**
- News Hooks section showing article dates
- Browser console (check for errors)

---

### Issue #2: Media UI Overlay (Half-Circle Artifact)

**IMPORTANT NOTE:** Based on code review, there is **NO "Media tab in right panel"** in the current structure.

**Current Structure:**
- **Right Panel:** Only contains "Strategy" header
- **Left Panel:** Contains "Media & Calendar" collapsible section

**Test Steps:**
1. Navigate to PR page
2. **Check Right Panel:** Should only show "Strategy" (no Media tab)
3. **Check Left Panel:** Look for "Media & Calendar" section
4. Click "Media & Calendar" to expand
5. Look for visual artifacts (half-circles, overlays)
6. Scroll through outlets list
7. Check for any CSS rendering issues

**Expected Behavior:**
- Right panel shows only "Strategy"
- Media content is in left panel
- No visual artifacts or half-circle overlays
- Clean UI rendering

**Screenshots Needed:**
- Right panel (showing only Strategy)
- Left panel with Media & Calendar expanded
- Any visual artifacts if present

---

## HOW TO FIND PRODUCTION URL

### Option 1: Check Railway Dashboard
1. Go to https://railway.app
2. Log in with your account
3. Find the Glossi Board project
4. Click on the deployment
5. Look for the public URL (usually `*.up.railway.app`)

### Option 2: Check Git Remote
```bash
cd /Users/jonathan.gitlin/Desktop/Glossi_Invest_CheatSheet
git remote -v
```

### Option 3: Check Browser History
- Look for recently visited Glossi Board URLs
- Check for `*.railway.app` or custom domain

### Option 4: Ask Team
- Check Slack/email for deployment links
- Ask whoever deployed the application

---

## ALTERNATIVE: Test on Localhost

If production URL is not available, you can test locally:

### Start Server
```bash
cd /Users/jonathan.gitlin/Desktop/Glossi_Invest_CheatSheet

# Make sure Node.js is installed
node --version

# Start the server
node server.js
```

### Navigate to Local Site
Open browser to: http://localhost:3005/pr.html

### Run Tests
Follow the same test steps as above for both issues.

---

## CONSOLE COMMANDS FOR TESTING

### Check News Hooks Data
```javascript
// In browser console on PR page
const newsManager = window.prAgent?.newsManager;
if (newsManager) {
  console.log('News hooks:', newsManager.newsHooks);
  newsManager.newsHooks.forEach((item, i) => {
    const date = new Date(item.date || item.fetched_at);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Article ${i + 1}:`, {
      headline: item.headline,
      date: item.date,
      daysAgo: daysAgo,
      isStale: daysAgo > 7
    });
  });
}
```

### Check for Visual Artifacts
```javascript
// Check for modal overlays
document.querySelectorAll('.modal-overlay').forEach(el => {
  console.log('Modal:', el, 'Visible:', el.classList.contains('visible'));
});

// Check for circular elements
document.querySelectorAll('*').forEach(el => {
  const style = window.getComputedStyle(el);
  if (style.borderRadius.includes('50%') && el.offsetWidth > 50) {
    console.log('Large circle element:', el, style.borderRadius);
  }
});
```

---

## EXPECTED FINDINGS

### Issue #1: News Hooks

**If Working Correctly:**
- ✅ Articles from last 30 days only
- ✅ "Old" badges on articles >7 days
- ✅ Auto-refresh triggers for stale news
- ✅ Console shows: "Cached news is stale, auto-refreshing..."

**If Issue Present:**
- ❌ Articles showing "400d ago" or similar
- ❌ No auto-refresh happening
- ❌ Database errors in console
- ❌ API errors in console

### Issue #2: Media UI

**If Working Correctly:**
- ✅ Right panel shows only "Strategy"
- ✅ Media in left panel under "Media & Calendar"
- ✅ No visual artifacts
- ✅ Clean UI rendering

**If Issue Present:**
- ❌ Half-circle overlay visible
- ❌ Media tab in right panel (shouldn't exist)
- ❌ CSS rendering artifacts
- ❌ Stuck modal backgrounds

---

## REPORTING FORMAT

Once you have access to production (or localhost), please report:

### Issue #1: News Hooks
- **Status:** [PRESENT / FIXED / NOT REPRODUCIBLE]
- **Article Dates Observed:** [e.g., "5d ago", "400d ago"]
- **Auto-refresh Triggered:** [YES / NO]
- **Console Errors:** [NONE / LIST]
- **Screenshot:** [Attach]

### Issue #2: Media UI
- **Status:** [PRESENT / FIXED / NOT REPRODUCIBLE]
- **Right Panel Structure:** [CORRECT / INCORRECT]
- **Visual Artifacts:** [NONE / DESCRIBE]
- **Screenshot:** [Attach]

---

## RELATED DOCUMENTATION

- `ISSUE_INVESTIGATION_GUIDE.md` - Detailed testing procedures
- `INVESTIGATION_SUMMARY.md` - Code analysis findings
- `CODE_REVIEW_SUMMARY.md` - Complete code verification

---

## NEXT STEPS

1. ✅ Locate production URL (Railway dashboard or git remote)
2. ⏳ Navigate to production PR page
3. ⏳ Test Issue #1 (News Hooks dates)
4. ⏳ Test Issue #2 (Media UI artifacts)
5. ⏳ Capture screenshots
6. ⏳ Report findings

---

## CONTACT

If you need help:
1. Share the production URL
2. I can provide specific testing instructions
3. Or test directly via browser automation (if MCP tools work)
