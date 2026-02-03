/**
 * Knowledge Base Module
 * Handles source management, AI chat, and report generation
 */

class KnowledgeBase {
  constructor() {
    this.sources = [];
    this.conversations = [];
    this.reports = [];
    this.currentConversation = null;
    this.selectedFile = null;
    this.selectedSourceType = 'text';
    this.selectedCategory = 'auto';
    this.selectedTemplate = 'custom';
    this.aiProcessor = null;
    this.storage = null;
    this.onUpdate = null;
    // Report generation state
    this.reportStep = 1;
    this.reportPrompt = '';
    this.reportAnswers = {};
    this.reportQuestions = [];
    // Folder state
    this.expandedFolders = {};
    this.folders = [];
    this.dashboardExpanded = true;
    this.isDraggingSource = false;
    this.quickLinksExpanded = false;
    this.enabledQuickLinks = {};
    this.quickLinkContent = {};
    this.fetchingLinks = new Set();
    // Dashboard data sources (live data from main app)
    this.dashboardSources = {
      weekAtGlance: { enabled: true, title: 'Week at a Glance', icon: 'calendar' },
      seedRaise: { enabled: true, title: 'Seed Raise', icon: 'trending-up' },
      pipeline: { enabled: true, title: 'Pipeline', icon: 'bar-chart' },
      meetings: { enabled: true, title: 'Meetings', icon: 'users' },
      quickLinks: { title: 'Quick Links', icon: 'link', expandable: true }
    };
  }

  /**
   * Initialize the Knowledge Base
   */
  init(storage, aiProcessor, onUpdate) {
    this.storage = storage;
    this.aiProcessor = aiProcessor;
    this.onUpdate = onUpdate;
    
    // Load data from storage
    this.loadData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Render initial state
    this.render();
    
    // Auto-fetch content for enabled quick links that don't have cached content
    setTimeout(() => this.fetchMissingQuickLinkContent(), 1000);
  }

  /**
   * Load data from storage
   */
  loadData() {
    const kbData = this.storage.getKnowledgeBase();
    this.sources = kbData.sources || [];
    this.conversations = kbData.conversations || [];
    this.reports = kbData.reports || [];
    this.folders = kbData.folders || [];
    
    // Load dashboard source preferences
    if (kbData.dashboardSources) {
      Object.keys(kbData.dashboardSources).forEach(key => {
        if (this.dashboardSources[key]) {
          this.dashboardSources[key].enabled = kbData.dashboardSources[key].enabled;
        }
      });
    }
    
    // Load enabled quick links state
    if (kbData.enabledQuickLinks) {
      this.enabledQuickLinks = kbData.enabledQuickLinks;
    }
    
    // Load cached quick link content
    if (kbData.quickLinkContent) {
      this.quickLinkContent = kbData.quickLinkContent;
    }
    
    // Create a new conversation if none exists
    if (this.conversations.length === 0) {
      this.currentConversation = this.createConversation();
    } else {
      this.currentConversation = this.conversations[this.conversations.length - 1];
    }
  }

  /**
   * Save data to storage
   */
  saveData() {
    // Save dashboard source preferences (just enabled state)
    const dashboardSourcePrefs = {};
    Object.keys(this.dashboardSources).forEach(key => {
      dashboardSourcePrefs[key] = { enabled: this.dashboardSources[key].enabled };
    });
    
    this.storage.updateKnowledgeBase({
      sources: this.sources,
      conversations: this.conversations,
      reports: this.reports,
      folders: this.folders,
      dashboardSources: dashboardSourcePrefs,
      enabledQuickLinks: this.enabledQuickLinks,
      quickLinkContent: this.quickLinkContent
    });
  }

  /**
   * Fetch and cache content for a quick link
   */
  async fetchQuickLinkContent(linkId) {
    const quickLinks = this.storage.getQuickLinks();
    const link = quickLinks.find(l => l.id === linkId);
    if (!link || !link.url) return;
    
    // Skip if already fetching
    if (this.fetchingLinks.has(linkId)) return;
    
    this.fetchingLinks.add(linkId);
    this.renderSources(); // Update UI to show fetching state
    
    try {
      const result = await this.fetchUrl(link.url);
      this.quickLinkContent[linkId] = {
        content: result.content,
        title: result.title || link.name,
        fetchedAt: new Date().toISOString(),
        url: link.url
      };
      this.saveData();
    } catch (error) {
      // Silently fail - content will be missing but link still works
    } finally {
      this.fetchingLinks.delete(linkId);
      this.renderSources();
    }
  }

  /**
   * Refresh all enabled quick link content
   */
  async refreshAllQuickLinks() {
    const quickLinks = this.storage.getQuickLinks();
    const enabledLinks = quickLinks.filter(l => this.enabledQuickLinks[l.id] !== false);
    
    for (const link of enabledLinks) {
      await this.fetchQuickLinkContent(link.id);
    }
  }

  /**
   * Fetch content for enabled links that don't have cached content
   */
  async fetchMissingQuickLinkContent() {
    const quickLinks = this.storage.getQuickLinks();
    const enabledLinks = quickLinks.filter(l => this.enabledQuickLinks[l.id] !== false);
    
    for (const link of enabledLinks) {
      if (!this.quickLinkContent[link.id]) {
        await this.fetchQuickLinkContent(link.id);
      }
    }
  }

  /**
   * Create a new conversation
   */
  createConversation() {
    const conversation = {
      id: 'conv_' + Date.now(),
      messages: [],
      createdAt: new Date().toISOString()
    };
    this.conversations.push(conversation);
    this.saveData();
    return conversation;
  }

  /**
   * Clear the current chat
   */
  clearChat() {
    if (!this.currentConversation || this.currentConversation.messages.length === 0) {
      return;
    }
    
    if (!confirm('Clear chat history? This cannot be undone.')) {
      return;
    }
    
    this.currentConversation.messages = [];
    this.saveData();
    this.renderMessages();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Toggle sidebar
    const toggleSidebar = document.getElementById('kb-toggle-sidebar');
    if (toggleSidebar) {
      toggleSidebar.addEventListener('click', () => {
        document.getElementById('kb-sources-sidebar')?.classList.toggle('collapsed');
      });
    }

    // Toggle all sources on/off
    const toggleAllBtn = document.getElementById('kb-toggle-all-btn');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => this.toggleAllSources());
    }

    // Create folder button
    const createFolderBtn = document.getElementById('kb-create-folder-btn');
    if (createFolderBtn) {
      createFolderBtn.addEventListener('click', () => this.createFolder());
    }

    // Sources drop zone
    const dropZone = document.getElementById('kb-sources-list');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only show drag-over for external files, not internal source moves
        if (!this.isDraggingSource) {
          dropZone.classList.add('drag-over');
        }
      });
      
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dropZone.contains(e.relatedTarget)) {
          dropZone.classList.remove('drag-over');
        }
      });
      
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        // Handle internal source moves - drop outside folder = ungrouped
        if (this.isDraggingSource) {
          const sourceId = e.dataTransfer.getData('text/plain');
          // Only move to ungrouped if not dropped on a folder header
          if (sourceId && !e.target.closest('.kb-folder-header')) {
            const source = this.sources.find(s => s.id === sourceId);
            if (source && source.folder) {
              this.moveSourceToFolder(sourceId, null);
            }
          }
          return;
        }
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          for (const file of files) {
            await this.handleDroppedFile(file);
          }
        }
      });
    }

    // Toggle reports panel
    const toggleReports = document.getElementById('kb-toggle-reports');
    if (toggleReports) {
      toggleReports.addEventListener('click', () => {
        document.getElementById('kb-reports-panel')?.classList.toggle('collapsed');
      });
    }

    // Add source button
    const addSourceBtn = document.getElementById('kb-add-source-btn');
    if (addSourceBtn) {
      addSourceBtn.addEventListener('click', () => this.showSourceModal());
    }

    // Source modal close/cancel
    const sourceModalClose = document.getElementById('kb-source-modal-close');
    if (sourceModalClose) {
      sourceModalClose.addEventListener('click', () => this.hideModal('kb-source-modal'));
    }
    const sourceCancel = document.getElementById('kb-source-cancel');
    if (sourceCancel) {
      sourceCancel.addEventListener('click', () => this.hideModal('kb-source-modal'));
    }

    // Source modal save
    const sourceSave = document.getElementById('kb-source-save');
    if (sourceSave) {
      sourceSave.addEventListener('click', () => this.addSource());
    }

    // Quick actions
    document.querySelectorAll('.kb-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.closest('.kb-action-btn').dataset.action;
        this.handleQuickAction(action);
      });
    });

    // Report modal
    const reportModalClose = document.getElementById('kb-report-modal-close');
    if (reportModalClose) {
      reportModalClose.addEventListener('click', () => this.hideModal('kb-report-modal'));
    }
    const reportCancel = document.getElementById('kb-report-cancel');
    if (reportCancel) {
      reportCancel.addEventListener('click', () => this.hideModal('kb-report-modal'));
    }
    const reportGenerate = document.getElementById('kb-report-generate');
    if (reportGenerate) {
      reportGenerate.addEventListener('click', () => this.generateReport());
    }

    // Report continue button (step 1 -> evaluate)
    const reportContinue = document.getElementById('kb-report-continue');
    if (reportContinue) {
      reportContinue.addEventListener('click', () => this.evaluateReportPrompt());
    }

    // Report back button
    const reportBack = document.getElementById('kb-report-back');
    if (reportBack) {
      reportBack.addEventListener('click', () => this.goBackReportStep());
    }

    // Chat input
    const chatInput = document.getElementById('kb-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
      });
    }

    // Send button
    const sendBtn = document.getElementById('kb-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Clear chat button
    const clearBtn = document.getElementById('kb-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearChat());
    }

    // Modal overlay clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideModal(overlay.id);
        }
      });
    });
  }

  /**
   * Switch source modal tab
   */
  switchSourceTab(type) {
    this.selectedSourceType = type;
    
    // Update tabs
    document.querySelectorAll('.kb-source-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === type);
    });
    
    // Update panels
    document.querySelectorAll('.kb-source-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `kb-panel-${type}`);
    });
  }

  /**
   * Show source modal
   */
  showSourceModal() {
    const textInput = document.getElementById('kb-source-text');
    if (textInput) textInput.value = '';
    this.showModal('kb-source-modal');
  }

  /**
   * Handle a dropped file
   */
  async handleDroppedFile(file) {
    const textExtensions = ['.txt', '.md', '.csv', '.json'];
    const pdfExtensions = ['.pdf'];
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isText = textExtensions.includes(ext);
    const isPdf = pdfExtensions.includes(ext);
    const isAudio = audioExtensions.includes(ext);
    const isImage = imageExtensions.includes(ext);
    
    if (!isText && !isPdf && !isAudio && !isImage) {
      return;
    }
    
    // Create placeholder source immediately (optimistic UI)
    const sourceId = 'src_' + Date.now();
    const title = file.name.replace(/\.[^/.]+$/, '');
    const placeholderSource = {
      id: sourceId,
      type: isAudio ? 'audio' : isPdf ? 'pdf' : isImage ? 'image' : 'file',
      title,
      content: '',
      category: 'other',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      },
      createdAt: new Date().toISOString(),
      processing: true,
      progress: 0
    };
    
    this.sources.push(placeholderSource);
    this.renderSources();
    
    // Start progress animation
    const progressInterval = this.startProgressAnimation(sourceId, isAudio ? 30000 : isPdf ? 10000 : isImage ? 15000 : 2000);
    
    try {
      let content = '';
      let metadata = { ...placeholderSource.metadata };
      let type = 'file';
      
      if (isText) {
        // Read text files directly
        content = await file.text();
        
      } else if (isPdf) {
        // Send to server for PDF extraction
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/process-pdf', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'PDF processing failed');
        }
        
        content = result.content;
        metadata.pageCount = result.pageCount;
        type = 'pdf';
        
      } else if (isAudio) {
        // Send to server for Whisper transcription
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Transcription failed');
        }
        
        content = result.transcript;
        metadata.duration = result.duration;
        type = 'audio';
        
      } else if (isImage) {
        // Convert image to base64 and analyze with Claude vision
        const base64 = await this.fileToBase64(file);
        const mediaType = file.type || 'image/png';
        
        if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
          throw new Error('AI not configured. Please add your API key in settings.');
        }
        
        // Use Claude vision to extract text and describe the image
        const visionPrompt = `Analyze this image thoroughly. Extract ALL text visible in the image (OCR). Then provide a detailed description of what the image contains. Format your response as:

TEXT CONTENT:
[All text found in the image, preserving structure]

DESCRIPTION:
[Detailed description of the image contents, charts, diagrams, etc.]

KEY INFORMATION:
[Bullet points of key facts, data, or insights from the image]`;

        const visionResponse = await this.aiProcessor.analyzeImageWithVision(base64, mediaType, visionPrompt);
        
        if (visionResponse) {
          content = visionResponse;
          metadata.imageWidth = null;
          metadata.imageHeight = null;
          type = 'image';
        } else {
          throw new Error('Failed to analyze image');
        }
      }
      
      // Stop progress animation
      clearInterval(progressInterval);
      
      // Determine category using AI
      let category = 'other';
      if (this.aiProcessor && this.aiProcessor.isConfigured() && content) {
        category = await this.categorizeSource(content.substring(0, 1000));
      }
      
      // Update the source with actual content
      const source = this.sources.find(s => s.id === sourceId);
      if (source) {
        source.type = type;
        source.content = content.substring(0, 500000);
        source.category = category;
        source.metadata = { ...metadata, contentLength: content.length };
        source.processing = false;
        source.progress = 100;
        delete source.processing;
        delete source.progress;
      }
      
      this.saveData();
      this.renderSources();
      
    } catch (error) {
      // Stop progress animation
      clearInterval(progressInterval);
      
      // Remove failed source
      this.sources = this.sources.filter(s => s.id !== sourceId);
      this.renderSources();
    }
  }
  
  /**
   * Start progress animation for a processing source
   */
  startProgressAnimation(sourceId, estimatedTime) {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(95, (elapsed / estimatedTime) * 100);
      
      const source = this.sources.find(s => s.id === sourceId);
      if (source && source.processing) {
        source.progress = progress;
        // Update just the progress bar element
        const progressBar = document.querySelector(`.kb-source-progress-fill[data-id="${sourceId}"]`);
        if (progressBar) {
          progressBar.style.width = `${progress}%`;
        }
      } else {
        clearInterval(interval);
      }
    }, 100);
    
    return interval;
  }

  /**
   * Add a new source from text
   */
  async addSource() {
    const content = document.getElementById('kb-source-text')?.value?.trim() || '';
    
    if (!content) {
      return;
    }
    
    // Generate title from AI or fallback
    let title = '';
    if (this.aiProcessor && this.aiProcessor.isConfigured()) {
      try {
        const response = await this.aiProcessor.chat(
          'Generate a brief, descriptive title (max 6 words) for this text. Return ONLY the title, no quotes or explanation.',
          content.substring(0, 1000)
        );
        title = response.trim().replace(/^["']|["']$/g, '');
        if (title.length > 60) {
          title = title.substring(0, 57) + '...';
        }
      } catch (e) {
        title = content.split('\n')[0].substring(0, 50) || 'Untitled';
      }
    } else {
      title = content.split('\n')[0].substring(0, 50) || 'Untitled';
    }
    
    // Create source object
    const source = {
      id: 'src_' + Date.now(),
      type: 'text',
      title,
      content,
      category: 'other',
      tags: [],
      addedAt: new Date().toISOString(),
      freshness: 'current',
      metadata: {}
    };
    
    this.sources.push(source);
    this.saveData();
    this.render();
    this.hideModal('kb-source-modal');
    this.clearSourceModal();
    
    if (this.onUpdate) this.onUpdate();
  }

  /**
   * Fetch URL content via server proxy
   */
  async fetchUrl(url) {
    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch URL');
      }
      
      return {
        title: result.title,
        content: result.content
      };
    } catch (error) {
      // Fallback to URL reference if server fetch fails
      const urlObj = new URL(url);
      return {
        title: urlObj.hostname,
        content: `[URL: ${url}]\n\nNote: Could not fetch content. Error: ${error.message}`
      };
    }
  }

  /**
   * Categorize source using AI
   */
  async categorizeSource(content) {
    if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
      return 'other';
    }
    
    try {
      const prompt = `Categorize the following content into one of these categories: market, customer, competitor, product, other.
      
Content:
${content.substring(0, 1000)}

Respond with ONLY the category name (lowercase).`;
      
      const response = await this.aiProcessor.sendMessage(prompt);
      const category = response.toLowerCase().trim();
      
      if (['market', 'customer', 'competitor', 'product', 'other'].includes(category)) {
        return category;
      }
      return 'other';
    } catch (error) {
      return 'other';
    }
  }

  /**
   * Clear source modal
   */
  clearSourceModal() {
    const titleEl = document.getElementById('kb-source-title');
    const textEl = document.getElementById('kb-source-text');
    const urlEl = document.getElementById('kb-source-url');
    if (titleEl) titleEl.value = '';
    if (textEl) textEl.value = '';
    if (urlEl) urlEl.value = '';
    this.selectedCategory = 'auto';
    document.querySelectorAll('.kb-category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === 'auto');
    });
  }

  /**
   * Handle quick action
   */
  handleQuickAction(action) {
    if (action === 'generate') {
      this.showReportModal();
      return;
    }
    
    if (this.sources.length === 0) {
      return;
    }
    
    const prompts = {
      summarize: 'Summarize all the sources, highlighting the most important insights and key takeaways.',
      quotes: 'Extract the most compelling quotes and key statements from the sources that would be useful for investor conversations.',
      changes: 'Based on the source dates and content, what are the most recent changes or updates? What information might be outdated?'
    };
    
    if (prompts[action]) {
      this.sendMessage(prompts[action]);
    }
  }

  /**
   * Send a chat message
   */
  async sendMessage(overrideMessage = null) {
    const input = document.getElementById('kb-chat-input');
    const message = overrideMessage || input?.value?.trim() || '';
    
    if (!message) return;
    
    if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
      return;
    }
    
    // Clear input
    if (!overrideMessage && input) {
      input.value = '';
      input.style.height = 'auto';
    }
    
    // Add user message
    this.currentConversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    this.renderMessages();
    
    // Show loading
    this.showTypingIndicator();
    
    try {
      // Build context from sources
      const context = this.buildSourceContext();
      
      const systemPrompt = `You are an AI assistant for Glossi's investor knowledge base.

SOURCES:
${context}

FORMATTING RULES:
- Use numbered sections for major topics (1. Topic Name)
- Use - for bullet points under each section
- Bold sparingly: only the first key term per bullet, not entire sentences
- Keep bullets concise (1-2 lines max)
- Add source citation at end of bullet: [Source: title]
- No excessive formatting or emphasis
- Be direct and scannable

CONTENT RULES:
- Answer based ONLY on the provided sources
- If information is not in sources, say so clearly
- Prioritize recent and relevant information`;

      const response = await this.aiProcessor.chat(systemPrompt, message);
      
      // Add assistant message
      this.currentConversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      });
      
      this.saveData();
    } catch (error) {
      this.currentConversation.messages.push({
        role: 'assistant',
        content: 'Sorry, I encountered an error: ' + error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    this.hideTypingIndicator();
    this.renderMessages();
  }

  /**
   * Build context from sources
   */
  buildSourceContext() {
    const contextParts = [];
    
    // Add enabled dashboard sources (live data)
    const dashboardContext = this.buildDashboardContext();
    if (dashboardContext) {
      contextParts.push(dashboardContext);
    }
    
    // Add enabled file sources
    const enabledSources = this.sources.filter(s => s.enabled !== false);
    
    if (enabledSources.length > 0) {
      const fileContext = enabledSources.map(source => {
        const freshnessLabel = {
          current: 'Current',
          review: 'Needs Review',
          outdated: 'Outdated'
        }[source.freshness] || 'Unknown';
        
        return `--- Source: ${source.title} ---
Category: ${source.category}
Added: ${new Date(source.addedAt || source.createdAt).toLocaleDateString()}
Status: ${freshnessLabel}
Content:
${source.content}
---`;
      }).join('\n\n');
      
      contextParts.push(fileContext);
    }
    
    if (contextParts.length === 0) {
      return 'No sources available.';
    }
    
    return contextParts.join('\n\n');
  }
  
  /**
   * Build context from dashboard data (live)
   */
  buildDashboardContext() {
    const parts = [];
    
    // Week at a Glance
    if (this.dashboardSources.weekAtGlance.enabled) {
      const weekData = this.getWeekAtGlanceData();
      if (weekData) {
        parts.push(`--- Dashboard Source: Week at a Glance (Live) ---
${weekData}
---`);
      }
    }
    
    // Seed Raise
    if (this.dashboardSources.seedRaise.enabled) {
      const seedData = this.getSeedRaiseData();
      if (seedData) {
        parts.push(`--- Dashboard Source: Seed Raise (Live) ---
${seedData}
---`);
      }
    }
    
    // Pipeline
    if (this.dashboardSources.pipeline.enabled) {
      const pipelineData = this.getPipelineData();
      if (pipelineData) {
        parts.push(`--- Dashboard Source: Pipeline (Live) ---
${pipelineData}
---`);
      }
    }
    
    // Meetings
    if (this.dashboardSources.meetings.enabled) {
      const meetingsData = this.getMeetingsData();
      if (meetingsData) {
        parts.push(`--- Dashboard Source: Meetings (Live) ---
${meetingsData}
---`);
      }
    }
    
    // Quick Links (uses individual link toggles)
    const linksData = this.getQuickLinksData();
    if (linksData) {
      parts.push(`--- Dashboard Source: Quick Links (Live) ---
${linksData}
---`);
    }
    
    return parts.join('\n\n');
  }
  
  /**
   * Get Week at a Glance data from storage
   */
  getWeekAtGlanceData() {
    const data = this.storage.getData();
    if (!data) return null;
    
    const lines = [];
    
    // Company info
    if (data.company) {
      lines.push(`Company: ${data.company.name}`);
      lines.push(`Tagline: ${data.company.tagline}`);
    }
    
    // Stats
    if (data.stats && data.stats.length > 0) {
      lines.push('\nKey Metrics:');
      data.stats.forEach(stat => {
        lines.push(`- ${stat.label}: ${stat.value}${stat.note ? ' (' + stat.note + ')' : ''}`);
      });
    }
    
    // Week summary (if exists in meetings or elsewhere)
    const meetings = this.storage.getMeetings();
    if (meetings && meetings.length > 0) {
      const latestMeeting = meetings[meetings.length - 1];
      if (latestMeeting.summary) {
        lines.push('\nLatest Summary:');
        lines.push(latestMeeting.summary);
      }
      if (latestMeeting.keyDecisions && latestMeeting.keyDecisions.length > 0) {
        lines.push('\nKey Decisions:');
        latestMeeting.keyDecisions.forEach(d => lines.push(`- ${d}`));
      }
      if (latestMeeting.actionItems && latestMeeting.actionItems.length > 0) {
        lines.push('\nAction Items:');
        latestMeeting.actionItems.forEach(a => lines.push(`- ${a.text || a}`));
      }
    }
    
    return lines.length > 0 ? lines.join('\n') : null;
  }
  
  /**
   * Get Seed Raise data from storage
   */
  getSeedRaiseData() {
    const data = this.storage.getData();
    if (!data || !data.seedRaise) return null;
    
    const lines = [];
    const seedRaise = data.seedRaise;
    
    lines.push(`Target: ${seedRaise.target || 'TBD'}`);
    
    // Calculate totals by stage
    const investors = seedRaise.investors || [];
    const stages = { interested: [], inTalks: [], committed: [], closed: [] };
    let totalCommitted = 0;
    
    investors.forEach(inv => {
      if (stages[inv.stage]) {
        stages[inv.stage].push(inv);
      }
      if (inv.stage === 'committed' || inv.stage === 'closed') {
        const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, '') || 0);
        if (!isNaN(amount)) {
          totalCommitted += amount * (inv.amount?.toLowerCase().includes('k') ? 1000 : 1);
        }
      }
    });
    
    lines.push(`Total Committed: $${(totalCommitted / 1000).toFixed(0)}K`);
    lines.push('');
    
    // List by stage
    Object.entries(stages).forEach(([stage, invs]) => {
      if (invs.length > 0) {
        lines.push(`${stage.charAt(0).toUpperCase() + stage.slice(1)} (${invs.length}):`);
        invs.forEach(inv => {
          lines.push(`  - ${inv.name}: ${inv.amount || 'TBD'}${inv.notes ? ' - ' + inv.notes : ''}`);
        });
      }
    });
    
    return lines.join('\n');
  }
  
  /**
   * Get Pipeline data from storage
   */
  getPipelineData() {
    const lines = [];
    
    // Primary source: Current pipeline email data (this is where the main pipeline data lives)
    const pipelineEmail = this.storage.getPipelineEmail?.() || this.storage.getData()?.pipelineEmail;
    
    if (pipelineEmail) {
      // Get update date
      if (pipelineEmail.updatedAt) {
        lines.push(`Pipeline Data (as of ${new Date(pipelineEmail.updatedAt).toLocaleDateString()}):`);
      } else {
        lines.push('Current Pipeline:');
      }
      
      // Calculate total from deals
      const deals = pipelineEmail.deals || [];
      let totalPipeline = 0;
      const stageBreakdown = {};
      
      deals.forEach(deal => {
        const value = this.parseMoneyValue(deal.value || deal.amount || '0');
        totalPipeline += value;
        const stage = deal.stage || 'unknown';
        if (!stageBreakdown[stage]) {
          stageBreakdown[stage] = { total: 0, count: 0, deals: [] };
        }
        stageBreakdown[stage].total += value;
        stageBreakdown[stage].count++;
        stageBreakdown[stage].deals.push(deal);
      });
      
      lines.push(`Total Pipeline: $${(totalPipeline / 1000).toFixed(0)}K`);
      lines.push('');
      
      // Stage breakdown
      if (Object.keys(stageBreakdown).length > 0) {
        lines.push('Pipeline by Stage:');
        Object.entries(stageBreakdown).forEach(([stage, data]) => {
          lines.push(`- ${stage.charAt(0).toUpperCase() + stage.slice(1)}: $${(data.total / 1000).toFixed(0)}K (${data.count} deals)`);
        });
      }
      
      // All deals
      if (deals.length > 0) {
        lines.push('\nAll Active Deals:');
        deals.forEach(deal => {
          const name = deal.name || deal.company || 'Unknown';
          const value = deal.value || deal.amount || 'TBD';
          const stage = deal.stage || 'unknown';
          const timing = deal.timing ? ` - Timing: ${deal.timing}` : '';
          const nextSteps = deal.nextSteps ? ` - Next: ${deal.nextSteps}` : '';
          lines.push(`- ${name}: ${value} (${stage})${timing}${nextSteps}`);
        });
      }
      
      // Highlights section
      const highlights = pipelineEmail.highlights || {};
      
      // Hot deals
      if (highlights.hotDeals && highlights.hotDeals.length > 0) {
        lines.push('\nHot Deals (Closest to Close):');
        highlights.hotDeals.forEach(item => {
          if (typeof item === 'string') {
            lines.push(`- ${item}`);
          } else {
            lines.push(`- ${item.name || item.company}: ${item.value || item.amount || ''}${item.notes ? ' - ' + item.notes : ''}`);
          }
        });
      }
      
      // Key updates
      if (highlights.keyUpdates && highlights.keyUpdates.length > 0) {
        lines.push('\nKey Updates:');
        highlights.keyUpdates.forEach(update => lines.push(`- ${update}`));
      }
      
      // Marketing
      if (highlights.marketing && highlights.marketing.length > 0) {
        lines.push('\nMarketing Updates:');
        highlights.marketing.forEach(item => lines.push(`- ${item}`));
      }
    }
    
    // Secondary source: Pipeline history (for historical context)
    const history = this.storage.getPipelineHistory?.() || [];
    if (history && history.length > 0 && lines.length === 0) {
      const latest = history[0];
      if (latest.deals && latest.deals.length > 0) {
        lines.push('Historical Pipeline Data:');
        latest.deals.forEach(deal => {
          const name = deal.name || deal.company || 'Unknown';
          const value = deal.value || deal.amount || 'TBD';
          lines.push(`- ${name}: ${value} (${deal.stage || 'unknown'})`);
        });
      }
    }
    
    // Fallback: Basic stats
    if (lines.length === 0) {
      const data = this.storage.getData();
      if (data && data.stats) {
        const pipelineStat = data.stats.find(s => s.id === 'pipeline' || s.label?.toLowerCase().includes('pipeline'));
        if (pipelineStat && pipelineStat.value) {
          lines.push(`Pipeline Value: ${pipelineStat.value}`);
        }
      }
    }
    
    return lines.length > 0 ? lines.join('\n') : null;
  }
  
  /**
   * Parse money value string to number
   */
  parseMoneyValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const str = String(value).replace(/[^0-9.kKmM]/g, '');
    let num = parseFloat(str) || 0;
    if (/[kK]/.test(value)) num *= 1000;
    if (/[mM]/.test(value)) num *= 1000000;
    return num;
  }
  
  /**
   * Get Meetings data from storage
   */
  getMeetingsData() {
    const meetings = this.storage.getMeetings();
    if (!meetings || meetings.length === 0) return null;
    
    const lines = [];
    
    // Get recent meetings (last 5)
    const recentMeetings = meetings.slice(-5).reverse();
    
    recentMeetings.forEach(meeting => {
      lines.push(`Meeting: ${meeting.title || 'Untitled'} (${new Date(meeting.date).toLocaleDateString()})`);
      if (meeting.summary) {
        lines.push(`Summary: ${meeting.summary}`);
      }
      if (meeting.keyDecisions && meeting.keyDecisions.length > 0) {
        lines.push('Key Decisions:');
        meeting.keyDecisions.forEach(d => lines.push(`  - ${d}`));
      }
      if (meeting.actionItems && meeting.actionItems.length > 0) {
        lines.push('Action Items:');
        meeting.actionItems.forEach(a => lines.push(`  - ${a.text || a}`));
      }
      lines.push('');
    });
    
    return lines.join('\n');
  }
  
  /**
   * Get Quick Links data from storage (only enabled links with cached content)
   */
  getQuickLinksData() {
    const data = this.storage.getData();
    if (!data || !data.quickLinks) return null;
    
    // Filter to only enabled links
    const enabledLinks = (data.quickLinks || []).filter(link => 
      this.enabledQuickLinks[link.id] !== false
    );
    
    if (enabledLinks.length === 0) return null;
    
    const parts = [];
    
    // Group by section for summary
    const sections = data.linkSections || [];
    const linksBySection = {};
    
    enabledLinks.forEach(link => {
      const section = link.section || 'other';
      if (!linksBySection[section]) linksBySection[section] = [];
      linksBySection[section].push(link);
    });
    
    // Summary of available resources
    const summaryLines = ['Available Resources:'];
    sections.forEach(section => {
      const links = linksBySection[section.id] || [];
      if (links.length > 0) {
        summaryLines.push(`\n${section.name}:`);
        links.forEach(link => {
          const hasCached = this.quickLinkContent[link.id];
          summaryLines.push(`- ${link.name}: ${link.url}${hasCached ? ' [content cached]' : ''}`);
        });
      }
    });
    parts.push(summaryLines.join('\n'));
    
    // Include cached content for each link
    enabledLinks.forEach(link => {
      const cached = this.quickLinkContent[link.id];
      if (cached && cached.content) {
        parts.push(`\n--- Content from "${link.name}" (${link.url}) ---\n${cached.content}\n---`);
      }
    });
    
    return parts.join('\n');
  }

  /**
   * Reset report modal to initial state
   */
  resetReportModal() {
    this.reportStep = 1;
    this.reportPrompt = '';
    this.reportAnswers = {};
    this.reportQuestions = [];
    
    // Show step 1, hide others
    const step1 = document.getElementById('kb-report-step-1');
    const step2 = document.getElementById('kb-report-step-2');
    const loading = document.getElementById('kb-report-loading');
    
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (loading) loading.style.display = 'none';
    
    // Reset buttons
    const continueBtn = document.getElementById('kb-report-continue');
    const backBtn = document.getElementById('kb-report-back');
    
    if (continueBtn) continueBtn.style.display = 'inline-flex';
    if (backBtn) backBtn.style.display = 'none';
    
    // Clear inputs
    const promptInput = document.getElementById('kb-report-prompt');
    if (promptInput) promptInput.value = '';
  }

  /**
   * Show report modal (override to reset state)
   */
  showReportModal() {
    this.resetReportModal();
    this.showModal('kb-report-modal');
  }

  /**
   * Evaluate report prompt and decide if clarification needed
   */
  async evaluateReportPrompt() {
    const promptInput = document.getElementById('kb-report-prompt');
    const prompt = promptInput?.value?.trim() || '';
    
    if (!prompt) {
      return;
    }
    
    if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
      return;
    }
    
    // Get enabled sources
    const enabledSources = this.sources.filter(s => s.enabled !== false);
    if (enabledSources.length === 0) {
      return;
    }
    
    this.reportPrompt = prompt;
    
    // Show loading
    const step1 = document.getElementById('kb-report-step-1');
    const loading = document.getElementById('kb-report-loading');
    const loadingText = document.getElementById('kb-report-loading-text');
    const continueBtn = document.getElementById('kb-report-continue');
    
    if (step1) step1.style.display = 'none';
    if (loading) loading.style.display = 'block';
    if (loadingText) loadingText.textContent = 'Analyzing your request...';
    if (continueBtn) continueBtn.style.display = 'none';
    
    try {
      const sourceList = enabledSources.map(s => `- ${s.title} (${s.category})`).join('\n');
      
      const evaluationPrompt = `You are helping a user generate a report. Evaluate if their request is clear enough to proceed or if you need clarification.

User's request: "${prompt}"

Available sources:
${sourceList}

If the request is clear and specific enough to generate a good report, respond with exactly:
{"ready": true}

If you need clarification, respond with a JSON object containing 1-3 questions. Each question should have:
- "id": unique identifier
- "question": the question text
- "type": either "text" (for open answer) or "choice" (for multiple choice)
- "options": array of options (only if type is "choice")

Example response if clarification needed:
{"ready": false, "questions": [
  {"id": "timeframe", "question": "What time period should the report cover?", "type": "choice", "options": ["Last week", "Last month", "Last quarter", "All time"]},
  {"id": "audience", "question": "Who is the primary audience for this report?", "type": "text"}
]}

Only ask questions that would meaningfully improve the report. If the prompt is reasonably clear, just proceed.`;

      const response = await this.aiProcessor.chat(evaluationPrompt, 'Evaluate this report request.');
      
      // Parse AI response
      let evaluation;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : { ready: true };
      } catch (e) {
        evaluation = { ready: true };
      }
      
      if (evaluation.ready) {
        // Prompt is clear, generate directly
        this.generateReport();
      } else if (evaluation.questions && evaluation.questions.length > 0) {
        // Show clarifying questions
        this.reportQuestions = evaluation.questions;
        this.showReportStep2(evaluation.questions);
      } else {
        // No questions, generate directly
        this.generateReport();
      }
    } catch (error) {
      // Fall back to step 1
      const step1El = document.getElementById('kb-report-step-1');
      const loadingEl = document.getElementById('kb-report-loading');
      const continueEl = document.getElementById('kb-report-continue');
      if (step1El) step1El.style.display = 'block';
      if (loadingEl) loadingEl.style.display = 'none';
      if (continueEl) continueEl.style.display = 'inline-flex';
    }
  }

  /**
   * Show step 2 with clarifying questions
   */
  showReportStep2(questions) {
    this.reportStep = 2;
    
    const loading = document.getElementById('kb-report-loading');
    const step2 = document.getElementById('kb-report-step-2');
    const backBtn = document.getElementById('kb-report-back');
    const continueBtn = document.getElementById('kb-report-continue');
    
    if (loading) loading.style.display = 'none';
    if (step2) step2.style.display = 'block';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (continueBtn) {
      continueBtn.style.display = 'inline-flex';
      continueBtn.textContent = 'Continue';
    }
    
    const container = document.getElementById('kb-report-questions');
    if (!container) return;
    
    container.innerHTML = questions.map(q => {
      if (q.type === 'choice' && q.options) {
        return `
          <div class="kb-report-question" data-id="${q.id}">
            <label>${this.escapeHtml(q.question)}</label>
            <div class="kb-report-options">
              ${q.options.map((opt, i) => `
                <button class="kb-report-option" data-value="${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</button>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        return `
          <div class="kb-report-question" data-id="${q.id}">
            <label>${this.escapeHtml(q.question)}</label>
            <input type="text" class="input kb-report-answer" placeholder="Your answer...">
          </div>
        `;
      }
    }).join('');
    
    // Add click handlers for choice buttons
    container.querySelectorAll('.kb-report-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const parent = e.target.closest('.kb-report-options');
        parent.querySelectorAll('.kb-report-option').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
    
    // Update continue button to go to step 3
    const continueBtnFinal = document.getElementById('kb-report-continue');
    if (continueBtnFinal) continueBtnFinal.onclick = () => this.collectAnswersAndProceed();
  }

  /**
   * Collect answers from step 2 and proceed to step 3
   */
  collectAnswersAndProceed() {
    const container = document.getElementById('kb-report-questions');
    this.reportAnswers = {};
    if (!container) return;
    
    container.querySelectorAll('.kb-report-question').forEach(q => {
      const id = q.dataset.id;
      const activeOption = q.querySelector('.kb-report-option.active');
      const textInput = q.querySelector('.kb-report-answer');
      
      if (activeOption) {
        this.reportAnswers[id] = activeOption.dataset.value;
      } else if (textInput && textInput.value.trim()) {
        this.reportAnswers[id] = textInput.value.trim();
      }
    });
    
    // Generate report directly after collecting answers
    this.generateReport();
  }

  /**
   * Go back to previous report step
   */
  goBackReportStep() {
    const step1 = document.getElementById('kb-report-step-1');
    const step2 = document.getElementById('kb-report-step-2');
    const backBtn = document.getElementById('kb-report-back');
    const continueBtn = document.getElementById('kb-report-continue');
    
    if (this.reportStep === 2) {
      // Back to step 1
      this.reportStep = 1;
      if (step2) step2.style.display = 'none';
      if (step1) step1.style.display = 'block';
      if (backBtn) backBtn.style.display = 'none';
      if (continueBtn) {
        continueBtn.style.display = 'inline-flex';
        continueBtn.textContent = 'Continue';
        continueBtn.onclick = () => this.evaluateReportPrompt();
      }
    }
  }

  /**
   * Generate report using all enabled sources
   */
  async generateReport() {
    if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
      return;
    }
    
    // Get all enabled sources
    const enabledSources = this.sources.filter(s => s.enabled !== false);
    if (enabledSources.length === 0) {
      return;
    }
    
    // Build full prompt from original request + answers
    let fullPrompt = this.reportPrompt;
    
    if (Object.keys(this.reportAnswers).length > 0) {
      fullPrompt += '\n\nAdditional details:';
      const questionMap = new Map(this.reportQuestions.map(q => [q.id, q]));
      for (const [key, value] of Object.entries(this.reportAnswers)) {
        const question = questionMap.get(key);
        if (question) {
          fullPrompt += `\n- ${question.question}: ${value}`;
        }
      }
    }
    
    // Show loading in modal
    const step1 = document.getElementById('kb-report-step-1');
    const step2 = document.getElementById('kb-report-step-2');
    const loading = document.getElementById('kb-report-loading');
    const loadingText = document.getElementById('kb-report-loading-text');
    const continueBtn = document.getElementById('kb-report-continue');
    const backBtn = document.getElementById('kb-report-back');
    
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (loading) loading.style.display = 'block';
    if (loadingText) loadingText.textContent = 'Generating your report...';
    if (continueBtn) continueBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    
    try {
      const context = enabledSources.map(s => 
        `--- ${s.title} (${s.category}) ---\n${s.content}\n---`
      ).join('\n\n');
      
      const systemPrompt = `You are generating a report for Glossi, a seed-stage startup.
Based on the provided sources, create a professional, well-structured report.

Sources:
${context}

Guidelines:
- Use clear headings and bullet points
- Use markdown formatting (headers, bold, lists)
- Prioritize recent and relevant information
- Be specific with data and quotes
- Keep it concise but comprehensive
- Cite sources when referencing specific information`;

      const response = await this.aiProcessor.chat(systemPrompt, fullPrompt);
      
      // Generate title from AI based on prompt and response
      let title = '';
      try {
        const titleResponse = await this.aiProcessor.chat(
          'Generate a brief, descriptive title (max 6 words) for this report. Return ONLY the title, no quotes or explanation.',
          `Request: ${this.reportPrompt}\n\nReport content: ${response.substring(0, 500)}`
        );
        title = titleResponse.trim().replace(/^["']|["']$/g, '');
        if (title.length > 60) {
          title = title.substring(0, 57) + '...';
        }
      } catch (e) {
        title = this.reportPrompt.substring(0, 50) + (this.reportPrompt.length > 50 ? '...' : '');
      }
      
      // Save report
      const report = {
        id: 'rpt_' + Date.now(),
        type: 'custom',
        title: title,
        content: response,
        sourcesUsed: enabledSources.map(s => s.id),
        createdAt: new Date().toISOString()
      };
      
      this.reports.push(report);
      this.saveData();
      
      this.hideModal('kb-report-modal');
      this.render();
      
      // Show report in modal
      this.showReportViewModal(report);
    } catch (error) {
      // Go back to step 1
      this.resetReportModal();
    }
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator() {
    const messagesContainer = document.getElementById('kb-messages');
    if (!messagesContainer) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'kb-message kb-message-assistant kb-message-loading';
    indicator.id = 'kb-typing-indicator';
    indicator.innerHTML = `
      <div class="kb-message-content">
        <div class="kb-typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    const indicator = document.getElementById('kb-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Render the Knowledge Base
   */
  render() {
    this.renderSources();
    this.renderMessages();
    this.renderReports();
  }

  /**
   * Render sources list
   */
  renderSources() {
    const container = document.getElementById('kb-sources-list');
    const countEl = document.getElementById('kb-sources-count');
    
    if (!container) return;
    
    // Count includes both dashboard sources and file sources
    const enabledDashboardCount = Object.values(this.dashboardSources).filter(s => s.enabled).length;
    if (countEl) {
      countEl.textContent = this.sources.length + enabledDashboardCount;
    }
    
    const dropIndicator = `
      <div class="kb-drop-indicator" id="kb-drop-indicator">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>Drop files here</span>
      </div>
    `;
    
    // Dashboard source icons
    const dashboardIcons = {
      weekAtGlance: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      seedRaise: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
      pipeline: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
      meetings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      quickLinks: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'
    };
    
    // Render dashboard sources section
    const dashboardExpandedClass = this.dashboardExpanded ? 'expanded' : '';
    let dashboardHtml = `
      <div class="kb-dashboard-sources ${dashboardExpandedClass}">
        <div class="kb-dashboard-sources-header" id="kb-dashboard-header">
          <svg class="kb-dashboard-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="kb-dashboard-sources-title">Dashboard Data</span>
          <span class="kb-dashboard-sources-badge">Live</span>
        </div>
        <div class="kb-dashboard-sources-list">
    `;
    
    Object.entries(this.dashboardSources).forEach(([key, source]) => {
      if (key === 'quickLinks') {
        // Quick Links is expandable with individual link toggles
        const quickLinks = this.storage.getQuickLinks();
        const enabledCount = quickLinks.filter(l => this.enabledQuickLinks[l.id] !== false).length;
        const isExpanded = this.quickLinksExpanded;
        
        dashboardHtml += `
          <div class="kb-dashboard-source kb-dashboard-expandable ${isExpanded ? 'expanded' : ''}" data-source-key="${key}">
            <div class="kb-dashboard-source-header" data-key="${key}">
              <svg class="kb-dashboard-source-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <div class="kb-dashboard-source-icon">${dashboardIcons[key]}</div>
              <span class="kb-dashboard-source-title">${source.title}</span>
              <span class="kb-dashboard-source-count">${enabledCount}/${quickLinks.length}</span>
              <button class="kb-quicklinks-fetch-all" title="Fetch all content" onclick="event.stopPropagation()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            </div>
            <div class="kb-dashboard-source-children">
              ${quickLinks.map(link => {
                const isEnabled = this.enabledQuickLinks[link.id] !== false;
                const isFetching = this.fetchingLinks.has(link.id);
                const hasCachedContent = !!this.quickLinkContent[link.id];
                const statusClass = isFetching ? 'fetching' : (hasCachedContent ? 'cached' : '');
                return `
                <div class="kb-dashboard-link-item ${isEnabled ? '' : 'disabled'} ${statusClass}" data-link-id="${link.id}">
                  <label class="kb-source-toggle-wrap" onclick="event.stopPropagation()">
                    <input type="checkbox" class="kb-quicklink-toggle" data-link-id="${link.id}" ${isEnabled ? 'checked' : ''}>
                  </label>
                  <span class="kb-dashboard-link-name">${this.escapeHtml(link.name)}</span>
                  ${isFetching ? '<span class="kb-link-status fetching">...</span>' : ''}
                  ${hasCachedContent && !isFetching ? `
                    <button class="kb-quicklink-refresh" title="Refresh content" onclick="event.stopPropagation()">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
        `;
      } else {
        dashboardHtml += `
          <div class="kb-dashboard-source ${source.enabled ? '' : 'disabled'}" data-source-key="${key}">
            <label class="kb-source-toggle-wrap" onclick="event.stopPropagation()">
              <input type="checkbox" class="kb-dashboard-toggle" data-key="${key}" ${source.enabled ? 'checked' : ''}>
            </label>
            <div class="kb-dashboard-source-icon">${dashboardIcons[key]}</div>
            <span class="kb-dashboard-source-title">${source.title}</span>
          </div>
        `;
      }
    });
    
    dashboardHtml += `
        </div>
      </div>
    `;
    
    // Show empty state only if no file sources
    if (this.sources.length === 0) {
      container.innerHTML = dashboardHtml + `
        <div class="kb-file-sources-header">
          <span>Files</span>
        </div>
        <div class="kb-empty-sources">
          <p>No files yet</p>
          <p class="kb-empty-hint">Drop files or click + Text</p>
        </div>
        ${dropIndicator}
      `;
      this.setupDashboardToggleHandlers(container);
      return;
    }
    
    const categoryIcons = {
      market: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>',
      customer: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
      competitor: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
      product: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
      other: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>'
    };
    
    // Group sources by folder
    const folders = {};
    const ungrouped = [];
    
    this.sources.forEach(source => {
      if (source.folder) {
        if (!folders[source.folder]) {
          folders[source.folder] = [];
        }
        folders[source.folder].push(source);
      } else {
        ungrouped.push(source);
      }
    });
    
    // Render file sources header
    let sourcesHtml = dashboardHtml + `
      <div class="kb-file-sources-header">
        <span>Files</span>
        <span class="kb-file-sources-count">${this.sources.length}</span>
      </div>
    `;
    
    // Merge folders from this.folders with folders that have sources
    const allFolderNames = new Set([
      ...Object.keys(folders),
      ...(this.folders || [])
    ]);
    
    // Render folders
    Array.from(allFolderNames).sort().forEach(folderName => {
      const folderSources = folders[folderName] || [];
      const isExpanded = this.expandedFolders && this.expandedFolders[folderName];
      sourcesHtml += `
        <div class="kb-folder ${isExpanded ? 'expanded' : ''}" data-folder="${this.escapeHtml(folderName)}">
          <div class="kb-folder-header">
            <svg class="kb-folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <svg class="kb-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="kb-folder-name">${this.escapeHtml(folderName)}</span>
            <span class="kb-folder-count">${folderSources.length}</span>
          </div>
          <div class="kb-folder-contents">
            ${folderSources.map(source => this.renderSourceItem(source)).join('')}
          </div>
        </div>
      `;
    });
    
    // Render ungrouped sources
    sourcesHtml += ungrouped.map(source => this.renderSourceItem(source)).join('');
    
    container.innerHTML = sourcesHtml + dropIndicator;
    
    // Setup dashboard toggle handlers
    this.setupDashboardToggleHandlers(container);
    
    // Dashboard header collapse toggle
    const dashboardHeader = container.querySelector('#kb-dashboard-header');
    if (dashboardHeader) {
      dashboardHeader.addEventListener('click', (e) => {
        if (e.target.closest('.kb-dashboard-toggle') || e.target.closest('.kb-source-toggle-wrap')) return;
        this.dashboardExpanded = !this.dashboardExpanded;
        this.renderSources();
      });
    }
    
    // Add folder click handlers
    container.querySelectorAll('.kb-folder-header').forEach(header => {
      header.addEventListener('click', () => {
        const folderName = header.closest('.kb-folder').dataset.folder;
        this.toggleFolder(folderName);
      });
      
      // Right-click context menu for folder
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const folderName = header.closest('.kb-folder').dataset.folder;
        this.showFolderContextMenu(e, folderName);
      });
    });
    
    // Add click handlers for sources
    container.querySelectorAll('.kb-source-item').forEach(item => {
      item.addEventListener('click', () => {
        const sourceId = item.dataset.id;
        this.showSourceDetails(sourceId);
      });
      
      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showSourceContextMenu(e, item.dataset.id);
      });
      
      // Drag start
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.id);
        item.classList.add('dragging');
        this.isDraggingSource = true;
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        this.isDraggingSource = false;
        // Clean up any lingering drag-over states
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
    });
    
    // Folder drop zones (header only for subtle indicator)
    container.querySelectorAll('.kb-folder').forEach(folder => {
      const header = folder.querySelector('.kb-folder-header');
      
      header.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.add('drag-over');
      });
      
      header.addEventListener('dragleave', (e) => {
        if (!header.contains(e.relatedTarget)) {
          header.classList.remove('drag-over');
        }
      });
      
      header.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over');
        const sourceId = e.dataTransfer.getData('text/plain');
        const folderName = folder.dataset.folder;
        if (sourceId && this.sources.find(s => s.id === sourceId)) {
          this.moveSourceToFolder(sourceId, folderName);
        }
      });
    });
    

    // Add toggle handlers
    container.querySelectorAll('.kb-source-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const sourceId = e.target.closest('.kb-source-item').dataset.id;
        this.toggleSource(sourceId, e.target.checked);
      });
    });
    
    // Add delete handlers
    container.querySelectorAll('.kb-source-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sourceId = e.target.closest('.kb-source-item').dataset.id;
        this.deleteSource(sourceId);
      });
    });
  }
  
  /**
   * Setup toggle handlers for dashboard sources
   */
  setupDashboardToggleHandlers(container) {
    container.querySelectorAll('.kb-dashboard-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const key = e.target.dataset.key;
        if (this.dashboardSources[key]) {
          this.dashboardSources[key].enabled = e.target.checked;
          this.saveData();
          // Update visual state without full re-render
          const sourceEl = e.target.closest('.kb-dashboard-source');
          if (sourceEl) {
            sourceEl.classList.toggle('disabled', !e.target.checked);
          }
          // Update count
          const countEl = document.getElementById('kb-sources-count');
          if (countEl) {
            const enabledDashboardCount = Object.values(this.dashboardSources).filter(s => s.enabled).length;
            countEl.textContent = this.sources.length + enabledDashboardCount;
          }
        }
      });
    });
    
    // Quick Links header click to expand/collapse
    container.querySelectorAll('.kb-dashboard-source-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.kb-source-toggle-wrap')) return;
        const key = header.dataset.key;
        if (key === 'quickLinks') {
          this.quickLinksExpanded = !this.quickLinksExpanded;
          this.renderSources();
        }
      });
    });
    
    // Individual quick link toggles
    container.querySelectorAll('.kb-quicklink-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const linkId = e.target.dataset.linkId;
        const isEnabled = e.target.checked;
        this.enabledQuickLinks[linkId] = isEnabled;
        this.saveData();
        
        // Update visual state
        const linkEl = e.target.closest('.kb-dashboard-link-item');
        if (linkEl) {
          linkEl.classList.toggle('disabled', !isEnabled);
        }
        
        // Update count display
        const countEl = e.target.closest('.kb-dashboard-expandable')?.querySelector('.kb-dashboard-source-count');
        if (countEl) {
          const quickLinks = this.storage.getQuickLinks();
          const enabledCount = quickLinks.filter(l => this.enabledQuickLinks[l.id] !== false).length;
          countEl.textContent = `${enabledCount}/${quickLinks.length}`;
        }
        
        // Fetch content when enabled (if not already cached)
        if (isEnabled && !this.quickLinkContent[linkId]) {
          await this.fetchQuickLinkContent(linkId);
        }
      });
    });
    
    // Quick link refresh buttons
    container.querySelectorAll('.kb-quicklink-refresh').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const linkId = e.target.closest('.kb-dashboard-link-item').dataset.linkId;
        await this.fetchQuickLinkContent(linkId);
      });
    });
    
    // Fetch all quick links button
    container.querySelectorAll('.kb-quicklinks-fetch-all').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.fetchMissingQuickLinkContent();
      });
    });
  }

  /**
   * Show context menu for source
   */
  showSourceContextMenu(e, sourceId) {
    // Remove existing menu
    const existingMenu = document.querySelector('.kb-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    // Get all folder names
    const folderNames = [...new Set(this.sources.filter(s => s.folder).map(s => s.folder))];
    
    const menu = document.createElement('div');
    menu.className = 'kb-context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    
    let folderOptions = '';
    if (folderNames.length > 0) {
      folderOptions = folderNames.map(f => 
        `<button class="kb-context-item" data-action="move" data-folder="${this.escapeHtml(f)}">Move to ${this.escapeHtml(f)}</button>`
      ).join('');
      if (source.folder) {
        folderOptions += `<button class="kb-context-item" data-action="move" data-folder="">Remove from folder</button>`;
      }
    }
    
    menu.innerHTML = `
      <button class="kb-context-item" data-action="rename">Rename</button>
      ${folderOptions}
      <div class="kb-context-divider"></div>
      <button class="kb-context-item kb-context-danger" data-action="delete">Delete</button>
    `;
    
    document.body.appendChild(menu);
    
    // Handle menu clicks
    menu.querySelectorAll('.kb-context-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'rename') {
          this.renameSource(sourceId);
        } else if (action === 'move') {
          this.moveSourceToFolder(sourceId, item.dataset.folder);
        } else if (action === 'delete') {
          this.deleteSource(sourceId);
        }
        menu.remove();
      });
    });
    
    // Close menu on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 10);
  }

  /**
   * Show source details
   */
  showSourceDetails(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    // For now, just highlight it and show content in chat
    this.sendMessage(`Tell me about the source "${source.title}"`);
  }

  /**
   * Toggle source enabled/disabled state
   */
  toggleSource(sourceId, enabled) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    source.enabled = enabled;
    this.saveData();
    this.renderSources();
  }

  /**
   * Toggle all sources on or off
   */
  toggleAllSources() {
    if (this.sources.length === 0) return;
    
    // Check if any sources are currently enabled
    const anyEnabled = this.sources.some(s => s.enabled !== false);
    
    // If any are enabled, turn all off. Otherwise, turn all on.
    const newState = !anyEnabled;
    
    this.sources.forEach(source => {
      source.enabled = newState;
    });
    
    // Also toggle dashboard sources
    Object.keys(this.dashboardSources).forEach(key => {
      this.dashboardSources[key].enabled = newState;
    });
    
    this.saveData();
    this.renderSources();
  }

  /**
   * Delete a source
   */
  deleteSource(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    if (!confirm(`Delete "${source.title}"? This cannot be undone.`)) {
      return;
    }
    
    this.sources = this.sources.filter(s => s.id !== sourceId);
    this.saveData();
    this.renderSources();
  }

  /**
   * Render a single source item
   */
  renderSourceItem(source) {
    const isProcessing = source.processing === true;
    const progress = source.progress || 0;
    
    return `
      <div class="kb-source-item ${source.enabled === false ? 'disabled' : ''} ${isProcessing ? 'processing' : ''}" data-id="${source.id}" draggable="${!isProcessing}">
        <label class="kb-source-toggle-wrap" onclick="event.stopPropagation()">
          <input type="checkbox" class="kb-source-toggle" ${source.enabled !== false ? 'checked' : ''} ${isProcessing ? 'disabled' : ''}>
        </label>
        <div class="kb-source-item-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="kb-source-item-content">
          <div class="kb-source-item-title">${this.escapeHtml(source.title)}</div>
          ${isProcessing ? `
            <div class="kb-source-progress">
              <div class="kb-source-progress-fill" data-id="${source.id}" style="width: ${progress}%"></div>
            </div>
          ` : ''}
        </div>
        <button class="kb-source-delete" onclick="event.stopPropagation()" title="Delete source" ${isProcessing ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
        </button>
      </div>
    `;
  }

  /**
   * Rename a source
   */
  renameSource(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    const newName = prompt('Rename source:', source.title);
    if (newName && newName.trim() && newName.trim() !== source.title) {
      source.title = newName.trim();
      this.saveData();
      this.renderSources();
    }
  }

  /**
   * Create a new folder - shows inline input
   */
  createFolder() {
    // Check if input already exists
    if (document.getElementById('kb-new-folder-input')) return;
    
    const container = document.getElementById('kb-sources-list');
    if (!container) return;
    
    // Insert input at top of file sources section
    const fileHeader = container.querySelector('.kb-file-sources-header');
    if (!fileHeader) return;
    
    const inputHtml = `
      <div class="kb-new-folder-input-wrap" id="kb-new-folder-wrap">
        <input type="text" id="kb-new-folder-input" class="kb-new-folder-input" placeholder="Folder name..." autofocus>
        <button class="kb-new-folder-save" id="kb-new-folder-save" title="Create">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button class="kb-new-folder-cancel" id="kb-new-folder-cancel" title="Cancel">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    
    fileHeader.insertAdjacentHTML('afterend', inputHtml);
    
    const input = document.getElementById('kb-new-folder-input');
    const saveBtn = document.getElementById('kb-new-folder-save');
    const cancelBtn = document.getElementById('kb-new-folder-cancel');
    const wrap = document.getElementById('kb-new-folder-wrap');
    
    const saveFolder = () => {
      const name = input.value.trim();
      if (name) {
        this.folders.push(name);
        this.expandedFolders[name] = true;
        this.saveData();
        this.renderSources();
      } else {
        wrap.remove();
      }
    };
    
    const cancel = () => wrap.remove();
    
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveFolder();
      if (e.key === 'Escape') cancel();
    });
    saveBtn.addEventListener('click', saveFolder);
    cancelBtn.addEventListener('click', cancel);
  }

  /**
   * Move source to folder
   */
  moveSourceToFolder(sourceId, folderName) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    source.folder = folderName || null;
    this.saveData();
    this.renderSources();
  }

  /**
   * Toggle folder expansion
   */
  toggleFolder(folderName) {
    this.expandedFolders[folderName] = !this.expandedFolders[folderName];
    this.renderSources();
  }

  /**
   * Show context menu for folder
   */
  showFolderContextMenu(e, folderName) {
    // Remove any existing menus
    document.querySelectorAll('.kb-context-menu').forEach(m => m.remove());
    
    const menu = document.createElement('div');
    menu.className = 'kb-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    
    menu.innerHTML = `
      <button class="kb-context-item" data-action="rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Rename
      </button>
      <button class="kb-context-item kb-context-danger" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
        </svg>
        Delete
      </button>
    `;
    
    document.body.appendChild(menu);
    
    // Handle menu item clicks
    menu.querySelectorAll('.kb-context-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'rename') {
          this.renameFolder(folderName);
        } else if (action === 'delete') {
          this.deleteFolder(folderName);
        }
        menu.remove();
      });
    });
    
    // Close menu on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 10);
  }

  /**
   * Rename a folder
   */
  renameFolder(oldName) {
    const container = document.getElementById('kb-sources-list');
    const folderEl = container?.querySelector(`.kb-folder[data-folder="${oldName}"]`);
    if (!folderEl) return;
    
    const header = folderEl.querySelector('.kb-folder-header');
    const nameEl = header.querySelector('.kb-folder-name');
    if (!nameEl) return;
    
    // Replace name with input
    const currentName = oldName;
    const inputHtml = `
      <input type="text" class="kb-folder-rename-input" value="${this.escapeHtml(currentName)}" />
    `;
    nameEl.outerHTML = inputHtml;
    
    const input = header.querySelector('.kb-folder-rename-input');
    input.focus();
    input.select();
    
    const save = () => {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        // Update folders array
        const index = this.folders.indexOf(oldName);
        if (index !== -1) {
          this.folders[index] = newName;
        }
        
        // Update sources that reference this folder
        this.sources.forEach(source => {
          if (source.folder === oldName) {
            source.folder = newName;
          }
        });
        
        // Update expanded state
        if (this.expandedFolders[oldName]) {
          this.expandedFolders[newName] = this.expandedFolders[oldName];
          delete this.expandedFolders[oldName];
        }
        
        this.saveData();
      }
      this.renderSources();
    };
    
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        this.renderSources();
      }
    });
    
    // Prevent folder toggle when clicking input
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  /**
   * Delete a folder
   */
  deleteFolder(folderName) {
    const sourcesInFolder = this.sources.filter(s => s.folder === folderName);
    
    if (sourcesInFolder.length > 0) {
      if (!confirm(`Delete folder "${folderName}"? The ${sourcesInFolder.length} source(s) inside will be moved to ungrouped.`)) {
        return;
      }
    }
    
    // Remove from folders array
    const index = this.folders.indexOf(folderName);
    if (index !== -1) {
      this.folders.splice(index, 1);
    }
    
    // Move sources to ungrouped
    sourcesInFolder.forEach(source => {
      source.folder = null;
    });
    
    // Clean up expanded state
    delete this.expandedFolders[folderName];
    
    this.saveData();
    this.renderSources();
  }

  /**
   * Render messages
   */
  renderMessages() {
    const container = document.getElementById('kb-messages');
    if (!container) return;
    
    if (!this.currentConversation || this.currentConversation.messages.length === 0) {
      container.innerHTML = '<div class="kb-empty-chat"><p>Ask a question or click a suggestion below</p></div>';
      return;
    }
    
    container.innerHTML = this.currentConversation.messages.map(msg => {
      const roleClass = msg.role === 'user' ? 'kb-message-user' : 'kb-message-assistant';
      return `
        <div class="kb-message ${roleClass}">
          <div class="kb-message-content">
            ${this.formatMessageContent(msg.content)}
          </div>
        </div>
      `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Format message content with markdown-like parsing
   */
  formatMessageContent(content) {
    // Basic markdown parsing
    let html = this.escapeHtml(content);
    
    // Numbered headers like "1. Title" become h2
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<h2>$1. $2</h2>');
    
    // Regular headers
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    
    // Move source citations to small numbered icons with tooltips
    let citationNum = 0;
    const citationMap = {};
    html = html.replace(/\[Source: (.+?)\]/g, (match, sourceName) => {
      // Assign number to unique sources
      if (!citationMap[sourceName]) {
        citationNum++;
        citationMap[sourceName] = citationNum;
      }
      const num = citationMap[sourceName];
      return `<span class="kb-inline-citation" data-source-num="${num}" data-tooltip="${sourceName}"></span>`;
    });
    
    // Process bullet points with nesting support
    const lines = html.split('\n');
    const processedLines = [];
    let listStack = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check for bullet point (-, *, •) with optional leading spaces for nesting
      const bulletMatch = line.match(/^(\s*)([-*•])\s+(.+)$/);
      
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        let bulletContent = bulletMatch[3];
        const depth = Math.floor(indent / 2);
        
        // Remove excessive bold - only keep first bold segment
        const boldMatches = bulletContent.match(/\*\*(.+?)\*\*/g);
        if (boldMatches && boldMatches.length > 0) {
          // Only bold the first segment, make rest regular
          bulletContent = bulletContent.replace(/\*\*(.+?)\*\*/g, (match, p1, idx) => {
            return idx === 0 ? `<strong>${p1}</strong>` : p1;
          });
        }
        
        // Close lists if going back up
        while (listStack.length > depth + 1) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        
        // Open new list if needed
        if (listStack.length <= depth) {
          processedLines.push('<ul>');
          listStack.push(depth);
        }
        
        processedLines.push('<li>' + bulletContent + '</li>');
      } else {
        // Close all open lists
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        
        if (trimmedLine) {
          // Don't wrap headers in <p>
          if (trimmedLine.startsWith('<h')) {
            processedLines.push(trimmedLine);
          } else {
            // Process bold in paragraphs - limit to first occurrence
            let processed = trimmedLine;
            const boldCount = (processed.match(/\*\*(.+?)\*\*/g) || []).length;
            if (boldCount > 1) {
              let first = true;
              processed = processed.replace(/\*\*(.+?)\*\*/g, (match, p1) => {
                if (first) {
                  first = false;
                  return `<strong>${p1}</strong>`;
                }
                return p1;
              });
            } else {
              processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            }
            processedLines.push('<p>' + processed + '</p>');
          }
        }
      }
    }
    
    // Close any remaining open lists
    while (listStack.length > 0) {
      processedLines.push('</ul>');
      listStack.pop();
    }
    
    html = processedLines.join('');
    
    return html;
  }

  /**
   * Render reports list
   */
  renderReports() {
    const container = document.getElementById('kb-reports-list');
    const countEl = document.getElementById('kb-reports-count');
    
    if (!container) return;
    
    if (countEl) {
      countEl.textContent = this.reports.length;
    }
    
    if (this.reports.length === 0) {
      container.innerHTML = `
        <div class="kb-empty-reports">
          <p>No reports yet</p>
          <p class="kb-empty-hint">Generate reports from your sources</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.reports.map(report => `
      <div class="kb-report-item" data-id="${report.id}">
        <div class="kb-report-item-title">${this.escapeHtml(report.title)}</div>
        <div class="kb-report-item-meta">${new Date(report.createdAt).toLocaleDateString()}</div>
      </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.kb-report-item').forEach(item => {
      item.addEventListener('click', () => {
        const reportId = item.dataset.id;
        const report = this.reports.find(r => r.id === reportId);
        if (report) {
          this.showReportViewModal(report);
        }
      });
      
      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showReportContextMenu(e, item.dataset.id);
      });
    });
  }

  /**
   * Show context menu for report
   */
  showReportContextMenu(e, reportId) {
    // Remove existing menu
    const existingMenu = document.querySelector('.kb-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return;
    
    const menu = document.createElement('div');
    menu.className = 'kb-context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    
    menu.innerHTML = `
      <button class="kb-context-item" data-action="rename">Rename</button>
      <button class="kb-context-item" data-action="edit">Edit</button>
      <div class="kb-context-divider"></div>
      <button class="kb-context-item kb-context-danger" data-action="delete">Delete</button>
    `;
    
    document.body.appendChild(menu);
    
    // Handle menu clicks
    menu.querySelectorAll('.kb-context-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'rename') {
          this.renameReport(reportId);
        } else if (action === 'edit') {
          this.showReportViewModal(report);
        } else if (action === 'delete') {
          this.deleteReport(reportId);
        }
        menu.remove();
      });
    });
    
    // Close menu on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 10);
  }

  /**
   * Rename a report
   */
  renameReport(reportId) {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return;
    
    const newName = prompt('Rename report:', report.title);
    if (newName && newName.trim() && newName.trim() !== report.title) {
      report.title = newName.trim();
      this.saveData();
      this.renderReports();
    }
  }

  /**
   * Delete a report
   */
  deleteReport(reportId) {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return;
    
    if (!confirm(`Delete "${report.title}"? This cannot be undone.`)) {
      return;
    }
    
    this.reports = this.reports.filter(r => r.id !== reportId);
    this.saveData();
    // Force immediate sync to server (bypass debounce)
    if (this.storage.save) {
      this.storage.save();
    }
    this.renderReports();
  }

  /**
   * Show report in chat
   */
  showReportInChat(reportId) {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return;
    
    // Add to chat
    this.currentConversation.messages.push({
      role: 'assistant',
      content: `**${report.title}** (Generated ${new Date(report.createdAt).toLocaleDateString()})\n\n${report.content}`,
      timestamp: new Date().toISOString()
    });
    
    this.renderMessages();
  }

  /**
   * Show report view modal with editing capability
   */
  showReportViewModal(report) {
    const modal = document.getElementById('kb-report-view-modal');
    const titleEl = document.getElementById('kb-report-view-title');
    const contentEl = document.getElementById('kb-report-view-content');
    const copyBtn = document.getElementById('kb-report-copy');
    const closeBtn = document.getElementById('kb-report-view-close');
    const saveBtn = document.getElementById('kb-report-save');
    
    if (!modal || !contentEl) return;
    
    // Store current report ID for saving
    this.currentEditingReportId = report.id;
    
    if (titleEl) {
      titleEl.value = report.title;
    }
    
    // Set raw content for editing
    contentEl.value = report.content;
    
    // Setup copy handler
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(contentEl.value);
      };
    }
    
    // Setup save handler
    if (saveBtn) {
      saveBtn.onclick = () => {
        this.saveReportChanges();
      };
    }
    
    // Setup close handler
    if (closeBtn) {
      closeBtn.onclick = () => this.hideModal('kb-report-view-modal');
    }
    
    this.showModal('kb-report-view-modal');
  }

  /**
   * Save changes to current report
   */
  saveReportChanges() {
    if (!this.currentEditingReportId) return;
    
    const report = this.reports.find(r => r.id === this.currentEditingReportId);
    if (!report) return;
    
    const titleEl = document.getElementById('kb-report-view-title');
    const contentEl = document.getElementById('kb-report-view-content');
    
    if (titleEl) {
      report.title = titleEl.value.trim() || 'Untitled Report';
    }
    if (contentEl) {
      report.content = contentEl.value;
    }
    
    this.saveData();
    this.renderReports();
    this.hideModal('kb-report-view-modal');
  }

  /**
   * Show modal
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('visible');
    }
  }

  /**
   * Hide modal
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('visible');
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Convert file to base64 string
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update source freshness
   */
  updateSourceFreshness(sourceId, freshness) {
    const source = this.sources.find(s => s.id === sourceId);
    if (source) {
      source.freshness = freshness;
      this.saveData();
      this.render();
    }
  }
}

// Export class and singleton instance
export { KnowledgeBase };
export const knowledgeBase = new KnowledgeBase();
export default knowledgeBase;
