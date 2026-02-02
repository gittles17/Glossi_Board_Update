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
  }

  /**
   * Load data from storage
   */
  loadData() {
    const kbData = this.storage.getKnowledgeBase();
    this.sources = kbData.sources || [];
    this.conversations = kbData.conversations || [];
    this.reports = kbData.reports || [];
    
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
    this.storage.updateKnowledgeBase({
      sources: this.sources,
      conversations: this.conversations,
      reports: this.reports
    });
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
   * Setup event listeners
   */
  setupEventListeners() {
    // Toggle sidebar
    const toggleSidebar = document.getElementById('kb-toggle-sidebar');
    if (toggleSidebar) {
      toggleSidebar.addEventListener('click', () => {
        document.getElementById('kb-sources-sidebar').classList.toggle('collapsed');
      });
    }

    // Sources drop zone
    const dropZone = document.getElementById('kb-sources-list');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
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
        document.getElementById('kb-reports-panel').classList.toggle('collapsed');
      });
    }

    // Add source button
    const addSourceBtn = document.getElementById('kb-add-source-btn');
    if (addSourceBtn) {
      addSourceBtn.addEventListener('click', () => this.showSourceModal());
    }

    // Source modal tabs
    document.querySelectorAll('.kb-source-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchSourceTab(e.target.closest('.kb-source-tab').dataset.type));
    });

    // Category buttons
    document.querySelectorAll('.kb-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.kb-category-btn').forEach(b => b.classList.remove('active'));
        e.target.closest('.kb-category-btn').classList.add('active');
        this.selectedCategory = e.target.closest('.kb-category-btn').dataset.category;
      });
    });

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

    // Template buttons
    document.querySelectorAll('.kb-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.kb-template-btn').forEach(b => b.classList.remove('active'));
        e.target.closest('.kb-template-btn').classList.add('active');
        this.selectedTemplate = e.target.closest('.kb-template-btn').dataset.template;
        this.updateReportPrompt();
      });
    });

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
    this.showModal('kb-source-modal');
    this.switchSourceTab('text');
    this.selectedCategory = 'auto';
    document.querySelectorAll('.kb-category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === 'auto');
    });
  }

  /**
   * Show report modal
   */
  showReportModal() {
    this.showModal('kb-report-modal');
    this.selectedTemplate = 'custom';
    document.querySelectorAll('.kb-template-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.template === 'custom');
    });
    this.populateReportSources();
    this.updateReportPrompt();
  }

  /**
   * Populate report sources checkboxes
   */
  populateReportSources() {
    const container = document.getElementById('kb-report-sources');
    if (!container) return;
    
    if (this.sources.length === 0) {
      container.innerHTML = '<p class="kb-no-sources">Add sources first to generate reports</p>';
      return;
    }
    
    container.innerHTML = this.sources.map(source => `
      <label class="kb-source-checkbox">
        <input type="checkbox" value="${source.id}" checked>
        <span>${this.escapeHtml(source.title)}</span>
      </label>
    `).join('');
  }

  /**
   * Update report prompt based on template
   */
  updateReportPrompt() {
    const promptInput = document.getElementById('kb-report-prompt');
    if (!promptInput) return;
    
    const prompts = {
      investor_update: 'Create a weekly investor update email summarizing key progress, metrics, and highlights from the sources.',
      talking_points: 'Generate a list of compelling talking points for investor conversations based on the sources.',
      due_diligence: 'Create a comprehensive due diligence brief covering company overview, market opportunity, traction, and competitive advantages.',
      custom: ''
    };
    
    promptInput.value = prompts[this.selectedTemplate] || '';
  }

  /**
   * Handle a dropped file
   */
  async handleDroppedFile(file) {
    const textExtensions = ['.txt', '.md', '.csv', '.json'];
    const pdfExtensions = ['.pdf'];
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'];
    
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isText = textExtensions.includes(ext);
    const isPdf = pdfExtensions.includes(ext);
    const isAudio = audioExtensions.includes(ext);
    
    if (!isText && !isPdf && !isAudio) {
      this.showToast(`Unsupported file type: ${file.name}`, 'error');
      return;
    }
    
    try {
      let content = '';
      let title = file.name.replace(/\.[^/.]+$/, '');
      let type = 'file';
      let metadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };
      
      if (isText) {
        // Read text files directly
        content = await file.text();
        this.showToast(`Processing: ${file.name}`, 'info');
        
      } else if (isPdf) {
        // Send to server for PDF extraction
        this.showToast(`Extracting PDF text: ${file.name}`, 'info');
        
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
        title = result.title || title;
        metadata.pageCount = result.pageCount;
        type = 'pdf';
        
      } else if (isAudio) {
        // Send to server for Whisper transcription
        this.showToast(`Transcribing audio: ${file.name} (this may take a moment)`, 'info');
        
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
        title = result.title || title;
        metadata.duration = result.duration;
        type = 'audio';
      }
      
      // Determine category using AI
      let category = 'other';
      if (this.aiProcessor && this.aiProcessor.isConfigured() && content) {
        category = await this.categorizeSource(content.substring(0, 1000));
      }
      
      // Create source object - store extracted text (up to 500KB)
      const source = {
        id: 'src_' + Date.now(),
        type,
        title,
        content: content.substring(0, 500000),
        category,
        metadata: {
          ...metadata,
          contentLength: content.length
        },
        createdAt: new Date().toISOString()
      };
      
      this.sources.push(source);
      this.saveData();
      this.renderSources();
      this.showToast(`Added: ${title}`, 'success');
      
    } catch (error) {
      this.showToast(`Failed to process file: ${error.message}`, 'error');
    }
  }

  /**
   * Add a new source
   */
  async addSource() {
    let content = '';
    let title = '';
    let type = this.selectedSourceType;
    let metadata = {};
    
    if (type === 'text') {
      title = document.getElementById('kb-source-title').value.trim();
      content = document.getElementById('kb-source-text').value.trim();
      
      if (!content) {
        this.showToast('Please enter some content', 'error');
        return;
      }
      
      if (!title) {
        // Generate title from first line or first 50 chars
        title = content.split('\n')[0].substring(0, 50) || 'Untitled';
      }
    } else if (type === 'url') {
      const url = document.getElementById('kb-source-url').value.trim();
      
      if (!url) {
        this.showToast('Please enter a URL', 'error');
        return;
      }
      
      try {
        const result = await this.fetchUrl(url);
        title = result.title || url;
        content = result.content;
        metadata = { url };
      } catch (error) {
        this.showToast('Failed to fetch URL: ' + error.message, 'error');
        return;
      }
    }
    
    // Determine category
    let category = this.selectedCategory;
    if (category === 'auto' && this.aiProcessor && this.aiProcessor.isConfigured()) {
      category = await this.categorizeSource(content);
    } else if (category === 'auto') {
      category = 'other';
    }
    
    // Create source object
    const source = {
      id: 'src_' + Date.now(),
      type,
      title,
      content,
      category,
      tags: [],
      addedAt: new Date().toISOString(),
      freshness: 'current',
      metadata
    };
    
    this.sources.push(source);
    this.saveData();
    this.render();
    this.hideModal('kb-source-modal');
    this.clearSourceModal();
    this.showToast('Source added successfully', 'success');
    
    if (this.onUpdate) this.onUpdate();
  }

  /**
   * Get file type from file
   */
  getFileType(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
    return 'text';
  }

  /**
   * Process uploaded file
   */
  async processFile(file) {
    const type = this.getFileType(file);
    
    if (type === 'pdf') {
      return await this.processPdf(file);
    } else if (type === 'image') {
      return await this.processImage(file);
    } else if (type === 'audio') {
      return await this.processAudio(file);
    } else {
      // Text file
      const content = await file.text();
      return { content };
    }
  }

  /**
   * Process PDF file
   */
  async processPdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          let content = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            content += pageText + '\n\n';
          }
          
          resolve({ content: content.trim(), metadata: { pages: pdf.numPages } });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Process image file
   */
  async processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        
        // If AI is configured, analyze the image
        if (this.aiProcessor && this.aiProcessor.isConfigured()) {
          try {
            const analysis = await this.aiProcessor.analyzeImage(dataUrl, file.name);
            resolve({ 
              content: analysis, 
              metadata: { 
                preview: dataUrl,
                fileName: file.name 
              } 
            });
          } catch (error) {
            resolve({ 
              content: '[Image: ' + file.name + ']', 
              metadata: { 
                preview: dataUrl,
                fileName: file.name 
              } 
            });
          }
        } else {
          resolve({ 
            content: '[Image: ' + file.name + ']', 
            metadata: { 
              preview: dataUrl,
              fileName: file.name 
            } 
          });
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Process audio file using OpenAI Whisper
   */
  async processAudio(file) {
    // Get OpenAI API key from settings
    const settings = this.storage.getSettings();
    const apiKey = settings.apiKey;
    
    if (!apiKey) {
      return {
        content: '[Audio file: ' + file.name + ' - Configure OpenAI API key in Settings to transcribe]',
        metadata: { fileName: file.name, needsTranscription: true }
      };
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const result = await response.json();
      return {
        content: result.text,
        metadata: { fileName: file.name, transcribed: true }
      };
    } catch (error) {
      return {
        content: '[Audio file: ' + file.name + ' - Transcription failed: ' + error.message + ']',
        metadata: { fileName: file.name, error: error.message }
      };
    }
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
    document.getElementById('kb-source-title').value = '';
    document.getElementById('kb-source-text').value = '';
    document.getElementById('kb-source-url').value = '';
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
      this.showToast('Add sources first', 'info');
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
    const message = overrideMessage || input.value.trim();
    
    if (!message) return;
    
    if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
      this.showToast('Please configure your API key in settings', 'error');
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
      
      const systemPrompt = `You are an AI assistant for the Glossi investor knowledge base. 
You have access to the following sources:

${context}

When answering questions:
1. Base your answers on the provided sources
2. Cite specific sources using [Source: title] format
3. If information is not in the sources, say so
4. Prioritize recent information over older data
5. Be concise but comprehensive`;

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
    if (this.sources.length === 0) {
      return 'No sources available.';
    }
    
    return this.sources.map(source => {
      const freshnessLabel = {
        current: 'Current',
        review: 'Needs Review',
        outdated: 'Outdated'
      }[source.freshness] || 'Unknown';
      
      return `--- Source: ${source.title} ---
Category: ${source.category}
Added: ${new Date(source.addedAt).toLocaleDateString()}
Status: ${freshnessLabel}
Content:
${source.content.substring(0, 2000)}${source.content.length > 2000 ? '...' : ''}
---`;
    }).join('\n\n');
  }

  /**
   * Generate report
   */
  async generateReport() {
    const promptInput = document.getElementById('kb-report-prompt');
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
      this.showToast('Please describe what you want to generate', 'error');
      return;
    }
    
    if (!this.aiProcessor || !this.aiProcessor.isConfigured()) {
      this.showToast('Please configure your API key in settings', 'error');
      return;
    }
    
    // Get selected sources
    const selectedSourceIds = [];
    document.querySelectorAll('#kb-report-sources input:checked').forEach(checkbox => {
      selectedSourceIds.push(checkbox.value);
    });
    
    if (selectedSourceIds.length === 0 && this.sources.length > 0) {
      this.showToast('Please select at least one source', 'error');
      return;
    }
    
    const selectedSources = this.sources.filter(s => selectedSourceIds.includes(s.id));
    
    this.hideModal('kb-report-modal');
    this.showTypingIndicator();
    
    try {
      const context = selectedSources.map(s => 
        `--- ${s.title} (${s.category}) ---\n${s.content}\n---`
      ).join('\n\n');
      
      const systemPrompt = `You are generating a report for Glossi, a seed-stage startup.
Based on the provided sources, create a professional, well-structured report.

Sources:
${context}

Guidelines:
- Use clear headings and bullet points
- Prioritize recent and relevant information
- Be specific with data and quotes
- Keep it concise but comprehensive`;

      const response = await this.aiProcessor.chat(systemPrompt, prompt);
      
      // Save report
      const report = {
        id: 'rpt_' + Date.now(),
        type: this.selectedTemplate,
        title: this.getReportTitle(prompt),
        content: response,
        sourcesUsed: selectedSourceIds,
        createdAt: new Date().toISOString()
      };
      
      this.reports.push(report);
      this.saveData();
      
      // Add to chat as assistant message
      this.currentConversation.messages.push({
        role: 'assistant',
        content: `**Generated Report: ${report.title}**\n\n${response}`,
        timestamp: new Date().toISOString()
      });
      
      this.saveData();
      this.render();
      this.showToast('Report generated successfully', 'success');
    } catch (error) {
      this.showToast('Failed to generate report: ' + error.message, 'error');
    }
    
    this.hideTypingIndicator();
    this.renderMessages();
  }

  /**
   * Get report title from prompt
   */
  getReportTitle(prompt) {
    const titles = {
      investor_update: 'Investor Update',
      talking_points: 'Talking Points',
      due_diligence: 'Due Diligence Brief',
      custom: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
    };
    return titles[this.selectedTemplate] || 'Custom Report';
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
    
    if (countEl) {
      countEl.textContent = this.sources.length;
    }
    
    if (this.sources.length === 0) {
      container.innerHTML = `
        <div class="kb-empty-sources">
          <p>No sources yet</p>
          <p class="kb-empty-hint">Add documents, URLs, or paste text</p>
        </div>
      `;
      return;
    }
    
    const categoryIcons = {
      market: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>',
      customer: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
      competitor: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
      product: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
      other: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>'
    };
    
    container.innerHTML = this.sources.map(source => `
      <div class="kb-source-item" data-id="${source.id}">
        <div class="kb-source-item-icon">
          ${categoryIcons[source.category] || categoryIcons.other}
        </div>
        <div class="kb-source-item-content">
          <div class="kb-source-item-title">${this.escapeHtml(source.title)}</div>
          <div class="kb-source-item-meta">
            <span class="kb-source-item-category">${source.category}</span>
            <span class="kb-source-freshness ${source.freshness}"></span>
          </div>
        </div>
      </div>
    `).join('');
    
    // Add click handlers for sources
    container.querySelectorAll('.kb-source-item').forEach(item => {
      item.addEventListener('click', () => {
        const sourceId = item.dataset.id;
        this.showSourceDetails(sourceId);
      });
    });
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
   * Render messages
   */
  renderMessages() {
    const container = document.getElementById('kb-messages');
    if (!container) return;
    
    if (!this.currentConversation || this.currentConversation.messages.length === 0) {
      container.innerHTML = `
        <div class="kb-message kb-message-system">
          <div class="kb-message-content">
            <p><strong>Welcome to your Knowledge Base</strong></p>
            <p>Add sources (documents, URLs, text) and I'll help you analyze them, answer questions, and generate reports.</p>
          </div>
        </div>
      `;
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
    
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet points
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    // Source citations
    html = html.replace(/\[Source: (.+?)\]/g, '<span class="kb-citation">$1</span>');
    
    return '<p>' + html + '</p>';
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
        this.showReportInChat(reportId);
      });
    });
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
   * Show modal
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * Hide modal
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
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
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Delete a source
   */
  deleteSource(sourceId) {
    const index = this.sources.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      this.sources.splice(index, 1);
      this.saveData();
      this.render();
    }
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

// Export singleton instance
export const knowledgeBase = new KnowledgeBase();
export default knowledgeBase;
