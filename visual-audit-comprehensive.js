/**
 * Comprehensive Visual Audit Script
 * Production URL: https://glossiboardupdate-production.up.railway.app/pr.html
 * 
 * This script performs a detailed visual audit with screenshots of every section
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://glossiboardupdate-production.up.railway.app/pr.html';
const SCREENSHOT_DIR = './visual-audit-screenshots';
const REPORT_FILE = './VISUAL-AUDIT-REPORT.md';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name, description) {
  const filename = `${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 ${description}`);
  console.log(`   Saved: ${filepath}\n`);
  return { filename, filepath, description };
}

async function takeFullPageScreenshot(page, name, description) {
  const filename = `${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${description}`);
  console.log(`   Saved: ${filepath}\n`);
  return { filename, filepath, description };
}

async function getElementInfo(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      
      return {
        visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
        text: el.textContent?.trim().substring(0, 100),
        classes: Array.from(el.classList),
        position: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        tagName: el.tagName.toLowerCase()
      };
    }, selector);
    
    return info;
  } catch (error) {
    return null;
  }
}

async function runVisualAudit() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE VISUAL AUDIT - GLOSSI PR PRODUCTION');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Production URL: ${PRODUCTION_URL}\n`);
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--window-size=1920,1080']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const screenshots = [];
  const findings = [];
  const consoleErrors = [];
  
  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`   🔴 Console Error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
    console.log(`   ❌ Page Error: ${error.message}`);
  });
  
  try {
    // ═══════════════════════════════════════════════════════════
    // PHASE 1: INITIAL PAGE LOAD
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PHASE 1: INITIAL PAGE LOAD');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Loading page...');
    await page.goto(PRODUCTION_URL, { 
      waitUntil: 'networkidle0', 
      timeout: 30000 
    });
    
    console.log('Waiting for content to render...');
    await delay(3000); // Let any animations settle
    
    // Take full page screenshot
    const fullPageSS = await takeFullPageScreenshot(
      page, 
      '01-full-page-initial-load',
      'Full page screenshot on initial load'
    );
    screenshots.push(fullPageSS);
    
    // Document what's visible
    console.log('Analyzing page layout...\n');
    
    const leftPanel = await getElementInfo(page, '.pr-sources-panel');
    const centerPanel = await getElementInfo(page, '.pr-workspace-panel');
    const rightPanel = await getElementInfo(page, '.pr-right-panel');
    
    findings.push({
      phase: 'Initial Load',
      section: 'Layout',
      status: leftPanel && centerPanel && rightPanel ? '✅' : '❌',
      details: {
        leftPanel: leftPanel ? '✅ Visible' : '❌ Not found',
        centerPanel: centerPanel ? '✅ Visible' : '❌ Not found',
        rightPanel: rightPanel ? '✅ Visible' : '❌ Not found'
      }
    });
    
    console.log(`   Left Panel: ${leftPanel ? '✅ Visible' : '❌ Not found'}`);
    console.log(`   Center Panel: ${centerPanel ? '✅ Visible' : '❌ Not found'}`);
    console.log(`   Right Panel: ${rightPanel ? '✅ Visible' : '❌ Not found'}\n`);
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 2: LEFT PANEL DETAILED AUDIT
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PHASE 2: LEFT PANEL DETAILED AUDIT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Scroll left panel to top
    await page.evaluate(() => {
      const leftPanel = document.querySelector('.pr-sources-panel');
      if (leftPanel) leftPanel.scrollTop = 0;
    });
    await delay(500);
    
    // Take screenshot of tab area
    const tabsSS = await takeScreenshot(
      page,
      '02-left-panel-tabs',
      'Left panel tabs'
    );
    screenshots.push(tabsSS);
    
    // Analyze tabs
    const tabs = await page.evaluate(() => {
      const tabElements = document.querySelectorAll('.pr-panel-tab');
      return Array.from(tabElements).map(tab => ({
        text: tab.textContent.trim(),
        isActive: tab.classList.contains('active'),
        dataTab: tab.getAttribute('data-panel-tab')
      }));
    });
    
    console.log('Tab Analysis:');
    tabs.forEach((tab, i) => {
      console.log(`   ${i + 1}. "${tab.text}" ${tab.isActive ? '(ACTIVE ✅)' : ''}`);
    });
    console.log('');
    
    findings.push({
      phase: 'Left Panel',
      section: 'Tabs',
      status: tabs.length === 3 && tabs[0].isActive ? '✅' : '❌',
      details: {
        tabs: tabs.map(t => t.text),
        activeTab: tabs.find(t => t.isActive)?.text || 'None',
        expected: 'Strategy active by default'
      }
    });
    
    // Screenshot News Hooks section
    await page.evaluate(() => {
      const newsHooks = document.querySelector('.pr-news-hooks-section');
      if (newsHooks) newsHooks.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    await delay(1000);
    
    const newsHooksSS = await takeScreenshot(
      page,
      '03-news-hooks-section',
      'News Hooks section'
    );
    screenshots.push(newsHooksSS);
    
    // Analyze News Hooks
    const newsHooksInfo = await page.evaluate(() => {
      const section = document.querySelector('.pr-news-hooks-section');
      if (!section) return null;
      
      const title = section.querySelector('.pr-workflow-title')?.textContent.trim();
      const refreshBtn = section.querySelector('#pr-fetch-news-btn');
      const emptyState = section.querySelector('.pr-news-hooks-empty');
      const hooksList = section.querySelector('.pr-news-hooks-list');
      const hasHooks = hooksList && !emptyState;
      
      return {
        title,
        hasRefreshButton: !!refreshBtn,
        refreshButtonText: refreshBtn?.textContent.trim(),
        emptyStateMessage: emptyState?.textContent.trim(),
        hasHooks
      };
    });
    
    console.log('News Hooks Analysis:');
    console.log(`   Title: "${newsHooksInfo?.title || 'Not found'}"`);
    console.log(`   Refresh Button: ${newsHooksInfo?.hasRefreshButton ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Empty State: "${newsHooksInfo?.emptyStateMessage || 'N/A'}"`);
    console.log(`   Has Hooks: ${newsHooksInfo?.hasHooks ? 'Yes' : 'No'}\n`);
    
    findings.push({
      phase: 'Left Panel',
      section: 'News Hooks',
      status: newsHooksInfo?.hasRefreshButton ? '✅' : '❌',
      details: newsHooksInfo
    });
    
    // Screenshot Story Angles section
    await page.evaluate(() => {
      const angles = document.querySelector('.pr-angles-section');
      if (angles) angles.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    await delay(1000);
    
    const anglesSS = await takeScreenshot(
      page,
      '04-story-angles-section',
      'Story Angles section'
    );
    screenshots.push(anglesSS);
    
    // Analyze Story Angles
    const anglesInfo = await page.evaluate(() => {
      const section = document.querySelector('.pr-angles-section');
      if (!section) return null;
      
      const title = section.querySelector('.pr-workflow-title')?.textContent.trim();
      const generateBtn = section.querySelector('#pr-generate-angles-btn');
      const emptyState = section.querySelector('.pr-angles-empty');
      const angleCards = section.querySelectorAll('.pr-angle-card');
      
      return {
        title,
        hasGenerateButton: !!generateBtn,
        generateButtonText: generateBtn?.textContent.trim(),
        emptyStateMessage: emptyState?.textContent.trim(),
        angleCount: angleCards.length
      };
    });
    
    console.log('Story Angles Analysis:');
    console.log(`   Title: "${anglesInfo?.title || 'Not found'}"`);
    console.log(`   Generate Button: ${anglesInfo?.hasGenerateButton ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Empty State: "${anglesInfo?.emptyStateMessage || 'N/A'}"`);
    console.log(`   Angle Cards: ${anglesInfo?.angleCount || 0}\n`);
    
    findings.push({
      phase: 'Left Panel',
      section: 'Story Angles',
      status: anglesInfo?.hasGenerateButton ? '✅' : '❌',
      details: anglesInfo
    });
    
    // Test tab switching
    console.log('Testing tab switching...\n');
    
    // Click Sources tab
    await page.click('.pr-panel-tab[data-panel-tab="sources"]');
    await delay(1000);
    const sourcesSS = await takeScreenshot(
      page,
      '05-sources-tab-content',
      'Sources tab content'
    );
    screenshots.push(sourcesSS);
    
    const sourcesActive = await page.evaluate(() => {
      const tab = document.querySelector('.pr-panel-tab[data-panel-tab="sources"]');
      return tab?.classList.contains('active');
    });
    console.log(`   Sources tab active: ${sourcesActive ? '✅' : '❌'}`);
    
    // Click Library tab
    await page.click('.pr-panel-tab[data-panel-tab="library"]');
    await delay(1000);
    const librarySS = await takeScreenshot(
      page,
      '06-library-tab-content',
      'Library tab content'
    );
    screenshots.push(librarySS);
    
    const libraryActive = await page.evaluate(() => {
      const tab = document.querySelector('.pr-panel-tab[data-panel-tab="library"]');
      return tab?.classList.contains('active');
    });
    console.log(`   Library tab active: ${libraryActive ? '✅' : '❌'}`);
    
    // Click Strategy tab again
    await page.click('.pr-panel-tab[data-panel-tab="strategy"]');
    await delay(1000);
    const strategyBackSS = await takeScreenshot(
      page,
      '07-strategy-tab-return',
      'Strategy tab (returned)'
    );
    screenshots.push(strategyBackSS);
    
    const strategyActiveAgain = await page.evaluate(() => {
      const tab = document.querySelector('.pr-panel-tab[data-panel-tab="strategy"]');
      return tab?.classList.contains('active');
    });
    console.log(`   Strategy tab active again: ${strategyActiveAgain ? '✅' : '❌'}\n`);
    
    findings.push({
      phase: 'Left Panel',
      section: 'Tab Switching',
      status: sourcesActive && libraryActive && strategyActiveAgain ? '✅' : '❌',
      details: {
        sourcesWorked: sourcesActive,
        libraryWorked: libraryActive,
        strategyReturnWorked: strategyActiveAgain
      }
    });
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 3: CENTER PANEL (WORKSPACE) AUDIT
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PHASE 3: CENTER PANEL (WORKSPACE) AUDIT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const workspaceSS = await takeScreenshot(
      page,
      '08-center-workspace',
      'Center workspace panel'
    );
    screenshots.push(workspaceSS);
    
    const workspaceInfo = await page.evaluate(() => {
      const workspace = document.querySelector('.pr-workspace-panel');
      if (!workspace) return null;
      
      const contentType = workspace.querySelector('#pr-content-type');
      const generateBtn = workspace.querySelector('#pr-generate-btn');
      const emptyState = workspace.querySelector('.pr-workspace-empty');
      const generatedContent = workspace.querySelector('.pr-workspace-generated');
      
      return {
        hasContentTypeDropdown: !!contentType,
        hasGenerateButton: !!generateBtn,
        generateButtonDisabled: generateBtn?.disabled,
        showingEmptyState: emptyState && window.getComputedStyle(emptyState).display !== 'none',
        hasGeneratedContent: generatedContent && window.getComputedStyle(generatedContent).display !== 'none'
      };
    });
    
    console.log('Workspace Analysis:');
    console.log(`   Content Type Dropdown: ${workspaceInfo?.hasContentTypeDropdown ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Generate Button: ${workspaceInfo?.hasGenerateButton ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Generate Button Disabled: ${workspaceInfo?.generateButtonDisabled ? 'Yes' : 'No'}`);
    console.log(`   Empty State Showing: ${workspaceInfo?.showingEmptyState ? 'Yes' : 'No'}`);
    console.log(`   Has Generated Content: ${workspaceInfo?.hasGeneratedContent ? 'Yes' : 'No'}\n`);
    
    findings.push({
      phase: 'Center Panel',
      section: 'Workspace',
      status: workspaceInfo?.hasContentTypeDropdown && workspaceInfo?.hasGenerateButton ? '✅' : '❌',
      details: workspaceInfo
    });
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 4: RIGHT PANEL AUDIT
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PHASE 4: RIGHT PANEL AUDIT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const rightPanelSS = await takeScreenshot(
      page,
      '09-right-panel-media',
      'Right panel - Media section'
    );
    screenshots.push(rightPanelSS);
    
    const rightPanelInfo = await page.evaluate(() => {
      const rightPanel = document.querySelector('.pr-right-panel');
      if (!rightPanel) return null;
      
      const mediaSection = rightPanel.querySelector('.pr-media-section');
      const mediaTitle = mediaSection?.querySelector('.pr-section-title')?.textContent.trim();
      const discoverBtn = rightPanel.querySelector('.pr-media-toggle-btn[data-media-view="discover"]');
      const trackBtn = rightPanel.querySelector('.pr-media-toggle-btn[data-media-view="track"]');
      const outlets = rightPanel.querySelectorAll('.pr-media-outlet');
      const distributionSection = rightPanel.querySelector('.pr-distribution-section');
      
      return {
        hasMediaSection: !!mediaSection,
        mediaTitle,
        hasDiscoverToggle: !!discoverBtn,
        hasTrackToggle: !!trackBtn,
        discoverActive: discoverBtn?.classList.contains('active'),
        outletCount: outlets.length,
        hasDistributionSection: !!distributionSection,
        distributionVisible: distributionSection && window.getComputedStyle(distributionSection).display !== 'none'
      };
    });
    
    console.log('Right Panel Analysis:');
    console.log(`   Media Section: ${rightPanelInfo?.hasMediaSection ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Media Title: "${rightPanelInfo?.mediaTitle || 'Not found'}"`);
    console.log(`   Discover Toggle: ${rightPanelInfo?.hasDiscoverToggle ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Track Toggle: ${rightPanelInfo?.hasTrackToggle ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Discover Active: ${rightPanelInfo?.discoverActive ? 'Yes' : 'No'}`);
    console.log(`   Outlet Cards: ${rightPanelInfo?.outletCount || 0}`);
    console.log(`   Distribution Section: ${rightPanelInfo?.hasDistributionSection ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Distribution Visible: ${rightPanelInfo?.distributionVisible ? 'Yes' : 'No (expected)'}\n`);
    
    findings.push({
      phase: 'Right Panel',
      section: 'Media & Distribution',
      status: rightPanelInfo?.hasMediaSection ? '✅' : '❌',
      details: rightPanelInfo
    });
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 5: MOBILE VIEW TEST
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PHASE 5: MOBILE VIEW TEST');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Resizing to mobile viewport (375x812)...');
    await page.setViewport({ width: 375, height: 812 });
    await delay(2000);
    
    const mobileInitialSS = await takeScreenshot(
      page,
      '10-mobile-initial-view',
      'Mobile view - initial'
    );
    screenshots.push(mobileInitialSS);
    
    // Analyze mobile tabs
    const mobileTabs = await page.evaluate(() => {
      const tabElements = document.querySelectorAll('.pr-mobile-tab');
      return Array.from(tabElements).map(tab => ({
        text: tab.textContent.trim(),
        isActive: tab.classList.contains('active'),
        dataTab: tab.getAttribute('data-tab')
      }));
    });
    
    console.log('Mobile Tabs Analysis:');
    mobileTabs.forEach((tab, i) => {
      console.log(`   ${i + 1}. "${tab.text}" ${tab.isActive ? '(ACTIVE ✅)' : ''}`);
    });
    console.log('');
    
    findings.push({
      phase: 'Mobile View',
      section: 'Mobile Tabs',
      status: mobileTabs.length === 3 && mobileTabs[0].text === 'Strategy' ? '✅' : '❌',
      details: {
        tabs: mobileTabs.map(t => t.text),
        activeTab: mobileTabs.find(t => t.isActive)?.text || 'None',
        expected: 'Strategy, Sources, Library (Strategy active)'
      }
    });
    
    // Click each mobile tab
    for (let i = 0; i < mobileTabs.length; i++) {
      const tab = mobileTabs[i];
      console.log(`Clicking mobile tab: "${tab.text}"...`);
      await page.click(`.pr-mobile-tab[data-tab="${tab.dataTab}"]`);
      await delay(1000);
      
      const mobileSS = await takeScreenshot(
        page,
        `11-mobile-tab-${i + 1}-${tab.dataTab}`,
        `Mobile view - ${tab.text} tab`
      );
      screenshots.push(mobileSS);
    }
    
    console.log('');
    
    // Restore desktop viewport
    console.log('Restoring desktop viewport...');
    await page.setViewport({ width: 1920, height: 1080 });
    await delay(1000);
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 6: CONSOLE ERRORS CHECK
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PHASE 6: CONSOLE ERRORS CHECK');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Console Errors Found: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    } else {
      console.log('   ✅ No console errors detected');
    }
    console.log('');
    
    findings.push({
      phase: 'Console',
      section: 'JavaScript Errors',
      status: consoleErrors.length === 0 ? '✅' : '⚠️',
      details: {
        errorCount: consoleErrors.length,
        errors: consoleErrors
      }
    });
    
    // ═══════════════════════════════════════════════════════════
    // GENERATE REPORT
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('GENERATING REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let report = `# Visual Audit Report - Glossi PR Production\n\n`;
    report += `**Production URL:** ${PRODUCTION_URL}\n`;
    report += `**Audit Date:** ${new Date().toLocaleString()}\n`;
    report += `**Screenshots:** ${screenshots.length}\n\n`;
    report += `---\n\n`;
    
    report += `## Executive Summary\n\n`;
    const totalFindings = findings.length;
    const passedFindings = findings.filter(f => f.status === '✅').length;
    const failedFindings = findings.filter(f => f.status === '❌').length;
    const warningFindings = findings.filter(f => f.status === '⚠️').length;
    
    report += `- **Total Checks:** ${totalFindings}\n`;
    report += `- **Passed:** ${passedFindings} ✅\n`;
    report += `- **Failed:** ${failedFindings} ❌\n`;
    report += `- **Warnings:** ${warningFindings} ⚠️\n`;
    report += `- **Success Rate:** ${Math.round((passedFindings / totalFindings) * 100)}%\n\n`;
    
    report += `---\n\n`;
    
    // Add findings by phase
    const phases = [...new Set(findings.map(f => f.phase))];
    phases.forEach(phase => {
      report += `## ${phase}\n\n`;
      const phaseFindings = findings.filter(f => f.phase === phase);
      phaseFindings.forEach(finding => {
        report += `### ${finding.status} ${finding.section}\n\n`;
        report += `**Status:** ${finding.status}\n\n`;
        report += `**Details:**\n\`\`\`json\n${JSON.stringify(finding.details, null, 2)}\n\`\`\`\n\n`;
      });
    });
    
    // Add screenshots section
    report += `---\n\n`;
    report += `## Screenshots\n\n`;
    screenshots.forEach((ss, i) => {
      report += `### ${i + 1}. ${ss.description}\n\n`;
      report += `![${ss.description}](${ss.filename})\n\n`;
    });
    
    // Add console errors section
    if (consoleErrors.length > 0) {
      report += `---\n\n`;
      report += `## Console Errors\n\n`;
      consoleErrors.forEach((error, i) => {
        report += `${i + 1}. \`${error}\`\n`;
      });
      report += `\n`;
    }
    
    // Write report
    fs.writeFileSync(REPORT_FILE, report);
    console.log(`✅ Report generated: ${REPORT_FILE}\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('AUDIT COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Summary:`);
    console.log(`   Screenshots: ${screenshots.length}`);
    console.log(`   Checks: ${totalFindings}`);
    console.log(`   Passed: ${passedFindings} ✅`);
    console.log(`   Failed: ${failedFindings} ❌`);
    console.log(`   Warnings: ${warningFindings} ⚠️`);
    console.log(`   Success Rate: ${Math.round((passedFindings / totalFindings) * 100)}%\n`);
    console.log(`📁 Files:`);
    console.log(`   Report: ${REPORT_FILE}`);
    console.log(`   Screenshots: ${SCREENSHOT_DIR}/\n`);
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// Run audit
runVisualAudit().catch(console.error);
