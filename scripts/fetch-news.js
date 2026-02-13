const { Pool } = require('pg');
const { tavily } = require('@tavily/core');
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
    const tavilyKey = process.env.TAVILY_API_KEY || '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';
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    
    if (!tavilyKey) {
      throw new Error('TAVILY_API_KEY not configured');
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
    
    // Initialize Tavily client
    const tvly = tavily({ apiKey: tavilyKey });
    
    // Step 1: Use Tavily to search for recent tech news
    console.log('Step 1: Searching for news with Tavily...\n');
    
    const searchQueries = [
      'AI machine learning generative AI',
      '3D rendering visualization computer vision',
      'e-commerce product visualization retail',
      'marketing technology creative AI tools',
      'enterprise AI adoption brand technology'
    ];
    
    let allResults = [];
    
    // Search each topic
    for (const query of searchQueries) {
      try {
        const searchResult = await tvly.search(query, {
          searchDepth: 'basic',
          topic: 'news',
          days: 30,
          maxResults: 10,
          includeDomains: ['techcrunch.com', 'theverge.com', 'wired.com', 'venturebeat.com', 'technologyreview.com', 'arstechnica.com', 'fastcompany.com', 'businessinsider.com', 'forbes.com', 'cnbc.com', 'reuters.com', 'bloomberg.com', 'tldr.tech', 'businessoffashion.com', 'theinterline.com']
        });
        
        if (searchResult.results) {
          allResults = allResults.concat(searchResult.results);
          console.log(`  "${query}": ${searchResult.results.length} articles`);
        } else {
          console.log(`  "${query}": No results object returned`);
        }
      } catch (error) {
        console.error(`  Tavily search error for query "${query}":`, error.message);
      }
    }
    
    console.log(`\n✓ Tavily total: ${allResults.length} articles before dedup`);
    
    // Remove duplicates by URL
    const uniqueResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());
    console.log(`✓ After dedup: ${uniqueResults.length} unique articles`);
    
    // Log outlet breakdown
    const outletCounts = {};
    uniqueResults.forEach(item => {
      const domain = item.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown';
      outletCounts[domain] = (outletCounts[domain] || 0) + 1;
    });
    console.log('✓ Outlets found:', outletCounts);
    console.log('');
    
    if (uniqueResults.length === 0) {
      console.log('⚠️  Warning: Tavily returned 0 articles');
      console.log('   Job will exit without updating database');
      process.exit(0);
    }
    
    // Step 2: Use Claude to analyze relevance and generate summaries
    const articlesToAnalyze = uniqueResults.slice(0, 40);
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
   SOURCE: ${article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown'}
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
- Maximum 40 articles (increased from 15)
- Sort by date (most recent first)
- Keep summaries and relevance statements concise (one sentence each)
- Use the exact domain from the SOURCE field for the outlet name`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      newsData = jsonMatch ? JSON.parse(jsonMatch[0]) : { news: [] };
      console.log(`✓ Claude returned ${newsData.news?.length || 0} articles`);
      
      if ((newsData.news?.length || 0) === 0 && uniqueResults.length > 0) {
        console.log(`⚠️  Warning: Claude filtered out all ${uniqueResults.length} articles from Tavily`);
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
