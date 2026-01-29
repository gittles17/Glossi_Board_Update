/**
 * Glossi Investor Cheat Sheet - Dynamic Content Manager
 * 
 * This script provides functionality to update the cheat sheet content
 * based on new inputs (text, data, notes, etc.)
 */

// ============================================
// CHEATSHEET DATA STORE
// ============================================

const CheatSheetData = {
  // Company basics
  company: {
    name: 'Glossi',
    tagline: 'AI-powered visuals. Pixel-perfect products.',
    description: 'Generate unlimited product images and videos without ever compromising your brand.',
    demoUrl: 'https://www.youtube.com/watch?v=kXbQqM35iHA'
  },

  // Timeline milestones
  timeline: [
    {
      id: 'enterprise',
      title: '2 Years with Enterprise',
      description: 'Built and refined Glossi alongside Crate & Barrel, HOKA, and other major brands. Deep product-market fit.',
      status: 'completed'
    },
    {
      id: 'ai',
      title: 'AI Integration',
      description: 'Successfully shipped AI texturing, AI backgrounds, and world models that understand 3D space.',
      status: 'completed'
    },
    {
      id: 'sales',
      title: 'Sales Motion Started',
      description: 'Enterprise sales launched 3 months ago. $1.2M+ pipeline already. Strong early traction.',
      status: 'active'
    },
    {
      id: 'seed',
      title: 'Seed Round',
      description: 'Raising to ramp sales and close pipeline. World models unlock the next wave of features.',
      status: 'future'
    }
  ],

  // Pipeline deals
  pipeline: {
    totalValue: '$1.2M+',
    closestToClose: [
      { name: 'MagnaFlow', value: '$36-50K', stage: 'pilot', timing: 'Q1' },
      { name: 'Peleman', value: '$50K', stage: 'demo', timing: 'Q1' },
      { name: '3Day Blinds', value: '$50K', stage: 'validation', timing: 'Q1' },
      { name: 'Centric Brands', value: '$50K', stage: 'demo', timing: 'Q1' }
    ],
    inProgress: [
      { name: 'Sunday Dinner', value: '$500K', stage: 'discovery', timing: 'Q1' },
      { name: 'Checkpoint', value: '$75K', stage: 'demo', timing: 'Q2' },
      { name: 'Bob Mills Furniture', value: '$50K', stage: 'demo', timing: 'Q1-Q2' },
      { name: 'Silverside', value: '$50K', stage: 'discovery', timing: 'Q1' },
      { name: 'Filson', value: '$50K', stage: 'discovery', timing: 'Q1' },
      { name: 'Fisher Footwear', value: '$50K', stage: 'discovery', timing: 'Q1' }
    ],
    partnerships: [
      { name: 'VNTANA', value: '$50K', timing: 'Q2', note: 'Joint case study' },
      { name: 'Vyking', value: '$50K', timing: 'Q2', note: 'Active in environment' },
      { name: 'Sharpthink', value: '$50K', timing: 'Q3', note: 'Co-pilot case study' }
    ],
    exploring: 'Building relationships with EY, PWC, KPMG, Deloitte, Accenture for enterprise distribution.'
  },

  // Key stats
  stats: [
    { value: '$1.2M+', label: 'Pipeline Value', note: 'built in 3 months' },
    { value: '10+', label: 'Active Prospects', note: 'in various stages' },
    { value: '3', label: 'Partnerships', note: 'strategic integrations' }
  ],

  // Moat/defensibility points
  moat: [
    {
      number: '01',
      title: '3D Pipeline Integration',
      description: 'We work with actual 3D product data, not images. Deep integration with existing brand workflows.'
    },
    {
      number: '02',
      title: 'Enterprise Relationships',
      description: 'Active pilots with major brands. Each integration deepens switching costs.'
    },
    {
      number: '03',
      title: 'Brand Trust Requirements',
      description: 'Enterprise brands need reliability that "good enough" AI can\'t deliver.'
    }
  ],

  // Key talking points for board
  talkingPoints: [
    {
      title: 'The Problem is Real',
      content: '"Current AI tools rebuild your product every time. Materials drift, proportions shift. It\'s not reliable enough for enterprise scale."'
    },
    {
      title: 'Our Approach is Different',
      content: '"We use 3D as the source of truth. The product is composited in, never generated. Pixel-perfect every time."'
    },
    {
      title: 'We Have Traction',
      content: '"$1.2M+ pipeline built in 3 months. Real conversations with real enterprise buyers who have real budgets."'
    },
    {
      title: 'The Moat is Deep',
      content: '"3D pipeline integration, enterprise relationships, and brand trust requirements create compounding defensibility."'
    },
    {
      title: 'Why Now',
      content: '"We\'ve spent 2 years building with enterprise. Sales motion just started. This is the inflection point."'
    }
  ],

  // Last updated
  lastUpdated: new Date().toISOString()
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format currency values
 */
function formatCurrency(value) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  return value;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Calculate total pipeline value
 */
function calculatePipelineTotal() {
  let total = 0;
  
  // Helper to parse value strings
  const parseValue = (str) => {
    const match = str.match(/\$?([\d,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return 0;
  };

  CheatSheetData.pipeline.closestToClose.forEach(deal => {
    total += parseValue(deal.value);
  });
  
  CheatSheetData.pipeline.inProgress.forEach(deal => {
    total += parseValue(deal.value);
  });
  
  CheatSheetData.pipeline.partnerships.forEach(deal => {
    total += parseValue(deal.value);
  });

  return total;
}

// ============================================
// UPDATE FUNCTIONS
// ============================================

/**
 * Add a new deal to the pipeline
 */
function addDeal(category, deal) {
  if (!deal.name || !deal.value) {
    console.error('Deal must have name and value');
    return false;
  }

  const validCategories = ['closestToClose', 'inProgress', 'partnerships'];
  if (!validCategories.includes(category)) {
    console.error('Invalid category. Use: closestToClose, inProgress, or partnerships');
    return false;
  }

  CheatSheetData.pipeline[category].push(deal);
  CheatSheetData.lastUpdated = new Date().toISOString();
  
  console.log(`Added deal: ${deal.name} to ${category}`);
  return true;
}

/**
 * Update an existing deal
 */
function updateDeal(category, dealName, updates) {
  const deals = CheatSheetData.pipeline[category];
  const index = deals.findIndex(d => d.name === dealName);
  
  if (index === -1) {
    console.error(`Deal "${dealName}" not found in ${category}`);
    return false;
  }

  CheatSheetData.pipeline[category][index] = {
    ...deals[index],
    ...updates
  };
  CheatSheetData.lastUpdated = new Date().toISOString();
  
  console.log(`Updated deal: ${dealName}`);
  return true;
}

/**
 * Move a deal between categories (stage progression)
 */
function moveDeal(dealName, fromCategory, toCategory) {
  const fromDeals = CheatSheetData.pipeline[fromCategory];
  const index = fromDeals.findIndex(d => d.name === dealName);
  
  if (index === -1) {
    console.error(`Deal "${dealName}" not found in ${fromCategory}`);
    return false;
  }

  const deal = fromDeals.splice(index, 1)[0];
  CheatSheetData.pipeline[toCategory].push(deal);
  CheatSheetData.lastUpdated = new Date().toISOString();
  
  console.log(`Moved deal: ${dealName} from ${fromCategory} to ${toCategory}`);
  return true;
}

/**
 * Update pipeline total value
 */
function updatePipelineTotal(newTotal) {
  CheatSheetData.pipeline.totalValue = newTotal;
  CheatSheetData.lastUpdated = new Date().toISOString();
}

/**
 * Add a new talking point
 */
function addTalkingPoint(title, content) {
  CheatSheetData.talkingPoints.push({ title, content });
  CheatSheetData.lastUpdated = new Date().toISOString();
  console.log(`Added talking point: ${title}`);
}

/**
 * Update a stat
 */
function updateStat(index, updates) {
  if (index < 0 || index >= CheatSheetData.stats.length) {
    console.error('Invalid stat index');
    return false;
  }

  CheatSheetData.stats[index] = {
    ...CheatSheetData.stats[index],
    ...updates
  };
  CheatSheetData.lastUpdated = new Date().toISOString();
  return true;
}

/**
 * Add a moat point
 */
function addMoatPoint(title, description) {
  const number = String(CheatSheetData.moat.length + 1).padStart(2, '0');
  CheatSheetData.moat.push({ number, title, description });
  CheatSheetData.lastUpdated = new Date().toISOString();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Re-render pipeline cards
 */
function renderPipeline() {
  // Update total value
  const kpiValue = document.querySelector('.kpi-value');
  if (kpiValue) {
    kpiValue.textContent = CheatSheetData.pipeline.totalValue;
  }

  // Render each category
  renderPipelineCategory('closestToClose', '.pipeline-section:nth-of-type(1) .pipeline-grid');
  renderPipelineCategory('inProgress', '.pipeline-section:nth-of-type(2) .pipeline-grid');
  renderPipelineCategory('partnerships', '.pipeline-section:nth-of-type(3) .pipeline-grid');
}

function renderPipelineCategory(category, selector) {
  const container = document.querySelector(selector);
  if (!container) return;

  const deals = CheatSheetData.pipeline[category];
  
  container.innerHTML = deals.map(deal => `
    <div class="pipeline-card ${category === 'partnerships' ? 'partnership-card' : ''}">
      <div class="card-header">
        <span class="company-name">${deal.name}</span>
        <span class="timing">${deal.timing}</span>
      </div>
      <span class="deal-value">${deal.value}</span>
      <span class="stage stage-${deal.stage || 'partnership'}">${deal.stage || 'Partnership'}</span>
      ${deal.note ? `<p class="card-note">${deal.note}</p>` : ''}
    </div>
  `).join('');
}

/**
 * Re-render stats
 */
function renderStats() {
  const container = document.querySelector('.stats-grid');
  if (!container) return;

  container.innerHTML = CheatSheetData.stats.map(stat => `
    <div class="stat-card">
      <span class="stat-value">${stat.value}</span>
      <span class="stat-label">${stat.label}</span>
      <span class="stat-note">${stat.note}</span>
    </div>
  `).join('');
}

/**
 * Re-render talking points
 */
function renderTalkingPoints() {
  const container = document.querySelector('.talking-points-grid');
  if (!container) return;

  container.innerHTML = CheatSheetData.talkingPoints.map((point, index) => `
    <div class="talking-point">
      <span class="point-number">${index + 1}</span>
      <div class="point-content">
        <h4>${point.title}</h4>
        <p>${point.content}</p>
      </div>
    </div>
  `).join('');
}

/**
 * Update last modified date
 */
function updateLastModified() {
  const dateEl = document.querySelector('.update-date');
  if (dateEl) {
    dateEl.textContent = `Last updated: ${formatDate(CheatSheetData.lastUpdated)}`;
  }
}

// ============================================
// EXPORT/IMPORT DATA
// ============================================

/**
 * Export current data as JSON
 */
function exportData() {
  const dataStr = JSON.stringify(CheatSheetData, null, 2);
  console.log('Current CheatSheet Data:');
  console.log(dataStr);
  return dataStr;
}

/**
 * Import data from JSON
 */
function importData(jsonData) {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    Object.assign(CheatSheetData, data);
    CheatSheetData.lastUpdated = new Date().toISOString();
    
    // Re-render all sections
    renderPipeline();
    renderStats();
    renderTalkingPoints();
    updateLastModified();
    
    console.log('Data imported successfully');
    return true;
  } catch (e) {
    console.error('Failed to import data:', e);
    return false;
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Update last modified date
  updateLastModified();

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  console.log('Glossi Investor Cheat Sheet loaded');
  console.log('Available functions:');
  console.log('- addDeal(category, deal)');
  console.log('- updateDeal(category, dealName, updates)');
  console.log('- moveDeal(dealName, fromCategory, toCategory)');
  console.log('- addTalkingPoint(title, content)');
  console.log('- updateStat(index, updates)');
  console.log('- exportData()');
  console.log('- importData(jsonData)');
});

// Make functions globally available
window.GlossiCheatSheet = {
  data: CheatSheetData,
  addDeal,
  updateDeal,
  moveDeal,
  updatePipelineTotal,
  addTalkingPoint,
  updateStat,
  addMoatPoint,
  renderPipeline,
  renderStats,
  renderTalkingPoints,
  exportData,
  importData,
  calculatePipelineTotal
};
