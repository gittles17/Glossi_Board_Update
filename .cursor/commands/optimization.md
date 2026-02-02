I need you to help me optimize and clean up this codebase, but with extreme caution. Follow these rules strictly:

## RULES:
1. **NEVER change business logic or matching algorithms** - these have been tuned over time and work correctly
2. **Make ONE small change at a time** - then stop and explain what you did
3. **Before ANY change, explain:**
   - What you're about to change
   - Why it's safe (won't affect functionality)
   - What could break if you're wrong
4. **DO NOT refactor working code just for style** - only fix actual problems
5. **Preserve all existing variable names in core logic** - renaming can hide bugs

## PRIORITY ORDER (address one category at a time):
1. **Errors first**: Fix only clear syntax errors or undefined references
2. **Performance issues**: Only obvious ones (N+1 queries, missing indexes, memory leaks)
3. **Dead code**: Remove only code that is provably unreachable
4. **Type safety**: Add types without changing runtime behavior

## WHAT TO AVOID:
- Combining functions that "look similar"
- Rewriting loops as functional chains (map/filter/reduce) unless I approve
- Changing data structures
- "Modernizing" syntax that works fine
- Touching anything related to matching/scoring/ranking logic

Start by giving me a summary of what you see, categorized by the priority order above. Don't make any changes yet—just report what you find.