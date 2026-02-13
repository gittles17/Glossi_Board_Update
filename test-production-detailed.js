const axios = require('axios');

async function testProductionDetailed() {
  console.log('\n=== DETAILED PRODUCTION NEWS HOOKS TEST ===\n');
  
  const baseUrl = 'https://glossiboardupdate-production.up.railway.app';
  
  console.log('Step 1: Check server health');
  console.log('-'.repeat(80));
  
  try {
    const healthCheck = await axios.get(baseUrl, { timeout: 5000 });
    console.log('✓ Server is responding');
  } catch (error) {
    console.log('⚠ Server health check failed:', error.message);
  }
  
  console.log('\nStep 2: Check current news hooks (cached)');
  console.log('-'.repeat(80));
  
  try {
    const cached = await axios.get(`${baseUrl}/api/pr/news-hooks`, { timeout: 5000 });
    console.log(`✓ GET request successful`);
    console.log(`  Cached articles: ${cached.data.news?.length || 0}`);
    
    if (cached.data.news?.length > 0) {
      console.log('\n  Sample cached articles:');
      cached.data.news.slice(0, 3).forEach((article, idx) => {
        console.log(`    ${idx + 1}. ${article.headline}`);
        console.log(`       Date: ${article.date}, Source: ${article.outlet}`);
      });
    }
  } catch (error) {
    console.log('✗ GET request failed:', error.message);
  }
  
  console.log('\nStep 3: Trigger news refresh (Tavily + Claude)');
  console.log('-'.repeat(80));
  console.log('This should take 10-20 seconds if working correctly...\n');
  
  const startTime = Date.now();
  let progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r  Elapsed: ${elapsed}s...`);
  }, 500);
  
  try {
    const response = await axios.post(`${baseUrl}/api/pr/news-hooks`, {}, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 90000
    });
    
    clearInterval(progressInterval);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    
    console.log(`✓ POST request completed in ${elapsed}s`);
    console.log(`  Success: ${response.data.success}`);
    console.log(`  Articles returned: ${response.data.news?.length || 0}`);
    
    if (response.data.error) {
      console.log(`  Error message: ${response.data.error}`);
    }
    
    if (elapsed < 5) {
      console.log('\n⚠ WARNING: Response was very fast (<5s)');
      console.log('  Expected: 10-20 seconds for Tavily + Claude');
      console.log('  This suggests:');
      console.log('    - Tavily search returned no results quickly');
      console.log('    - API rate limit reached');
      console.log('    - Early exit due to error');
    }
    
    if (response.data.news?.length === 0) {
      console.log('\n⚠ WARNING: No articles returned');
      console.log('  Possible causes:');
      console.log('    1. Tavily returned no results (API issue or rate limit)');
      console.log('    2. Claude filtered all articles as irrelevant');
      console.log('    3. Date filtering removed all articles');
      console.log('\n  Next steps:');
      console.log('    - Check Railway logs for Tavily errors');
      console.log('    - Verify TAVILY_API_KEY is set on Railway');
      console.log('    - Check Tavily API usage/rate limits');
    }
    
    if (response.data.news?.length > 0) {
      console.log('\n✅ SUCCESS: Articles returned');
      console.log('-'.repeat(80));
      
      response.data.news.slice(0, 5).forEach((article, idx) => {
        console.log(`\n${idx + 1}. ${article.headline}`);
        console.log(`   Source: ${article.outlet}`);
        console.log(`   Date: ${article.date}`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Summary: ${article.summary?.substring(0, 80)}...`);
        console.log(`   Relevance: ${article.relevance?.substring(0, 80)}...`);
      });
      
      if (response.data.news.length > 5) {
        console.log(`\n... and ${response.data.news.length - 5} more articles`);
      }
    }
    
  } catch (error) {
    clearInterval(progressInterval);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✗ POST request failed after ${elapsed}s`);
    
    if (error.code === 'ETIMEDOUT') {
      console.log('  Error: Request timed out (>90s)');
    } else if (error.response) {
      console.log(`  HTTP ${error.response.status}: ${error.response.statusText}`);
      console.log(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\nTo check Railway logs:');
  console.log('1. Go to https://railway.app');
  console.log('2. Open your project');
  console.log('3. Click on Deployments');
  console.log('4. Look for these log messages:');
  console.log('   - "Searching for news with Tavily..."');
  console.log('   - "Found X unique articles from Tavily"');
  console.log('   - "Claude analysis complete"');
  console.log('   - "Inserted X of Y articles into database"');
  console.log('   - Any "Tavily search error" messages');
  
  console.log('\nTo verify environment variables:');
  console.log('1. Railway dashboard > Project > Variables');
  console.log('2. Confirm these are set:');
  console.log('   - ANTHROPIC_API_KEY');
  console.log('   - TAVILY_API_KEY (optional, has fallback)');
  
  console.log('');
}

testProductionDetailed().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
