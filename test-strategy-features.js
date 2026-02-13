/**
 * Strategy Features Test - Post-Implementation Verification
 * Run this after implementation to verify new features work
 */

const tests = {
  passed: 0,
  failed: 0,
  errors: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      tests.passed++;
      console.log(`✅ ${name}`);
    } else {
      tests.failed++;
      tests.errors.push(name);
      console.log(`❌ ${name}`);
    }
  } catch (e) {
    tests.failed++;
    tests.errors.push(`${name}: ${e.message}`);
    console.log(`❌ ${name}: ${e.message}`);
  }
}

console.log('🧪 Running Strategy Features Tests...\n');

console.log('--- New Tab Structure ---');
test('Strategy tab exists', () => document.querySelector('.pr-panel-tab[data-panel-tab="strategy"]') !== null);
test('Sources tab exists (renamed from Research)', () => document.querySelector('.pr-panel-tab[data-panel-tab="sources"]') !== null);
test('Library tab still exists', () => document.querySelector('.pr-panel-tab[data-panel-tab="library"]') !== null);
test('Strategy tab is default active', () => {
  const strategyTab = document.querySelector('.pr-panel-tab[data-panel-tab="strategy"]');
  return strategyTab && strategyTab.classList.contains('active');
});

console.log('\n--- Strategy Tab Content ---');
test('Strategy tab content area exists', () => document.getElementById('pr-tab-strategy') !== null);
test('News Hooks section in Strategy tab', () => {
  const strategyContent = document.getElementById('pr-tab-strategy');
  return strategyContent && strategyContent.querySelector('.pr-news-hooks-section') !== null;
});
test('Recommended Angles section exists', () => {
  const strategyContent = document.getElementById('pr-tab-strategy');
  return strategyContent && strategyContent.querySelector('.pr-angles-section') !== null;
});
test('Angle Tracker section exists', () => {
  const strategyContent = document.getElementById('pr-tab-strategy');
  return strategyContent && strategyContent.querySelector('.pr-angle-tracker-section') !== null;
});

console.log('\n--- News Hooks (Moved) ---');
test('News Hooks removed from workspace tabs', () => {
  return document.querySelector('.pr-workspace-tab[data-workspace-tab="news-hooks"]') === null;
});
test('News Hooks list accessible in Strategy', () => {
  const strategyTab = document.getElementById('pr-tab-strategy');
  return strategyTab && strategyTab.querySelector('#pr-news-hooks-list') !== null;
});

console.log('\n--- Angles Feature ---');
test('Generate Angles button exists', () => document.getElementById('pr-generate-angles-btn') !== null);
test('Angles container exists', () => document.getElementById('pr-angles-list') !== null);

console.log('\n--- Angle Tracker ---');
test('Angle tracker container exists', () => document.getElementById('pr-angle-tracker') !== null);

console.log('\n--- Existing Features (Regression Check) ---');
test('Sources list still works', () => document.getElementById('pr-sources-list') !== null);
test('Add source button still works', () => document.getElementById('pr-add-source-btn') !== null);
test('Generate button still exists', () => document.getElementById('pr-generate-btn') !== null);
test('History list still exists', () => document.getElementById('pr-history-list') !== null);
test('Wizard still exists', () => document.getElementById('wizard-overlay') !== null);

console.log('\n--- LocalStorage Keys ---');
test('pr_angles key exists or can be created', () => {
  try {
    localStorage.setItem('pr_angles_test', '[]');
    localStorage.removeItem('pr_angles_test');
    return true;
  } catch (e) {
    return false;
  }
});

console.log('\n📊 Results:');
console.log(`Passed: ${tests.passed}`);
console.log(`Failed: ${tests.failed}`);

if (tests.errors.length > 0) {
  console.log('\n❌ Failed Tests:');
  tests.errors.forEach(err => console.log(`  - ${err}`));
} else {
  console.log('\n✅ All strategy feature tests passed!');
}
