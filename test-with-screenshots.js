#!/usr/bin/env node

/**
 * Browser Testing with Screenshots
 * Uses Puppeteer to test and capture visual issues
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://glossiboardupdate-production.up.railway.app/pr.html';
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR);
}

async function testSite() {
  console.log('========================================');
  console.log('Glossi Site Visual Testing');
  console.log('========================================\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('🌐 Navigating to:', PRODUCTION_URL);
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('📸 Taking initial screenshot...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-initial-page.png'),
      fullPage: true
    });

    // Test 1: News Hooks
    console.log('\n🔍 Test 1: News Hooks');
    try {
      // Click News Hooks tab
      await page.waitForSelector('[data-workspace-tab="news-hooks"]', { timeout: 5000 });
      await page.click('[data-workspace-tab="news-hooks"]');
      await new Promise(r => setTimeout(r, 1000));

      console.log('📸 Taking News Hooks screenshot...');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-news-hooks-tab.png'),
        fullPage: true
      });

      // Click refresh button
      const refreshBtn = await page.$('#pr-fetch-news-btn');
      if (refreshBtn) {
        console.log('  Clicking refresh button...');
        await refreshBtn.click();
        await new Promise(r => setTimeout(r, 8000)); // Wait for news to load

        console.log('📸 Taking News Hooks after refresh screenshot...');
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, '03-news-hooks-loaded.png'),
          fullPage: true
        });
      }
    } catch (err) {
      console.log('  ⚠️  Could not test News Hooks:', err.message);
    }

    // Test 2: Media UI
    console.log('\n🔍 Test 2: Media UI Overlay');
    try {
      // Click Media tab in right panel
      await page.waitForSelector('[data-right-tab="media"]', { timeout: 5000 });
      await page.click('[data-right-tab="media"]');
      await new Promise(r => setTimeout(r, 1000));

      console.log('📸 Taking Media section screenshot...');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04-media-tab-full.png'),
        fullPage: true
      });

      // Take a focused screenshot of just the right panel
      const rightPanel = await page.$('.pr-strategy-panel');
      if (rightPanel) {
        await rightPanel.screenshot({
          path: path.join(SCREENSHOTS_DIR, '05-media-tab-panel-only.png')
        });
      }

      // Scroll the media section
      await page.evaluate(() => {
        const mediaDiscover = document.querySelector('.pr-media-discover');
        if (mediaDiscover) {
          mediaDiscover.scrollTop = 200;
        }
      });
      await new Promise(r => setTimeout(r, 500));

      console.log('📸 Taking Media section after scroll...');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '06-media-tab-scrolled.png'),
        fullPage: true
      });

    } catch (err) {
      console.log('  ⚠️  Could not test Media UI:', err.message);
    }

    // Get console errors
    console.log('\n📋 Console Errors:');
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    if (errors.length > 0) {
      errors.forEach(err => console.log('  ❌', err));
    } else {
      console.log('  ✅ No console errors');
    }

    console.log('\n========================================');
    console.log('✅ Testing Complete!');
    console.log('========================================');
    console.log(`\n📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('\nScreenshots captured:');
    console.log('  1. 01-initial-page.png');
    console.log('  2. 02-news-hooks-tab.png');
    console.log('  3. 03-news-hooks-loaded.png');
    console.log('  4. 04-media-tab-full.png');
    console.log('  5. 05-media-tab-panel-only.png');
    console.log('  6. 06-media-tab-scrolled.png');
    console.log('\nReview these screenshots to identify any visual artifacts.');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testSite().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
