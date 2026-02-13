const { Pool } = require('pg');
const Parser = require('rss-parser');
const axios = require('axios');

// Database configuration
const useDatabase = !!process.env.DATABASE_URL;
const pool = useDatabase ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  idleTimeoutMillis: 30000
}) : null;

// Outlet name normalization map
const OUTLET_NAME_MAP = {
  'techcrunch.com': 'TechCrunch',
  'www.techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'www.theverge.com': 'The Verge',
  'wired.com': 'WIRED',
  'www.wired.com': 'WIRED',
  'venturebeat.com': 'VentureBeat',
  'www.venturebeat.com': 'VentureBeat',
  'technologyreview.com': 'MIT Technology Review',
  'www.technologyreview.com': 'MIT Technology Review',
  'arstechnica.com': 'Ars Technica',
  'www.arstechnica.com': 'Ars Technica',
  'fastcompany.com': 'Fast Company',
  'www.fastcompany.com': 'Fast Company',
  'businessinsider.com': 'Business Insider',
  'www.businessinsider.com': 'Business Insider',
  'forbes.com': 'Forbes',
  'www.forbes.com': 'Forbes',
  'cnbc.com': 'CNBC',
  'www.cnbc.com': 'CNBC',
  'reuters.com': 'Reuters',
  'www.reuters.com': 'Reuters',
  'bloomberg.com': 'Bloomberg',
  'www.bloomberg.com': 'Bloomberg',
  'tldr.tech': 'TLDR',
  'www.tldr.tech': 'TLDR',
  'businessoffashion.com': 'Business of Fashion',
  'www.businessoffashion.com': 'Business of Fashion',
  'theinterline.com': 'The Interline',
  'www.theinterline.com': 'The Interline'
};

function normalizeOutletName(rawOutlet) {
  if (!rawOutlet) return 'Unknown';
  const cleaned = rawOutlet.toLowerCase().trim();
  return OUTLET_NAME_MAP[cleaned] || 
         OUTLET_NAME_MAP[cleaned.replace('www.', '')] || 
         rawOutlet;
}

async function fetchNews() {
  try {
    console.log('========================================');
    console.log('Starting news fetch job...');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('========================================\n');

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    
    if (!useDatabase) {
      throw new Error('DATABASE_URL not configured');
    }
    
    // Clean up old news hooks before fetching new ones (by article date)
    try {
      await pool.query(`
        DELETE FROM pr_news_hooks 
        WHERE date < NOW() - INTERVAL '30 days'
      `);
      console.log('✓ Cleaned up old news (>30 days)\n');
    } catch (cleanupError) {
      console.error('Error cleaning up old news:', cleanupError);
    }
    
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Initialize RSS parser
    const parser = new Parser({
      timeout: 10000,
      headers: {'User-Agent': 'Glossi News Fetcher/1.0'}
    });
    
    // Step 1: Fetch RSS feeds from outlets
    console.log('Step 1: Fetching RSS feeds from outlets...\n');
    
    const RSS_FEEDS = {
      'techcrunch.com': 'https://techcrunch.com/feed/',
      'www.theverge.com': 'https://www.theverge.com/rss/index.xml',
      'www.wired.com': 'https://www.wired.com/feed/rss',
      'arstechnica.com': 'https://feeds.arstechnica.com/arstechnica/index',
      'www.technologyreview.com': 'https://www.technologyreview.com/feed/',
      'venturebeat.com': 'http://feeds.venturebeat.com/VentureBeat',
      'www.forbes.com': 'https://www.forbes.com/innovation/feed2/',
      'www.cnbc.com': 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
      'www.businessinsider.com': 'https://www.businessinsider.com/rss',
      'www.reuters.com': 'https://www.reuters.com/technology',
      'www.fastcompany.com': 'https://www.fastcompany.com/technology/rss',
      'www.bloomberg.com': 'https://feeds.bloomberg.com/technology/news.rss',
      'www.theinterline.com': 'https://www.theinterline.com/feed/'
    };
    
    let allArticles = [];
    
    // Fetch each RSS feed
    for (const [domain, feedUrl] of Object.entries(RSS_FEEDS)) {
      try {
        const feed = await parser.parseURL(feedUrl);
        
        // Filter for articles from last 30 days
        const recentArticles = (feed.items || [])
          .filter(item => {
            const pubDate = new Date(item.pubDate || item.isoDate || Date.now());
            return pubDate.getTime() > thirtyDaysAgo;
          })
          .slice(0, 10)  // Top 10 per outlet
          .map(item => ({
            title: item.title,
            url: item.link,
            content: item.contentSnippet || item.summary || item.content || '',
            publishedDate: item.pubDate || item.isoDate,
            domain: domain
          }));
        
        allArticles = allArticles.concat(recentArticles);
        console.log(`  ${domain}: ${recentArticles.length} articles`);
        
      } catch (error) {
        console.log(`  ${domain}: ✗ ${error.message}`);
      }
    }
    
    console.log(`\n✓ RSS total: ${allArticles.length} articles from ${Object.keys(RSS_FEEDS).length} feeds`);
    
    // Remove duplicates by URL
    const uniqueResults = Array.from(new Map(allArticles.map(item => [item.url, item])).values());
    console.log(`✓ After dedup: ${uniqueResults.length} unique articles`);
    
    // Log outlet breakdown
    const outletCounts = {};
    uniqueResults.forEach(item => {
      const domain = item.domain || item.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown';
      outletCounts[domain] = (outletCounts[domain] || 0) + 1;
    });
    console.log('✓ Outlets found:', outletCounts);
    console.log('');
    
    if (uniqueResults.length === 0) {
      console.log('⚠️  Warning: No articles found in RSS feeds');
      console.log('   Job will exit without updating database');
      process.exit(0);
    }
    
    // Step 2: Use Claude to analyze relevance and generate summaries
    const articlesToAnalyze = uniqueResults.slice(0, 30);  // Analyze up to 30 articles for faster processing
    console.log(`Step 2: Sending ${articlesToAnalyze.length} articles to Claude for analysis...\n`);
    
    const analysisPrompt = `You are analyzing news articles for Glossi, an AI-native 3D product visualization platform.

GLOSSI CONTEXT:
- First AI-native 3D product visualization platform
- Core tech: compositing (not generation). Product 3D asset stays untouched, AI generates scenes around it
- Built on Unreal Engine 5, runs in browser
- Target: enterprise brands, e-commerce, CPG, fashion, beauty
- Key value: 80% reduction in product photo costs, unlimited variations, brand consistency

TASK: Analyze each article and determine if it's broadly relevant to tech, AI, 3D, visualization, e-commerce, marketing, creative industries, or brand technology. Be INCLUSIVE rather than overly selective.

ARTICLES:
${articlesToAnalyze.map((article, i) => `
${i + 1}. TITLE: ${article.title}
   SOURCE: ${article.domain}
   DATE: ${article.publishedDate || 'Recent'}
   SNIPPET: ${article.content?.substring(0, 300) || 'No preview'}
`).join('\n')}

Return articles in this JSON format:
{
  "news": [
    {
      "headline": "Original article title",
      "outlet": "Source domain (use the raw domain from SOURCE field)",
      "date": "YYYY-MM-DD format",
      "url": "Original URL",
      "summary": "One sentence summary of the article",
      "relevance": "ONE sentence explaining how this relates to Glossi or the industry"
    }
  ]
}

Rules:
- Include articles that are broadly relevant to tech, AI, 3D, visualization, e-commerce, creative industries, marketing, or brand technology
- Be INCLUSIVE - if there's any connection to these topics, include it
- Maximum 30 articles
- Sort by date (most recent first)
- Keep summaries and relevance statements concise (one sentence each)
- Use the exact domain from the SOURCE field for the outlet name`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      system: 'You are a strategic communications analyst. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    const analysisText = analysisResponse.data.content?.[0]?.text || '{}';
    console.log('✓ Claude analysis complete\n');
    
    let newsData;
    try {
      // Remove markdown code fences if present
      let cleanedText = analysisText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      newsData = jsonMatch ? JSON.parse(jsonMatch[0]) : { news: [] };
      console.log(`✓ Claude returned ${newsData.news?.length || 0} articles`);
      
      if ((newsData.news?.length || 0) === 0 && uniqueResults.length > 0) {
        console.log(`⚠️  Warning: Claude filtered out all ${uniqueResults.length} articles from RSS feeds`);
      }
    } catch (error) {
      console.error('Failed to parse Claude analysis:', error);
      console.error('Claude raw response:', analysisText.substring(0, 500));
      newsData = { news: [] };
    }
    console.log('');
    
    // Normalize dates, outlet names, and validate
    const normalizedNews = (newsData.news || []).map(item => {
      item.outlet = normalizeOutletName(item.outlet);
      let articleDate = item.date;
      
      if (!articleDate || articleDate === 'Recent') {
        articleDate = today;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(articleDate)) {
        try {
          const parsed = new Date(articleDate);
          if (!isNaN(parsed.getTime())) {
            articleDate = parsed.toISOString().split('T')[0];
          } else {
            articleDate = today;
          }
        } catch {
          articleDate = today;
        }
      }
      
      return {
        ...item,
        date: articleDate
      };
    });
    
    // Step 3: Save to database
    console.log('Step 3: Saving to database...\n');
    
    await pool.query('DELETE FROM pr_news_hooks');
    console.log('✓ Cleared old news from database');
    
    let insertedCount = 0;
    
    for (const item of normalizedNews) {
      try {
        await pool.query(`
          INSERT INTO pr_news_hooks (headline, outlet, date, url, summary, relevance, fetched_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          item.headline || 'No title',
          item.outlet || 'Unknown',
          item.date,
          item.url || '',
          item.summary || '',
          item.relevance || ''
        ]);
        insertedCount++;
      } catch (error) {
        console.error('Error inserting article:', error.message, item.headline);
      }
    }
    
    console.log(`✓ Inserted ${insertedCount} of ${normalizedNews.length} articles into database\n`);
    
    // Log final outlet distribution
    const finalOutletCounts = {};
    normalizedNews.forEach(item => {
      finalOutletCounts[item.outlet] = (finalOutletCounts[item.outlet] || 0) + 1;
    });
    
    console.log('========================================');
    console.log('✓ News fetch completed successfully!');
    console.log('========================================');
    console.log(`Total articles: ${normalizedNews.length}`);
    console.log(`Outlets: ${Object.keys(finalOutletCounts).length}`);
    console.log('\nDistribution:');
    Object.entries(finalOutletCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([outlet, count]) => {
        console.log(`  ${outlet}: ${count}`);
      });
    console.log('========================================\n');
    
    // Close database connection
    await pool.end();
    
    // Exit cleanly for Railway cron
    process.exit(0);
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ ERROR: News fetch failed');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================\n');
    
    if (pool) {
      await pool.end();
    }
    
    process.exit(1);
  }
}

// Run the fetch
fetchNews();
