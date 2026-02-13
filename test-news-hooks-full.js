const { tavily } = require('@tavily/core');
const axios = require('axios');

async function testFullNewsHooksFlow() {
  console.log('\n=== TESTING FULL NEWS HOOKS FLOW (TAVILY + CLAUDE) ===\n');
  
  const tavilyKey = process.env.TAVILY_API_KEY || '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';
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!tavilyKey) {
    console.error('❌ TAVILY_API_KEY not found');
    process.exit(1);
  }
  
  if (!anthropicKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.log('\nTo test the full flow, set your API key:');
    console.log('export ANTHROPIC_API_KEY="your-key-here"\n');
    process.exit(1);
  }
  
  console.log('✓ API keys configured\n');
  
  console.log('STEP 1: TAVILY SEARCH');
  console.log('='.repeat(80));
  
  const tvly = tavily({ apiKey: tavilyKey });
  
  const searchQueries = [
    'AI machine learning generative AI LLM',
    '3D rendering visualization computer vision',
    'e-commerce product visualization retail tech',
    'marketing technology creative AI tools',
    'enterprise AI adoption brand technology'
  ];
  
  const targetDomains = [
    'techcrunch.com', 
    'theverge.com', 
    'wired.com', 
    'venturebeat.com', 
    'technologyreview.com', 
    'arstechnica.com', 
    'fastcompany.com', 
    'businessinsider.com', 
    'forbes.com', 
    'cnbc.com', 
    'reuters.com', 
    'bloomberg.com', 
    'tldr.tech'
  ];
  
  let allResults = [];
  const startTime = Date.now();
  
  for (const query of searchQueries) {
    try {
      const searchResult = await tvly.search(query, {
        searchDepth: 'basic',
        topic: 'news',
        days: 7,
        maxResults: 5,
        includeDomains: targetDomains
      });
      
      if (searchResult.results) {
        allResults = allResults.concat(searchResult.results);
      }
    } catch (error) {
      console.error(`   ❌ Error for "${query}": ${error.message}`);
    }
  }
  
  const uniqueResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());
  const tavilyTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n✓ Tavily search complete: ${uniqueResults.length} unique articles (${tavilyTime}s)\n`);
  
  if (uniqueResults.length === 0) {
    console.error('❌ No articles found from Tavily. Cannot proceed with Claude analysis.');
    process.exit(1);
  }
  
  console.log('\nSTEP 2: CLAUDE RELEVANCE ANALYSIS');
  console.log('='.repeat(80));
  
  const analysisPrompt = `You are analyzing news articles for Glossi, an AI-native 3D product visualization platform.

GLOSSI CONTEXT:
- First AI-native 3D product visualization platform
- Core tech: compositing (not generation). Product 3D asset stays untouched, AI generates scenes around it
- Built on Unreal Engine 5, runs in browser
- Target: enterprise brands, e-commerce, CPG, fashion, beauty
- Key value: 80% reduction in product photo costs, unlimited variations, brand consistency

TASK: For each article below, determine if it's relevant to Glossi and provide a brief relevance statement. Only include articles that are relevant.

ARTICLES:
${uniqueResults.slice(0, 20).map((article, i) => `
${i + 1}. TITLE: ${article.title}
   SOURCE: ${article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown'}
   DATE: ${article.publishedDate || 'Recent'}
   SNIPPET: ${article.content?.substring(0, 300) || 'No preview'}
`).join('\n')}

Return ONLY articles relevant to Glossi in this JSON format:
{
  "news": [
    {
      "headline": "Original article title",
      "outlet": "Source domain",
      "date": "YYYY-MM-DD format",
      "url": "Original URL",
      "summary": "One sentence summary of the article",
      "relevance": "ONE sentence explaining how Glossi ties into this story"
    }
  ]
}

Rules:
- Only include relevant articles (AI, 3D, visualization, e-commerce, creative tech, marketing tech, brand tech)
- Maximum 15 articles
- Sort by relevance to Glossi
- Keep summaries and relevance statements concise (one sentence each)`;

  const claudeStartTime = Date.now();
  
  try {
    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-opus-4-6',
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
    
    const claudeTime = ((Date.now() - claudeStartTime) / 1000).toFixed(2);
    const analysisText = analysisResponse.data.content?.[0]?.text || '{}';
    
    console.log(`\n✓ Claude analysis complete (${claudeTime}s)\n`);
    
    let newsData;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      newsData = jsonMatch ? JSON.parse(jsonMatch[0]) : { news: [] };
    } catch (error) {
      console.error('❌ Failed to parse Claude response:', error.message);
      console.log('\nRaw Claude response:');
      console.log(analysisText.substring(0, 500));
      process.exit(1);
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    const normalizedNews = (newsData.news || []).map(item => {
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
    
    console.log('\nSTEP 3: RESULTS');
    console.log('='.repeat(80));
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\nTotal time: ${totalTime}s`);
    console.log(`  - Tavily search: ${tavilyTime}s`);
    console.log(`  - Claude analysis: ${claudeTime}s`);
    
    console.log(`\nArticles found by Tavily: ${uniqueResults.length}`);
    console.log(`Articles deemed relevant by Claude: ${normalizedNews.length}`);
    console.log(`Relevance rate: ${((normalizedNews.length / uniqueResults.length) * 100).toFixed(1)}%`);
    
    if (normalizedNews.length === 0) {
      console.log('\n⚠ WARNING: Claude found no relevant articles');
      console.log('This could mean:');
      console.log('  - Current news is not relevant to Glossi');
      console.log('  - Search terms need adjustment');
      console.log('  - Claude is being too strict with filtering');
    } else {
      console.log('\n✅ TEST PASSED: Full news hooks flow working correctly\n');
      
      console.log('RELEVANT ARTICLES:');
      console.log('-'.repeat(80));
      
      normalizedNews.forEach((article, idx) => {
        console.log(`\n${idx + 1}. ${article.headline}`);
        console.log(`   Source: ${article.outlet}`);
        console.log(`   Date: ${article.date}`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Summary: ${article.summary}`);
        console.log(`   Relevance: ${article.relevance}`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('\n✓ These articles would be stored in the database');
      console.log('✓ They would appear in the PR Agent > Research tab');
      console.log('');
    }
    
  } catch (error) {
    console.error('\n❌ Claude API Error:', error.response?.data?.error?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('\nThe API key may be invalid. Check your ANTHROPIC_API_KEY.');
    } else if (error.response?.status === 429) {
      console.log('\nRate limit exceeded. Wait a moment and try again.');
    }
    
    process.exit(1);
  }
}

testFullNewsHooksFlow().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});
