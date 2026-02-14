# Tavily + Claude News Hooks Integration

## Overview
News hooks now use a two-step process:
1. **Tavily API** searches the web for recent tech news
2. **Claude Opus** analyzes results for relevance to Glossi

This replaces the previous Claude-only approach which returned example data.

## How It Works

### Step 1: Tavily Search
Searches 5 topic areas with Tavily's news search:
- AI machine learning, generative AI, LLMs
- 3D rendering, visualization, computer vision
- E-commerce, product visualization, retail tech
- Marketing technology, creative AI tools
- Enterprise AI adoption, brand technology

**Search parameters:**
- `searchDepth: 'basic'` - Fast search
- `topic: 'news'` - News articles only
- `days: 7` - Last 7 days
- `maxResults: 5` per query (25 total)
- Filtered to major tech publications (TechCrunch, The Verge, Wired, etc.)

### Step 2: Claude Analysis
Claude Opus receives all Tavily results and:
- Filters for relevance to Glossi
- Generates concise summaries
- Explains how Glossi ties into each story
- Returns max 15 most relevant articles
- Sorts by relevance

## API Key Configuration

### Option 1: Environment Variable (Recommended)
```bash
export TAVILY_API_KEY="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"
```

Add to your `.env` file or Railway/hosting service environment variables.

### Option 2: Hardcoded (Currently Active)
The key is hardcoded in `server.js` as a fallback:
```javascript
const tavilyKey = process.env.TAVILY_API_KEY || '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';
```

## Dependencies

### Installed Packages
```bash
npm install @tavily/core
```

Already added to `package.json`:
- `@tavily/core` - Tavily JavaScript SDK

## Response Format

### Tavily Results (Raw)
```javascript
{
  results: [
    {
      title: "Article title",
      url: "https://...",
      content: "Article preview text...",
      publishedDate: "2026-02-12T...",
      score: 0.95
    }
  ]
}
```

### Claude Analysis (Final Output)
```javascript
{
  news: [
    {
      headline: "Article title",
      outlet: "techcrunch.com",
      date: "2026-02-12",
      url: "https://...",
      summary: "One sentence summary",
      relevance: "How Glossi ties into this story"
    }
  ]
}
```

## Error Handling

1. **Tavily API Error**: Logs error, continues with other queries
2. **Claude API Error**: Returns 500 error to client
3. **No Results**: Returns empty array with success: true
4. **Invalid Dates**: Normalizes to today's date
5. **Database Error**: Logs error, continues with other articles

## Performance

- **Typical Response Time**: 5-15 seconds
  - Tavily search: 2-5 seconds (5 queries)
  - Claude analysis: 3-10 seconds
  
- **Rate Limits**:
  - Tavily: 1000 requests/month (free tier)
  - Claude: Standard API limits

## Testing

To test the endpoint:
```bash
curl -X POST http://localhost:5500/api/pr/news-hooks \
  -H "Content-Type: application/json"
```

Should return real news articles with:
- Valid URLs
- Recent dates (last 7 days)
- Relevant summaries
- Glossi tie-in explanations

## Monitoring

Check server logs for:
```
Searching for news with Tavily...
Found X unique articles from Tavily
Claude analysis complete
Inserted X of Y articles into database
```

## Cost Estimate

Based on 10 news hook refreshes per day:

**Tavily:**
- Free tier: 1000 requests/month
- 5 queries per refresh = 50 queries/day = 1500/month
- Need paid plan: $49/month (10K requests)

**Claude:**
- ~2K tokens per analysis request
- 10 refreshes/day = 600K tokens/month
- Cost: ~$3-6/month

**Total: ~$55/month for unlimited daily refreshes**

## Future Improvements

1. **Caching**: Cache Tavily results for 1 hour to reduce API calls
2. **Incremental Updates**: Only search for new articles, not replace all
3. **More Sources**: Add RSS feeds as backup source
4. **Smart Scheduling**: Auto-refresh during business hours only
5. **Relevance Scoring**: Let Claude rate relevance 1-10, filter <7
