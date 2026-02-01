/**
 * Storage Module
 * Handles file-based persistence for the Glossi Dashboard
 */

// Default data structure
const DEFAULT_DATA = {
  company: {
    name: 'Glossi',
    tagline: 'AI-powered visuals. Pixel-perfect products.',
    description: 'Generate unlimited product images and videos without ever compromising your brand.',
    demoUrl: 'https://www.youtube.com/watch?v=kXbQqM35iHA'
  },
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
    closed: [],
    exploring: 'Building relationships with EY, PWC, KPMG, Deloitte, Accenture for enterprise distribution.'
  },
  stats: [
    { id: 'pipeline', value: '$1.2M+', label: 'Pipeline Value', note: 'built in 3 months' },
    { id: 'prospects', value: '10+', label: 'Active Prospects', note: 'in various stages' },
    { id: 'partnerships', value: '3', label: 'Partnerships', note: 'strategic integrations' },
    { id: 'closed', value: '0', label: 'Deals Closed', note: '$0 revenue' }
  ],
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
  talkingPoints: [
    {
      title: 'The Problem is Real',
      content: 'Current AI tools rebuild your product every time. Materials drift, proportions shift. It\'s not reliable enough for enterprise scale.',
      category: 'core'
    },
    {
      title: 'Our Approach is Different',
      content: 'We use 3D as the source of truth. The product is composited in, never generated. Pixel-perfect every time.',
      category: 'core'
    },
    {
      title: 'We Have Traction',
      content: '$1.2M+ pipeline built in 3 months. Real conversations with real enterprise buyers who have real budgets.',
      category: 'traction'
    },
    {
      title: 'The Moat is Deep',
      content: '3D pipeline integration, enterprise relationships, and brand trust requirements create compounding defensibility.',
      category: 'core'
    },
    {
      title: 'Why Now',
      content: 'We\'ve spent 2 years building with enterprise. Sales motion just started. This is the inflection point.',
      category: 'market'
    }
  ],
  talkingPointCategories: ['core', 'traction', 'market', 'testimonials'],
  quickLinks: [
    { id: 'website', name: 'Glossi.io', url: 'https://glossi.io', icon: 'globe', color: 'default', emailEnabled: true, emailLabel: 'Website' },
    { id: 'video', name: 'Pitch Video', url: 'https://www.youtube.com/watch?v=kXbQqM35iHA', icon: 'video', color: 'red', emailEnabled: true, emailLabel: 'Pitch Video' },
    { id: 'deck', name: 'Deck', url: 'https://docsend.com/view/sqmwqnjh9zk8pncu', icon: 'document', color: 'blue', emailEnabled: true, emailLabel: 'Deck' },
    { id: 'article', name: 'a16z Article', url: 'https://a16z.com/ai-is-learning-to-build-reality/', icon: 'book', color: 'purple', emailEnabled: true, emailLabel: 'a16z - AI World Models' }
  ],
  thoughts: [],
  seedRaise: {
    target: '$500K',
    investors: []
  },
  lastUpdated: new Date().toISOString()
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  autoSave: true,
  theme: 'dark',
  email: {
    // Section order (drag to reorder)
    sectionOrder: ['metrics', 'pipeline', 'talkingPoints', 'highlights', 'decisions', 'actionItems'],
    // Sections to include
    sections: {
      metrics: true,
      pipeline: true,
      talkingPoints: true,
      highlights: true,
      decisions: true,
      actionItems: true
    },
    // Number of items to show
    counts: {
      pipelineDeals: 5,
      talkingPoints: 4
    },
    // Signature
    signature: 'JG',
    // Custom greeting/intro (optional)
    greeting: ''
  }
};

// Pipeline stages in order of progression
const PIPELINE_STAGES = ['discovery', 'demo', 'validation', 'pilot', 'closed'];

// Seed raise funnel stages
const SEED_RAISE_STAGES = ['interested', 'inTalks', 'committed', 'closed'];

class Storage {
  constructor() {
    this.data = null;
    this.settings = null;
    this.meetings = [];
    this.pipelineHistory = [];
    this.statHistory = [];
    this.fileHandle = null;
    this.settingsHandle = null;
    this.saveTimeout = null;
    this.serverAvailable = false;
  }

  /**
   * Initialize storage - load from server files first, then localStorage as fallback
   */
  async init() {
    // Try to load from server files first
    try {
      const response = await fetch('/api/data');
      if (response.ok) {
        const result = await response.json();
        this.serverAvailable = true;
        console.log('Server available, loading from files...');
        
        if (result.data) {
          if (result.data.dashboard_data) {
            this.data = { ...DEFAULT_DATA, ...result.data.dashboard_data };
          }
          if (result.data.meetings) {
            this.meetings = result.data.meetings;
          }
          if (result.data.settings) {
            this.settings = { ...DEFAULT_SETTINGS, ...result.data.settings };
          }
          if (result.data.pipeline_history) {
            this.pipelineHistory = result.data.pipeline_history;
          }
          if (result.data.stat_history) {
            this.statHistory = result.data.stat_history;
          }
          
          console.log('Loaded from server files:', {
            meetings: this.meetings?.length || 0,
            pipelineHistory: this.pipelineHistory?.length || 0
          });
        }
      }
    } catch (e) {
      console.log('Server not available, using localStorage');
      this.serverAvailable = false;
    }

    // Fallback to localStorage if server data is empty
    if (!this.data) {
      const storedData = localStorage.getItem('glossi_data');
      this.data = storedData ? JSON.parse(storedData) : { ...DEFAULT_DATA };
    }
    if (!this.settings) {
      const storedSettings = localStorage.getItem('glossi_settings');
      this.settings = storedSettings ? JSON.parse(storedSettings) : { ...DEFAULT_SETTINGS };
    }
    if (!this.meetings || this.meetings.length === 0) {
      const storedMeetings = localStorage.getItem('glossi_meetings');
      this.meetings = storedMeetings ? JSON.parse(storedMeetings) : [];
    }
    if (!this.pipelineHistory || this.pipelineHistory.length === 0) {
      const storedPipelineHistory = localStorage.getItem('glossi_pipeline_history');
      this.pipelineHistory = storedPipelineHistory ? JSON.parse(storedPipelineHistory) : [];
    }
    if (!this.statHistory || this.statHistory.length === 0) {
      const storedStatHistory = localStorage.getItem('glossi_stat_history');
      this.statHistory = storedStatHistory ? JSON.parse(storedStatHistory) : [];
    }

    console.log('Final loaded data:');
    console.log('- Meetings:', this.meetings?.length || 0);

    // Ensure all required fields exist
    this.data = { ...DEFAULT_DATA, ...this.data };
    this.settings = { ...DEFAULT_SETTINGS, ...this.settings };

    // Create initial snapshot if no history exists
    if (this.pipelineHistory.length === 0) {
      this.savePipelineSnapshot('Initial snapshot');
    }

    // Create initial stat snapshot if no history exists
    if (this.statHistory.length === 0) {
      this.saveStatSnapshot();
    }

    return {
      data: this.data,
      settings: this.settings,
      meetings: this.meetings,
      pipelineHistory: this.pipelineHistory,
      statHistory: this.statHistory
    };
  }

  /**
   * Get current data
   */
  getData() {
    return this.data;
  }

  /**
   * Get settings
   */
  getSettings() {
    return this.settings;
  }

  /**
   * Get all meetings
   */
  getMeetings() {
    return this.meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get latest meeting
   */
  getLatestMeeting() {
    const sorted = this.getMeetings();
    return sorted.length > 0 ? sorted[0] : null;
  }

  /**
   * Get meeting by ID
   */
  getMeetingById(id) {
    return this.meetings.find(m => m.id === id);
  }

  /**
   * Update data with new values
   */
  updateData(updates) {
    this.data = {
      ...this.data,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data;
  }

  /**
   * Update a specific section of data
   */
  updateSection(section, updates) {
    if (this.data[section]) {
      if (Array.isArray(this.data[section])) {
        this.data[section] = updates;
      } else {
        this.data[section] = {
          ...this.data[section],
          ...updates
        };
      }
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Add a new deal to pipeline
   */
  addDeal(category, deal) {
    if (this.data.pipeline[category]) {
      this.data.pipeline[category].push(deal);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Update an existing deal
   */
  updateDeal(category, dealName, updates) {
    const deals = this.data.pipeline[category];
    if (deals) {
      const index = deals.findIndex(d => d.name === dealName);
      if (index !== -1) {
        this.data.pipeline[category][index] = {
          ...deals[index],
          ...updates
        };
        this.data.lastUpdated = new Date().toISOString();
        this.scheduleSave();
      }
    }
    return this.data;
  }

  /**
   * Add a new talking point with optional category
   */
  addTalkingPoint(title, content, category = 'core') {
    this.data.talkingPoints.push({ title, content, category });
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data;
  }

  /**
   * Update an existing talking point
   */
  updateTalkingPoint(index, title, content, category) {
    if (index >= 0 && index < this.data.talkingPoints.length) {
      this.data.talkingPoints[index] = { 
        title, 
        content, 
        category: category || this.data.talkingPoints[index].category || 'core'
      };
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get talking point categories
   */
  getTalkingPointCategories() {
    return this.data.talkingPointCategories || ['core', 'traction', 'market', 'testimonials'];
  }

  /**
   * Delete a talking point
   */
  deleteTalkingPoint(index) {
    if (index >= 0 && index < this.data.talkingPoints.length) {
      this.data.talkingPoints.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get all thoughts
   */
  getThoughts() {
    return this.data.thoughts || [];
  }

  /**
   * Add a new thought (preserves all properties including isGrouped, items, suggestedCategory)
   */
  addThought(thought) {
    if (!this.data.thoughts) {
      this.data.thoughts = [];
    }
    const newThought = {
      ...thought,  // Keep all passed properties (isGrouped, items, suggestedCategory, etc.)
      id: 'thought_' + Date.now(),
      type: thought.type || 'text',
      createdAt: new Date().toISOString()
    };
    this.data.thoughts.unshift(newThought); // Add to beginning
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newThought;
  }

  /**
   * Update an existing thought
   */
  updateThought(id, updates) {
    if (!this.data.thoughts) return null;
    const index = this.data.thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.thoughts[index] = { ...this.data.thoughts[index], ...updates };
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      return this.data.thoughts[index];
    }
    return null;
  }

  /**
   * Delete a thought
   */
  deleteThought(id) {
    if (!this.data.thoughts) return this.data;
    const index = this.data.thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.thoughts.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get quick links
   */
  getQuickLinks() {
    return this.data.quickLinks || [];
  }

  /**
   * Add a quick link
   */
  addQuickLink(link) {
    if (!this.data.quickLinks) {
      this.data.quickLinks = [];
    }
    const newLink = {
      id: 'link_' + Date.now(),
      name: link.name,
      url: link.url,
      icon: link.icon || 'link',
      color: link.color || 'default',
      emailEnabled: link.emailEnabled !== false,
      emailLabel: link.emailLabel || link.name
    };
    this.data.quickLinks.push(newLink);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data;
  }

  /**
   * Update a quick link
   */
  updateQuickLink(id, updates) {
    const index = this.data.quickLinks.findIndex(l => l.id === id);
    if (index >= 0) {
      this.data.quickLinks[index] = { ...this.data.quickLinks[index], ...updates };
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Delete a quick link
   */
  deleteQuickLink(id) {
    const index = this.data.quickLinks.findIndex(l => l.id === id);
    if (index >= 0) {
      this.data.quickLinks.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get seed raise data
   */
  getSeedRaise() {
    if (!this.data.seedRaise) {
      this.data.seedRaise = { target: '$500K', investors: [] };
    }
    return this.data.seedRaise;
  }

  /**
   * Add an investor to seed raise
   */
  addInvestor(investor) {
    if (!this.data.seedRaise) {
      this.data.seedRaise = { target: '$500K', investors: [] };
    }
    const newInvestor = {
      id: 'inv_' + Date.now(),
      name: investor.name,
      amount: investor.amount || '$TBD',
      stage: investor.stage || 'interested',
      notes: investor.notes || ''
    };
    this.data.seedRaise.investors.push(newInvestor);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newInvestor;
  }

  /**
   * Update an investor
   */
  updateInvestor(id, updates) {
    if (!this.data.seedRaise) return null;
    const index = this.data.seedRaise.investors.findIndex(i => i.id === id);
    if (index >= 0) {
      this.data.seedRaise.investors[index] = {
        ...this.data.seedRaise.investors[index],
        ...updates
      };
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      return this.data.seedRaise.investors[index];
    }
    return null;
  }

  /**
   * Delete an investor
   */
  deleteInvestor(id) {
    if (!this.data.seedRaise) return false;
    const index = this.data.seedRaise.investors.findIndex(i => i.id === id);
    if (index >= 0) {
      this.data.seedRaise.investors.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  /**
   * Update seed raise target
   */
  updateSeedTarget(target) {
    if (!this.data.seedRaise) {
      this.data.seedRaise = { target: '$500K', investors: [] };
    }
    this.data.seedRaise.target = target;
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data.seedRaise;
  }

  /**
   * Get seed raise stages constant
   */
  getSeedRaiseStages() {
    return SEED_RAISE_STAGES;
  }

  /**
   * Update settings
   */
  updateSettings(updates) {
    console.log('Updating settings with:', updates);
    this.settings = {
      ...this.settings,
      ...updates
    };
    const saved = this.saveSettings();
    console.log('Settings saved:', saved, this.settings);
    return this.settings;
  }

  /**
   * Save a new meeting
   */
  saveMeeting(meeting) {
    const id = meeting.id || `meeting-${Date.now()}`;
    const existingIndex = this.meetings.findIndex(m => m.id === id);
    
    const meetingData = {
      ...meeting,
      id,
      savedAt: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      this.meetings[existingIndex] = meetingData;
      console.log('Updated existing meeting:', id);
    } else {
      this.meetings.push(meetingData);
      console.log('Added new meeting:', id);
    }

    console.log('Total meetings in memory:', this.meetings.length);

    // Save immediately for meetings (no debounce)
    const saved = this.save();
    console.log('Save result:', saved);
    
    // Verify it was saved
    const verify = localStorage.getItem('glossi_meetings');
    console.log('Verified in localStorage:', verify ? JSON.parse(verify).length : 0, 'meetings');
    
    return meetingData;
  }

  /**
   * Update a todo item in a meeting
   */
  updateMeetingTodo(meetingId, todoId, completed) {
    const meeting = this.meetings.find(m => m.id === meetingId);
    if (meeting && meeting.todos) {
      const todo = meeting.todos.find(t => t.id === todoId);
      if (todo) {
        todo.completed = completed;
        this.scheduleSave();
      }
    }
    return meeting;
  }

  /**
   * Get all clients from pipeline with their current stage
   */
  getAllPipelineClients() {
    const clients = [];
    const pipeline = this.data.pipeline;

    // Collect from closestToClose
    if (pipeline.closestToClose) {
      pipeline.closestToClose.forEach(deal => {
        clients.push({
          name: deal.name,
          stage: deal.stage,
          value: deal.value,
          timing: deal.timing,
          category: 'closestToClose'
        });
      });
    }

    // Collect from inProgress
    if (pipeline.inProgress) {
      pipeline.inProgress.forEach(deal => {
        clients.push({
          name: deal.name,
          stage: deal.stage,
          value: deal.value,
          timing: deal.timing,
          category: 'inProgress'
        });
      });
    }

    // Collect from partnerships
    if (pipeline.partnerships) {
      pipeline.partnerships.forEach(deal => {
        clients.push({
          name: deal.name,
          stage: 'partnership',
          value: deal.value,
          timing: deal.timing,
          category: 'partnerships',
          note: deal.note
        });
      });
    }

    // Collect from closed
    if (pipeline.closed) {
      pipeline.closed.forEach(deal => {
        clients.push({
          name: deal.name,
          stage: 'closed',
          value: deal.value,
          timing: deal.timing,
          category: 'closed',
          note: deal.note
        });
      });
    }

    return clients;
  }

  /**
   * Get closed deals statistics
   */
  getClosedDealsStats() {
    const closed = this.data.pipeline?.closed || [];
    const count = closed.length;
    
    // Calculate total revenue
    let totalRevenue = 0;
    closed.forEach(deal => {
      const value = deal.value || '0';
      // Parse value like "$50K" or "$1.2M"
      const match = value.match(/\$?([\d.]+)([KMB])?/i);
      if (match) {
        let num = parseFloat(match[1]);
        const suffix = (match[2] || '').toUpperCase();
        if (suffix === 'K') num *= 1000;
        else if (suffix === 'M') num *= 1000000;
        else if (suffix === 'B') num *= 1000000000;
        totalRevenue += num;
      }
    });

    // Format revenue
    let revenueStr = '$0';
    if (totalRevenue >= 1000000) {
      revenueStr = `$${(totalRevenue / 1000000).toFixed(1)}M`;
    } else if (totalRevenue >= 1000) {
      revenueStr = `$${(totalRevenue / 1000).toFixed(0)}K`;
    } else if (totalRevenue > 0) {
      revenueStr = `$${totalRevenue.toFixed(0)}`;
    }

    return { count, totalRevenue, revenueStr };
  }

  /**
   * Add a closed deal
   */
  addClosedDeal(deal) {
    if (!this.data.pipeline.closed) {
      this.data.pipeline.closed = [];
    }
    this.data.pipeline.closed.push({
      name: deal.name,
      value: deal.value,
      timing: deal.timing || new Date().toISOString().slice(0, 7),
      note: deal.note || 'Closed'
    });
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data;
  }

  /**
   * Save a pipeline snapshot
   */
  savePipelineSnapshot(note = '') {
    const clients = this.getAllPipelineClients();
    const previousSnapshot = this.pipelineHistory.length > 0 
      ? this.pipelineHistory[this.pipelineHistory.length - 1] 
      : null;

    // Calculate changes from previous snapshot
    const clientsWithChanges = clients.map(client => {
      let previousStage = null;
      let isNew = true;

      if (previousSnapshot) {
        const prevClient = previousSnapshot.clients.find(c => c.name === client.name);
        if (prevClient) {
          previousStage = prevClient.stage;
          isNew = false;
        }
      }

      return {
        ...client,
        previousStage,
        isNew,
        stageChanged: previousStage && previousStage !== client.stage
      };
    });

    const snapshot = {
      id: `snapshot-${Date.now()}`,
      date: new Date().toISOString(),
      note,
      clients: clientsWithChanges,
      summary: {
        total: clients.length,
        byStage: this.getClientCountByStage(clients),
        movements: clientsWithChanges.filter(c => c.stageChanged).length,
        newClients: clientsWithChanges.filter(c => c.isNew).length
      }
    };

    this.pipelineHistory.push(snapshot);
    this.savePipelineHistory();
    return snapshot;
  }

  /**
   * Get client count by stage
   */
  getClientCountByStage(clients = null) {
    const clientList = clients || this.getAllPipelineClients();
    const counts = {};
    
    PIPELINE_STAGES.forEach(stage => {
      counts[stage] = 0;
    });
    counts['partnership'] = 0;

    clientList.forEach(client => {
      if (counts.hasOwnProperty(client.stage)) {
        counts[client.stage]++;
      }
    });

    return counts;
  }

  /**
   * Get pipeline history
   */
  getPipelineHistory() {
    return this.pipelineHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get the latest pipeline snapshot
   */
  getLatestSnapshot() {
    if (this.pipelineHistory.length === 0) return null;
    return this.pipelineHistory[this.pipelineHistory.length - 1];
  }

  /**
   * Get history for a specific client
   */
  getClientHistory(clientName) {
    const history = [];
    
    this.pipelineHistory.forEach(snapshot => {
      const client = snapshot.clients.find(c => c.name === clientName);
      if (client) {
        history.push({
          date: snapshot.date,
          stage: client.stage,
          previousStage: client.previousStage,
          value: client.value,
          stageChanged: client.stageChanged
        });
      }
    });

    return history.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Get all stage movements (clients that changed stages)
   */
  getStageMovements(limit = 10) {
    const movements = [];

    // Go through history in reverse (newest first)
    const sortedHistory = [...this.pipelineHistory].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    for (const snapshot of sortedHistory) {
      for (const client of snapshot.clients) {
        if (client.stageChanged) {
          movements.push({
            clientName: client.name,
            previousStage: client.previousStage,
            currentStage: client.stage,
            date: snapshot.date,
            value: client.value
          });
        }
        if (client.isNew && !client.stageChanged) {
          movements.push({
            clientName: client.name,
            previousStage: null,
            currentStage: client.stage,
            date: snapshot.date,
            value: client.value,
            isNew: true
          });
        }
      }

      if (movements.length >= limit) break;
    }

    return movements.slice(0, limit);
  }

  /**
   * Get pipeline stages constant
   */
  getPipelineStages() {
    return PIPELINE_STAGES;
  }

  /**
   * Save pipeline history to localStorage and sync to server
   */
  savePipelineHistory() {
    try {
      localStorage.setItem('glossi_pipeline_history', JSON.stringify(this.pipelineHistory));
      this.syncToServer();
      return true;
    } catch (e) {
      console.error('Failed to save pipeline history:', e);
      return false;
    }
  }

  /**
   * Save a stat snapshot for week-over-week tracking
   */
  saveStatSnapshot() {
    const stats = this.data.stats;
    const snapshot = {
      id: `stat-${Date.now()}`,
      date: new Date().toISOString(),
      week: this.getWeekNumber(new Date()),
      stats: stats.map(s => ({
        id: s.id,
        value: s.value,
        numericValue: this.parseStatValue(s.value)
      }))
    };

    this.statHistory.push(snapshot);
    
    // Keep only last 52 weeks (1 year)
    if (this.statHistory.length > 52) {
      this.statHistory = this.statHistory.slice(-52);
    }

    this.saveStatHistory();
    return snapshot;
  }

  /**
   * Parse stat value to numeric for comparison
   */
  parseStatValue(value) {
    if (typeof value === 'number') return value;
    
    const str = String(value).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    
    // Handle K, M suffixes
    if (String(value).includes('M')) {
      return num * 1000000;
    } else if (String(value).includes('K')) {
      return num * 1000;
    }
    
    return isNaN(num) ? 0 : num;
  }

  /**
   * Get week number of the year
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Get previous week's stats for comparison
   */
  getPreviousWeekStats() {
    if (this.statHistory.length < 2) return null;
    
    // Get the second-to-last snapshot (previous week)
    return this.statHistory[this.statHistory.length - 2];
  }

  /**
   * Get stat trends comparing current to previous week
   */
  getStatTrends() {
    const currentStats = this.data.stats;
    const previousSnapshot = this.getPreviousWeekStats();
    
    const trends = {};
    
    currentStats.forEach(stat => {
      const currentNumeric = this.parseStatValue(stat.value);
      let trend = 'neutral';
      let change = 0;
      let changeDisplay = '';
      
      if (previousSnapshot) {
        const prevStat = previousSnapshot.stats.find(s => s.id === stat.id);
        if (prevStat) {
          const prevNumeric = prevStat.numericValue;
          change = currentNumeric - prevNumeric;
          
          if (change > 0) {
            trend = 'up';
            changeDisplay = this.formatChange(change, stat.id);
          } else if (change < 0) {
            trend = 'down';
            changeDisplay = this.formatChange(Math.abs(change), stat.id);
          }
        }
      }
      
      trends[stat.id] = {
        trend,
        change,
        changeDisplay,
        previousValue: previousSnapshot?.stats.find(s => s.id === stat.id)?.value || null
      };
    });
    
    return trends;
  }

  /**
   * Format change value for display
   */
  formatChange(value, statId) {
    if (statId === 'pipeline') {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value}`;
    }
    return String(Math.round(value));
  }

  /**
   * Save stat history to localStorage and sync to server
   */
  saveStatHistory() {
    try {
      localStorage.setItem('glossi_stat_history', JSON.stringify(this.statHistory));
      this.syncToServer();
      return true;
    } catch (e) {
      console.error('Failed to save stat history:', e);
      return false;
    }
  }

  /**
   * Schedule a save operation (debounced)
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.save(), 1000);
  }

  /**
   * Save all data to localStorage and sync to server
   */
  save() {
    try {
      localStorage.setItem('glossi_data', JSON.stringify(this.data));
      localStorage.setItem('glossi_meetings', JSON.stringify(this.meetings));
      console.log('Data saved to localStorage');
      
      // Sync to server
      this.syncToServer();
      
      return true;
    } catch (e) {
      console.error('Failed to save data:', e);
      return false;
    }
  }

  /**
   * Save settings to localStorage and sync to server
   */
  saveSettings() {
    try {
      localStorage.setItem('glossi_settings', JSON.stringify(this.settings));
      console.log('Settings written to localStorage:', this.settings);
      
      // Sync to server
      this.syncToServer();
      
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  }

  /**
   * Sync all data to server files
   */
  async syncToServer() {
    if (!this.serverAvailable) return;

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: this.data,
          meetings: this.meetings,
          settings: this.settings,
          pipelineHistory: this.pipelineHistory,
          statHistory: this.statHistory
        })
      });

      if (response.ok) {
        console.log('Data synced to server files');
      } else {
        console.warn('Failed to sync to server');
      }
    } catch (e) {
      console.warn('Server sync failed:', e.message);
    }
  }

  /**
   * Export all data as JSON
   */
  exportData() {
    return JSON.stringify({
      data: this.data,
      meetings: this.meetings,
      pipelineHistory: this.pipelineHistory,
      statHistory: this.statHistory,
      settings: { ...this.settings, apiKey: '' }, // Don't export API key
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import data from JSON
   */
  importData(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      
      if (imported.data) {
        this.data = { ...DEFAULT_DATA, ...imported.data };
      }
      
      if (imported.meetings) {
        this.meetings = imported.meetings;
      }

      if (imported.pipelineHistory) {
        this.pipelineHistory = imported.pipelineHistory;
        this.savePipelineHistory();
      }

      if (imported.statHistory) {
        this.statHistory = imported.statHistory;
        this.saveStatHistory();
      }
      
      this.save();
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.data = { ...DEFAULT_DATA };
    this.meetings = [];
    this.save();
    return this.data;
  }
}

// Export singleton instance
export const storage = new Storage();
export default storage;
