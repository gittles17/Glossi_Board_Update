#!/usr/bin/env node
const puppeteer = require('puppeteer');

async function inspect() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle2'
  });
  
  await new Promise(r => setTimeout(r, 3000));
  await page.click('[data-right-tab="media"]');
  await new Promise(r => setTimeout(r, 2000));
  
  // Get computed styles of all elements in the hierarchy
  const styles = await page.evaluate(() => {
    const panel = document.querySelector('.pr-strategy-panel');
    const tabContent = document.querySelector('[data-right-content="media"]');
    const mediaBody = document.querySelector('.pr-media-panel-body');
    const mediaView = document.querySelector('.pr-media-view');
    const mediaHeader = document.querySelector('.pr-media-header');
    const mediaDiscover = document.querySelector('.pr-media-discover');
    
    function getRelevantStyles(el, name) {
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      return {
        name,
        borderRadius: computed.borderRadius,
        border: computed.border,
        boxShadow: computed.boxShadow,
        background: computed.background.substring(0, 100),
        position: computed.position,
        overflow: computed.overflow
      };
    }
    
    return {
      panel: getRelevantStyles(panel, 'pr-strategy-panel'),
      tabContent: getRelevantStyles(tabContent, 'tab-content'),
      mediaBody: getRelevantStyles(mediaBody, 'media-body'),
      mediaView: getRelevantStyles(mediaView, 'media-view'),
      mediaHeader: getRelevantStyles(mediaHeader, 'media-header'),
      mediaDiscover: getRelevantStyles(mediaDiscover, 'media-discover')
    };
  });
  
  console.log('Computed Styles:');
  console.log(JSON.stringify(styles, null, 2));
  
  await browser.close();
}

inspect().catch(console.error);
