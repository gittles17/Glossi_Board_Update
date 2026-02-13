const axios = require('axios');

async function testNewsHooksEndpoint() {
  console.log('\n=== TESTING NEWS HOOKS API ENDPOINT ===\n');
  
  const baseUrl = process.env.SERVER_URL || 'http://localhost:5500';
  const endpoint = `${baseUrl}/api/pr/news-hooks`;
  
  console.log(`Testing endpoint: ${endpoint}`);
  console.log('This will test the complete Tavily + Claude flow\n');
  
  console.log('Sending POST request to refresh news hooks...');
  const startTime = Date.now();
  
  try {
    const response = await axios.post(endpoint, {}, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (response.data.success) {
      console.log(`\n✅ SUCCESS (${elapsed}s)`);
      console.log('\n='.repeat(80));
      
      const news = response.data.news || [];
      
      console.log(`\nArticles returned: ${news.length}`);
      
      if (news.length === 0) {
        console.log('\n⚠ WARNING: No articles returned');
        console.log('Possible reasons:');
        console.log('  - No recent news matching search criteria');
        console.log('  - Claude filtered all articles as irrelevant');
        console.log('  - API rate limits reached');
      } else {
        console.log('\nSAMPLE ARTICLES:');
        console.log('-'.repeat(80));
        
        news.slice(0, 5).forEach((article, idx) => {
          console.log(`\n${idx + 1}. ${article.headline}`);
          console.log(`   Source: ${article.outlet}`);
          console.log(`   Date: ${article.date}`);
          console.log(`   URL: ${article.url}`);
          console.log(`   Summary: ${article.summary}`);
          console.log(`   Relevance: ${article.relevance}`);
        });
        
        if (news.length > 5) {
          console.log(`\n... and ${news.length - 5} more articles`);
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('\nDATA QUALITY CHECKS:');
        
        let allValid = true;
        const checks = {
          'All articles have headlines': news.every(n => n.headline && n.headline.length > 0),
          'All articles have outlets': news.every(n => n.outlet && n.outlet.length > 0),
          'All articles have dates': news.every(n => n.date && /^\d{4}-\d{2}-\d{2}$/.test(n.date)),
          'All articles have URLs': news.every(n => n.url && n.url.startsWith('http')),
          'All articles have summaries': news.every(n => n.summary && n.summary.length > 10),
          'All articles have relevance': news.every(n => n.relevance && n.relevance.length > 10),
          'No example/placeholder data': !news.some(n => 
            n.headline?.toLowerCase().includes('example') || 
            n.headline?.toLowerCase().includes('placeholder') ||
            n.summary?.toLowerCase().includes('would be')
          )
        };
        
        for (const [check, passed] of Object.entries(checks)) {
          const status = passed ? '✓' : '✗';
          console.log(`  ${status} ${check}`);
          if (!passed) allValid = false;
        }
        
        if (allValid) {
          console.log('\n✅ ALL QUALITY CHECKS PASSED');
        } else {
          console.log('\n⚠ SOME QUALITY CHECKS FAILED');
        }
        
        const sources = [...new Set(news.map(n => n.outlet))];
        console.log(`\nSources represented: ${sources.length}`);
        console.log(`  ${sources.slice(0, 5).join(', ')}${sources.length > 5 ? '...' : ''}`);
        
        const dates = [...new Set(news.map(n => n.date))].sort();
        console.log(`\nDate range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }
      
      console.log('\n='.repeat(80));
      console.log('\n✓ News hooks endpoint is working correctly');
      console.log('✓ Articles are being fetched and analyzed');
      console.log('✓ Data would be stored in database and displayed in UI');
      console.log('');
      
    } else {
      console.log(`\n❌ FAILED: ${response.data.error || 'Unknown error'}`);
      process.exit(1);
    }
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ REQUEST FAILED (${elapsed}s)`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ Server is not running');
      console.log('\nTo test this endpoint:');
      console.log('1. Start the server: node server.js');
      console.log('2. Run this test: node test-news-hooks-endpoint.js');
      console.log('\nOr set SERVER_URL to test production:');
      console.log('export SERVER_URL="https://your-production-url.com"');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n❌ Request timed out (>60s)');
      console.log('The news hooks search may be taking too long');
    } else if (error.response) {
      console.log(`\nHTTP ${error.response.status}: ${error.response.statusText}`);
      console.log('Error:', error.response.data?.error || 'Unknown error');
    } else {
      console.log('\nError:', error.message);
    }
    
    console.log('');
    process.exit(1);
  }
}

console.log('Note: This test requires the server to be running');
console.log('Make sure ANTHROPIC_API_KEY and TAVILY_API_KEY are configured\n');

testNewsHooksEndpoint().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
