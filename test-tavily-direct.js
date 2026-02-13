const { tavily } = require('@tavily/core');

async function testTavily() {
  // Use hardcoded key for testing
  const tavilyKey = process.env.TAVILY_API_KEY || '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';
  
  console.log('Testing Tavily API...');
  console.log('API Key:', tavilyKey.substring(0, 10) + '...');
  
  const tvly = tavily({ apiKey: tavilyKey });
  
  const searchQueries = [
    // AI/ML/Generative AI (3 queries)
    'generative AI marketing creative tools',
    'large language models enterprise adoption',
    'AI image generation visual content',
    // 3D Visualization/Computer Vision (3 queries)
    '3D product visualization rendering',
    'computer vision image recognition retail',
    '3D modeling software AI automation',
    // E-commerce/Product/Retail (3 queries)
    'e-commerce product photography AI',
    'retail technology digital transformation',
    'online shopping visual merchandising',
    // Marketing/Creative AI (2 queries)
    'marketing automation AI content creation',
    'creative technology advertising tools',
    // Enterprise AI/Brand Tech (2 queries)
    'enterprise AI adoption brand strategy',
    'corporate AI investment digital transformation',
    // Design Software/CAD (1 query)
    'design software 3D CAD creative tools',
    // Fashion/Digital Innovation (1 query)
    'fashion technology e-commerce digital innovation'
  ];
  
  const includeDomains = [
    'techcrunch.com', 'theverge.com', 'wired.com', 'venturebeat.com',
    'technologyreview.com', 'arstechnica.com', 'fastcompany.com',
    'businessinsider.com', 'forbes.com', 'cnbc.com', 'reuters.com',
    'bloomberg.com', 'tldr.tech', 'businessoffashion.com', 'theinterline.com'
  ];
  
  let allResults = [];
  
  for (const query of searchQueries) {
    try {
      console.log(`\n=== Query: "${query}" ===`);
      
      const searchResult = await tvly.search(query, {
        searchDepth: 'basic',
        topic: 'news',
        days: 30,
        maxResults: 6,
        includeDomains
      });
      
      console.log(`✓ Found ${searchResult.results.length} articles`);
      
      if (searchResult.results.length > 0) {
        searchResult.results.forEach((article, i) => {
          const domain = article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown';
          console.log(`  ${i + 1}. ${domain} - ${article.title.substring(0, 60)}...`);
        });
      }
      
      allResults = allResults.concat(searchResult.results);
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Data:`, error.response.data);
      }
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total articles before dedup: ${allResults.length}`);
  
  // Deduplicate
  const uniqueResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());
  console.log(`Unique articles: ${uniqueResults.length}`);
  
  // Outlet breakdown
  const outletCounts = {};
  uniqueResults.forEach(item => {
    const domain = item.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown';
    outletCounts[domain] = (outletCounts[domain] || 0) + 1;
  });
  
  console.log('\nOutlets found:');
  Object.entries(outletCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count}`);
    });
  
  // Check which of the 15 expected outlets are missing
  console.log('\nExpected outlets NOT found:');
  includeDomains.forEach(domain => {
    const found = Object.keys(outletCounts).some(d => d.includes(domain.replace('www.', '')));
    if (!found) {
      console.log(`  ✗ ${domain}`);
    }
  });
}

testTavily().catch(console.error);
