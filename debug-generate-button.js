const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('DEBUG: Generate Button Disabled Issue');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Step 1: Navigate to page and wait 5 seconds...\n');
  
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  await page.waitForTimeout(5000);
  console.log('✓ Page loaded\n');
  
  console.log('Step 2: Taking initial screenshot...\n');
  await page.screenshot({ path: 'debug-1-initial.png', fullPage: true });
  console.log('✓ Screenshot: debug-1-initial.png\n');
  
  console.log('Step 3: Opening DevTools Console (simulated)...\n');
  
  console.log('Step 4: Checking Sources section - are checkboxes checked?\n');
  
  const checkboxState = await page.evaluate(() => {
    const sourceItems = document.querySelectorAll('.pr-source-item');
    const checkboxes = document.querySelectorAll('.pr-source-item input[type="checkbox"]');
    const checkedBoxes = document.querySelectorAll('.pr-source-item input[type="checkbox"]:checked');
    
    const details = Array.from(sourceItems).map(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const title = item.querySelector('.pr-source-title')?.textContent.trim();
      return {
        title: title?.substring(0, 50),
        checked: checkbox?.checked || false,
        disabled: checkbox?.disabled || false
      };
    });
    
    return {
      totalSources: sourceItems.length,
      totalCheckboxes: checkboxes.length,
      checkedCount: checkedBoxes.length,
      details
    };
  });
  
  console.log(`Total sources: ${checkboxState.totalSources}`);
  console.log(`Total checkboxes: ${checkboxState.totalCheckboxes}`);
  console.log(`Checked sources: ${checkboxState.checkedCount}\n`);
  
  if (checkboxState.details.length > 0) {
    console.log('Source details:');
    checkboxState.details.forEach((source, i) => {
      const status = source.checked ? '☑️ CHECKED' : '☐ unchecked';
      console.log(`  ${i + 1}. ${status} - ${source.title}`);
    });
  }
  console.log();
  
  console.log('Step 5: Running console diagnostics...\n');
  
  const diagnostics = await page.evaluate(() => {
    const results = {};
    
    // Check if prAgent exists
    if (window.prAgent) {
      results.prAgentExists = true;
      results.apiKey = window.prAgent.apiKey || 'not set';
      results.apiKeySource = window.prAgent.apiKeySource || 'unknown';
      results.isGenerating = window.prAgent.isGenerating || false;
      
      if (window.prAgent.sources) {
        results.sourcesArray = window.prAgent.sources.map(s => ({
          id: s.id,
          title: s.title?.substring(0, 40),
          selected: s.selected,
          type: s.type
        }));
        results.selectedCount = window.prAgent.sources.filter(s => s.selected).length;
      } else {
        results.sourcesArray = null;
        results.selectedCount = 0;
      }
    } else {
      results.prAgentExists = false;
    }
    
    // Check button state
    const btn = document.getElementById('pr-generate-btn') || document.querySelector('.pr-generate-btn');
    if (btn) {
      results.buttonExists = true;
      results.buttonDisabled = btn.disabled;
      results.buttonText = btn.textContent.trim();
      results.buttonVisible = window.getComputedStyle(btn).display !== 'none';
    } else {
      results.buttonExists = false;
    }
    
    return results;
  });
  
  console.log('Console Diagnostics:');
  console.log('─'.repeat(60));
  console.log(`prAgent exists: ${diagnostics.prAgentExists ? '✅ YES' : '❌ NO'}`);
  
  if (diagnostics.prAgentExists) {
    console.log(`API Key: ${diagnostics.apiKey}`);
    console.log(`API Key Source: ${diagnostics.apiKeySource}`);
    console.log(`Is Generating: ${diagnostics.isGenerating}`);
    console.log(`Selected Sources: ${diagnostics.selectedCount}`);
    
    if (diagnostics.sourcesArray && diagnostics.sourcesArray.length > 0) {
      console.log('\nSources in prAgent.sources:');
      diagnostics.sourcesArray.forEach((s, i) => {
        const sel = s.selected ? '✓ SELECTED' : '✗ not selected';
        console.log(`  ${i + 1}. ${sel} - ${s.title} (${s.type})`);
      });
    }
  }
  
  console.log();
  console.log(`Generate Button exists: ${diagnostics.buttonExists ? '✅ YES' : '❌ NO'}`);
  if (diagnostics.buttonExists) {
    console.log(`Generate Button disabled: ${diagnostics.buttonDisabled ? '🔴 YES (DISABLED)' : '🟢 NO (enabled)'}`);
    console.log(`Generate Button text: "${diagnostics.buttonText}"`);
    console.log(`Generate Button visible: ${diagnostics.buttonVisible ? '✅ YES' : '❌ NO'}`);
  }
  console.log('─'.repeat(60));
  console.log();
  
  console.log('Step 6: Taking screenshot with console output visible...\n');
  
  // Add the diagnostic output to the page for screenshot
  await page.evaluate((diag) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
      max-width: 400px;
      white-space: pre-wrap;
    `;
    
    overlay.textContent = `DIAGNOSTICS:
prAgent: ${diag.prAgentExists ? 'EXISTS' : 'MISSING'}
API Key: ${diag.apiKey}
Selected: ${diag.selectedCount}
Generating: ${diag.isGenerating}
Button: ${diag.buttonDisabled ? 'DISABLED' : 'ENABLED'}`;
    
    document.body.appendChild(overlay);
  }, diagnostics);
  
  await page.screenshot({ path: 'debug-2-diagnostics.png', fullPage: true });
  console.log('✓ Screenshot: debug-2-diagnostics.png\n');
  
  console.log('Step 7: Checking if we need to manually select sources...\n');
  
  if (checkboxState.checkedCount === 0 && checkboxState.totalCheckboxes > 0) {
    console.log('⚠️  No sources checked! Manually selecting all sources...\n');
    
    await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('.pr-source-item input[type="checkbox"]');
      checkboxes.forEach(cb => {
        if (!cb.checked && !cb.disabled) {
          cb.click();
        }
      });
    });
    
    await page.waitForTimeout(1000);
    
    const afterSelection = await page.evaluate(() => {
      const checkedBoxes = document.querySelectorAll('.pr-source-item input[type="checkbox"]:checked');
      const btn = document.getElementById('pr-generate-btn') || document.querySelector('.pr-generate-btn');
      const selectedInPrAgent = window.prAgent?.sources?.filter(s => s.selected).length || 0;
      
      return {
        checkedBoxesCount: checkedBoxes.length,
        buttonDisabled: btn?.disabled,
        selectedInPrAgent
      };
    });
    
    console.log(`After manual selection:`);
    console.log(`  Checked checkboxes: ${afterSelection.checkedBoxesCount}`);
    console.log(`  Selected in prAgent: ${afterSelection.selectedInPrAgent}`);
    console.log(`  Button disabled: ${afterSelection.buttonDisabled ? '🔴 STILL DISABLED' : '🟢 NOW ENABLED'}`);
    console.log();
    
    await page.screenshot({ path: 'debug-3-after-selection.png', fullPage: true });
    console.log('✓ Screenshot: debug-3-after-selection.png\n');
  } else {
    console.log(`✓ Sources already checked (${checkboxState.checkedCount}/${checkboxState.totalCheckboxes})\n`);
  }
  
  console.log('Step 8: Final button state check...\n');
  
  const finalState = await page.evaluate(() => {
    const btn = document.getElementById('pr-generate-btn') || document.querySelector('.pr-generate-btn');
    const checkedBoxes = document.querySelectorAll('.pr-source-item input[type="checkbox"]:checked');
    const selectedInPrAgent = window.prAgent?.sources?.filter(s => s.selected).length || 0;
    
    return {
      buttonDisabled: btn?.disabled,
      buttonText: btn?.textContent.trim(),
      checkedBoxesCount: checkedBoxes.length,
      selectedInPrAgent,
      apiKey: window.prAgent?.apiKey || 'not set',
      isGenerating: window.prAgent?.isGenerating || false
    };
  });
  
  console.log('Final State:');
  console.log(`  Checked checkboxes: ${finalState.checkedBoxesCount}`);
  console.log(`  Selected in prAgent: ${finalState.selectedInPrAgent}`);
  console.log(`  API Key: ${finalState.apiKey}`);
  console.log(`  Is Generating: ${finalState.isGenerating}`);
  console.log(`  Button disabled: ${finalState.buttonDisabled ? '🔴 YES' : '🟢 NO'}`);
  console.log(`  Button text: "${finalState.buttonText}"`);
  console.log();
  
  await page.screenshot({ path: 'debug-4-final.png', fullPage: true });
  console.log('✓ Screenshot: debug-4-final.png\n');
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Issue Analysis:');
  
  if (!diagnostics.prAgentExists) {
    console.log('❌ CRITICAL: prAgent not found in window object');
    console.log('   → JavaScript may not have loaded correctly');
  } else {
    if (finalState.selectedInPrAgent === 0) {
      console.log('❌ ISSUE: No sources selected in prAgent.sources array');
      console.log('   → Checkboxes may not be updating prAgent state');
    } else {
      console.log(`✅ Sources selected: ${finalState.selectedInPrAgent}`);
    }
    
    if (finalState.apiKey === 'not set' || finalState.apiKey === null) {
      console.log('❌ ISSUE: API key not set');
      console.log('   → This would disable the Generate button');
    } else {
      console.log(`✅ API key configured: ${finalState.apiKey}`);
    }
    
    if (finalState.isGenerating) {
      console.log('⚠️  Generation already in progress');
      console.log('   → Button disabled during generation');
    }
  }
  
  console.log();
  
  if (finalState.buttonDisabled) {
    console.log('❌ Generate button is DISABLED');
    console.log('\nPossible causes:');
    console.log('  1. No sources selected (need at least 1)');
    console.log('  2. API key not configured');
    console.log('  3. Generation already in progress');
    console.log('  4. Checkbox state not syncing with prAgent');
  } else {
    console.log('✅ Generate button is ENABLED and ready to use');
  }
  
  console.log();
  console.log('Screenshots saved:');
  console.log('  1. debug-1-initial.png - Initial page state');
  console.log('  2. debug-2-diagnostics.png - With diagnostic overlay');
  console.log('  3. debug-3-after-selection.png - After manual selection (if needed)');
  console.log('  4. debug-4-final.png - Final state');
  console.log();
  
  console.log('Browser will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  
  console.log('\n✓ Debug complete');
})();
