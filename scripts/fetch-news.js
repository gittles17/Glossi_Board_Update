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
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
    
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
        
        // Filter for articles from last 60 days
        const recentArticles = (feed.items || [])
          .filter(item => {
            const pubDate = new Date(item.pubDate || item.isoDate || Date.now());
            return pubDate.getTime() > sixtyDaysAgo;
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
    
    // Step 2: Diversify article selection across outlets
    const articlesByOutlet = {};
    uniqueResults.forEach(article => {
      const outlet = article.domain;
      if (!articlesByOutlet[outlet]) articlesByOutlet[outlet] = [];
      articlesByOutlet[outlet].push(article);
    });
    
    // Take 3 articles from each outlet for diversity
    const articlesToAnalyze = [];
    Object.values(articlesByOutlet).forEach(outletArticles => {
      articlesToAnalyze.push(...outletArticles.slice(0, 3));
    });
    
    // Limit to 30 total articles
    const finalArticles = articlesToAnalyze.slice(0, 30);
    console.log(`Step 2: Sending ${finalArticles.length} articles from ${Object.keys(articlesByOutlet).length} outlets to Claude for analysis...\n`);
    
    const analysisPrompt = `You are curating strategic news for Glossi, an AI-powered 3D product visualization platform.

GLOSSI'S MARKET:
- Product: AI + 3D engine that creates unlimited product photos (eliminates photoshoots)
- Customers: Enterprise brands (CPG, fashion, beauty, e-commerce)
- Buyers: CMOs, creative directors, e-commerce directors
- Use case: Product marketing, e-commerce catalogs, social media content

INCLUDE ARTICLES ABOUT:

**Core Topics:**
1. **AI creative/marketing tools** - Midjourney, Adobe Firefly, Canva AI, design automation, AI content generation
2. **E-commerce platforms & tech** - Shopify, Amazon, 3D/AR product views, visual commerce innovations
3. **Creative automation platforms** - Workflow tools, brand asset management, DAM/CMS systems
4. **AI image generation** - Midjourney, DALL-E, Stable Diffusion for commercial use

**Adjacent Tech:**
5. **3D engines for commerce** - Unreal Engine, Unity applied to product visualization, browser 3D tech
6. **Digital twins & virtual showrooms** - Virtual product experiences, immersive brand environments
7. **Brand AI workflow implementation** - How companies deploy AI in creative/marketing operations

**Customer Industries:**
8. **DTC brand strategies** - Direct-to-consumer challenges, content production at scale, omnichannel
9. **Retail digital transformation** - Store tech, online merchandising, customer experience innovation
10. **Fashion tech** - Digital fashion, virtual samples, sustainability in fashion production

**Buyer Insights:**
11. **CMO priorities** - Marketing leadership trends, budget allocation, team structure
12. **Creative operations** - Production workflows, bottlenecks, efficiency improvements
13. **Marketing tech stack** - Tool consolidation, integration trends, martech evolution
14. **Agency vs in-house** - Production model shifts, hybrid approaches

**Market Signals:**
15. **Funding/M&A in creative/martech** - Who's raising, acquisitions, market consolidation
16. **Pricing model evolution** - Consumption-based pricing, credit systems, enterprise deals
17. **Platform partnerships** - Shopify apps, marketplace integrations, ecosystem plays

STRONG EXCLUDE:
- Autonomous vehicles, robotics, IoT, drones
- Gaming (unless specifically about engines for product visualization)
- Celebrity profiles, entertainment IP, movies/TV
- Cybersecurity, developer tools (unless creative workflow related)
- Healthcare, biotech, fintech, crypto
- Manufacturing, supply chain, logistics (unless about product content)
- Hardware/chips (unless about rendering/AI acceleration)
- Space tech, infrastructure
- Generic AI research without clear business application
- Politics, policy, tariffs (unless directly impacting e-commerce/DTC brands)

TASK: Return ONLY 12-18 articles with direct relevance to Glossi's market. Be ruthlessly selective.

ARTICLES:
${finalArticles.map((article, i) => `
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
      "relevance": "Topic #X: [explain connection]"
    }
  ]
}

CRITICAL: Only include articles you're recommending. Do NOT include articles with "EXCLUDED" or "Not relevant" in the relevance field. If you think an article should be excluded, simply don't add it to the JSON array.

Rules:
- CRITICAL: Return ONLY 12-18 articles that you would actually recommend
- Do NOT include articles you're marking as "Excluded", "Minimal relevance", or questionable fit
- If an article doesn't clearly fit one of the 17 topics, DON'T RETURN IT (don't include it with "excluded" note)
- Remove duplicates (same story from different outlets = pick one)
- Good articles: direct connection to one of the 17 topics
- Examples of GOOD: "Shopify adds 3D viewer", "CMO survey shows content bottleneck", "DTC brand raises funding", "Canva prices for enterprise"
- Examples to EXCLUDE: "Waymo robotaxis", "Wildlife trafficking", "Celebrity fitness", "Generic policy"
- In 'relevance': state which topic # and explain the connection
- Prioritize: last 14 days > last 30 days > older
- Sort by relevance (most direct connection first)
- Use exact domain from SOURCE field for outlet name`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
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
