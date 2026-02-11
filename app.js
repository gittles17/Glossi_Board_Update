/**
 * Glossi Board Dashboard - Main Application
 * Ties together all modules and handles UI interactions
 */

import { storage } from './modules/storage.js';
import { aiProcessor } from './modules/ai-processor.js';
import { meetingsManager } from './modules/meetings.js';
import { notebook } from './modules/notebook.js';

// OpenAI API key for Whisper transcription (set in settings)
let OPENAI_API_KEY = null;

// Module-level variable for drag and drop (guaranteed accessible)
let _draggedTodoId = null;

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
    
    // Pipeline state
    this.selectedPipelineWeek = null;
    
    // Thought promotion state
    this.promotingThought = null;
    
    // Grouped items review state
    this.pendingGroupedItems = null;
    this.pendingGroupedSource = null;
    
    // Item review flow state
    this.pendingItems = [];
    this.currentItemIndex = 0;
    this.savedItems = { thoughts: [], talking_points: [] };
    
    // Name aliases for display
    this.nameAliases = {
      'rs': 'Ricky',
      'jg': 'Jonathan',
      'adam': 'Adam',
      'ricky': 'Ricky',
      'jonathan': 'Jonathan',
      'will': 'Will',
      'david': 'David'
    };
    
    // Available team members for quick assignment (loaded in init from server/localStorage)
    this.teamMembers = ['Ricky', 'Jonathan', 'Adam', 'Will', 'David', 'Unassigned'];
  }
  
  /**
   * Save team members to storage and sync
   */
  saveTeamMembers() {
    localStorage.setItem('glossi_team_members', JSON.stringify(this.teamMembers));
    if (storage) {
      storage.setTeamMembers(this.teamMembers);
    }
  }
  
  /**
   * Add a new team member
   */
  async addTeamMember(name) {
    const trimmed = name.trim();
    if (!trimmed || this.teamMembers.includes(trimmed)) return false;
    
    // Add before "Unassigned" if it exists, otherwise at end
    const unassignedIndex = this.teamMembers.indexOf('Unassigned');
    if (unassignedIndex !== -1) {
      this.teamMembers.splice(unassignedIndex, 0, trimmed);
    } else {
      this.teamMembers.push(trimmed);
    }
    this.saveTeamMembers();
    return true;
  }

  /**
   * Show a custom confirmation dialog (replaces browser confirm())
   * @returns {Promise<boolean>}
   */
  showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const messageEl = document.getElementById('confirm-modal-message');
      const cancelBtn = document.getElementById('confirm-modal-cancel');
      const okBtn = document.getElementById('confirm-modal-ok');
      
      if (!modal) {
        resolve(confirm(message));
        return;
      }
      
      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.classList.add('visible');
      
      const cleanup = () => {
        modal.classList.remove('visible');
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
        modal.removeEventListener('click', onOverlayClick);
      };
      
      const onCancel = () => { cleanup(); resolve(false); };
      const onOk = () => { cleanup(); resolve(true); };
      const onOverlayClick = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };
      
      cancelBtn.addEventListener('click', onCancel);
      okBtn.addEventListener('click', onOk);
      modal.addEventListener('click', onOverlayClick);
    });
  }

  /**
   * Show a custom prompt dialog (replaces browser prompt())
   * @returns {Promise<string|null>}
   */
  showPrompt(title = 'Enter Value', defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('prompt-modal');
      const titleEl = document.getElementById('prompt-modal-title');
      const input = document.getElementById('prompt-modal-input');
      const cancelBtn = document.getElementById('prompt-modal-cancel');
      const okBtn = document.getElementById('prompt-modal-ok');
      
      if (!modal) {
        resolve(prompt(title, defaultValue));
        return;
      }
      
      titleEl.textContent = title;
      input.value = defaultValue;
      modal.classList.add('visible');
      setTimeout(() => { input.focus(); input.select(); }, 50);
      
      const cleanup = () => {
        modal.classList.remove('visible');
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
        input.removeEventListener('keydown', onKeydown);
        modal.removeEventListener('click', onOverlayClick);
      };
      
      const onCancel = () => { cleanup(); resolve(null); };
      const onOk = () => { cleanup(); resolve(input.value); };
      const onKeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onOk(); }
        else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      };
      const onOverlayClick = (e) => { if (e.target === modal) { cleanup(); resolve(null); } };
      
      cancelBtn.addEventListener('click', onCancel);
      okBtn.addEventListener('click', onOk);
      input.addEventListener('keydown', onKeydown);
      modal.addEventListener('click', onOverlayClick);
    });
  }

  /**
   * Show a custom alert dialog (replaces browser alert())
   * @returns {Promise<void>}
   */
  showAlert(message, title = 'Notice') {
    return new Promise((resolve) => {
      const modal = document.getElementById('alert-modal');
      const titleEl = document.getElementById('alert-modal-title');
      const messageEl = document.getElementById('alert-modal-message');
      const okBtn = document.getElementById('alert-modal-ok');
      
      if (!modal) {
        alert(message);
        resolve();
        return;
      }
      
      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.classList.add('visible');
      
      const cleanup = () => {
        modal.classList.remove('visible');
        okBtn.removeEventListener('click', onOk);
        modal.removeEventListener('click', onOverlayClick);
      };
      
      const onOk = () => { cleanup(); resolve(); };
      const onOverlayClick = (e) => { if (e.target === modal) { cleanup(); resolve(); } };
      
      okBtn.addEventListener('click', onOk);
      modal.addEventListener('click', onOverlayClick);
    });
  }

  /**
   * Resolve name alias to full name
   */
  resolveOwnerName(name) {
    if (!name) return 'Unassigned';
    const lower = name.toLowerCase().trim();
    // Return alias if found, otherwise title-case the name for consistency
    if (this.nameAliases[lower]) {
      return this.nameAliases[lower];
    }
    // Title-case unknown names (e.g., "WILL" -> "Will", "john" -> "John")
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    // Initialize storage and load data
    const { data, settings, meetings } = await storage.init();
    this.data = data;
    this.settings = settings;
    
    // Load team members from server data or localStorage
    const serverTeamMembers = storage.getTeamMembers?.();
    if (serverTeamMembers && serverTeamMembers.length > 0) {
      this.teamMembers = serverTeamMembers;
    } else {
      try {
        const saved = localStorage.getItem('glossi_team_members');
        if (saved) this.teamMembers = JSON.parse(saved);
      } catch (e) { /* use defaults */ }
    }

    // Initialize AI processor with API key
    if (settings.apiKey) {
      aiProcessor.setApiKey(settings.apiKey);
    }

    // Initialize meetings manager
    meetingsManager.init(storage, (meeting) => this.renderMeeting(meeting));

    // Initialize Notebook
    notebook.init(storage, aiProcessor, () => this.render());

    // Load saved Google Sheet pipeline data from storage
    const savedPipeline = storage.getGoogleSheetPipeline();
    if (savedPipeline && savedPipeline.deals) {
      this.pipelineDeals = savedPipeline.deals;
      if (savedPipeline.syncedAt) {
        this.pipelineLastSync = new Date(savedPipeline.syncedAt);
      }
    }

    // Setup UI event listeners
    this.setupEventListeners();

    // Setup global todo drag-drop (once, uses document-level delegation)
    this.setupGlobalTodoDragDrop();

    // Setup intersection observer for animations
    this.setupAnimationObserver();

    // Render initial state
    this.render();

    // Setup pipeline auto-refresh from Google Sheets
    this.setupPipelineAutoRefresh();

    // Render independent action items
    this.renderActionItems();

    // Trigger entrance animations
    requestAnimationFrame(() => {
      this.animateStatsOnLoad();
    });

    // Check for URL actions (e.g., redirected from notebook page)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'share') {
      // Clean URL and open share modal
      window.history.replaceState({}, '', window.location.pathname);
      this.openShareEmailModal();
    }

  }

  /**
   * Render independent action items in the meeting panel
   */
  renderActionItems() {
    const container = document.getElementById('todo-list');
    const progressEl = document.getElementById('todo-progress');
    const progressBar = document.getElementById('action-progress-fill');
    const allTodos = storage.getAllTodos();
    
    // Filter out any completed todos and delete them from storage
    const completedTodos = allTodos.filter(t => t.completed);
    completedTodos.forEach(t => storage.deleteTodo(t.id));
    
    // Get only active todos
    const activeTodos = allTodos.filter(t => !t.completed);
    
    // Update progress count
    const count = activeTodos.length;
    progressEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    progressBar.style.width = count > 0 ? '100%' : '0%';
    
    if (activeTodos.length === 0) {
      container.innerHTML = '<div class="empty-state">No action items yet.</div>';
      return;
    }
    
    // Group by owner
    const groupByOwner = (todos) => {
      const grouped = {};
      todos.forEach(todo => {
        const owner = this.resolveOwnerName(todo.owner);
        if (!grouped[owner]) grouped[owner] = [];
        grouped[owner].push(todo);
      });
      return grouped;
    };
    
    // Render todo item HTML - no owner tag, just text
    const renderTodoItem = (todo) => `
      <div class="todo-item" data-todo-id="${todo.id}" draggable="true">
        <div class="todo-drag-handle" title="Drag to move">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1.5"></circle>
            <circle cx="15" cy="5" r="1.5"></circle>
            <circle cx="9" cy="12" r="1.5"></circle>
            <circle cx="15" cy="12" r="1.5"></circle>
            <circle cx="9" cy="19" r="1.5"></circle>
            <circle cx="15" cy="19" r="1.5"></circle>
          </svg>
        </div>
        <div class="todo-checkbox" onclick="window.dashboard.toggleTodo('${todo.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="todo-content">
          <span class="todo-text editable-item" contenteditable="true" data-type="todo-text" data-todo-id="${todo.id}" draggable="false">${todo.text}</span>
        </div>
        <button class="delete-btn" onclick="window.dashboard.deleteTodo('${todo.id}')" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    
    let html = '';
    
    // Render active todos grouped by owner
    if (activeTodos.length > 0) {
      const activeByOwner = groupByOwner(activeTodos);
      Object.entries(activeByOwner).forEach(([owner, todos]) => {
        html += `
          <div class="todo-group" data-owner="${owner}">
            <div class="todo-group-header">${owner}</div>
            <div class="todo-group-items">
              ${todos.map(renderTodoItem).join('')}
            </div>
          </div>
        `;
      });
    } else {
      html += '<div class="empty-state">All caught up!</div>';
    }
    
    container.innerHTML = html;
    this.setupTodoEditListeners(container);
    this.setupTodoDragDrop();
  }

  /**
   * Setup editable listeners for todo items
   */
  setupTodoEditListeners(container) {
    // Text editing (contenteditable)
    container.querySelectorAll('.editable-item').forEach(item => {
      let inputDebounce = null;

      // Auto-save on typing (debounced) so edits persist even without blur
      item.addEventListener('input', (e) => {
        if (_draggedTodoId) return;
        clearTimeout(inputDebounce);
        inputDebounce = setTimeout(() => {
          const todoId = e.target.dataset.todoId;
          const type = e.target.dataset.type;
          const newValue = e.target.textContent.trim();
          if (type === 'todo-text' && newValue) {
            storage.updateTodo(todoId, { text: newValue });
          }
        }, 800);
      });

      item.addEventListener('blur', (e) => {
        // Don't save during drag operations
        if (_draggedTodoId) return;
        
        // Clear any pending debounce and save immediately
        clearTimeout(inputDebounce);
        const todoId = e.target.dataset.todoId;
        const type = e.target.dataset.type;
        const newValue = e.target.textContent.trim();
        
        if (type === 'todo-text' && newValue) {
          storage.updateTodo(todoId, { text: newValue });
        }
      });
      
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
      
      // Strip formatting on paste - only allow plain text
      item.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
      });
    });
  }

  /**
   * Complete and delete a todo (checking off deletes it permanently)
   */
  toggleTodo(todoId) {
    this.savePendingTodoEdits();
    storage.deleteTodo(todoId);
    this.renderActionItems();
  }

  /**
   * Delete a todo
   */
  deleteTodo(todoId) {
    this.savePendingTodoEdits();
    storage.deleteTodo(todoId);
    this.renderActionItems();
  }

  /**
   * Save all pending todo text edits before re-rendering
   */
  savePendingTodoEdits() {
    const todoList = document.getElementById('todo-list');
    if (!todoList) return;
    
    todoList.querySelectorAll('.todo-text').forEach(textEl => {
      const todoId = textEl.dataset.todoId;
      const currentText = textEl.textContent.trim();
      if (todoId && currentText) {
        storage.updateTodo(todoId, { text: currentText });
      }
    });
  }
  
  /**
   * Add a new todo
   */
  addNewTodo() {
    // Save any pending edits first
    this.savePendingTodoEdits();
    
    const newTodo = storage.addTodo({
      text: 'New action item',
      owner: 'Unassigned'
    });
    
    this.renderActionItems();
    
    // Focus the new todo for editing
    setTimeout(() => {
      const newEl = document.querySelector(`[data-todo-id="${newTodo.id}"] .todo-text`);
      if (newEl) {
        newEl.focus();
        const range = document.createRange();
        range.selectNodeContents(newEl);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    }, 50);
  }
  
  /**
   * Show menu for adding todo or owner
   */
  showTodoAddMenu(button) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.todo-add-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }
    
    const menu = document.createElement('div');
    menu.className = 'todo-add-menu dropdown-menu active';
    menu.innerHTML = `
      <button class="dropdown-item" data-action="add-todo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
        Item
      </button>
      <button class="dropdown-item" data-action="add-owner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        List
      </button>
    `;
    
    // Position menu below button
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    
    document.body.appendChild(menu);
    
    // Handle clicks
    menu.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      menu.remove();
      
      if (action === 'add-todo') {
        this.addNewTodo();
      } else if (action === 'add-owner') {
        // Save pending edits before showing prompt
        this.savePendingTodoEdits();
        
        const newOwner = await this.showPrompt('New Owner Name', '');
        if (newOwner && newOwner.trim()) {
          const ownerName = newOwner.trim();
          await this.addTeamMember(ownerName);
          // Create a new todo for this owner so their section appears
          const newTodo = storage.addTodo({
            text: 'New action item',
            owner: ownerName
          });
          this.renderActionItems();
          // Focus the new todo for editing
          setTimeout(() => {
            const newEl = document.querySelector(`[data-todo-id="${newTodo.id}"] .todo-text`);
            if (newEl) {
              newEl.focus();
              const range = document.createRange();
              range.selectNodeContents(newEl);
              window.getSelection().removeAllRanges();
              window.getSelection().addRange(range);
            }
          }, 50);
        }
      }
    });
    
    // Close on click outside
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== button) {
          menu.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 0);
  }

  /**
   * Setup global drag and drop listeners (called once in constructor)
   */
  setupGlobalTodoDragDrop() {
    const self = this;
    
    // Create reusable placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'todo-drop-placeholder';
    placeholder.textContent = 'Drop here to reassign';
    
    // DRAGSTART - Document level delegation
    document.addEventListener('dragstart', function(e) {
      const todoItem = e.target.closest('.todo-item');
      if (!todoItem) return;
      
      // Don't drag from contenteditable
      if (e.target.closest('[contenteditable="true"]')) {
        e.preventDefault();
        return;
      }
      
      // Save any pending text edits BEFORE starting drag
      const todoId = todoItem.dataset.todoId;
      const textEl = todoItem.querySelector('.todo-text');
      if (textEl) {
        const currentText = textEl.textContent.trim();
        if (currentText) {
          storage.updateTodo(todoId, { text: currentText });
        }
      }
      
      _draggedTodoId = todoId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _draggedTodoId);
      
      requestAnimationFrame(() => todoItem.classList.add('dragging'));
    });
    
    // DRAGEND - Cleanup
    document.addEventListener('dragend', function(e) {
      const todoItem = e.target.closest('.todo-item');
      if (todoItem) {
        todoItem.classList.remove('dragging');
      }
      _draggedTodoId = null;
      
      // Remove placeholder
      if (placeholder.parentNode) {
        placeholder.remove();
      }
      
      // Clear all drag-over states
      document.querySelectorAll('.todo-group-items.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });
    
    // DRAGOVER - Show feedback
    document.addEventListener('dragover', function(e) {
      if (!_draggedTodoId) return;
      
      const dropZone = e.target.closest('.todo-group-items');
      if (!dropZone) return;
      
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Highlight drop zone
      document.querySelectorAll('.todo-group-items.drag-over').forEach(el => {
        if (el !== dropZone) el.classList.remove('drag-over');
      });
      dropZone.classList.add('drag-over');
      
      // Add placeholder
      if (!dropZone.contains(placeholder)) {
        if (placeholder.parentNode) placeholder.remove();
        dropZone.appendChild(placeholder);
      }
    });
    
    // DRAGLEAVE - Remove feedback when leaving
    document.addEventListener('dragleave', function(e) {
      const dropZone = e.target.closest('.todo-group-items');
      if (!dropZone) return;
      
      // Check if we're really leaving the dropzone
      const relatedTarget = e.relatedTarget;
      if (relatedTarget && dropZone.contains(relatedTarget)) return;
      
      dropZone.classList.remove('drag-over');
      if (dropZone.contains(placeholder)) {
        placeholder.remove();
      }
    });
    
    // DROP - Handle the actual move
    document.addEventListener('drop', function(e) {
      const dropZone = e.target.closest('.todo-group-items');
      if (!dropZone || !_draggedTodoId) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Cleanup UI
      dropZone.classList.remove('drag-over');
      if (placeholder.parentNode) placeholder.remove();
      
      // Get new owner from target group
      const targetGroup = dropZone.closest('.todo-group');
      const newOwner = targetGroup ? targetGroup.dataset.owner : null;
      
      if (_draggedTodoId && newOwner) {
        // Update the todo
        storage.updateTodo(_draggedTodoId, { owner: newOwner });
        _draggedTodoId = null;
        self.renderActionItems();
      }
    });
  }
  
  /**
   * Setup drag and drop (no-op, global listeners handle it)
   */
  setupTodoDragDrop() {
    // Global listeners already set up in constructor
  }

  /**
   * Show todo review modal for imported action items
   */
  showTodoReviewModal(todos) {
    if (!todos || todos.length === 0) return;
    
    this.pendingTodos = todos.map((t, i) => ({
      id: `pending-${i}`,
      text: t.text,
      owner: t.owner || 'Unassigned',
      selected: true
    }));
    
    const container = document.getElementById('todo-review-list');
    container.innerHTML = this.pendingTodos.map(todo => `
      <div class="todo-review-item" data-id="${todo.id}">
        <input type="checkbox" class="todo-review-checkbox" ${todo.selected ? 'checked' : ''} data-id="${todo.id}">
        <div class="todo-review-content">
          <input type="text" class="todo-review-text" value="${todo.text}" data-id="${todo.id}">
          <input type="text" class="todo-review-owner" value="${todo.owner}" data-id="${todo.id}" placeholder="Assignee">
        </div>
      </div>
    `).join('');
    
    this.showModal('todo-review-modal');
  }

  /**
   * Add selected todos from review modal
   */
  addSelectedTodos() {
    const items = document.querySelectorAll('.todo-review-item');
    let addedCount = 0;
    
    items.forEach(item => {
      const checkbox = item.querySelector('.todo-review-checkbox');
      const textInput = item.querySelector('.todo-review-text');
      const ownerInput = item.querySelector('.todo-review-owner');
      
      if (checkbox.checked && textInput.value.trim()) {
        storage.addTodo({
          text: textInput.value.trim(),
          owner: this.resolveOwnerName(ownerInput.value.trim() || 'Unassigned')
        });
        addedCount++;
      }
    });
    
    this.hideModal('todo-review-modal');
    this.pendingTodos = [];
    this.renderActionItems();
    
    if (addedCount > 0) {
      this.showToast(`Added ${addedCount} action item${addedCount > 1 ? 's' : ''}`, 'success');
    }
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

    // Menu items
    document.getElementById('menu-share').addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.openShareEmailModal();
    });
    
    // Share email modal
    document.getElementById('share-email-close')?.addEventListener('click', () => {
      this.hideModal('share-email-modal');
    });
    
    document.getElementById('share-email-cancel')?.addEventListener('click', () => {
      this.hideModal('share-email-modal');
    });
    
    document.getElementById('share-email-generate')?.addEventListener('click', () => {
      this.generateAndSendEmail();
    });
    
    // Parent checkbox toggles all report children
    document.getElementById('share-reports')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.getElementById('share-reports-list')?.querySelectorAll('.share-report-item').forEach(cb => {
        cb.checked = checked;
      });
    });
    
    // Delegated handler for individual report checkboxes
    document.getElementById('share-reports-list')?.addEventListener('change', (e) => {
      if (e.target.classList.contains('share-report-item')) {
        this.syncReportParentCheckbox();
      }
    });
    
    // Parent checkbox toggles all links children
    document.getElementById('share-links')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.getElementById('share-links-list')?.querySelectorAll('.share-link-item').forEach(cb => {
        cb.checked = checked;
      });
    });
    
    // Delegated handler for individual link checkboxes
    document.getElementById('share-links-list')?.addEventListener('change', (e) => {
      if (e.target.classList.contains('share-link-item')) {
        this.syncLinksParentCheckbox();
      }
    });
    
    // Email preview modal
    document.getElementById('email-preview-close')?.addEventListener('click', () => {
      this.hideModal('email-preview-modal');
    });
    
    document.getElementById('email-preview-cancel')?.addEventListener('click', () => {
      this.hideModal('email-preview-modal');
    });
    
    document.getElementById('email-preview-copy')?.addEventListener('click', () => {
      this.copyEmailToClipboard();
    });

    document.getElementById('menu-settings').addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.renderSettingsStatus();
      this.showModal('settings-modal');
    });

    // Desktop nav button handlers
    document.getElementById('desktop-share-btn')?.addEventListener('click', () => {
      this.openShareEmailModal();
    });
    
    document.getElementById('desktop-settings-btn')?.addEventListener('click', () => {
      this.renderSettingsStatus();
      this.showModal('settings-modal');
    });

  }

  /**
   * Process a dropped or selected file
   */
  async processDroppedFile(file) {
    const fileType = this.getFileType(file);
    
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
        
        if (fileSizeMB > 25) {
          this.showToast(`Audio file too large (${fileSizeMB.toFixed(1)}MB). Max is 25MB. Try a shorter clip or compress the file.`, 'error');
          return;
        }
        
        // Show progress overlay
        this.showProgress('Processing Audio');
        
        content = await this.processAudioFile(file);
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

    // Settings modal
    document.getElementById('settings-modal-close').addEventListener('click', () => {
      this.hideModal('settings-modal');
    });

    // Todo review modal
    document.getElementById('todo-review-close')?.addEventListener('click', () => {
      this.hideModal('todo-review-modal');
      this.pendingTodos = [];
    });
    document.getElementById('todo-review-skip')?.addEventListener('click', () => {
      this.hideModal('todo-review-modal');
      this.pendingTodos = [];
    });
    document.getElementById('todo-review-add')?.addEventListener('click', () => {
      this.addSelectedTodos();
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

    document.getElementById('add-todo-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showTodoAddMenu(e.currentTarget);
    });

    document.getElementById('add-decision-btn').addEventListener('click', () => {
      const meeting = meetingsManager.getCurrentMeeting();
      if (meeting) {
        this.showModal('decision-modal');
        document.getElementById('decision-text').value = '';
        document.getElementById('decision-text').focus();
      }
    });
    
    document.getElementById('add-section-btn')?.addEventListener('click', () => {
      this.addLinkSection();
    });

    // Link modal event listeners
    document.getElementById('link-modal-close')?.addEventListener('click', () => {
      this.hideModal('link-modal');
    });

    document.getElementById('link-cancel')?.addEventListener('click', () => {
      this.hideModal('link-modal');
    });

    document.getElementById('link-save')?.addEventListener('click', () => {
      this.saveLink();
    });

    document.getElementById('link-delete')?.addEventListener('click', () => {
      if (this.editingLinkId) {
        this.deleteLink(this.editingLinkId);
      }
    });

    // Color picker event listeners for link modal
    document.querySelectorAll('.color-picker .color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-picker .color-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
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

    // Pipeline refresh button
    document.getElementById('pipeline-refresh-btn')?.addEventListener('click', () => {
      this.fetchPipelineFromSheet();
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
    try { this.renderQuickLinks(); } catch (e) { console.error('renderQuickLinks error:', e); }
    
    try {
      const currentMeeting = meetingsManager.getCurrentMeeting();
      if (currentMeeting) {
        this.renderMeeting(currentMeeting);
      }
    } catch (e) { console.error('renderMeeting error:', e); }

    try { this.renderSettingsStatus(); } catch (e) { console.error('renderSettingsStatus error:', e); }
  }

  /**
   * Render stats (deprecated - stats section removed)
   */
  renderStats() {
    // Stats section was removed
  }

  /**
   * Render the pipeline section with two-tier layout
   */
  renderPipelineSection() {
    const pipelineData = this.pipelineDeals || [];
    const stagesRow = document.getElementById('pipeline-stages-row');
    const dealsSection = document.getElementById('pipeline-deals-section');
    const dealsHeader = document.getElementById('pipeline-deals-header');
    const dealsGrid = document.getElementById('pipeline-deals-grid');
    const closedEl = document.getElementById('pipeline-closed-value');
    const targetEl = document.getElementById('pipeline-target');
    const countEl = document.getElementById('pipeline-deal-count');
    const emptyEl = document.getElementById('pipeline-empty');
    
    // If no data, show empty state
    if (pipelineData.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (stagesRow) stagesRow.style.display = 'none';
      if (dealsSection) dealsSection.classList.remove('visible');
      if (closedEl) closedEl.textContent = '$0';
      if (targetEl) targetEl.textContent = '$0';
      if (countEl) countEl.textContent = '';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    if (stagesRow) stagesRow.style.display = 'flex';
    
    // Group deals by stage (with fuzzy matching)
    this.pipelineStageGroups = {};
    let grandTotal = 0;
    let closedTotal = 0;
    
    pipelineData.forEach(deal => {
      // Normalize stage name (case-insensitive, trim whitespace)
      const rawStage = (deal.stage || '').trim();
      if (!rawStage) return; // Skip deals with no stage
      
      const stage = this.normalizeStage(rawStage);
      
      if (!this.pipelineStageGroups[stage]) {
        this.pipelineStageGroups[stage] = { deals: [], total: 0 };
      }
      this.pipelineStageGroups[stage].deals.push(deal);
      const value = this.parseMoneyValue(deal.value);
      this.pipelineStageGroups[stage].total += value;
      grandTotal += value;
      
      // Track closed deals separately
      if (stage.toLowerCase() === 'closed') {
        closedTotal += value;
      }
    });
    
    // Count deals with valid stages
    const totalDeals = Object.values(this.pipelineStageGroups).reduce((sum, g) => sum + g.deals.length, 0);
    
    // Update header: closed deals / total pipeline value
    if (closedEl) closedEl.textContent = this.formatMoney(closedTotal);
    if (targetEl) targetEl.textContent = this.formatMoney(grandTotal);
    if (countEl) countEl.textContent = `(${totalDeals} deals)`;
    
    // Define stage order (matches typical sales funnel)
    const stageOrder = ['Connected', 'Discovery Call', 'Demo', 'Proposal', 'POC', 'Closed', 'Stalled', 'Lost'];
    this.sortedPipelineStages = Object.keys(this.pipelineStageGroups).sort((a, b) => {
      const aIdx = stageOrder.indexOf(a);
      const bIdx = stageOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    
    // Render stage pills
    if (stagesRow) {
      stagesRow.innerHTML = this.sortedPipelineStages.map(stage => {
        const data = this.pipelineStageGroups[stage];
        const isActive = this.selectedPipelineStage === stage;
        
        return `
          <div class="stage-pill ${isActive ? 'active' : ''}" data-stage="${this.escapeHtml(stage)}">
            <span class="stage-pill-name">${this.escapeHtml(stage)}</span>
            <span class="stage-pill-value">${this.formatMoney(data.total)}</span>
            <span class="stage-pill-count">${data.deals.length} deal${data.deals.length !== 1 ? 's' : ''}</span>
          </div>
        `;
      }).join('');
      
      // Add click handlers for stage pills
      stagesRow.querySelectorAll('.stage-pill').forEach(pill => {
        pill.onclick = () => {
          const stage = pill.dataset.stage;
          this.selectPipelineStage(stage);
        };
      });
    }
    
    // If a stage is selected, render its deals
    if (this.selectedPipelineStage && this.pipelineStageGroups[this.selectedPipelineStage]) {
      this.renderPipelineDeals(this.selectedPipelineStage);
    } else if (this.sortedPipelineStages.length > 0) {
      // Auto-select first stage with deals
      this.selectPipelineStage(this.sortedPipelineStages[0]);
    }
  }
  
  /**
   * Select a pipeline stage and show its deals
   */
  selectPipelineStage(stage) {
    this.selectedPipelineStage = stage;
    
    // Update active state on pills
    const stagesRow = document.getElementById('pipeline-stages-row');
    if (stagesRow) {
      stagesRow.querySelectorAll('.stage-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.stage === stage);
      });
    }
    
    // Render deals for this stage
    this.renderPipelineDeals(stage);
  }
  
  /**
   * Render deals for a specific stage
   */
  renderPipelineDeals(stage) {
    const dealsSection = document.getElementById('pipeline-deals-section');
    const dealsHeader = document.getElementById('pipeline-deals-header');
    const dealsGrid = document.getElementById('pipeline-deals-grid');
    
    if (!dealsSection || !dealsHeader || !dealsGrid) return;
    
    const stageData = this.pipelineStageGroups[stage];
    if (!stageData) return;
    
    // Show deals section
    dealsSection.classList.add('visible');
    
    // Update header
    dealsHeader.innerHTML = `
      <h3>${this.escapeHtml(stage)} <span style="font-weight: 400; color: var(--text-secondary);">(${stageData.deals.length})</span></h3>
      <span class="stage-total">${this.formatMoney(stageData.total)}</span>
    `;
    
    // Render deal cards
    dealsGrid.innerHTML = stageData.deals.map((deal, index) => this.renderDealCard(deal, index)).join('');
    
    // Add click handlers for deal cards
    dealsGrid.querySelectorAll('.deal-card-compact').forEach(card => {
      card.onclick = (e) => {
        // Don't toggle if clicking on a link
        if (e.target.tagName === 'A') return;
        card.classList.toggle('expanded');
      };
    });
  }
  
  /**
   * Render a compact deal card with expandable details
   */
  renderDealCard(deal, index) {
    const hasBlocker = deal.blockers && deal.blockers.toLowerCase() !== 'none' && deal.blockers.trim() !== '';
    const ownerInitial = deal.owner ? deal.owner.charAt(0).toUpperCase() : '?';
    
    // Format close date to be more compact
    let closeDisplay = deal.closeDate || 'TBD';
    if (closeDisplay.includes('/')) {
      const parts = closeDisplay.split('/');
      if (parts.length >= 2) {
        closeDisplay = `${parts[0]}/${parts[1]}`;
      }
    }
    
    return `
      <div class="deal-card-compact" data-index="${index}">
        <div class="deal-card-top">
          <span class="deal-card-name">${this.escapeHtml(deal.name)}</span>
          <span class="deal-card-value">${this.escapeHtml(deal.value || 'TBD')}</span>
        </div>
        <div class="deal-card-meta">
          <span>${this.escapeHtml(deal.owner || 'Unassigned')}</span>
          <span>${closeDisplay}</span>
        </div>
        ${hasBlocker ? `
          <div class="deal-card-blocker-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            ${this.escapeHtml(this.truncateText(deal.blockers, 30))}
          </div>
        ` : ''}
        <div class="deal-card-details">
          ${deal.owner ? `
            <div class="deal-card-detail-row">
              <span class="deal-card-detail-label">Owner</span>
              <span class="deal-card-detail-value">${this.escapeHtml(deal.owner)}</span>
            </div>
          ` : ''}
          ${deal.closeDate ? `
            <div class="deal-card-detail-row">
              <span class="deal-card-detail-label">Close</span>
              <span class="deal-card-detail-value">${this.escapeHtml(deal.closeDate)}</span>
            </div>
          ` : ''}
          ${deal.nextTask ? `
            <div class="deal-card-detail-row">
              <span class="deal-card-detail-label">Next</span>
              <span class="deal-card-detail-value">${this.escapeHtml(deal.nextTask)}</span>
            </div>
          ` : ''}
          ${hasBlocker ? `
            <div class="deal-card-detail-row">
              <span class="deal-card-detail-label">Blocker</span>
              <span class="deal-card-detail-value blocker">${this.escapeHtml(deal.blockers)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * Truncate text to a max length
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  /**
   * Normalize stage name for fuzzy matching (case-insensitive)
   */
  normalizeStage(stage) {
    if (!stage) return '';
    
    const lower = stage.toLowerCase().trim();
    
    // Map common variations to canonical names
    const stageMap = {
      'connected': 'Connected',
      'discovery call': 'Discovery Call',
      'discovery': 'Discovery Call',
      'demo': 'Demo',
      'proposal': 'Proposal',
      'poc': 'POC',
      'proof of concept': 'POC',
      'closed': 'Closed',
      'closed won': 'Closed',
      'won': 'Closed',
      'stalled': 'Stalled',
      'on hold': 'Stalled',
      'lost': 'Lost',
      'closed lost': 'Lost'
    };
    
    // Check for exact match first
    if (stageMap[lower]) {
      return stageMap[lower];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(stageMap)) {
      if (lower.includes(key) || key.includes(lower)) {
        return value;
      }
    }
    
    // Title case the original if no match found
    return stage.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  /**
   * Fetch pipeline data from Google Sheet
   */
  async fetchPipelineFromSheet() {
    const settings = storage.getSettings();
    // Use saved URL or default
    const sheetUrl = settings.pipelineSheetUrl || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO6VSxW3EngXb-xa15zVxPA45zt34rjNcpAIpYqfx3iiywuPkE0jseDN0al-UsH6Xqkxt5eI6Y0L4w/pub?output=csv&gid=0';
    
    if (!sheetUrl) {
      return null;
    }
    
    // Show loading state
    const refreshBtn = document.getElementById('pipeline-refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('refreshing');
    
    try {
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error('Failed to fetch sheet');
      
      const csv = await response.text();
      const deals = this.parseCSVPipeline(csv);
      
      // Store the data in memory
      this.pipelineDeals = deals;
      this.pipelineLastSync = new Date();
      
      // Save to persistent storage for notebook access
      storage.saveGoogleSheetPipeline(deals, this.pipelineLastSync.toISOString());
      
      // Update sync time display
      this.updatePipelineSyncTime();
      
      // Render
      this.renderPipelineSection();
      
      return deals;
    } catch (error) {
      this.showToast('Failed to sync pipeline: ' + error.message, 'error');
      return null;
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('refreshing');
    }
  }
  
  /**
   * Parse CSV from Google Sheet into deal objects
   * Handles multi-line quoted fields correctly
   */
  parseCSVPipeline(csv) {
    // Parse all rows handling multi-line quoted fields
    const rows = this.parseCSVRows(csv);
    if (rows.length < 2) return [];
    
    // Parse header
    const headers = rows[0];
    
    // Map expected columns (flexible matching)
    const colMap = {};
    headers.forEach((h, i) => {
      const lower = (h || '').toLowerCase().trim();
      if (lower.includes('opportunity') || lower.includes('name') || lower.includes('company')) colMap.name = i;
      if (lower.includes('close') && lower.includes('date')) colMap.closeDate = i;
      if (lower.includes('owner')) colMap.owner = i;
      if (lower.includes('value') || lower.includes('amount')) colMap.value = i;
      if (lower.includes('stage')) colMap.stage = i;
      if (lower.includes('next') || lower.includes('task')) colMap.nextTask = i;
      if (lower.includes('blocker')) colMap.blockers = i;
    });
    
    // Parse data rows
    const deals = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (!cols || cols.length === 0) continue;
      
      const deal = {
        name: cols[colMap.name] || '',
        closeDate: cols[colMap.closeDate] || '',
        owner: cols[colMap.owner] || '',
        value: cols[colMap.value] || '',
        stage: cols[colMap.stage] || '',
        nextTask: cols[colMap.nextTask] || '',
        blockers: cols[colMap.blockers] || ''
      };
      
      // Skip empty rows
      if (deal.name) {
        deals.push(deal);
      }
    }
    
    return deals;
  }
  
  /**
   * Parse CSV into rows, properly handling multi-line quoted fields
   */
  parseCSVRows(csv) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const nextChar = csv[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
        // End of row (not inside quotes)
        if (char === '\r') i++; // Skip \n in \r\n
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) { // Only add non-empty rows
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\r' && !inQuotes) {
        // Handle standalone \r as line ending
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        // Regular character (including newlines inside quotes)
        currentField += char;
      }
    }
    
    // Don't forget the last field and row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f)) {
        rows.push(currentRow);
      }
    }
    
    return rows;
  }
  
  /**
   * Update pipeline sync time display
   */
  updatePipelineSyncTime() {
    const el = document.getElementById('pipeline-sync-time');
    if (!el || !this.pipelineLastSync) return;
    
    const now = new Date();
    const diff = Math.floor((now - this.pipelineLastSync) / 1000 / 60);
    
    if (diff < 1) {
      el.textContent = 'Just synced';
    } else if (diff === 1) {
      el.textContent = '1 min ago';
    } else if (diff < 60) {
      el.textContent = `${diff} min ago`;
    } else {
      el.textContent = this.pipelineLastSync.toLocaleTimeString();
    }
  }
  
  /**
   * Setup pipeline auto-refresh (every 5 minutes)
   */
  setupPipelineAutoRefresh() {
    // Initial fetch
    this.fetchPipelineFromSheet();
    
    // Auto-refresh every 5 minutes
    setInterval(() => {
      this.fetchPipelineFromSheet();
    }, 5 * 60 * 1000);
    
    // Update sync time display every minute
    setInterval(() => {
      this.updatePipelineSyncTime();
    }, 60 * 1000);
  }

  /**
   * Populate pipeline week selector dropdown
   */
  populatePipelineWeekSelector(currentData, history) {
    const select = document.getElementById('pipeline-week-select');
    if (!select) return;
    
    // Build options
    let options = '';
    
    // Current week option
    if (currentData?.updatedAt) {
      const date = new Date(currentData.updatedAt);
      const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      options += `<option value="current">${formatted}</option>`;
    } else {
      options += '<option value="current">Current</option>';
    }
    
    // Historical weeks (dedupe by date string to avoid showing same date multiple times)
    const seenDates = new Set();
    if (currentData?.updatedAt) {
      seenDates.add(new Date(currentData.updatedAt).toDateString());
    }
    
    history.forEach((week, index) => {
      if (week?.updatedAt) {
        const date = new Date(week.updatedAt);
        const dateKey = date.toDateString();
        
        // Skip if we've already shown this date
        if (seenDates.has(dateKey)) return;
        seenDates.add(dateKey);
        
        const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        options += `<option value="${index}">${formatted}</option>`;
      }
    });
    
    select.innerHTML = options;
    
    // Restore selection
    if (this.selectedPipelineWeek !== null && this.selectedPipelineWeek !== undefined) {
      select.value = this.selectedPipelineWeek.toString();
    } else {
      select.value = 'current';
    }
  }

  /**
   * Render change indicator for pipeline cards
   */
  renderChangeIndicator(el, diff, hasPreviousData) {
    if (!hasPreviousData) {
      el.textContent = '';
      el.className = 'card-change';
      return;
    }
    
    if (diff > 0) {
      el.textContent = `+${this.formatMoney(diff)}`;
      el.className = 'card-change change-positive';
    } else if (diff < 0) {
      el.textContent = this.formatMoney(diff);
      el.className = 'card-change change-negative';
    } else {
      el.textContent = 'No change';
      el.className = 'card-change change-neutral';
    }
  }

  /**
   * Render a single deal badge
   */
  renderDealBadge(deal) {
    if (deal.status === 'new') return ' <span class="deal-badge badge-new">NEW</span>';
    if (deal.status === 'stage-changed') return ' <span class="deal-badge badge-moved">MOVED</span>';
    if (deal.status === 'stalled') return ' <span class="deal-badge badge-stalled">STALLED</span>';
    return '';
  }

  /**
   * Toggle pipeline card expand/collapse (deprecated)
   */
  togglePipelineCard(stage) {
    // No longer used with new layout
  }

  /**
   * Toggle highlights section (deprecated)
   */
  toggleHighlights() {
    // No longer used with new layout
  }

  /**
   * Render pipeline highlights (deprecated - now rendered inline)
   */
  renderPipelineHighlights(highlights, updatedAt) {
    // No longer used - highlights now rendered in main section
  }

  /**
   * Parse money value string to number
   * Handles ranges like "$36-$50K", commas like "US$50,000.00"
   */
  parseMoneyValue(value) {
    if (!value) return 0;
    
    // Handle ranges like "$36-$50K" - take the first number
    let numStr = value;
    if (value.includes('-') && /\d+-\d/.test(value)) {
      numStr = value.split('-')[0];
    }
    
    // Remove commas from numbers (e.g., "50,000" -> "50000")
    numStr = numStr.replace(/,/g, '');
    
    // Extract the number
    const numMatch = numStr.match(/[\d.]+/);
    if (!numMatch) return 0;
    
    let num = parseFloat(numMatch[0]) || 0;
    
    // Check for K/M multiplier in the original value
    if (/[Kk]/.test(value)) num *= 1000;
    else if (/[Mm]/.test(value)) num *= 1000000;
    
    return num;
  }

  /**
   * Format number as money string
   */
  formatMoney(value) {
    if (value >= 1000000) {
      return '$' + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return '$' + (value / 1000).toFixed(0) + 'K';
    }
    return '$' + value.toFixed(0);
  }

  /**
   * Open the pipeline edit modal
   */
  openPipelineEditModal() {
    const pipelineData = this.data?.pipelineEmail || storage.getPipelineEmail?.() || null;
    const textarea = document.getElementById('pipeline-email-content');
    
    if (textarea && pipelineData?.rawContent) {
      textarea.value = pipelineData.rawContent;
    } else if (textarea) {
      textarea.value = '';
    }
    
    this.showModal('pipeline-edit-modal');
    textarea?.focus();
  }

  /**
   * Save and parse the pipeline email content using AI
   */
  async savePipelineEmail() {
    const textarea = document.getElementById('pipeline-email-content');
    const content = textarea?.value?.trim() || '';
    
    if (!content) {
      this.showToast('Please paste pipeline email content', 'error');
      return;
    }
    
    // Show processing state
    const saveBtn = document.getElementById('pipeline-edit-save');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
      saveBtn.innerHTML = 'Processing...';
      saveBtn.disabled = true;
    }
    
    try {
      // Get previous data for comparison
      const previousData = storage.getPipelineEmail();
      const previousDeals = previousData?.deals || [];
      
      // Use AI to parse the email content and match against existing deals
      const parsedData = await this.parsePipelineWithAI(content, previousDeals);
      
      // Calculate changes
      const changes = this.calculatePipelineChanges(parsedData.deals, previousDeals);
      
      // Use email date if extracted, otherwise current date
      let emailDate = new Date().toISOString();
      if (parsedData.emailDate) {
        const parsed = new Date(parsedData.emailDate);
        if (!isNaN(parsed.getTime())) {
          emailDate = parsed.toISOString();
        }
      }
      
      const pipelineData = {
        rawContent: content,
        deals: parsedData.deals || [],
        highlights: parsedData.highlights || {},
        changes: changes,
        updatedAt: emailDate
      };
      
      // Save to storage with history
      storage.updatePipelineEmail(pipelineData, previousData);
      this.data.pipelineEmail = pipelineData;
      
      this.hideModal('pipeline-edit-modal');
      this.renderPipelineSection();
      
    } catch (error) {
      this.showToast('Failed to parse pipeline: ' + error.message, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }
    }
  }

  /**
   * Calculate changes between new and previous pipeline data
   */
  calculatePipelineChanges(newDeals, previousDeals) {
    const changes = { newDeals: 0, stageChanges: 0, valueChanges: 0, stalled: 0 };
    
    newDeals.forEach(deal => {
      if (deal.status === 'new') changes.newDeals++;
      if (deal.status === 'stage-changed') changes.stageChanges++;
      if (deal.status === 'value-changed') changes.valueChanges++;
    });
    
    // Count stalled deals (in previous but not in new)
    const newNames = new Set(newDeals.map(d => d.name.toLowerCase()));
    previousDeals.forEach(prev => {
      if (!newNames.has(prev.name.toLowerCase())) {
        changes.stalled++;
      }
    });
    
    return changes;
  }

  /**
   * Parse pipeline email content using Claude AI
   */
  async parsePipelineWithAI(content, previousDeals = []) {
    const previousContext = previousDeals.length > 0 
      ? `\n\nPREVIOUS DEALS (for matching and detecting changes):\n${previousDeals.map(d => `- ${d.name}: ${d.value}, Stage: ${d.stage}, Timing: ${d.timing}`).join('\n')}`
      : '';

    const systemPrompt = `You are a pipeline data parser for a sales/business development dashboard.

Parse the provided email content and extract:
1. The EMAIL DATE from the email (look for "Date:", forwarded message dates, or dates in subject line like "1/19/26")
2. Individual deals with their stage, value, timing, contact, and next steps
3. Categorized highlights (hot deals, key updates, marketing)

STAGES - Categorize each deal into one of these 4 stages:
- discovery: Discovery calls, intro meetings, qualifying leads
- demo: Demo scheduled or completed, showing product
- pilot: Pilot evaluation, technical validation, proof of concept
- closing: Final negotiations, contracts, verbal commitments

DEAL MATCHING - Compare against previous deals:${previousContext}
- If a deal name matches (fuzzy match OK, e.g. "Bob Mills" = "Bob Mills Furniture"), detect what changed
- Set status to: "new" (not in previous), "stage-changed", "value-changed", "timing-changed", "updated" (only next steps changed), or null (unchanged)

Return JSON:
{
  "emailDate": "2026-01-19",
  "deals": [
    {
      "name": "Company Name",
      "value": "$50K",
      "stage": "discovery|demo|pilot|closing",
      "timing": "Q1|Q2|Q3|TBD",
      "contact": "Contact Name",
      "nextSteps": "Brief next step",
      "status": "new|stage-changed|value-changed|timing-changed|updated|null"
    }
  ],
  "highlights": {
    "hotDeals": ["Deal with Q1 timing and active momentum", ...],
    "keyUpdates": ["Important next step this week", ...],
    "marketing": ["Marketing activity or plan", ...]
  }
}

RULES:
- IMPORTANT: Extract the email date from subject lines (e.g. "Weekly Pipeline Report 1/19/26") or "Date:" headers and return as ISO format (YYYY-MM-DD)
- Extract ALL deals from the email (they are usually numbered)
- Use exact values from email ($50K, not $50,000)
- For timing, normalize to Q1/Q2/Q3/TBD
- Hot deals = Q1 timing with recent activity
- Marketing section is usually at the end of the email
- Return ONLY valid JSON, no other text.`;

    const result = await aiProcessor.chat(systemPrompt, content);
    
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Add stalled deals from previous that aren't in new
        if (previousDeals.length > 0) {
          const newNames = new Set(parsed.deals.map(d => d.name.toLowerCase()));
          previousDeals.forEach(prev => {
            if (!newNames.has(prev.name.toLowerCase())) {
              parsed.deals.push({
                ...prev,
                status: 'stalled',
                lastSeen: prev.updatedAt || 'Previous update'
              });
            }
          });
        }
        
        return parsed;
      }
      throw new Error('Invalid response format');
    } catch (e) {
      return { 
        deals: [], 
        highlights: { 
          hotDeals: [], 
          keyUpdates: ['Failed to parse email content. Please try again.'], 
          marketing: [] 
        } 
      };
    }
  }

  /**
   * Render talking points (deprecated - section removed, using Notebook instead)
   */
  renderTalkingPoints() {
    // Talking points section was removed - using Notebook instead
    return;
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
    
  }

  /**
   * Render quick links dynamically (grouped by section)
   */
  renderQuickLinks() {
    const container = document.getElementById('quick-links-container');
    const linksListContainer = document.getElementById('links-list');
    const links = storage.getQuickLinks();
    const sections = storage.getLinkSections();
    const linksBySection = storage.getQuickLinksBySection();

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

    // Render to header quick links container (if exists)
    if (container) {
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
    
    // Render to links card on homepage (grouped by section) - matches Seed Raise funnel structure
    if (linksListContainer) {
      if (links.length === 0 && sections.length === 0) {
        linksListContainer.innerHTML = '<div class="empty-state">No links added yet. Click + to add a section.</div>';
        linksListContainer.classList.add('empty');
      } else {
        linksListContainer.classList.remove('empty');
        
        // Render each section (like funnel-column in Seed Raise)
        linksListContainer.innerHTML = sections.map(section => {
          const sectionLinks = linksBySection[section.id] || [];
          
          return `
            <div class="link-column" data-section-id="${section.id}">
              <div class="link-column-header">
                <div class="link-column-title-row">
                  <span class="link-column-title" data-section-id="${section.id}">${section.name}</span>
                  <span class="link-column-count">(${sectionLinks.length})</span>
                </div>
              </div>
              <div class="link-column-items" data-section-id="${section.id}">
                ${sectionLinks.length === 0 ? `
                  <div class="empty-state drop-hint">Drop here</div>
                ` : sectionLinks.map(link => `
                  <div class="link-card" data-link-id="${link.id}" data-section-id="${section.id}" draggable="true">
                    <div class="link-card-info">
                      <a href="${link.url}" target="_blank" class="link-card-name" onclick="event.stopPropagation()">${link.name}</a>
                      <span class="link-card-url">${link.url}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('');
        
        // Setup handlers (like Seed Raise)
        this.setupLinkCardHandlers(linksListContainer, links);
      }
    }
  }
  
  /**
   * Setup event handlers for links card (matches Seed Raise pattern)
   */
  setupLinkCardHandlers(container, links) {
    // Click to edit link (like investor cards)
    container.querySelectorAll('.link-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!card.classList.contains('dragging')) {
          this.editLink(card.dataset.linkId);
        }
      });
    });
    
    // Click section title to edit name
    container.querySelectorAll('.link-column-title').forEach(title => {
      title.addEventListener('click', () => {
        this.editLinkSection(title.dataset.sectionId);
      });
    });
    
    // Setup drag and drop
    this.setupLinkDragDrop(container);
  }
  
  /**
   * Setup drag and drop for links (matches Seed Raise setupInvestorDragDrop)
   */
  setupLinkDragDrop(container) {
    const cards = container.querySelectorAll('.link-card[draggable="true"]');
    const columns = container.querySelectorAll('.link-column-items');

    // Disable dragging on touch devices to allow scrolling
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      cards.forEach(card => {
        card.removeAttribute('draggable');
      });
      return;
    }

    // Link card drag handlers (exactly like investor cards)
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.linkId);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        columns.forEach(col => col.classList.remove('drag-over'));
      });
    });

    // Columns as drop zones (exactly like Seed Raise)
    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', (e) => {
        if (!column.contains(e.relatedTarget)) {
          column.classList.remove('drag-over');
        }
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        const linkId = e.dataTransfer.getData('text/plain');
        const newSectionId = column.dataset.sectionId;
        
        if (linkId && newSectionId) {
          this.moveLinkToSection(linkId, newSectionId);
        }
      });
    });
  }
  
  /**
   * Move link to a new section with optimistic UI update (like moveInvestorToStage)
   */
  moveLinkToSection(linkId, newSectionId) {
    const links = storage.getQuickLinks();
    const link = links.find(l => l.id === linkId);
    
    if (!link || link.section === newSectionId) return;

    // Optimistic: Move DOM element immediately (like Seed Raise)
    const card = document.querySelector(`.link-card[data-link-id="${linkId}"]`);
    const targetColumn = document.querySelector(`.link-column-items[data-section-id="${newSectionId}"]`);
    
    if (card && targetColumn) {
      // Animate the move
      card.style.opacity = '0.5';
      card.style.transform = 'scale(0.95)';
      
      requestAnimationFrame(() => {
        targetColumn.appendChild(card);
        card.dataset.sectionId = newSectionId;
        card.style.opacity = '';
        card.style.transform = '';
      });
    }

    // Persist in background
    const sectionLinks = links.filter(l => l.section === newSectionId);
    const newOrder = sectionLinks.length;
    storage.reorderLinks(linkId, newSectionId, newOrder);
    this.data = storage.getData();
    
    // Delayed re-render to update counts and sync state
    setTimeout(() => this.renderQuickLinks(), 150);
  }
  
  /**
   * Get element to insert link after based on mouse position
   */
  getDragAfterElementLink(container, y) {
    const draggableElements = [...container.querySelectorAll('.link-item:not(.dragging)')];
    
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
   * Delete a link directly (from links card)
   */
  deleteLinkDirect(linkId) {
    const linkEl = document.querySelector(`.link-item[data-link-id="${linkId}"]`);
    if (linkEl) {
      linkEl.style.opacity = '0';
      linkEl.style.transform = 'scale(0.95)';
      linkEl.style.transition = 'all 0.15s ease-out';
    }
    
    setTimeout(() => {
      storage.deleteQuickLink(linkId);
      this.data = storage.getData();
      this.renderQuickLinks();
      
      // Update KB sources panel if it exists
      if (notebook && typeof notebook.renderSources === 'function') {
        notebook.renderSources();
      }
    }, 150);
  }

  /**
   * Open add link modal
   */
  openAddLink(sectionId = null) {
    this.editingLinkId = null;
    this.selectedLinkSection = sectionId;
    document.getElementById('link-modal-title').textContent = 'Add Link';
    document.getElementById('link-name').value = '';
    document.getElementById('link-url').value = '';
    document.getElementById('link-email-label').value = '';
    document.getElementById('link-email-enabled').checked = true;
    document.getElementById('link-delete').style.display = 'none';
    
    // Reset color picker
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.color-option.default').classList.add('selected');
    
    // Populate section dropdown
    this.populateLinkSectionDropdown(sectionId);
    
    this.showModal('link-modal');
  }
  
  /**
   * Populate link section dropdown
   */
  populateLinkSectionDropdown(selectedId = null) {
    const dropdown = document.getElementById('link-section');
    if (!dropdown) return;
    
    const sections = storage.getLinkSections();
    dropdown.innerHTML = sections.map(section => 
      `<option value="${section.id}" ${section.id === selectedId ? 'selected' : ''}>${section.name}</option>`
    ).join('');
  }
  
  /**
   * Add a new link section
   */
  async addLinkSection() {
    const name = await this.showPrompt('Enter section name');
    if (!name || !name.trim()) return;
    
    storage.addLinkSection(name.trim());
    this.data = storage.getData();
    this.renderQuickLinks();
  }
  
  /**
   * Edit a link section
   */
  editLinkSection(sectionId) {
    const sections = storage.getLinkSections();
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Find the section name element and make it editable
    const nameEl = document.querySelector(`.link-column-title[data-section-id="${sectionId}"]`);
    if (!nameEl) return;
    
    // Store original name
    const originalName = section.name;
    
    // Make editable
    nameEl.contentEditable = 'true';
    nameEl.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    // Add editing styles
    nameEl.classList.add('editing');
    
    // Handle blur (save)
    const handleBlur = () => {
      const newName = nameEl.textContent.trim();
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('editing');
      
      if (!newName) {
        // Restore original name if empty
        nameEl.textContent = originalName;
        return;
      }
      
      if (newName !== originalName) {
        storage.updateLinkSection(sectionId, { name: newName });
        this.data = storage.getData();
      }
    };
    
    // Handle keydown
    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      } else if (e.key === 'Escape') {
        nameEl.textContent = originalName;
        nameEl.blur();
      }
    };
    
    nameEl.addEventListener('blur', handleBlur, { once: true });
    nameEl.addEventListener('keydown', handleKeydown);
  }
  
  /**
   * Delete a link section
   */
  async deleteLinkSection(sectionId) {
    const sections = storage.getLinkSections();
    if (sections.length <= 1) {
      await this.showAlert('Cannot delete the last section.');
      return;
    }
    
    const confirmed = await this.showConfirm('Delete this section? Links will be moved to another section.', 'Delete Section');
    if (confirmed) {
      storage.deleteLinkSection(sectionId);
      this.data = storage.getData();
      this.renderQuickLinks();
    }
  }

  /**
   * Edit a link
   */
  editLink(id) {
    const links = storage.getQuickLinks();
    const link = links.find(l => l.id === id);
    if (!link) return;

    this.editingLinkId = id;
    this.selectedLinkSection = link.section;
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
    
    // Populate section dropdown
    this.populateLinkSectionDropdown(link.section);
    
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
    const sectionDropdown = document.getElementById('link-section');
    const section = sectionDropdown?.value || this.selectedLinkSection || storage.getLinkSections()[0]?.id;

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
      emailLabel: emailLabel || name,
      section
    };

    if (this.editingLinkId) {
      storage.updateQuickLink(this.editingLinkId, linkData);
    } else {
      storage.addQuickLink(linkData);
    }

    this.data = storage.getData();
    this.hideModal('link-modal');
    this.renderQuickLinks();
    
    // Update KB sources panel if it exists
    if (notebook && typeof notebook.renderSources === 'function') {
      notebook.renderSources();
    }
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
    
    // Persist and re-render after animation
    setTimeout(() => {
      storage.deleteQuickLink(linkId);
      this.data = storage.getData();
      this.renderQuickLinks();
      this.renderSettingsStatus();
      
      // Update KB sources panel if it exists
      if (notebook && typeof notebook.renderSources === 'function') {
        notebook.renderSources();
      }
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
  }

  /**
   * Setup drag and drop for todo items (reorder within groups and move between groups)
   */
  setupTodoDragDrop(meetingId) {
    const todoItems = document.querySelectorAll('.todo-item[draggable="true"]');
    const todoGroups = document.querySelectorAll('.todo-group-items');

    // Disable dragging on touch devices to allow scrolling
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      todoItems.forEach(item => item.removeAttribute('draggable'));
      return;
    }

    let draggedId = null;
    let dropIndicator = null;

    // Create drop indicator element
    const createDropIndicator = () => {
      const indicator = document.createElement('div');
      indicator.className = 'todo-drop-indicator';
      indicator.style.cssText = 'height: 2px; background: var(--accent-blue, #4A90D9); margin: 2px 0; border-radius: 1px; pointer-events: none;';
      return indicator;
    };

    const removeDropIndicator = () => {
      if (dropIndicator && dropIndicator.parentNode) {
        dropIndicator.parentNode.removeChild(dropIndicator);
      }
      dropIndicator = null;
    };

    const getDropPosition = (group, y) => {
      const items = [...group.querySelectorAll('.todo-item:not(.dragging)')];
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (y < midY) {
          return { element: items[i], position: 'before' };
        }
      }
      return { element: null, position: 'end' };
    };

    todoItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedId = item.dataset.todoId;
        e.dataTransfer.setData('text/plain', draggedId);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
        setTimeout(() => item.style.opacity = '0.4', 0);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        item.style.opacity = '';
        draggedId = null;
        removeDropIndicator();
        todoGroups.forEach(group => group.classList.remove('drag-over'));
      });
    });

    todoGroups.forEach(group => {
      group.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        group.classList.add('drag-over');

        // Show drop indicator at correct position
        const { element, position } = getDropPosition(group, e.clientY);
        removeDropIndicator();
        dropIndicator = createDropIndicator();
        
        if (position === 'end') {
          group.appendChild(dropIndicator);
        } else if (element) {
          element.parentNode.insertBefore(dropIndicator, element);
        }
      });

      group.addEventListener('dragleave', (e) => {
        if (!group.contains(e.relatedTarget)) {
          group.classList.remove('drag-over');
          removeDropIndicator();
        }
      });

      group.addEventListener('drop', (e) => {
        e.preventDefault();
        group.classList.remove('drag-over');
        
        const todoId = e.dataTransfer.getData('text/plain');
        const newOwner = group.closest('.todo-group').dataset.owner;
        const { element, position } = getDropPosition(group, e.clientY);
        const targetTodoId = element?.dataset?.todoId || null;
        
        removeDropIndicator();
        
        if (todoId && newOwner) {
          this.moveTodoToPosition(meetingId, todoId, newOwner, targetTodoId, position);
        }
      });
    });
  }

  /**
   * Move todo to a new position (reorder or change owner)
   */
  moveTodoToPosition(meetingId, todoId, newOwner, targetTodoId, position) {
    const meeting = meetingsManager.getMeeting(meetingId);
    if (!meeting || !meeting.todos) return;

    const todoIndex = meeting.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) return;

    const todo = meeting.todos[todoIndex];
    const currentOwner = this.resolveOwnerName(todo.owner);
    
    // Remove from current position
    meeting.todos.splice(todoIndex, 1);
    
    // Update owner if changed
    if (currentOwner !== newOwner) {
      todo.owner = newOwner;
    }
    
    // Find new position
    let insertIndex;
    if (targetTodoId && position === 'before') {
      insertIndex = meeting.todos.findIndex(t => t.id === targetTodoId);
      if (insertIndex === -1) insertIndex = meeting.todos.length;
    } else {
      // Insert at end of the target owner's todos
      const ownerTodos = meeting.todos.filter(t => this.resolveOwnerName(t.owner) === newOwner);
      if (ownerTodos.length > 0) {
        const lastOwnerTodo = ownerTodos[ownerTodos.length - 1];
        insertIndex = meeting.todos.findIndex(t => t.id === lastOwnerTodo.id) + 1;
      } else {
        insertIndex = meeting.todos.length;
      }
    }
    
    // Insert at new position
    meeting.todos.splice(insertIndex, 0, todo);
    
    // Save and re-render
    meetingsManager.updateMeeting(meeting);
    this.renderMeeting(meeting);
    this.renderActionItems();
  }

  /**
   * Move todo to a new owner (legacy method for compatibility)
   */
  moveTodoToOwner(meetingId, todoId, newOwner) {
    this.moveTodoToPosition(meetingId, todoId, newOwner, null, 'end');
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
    } else {
      // Add new
      storage.addInvestor({ name, amount: amount || '$TBD', stage, notes });
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
   * Open share email modal with section options
   */
  openShareEmailModal() {
    const reports = notebook.reports || [];
    const reportsHint = document.getElementById('share-reports-hint');
    const reportsCheckbox = document.getElementById('share-reports');
    const reportsList = document.getElementById('share-reports-list');
    
    // Update hint text
    if (reportsHint) {
      reportsHint.textContent = reports.length > 0 
        ? `${reports.length} report${reports.length !== 1 ? 's' : ''} available`
        : 'No reports generated';
    }
    
    // Populate individual report checkboxes
    if (reportsList) {
      if (reports.length > 0) {
        reportsList.innerHTML = reports.map(r => `
          <label class="checkbox-subitem">
            <input type="checkbox" class="share-report-item" data-report-id="${r.id}" checked>
            <span class="checkbox-subitem-label">${r.title}</span>
          </label>
        `).join('');
        reportsList.classList.add('has-items');
      } else {
        reportsList.innerHTML = '';
        reportsList.classList.remove('has-items');
      }
    }
    
    // Enable/disable parent checkbox and sync state
    if (reportsCheckbox) {
      reportsCheckbox.disabled = reports.length === 0;
      reportsCheckbox.checked = reports.length > 0;
    }
    
    // Populate links section
    const quickLinks = storage.getQuickLinks();
    const linksList = document.getElementById('share-links-list');
    const linksCheckbox = document.getElementById('share-links');
    
    if (linksList) {
      if (quickLinks.length > 0) {
        linksList.innerHTML = quickLinks.map(link => `
          <label class="checkbox-subitem">
            <input type="checkbox" class="share-link-item" data-link-id="${link.id}" ${link.emailEnabled !== false ? 'checked' : ''}>
            <span class="checkbox-subitem-label">${link.name}</span>
          </label>
        `).join('');
        linksList.classList.add('has-items');
      } else {
        linksList.innerHTML = '<span class="checkbox-subitem-label" style="opacity: 0.5;">No links configured</span>';
      }
    }
    
    if (linksCheckbox) {
      linksCheckbox.disabled = quickLinks.length === 0;
      linksCheckbox.checked = quickLinks.length > 0;
    }
    
    this.showModal('share-email-modal');
  }
  
  syncReportParentCheckbox() {
    const reportsList = document.getElementById('share-reports-list');
    const reportsCheckbox = document.getElementById('share-reports');
    if (!reportsList || !reportsCheckbox) return;
    
    const allCheckboxes = reportsList.querySelectorAll('.share-report-item');
    const checkedCount = reportsList.querySelectorAll('.share-report-item:checked').length;
    
    reportsCheckbox.checked = checkedCount > 0;
    reportsCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
  }
  
  syncLinksParentCheckbox() {
    const linksList = document.getElementById('share-links-list');
    const linksCheckbox = document.getElementById('share-links');
    if (!linksList || !linksCheckbox) return;
    
    const allCheckboxes = linksList.querySelectorAll('.share-link-item');
    const checkedCount = linksList.querySelectorAll('.share-link-item:checked').length;
    
    linksCheckbox.checked = checkedCount > 0;
    linksCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
  }

  /**
   * Generate and send email with selected sections
   */
  async generateAndSendEmail() {
    const includePipeline = document.getElementById('share-pipeline')?.checked;
    const includeSeedRaise = document.getElementById('share-seedraise')?.checked;
    const includeMeetings = document.getElementById('share-meetings')?.checked;
    const includeReports = document.getElementById('share-reports')?.checked;
    const includeLinks = document.getElementById('share-links')?.checked;
    
    // Show processing state
    const generateBtn = document.getElementById('share-email-generate');
    const originalText = generateBtn?.innerHTML;
    if (generateBtn) {
      generateBtn.innerHTML = 'Generating...';
      generateBtn.disabled = true;
    }
    
    try {
      // Collect content from selected sections
      const content = this.collectEmailContent({
        pipeline: includePipeline,
        seedRaise: includeSeedRaise,
        meetings: includeMeetings,
        reports: includeReports,
        links: includeLinks
      });
      
      // Polish with AI
      const polishedEmail = await this.polishEmailWithAI(content);
      
      // Show preview modal
      this.showEmailPreview(polishedEmail);
      
      this.hideModal('share-email-modal');
    } catch (error) {
      this.showToast('Failed to generate email: ' + error.message, 'error');
    } finally {
      if (generateBtn) {
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
      }
    }
  }

  /**
   * Collect content from selected sections
   */
  collectEmailContent(sections) {
    const weekRange = this.getWeekRange(new Date());
    let content = { weekRange, sections: [] };
    
    // Pipeline (use live Google Sheet data, same as dashboard)
    if (sections.pipeline) {
      const deals = this.pipelineDeals || [];
      let total = 0;
      const stageTotals = {};

      deals.forEach(d => {
        const stage = this.normalizeStage(d.stage || '');
        if (!stage) return;
        const value = this.parseMoneyValue(d.value);
        total += value;
        if (!stageTotals[stage]) stageTotals[stage] = 0;
        stageTotals[stage] += value;
      });

      content.sections.push({
        name: 'Pipeline',
        data: {
          total: this.formatMoney(total),
          dealCount: deals.length,
          stages: Object.entries(stageTotals)
            .map(([stage, val]) => `${stage}: ${this.formatMoney(val)}`).join(', '),
          topDeals: deals
            .filter(d => d.name || d.company)
            .slice(0, 8)
            .map(d => `${d.name || d.company}: ${d.value || 'TBD'} (${d.stage || 'unknown'})`)
        }
      });
    }
    
    // Seed Raise
    if (sections.seedRaise) {
      const seedRaise = this.data?.seedRaise || {};
      const investors = seedRaise.investors || [];
      const committed = investors.filter(i => i.stage === 'committed' || i.stage === 'closed');
      let raised = 0;
      committed.forEach(i => { raised += this.parseMoneyValue(i.amount); });
      
      content.sections.push({
        name: 'Seed Raise',
        data: {
          raised: this.formatMoney(raised),
          target: seedRaise.target || '$500K',
          committedCount: committed.length,
          recentCommits: committed.slice(-3).map(i => `${i.name}: ${i.amount}`)
        }
      });
    }
    
    // Meetings / Week at a Glance
    if (sections.meetings) {
      const meeting = meetingsManager.getCurrentMeeting();
      content.sections.push({
        name: 'Week at a Glance',
        data: {
          summary: meeting?.summary || [],
          decisions: meeting?.decisions || [],
          actionItems: storage.getAllTodos()
            .filter(t => !t.completed)
            .map(t => ({
              task: t.text,
              owner: this.resolveOwnerName(t.owner)
            }))
        }
      });
    }
    
    // KB Reports (only selected ones)
    if (sections.reports) {
      const allReports = notebook.reports || [];
      const reportsList = document.getElementById('share-reports-list');
      const selectedIds = new Set();
      
      reportsList?.querySelectorAll('.share-report-item:checked').forEach(cb => {
        selectedIds.add(cb.dataset.reportId);
      });
      
      const selectedReports = allReports.filter(r => selectedIds.has(r.id));
      
      if (selectedReports.length > 0) {
        content.sections.push({
          name: 'Reports',
          data: {
            reports: selectedReports.map(r => ({
              title: r.title,
              content: r.content?.substring(0, 500) + (r.content?.length > 500 ? '...' : '')
            }))
          }
        });
      }
    }
    
    // Links (selected ones)
    if (sections.links) {
      const allLinks = storage.getQuickLinks();
      const linksList = document.getElementById('share-links-list');
      const selectedIds = new Set();
      
      linksList?.querySelectorAll('.share-link-item:checked').forEach(cb => {
        selectedIds.add(cb.dataset.linkId);
      });
      
      const selectedLinks = allLinks.filter(l => selectedIds.has(l.id));
      
      if (selectedLinks.length > 0) {
        content.links = selectedLinks.map(l => ({
          name: l.emailLabel || l.name,
          url: l.url
        }));
      }
    }
    
    return content;
  }

  /**
   * Polish email content with AI
   */
  async polishEmailWithAI(content) {
    const systemPrompt = `You are a professional email writer. Format the following weekly update data into a polished, professional email.

RULES:
- No emojis or special characters
- Plain text formatting only
- Simple dashes for bullets
- Clean section headers (no decorative lines or symbols)
- Sophisticated, understated tone
- Direct and factual
- Brief sign-off without flourish
- Keep it concise and scannable

IMPORTANT: Your response must be valid JSON with this exact format:
{
  "highlights": "brief 5-8 word summary of key wins/updates",
  "body": "the full email body text"
}

The highlights should capture the most important 1-2 things (e.g., "3 New Deals, Pipeline Growth").
The body should NOT include a subject line or greeting like "Dear X".`;

    const linksSection = content.links && content.links.length > 0 
      ? `\n\nLINKS TO INCLUDE AT END:\n${content.links.map(l => `${l.name}: ${l.url}`).join('\n')}`
      : '';
    
    const userPrompt = `Create a weekly update email for: ${content.weekRange}

DATA TO INCLUDE:
${JSON.stringify(content.sections, null, 2)}${linksSection}

Format this into a clean, professional weekly update email. Return as JSON with "highlights" and "body" fields.`;

    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;

    try {
      const response = await aiProcessor.chat(systemPrompt, userPrompt);
      const parsed = JSON.parse(response);
      return {
        subject: `Glossi Weekly Update ${dateStr}: ${parsed.highlights}`,
        body: parsed.body
      };
    } catch (error) {
      // Fallback to raw formatting if AI fails
      return {
        subject: `Glossi Weekly Update ${dateStr}`,
        body: this.formatRawEmail(content)
      };
    }
  }
  
  /**
   * Show email preview modal
   */
  showEmailPreview(email) {
    const subjectInput = document.getElementById('email-preview-subject');
    const bodyTextarea = document.getElementById('email-preview-body');
    
    if (subjectInput) subjectInput.value = email.subject;
    if (bodyTextarea) bodyTextarea.value = email.body;
    
    this.showModal('email-preview-modal');
  }
  
  /**
   * Copy email to clipboard
   */
  async copyEmailToClipboard() {
    const subject = document.getElementById('email-preview-subject')?.value || '';
    const body = document.getElementById('email-preview-body')?.value || '';
    
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    
    try {
      await navigator.clipboard.writeText(fullEmail);
      // Update button to show success
      const copyBtn = document.getElementById('email-preview-copy');
      if (copyBtn) {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
        setTimeout(() => { copyBtn.innerHTML = original; }, 2000);
      }
    } catch (error) {
      this.showToast('Failed to copy', 'error');
    }
  }

  /**
   * Format email without AI (fallback)
   */
  formatRawEmail(content) {
    let body = `WEEKLY UPDATE | ${content.weekRange}\n${'='.repeat(40)}\n\n`;
    
    content.sections.forEach(section => {
      body += `${section.name.toUpperCase()}\n${'-'.repeat(20)}\n`;
      
      if (section.name === 'Pipeline') {
        body += `Total: ${section.data.total} (${section.data.dealCount} deals)\n`;
        body += `By Stage: ${section.data.stages}\n`;
        if (section.data.topDeals?.length) {
          body += `Top Deals:\n${section.data.topDeals.map(d => `  - ${d}`).join('\n')}\n`;
        }
      } else if (section.name === 'Seed Raise') {
        body += `Raised: ${section.data.raised} / ${section.data.target}\n`;
        if (section.data.recentCommits?.length) {
          body += `Recent: ${section.data.recentCommits.join(', ')}\n`;
        }
      } else if (section.name === 'Week at a Glance') {
        if (section.data.summary?.length) {
          body += `Summary:\n${section.data.summary.map(s => `  - ${s}`).join('\n')}\n`;
        }
        if (section.data.actionItems?.length) {
          body += `Action Items:\n${section.data.actionItems.map(a => `  - ${a.task} (${a.owner})`).join('\n')}\n`;
        }
      } else if (section.name === 'Reports') {
        section.data.reports?.forEach(r => {
          body += `${r.title}:\n${r.content}\n\n`;
        });
      }
      
      body += '\n';
    });
    
    return body;
  }

  /**
   * Open mailto link with email content
   */
  openMailto(email) {
    const subject = encodeURIComponent(email.subject);
    const body = encodeURIComponent(email.body);
    const mailto = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank');
  }

  /**
   * Share weekly update via email - clean, scannable format (legacy)
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
  }

  /**
   * Render meeting selector dropdown
   */
  renderMeetingSelector() {
    const select = document.getElementById('meeting-select');
    const meetings = meetingsManager.getAllMeetings();
    

    // Get current week range
    const thisWeekRange = this.getWeekRange(new Date());
    const thisWeekKey = this.getWeekKey(new Date());

    // Group meetings by week, keeping only the most recent per week
    const weekMap = new Map();
    meetings.forEach(meeting => {
      const meetingDate = new Date(meeting.date);
      const weekKey = this.getWeekKey(meetingDate);
      const weekRange = this.getWeekRange(meetingDate);
      
      // Keep only the most recent meeting per week
      if (!weekMap.has(weekKey) || new Date(meeting.date) > new Date(weekMap.get(weekKey).date)) {
        weekMap.set(weekKey, { meeting, weekRange });
      }
    });

    // Check if there's a meeting this week
    const thisWeekMeeting = meetings.find(m => this.getWeekKey(new Date(m.date)) === thisWeekKey);
    
    // Sort weeks by date (most recent first)
    const sortedWeeks = Array.from(weekMap.entries())
      .sort((a, b) => new Date(b[1].meeting.date) - new Date(a[1].meeting.date));
    
    // Build select options - only show current week if it has a meeting
    select.innerHTML = '';
    
    if (thisWeekMeeting) {
      select.innerHTML += `<option value="latest">${thisWeekRange}</option>`;
    }

    // Add all weeks with meetings
    sortedWeeks.forEach(([weekKey, { meeting, weekRange }]) => {
      // Skip current week (already added above if it has a meeting)
      if (weekKey === thisWeekKey) return;
      select.innerHTML += `<option value="${meeting.id}">${weekRange}</option>`;
    });
    
    // If no meetings at all, show empty state
    if (select.innerHTML === '') {
      select.innerHTML = `<option value="latest">${thisWeekRange} (no notes)</option>`;
    }
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
      this.renderActionItems();
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
      // First resolve alias to full name
      let resolvedOwner = this.resolveOwnerName(newOwner);
      
      // Check if there's an existing owner in this meeting that matches (case-insensitive)
      // This ensures "WILL" matches existing "Will" group
      const existingOwners = [...new Set(meeting.todos.map(t => this.resolveOwnerName(t.owner)))];
      const matchingOwner = existingOwners.find(
        existing => existing.toLowerCase() === resolvedOwner.toLowerCase()
      );
      
      if (matchingOwner) {
        resolvedOwner = matchingOwner;
      }
      
      todo.owner = resolvedOwner;
      meetingsManager.updateMeeting(meeting);
      this.renderActionItems();
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
    this.hideModal('pipeline-edit-modal');
    this.renderPipelineSection();
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
    } else {
      storage.addTalkingPoint(title, content);
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
      const result = await aiProcessor.processMeetingNotes(notes, title, date);
      
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
    this.renderActionItems();
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
    const responseText = result.content?.[0]?.text || '';
    
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
    
    try {
      const deals = await this.extractPipelineDeals(text);
      
      if (deals.length === 0) {
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
    const responseText = result.content?.[0]?.text || '';
    
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
      const responseText = result.content?.[0]?.text || '';
      
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
      const responseText = result.content?.[0]?.text || '';
      
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
      return;
    }
    
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
      const responseText = result.content?.[0]?.text || '';
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse response');
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      if (!analysis.fixes || analysis.fixes.length === 0) {
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
    const responseText = result.content?.[0]?.text || '';
    
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
    this.renderActionItems();
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
          }
        }
        break;
        
      default:
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
    return result.content?.[0]?.text || '';
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
    return result.content?.[0]?.text || '';
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
    const responseText = result.content?.[0]?.text || '';
    
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
    const responseText = result.content?.[0]?.text || '';
    
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
    const responseText = result.content?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      return null;
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
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
    } else if (action === 'talking_point') {
      // Add to talking points under testimonials category
      const title = item.source || 'Customer Quote';
      const content = item.quote + (item.context ? ` (${item.context})` : '');
      storage.addTalkingPoint(title, content, 'testimonials');
      this.savedItems.talkingPoints.push(item);
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
        const text = (result.content?.[0]?.text || '').toLowerCase().trim();
        
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
    // Quotes section was removed - using Notebook instead
    return;
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
  }

  /**
   * Render scratchpad list (deprecated - section removed)
   */
  renderScratchpad() {
    // Scratchpad section was removed - using Notebook instead
    return;
  }

  /**
   * Restore an archived scratchpad item
   */
  restoreArchivedItem(id) {
    storage.restoreArchivedItem(id);
    this.renderScratchpad();
  }

  /**
   * Permanently delete an archived item
   */
  deleteArchivedItem(id) {
    storage.deleteArchivedItem(id);
    this.renderScratchpad();
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
  }

  /**
   * View original source file
   */
  viewSource(thoughtId) {
    const result = this.findScratchpadItem(thoughtId);
    if (!result || !result.item.originalSource) {
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
        const suggestion = (result.content?.[0]?.text || '').toLowerCase();
        
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

    let pipelineChanged = false;

    if (this.pendingReview.type === 'meeting') {
      // Extract todos for review (don't auto-add them to meeting)
      const extractedTodos = this.pendingReview.aiData.todos || [];
      
      // Create the meeting WITHOUT todos (summary and decisions auto-save)
      const meetingData = {
        ...this.pendingReview.aiData,
        todos: [] // Todos go through review modal
      };
      
      const meeting = meetingsManager.createMeeting(
        this.pendingReview.title,
        this.pendingReview.date,
        this.pendingReview.rawNotes,
        meetingData
      );

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
      this.renderActionItems();
      this.renderPipelineSection();
      
      // Show todo review modal if there are extracted todos
      if (extractedTodos.length > 0) {
        setTimeout(() => {
          this.showTodoReviewModal(extractedTodos);
        }, 300);
      }
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
    const pipelineSheetUrl = document.getElementById('pipeline-sheet-url')?.value.trim() || '';

    // Update seed raise target
    const seedRaiseTarget = document.getElementById('seed-raise-target').value.trim();
    if (seedRaiseTarget) {
      storage.updateSeedTarget(seedRaiseTarget);
    }
    
    // Update pipeline target
    const pipelineTarget = document.getElementById('pipeline-target-setting')?.value.trim();
    if (pipelineTarget) {
      storage.updatePipelineTarget(pipelineTarget);
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
      pipelineSheetUrl,
      autoCurate,
      staleThresholdWeeks
    });
    aiProcessor.setApiKey(apiKey);
    OPENAI_API_KEY = openaiApiKey || null;

    // Close modal first
    this.hideModal('settings-modal');

    // Test connection if key provided
    if (apiKey) {
      const connected = await aiProcessor.testConnection();
    }

    // Update UI status
    this.renderSettingsStatus();
    this.renderSeedRaise();
    
    // Refresh pipeline if URL changed
    if (pipelineSheetUrl) {
      this.fetchPipelineFromSheet();
    }
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

    // Pipeline sheet URL
    const pipelineSheetUrlEl = document.getElementById('pipeline-sheet-url');
    if (pipelineSheetUrlEl) {
      pipelineSheetUrlEl.value = this.settings.pipelineSheetUrl || '';
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

    // Seed raise target
    const seedRaise = storage.getSeedRaise();
    document.getElementById('seed-raise-target').value = seedRaise.target || '$500K';
    
    // Pipeline target
    const pipelineTargetEl = document.getElementById('pipeline-target-setting');
    if (pipelineTargetEl) {
      pipelineTargetEl.value = this.data?.settings?.pipelineTarget || '$900K';
    }
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
