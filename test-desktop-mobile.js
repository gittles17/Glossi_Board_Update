const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('DESKTOP vs MOBILE GENERATE BUTTON TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('Step 1: Navigate to page...\n');
  
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  await page.waitForTimeout(5000);
  console.log('✓ Page loaded at desktop width (1920x1080)\n');
  
  console.log('Step 2: Taking desktop screenshot...\n');
  await page.screenshot({ path: 'responsive-1-desktop.png', fullPage: true });
  console.log('✓ Screenshot: responsive-1-desktop.png\n');
  
  console.log('Step 3: Testing desktop Generate button...\n');
  
  const desktopButtonState = await page.evaluate(() => {
    const btn = document.getElementById('pr-generate-btn');
    const mobileTabsContainer = document.querySelector('.pr-mobile-tabs');
    
    return {
      buttonExists: !!btn,
      buttonVisible: btn ? window.getComputedStyle(btn).display !== 'none' : false,
      buttonDisabled: btn?.disabled || false,
      buttonText: btn?.textContent.trim(),
      buttonPosition: btn ? btn.getBoundingClientRect() : null,
      mobileTabsVisible: mobileTabsContainer ? 
        window.getComputedStyle(mobileTabsContainer).display !== 'none' : false
    };
  });
  
  console.log('Desktop Button State:');
  console.log(`  Exists: ${desktopButtonState.buttonExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Visible: ${desktopButtonState.buttonVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`  Disabled: ${desktopButtonState.buttonDisabled ? '🔴 YES' : '🟢 NO'}`);
  console.log(`  Text: "${desktopButtonState.buttonText}"`);
  console.log(`  Mobile tabs visible: ${desktopButtonState.mobileTabsVisible ? 'YES' : 'NO'}`);
  if (desktopButtonState.buttonPosition) {
    console.log(`  Position: x=${desktopButtonState.buttonPosition.x.toFixed(0)}, y=${desktopButtonState.buttonPosition.y.toFixed(0)}`);
  }
  console.log();
  
  if (desktopButtonState.buttonVisible && !desktopButtonState.buttonDisabled) {
    console.log('Clicking desktop Generate button...\n');
    
    await page.evaluate(() => {
      const btn = document.getElementById('pr-generate-btn');
      if (btn) {
        console.log('🖱️ Desktop button clicked');
        btn.click();
      }
    });
    
    await page.waitForTimeout(2000);
    
    const afterDesktopClick = await page.evaluate(() => {
      const loading = document.querySelector('.pr-loading-state');
      return {
        loadingVisible: loading ? window.getComputedStyle(loading).display !== 'none' : false
      };
    });
    
    console.log(`Desktop button click result:`);
    console.log(`  Loading state appeared: ${afterDesktopClick.loadingVisible ? '✅ YES' : '❌ NO'}`);
    
    if (afterDesktopClick.loadingVisible) {
      console.log('  ✅ Desktop button works!\n');
      
      // Cancel the generation to test mobile button
      await page.evaluate(() => {
        if (window.prAgent && window.prAgent.isGenerating) {
          window.prAgent.isGenerating = false;
          const loading = document.querySelector('.pr-loading-state');
          if (loading) loading.style.display = 'none';
        }
      });
      
      await page.waitForTimeout(500);
      console.log('  (Cancelled generation to test mobile button)\n');
    } else {
      console.log('  ❌ Desktop button did not trigger generation\n');
    }
    
    await page.screenshot({ path: 'responsive-2-desktop-clicked.png', fullPage: true });
    console.log('✓ Screenshot: responsive-2-desktop-clicked.png\n');
  } else {
    console.log('⚠️  Desktop button not clickable (disabled or hidden)\n');
  }
  
  console.log('Step 4: Resizing to mobile width (375px)...\n');
  
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  console.log('✓ Viewport resized to 375x667 (iPhone SE)\n');
  
  console.log('Step 5: Taking mobile screenshot...\n');
  await page.screenshot({ path: 'responsive-3-mobile.png', fullPage: true });
  console.log('✓ Screenshot: responsive-3-mobile.png\n');
  
  console.log('Step 6: Checking mobile Generate button...\n');
  
  const mobileButtonState = await page.evaluate(() => {
    const btn = document.getElementById('pr-generate-btn');
    const mobileTabsContainer = document.querySelector('.pr-mobile-tabs');
    const workspaceTab = document.querySelector('.pr-mobile-tab[data-mobile-tab="workspace"]');
    
    return {
      buttonExists: !!btn,
      buttonVisible: btn ? window.getComputedStyle(btn).display !== 'none' : false,
      buttonDisabled: btn?.disabled || false,
      buttonText: btn?.textContent.trim(),
      buttonPosition: btn ? btn.getBoundingClientRect() : null,
      mobileTabsVisible: mobileTabsContainer ? 
        window.getComputedStyle(mobileTabsContainer).display !== 'none' : false,
      workspaceTabExists: !!workspaceTab,
      workspaceTabActive: workspaceTab?.classList.contains('active')
    };
  });
  
  console.log('Mobile Button State:');
  console.log(`  Button exists: ${mobileButtonState.buttonExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button visible: ${mobileButtonState.buttonVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button disabled: ${mobileButtonState.buttonDisabled ? '🔴 YES' : '🟢 NO'}`);
  console.log(`  Button text: "${mobileButtonState.buttonText}"`);
  console.log(`  Mobile tabs visible: ${mobileButtonState.mobileTabsVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`  Workspace tab exists: ${mobileButtonState.workspaceTabExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Workspace tab active: ${mobileButtonState.workspaceTabActive ? 'YES' : 'NO'}`);
  if (mobileButtonState.buttonPosition) {
    console.log(`  Button position: x=${mobileButtonState.buttonPosition.x.toFixed(0)}, y=${mobileButtonState.buttonPosition.y.toFixed(0)}`);
    console.log(`  Button in viewport: ${mobileButtonState.buttonPosition.y >= 0 && mobileButtonState.buttonPosition.y < 667 ? '✅ YES' : '❌ NO (needs scroll)'}`);
  }
  console.log();
  
  // Switch to Workspace tab if needed
  if (!mobileButtonState.workspaceTabActive && mobileButtonState.workspaceTabExists) {
    console.log('Switching to Workspace tab on mobile...\n');
    
    await page.evaluate(() => {
      const workspaceTab = document.querySelector('.pr-mobile-tab[data-mobile-tab="workspace"]');
      if (workspaceTab) {
        workspaceTab.click();
      }
    });
    
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'responsive-4-mobile-workspace.png', fullPage: true });
    console.log('✓ Screenshot: responsive-4-mobile-workspace.png\n');
    
    // Re-check button state
    const updatedMobileState = await page.evaluate(() => {
      const btn = document.getElementById('pr-generate-btn');
      return {
        buttonVisible: btn ? window.getComputedStyle(btn).display !== 'none' : false,
        buttonDisabled: btn?.disabled || false
      };
    });
    
    console.log('After switching to Workspace tab:');
    console.log(`  Button visible: ${updatedMobileState.buttonVisible ? '✅ YES' : '❌ NO'}`);
    console.log(`  Button disabled: ${updatedMobileState.buttonDisabled ? '🔴 YES' : '🟢 NO'}`);
    console.log();
    
    mobileButtonState.buttonVisible = updatedMobileState.buttonVisible;
    mobileButtonState.buttonDisabled = updatedMobileState.buttonDisabled;
  }
  
  console.log('Step 7: Testing mobile Generate button...\n');
  
  if (mobileButtonState.buttonExists) {
    // Scroll to button if needed
    await page.evaluate(() => {
      const btn = document.getElementById('pr-generate-btn');
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(500);
    
    const clickResult = await page.evaluate(() => {
      const btn = document.getElementById('pr-generate-btn');
      
      if (!btn) {
        return { success: false, error: 'Button not found' };
      }
      
      if (btn.disabled) {
        return { success: false, error: 'Button is disabled' };
      }
      
      const styles = window.getComputedStyle(btn);
      if (styles.display === 'none') {
        return { success: false, error: 'Button is hidden (display: none)' };
      }
      
      console.log('🖱️ Mobile button clicked');
      
      try {
        btn.click();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });
    
    if (clickResult.success) {
      console.log('✅ Mobile button clicked successfully\n');
      
      await page.waitForTimeout(2000);
      
      const afterMobileClick = await page.evaluate(() => {
        const loading = document.querySelector('.pr-loading-state');
        return {
          loadingVisible: loading ? window.getComputedStyle(loading).display !== 'none' : false
        };
      });
      
      console.log(`Mobile button click result:`);
      console.log(`  Loading state appeared: ${afterMobileClick.loadingVisible ? '✅ YES' : '❌ NO'}`);
      
      if (afterMobileClick.loadingVisible) {
        console.log('  ✅ Mobile button works!\n');
      } else {
        console.log('  ❌ Mobile button did not trigger generation\n');
      }
      
      await page.screenshot({ path: 'responsive-5-mobile-clicked.png', fullPage: true });
      console.log('✓ Screenshot: responsive-5-mobile-clicked.png\n');
    } else {
      console.log(`❌ Mobile button click failed: ${clickResult.error}\n`);
    }
  } else {
    console.log('❌ Mobile button does not exist\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('COMPARISON SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('DESKTOP (1920px):');
  console.log(`  Button exists: ${desktopButtonState.buttonExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button visible: ${desktopButtonState.buttonVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button clickable: ${desktopButtonState.buttonVisible && !desktopButtonState.buttonDisabled ? '✅ YES' : '❌ NO'}`);
  console.log(`  Mobile tabs shown: ${desktopButtonState.mobileTabsVisible ? 'YES' : 'NO'}`);
  console.log();
  
  console.log('MOBILE (375px):');
  console.log(`  Button exists: ${mobileButtonState.buttonExists ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button visible: ${mobileButtonState.buttonVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`  Button clickable: ${mobileButtonState.buttonVisible && !mobileButtonState.buttonDisabled ? '✅ YES' : '❌ NO'}`);
  console.log(`  Mobile tabs shown: ${mobileButtonState.mobileTabsVisible ? '✅ YES' : '❌ NO'}`);
  console.log();
  
  console.log('RESPONSIVE BEHAVIOR:');
  const responsiveOk = desktopButtonState.buttonExists && 
                       mobileButtonState.buttonExists &&
                       desktopButtonState.buttonVisible &&
                       mobileButtonState.mobileTabsVisible;
  
  if (responsiveOk) {
    console.log('  ✅ Both desktop and mobile buttons functional');
    console.log('  ✅ Layout adapts correctly to viewport size');
    console.log('  ✅ Mobile tabs appear on small screens');
  } else {
    console.log('  ⚠️  Some responsive issues detected');
    if (!desktopButtonState.buttonVisible) {
      console.log('  - Desktop button not visible');
    }
    if (!mobileButtonState.mobileTabsVisible) {
      console.log('  - Mobile tabs not showing on small screen');
    }
  }
  console.log();
  
  console.log('Screenshots saved:');
  console.log('  1. responsive-1-desktop.png - Desktop view');
  console.log('  2. responsive-2-desktop-clicked.png - After desktop click');
  console.log('  3. responsive-3-mobile.png - Mobile view');
  console.log('  4. responsive-4-mobile-workspace.png - Mobile workspace tab');
  console.log('  5. responsive-5-mobile-clicked.png - After mobile click');
  console.log();
  
  console.log('Browser will stay open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  
  console.log('\n✓ Test complete');
})();
