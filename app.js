/**
 * Glossi Board Dashboard - Main Application
 * Ties together all modules and handles UI interactions
 */

import { storage } from './modules/storage.js';
import { aiProcessor } from './modules/ai-processor.js';
import { meetingsManager } from './modules/meetings.js';

// OpenAI API key for Whisper transcription (set in settings)
let OPENAI_API_KEY = null;

class GlossiDashboard {
  constructor() {
    this.data = null;
    this.settings = null;
    this.pendingReview = null;
    this.pendingDroppedContent = null;
    this.pendingAnalysis = null;
    this.animationObserver = null;
    this.editingTalkingPointIndex = null;
    this.editingLinkId = null;
    this.editingInvestorId = null;
    
    // Name aliases for display
    this.nameAliases = {
      'rs': 'Ricky',
      'jg': 'Jonathan',
      'adam': 'Adam',
      'ricky': 'Ricky',
      'jonathan': 'Jonathan'
    };
    
    // Available team members for quick assignment
    this.teamMembers = ['Ricky', 'Jonathan', 'Adam', 'Unassigned'];
  }

  /**
   * Resolve name alias to full name
   */
  resolveOwnerName(name) {
    if (!name) return 'Unassigned';
    const lower = name.toLowerCase().trim();
    return this.nameAliases[lower] || name;
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    // Initialize storage and load data
    const { data, settings, meetings } = await storage.init();
    this.data = data;
    this.settings = settings;

    // Initialize AI processor with API key
    if (settings.apiKey) {
      aiProcessor.setApiKey(settings.apiKey);
    }

    // Initialize meetings manager
    meetingsManager.init(storage, (meeting) => this.renderMeeting(meeting));

    // Setup UI event listeners
    this.setupEventListeners();

    // Setup intersection observer for animations
    this.setupAnimationObserver();

    // Render initial state
    this.render();

    // Trigger entrance animations
    requestAnimationFrame(() => {
      this.animateStatsOnLoad();
    });

    console.log('Glossi Dashboard initialized');
  }

  /**
   * Setup intersection observer for scroll animations
   */
  setupAnimationObserver() {
    this.animationObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            this.animationObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
  }

  /**
   * Setup the settings drop zone for file uploads
   */
  /**
   * Setup hamburger menu dropdown
   */
  setupMenuDropdown() {
    const menuBtn = document.getElementById('menu-btn');
    const dropdown = document.getElementById('dropdown-menu');
    const menuDropZone = document.getElementById('menu-drop-zone');
    const menuFileInput = document.getElementById('menu-file-input');

    // Toggle menu on button click
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    // Menu drop zone - click to browse
    menuDropZone.addEventListener('click', (e) => {
      e.stopPropagation();
      menuFileInput.click();
    });

    // Menu drop zone - file selected
    menuFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        dropdown.classList.remove('open');
        this.processDroppedFile(e.target.files[0]);
        menuFileInput.value = '';
      }
    });

    // Menu drop zone - drag events
    menuDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menuDropZone.classList.add('drag-over');
    });

    menuDropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menuDropZone.classList.remove('drag-over');
    });

    menuDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menuDropZone.classList.remove('drag-over');
      dropdown.classList.remove('open');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processDroppedFile(files[0]);
      }
    });

    // Paste text submission
    const pasteInput = document.getElementById('menu-paste-input');

    // Submit on Enter
    pasteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = pasteInput.value.trim();
        if (text) {
          dropdown.classList.remove('open');
          this.handleDroppedContent({ content: { text }, type: 'text', fileName: 'Pasted text' });
          pasteInput.value = '';
        }
      }
      e.stopPropagation();
    });

    // Prevent menu close when clicking in input
    pasteInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Menu items
    document.getElementById('menu-share').addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.shareViaEmail();
    });

    document.getElementById('menu-settings').addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.renderSettingsStatus();
      this.showModal('settings-modal');
    });
  }

  /**
   * Setup drag-and-drop for email section reordering
   */
  setupEmailSectionDragDrop() {
    const container = document.getElementById('email-sections-sortable');
    if (!container) return;

    // Disable dragging on touch devices to allow scrolling
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      container.querySelectorAll('.sortable-item').forEach(item => {
        item.removeAttribute('draggable');
      });
      return; // Skip drag setup on touch devices
    }

    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.sortable-item');
      if (!item) return;
      
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.section);
    });

    container.addEventListener('dragend', (e) => {
      const item = e.target.closest('.sortable-item');
      if (item) {
        item.classList.remove('dragging');
      }
      // Remove drag-over from all items
      container.querySelectorAll('.sortable-item').forEach(el => {
        el.classList.remove('drag-over');
      });
      draggedItem = null;
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = this.getDragAfterElement(container, e.clientY);
      const currentItem = e.target.closest('.sortable-item');
      
      // Remove drag-over from all items
      container.querySelectorAll('.sortable-item').forEach(el => {
        el.classList.remove('drag-over');
      });
      
      // Add drag-over to the item we're over
      if (currentItem && currentItem !== draggedItem) {
        currentItem.classList.add('drag-over');
      }
    });

    container.addEventListener('dragleave', (e) => {
      const item = e.target.closest('.sortable-item');
      if (item) {
        item.classList.remove('drag-over');
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      
      if (!draggedItem) return;
      
      const afterElement = this.getDragAfterElement(container, e.clientY);
      
      if (afterElement === null) {
        container.appendChild(draggedItem);
      } else {
        container.insertBefore(draggedItem, afterElement);
      }
      
      // Remove all drag states
      container.querySelectorAll('.sortable-item').forEach(el => {
        el.classList.remove('drag-over', 'dragging');
      });
    });
  }

  /**
   * Get the element to insert after based on mouse position
   */
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  /**
   * Process a dropped or selected file
   */
  async processDroppedFile(file) {
    const fileType = this.getFileType(file);
    
    if (!fileType) {
      this.showToast('Unsupported file type', 'error');
      return;
    }

    this.hideModal('settings-modal');
    
    try {
      let content = {};
      
      if (fileType === 'image') {
        content = await this.processImageFile(file);
      } else if (fileType === 'pdf') {
        content = await this.processPDFFile(file);
      } else if (fileType === 'text') {
        content = await this.processTextFile(file);
      } else if (fileType === 'audio') {
        this.showToast('Transcribing audio...', 'info');
        content = await this.processAudioFile(file);
      }

      content.type = fileType;
      content.fileName = file.name;

      this.handleDroppedContent(content);
    } catch (error) {
      this.showToast('Failed to process file: ' + error.message, 'error');
    }
  }

  /**
   * Get file type from file object
   */
  getFileType(file) {
    const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const pdfTypes = ['application/pdf'];
    const textTypes = ['text/plain', 'text/markdown'];
    const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg'];

    if (imageTypes.includes(file.type)) return 'image';
    if (pdfTypes.includes(file.type)) return 'pdf';
    if (textTypes.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt')) return 'text';
    if (audioTypes.includes(file.type) || 
        file.name.endsWith('.mp3') || 
        file.name.endsWith('.wav') || 
        file.name.endsWith('.m4a') ||
        file.name.endsWith('.webm') ||
        file.name.endsWith('.ogg')) return 'audio';
    
    return null;
  }

  /**
   * Process image file
   */
  processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ content: { dataUrl: e.target.result } });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Process PDF file
   */
  async processPDFFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    
    return { content: { text } };
  }

  /**
   * Process text file
   */
  processTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ content: { text: e.target.result } });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Process audio file using OpenAI Whisper API
   */
  async processAudioFile(file) {
    const apiKey = this.settings.openaiApiKey || OPENAI_API_KEY;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Transcription failed: ${error}`);
    }

    const transcript = await response.text();
    return { content: { text: transcript } };
  }

  /**
   * Animate stats with counting effect on load
   */
  animateStatsOnLoad() {
    const statElements = document.querySelectorAll('.stat-value');
    statElements.forEach((el, index) => {
      const finalValue = el.textContent;
      const delay = 300 + (index * 100);
      
      // Start with empty
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      
      setTimeout(() => {
        el.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        
        // Animate numbers if it contains a number
        if (/\$[\d.]+/.test(finalValue)) {
          this.animateNumber(el, finalValue);
        }
      }, delay);
    });
  }

  /**
   * Animate a number with counting effect
   */
  animateNumber(element, finalValue) {
    const match = finalValue.match(/\$([\d.]+)/);
    if (!match) return;
    
    const targetNum = parseFloat(match[1]);
    const suffix = finalValue.replace(/\$[\d.]+/, '').trim();
    const duration = 800;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentNum = (targetNum * eased).toFixed(1);
      
      element.textContent = `$${currentNum}${suffix}`;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = finalValue;
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Setup all UI event listeners
   */
  setupEventListeners() {
    // Hamburger menu
    this.setupMenuDropdown();
    
    // Email section drag-drop reordering
    this.setupEmailSectionDragDrop();

    // Settings modal
    document.getElementById('settings-modal-close').addEventListener('click', () => {
      this.hideModal('settings-modal');
    });

    document.getElementById('toggle-api-key').addEventListener('click', (e) => {
      const input = document.getElementById('api-key');
      if (input.type === 'password') {
        input.type = 'text';
        e.target.textContent = 'Hide';
      } else {
        input.type = 'password';
        e.target.textContent = 'Show';
      }
    });

    document.getElementById('toggle-openai-key').addEventListener('click', (e) => {
      const input = document.getElementById('openai-api-key');
      if (input.type === 'password') {
        input.type = 'text';
        e.target.textContent = 'Hide';
      } else {
        input.type = 'password';
        e.target.textContent = 'Show';
      }
    });

    document.getElementById('settings-save').addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('export-data').addEventListener('click', () => {
      this.exportData();
    });

    // Meeting notes modal
    document.getElementById('add-notes-btn').addEventListener('click', () => {
      this.showNotesModal();
    });

    // Small add buttons for summary and todos
    document.getElementById('add-summary-btn').addEventListener('click', () => {
      this.addNewSummaryItem();
    });

    document.getElementById('add-todo-btn').addEventListener('click', () => {
      const meeting = meetingsManager.getCurrentMeeting();
      if (meeting) {
        this.addNewTodo(meeting.id);
      } else {
        this.showToast('Add meeting notes first', 'info');
      }
    });

    document.getElementById('add-decision-btn').addEventListener('click', () => {
      const meeting = meetingsManager.getCurrentMeeting();
      if (meeting) {
        this.showModal('decision-modal');
        document.getElementById('decision-text').value = '';
        document.getElementById('decision-text').focus();
      } else {
        this.showToast('Add meeting notes first', 'info');
      }
    });

    document.getElementById('decision-modal-close').addEventListener('click', () => {
      this.hideModal('decision-modal');
    });

    document.getElementById('decision-cancel').addEventListener('click', () => {
      this.hideModal('decision-modal');
    });

    document.getElementById('decision-save').addEventListener('click', () => {
      this.saveDecision();
    });

    document.getElementById('add-pipeline-btn').addEventListener('click', () => {
      this.showModal('pipeline-modal');
      document.getElementById('pipeline-name').value = '';
      document.getElementById('pipeline-value').value = '';
      document.getElementById('pipeline-stage').value = 'discovery';
      document.getElementById('pipeline-timing').value = '';
      document.getElementById('pipeline-name').focus();
    });

    document.getElementById('pipeline-modal-close').addEventListener('click', () => {
      this.hideModal('pipeline-modal');
    });

    document.getElementById('pipeline-cancel').addEventListener('click', () => {
      this.hideModal('pipeline-modal');
    });

    document.getElementById('pipeline-save').addEventListener('click', () => {
      this.savePipelineDeal();
    });

    document.getElementById('notes-modal-close').addEventListener('click', () => {
      this.hideModal('notes-modal');
    });

    document.getElementById('notes-cancel').addEventListener('click', () => {
      this.hideModal('notes-modal');
    });

    document.getElementById('notes-process').addEventListener('click', () => {
      this.processMeetingNotes();
    });

    document.getElementById('notes-save-direct').addEventListener('click', () => {
      this.saveMeetingDirectly();
    });

    // Talking point modal
    document.getElementById('add-talking-point-btn').addEventListener('click', () => {
      this.openAddTalkingPoint();
    });

    document.getElementById('talking-point-modal-close').addEventListener('click', () => {
      this.hideModal('talking-point-modal');
    });

    document.getElementById('talking-point-cancel').addEventListener('click', () => {
      this.hideModal('talking-point-modal');
    });

    document.getElementById('talking-point-save').addEventListener('click', () => {
      this.saveTalkingPoint();
    });

    // Link modal
    document.getElementById('add-link-btn').addEventListener('click', () => {
      this.openAddLink();
    });

    document.getElementById('link-modal-close').addEventListener('click', () => {
      this.hideModal('link-modal');
    });

    document.getElementById('link-cancel').addEventListener('click', () => {
      this.hideModal('link-modal');
    });

    document.getElementById('link-save').addEventListener('click', () => {
      this.saveLink();
    });

    document.getElementById('link-delete').addEventListener('click', () => {
      this.deleteLink();
    });

    // Investor modal
    document.getElementById('add-investor-btn').addEventListener('click', () => {
      this.openAddInvestor();
    });

    document.getElementById('investor-modal-close').addEventListener('click', () => {
      this.hideModal('investor-modal');
    });

    document.getElementById('investor-cancel').addEventListener('click', () => {
      this.hideModal('investor-modal');
    });

    document.getElementById('investor-save').addEventListener('click', () => {
      this.saveInvestor();
    });

    document.getElementById('investor-delete').addEventListener('click', () => {
      this.deleteInvestor();
    });

    // Color picker
    document.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
    });

    // Review modal
    document.getElementById('modal-close').addEventListener('click', () => {
      this.hideModal('review-modal');
      this.pendingReview = null;
    });

    document.getElementById('review-reject').addEventListener('click', () => {
      this.hideModal('review-modal');
      this.pendingReview = null;
      this.showToast('Changes rejected', 'info');
    });

    document.getElementById('review-accept').addEventListener('click', () => {
      this.applyPendingChanges();
    });

    // Content action modal
    document.getElementById('content-action-close').addEventListener('click', () => {
      this.hideModal('content-action-modal');
      this.pendingDroppedContent = null;
      this.pendingAnalysis = null;
    });

    document.getElementById('action-save-thought').addEventListener('click', () => {
      this.saveAnalysisToThoughts();
    });

    document.getElementById('action-add-talking-point').addEventListener('click', () => {
      this.addToTalkingPoints();
    });

    // Image preview modal
    document.getElementById('image-preview-close').addEventListener('click', () => {
      this.hideModal('image-preview-modal');
    });

    // Meeting selector
    document.getElementById('meeting-select').addEventListener('change', (e) => {
      if (e.target.value === 'latest') {
        const latest = meetingsManager.getCurrentMeeting();
        if (latest) this.renderMeeting(latest);
      } else {
        const meeting = meetingsManager.setCurrentMeeting(e.target.value);
        if (meeting) this.renderMeeting(meeting);
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideModal(overlay.id);
        }
      });
    });

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.visible').forEach(modal => {
          this.hideModal(modal.id);
        });
      }
    });

    // Collapsible sections
    document.querySelectorAll('.section-header-row.clickable').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't collapse when clicking add button
        if (e.target.closest('.add-btn-small')) return;
        
        const section = header.closest('.meeting-section');
        section.classList.toggle('collapsed');
        
        const toggle = header.querySelector('.collapse-toggle');
        if (toggle) {
          toggle.setAttribute('aria-expanded', !section.classList.contains('collapsed'));
        }
      });
    });
  }

  /**
   * Render all dashboard components
   */
  render() {
    this.renderStats();
    this.renderPipeline();
    this.renderTalkingPoints();
    this.renderThoughts();
    this.renderQuickLinks();
    this.renderSeedRaise();
    this.renderMeetingSelector();
    
    const currentMeeting = meetingsManager.getCurrentMeeting();
    if (currentMeeting) {
      this.renderMeeting(currentMeeting);
    }

    this.renderSettingsStatus();
  }

  /**
   * Render stats row with trend indicators
   */
  renderStats() {
    const stats = this.data.stats;
    const trends = storage.getStatTrends();
    
    // Update stat values
    document.getElementById('stat-pipeline').textContent = 
      stats.find(s => s.id === 'pipeline')?.value || '$1.2M+';
    document.getElementById('stat-prospects').textContent = 
      stats.find(s => s.id === 'prospects')?.value || '10+';
    document.getElementById('stat-partnerships').textContent = 
      stats.find(s => s.id === 'partnerships')?.value || '3';

    // Update closed deals (calculated from pipeline data)
    const closedStats = storage.getClosedDealsStats();
    document.getElementById('stat-closed').textContent = closedStats.count;
    document.getElementById('stat-closed-revenue').textContent = `${closedStats.revenueStr} revenue`;

    // Update trend indicators
    this.updateTrendIndicator('pipeline', trends.pipeline);
    this.updateTrendIndicator('prospects', trends.prospects);
    this.updateTrendIndicator('partnerships', trends.partnerships);
  }

  /**
   * Update a single trend indicator
   */
  updateTrendIndicator(statId, trendData) {
    const trendEl = document.getElementById(`trend-${statId}`);
    if (!trendEl || !trendData) return;

    trendEl.setAttribute('data-trend', trendData.trend);
    
    const changeEl = trendEl.querySelector('.trend-change');
    if (changeEl) {
      changeEl.textContent = trendData.changeDisplay || '';
    }
  }

  /**
   * Render pipeline highlights with staggered animations
   * Shows top deals from both closestToClose and inProgress
   */
  renderPipeline() {
    const container = document.getElementById('pipeline-hot');
    
    // Get all clients from storage (this is the same source as pipeline report)
    const allClients = storage.getAllPipelineClients();
    
    // Sort by stage priority (pilot > validation > demo > discovery) and take top 4
    const stagePriority = { pilot: 4, validation: 3, demo: 2, discovery: 1, partnership: 0 };
    const topDeals = allClients
      .filter(c => c.category !== 'partnerships')
      .sort((a, b) => (stagePriority[b.stage] || 0) - (stagePriority[a.stage] || 0))
      .slice(0, 4);

    container.innerHTML = topDeals.map((deal, index) => {
      const isHot = deal.stage === 'pilot' || deal.stage === 'validation';
      return `
      <div class="pipeline-item ${isHot ? 'hot' : ''}" data-stage="${deal.stage}" style="animation-delay: ${0.4 + index * 0.05}s">
        <div>
          <span class="company">${deal.name}</span>
          <span class="stage">${deal.stage}</span>
        </div>
        <span class="value">${deal.value}</span>
      </div>
    `;
    }).join('');

    // Add staggered entrance animation
    this.animateListItems(container, '.pipeline-item');
  }

  /**
   * Render talking points with full explanations and staggered animations
   */
  renderTalkingPoints() {
    const container = document.getElementById('talking-points');
    const points = this.data.talkingPoints || [];

    if (points.length === 0) {
      container.innerHTML = '<div class="empty-state">No talking points yet. Click + to add one.</div>';
      return;
    }

    container.innerHTML = points.map((point, index) => `
      <div class="talking-point-full" style="animation-delay: ${0.45 + index * 0.05}s" data-index="${index}">
        <div class="talking-point-header">
          <span class="number">${index + 1}</span>
          <span class="title">${point.title}</span>
          <div class="talking-point-actions">
            <button class="edit-btn" onclick="window.dashboard.editTalkingPoint(${index})" title="Edit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="delete-btn" onclick="window.dashboard.deleteTalkingPoint(${index})" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <p class="description">${point.content || point.description || 'Key differentiator for investor conversations.'}</p>
      </div>
    `).join('');

    // Add staggered entrance animation
    this.animateListItems(container, '.talking-point-full');
  }

  /**
   * Render quick links dynamically
   */
  renderQuickLinks() {
    const container = document.getElementById('quick-links-container');
    const links = storage.getQuickLinks();

    const iconMap = {
      globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>`,
      video: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>`,
      document: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>`,
      book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>`,
      link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>`
    };

    // Map old color names to CSS classes
    const colorClassMap = {
      'default': '',
      'red': 'video',
      'blue': 'deck',
      'purple': 'article',
      'green': 'green',
      'orange': 'orange'
    };

    container.innerHTML = links.map(link => {
      const icon = iconMap[link.icon] || iconMap.link;
      const colorClass = colorClassMap[link.color] || link.color || '';
      return `
        <a href="${link.url}" target="_blank" class="quick-link ${colorClass}" data-link-id="${link.id}" onclick="event.preventDefault(); if(event.shiftKey) { window.dashboard.editLink('${link.id}'); } else { window.open('${link.url}', '_blank'); }">
          ${icon}
          <span>${link.name}</span>
        </a>
      `;
    }).join('');
  }

  /**
   * Open add link modal
   */
  openAddLink() {
    this.editingLinkId = null;
    document.getElementById('link-modal-title').textContent = 'Add Link';
    document.getElementById('link-name').value = '';
    document.getElementById('link-url').value = '';
    document.getElementById('link-email-label').value = '';
    document.getElementById('link-email-enabled').checked = true;
    document.getElementById('link-delete').style.display = 'none';
    
    // Reset color picker
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.color-option.default').classList.add('selected');
    
    this.showModal('link-modal');
  }

  /**
   * Edit a link
   */
  editLink(id) {
    const links = storage.getQuickLinks();
    const link = links.find(l => l.id === id);
    if (!link) return;

    this.editingLinkId = id;
    document.getElementById('link-modal-title').textContent = 'Edit Link';
    document.getElementById('link-name').value = link.name;
    document.getElementById('link-url').value = link.url;
    document.getElementById('link-email-label').value = link.emailLabel || '';
    document.getElementById('link-email-enabled').checked = link.emailEnabled !== false;
    document.getElementById('link-delete').style.display = 'block';
    
    // Set color picker
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    const colorOption = document.querySelector(`.color-option.${link.color || 'default'}`);
    if (colorOption) colorOption.classList.add('selected');
    
    this.showModal('link-modal');
  }

  /**
   * Save link
   */
  saveLink() {
    const name = document.getElementById('link-name').value.trim();
    const url = document.getElementById('link-url').value.trim();
    const emailLabel = document.getElementById('link-email-label').value.trim();
    const emailEnabled = document.getElementById('link-email-enabled').checked;
    const selectedColor = document.querySelector('.color-option.selected');
    const color = selectedColor ? selectedColor.dataset.color : 'default';

    if (!name || !url) {
      this.showToast('Please enter a name and URL', 'error');
      return;
    }

    // Determine icon based on URL
    let icon = 'link';
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) {
      icon = 'video';
    } else if (url.includes('docsend.com') || url.includes('docs.google.com') || url.includes('.pdf')) {
      icon = 'document';
    } else if (url.includes('medium.com') || url.includes('a16z.com') || url.includes('substack.com')) {
      icon = 'book';
    } else if (url.includes('.io') || url.includes('.com') || url.includes('.co')) {
      icon = 'globe';
    }

    const linkData = {
      name,
      url,
      icon,
      color,
      emailEnabled,
      emailLabel: emailLabel || name
    };

    if (this.editingLinkId) {
      storage.updateQuickLink(this.editingLinkId, linkData);
      this.showToast('Link updated', 'success');
    } else {
      storage.addQuickLink(linkData);
      this.showToast('Link added', 'success');
    }

    this.data = storage.getData();
    this.hideModal('link-modal');
    this.renderQuickLinks();
    this.renderSettingsStatus(); // Refresh email link toggles
  }

  /**
   * Delete a link with optimistic UI update
   */
  deleteLink() {
    if (!this.editingLinkId) return;
    
    if (confirm('Are you sure you want to delete this link?')) {
      const linkId = this.editingLinkId;
      
      // Close modal immediately
      this.hideModal('link-modal');
      
      // Optimistic: Animate removal
      const link = document.querySelector(`.quick-link[data-link-id="${linkId}"]`);
      if (link) {
        link.style.opacity = '0';
        link.style.transform = 'scale(0.9)';
        link.style.transition = 'all 0.15s ease-out';
      }
      
      this.showToast('Link deleted', 'success');
      
      // Persist and re-render after animation
      setTimeout(() => {
        storage.deleteQuickLink(linkId);
        this.data = storage.getData();
        this.renderQuickLinks();
        this.renderSettingsStatus();
      }, 150);
    }
  }

  /**
   * Render seed raise funnel section
   */
  renderSeedRaise() {
    const seedRaise = storage.getSeedRaise();
    const investors = seedRaise.investors || [];
    const stages = ['interested', 'inTalks', 'committed', 'closed'];
    
    // Calculate progress (committed + closed amounts)
    const { raised, percent } = this.calculateRaiseProgress(investors, seedRaise.target);
    
    // Update progress display
    document.getElementById('seed-raised').textContent = raised;
    document.getElementById('seed-target').textContent = seedRaise.target;
    document.getElementById('seed-percent').textContent = `${percent}%`;
    document.getElementById('seed-progress-fill').style.width = `${Math.min(percent, 100)}%`;
    
    // Render each column
    stages.forEach(stage => {
      const container = document.getElementById(`stage-${stage}`);
      const stageInvestors = investors.filter(inv => inv.stage === stage);
      const countEl = document.getElementById(`count-${stage}`);
      const totalEl = document.getElementById(`total-${stage}`);
      
      if (countEl) {
        countEl.textContent = `(${stageInvestors.length})`;
      }
      
      // Calculate and display stage total
      if (totalEl) {
        const stageTotal = stageInvestors.reduce((sum, inv) => sum + this.parseAmount(inv.amount), 0);
        if (stageTotal > 0) {
          if (stageTotal >= 1000000) {
            totalEl.textContent = `$${(stageTotal / 1000000).toFixed(1)}M`;
          } else if (stageTotal >= 1000) {
            totalEl.textContent = `$${Math.round(stageTotal / 1000)}K`;
          } else {
            totalEl.textContent = `$${stageTotal}`;
          }
        } else {
          totalEl.textContent = '';
        }
      }
      
      if (stageInvestors.length === 0) {
        container.innerHTML = '<div class="empty-state drop-hint">Drop here</div>';
      } else {
        container.innerHTML = stageInvestors.map(inv => `
          <div class="investor-card" data-id="${inv.id}" draggable="true">
            <div class="investor-info">
              <span class="investor-name">${inv.name}</span>
              <span class="investor-amount">${inv.amount}</span>
              ${inv.notes ? `<span class="investor-notes">${inv.notes}</span>` : ''}
            </div>
          </div>
        `).join('');
      }
    });

    // Setup drag and drop
    this.setupInvestorDragDrop();
  }

  /**
   * Setup drag and drop for investor cards
   */
  setupInvestorDragDrop() {
    const cards = document.querySelectorAll('.investor-card[draggable="true"]');
    const columns = document.querySelectorAll('.column-items');

    // Disable dragging on touch devices to allow scrolling
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      cards.forEach(card => {
        card.removeAttribute('draggable');
        card.addEventListener('click', () => this.editInvestor(card.dataset.id));
      });
      return; // Skip drag setup on touch devices
    }

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.column-items').forEach(col => {
          col.classList.remove('drag-over');
        });
      });

      // Click to edit (not drag)
      card.addEventListener('click', (e) => {
        if (!card.classList.contains('dragging')) {
          this.editInvestor(card.dataset.id);
        }
      });
    });

    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', (e) => {
        // Only remove if leaving the column entirely
        if (!column.contains(e.relatedTarget)) {
          column.classList.remove('drag-over');
        }
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        const investorId = e.dataTransfer.getData('text/plain');
        const newStage = column.id.replace('stage-', '');
        
        if (investorId && newStage) {
          this.moveInvestorToStage(investorId, newStage);
        }
      });
    });
  }

  /**
   * Move investor to a new stage with optimistic UI update
   */
  moveInvestorToStage(investorId, newStage) {
    const seedRaise = storage.getSeedRaise();
    const investor = seedRaise.investors.find(inv => inv.id === investorId);
    
    if (!investor || investor.stage === newStage) return;

    // Optimistic: Move DOM element immediately
    const card = document.querySelector(`.investor-card[data-investor-id="${investorId}"]`);
    const targetColumn = document.getElementById(`stage-${newStage}`);
    
    if (card && targetColumn) {
      // Animate the move
      card.style.opacity = '0.5';
      card.style.transform = 'scale(0.95)';
      
      requestAnimationFrame(() => {
        targetColumn.appendChild(card);
        card.style.opacity = '';
        card.style.transform = '';
      });
    }

    // Persist in background
    storage.updateInvestor(investorId, { stage: newStage });
    this.data = storage.getData();
    
    // Delayed re-render to update totals and sync state
    setTimeout(() => this.renderSeedRaise(), 150);
    this.showToast(`Moved to ${this.formatStageName(newStage)}`, 'success');
  }

  /**
   * Setup drag and drop for todo items between owner groups
   */
  setupTodoDragDrop(meetingId) {
    const todoItems = document.querySelectorAll('.todo-item[draggable="true"]');
    const todoGroups = document.querySelectorAll('.todo-group-items');

    // Disable dragging on touch devices to allow scrolling
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      todoItems.forEach(item => item.removeAttribute('draggable'));
      return; // Skip drag setup on touch devices
    }

    todoItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.todoId);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        todoGroups.forEach(group => group.classList.remove('drag-over'));
      });
    });

    todoGroups.forEach(group => {
      group.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        group.classList.add('drag-over');
      });

      group.addEventListener('dragleave', (e) => {
        if (!group.contains(e.relatedTarget)) {
          group.classList.remove('drag-over');
        }
      });

      group.addEventListener('drop', (e) => {
        e.preventDefault();
        group.classList.remove('drag-over');
        
        const todoId = e.dataTransfer.getData('text/plain');
        const newOwner = group.closest('.todo-group').dataset.owner;
        
        if (todoId && newOwner) {
          this.moveTodoToOwner(meetingId, todoId, newOwner);
        }
      });
    });
  }

  /**
   * Move todo to a new owner with optimistic UI update
   */
  moveTodoToOwner(meetingId, todoId, newOwner) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.todos) return;

    const todo = meeting.todos.find(t => t.id === todoId);
    if (!todo || this.resolveOwnerName(todo.owner) === newOwner) return;

    // Optimistic: Move DOM element immediately
    const todoEl = document.querySelector(`[data-todo-id="${todoId}"]`);
    const targetGroup = document.querySelector(`.todo-group[data-owner="${newOwner}"] .todo-group-items`);
    
    if (todoEl && targetGroup) {
      // Animate the move
      todoEl.style.opacity = '0.5';
      todoEl.style.transform = 'scale(0.95)';
      
      requestAnimationFrame(() => {
        targetGroup.appendChild(todoEl);
        todoEl.style.opacity = '';
        todoEl.style.transform = '';
        
        // Update the owner badge in the UI
        const ownerBadge = todoEl.querySelector('.todo-owner-edit');
        if (ownerBadge) {
          ownerBadge.textContent = newOwner;
        }
      });
    }

    // Persist in background and do full re-render to sync state
    todo.owner = newOwner;
    meetingsManager.updateMeeting(meeting);
    
    // Delayed re-render to ensure data consistency
    setTimeout(() => this.renderMeeting(meeting), 150);
    this.showToast(`Moved to ${newOwner}`, 'success');
  }

  /**
   * Format stage name for display
   */
  formatStageName(stage) {
    const names = {
      interested: 'Interested',
      inTalks: 'In Talks',
      committed: 'Committed',
      closed: 'Closed'
    };
    return names[stage] || stage;
  }

  /**
   * Calculate raise progress from committed and closed investors
   */
  calculateRaiseProgress(investors, target) {
    // Parse target
    const targetNum = this.parseAmount(target);
    
    // Sum committed and closed amounts
    let raisedNum = 0;
    investors.forEach(inv => {
      if (inv.stage === 'committed' || inv.stage === 'closed') {
        raisedNum += this.parseAmount(inv.amount);
      }
    });
    
    // Format raised amount
    let raised = '$0';
    if (raisedNum >= 1000000) {
      raised = `$${(raisedNum / 1000000).toFixed(1)}M`;
    } else if (raisedNum >= 1000) {
      raised = `$${Math.round(raisedNum / 1000)}K`;
    } else if (raisedNum > 0) {
      raised = `$${raisedNum}`;
    }
    
    // Calculate percent
    const percent = targetNum > 0 ? Math.round((raisedNum / targetNum) * 100) : 0;
    
    return { raised, raisedNum, percent };
  }

  /**
   * Parse amount string to number
   */
  parseAmount(amount) {
    if (!amount || amount === '$TBD') return 0;
    const match = String(amount).match(/\$?([\d.]+)([KMB])?/i);
    if (!match) return 0;
    let num = parseFloat(match[1]);
    const suffix = (match[2] || '').toUpperCase();
    if (suffix === 'K') num *= 1000;
    else if (suffix === 'M') num *= 1000000;
    else if (suffix === 'B') num *= 1000000000;
    return num;
  }

  /**
   * Open add investor modal
   */
  openAddInvestor() {
    this.editingInvestorId = null;
    document.getElementById('investor-modal-title').textContent = 'Add Investor';
    document.getElementById('investor-name').value = '';
    document.getElementById('investor-amount').value = '';
    document.getElementById('investor-stage').value = 'interested';
    document.getElementById('investor-notes').value = '';
    document.getElementById('investor-delete').style.display = 'none';
    this.showModal('investor-modal');
    document.getElementById('investor-name').focus();
  }

  /**
   * Edit an existing investor
   */
  editInvestor(id) {
    const seedRaise = storage.getSeedRaise();
    const investor = seedRaise.investors.find(inv => inv.id === id);
    if (!investor) return;
    
    this.editingInvestorId = id;
    document.getElementById('investor-modal-title').textContent = 'Edit Investor';
    document.getElementById('investor-name').value = investor.name;
    document.getElementById('investor-amount').value = investor.amount;
    document.getElementById('investor-stage').value = investor.stage;
    document.getElementById('investor-notes').value = investor.notes || '';
    document.getElementById('investor-delete').style.display = 'block';
    this.showModal('investor-modal');
  }

  /**
   * Save investor (add or update)
   */
  saveInvestor() {
    const name = document.getElementById('investor-name').value.trim();
    const amount = document.getElementById('investor-amount').value.trim();
    const stage = document.getElementById('investor-stage').value;
    const notes = document.getElementById('investor-notes').value.trim();
    
    if (!name) {
      this.showToast('Please enter an investor name', 'error');
      return;
    }
    
    if (this.editingInvestorId) {
      // Update existing
      storage.updateInvestor(this.editingInvestorId, { name, amount: amount || '$TBD', stage, notes });
      this.showToast('Investor updated', 'success');
    } else {
      // Add new
      storage.addInvestor({ name, amount: amount || '$TBD', stage, notes });
      this.showToast('Investor added', 'success');
    }
    
    this.data = storage.getData();
    this.hideModal('investor-modal');
    this.renderSeedRaise();
  }

  /**
   * Delete an investor with optimistic UI update
   */
  deleteInvestor() {
    if (!this.editingInvestorId) return;
    
    if (confirm('Are you sure you want to delete this investor?')) {
      const investorId = this.editingInvestorId;
      
      // Close modal immediately
      this.hideModal('investor-modal');
      
      // Optimistic: Animate card removal
      const card = document.querySelector(`.investor-card[data-investor-id="${investorId}"]`);
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        card.style.transition = 'all 0.15s ease-out';
      }
      
      this.showToast('Investor deleted', 'success');
      
      // Persist and re-render after animation
      setTimeout(() => {
        storage.deleteInvestor(investorId);
        this.data = storage.getData();
        this.renderSeedRaise();
      }, 150);
    }
  }


  /**
   * Animate list items with stagger effect
   */
  animateListItems(container, selector) {
    const items = container.querySelectorAll(selector);
    items.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(-10px)';
      
      setTimeout(() => {
        item.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      }, 400 + index * 60);
    });
  }

  /**
   * Refresh pipeline view
   */
  refreshPipelineViews() {
    this.renderPipeline();
  }

  /**
   * Share weekly update via email
   */
  shareViaEmail() {
    const data = this.data;
    const stats = data.stats;
    const talkingPoints = data.talkingPoints;
    
    // Get email settings with defaults
    const emailSettings = this.settings.email || {};
    const sectionOrder = emailSettings.sectionOrder || ['metrics', 'pipeline', 'talkingPoints', 'highlights', 'decisions', 'actionItems'];
    const sections = emailSettings.sections || {
      metrics: true, pipeline: true, talkingPoints: true,
      highlights: true, decisions: true, actionItems: true
    };
    const counts = emailSettings.counts || { pipelineDeals: 5, talkingPoints: 4 };
    const signature = emailSettings.signature || 'JG';
    const greeting = emailSettings.greeting || '';

    // Get current week range
    const weekRange = this.getWeekRange(new Date());

    // Get current meeting data
    const meeting = meetingsManager.getCurrentMeeting();

    // Get top pipeline deals
    const allClients = storage.getAllPipelineClients();
    const stagePriority = { pilot: 4, validation: 3, demo: 2, discovery: 1, partnership: 0 };
    const topDeals = allClients
      .filter(c => c.category !== 'partnerships')
      .sort((a, b) => (stagePriority[b.stage] || 0) - (stagePriority[a.stage] || 0))
      .slice(0, counts.pipelineDeals);

    // Section renderers
    const sectionRenderers = {
      metrics: () => {
        let content = 'KEY METRICS\n';
        stats.forEach(stat => {
          content += `- ${stat.label}: ${stat.value}\n`;
        });
        return content + '\n---\n\n';
      },
      pipeline: () => {
        const pipelineTotal = data.pipeline?.totalValue || '$1.2M+';
        let content = `PIPELINE HOT (${pipelineTotal})\n`;
        topDeals.forEach((deal, i) => {
          content += `${i + 1}. ${deal.name} - ${deal.stage} - ${deal.value}\n`;
        });
        return content + '\n---\n\n';
      },
      talkingPoints: () => {
        if (!talkingPoints || talkingPoints.length === 0) return '';
        let content = 'KEY TALKING POINTS\n';
        talkingPoints.slice(0, counts.talkingPoints).forEach((point, i) => {
          content += `${i + 1}. ${point.title}\n`;
          if (point.content) {
            content += `   ${point.content}\n`;
          }
        });
        return content + '\n---\n\n';
      },
      highlights: () => {
        let content = "THIS WEEK'S HIGHLIGHTS\n";
        if (meeting?.summary && meeting.summary.length > 0) {
          meeting.summary.forEach(item => {
            content += `- ${item}\n`;
          });
        } else {
          content += '- No highlights recorded\n';
        }
        return content + '\n---\n\n';
      },
      decisions: () => {
        let content = 'KEY DECISIONS\n';
        if (meeting?.decisions && meeting.decisions.length > 0) {
          meeting.decisions.forEach(decision => {
            content += `- ${decision}\n`;
          });
        } else {
          content += '- No decisions recorded\n';
        }
        return content + '\n---\n\n';
      },
      actionItems: () => {
        let content = 'ACTION ITEMS\n';
        if (meeting?.todos && meeting.todos.length > 0) {
          const todosByOwner = {};
          meeting.todos.forEach(todo => {
            const owner = this.resolveOwnerName(todo.owner);
            if (!todosByOwner[owner]) {
              todosByOwner[owner] = [];
            }
            todosByOwner[owner].push(todo);
          });
          Object.entries(todosByOwner).forEach(([owner, todos]) => {
            content += `\n${owner}:\n`;
            todos.forEach(todo => {
              const checkbox = todo.completed ? '[x]' : '[ ]';
              content += `${checkbox} ${todo.text}\n`;
            });
          });
        } else {
          content += '- No action items\n';
        }
        return content + '\n---\n\n';
      }
    };

    // Build email body
    let body = '';

    // Header
    body += 'GLOSSI\n';
    body += `Weekly Update - ${weekRange}\n\n`;
    
    // Custom greeting if provided
    if (greeting) {
      body += `${greeting}\n\n`;
    }
    
    body += '---\n\n';

    // Render sections in configured order
    sectionOrder.forEach(sectionKey => {
      if (sections[sectionKey] && sectionRenderers[sectionKey]) {
        body += sectionRenderers[sectionKey]();
      }
    });

    // Footer with signature
    body += 'Best,\n';
    body += `${signature}\n\n`;
    
    // Links - dynamically from quickLinks
    const quickLinks = storage.getQuickLinks();
    const enabledLinks = quickLinks.filter(link => link.emailEnabled !== false);
    
    if (enabledLinks.length > 0) {
      body += '---\n';
      enabledLinks.forEach((link, index) => {
        const label = link.emailLabel || link.name;
        body += `${label}: ${link.url}`;
        if (index < enabledLinks.length - 1) body += '\n';
      });
    }

    // Open default email app (Outlook)
    const subject = `Glossi Weekly Update - ${weekRange}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.location.href = mailtoLink;
    this.showToast('Opening Outlook...', 'success');
  }

  /**
   * Render meeting selector dropdown
   */
  renderMeetingSelector() {
    const select = document.getElementById('meeting-select');
    const meetings = meetingsManager.getAllMeetings();
    
    console.log('Rendering meeting selector, meetings:', meetings.length);

    // Get current week range
    const thisWeekRange = this.getWeekRange(new Date());
    const thisWeekKey = this.getWeekKey(new Date());

    // Group meetings by week, keeping only the most recent per week
    const weekMap = new Map();
    meetings.forEach(meeting => {
      const meetingDate = new Date(meeting.date);
      const weekKey = this.getWeekKey(meetingDate);
      const weekRange = this.getWeekRange(meetingDate);
      
      // Skip if this is the current week (handled separately)
      if (weekKey === thisWeekKey) return;
      
      // Keep only the most recent meeting per week
      if (!weekMap.has(weekKey) || new Date(meeting.date) > new Date(weekMap.get(weekKey).date)) {
        weekMap.set(weekKey, { meeting, weekRange });
      }
    });

    // Check if there's a meeting this week
    const thisWeekMeeting = meetings.find(m => this.getWeekKey(new Date(m.date)) === thisWeekKey);
    
    // Build select options
    select.innerHTML = `<option value="latest">${thisWeekRange}${thisWeekMeeting ? '' : ' (empty)'}</option>`;

    // Add past weeks (sorted by date, most recent first)
    const sortedWeeks = Array.from(weekMap.entries())
      .sort((a, b) => new Date(b[1].meeting.date) - new Date(a[1].meeting.date));
    
    sortedWeeks.forEach(([weekKey, { meeting, weekRange }]) => {
      select.innerHTML += `<option value="${meeting.id}">${weekRange}</option>`;
    });
  }

  /**
   * Get week key for grouping (e.g., "2026-W05")
   */
  getWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  /**
   * Get week range string (e.g., "Jan 27 - Feb 2")
   */
  getWeekRange(date) {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (d) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    };
    
    return `${formatDate(monday)} - ${formatDate(sunday)}`;
  }

  /**
   * Render a meeting
   */
  renderMeeting(meeting) {
    if (!meeting) {
      this.renderEmptyMeeting();
      return;
    }

    // Store current meeting ID for editing
    this.currentMeetingId = meeting.id;

    // Progress
    const progress = meetingsManager.getTodoProgress(meeting);
    document.getElementById('todo-progress').textContent = 
      `${progress.completed}/${progress.total} complete`;
    
    // Update progress bar
    const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
    document.getElementById('action-progress-fill').style.width = `${percentage}%`;
    const statusEl = document.getElementById('meeting-status');
    if (progress.completed > 0) {
      statusEl.classList.add('has-progress');
    } else {
      statusEl.classList.remove('has-progress');
    }

    // Summary (editable with delete)
    const summaryContainer = document.getElementById('meeting-summary');
    const summaryCount = meeting.summary?.length || 0;
    document.getElementById('summary-count').textContent = summaryCount > 0 ? summaryCount : '';
    
    if (summaryCount > 0) {
      summaryContainer.innerHTML = meeting.summary.map((item, index) => 
        `<li class="deletable-item">
          <span class="editable-item" contenteditable="true" data-type="summary" data-index="${index}">${item}</span>
          <button class="delete-btn" onclick="window.dashboard.deleteSummaryItem('${meeting.id}', ${index})" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </li>`
      ).join('');
      this.setupEditableListeners(summaryContainer, 'summary', meeting.id);
    } else {
      summaryContainer.innerHTML = '<li class="empty-state">No summary yet.</li>';
    }

    // Todos (grouped by owner, editable)
    const todoContainer = document.getElementById('todo-list');
    if (meeting.todos && meeting.todos.length > 0) {
      // Group todos by resolved owner name
      const todosByOwner = {};
      meeting.todos.forEach(todo => {
        const owner = this.resolveOwnerName(todo.owner);
        if (!todosByOwner[owner]) {
          todosByOwner[owner] = [];
        }
        todosByOwner[owner].push(todo);
      });

      // Render grouped todos
      let html = '';
      Object.entries(todosByOwner).forEach(([owner, todos]) => {
        html += `
          <div class="todo-group" data-owner="${owner}">
            <div class="todo-group-header">${owner}</div>
            <div class="todo-group-items">
              ${todos.map(todo => `
                <div class="todo-item ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}" draggable="true">
                  <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" onclick="window.dashboard.toggleTodo('${meeting.id}', '${todo.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div class="todo-content">
                    <span class="todo-text editable-item" contenteditable="true" data-type="todo-text" data-todo-id="${todo.id}">${todo.text}</span>
                    <span class="todo-owner-edit editable-item" contenteditable="true" data-type="todo-owner" data-todo-id="${todo.id}" title="Click to change assignee">${this.resolveOwnerName(todo.owner)}</span>
                  </div>
                  <button class="delete-btn" onclick="window.dashboard.deleteTodo('${meeting.id}', '${todo.id}')" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
      
      todoContainer.innerHTML = html;
      this.setupTodoEditListeners(todoContainer, meeting.id);
      this.setupTodoDragDrop(meeting.id);
    } else {
      todoContainer.innerHTML = '<div class="empty-state">No action items yet.</div>';
    }

    // Decisions (editable with delete)
    const decisionsContainer = document.getElementById('decisions-list');
    const decisionsCount = meeting.decisions?.length || 0;
    document.getElementById('decisions-count').textContent = decisionsCount > 0 ? decisionsCount : '';
    
    if (decisionsCount > 0) {
      decisionsContainer.innerHTML = meeting.decisions.map((decision, index) => 
        `<li class="deletable-item">
          <span class="editable-item" contenteditable="true" data-type="decision" data-index="${index}">${decision}</span>
          <button class="delete-btn" onclick="window.dashboard.deleteDecision('${meeting.id}', ${index})" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </li>`
      ).join('');
      this.setupEditableListeners(decisionsContainer, 'decision', meeting.id);
    } else {
      decisionsContainer.innerHTML = '<li class="empty-state">No decisions recorded.</li>';
    }
  }

  /**
   * Setup editable listeners for summary and decisions
   */
  setupEditableListeners(container, type, meetingId) {
    const items = container.querySelectorAll('.editable-item');
    items.forEach(item => {
      // Save on blur
      item.addEventListener('blur', (e) => {
        const index = parseInt(e.target.dataset.index);
        const newValue = e.target.textContent.trim();
        this.updateMeetingField(meetingId, type, index, newValue);
      });

      // Save on Enter (prevent newline)
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });

      // Visual feedback on focus
      item.addEventListener('focus', (e) => {
        e.target.classList.add('editing');
      });

      item.addEventListener('blur', (e) => {
        e.target.classList.remove('editing');
      });
    });
  }

  /**
   * Setup editable listeners for todo items
   */
  setupTodoEditListeners(container, meetingId) {
    const editables = container.querySelectorAll('.editable-item');
    editables.forEach(item => {
      item.addEventListener('blur', (e) => {
        const todoId = e.target.dataset.todoId;
        const type = e.target.dataset.type;
        const newValue = e.target.textContent.trim();
        
        if (type === 'todo-text') {
          this.updateTodoText(meetingId, todoId, newValue);
        } else if (type === 'todo-owner') {
          this.updateTodoOwner(meetingId, todoId, newValue);
          // Re-render to regroup by owner
          const meeting = meetingsManager.getMeeting(meetingId);
          if (meeting) {
            this.renderMeeting(meeting);
          }
        }
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });

      item.addEventListener('focus', (e) => {
        e.target.classList.add('editing');
      });

      item.addEventListener('blur', (e) => {
        e.target.classList.remove('editing');
      });
    });
  }

  /**
   * Update a meeting field (summary or decision)
   */
  updateMeetingField(meetingId, type, index, newValue) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting) return;

    if (type === 'summary') {
      if (!meeting.summary) meeting.summary = [];
      meeting.summary[index] = newValue;
    } else if (type === 'decision') {
      if (!meeting.decisions) meeting.decisions = [];
      meeting.decisions[index] = newValue;
    }

    meetingsManager.updateMeeting(meeting);
  }

  /**
   * Update todo text
   */
  updateTodoText(meetingId, todoId, newText) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.todos) return;

    const todo = meeting.todos.find(t => t.id === todoId);
    if (todo) {
      todo.text = newText;
      meetingsManager.updateMeeting(meeting);
    }
  }

  /**
   * Update todo owner
   */
  updateTodoOwner(meetingId, todoId, newOwner) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.todos) return;

    const todo = meeting.todos.find(t => t.id === todoId);
    if (todo) {
      // Resolve alias to full name
      todo.owner = this.resolveOwnerName(newOwner);
      meetingsManager.updateMeeting(meeting);
    }
  }

  /**
   * Delete a summary item with optimistic UI update
   */
  deleteSummaryItem(meetingId, index) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.summary) return;

    // Optimistic: Animate removal immediately
    const summaryItems = document.querySelectorAll('#meeting-summary .deletable-item');
    const itemEl = summaryItems[index];
    if (itemEl) {
      itemEl.style.opacity = '0';
      itemEl.style.transform = 'translateX(-10px)';
      itemEl.style.transition = 'all 0.15s ease-out';
    }

    // Persist and re-render after animation
    setTimeout(() => {
      meeting.summary.splice(index, 1);
      meetingsManager.updateMeeting(meeting);
      this.renderMeeting(meeting);
    }, 150);
    this.showToast('Summary item deleted', 'success');
  }

  /**
   * Delete a decision with optimistic UI update
   */
  deleteDecision(meetingId, index) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.decisions) return;

    // Optimistic: Animate removal immediately
    const decisionItems = document.querySelectorAll('#decisions-list .deletable-item');
    const itemEl = decisionItems[index];
    if (itemEl) {
      itemEl.style.opacity = '0';
      itemEl.style.transform = 'translateX(-10px)';
      itemEl.style.transition = 'all 0.15s ease-out';
    }

    // Persist and re-render after animation
    setTimeout(() => {
      meeting.decisions.splice(index, 1);
      meetingsManager.updateMeeting(meeting);
      this.renderMeeting(meeting);
    }, 150);
    this.showToast('Decision deleted', 'success');
  }

  /**
   * Delete a todo item with optimistic UI update
   */
  deleteTodo(meetingId, todoId) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.todos) return;

    const index = meeting.todos.findIndex(t => t.id === todoId);
    if (index === -1) return;

    // Optimistic: Animate removal immediately
    const todoEl = document.querySelector(`[data-todo-id="${todoId}"]`);
    if (todoEl) {
      todoEl.style.opacity = '0';
      todoEl.style.transform = 'translateX(-10px)';
      todoEl.style.transition = 'all 0.15s ease-out';
    }

    // Update progress immediately
    const todo = meeting.todos[index];
    const totalBefore = meeting.todos.length;
    const completedBefore = meeting.todos.filter(t => t.completed).length;
    const newTotal = totalBefore - 1;
    const newCompleted = todo.completed ? completedBefore - 1 : completedBefore;
    
    document.getElementById('todo-progress').textContent = 
      `${newCompleted}/${newTotal} complete`;
    const percentage = newTotal > 0 ? (newCompleted / newTotal) * 100 : 0;
    document.getElementById('action-progress-fill').style.width = `${percentage}%`;

    // Persist and re-render after animation
    setTimeout(() => {
      meeting.todos.splice(index, 1);
      meetingsManager.updateMeeting(meeting);
      this.renderMeeting(meeting);
    }, 150);
    this.showToast('Action item deleted', 'success');
  }

  /**
   * Save a new decision
   */
  saveDecision() {
    const text = document.getElementById('decision-text').value.trim();
    if (!text) {
      this.showToast('Please enter a decision', 'error');
      return;
    }

    const meeting = meetingsManager.getCurrentMeeting();
    if (!meeting) return;

    if (!meeting.decisions) {
      meeting.decisions = [];
    }
    meeting.decisions.push(text);
    meetingsManager.updateMeeting(meeting);
    
    this.hideModal('decision-modal');
    this.renderMeeting(meeting);
    this.showToast('Decision added', 'success');
  }

  /**
   * Save a new pipeline deal
   */
  savePipelineDeal() {
    const name = document.getElementById('pipeline-name').value.trim();
    const value = document.getElementById('pipeline-value').value.trim();
    const stage = document.getElementById('pipeline-stage').value;
    const timing = document.getElementById('pipeline-timing').value.trim();

    if (!name) {
      this.showToast('Please enter a company name', 'error');
      return;
    }

    storage.addDeal('inProgress', {
      name,
      value: value || '$TBD',
      stage,
      timing: timing || 'TBD'
    });

    this.data = storage.getData();
    this.hideModal('pipeline-modal');
    this.renderPipeline();
    this.showToast('Pipeline deal added', 'success');
  }

  /**
   * Open modal to add a new talking point
   */
  openAddTalkingPoint() {
    this.editingTalkingPointIndex = null;
    document.getElementById('talking-point-modal-title').textContent = 'Add Talking Point';
    document.getElementById('talking-point-title').value = '';
    document.getElementById('talking-point-content').value = '';
    this.showModal('talking-point-modal');
  }

  /**
   * Open modal to edit an existing talking point
   */
  editTalkingPoint(index) {
    const points = this.data.talkingPoints || [];
    if (index < 0 || index >= points.length) return;

    const point = points[index];
    this.editingTalkingPointIndex = index;
    document.getElementById('talking-point-modal-title').textContent = 'Edit Talking Point';
    document.getElementById('talking-point-title').value = point.title || '';
    document.getElementById('talking-point-content').value = point.content || point.description || '';
    this.showModal('talking-point-modal');
  }

  /**
   * Save talking point (add or update)
   */
  saveTalkingPoint() {
    const title = document.getElementById('talking-point-title').value.trim();
    const content = document.getElementById('talking-point-content').value.trim();

    if (!title) {
      this.showToast('Please enter a title', 'error');
      return;
    }

    if (this.editingTalkingPointIndex !== null) {
      storage.updateTalkingPoint(this.editingTalkingPointIndex, title, content);
      this.showToast('Talking point updated', 'success');
    } else {
      storage.addTalkingPoint(title, content);
      this.showToast('Talking point added', 'success');
    }

    this.data = storage.getData();
    this.hideModal('talking-point-modal');
    this.renderTalkingPoints();
  }

  /**
   * Delete a talking point with optimistic UI update
   */
  deleteTalkingPoint(index) {
    if (confirm('Delete this talking point?')) {
      // Optimistic: Animate removal
      const cards = document.querySelectorAll('#key-talking-points .talking-point-card');
      const card = cards[index];
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        card.style.transition = 'all 0.15s ease-out';
      }
      
      this.showToast('Talking point deleted', 'success');
      
      // Persist and re-render after animation
      setTimeout(() => {
        storage.deleteTalkingPoint(index);
        this.data = storage.getData();
        this.renderTalkingPoints();
      }, 150);
    }
  }

  /**
   * Add a new summary item
   */
  addNewSummaryItem() {
    const meeting = meetingsManager.getCurrentMeeting();
    if (!meeting) {
      this.showToast('Add meeting notes first', 'info');
      return;
    }

    if (!meeting.summary) {
      meeting.summary = [];
    }

    meeting.summary.push('New summary point');
    meetingsManager.updateMeeting(meeting);
    
    // Re-render and focus the new item
    this.renderMeeting(meeting);
    
    // Focus the new summary item
    setTimeout(() => {
      const summaryItems = document.querySelectorAll('#meeting-summary .editable-item');
      const newItem = summaryItems[summaryItems.length - 1];
      if (newItem) {
        newItem.focus();
        const range = document.createRange();
        range.selectNodeContents(newItem);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 50);
  }

  /**
   * Add a new todo item
   */
  addNewTodo(meetingId) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting) return;

    if (!meeting.todos) {
      meeting.todos = [];
    }

    // Create new todo
    const newTodo = {
      id: `todo-${Date.now()}`,
      text: 'New action item',
      owner: 'Unassigned',
      completed: false
    };

    meeting.todos.push(newTodo);
    meetingsManager.updateMeeting(meeting);
    
    // Re-render and focus the new item
    this.renderMeeting(meeting);
    
    // Focus the new todo text for immediate editing
    setTimeout(() => {
      const newTodoEl = document.querySelector(`[data-todo-id="${newTodo.id}"] .todo-text`);
      if (newTodoEl) {
        newTodoEl.focus();
        // Select all text for easy replacement
        const range = document.createRange();
        range.selectNodeContents(newTodoEl);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 50);
  }

  /**
   * Render empty meeting state
   */
  renderEmptyMeeting() {
    document.getElementById('todo-progress').textContent = '0/0 complete';
    document.getElementById('action-progress-fill').style.width = '0%';
    document.getElementById('meeting-status').classList.remove('has-progress');
    document.getElementById('meeting-summary').innerHTML = 
      '<li class="empty-state">No meeting notes yet. Click + to add notes.</li>';
    document.getElementById('todo-list').innerHTML = 
      '<div class="empty-state">No action items yet.</div>';
    document.getElementById('decisions-list').innerHTML = 
      '<li class="empty-state">No decisions recorded.</li>';
  }

  /**
   * Toggle a todo item with optimistic UI update
   */
  toggleTodo(meetingId, todoId) {
    const todoItem = document.querySelector(`[data-todo-id="${todoId}"]`);
    const checkbox = todoItem?.querySelector('.todo-checkbox');
    
    if (!todoItem || !checkbox) return;

    // Optimistic: Update UI immediately
    const isCompleting = !todoItem.classList.contains('completed');
    todoItem.classList.toggle('completed', isCompleting);
    checkbox.classList.toggle('checked', isCompleting);
    
    // Add satisfying click feedback
    checkbox.style.transform = 'scale(0.85)';
    requestAnimationFrame(() => {
      checkbox.style.transform = '';
    });

    // Update progress bar immediately
    const meeting = meetingsManager.getMeeting(meetingId);
    if (meeting) {
      const todo = meeting.todos.find(t => t.id === todoId);
      if (todo) {
        todo.completed = isCompleting;
        const progress = meetingsManager.getTodoProgress(meeting);
        document.getElementById('todo-progress').textContent = 
          `${progress.completed}/${progress.total} complete`;
        const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
        document.getElementById('action-progress-fill').style.width = `${percentage}%`;
        
        // Persist in background
        meetingsManager.updateMeeting(meeting);
        
        if (progress.completed === progress.total && progress.total > 0) {
          this.showToast('All tasks complete!', 'success');
        }
      }
    }
  }

  /**
   * Show notes modal
   */
  showNotesModal() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('meeting-date-input').value = today;
    document.getElementById('meeting-title').value = '';
    document.getElementById('meeting-notes-input').value = '';
    
    this.showModal('notes-modal');
  }

  /**
   * Process meeting notes with Claude
   */
  async processMeetingNotes() {
    const title = document.getElementById('meeting-title').value.trim() || 'Weekly Board Sync';
    const date = document.getElementById('meeting-date-input').value;
    const notes = document.getElementById('meeting-notes-input').value.trim();

    if (!notes) {
      this.showToast('Please enter meeting notes', 'error');
      return;
    }

    if (!aiProcessor.isConfigured()) {
      this.showToast('Please configure your Anthropic API key in Settings', 'error');
      return;
    }

    // Show loading state
    this.hideModal('notes-modal');
    this.showModal('review-modal');
    document.getElementById('review-content').innerHTML = `
      <div class="review-loading">
        <div class="spinner"></div>
        <p>Claude is analyzing your meeting notes...</p>
      </div>
    `;

    try {
      console.log('Processing meeting notes with AI...');
      const result = await aiProcessor.processMeetingNotes(notes, title, date);
      console.log('AI result:', result);
      
      // Store pending data
      this.pendingReview = {
        type: 'meeting',
        title,
        date,
        rawNotes: notes,
        aiData: result
      };

      // Show review content
      this.renderMeetingReview(result);
    } catch (error) {
      console.error('Meeting notes processing error:', error);
      this.hideModal('review-modal');
      this.showToast('Failed to process notes: ' + error.message, 'error');
    }
  }

  /**
   * Save meeting directly without AI processing
   */
  saveMeetingDirectly() {
    const title = document.getElementById('meeting-title').value.trim() || 'Weekly Board Sync';
    const date = document.getElementById('meeting-date-input').value;
    const notes = document.getElementById('meeting-notes-input').value.trim();

    if (!notes) {
      this.showToast('Please enter meeting notes', 'error');
      return;
    }

    // Create meeting with basic structure (no AI)
    const meeting = meetingsManager.createMeeting(title, date, notes, {
      summary: [notes.substring(0, 200) + (notes.length > 200 ? '...' : '')],
      todos: [],
      decisions: [],
      pipelineUpdates: [],
      talkingPointSuggestions: []
    });

    this.hideModal('notes-modal');
    this.renderMeetingSelector();
    this.renderMeeting(meeting);
    this.showToast('Meeting saved!', 'success');
  }

  /**
   * Render meeting review in modal
   */
  renderMeetingReview(result) {
    let html = '';

    // Summary
    if (result.summary?.length > 0) {
      html += `
        <div class="review-section">
          <h4>Summary</h4>
          ${result.summary.map(item => `
            <div class="review-item">
              <span class="content">${item}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Action Items
    if (result.todos?.length > 0) {
      html += `
        <div class="review-section">
          <h4>Action Items</h4>
          ${result.todos.map(todo => `
            <div class="review-item">
              <span class="label">${todo.owner || 'Unassigned'}</span>
              <span class="content">${todo.text}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Decisions
    if (result.decisions?.length > 0) {
      html += `
        <div class="review-section">
          <h4>Key Decisions</h4>
          ${result.decisions.map(decision => `
            <div class="review-item">
              <span class="content">${decision}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Pipeline Updates
    if (result.pipelineUpdates?.length > 0) {
      html += `
        <div class="review-section">
          <h4>Pipeline Updates Detected</h4>
          ${result.pipelineUpdates.map(update => `
            <div class="review-item">
              <span class="label">${update.company}</span>
              <span class="content">${update.update}</span>
              ${update.newValue ? `<span class="diff-add">${update.newValue}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    // Talking Point Suggestions
    if (result.talkingPointSuggestions?.length > 0) {
      html += `
        <div class="review-section">
          <h4>Suggested Talking Points</h4>
          ${result.talkingPointSuggestions.map(point => `
            <div class="review-item">
              <span class="label">${point.title}</span>
              <span class="content">${point.content}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (!html) {
      html = '<p style="color: var(--text-muted); text-align: center;">No significant items extracted from the notes.</p>';
    }

    document.getElementById('review-content').innerHTML = html;
  }

  /**
   * Handle dropped content - analyze with AI then show destination options
   */
  async handleDroppedContent(droppedContent) {
    // Store the pending content
    this.pendingDroppedContent = droppedContent;
    
    // Check for API key
    if (!aiProcessor.isConfigured()) {
      this.showToast('Please configure your Anthropic API key in Settings', 'error');
      return;
    }
    
    // Analyze immediately with AI
    await this.analyzeAndShowOptions();
  }

  /**
   * Analyze content with AI (including vision for images) and show destination options
   */
  async analyzeAndShowOptions() {
    if (!this.pendingDroppedContent) return;
    
    const content = this.pendingDroppedContent;
    
    // Show loading modal
    this.showModal('content-action-modal');
    document.getElementById('content-analysis-result').innerHTML = `
      <div class="analysis-loading">
        <div class="spinner"></div>
        <p>Analyzing ${content.type}...</p>
      </div>
    `;
    document.getElementById('content-action-buttons').style.display = 'none';

    try {
      let analysisResult;
      
      if (content.type === 'image' && content.content.dataUrl) {
        // Use Claude Vision API for images
        analysisResult = await this.analyzeImageWithVision(content.content.dataUrl, content.fileName);
      } else {
        // Use text analysis for text/PDF
        const textContent = content.content.text || '';
        analysisResult = await this.analyzeTextContent(textContent);
      }
      
      // Store the analysis result
      this.pendingAnalysis = analysisResult;
      
      // Show the result with destination options
      this.showAnalysisWithOptions(analysisResult, content.type);
      
    } catch (error) {
      console.error('Analysis error:', error);
      this.hideModal('content-action-modal');
      this.showToast('Failed to analyze: ' + error.message, 'error');
      this.pendingDroppedContent = null;
    }
  }

  /**
   * Analyze image using Claude Vision API
   */
  async analyzeImageWithVision(dataUrl, fileName) {
    // Extract base64 data and media type from dataUrl
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image data');
    }
    
    const mediaType = matches[1];
    const base64Data = matches[2];
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            },
            {
              type: 'text',
              text: `Analyze this image and extract the key information. Create a digestible summary.

Respond in this exact format:
TITLE: [brief descriptive title, max 8 words]
SUMMARY: [1-2 sentence summary of what the image contains]
KEY POINTS:
- [key insight or information 1]
- [key insight or information 2]
- [key insight or information 3 if applicable]`
            }
          ]
        }]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Vision API failed');
    }
    
    const result = await response.json();
    return result.content[0].text;
  }

  /**
   * Analyze text content using Claude
   */
  async analyzeTextContent(text) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze this content and create a digestible summary.

Content:
${text.substring(0, 4000)}

Respond in this exact format:
TITLE: [brief descriptive title, max 8 words]
SUMMARY: [1-2 sentence summary]
KEY POINTS:
- [key point 1]
- [key point 2]
- [key point 3 if applicable]`
        }]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Analysis failed');
    }
    
    const result = await response.json();
    return result.content[0].text;
  }

  /**
   * Show analysis result with destination options
   */
  showAnalysisWithOptions(analysis, contentType) {
    // Parse the analysis
    const titleMatch = analysis.match(/^TITLE:\s*(.+?)(?:\n|$)/im);
    const summaryMatch = analysis.match(/^SUMMARY:\s*(.+?)(?:\n|$)/im);
    const keyPointsMatch = analysis.match(/KEY POINTS:\s*([\s\S]*?)$/im);
    
    const title = titleMatch ? titleMatch[1].trim() : 'Content Analysis';
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : '';
    const keyPoints = keyPointsText.match(/^-\s*.+$/gm) || [];
    
    let html = `
      <div class="analysis-result">
        <h4 class="analysis-title">${this.escapeHtml(title)}</h4>
        ${summary ? `<p class="analysis-summary">${this.escapeHtml(summary)}</p>` : ''}
        ${keyPoints.length > 0 ? `
          <ul class="analysis-points">
            ${keyPoints.map(p => `<li>${this.escapeHtml(p.replace(/^-\s*/, ''))}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    document.getElementById('content-analysis-result').innerHTML = html;
    document.getElementById('content-action-buttons').style.display = 'flex';
  }

  /**
   * Add analysis to Key Talking Points
   */
  addToTalkingPoints() {
    if (!this.pendingAnalysis) return;
    
    // Parse title and content from analysis
    const titleMatch = this.pendingAnalysis.match(/^TITLE:\s*(.+?)(?:\n|$)/im);
    const title = titleMatch ? titleMatch[1].trim() : 'New Talking Point';
    
    // Get summary and key points as content
    const summaryMatch = this.pendingAnalysis.match(/^SUMMARY:\s*(.+?)(?:\n|$)/im);
    const keyPointsMatch = this.pendingAnalysis.match(/KEY POINTS:\s*([\s\S]*?)$/im);
    
    let content = '';
    if (summaryMatch) {
      content = summaryMatch[1].trim();
    }
    if (keyPointsMatch) {
      const points = keyPointsMatch[1].trim().split('\n').filter(p => p.trim().startsWith('-'));
      if (points.length > 0) {
        content += (content ? ' ' : '') + points.map(p => p.replace(/^-\s*/, '')).join(' ');
      }
    }
    
    // Add to talking points
    storage.addTalkingPoint(title, content || 'Key insight from analyzed content.');
    this.data = storage.getData();
    
    this.hideModal('content-action-modal');
    this.renderTalkingPoints();
    this.showToast('Added to Key Talking Points', 'success');
    
    this.pendingAnalysis = null;
    this.pendingDroppedContent = null;
  }

  /**
   * Save analysis to Thoughts
   */
  saveAnalysisToThoughts() {
    if (!this.pendingAnalysis) return;
    
    const content = this.pendingDroppedContent;
    const thought = {
      type: content?.type || 'text',
      content: this.pendingAnalysis,
      preview: content?.type === 'image' ? content.content.dataUrl : null,
      fileName: content?.fileName
    };
    
    storage.addThought(thought);
    
    this.hideModal('content-action-modal');
    this.renderThoughts();
    this.showToast('Saved to Thoughts', 'success');
    
    this.pendingAnalysis = null;
    this.pendingDroppedContent = null;
  }

  /**
   * Render thoughts list
   */
  renderThoughts() {
    const thoughts = storage.getThoughts();
    const container = document.getElementById('thoughts-list');
    const countEl = document.getElementById('thoughts-count');
    
    countEl.textContent = thoughts.length > 0 ? `(${thoughts.length})` : '';
    
    if (thoughts.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = thoughts.map(thought => {
      const date = new Date(thought.createdAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Parse digested content (TITLE: ... followed by bullet points)
      const content = thought.content || '';
      const titleMatch = content.match(/^TITLE:\s*(.+?)(?:\n|$)/i);
      const summaryMatch = content.match(/^SUMMARY:\s*(.+?)(?:\n|$)/im);
      const title = titleMatch ? titleMatch[1].trim() : null;
      const summary = summaryMatch ? summaryMatch[1].trim() : null;
      const bullets = content.match(/^-\s*.+$/gm) || [];
      const hasAnalysis = title || summary || bullets.length > 0;
      
      // Image with analysis (analyzed image)
      if (thought.type === 'image' && thought.preview && hasAnalysis) {
        return `
          <div class="thought-item thought-image-analyzed" data-thought-id="${thought.id}">
            <img src="${thought.preview}" alt="${thought.fileName || 'Image'}" class="thought-image-thumb" onclick="window.dashboard.showImagePreview('${thought.id}')">
            <div class="thought-analysis">
              ${title ? `<div class="thought-title" contenteditable="true" data-field="title" data-thought-id="${thought.id}">${this.escapeHtml(title)}</div>` : ''}
              ${summary ? `<div class="thought-summary" contenteditable="true" data-field="summary" data-thought-id="${thought.id}">${this.escapeHtml(summary)}</div>` : ''}
              ${bullets.length > 0 ? `
                <ul class="thought-bullets">
                  ${bullets.map((b, i) => `<li contenteditable="true" data-field="bullet-${i}" data-thought-id="${thought.id}">${this.escapeHtml(b.replace(/^-\s*/, ''))}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
            <div class="thought-meta">
              <span class="thought-date">${date}</span>
              <span class="thought-type">image</span>
              <button class="delete-btn" onclick="window.dashboard.deleteThought('${thought.id}')" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        `;
      }
      
      // Image without analysis (just saved image)
      if (thought.type === 'image' && thought.preview) {
        return `
          <div class="thought-item thought-image" data-thought-id="${thought.id}">
            <img src="${thought.preview}" alt="${thought.fileName || 'Image'}" class="thought-image-preview" onclick="window.dashboard.showImagePreview('${thought.id}')">
            <div class="thought-meta">
              <span class="thought-date">${date}</span>
              <span class="thought-type">image</span>
              <button class="delete-btn" onclick="window.dashboard.deleteThought('${thought.id}')" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        `;
      }
      
      // Text with analysis (digested format)
      if (hasAnalysis) {
        return `
          <div class="thought-item thought-digested" data-thought-id="${thought.id}">
            <div class="thought-digest">
              ${title ? `<div class="thought-title" contenteditable="true" data-field="title" data-thought-id="${thought.id}">${this.escapeHtml(title)}</div>` : ''}
              ${summary ? `<div class="thought-summary" contenteditable="true" data-field="summary" data-thought-id="${thought.id}">${this.escapeHtml(summary)}</div>` : ''}
              ${bullets.length > 0 ? `
                <ul class="thought-bullets">
                  ${bullets.map((b, i) => `<li contenteditable="true" data-field="bullet-${i}" data-thought-id="${thought.id}">${this.escapeHtml(b.replace(/^-\s*/, ''))}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
            <div class="thought-meta">
              <span class="thought-date">${date}</span>
              <button class="delete-btn" onclick="window.dashboard.deleteThought('${thought.id}')" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        `;
      }
      
      // Raw content fallback
      return `
        <div class="thought-item" data-thought-id="${thought.id}">
          <div class="thought-content">${this.escapeHtml(content)}</div>
          <div class="thought-meta">
            <span class="thought-date">${date}</span>
            <button class="delete-btn" onclick="window.dashboard.deleteThought('${thought.id}')" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Setup edit listeners after render
    setTimeout(() => this.setupThoughtEditListeners(), 0);
  }

  /**
   * Delete a thought
   */
  deleteThought(id) {
    const el = document.querySelector(`[data-thought-id="${id}"]`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.95)';
    }
    
    setTimeout(() => {
      storage.deleteThought(id);
      this.renderThoughts();
    }, 150);
    this.showToast('Thought deleted', 'success');
  }

  /**
   * Show image preview modal
   */
  showImagePreview(thoughtId) {
    const thoughts = storage.getThoughts();
    const thought = thoughts.find(t => t.id === thoughtId);
    if (!thought || !thought.preview) return;
    
    document.getElementById('image-preview-img').src = thought.preview;
    this.showModal('image-preview-modal');
  }

  /**
   * Update thought content when edited
   */
  updateThoughtContent(thoughtId, field, newValue) {
    const thoughts = storage.getThoughts();
    const thought = thoughts.find(t => t.id === thoughtId);
    if (!thought) return;
    
    // Parse current content
    let content = thought.content || '';
    
    if (field === 'title') {
      // Update title
      if (content.match(/^TITLE:/im)) {
        content = content.replace(/^TITLE:\s*.+$/im, `TITLE: ${newValue}`);
      } else {
        content = `TITLE: ${newValue}\n${content}`;
      }
    } else if (field === 'summary') {
      // Update summary
      if (content.match(/^SUMMARY:/im)) {
        content = content.replace(/^SUMMARY:\s*.+$/im, `SUMMARY: ${newValue}`);
      } else {
        const titleMatch = content.match(/^TITLE:.+\n?/im);
        if (titleMatch) {
          content = content.replace(titleMatch[0], `${titleMatch[0]}SUMMARY: ${newValue}\n`);
        } else {
          content = `SUMMARY: ${newValue}\n${content}`;
        }
      }
    } else if (field.startsWith('bullet-')) {
      // Update bullet point
      const bulletIndex = parseInt(field.replace('bullet-', ''));
      const bullets = content.match(/^-\s*.+$/gm) || [];
      if (bulletIndex < bullets.length) {
        const oldBullet = bullets[bulletIndex];
        content = content.replace(oldBullet, `- ${newValue}`);
      }
    }
    
    // Update storage
    thought.content = content;
    storage.data.thoughts = thoughts;
    storage.scheduleSave();
  }

  /**
   * Setup thought edit listeners
   */
  setupThoughtEditListeners() {
    const container = document.getElementById('thoughts-list');
    if (!container) return;
    
    container.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('blur', (e) => {
        const thoughtId = e.target.dataset.thoughtId;
        const field = e.target.dataset.field;
        const newValue = e.target.textContent.trim();
        if (thoughtId && field && newValue) {
          this.updateThoughtContent(thoughtId, field, newValue);
        }
      });
      
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
    });
  }

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render content review in modal
   */
  renderContentReview(result) {
    let html = `
      <div class="review-section">
        <h4>Content Analysis</h4>
        <div class="review-item">
          <span class="content">${result.contentSummary}</span>
          <span class="badge badge-${result.relevance === 'high' ? 'green' : result.relevance === 'medium' ? 'orange' : 'blue'}" style="margin-top: 8px;">
            ${result.relevance} relevance
          </span>
        </div>
      </div>
    `;

    if (result.suggestedUpdates?.length > 0) {
      html += `
        <div class="review-section">
          <h4>Suggested Updates</h4>
          ${result.suggestedUpdates.map(update => `
            <div class="review-item">
              <span class="label">${update.section} - ${update.type}</span>
              <span class="content">${update.description}</span>
              ${update.currentValue ? `<span class="diff-remove">${update.currentValue}</span>` : ''}
              <span class="diff-add">${update.newValue}</span>
              <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${update.reason}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      html += `
        <div class="review-section">
          <h4>No Updates Suggested</h4>
          <div class="review-item">
            <span class="content">${result.noUpdatesReason || 'No relevant updates identified.'}</span>
          </div>
        </div>
      `;
    }

    document.getElementById('review-content').innerHTML = html;
  }

  /**
   * Apply pending changes from review
   */
  applyPendingChanges() {
    if (!this.pendingReview) {
      this.hideModal('review-modal');
      return;
    }

    console.log('Applying pending changes:', this.pendingReview);
    let pipelineChanged = false;

    if (this.pendingReview.type === 'meeting') {
      // Create the meeting
      console.log('Creating meeting with data:', this.pendingReview.aiData);
      const meeting = meetingsManager.createMeeting(
        this.pendingReview.title,
        this.pendingReview.date,
        this.pendingReview.rawNotes,
        this.pendingReview.aiData
      );
      console.log('Meeting created:', meeting);

      // Apply any pipeline updates
      if (this.pendingReview.aiData.pipelineUpdates && this.pendingReview.aiData.pipelineUpdates.length > 0) {
        this.pendingReview.aiData.pipelineUpdates.forEach(update => {
          if (update.isNewClient) {
            // Add new client to pipeline
            storage.addDeal('inProgress', {
              name: update.company,
              value: update.newValue || '$50K',
              stage: update.newStage || 'discovery',
              timing: 'TBD'
            });
            pipelineChanged = true;
          } else if (update.newStage) {
            // Update existing client stage
            // Try to find in closestToClose first, then inProgress
            const updated = storage.updateDeal('closestToClose', update.company, {
              stage: update.newStage,
              value: update.newValue || undefined
            });
            if (!updated || !updated.pipeline.closestToClose.find(d => d.name === update.company)) {
              storage.updateDeal('inProgress', update.company, {
                stage: update.newStage,
                value: update.newValue || undefined
              });
            }
            pipelineChanged = true;
          }
        });
      }

      // Apply talking point suggestions (just add them)
      if (this.pendingReview.aiData.talkingPointSuggestions) {
        this.pendingReview.aiData.talkingPointSuggestions.forEach(point => {
          storage.addTalkingPoint(point.title, point.content);
        });
      }

      // Save pipeline snapshot if changes were made
      if (pipelineChanged) {
        storage.savePipelineSnapshot(`Meeting: ${this.pendingReview.title}`);
      }

      this.renderMeetingSelector();
      this.renderMeeting(meeting);
      this.renderTalkingPoints();
      this.renderPipeline();
      this.renderStats(); // Refresh stats to update trends
      this.showToast('Meeting saved successfully', 'success');
    } else if (this.pendingReview.type === 'content') {
      // Apply content updates
      const updates = this.pendingReview.aiData.suggestedUpdates || [];
      
      updates.forEach(update => {
        if (update.section === 'pipeline' && update.type === 'add') {
          storage.addDeal('inProgress', {
            name: update.newValue,
            value: '$50K',
            stage: 'discovery',
            timing: 'TBD'
          });
          pipelineChanged = true;
        } else if (update.section === 'talkingPoints') {
          storage.addTalkingPoint(update.newValue.split(':')[0], update.newValue);
        } else if (update.section === 'stats') {
          // Handle stat updates
          const statId = update.description.toLowerCase().includes('pipeline') ? 'pipeline' :
                        update.description.toLowerCase().includes('prospect') ? 'prospects' : null;
          if (statId) {
            const stats = storage.getData().stats;
            const statIndex = stats.findIndex(s => s.id === statId);
            if (statIndex !== -1) {
              stats[statIndex].value = update.newValue;
              storage.updateSection('stats', stats);
            }
          }
        }
      });

      // Save pipeline snapshot if changes were made
      if (pipelineChanged) {
        storage.savePipelineSnapshot('Content update');
      }

      this.render();
      this.showToast('Updates applied successfully', 'success');
    }

    this.hideModal('review-modal');
    this.pendingReview = null;
  }

  /**
   * Save settings
   */
  async saveSettings() {
    const apiKey = document.getElementById('api-key').value.trim();
    const openaiApiKey = document.getElementById('openai-api-key').value.trim();
    
    // Get section order from DOM
    const container = document.getElementById('email-sections-sortable');
    const sectionOrder = [...container.querySelectorAll('.sortable-item')]
      .map(item => item.dataset.section);
    
    // Collect email settings
    const emailSettings = {
      sectionOrder,
      sections: {
        metrics: document.getElementById('email-metrics').checked,
        pipeline: document.getElementById('email-pipeline').checked,
        talkingPoints: document.getElementById('email-talking-points').checked,
        highlights: document.getElementById('email-highlights').checked,
        decisions: document.getElementById('email-decisions').checked,
        actionItems: document.getElementById('email-action-items').checked
      },
      counts: {
        pipelineDeals: parseInt(document.getElementById('email-pipeline-count').value) || 5,
        talkingPoints: parseInt(document.getElementById('email-talking-points-count').value) || 4
      },
      signature: document.getElementById('email-signature').value.trim() || 'JG',
      greeting: document.getElementById('email-greeting').value.trim()
    };

    // Update link email settings
    const linkToggles = document.querySelectorAll('#email-links-toggles input[data-link-id]');
    linkToggles.forEach(toggle => {
      const linkId = toggle.dataset.linkId;
      storage.updateQuickLink(linkId, { emailEnabled: toggle.checked });
    });

    // Update seed raise target
    const seedRaiseTarget = document.getElementById('seed-raise-target').value.trim();
    if (seedRaiseTarget) {
      storage.updateSeedTarget(seedRaiseTarget);
    }
    
    // Update storage and local settings
    this.data = storage.getData();
    this.settings = storage.updateSettings({ apiKey, openaiApiKey, email: emailSettings });
    aiProcessor.setApiKey(apiKey);
    OPENAI_API_KEY = openaiApiKey || null;

    // Close modal first
    this.hideModal('settings-modal');

    // Test connection if key provided
    if (apiKey) {
      this.showToast('Testing API connection...', 'info');
      const connected = await aiProcessor.testConnection();
      
      if (connected) {
        this.showToast('API connected successfully', 'success');
      } else {
        this.showToast('API connection failed. Please check your key.', 'error');
      }
    } else {
      this.showToast('Settings saved', 'success');
    }

    // Update UI status
    this.renderSettingsStatus();
    this.renderSeedRaise();
  }

  /**
   * Render settings status
   */
  renderSettingsStatus() {
    const statusEl = document.getElementById('api-status');
    const apiKey = document.getElementById('api-key');
    
    apiKey.value = this.settings.apiKey || '';

    if (aiProcessor.isConfigured()) {
      statusEl.classList.add('connected');
      statusEl.querySelector('.status-text').textContent = 'Connected';
    } else {
      statusEl.classList.remove('connected');
      statusEl.querySelector('.status-text').textContent = 'Not configured';
    }

    // OpenAI API key status
    const openaiStatusEl = document.getElementById('openai-status');
    const openaiApiKey = document.getElementById('openai-api-key');
    
    openaiApiKey.value = this.settings.openaiApiKey || '';
    OPENAI_API_KEY = this.settings.openaiApiKey || null;

    if (this.settings.openaiApiKey) {
      openaiStatusEl.classList.add('connected');
      openaiStatusEl.querySelector('.status-text').textContent = 'Connected';
    } else {
      openaiStatusEl.classList.remove('connected');
      openaiStatusEl.querySelector('.status-text').textContent = 'Not configured';
    }

    // Populate email settings
    const email = this.settings.email || {};
    const sections = email.sections || {};
    const counts = email.counts || {};
    const links = email.links || {};
    const sectionOrder = email.sectionOrder || ['metrics', 'pipeline', 'talkingPoints', 'highlights', 'decisions', 'actionItems'];

    // Reorder DOM elements based on stored order
    const container = document.getElementById('email-sections-sortable');
    if (container) {
      sectionOrder.forEach(sectionKey => {
        const item = container.querySelector(`[data-section="${sectionKey}"]`);
        if (item) {
          container.appendChild(item);
        }
      });
    }

    // Section toggles
    document.getElementById('email-metrics').checked = sections.metrics !== false;
    document.getElementById('email-pipeline').checked = sections.pipeline !== false;
    document.getElementById('email-talking-points').checked = sections.talkingPoints !== false;
    document.getElementById('email-highlights').checked = sections.highlights !== false;
    document.getElementById('email-decisions').checked = sections.decisions !== false;
    document.getElementById('email-action-items').checked = sections.actionItems !== false;

    // Counts
    document.getElementById('email-pipeline-count').value = counts.pipelineDeals || 5;
    document.getElementById('email-talking-points-count').value = counts.talkingPoints || 4;

    // Signature and greeting
    document.getElementById('email-signature').value = email.signature || 'JG';
    document.getElementById('email-greeting').value = email.greeting || '';

    // Render link toggles dynamically
    const linksContainer = document.getElementById('email-links-toggles');
    const quickLinks = storage.getQuickLinks();
    linksContainer.innerHTML = quickLinks.map(link => `
      <label class="toggle-row">
        <input type="checkbox" data-link-id="${link.id}" ${link.emailEnabled !== false ? 'checked' : ''}>
        <span class="toggle-switch"></span>
        <span class="toggle-label">Include ${link.name}</span>
      </label>
    `).join('');

    // Seed raise target
    const seedRaise = storage.getSeedRaise();
    document.getElementById('seed-raise-target').value = seedRaise.target || '$500K';
  }

  /**
   * Export all data
   */
  exportData() {
    const data = storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `glossi-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showToast('Data exported successfully', 'success');
  }

  /**
   * Import data
   */
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const success = storage.importData(event.target.result);
        if (success) {
          this.data = storage.getData();
          this.render();
          this.showToast('Data imported successfully', 'success');
        } else {
          this.showToast('Failed to import data', 'error');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  /**
   * Show modal
   */
  showModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
  }

  /**
   * Hide modal
   */
  hideModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
  }

  /**
   * Show toast notification with premium animation
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };
    
    toast.innerHTML = `
      <span class="toast-icon ${type}">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Add progress bar animation
    const progressBar = toast.querySelector('.toast-progress');
    if (progressBar) {
      progressBar.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: ${type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-blue)'};
        width: 100%;
        transform-origin: left;
        animation: toast-progress 4s linear forwards;
      `;
    }

    // Auto remove after 4 seconds with exit animation
    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Add ripple effect to element
   */
  addRipple(element, event) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out forwards;
      pointer-events: none;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new GlossiDashboard();
  window.dashboard.init();
});

export default GlossiDashboard;
