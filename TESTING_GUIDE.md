# Testing Guide - Strategy Workflow Implementation

## Pre-Deployment Checklist

Before deploying to production, verify all features work correctly.

---

## 1. Environment Setup

**Check API Key:**
```bash
echo $ANTHROPIC_API_KEY
```

If not set:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Start Server:**
```bash
npm start
# or
node server.js
```

Navigate to `http://localhost:5500/pr.html`

---

## 2. Automated Tests

### Run Test Scripts

**Open browser console and run:**

```javascript
// Test current state
const scriptBaseline = document.createElement('script');
scriptBaseline.src = './test-current-state.js';
document.body.appendChild(scriptBaseline);

// Wait 2 seconds, then test new features
setTimeout(() => {
  const scriptFeatures = document.createElement('script');
  scriptFeatures.src = './test-strategy-features.js';
  document.body.appendChild(scriptFeatures);
}, 2000);
```

**Expected Results:**
- All baseline tests should pass
- All strategy feature tests should pass
- No console errors

---

## 3. Manual Testing Checklist

### Tab Navigation
- [ ] Strategy tab is visible and active by default
- [ ] Clicking Sources tab shows sources panel
- [ ] Clicking Library tab shows content library
- [ ] Mobile tabs work correctly (test at <768px width)

### News Hooks (in Strategy Tab)
- [ ] News hooks section displays
- [ ] Click "Refresh" button - shows loading state
- [ ] News hooks populate with realistic data
- [ ] Date filter works (7 days, 30 days, 60 days, all)
- [ ] Outlet filter button opens modal
- [ ] Selecting outlets filters news correctly
- [ ] "Clear" button resets filters
- [ ] Click "Use as Hook" - creates source in Sources tab
- [ ] Source appears in Sources tab with news content

### Angles (No Sources)
- [ ] With empty sources, default angles appear
- [ ] Three default angles visible:
  - "Brand Decay at Scale"
  - "World Models Validate Our Bet"
  - "Green Screen for Products"
- [ ] Each shows urgency badge (🔴🟡🟢)
- [ ] Expand button reveals content plan
- [ ] Content plan items show with priorities
- [ ] "Create Content →" button exists
- [ ] No delete button on default angles

### Angles (With Sources)
- [ ] Add at least 2 sources via Sources tab
- [ ] Click "Generate Angles" in Strategy tab
- [ ] Loading state appears
- [ ] 3-4 strategic angles generate
- [ ] Angles show narrative and "why now"
- [ ] Angles can be expanded/collapsed
- [ ] Content plans display correctly
- [ ] Delete button appears on generated angles (not defaults)
- [ ] Deleting angle removes it from list

### Angle to Content Flow
- [ ] Click "Create Content →" on any angle
- [ ] Workspace panel activates (switches tab on mobile)
- [ ] Content type dropdown pre-fills with first plan item
- [ ] Click "Generate" button
- [ ] Content generates successfully
- [ ] Content includes angle narrative in style
- [ ] Active Angle Tracker section appears
- [ ] Tracker shows angle title and progress
- [ ] First content plan item marked complete (✅)
- [ ] Generate another type from same angle
- [ ] Second item marks complete
- [ ] When all complete, tracker hides

### Angle Tracker Edge Cases
- [ ] Tracker hidden when no active angle
- [ ] Tracker persists across page refresh
- [ ] Switching angles updates tracker
- [ ] Completing all items clears active angle
- [ ] Can start new angle after completing one

### Sources Tab (Renamed from Research)
- [ ] Sources tab click shows source list
- [ ] Add source button works
- [ ] Search sources works
- [ ] Edit Foundation button opens wizard
- [ ] All existing source functionality intact

### Library Tab
- [ ] Library tab click shows content history
- [ ] Generated content appears in list
- [ ] Phase filters work (Edit, Review, Publish)
- [ ] Click content item loads it in workspace

---

## 4. Error Scenarios

### No API Key
- [ ] Generate angles without API key
- [ ] Error message displays gracefully
- [ ] Default angles still available
- [ ] UI remains functional

### Network Errors
- [ ] Disconnect network
- [ ] Try generating angles
- [ ] Error message appears
- [ ] Can retry after reconnecting

### Invalid Source Data
- [ ] Generate angles with empty source content
- [ ] Angles still generate (uses prompts)
- [ ] No crashes or console errors

### Large Data Sets
- [ ] Add 20+ sources
- [ ] Generate angles
- [ ] Performance acceptable (<5 seconds)
- [ ] UI remains responsive

---

## 5. Regression Testing

### Verify Existing Features Still Work
- [ ] Wizard opens and saves correctly
- [ ] File upload (PDF, text) works
- [ ] Audio recording/transcription works
- [ ] URL fetching works
- [ ] Content generation (non-angle) works
- [ ] Media manager displays journalists
- [ ] Calendar manager shows events
- [ ] Export content works (copy, HTML)
- [ ] Copy to clipboard works
- [ ] Chat refinement works

---

## 6. Mobile Testing

**Test at these breakpoints:**
- [ ] 320px (iPhone SE)
- [ ] 375px (iPhone standard)
- [ ] 768px (iPad)
- [ ] 1024px (iPad landscape)

**Mobile-Specific Checks:**
- [ ] Mobile tabs switch correctly
- [ ] Strategy tab accessible on mobile
- [ ] Angle cards readable and tappable
- [ ] Buttons properly sized (min 44x44px)
- [ ] No horizontal scrolling
- [ ] Text remains readable
- [ ] Filters work on mobile

---

## 7. Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## 8. Performance Checks

**Verify:**
- [ ] Page load time <3 seconds
- [ ] Angle generation completes <10 seconds
- [ ] No memory leaks (check DevTools memory tab)
- [ ] Smooth animations (60fps)
- [ ] localStorage not exceeding 5MB

---

## 9. Data Persistence

**Test localStorage:**
```javascript
// Check what's stored
console.log('Angles:', JSON.parse(localStorage.getItem('pr_angles')));
console.log('Active Angle:', JSON.parse(localStorage.getItem('pr_active_angle')));
console.log('Expanded:', JSON.parse(localStorage.getItem('pr_expanded_angles')));
```

**Verify:**
- [ ] Angles persist after refresh
- [ ] Active angle persists
- [ ] Expanded state persists
- [ ] Clearing localStorage resets correctly

---

## 10. Console Errors

**Open DevTools Console:**
- [ ] No errors on page load
- [ ] No errors when clicking Strategy tab
- [ ] No errors when generating angles
- [ ] No errors when creating content
- [ ] No warnings about deprecated APIs

---

## 11. Accessibility

**Quick Checks:**
- [ ] Tab navigation works (keyboard only)
- [ ] Buttons have clear hover states
- [ ] Text contrast meets WCAG AA (4.5:1)
- [ ] Focus indicators visible
- [ ] Screen reader text appropriate

---

## Pass Criteria

**Minimum to Deploy:**
- ✅ All automated tests pass
- ✅ No console errors
- ✅ Strategy tab loads correctly
- ✅ Angles generate successfully
- ✅ Content creation flow works
- ✅ No regressions in existing features
- ✅ Mobile experience functional

**Optional (Can Fix Post-Launch):**
- Minor UI polish
- Performance optimizations
- Additional error messages

---

## If Tests Fail

1. Check `IMPLEMENTATION_SUMMARY.md` for expected behavior
2. Review console errors
3. Verify API key is set correctly
4. Check network tab for failed requests
5. Compare with `glossi-pr-strategy-addendum.md` spec

---

## Deployment

**When all tests pass:**

1. Commit changes:
```bash
git add .
git commit -m "Implement strategy-first workflow with angles and tracking"
git push
```

2. Deploy to Railway/Vercel:
```bash
# Railway auto-deploys on push
# or manually:
railway up
```

3. Verify production deployment
4. Monitor for errors in first 24 hours

---

**Testing Date:** February 13, 2026  
**Tester:** [Your Name]  
**Status:** ⏳ Ready for Testing
