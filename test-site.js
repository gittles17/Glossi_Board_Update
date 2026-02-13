#!/usr/bin/env node

/**
 * Automated Site Testing Script
 * Tests both the News Hooks and Media UI issues
 */

const https = require('https');

const PRODUCTION_URL = 'https://glossiboardupdate-production.up.railway.app';

console.log('========================================');
console.log('Glossi Site Testing Script');
console.log('========================================\n');

// Test 1: Check if site is accessible
console.log('🔍 Test 1: Site Accessibility');
https.get(`${PRODUCTION_URL}/pr.html`, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Site is accessible (Status: 200)');
    console.log(`   URL: ${PRODUCTION_URL}/pr.html\n`);
  } else {
    console.log(`❌ Site returned status: ${res.statusCode}\n`);
  }
}).on('error', (err) => {
  console.log(`❌ Error accessing site: ${err.message}\n`);
});

// Test 2: Check news hooks API
console.log('🔍 Test 2: News Hooks API');
https.get(`${PRODUCTION_URL}/api/pr/news-hooks`, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      
      if (json.success && json.news) {
        const newsCount = json.news.length;
        console.log(`✅ News API working (${newsCount} articles found)`);
        
        if (newsCount > 0) {
          // Check dates
          const now = Date.now();
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          
          let oldArticles = 0;
          let recentArticles = 0;
          
          json.news.forEach(article => {
            const articleDate = new Date(article.date);
            const ageMs = now - articleDate.getTime();
            const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
            
            if (ageMs > thirtyDaysMs) {
              oldArticles++;
              console.log(`   ⚠️  Old article found: "${article.headline.substring(0, 50)}..." (${ageDays}d ago)`);
            } else {
              recentArticles++;
            }
          });
          
          console.log(`\n   Summary:`);
          console.log(`   - Recent articles (<30 days): ${recentArticles}`);
          console.log(`   - Old articles (>30 days): ${oldArticles}`);
          
          if (oldArticles > 0) {
            console.log(`\n   ❌ ISSUE NOT FIXED: ${oldArticles} articles are older than 30 days`);
          } else {
            console.log(`\n   ✅ ISSUE FIXED: All articles are recent`);
          }
        } else {
          console.log(`   ℹ️  No articles cached. Click "Refresh" in the News Hooks tab to fetch.`);
        }
      } else {
        console.log(`❌ News API error: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.log(`❌ Error parsing news data: ${err.message}`);
    }
    
    console.log('\n========================================');
    console.log('Manual Testing Required:');
    console.log('========================================');
    console.log('\nFor the Media UI overlay issue:');
    console.log('1. Open: ' + PRODUCTION_URL + '/pr.html');
    console.log('2. Click "Media" tab in the right panel');
    console.log('3. Scroll through outlets list');
    console.log('4. Check for half-circle overlay or visual artifacts');
    console.log('\nThe News Hooks dates can be verified by:');
    console.log('1. Click "News Hooks" tab in workspace');
    console.log('2. Click "Refresh" button');
    console.log('3. Check that article dates show recent days (not 400+)');
    console.log('========================================\n');
  });
}).on('error', (err) => {
  console.log(`❌ Error checking news API: ${err.message}\n`);
});
