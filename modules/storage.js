/**
 * Storage Module
 * Handles file-based persistence for the Glossi Dashboard
 */

// Default data structure - Clean slate ready for rebuild
const DEFAULT_DATA = {
  company: {
    name: 'Glossi',
    tagline: 'AI-powered visuals. Pixel-perfect products.',
    description: 'Generate unlimited product images and videos without ever compromising your brand.',
    demoUrl: 'https://www.youtube.com/watch?v=kXbQqM35iHA'
  },
  stats: [
    { id: 'pipeline', value: '$0', label: 'Pipeline', note: '' },
    { id: 'prospects', value: '0', label: 'Prospects', note: '' },
    { id: 'partnerships', value: '0', label: 'Partnerships', note: '' },
    { id: 'closed', value: '0', label: 'Closed', note: '$0 revenue' }
  ],
  linkSections: [
    { id: 'resources', name: 'Resources', order: 0 },
    { id: 'media', name: 'Media', order: 1 },
    { id: 'documents', name: 'Documents', order: 2 }
  ],
  quickLinks: [
    { id: 'website', name: 'Glossi.io', url: 'https://glossi.io', icon: 'globe', color: 'default', emailEnabled: true, emailLabel: 'Website', section: 'resources', order: 0 },
    { id: 'video', name: 'Pitch Video', url: 'https://www.youtube.com/watch?v=kXbQqM35iHA', icon: 'video', color: 'red', emailEnabled: true, emailLabel: 'Pitch Video', section: 'media', order: 0 },
    { id: 'deck', name: 'Deck', url: 'https://docsend.com/view/sqmwqnjh9zk8pncu', icon: 'document', color: 'blue', emailEnabled: true, emailLabel: 'Deck', section: 'documents', order: 0 },
    { id: 'article', name: 'a16z Article', url: 'https://a16z.com/ai-is-learning-to-build-reality/', icon: 'book', color: 'purple', emailEnabled: true, emailLabel: 'a16z - AI World Models', section: 'media', order: 1 },
    { id: 'link5', name: 'AI Won\'t Kill 3D', url: 'https://www.linkedin.com/pulse/why-ai-wont-kill-3d-jonathan-gitlin-krhyc/', icon: 'globe', color: 'default', emailEnabled: true, emailLabel: 'AI Won\'t Kill 3D', section: 'media', order: 2 }
  ],
  seedRaise: {
    target: '$500K',
    investors: [
      { id: 'inv_1', name: 'Bobby', amount: 'TBD', stage: 'interested', notes: 'advisor?' },
      { id: 'inv_2', name: 'James Trice', amount: '25k', stage: 'interested', notes: '' },
      { id: 'inv_3', name: 'Andrew Riley', amount: 'TBD', stage: 'inTalks', notes: 'Board seat?' },
      { id: 'inv_4', name: 'George K', amount: '25k', stage: 'inTalks', notes: '' },
      { id: 'inv_5', name: 'JG', amount: '25k', stage: 'committed', notes: '' },
      { id: 'inv_6', name: 'Ricky', amount: '100k', stage: 'committed', notes: '' },
      { id: 'inv_7', name: 'Matt Stern', amount: '15k', stage: 'committed', notes: '' },
      { id: 'inv_8', name: 'Josh Stern', amount: '15k', stage: 'committed', notes: '' }
    ]
  },
  pipeline: {},
  pipelineHistory: [],
  lastUpdated: '2026-02-01T00:00:00.000Z'
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  autoSave: true,
  theme: 'dark',
  autoCurate: true,
  staleThresholdWeeks: 4,
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
    this.todos = []; // Independent action items storage
    this.pipelineHistory = [];
    this.statHistory = [];
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
        }
      }
    } catch (e) {
      this.serverAvailable = false;
    }

    // Fallback to localStorage if server data is empty
    // Helper to safely parse JSON from localStorage
    const safeJsonParse = (key, fallback) => {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
      } catch (e) {
        console.warn(`Failed to parse ${key} from localStorage, using default:`, e);
        return fallback;
      }
    };

    if (!this.data) {
      this.data = safeJsonParse('glossi_data', { ...DEFAULT_DATA });
    }
    if (!this.settings) {
      this.settings = safeJsonParse('glossi_settings', { ...DEFAULT_SETTINGS });
    }
    if (!this.meetings || this.meetings.length === 0) {
      this.meetings = safeJsonParse('glossi_meetings', []);
    }
    if (!this.todos || this.todos.length === 0) {
      this.todos = safeJsonParse('glossi_todos', []);
    }
    
    // Migration: Copy todos from meetings to independent storage (one-time)
    if (this.todos.length === 0 && this.meetings && this.meetings.length > 0) {
      const migratedTodos = [];
      this.meetings.forEach(meeting => {
        if (meeting.todos && meeting.todos.length > 0) {
          meeting.todos.forEach(todo => {
            migratedTodos.push({
              id: todo.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              text: todo.text,
              owner: todo.owner || 'Unassigned',
              completed: todo.completed || false,
              createdAt: meeting.date || new Date().toISOString()
            });
          });
        }
      });
      if (migratedTodos.length > 0) {
        this.todos = migratedTodos;
        this.saveTodos();
      }
    }
    if (!this.pipelineHistory || this.pipelineHistory.length === 0) {
      this.pipelineHistory = safeJsonParse('glossi_pipeline_history', []);
    }
    if (!this.statHistory || this.statHistory.length === 0) {
      this.statHistory = safeJsonParse('glossi_stat_history', []);
    }


    // Ensure all required fields exist
    this.data = { ...DEFAULT_DATA, ...this.data };
    this.settings = { ...DEFAULT_SETTINGS, ...this.settings };

    // Migrate: Ensure default quick links exist if none are present
    if (!this.data.quickLinks || this.data.quickLinks.length === 0) {
      this.data.quickLinks = DEFAULT_DATA.quickLinks;
      this.save();
    }

    // Migrate: Ensure link sections exist
    if (!this.data.linkSections || this.data.linkSections.length === 0) {
      this.data.linkSections = DEFAULT_DATA.linkSections;
      this.save();
    }

    // Migrate: Assign sections to existing links that don't have one
    let needsSave = false;
    if (this.data.quickLinks) {
      this.data.quickLinks.forEach((link, index) => {
        if (!link.section) {
          // Auto-assign based on content type
          if (link.icon === 'video' || link.url?.includes('youtube') || link.url?.includes('vimeo')) {
            link.section = 'media';
          } else if (link.icon === 'document' || link.url?.includes('docsend') || link.url?.includes('.pdf')) {
            link.section = 'documents';
          } else {
            link.section = 'resources';
          }
          link.order = index;
          needsSave = true;
        }
        if (link.order === undefined) {
          link.order = index;
          needsSave = true;
        }
      });
      if (needsSave) {
        this.save();
      }
    }

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
   * Get all independent todos
   */
  getAllTodos() {
    return this.todos || [];
  }

  /**
   * Add a new todo
   */
  addTodo(todo) {
    if (!this.todos) this.todos = [];
    const newTodo = {
      id: todo.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: todo.text,
      owner: todo.owner || 'Unassigned',
      completed: todo.completed || false,
      createdAt: new Date().toISOString()
    };
    this.todos.push(newTodo);
    this.saveTodos();
    return newTodo;
  }

  /**
   * Update a todo
   */
  updateTodo(todoId, updates) {
    const todo = this.todos.find(t => t.id === todoId);
    if (todo) {
      Object.assign(todo, updates);
      this.saveTodos();
    }
    return todo;
  }

  /**
   * Delete a todo
   */
  deleteTodo(todoId) {
    const index = this.todos.findIndex(t => t.id === todoId);
    if (index !== -1) {
      this.todos.splice(index, 1);
      this.saveTodos();
      return true;
    }
    return false;
  }

  /**
   * Save todos to localStorage
   */
  saveTodos() {
    try {
      localStorage.setItem('glossi_todos', JSON.stringify(this.todos));
      this.syncToServer();
    } catch (e) {
      console.error('Failed to save todos:', e);
    }
  }

  /**
   * Get todo progress stats
   */
  getTodoProgress() {
    const todos = this.todos || [];
    const completed = todos.filter(t => t.completed).length;
    const total = todos.length;
    return { completed, total };
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
   * Get all scratchpad items (formerly thoughts)
   */
  getScratchpad() {
    return this.data.thoughts || [];
  }

  /**
   * Alias for backwards compatibility
   */
  getThoughts() {
    return this.getScratchpad();
  }

  /**
   * Add a new scratchpad item (preserves all properties including isGrouped, items, suggestedCategory)
   */
  addScratchpadItem(item) {
    if (!this.data.thoughts) {
      this.data.thoughts = [];
    }
    const newItem = {
      ...item,  // Keep all passed properties (isGrouped, items, suggestedCategory, etc.)
      id: 'scratchpad_' + Date.now(),
      type: item.type || 'text',
      createdAt: new Date().toISOString()
    };
    this.data.thoughts.unshift(newItem); // Add to beginning
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newItem;
  }

  /**
   * Alias for backwards compatibility
   */
  addThought(thought) {
    return this.addScratchpadItem(thought);
  }

  /**
   * Update an existing scratchpad item
   */
  updateScratchpadItem(id, updates) {
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
   * Alias for backwards compatibility
   */
  updateThought(id, updates) {
    return this.updateScratchpadItem(id, updates);
  }

  /**
   * Delete a scratchpad item
   */
  deleteScratchpadItem(id) {
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
   * Alias for backwards compatibility
   */
  deleteThought(id) {
    return this.deleteScratchpadItem(id);
  }

  /**
   * Get archived scratchpad items
   */
  getArchivedScratchpad() {
    if (!this.data.archivedScratchpad) {
      this.data.archivedScratchpad = [];
    }
    return this.data.archivedScratchpad;
  }

  /**
   * Archive a scratchpad item (move to archived section)
   */
  archiveScratchpadItem(id) {
    if (!this.data.thoughts) return null;
    const index = this.data.thoughts.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const item = this.data.thoughts[index];
    item.archivedAt = new Date().toISOString();
    item.archivedFrom = 'scratchpad';
    
    if (!this.data.archivedScratchpad) {
      this.data.archivedScratchpad = [];
    }
    this.data.archivedScratchpad.unshift(item);
    this.data.thoughts.splice(index, 1);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return item;
  }

  /**
   * Restore an archived scratchpad item
   */
  restoreArchivedItem(id) {
    if (!this.data.archivedScratchpad) return null;
    const index = this.data.archivedScratchpad.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const item = this.data.archivedScratchpad[index];
    delete item.archivedAt;
    delete item.archivedFrom;
    
    if (!this.data.thoughts) {
      this.data.thoughts = [];
    }
    this.data.thoughts.unshift(item);
    this.data.archivedScratchpad.splice(index, 1);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return item;
  }

  /**
   * Permanently delete an archived item
   */
  deleteArchivedItem(id) {
    if (!this.data.archivedScratchpad) return this.data;
    const index = this.data.archivedScratchpad.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.archivedScratchpad.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get all quotes
   */
  getQuotes() {
    return this.data.quotes || [];
  }

  /**
   * Add a new quote to the library
   */
  addQuote(quote) {
    if (!this.data.quotes) {
      this.data.quotes = [];
    }
    const newQuote = {
      id: 'quote_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      quote: quote.quote,
      source: quote.source,
      context: quote.context || '',
      featured: false,
      addedAt: new Date().toISOString()
    };
    this.data.quotes.unshift(newQuote);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newQuote;
  }

  /**
   * Toggle featured status of a quote (max 3 featured)
   */
  toggleQuoteFeatured(id) {
    if (!this.data.quotes) return null;
    const quote = this.data.quotes.find(q => q.id === id);
    if (!quote) return null;
    
    // If trying to feature, check max limit
    if (!quote.featured) {
      const featuredCount = this.data.quotes.filter(q => q.featured).length;
      if (featuredCount >= 3) {
        return { error: 'Maximum 3 featured quotes allowed' };
      }
    }
    
    quote.featured = !quote.featured;
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return quote;
  }

  /**
   * Delete a quote
   */
  deleteQuote(id) {
    if (!this.data.quotes) return this.data;
    const index = this.data.quotes.findIndex(q => q.id === id);
    if (index !== -1) {
      this.data.quotes.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get featured quotes (max 3)
   */
  getFeaturedQuotes() {
    if (!this.data.quotes) return [];
    return this.data.quotes.filter(q => q.featured).slice(0, 3);
  }

  /**
   * Get all milestones
   */
  getMilestones() {
    return this.data.milestones || [];
  }

  /**
   * Add a new milestone
   */
  addMilestone(milestone) {
    if (!this.data.milestones) {
      this.data.milestones = [];
    }
    const newMilestone = {
      id: 'milestone_' + Date.now(),
      title: milestone.title,
      before: milestone.before,
      after: milestone.after,
      createdAt: new Date().toISOString()
    };
    this.data.milestones.unshift(newMilestone);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newMilestone;
  }

  /**
   * Delete a milestone
   */
  deleteMilestone(id) {
    if (!this.data.milestones) return this.data;
    const index = this.data.milestones.findIndex(m => m.id === id);
    if (index !== -1) {
      this.data.milestones.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Get link sections
   */
  getLinkSections() {
    return (this.data.linkSections || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Add a link section
   */
  addLinkSection(name) {
    if (!this.data.linkSections) {
      this.data.linkSections = [];
    }
    const maxOrder = Math.max(-1, ...this.data.linkSections.map(s => s.order || 0));
    const newSection = {
      id: 'section_' + Date.now(),
      name: name,
      order: maxOrder + 1
    };
    this.data.linkSections.push(newSection);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newSection;
  }

  /**
   * Update a link section
   */
  updateLinkSection(id, updates) {
    const index = this.data.linkSections.findIndex(s => s.id === id);
    if (index >= 0) {
      this.data.linkSections[index] = { ...this.data.linkSections[index], ...updates };
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Delete a link section (moves links to first section)
   */
  deleteLinkSection(id) {
    const sections = this.getLinkSections();
    if (sections.length <= 1) return this.data; // Don't delete last section
    
    const index = this.data.linkSections.findIndex(s => s.id === id);
    if (index >= 0) {
      // Move all links in this section to the first available section
      const firstOtherSection = sections.find(s => s.id !== id);
      if (firstOtherSection && this.data.quickLinks) {
        this.data.quickLinks.forEach(link => {
          if (link.section === id) {
            link.section = firstOtherSection.id;
          }
        });
      }
      this.data.linkSections.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data;
  }

  /**
   * Reorder link sections
   */
  reorderLinkSections(sectionIds) {
    sectionIds.forEach((id, index) => {
      const section = this.data.linkSections.find(s => s.id === id);
      if (section) {
        section.order = index;
      }
    });
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data;
  }

  /**
   * Get quick links
   */
  getQuickLinks() {
    return this.data.quickLinks || [];
  }

  /**
   * Get quick links grouped by section
   */
  getQuickLinksBySection() {
    const links = this.getQuickLinks();
    const sections = this.getLinkSections();
    const grouped = {};
    
    // Initialize all sections
    sections.forEach(section => {
      grouped[section.id] = [];
    });
    
    // Group links by section
    links.forEach(link => {
      const sectionId = link.section || (sections[0]?.id || 'resources');
      if (!grouped[sectionId]) {
        grouped[sectionId] = [];
      }
      grouped[sectionId].push(link);
    });
    
    // Sort links within each section by order
    Object.keys(grouped).forEach(sectionId => {
      grouped[sectionId].sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    
    return grouped;
  }

  /**
   * Add a quick link
   */
  addQuickLink(link) {
    if (!this.data.quickLinks) {
      this.data.quickLinks = [];
    }
    const sections = this.getLinkSections();
    const sectionId = link.section || (sections[0]?.id || 'resources');
    
    // Get max order in target section
    const sectionLinks = this.data.quickLinks.filter(l => l.section === sectionId);
    const maxOrder = Math.max(-1, ...sectionLinks.map(l => l.order || 0));
    
    const newLink = {
      id: 'link_' + Date.now(),
      name: link.name,
      url: link.url,
      icon: link.icon || 'link',
      color: link.color || 'default',
      emailEnabled: link.emailEnabled !== false,
      emailLabel: link.emailLabel || link.name,
      section: sectionId,
      order: maxOrder + 1
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
   * Reorder links within and across sections
   */
  reorderLinks(linkId, targetSectionId, newOrder) {
    const link = this.data.quickLinks.find(l => l.id === linkId);
    if (!link) return this.data;
    
    const oldSection = link.section;
    link.section = targetSectionId;
    link.order = newOrder;
    
    // Reorder other links in target section
    const sectionLinks = this.data.quickLinks
      .filter(l => l.section === targetSectionId && l.id !== linkId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    sectionLinks.forEach((l, idx) => {
      if (idx >= newOrder) {
        l.order = idx + 1;
      } else {
        l.order = idx;
      }
    });
    
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
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

  // =====================================================
  // PIPELINE EMAIL FUNCTIONS
  // =====================================================

  /**
   * Get pipeline email content
   */
  getPipelineEmail() {
    return this.data.pipelineEmail || null;
  }

  /**
   * Update pipeline email content with history tracking
   */
  updatePipelineEmail(pipelineData, previousData = null) {
    // Initialize history array if needed
    if (!this.data.pipelineHistory) {
      this.data.pipelineHistory = [];
    }
    
    // Save previous data to history (if it exists and has deals)
    if (previousData && previousData.deals && previousData.deals.length > 0) {
      this.data.pipelineHistory.unshift({
        deals: previousData.deals,
        highlights: previousData.highlights,
        updatedAt: previousData.updatedAt
      });
      
      // Keep only last 52 weeks of history
      if (this.data.pipelineHistory.length > 52) {
        this.data.pipelineHistory = this.data.pipelineHistory.slice(0, 52);
      }
    }
    
    // Update current data
    this.data.pipelineEmail = {
      ...pipelineData,
      updatedAt: pipelineData.updatedAt || new Date().toISOString()
    };
    
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data.pipelineEmail;
  }

  // =====================================================
  // KNOWLEDGE BASE FUNCTIONS
  // =====================================================

  /**
   * Get Knowledge Base data
   */
  getKnowledgeBase() {
    if (!this.data.knowledgeBase) {
      this.data.knowledgeBase = {
        sources: [],
        conversations: [],
        reports: []
      };
    }
    return this.data.knowledgeBase;
  }

  /**
   * Update Knowledge Base data
   */
  updateKnowledgeBase(updates) {
    if (!this.data.knowledgeBase) {
      this.data.knowledgeBase = {
        sources: [],
        conversations: [],
        reports: []
      };
    }
    this.data.knowledgeBase = {
      ...this.data.knowledgeBase,
      ...updates
    };
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.data.knowledgeBase;
  }

  /**
   * Add a source to Knowledge Base
   */
  addKBSource(source) {
    const kb = this.getKnowledgeBase();
    const newSource = {
      ...source,
      id: source.id || 'src_' + Date.now(),
      addedAt: source.addedAt || new Date().toISOString(),
      freshness: source.freshness || 'current'
    };
    kb.sources.push(newSource);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newSource;
  }

  /**
   * Update a Knowledge Base source
   */
  updateKBSource(sourceId, updates) {
    const kb = this.getKnowledgeBase();
    const index = kb.sources.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      kb.sources[index] = { ...kb.sources[index], ...updates };
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      return kb.sources[index];
    }
    return null;
  }

  /**
   * Delete a Knowledge Base source
   */
  deleteKBSource(sourceId) {
    const kb = this.getKnowledgeBase();
    const index = kb.sources.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      kb.sources.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data.knowledgeBase;
  }

  /**
   * Add a report to Knowledge Base
   */
  addKBReport(report) {
    const kb = this.getKnowledgeBase();
    const newReport = {
      ...report,
      id: report.id || 'rpt_' + Date.now(),
      createdAt: report.createdAt || new Date().toISOString()
    };
    kb.reports.push(newReport);
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newReport;
  }

  /**
   * Delete a Knowledge Base report
   */
  deleteKBReport(reportId) {
    const kb = this.getKnowledgeBase();
    const index = kb.reports.findIndex(r => r.id === reportId);
    if (index !== -1) {
      kb.reports.splice(index, 1);
      this.data.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return this.data.knowledgeBase;
  }

  /**
   * Update settings
   */
  updateSettings(updates) {
    this.settings = {
      ...this.settings,
      ...updates
    };
    const saved = this.saveSettings();
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
    } else {
      this.meetings.push(meetingData);
    }


    // Save immediately for meetings (no debounce)
    const saved = this.save();
    
    // Verify it was saved
    const verify = localStorage.getItem('glossi_meetings');
    
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
   * Add a pipeline deal
   */
  addPipelineDeal(deal) {
    const category = deal.category || 'inProgress';
    if (!this.data.pipeline[category]) {
      this.data.pipeline[category] = [];
    }
    
    const newDeal = {
      name: deal.name,
      value: deal.value || '',
      stage: deal.stage || 'discovery',
      timing: deal.timing || '',
      note: deal.note || '',
      sourceFile: deal.sourceFile || null
    };
    
    // Check if deal already exists
    const existing = this.data.pipeline[category].findIndex(d => d.name === deal.name);
    if (existing >= 0) {
      // Update existing
      this.data.pipeline[category][existing] = { ...this.data.pipeline[category][existing], ...newDeal };
    } else {
      this.data.pipeline[category].push(newDeal);
    }
    
    // Update total pipeline value
    this.recalculatePipelineTotal();
    
    this.data.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newDeal;
  }

  /**
   * Delete a pipeline deal
   */
  deletePipelineDeal(name, category) {
    if (!category) {
      // Find which category it's in
      for (const cat of ['closestToClose', 'inProgress', 'partnerships', 'closed']) {
        if (this.data.pipeline[cat]) {
          const idx = this.data.pipeline[cat].findIndex(d => d.name === name);
          if (idx >= 0) {
            category = cat;
            break;
          }
        }
      }
    }
    
    if (category && this.data.pipeline[category]) {
      const idx = this.data.pipeline[category].findIndex(d => d.name === name);
      if (idx >= 0) {
        this.data.pipeline[category].splice(idx, 1);
        this.recalculatePipelineTotal();
        this.data.lastUpdated = new Date().toISOString();
        this.scheduleSave();
      }
    }
    return this.data;
  }

  /**
   * Recalculate pipeline total value
   */
  recalculatePipelineTotal() {
    const clients = this.getAllPipelineClients();
    let total = 0;
    
    clients.forEach(c => {
      if (c.value) {
        // Parse value like "$50K", "$1.2M", "$100K+"
        const match = c.value.match(/\$?([\d.]+)\s*(K|M)?/i);
        if (match) {
          let num = parseFloat(match[1]);
          if (match[2]?.toUpperCase() === 'M') num *= 1000000;
          else if (match[2]?.toUpperCase() === 'K') num *= 1000;
          total += num;
        }
      }
    });
    
    // Format total
    if (total >= 1000000) {
      this.data.pipeline.totalValue = `$${(total / 1000000).toFixed(1)}M+`;
    } else if (total >= 1000) {
      this.data.pipeline.totalValue = `$${Math.round(total / 1000)}K+`;
    } else {
      this.data.pipeline.totalValue = `$${total}`;
    }
    
    // Also update stats
    const pipelineStat = this.data.stats.find(s => s.id === 'pipeline');
    if (pipelineStat) {
      pipelineStat.value = this.data.pipeline.totalValue;
    }
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
      localStorage.setItem('glossi_todos', JSON.stringify(this.todos));
      
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

// Export class and singleton instance
export { Storage };
export const storage = new Storage();
export default storage;
