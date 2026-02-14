# News Hooks Issue Fix - Feb 13, 2026

## Problem
News Hooks feature was returning example/placeholder data like:
- "Example headline would go here"
- "This would be a one-sentence summary of the article"
- Generic placeholder text instead of real news articles

## Root Cause
The Anthropic Claude Messages API **does not include web search capabilities by default**. When asked to "search" for news articles, Claude generates example responses that match the requested JSON format instead of actually searching the web.

## Solution Applied

### 1. Added Detection for Example Data
```javascript
// Check if response contains example/placeholder data
const hasExampleData = newsData.news?.some(item => 
  item.headline?.toLowerCase().includes('example') || 
  item.headline?.toLowerCase().includes('placeholder') ||
  item.summary?.toLowerCase().includes('would be')
);

if (hasExampleData) {
  return res.json({ 
    success: false, 
    error: 'Claude returned example data. This model may not have web search capabilities.'
  });
}
```

### 2. Updated Prompt Instructions
```javascript
CRITICAL INSTRUCTIONS:
1. Only return REAL news articles
2. Do NOT generate example, placeholder, or hypothetical articles
3. If you cannot find real articles, return an empty array: {"news": []}
4. Every article MUST have a real, valid URL
```

### 3. Added Logging
```javascript
console.log('Claude response for news hooks:', newsText.substring(0, 500));
```

## Options to Fix This Permanently

### Option 1: Use News API (Recommended)
Integrate with a real news API service:
- **NewsAPI.org** - Free tier: 100 requests/day
- **Google News API**
- **Bing News Search API**

### Option 2: Enable Claude Extended Thinking
If available, enable Claude's extended thinking/search capabilities:
- Check Anthropic console for extended features
- May require different API endpoint or beta access

### Option 3: Web Scraping
Implement custom web scraping:
- Use Puppeteer or Playwright
- Scrape TechCrunch, The Verge, etc. directly
- Parse RSS feeds from target publications

### Option 4: Manual Curation
As a temporary workaround:
- Manually add news hooks as sources
- Use the "Add Source" feature with URLs
- Paste in article URLs and let Claude analyze them

## Recommended Next Steps

1. **Immediate**: Document this limitation for users
2. **Short-term**: Integrate NewsAPI.org (free tier should be sufficient)
3. **Long-term**: Build custom RSS feed aggregator or web scraper

## Implementation Example (NewsAPI)

```javascript
// Install: npm install newsapi
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(process.env.NEWSAPI_KEY);

app.post('/api/pr/news-hooks', async (req, res) => {
  try {
    const response = await newsapi.v2.everything({
      q: '(AI OR "artificial intelligence" OR "3D rendering" OR "product visualization")',
      sources: 'techcrunch,the-verge,wired,ars-technica',
      language: 'en',
      sortBy: 'publishedAt',
      from: sevenDaysAgo,
      to: today
    });
    
    // Transform to our format
    const news = response.articles.map(article => ({
      headline: article.title,
      outlet: article.source.name,
      date: article.publishedAt.split('T')[0],
      url: article.url,
      summary: article.description,
      relevance: '' // Can use Claude to analyze relevance to Glossi
    }));
    
    res.json({ success: true, news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Status
- ✅ Detection added for example data
- ✅ Better error messages
- ✅ Logging added for debugging
- ⚠️ Still requires real web search integration for full functionality
