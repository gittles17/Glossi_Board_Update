# Production Testing Checklist

**Production URL:** https://glossiboardupdate-production.up.railway.app/pr.html

**Date:** 2026-02-12

---

## 🔴 TEST 1: NEWS HOOKS (Old Articles Issue)

### Steps:

1. ✅ Navigate to: https://glossiboardupdate-production.up.railway.app/pr.html

2. ⏳ Wait for page to fully load (check that all panels are visible)

3. ⏳ **Locate News Hooks Section**
   - **IMPORTANT:** Based on code review, News Hooks is in the **LEFT PANEL** (not a workspace tab)
   - Look for "News Hooks" heading at the top of the left panel
   - It should be the FIRST section in the left panel

4. ⏳ **Click Refresh Button**
   - Look for the refresh icon (↻) next to "News Hooks" heading
   - Click it to fetch fresh news
   - Wait for loading (should show "Searching for relevant news...")

5. ⏳ **Check Article Dates**
   - Look at each news article displayed
   - Check the date shown (e.g., "Today", "Yesterday", "5d ago")
   - **ISSUE:** If you see "400d ago" or similar, the bug is present
   - **EXPECTED:** All articles should be within 30 days

6. ⏳ **Look for "Old" Badges**
   - Articles older than 7 days should have an "Old" badge
   - This is normal and expected for articles 7-30 days old

7. ⏳ **Take Screenshot**
   - Capture the News Hooks section with dates visible
   - Make sure article dates are readable

8. ⏳ **Check Console**
   - Press F12 (or Cmd+Option+I on Mac)
   - Go to Console tab
   - Look for errors related to:
     - "Error loading cached news"
     - "Error refreshing news"
     - Database errors
     - API errors
   - Take screenshot of console if errors present

---

### Expected Results:

✅ **PASS Criteria:**
- All articles show dates within 30 days (e.g., "Today", "5d ago", "28d ago")
- Articles 7-30 days old have "Old" badge
- No console errors
- Auto-refresh triggered if cached news was stale

❌ **FAIL Criteria:**
- Articles showing "400d ago" or similar very old dates
- Console errors about news fetching
- No articles loading at all
- Database connection errors

---

### Test Results:

**Status:** [ ] PASS / [ ] FAIL / [ ] NOT TESTED

**Article Dates Observed:**
- Article 1: _______________
- Article 2: _______________
- Article 3: _______________
- Article 4: _______________
- Article 5: _______________

**"Old" Badges Present:** [ ] YES / [ ] NO

**Auto-refresh Triggered:** [ ] YES / [ ] NO / [ ] UNKNOWN

**Console Errors:** [ ] NONE / [ ] PRESENT (describe below)

**Error Details:**
```
[Paste console errors here if any]
```

**Screenshot:** [ ] Attached

---

## 🔵 TEST 2: MEDIA UI (Half-Circle Overlay Issue)

### Steps:

1. ⏳ **Locate Media Section**
   - **IMPORTANT UPDATE:** Based on code review, the structure has changed:
   - **RIGHT PANEL:** Should only show "Strategy" (NO Media tab)
   - **LEFT PANEL:** Media is under "Media & Calendar" collapsible section
   
2. ⏳ **Check Right Panel First**
   - Look at the right panel
   - **EXPECTED:** Should only show "Strategy" header
   - **IF YOU SEE A MEDIA TAB HERE:** You're viewing an old cached version - hard refresh (Cmd+Shift+R)

3. ⏳ **Find Media in Left Panel**
   - Scroll down in the left panel
   - Look for "Media & Calendar" section (should be collapsed by default)
   - Click "Media & Calendar" to expand it

4. ⏳ **Check for Visual Artifacts**
   - Look for:
     - Half-circle overlays
     - Clipping issues
     - CSS rendering artifacts
     - Stuck modal backgrounds
     - Any visual glitches

5. ⏳ **Scroll Through Outlets**
   - Scroll up and down in the Media section
   - Check if scrolling is smooth
   - Look for visual artifacts appearing during scroll

6. ⏳ **Take Screenshot**
   - Capture the Media section with outlets list visible
   - Include any artifacts if present

7. ⏳ **Inspect Any Artifacts**
   - If you see a half-circle or artifact:
     - Right-click on it
     - Select "Inspect Element"
     - Note the CSS class names
     - Check for `border-radius: 50%` or `::before`/`::after` pseudo-elements

---

### Expected Results:

✅ **PASS Criteria:**
- Right panel shows only "Strategy"
- Media content is in left panel under "Media & Calendar"
- No visual artifacts or half-circle overlays
- Smooth scrolling
- Clean UI rendering

❌ **FAIL Criteria:**
- Half-circle overlay visible
- Visual artifacts or clipping
- CSS rendering issues
- Stuck modal backgrounds

---

### Test Results:

**Status:** [ ] PASS / [ ] FAIL / [ ] NOT TESTED

**Right Panel Structure:** [ ] CORRECT (Strategy only) / [ ] INCORRECT (has Media tab)

**Media Location:** [ ] Left Panel / [ ] Right Panel / [ ] Not Found

**Visual Artifacts:** [ ] NONE / [ ] PRESENT (describe below)

**Artifact Description:**
```
[Describe any visual artifacts, half-circles, overlays, etc.]
```

**Artifact Location:**
- [ ] Right panel
- [ ] Left panel
- [ ] Media section
- [ ] Other: _______________

**CSS Class Names (if artifact found):**
```
[Paste CSS class names from Inspector]
```

**Scrolling:** [ ] SMOOTH / [ ] GLITCHY

**Screenshot:** [ ] Attached

---

## 🟢 OVERALL SUMMARY

### Issue #1: News Hooks
- [ ] ✅ FIXED - Articles show recent dates only
- [ ] ❌ NOT FIXED - Still showing 400+ day old articles
- [ ] ⚠️ PARTIALLY FIXED - Some issues remain
- [ ] ❓ UNABLE TO TEST

### Issue #2: Media UI
- [ ] ✅ FIXED - No visual artifacts
- [ ] ❌ NOT FIXED - Half-circle overlay still present
- [ ] ⚠️ PARTIALLY FIXED - Some artifacts remain
- [ ] ❓ UNABLE TO TEST

---

## 📸 SCREENSHOTS CHECKLIST

- [ ] News Hooks section with article dates visible
- [ ] Browser console (if errors present)
- [ ] Media section in left panel
- [ ] Any visual artifacts (if present)
- [ ] Right panel showing "Strategy" only

---

## 🐛 ADDITIONAL OBSERVATIONS

**Performance:**
- Page load time: _______________
- News fetch time: _______________
- Any lag or delays: _______________

**Browser Used:**
- Browser: _______________
- Version: _______________
- OS: _______________

**Other Issues Found:**
```
[Note any other bugs or issues discovered during testing]
```

---

## 🔧 TROUBLESHOOTING

### If News Hooks Won't Load:
1. Check browser console for errors
2. Verify API keys are configured (Settings modal)
3. Check if database is connected
4. Try hard refresh (Cmd+Shift+R)

### If Media Section Not Found:
1. Hard refresh page (Cmd+Shift+R)
2. Clear browser cache
3. Check if viewing correct URL
4. Look in left panel for "Media & Calendar"

### If Page Won't Load:
1. Check if Railway deployment is active
2. Verify URL is correct
3. Check browser console for errors
4. Try different browser

---

## 📋 NEXT STEPS AFTER TESTING

### If Both Issues Fixed:
- ✅ Mark issues as resolved
- Document what fixed them
- Close related tickets

### If Issues Persist:
1. Share screenshots with development team
2. Provide console error logs
3. Note exact reproduction steps
4. Consider debugging locally

### If New Issues Found:
1. Document thoroughly
2. Take screenshots
3. Note reproduction steps
4. Create new tickets

---

## 📞 SUPPORT

If you need help with testing:
1. Share screenshots in this document
2. Copy console errors
3. Describe what you're seeing
4. Note any differences from expected behavior

---

**Testing Completed By:** _______________

**Date/Time:** _______________

**Duration:** _______________

**Notes:**
```
[Any additional notes or observations]
```
