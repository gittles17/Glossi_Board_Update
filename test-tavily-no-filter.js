const { tavily } = require('@tavily/core');

async function testTavily() {
  const tavilyKey = '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';
  
  console.log('Testing Tavily WITHOUT domain filter...\n');
  
  const tvly = tavily({ apiKey: tavilyKey });
  
  const testQuery = '3D rendering visualization computer vision';
  
  console.log(`Query: "${testQuery}"\n`);
  
  try {
    const searchResult = await tvly.search(testQuery, {
      searchDepth: 'advanced',
      topic: 'news',
      days: 30,
      maxResults: 15
      // NO includeDomains filter
    });
    
    console.log(`✓ Found ${searchResult.results.length} articles\n`);
    
    const outletCounts = {};
    searchResult.results.forEach((article, i) => {
      const domain = article.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'Unknown';
      outletCounts[domain] = (outletCounts[domain] || 0) + 1;
      console.log(`${i + 1}. ${domain}`);
    });
    
    console.log('\n=== Outlet Distribution ===');
    Object.entries(outletCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        console.log(`${domain}: ${count}`);
      });
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
  }
}

testTavily().catch(console.error);
