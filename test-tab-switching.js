// Test tab switching functionality on production
const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Testing Tab Switching Functionality\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to production
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle0'
  });
  
  console.log('✅ Page loaded\n');
  
  // Wait for tabs to be rendered
  await page.waitForSelector('.pr-panel-tab');
  
  // Get initial state
  const initialState = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.pr-panel-tab'));
    const contents = Array.from(document.querySelectorAll('.pr-panel-tab-content'));
    
    return {
      tabs: tabs.map(t => ({
        text: t.textContent.trim(),
        hasActive: t.classList.contains('active'),
        dataTab: t.dataset.panelTab
      })),
      contents: contents.map(c => ({
        id: c.id,
        hasActive: c.classList.contains('active')
      }))
    };
  });
  
  console.log('📋 Initial State:');
  console.log('Tabs:', JSON.stringify(initialState.tabs, null, 2));
  console.log('Content:', JSON.stringify(initialState.contents, null, 2));
  console.log('');
  
  // Test clicking Sources tab
  console.log('🖱️  Clicking "Sources" tab...');
  await page.click('.pr-panel-tab[data-panel-tab="sources"]');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const afterSourcesClick = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.pr-panel-tab'));
    const contents = Array.from(document.querySelectorAll('.pr-panel-tab-content'));
    
    return {
      tabs: tabs.map(t => ({
        text: t.textContent.trim(),
        hasActive: t.classList.contains('active')
      })),
      contents: contents.map(c => ({
        id: c.id,
        hasActive: c.classList.contains('active')
      }))
    };
  });
  
  console.log('After clicking Sources:');
  console.log('Tabs:', JSON.stringify(afterSourcesClick.tabs, null, 2));
  console.log('Content:', JSON.stringify(afterSourcesClick.contents, null, 2));
  console.log('');
  
  // Check if Sources is now active
  const sourcesTabActive = afterSourcesClick.tabs.find(t => t.text === 'Sources')?.hasActive;
  const sourcesContentActive = afterSourcesClick.contents.find(c => c.id === 'pr-tab-sources')?.hasActive;
  
  console.log('✅ Results:');
  console.log(`Sources tab has active class: ${sourcesTabActive ? '✅ YES' : '❌ NO'}`);
  console.log(`Sources content has active class: ${sourcesContentActive ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  // Check for JavaScript errors in console
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Test clicking Library tab
  console.log('🖱️  Clicking "Library" tab...');
  await page.click('.pr-panel-tab[data-panel-tab="library"]');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const afterLibraryClick = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.pr-panel-tab'));
    const contents = Array.from(document.querySelectorAll('.pr-panel-tab-content'));
    
    return {
      tabs: tabs.map(t => ({
        text: t.textContent.trim(),
        hasActive: t.classList.contains('active')
      })),
      contents: contents.map(c => ({
        id: c.id,
        hasActive: c.classList.contains('active')
      }))
    };
  });
  
  console.log('After clicking Library:');
  console.log('Tabs:', JSON.stringify(afterLibraryClick.tabs, null, 2));
  console.log('Content:', JSON.stringify(afterLibraryClick.contents, null, 2));
  console.log('');
  
  // Check if Library is now active
  const libraryTabActive = afterLibraryClick.tabs.find(t => t.text === 'Library')?.hasActive;
  const libraryContentActive = afterLibraryClick.contents.find(c => c.id === 'pr-tab-library')?.hasActive;
  
  console.log('✅ Results:');
  console.log(`Library tab has active class: ${libraryTabActive ? '✅ YES' : '❌ NO'}`);
  console.log(`Library content has active class: ${libraryContentActive ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  if (errors.length > 0) {
    console.log('❌ Console Errors Found:');
    errors.forEach(err => console.log(`  - ${err}`));
  } else {
    console.log('✅ No console errors detected');
  }
  
  await browser.close();
})();
