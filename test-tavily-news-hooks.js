const { tavily } = require('@tavily/core');

async function testTavilyNewsHooks() {
  console.log('\n=== TESTING TAVILY NEWS HOOKS SEARCH ===\n');
  
  const tavilyKey = process.env.TAVILY_API_KEY || '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';
  
  if (!tavilyKey) {
    console.error('❌ TAVILY_API_KEY not found');
    process.exit(1);
  }
  
  console.log('✓ Tavily API key configured\n');
  
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
  let queryCount = 0;
  
  console.log('Starting Tavily searches...\n');
  
  for (const query of searchQueries) {
    queryCount++;
    console.log(`[${queryCount}/${searchQueries.length}] Searching: "${query}"`);
    
    try {
      const startTime = Date.now();
      
      const searchResult = await tvly.search(query, {
        searchDepth: 'basic',
        topic: 'news',
        days: 7,
        maxResults: 5,
        includeDomains: targetDomains
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (searchResult.results) {
        console.log(`   ✓ Found ${searchResult.results.length} articles (${elapsed}s)`);
        
        searchResult.results.forEach((article, idx) => {
          const domain = article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
          const date = article.publishedDate ? new Date(article.publishedDate).toLocaleDateString() : 'No date';
          console.log(`      ${idx + 1}. ${domain} - ${date}`);
          console.log(`         ${article.title.substring(0, 70)}...`);
        });
        
        allResults = allResults.concat(searchResult.results);
      } else {
        console.log(`   ⚠ No results returned`);
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\nTotal articles found: ${allResults.length}`);
  
  const uniqueResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());
  console.log(`Unique articles (after deduplication): ${uniqueResults.length}`);
  
  const domainCounts = {};
  uniqueResults.forEach(article => {
    const domain = article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });
  
  console.log('\nArticles by source:');
  Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count}`);
    });
  
  console.log('\nDate range:');
  const dates = uniqueResults
    .map(a => a.publishedDate ? new Date(a.publishedDate) : null)
    .filter(d => d !== null)
    .sort((a, b) => a - b);
  
  if (dates.length > 0) {
    const oldest = dates[0].toLocaleDateString();
    const newest = dates[dates.length - 1].toLocaleDateString();
    console.log(`  ${oldest} to ${newest}`);
  } else {
    console.log('  No dates available');
  }
  
  console.log('\nSample articles:');
  console.log('-'.repeat(80));
  
  uniqueResults.slice(0, 5).forEach((article, idx) => {
    const domain = article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
    const date = article.publishedDate ? new Date(article.publishedDate).toLocaleDateString() : 'No date';
    
    console.log(`\n${idx + 1}. ${article.title}`);
    console.log(`   Source: ${domain}`);
    console.log(`   Date: ${date}`);
    console.log(`   URL: ${article.url}`);
    console.log(`   Score: ${article.score || 'N/A'}`);
    if (article.content) {
      console.log(`   Preview: ${article.content.substring(0, 150)}...`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  
  if (uniqueResults.length === 0) {
    console.log('\n❌ TEST FAILED: No articles found');
    console.log('\nPossible issues:');
    console.log('  - Tavily API key may be invalid or rate limited');
    console.log('  - Network connectivity issues');
    console.log('  - No recent news matching search criteria');
    process.exit(1);
  } else if (uniqueResults.length < 5) {
    console.log(`\n⚠ TEST WARNING: Only ${uniqueResults.length} articles found`);
    console.log('  Expected 10-25 articles. May want to:');
    console.log('  - Broaden search terms');
    console.log('  - Increase days parameter');
    console.log('  - Add more source domains');
  } else {
    console.log('\n✅ TEST PASSED: Tavily news hooks search working correctly');
    console.log(`   ${uniqueResults.length} unique articles found from recent news`);
  }
  
  console.log('\nNext step: These articles would be sent to Claude for relevance analysis');
  console.log('');
}

testTavilyNewsHooks().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});
