const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', err => {
    const text = `PAGE ERROR: ${err.message}`;
    errors.push(text);
    console.log(`❌ ${text}`);
  });
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE FILTER DROPDOWN DEBUG');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('Step 1-2: Navigate and wait 5 seconds...\n');
  
  await page.goto('https://glossiboardupdate-production.up.railway.app/pr.html', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  await page.waitForTimeout(5000);
  console.log('✓ Page loaded\n');
  
  console.log('Step 3: Taking initial screenshot...\n');
  await page.screenshot({ path: 'phase-1-initial.png', fullPage: true });
  console.log('✓ Screenshot: phase-1-initial.png\n');
  
  console.log('Step 5: Checking if dropdown button exists...\n');
  
  const buttonCheck = await page.evaluate(() => {
    const btn = document.getElementById('pr-phase-filter-btn');
    
    if (!btn) {
      // Try alternate selectors
      const byClass = document.querySelector('.pr-phase-filter-btn');
      const anyPhaseBtn = document.querySelector('[id*="phase"]');
      
      return {
        byId: null,
        byClass: byClass ? {
          id: byClass.id,
          classes: byClass.className,
          text: byClass.textContent.trim()
        } : null,
        anyPhaseElement: anyPhaseBtn ? {
          id: anyPhaseBtn.id,
          tag: anyPhaseBtn.tagName,
          text: anyPhaseBtn.textContent.trim().substring(0, 50)
        } : null
      };
    }
    
    return {
      byId: {
        exists: true,
        id: btn.id,
        classes: btn.className,
        text: btn.textContent.trim(),
        disabled: btn.disabled,
        visible: window.getComputedStyle(btn).display !== 'none'
      }
    };
  });
  
  console.log('Button Check:');
  if (buttonCheck.byId) {
    console.log('  ✅ Found by ID: "pr-phase-filter-btn"');
    console.log(`  Text: "${buttonCheck.byId.text}"`);
    console.log(`  Classes: ${buttonCheck.byId.classes}`);
    console.log(`  Disabled: ${buttonCheck.byId.disabled}`);
    console.log(`  Visible: ${buttonCheck.byId.visible}`);
  } else {
    console.log('  ❌ NOT found by ID: "pr-phase-filter-btn"');
    
    if (buttonCheck.byClass) {
      console.log('  ⚠️  Found by class instead:');
      console.log(`    ID: ${buttonCheck.byClass.id}`);
      console.log(`    Text: "${buttonCheck.byClass.text}"`);
    }
    
    if (buttonCheck.anyPhaseElement) {
      console.log('  ⚠️  Found element with "phase" in ID:');
      console.log(`    ID: ${buttonCheck.anyPhaseElement.id}`);
      console.log(`    Tag: ${buttonCheck.anyPhaseElement.tag}`);
      console.log(`    Text: "${buttonCheck.anyPhaseElement.text}"`);
    }
    
    if (!buttonCheck.byClass && !buttonCheck.anyPhaseElement) {
      console.log('  ❌ No phase filter button found at all');
    }
  }
  console.log();
  
  console.log('Step 6: Checking if menu exists...\n');
  
  const menuCheck = await page.evaluate(() => {
    const menu = document.getElementById('pr-phase-filter-menu');
    
    if (!menu) {
      // Try alternate selectors
      const byClass = document.querySelector('.pr-phase-filter-menu');
      const anyPhaseMenu = document.querySelector('[id*="phase"][id*="menu"]');
      
      return {
        byId: null,
        byClass: byClass ? {
          id: byClass.id,
          classes: byClass.className,
          display: window.getComputedStyle(byClass).display
        } : null,
        anyPhaseMenu: anyPhaseMenu ? {
          id: anyPhaseMenu.id,
          tag: anyPhaseMenu.tagName
        } : null
      };
    }
    
    const styles = window.getComputedStyle(menu);
    
    return {
      byId: {
        exists: true,
        id: menu.id,
        classes: menu.className,
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position
      }
    };
  });
  
  console.log('Menu Check:');
  if (menuCheck.byId) {
    console.log('  ✅ Found by ID: "pr-phase-filter-menu"');
    console.log(`  Classes: ${menuCheck.byId.classes}`);
    console.log(`  Display: ${menuCheck.byId.display}`);
    console.log(`  Visibility: ${menuCheck.byId.visibility}`);
    console.log(`  Opacity: ${menuCheck.byId.opacity}`);
    console.log(`  Position: ${menuCheck.byId.position}`);
  } else {
    console.log('  ❌ NOT found by ID: "pr-phase-filter-menu"');
    
    if (menuCheck.byClass) {
      console.log('  ⚠️  Found by class instead:');
      console.log(`    ID: ${menuCheck.byClass.id}`);
      console.log(`    Display: ${menuCheck.byClass.display}`);
    }
    
    if (menuCheck.anyPhaseMenu) {
      console.log('  ⚠️  Found element with "phase" and "menu" in ID:');
      console.log(`    ID: ${menuCheck.anyPhaseMenu.id}`);
    }
    
    if (!menuCheck.byClass && !menuCheck.anyPhaseMenu) {
      console.log('  ❌ No phase filter menu found at all');
    }
  }
  console.log();
  
  console.log('Step 7: Attempting to click dropdown button...\n');
  
  // Try to find and click the button
  const clickResult = await page.evaluate(() => {
    let btn = document.getElementById('pr-phase-filter-btn');
    
    if (!btn) {
      // Try finding the Press Release dropdown
      const dropdown = document.getElementById('pr-content-type-select');
      if (dropdown) {
        return {
          clicked: false,
          found: 'content-type-select',
          note: 'Found content type dropdown instead of phase filter'
        };
      }
      
      return { clicked: false, error: 'Button not found' };
    }
    
    console.log('🖱️ Clicking phase filter button');
    
    try {
      btn.click();
      return { clicked: true };
    } catch (err) {
      return { clicked: false, error: err.message };
    }
  });
  
  if (clickResult.clicked) {
    console.log('✅ Button clicked successfully\n');
    
    await page.waitForTimeout(1000);
    
    const afterClick = await page.evaluate(() => {
      const menu = document.getElementById('pr-phase-filter-menu');
      
      if (!menu) {
        return { menuFound: false };
      }
      
      const styles = window.getComputedStyle(menu);
      
      return {
        menuFound: true,
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        menuVisible: styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0'
      };
    });
    
    console.log('After clicking:');
    if (afterClick.menuFound) {
      console.log(`  Menu display: ${afterClick.display}`);
      console.log(`  Menu visibility: ${afterClick.visibility}`);
      console.log(`  Menu opacity: ${afterClick.opacity}`);
      console.log(`  Menu visible: ${afterClick.menuVisible ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('  ❌ Menu still not found after click');
    }
  } else if (clickResult.found) {
    console.log(`⚠️  ${clickResult.note}\n`);
  } else {
    console.log(`❌ Click failed: ${clickResult.error}\n`);
  }
  console.log();
  
  console.log('Step 8: Checking for console errors...\n');
  
  if (errors.length === 0) {
    console.log('✅ No JavaScript errors detected\n');
  } else {
    console.log(`❌ ${errors.length} errors found:`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
    console.log();
  }
  
  console.log('Step 9: Taking final screenshot...\n');
  await page.screenshot({ path: 'phase-2-after-click.png', fullPage: true });
  console.log('✓ Screenshot: phase-2-after-click.png\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ADDITIONAL INVESTIGATION');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('Searching for any phase-related UI elements...\n');
  
  const phaseElements = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const phaseRelated = [];
    
    allElements.forEach(el => {
      const id = el.id?.toLowerCase() || '';
      const classes = el.className?.toLowerCase() || '';
      const text = el.textContent?.trim().toLowerCase() || '';
      
      if (id.includes('phase') || classes.includes('phase') || 
          (text.includes('phase') && text.length < 100)) {
        phaseRelated.push({
          tag: el.tagName,
          id: el.id,
          classes: el.className,
          text: el.textContent.trim().substring(0, 60)
        });
      }
    });
    
    return phaseRelated.slice(0, 10); // Limit to first 10
  });
  
  if (phaseElements.length > 0) {
    console.log(`Found ${phaseElements.length} phase-related elements:`);
    phaseElements.forEach((el, i) => {
      console.log(`\n  ${i + 1}. <${el.tag}>`);
      if (el.id) console.log(`     ID: ${el.id}`);
      if (el.classes) console.log(`     Classes: ${el.classes}`);
      if (el.text) console.log(`     Text: "${el.text}"`);
    });
  } else {
    console.log('⚠️  No phase-related elements found in DOM');
    console.log('     The phase filter feature may not be implemented yet');
  }
  console.log();
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('Button Element:');
  console.log(`  Exists by ID: ${buttonCheck.byId ? '✅ YES' : '❌ NO'}`);
  
  console.log('\nMenu Element:');
  console.log(`  Exists by ID: ${menuCheck.byId ? '✅ YES' : '❌ NO'}`);
  
  console.log('\nFunctionality:');
  console.log(`  Click works: ${clickResult.clicked ? '✅ YES' : '❌ NO'}`);
  console.log(`  Console errors: ${errors.length > 0 ? `❌ ${errors.length}` : '✅ None'}`);
  
  console.log('\nConclusion:');
  if (!buttonCheck.byId && !menuCheck.byId) {
    console.log('  ⚠️  Phase filter dropdown not found in DOM');
    console.log('  📝 This feature may not be implemented yet');
    console.log('  💡 Check HTML/JS to see if phase filter exists');
  } else if (buttonCheck.byId && !menuCheck.byId) {
    console.log('  ⚠️  Button exists but menu is missing');
    console.log('  🐛 Possible bug: menu element not created');
  } else if (!buttonCheck.byId && menuCheck.byId) {
    console.log('  ⚠️  Menu exists but button is missing');
    console.log('  🐛 Possible bug: button element not created');
  } else {
    console.log('  ✅ Both button and menu exist');
    if (clickResult.clicked) {
      console.log('  ✅ Dropdown functionality working');
    } else {
      console.log('  ❌ Click functionality broken');
    }
  }
  console.log();
  
  console.log('Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  
  console.log('\n✓ Debug complete');
})();
