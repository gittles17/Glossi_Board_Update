# Project Learnings

## 2026-02-01 - Modal Visibility Classes

**Failure**: Modal wouldn't show after clicking button
**Cause**: JS was adding `.active` class but CSS used `.visible`
**Lesson**: Always verify CSS class names match JS before assuming logic is broken

---

## 2026-02-01 - Debounced Save Race Condition

**Failure**: Deleted items reappeared after page refresh
**Cause**: Debounced save hadn't synced to server before refresh
**Lesson**: For destructive operations (delete), bypass debounce and save immediately with `storage.save()`

---

## 2026-02-01 - DOM Null Access Errors

**Failure**: TypeError when accessing DOM elements
**Cause**: Elements accessed without null checks during dynamic UI updates
**Lesson**: Always use optional chaining (`?.`) when accessing DOM elements that may not exist

---

## 2026-02-02 - AI JSON Response Parsing

**Failure**: JSON.parse failed on AI response
**Cause**: AI may include explanatory text or markdown fences around JSON
**Lesson**: Request "raw JSON only" in prompts and wrap parse in try/catch with fallback

---

## 2026-02-02 - Event Listener Memory Leaks

**Failure**: Multiple event handlers firing for single action
**Cause**: Adding event listeners inside functions called multiple times (e.g., modal open)
**Lesson**: Add event listeners once during init, use event delegation for dynamic elements

---
