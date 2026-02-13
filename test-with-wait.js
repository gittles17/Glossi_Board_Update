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
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Click Media tab
  console.log('Clicking Media tab...');
  await page.click('[data-right-tab="media"]');
  
  // Wait for outlets to load (wait for TechCrunch to appear)
  console.log('Waiting for outlets to load...');
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('TechCrunch') || text.includes('The Verge');
    }, { timeout: 10000 });
    console.log('Outlets loaded!');
  } catch (e) {
    console.log('Outlets did not load in time, taking screenshot anyway...');
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Take screenshot of right panel
  const rightPanel = await page.$('.pr-strategy-panel');
  await rightPanel.screenshot({
    path: 'test-screenshots/final-media-panel.png'
  });
  
  // Also take full page
  await page.screenshot({
    path: 'test-screenshots/final-full-page.png',
    fullPage: true
  });
  
  console.log('Screenshots saved!');
  console.log('- test-screenshots/final-media-panel.png');
  console.log('- test-screenshots/final-full-page.png');
  
  await browser.close();
}

test().catch(console.error);
