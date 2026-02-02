/**
 * Glossi Board Dashboard - Main Application
 * Ties together all modules and handles UI interactions
 */

import { storage } from './modules/storage.js';
import { aiProcessor } from './modules/ai-processor.js';
import { meetingsManager } from './modules/meetings.js';
import { knowledgeBase } from './modules/knowledge-base.js';

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

    // Initialize Knowledge Base
    knowledgeBase.init(storage, aiProcessor, () => this.render());

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

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processDroppedFile(files[0]);
      }
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
    console.log('Processing file:', file.name, 'MIME type:', file.type);
    const fileType = this.getFileType(file);
    console.log('Detected as:', fileType);
    
    if (!fileType) {
      this.showToast('Unsupported file type: ' + (file.type || file.name), 'error');
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
        // Check for OpenAI API key first
        const openaiKey = this.settings.openaiApiKey || OPENAI_API_KEY;
        if (!openaiKey) {
          this.showToast('Please configure your OpenAI API key in Settings for audio transcription', 'error');
          return;
        }
        
        // Check file size (Whisper limit is 25MB)
        const fileSizeMB = file.size / (1024 * 1024);
        console.log('Audio file size:', fileSizeMB.toFixed(2), 'MB');
        
        if (fileSizeMB > 25) {
          this.showToast(`Audio file too large (${fileSizeMB.toFixed(1)}MB). Max is 25MB. Try a shorter clip or compress the file.`, 'error');
          return;
        }
        
        // Show progress overlay
        this.showProgress('Processing Audio');
        
        console.log('Starting audio transcription...');
        content = await this.processAudioFile(file);
        console.log('Transcription result:', content);
      }

      content.type = fileType;
      content.fileName = file.name;

      this.handleDroppedContent(content);
    } catch (error) {
      console.error('File processing error:', error);
      this.hideProgress();
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
    const audioTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 
      'audio/webm', 'audio/ogg', 'audio/x-m4a', 'audio/aac', 'audio/x-wav',
      'audio/mp4a-latm', 'audio/3gpp', 'audio/amr', 'video/mp4' // voice memos can be video/mp4
    ];
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.mp4', '.3gp', '.amr'];

    if (imageTypes.includes(file.type)) return 'image';
    if (pdfTypes.includes(file.type)) return 'pdf';
    if (textTypes.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt')) return 'text';
    
    // Check audio by MIME type or extension
    const lowerName = file.name.toLowerCase();
    if (audioTypes.includes(file.type) || file.type.startsWith('audio/') || 
        audioExtensions.some(ext => lowerName.endsWith(ext))) {
      return 'audio';
    }
    
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
   * Process audio file using OpenAI Whisper API with progress tracking
   */
  async processAudioFile(file) {
    const apiKey = this.settings.openaiApiKey || OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress (0-50%)
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const uploadPercent = Math.round((e.loaded / e.total) * 50);
          this.updateProgress(uploadPercent, 'Uploading audio...');
        }
      });
      
      xhr.upload.addEventListener('load', () => {
        // Upload complete, now processing (50-95%)
        this.updateProgress(50, 'Processing with Whisper AI...');
        this.simulateProcessingProgress(50, 95, 60000); // Simulate over 60 seconds
      });
      
      xhr.addEventListener('load', () => {
        this.stopProgressSimulation();
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            const transcript = result.text;
            
            console.log('Audio duration:', result.duration, 'seconds');
            console.log('Audio transcription length:', transcript?.length, 'chars');
            
            if (!transcript || transcript.trim().length === 0) {
              reject(new Error('No speech detected in audio'));
              return;
            }
            
            this.updateProgress(100, 'Transcription complete!');
            setTimeout(() => this.hideProgress(), 500);
            
            resolve({ content: { text: transcript } });
          } catch (e) {
            reject(new Error('Failed to parse transcription response'));
          }
        } else {
          console.error('Whisper API error:', xhr.responseText);
          reject(new Error(`Transcription failed: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        this.stopProgressSimulation();
        this.hideProgress();
        reject(new Error('Network error during transcription'));
      });
      
      xhr.addEventListener('timeout', () => {
        this.stopProgressSimulation();
        this.hideProgress();
        reject(new Error('Transcription timed out - try a shorter audio file'));
      });
      
      xhr.open('POST', 'https://api.openai.com/v1/audio/transcriptions');
      xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
      xhr.timeout = 300000; // 5 min timeout
      xhr.send(formData);
    });
  }

  /**
   * Show progress overlay
   */
  showProgress(title = 'Processing') {
    document.getElementById('progress-title').textContent = title;
    document.getElementById('progress-overlay').classList.add('visible');
    this.updateProgress(0, 'Starting...');
  }

  /**
   * Update progress bar
   */
  updateProgress(percent, status) {
    document.getElementById('progress-bar').style.width = `${percent}%`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    if (status) {
      document.getElementById('progress-status').textContent = status;
    }
  }

  /**
   * Hide progress overlay
   */
  hideProgress() {
    document.getElementById('progress-overlay').classList.remove('visible');
  }

  /**
   * Simulate progress during API processing
   */
  simulateProcessingProgress(from, to, duration) {
    this.stopProgressSimulation();
    const startTime = Date.now();
    
    this.progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(from + ((to - from) * (elapsed / duration)), to);
      this.updateProgress(Math.round(progress), 'Processing with Whisper AI...');
      
      if (progress >= to) {
        this.stopProgressSimulation();
      }
    }, 500);
  }

  /**
   * Stop progress simulation
   */
  stopProgressSimulation() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
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

    // Pipeline edit modal
    document.getElementById('edit-pipeline-btn')?.addEventListener('click', () => {
      this.openPipelineEditModal();
    });

    document.getElementById('pipeline-edit-close')?.addEventListener('click', () => {
      this.hideModal('pipeline-edit-modal');
    });

    document.getElementById('pipeline-edit-cancel')?.addEventListener('click', () => {
      this.hideModal('pipeline-edit-modal');
    });

    document.getElementById('pipeline-edit-save')?.addEventListener('click', () => {
      this.savePipelineEmail();
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

    // Content action modal (unified intelligence)
    document.getElementById('content-action-close').addEventListener('click', () => {
      this.hideModal('content-action-modal');
      this.pendingDroppedContent = null;
      this.pendingExtractedData = null;
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
    try { this.renderSeedRaise(); } catch (e) { console.error('renderSeedRaise error:', e); }
    try { this.renderPipelineSection(); } catch (e) { console.error('renderPipelineSection error:', e); }
    try { this.renderMeetingSelector(); } catch (e) { console.error('renderMeetingSelector error:', e); }
    
    try {
      const currentMeeting = meetingsManager.getCurrentMeeting();
      if (currentMeeting) {
        this.renderMeeting(currentMeeting);
      }
    } catch (e) { console.error('renderMeeting error:', e); }

    try { this.renderSettingsStatus(); } catch (e) { console.error('renderSettingsStatus error:', e); }
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
   * Render pipeline (deprecated - section removed, using Knowledge Base instead)
   */
  renderPipeline() {
    // Pipeline section was removed
  }

  /**
   * Delete a pipeline deal (deprecated)
   */
  deletePipelineDeal(name, category) {
    // Pipeline section was removed
  }

  /**
   * Render the pipeline section from pasted email content
   */
  renderPipelineSection() {
    const container = document.getElementById('pipeline-content');
    const totalEl = document.getElementById('pipeline-total-value');
    const countEl = document.getElementById('pipeline-deal-count');
    
    if (!container) return;
    
    const pipelineData = this.data?.pipelineEmail || storage.getPipelineEmail?.() || null;
    
    if (!pipelineData || !pipelineData.content) {
      container.innerHTML = `
        <div class="pipeline-empty">
          <p>No pipeline data yet</p>
          <p class="pipeline-hint">Click "Update" to paste your weekly pipeline email</p>
        </div>
      `;
      if (totalEl) totalEl.textContent = '$0';
      if (countEl) countEl.textContent = '0 deals';
      return;
    }
    
    // Display the pasted content
    const updatedDate = pipelineData.updatedAt ? new Date(pipelineData.updatedAt).toLocaleDateString() : '';
    
    container.innerHTML = `
      <div class="pipeline-email-display">${this.escapeHtml(pipelineData.content)}</div>
      ${updatedDate ? `<div class="pipeline-updated">Last updated: ${updatedDate}</div>` : ''}
    `;
    
    // Update stats if provided
    if (totalEl && pipelineData.total) totalEl.textContent = pipelineData.total;
    if (countEl && pipelineData.dealCount) countEl.textContent = pipelineData.dealCount;
  }

  /**
   * Open the pipeline edit modal
   */
  openPipelineEditModal() {
    const pipelineData = this.data?.pipelineEmail || storage.getPipelineEmail?.() || null;
    const textarea = document.getElementById('pipeline-email-content');
    
    if (textarea && pipelineData?.content) {
      textarea.value = pipelineData.content;
    } else if (textarea) {
      textarea.value = '';
    }
    
    this.showModal('pipeline-edit-modal');
    textarea?.focus();
  }

  /**
   * Save the pipeline email content
   */
  savePipelineEmail() {
    const textarea = document.getElementById('pipeline-email-content');
    const content = textarea?.value?.trim() || '';
    
    // Extract some basic stats from the content (rough estimates)
    let total = '$0';
    let dealCount = '0 deals';
    
    // Try to extract total from common patterns
    const totalMatch = content.match(/total[:\s]*\$?([\d,\.]+[KkMm]?)/i);
    if (totalMatch) {
      total = '$' + totalMatch[1].toUpperCase();
    }
    
    // Count lines that look like deals (have dollar amounts)
    const dealLines = content.split('\n').filter(line => /\$[\d,\.]+/.test(line));
    if (dealLines.length > 0) {
      dealCount = dealLines.length + ' deals';
    }
    
    const pipelineData = {
      content,
      total,
      dealCount,
      updatedAt: new Date().toISOString()
    };
    
    // Save to storage
    if (!this.data.pipelineEmail) {
      this.data.pipelineEmail = {};
    }
    this.data.pipelineEmail = pipelineData;
    storage.updatePipelineEmail(pipelineData);
    
    this.hideModal('pipeline-edit-modal');
    this.renderPipelineSection();
    this.showToast('Pipeline updated', 'success');
  }

  /**
   * Render talking points (deprecated - section removed, using Knowledge Base instead)
   */
  renderTalkingPoints() {
    // Talking points section was removed - using Knowledge Base instead
    return;
    
    // Legacy code below (kept for reference)
    const container = document.getElementById('talking-points');
    if (!container || !this.data) return;
    
    const points = this.data.talkingPoints || [];
    const categories = storage.getTalkingPointCategories() || ['core', 'traction', 'market', 'testimonials'];
    
    const categoryLabels = {
      core: 'Core Value Prop',
      traction: 'Traction & Proof',
      market: 'Market & Timing',
      testimonials: 'Customer Validation'
    };

    if (points.length === 0) {
      container.innerHTML = '<div class="empty-state">No talking points yet. Click + to add one.</div>';
      return;
    }

    // Group points by category
    const grouped = {};
    categories.forEach(cat => grouped[cat] = []);
    
    points.forEach((point, index) => {
      const cat = point.category || 'core';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ ...point, originalIndex: index });
    });

    let html = '';
    let animIndex = 0;
    
    categories.forEach(category => {
      const catPoints = grouped[category];
      if (catPoints.length === 0 && category !== 'testimonials') return;
      
      html += `
        <div class="talking-point-category" data-category="${category}">
          <div class="category-header">
            <span class="category-label">${categoryLabels[category] || category}</span>
            <span class="category-count">${catPoints.length}</span>
          </div>
          <div class="category-points">
      `;
      
      if (catPoints.length === 0) {
        html += '<div class="empty-category">No ${category} talking points yet</div>';
      } else {
        catPoints.forEach((point) => {
          html += `
            <div class="talking-point-full" style="animation-delay: ${0.45 + animIndex * 0.05}s" data-index="${point.originalIndex}" draggable="true">
              <div class="talking-point-header">
                <span class="drag-handle" title="Drag to move">⋮⋮</span>
                <span class="title">${point.title}</span>
                <div class="talking-point-actions">
                  <button class="edit-btn" onclick="window.dashboard.editTalkingPoint(${point.originalIndex})" title="Edit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button class="delete-btn" onclick="window.dashboard.deleteTalkingPoint(${point.originalIndex})" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
              <p class="description">${point.content || point.description || ''}</p>
            </div>
          `;
          animIndex++;
        });
      }
      
      html += '</div></div>';
    });

    container.innerHTML = html;

    // Add staggered entrance animation
    this.animateListItems(container, '.talking-point-full');
    
    // Setup drag-drop for talking points
    this.setupTalkingPointDragDrop();
  }

  /**
   * Setup drag-drop for talking points between categories
   */
  setupTalkingPointDragDrop() {
    const items = document.querySelectorAll('.talking-point-full[draggable="true"]');
    const categories = document.querySelectorAll('.category-points');
    
    let draggedItem = null;
    let draggedIndex = null;
    
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        draggedIndex = null;
        categories.forEach(c => c.classList.remove('drag-over'));
      });
    });
    
    categories.forEach(categoryEl => {
      categoryEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        categoryEl.classList.add('drag-over');
      });
      
      categoryEl.addEventListener('dragleave', () => {
        categoryEl.classList.remove('drag-over');
      });
      
      categoryEl.addEventListener('drop', (e) => {
        e.preventDefault();
        categoryEl.classList.remove('drag-over');
        
        if (draggedItem && draggedIndex !== null) {
          const newCategory = categoryEl.closest('.talking-point-category')?.dataset.category;
          if (newCategory) {
            this.moveTalkingPointToCategory(draggedIndex, newCategory);
          }
        }
      });
    });
  }

  /**
   * Move a talking point to a different category
   */
  moveTalkingPointToCategory(index, newCategory) {
    const points = this.data?.talkingPoints || [];
    if (index < 0 || index >= points.length) return;
    
    const point = points[index];
    const oldCategory = point.category;
    if (oldCategory === newCategory) return;
    
    // Update category (storage.updateTalkingPoint takes: index, title, content, category)
    storage.updateTalkingPoint(index, point.title, point.content, newCategory);
    
    this.data = storage.getData();
    this.renderTalkingPoints();
    
    const categoryLabels = {
      core: 'Core Value Prop',
      traction: 'Traction & Proof',
      market: 'Market & Timing',
      testimonials: 'Customer Validation'
    };
    
    this.showToast(`Moved to ${categoryLabels[newCategory]}`, 'success');
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
        <div class="quick-link-wrapper" data-link-id="${link.id}">
          <a href="${link.url}" target="_blank" class="quick-link ${colorClass}">
            ${icon}
            <span>${link.name}</span>
          </a>
          <button class="link-edit-btn" onclick="window.dashboard.editLink('${link.id}')" title="Edit">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
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
   * Refresh pipeline view (deprecated - pipeline section removed)
   */
  refreshPipelineViews() {
    // Pipeline section was removed
  }

  /**
   * Share weekly update via email - clean, scannable format
   */
  shareViaEmail() {
    const data = this.data;
    const stats = data.stats || [];
    const talkingPoints = data.talkingPoints || [];
    
    // Get email settings
    const emailSettings = this.settings.email || {};
    const signature = emailSettings.signature || 'JG';
    const greeting = emailSettings.greeting || '';

    // Get current week range
    const weekRange = this.getWeekRange(new Date());

    // Get meeting data
    const meeting = meetingsManager.getCurrentMeeting();

    // Get featured quotes
    const featuredQuotes = storage.getFeaturedQuotes ? storage.getFeaturedQuotes() : [];

    // Get top pipeline deals (sorted by stage)
    const allClients = storage.getAllPipelineClients();
    const stagePriority = { pilot: 4, validation: 3, demo: 2, discovery: 1, partnership: 0 };
    const topDeals = allClients
      .filter(c => c.category !== 'partnerships')
      .sort((a, b) => (stagePriority[b.stage] || 0) - (stagePriority[a.stage] || 0))
      .slice(0, 5);

    // Build email body
    let body = '';

    // Header
    body += `GLOSSI UPDATE | ${weekRange}\n`;
    body += '================================\n\n';
    
    // Custom greeting
    if (greeting) {
      body += `${greeting}\n\n`;
    }

    // MEETING RECAP (if summary exists)
    if (meeting?.summary && meeting.summary.length > 0) {
      body += 'MEETING RECAP\n';
      body += '------------\n';
      meeting.summary.forEach(item => {
        body += `- ${item}\n`;
      });
      body += '\n';
    }

    // ACTION ITEMS (if todos exist)
    if (meeting?.todos && meeting.todos.length > 0) {
      body += 'ACTION ITEMS\n';
      body += '------------\n';
      const todosByOwner = {};
      meeting.todos.forEach(todo => {
        const owner = this.resolveOwnerName(todo.owner);
        if (!todosByOwner[owner]) todosByOwner[owner] = [];
        todosByOwner[owner].push(todo);
      });
      Object.entries(todosByOwner).forEach(([owner, todos]) => {
        body += `${owner}:\n`;
        todos.forEach(todo => {
          const checkbox = todo.completed ? '[x]' : '[ ]';
          body += `  ${checkbox} ${todo.text}\n`;
        });
      });
      body += '\n';
    }

    body += '--- CHEAT SHEET ---\n\n';

    // Quick Stats (one line)
    const statsLine = stats
      .filter(s => s.value && s.value !== '0' && s.value !== '$0')
      .map(s => `${s.label}: ${s.value}`)
      .join('  |  ');
    if (statsLine) {
      body += `${statsLine}\n\n`;
    }

    // Pipeline Snapshot
    if (topDeals.length > 0) {
      const pipelineTotal = data.pipeline?.totalValue || '$0';
      body += `PIPELINE: ${pipelineTotal}\n`;
      topDeals.slice(0, 4).forEach(deal => {
        const value = deal.value || '';
        body += `- ${deal.name} (${deal.stage})${value ? ' - ' + value : ''}\n`;
      });
      body += '\n';
    }

    // Key Talking Points
    if (talkingPoints.length > 0) {
      body += 'KEY TALKING POINTS\n';
      talkingPoints.slice(0, 5).forEach(point => {
        body += `> ${point.title}\n`;
        if (point.content) {
          const short = point.content.length > 100 
            ? point.content.substring(0, 97) + '...'
            : point.content;
          body += `  ${short}\n`;
        }
        body += '\n';
      });
    }

    // Customer Quotes
    if (featuredQuotes.length > 0) {
      body += 'CUSTOMER QUOTES\n';
      featuredQuotes.slice(0, 3).forEach(quote => {
        const shortQuote = quote.quote.length > 80 
          ? quote.quote.substring(0, 77) + '...'
          : quote.quote;
        body += `"${shortQuote}"\n  - ${quote.source}\n\n`;
      });
    }

    // Footer
    body += '================================\n';
    body += `${signature}\n\n`;
    
    // Links
    const quickLinks = storage.getQuickLinks();
    const enabledLinks = quickLinks.filter(link => link.emailEnabled !== false);
    
    if (enabledLinks.length > 0) {
      body += 'LINKS\n';
      enabledLinks.forEach(link => {
        const label = link.emailLabel || link.name;
        body += `${label}: ${link.url}\n`;
      });
    }

    // Open default email app
    const subject = `Glossi Update | ${weekRange}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.location.href = mailtoLink;
    this.showToast('Opening email...', 'success');
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
    console.log('handleDroppedContent called with:', droppedContent.type, droppedContent.fileName);
    
    // Store the pending content
    this.pendingDroppedContent = droppedContent;
    
    // Check for API key
    if (!aiProcessor.isConfigured()) {
      console.log('Anthropic API key not configured');
      this.showToast('Please configure your Anthropic API key in Settings', 'error');
      return;
    }
    
    console.log('Starting AI analysis...');
    // Analyze immediately with AI
    await this.analyzeAndShowOptions();
  }

  /**
   * Simple auto-import: Opus analyzes and auto-adds to sections
   */
  async analyzeAndShowOptions() {
    if (!this.pendingDroppedContent) return;
    
    const content = this.pendingDroppedContent;
    
    // Show loading toast
    this.showToast('Analyzing content...', 'info');

    try {
      // Single Opus call to extract everything
      const result = await this.extractForCheatSheet(content);
      console.log('Extraction result:', result);
      
      // Compress source for linking
      const compressedSource = {
        fileName: content.fileName,
        type: content.type,
        text: content.content?.text ? this.compressText(content.content.text).text : null,
        addedAt: new Date().toISOString()
      };
      
      let counts = { talkingPoints: 0, quotes: 0, notes: 0 };
      
      // Auto-add talking points
      if (result.talkingPoints?.length > 0) {
        result.talkingPoints.forEach(tp => {
          storage.addTalkingPoint(tp.title, tp.content, tp.category || 'core');
          counts.talkingPoints++;
        });
      }
      
      // Auto-add quotes
      if (result.quotes?.length > 0) {
        result.quotes.forEach(q => {
          storage.addQuote({
            quote: q.quote,
            source: q.source,
            context: q.context || '',
            sourceFile: compressedSource
          });
          counts.quotes++;
        });
      }
      
      // Auto-add notes
      if (result.notes?.length > 0) {
        result.notes.forEach(n => {
          storage.addThought({
            content: `TITLE: ${n.title}\n${n.content}`,
            fileName: content.fileName,
            originalSource: compressedSource
          });
          counts.notes++;
        });
      }
      
      // Refresh UI
      this.data = storage.getData();
      this.render();
      
      // Build summary toast
      const parts = [];
      if (counts.talkingPoints) parts.push(`${counts.talkingPoints} talking points`);
      if (counts.quotes) parts.push(`${counts.quotes} quotes`);
      if (counts.notes) parts.push(`${counts.notes} notes`);
      
      if (parts.length > 0) {
        this.showToast(`Added: ${parts.join(', ')}`, 'success');
      } else {
        this.showToast('No items extracted', 'info');
      }
      
      this.pendingDroppedContent = null;
      
    } catch (error) {
      console.error('Import error:', error);
      this.showToast('Failed to analyze: ' + error.message, 'error');
      this.pendingDroppedContent = null;
    }
  }

  /**
   * Extract content for cheat sheet (talking points, quotes, notes)
   */
  async extractForCheatSheet(content) {
    const textContent = content.content?.text || '';
    const isImage = content.type === 'image';
    
    const existingTalkingPoints = this.data?.talkingPoints || [];
    const existingContext = existingTalkingPoints.length > 0
      ? `Current talking points: ${existingTalkingPoints.map(tp => tp.title).join(', ')}`
      : 'No existing talking points.';
    
    const prompt = `Extract content for an investor cheat sheet. Be thorough but selective.

${existingContext}

CONTENT TO ANALYZE:
${isImage ? '[Image - extract all visible text]' : textContent.substring(0, 12000)}

Extract into three categories:

1. TALKING POINTS - Strong investor-ready statements
   - Punchy, casual language (like talking to a friend)
   - Concrete numbers and traction
   - Max 5 new talking points
   - Don't duplicate existing ones

2. QUOTES - Customer/partner/investor quotes
   - Exact quote text with attribution
   - Only genuine quotes (in quotation marks or blockquotes)

3. NOTES - Reference material worth saving
   - Team updates, context, research
   - Info that's useful but not investor-facing

Return JSON:
{
  "talkingPoints": [
    { "title": "Short punchy title", "content": "1-2 sentences, casual tone", "category": "core|traction|market|testimonials" }
  ],
  "quotes": [
    { "quote": "The exact quote text", "source": "Name, Title/Company", "context": "Brief context" }
  ],
  "notes": [
    { "title": "Note title", "content": "The content" }
  ]
}

TONE RULES:
- Talking points should sound like a confident founder at a coffee chat
- No corporate jargon or buzzwords
- Specific > vague (use real numbers)
- Short > long`;

    let messages;
    
    if (isImage && content.content?.dataUrl) {
      const matches = content.content.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid image data');
      
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: matches[1], data: matches[2] } },
          { type: 'text', text: prompt }
        ]
      }];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

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
        max_tokens: 4000,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Extraction failed');
    }

    const result = await response.json();
    const responseText = result.content[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse response');
    
    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Open pipeline update modal
   */
  openPipelineUpdate() {
    document.getElementById('pipeline-paste-text').value = '';
    this.showModal('pipeline-update-modal');
    document.getElementById('pipeline-paste-text').focus();
  }

  /**
   * Process pasted pipeline email
   */
  async processPipelineUpdate() {
    const text = document.getElementById('pipeline-paste-text').value.trim();
    if (!text) {
      this.showToast('Please paste your pipeline email', 'error');
      return;
    }
    
    this.showToast('Extracting deals...', 'info');
    
    try {
      const deals = await this.extractPipelineDeals(text);
      
      if (deals.length === 0) {
        this.showToast('No deals found in text', 'info');
        return;
      }
      
      // Add/update deals
      deals.forEach(deal => {
        storage.addPipelineDeal({
          name: deal.name,
          value: deal.value || '',
          stage: deal.stage || 'discovery',
          timing: deal.timing || ''
        });
      });
      
      // Update pipeline total if provided
      if (deals.pipelineTotal) {
        this.data.pipeline.totalValue = deals.pipelineTotal;
        const stat = this.data.stats.find(s => s.id === 'pipeline');
        if (stat) stat.value = deals.pipelineTotal;
      }
      
      this.data = storage.getData();
      this.render();
      this.hideModal('pipeline-update-modal');
      this.showToast(`Pipeline updated: ${deals.length} deals`, 'success');
      
    } catch (error) {
      console.error('Pipeline update error:', error);
      this.showToast('Failed to extract: ' + error.message, 'error');
    }
  }

  /**
   * Extract pipeline deals from email text
   */
  async extractPipelineDeals(text) {
    const prompt = `Extract sales pipeline deals from this email/text.

TEXT:
${text.substring(0, 8000)}

Extract each company/deal mentioned with:
- Company name
- Deal value (if mentioned)
- Stage: discovery, demo, validation, pilot, or closed
- Timing (Q1, Q2, etc. if mentioned)

Also extract the total pipeline value if mentioned.

Return JSON:
{
  "pipelineTotal": "$1.5M+" or null,
  "deals": [
    { "name": "Company Name", "value": "$50K", "stage": "pilot", "timing": "Q1" }
  ]
}

RULES:
- Only include actual sales prospects/deals
- Partnerships and integrations are NOT pipeline deals
- Stage mapping: "talking to" = discovery, "demo scheduled" = demo, "evaluating" = validation, "pilot" = pilot`;

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Extraction failed');
    }

    const result = await response.json();
    const responseText = result.content[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    const deals = parsed.deals || [];
    deals.pipelineTotal = parsed.pipelineTotal;
    return deals;
  }

  /**
   * Curate all content - AI analyzes and recommends what to keep/cut
   */
  async curateAllContent() {
    // Show modal with loading state
    this.showModal('curation-modal');
    document.getElementById('curation-loading').style.display = 'flex';
    document.getElementById('curation-results').style.display = 'none';
    document.getElementById('curation-footer').style.display = 'none';

    try {
      const talkingPoints = this.data?.talkingPoints || [];
      const quotes = storage.getQuotes() || [];
      const thoughts = storage.getThoughts() || [];

      const prompt = `You are curating an investor cheat sheet for Glossi, a seed-stage startup.

GLOSSI CONTEXT:
- Stage: Seed (finding product-market fit)
- Investor targets: Mix of angels, pre-seed/seed VCs, Series A VCs, and strategic investors
- Priority themes: traction, product differentiation, customer love, market opportunity, revenue model

QUALITY SIGNALS (good content should have at least one):
- Specific numbers or metrics (e.g., "$1.2M pipeline", "10+ prospects")
- Unique angle competitors can't claim
- Customer voice or proof (testimonials, case studies)
- Addresses common investor objections
- Memorable/quotable phrasing
- Validates market size or timing

CURRENT TALKING POINTS (${talkingPoints.length}):
${talkingPoints.map((tp, i) => `${i + 1}. "${tp.title}": ${tp.content}`).join('\n')}

CURRENT QUOTES (${quotes.length}):
${quotes.map((q, i) => `${i + 1}. "${q.quote}" - ${q.source}`).join('\n')}

CURRENT SCRATCHPAD (${thoughts.length}):
${thoughts.map((t, i) => {
  const createdAt = t.createdAt ? new Date(t.createdAt) : null;
  const ageWeeks = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;
  return `${i + 1}. [${ageWeeks}w old] ${t.content?.substring(0, 150)}...`;
}).join('\n')}

CURATION RULES:
- Target: 5-7 talking points maximum (investors can't absorb more)
- Max 3-5 quotes (quality over quantity)
- Scratchpad items older than 4 weeks without quality signals should be archived
- KEEP: Items with quality signals above
- CUT: Vague statements, duplicates, outdated info, internal details
- MERGE: Similar items into stronger single points
- PROMOTE: Scratchpad items that are investor-ready
- ARCHIVE: Stale content (mark with action "archive")

For each recommendation, include a confidence level: "high", "medium", or "low"
- High confidence: Auto-apply (for low-risk changes like categorization)
- Medium/Low confidence: Needs user review (for cuts, merges, promotions)

Return JSON:
{
  "summary": "Brief summary of recommended changes",
  "talkingPoints": [
    { "index": 0, "action": "keep|cut|merge", "reason": "Why", "confidence": "high|medium|low", "mergeWith": null or index }
  ],
  "quotes": [
    { "index": 0, "action": "keep|cut", "reason": "Why", "confidence": "high|medium|low" }
  ],
  "scratchpad": [
    { "index": 0, "action": "keep|cut|promote|archive", "reason": "Why", "confidence": "high|medium|low", "promoteTo": null or "talkingPoint" }
  ],
  "newMergedPoints": [
    { "title": "Merged title", "content": "Combined content", "mergedFrom": [0, 2] }
  ]
}`;

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
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Curation failed');
      }

      const result = await response.json();
      const responseText = result.content[0].text;
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse curation response');
      
      const curation = JSON.parse(jsonMatch[0]);
      this.pendingCuration = { curation, talkingPoints, quotes, scratchpad: thoughts };
      
      this.showCurationResults(curation, talkingPoints, quotes, thoughts);
      
    } catch (error) {
      console.error('Curation error:', error);
      this.hideModal('curation-modal');
      this.showToast('Curation failed: ' + error.message, 'error');
    }
  }

  /**
   * Show curation results in modal
   */
  showCurationResults(curation, talkingPoints, quotes, thoughts) {
    document.getElementById('curation-loading').style.display = 'none';
    document.getElementById('curation-results').style.display = 'block';
    document.getElementById('curation-footer').style.display = 'flex';

    // Summary
    document.getElementById('curation-summary').innerHTML = `
      <div class="curation-summary-text">${this.escapeHtml(curation.summary)}</div>
    `;

    // Build sections
    let sectionsHtml = '';

    // Talking Points section
    const tpKeep = curation.talkingPoints?.filter(r => r.action === 'keep').length || 0;
    const tpCut = curation.talkingPoints?.filter(r => r.action === 'cut').length || 0;
    const tpMerge = curation.talkingPoints?.filter(r => r.action === 'merge').length || 0;
    
    sectionsHtml += `
      <div class="curation-section">
        <div class="curation-section-header">
          <h4>Talking Points</h4>
          <span class="curation-stats">
            <span class="stat-keep">${tpKeep} keep</span>
            <span class="stat-cut">${tpCut} cut</span>
            ${tpMerge > 0 ? `<span class="stat-merge">${tpMerge} merge</span>` : ''}
          </span>
        </div>
        <div class="curation-items">
          ${(curation.talkingPoints || []).map((rec, i) => {
            const tp = talkingPoints[rec.index];
            if (!tp) return '';
            return `
              <div class="curation-item ${rec.action}" data-type="talkingPoint" data-index="${rec.index}">
                <div class="curation-item-icon">
                  ${rec.action === 'keep' ? '<span class="icon-keep">✓</span>' : 
                    rec.action === 'cut' ? '<span class="icon-cut">✕</span>' : 
                    '<span class="icon-merge">⊕</span>'}
                </div>
                <div class="curation-item-content">
                  <div class="curation-item-title">${this.escapeHtml(tp.title)}</div>
                  <div class="curation-item-reason">${this.escapeHtml(rec.reason)}</div>
                </div>
                <label class="curation-toggle">
                  <input type="checkbox" ${rec.action === 'keep' || rec.action === 'merge' ? 'checked' : ''} data-action="${rec.action}">
                  <span class="toggle-label">${rec.action === 'cut' ? 'Keep anyway' : 'Include'}</span>
                </label>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Quotes section
    if (quotes.length > 0) {
      const qKeep = curation.quotes?.filter(r => r.action === 'keep').length || 0;
      const qCut = curation.quotes?.filter(r => r.action === 'cut').length || 0;
      
      sectionsHtml += `
        <div class="curation-section">
          <div class="curation-section-header">
            <h4>Quotes</h4>
            <span class="curation-stats">
              <span class="stat-keep">${qKeep} keep</span>
              <span class="stat-cut">${qCut} cut</span>
            </span>
          </div>
          <div class="curation-items">
            ${(curation.quotes || []).map((rec, i) => {
              const q = quotes[rec.index];
              if (!q) return '';
              return `
                <div class="curation-item ${rec.action}" data-type="quote" data-index="${rec.index}">
                  <div class="curation-item-icon">
                    ${rec.action === 'keep' ? '<span class="icon-keep">✓</span>' : '<span class="icon-cut">✕</span>'}
                  </div>
                  <div class="curation-item-content">
                    <div class="curation-item-title">"${this.escapeHtml(q.quote?.substring(0, 60))}..."</div>
                    <div class="curation-item-reason">${this.escapeHtml(rec.reason)}</div>
                  </div>
                  <label class="curation-toggle">
                    <input type="checkbox" ${rec.action === 'keep' ? 'checked' : ''}>
                    <span class="toggle-label">${rec.action === 'cut' ? 'Keep anyway' : 'Include'}</span>
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Scratchpad section
    const scratchpadRecs = curation.scratchpad || curation.thoughts || [];
    if (thoughts.length > 0 && scratchpadRecs.length > 0) {
      const nKeep = scratchpadRecs.filter(r => r.action === 'keep').length || 0;
      const nCut = scratchpadRecs.filter(r => r.action === 'cut').length || 0;
      const nPromote = scratchpadRecs.filter(r => r.action === 'promote').length || 0;
      const nArchive = scratchpadRecs.filter(r => r.action === 'archive').length || 0;
      
      sectionsHtml += `
        <div class="curation-section">
          <div class="curation-section-header">
            <h4>Scratchpad</h4>
            <span class="curation-stats">
              <span class="stat-keep">${nKeep} keep</span>
              <span class="stat-cut">${nCut} cut</span>
              ${nPromote > 0 ? `<span class="stat-promote">${nPromote} promote</span>` : ''}
              ${nArchive > 0 ? `<span class="stat-archive">${nArchive} archive</span>` : ''}
            </span>
          </div>
          <div class="curation-items">
            ${scratchpadRecs.map((rec, i) => {
              const t = thoughts[rec.index];
              if (!t) return '';
              const title = t.content?.match(/^TITLE:\s*(.+?)(?:\n|$)/i)?.[1] || t.fileName || 'Untitled';
              const confidenceClass = rec.confidence === 'high' ? 'confidence-high' : rec.confidence === 'low' ? 'confidence-low' : 'confidence-medium';
              return `
                <div class="curation-item ${rec.action} ${confidenceClass}" data-type="scratchpad" data-index="${rec.index}">
                  <div class="curation-item-icon">
                    ${rec.action === 'keep' ? '<span class="icon-keep">✓</span>' : 
                      rec.action === 'cut' ? '<span class="icon-cut">✕</span>' : 
                      rec.action === 'archive' ? '<span class="icon-archive">📦</span>' :
                      '<span class="icon-promote">↑</span>'}
                  </div>
                  <div class="curation-item-content">
                    <div class="curation-item-title">${this.escapeHtml(title)}</div>
                    <div class="curation-item-reason">${this.escapeHtml(rec.reason)}</div>
                    <span class="confidence-indicator" title="${rec.confidence} confidence"></span>
                  </div>
                  <label class="curation-toggle">
                    <input type="checkbox" ${rec.action !== 'cut' ? 'checked' : ''}>
                    <span class="toggle-label">${rec.action === 'cut' ? 'Keep anyway' : rec.action === 'promote' ? 'Promote' : rec.action === 'archive' ? 'Archive' : 'Include'}</span>
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    document.getElementById('curation-sections').innerHTML = sectionsHtml;
  }

  /**
   * Apply curation changes
   */
  applyCuration() {
    if (!this.pendingCuration) return;
    
    const { curation, talkingPoints, quotes, scratchpad } = this.pendingCuration;
    const thoughts = scratchpad || this.pendingCuration.thoughts || [];
    let deletedCount = 0;
    let mergedCount = 0;
    let promotedCount = 0;
    let archivedCount = 0;

    // Process talking points - collect indices to delete (checked=false means delete)
    const tpToDelete = [];
    document.querySelectorAll('.curation-item[data-type="talkingPoint"]').forEach(el => {
      const checkbox = el.querySelector('input[type="checkbox"]');
      const index = parseInt(el.dataset.index);
      const rec = curation.talkingPoints?.find(r => r.index === index);
      
      if (!checkbox.checked && rec?.action !== 'merge') {
        const tp = talkingPoints[index];
        if (tp) tpToDelete.push(tp.id || tp.title);
      }
    });
    
    // Delete talking points
    tpToDelete.forEach(id => {
      const currentTps = this.data?.talkingPoints || [];
      const idx = currentTps.findIndex(tp => tp.id === id || tp.title === id);
      if (idx !== -1) {
        storage.deleteTalkingPoint(idx);
        deletedCount++;
      }
    });

    // Process quotes
    const quotesToDelete = [];
    document.querySelectorAll('.curation-item[data-type="quote"]').forEach(el => {
      const checkbox = el.querySelector('input[type="checkbox"]');
      const index = parseInt(el.dataset.index);
      
      if (!checkbox.checked) {
        const q = quotes[index];
        if (q) quotesToDelete.push(q.id);
      }
    });
    
    quotesToDelete.forEach(id => {
      storage.deleteQuote(id);
      deletedCount++;
    });

    // Process scratchpad items
    const scratchpadRecs = curation.scratchpad || curation.thoughts || [];
    const itemsToDelete = [];
    const itemsToPromote = [];
    const itemsToArchive = [];
    document.querySelectorAll('.curation-item[data-type="scratchpad"], .curation-item[data-type="thought"]').forEach(el => {
      const checkbox = el.querySelector('input[type="checkbox"]');
      const index = parseInt(el.dataset.index);
      const rec = scratchpadRecs.find(r => r.index === index);
      
      if (!checkbox.checked) {
        const t = thoughts[index];
        if (t) itemsToDelete.push(t.id);
      } else if (rec?.action === 'promote' && checkbox.checked) {
        const t = thoughts[index];
        if (t) itemsToPromote.push(t);
      } else if (rec?.action === 'archive' && checkbox.checked) {
        const t = thoughts[index];
        if (t) itemsToArchive.push(t.id);
      }
    });
    
    itemsToDelete.forEach(id => {
      storage.deleteScratchpadItem(id);
      deletedCount++;
    });

    // Archive stale items
    itemsToArchive.forEach(id => {
      storage.archiveScratchpadItem(id);
      archivedCount++;
    });

    // Promote scratchpad items to talking points
    itemsToPromote.forEach(item => {
      const title = item.content?.match(/^TITLE:\s*(.+?)(?:\n|$)/i)?.[1] || 'Promoted Note';
      const body = item.content?.replace(/^TITLE:\s*.+\n?/i, '').trim() || item.content;
      storage.addTalkingPoint(title, body, 'core');
      storage.deleteScratchpadItem(item.id);
      promotedCount++;
    });

    // Add merged points
    if (curation.newMergedPoints?.length > 0) {
      curation.newMergedPoints.forEach(merged => {
        storage.addTalkingPoint(merged.title, merged.content, 'core');
        mergedCount++;
      });
    }

    // Refresh
    this.data = storage.getData();
    this.render();
    this.hideModal('curation-modal');
    this.pendingCuration = null;

    // Show summary
    const parts = [];
    if (deletedCount) parts.push(`${deletedCount} removed`);
    if (mergedCount) parts.push(`${mergedCount} merged`);
    if (promotedCount) parts.push(`${promotedCount} promoted`);
    if (archivedCount) parts.push(`${archivedCount} archived`);
    
    this.showToast(parts.length > 0 ? `Curated: ${parts.join(', ')}` : 'No changes made', 'success');
  }

  /**
   * Run auto-curation after new content is added (if enabled)
   */
  async runAutoCuration() {
    // Check if auto-curation is enabled
    if (!this.settings.autoCurate) return;
    
    // Check if API is configured
    if (!aiProcessor.isConfigured()) return;
    
    // Don't run if we have very little content
    const scratchpad = storage.getScratchpad();
    const talkingPoints = this.data?.talkingPoints || [];
    if (scratchpad.length < 3 && talkingPoints.length < 5) return;
    
    // Show non-blocking notification
    this.showToast('Running smart curation...', 'info');
    
    try {
      // Run curation analysis
      const quotes = storage.getQuotes() || [];
      const thoughts = scratchpad;

      const prompt = `You are performing a QUICK curation check for Glossi's investor cheat sheet.
Only flag items that CLEARLY need attention. Be conservative.

CURRENT TALKING POINTS (${talkingPoints.length}):
${talkingPoints.map((tp, i) => `${i + 1}. "${tp.title}": ${tp.content}`).join('\n')}

CURRENT SCRATCHPAD (${thoughts.length}):
${thoughts.slice(0, 10).map((t, i) => {
  const createdAt = t.createdAt ? new Date(t.createdAt) : null;
  const ageWeeks = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;
  return `${i + 1}. [${ageWeeks}w old] ${t.content?.substring(0, 100)}...`;
}).join('\n')}

AUTO-CURATION RULES:
- Only auto-apply HIGH CONFIDENCE changes
- Archive items older than ${this.settings.staleThresholdWeeks || 4} weeks without quality signals
- Flag obvious duplicates
- Target: 5-7 talking points

Return JSON (only include items that need action):
{
  "autoApply": [
    { "type": "scratchpad", "index": 0, "action": "archive", "reason": "Stale (8 weeks old)" }
  ],
  "needsReview": [
    { "type": "talkingPoint", "index": 0, "action": "merge", "reason": "Similar to #2", "confidence": "medium" }
  ],
  "summary": "Brief summary or null if nothing to do"
}`;

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
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) return;

      const result = await response.json();
      const responseText = result.content[0].text;
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;
      
      const curation = JSON.parse(jsonMatch[0]);
      
      // Auto-apply high-confidence changes
      let autoAppliedCount = 0;
      if (curation.autoApply?.length > 0) {
        for (const item of curation.autoApply) {
          if (item.type === 'scratchpad' && item.action === 'archive') {
            const scratchpadItem = thoughts[item.index];
            if (scratchpadItem) {
              storage.archiveScratchpadItem(scratchpadItem.id);
              autoAppliedCount++;
            }
          }
        }
      }
      
      // Show notification if there are items needing review
      const needsReviewCount = curation.needsReview?.length || 0;
      
      if (autoAppliedCount > 0 || needsReviewCount > 0) {
        this.data = storage.getData();
        this.renderScratchpad();
        
        const parts = [];
        if (autoAppliedCount > 0) parts.push(`${autoAppliedCount} auto-archived`);
        if (needsReviewCount > 0) parts.push(`${needsReviewCount} need review`);
        
        this.showToast(parts.join(', ') + ' - Click Curate to review', 'info');
      }
      
    } catch (error) {
      // Silently fail for auto-curation
    }
  }

  /**
   * Fix redundancies and misplaced talking points
   */
  async fixTalkingPointRedundancies() {
    const talkingPoints = this.data?.talkingPoints || [];
    
    if (talkingPoints.length === 0) {
      this.showToast('No talking points to analyze', 'info');
      return;
    }
    
    this.showToast('Analyzing talking points...', 'info');
    
    try {
      const prompt = `Analyze these talking points for an investor cheat sheet. Find and fix:
1. DUPLICATES: Points saying the same thing
2. WRONG CATEGORY: Points in the wrong section
3. WEAK POINTS: Vague or unhelpful statements

CURRENT TALKING POINTS:
${talkingPoints.map((tp, i) => `${i}. [${tp.category}] "${tp.title}": ${tp.content}`).join('\n')}

CATEGORY DEFINITIONS:
- core: Core value proposition - what makes us unique, our approach
- traction: Proof points - revenue, pipeline, customers, growth metrics
- market: Market opportunity, timing, why now
- testimonials: Customer quotes, validation from users/partners

Return JSON with fixes:
{
  "analysis": "Brief summary of issues found",
  "fixes": [
    {
      "index": 0,
      "action": "delete|move|rewrite",
      "reason": "Why this fix",
      "newCategory": "core|traction|market|testimonials" (if move),
      "newTitle": "..." (if rewrite),
      "newContent": "..." (if rewrite),
      "duplicateOf": 2 (if delete due to duplicate)
    }
  ]
}

RULES:
- Only suggest changes that clearly improve the cheat sheet
- Prefer moving over deleting when possible
- Rewrite only if the point is good but poorly worded
- Keep investor-friendly, casual tone when rewriting`;

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
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Analysis failed');
      }

      const result = await response.json();
      const responseText = result.content[0].text;
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse response');
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      if (!analysis.fixes || analysis.fixes.length === 0) {
        this.showToast('No issues found - talking points look good!', 'success');
        return;
      }
      
      // Apply fixes (in reverse order to preserve indices)
      const sortedFixes = analysis.fixes.sort((a, b) => b.index - a.index);
      let deleted = 0, moved = 0, rewritten = 0;
      
      sortedFixes.forEach(fix => {
        const point = talkingPoints[fix.index];
        if (!point) return;
        
        if (fix.action === 'delete') {
          storage.deleteTalkingPoint(fix.index);
          deleted++;
        } else if (fix.action === 'move' && fix.newCategory) {
          storage.updateTalkingPoint(fix.index, point.title, point.content, fix.newCategory);
          moved++;
        } else if (fix.action === 'rewrite') {
          const newTitle = fix.newTitle || point.title;
          const newContent = fix.newContent || point.content;
          const newCategory = fix.newCategory || point.category;
          storage.updateTalkingPoint(fix.index, newTitle, newContent, newCategory);
          rewritten++;
        }
      });
      
      this.data = storage.getData();
      this.renderTalkingPoints();
      
      const parts = [];
      if (deleted) parts.push(`${deleted} removed`);
      if (moved) parts.push(`${moved} moved`);
      if (rewritten) parts.push(`${rewritten} improved`);
      
      this.showToast(`Fixed: ${parts.join(', ')}`, 'success');
      
    } catch (error) {
      console.error('Fix redundancies error:', error);
      this.showToast('Analysis failed: ' + error.message, 'error');
    }
  }

  /**
   * Build context of current site data for AI
   */
  buildSiteContext() {
    const talkingPoints = this.data?.talkingPoints || [];
    const quotes = storage.getQuotes() || [];
    const pipeline = storage.getAllPipelineClients() || [];
    const stats = this.data?.stats || [];
    
    return {
      talkingPoints: talkingPoints.map(tp => ({
        title: tp.title,
        content: tp.content,
        category: tp.category
      })),
      quotes: quotes.map(q => ({ quote: q.quote, source: q.source })),
      pipeline: pipeline.map(p => ({ name: p.name, value: p.value, stage: p.stage })),
      stats: stats.map(s => ({ id: s.id, value: s.value, label: s.label })),
      pipelineTotal: this.data?.pipeline?.totalValue || '$0'
    };
  }

  /**
   * Comprehensive AI extraction
   */
  async extractContentComprehensively(contentData, contentType, fileName, siteContext) {
    const textContent = contentData?.text || '';
    const isImage = contentType === 'image';
    
    const prompt = `You are analyzing content for an investor cheat sheet dashboard. Extract ALL relevant information.

CURRENT SITE DATA (check for inconsistencies):
Pipeline Total: ${siteContext.pipelineTotal}
Stats: ${siteContext.stats.map(s => `${s.label}: ${s.value}`).join(', ')}
Talking Points (${siteContext.talkingPoints.length}): ${siteContext.talkingPoints.map(tp => `"${tp.title}"`).join(', ') || 'None'}
Pipeline Deals: ${siteContext.pipeline.map(p => `${p.name} (${p.stage}) ${p.value}`).join(', ') || 'None'}

CONTENT TO ANALYZE:
${isImage ? '[Image - extract all visible text and data]' : textContent.substring(0, 12000)}

Extract and return JSON:
{
  "summary": "1-2 sentence summary of what this content contains",
  
  "pipelineDeals": [
    { "name": "Company Name", "value": "$50K", "stage": "discovery|demo|validation|pilot|closed", "isNew": true/false }
  ],
  
  "talkingPoints": [
    { "title": "Short punchy title", "content": "1-2 sentences, casual investor-friendly", "category": "core|traction|market|testimonials" }
  ],
  
  "quotes": [
    { "quote": "The exact quote", "source": "Person Name, Title/Company", "context": "Brief context" }
  ],
  
  "thoughts": [
    { "title": "Note title", "content": "Info worth saving but not investor-facing" }
  ],
  
  "inconsistencies": [
    { "field": "pipeline|stat|talkingPoint", "current": "Current value on site", "new": "New value in content", "suggestion": "What to update" }
  ]
}

RULES:
1. Pipeline: Extract company names, deal values, and stages. Flag if different from current data.
2. Talking Points: Only strong investor-ready statements. Keep short and punchy.
3. Quotes: Exact quotes from customers, partners, VCs. Include attribution.
4. Notes: Supporting info, context, research - not investor-facing but worth saving.
5. Inconsistencies: Flag ANY number differences (e.g., "$1.2M" vs "$1.5M" pipeline).
6. Use casual, glanceable language - no jargon. This is for board members.
7. If empty for a category, use empty array [].`;

    let messages;
    
    if (isImage && contentData?.dataUrl) {
      const matches = contentData.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid image data');
      
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: matches[1], data: matches[2] } },
          { type: 'text', text: prompt }
        ]
      }];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

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
        max_tokens: 4000,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Analysis failed');
    }

    const result = await response.json();
    const responseText = result.content[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse response');
    
    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Show extraction preview modal
   */
  showExtractionPreview(extraction, fileName) {
    document.getElementById('unified-modal-title').textContent = fileName || 'Content Extraction';
    document.getElementById('content-analysis-result').innerHTML = `
      <div class="extraction-summary">${this.escapeHtml(extraction.summary || 'Content analyzed')}</div>
    `;
    
    const sectionsEl = document.getElementById('unified-preview-sections');
    let html = '';
    
    // Inconsistencies (show first if any)
    if (extraction.inconsistencies?.length > 0) {
      html += `<div class="extraction-section inconsistencies">
        <div class="extraction-section-header">
          <span class="section-icon">⚠️</span>
          <span class="section-title">Inconsistencies Found</span>
          <span class="section-count">${extraction.inconsistencies.length}</span>
        </div>
        <div class="extraction-items">
          ${extraction.inconsistencies.map((inc, i) => `
            <label class="extraction-item inconsistency" data-type="inconsistency" data-index="${i}">
              <input type="checkbox" checked>
              <div class="item-content">
                <div class="item-main">${this.escapeHtml(inc.field)}: ${this.escapeHtml(inc.current)} → ${this.escapeHtml(inc.new)}</div>
                <div class="item-meta">${this.escapeHtml(inc.suggestion)}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>`;
    }
    
    // Pipeline Deals
    if (extraction.pipelineDeals?.length > 0) {
      html += `<div class="extraction-section pipeline">
        <div class="extraction-section-header">
          <span class="section-title">Pipeline Deals</span>
          <span class="section-count">${extraction.pipelineDeals.length}</span>
        </div>
        <div class="extraction-items">
          ${extraction.pipelineDeals.map((deal, i) => `
            <label class="extraction-item" data-type="pipeline" data-index="${i}">
              <input type="checkbox" checked>
              <div class="item-content">
                <div class="item-main">${this.escapeHtml(deal.name)} - ${this.escapeHtml(deal.value || 'TBD')}</div>
                <div class="item-meta">${deal.stage}${deal.isNew ? ' (new)' : ''}</div>
              </div>
              <select class="item-category" data-field="stage">
                <option value="discovery" ${deal.stage === 'discovery' ? 'selected' : ''}>Discovery</option>
                <option value="demo" ${deal.stage === 'demo' ? 'selected' : ''}>Demo</option>
                <option value="validation" ${deal.stage === 'validation' ? 'selected' : ''}>Validation</option>
                <option value="pilot" ${deal.stage === 'pilot' ? 'selected' : ''}>Pilot</option>
                <option value="closed" ${deal.stage === 'closed' ? 'selected' : ''}>Closed</option>
              </select>
            </label>
          `).join('')}
        </div>
      </div>`;
    }
    
    // Talking Points
    if (extraction.talkingPoints?.length > 0) {
      html += `<div class="extraction-section talking-points">
        <div class="extraction-section-header">
          <span class="section-title">Talking Points</span>
          <span class="section-count">${extraction.talkingPoints.length}</span>
        </div>
        <div class="extraction-items">
          ${extraction.talkingPoints.map((tp, i) => `
            <label class="extraction-item" data-type="talkingPoint" data-index="${i}">
              <input type="checkbox" checked>
              <div class="item-content">
                <div class="item-main">${this.escapeHtml(tp.title)}</div>
                <div class="item-meta">${this.escapeHtml(tp.content?.substring(0, 80))}...</div>
              </div>
              <select class="item-category" data-field="category">
                <option value="core" ${tp.category === 'core' ? 'selected' : ''}>Core</option>
                <option value="traction" ${tp.category === 'traction' ? 'selected' : ''}>Traction</option>
                <option value="market" ${tp.category === 'market' ? 'selected' : ''}>Market</option>
                <option value="testimonials" ${tp.category === 'testimonials' ? 'selected' : ''}>Testimonials</option>
              </select>
            </label>
          `).join('')}
        </div>
      </div>`;
    }
    
    // Quotes
    if (extraction.quotes?.length > 0) {
      html += `<div class="extraction-section quotes">
        <div class="extraction-section-header">
          <span class="section-title">Quotes</span>
          <span class="section-count">${extraction.quotes.length}</span>
        </div>
        <div class="extraction-items">
          ${extraction.quotes.map((q, i) => `
            <label class="extraction-item" data-type="quote" data-index="${i}">
              <input type="checkbox" checked>
              <div class="item-content">
                <div class="item-main">"${this.escapeHtml(q.quote?.substring(0, 60))}..."</div>
                <div class="item-meta">- ${this.escapeHtml(q.source)}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>`;
    }
    
    // Thoughts
    if (extraction.thoughts?.length > 0) {
      html += `<div class="extraction-section thoughts">
        <div class="extraction-section-header">
          <span class="section-title">Notes</span>
          <span class="section-count">${extraction.thoughts.length}</span>
        </div>
        <div class="extraction-items">
          ${extraction.thoughts.map((t, i) => `
            <label class="extraction-item" data-type="thought" data-index="${i}">
              <input type="checkbox" checked>
              <div class="item-content">
                <div class="item-main">${this.escapeHtml(t.title)}</div>
                <div class="item-meta">${this.escapeHtml(t.content?.substring(0, 60))}...</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>`;
    }
    
    // Empty state
    if (!html) {
      html = '<div class="extraction-empty">No extractable content found.</div>';
    }
    
    sectionsEl.innerHTML = html;
    sectionsEl.style.display = 'block';
    
    // Show footer
    const footerEl = document.getElementById('unified-preview-footer');
    footerEl.innerHTML = `
      <button class="btn-secondary" onclick="window.dashboard.cancelExtraction()">Cancel</button>
      <button class="btn-primary" onclick="window.dashboard.applyExtraction()">Apply Selected</button>
    `;
    footerEl.style.display = 'flex';
  }

  /**
   * Cancel extraction
   */
  cancelExtraction() {
    this.hideModal('content-action-modal');
    this.pendingDroppedContent = null;
    this.pendingExtraction = null;
  }

  /**
   * Apply selected extractions
   */
  async applyExtraction() {
    if (!this.pendingExtraction) return;
    
    const extraction = this.pendingExtraction;
    const content = this.pendingDroppedContent;
    
    // Compress source for linking
    const compressedSource = {
      fileName: content?.fileName,
      type: content?.type,
      text: content?.content?.text ? this.compressText(content.content.text).text : null,
      dataUrl: content?.type === 'image' ? await this.compressImage(content.content.dataUrl) : null,
      addedAt: new Date().toISOString()
    };
    
    let addedCounts = { pipeline: 0, talkingPoints: 0, quotes: 0, thoughts: 0, fixes: 0 };
    
    // Get all checked items
    const checkedItems = document.querySelectorAll('#unified-preview-sections .extraction-item input:checked');
    
    checkedItems.forEach(checkbox => {
      const item = checkbox.closest('.extraction-item');
      const type = item.dataset.type;
      const index = parseInt(item.dataset.index);
      
      if (type === 'inconsistency') {
        const inc = extraction.inconsistencies[index];
        this.applyInconsistencyFix(inc);
        addedCounts.fixes++;
      }
      else if (type === 'pipeline') {
        const deal = extraction.pipelineDeals[index];
        const stage = item.querySelector('select')?.value || deal.stage;
        storage.addPipelineDeal({ ...deal, stage, sourceFile: compressedSource });
        addedCounts.pipeline++;
      }
      else if (type === 'talkingPoint') {
        const tp = extraction.talkingPoints[index];
        const category = item.querySelector('select')?.value || tp.category;
        storage.addTalkingPoint(tp.title, tp.content, category);
        addedCounts.talkingPoints++;
      }
      else if (type === 'quote') {
        const quote = extraction.quotes[index];
        storage.addQuote({ ...quote, sourceFile: compressedSource });
        addedCounts.quotes++;
      }
      else if (type === 'thought') {
        const thought = extraction.thoughts[index];
        storage.addThought({
          content: `TITLE: ${thought.title}\n${thought.content}`,
          fileName: content?.fileName,
          originalSource: compressedSource
        });
        addedCounts.thoughts++;
      }
    });
    
    // Refresh UI
    this.data = storage.getData();
    this.render();
    
    // Build summary message
    const parts = [];
    if (addedCounts.pipeline) parts.push(`${addedCounts.pipeline} deals`);
    if (addedCounts.talkingPoints) parts.push(`${addedCounts.talkingPoints} talking points`);
    if (addedCounts.quotes) parts.push(`${addedCounts.quotes} quotes`);
    if (addedCounts.thoughts) parts.push(`${addedCounts.thoughts} notes`);
    if (addedCounts.fixes) parts.push(`${addedCounts.fixes} fixes`);
    
    this.hideModal('content-action-modal');
    this.showToast(`Added: ${parts.join(', ')}`, 'success');
    
    this.pendingDroppedContent = null;
    this.pendingExtraction = null;
  }

  /**
   * Apply an inconsistency fix
   */
  applyInconsistencyFix(inc) {
    if (inc.field === 'pipeline' || inc.field === 'pipelineTotal') {
      this.data.pipeline.totalValue = inc.new;
      const stat = this.data.stats.find(s => s.id === 'pipeline');
      if (stat) stat.value = inc.new;
    } else if (inc.field === 'stat') {
      const stat = this.data.stats.find(s => s.id === inc.statId || s.label.toLowerCase().includes(inc.field.toLowerCase()));
      if (stat) stat.value = inc.new;
    }
    // Update talking points that mention old value
    this.data.talkingPoints?.forEach(tp => {
      if (tp.content?.includes(inc.current)) {
        tp.content = tp.content.replace(inc.current, inc.new);
      }
    });
    storage.updateSection('pipeline', this.data.pipeline);
    storage.updateSection('stats', this.data.stats);
    storage.updateSection('talkingPoints', this.data.talkingPoints);
  }

  /**
   * Show unified preview modal with all extracted data
   */
  showUnifiedPreview(data, fileName) {
    document.getElementById('unified-modal-title').textContent = fileName || 'Content Analysis';
    document.getElementById('content-analysis-result').innerHTML = `
      <div class="unified-summary">
        <p>${this.escapeHtml(data.contentSummary || 'Content analyzed')}</p>
      </div>
    `;
    
    const sectionsContainer = document.getElementById('unified-preview-sections');
    let html = '';
    
    // Stats Updates
    if (data.statsUpdates && data.statsUpdates.length > 0) {
      html += this.renderUnifiedSection('stats', 'Stats Updates', data.statsUpdates.map(s => ({
        id: `stat-${s.stat}`,
        title: s.stat.charAt(0).toUpperCase() + s.stat.slice(1),
        detail: `<span class="unified-stat-update"><span class="unified-stat-old">${this.getCurrentStatValue(s.stat)}</span> <span class="unified-stat-arrow">→</span> <span class="unified-stat-new">${s.newValue}</span></span>`,
        meta: s.reason,
        badge: 'stat',
        data: s
      })));
    }
    
    // Pipeline Deals
    if (data.pipelineDeals && data.pipelineDeals.length > 0) {
      html += this.renderUnifiedSection('pipeline', 'Pipeline Highlights', data.pipelineDeals.map((d, i) => ({
        id: `pipeline-${i}`,
        title: `${d.name} ${d.value ? '(' + d.value + ')' : ''}`,
        detail: d.signal,
        meta: d.stage,
        data: d
      })));
    }
    
    // Meeting Data
    if (data.meeting && (data.meeting.summary?.length || data.meeting.todos?.length || data.meeting.decisions?.length)) {
      const meetingItems = [];
      
      if (data.meeting.summary?.length) {
        data.meeting.summary.forEach((s, i) => {
          meetingItems.push({
            id: `summary-${i}`,
            title: 'Summary',
            detail: s,
            badge: 'meeting',
            type: 'summary',
            data: s
          });
        });
      }
      
      if (data.meeting.todos?.length) {
        data.meeting.todos.forEach((t, i) => {
          meetingItems.push({
            id: `todo-${i}`,
            title: `<span class="unified-owner">${t.owner || 'Unassigned'}</span> ${this.escapeHtml(t.text)}`,
            detail: '',
            badge: 'meeting',
            type: 'todo',
            data: t
          });
        });
      }
      
      if (data.meeting.decisions?.length) {
        data.meeting.decisions.forEach((d, i) => {
          meetingItems.push({
            id: `decision-${i}`,
            title: 'Decision',
            detail: d,
            badge: 'meeting',
            type: 'decision',
            data: d
          });
        });
      }
      
      html += this.renderUnifiedSection('meeting', `Week at a Glance${data.meeting.title ? ' - ' + data.meeting.title : ''}`, meetingItems);
    }
    
    // Talking Points
    if (data.talkingPoints && data.talkingPoints.length > 0) {
      html += this.renderUnifiedSection('talkingPoints', 'Talking Points', data.talkingPoints.map((t, i) => ({
        id: `tp-${i}`,
        title: t.title,
        detail: t.content,
        meta: t.category,
        data: t
      })));
    }
    
    // Quotes/Testimonials
    if (data.quotes && data.quotes.length > 0) {
      html += this.renderUnifiedSection('quotes', 'Customer Validation', data.quotes.map((q, i) => ({
        id: `quote-${i}`,
        title: `"${q.quote}"`,
        detail: `— ${q.source}`,
        meta: q.context,
        data: q
      })));
    }
    
    // Milestones
    if (data.milestones && data.milestones.length > 0) {
      html += this.renderUnifiedSection('milestones', 'Milestones', data.milestones.map((m, i) => ({
        id: `milestone-${i}`,
        title: m.title,
        detail: `<span class="unified-stat-update"><span class="unified-stat-old">${m.before}</span> <span class="unified-stat-arrow">→</span> <span class="unified-stat-new">${m.after}</span></span>`,
        data: m
      })));
    }
    
    // Fundraising
    if (data.fundraising && (data.fundraising.target || data.fundraising.committed)) {
      const fundItems = [];
      if (data.fundraising.target) {
        fundItems.push({ id: 'fund-target', title: 'Target', detail: data.fundraising.target, data: { field: 'target', value: data.fundraising.target } });
      }
      if (data.fundraising.committed) {
        fundItems.push({ id: 'fund-committed', title: 'Committed', detail: data.fundraising.committed, data: { field: 'committed', value: data.fundraising.committed } });
      }
      if (data.fundraising.cap) {
        fundItems.push({ id: 'fund-cap', title: 'Cap', detail: data.fundraising.cap, data: { field: 'cap', value: data.fundraising.cap } });
      }
      html += this.renderUnifiedSection('fundraising', 'Fundraising', fundItems);
    }
    
    // Thoughts (reference material)
    if (data.thoughts && data.thoughts.length > 0) {
      html += this.renderUnifiedSection('thoughts', 'Thoughts (Reference)', data.thoughts.map((t, i) => ({
        id: `thought-${i}`,
        title: t.content.substring(0, 60) + (t.content.length > 60 ? '...' : ''),
        detail: t.content,
        meta: t.reason,
        badge: 'thought',
        data: t
      })));
    }
    
    // Inconsistencies (fixes needed)
    if (data.inconsistencies && data.inconsistencies.length > 0) {
      html += this.renderUnifiedSection('inconsistencies', 'Fixes Needed (Outdated Info)', data.inconsistencies.map((inc, i) => ({
        id: `fix-${i}`,
        title: `${inc.section}: ${inc.issue}`,
        detail: `<span class="unified-stat-update"><span class="unified-stat-old">"${this.escapeHtml(inc.currentText?.substring(0, 50) || '')}..."</span> <span class="unified-stat-arrow">→</span> <span class="unified-stat-new">"${this.escapeHtml(inc.suggestedFix?.substring(0, 50) || '')}..."</span></span>`,
        meta: `Section: ${inc.section}`,
        badge: 'fix',
        data: inc
      })));
    }
    
    if (!html) {
      html = '<div class="empty-state">No actionable data found in this content.</div>';
    }
    
    sectionsContainer.innerHTML = html;
    sectionsContainer.style.display = 'flex';
    document.getElementById('unified-preview-footer').style.display = 'flex';
    
    // Setup event listeners for section checkboxes
    this.setupUnifiedPreviewListeners();
  }

  /**
   * Show testimonials preview with option to add all to quotes library
   */
  showTestimonialsPreview(data, fileName) {
    document.getElementById('unified-modal-title').textContent = 'Testimonials Detected';
    document.getElementById('content-analysis-result').innerHTML = `
      <div class="unified-summary">
        <p>Found <strong>${data.quotes.length} quotes</strong> from ${this.escapeHtml(data.summary || fileName)}</p>
      </div>
    `;
    
    const sectionsContainer = document.getElementById('unified-preview-sections');
    
    // Show all quotes with checkboxes
    let html = `
      <div class="unified-section">
        <div class="unified-section-header">
          <label class="unified-section-checkbox">
            <input type="checkbox" checked data-section="quotes">
            <span class="checkmark"></span>
          </label>
          <h4>Quotes to Import (${data.quotes.length})</h4>
        </div>
        <div class="unified-section-items">
    `;
    
    data.quotes.forEach((q, i) => {
      html += `
        <div class="unified-item" data-item-type="quote" data-item-id="quote-${i}">
          <label class="unified-item-checkbox">
            <input type="checkbox" checked>
            <span class="checkmark"></span>
          </label>
          <div class="unified-item-content">
            <div class="unified-item-title">"${this.escapeHtml(q.quote.substring(0, 80))}${q.quote.length > 80 ? '...' : ''}"</div>
            <div class="unified-item-detail">- ${this.escapeHtml(q.source)}</div>
            ${q.context ? `<div class="unified-item-meta">${this.escapeHtml(q.context)}</div>` : ''}
          </div>
          <span class="unified-item-badge badge-quote">quote</span>
        </div>
      `;
    });
    
    html += '</div></div>';
    
    sectionsContainer.innerHTML = html;
    sectionsContainer.style.display = 'flex';
    document.getElementById('unified-preview-footer').style.display = 'flex';
    
    // Store quotes data for apply
    this.pendingExtractedData = data;
    
    // Setup listeners
    this.setupTestimonialsListeners(data);
  }

  /**
   * Setup event listeners for testimonials preview
   */
  setupTestimonialsListeners(data) {
    const footer = document.getElementById('unified-preview-footer');
    
    // Section checkbox toggles all items
    const sectionCheckbox = document.querySelector('[data-section="quotes"]');
    if (sectionCheckbox) {
      sectionCheckbox.addEventListener('change', (e) => {
        const items = document.querySelectorAll('[data-item-type="quote"] input[type="checkbox"]');
        items.forEach(cb => cb.checked = e.target.checked);
      });
    }
    
    // Apply button
    const applyBtn = footer.querySelector('.btn-primary');
    if (applyBtn) {
      applyBtn.onclick = () => this.applySelectedQuotes(data);
    }
    
    // Cancel button
    const cancelBtn = footer.querySelector('.btn-secondary');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.hideModal('content-action-modal');
        this.pendingDroppedContent = null;
        this.pendingExtractedData = null;
      };
    }
  }

  /**
   * Apply selected quotes to the quotes library
   */
  applySelectedQuotes(data) {
    const selectedItems = document.querySelectorAll('[data-item-type="quote"] input[type="checkbox"]:checked');
    let addedCount = 0;
    
    selectedItems.forEach(cb => {
      const item = cb.closest('.unified-item');
      const id = item.dataset.itemId;
      const index = parseInt(id.replace('quote-', ''));
      const quote = data.quotes[index];
      
      if (quote) {
        storage.addQuote({
          quote: quote.quote,
          source: quote.source,
          context: quote.context || ''
        });
        addedCount++;
      }
    });
    
    this.data = storage.getData();
    this.renderQuotes();
    this.hideModal('content-action-modal');
    
    this.showToast(`Added ${addedCount} quotes to library`, 'success');
    
    this.pendingDroppedContent = null;
    this.pendingExtractedData = null;
  }

  /**
   * Render a section in the unified preview
   */
  renderUnifiedSection(sectionId, title, items) {
    const categoryOptions = [
      { value: 'talkingPoints', label: 'Talking Point' },
      { value: 'thoughts', label: 'Thought' },
      { value: 'quotes', label: 'Quote' },
      { value: 'meeting-summary', label: 'Meeting Note' },
      { value: 'meeting-todo', label: 'Todo' },
      { value: 'skip', label: 'Skip' }
    ];
    
    return `
      <div class="unified-section" data-section="${sectionId}">
        <div class="unified-section-header">
          <input type="checkbox" id="section-${sectionId}" checked>
          <span class="unified-section-title">${title}</span>
          <span class="unified-section-count">${items.length}</span>
        </div>
        <div class="unified-section-items">
          ${items.map(item => `
            <div class="unified-item" data-item-id="${item.id}" data-item-type="${item.type || sectionId}" data-original-type="${item.type || sectionId}">
              <input type="checkbox" id="item-${item.id}" checked>
              <div class="unified-item-content">
                <div class="unified-item-title">${item.title}</div>
                ${item.detail ? `<div class="unified-item-detail">${item.detail}</div>` : ''}
                ${item.meta ? `<div class="unified-item-meta">${item.meta}</div>` : ''}
              </div>
              <select class="unified-item-category" onchange="this.closest('.unified-item').dataset.itemType = this.value">
                ${categoryOptions.map(opt => `
                  <option value="${opt.value}" ${(item.type || sectionId) === opt.value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
              </select>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Get current stat value for comparison
   */
  getCurrentStatValue(statId) {
    const stats = this.data?.stats || [];
    const stat = stats.find(s => s.id === statId);
    return stat?.value || '—';
  }

  /**
   * Setup event listeners for unified preview
   */
  setupUnifiedPreviewListeners() {
    // Section header checkboxes toggle all items
    document.querySelectorAll('.unified-section-header input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const section = e.target.closest('.unified-section');
        section.querySelectorAll('.unified-item input[type="checkbox"]').forEach(itemCb => {
          itemCb.checked = e.target.checked;
        });
      });
    });
    
    // Item checkboxes update section header state
    document.querySelectorAll('.unified-item input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const section = e.target.closest('.unified-section');
        const allItems = section.querySelectorAll('.unified-item input[type="checkbox"]');
        const checkedItems = section.querySelectorAll('.unified-item input[type="checkbox"]:checked');
        const sectionCb = section.querySelector('.unified-section-header input[type="checkbox"]');
        sectionCb.checked = checkedItems.length > 0;
        sectionCb.indeterminate = checkedItems.length > 0 && checkedItems.length < allItems.length;
      });
    });
    
    // Apply selected button
    document.getElementById('unified-apply-selected').onclick = () => this.applySelectedUpdates();
    document.getElementById('unified-cancel').onclick = () => {
      this.hideModal('content-action-modal');
      this.pendingDroppedContent = null;
      this.pendingExtractedData = null;
    };
  }

  /**
   * Apply selected updates from unified preview
   */
  async applySelectedUpdates() {
    const data = this.pendingExtractedData;
    if (!data) return;
    
    let appliedCount = 0;
    
    // Process each selected item
    document.querySelectorAll('.unified-item input[type="checkbox"]:checked').forEach(checkbox => {
      const itemEl = checkbox.closest('.unified-item');
      const itemType = itemEl.dataset.itemType;
      const originalType = itemEl.dataset.originalType;
      const itemId = itemEl.dataset.itemId;
      
      // Skip if user chose to skip
      if (itemType === 'skip') return;
      
      // Get item content regardless of original type
      const itemContent = this.getItemContent(data, originalType, itemId);
      
      try {
        // Check if item was re-categorized
        if (itemType !== originalType && ['thoughts', 'quotes', 'talkingPoints', 'meeting-summary', 'meeting-todo'].includes(itemType)) {
          if (this.saveToNewDestination(itemType, itemContent, this.pendingDroppedContent)) {
            appliedCount++;
          }
          return; // Don't process with original logic
        }
        
        switch (itemType) {
          case 'stats':
            const statData = data.statsUpdates?.find(s => `stat-${s.stat}` === itemId);
            if (statData) {
              this.updateStat(statData.stat, statData.newValue);
              appliedCount++;
            }
            break;
            
          case 'pipeline':
            const pipelineIdx = parseInt(itemId.replace('pipeline-', ''));
            const dealData = data.pipelineDeals?.[pipelineIdx];
            if (dealData) {
              storage.addDeal('closestToClose', {
                name: dealData.name,
                value: dealData.value || '$50K',
                stage: dealData.stage || 'discovery',
                timing: 'Q1',
                note: dealData.signal
              });
              appliedCount++;
            }
            break;
            
          case 'summary':
            const summaryIdx = parseInt(itemId.replace('summary-', ''));
            const summaryData = data.meeting?.summary?.[summaryIdx];
            if (summaryData) {
              this.addMeetingSummary(summaryData);
              appliedCount++;
            }
            break;
            
          case 'todo':
            const todoIdx = parseInt(itemId.replace('todo-', ''));
            const todoData = data.meeting?.todos?.[todoIdx];
            if (todoData) {
              this.addMeetingTodo(todoData.text, todoData.owner);
              appliedCount++;
            }
            break;
            
          case 'decision':
            const decisionIdx = parseInt(itemId.replace('decision-', ''));
            const decisionData = data.meeting?.decisions?.[decisionIdx];
            if (decisionData) {
              this.addMeetingDecision(decisionData);
              appliedCount++;
            }
            break;
            
          case 'talkingPoints':
            const tpIdx = parseInt(itemId.replace('tp-', ''));
            const tpData = data.talkingPoints?.[tpIdx];
            if (tpData) {
              storage.addTalkingPoint(tpData.title, tpData.content, tpData.category || 'core');
              appliedCount++;
            }
            break;
            
          case 'quotes':
            const quoteIdx = parseInt(itemId.replace('quote-', ''));
            const quoteData = data.quotes?.[quoteIdx];
            if (quoteData) {
              storage.addTalkingPoint(quoteData.source, quoteData.quote, 'testimonials');
              appliedCount++;
            }
            break;
            
          case 'milestones':
            const milestoneIdx = parseInt(itemId.replace('milestone-', ''));
            const milestoneData = data.milestones?.[milestoneIdx];
            if (milestoneData) {
              storage.addMilestone(milestoneData);
              appliedCount++;
            }
            break;
            
          case 'thoughts':
            const thoughtIdx = parseInt(itemId.replace('thought-', ''));
            const thoughtData = data.thoughts?.[thoughtIdx];
            if (thoughtData) {
              // Use the reason as title if available, otherwise create from content
              const thoughtTitle = thoughtData.reason || thoughtData.content.substring(0, 50);
              const droppedContent = this.pendingDroppedContent;
              
              // Use proper compression methods
              const compressedText = this.compressText(droppedContent?.content?.text);
              const isImage = droppedContent?.type === 'image';
              
              // For images, compress async and save
              if (isImage && droppedContent?.content?.dataUrl) {
                this.compressImage(droppedContent.content.dataUrl).then(compressedImage => {
                  storage.addThought({
                    type: 'image',
                    content: `TITLE: ${thoughtTitle}\nSUMMARY: ${thoughtData.content}`,
                    fileName: droppedContent?.fileName,
                    preview: compressedImage,
                    suggestedCategory: null,
                    originalSource: {
                      text: null,
                      dataUrl: compressedImage,
                      fileName: droppedContent?.fileName,
                      type: 'image',
                      truncated: false
                    }
                  });
                  this.data = storage.getData();
                  this.renderScratchpad();
                });
              } else {
                // Text content - save immediately
                storage.addThought({
                  type: droppedContent?.type || 'text',
                  content: `TITLE: ${thoughtTitle}\nSUMMARY: ${thoughtData.content}`,
                  fileName: droppedContent?.fileName,
                  preview: null,
                  suggestedCategory: null,
                  originalSource: {
                    text: compressedText.text,
                    dataUrl: null,
                    fileName: droppedContent?.fileName,
                    type: droppedContent?.type || 'text',
                    truncated: compressedText.truncated
                  }
                });
              }
              appliedCount++;
            }
            break;
            
          case 'inconsistencies':
            const fixIdx = parseInt(itemId.replace('fix-', ''));
            const fixData = data.inconsistencies?.[fixIdx];
            if (fixData) {
              this.applyInconsistencyFix(fixData);
              appliedCount++;
            }
            break;
        }
      } catch (e) {
        console.error('Error applying item:', itemType, itemId, e);
      }
    });
    
    // Refresh data and UI
    this.data = storage.getData();
    this.render();
    
    this.hideModal('content-action-modal');
    this.showToast(`Applied ${appliedCount} updates`, 'success');
    
    this.pendingDroppedContent = null;
    this.pendingExtractedData = null;
  }

  /**
   * Get item content from extracted data by original type and ID
   */
  getItemContent(data, originalType, itemId) {
    let title = '';
    let content = '';
    let source = '';
    
    switch (originalType) {
      case 'talkingPoints':
        const tpIdx = parseInt(itemId.replace('tp-', ''));
        const tp = data.talkingPoints?.[tpIdx];
        if (tp) {
          title = tp.title;
          content = tp.content;
        }
        break;
      case 'quotes':
        const qIdx = parseInt(itemId.replace('quote-', ''));
        const quote = data.quotes?.[qIdx];
        if (quote) {
          title = quote.source;
          content = quote.quote;
          source = quote.source;
        }
        break;
      case 'thoughts':
        const thIdx = parseInt(itemId.replace('thought-', ''));
        const thought = data.thoughts?.[thIdx];
        if (thought) {
          title = thought.reason || 'Reference Note';
          content = thought.content;
        }
        break;
      case 'summary':
        const sIdx = parseInt(itemId.replace('summary-', ''));
        content = data.meeting?.summary?.[sIdx] || '';
        title = 'Meeting Note';
        break;
      case 'todo':
        const todoIdx = parseInt(itemId.replace('todo-', ''));
        const todo = data.meeting?.todos?.[todoIdx];
        if (todo) {
          content = todo.text;
          title = 'Action Item';
        }
        break;
      case 'decision':
        const decIdx = parseInt(itemId.replace('decision-', ''));
        content = data.meeting?.decisions?.[decIdx] || '';
        title = 'Decision';
        break;
      case 'pipeline':
        const pIdx = parseInt(itemId.replace('pipeline-', ''));
        const deal = data.pipelineDeals?.[pIdx];
        if (deal) {
          title = deal.name;
          content = `${deal.value || ''} - ${deal.signal || deal.stage || ''}`;
        }
        break;
      case 'milestones':
        const mIdx = parseInt(itemId.replace('milestone-', ''));
        const milestone = data.milestones?.[mIdx];
        if (milestone) {
          title = milestone.title;
          content = `Before: ${milestone.before}, After: ${milestone.after}`;
        }
        break;
    }
    
    return { title, content, source };
  }

  /**
   * Save item to new destination based on re-categorization
   */
  saveToNewDestination(itemType, itemContent, droppedContent) {
    const { title, content, source } = itemContent;
    if (!content && !title) return false;
    
    switch (itemType) {
      case 'thoughts':
        // Always save and compress the source for thoughts
        const compressedText = this.compressText(droppedContent?.content?.text);
        const isImage = droppedContent?.type === 'image';
        
        if (isImage && droppedContent?.content?.dataUrl) {
          // Handle image - compress async
          this.compressImage(droppedContent.content.dataUrl).then(compressedImage => {
            storage.addThought({
              type: 'image',
              content: `TITLE: ${title}\nSUMMARY: ${content}`,
              fileName: droppedContent?.fileName,
              preview: compressedImage,
              suggestedCategory: null,
              originalSource: {
                text: null,
                dataUrl: compressedImage,
                fileName: droppedContent?.fileName,
                type: 'image',
                truncated: false
              }
            });
            this.data = storage.getData();
            this.renderScratchpad();
          });
        } else {
          // Handle text/audio - save immediately with compressed source
          storage.addThought({
            type: droppedContent?.type || 'text',
            content: `TITLE: ${title}\nSUMMARY: ${content}`,
            fileName: droppedContent?.fileName,
            suggestedCategory: null,
            originalSource: {
              text: compressedText.text,
              dataUrl: null,
              fileName: droppedContent?.fileName,
              type: droppedContent?.type || 'text',
              truncated: compressedText.truncated
            }
          });
        }
        return true;
        
      case 'quotes':
        storage.addQuote({
          quote: content,
          source: source || title,
          context: ''
        });
        return true;
        
      case 'talkingPoints':
        storage.addTalkingPoint(title || 'Key Point', content, 'core');
        return true;
        
      case 'meeting-summary':
        this.addMeetingSummary(content);
        return true;
        
      case 'meeting-todo':
        this.addMeetingTodo(content, 'Unassigned');
        return true;
    }
    
    return false;
  }

  /**
   * Update a stat value
   */
  updateStat(statId, newValue) {
    const stats = this.data.stats;
    const statIndex = stats.findIndex(s => s.id === statId);
    if (statIndex !== -1) {
      stats[statIndex].value = newValue;
      storage.scheduleSave();
    }
  }

  /**
   * Add summary to current meeting
   */
  addMeetingSummary(text) {
    let meeting = meetingsManager.getCurrentMeeting();
    if (!meeting) {
      meeting = meetingsManager.createMeeting('Imported Notes', new Date().toISOString().split('T')[0], '', {
        summary: [],
        todos: [],
        decisions: []
      });
    }
    if (!meeting.summary) meeting.summary = [];
    meeting.summary.push(text);
    meetingsManager.updateMeeting(meeting);
  }

  /**
   * Add todo to current meeting
   */
  addMeetingTodo(text, owner) {
    let meeting = meetingsManager.getCurrentMeeting();
    if (!meeting) {
      meeting = meetingsManager.createMeeting('Imported Notes', new Date().toISOString().split('T')[0], '', {
        summary: [],
        todos: [],
        decisions: []
      });
    }
    if (!meeting.todos) meeting.todos = [];
    meeting.todos.push({
      id: `todo-${Date.now()}`,
      text: text,
      owner: this.resolveOwnerName(owner),
      completed: false
    });
    meetingsManager.updateMeeting(meeting);
  }

  /**
   * Add decision to current meeting
   */
  addMeetingDecision(text) {
    let meeting = meetingsManager.getCurrentMeeting();
    if (!meeting) {
      meeting = meetingsManager.createMeeting('Imported Notes', new Date().toISOString().split('T')[0], '', {
        summary: [],
        todos: [],
        decisions: []
      });
    }
    if (!meeting.decisions) meeting.decisions = [];
    meeting.decisions.push(text);
    meetingsManager.updateMeeting(meeting);
  }

  /**
   * Apply an inconsistency fix (update existing content)
   */
  applyInconsistencyFix(fix) {
    if (!fix.section || !fix.suggestedFix) return;
    
    switch (fix.section) {
      case 'talkingPoints':
        // Find and update the talking point with outdated info
        const tps = this.data.talkingPoints || [];
        const tpIndex = tps.findIndex(tp => 
          tp.content.includes(fix.currentText?.substring(0, 30)) ||
          tp.title.includes(fix.currentText?.substring(0, 20))
        );
        if (tpIndex !== -1) {
          // Update the content with the fix
          if (fix.currentText && fix.suggestedFix) {
            tps[tpIndex].content = tps[tpIndex].content.replace(fix.currentText, fix.suggestedFix);
          }
          storage.updateTalkingPoint(tpIndex, tps[tpIndex].title, tps[tpIndex].content, tps[tpIndex].category);
          console.log('Fixed talking point:', tpIndex);
        }
        break;
        
      case 'stats':
        // Update stat value
        if (fix.currentText && fix.suggestedFix) {
          const statId = fix.issue?.toLowerCase().includes('pipeline') ? 'pipeline' :
                        fix.issue?.toLowerCase().includes('prospect') ? 'prospects' :
                        fix.issue?.toLowerCase().includes('partner') ? 'partnerships' : null;
          if (statId) {
            this.updateStat(statId, fix.suggestedFix);
            console.log('Fixed stat:', statId);
          }
        }
        break;
        
      default:
        console.log('Unknown section for fix:', fix.section);
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
   * Unified Content Intelligence - Analyze any content and extract all relevant data
   */
  async analyzeContentIntelligently(content, contentType, fileName) {
    const textContent = content?.text || '';
    const isImage = contentType === 'image';
    
    // Detect testimonial/quotes files
    const isTestimonialFile = 
      fileName?.toLowerCase().includes('testimonial') ||
      fileName?.toLowerCase().includes('quote') ||
      fileName?.toLowerCase().includes('customer') ||
      (textContent.match(/^>\s*.+/gm)?.length > 3); // Multiple blockquotes
    
    // Handle testimonial files with specialized extraction
    if (isTestimonialFile && !isImage) {
      return await this.extractTestimonials(textContent, fileName);
    }
    
    // Get current cheat sheet data for context
    const currentStats = this.data?.stats || [];
    const currentTalkingPoints = this.data?.talkingPoints || [];
    const currentPipeline = this.data?.pipeline || {};
    
    const currentContext = `
CURRENT CHEAT SHEET DATA (scan for inconsistencies):

STATS:
- Pipeline: ${currentStats.find(s => s.id === 'pipeline')?.value || 'unknown'}
- Prospects: ${currentStats.find(s => s.id === 'prospects')?.value || 'unknown'}
- Partnerships: ${currentStats.find(s => s.id === 'partnerships')?.value || 'unknown'}

EXISTING TALKING POINTS (check each for outdated numbers):
${currentTalkingPoints.map(tp => `- "${tp.title}": "${tp.content}"`).join('\n')}
`;
    
    // Build the prompt for comprehensive extraction
    const prompt = `You are analyzing content for a startup investor cheat sheet. This is a QUICK REFERENCE tool for board members and investors - not a technical document.

CRITICAL: CONSISTENCY CHECK
${currentContext}

IMPORTANT - NUMBER CONSISTENCY CHECK:
1. Extract ALL dollar amounts from the NEW content you're analyzing (e.g., "$1.5M", "$2M", "$50K")
2. Compare these numbers against the EXISTING talking points listed above
3. If you find ANY numeric mismatch - FLAG IT AS AN INCONSISTENCY
   Example: If new content says "$1.5M+ pipeline" but an existing talking point says "$1.2M+ pipeline" - that MUST be flagged
4. Check pipeline values, deal sizes, revenue numbers, percentages - ALL numbers must match

When you extract new data, ALSO check if any existing content above is now OUTDATED or INCONSISTENT with the new information:
- Numbers and dollar amounts must match across all sections
- If company stages changed, update references
- Dates and facts must be consistent

CRITICAL TONE REQUIREMENTS:
- Write for busy investors who want to glance and understand in seconds
- Use CASUAL, conversational language (like texting a friend about your startup)
- Keep everything SHORT and punchy - no corporate jargon or buzzwords
- If something is technical, translate it to plain English
- Think "coffee chat" not "board presentation"

BAD: "Implementing Gaussian splatting for world model integration enables prompt-to-3D capabilities"
GOOD: "New tech lets users create 3D scenes from text prompts - huge differentiator"

BAD: "Enterprise validation through advanced paid proof-of-concept engagements"
GOOD: "Big brands paying us to prove it works"

The dashboard sections:
- Stats: Pipeline value, deal count, partnerships
- Pipeline Highlights: Deals + why they're exciting (1 sentence max)
- Talking Points: Punchy statements an investor would remember
- Week at a Glance: Meeting notes, action items, decisions
- Milestones: Wins with clear before/after
- Thoughts: Internal reference (can be more detailed)

Content type: ${contentType}
File name: ${fileName || 'Unknown'}

${isImage ? 'This is an image - extract any visible text, numbers, or key information.' : `Content:
${textContent.substring(0, 12000)}`}

Respond with JSON containing extractable data (casual, glanceable language):

{
  "contentSummary": "One casual sentence about what this is",
  "contentType": "meeting_notes" | "investor_update" | "conversation" | "quotes" | "screenshot" | "general",
  
  "statsUpdates": [
    { "stat": "pipeline|prospects|partnerships", "newValue": "value", "reason": "short reason" }
  ],
  
  "pipelineDeals": [
    { "name": "Company", "value": "$X", "stage": "discovery|demo|validation|pilot", "signal": "1 sentence why exciting" }
  ],
  
  "talkingPoints": [
    { "title": "3-5 word title", "content": "1-2 casual sentences max", "category": "core|traction|market|testimonials" }
  ],
  
  "quotes": [
    { "quote": "Keep it punchy", "source": "Name/title", "context": "Brief" }
  ],
  
  "meeting": {
    "title": "Meeting name",
    "date": "YYYY-MM-DD",
    "summary": ["Short bullet", "Another bullet"],
    "todos": [
      { "text": "Clear action", "owner": "Jonathan|Ricky|Adam|Unassigned" }
    ],
    "decisions": ["Decision made"]
  },
  
  "milestones": [
    { "title": "What improved", "before": "Old", "after": "New" }
  ],
  
  "fundraising": {
    "target": "$X",
    "committed": "$X", 
    "cap": "$X",
    "investors": ["Name"]
  },
  
  "thoughts": [
    { "content": "Reference note (can be longer)", "reason": "Why save for later" }
  ],
  
  "inconsistencies": [
    { 
      "section": "talkingPoints|stats|pipeline",
      "issue": "What's wrong (e.g., 'Says $1.2M but should be $1.5M')",
      "currentText": "The text that needs updating",
      "suggestedFix": "Updated text with correct info"
    }
  ]
}

Rules:
- BREVITY IS KEY - if you can say it in fewer words, do it
- Translate technical content to investor-friendly language
- For owner detection: "Jonathan to...", "Ricky will...", "Adam needs to..."
- Quotes = third-party validation only (VCs, customers, experts)
- Talking points should make an investor say "oh, interesting!"
- Only include sections with actual data
- Empty arrays are fine
- IMPORTANT: Always check existing data for inconsistencies with new info`;

    let messages;
    
    if (isImage && content?.dataUrl) {
      // Vision request for images
      const matches = content.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid image data');
      
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: matches[1],
              data: matches[2]
            }
          },
          { type: 'text', text: prompt }
        ]
      }];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

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
        max_tokens: 4000,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Analysis failed');
    }

    const result = await response.json();
    const responseText = result.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      throw new Error('Failed to parse AI response');
    }
    
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('JSON parse error:', e, jsonMatch[0]);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Extract testimonials from a quotes/testimonials file and add to quotes library
   */
  async extractTestimonials(text, fileName) {
    const prompt = `Extract ALL customer quotes/testimonials from this document.

DOCUMENT:
${text.substring(0, 15000)}

For EACH quote, extract:
1. The exact quote text (keep it punchy and investor-ready, 1-2 sentences max)
2. Source (person name + company/title)
3. Brief context if available

IMPORTANT:
- Extract EVERY quote, don't summarize or combine them
- Keep quotes SHORT and impactful - trim if needed
- These will be used in investor emails, so they need to be compelling
- Include company/title with person's name for credibility

Respond with JSON:
{
  "quotes": [
    { "quote": "The exact quote text", "source": "Name, Company/Title", "context": "Brief context" }
  ],
  "summary": "One sentence describing the source of these quotes"
}`;

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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Extraction failed');
    }

    const result = await response.json();
    const responseText = result.content[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse response');
    
    const data = JSON.parse(jsonMatch[0]);
    
    // Return special format to indicate this is testimonials
    return {
      isTestimonials: true,
      quotes: data.quotes || [],
      summary: data.summary || `Quotes from ${fileName}`
    };
  }

  /**
   * Parse testimonials/quotes into individual items with AI suggestions
   */
  async parseTestimonials(text) {
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
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Parse this document into individual testimonials, quotes, or key insights. For each item, suggest whether it would be best as a "talking_point" (compelling for investors/sales) or "thought" (reference for later).

Document:
${text.substring(0, 8000)}

Respond in JSON format:
{
  "items": [
    {
      "quote": "the exact quote or key insight",
      "source": "who said it or where it's from",
      "context": "brief context if available",
      "suggestion": "talking_point" or "thought",
      "reason": "why this suggestion"
    }
  ]
}

Focus on extracting the most valuable, quotable content. Include statistics, specific claims, and compelling statements. Aim for 5-15 items max.`
        }]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to parse testimonials');
    }
    
    const result = await response.json();
    const responseText = result.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      return null;
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed testimonials:', parsed.items?.length, 'items');
      return parsed.items || [];
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return null;
    }
  }

  /**
   * Show options for grouped content (multiple quotes from one source)
   */
  showGroupedContentOptions(items, sourceContent) {
    const fileName = sourceContent.fileName || 'Document';
    const sourceType = sourceContent.type || 'text';
    
    // Build preview of items
    const previewHtml = items.slice(0, 3).map(item => `
      <div class="grouped-item-preview">
        <span class="preview-quote">"${this.escapeHtml(item.quote.substring(0, 80))}${item.quote.length > 80 ? '...' : ''}"</span>
        ${item.source ? `<span class="preview-source">- ${this.escapeHtml(item.source)}</span>` : ''}
      </div>
    `).join('');
    
    const html = `
      <div class="grouped-content-options">
        <div class="source-info">
          <span class="source-icon">${sourceType === 'audio' ? '🎙️' : sourceType === 'image' ? '🖼️' : '📄'}</span>
          <span class="source-name">${this.escapeHtml(fileName)}</span>
          <span class="source-count">${items.length} items found</span>
        </div>
        
        <div class="grouped-preview">
          ${previewHtml}
          ${items.length > 3 ? `<div class="more-items">+ ${items.length - 3} more...</div>` : ''}
        </div>
        
        <div class="grouped-actions">
          <button class="btn btn-secondary" onclick="window.dashboard.saveGroupedToThoughts()">
            Save All to Thoughts
          </button>
          <button class="btn btn-primary" onclick="window.dashboard.reviewItemsIndividually()">
            Review Each Item
          </button>
        </div>
      </div>
    `;
    
    // Store for later
    this.pendingGroupedItems = items;
    this.pendingGroupedSource = sourceContent;
    
    document.getElementById('content-analysis-result').innerHTML = html;
    document.getElementById('content-action-buttons').style.display = 'none';
    
    // Update modal title
    const modalTitle = document.querySelector('#content-action-modal h2');
    if (modalTitle) modalTitle.textContent = 'Content Found';
  }

  /**
   * Save all grouped items as one thought with sub-items
   */
  async saveGroupedToThoughts() {
    if (!this.pendingGroupedItems || !this.pendingGroupedSource) return;
    
    const items = this.pendingGroupedItems;
    const source = this.pendingGroupedSource;
    
    // Compress source content for storage
    const compressedText = this.compressText(source.content?.text);
    const compressedImage = source.type === 'image' 
      ? await this.compressImage(source.content?.dataUrl)
      : null;
    
    // Create thought with sub-items and compressed original source
    const thought = {
      type: source.type || 'document',
      fileName: source.fileName,
      sourceType: source.type,
      isGrouped: true,
      items: items.map(item => ({
        quote: item.quote,
        source: item.source,
        context: item.context,
        suggestion: item.suggestion
      })),
      content: `TITLE: ${source.fileName || 'Document'}\nSUMMARY: ${items.length} quotes/insights extracted`,
      suggestedCategory: 'testimonials',
      preview: compressedImage,
      // Save compressed original source for reference
      originalSource: {
        text: compressedText.text,
        dataUrl: compressedImage,
        fileName: source.fileName,
        type: source.type,
        truncated: compressedText.truncated
      }
    };
    
    storage.addThought(thought);
    
    this.hideModal('content-action-modal');
    this.renderScratchpad();
    this.showToast(`Saved ${items.length} items from ${source.fileName || 'document'}`, 'success');
    
    this.pendingGroupedItems = null;
    this.pendingGroupedSource = null;
  }

  /**
   * Switch to item-by-item review
   */
  reviewItemsIndividually() {
    if (!this.pendingGroupedItems) return;
    this.showItemReviewFlow(this.pendingGroupedItems);
    this.pendingGroupedItems = null;
    this.pendingGroupedSource = null;
  }

  /**
   * Show item-by-item review flow for multiple quotes/testimonials
   */
  showItemReviewFlow(items) {
    this.pendingItems = items;
    this.currentItemIndex = 0;
    this.savedItems = { thoughts: [], talkingPoints: [] };
    
    // Create modal content
    const modal = document.getElementById('content-action-modal');
    const modalContent = modal.querySelector('.modal-content') || modal.querySelector('.modal');
    
    // Update modal title
    const titleEl = modal.querySelector('h2');
    if (titleEl) titleEl.textContent = 'Review Testimonials';
    
    this.showModal('content-action-modal');
    this.renderCurrentItem();
  }

  /**
   * Render current item in review flow
   */
  renderCurrentItem() {
    const item = this.pendingItems[this.currentItemIndex];
    const total = this.pendingItems.length;
    const current = this.currentItemIndex + 1;
    
    const suggestionClass = item.suggestion === 'talking_point' ? 'suggestion-talking' : 'suggestion-thought';
    const suggestionText = item.suggestion === 'talking_point' ? 'Key Talking Point' : 'Save for Later';
    
    const html = `
      <div class="item-review">
        <div class="item-progress">
          <span>${current} of ${total}</span>
          <div class="item-progress-bar">
            <div class="item-progress-fill" style="width: ${(current / total) * 100}%"></div>
          </div>
        </div>
        
        <div class="item-quote">
          <blockquote>"${this.escapeHtml(item.quote)}"</blockquote>
          ${item.source ? `<cite>- ${this.escapeHtml(item.source)}</cite>` : ''}
          ${item.context ? `<p class="item-context">${this.escapeHtml(item.context)}</p>` : ''}
        </div>
        
        <div class="item-suggestion ${suggestionClass}">
          <span class="suggestion-label">Suggested:</span>
          <span class="suggestion-value">${suggestionText}</span>
          <p class="suggestion-reason">${this.escapeHtml(item.reason)}</p>
        </div>
        
        <div class="item-actions">
          <button class="btn btn-secondary" onclick="window.dashboard.reviewItemAction('skip')">
            Skip
          </button>
          <button class="btn btn-secondary" onclick="window.dashboard.reviewItemAction('thought')">
            Save to Thoughts
          </button>
          <button class="btn btn-primary" onclick="window.dashboard.reviewItemAction('talking_point')">
            Add to Talking Points
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('content-analysis-result').innerHTML = html;
    document.getElementById('content-action-buttons').style.display = 'none';
  }

  /**
   * Handle action for current review item
   */
  reviewItemAction(action) {
    const item = this.pendingItems[this.currentItemIndex];
    
    if (action === 'thought') {
      // Save to thoughts with testimonials suggestion since it's from testimonials parsing
      const thought = {
        type: 'testimonial',
        content: `TITLE: ${item.source || 'Quote'}\nSUMMARY: ${item.quote}\n${item.context ? `- ${item.context}` : ''}`,
        fileName: item.source,
        suggestedCategory: 'testimonials'
      };
      storage.addThought(thought);
      this.savedItems.thoughts.push(item);
      this.showToast('Saved to Thoughts', 'success');
    } else if (action === 'talking_point') {
      // Add to talking points under testimonials category
      const title = item.source || 'Customer Quote';
      const content = item.quote + (item.context ? ` (${item.context})` : '');
      storage.addTalkingPoint(title, content, 'testimonials');
      this.savedItems.talkingPoints.push(item);
      this.showToast('Added to Talking Points', 'success');
    }
    
    // Move to next item
    this.currentItemIndex++;
    
    if (this.currentItemIndex < this.pendingItems.length) {
      this.renderCurrentItem();
    } else {
      // Done reviewing all items
      this.finishItemReview();
    }
  }

  /**
   * Finish item review flow
   */
  finishItemReview() {
    const thoughtCount = this.savedItems.thoughts.length;
    const talkingCount = this.savedItems.talkingPoints.length;
    
    const html = `
      <div class="review-complete">
        <div class="review-icon">✓</div>
        <h3>Review Complete</h3>
        <p>
          ${talkingCount > 0 ? `<strong>${talkingCount}</strong> added to Talking Points<br>` : ''}
          ${thoughtCount > 0 ? `<strong>${thoughtCount}</strong> saved to Thoughts` : ''}
          ${talkingCount === 0 && thoughtCount === 0 ? 'No items saved' : ''}
        </p>
        <button class="btn btn-primary" onclick="window.dashboard.closeItemReview()">Done</button>
      </div>
    `;
    
    document.getElementById('content-analysis-result').innerHTML = html;
  }

  /**
   * Close item review and refresh UI
   */
  closeItemReview() {
    this.hideModal('content-action-modal');
    this.renderScratchpad();
    this.renderTalkingPoints();
    this.pendingItems = null;
    this.currentItemIndex = 0;
    this.savedItems = null;
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
   * Save analysis to Thoughts with AI category suggestion
   */
  async saveAnalysisToThoughts() {
    if (!this.pendingAnalysis) return;
    
    const content = this.pendingDroppedContent;
    
    // Compress source content for storage
    const compressedText = this.compressText(content?.content?.text);
    const compressedImage = content?.type === 'image' 
      ? await this.compressImage(content.content.dataUrl)
      : null;
    
    const thought = {
      type: content?.type || 'text',
      content: this.pendingAnalysis,
      preview: compressedImage,
      fileName: content?.fileName,
      suggestedCategory: null,
      // Save compressed original source for reference
      originalSource: {
        text: compressedText.text,
        dataUrl: compressedImage,
        fileName: content?.fileName,
        type: content?.type,
        truncated: compressedText.truncated
      }
    };
    
    // Get AI suggestion for category
    const suggestion = await this.getCategorySuggestion(this.pendingAnalysis);
    thought.suggestedCategory = suggestion;
    
    storage.addThought(thought);
    
    this.hideModal('content-action-modal');
    this.renderScratchpad();
    this.showToast('Saved to Thoughts', 'success');
    
    this.pendingAnalysis = null;
    this.pendingDroppedContent = null;
  }

  /**
   * Get AI category suggestion for content
   */
  async getCategorySuggestion(content) {
    if (!aiProcessor.isConfigured()) return null;
    
    try {
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
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: `Categorize for investor pitch. Reply with ONLY one word: core, traction, market, or testimonials.

Content: "${content.substring(0, 300)}"`
          }]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const text = result.content[0].text.toLowerCase().trim();
        
        if (text.includes('testimonial')) return 'testimonials';
        if (text.includes('traction')) return 'traction';
        if (text.includes('market')) return 'market';
        return 'core';
      }
    } catch (e) {
      console.error('Failed to get category suggestion:', e);
    }
    return null;
  }

  /**
   * Render quotes library (deprecated - section removed)
   */
  renderQuotes() {
    // Quotes section was removed - using Knowledge Base instead
    return;
    
    // Legacy code below
    const quotes = storage.getQuotes();
    const featuredContainer = document.getElementById('quotes-featured');
    const listContainer = document.getElementById('quotes-list');
    const countEl = document.getElementById('quotes-count');
    
    if (!listContainer) return;
    
    // Update count
    if (countEl) {
      countEl.textContent = quotes.length > 0 ? `(${quotes.length})` : '';
    }
    
    // Render featured quotes
    const featured = quotes.filter(q => q.featured);
    if (featured.length > 0 && featuredContainer) {
      featuredContainer.classList.add('has-featured');
      featuredContainer.innerHTML = `
        <div class="quotes-featured-label">Featured in Email (${featured.length}/3)</div>
        ${featured.map(q => `
          <div class="quote-item featured" data-quote-id="${q.id}">
            <div class="quote-content">
              <div class="quote-text">${this.escapeHtml(q.quote)}</div>
              <div class="quote-source">- ${this.escapeHtml(q.source)}</div>
            </div>
          </div>
        `).join('')}
      `;
    } else if (featuredContainer) {
      featuredContainer.classList.remove('has-featured');
      featuredContainer.innerHTML = '';
    }
    
    // Render all quotes
    if (quotes.length === 0) {
      listContainer.innerHTML = '<div class="quotes-empty">No quotes yet. Drop a testimonials file to import.</div>';
      return;
    }
    
    listContainer.innerHTML = quotes.map(q => `
      <div class="quote-item ${q.featured ? 'featured' : ''}" data-quote-id="${q.id}">
        <div class="quote-content">
          <div class="quote-text">${this.escapeHtml(q.quote)}</div>
          <div class="quote-source">- ${this.escapeHtml(q.source)}</div>
          ${q.context ? `<div class="quote-context">${this.escapeHtml(q.context)}</div>` : ''}
        </div>
        <div class="quote-actions">
          <button class="quote-action-btn feature-btn ${q.featured ? 'active' : ''}" 
                  onclick="window.dashboard.toggleQuoteFeatured('${q.id}')" 
                  title="${q.featured ? 'Remove from email' : 'Feature in email'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${q.featured ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button class="quote-action-btn delete-btn" 
                  onclick="window.dashboard.deleteQuote('${q.id}')" 
                  title="Delete quote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Toggle featured status of a quote
   */
  toggleQuoteFeatured(id) {
    const result = storage.toggleQuoteFeatured(id);
    if (result?.error) {
      this.showToast(result.error, 'error');
      return;
    }
    
    // Optimistic animation
    const el = document.querySelector(`[data-quote-id="${id}"]`);
    if (el) {
      el.style.transition = 'all 0.2s ease';
    }
    
    this.data = storage.getData();
    this.renderQuotes();
    
    if (result?.featured) {
      this.showToast('Quote will appear in email', 'success');
    } else {
      this.showToast('Quote removed from email', 'info');
    }
  }

  /**
   * Delete a quote
   */
  deleteQuote(id) {
    // Optimistic animation
    const el = document.querySelector(`[data-quote-id="${id}"]`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20px)';
      el.style.transition = 'all 0.15s ease-out';
    }
    
    setTimeout(() => {
      storage.deleteQuote(id);
      this.data = storage.getData();
      this.renderQuotes();
    }, 150);
    
    this.showToast('Quote deleted', 'success');
  }

  /**
   * Render scratchpad list (deprecated - section removed)
   */
  renderScratchpad() {
    // Scratchpad section was removed - using Knowledge Base instead
    return;
    
    // Legacy code below
    const items = storage.getScratchpad();
    const container = document.getElementById('scratchpad-list');
    const countEl = document.getElementById('scratchpad-count');
    
    if (!container || !countEl) return;
    
    countEl.textContent = items.length > 0 ? `(${items.length})` : '';
    
    if (items.length === 0) {
      container.innerHTML = '';
      this.renderArchivedScratchpad();
      return;
    }
    
    container.innerHTML = items.map((thought, index) => {
      // Ensure each item has a unique ID (fallback to index-based ID if missing)
      const itemId = thought.id || `scratchpad_fallback_${index}`;
      
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
      
      // Get display title for collapsed header
      const displayTitle = title || (thought.fileName ? thought.fileName : 'Untitled thought');
      const sourceFile = thought.fileName || thought.originalSource?.fileName;
      const itemCount = thought.isGrouped && thought.items ? thought.items.length : 0;
      const typeLabel = thought.type === 'image' ? 'image' : 
                        thought.type === 'audio' ? 'audio' : 
                        thought.isGrouped ? `${itemCount} items` : '';
      
      // Promotion suggestion (new format) or category suggestion (legacy)
      const categoryLabels = {
        core: 'Core Value',
        traction: 'Traction',
        market: 'Market',
        testimonials: 'Testimonial'
      };
      
      // Handle new promotionSuggestion format
      const promo = thought.promotionSuggestion;
      let suggestionBadge = '';
      
      if (promo?.shouldPromote) {
        const cat = promo.suggestedCategory || 'core';
        suggestionBadge = `
          <button class="suggestion-badge promote-suggestion" onclick="event.stopPropagation(); window.dashboard.quickPromote('${itemId}', '${cat}')" title="${this.escapeHtml(promo.reason || 'Promote to Talking Points')}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 11 12 6 7 11"></polyline>
              <line x1="12" y1="18" x2="12" y2="6"></line>
            </svg>
            Promote to ${categoryLabels[cat]}
          </button>`;
      } else if (promo && !promo.shouldPromote) {
        suggestionBadge = `<span class="suggestion-badge keep-thought" title="${this.escapeHtml(promo.reason || 'Keep in Scratchpad')}">Keep for reference</span>`;
      } else if (thought.suggestedCategory) {
        // Legacy format
        const suggestedCat = thought.suggestedCategory;
        suggestionBadge = `
          <button class="suggestion-badge" onclick="event.stopPropagation(); window.dashboard.quickPromote('${itemId}', '${suggestedCat}')" title="Add to ${categoryLabels[suggestedCat]} talking points">
            ${categoryLabels[suggestedCat]}
          </button>`;
      }
      
      // Build expandable content
      let expandableContent = '';
      
      // Grouped thought with multiple sub-items
      if (thought.isGrouped && thought.items && thought.items.length > 0) {
        expandableContent = `
          <div class="thought-expand-content grouped-items">
            ${thought.items.map((item, idx) => `
              <div class="grouped-sub-item" data-item-index="${idx}">
                <div class="sub-item-quote">"${this.escapeHtml(item.quote)}"</div>
                ${item.source ? `<div class="sub-item-source">- ${this.escapeHtml(item.source)}</div>` : ''}
                <div class="sub-item-actions">
                  <button class="sub-item-promote" onclick="event.stopPropagation(); window.dashboard.promoteSubItem('${itemId}', ${idx})" title="Add to Talking Points">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="17 11 12 6 7 11"></polyline>
                      <line x1="12" y1="18" x2="12" y2="6"></line>
                    </svg>
                  </button>
                  <button class="sub-item-delete" onclick="event.stopPropagation(); window.dashboard.deleteSubItem('${itemId}', ${idx})" title="Delete">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (thought.type === 'image' && thought.preview) {
        expandableContent = `
          <div class="thought-expand-content">
            <img src="${thought.preview}" alt="${thought.fileName || 'Image'}" class="thought-image-thumb" onclick="event.stopPropagation(); window.dashboard.showImagePreview('${itemId}')" style="width: 60px; height: 60px; margin-bottom: 8px;">
            ${summary ? `<div class="thought-summary" contenteditable="true" data-field="summary" data-thought-id="${itemId}" onclick="event.stopPropagation()">${this.escapeHtml(summary)}</div>` : ''}
            ${bullets.length > 0 ? `
              <ul class="thought-bullets">
                ${bullets.map((b, i) => `<li contenteditable="true" data-field="bullet-${i}" data-thought-id="${itemId}" onclick="event.stopPropagation()">${this.escapeHtml(b.replace(/^-\s*/, ''))}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `;
      } else if (hasAnalysis) {
        // Get the body text (everything after TITLE line)
        const bodyText = content.replace(/^TITLE:\s*.+\n?/i, '').replace(/^SUMMARY:\s*.+\n?/im, '').trim();
        const nonBulletContent = bodyText.replace(/^-\s*.+$/gm, '').trim();
        
        expandableContent = `
          <div class="thought-expand-content">
            ${summary ? `<div class="thought-summary">${this.escapeHtml(summary)}</div>` : ''}
            ${nonBulletContent && !summary ? `<div class="thought-body">${this.escapeHtml(nonBulletContent)}</div>` : ''}
            ${bullets.length > 0 ? `
              <ul class="thought-bullets">
                ${bullets.map((b, i) => `<li>${this.escapeHtml(b.replace(/^-\s*/, ''))}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `;
      } else {
        expandableContent = `
          <div class="thought-expand-content">
            <div class="thought-body">${this.escapeHtml(content)}</div>
          </div>
        `;
      }
      
      return `
        <div class="thought-item" data-thought-id="${itemId}">
          <div class="thought-header">
            <div class="thought-toggle" onclick="window.dashboard.toggleThought('${itemId}')">
              <svg class="thought-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span class="thought-header-title">${this.escapeHtml(displayTitle)}</span>
              ${sourceFile && sourceFile !== displayTitle ? `<span class="thought-source">from ${this.escapeHtml(sourceFile)}</span>` : ''}
              <span class="thought-date">${date}</span>
            </div>
            <div class="thought-actions">
              ${typeLabel ? `<span class="thought-type">${typeLabel}</span>` : ''}
              ${suggestionBadge}
              ${thought.originalSource ? `
              <button class="source-btn" onclick="window.dashboard.viewSource('${itemId}')" title="View original source">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </button>
              ` : ''}
              <button class="promote-btn" onclick="window.dashboard.promoteThought('${itemId}')" title="Choose category">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="17 11 12 6 7 11"></polyline>
                  <line x1="12" y1="18" x2="12" y2="6"></line>
                </svg>
              </button>
              <button class="delete-btn" onclick="window.dashboard.deleteThought('${itemId}')" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="thought-expandable">
            ${expandableContent}
          </div>
        </div>
      `;
    }).join('');
    
    // Setup edit listeners after render
    setTimeout(() => this.setupScratchpadEditListeners(), 0);
    
    // Also render archived section
    this.renderArchivedScratchpad();
  }

  /**
   * Render archived scratchpad items
   */
  renderArchivedScratchpad() {
    const archived = storage.getArchivedScratchpad();
    const container = document.getElementById('scratchpad-list');
    if (!container) return;
    
    // Remove existing archived section
    const existingArchived = container.querySelector('.archived-section');
    if (existingArchived) existingArchived.remove();
    
    if (archived.length === 0) return;
    
    const archivedHtml = `
      <div class="archived-section">
        <div class="archived-header" onclick="this.parentElement.classList.toggle('expanded')">
          <svg class="archived-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>Archived (${archived.length})</span>
        </div>
        <div class="archived-items">
          ${archived.map(item => {
            const content = item.content || '';
            const titleMatch = content.match(/^TITLE:\s*(.+?)(?:\n|$)/i);
            const title = titleMatch ? titleMatch[1].trim() : (item.fileName || 'Untitled');
            const archivedDate = new Date(item.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            return `
              <div class="archived-item" data-archived-id="${item.id}">
                <span class="archived-item-title">${this.escapeHtml(title)}</span>
                <span class="archived-item-date">${archivedDate}</span>
                <div class="archived-item-actions">
                  <button class="restore-btn" onclick="window.dashboard.restoreArchivedItem('${item.id}')" title="Restore">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                  </button>
                  <button class="delete-btn" onclick="window.dashboard.deleteArchivedItem('${item.id}')" title="Delete permanently">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', archivedHtml);
  }

  /**
   * Restore an archived scratchpad item
   */
  restoreArchivedItem(id) {
    storage.restoreArchivedItem(id);
    this.renderScratchpad();
    this.showToast('Item restored', 'success');
  }

  /**
   * Permanently delete an archived item
   */
  deleteArchivedItem(id) {
    storage.deleteArchivedItem(id);
    this.renderScratchpad();
    this.showToast('Item permanently deleted', 'success');
  }

  /**
   * Archive a scratchpad item
   */
  archiveScratchpadItem(id) {
    const result = this.findScratchpadItem(id);
    if (!result) {
      this.showToast('Item not found', 'error');
      return;
    }
    
    // Use actual ID for archiving (if available)
    const actualId = result.item.id;
    if (actualId) {
      storage.archiveScratchpadItem(actualId);
    } else {
      // For items without IDs, manually archive by moving to archived array
      const archived = storage.getArchivedScratchpad();
      archived.unshift({
        ...result.item,
        id: 'archived_' + Date.now(),
        archivedAt: new Date().toISOString()
      });
      const thoughts = storage.getThoughts();
      thoughts.splice(result.index, 1);
      storage.scheduleSave();
    }
    
    this.renderScratchpad();
    this.showToast('Item archived', 'success');
  }

  /**
   * Find a scratchpad item by ID (handles both actual IDs and fallback IDs)
   * Fallback IDs are in format: scratchpad_fallback_INDEX
   */
  findScratchpadItem(id) {
    const thoughts = storage.getThoughts();
    
    // Check for fallback ID format
    if (id && id.startsWith('scratchpad_fallback_')) {
      const index = parseInt(id.replace('scratchpad_fallback_', ''), 10);
      if (!isNaN(index) && index >= 0 && index < thoughts.length) {
        return { item: thoughts[index], index };
      }
      return null;
    }
    
    // Regular ID lookup
    const index = thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      return { item: thoughts[index], index };
    }
    return null;
  }

  /**
   * Toggle scratchpad item expand/collapse
   */
  toggleThought(id) {
    const el = document.querySelector(`.thought-item[data-thought-id="${id}"]`);
    if (el) {
      el.classList.toggle('expanded');
    }
  }

  /**
   * Delete a scratchpad item
   */
  deleteThought(id) {
    const result = this.findScratchpadItem(id);
    if (!result) {
      this.showToast('Item not found', 'error');
      return;
    }
    
    const el = document.querySelector(`[data-thought-id="${id}"]`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.95)';
    }
    
    setTimeout(() => {
      // Use the actual item ID for deletion
      const actualId = result.item.id;
      if (actualId) {
        storage.deleteScratchpadItem(actualId);
      } else {
        // If no ID, delete by index
        const thoughts = storage.getThoughts();
        thoughts.splice(result.index, 1);
        storage.scheduleSave();
      }
      this.renderScratchpad();
    }, 150);
    this.showToast('Item deleted', 'success');
  }

  /**
   * View original source file
   */
  viewSource(thoughtId) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result || !result.item.originalSource) {
      this.showToast('Source not available', 'info');
      return;
    }
    const thought = result.item;
    
    const source = thought.originalSource;
    const fileName = source.fileName || 'Source';
    const fileType = source.type || 'text';
    
    let contentHtml = '';
    
    if (source.dataUrl && (fileType === 'image')) {
      // Image source
      contentHtml = `<img src="${source.dataUrl}" alt="${fileName}" class="source-image">`;
    } else if (source.text) {
      // Text source
      contentHtml = `<pre class="source-text">${this.escapeHtml(source.text)}</pre>`;
    } else {
      contentHtml = '<p class="source-unavailable">Original source content not available</p>';
    }
    
    const html = `
      <div class="source-viewer">
        <div class="source-header">
          <span class="source-icon">${fileType === 'audio' ? '🎙️' : fileType === 'image' ? '🖼️' : '📄'}</span>
          <span class="source-filename">${this.escapeHtml(fileName)}</span>
        </div>
        <div class="source-content">
          ${contentHtml}
        </div>
      </div>
    `;
    
    document.getElementById('content-analysis-result').innerHTML = html;
    
    // Hide the footer buttons since this is just viewing source
    const footer = document.getElementById('unified-preview-footer');
    if (footer) footer.style.display = 'none';
    
    // Hide the preview sections
    const sections = document.getElementById('unified-preview-sections');
    if (sections) sections.style.display = 'none';
    
    // Update modal title
    document.getElementById('unified-modal-title').textContent = 'Original Source';
    
    this.showModal('content-action-modal');
  }

  /**
   * Promote a thought to talking points with AI category suggestion
   */
  async promoteThought(id) {
    const result = this.findScratchpadItem(id);
    if (!result) return;
    const thought = result.item;
    
    // Parse thought content
    const content = thought.content || '';
    const titleMatch = content.match(/^TITLE:\s*(.+?)(?:\n|$)/i);
    const summaryMatch = content.match(/^SUMMARY:\s*(.+?)(?:\n|$)/im);
    const title = titleMatch ? titleMatch[1].trim() : (thought.fileName || 'Untitled');
    const summary = summaryMatch ? summaryMatch[1].trim() : content.substring(0, 200);
    
    // Store for later (use actual ID if available, otherwise store the DOM ID and index)
    this.promotingThought = { 
      id: thought.id || id, 
      domId: id,
      index: result.index,
      title, 
      summary, 
      content 
    };
    
    // Show category selection modal
    this.showPromoteCategoryModal(title, summary);
    
    // Get AI suggestion in background
    if (aiProcessor.isConfigured()) {
      this.suggestCategory(summary);
    }
  }

  /**
   * Show modal for selecting category when promoting thought
   */
  showPromoteCategoryModal(title, summary) {
    const categories = storage.getTalkingPointCategories();
    const categoryLabels = {
      core: 'Core Value Prop',
      traction: 'Traction & Proof',
      market: 'Market & Timing',
      testimonials: 'Customer Validation'
    };
    
    const html = `
      <div class="promote-modal-content">
        <div class="promote-preview">
          <h4>${this.escapeHtml(title)}</h4>
          <p>${this.escapeHtml(summary.substring(0, 150))}${summary.length > 150 ? '...' : ''}</p>
        </div>
        
        <div class="promote-categories">
          <label class="category-select-label">Select Category:</label>
          <div class="category-options" id="category-options">
            ${categories.map(cat => `
              <button class="category-option" data-category="${cat}" onclick="window.dashboard.selectPromoteCategory('${cat}')">
                ${categoryLabels[cat] || cat}
              </button>
            `).join('')}
          </div>
          <div class="ai-suggestion" id="ai-category-suggestion">
            <span class="suggestion-loading">AI analyzing...</span>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('content-analysis-result').innerHTML = html;
    document.getElementById('content-action-buttons').style.display = 'none';
    
    // Update modal title
    const modalTitle = document.querySelector('#content-action-modal h2');
    if (modalTitle) modalTitle.textContent = 'Add to Talking Points';
    
    this.showModal('content-action-modal');
  }

  /**
   * Get AI suggestion for category
   */
  async suggestCategory(content) {
    try {
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
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Categorize this content for an investor pitch deck. Choose ONE category:
- core: Core value proposition, product differentiation, technical approach
- traction: Revenue, customers, pipeline, growth metrics, proof points
- market: Market timing, trends, why now, industry shifts
- testimonials: Customer quotes, validation, partner feedback

Content: "${content.substring(0, 500)}"

Respond with just the category name (core, traction, market, or testimonials) and a brief reason.`
          }]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const suggestion = result.content[0].text.toLowerCase();
        
        // Parse category from response
        let category = 'core';
        if (suggestion.includes('testimonial')) category = 'testimonials';
        else if (suggestion.includes('traction')) category = 'traction';
        else if (suggestion.includes('market')) category = 'market';
        
        // Update UI with suggestion
        const suggestionEl = document.getElementById('ai-category-suggestion');
        if (suggestionEl) {
          suggestionEl.innerHTML = `
            <span class="suggestion-label">AI Suggests:</span>
            <button class="category-option suggested" data-category="${category}" onclick="window.dashboard.selectPromoteCategory('${category}')">
              ${category === 'testimonials' ? 'Customer Validation' : 
                category === 'traction' ? 'Traction & Proof' : 
                category === 'market' ? 'Market & Timing' : 'Core Value Prop'}
            </button>
          `;
          
          // Highlight the suggested category
          document.querySelectorAll('.category-option').forEach(btn => {
            if (btn.dataset.category === category && !btn.classList.contains('suggested')) {
              btn.classList.add('ai-recommended');
            }
          });
        }
      }
    } catch (e) {
      console.error('Failed to get category suggestion:', e);
      const suggestionEl = document.getElementById('ai-category-suggestion');
      if (suggestionEl) suggestionEl.innerHTML = '';
    }
  }

  /**
   * Select category and complete promotion
   */
  selectPromoteCategory(category) {
    if (!this.promotingThought) return;
    
    const { id, title, summary, content } = this.promotingThought;
    
    // Add to talking points with category
    storage.addTalkingPoint(title, summary || content.substring(0, 300), category);
    this.data = storage.getData();
    
    // Optionally delete from thoughts
    storage.deleteThought(id);
    
    this.hideModal('content-action-modal');
    this.renderScratchpad();
    this.renderTalkingPoints();
    this.showToast(`Added to ${category === 'testimonials' ? 'Customer Validation' : category} talking points`, 'success');
    
    this.promotingThought = null;
  }

  /**
   * Quick promote using suggested category (one-click)
   */
  quickPromote(thoughtId, category) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result) return;
    const thought = result.item;
    
    // Parse thought content
    const content = thought.content || '';
    const titleMatch = content.match(/^TITLE:\s*(.+?)(?:\n|$)/i);
    const summaryMatch = content.match(/^SUMMARY:\s*(.+?)(?:\n|$)/im);
    const title = titleMatch ? titleMatch[1].trim() : (thought.fileName || 'Untitled');
    const summary = summaryMatch ? summaryMatch[1].trim() : content.substring(0, 200);
    
    // Add to talking points with category
    storage.addTalkingPoint(title, summary || content.substring(0, 300), category);
    this.data = storage.getData();
    
    // Delete from scratchpad (use actual ID if available, otherwise delete by index)
    const actualId = thought.id;
    if (actualId) {
      storage.deleteThought(actualId);
    } else {
      const thoughts = storage.getThoughts();
      thoughts.splice(result.index, 1);
      storage.scheduleSave();
    }
    
    // Animate removal
    const el = document.querySelector(`[data-thought-id="${thoughtId}"]`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
    }
    
    setTimeout(() => {
      this.renderScratchpad();
      this.renderTalkingPoints();
    }, 200);
    
    const categoryLabels = {
      core: 'Core Value Prop',
      traction: 'Traction & Proof',
      market: 'Market & Timing',
      testimonials: 'Customer Validation'
    };
    this.showToast(`Added to ${categoryLabels[category]}`, 'success');
  }

  /**
   * Promote a sub-item from a grouped thought to talking points
   */
  promoteSubItem(thoughtId, itemIndex) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result) return;
    const thought = result.item;
    if (!thought.isGrouped || !thought.items) return;
    
    const item = thought.items[itemIndex];
    if (!item) return;
    
    // Add to talking points
    const title = item.source || 'Quote';
    const content = item.quote + (item.context ? ` (${item.context})` : '');
    storage.addTalkingPoint(title, content, 'testimonials');
    this.data = storage.getData();
    
    // Remove item from thought
    thought.items.splice(itemIndex, 1);
    
    // Get actual ID for storage operations
    const actualId = thought.id;
    
    // If no items left, delete the thought
    if (thought.items.length === 0) {
      if (actualId) {
        storage.deleteThought(actualId);
      } else {
        const thoughts = storage.getThoughts();
        thoughts.splice(result.index, 1);
        storage.scheduleSave();
      }
    } else {
      // Update the thought
      if (actualId) {
        storage.updateThought(actualId, {
          items: thought.items,
          content: `TITLE: ${thought.fileName || 'Document'}\nSUMMARY: ${thought.items.length} quotes/insights remaining`
        });
      } else {
        storage.scheduleSave();
      }
    }
    
    // Animate the sub-item
    const subItem = document.querySelector(`[data-thought-id="${thoughtId}"] [data-item-index="${itemIndex}"]`);
    if (subItem) {
      subItem.style.opacity = '0';
      subItem.style.transform = 'translateX(20px)';
    }
    
    setTimeout(() => {
      this.renderScratchpad();
      this.renderTalkingPoints();
    }, 200);
    
    this.showToast('Added to Customer Validation', 'success');
  }

  /**
   * Delete a sub-item from a grouped thought
   */
  deleteSubItem(thoughtId, itemIndex) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result) return;
    const thought = result.item;
    if (!thought.isGrouped || !thought.items) return;
    
    // Animate the sub-item
    const subItem = document.querySelector(`[data-thought-id="${thoughtId}"] [data-item-index="${itemIndex}"]`);
    if (subItem) {
      subItem.style.opacity = '0';
      subItem.style.transform = 'translateX(-20px)';
    }
    
    // Get actual ID for storage operations
    const actualId = thought.id;
    
    setTimeout(() => {
      // Remove item from thought
      thought.items.splice(itemIndex, 1);
      
      // If no items left, delete the entire thought
      if (thought.items.length === 0) {
        if (actualId) {
          storage.deleteThought(actualId);
        } else {
          const thoughts = storage.getThoughts();
          thoughts.splice(result.index, 1);
          storage.scheduleSave();
        }
        this.showToast('All items deleted', 'success');
      } else {
        // Update the thought using proper method
        if (actualId) {
          storage.updateThought(actualId, {
            items: thought.items,
            content: `TITLE: ${thought.fileName || 'Document'}\nSUMMARY: ${thought.items.length} quotes/insights remaining`
          });
        } else {
          storage.scheduleSave();
        }
        this.showToast('Item deleted', 'success');
      }
      
      this.renderScratchpad();
    }, 150);
  }

  /**
   * Show image preview modal
   */
  showImagePreview(thoughtId) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result || !result.item.preview) return;
    
    document.getElementById('image-preview-img').src = result.item.preview;
    this.showModal('image-preview-modal');
  }

  /**
   * Update thought content when edited
   */
  updateThoughtContent(thoughtId, field, newValue) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result) return;
    const thought = result.item;
    
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
    
    // Update storage using proper method (use actual ID if available)
    const actualId = thought.id;
    if (actualId) {
      storage.updateThought(actualId, { content });
    } else {
      // Update directly and schedule save
      thought.content = content;
      storage.scheduleSave();
    }
  }

  /**
   * Setup scratchpad edit listeners
   */
  setupScratchpadEditListeners() {
    const container = document.getElementById('scratchpad-list');
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
   * Compress text content (truncate if too long)
   * @param {string} text - Original text
   * @param {number} maxLength - Max characters (default 20KB)
   * @returns {object} - { text, truncated }
   */
  compressText(text, maxLength = 20000) {
    if (!text) return { text: null, truncated: false };
    if (text.length <= maxLength) return { text, truncated: false };
    return {
      text: text.substring(0, maxLength) + '\n\n[... truncated for storage ...]',
      truncated: true
    };
  }

  /**
   * Compress image to smaller size
   * @param {string} dataUrl - Original image dataUrl
   * @param {number} maxWidth - Max width (default 800px)
   * @param {number} quality - JPEG quality 0-1 (default 0.6)
   * @returns {Promise<string>} - Compressed dataUrl
   */
  async compressImage(dataUrl, maxWidth = 800, quality = 0.6) {
    if (!dataUrl) return null;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG for smaller size
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl); // Fallback to original
      img.src = dataUrl;
    });
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

    // Smart curation settings
    const autoCurateEl = document.getElementById('auto-curate-toggle');
    const staleThresholdEl = document.getElementById('stale-threshold');
    const autoCurate = autoCurateEl ? autoCurateEl.checked : true;
    const staleThresholdWeeks = staleThresholdEl ? parseInt(staleThresholdEl.value) || 4 : 4;
    
    // Update storage and local settings
    this.data = storage.getData();
    this.settings = storage.updateSettings({ 
      apiKey, 
      openaiApiKey, 
      email: emailSettings,
      autoCurate,
      staleThresholdWeeks
    });
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

    // Smart curation settings
    const autoCurateEl = document.getElementById('auto-curate-toggle');
    const staleThresholdEl = document.getElementById('stale-threshold');
    if (autoCurateEl) {
      autoCurateEl.checked = this.settings.autoCurate !== false;
    }
    if (staleThresholdEl) {
      staleThresholdEl.value = this.settings.staleThresholdWeeks || 4;
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
