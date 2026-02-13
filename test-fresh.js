#!/usr/bin/env node
const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Clear cache
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Navigating with cache disabled...');
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle2'
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Media tab
  await page.click('[data-right-tab="media"]');
  await new Promise(r => setTimeout(r, 1000));
  
  // Take screenshot
  const rightPanel = await page.$('.pr-strategy-panel');
  await rightPanel.screenshot({
    path: 'test-screenshots/fresh-media-panel.png'
  });
  
  console.log('Screenshot saved: test-screenshots/fresh-media-panel.png');
  
  await browser.close();
}

test().catch(console.error);
