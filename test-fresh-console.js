const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--incognito']
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const consoleMessages = [];
  const errors = [];
  const warnings = [];
  const networkFailures = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    consoleMessages.push({ type, text });
    
    if (type === 'error') {
      errors.push(text);
      console.log(`❌ [ERROR] ${text}`);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log(`⚠️  [WARNING] ${text}`);
    } else {
      console.log(`ℹ️  [${type.toUpperCase()}] ${text}`);
    }
  });
  
  // Capture page errors
  page.on('pageerror', err => {
    const text = `PAGE ERROR: ${err.message}`;
    errors.push(text);
    console.log(`❌ ${text}`);
  });
  
  // Capture failed network requests
  page.on('requestfailed', request => {
    const text = `${request.method()} ${request.url()} - ${request.failure().errorText}`;
    networkFailures.push(text);
    console.log(`🔴 [NETWORK FAILURE] ${text}`);
  });
  
  // Capture response errors
  page.on('response', response => {
    if (response.status() >= 400) {
      const text = `${response.status()} ${response.url()}`;
      networkFailures.push(text);
      console.log(`🔴 [HTTP ERROR] ${text}`);
    }
  });
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('FRESH INCOGNITO SESSION TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('Step 1: Opening URL in fresh incognito session...\n');
  
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  console.log('✓ Page loaded\n');
  
  console.log('Step 2: Waiting 5 seconds for full initialization...\n');
  await page.waitForTimeout(5000);
  console.log('✓ Wait complete\n');
  
  console.log('Step 3: DevTools Console is already open (captured above)\n');
  
  console.log('Step 4: Taking screenshot of initial state...\n');
  await page.screenshot({ path: 'fresh-1-loaded.png', fullPage: true });
  console.log('✓ Screenshot: fresh-1-loaded.png\n');
  
  console.log('Step 5: Checking network requests...\n');
  
  console.log('Step 6: Checking if prAgent initialized...\n');
  
  const prAgentCheck = await page.evaluate(() => {
    return {
      typeofPrAgent: typeof window.prAgent,
      prAgentExists: !!window.prAgent,
      hasLoadData: window.prAgent && typeof window.prAgent.loadData === 'function',
      hasSources: window.prAgent && Array.isArray(window.prAgent.sources),
      sourcesCount: window.prAgent?.sources?.length || 0
    };
  });
  
  console.log(`typeof window.prAgent: "${prAgentCheck.typeofPrAgent}"`);
  console.log(`prAgent exists: ${prAgentCheck.prAgentExists ? '✅ YES' : '❌ NO'}`);
  if (prAgentCheck.prAgentExists) {
    console.log(`  Has loadData method: ${prAgentCheck.hasLoadData ? '✅ YES' : '❌ NO'}`);
    console.log(`  Has sources array: ${prAgentCheck.hasSources ? '✅ YES' : '❌ NO'}`);
    console.log(`  Sources count: ${prAgentCheck.sourcesCount}`);
  }
  console.log();
  
  console.log('Step 7: Manually accessing Generate button...\n');
  
  const buttonTest = await page.evaluate(() => {
    const btn = document.getElementById('pr-generate-btn');
    const results = {
      buttonExists: !!btn,
      buttonDisabled: btn?.disabled,
      buttonText: btn?.textContent.trim(),
      buttonType: btn?.type,
      hasOnclick: !!btn?.onclick,
      buttonClasses: btn?.className
    };
    
    // Log to browser console
    console.log('Button exists:', results.buttonExists);
    console.log('Button disabled:', results.buttonDisabled);
    console.log('Button onclick:', btn?.onclick);
    
    return results;
  });
  
  console.log('Button Test Results:');
  console.log(`  Button exists: ${buttonTest.buttonExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button disabled: ${buttonTest.buttonDisabled ? '🔴 YES (DISABLED)' : '🟢 NO (enabled)'}`);
  console.log(`  Button text: "${buttonTest.buttonText}"`);
  console.log(`  Button type: ${buttonTest.buttonType}`);
  console.log(`  Has onclick: ${buttonTest.hasOnclick ? 'YES' : 'NO'}`);
  console.log(`  Button classes: ${buttonTest.buttonClasses}`);
  console.log();
  
  console.log('Step 8: Attempting to click the button...\n');
  
  // Wait a moment for any async operations
  await page.waitForTimeout(1000);
  
  const clickResult = await page.evaluate(() => {
    const btn = document.getElementById('pr-generate-btn');
    
    if (!btn) {
      return { success: false, error: 'Button not found' };
    }
    
    if (btn.disabled) {
      return { success: false, error: 'Button is disabled' };
    }
    
    console.log('🖱️ Clicking button...');
    
    try {
      btn.click();
      return { success: true, clicked: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  if (clickResult.success) {
    console.log('✅ Button clicked successfully!\n');
    
    // Wait to see what happens
    await page.waitForTimeout(3000);
    
    const afterClick = await page.evaluate(() => {
      const loading = document.querySelector('.pr-loading-state');
      const workspaceTab = document.querySelector('.pr-workspace-tab-content[data-tab-content="content"]');
      
      return {
        loadingVisible: loading ? window.getComputedStyle(loading).display !== 'none' : false,
        workspaceVisible: workspaceTab ? window.getComputedStyle(workspaceTab).display !== 'none' : false
      };
    });
    
    console.log('After clicking:');
    console.log(`  Loading state visible: ${afterClick.loadingVisible ? '✅ YES' : '❌ NO'}`);
    console.log(`  Workspace visible: ${afterClick.workspaceVisible ? '✅ YES' : '❌ NO'}`);
    
    if (afterClick.loadingVisible) {
      console.log('\n🎉 Generation started! Loading state is visible.');
    } else {
      console.log('\n⚠️  No loading state appeared after click.');
    }
  } else {
    console.log(`❌ Button click failed: ${clickResult.error}\n`);
  }
  
  await page.screenshot({ path: 'fresh-2-after-click.png', fullPage: true });
  console.log('\n✓ Screenshot: fresh-2-after-click.png\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('CONSOLE ERRORS:');
  if (errors.length === 0) {
    console.log('  ✅ No JavaScript errors detected');
  } else {
    console.log(`  ❌ ${errors.length} errors found:`);
    errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 100)}`);
    });
  }
  console.log();
  
  console.log('CONSOLE WARNINGS:');
  if (warnings.length === 0) {
    console.log('  ✅ No warnings');
  } else {
    console.log(`  ⚠️  ${warnings.length} warnings found:`);
    warnings.slice(0, 5).forEach((warn, i) => {
      console.log(`  ${i + 1}. ${warn.substring(0, 100)}`);
    });
  }
  console.log();
  
  console.log('NETWORK FAILURES:');
  if (networkFailures.length === 0) {
    console.log('  ✅ All network requests succeeded');
  } else {
    console.log(`  🔴 ${networkFailures.length} failures found:`);
    networkFailures.forEach((fail, i) => {
      console.log(`  ${i + 1}. ${fail}`);
    });
  }
  console.log();
  
  console.log('PRAGENT STATUS:');
  console.log(`  typeof window.prAgent: "${prAgentCheck.typeofPrAgent}"`);
  console.log(`  Initialized: ${prAgentCheck.prAgentExists ? '✅ YES' : '❌ NO'}`);
  if (prAgentCheck.prAgentExists) {
    console.log(`  Sources loaded: ${prAgentCheck.sourcesCount > 0 ? `✅ YES (${prAgentCheck.sourcesCount})` : '❌ NO'}`);
  }
  console.log();
  
  console.log('GENERATE BUTTON:');
  console.log(`  Exists: ${buttonTest.buttonExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Enabled: ${!buttonTest.buttonDisabled ? '✅ YES' : '❌ NO (disabled)'}`);
  console.log(`  Clickable: ${clickResult.success ? '✅ YES' : '❌ NO'}`);
  console.log();
  
  console.log('OVERALL HEALTH:');
  const hasErrors = errors.length > 0;
  const hasNetworkFailures = networkFailures.length > 0;
  const prAgentOk = prAgentCheck.prAgentExists;
  const buttonOk = buttonTest.buttonExists && !buttonTest.buttonDisabled;
  
  if (!hasErrors && !hasNetworkFailures && prAgentOk && buttonOk) {
    console.log('  🟢 EXCELLENT - System fully operational');
  } else if (hasErrors || hasNetworkFailures) {
    console.log('  🔴 ISSUES DETECTED - See errors above');
  } else {
    console.log('  🟡 PARTIAL - Some components may not be initialized');
  }
  console.log();
  
  console.log('All console messages:');
  console.log(`  Total: ${consoleMessages.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Info/Log: ${consoleMessages.length - errors.length - warnings.length}`);
  console.log();
  
  console.log('Browser will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  
  console.log('\n✓ Test complete');
})();
