# Check Railway Deployment Logs

The TAVILY_API_KEY variable is set, but tests still show 0 articles.

## Check Deployment Status

1. In Railway, click **"Deployments"** tab (next to Variables)
2. Look for the most recent deployment
3. Check if it says "Active" or "Deploying"
4. If still deploying, wait 1-2 more minutes

## View Logs

Click on the latest deployment to see logs. Look for:

### ✅ Success Messages (What We Want to See)
```
POST /api/pr/news-hooks
Searching for news with Tavily...
Found 25 unique articles from Tavily
Claude analysis complete
Inserted 15 of 15 articles into database
```

### ❌ Error Messages (Problems to Look For)
```
Tavily search error for query "...": 401 Unauthorized
Tavily search error for query "...": 429 Too Many Requests
Tavily search error for query "...": Network error
Error fetching news hooks: ...
```

## Common Issues

### Issue 1: Rate Limit
If you see "429 Too Many Requests":
- The API key has hit its rate limit
- May need to wait or get a new key from Tavily
- Free tier: 1,000 requests/month

### Issue 2: Invalid Key
If you see "401 Unauthorized":
- The API key may be invalid
- Try regenerating at https://tavily.com

### Issue 3: Deployment Not Complete
If logs don't show the POST request at all:
- Deployment may still be in progress
- Wait 2-3 more minutes
- Try the test again

## Manual Test

After checking logs, try manually triggering a refresh:

1. Go to: https://glossiboardupdate-production.up.railway.app/pr.html
2. Find "News Hooks" section
3. Click the refresh button (↻)
4. Watch the logs in Railway as you click
5. Should see "Searching for news with Tavily..." appear

## Next Steps

**If logs show Tavily errors:**
- Share the exact error message
- May need new API key

**If logs show nothing:**
- Deployment may not be complete
- Wait a few more minutes
- Run `./verify-tavily-fix.sh` again

**If logs show success but 0 articles:**
- Check the full log output
- May be a Claude filtering issue
- May need to adjust search queries
