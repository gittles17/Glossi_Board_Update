# Railway Cron Job Setup for News Fetching

## Overview

The news fetching has been moved to a background cron job to avoid timeout issues. This setup allows the slow Tavily/Claude pipeline to run independently while users get instant access to cached results.

## Setup Instructions

### Option A: Run Once Now, Then Set Up Weekly Cron

1. **Run the script manually once to populate the database**
   - In Railway dashboard, go to your `Glossi_Board_Update` service
   - Click "Settings" tab
   - Scroll to "Custom Start Command"
   - Temporarily change it to: `npm run fetch-news`
   - Click "Deploy"
   - Wait for it to complete (check logs for "✓ News fetch completed successfully!")
   - Change start command back to: `node server.js`
   - Click "Deploy" again

2. **Set up the weekly cron job**
   - In Railway dashboard, go to your `Glossi_Board_Update` service
   - Click "Settings" tab
   - Scroll to "Cron Schedule"
   - Enable cron and add:
     - **Cron Expression:** `0 3 * * 1`
     - **Command:** `npm run fetch-news`
   - This will run every Monday at 3:00 AM UTC

### Option B: Create Separate Cron Service (Recommended for Production)

1. **Create a new service in Railway**
   - Click "+ New" → "Empty Service"
   - Name it `glossi-news-fetcher`
   
2. **Connect to same GitHub repo**
   - Connect to `gittles17/Glossi_Board_Update`
   - Same branch as main service

3. **Configure environment variables**
   - Copy these from your main `Glossi_Board_Update` service:
     - `DATABASE_URL` (shared variable to same database)
     - `ANTHROPIC_API_KEY`
     - `TAVILY_API_KEY`

4. **Set start command**
   - Settings → Custom Start Command: `npm run fetch-news`

5. **Set cron schedule**
   - Settings → Cron Schedule
   - Enable cron
   - **Cron Expression:** `0 3 * * 1` (Monday 3am UTC)
   - **Command:** `npm run fetch-news`

6. **Run it once manually**
   - Click "Deploy" to trigger first run
   - Check logs for "✓ News fetch completed successfully!"
   - Verify production site shows articles

## Cron Schedule Explained

`0 3 * * 1`
- `0` = minute (0th minute)
- `3` = hour (3am)
- `*` = day of month (any)
- `*` = month (any)
- `1` = day of week (Monday, 0=Sunday, 1=Monday, etc.)

**Result:** Runs every Monday at 3:00 AM UTC

### Other Schedule Options

- Every day at 3am: `0 3 * * *`
- Twice weekly (Mon/Thu 3am): `0 3 * * 1,4`
- Every 12 hours: `0 */12 * * *`

## What the Script Does

1. Connects to PostgreSQL database
2. Cleans up articles older than 30 days
3. Searches Tavily API with 10 different queries
4. Analyzes articles with Claude for relevance
5. Normalizes outlet names and dates
6. Saves to `pr_news_hooks` table
7. Logs comprehensive results
8. Exits cleanly for cron

## Expected Results

- **Duration:** 60-90 seconds
- **Articles:** 20-40 articles
- **Outlets:** 7-10 outlets
- **Distribution:** Forbes, TechCrunch, CNBC, Business of Fashion, etc.

## Monitoring

### Check logs in Railway:
```
========================================
✓ News fetch completed successfully!
========================================
Total articles: 29
Outlets: 7

Distribution:
  Forbes: 9
  Business of Fashion: 7
  TechCrunch: 5
  CNBC: 3
  Business Insider: 2
  Reuters: 2
  The Verge: 1
========================================
```

### Verify on production:
```bash
curl https://glossiboardupdate-production.up.railway.app/api/pr/news-hooks
```

Should return articles instantly (from cache).

## User Experience

**Before (with timeouts):**
- User clicks Refresh → 60s wait → timeout → 0 articles ❌

**After (with cron):**
- User loads page → instant → 29 cached articles ✅
- Articles auto-update weekly in background

## Troubleshooting

### If the cron job fails:

1. **Check logs** for error messages
2. **Verify environment variables** are set correctly
3. **Check database connection** - DATABASE_URL valid?
4. **Test manually** by deploying with `npm run fetch-news` command

### If no articles appear:

1. Check that cron job completed successfully in logs
2. Verify database has articles: `SELECT COUNT(*) FROM pr_news_hooks;`
3. Check GET endpoint returns articles
4. Clear Railway cache and redeploy if needed

## Benefits

✅ No user-facing timeouts
✅ Fresh articles weekly without manual intervention
✅ Instant page loads (reads from cache)
✅ Can run all 10 queries without rushing
✅ Better error handling and logging
✅ Automatic cleanup of old articles

## Manual Trigger (if needed)

To manually trigger a news refresh before the scheduled time:
1. Go to Railway → `glossi-news-fetcher` service (or main service if using Option A)
2. Click "Deploy" to trigger the cron job immediately
3. Check logs to verify completion
4. Refresh production site to see new articles
