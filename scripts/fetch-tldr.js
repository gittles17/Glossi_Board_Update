const { Pool } = require('pg');
const axios = require('axios');

const useDatabase = !!process.env.DATABASE_URL;
const pool = useDatabase ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  idleTimeoutMillis: 30000
}) : null;

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function extractArticlesFromHtml(html) {
  const articles = [];
  const articleRegex = /<article[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>\s*<h3>([\s\S]*?)<\/h3>\s*<\/a>\s*<div class="newsletter-html"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/gi;

  let match;
  while ((match = articleRegex.exec(html)) !== null) {
    const rawUrl = decodeHtmlEntities(match[1]);
    const title = stripHtml(match[2]);
    const description = stripHtml(match[3]);

    if (title.toLowerCase().includes('sponsor')) continue;

    const cleanUrl = rawUrl.replace(/[?&]utm_source=tldrai/g, '').replace(/[?&]$/, '');

    articles.push({ url: cleanUrl, title: title.replace(/\s*\(\d+\s*minute\s*read\)\s*$/i, ''), description });
  }

  return articles;
}

function extractOutletFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const map = {
      'blog.google': 'Google',
      'techcrunch.com': 'TechCrunch',
      'theverge.com': 'The Verge',
      'wired.com': 'WIRED',
      'venturebeat.com': 'VentureBeat',
      'technologyreview.com': 'MIT Technology Review',
      'arstechnica.com': 'Ars Technica',
      'fastcompany.com': 'Fast Company',
      'businessinsider.com': 'Business Insider',
      'forbes.com': 'Forbes',
      'cnbc.com': 'CNBC',
      'reuters.com': 'Reuters',
      'bloomberg.com': 'Bloomberg',
      'ben-evans.com': 'Ben Evans',
      'fortune.com': 'Fortune',
      '9to5mac.com': '9to5Mac',
      'arxiv.org': 'arXiv'
    };
    return map[hostname] || hostname;
  } catch {
    return 'Unknown';
  }
}

async function fetchFullArticle(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      maxContentLength: 500000
    });

    const html = response.data;
    if (typeof html !== 'string') return null;

    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = pRegex.exec(html)) !== null) {
      const text = stripHtml(m[1]).trim();
      if (text.length > 30) paragraphs.push(text);
    }

    return paragraphs.join('\n\n').substring(0, 5000) || null;
  } catch {
    return null;
  }
}

async function fetchTldr() {
  try {
    console.log('========================================');
    console.log('Starting TLDR AI newsletter fetch...');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('========================================\n');

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');
    if (!useDatabase) throw new Error('DATABASE_URL not configured');

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE pr_news_hooks ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'rss';
        ALTER TABLE pr_news_hooks ADD COLUMN IF NOT EXISTS glossi_takeaway TEXT;
      END $$;
    `);

    const today = new Date().toISOString().split('T')[0];
    const url = `https://tldr.tech/ai/${today}`;

    console.log(`Step 1: Fetching TLDR AI newsletter for ${today}...`);
    console.log(`URL: ${url}\n`);

    let html;
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      html = response.data;
    } catch {
      console.log("Today's newsletter not available, trying latest...");
      const latestResponse = await axios.get('https://tldr.tech/api/latest/ai', {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      html = latestResponse.data;
    }

    console.log('Step 2: Extracting articles from newsletter...\n');
    const articles = extractArticlesFromHtml(html);
    console.log(`Found ${articles.length} articles (excluding sponsors)\n`);

    if (articles.length === 0) {
      console.log('No articles found in newsletter');
      process.exit(0);
    }

    console.log('Step 3: Fetching full article content...\n');

    const fetchPromises = articles.map(async (article) => {
      article.fullContent = await fetchFullArticle(article.url);
      article.outlet = extractOutletFromUrl(article.url);
      const status = article.fullContent ? `${article.fullContent.length} chars` : 'unavailable';
      console.log(`  ${article.outlet}: ${article.title.substring(0, 55)}... (${status})`);
    });
    await Promise.all(fetchPromises);

    console.log('\nStep 4: Claude analysis for Glossi relevance...\n');

    const analysisPrompt = `You are a strategic analyst for Glossi, an AI-powered 3D product visualization platform.

ABOUT GLOSSI:
- Product: AI + 3D engine that creates unlimited product photos (eliminates photoshoots)
- Customers: Enterprise brands (CPG, fashion, beauty, e-commerce)
- Buyers: CMOs, creative directors, e-commerce directors
- Stage: Seed-stage startup, actively fundraising
- Use case: Product marketing, e-commerce catalogs, social media content

TASK: Analyze these articles from today's TLDR AI newsletter. For each RELEVANT article, provide a relevance assessment and a specific "Glossi takeaway."

RELEVANCE CRITERIA (priority order):
1. AI creative/marketing tools, image generation for commercial use
2. E-commerce platforms, 3D/AR product visualization, visual commerce
3. Creative automation, brand asset management, content production at scale
4. DTC brand strategies, retail digital transformation, fashion tech
5. Enterprise AI adoption in marketing/creative operations
6. Funding/M&A in creative tech, martech, or adjacent markets
7. Platform partnerships, marketplace integrations, ecosystem plays

EXCLUDE:
- Pure AI research with no business application
- Cybersecurity, developer tools, healthcare, biotech, fintech, crypto
- Autonomous vehicles, robotics, gaming (unless product visualization)
- Celebrity/corporate drama, politics, general AI philosophy
- AI model benchmarks or capabilities (unless applied to creative/commerce)

ARTICLES:
${articles.map((a, i) => `
${i + 1}. TITLE: ${a.title}
   OUTLET: ${a.outlet}
   URL: ${a.url}
   TLDR SUMMARY: ${a.description}
   ${a.fullContent ? `FULL ARTICLE EXCERPT:\n${a.fullContent.substring(0, 2000)}` : 'FULL ARTICLE: Not available'}
`).join('\n')}

Return JSON:
{
  "articles": [
    {
      "title": "Clean article title",
      "url": "Article URL",
      "outlet": "Publication name",
      "summary": "1-2 sentence summary",
      "relevance": "Why this matters to Glossi's market (1 sentence)",
      "angle_title": "Short angle label (3-5 words, e.g. 'AI Creative Tools', 'Visual Commerce Growth')",
      "glossi_takeaway": "Specific, actionable insight for Glossi: what to say in investor meetings, how to position, sales angle, or strategic implication. Be concrete. 2-3 sentences."
    }
  ]
}

Rules:
- Only include articles with CLEAR relevance. Quality over quantity.
- glossi_takeaway must be specific and actionable, not generic
- If fewer than 2 articles are relevant, that's fine
- Return ONLY the JSON, no other text`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: 'You are a strategic business analyst. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const analysisText = analysisResponse.data.content?.[0]?.text || '{}';
    console.log('Claude analysis complete\n');

    let analysisData;
    try {
      let cleanedText = analysisText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : { articles: [] };
      console.log(`Claude selected ${analysisData.articles?.length || 0} relevant articles for Glossi\n`);
    } catch (error) {
      console.error('Failed to parse Claude analysis:', error.message);
      analysisData = { articles: [] };
    }

    console.log('Step 5: Saving to database...\n');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of (analysisData.articles || [])) {
      try {
        const existing = await pool.query(
          'SELECT id FROM pr_news_hooks WHERE url = $1 OR headline = $2 LIMIT 1',
          [item.url || '', item.title || '']
        );

        if (existing.rows.length > 0) {
          skippedCount++;
          console.log(`  ~ Skipped (duplicate): ${item.title}`);
          continue;
        }

        await pool.query(`
          INSERT INTO pr_news_hooks (headline, outlet, date, url, summary, relevance, angle_title, angle_narrative, glossi_takeaway, source, fetched_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'tldr', NOW())
        `, [
          item.title || 'No title',
          item.outlet || 'TLDR AI',
          today,
          item.url || '',
          item.summary || '',
          item.relevance || '',
          item.angle_title || 'TLDR AI Insight',
          item.glossi_takeaway || '',
          item.glossi_takeaway || ''
        ]);
        insertedCount++;
        console.log(`  + ${item.title}`);
      } catch (error) {
        console.error(`  x Error inserting: ${error.message}`);
      }
    }

    console.log(`\nInserted ${insertedCount} articles, skipped ${skippedCount} duplicates\n`);

    console.log('========================================');
    console.log('TLDR AI newsletter fetch complete!');
    console.log('========================================');
    console.log(`Relevant articles: ${analysisData.articles?.length || 0}`);
    console.log(`New articles saved: ${insertedCount}`);
    console.log('========================================\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n========================================');
    console.error('TLDR fetch failed');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================\n');

    if (pool) await pool.end();
    process.exit(1);
  }
}

fetchTldr();
