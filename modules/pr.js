/**
 * PR Agent Module
 * Handles PR content generation, source management, and strategy recommendations
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const PR_SYSTEM_PROMPT = `You are Glossi's communications strategist. You write like the teams at Linear and Cursor communicate. Study how they work:

Linear announced an $82M Series C by saying "not much changes after a raise. We go back to building." That's the energy. Cursor's homepage says "Built to make you extraordinarily productive, Cursor is the best way to code with AI." One sentence. States the claim. Moves on.

Glossi communicates the same way. We are the first AI-native 3D product visualization platform. We built this. It works. The industry is catching up to where we already are.

VOICE RULES:
- Open with what happened or what the product does. Never with how you feel.
- Short sentences. Period-separated thoughts. Not comma-laden ones.
- Numbers over adjectives. "80% reduction" not "dramatic reduction."
- Name the specific technology. "Real-time 3D compositing in browser via Unreal Engine 5." Not "our advanced AI platform."
- Features are facts, not events. Announce them like a Linear changelog entry.
- Never use: "excited to announce", "thrilled", "groundbreaking", "game-changing", "revolutionary", "best-in-class", "cutting-edge", "leveraging", "unlocking"
- No exclamation marks. Ever.
- Never explain why Glossi is great. Describe what it does. Let the reader conclude.
- When writing pitches: no "Dear [name]" openings. Open with the story or the fact.
- The confidence comes from specificity, not volume. Be precise. Be brief. Be done.

LEADERSHIP STANCE:
- Glossi is the leader. The first. Write from that position.
- Never defensive. Never reacting to competitors. We set the pace.
- When referencing the market or trends (like world models), the framing is: "We built for this. Now it's arriving."
- Features ship constantly. This is a company that builds. Communicate that through cadence, not claims.

SOURCING RULES (CRITICAL):
- You may ONLY make claims that are directly supported by the provided sources.
- Every factual claim must include a citation reference [Source X].
- If you cannot source a claim, mark it as [NEEDS SOURCE] and flag it for user review.
- Never infer, assume, or hallucinate metrics, dates, partnerships, or features not present in sources.
- If sources are insufficient for the requested content type, tell the user what additional information is needed.
- Do not invent quotes. Do not fabricate analyst commentary. Do not assume future features.

GLOSSI CONTEXT:
- First AI-native 3D product visualization platform
- Core architecture: compositing, not generation. The product 3D asset stays untouched. AI generates scenes around it.
- Analogy: green screen for products. The product is the actor. Sacred. Untouchable.
- Built on Unreal Engine 5, runs in browser. No plugins, no installs.
- World models (emerging in 2026) validate Glossi's architectural decisions. Legacy tools will retrofit. Glossi is ready.
- Target customers: enterprise brands, e-commerce, CPG, fashion, beauty
- Traction: 50+ brands, $200K pipeline, 80% photo cost reduction
- Company has features rolling out continuously. Communicate through momentum, not proclamation.

CONTENT TYPE GUIDANCE:

Press Release: Write like Linear's blog announcements. Open with the news. One paragraph of context. Quote from founder (short, confident, not salesy). Details. Close with about section. No "FOR IMMEDIATE RELEASE" unless user requests it.

Media Pitch: Open with why this matters to the journalist's beat. Not "I hope this email finds you well." Get to the angle in the first sentence. Keep it under 150 words.

Product Announcement: Changelog style. What shipped. What it does. One sentence on why it matters. Move on.

LinkedIn Post: Perspective piece energy. Share a take. Back it with what you've built. No hashtag spam. One or two max.

Blog Post: Write like Linear's "Now" blog. First-person where appropriate. Opinionated. Substantive. Not content marketing. Real thinking about real problems in the space.

Tweet Thread: Each tweet stands alone. No "1/" numbering. First tweet is the hook. Last tweet is the call to action or link. Keep each under 280 characters.

Founder Quote / Soundbite: Short. Quotable. Something a journalist would actually use. Not corporate speak.

Briefing Document: Background context for a journalist meeting. Key facts, angles, what to emphasize, what to avoid.

Talking Points: Bullet format. Each point is self-contained. Ordered by importance.

When generating content, first analyze the provided sources, then produce the requested content type with proper citations. After generating, provide distribution strategy recommendations.

RESPONSE FORMAT:
Return your response in this exact JSON structure:
{
  "content": "The generated PR content with [Source X] citations inline",
  "citations": [
    {"index": 1, "sourceId": "src_id", "excerpt": "relevant quote from source", "verified": true},
    {"index": 2, "sourceId": null, "excerpt": "claim that needs verification", "verified": false}
  ],
  "strategy": {
    "outlets": [
      {"name": "Outlet Name", "tier": 1, "rationale": "Why this outlet", "angle": "How to frame for them"}
    ],
    "timing": "Optimal timing recommendation",
    "hooks": ["Current news hook 1", "Current news hook 2"],
    "journalistBeats": ["Beat to target 1", "Beat to target 2"],
    "amplification": {
      "social": ["Step 1", "Step 2"],
      "internal": ["Investor update note", "Team announcement"],
      "community": ["Subreddit or community 1", "Community 2"]
    }
  }
}`;

const CONTENT_TYPES = [
  { id: 'press_release', label: 'Press Release' },
  { id: 'media_pitch', label: 'Media Pitch Email' },
  { id: 'product_announcement', label: 'Product Announcement' },
  { id: 'founder_quote', label: 'Founder Quote / Soundbite' },
  { id: 'blog_post', label: 'Blog Post' },
  { id: 'linkedin_post', label: 'LinkedIn Post' },
  { id: 'tweet_thread', label: 'Tweet Thread' },
  { id: 'briefing_doc', label: 'Briefing Document' },
  { id: 'talking_points', label: 'Talking Points' },
  { id: 'custom', label: 'Custom' }
];

class PRAgent {
  constructor() {
    this.sources = [];
    this.outputs = [];
    this.settings = {};
    this.currentOutput = null;
    this.isGenerating = false;
    this.apiKey = null;
    this.openaiApiKey = null;
  }

  init() {
    this.loadData();
    this.setupDOM();
    this.setupEventListeners();
    this.renderSources();
    this.renderHistory();
    this.updateGenerateButton();
  }

  loadData() {
    try {
      const sourcesRaw = localStorage.getItem('pr_sources');
      const parsed = sourcesRaw ? JSON.parse(sourcesRaw) : [];
      this.sources = Array.isArray(parsed) ? parsed.map(s => ({
        ...s,
        selected: s.selected !== false
      })) : [];
    } catch (e) {
      this.sources = [];
    }
    try {
      const outputsRaw = localStorage.getItem('pr_outputs');
      this.outputs = outputsRaw ? JSON.parse(outputsRaw) : [];
    } catch (e) {
      this.outputs = [];
    }
    try {
      const settingsRaw = localStorage.getItem('pr_settings');
      this.settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    } catch (e) {
      this.settings = {};
    }
    try {
      const glossiSettings = localStorage.getItem('glossi_settings');
      if (glossiSettings) {
        const gs = JSON.parse(glossiSettings);
        this.apiKey = gs.apiKey || null;
        this.openaiApiKey = gs.openaiApiKey || null;
      }
    } catch (e) {
      this.apiKey = null;
      this.openaiApiKey = null;
    }
    this.isGenerating = false;
  }

  saveSources() {
    try {
      localStorage.setItem('pr_sources', JSON.stringify(this.sources));
    } catch (e) {
      this.showToast('Failed to save sources', 'error');
    }
  }

  saveOutputs() {
    try {
      localStorage.setItem('pr_outputs', JSON.stringify(this.outputs));
    } catch (e) {
      this.showToast('Failed to save outputs', 'error');
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('pr_settings', JSON.stringify(this.settings));
    } catch (e) {
      this.showToast('Failed to save settings', 'error');
    }
  }

  setupDOM() {
    this.dom = {
      sourcesList: document.getElementById('pr-sources-list'),
      sourcesCount: document.getElementById('pr-sources-count'),
      sourcesEmpty: document.getElementById('pr-sources-empty'),
      sourceSearch: document.getElementById('pr-source-search'),
      addSourceBtn: document.getElementById('pr-add-source-btn'),
      sourceModal: document.getElementById('pr-source-modal'),
      sourceModalClose: document.getElementById('pr-source-modal-close'),
      sourceModalCancel: document.getElementById('pr-source-cancel'),
      sourceModalSave: document.getElementById('pr-source-save'),
      sourceTabs: document.querySelectorAll('.pr-source-tab'),
      sourcePanels: document.querySelectorAll('.pr-source-panel'),
      contentType: document.getElementById('pr-content-type'),
      customPromptWrap: document.getElementById('pr-custom-prompt-wrap'),
      customPrompt: document.getElementById('pr-custom-prompt'),
      generateBtn: document.getElementById('pr-generate-btn'),
      regenerateBtn: document.getElementById('pr-regenerate-btn'),
      workspace: document.getElementById('pr-workspace-content'),
      workspaceEmpty: document.getElementById('pr-workspace-empty'),
      workspaceGenerated: document.getElementById('pr-workspace-generated'),
      generatedContent: document.getElementById('pr-generated-content'),
      loadingState: document.getElementById('pr-loading-state'),
      verificationBar: document.getElementById('pr-verification-bar'),
      verificationText: document.getElementById('pr-verification-text'),
      verificationProgress: document.getElementById('pr-verification-progress'),
      copyBtn: document.getElementById('pr-copy-btn'),
      exportBtn: document.getElementById('pr-export-btn'),
      exportMenu: document.getElementById('pr-export-menu'),
      strategyPanel: document.getElementById('pr-strategy-content'),
      strategyEmpty: document.getElementById('pr-strategy-empty'),
      historyList: document.getElementById('pr-history-list'),
      historyEmpty: document.getElementById('pr-history-empty'),
      historyToggle: document.getElementById('pr-history-toggle'),
      historySection: document.getElementById('pr-history-section'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  setupEventListeners() {
    // Add source button
    this.dom.addSourceBtn?.addEventListener('click', () => this.openSourceModal());

    // Source modal close
    this.dom.sourceModalClose?.addEventListener('click', () => this.closeSourceModal());
    this.dom.sourceModalCancel?.addEventListener('click', () => this.closeSourceModal());
    this.dom.sourceModal?.addEventListener('click', (e) => {
      if (e.target === this.dom.sourceModal) this.closeSourceModal();
    });

    // Source modal save
    this.dom.sourceModalSave?.addEventListener('click', () => this.saveSource());

    // Source tabs
    this.dom.sourceTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchSourceTab(tab.dataset.type));
    });

    // Source search
    this.dom.sourceSearch?.addEventListener('input', () => this.filterSources());

    // Content type change
    this.dom.contentType?.addEventListener('change', () => {
      const isCustom = this.dom.contentType.value === 'custom';
      if (this.dom.customPromptWrap) {
        this.dom.customPromptWrap.style.display = isCustom ? 'block' : 'none';
      }
    });

    // Generate button
    this.dom.generateBtn?.addEventListener('click', () => this.generateContent());

    // Intercept clicks on disabled generate button via parent container
    const controls = document.querySelector('.pr-workspace-controls');
    if (controls) {
      controls.addEventListener('click', (e) => {
        if (this.dom.generateBtn?.disabled && e.target.closest('.pr-workspace-controls')) {
          const hasApiKey = this.apiKey && this.apiKey.length > 0;
          const selectedSources = this.sources.filter(s => s.selected);
          if (!hasApiKey) {
            this.showToast('Set your Anthropic API key in Settings first', 'error');
          } else if (selectedSources.length === 0) {
            this.showToast('Select at least one source to generate content', 'error');
          }
        }
      });
    }

    // Regenerate button
    this.dom.regenerateBtn?.addEventListener('click', () => this.generateContent());

    // Copy button
    this.dom.copyBtn?.addEventListener('click', () => this.copyContent());

    // Export button
    this.dom.exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.exportMenu?.classList.toggle('active');
    });

    // Export menu items
    document.getElementById('pr-export-text')?.addEventListener('click', () => this.exportAs('text'));
    document.getElementById('pr-export-html')?.addEventListener('click', () => this.exportAs('html'));

    // Close export menu on outside click
    document.addEventListener('click', () => {
      this.dom.exportMenu?.classList.remove('active');
    });

    // History toggle
    this.dom.historyToggle?.addEventListener('click', () => {
      const content = document.getElementById('pr-history-content');
      const toggle = this.dom.historyToggle;
      if (content) {
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'block' : 'none';
        toggle.classList.toggle('collapsed', !isCollapsed);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSourceModal();
        this.dom.exportMenu?.classList.remove('active');
      }
    });

    // Confirm/Prompt modal handlers
    this.setupConfirmModal();
  }

  setupConfirmModal() {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmOk = document.getElementById('confirm-modal-ok');
    const confirmCancel = document.getElementById('confirm-modal-cancel');

    if (confirmOk) {
      confirmOk.addEventListener('click', () => {
        confirmModal.classList.remove('visible');
        if (this._confirmResolve) {
          this._confirmResolve(true);
          this._confirmResolve = null;
        }
      });
    }
    if (confirmCancel) {
      confirmCancel.addEventListener('click', () => {
        confirmModal.classList.remove('visible');
        if (this._confirmResolve) {
          this._confirmResolve(false);
          this._confirmResolve = null;
        }
      });
    }
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
          confirmModal.classList.remove('visible');
          if (this._confirmResolve) {
            this._confirmResolve(false);
            this._confirmResolve = null;
          }
        }
      });
    }
  }

  showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      this._confirmResolve = resolve;
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const messageEl = document.getElementById('confirm-modal-message');
      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;
      modal?.classList.add('visible');
    });
  }

  // =========================================
  // SOURCE MANAGEMENT
  // =========================================

  openSourceModal() {
    this.resetSourceModal();
    this.dom.sourceModal?.classList.add('visible');
    setTimeout(() => {
      document.getElementById('pr-source-title')?.focus();
    }, 100);
  }

  closeSourceModal() {
    this.dom.sourceModal?.classList.remove('visible');
  }

  resetSourceModal() {
    const fields = [
      'pr-source-title', 'pr-source-title-url', 'pr-source-title-file', 'pr-source-title-audio',
      'pr-source-text', 'pr-source-url'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const fileInput = document.getElementById('pr-source-file-input');
    if (fileInput) fileInput.value = '';
    this.switchSourceTab('text');
    // Clear file preview
    const filePreview = document.getElementById('pr-file-preview');
    if (filePreview) {
      filePreview.style.display = 'none';
      filePreview.textContent = '';
    }
    // Clear audio state
    this.stopRecording();
    const audioPreview = document.getElementById('pr-audio-preview');
    if (audioPreview) audioPreview.style.display = 'none';
  }

  switchSourceTab(type) {
    this.dom.sourceTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === type);
    });
    this.dom.sourcePanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `pr-panel-${type}`);
    });
    this._activeSourceTab = type;
  }

  saveSource() {
    const type = this._activeSourceTab || 'text';
    const titleSuffix = type === 'text' ? '' : `-${type}`;
    const titleInput = document.getElementById(`pr-source-title${titleSuffix}`);
    const title = titleInput?.value.trim() || '';

    let content = '';
    let url = '';
    let fileName = '';

    if (type === 'text') {
      const textInput = document.getElementById('pr-source-text');
      content = textInput?.value.trim() || '';
      if (!content) {
        this.showToast('Please enter some text content', 'error');
        return;
      }
    } else if (type === 'url') {
      const urlInput = document.getElementById('pr-source-url');
      url = urlInput?.value.trim() || '';
      if (!url) {
        this.showToast('Please enter a URL', 'error');
        return;
      }
      if (!this.isValidUrl(url)) {
        this.showToast('Please enter a valid URL', 'error');
        return;
      }
      const urlTitle = document.getElementById('pr-source-title-url')?.value.trim() || '';
      this.fetchUrlContent(url, urlTitle);
      return;
    } else if (type === 'file') {
      content = this._pendingFileContent || '';
      fileName = this._pendingFileName || '';
      if (!content) {
        this.showToast('Please upload a file first', 'error');
        return;
      }
    } else if (type === 'audio') {
      content = this._pendingTranscription || '';
      if (!content) {
        this.showToast('Please record or upload audio first', 'error');
        return;
      }
    }

    const autoTitle = title || this.generateTitle(content, type);

    const source = {
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: autoTitle,
      type,
      content,
      url: url || undefined,
      fileName: fileName || undefined,
      createdAt: new Date().toISOString(),
      selected: true
    };

    this.sources.push(source);
    this.saveSources();
    this.renderSources();
    this.updateGenerateButton();
    this.closeSourceModal();
    this.showToast('Source added');

    // Clean up pending data
    this._pendingFileContent = null;
    this._pendingFileName = null;
    this._pendingTranscription = null;
  }

  generateTitle(content, type) {
    if (!content) return `${type.charAt(0).toUpperCase() + type.slice(1)} Source`;
    const words = content.split(/\s+/).slice(0, 8).join(' ');
    return words.length > 50 ? words.substring(0, 50) + '...' : words;
  }

  isValidUrl(str) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async fetchUrlContent(url, title) {
    this.showToast('Fetching URL content...');
    try {
      const response = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
      let content = '';
      if (response.ok) {
        const data = await response.json();
        content = data.content || data.text || '';
      }
      if (!content) {
        try {
          const directResponse = await fetch(url);
          const html = await directResponse.text();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const scripts = tempDiv.querySelectorAll('script, style, nav, footer, header');
          scripts.forEach(el => el.remove());
          content = tempDiv.textContent?.replace(/\s+/g, ' ').trim() || '';
        } catch {
          this.showToast('Could not fetch URL content. The site may block external requests.', 'error');
          return;
        }
      }
      if (!content || content.length < 10) {
        this.showToast('Could not extract meaningful content from this URL', 'error');
        return;
      }

      const autoTitle = title || new URL(url).hostname;
      const source = {
        id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        title: autoTitle,
        type: 'url',
        content: content.substring(0, 50000),
        url,
        createdAt: new Date().toISOString(),
        selected: true
      };

      this.sources.push(source);
      this.saveSources();
      this.renderSources();
      this.updateGenerateButton();
      this.closeSourceModal();
      this.showToast('URL source added');
    } catch (err) {
      this.showToast('Failed to fetch URL: ' + err.message, 'error');
    }
  }

  async deleteSource(id) {
    const confirmed = await this.showConfirm('Delete this source? This cannot be undone.', 'Delete Source');
    if (!confirmed) return;

    this.sources = this.sources.filter(s => s.id !== id);
    this.saveSources();
    this.renderSources();
    this.updateGenerateButton();
    this.showToast('Source deleted');
  }

  toggleSourceSelection(id) {
    const source = this.sources.find(s => s.id === id);
    if (source) {
      source.selected = !source.selected;
      this.saveSources();
      this.renderSources();
      this.updateGenerateButton();
    }
  }

  editSourceTitle(id) {
    const source = this.sources.find(s => s.id === id);
    if (!source) return;

    const titleEl = document.querySelector(`[data-source-id="${id}"] .pr-source-title`);
    if (!titleEl) return;

    titleEl.contentEditable = true;
    titleEl.focus();

    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const onBlur = () => {
      titleEl.contentEditable = false;
      const newTitle = titleEl.textContent.trim();
      if (newTitle && newTitle !== source.title) {
        source.title = newTitle;
        this.saveSources();
      } else {
        titleEl.textContent = source.title;
      }
      titleEl.removeEventListener('blur', onBlur);
      titleEl.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      } else if (e.key === 'Escape') {
        titleEl.textContent = source.title;
        titleEl.blur();
      }
    };

    titleEl.addEventListener('blur', onBlur);
    titleEl.addEventListener('keydown', onKeydown);
  }

  filterSources() {
    const query = this.dom.sourceSearch?.value.toLowerCase() || '';
    const items = document.querySelectorAll('.pr-source-item');
    items.forEach(item => {
      const title = item.querySelector('.pr-source-title')?.textContent.toLowerCase() || '';
      item.style.display = title.includes(query) ? '' : 'none';
    });
  }

  renderSources() {
    if (!this.dom.sourcesList) return;

    const selectedCount = this.sources.filter(s => s.selected).length;
    if (this.dom.sourcesCount) {
      this.dom.sourcesCount.textContent = this.sources.length;
    }

    if (this.sources.length === 0) {
      this.dom.sourcesList.innerHTML = '';
      if (this.dom.sourcesEmpty) this.dom.sourcesEmpty.style.display = 'block';
      return;
    }

    if (this.dom.sourcesEmpty) this.dom.sourcesEmpty.style.display = 'none';

    const typeIcons = {
      text: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
      url: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
      file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>',
      audio: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>'
    };

    this.dom.sourcesList.innerHTML = this.sources.map(source => {
      const date = new Date(source.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const preview = (source.content || '').substring(0, 100);
      return `
        <div class="pr-source-item ${source.selected ? 'selected' : ''}" data-source-id="${source.id}">
          <label class="pr-source-checkbox">
            <input type="checkbox" ${source.selected ? 'checked' : ''} data-action="toggle" data-id="${source.id}">
          </label>
          <div class="pr-source-info" data-action="edit-title" data-id="${source.id}">
            <div class="pr-source-header">
              <span class="pr-source-type-icon">${typeIcons[source.type] || typeIcons.text}</span>
              <span class="pr-source-title">${this.escapeHtml(source.title)}</span>
            </div>
            <div class="pr-source-meta">
              <span class="pr-source-date">${date}</span>
              ${preview ? `<span class="pr-source-preview">${this.escapeHtml(preview)}</span>` : ''}
            </div>
          </div>
          <button class="pr-source-delete" data-action="delete" data-id="${source.id}" title="Delete source">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>`;
    }).join('');

    // Event delegation for source items
    this.dom.sourcesList.querySelectorAll('[data-action]').forEach(el => {
      const action = el.dataset.action;
      if (action === 'toggle') {
        el.addEventListener('change', () => {
          this.toggleSourceSelection(el.dataset.id);
        });
      } else if (action === 'delete') {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteSource(el.dataset.id);
        });
      } else if (action === 'edit-title') {
        el.addEventListener('click', () => {
          this.editSourceTitle(el.dataset.id);
        });
      }
    });
  }

  renderHistory() {
    if (!this.dom.historyList) return;

    if (this.outputs.length === 0) {
      this.dom.historyList.innerHTML = '';
      if (this.dom.historyEmpty) this.dom.historyEmpty.style.display = 'block';
      return;
    }

    if (this.dom.historyEmpty) this.dom.historyEmpty.style.display = 'none';

    const sorted = [...this.outputs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    this.dom.historyList.innerHTML = sorted.map(output => {
      const date = new Date(output.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const typeLabel = CONTENT_TYPES.find(t => t.id === output.contentType)?.label || output.contentType;
      return `
        <div class="pr-history-item" data-output-id="${output.id}">
          <div class="pr-history-info">
            <span class="pr-history-title">${this.escapeHtml(output.title || 'Untitled')}</span>
            <span class="pr-history-meta">${typeLabel} / ${date}</span>
          </div>
          <button class="pr-history-delete" data-history-delete="${output.id}" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>`;
    }).join('');

    // Event listeners for history items
    this.dom.historyList.querySelectorAll('.pr-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-history-delete]')) return;
        this.loadOutput(item.dataset.outputId);
      });
    });

    this.dom.historyList.querySelectorAll('[data-history-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await this.showConfirm('Delete this output?', 'Delete');
        if (confirmed) {
          this.outputs = this.outputs.filter(o => o.id !== btn.dataset.historyDelete);
          this.saveOutputs();
          this.renderHistory();
          this.showToast('Output deleted');
        }
      });
    });
  }

  loadOutput(id) {
    const output = this.outputs.find(o => o.id === id);
    if (!output) return;

    this.currentOutput = output;
    if (this.dom.contentType) {
      this.dom.contentType.value = output.contentType;
      const isCustom = output.contentType === 'custom';
      if (this.dom.customPromptWrap) {
        this.dom.customPromptWrap.style.display = isCustom ? 'block' : 'none';
      }
    }

    this.renderGeneratedContent(output);
    this.renderStrategy(output.strategy);
    this.showWorkspace();
  }

  updateGenerateButton() {
    const selectedSources = this.sources.filter(s => s.selected);
    const hasApiKey = this.apiKey && this.apiKey.length > 0;
    const isDisabled = selectedSources.length === 0 || !hasApiKey || this.isGenerating;

    if (this.dom.generateBtn) {
      this.dom.generateBtn.disabled = isDisabled;

      if (!hasApiKey) {
        this.dom.generateBtn.title = 'Configure your Anthropic API key in Settings first';
      } else if (selectedSources.length === 0) {
        this.dom.generateBtn.title = 'Select at least one source to generate content';
      } else {
        this.dom.generateBtn.title = '';
      }
    }

    const hint = document.getElementById('pr-status-hint');
    const hintText = document.getElementById('pr-status-hint-text');
    if (hint && hintText) {
      if (!hasApiKey) {
        hint.style.display = 'flex';
        hintText.textContent = 'Add your Anthropic API key in Settings to enable generation.';
      } else if (selectedSources.length === 0 && this.sources.length > 0) {
        hint.style.display = 'flex';
        hintText.textContent = 'Select at least one source to generate content.';
      } else if (this.sources.length === 0) {
        hint.style.display = 'flex';
        hintText.textContent = 'Add a source, then generate content.';
      } else {
        hint.style.display = 'none';
      }
    }

    const stepKey = document.getElementById('pr-step-key');
    const stepSource = document.getElementById('pr-step-source');
    const stepSelect = document.getElementById('pr-step-select');
    if (stepKey) stepKey.classList.toggle('completed', hasApiKey);
    if (stepSource) stepSource.classList.toggle('completed', this.sources.length > 0);
    if (stepSelect) stepSelect.classList.toggle('completed', selectedSources.length > 0 && hasApiKey);
  }

  // =========================================
  // CONTENT GENERATION
  // =========================================

  async generateContent() {
    if (this.isGenerating) return;

    const selectedSources = this.sources.filter(s => s.selected);
    if (selectedSources.length === 0) {
      this.showToast('Select at least one source', 'error');
      return;
    }

    if (!this.apiKey) {
      this.showToast('Configure your Anthropic API key in Dashboard Settings', 'error');
      return;
    }

    const contentType = this.dom.contentType?.value || 'press_release';
    const typeLabel = CONTENT_TYPES.find(t => t.id === contentType)?.label || contentType;
    const customPrompt = contentType === 'custom' ? (this.dom.customPrompt?.value.trim() || '') : '';

    if (contentType === 'custom' && !customPrompt) {
      this.showToast('Enter a custom prompt', 'error');
      return;
    }

    this.isGenerating = true;
    this.updateGenerateButton();
    this.showLoading();

    const sourcesContext = selectedSources.map((s, i) => {
      return `[Source ${i + 1}] (ID: ${s.id})\nTitle: ${s.title}\nType: ${s.type}\nContent:\n${s.content}\n---`;
    }).join('\n\n');

    let userMessage = `Generate a ${typeLabel} based on the following sources.\n\n`;
    if (customPrompt) {
      userMessage += `Custom instructions: ${customPrompt}\n\n`;
    }
    userMessage += `SOURCES:\n${sourcesContext}`;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-20250514',
          max_tokens: 8192,
          system: PR_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API request failed (${response.status})`);
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '';

      let parsed;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        parsed = null;
      }

      if (!parsed) {
        parsed = {
          content: rawText,
          citations: [],
          strategy: null
        };
      }

      // Map citation sourceIds to actual source IDs
      if (parsed.citations) {
        parsed.citations = parsed.citations.map((c, i) => {
          const srcIndex = c.index || (i + 1);
          const matchedSource = selectedSources[srcIndex - 1];
          return {
            ...c,
            index: srcIndex,
            sourceId: matchedSource?.id || c.sourceId || null,
            verified: c.sourceId !== null && c.verified !== false
          };
        });
      }

      const output = {
        id: 'out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        contentType,
        title: this.extractTitle(parsed.content, typeLabel),
        content: parsed.content,
        sources: selectedSources.map(s => s.id),
        citations: parsed.citations || [],
        strategy: parsed.strategy || null,
        createdAt: new Date().toISOString(),
        status: 'draft'
      };

      this.currentOutput = output;
      this.outputs.push(output);
      this.saveOutputs();

      this.renderGeneratedContent(output);
      this.renderStrategy(output.strategy);
      this.renderHistory();
      this.showWorkspace();

    } catch (err) {
      this.showToast('Generation failed: ' + err.message, 'error');
      this.hideLoading();
    } finally {
      this.isGenerating = false;
      this.hideLoading();
      this.updateGenerateButton();
    }
  }

  extractTitle(content, fallbackType) {
    if (!content) return fallbackType;
    const firstLine = content.split('\n').find(l => l.trim().length > 0) || '';
    const clean = firstLine.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
    return clean.length > 60 ? clean.substring(0, 60) + '...' : clean || fallbackType;
  }

  showLoading() {
    if (this.dom.workspaceEmpty) this.dom.workspaceEmpty.style.display = 'none';
    if (this.dom.workspaceGenerated) this.dom.workspaceGenerated.style.display = 'none';
    if (this.dom.loadingState) this.dom.loadingState.style.display = 'flex';
  }

  hideLoading() {
    if (this.dom.loadingState) this.dom.loadingState.style.display = 'none';
  }

  showWorkspace() {
    this.hideLoading();
    if (this.dom.workspaceEmpty) this.dom.workspaceEmpty.style.display = 'none';
    if (this.dom.workspaceGenerated) this.dom.workspaceGenerated.style.display = 'block';
    if (this.dom.regenerateBtn) this.dom.regenerateBtn.style.display = 'inline-flex';
  }

  renderGeneratedContent(output) {
    if (!this.dom.generatedContent || !output) return;

    let html = this.formatContent(output.content, output.citations);
    this.dom.generatedContent.innerHTML = html;

    // Setup inline editing
    this.dom.generatedContent.querySelectorAll('.pr-paragraph').forEach(p => {
      p.addEventListener('click', () => {
        if (p.contentEditable === 'true') return;
        p.contentEditable = true;
        p.focus();
        p.classList.add('editing');
      });

      p.addEventListener('blur', () => {
        p.contentEditable = false;
        p.classList.remove('editing');
        if (this.currentOutput) {
          this.updateOutputContent();
        }
      });
    });

    // Citation hover tooltips
    this.dom.generatedContent.querySelectorAll('.pr-citation').forEach(cite => {
      cite.addEventListener('mouseenter', (e) => this.showCitationTooltip(e, cite));
      cite.addEventListener('mouseleave', () => this.hideCitationTooltip());
      cite.addEventListener('click', () => {
        const sourceId = cite.dataset.sourceId;
        if (sourceId) {
          this.highlightSource(sourceId);
        }
      });
    });

    // Needs source badge click handlers
    this.dom.generatedContent.querySelectorAll('.pr-needs-source').forEach(badge => {
      badge.addEventListener('click', (e) => this.handleNeedsSourceClick(e, badge));
    });

    this.updateVerificationBar(output);
  }

  formatContent(content, citations) {
    if (!content) return '<p class="pr-empty-content">No content generated</p>';

    // Process [Source X] citations
    let processed = this.escapeHtml(content);

    // Replace [Source X] with citation badges
    processed = processed.replace(/\[Source (\d+)\]/g, (match, num) => {
      const citation = citations?.find(c => c.index === parseInt(num));
      const sourceId = citation?.sourceId || '';
      const verified = citation?.verified !== false;
      return `<sup class="pr-citation" data-source-index="${num}" data-source-id="${sourceId}" data-verified="${verified}">${num}</sup>`;
    });

    // Replace [NEEDS SOURCE] with badges
    processed = processed.replace(/\[NEEDS SOURCE\]/g, '<span class="pr-needs-source">NEEDS SOURCE</span>');

    // Convert markdown-style headers
    processed = processed.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    processed = processed.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    processed = processed.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Convert bold
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert line breaks to paragraphs
    const paragraphs = processed.split(/\n\n+/);
    return paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h1>') || trimmed.startsWith('<h2>') || trimmed.startsWith('<h3>')) {
        return trimmed;
      }
      // Handle list items
      if (trimmed.includes('\n- ') || trimmed.startsWith('- ')) {
        const items = trimmed.split('\n').map(line => {
          const l = line.trim();
          if (l.startsWith('- ')) {
            return `<li>${l.substring(2)}</li>`;
          }
          return l ? `<p class="pr-paragraph">${l}</p>` : '';
        });
        const listItems = items.filter(i => i.startsWith('<li>'));
        const nonList = items.filter(i => !i.startsWith('<li>'));
        return nonList.join('') + (listItems.length ? `<ul>${listItems.join('')}</ul>` : '');
      }
      return `<p class="pr-paragraph">${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('\n');
  }

  showCitationTooltip(e, cite) {
    const sourceId = cite.dataset.sourceId;
    const source = this.sources.find(s => s.id === sourceId);
    const citation = this.currentOutput?.citations?.find(c => c.index === parseInt(cite.dataset.sourceIndex));

    let tooltipText = '';
    if (source) {
      tooltipText = `<strong>${this.escapeHtml(source.title)}</strong>`;
      if (citation?.excerpt) {
        tooltipText += `<br><span class="pr-tooltip-excerpt">"${this.escapeHtml(citation.excerpt)}"</span>`;
      }
    } else {
      tooltipText = 'Source not found';
    }

    this.hideCitationTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'pr-citation-tooltip';
    tooltip.innerHTML = tooltipText;
    document.body.appendChild(tooltip);

    const rect = cite.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.bottom + 6) + 'px';
    this._activeTooltip = tooltip;
  }

  hideCitationTooltip() {
    if (this._activeTooltip) {
      this._activeTooltip.remove();
      this._activeTooltip = null;
    }
  }

  highlightSource(sourceId) {
    const item = document.querySelector(`[data-source-id="${sourceId}"]`);
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.classList.add('pr-source-highlight');
      setTimeout(() => item.classList.remove('pr-source-highlight'), 2000);
    }
  }

  handleNeedsSourceClick(e, badge) {
    const existing = document.querySelector('.pr-needs-source-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'pr-needs-source-menu';
    menu.innerHTML = `
      <button class="pr-ns-action" data-ns-action="approve">Approve</button>
      <button class="pr-ns-action" data-ns-action="remove">Remove</button>
    `;
    badge.parentElement.appendChild(menu);

    menu.querySelectorAll('.pr-ns-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.nsAction === 'approve') {
          badge.className = 'pr-citation-approved';
          badge.textContent = 'Approved';
        } else if (btn.dataset.nsAction === 'remove') {
          const paragraph = badge.closest('.pr-paragraph');
          if (paragraph) paragraph.remove();
        }
        menu.remove();
        this.updateOutputContent();
        if (this.currentOutput) {
          this.updateVerificationBar(this.currentOutput);
        }
      });
    });

    const closeMenu = (e) => {
      if (!menu.contains(e.target) && e.target !== badge) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  updateOutputContent() {
    if (!this.currentOutput || !this.dom.generatedContent) return;
    const outputIndex = this.outputs.findIndex(o => o.id === this.currentOutput.id);
    if (outputIndex !== -1) {
      this.outputs[outputIndex].content = this.dom.generatedContent.innerText;
      this.saveOutputs();
    }
  }

  updateVerificationBar(output) {
    if (!this.dom.verificationBar || !output) return;

    const total = (output.citations || []).length;
    const needsSourceCount = (this.dom.generatedContent?.querySelectorAll('.pr-needs-source') || []).length;
    const verified = total - (output.citations || []).filter(c => !c.verified).length;

    if (total === 0 && needsSourceCount === 0) {
      this.dom.verificationBar.style.display = 'none';
      return;
    }

    this.dom.verificationBar.style.display = 'flex';
    const sourced = total > 0 ? verified : 0;
    const totalClaims = total + needsSourceCount;

    if (this.dom.verificationText) {
      this.dom.verificationText.textContent = `${sourced} of ${totalClaims} claims sourced`;
    }
    if (this.dom.verificationProgress) {
      const pct = totalClaims > 0 ? (sourced / totalClaims) * 100 : 0;
      this.dom.verificationProgress.style.width = pct + '%';
    }
  }

  // =========================================
  // STRATEGY PANEL
  // =========================================

  renderStrategy(strategy) {
    if (!this.dom.strategyPanel) return;

    if (!strategy) {
      this.dom.strategyPanel.innerHTML = '';
      if (this.dom.strategyEmpty) this.dom.strategyEmpty.style.display = 'block';
      return;
    }

    if (this.dom.strategyEmpty) this.dom.strategyEmpty.style.display = 'none';

    let html = '';

    // Distribution Strategy
    if (strategy.outlets && strategy.outlets.length > 0) {
      html += `<div class="pr-strategy-section">
        <h4 class="pr-strategy-heading">Distribution Strategy</h4>
        <div class="pr-strategy-outlets">
          ${strategy.outlets.map(o => `
            <div class="pr-outlet-item">
              <div class="pr-outlet-header">
                <span class="pr-outlet-name">${this.escapeHtml(o.name)}</span>
                <span class="pr-outlet-tier">Tier ${o.tier || '?'}</span>
              </div>
              <p class="pr-outlet-rationale">${this.escapeHtml(o.rationale || '')}</p>
              ${o.angle ? `<p class="pr-outlet-angle">Angle: ${this.escapeHtml(o.angle)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Timing & Hooks
    if (strategy.timing || (strategy.hooks && strategy.hooks.length > 0)) {
      html += `<div class="pr-strategy-section">
        <h4 class="pr-strategy-heading">Timing & Hooks</h4>
        ${strategy.timing ? `<p class="pr-strategy-text">${this.escapeHtml(strategy.timing)}</p>` : ''}
        ${strategy.hooks && strategy.hooks.length > 0 ? `
          <ul class="pr-strategy-list">
            ${strategy.hooks.map(h => `<li>${this.escapeHtml(h)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>`;
    }

    // Journalist Targets
    if (strategy.journalistBeats && strategy.journalistBeats.length > 0) {
      html += `<div class="pr-strategy-section">
        <h4 class="pr-strategy-heading">Journalist Targets</h4>
        <p class="pr-strategy-subtext">Look for reporters covering:</p>
        <ul class="pr-strategy-list">
          ${strategy.journalistBeats.map(b => `<li>${this.escapeHtml(b)}</li>`).join('')}
        </ul>
      </div>`;
    }

    // Amplification Playbook
    if (strategy.amplification) {
      const amp = strategy.amplification;
      html += `<div class="pr-strategy-section">
        <h4 class="pr-strategy-heading">Amplification Playbook</h4>`;

      if (amp.social && amp.social.length > 0) {
        html += `<h5 class="pr-strategy-subheading">Social Sequencing</h5>
          <ol class="pr-strategy-list pr-strategy-ordered">
            ${amp.social.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
          </ol>`;
      }
      if (amp.internal && amp.internal.length > 0) {
        html += `<h5 class="pr-strategy-subheading">Internal Comms</h5>
          <ul class="pr-strategy-list">
            ${amp.internal.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
          </ul>`;
      }
      if (amp.community && amp.community.length > 0) {
        html += `<h5 class="pr-strategy-subheading">Community Seeding</h5>
          <ul class="pr-strategy-list">
            ${amp.community.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
          </ul>`;
      }
      html += `</div>`;
    }

    this.dom.strategyPanel.innerHTML = html;
  }

  // =========================================
  // COPY & EXPORT
  // =========================================

  copyContent() {
    if (!this.dom.generatedContent) return;
    const text = this.getCleanText();
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copied to clipboard');
    }).catch(() => {
      this.showToast('Failed to copy', 'error');
    });
  }

  exportAs(format) {
    this.dom.exportMenu?.classList.remove('active');
    const text = this.getCleanText();

    if (format === 'text') {
      this.downloadFile(text, 'pr-content.txt', 'text/plain');
    } else if (format === 'html') {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PR Content</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;line-height:1.6;color:#333}h1,h2,h3{color:#111}ul,ol{padding-left:20px}</style></head><body>${this.dom.generatedContent?.innerHTML || ''}</body></html>`;
      this.downloadFile(html, 'pr-content.html', 'text/html');
    }
  }

  getCleanText() {
    if (!this.dom.generatedContent) return '';
    const clone = this.dom.generatedContent.cloneNode(true);
    clone.querySelectorAll('.pr-citation, .pr-needs-source, .pr-citation-approved').forEach(el => el.remove());
    return clone.innerText.trim();
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =========================================
  // FILE UPLOAD
  // =========================================

  setupFileUpload() {
    const dropzone = document.getElementById('pr-file-dropzone');
    const fileInput = document.getElementById('pr-source-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) this.processFile(file);
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) this.processFile(file);
      });
    }
  }

  async processFile(file) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showToast('File too large. Maximum size is 10MB.', 'error');
      return;
    }

    const preview = document.getElementById('pr-file-preview');
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.csv')) {
      const text = await file.text();
      this._pendingFileContent = text;
      this._pendingFileName = file.name;
      if (preview) {
        preview.style.display = 'block';
        preview.textContent = text.substring(0, 500) + (text.length > 500 ? '...' : '');
      }
    } else if (fileName.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        this._pendingFileContent = text.trim();
        this._pendingFileName = file.name;
        if (preview) {
          preview.style.display = 'block';
          preview.textContent = text.substring(0, 500) + (text.length > 500 ? '...' : '');
        }
      } catch (err) {
        this.showToast('Failed to read PDF: ' + err.message, 'error');
      }
    } else {
      this.showToast('Unsupported file type. Use .txt, .pdf, .md, or .csv files.', 'error');
    }
  }

  // =========================================
  // AUDIO TRANSCRIPTION
  // =========================================

  setupAudio() {
    const recordBtn = document.getElementById('pr-audio-record');
    const stopBtn = document.getElementById('pr-audio-stop');
    const uploadBtn = document.getElementById('pr-audio-upload-btn');
    const audioInput = document.getElementById('pr-audio-file-input');

    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.startRecording());
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopRecording());
    }
    if (uploadBtn && audioInput) {
      uploadBtn.addEventListener('click', () => audioInput.click());
      audioInput.addEventListener('change', () => {
        const file = audioInput.files[0];
        if (file) this.transcribeAudio(file);
      });
    }
  }

  async startRecording() {
    if (!this.openaiApiKey) {
      this.showToast('Configure your OpenAI API key in Dashboard Settings for audio transcription', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._mediaRecorder = new MediaRecorder(stream);
      this._audioChunks = [];

      this._mediaRecorder.ondataavailable = (e) => {
        this._audioChunks.push(e.data);
      };

      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._audioChunks, { type: 'audio/webm' });
        this.transcribeAudio(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      this._mediaRecorder.start();

      const recordBtn = document.getElementById('pr-audio-record');
      const stopBtn = document.getElementById('pr-audio-stop');
      const indicator = document.getElementById('pr-audio-indicator');
      if (recordBtn) recordBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      if (indicator) indicator.style.display = 'flex';
    } catch (err) {
      this.showToast('Microphone access denied. Please allow microphone permissions.', 'error');
    }
  }

  stopRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
      this._mediaRecorder.stop();
    }
    const recordBtn = document.getElementById('pr-audio-record');
    const stopBtn = document.getElementById('pr-audio-stop');
    const indicator = document.getElementById('pr-audio-indicator');
    if (recordBtn) recordBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (indicator) indicator.style.display = 'none';
  }

  async transcribeAudio(fileOrBlob) {
    if (!this.openaiApiKey) {
      this.showToast('Configure your OpenAI API key in Dashboard Settings', 'error');
      return;
    }

    const audioPreview = document.getElementById('pr-audio-preview');
    const audioStatus = document.getElementById('pr-audio-status');
    if (audioPreview) audioPreview.style.display = 'block';
    if (audioStatus) audioStatus.textContent = 'Transcribing...';

    try {
      const formData = new FormData();
      const file = fileOrBlob instanceof Blob && !(fileOrBlob instanceof File)
        ? new File([fileOrBlob], 'recording.webm', { type: 'audio/webm' })
        : fileOrBlob;
      formData.append('file', file);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();
      this._pendingTranscription = result.text;
      if (audioStatus) audioStatus.textContent = 'Transcription complete';

      const transcriptPreview = document.getElementById('pr-audio-transcript');
      if (transcriptPreview) {
        transcriptPreview.style.display = 'block';
        transcriptPreview.textContent = result.text.substring(0, 500) + (result.text.length > 500 ? '...' : '');
      }
    } catch (err) {
      if (audioStatus) audioStatus.textContent = 'Transcription failed';
      this.showToast('Audio transcription failed: ' + err.message, 'error');
    }
  }

  // =========================================
  // UTILITIES
  // =========================================

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  showToast(message, type = 'success') {
    const container = this.dom.toastContainer;
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-20px) scale(0.95)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

export { PRAgent, CONTENT_TYPES };
