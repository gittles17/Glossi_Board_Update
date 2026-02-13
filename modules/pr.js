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
    this.folders = [];
    this.expandedFolders = {};
    this.isDraggingSource = false;
  }

  async apiCall(url, options = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          if (response.status === 429 && i < retries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            continue;
          }
          
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Request failed (${response.status})`);
        }
        
        return await response.json();
      } catch (error) {
        if (i === retries) {
          throw error;
        }
        
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } else {
          throw error;
        }
      }
    }
  }

  async init() {
    await this.loadData();
    this.setupDOM();
    this.setupEventListeners();
    this.renderSources();
    this.renderHistory();
    this.updateGenerateButton();
    
    // Initialize wizard
    this.wizard = new WizardManager(this);
    await this.wizard.init();
    
    // Initialize news monitor FIRST (faster, more relevant content)
    this.newsMonitor = new NewsMonitor(this);
    await this.newsMonitor.init();
    
    // Initialize media manager
    this.mediaManager = new MediaManager(this);
    await this.mediaManager.init();
    
    // Initialize calendar manager
    this.calendarManager = new CalendarManager(this);
    await this.calendarManager.init();
    
    // Add "Edit Foundation" button to sources header
    this.addEditFoundationButton();
    
    // Setup command center
    this.setupCommandCenter();
    
    // Setup API key monitoring
    this.setupApiKeyMonitoring();
  }
  
  addEditFoundationButton() {
    const sourcesHeader = document.querySelector('.pr-sources-header');
    if (sourcesHeader && !document.getElementById('pr-edit-foundation-btn')) {
      const editBtn = document.createElement('button');
      editBtn.id = 'pr-edit-foundation-btn';
      editBtn.className = 'pr-create-folder-btn';
      editBtn.title = 'Edit Foundation';
      editBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener('click', () => this.wizard.open(true));
      
      // Insert before the create folder button
      const createFolderBtn = document.getElementById('pr-create-folder-btn');
      if (createFolderBtn) {
        sourcesHeader.insertBefore(editBtn, createFolderBtn);
      } else {
        sourcesHeader.appendChild(editBtn);
      }
    }
  }

  async setupCommandCenter() {
    // Update stats
    await this.updateCommandCenterStats();
    
    // Setup card click handlers
    document.querySelectorAll('.pr-command-item').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        this.handleCommandCardClick(action);
      });
    });
    
    // Setup article feed
    await this.setupArticleFeed();
  }

  async updateCommandCenterStats() {
    // Update library count - show saved content
    const libraryStat = document.getElementById('pr-stat-library');
    if (libraryStat) {
      const count = this.outputs.length;
      if (count > 0) {
        libraryStat.textContent = `${count} item${count !== 1 ? 's' : ''} saved`;
      } else {
        libraryStat.textContent = 'No content yet';
      }
    }

    // Update journalists count
    try {
      const journalistsStat = document.getElementById('pr-stat-journalists');
      if (journalistsStat && this.mediaManager) {
        const count = this.mediaManager.journalists.length;
        journalistsStat.textContent = `${count} journalist${count !== 1 ? 's' : ''} saved`;
      }
    } catch (e) {}

    // Update calendar count
    try {
      const calendarStat = document.getElementById('pr-stat-calendar');
      if (calendarStat && this.calendarManager) {
        const count = this.calendarManager.calendarItems.length;
        calendarStat.textContent = `${count} item${count !== 1 ? 's' : ''} scheduled`;
      }
    } catch (e) {}

    // Update news hooks
    try {
      const newsStat = document.getElementById('pr-stat-news');
      if (newsStat && this.newsMonitor) {
        const count = this.newsMonitor.newsHooks.length;
        if (count > 0) {
          newsStat.textContent = `${count} hook${count !== 1 ? 's' : ''} found`;
        } else {
          newsStat.textContent = 'Check for updates';
        }
      }
    } catch (e) {}
  }

  handleCommandCardClick(action) {
    // On mobile, switch to the appropriate tab
    const isMobile = window.innerWidth < 768;
    
    switch (action) {
      case 'generate':
        // Switch to Library tab
        if (isMobile) {
          const mobileSourcesTab = document.querySelector('.pr-mobile-tab[data-tab="sources"]');
          if (mobileSourcesTab) mobileSourcesTab.click();
        }
        // Switch to Library panel tab
        const libraryTab = document.querySelector('.pr-panel-tab[data-panel-tab="library"]');
        if (libraryTab) libraryTab.click();
        break;
        
      case 'media':
        // Switch to Media tab
        if (isMobile) {
          const mobileSourcesTab = document.querySelector('.pr-mobile-tab[data-tab="sources"]');
          if (mobileSourcesTab) mobileSourcesTab.click();
        }
        const mediaTab = document.querySelector('.pr-panel-tab[data-panel-tab="media"]');
        if (mediaTab) mediaTab.click();
        break;
        
      case 'calendar':
        // Switch to Media tab and scroll to calendar
        if (isMobile) {
          const mobileSourcesTab = document.querySelector('.pr-mobile-tab[data-tab="sources"]');
          if (mobileSourcesTab) mobileSourcesTab.click();
        }
        const calendarTab = document.querySelector('.pr-panel-tab[data-panel-tab="media"]');
        if (calendarTab) calendarTab.click();
        setTimeout(() => {
          const calendarSection = document.querySelector('.pr-calendar-header');
          if (calendarSection) {
            calendarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 200);
        break;
        
      case 'news':
        // Switch to Research tab (news hooks are there)
        if (isMobile) {
          const mobileSourcesTab = document.querySelector('.pr-mobile-tab[data-tab="sources"]');
          if (mobileSourcesTab) mobileSourcesTab.click();
        }
        const researchTab = document.querySelector('.pr-panel-tab[data-panel-tab="research"]');
        if (researchTab) researchTab.click();
        break;
    }
  }


  showSaveConfirmation() {
    // Create save indicator
    const indicator = document.createElement('div');
    indicator.className = 'pr-save-indicator';
    indicator.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Saved to Library</span>
    `;
    document.body.appendChild(indicator);

    // Animate in
    setTimeout(() => indicator.classList.add('visible'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      indicator.classList.remove('visible');
      setTimeout(() => indicator.remove(), 300);
    }, 3000);
  }

  async setupArticleFeed() {
    const articlesList = document.getElementById('pr-articles-list');
    if (!articlesList) return;

    // Check if we need to fetch fresh articles
    const lastFetch = localStorage.getItem('pr_articles_last_fetch');
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (!lastFetch || (now - parseInt(lastFetch)) > oneDayMs) {
      // Fetch fresh articles
      await this.fetchArticles();
    } else {
      // Display cached articles
      await this.displayCachedArticles();
    }
  }

  async fetchArticles() {
    const articlesList = document.getElementById('pr-articles-list');
    if (!articlesList) return;

    articlesList.innerHTML = '<div class="pr-articles-loading">Fetching articles...</div>';

    try {
      const response = await this.apiCall('/api/pr/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.success && response.articles) {
        // Update last fetch timestamp
        localStorage.setItem('pr_articles_last_fetch', Date.now().toString());
        this.renderArticles(response.articles);
      } else {
        articlesList.innerHTML = '<div class="pr-articles-loading">No articles found</div>';
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      articlesList.innerHTML = '<div class="pr-articles-loading">Error loading articles</div>';
    }
  }

  async displayCachedArticles() {
    const articlesList = document.getElementById('pr-articles-list');
    if (!articlesList) return;

    try {
      const response = await this.apiCall('/api/pr/articles');
      
      if (response.success && response.articles && response.articles.length > 0) {
        this.renderArticles(response.articles);
      } else {
        articlesList.innerHTML = '<div class="pr-articles-loading">No articles yet</div>';
      }
    } catch (error) {
      console.error('Error loading cached articles:', error);
      articlesList.innerHTML = '<div class="pr-articles-loading">Error loading articles</div>';
    }
  }

  renderArticles(articles) {
    const articlesList = document.getElementById('pr-articles-list');
    if (!articlesList) return;

    if (!articles || articles.length === 0) {
      articlesList.innerHTML = '<div class="pr-articles-loading">No articles found</div>';
      return;
    }

    articlesList.innerHTML = articles.map(article => `
      <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="pr-article-item">
        <span class="pr-article-outlet">${article.outlet}</span>
        <span class="pr-article-title">${article.title}</span>
      </a>
    `).join('');
  }

  setupApiKeyMonitoring() {
    // Check for API key updates every 3 seconds
    setInterval(() => {
      const previousKey = this.apiKey;
      
      try {
        const glossiSettings = localStorage.getItem('glossi_settings');
        if (glossiSettings) {
          const gs = JSON.parse(glossiSettings);
          this.apiKey = gs.apiKey || null;
          this.openaiApiKey = gs.openaiApiKey || null;
          
          // If key status changed, update UI
          if ((previousKey === null && this.apiKey) || (previousKey && !this.apiKey)) {
            this.updateGenerateButton();
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }, 3000);
  }

  async loadData() {
    // Check if migration is needed (localStorage has data but API doesn't)
    await this.checkAndMigrateData();
    
    // Load sources from API
    try {
      const response = await fetch('/api/pr/sources');
      const data = await response.json();
      if (data.success) {
        this.sources = data.sources.map(s => ({
          ...s,
          selected: s.selected !== false
        }));
      } else {
        this.sources = [];
      }
    } catch (e) {
      console.error('Error loading sources from API:', e);
      // Fallback to localStorage
      try {
        const sourcesRaw = localStorage.getItem('pr_sources');
        const parsed = sourcesRaw ? JSON.parse(sourcesRaw) : [];
        this.sources = Array.isArray(parsed) ? parsed.map(s => ({
          ...s,
          selected: s.selected !== false
        })) : [];
      } catch (e2) {
        this.sources = [];
      }
    }
    
    // Load outputs from API
    try {
      const response = await fetch('/api/pr/outputs');
      const data = await response.json();
      if (data.success) {
        this.outputs = data.outputs;
      } else {
        this.outputs = [];
      }
    } catch (e) {
      console.error('Error loading outputs from API:', e);
      // Fallback to localStorage
      try {
        const outputsRaw = localStorage.getItem('pr_outputs');
        this.outputs = outputsRaw ? JSON.parse(outputsRaw) : [];
      } catch (e2) {
        this.outputs = [];
      }
    }
    
    // Load PR settings from API first, fallback to localStorage
    try {
      const response = await fetch('/api/pr/settings');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.settings) {
          this.settings = result.settings;
          this.folders = result.settings.folders || [];
          this.expandedFolders = result.settings.expandedFolders || {};
        } else {
          // Fallback to localStorage if no server settings
          const settingsRaw = localStorage.getItem('pr_settings');
          const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
          this.settings = settings;
          this.folders = settings.folders || [];
          this.expandedFolders = settings.expandedFolders || {};
          // Migrate to server if we have local data
          if (settingsRaw) {
            this.saveSettings();
          }
        }
      } else {
        throw new Error('API not available');
      }
    } catch (e) {
      // Fallback to localStorage on error
      try {
        const settingsRaw = localStorage.getItem('pr_settings');
        const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
        this.settings = settings;
        this.folders = settings.folders || [];
        this.expandedFolders = settings.expandedFolders || {};
      } catch (e2) {
        this.settings = {};
        this.folders = [];
        this.expandedFolders = {};
      }
    }
    
    // Check server for environment-configured API keys first
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const serverSettings = await response.json();
        // If server has API keys configured via environment, we're done
        if (serverSettings.hasAnthropicKey) {
          this.apiKey = 'env'; // Placeholder to indicate env key exists
        }
        if (serverSettings.hasOpenAIKey) {
          this.openaiApiKey = 'env'; // Placeholder to indicate env key exists
        }
      }
    } catch (e) {
      console.warn('Could not check server for API keys');
    }
    
    // Fall back to localStorage if no environment keys
    if (!this.apiKey || !this.openaiApiKey) {
      try {
        const glossiSettings = localStorage.getItem('glossi_settings');
        if (glossiSettings) {
          const gs = JSON.parse(glossiSettings);
          if (!this.apiKey) this.apiKey = gs.apiKey || null;
          if (!this.openaiApiKey) this.openaiApiKey = gs.openaiApiKey || null;
        }
      } catch (e) {
        console.error('Error loading API keys from localStorage:', e);
      }
    }
    
    this.isGenerating = false;
  }

  async checkAndMigrateData() {
    // Check if localStorage has data
    const localSources = localStorage.getItem('pr_sources');
    const localOutputs = localStorage.getItem('pr_outputs');
    
    if (!localSources && !localOutputs) {
      // No local data to migrate
      return;
    }

    try {
      // Check if API already has data
      const sourcesResponse = await fetch('/api/pr/sources');
      const sourcesData = await sourcesResponse.json();
      
      const outputsResponse = await fetch('/api/pr/outputs');
      const outputsData = await outputsResponse.json();
      
      // If API has data, skip migration (already done)
      if ((sourcesData.sources && sourcesData.sources.length > 0) || 
          (outputsData.outputs && outputsData.outputs.length > 0)) {
        return;
      }
      
      // Show migration modal
      const migrationNeeded = (localSources && JSON.parse(localSources).length > 0) ||
                             (localOutputs && JSON.parse(localOutputs).length > 0);
      
      if (!migrationNeeded) return;
      
      // Create migration modal
      const modal = document.createElement('div');
      modal.className = 'pr-migration-modal';
      modal.innerHTML = `
        <div class="pr-migration-content">
          <div class="pr-loading-spinner"></div>
          <h3>Migrating your PR data...</h3>
          <p class="pr-migration-progress" id="pr-migration-progress">Preparing migration...</p>
          <div class="pr-migration-bar">
            <div class="pr-migration-bar-fill" id="pr-migration-bar-fill"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      const progressText = document.getElementById('pr-migration-progress');
      const progressBar = document.getElementById('pr-migration-bar-fill');
      
      let migratedCount = 0;
      let totalCount = 0;
      
      // Migrate sources
      if (localSources) {
        const sources = JSON.parse(localSources);
        totalCount += sources.length;
        
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          await fetch('/api/pr/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(source)
          });
          migratedCount++;
          if (progressText) progressText.textContent = `Migrated ${migratedCount} of ${totalCount} items...`;
          if (progressBar) progressBar.style.width = `${(migratedCount / totalCount) * 100}%`;
        }
      }
      
      // Migrate outputs
      if (localOutputs) {
        const outputs = JSON.parse(localOutputs);
        totalCount += outputs.length;
        
        for (let i = 0; i < outputs.length; i++) {
          const output = outputs[i];
          await fetch('/api/pr/outputs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(output)
          });
          migratedCount++;
          if (progressText) progressText.textContent = `Migrated ${migratedCount} of ${totalCount} items...`;
          if (progressBar) progressBar.style.width = `${(migratedCount / totalCount) * 100}%`;
        }
      }
      
      if (progressText) progressText.textContent = 'Migration complete!';
      if (progressBar) progressBar.style.width = '100%';
      
      setTimeout(() => {
        modal.remove();
      }, 1500);
      
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  async saveSources() {
    // Save folder settings to API and localStorage
    try {
      this.settings.folders = this.folders;
      this.settings.expandedFolders = this.expandedFolders;
      
      // Save to API first
      try {
        await fetch('/api/pr/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: this.settings })
        });
      } catch (apiError) {
        console.warn('Failed to save settings to server, using localStorage fallback');
      }
      
      // Also save to localStorage as fallback
      localStorage.setItem('pr_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    
    // Sources are saved individually via API calls when modified
  }

  async saveOutputs() {
    // Outputs are saved individually via API calls when created
  }

  async saveSettings() {
    try {
      // Save to API first
      try {
        await fetch('/api/pr/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: this.settings })
        });
      } catch (apiError) {
        console.warn('Failed to save settings to server, using localStorage fallback');
      }
      
      // Also save to localStorage as fallback
      localStorage.setItem('pr_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
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

    // Create folder button
    const createFolderBtn = document.getElementById('pr-create-folder-btn');
    if (createFolderBtn) {
      createFolderBtn.addEventListener('click', () => this.createFolder());
    }

    // Setup drag-drop for external files
    this.setupExternalFileDrop();

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

    // Content Library is now always visible (no toggle)

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

  async saveSource() {
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
        return;
      }
    } else if (type === 'url') {
      const urlInput = document.getElementById('pr-source-url');
      url = urlInput?.value.trim() || '';
      if (!url) {
        return;
      }
      if (!this.isValidUrl(url)) {
        return;
      }
      const urlTitle = document.getElementById('pr-source-title-url')?.value.trim() || '';
      this.fetchUrlContent(url, urlTitle);
      return;
    } else if (type === 'file') {
      content = this._pendingFileContent || '';
      fileName = this._pendingFileName || '';
      if (!content) {
        return;
      }
    } else if (type === 'audio') {
      content = this._pendingTranscription || '';
      if (!content) {
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
    
    // Save to API
    try {
      await fetch('/api/pr/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      });
    } catch (error) {
      console.error('Error saving source:', error);
    }
    
    this.saveSources();
    this.renderSources();
    this.updateGenerateButton();
    this.closeSourceModal();

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
          console.error('Could not fetch URL content');
          return;
        }
      }
      if (!content || content.length < 10) {
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
      
      // Save to API
      try {
        await fetch('/api/pr/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(source)
        });
      } catch (error) {
        console.error('Error saving source:', error);
      }
      
      this.saveSources();
      this.renderSources();
      this.updateGenerateButton();
      this.closeSourceModal();
    } catch (err) {
      console.error('Failed to fetch URL:', err);
    }
  }

  async deleteSource(id) {
    // Optimistic delete - remove immediately, no confirmation
    this.sources = this.sources.filter(s => s.id !== id);
    this.renderSources();
    this.updateGenerateButton();
    
    // Sync delete with API in background
    fetch(`/api/pr/sources/${id}`, {
      method: 'DELETE'
    }).catch(error => {
      console.error('Error deleting source:', error);
    });
    
    this.saveSources();
  }

  async toggleSourceSelection(id) {
    const source = this.sources.find(s => s.id === id);
    if (source) {
      source.selected = !source.selected;
      
      // Update in API
      try {
        await fetch('/api/pr/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(source)
        });
      } catch (error) {
        console.error('Error updating source:', error);
      }
      
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
        
        // Update in API
        fetch('/api/pr/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(source)
        }).catch(error => console.error('Error updating source:', error));
        
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

  // =========================================
  // FOLDER MANAGEMENT
  // =========================================

  createFolder() {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;
    const folderName = name.trim();
    if (this.folders.includes(folderName)) {
      return;
    }
    this.folders.push(folderName);
    this.expandedFolders[folderName] = true;
    this.saveSources();
    this.renderSources();
  }

  async deleteFolder(name) {
    // Optimistic delete - remove immediately, no confirmation
    this.folders = this.folders.filter(f => f !== name);
    delete this.expandedFolders[name];
    this.sources.forEach(s => {
      if (s.folder === name) s.folder = null;
    });
    this.renderSources();
    this.saveSources();
  }

  renameFolder(oldName) {
    const newName = prompt('Enter new folder name:', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const folderName = newName.trim();
    if (this.folders.includes(folderName)) {
      return;
    }
    const index = this.folders.indexOf(oldName);
    if (index !== -1) this.folders[index] = folderName;
    if (this.expandedFolders[oldName]) {
      this.expandedFolders[folderName] = this.expandedFolders[oldName];
      delete this.expandedFolders[oldName];
    }
    this.sources.forEach(s => {
      if (s.folder === oldName) s.folder = folderName;
    });
    this.saveSources();
    this.renderSources();
  }

  toggleFolder(name) {
    this.expandedFolders[name] = !this.expandedFolders[name];
    this.saveSources();
    const folder = document.querySelector(`[data-folder="${this.escapeHtml(name)}"]`);
    if (folder) folder.classList.toggle('expanded', this.expandedFolders[name]);
  }

  async moveSourceToFolder(sourceId, folderName) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return;
    source.folder = folderName;
    
    // Update in API
    try {
      await fetch('/api/pr/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      });
    } catch (error) {
      console.error('Error updating source:', error);
    }
    
    this.saveSources();
    this.renderSources();
    return;
  }

  showFolderContextMenu(e, folderName) {
    const menu = document.createElement('div');
    menu.className = 'pr-context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.innerHTML = `
      <button class="pr-context-menu-item" data-action="rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Rename
      </button>
      <button class="pr-context-menu-item" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Delete
      </button>
    `;
    document.body.appendChild(menu);

    const removeMenu = () => {
      menu.remove();
      document.removeEventListener('click', removeMenu);
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 100);

    menu.querySelector('[data-action="rename"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.renameFolder(folderName);
      removeMenu();
    });
    menu.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.deleteFolder(folderName);
      removeMenu();
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

    const renderSourceItem = (source) => {
      const date = new Date(source.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const preview = (source.content || '').substring(0, 100);
      const loadingClass = source.loading ? 'loading' : '';
      const loadingIndicator = source.loading ? `
        <div class="pr-source-loading-overlay">
          <svg class="spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
            <path d="M12 2 A10 10 0 0 1 22 12" opacity="0.75"></path>
          </svg>
          <span>Saving...</span>
        </div>
      ` : '';
      return `
        <div class="pr-source-item ${source.selected ? 'selected' : ''} ${loadingClass}" data-source-id="${source.id}" draggable="true">
          ${loadingIndicator}
          <label class="pr-source-checkbox">
            <input type="checkbox" ${source.selected ? 'checked' : ''} data-action="toggle" data-id="${source.id}" ${source.loading ? 'disabled' : ''}>
          </label>
          <div class="pr-source-info" data-action="open-wizard" data-id="${source.id}">
            <div class="pr-source-header">
              <span class="pr-source-type-icon">${typeIcons[source.type] || typeIcons.text}</span>
              <span class="pr-source-title">${this.escapeHtml(source.title)}</span>
            </div>
            <div class="pr-source-meta">
              <span class="pr-source-date">${date}</span>
              ${preview ? `<span class="pr-source-preview">${this.escapeHtml(preview)}</span>` : ''}
            </div>
          </div>
          <button class="pr-source-delete" data-action="delete" data-id="${source.id}" title="Delete source" ${source.loading ? 'disabled' : ''}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>`;
    };

    const folders = {};
    const ungrouped = [];
    this.sources.forEach(source => {
      if (source.folder) {
        if (!folders[source.folder]) folders[source.folder] = [];
        folders[source.folder].push(source);
      } else {
        ungrouped.push(source);
      }
    });

    const allFolderNames = new Set([...Object.keys(folders), ...this.folders]);
    let html = '';
    Array.from(allFolderNames).sort().forEach(folderName => {
      const folderSources = folders[folderName] || [];
      const isExpanded = this.expandedFolders[folderName];
      html += `
        <div class="pr-folder ${isExpanded ? 'expanded' : ''}" data-folder="${this.escapeHtml(folderName)}">
          <div class="pr-folder-header">
            <svg class="pr-folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <svg class="pr-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="pr-folder-name">${this.escapeHtml(folderName)}</span>
            <span class="pr-folder-count">${folderSources.length}</span>
          </div>
          <div class="pr-folder-contents">
            ${folderSources.map(s => renderSourceItem(s)).join('')}
          </div>
        </div>
      `;
    });
    html += ungrouped.map(s => renderSourceItem(s)).join('');

    const dropIndicator = '<div class="pr-drop-indicator" id="pr-drop-indicator"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><span>Drop files here</span></div>';
    this.dom.sourcesList.innerHTML = html + dropIndicator;

    this.dom.sourcesList.querySelectorAll('.pr-folder-header').forEach(header => {
      header.addEventListener('click', () => {
        const folderName = header.closest('.pr-folder').dataset.folder;
        this.toggleFolder(folderName);
      });
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const folderName = header.closest('.pr-folder').dataset.folder;
        this.showFolderContextMenu(e, folderName);
      });
    });

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
      } else if (action === 'open-wizard') {
        el.addEventListener('click', () => {
          if (this.wizard) {
            this.wizard.open();
          } else {
            console.error('Wizard not initialized');
          }
        });
      }
    });

    this.setupSourceDrag();
    this.setupFolderDrop();
    
    // Update command center stats
    this.updateCommandCenterStats();
  }

  setupSourceDrag() {
    this.dom.sourcesList.querySelectorAll('[draggable]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        this.isDraggingSource = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.sourceId);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        this.isDraggingSource = false;
        item.classList.remove('dragging');
      });
    });
  }

  setupFolderDrop() {
    this.dom.sourcesList.querySelectorAll('.pr-folder').forEach(folder => {
      const header = folder.querySelector('.pr-folder-header');
      header.addEventListener('dragover', (e) => {
        if (!this.isDraggingSource) return;
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

    this.dom.sourcesList.addEventListener('dragover', (e) => {
      if (!this.isDraggingSource) return;
      if (!e.target.closest('.pr-folder-header')) {
        e.preventDefault();
      }
    });
    this.dom.sourcesList.addEventListener('drop', (e) => {
      if (!this.isDraggingSource) return;
      if (!e.target.closest('.pr-folder-header')) {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        const source = this.sources.find(s => s.id === sourceId);
        if (source && source.folder) {
          this.moveSourceToFolder(sourceId, null);
        }
      }
    });
  }

  setupExternalFileDrop() {
    const dropZone = this.dom.sourcesList;
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      if (!this.isDraggingSource) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
        const indicator = document.getElementById('pr-drop-indicator');
        if (indicator) indicator.style.display = 'flex';
      }
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
        const indicator = document.getElementById('pr-drop-indicator');
        if (indicator) indicator.style.display = 'none';
      }
    });

    dropZone.addEventListener('drop', async (e) => {
      if (this.isDraggingSource) return;
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      const indicator = document.getElementById('pr-drop-indicator');
      if (indicator) indicator.style.display = 'none';

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        for (const file of files) {
          await this.handleDroppedFile(file);
        }
      }
    });
  }

  async handleDroppedFile(file) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.prAgent.showToast('File too large (max 10MB)', 'error');
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    let content = '';
    let type = 'file';

    if (['txt', 'md', 'csv'].includes(ext)) {
      content = await file.text();
      type = 'text';
    } else if (ext === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const textParts = [];
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          textParts.push(textContent.items.map(item => item.str).join(' '));
        }
        content = textParts.join('\n\n');
        type = 'file';
      } catch (err) {
        console.error('Failed to parse PDF:', err);
        return;
      }
    } else if (['mp3', 'wav', 'm4a', 'webm'].includes(ext)) {
      if (!this.openaiApiKey) {
        this.showToast('OpenAI API key required for audio transcription', 'error');
        return;
      }
      try {
        const transcription = await this.transcribeAudio(file);
        content = transcription;
        type = 'audio';
      } catch (err) {
        console.error('Audio transcription failed:', err);
        return;
      }
    } else {
      this.showToast('Unsupported file type', 'error');
      return;
    }

    if (!content || content.trim().length === 0) {
      this.showToast('No content extracted from file', 'error');
      return;
    }

    const source = {
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: file.name,
      type,
      content: content.substring(0, 50000),
      fileName: file.name,
      createdAt: new Date().toISOString(),
      selected: true,
      folder: null
    };

    this.sources.push(source);
    
    // Save to API
    try {
      await fetch('/api/pr/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      });
    } catch (error) {
      console.error('Error saving source:', error);
    }
    
    this.saveSources();
    this.renderSources();
    this.updateGenerateButton();
  }

  renderHistory() {
    if (!this.dom.historyList) return;

    // Update count badge
    const countBadge = document.getElementById('pr-history-count');
    if (countBadge) {
      countBadge.textContent = this.outputs.length;
      countBadge.style.display = this.outputs.length > 0 ? 'inline-flex' : 'none';
    }

    if (this.outputs.length === 0) {
      this.dom.historyList.innerHTML = '';
      if (this.dom.historyEmpty) this.dom.historyEmpty.style.display = 'block';
      return;
    }

    if (this.dom.historyEmpty) this.dom.historyEmpty.style.display = 'none';

    const sorted = [...this.outputs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    this.dom.historyList.innerHTML = sorted.map(output => {
      const date = new Date(output.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const time = new Date(output.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const typeLabel = CONTENT_TYPES.find(t => t.id === output.contentType)?.label || output.contentType;
      return `
        <div class="pr-history-item" data-output-id="${output.id}">
          <div class="pr-history-info">
            <span class="pr-history-title">${this.escapeHtml(output.title || 'Untitled')}</span>
            <span class="pr-history-meta">
              <span class="pr-history-type">${typeLabel}</span>
              <span class="pr-history-date">${date} at ${time}</span>
            </span>
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
        // Optimistic delete - remove immediately, no confirmation
        const outputId = btn.dataset.historyDelete;
        this.outputs = this.outputs.filter(o => o.id !== outputId);
        this.renderHistory();
        
        // Sync delete with API in background
        fetch(`/api/pr/outputs/${outputId}`, {
          method: 'DELETE'
        }).catch(error => {
          console.error('Error deleting output:', error);
        });
        
        this.saveOutputs();
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
        hintText.innerHTML = 'Anthropic API key not set. <a href="index.html" style="color: var(--accent-green); text-decoration: underline;">Open Dashboard Settings</a> to add your API key. No refresh needed!';
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
      return;
    }

    if (!this.apiKey) {
      return;
    }

    const contentType = this.dom.contentType?.value || 'press_release';
    const typeLabel = CONTENT_TYPES.find(t => t.id === contentType)?.label || contentType;
    const customPrompt = contentType === 'custom' ? (this.dom.customPrompt?.value.trim() || '') : '';

    if (contentType === 'custom' && !customPrompt) {
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system: PR_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `API request failed (${response.status})`);
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
        drafts: [{
          content: parsed.content,
          version: 1,
          timestamp: Date.now(),
          prompt: null
        }],
        sources: selectedSources.map(s => s.id),
        citations: parsed.citations || [],
        strategy: parsed.strategy || null,
        createdAt: new Date().toISOString(),
        status: 'draft'
      };

      this.currentOutput = output;
      this.outputs.push(output);
      
      // Save to API
      try {
        await fetch('/api/pr/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(output)
        });
      } catch (error) {
        console.error('Error saving output:', error);
      }
      
      this.saveOutputs();

      this.renderGeneratedContent(output);
      this.renderStrategy(output.strategy);
      this.renderHistory();
      this.showWorkspace();
      
      // Show save confirmation
      this.showSaveConfirmation();

    } catch (err) {
      console.error('Generation failed:', err);
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
    
    // Switch to workspace tab after generation
    const workspaceTab = document.querySelector('[data-workspace-tab="content"]');
    if (workspaceTab) {
      workspaceTab.click();
    }
  }

  renderGeneratedContent(output) {
    if (!this.dom.generatedContent || !output) return;

    // Use new draft rendering if drafts exist
    if (output.drafts && output.drafts.length > 0) {
      this.renderDrafts();
    } else {
      // Backward compatibility - migrate old format
      output = this.migrateContentToDrafts(output);
      this.renderDrafts();
    }

    this.updateVerificationBar(output);
  }

  renderDrafts() {
    if (!this.currentOutput || !this.currentOutput.drafts) return;
    
    const container = this.dom.generatedContent;
    const drafts = this.currentOutput.drafts;
    
    container.innerHTML = drafts.map((draft, index) => {
      const isLatest = index === 0;
      const timeAgo = this.formatTimeAgo(draft.timestamp);
      
      return `
        <div class="pr-draft" data-version="${draft.version}">
          <div class="pr-draft-header">
            <span class="pr-draft-version">
              ${isLatest ? 'Latest' : `Version ${draft.version}`}
            </span>
            <span class="pr-draft-time">${timeAgo}</span>
            ${draft.prompt ? `<span class="pr-draft-prompt">"${this.escapeHtml(draft.prompt)}"</span>` : ''}
          </div>
          <div class="pr-draft-content">
            ${this.formatContent(draft.content, this.currentOutput.citations)}
          </div>
        </div>
      `;
    }).join('');
  }

  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  migrateContentToDrafts(output) {
    if (output.content && !output.drafts) {
      output.drafts = [{
        content: output.content,
        version: 1,
        timestamp: new Date(output.createdAt).getTime(),
        prompt: null
      }];
      delete output.content;
    }
    return output;
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

  async updateOutputContent() {
    if (!this.currentOutput || !this.dom.generatedContent) return;
    const outputIndex = this.outputs.findIndex(o => o.id === this.currentOutput.id);
    if (outputIndex !== -1) {
      this.outputs[outputIndex].content = this.dom.generatedContent.innerText;
      
      // Update in API
      try {
        await fetch('/api/pr/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.outputs[outputIndex])
        });
      } catch (error) {
        console.error('Error updating output:', error);
      }
      
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
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy:', err);
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
      this.prAgent.showToast('File too large (max 10MB)', 'error');
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
        console.error('Failed to read PDF:', err);
      }
    } else {
      this.prAgent.showToast('Unsupported file type', 'error');
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
      this.prAgent.showToast('OpenAI API key required for audio transcription', 'error');
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
      console.error('Microphone access denied:', err);
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
      this.prAgent.showToast('OpenAI API key required', 'error');
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
      console.error('Audio transcription failed:', err);
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
    // Disabled for cleaner, optimistic UI
    return;
  }

  // =========================================
  // CHAT FUNCTIONALITY
  // =========================================

  async sendChatMessage() {
    const input = document.getElementById('pr-chat-input');
    const message = input?.value?.trim();
    if (!message || !this.currentOutput) return;

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    input.disabled = true;
    
    const sendBtn = document.getElementById('pr-send-btn');
    if (sendBtn) sendBtn.disabled = true;
    
    // Show refining overlay
    this.showRefiningOverlay();

    try {
      // Build context
      const context = this.buildChatContext();
      
      const systemPrompt = `You are a PR content refinement assistant for Glossi. The user has generated PR content and wants to refine it.

VOICE RULES (from PR system prompt):
- Open with what happened or what the product does. Never with how you feel.
- Short sentences. Period-separated thoughts. Not comma-laden ones.
- Numbers over adjectives.
- Name the specific technology.
- Never use: "excited to announce", "thrilled", "groundbreaking", "game-changing"
- No exclamation marks.
- The confidence comes from specificity, not volume.

CURRENT CONTEXT:
${context}

USER REQUEST: ${message}

Apply the requested refinement and return ONLY the complete refined content (no explanations, no tags, just the refined text).`;

      // Call API via proxy
      const response = await this.apiCall('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }]
        })
      });

      const refinedContent = response.content[0].text.trim();

      // Migrate to drafts if needed
      if (!this.currentOutput.drafts) {
        this.currentOutput = this.migrateContentToDrafts(this.currentOutput);
      }

      // Create new draft version
      const newVersion = this.currentOutput.drafts.length + 1;
      this.currentOutput.drafts.unshift({
        content: refinedContent,
        version: newVersion,
        timestamp: Date.now(),
        prompt: message
      });
      
      // Render updated drafts
      this.renderDrafts();
      
      // Save
      await this.saveOutputs();

      // Generate new suggestions
      await this.generateSuggestions();

    } catch (error) {
      console.error('Error in refinement:', error);
      this.showRefiningError('Refinement failed. Please try again.');
      setTimeout(() => this.hideRefiningOverlay(), 2000);
      return;
    } finally {
      this.hideRefiningOverlay();
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  }

  async generateSuggestions() {
    if (!this.currentOutput) return;

    const container = document.getElementById('pr-suggestions');
    if (!container) return;

    try {
      const context = this.buildChatContext();
      
      const systemPrompt = `You are analyzing PR content for Glossi. Generate 4-5 specific, actionable refinement suggestions.

CONTEXT:
${context}

Return ONLY a JSON array of suggestions in this format:
["suggestion text 1", "suggestion text 2", ...]

Suggestion types to consider:
1. Link to active news hooks (if available in sources)
2. Tighten/shorten specific sections
3. Add missing Glossi metrics or specifics
4. Adjust tone (more direct, more confident)
5. Emphasize timing/positioning angles
6. Remove weak/generic language

Each suggestion should be:
- Specific and actionable (not generic like "improve tone")
- 3-7 words max
- Directly applicable with one click

Examples of good suggestions:
- "Tie to Nike launches announcement"
- "Shorten opening by 30%"
- "Add 50x rendering speed metric"
- "Remove 'game-changing' language"
- "Emphasize world models timing"

Return ONLY the JSON array, nothing else.`;

      const response = await this.apiCall('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Generate refinement suggestions for this content.' }]
        })
      });

      const responseText = response.content[0].text.trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      // Render suggestions
      container.innerHTML = suggestions.map(suggestion => 
        `<button class="pr-suggestion-btn" data-suggestion="${this.escapeHtml(suggestion)}">${this.escapeHtml(suggestion)}</button>`
      ).join('');

    } catch (error) {
      console.error('Error generating suggestions:', error);
      // Fallback to default suggestions
      container.innerHTML = `
        <button class="pr-suggestion-btn" data-suggestion="Make more direct">Make more direct</button>
        <button class="pr-suggestion-btn" data-suggestion="Shorten by 20%">Shorten by 20%</button>
        <button class="pr-suggestion-btn" data-suggestion="Add specific metrics">Add specific metrics</button>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  buildChatContext() {
    const parts = [];

    // Current content - include all drafts
    if (this.currentOutput) {
      parts.push(`CONTENT TYPE: ${this.currentOutput.contentType}`);
      
      if (this.currentOutput.drafts && this.currentOutput.drafts.length > 0) {
        parts.push(`\nDRAFT VERSIONS (${this.currentOutput.drafts.length} total):`);
        this.currentOutput.drafts.forEach((draft, i) => {
          const label = i === 0 ? 'LATEST DRAFT' : `VERSION ${draft.version}`;
          const promptInfo = draft.prompt ? ` (refined with: "${draft.prompt}")` : '';
          parts.push(`\n${label}${promptInfo}:\n${draft.content}`);
        });
      } else if (this.currentOutput.content) {
        // Backward compatibility
        parts.push(`\nCURRENT CONTENT:\n${this.currentOutput.content}`);
      }
    }

    // Sources
    if (this.sources.length > 0) {
      parts.push('\n\nSOURCES:');
      this.sources.forEach((source, i) => {
        parts.push(`\n[Source ${i + 1}] ${source.title}:\n${source.content}`);
      });
    }

    // Strategy
    if (this.currentOutput?.strategy) {
      parts.push('\n\nSTRATEGY RECOMMENDATIONS:\n' + JSON.stringify(this.currentOutput.strategy, null, 2));
    }

    return parts.join('\n');
  }

  renderChatMessages() {
    // No longer needed - content updates directly in workspace
  }

  showTypingIndicator() {
    // No longer needed - refinement happens instantly
  }

  hideTypingIndicator() {
    // No longer needed - refinement happens instantly
  }

  clearChat() {
    // No longer needed - no chat history
  }

  showRefiningOverlay() {
    const overlay = document.getElementById('pr-refining-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  hideRefiningOverlay() {
    const overlay = document.getElementById('pr-refining-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      const textEl = overlay.querySelector('.pr-refining-text');
      if (textEl) {
        textEl.textContent = 'Refining...';
        textEl.style.color = 'var(--text-secondary)';
      }
    }
  }

  showRefiningError(message) {
    const overlay = document.getElementById('pr-refining-overlay');
    const textEl = overlay?.querySelector('.pr-refining-text');
    if (textEl) {
      textEl.textContent = message;
      textEl.style.color = 'var(--accent-red)';
    }
  }

  async clearOldDrafts() {
    if (!this.currentOutput || !this.currentOutput.drafts) return;
    
    const latestDraft = this.currentOutput.drafts[0];
    this.currentOutput.drafts = [latestDraft];
    
    await this.saveOutputs();
    this.renderDrafts();
  }
}

// =========================================
// WIZARD MANAGER
// =========================================

class WizardManager {
  constructor(prAgent) {
    this.prAgent = prAgent;
    this.currentStep = 1;
    this.totalSteps = 6;
    this.data = {};
    this.isEditing = false;
  }

  async init() {
    this.setupDOM();
    this.setupEventListeners();
    await this.loadWizardData();
    
    // Check if wizard should auto-launch
    const shouldAutoLaunch = await this.shouldAutoLaunch();
    if (shouldAutoLaunch) {
      this.open();
    }
  }

  setupDOM() {
    this.dom = {
      overlay: document.getElementById('wizard-overlay'),
      closeBtn: document.getElementById('wizard-close'),
      stepText: document.getElementById('wizard-step-text'),
      progressFill: document.getElementById('wizard-progress-fill'),
      body: document.getElementById('wizard-body'),
      backBtn: document.getElementById('wizard-back'),
      nextBtn: document.getElementById('wizard-next'),
      finishBtn: document.getElementById('wizard-finish'),
      skipBtn: document.getElementById('wizard-skip'),
      steps: document.querySelectorAll('.wizard-step')
    };
  }

  setupEventListeners() {
    this.dom.closeBtn?.addEventListener('click', () => this.close());
    this.dom.backBtn?.addEventListener('click', () => this.previousStep());
    this.dom.nextBtn?.addEventListener('click', () => this.nextStep());
    this.dom.finishBtn?.addEventListener('click', () => this.finish());
    this.dom.skipBtn?.addEventListener('click', () => this.skipStep());
    
    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dom.overlay?.classList.contains('visible')) {
        this.close();
      }
    });
    
    // Save on input change (debounced)
    this.dom.overlay?.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('input', () => {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => this.saveProgress(), 1000);
      });
    });
    
    // Pre-fill defaults
    this.setDefaults();
  }

  setDefaults() {
    const companyName = document.getElementById('wizard-company-name');
    const companyDesc = document.getElementById('wizard-company-description');
    
    if (companyName && !companyName.value) {
      companyName.value = 'Glossi';
    }
    if (companyDesc && !companyDesc.value) {
      companyDesc.value = 'AI-native 3D product visualization platform';
    }
  }

  async shouldAutoLaunch() {
    try {
      const response = await fetch('/api/pr/sources');
      const data = await response.json();
      return data.success && data.sources.length === 0;
    } catch {
      return false;
    }
  }

  async loadWizardData() {
    try {
      const response = await fetch('/api/pr/wizard');
      const result = await response.json();
      
      if (result.success && result.data) {
        this.data = result.data;
        this.populateFields();
      }
    } catch (error) {
      console.error('Error loading wizard data:', error);
    }
  }

  populateFields() {
    Object.keys(this.data).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'radio') {
          const radio = document.querySelector(`input[name="${element.name}"][value="${this.data[key]}"]`);
          if (radio) radio.checked = true;
        } else {
          element.value = this.data[key] || '';
        }
      }
    });
  }

  open(isEditing = false) {
    // Auto-detect if we have existing data
    if (!isEditing && this.data && Object.keys(this.data).length > 0) {
      this.isEditing = true;
    } else {
      this.isEditing = isEditing;
    }
    
    this.currentStep = 1;
    this.goToStep(1);
    
    // Repopulate fields with existing data
    if (this.isEditing) {
      this.populateFields();
    }
    
    this.dom.overlay?.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.saveProgress();
    this.dom.overlay?.classList.remove('visible');
    document.body.style.overflow = '';
  }

  goToStep(step) {
    this.currentStep = step;
    
    // Update step visibility
    this.dom.steps?.forEach(stepEl => {
      stepEl.classList.toggle('active', parseInt(stepEl.dataset.step) === step);
    });
    
    // Update progress
    if (this.dom.stepText) {
      this.dom.stepText.textContent = `Step ${step} of ${this.totalSteps}`;
    }
    if (this.dom.progressFill) {
      const progress = (step / this.totalSteps) * 100;
      this.dom.progressFill.style.width = `${progress}%`;
    }
    
    // Update button visibility
    if (this.dom.backBtn) {
      this.dom.backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    }
    if (this.dom.nextBtn) {
      this.dom.nextBtn.style.display = step < this.totalSteps ? 'inline-flex' : 'none';
    }
    if (this.dom.finishBtn) {
      this.dom.finishBtn.style.display = step === this.totalSteps ? 'inline-flex' : 'none';
    }
    
    // Scroll to top
    if (this.dom.body) {
      this.dom.body.scrollTop = 0;
    }
  }

  nextStep() {
    this.saveProgress();
    if (this.currentStep < this.totalSteps) {
      this.goToStep(this.currentStep + 1);
    }
  }

  previousStep() {
    this.saveProgress();
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  }

  skipStep() {
    this.nextStep();
  }

  collectData() {
    const data = {};
    
    // Step 1
    data['wizard-company-name'] = document.getElementById('wizard-company-name')?.value || '';
    data['wizard-company-description'] = document.getElementById('wizard-company-description')?.value || '';
    data['wizard-founded-year'] = document.getElementById('wizard-founded-year')?.value || '';
    data['wizard-team-size'] = document.getElementById('wizard-team-size')?.value || '';
    data['wizard-headquarters'] = document.getElementById('wizard-headquarters')?.value || '';
    data['wizard-website'] = document.getElementById('wizard-website')?.value || '';
    data['wizard-founders'] = document.getElementById('wizard-founders')?.value || '';
    data['wizard-founder-background'] = document.getElementById('wizard-founder-background')?.value || '';
    
    // Step 2
    data['wizard-problem'] = document.getElementById('wizard-problem')?.value || '';
    data['wizard-who'] = document.getElementById('wizard-who')?.value || '';
    data['wizard-current-solution'] = document.getElementById('wizard-current-solution')?.value || '';
    data['wizard-cost'] = document.getElementById('wizard-cost')?.value || '';
    
    // Step 3
    data['wizard-solution'] = document.getElementById('wizard-solution')?.value || '';
    data['wizard-technology'] = document.getElementById('wizard-technology')?.value || '';
    data['wizard-insight'] = document.getElementById('wizard-insight')?.value || '';
    data['wizard-analogy'] = document.getElementById('wizard-analogy')?.value || '';
    
    // Step 4
    data['wizard-customers'] = document.getElementById('wizard-customers')?.value || '';
    data['wizard-revenue'] = document.getElementById('wizard-revenue')?.value || '';
    data['wizard-key-metric'] = document.getElementById('wizard-key-metric')?.value || '';
    data['wizard-notable-customers'] = document.getElementById('wizard-notable-customers')?.value || '';
    data['wizard-press'] = document.getElementById('wizard-press')?.value || '';
    data['wizard-awards'] = document.getElementById('wizard-awards')?.value || '';
    data['wizard-features'] = document.getElementById('wizard-features')?.value || '';
    
    // Step 5
    data['wizard-market-urgency'] = document.getElementById('wizard-market-urgency')?.value || '';
    data['wizard-tech-shifts'] = document.getElementById('wizard-tech-shifts')?.value || '';
    data['wizard-moat'] = document.getElementById('wizard-moat')?.value || '';
    data['wizard-if-not'] = document.getElementById('wizard-if-not')?.value || '';
    
    // Step 6
    data['wizard-elevator-pitch'] = document.getElementById('wizard-elevator-pitch')?.value || '';
    data['wizard-strong-opinion'] = document.getElementById('wizard-strong-opinion')?.value || '';
    data['wizard-investor-pitch'] = document.getElementById('wizard-investor-pitch')?.value || '';
    const toneRadio = document.querySelector('input[name="wizard-tone"]:checked');
    data['wizard-tone'] = toneRadio?.value || 'understated';
    
    return data;
  }

  async saveProgress() {
    this.data = this.collectData();
    
    try {
      const response = await fetch('/api/pr/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: this.data })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save progress');
      }
    } catch (error) {
      console.error('Error saving wizard progress:', error);
    }
  }

  async finish() {
    try {
      await this.saveProgress();
      await this.generateSources();
      this.close();
      this.prAgent.showToast('PR foundation created! 5 sources added.', 'success');
    } catch (error) {
      console.error('Error finishing wizard:', error);
      this.prAgent.showToast('Failed to complete wizard. Please try again.', 'error');
    }
  }

  async generateSources() {
    const data = this.data;
    const sources = [];
    
    // Source 1: Company Fact Sheet (Step 1 + Step 4)
    const factSheetContent = `
Company: ${data['wizard-company-name'] || '[Not provided]'}
Description: ${data['wizard-company-description'] || '[Not provided]'}
Founded: ${data['wizard-founded-year'] || '[Not provided]'}
Team Size: ${data['wizard-team-size'] || '[Not provided]'}
Location: ${data['wizard-headquarters'] || '[Not provided]'}
Website: ${data['wizard-website'] || '[Not provided]'}
Founders: ${data['wizard-founders'] || '[Not provided]'}
Background: ${data['wizard-founder-background'] || '[Not provided]'}

TRACTION:
Customers: ${data['wizard-customers'] || '[Not provided]'}
Revenue/Pipeline: ${data['wizard-revenue'] || '[Not provided]'}
Key Metric: ${data['wizard-key-metric'] || '[Not provided]'}
Notable Customers: ${data['wizard-notable-customers'] || '[Not provided]'}
Press Coverage: ${data['wizard-press'] || '[Not provided]'}
Awards/Investors: ${data['wizard-awards'] || '[Not provided]'}
Recent Features: ${data['wizard-features'] || '[Not provided]'}
    `.trim();
    
    sources.push({
      id: 'src_wizard_facts_' + Date.now(),
      title: 'Company Fact Sheet',
      type: 'text',
      content: factSheetContent,
      createdAt: new Date().toISOString(),
      selected: true
    });
    
    // Source 2: Problem & Market Context (Step 2)
    const problemContent = `
THE PROBLEM:
${data['wizard-problem'] || '[Not provided - add details to improve PR output]'}

WHO HAS THIS PROBLEM:
${data['wizard-who'] || '[Not provided - add details to improve PR output]'}

CURRENT SOLUTIONS:
${data['wizard-current-solution'] || '[Not provided - add details to improve PR output]'}

COST OF CURRENT APPROACH:
${data['wizard-cost'] || '[Not provided - add details to improve PR output]'}
    `.trim();
    
    sources.push({
      id: 'src_wizard_problem_' + Date.now(),
      title: 'Problem & Market Context',
      type: 'text',
      content: problemContent,
      createdAt: new Date().toISOString(),
      selected: true
    });
    
    // Source 3: Solution & Technology (Step 3)
    const solutionContent = `
HOW WE SOLVE IT:
${data['wizard-solution'] || '[Not provided - add details to improve PR output]'}

CORE TECHNOLOGY:
${data['wizard-technology'] || '[Not provided - add details to improve PR output]'}

KEY INSIGHT/DIFFERENTIATOR:
${data['wizard-insight'] || '[Not provided - add details to improve PR output]'}

ANALOGY:
${data['wizard-analogy'] || '[Not provided - add details to improve PR output]'}
    `.trim();
    
    sources.push({
      id: 'src_wizard_solution_' + Date.now(),
      title: 'Solution & Technology',
      type: 'text',
      content: solutionContent,
      createdAt: new Date().toISOString(),
      selected: true
    });
    
    // Source 4: Market Timing & Why Now (Step 5)
    const timingContent = `
MARKET URGENCY:
${data['wizard-market-urgency'] || '[Not provided - add details to improve PR output]'}

TECHNOLOGY SHIFTS:
${data['wizard-tech-shifts'] || '[Not provided - add details to improve PR output]'}

WHY INCUMBENTS CAN'T DO THIS:
${data['wizard-moat'] || '[Not provided - add details to improve PR output]'}

CONSEQUENCE OF INACTION:
${data['wizard-if-not'] || '[Not provided - add details to improve PR output]'}
    `.trim();
    
    sources.push({
      id: 'src_wizard_timing_' + Date.now(),
      title: 'Market Timing & Why Now',
      type: 'text',
      content: timingContent,
      createdAt: new Date().toISOString(),
      selected: true
    });
    
    // Source 5: Founder Voice & Messaging (Step 6)
    const voiceContent = `
30-SECOND PITCH:
${data['wizard-elevator-pitch'] || '[Not provided - add details to improve PR output]'}

STRONG OPINION:
${data['wizard-strong-opinion'] || '[Not provided - add details to improve PR output]'}

WHAT RESONATES WITH INVESTORS:
${data['wizard-investor-pitch'] || '[Not provided - add details to improve PR output]'}

TONE PREFERENCE:
${data['wizard-tone'] || 'understated'}
    `.trim();
    
    sources.push({
      id: 'src_wizard_voice_' + Date.now(),
      title: 'Founder Voice & Messaging',
      type: 'text',
      content: voiceContent,
      createdAt: new Date().toISOString(),
      selected: true
    });
    
    // Save all sources to database
    for (const source of sources) {
      try {
        const response = await fetch('/api/pr/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(source)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save source: ${source.title}`);
        }
      } catch (error) {
        console.error('Error saving source:', error);
        throw error;
      }
    }
    
    // Refresh sources display
    await this.prAgent.loadData();
    this.prAgent.renderSources();
    this.prAgent.updateGenerateButton();
  }
}

// =========================================
// MEDIA MANAGER
// =========================================

const OUTLET_DATABASE = {
  tier1: [
    { name: "TechCrunch", beats: ["AI", "3D", "startups", "enterprise"], url: "techcrunch.com", notes: "Strongest for funding announcements and product launches" },
    { name: "The Verge", beats: ["AI", "creative tools", "tech products"], url: "theverge.com", notes: "Best for consumer-facing tech stories with visual demos" },
    { name: "VentureBeat", beats: ["AI", "enterprise", "3D"], url: "venturebeat.com", notes: "AI/ML focused, good for technical depth" },
    { name: "Wired", beats: ["AI", "design", "future of work"], url: "wired.com", notes: "Long-form, needs a strong narrative angle" },
    { name: "The Information", beats: ["enterprise tech", "AI"], url: "theinformation.com", notes: "Premium audience, focuses on enterprise adoption" },
    { name: "Fast Company", beats: ["design", "innovation", "creative tech"], url: "fastcompany.com", notes: "Design and innovation angle, good for 'most innovative companies' lists" },
    { name: "MIT Technology Review", beats: ["AI", "tech research", "future tech"], url: "technologyreview.com", notes: "Research-focused, technical depth, respected authority" },
    { name: "Ars Technica", beats: ["tech", "AI", "science"], url: "arstechnica.com", notes: "Technical audience, detailed coverage" },
    { name: "Business Insider", beats: ["business", "tech", "innovation"], url: "businessinsider.com", notes: "Broad business audience, executive readership" },
    { name: "Forbes Tech", beats: ["enterprise", "innovation", "business"], url: "forbes.com/technology", notes: "Business leadership audience, innovation focus" },
    { name: "Bloomberg Technology", beats: ["enterprise tech", "business", "AI"], url: "bloomberg.com/technology", notes: "Financial and business angle, enterprise focus" },
  ],
  tier2: [
    { name: "Adweek", beats: ["brand strategy", "creative tech", "marketing"], url: "adweek.com", notes: "Brand/marketing angle, CMO audience" },
    { name: "Digiday", beats: ["marketing tech", "brand content", "e-commerce"], url: "digiday.com", notes: "Marketing tech transformation stories" },
    { name: "Campaign", beats: ["advertising", "brand", "creative"], url: "campaignlive.com", notes: "Global advertising and brand strategy" },
    { name: "Marketing Brew", beats: ["marketing", "brand tech"], url: "marketingbrew.com", notes: "Newsletter format, concise, high-engagement audience" },
    { name: "Protocol", beats: ["tech policy", "enterprise", "AI"], url: "protocol.com", notes: "Tech industry insights, enterprise tech" },
    { name: "CNBC Tech", beats: ["tech business", "enterprise"], url: "cnbc.com/technology", notes: "Business news network, broad reach" },
    { name: "Reuters Tech", beats: ["tech news", "business"], url: "reuters.com/technology", notes: "Global news service, authoritative" },
    { name: "Product Hunt", beats: ["product launches"], url: "producthunt.com", notes: "Community-driven launch platform" },
    { name: "Hacker News", beats: ["technical", "startups"], url: "news.ycombinator.com", notes: "Developer/technical audience, organic only" },
  ],
  tier3_niche: [
    { name: "Business of Fashion", beats: ["fashion", "luxury", "retail", "beauty", "sustainability", "marketing"], url: "businessoffashion.com", notes: "Leading fashion industry publication, covers business, technology, and trends" },
    { name: "The Interline", beats: ["fashion tech", "3D", "digital product creation", "PLM", "AI", "sustainability"], url: "theinterline.com", notes: "Fashion technology magazine, technical depth on digital transformation" },
    { name: "3D World", beats: ["3D", "visualization", "rendering"], url: "3dworldmag.com", notes: "Deep technical audience, 3D professionals" },
    { name: "CGSociety", beats: ["3D", "VFX", "visualization"], url: "cgsociety.org", notes: "CG/VFX community" },
    { name: "Creative Bloq", beats: ["design", "creative tools"], url: "creativebloq.com", notes: "Creative professionals, design tools" },
    { name: "RetailDive", beats: ["retail tech", "e-commerce"], url: "retaildive.com", notes: "Retail industry vertical" },
    { name: "Glossy", beats: ["fashion", "beauty", "DTC brands"], url: "glossy.co", notes: "Fashion/beauty brand audience, perfect vertical fit" },
  ],
  newsletters: [
    { name: "TLDR Newsletter", beats: ["tech", "AI", "dev", "startups"], url: "tldr.tech", notes: "1.6M+ readers, daily tech newsletter with AI, Dev, Design, Marketing verticals" },
    { name: "The Neuron", beats: ["AI"], url: "theneurondaily.com", notes: "Daily AI newsletter, large audience" },
    { name: "TLDR AI", beats: ["AI"], url: "tldr.tech/ai", notes: "Short-form AI news, developer skew" },
    { name: "Ben's Bites", beats: ["AI", "startups"], url: "bensbites.com", notes: "AI startup ecosystem" },
    { name: "Import AI", beats: ["AI research"], url: "importai.net", notes: "More technical/research-focused" },
    { name: "The Hustle", beats: ["startups", "business"], url: "thehustle.co", notes: "Business-focused, accessible tone" },
  ]
};

class MediaManager {
  constructor(prAgent) {
    this.prAgent = prAgent;
    this.journalists = [];
    this.pitches = [];
  }

  async init() {
    this.setupDOM();
    this.setupEventListeners();
    await this.loadJournalists();
    await this.loadPitches();
    this.renderOutlets();
  }

  setupDOM() {
    this.dom = {
      outletsContainer: document.getElementById('pr-media-outlets-right') || document.getElementById('pr-media-outlets'),
      discoverView: document.getElementById('pr-media-discover-right') || document.getElementById('pr-media-discover'),
      trackView: document.getElementById('pr-media-track-right') || document.getElementById('pr-media-track'),
      pitchTracker: document.getElementById('pr-pitch-tracker-right') || document.getElementById('pr-pitch-tracker'),
      toggleBtns: document.querySelectorAll('.pr-media-toggle-btn')
    };
  }

  setupEventListeners() {
    // Toggle between Discover and Track views
    this.dom.toggleBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.mediaView;
        
        this.dom.toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.dom.discoverView?.classList.toggle('active', view === 'discover');
        this.dom.trackView?.classList.toggle('active', view === 'track');
        
        if (view === 'track') {
          // Render journalist table
          this.dom.pitchTracker.innerHTML = this.renderJournalistTable();
          this.setupJournalistTableListeners();
        }
      });
    });
  }

  async loadJournalists() {
    try {
      const response = await fetch('/api/pr/journalists');
      const data = await response.json();
      if (data.success) {
        this.journalists = data.journalists;
      }
    } catch (error) {
      console.error('Error loading journalists:', error);
    }
  }

  async loadPitches() {
    try {
      const response = await fetch('/api/pr/pitches');
      const data = await response.json();
      if (data.success) {
        this.pitches = data.pitches;
      }
    } catch (error) {
      console.error('Error loading pitches:', error);
    }
  }

  renderOutlets() {
    if (!this.dom.outletsContainer) return;

    const tierLabels = {
      tier1: 'Tier 1',
      tier2: 'Tier 2',
      tier3_niche: 'Tier 3 / Niche',
      newsletters: 'Newsletters'
    };

    let html = '';
    
    Object.keys(OUTLET_DATABASE).forEach(tier => {
      html += `<div class="pr-outlet-tier">
        <h4 class="pr-outlet-tier-label">${tierLabels[tier]}</h4>
        <div class="pr-outlet-cards">`;
      
      OUTLET_DATABASE[tier].forEach(outlet => {
        html += `
          <div class="pr-outlet-card">
            <div class="pr-outlet-card-header">
              <div class="pr-outlet-card-title">
                <span class="pr-outlet-name">${this.escapeHtml(outlet.name)}</span>
                <a href="https://${outlet.url}" target="_blank" class="pr-outlet-url" title="Visit ${outlet.name}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>
            <div class="pr-outlet-beats">
              ${outlet.beats.map(beat => `<span class="pr-beat-tag">${beat}</span>`).join('')}
            </div>
            <p class="pr-outlet-notes">${this.escapeHtml(outlet.notes)}</p>
            <button class="btn btn-sm btn-primary pr-find-journalists-btn" data-outlet="${this.escapeHtml(outlet.name)}" data-url="${outlet.url}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              Find Journalists
            </button>
          </div>
        `;
      });
      
      html += `</div></div>`;
    });

    this.dom.outletsContainer.innerHTML = html;

    // Add event listeners to find journalists buttons
    this.dom.outletsContainer.querySelectorAll('.pr-find-journalists-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const outletName = btn.dataset.outlet;
        const outletUrl = btn.dataset.url;
        this.discoverJournalists(outletName, outletUrl);
      });
    });
  }

  async discoverJournalists(outletName, outletUrl) {
    // Show loading state
    const loadingModal = this.showLoadingModal('Discovering journalists...');

    try {
      const response = await fetch('/api/pr/discover-journalists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletName,
          outletUrl
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Discovery failed');
      }

      loadingModal.remove();
      
      if (data.journalists.length === 0) {
        this.prAgent.showToast('No journalists found for this outlet', 'info');
        return;
      }

      this.showJournalistResults(data.journalists, outletName);
    } catch (error) {
      loadingModal.remove();
      console.error('Error discovering journalists:', error);
      this.prAgent.showToast('Failed to discover journalists. ' + error.message, 'error');
    }
  }

  showLoadingModal(message) {
    const modal = document.createElement('div');
    modal.className = 'pr-loading-modal';
    modal.innerHTML = `
      <div class="pr-loading-modal-content">
        <div class="pr-loading-spinner"></div>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  showJournalistResults(journalists, outletName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>Journalists at ${this.escapeHtml(outletName)}</h2>
          <button class="btn-icon modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="pr-journalist-results">
            ${journalists.map(j => `
              <div class="pr-journalist-card">
                <div class="pr-journalist-header">
                  <div class="pr-journalist-info">
                    <h3 class="pr-journalist-name">${this.escapeHtml(j.name)}</h3>
                    <p class="pr-journalist-outlet">${this.escapeHtml(j.outlet)}${j.beat ? ` / ${this.escapeHtml(j.beat)}` : ''}</p>
                  </div>
                  ${j.contactFound ? '<span class="pr-contact-badge">Contact info found</span>' : ''}
                </div>
                ${j.articles && j.articles.length > 0 ? `
                  <div class="pr-journalist-articles">
                    <p class="pr-articles-label">Recent coverage:</p>
                    ${j.articles.slice(0, 3).map(a => `
                      <div class="pr-article-item">
                        <a href="${a.url}" target="_blank" class="pr-article-title">${this.escapeHtml(a.title)}</a>
                        <p class="pr-article-meta">${a.date || 'Recent'}</p>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ${(j.email || j.twitter || j.linkedin) ? `
                  <div class="pr-journalist-contact">
                    ${j.email ? `<span class="pr-contact-item">📧 ${this.escapeHtml(j.email)}</span>` : ''}
                    ${j.twitter ? `<span class="pr-contact-item">𝕏 @${this.escapeHtml(j.twitter)}</span>` : ''}
                    ${j.linkedin ? `<a href="${j.linkedin}" target="_blank" class="pr-contact-item">💼 LinkedIn</a>` : ''}
                  </div>
                ` : ''}
                <button class="btn btn-primary pr-save-journalist-btn" data-journalist='${JSON.stringify(j).replace(/'/g, "&apos;")}'>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save to Media List
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelectorAll('.pr-save-journalist-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const journalist = JSON.parse(btn.dataset.journalist.replace(/&apos;/g, "'"));
        await this.saveJournalist(journalist);
        btn.disabled = true;
        btn.textContent = 'Saved!';
      });
    });
  }

  async saveJournalist(journalist) {
    const id = 'jrn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const journalistData = {
      id,
      name: journalist.name,
      outlet: journalist.outlet,
      outlet_url: journalist.outletUrl,
      beat: journalist.beat || null,
      recent_articles: journalist.articles || [],
      email: journalist.email || null,
      twitter: journalist.twitter || null,
      linkedin: journalist.linkedin || null,
      notes: '',
      last_pitched: null,
      status: 'new'
    };

    // Optimistic add - update UI immediately
    this.journalists.push(journalistData);
    
    // Sync with API in background
    fetch('/api/pr/journalists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(journalistData)
    }).catch(error => {
      console.error('Error saving journalist:', error);
    });
  }

  renderPitches() {
    if (!this.dom.pitchTracker) return;

    if (this.pitches.length === 0) {
      this.dom.pitchTracker.innerHTML = '<p class="pr-empty-text">No pitches tracked yet</p>';
      return;
    }

    // Pitch analytics
    const sent = this.pitches.filter(p => ['sent', 'followed_up', 'responded', 'covered'].includes(p.status)).length;
    const responded = this.pitches.filter(p => ['responded', 'covered'].includes(p.status)).length;
    const covered = this.pitches.filter(p => p.status === 'covered').length;

    let html = `
      <div class="pr-pitch-analytics">
        <div class="pr-pitch-stat">
          <span class="pr-pitch-stat-value">${sent}</span>
          <span class="pr-pitch-stat-label">Pitches Sent</span>
        </div>
        <div class="pr-pitch-stat">
          <span class="pr-pitch-stat-value">${responded}</span>
          <span class="pr-pitch-stat-label">Responses</span>
        </div>
        <div class="pr-pitch-stat">
          <span class="pr-pitch-stat-value">${covered}</span>
          <span class="pr-pitch-stat-label">Coverage</span>
        </div>
      </div>
      <div class="pr-pitch-list">
    `;
    
    this.pitches.forEach(pitch => {
      const journalist = this.journalists.find(j => j.id === pitch.journalist_id);
      const followUpDue = pitch.follow_up_date && new Date(pitch.follow_up_date) <= new Date();
      
      html += `
        <div class="pr-pitch-item ${followUpDue ? 'follow-up-due' : ''}">
          <div class="pr-pitch-header">
            <div class="pr-pitch-info">
              <span class="pr-pitch-journalist">${journalist ? this.escapeHtml(journalist.name) : 'Unknown'}</span>
              ${journalist ? `<span class="pr-pitch-outlet">${this.escapeHtml(journalist.outlet)}</span>` : ''}
            </div>
            <select class="pr-pitch-status-select" data-pitch-id="${pitch.id}">
              <option value="drafted" ${pitch.status === 'drafted' ? 'selected' : ''}>Drafted</option>
              <option value="sent" ${pitch.status === 'sent' ? 'selected' : ''}>Sent</option>
              <option value="followed_up" ${pitch.status === 'followed_up' ? 'selected' : ''}>Followed Up</option>
              <option value="responded" ${pitch.status === 'responded' ? 'selected' : ''}>Responded</option>
              <option value="declined" ${pitch.status === 'declined' ? 'selected' : ''}>Declined</option>
              <option value="covered" ${pitch.status === 'covered' ? 'selected' : ''}>Covered</option>
            </select>
          </div>
          <div class="pr-pitch-meta">
            <span>${pitch.sent_date ? new Date(pitch.sent_date).toLocaleDateString() : 'Not sent'}</span>
            ${followUpDue ? '<span class="pr-follow-up-badge">Follow-up due</span>' : ''}
          </div>
          ${pitch.notes ? `<p class="pr-pitch-notes">${this.escapeHtml(pitch.notes)}</p>` : ''}
          ${pitch.coverage_url ? `<a href="${pitch.coverage_url}" target="_blank" class="pr-coverage-link">View Coverage →</a>` : ''}
        </div>
      `;
    });
    
    html += `</div>`;
    this.dom.pitchTracker.innerHTML = html;

    // Add status change listeners
    this.dom.pitchTracker.querySelectorAll('.pr-pitch-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const pitchId = e.target.dataset.pitchId;
        const newStatus = e.target.value;
        await this.updatePitchStatus(pitchId, newStatus);
      });
    });
  }

  async updatePitchStatus(pitchId, newStatus) {
    const pitch = this.pitches.find(p => p.id === pitchId);
    if (!pitch) return;

    pitch.status = newStatus;

    try {
      await fetch('/api/pr/pitches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pitch)
      });

      this.renderPitches();
      this.prAgent.showToast('Pitch status updated', 'success');
    } catch (error) {
      console.error('Error updating pitch status:', error);
      this.prAgent.showToast('Failed to update status', 'error');
    }
  }

  renderJournalistTable() {
    if (this.journalists.length === 0) {
      return '<p class="pr-empty-text">No journalists saved yet. Discover journalists from outlets.</p>';
    }

    let html = `
      <div class="pr-journalist-table">
        <div class="pr-journalist-filters">
          <input type="text" class="input input-sm" id="pr-journalist-search" placeholder="Search journalists...">
          <select class="input input-sm" id="pr-journalist-filter-outlet">
            <option value="">All Outlets</option>
            ${[...new Set(this.journalists.map(j => j.outlet))].map(outlet => 
              `<option value="${outlet}">${outlet}</option>`
            ).join('')}
          </select>
          <select class="input input-sm" id="pr-journalist-filter-status">
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="researched">Researched</option>
            <option value="pitched">Pitched</option>
            <option value="responded">Responded</option>
            <option value="covered">Covered</option>
          </select>
        </div>
        <div class="pr-journalist-table-rows">
    `;

    this.journalists.forEach(journalist => {
      html += `
        <div class="pr-journalist-row" data-journalist-id="${journalist.id}">
          <div class="pr-journalist-row-main">
            <div class="pr-journalist-row-info">
              <span class="pr-journalist-row-name">${this.escapeHtml(journalist.name)}</span>
              <span class="pr-journalist-row-outlet">${this.escapeHtml(journalist.outlet)}</span>
              ${journalist.beat ? `<span class="pr-journalist-row-beat">${this.escapeHtml(journalist.beat)}</span>` : ''}
            </div>
            <div class="pr-journalist-row-actions">
              <select class="pr-status-select" data-journalist-id="${journalist.id}">
                <option value="new" ${journalist.status === 'new' ? 'selected' : ''}>New</option>
                <option value="researched" ${journalist.status === 'researched' ? 'selected' : ''}>Researched</option>
                <option value="pitched" ${journalist.status === 'pitched' ? 'selected' : ''}>Pitched</option>
                <option value="responded" ${journalist.status === 'responded' ? 'selected' : ''}>Responded</option>
                <option value="covered" ${journalist.status === 'covered' ? 'selected' : ''}>Covered</option>
              </select>
              <button class="btn-icon" data-action="view" data-journalist-id="${journalist.id}" title="View details">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="btn-icon" data-action="delete" data-journalist-id="${journalist.id}" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          ${(journalist.email || journalist.twitter || journalist.linkedin) ? `
            <div class="pr-journalist-row-contact">
              ${journalist.email ? `<span>📧 ${this.escapeHtml(journalist.email)}</span>` : ''}
              ${journalist.twitter ? `<span>𝕏 @${this.escapeHtml(journalist.twitter)}</span>` : ''}
              ${journalist.linkedin ? `<a href="${journalist.linkedin}" target="_blank">💼 LinkedIn</a>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div></div>`;
    return html;
  }

  setupJournalistTableListeners() {
    // Status change
    document.querySelectorAll('.pr-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const journalistId = e.target.dataset.journalistId;
        const newStatus = e.target.value;
        await this.updateJournalistStatus(journalistId, newStatus);
      });
    });

    // Actions
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const journalistId = btn.dataset.journalistId;

        if (action === 'view') {
          this.viewJournalistDetails(journalistId);
        } else if (action === 'delete') {
          await this.deleteJournalist(journalistId);
        }
      });
    });

    // Filtering
    const searchInput = document.getElementById('pr-journalist-search');
    const outletFilter = document.getElementById('pr-journalist-filter-outlet');
    const statusFilter = document.getElementById('pr-journalist-filter-status');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterJournalists());
    }
    if (outletFilter) {
      outletFilter.addEventListener('change', () => this.filterJournalists());
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.filterJournalists());
    }
  }

  filterJournalists() {
    const searchTerm = document.getElementById('pr-journalist-search')?.value.toLowerCase() || '';
    const outletFilter = document.getElementById('pr-journalist-filter-outlet')?.value || '';
    const statusFilter = document.getElementById('pr-journalist-filter-status')?.value || '';

    document.querySelectorAll('.pr-journalist-row').forEach(row => {
      const journalistId = row.dataset.journalistId;
      const journalist = this.journalists.find(j => j.id === journalistId);

      if (!journalist) {
        row.style.display = 'none';
        return;
      }

      const matchesSearch = journalist.name.toLowerCase().includes(searchTerm) ||
                           journalist.outlet.toLowerCase().includes(searchTerm);
      const matchesOutlet = !outletFilter || journalist.outlet === outletFilter;
      const matchesStatus = !statusFilter || journalist.status === statusFilter;

      row.style.display = matchesSearch && matchesOutlet && matchesStatus ? '' : 'none';
    });
  }

  async updateJournalistStatus(journalistId, newStatus) {
    const journalist = this.journalists.find(j => j.id === journalistId);
    if (!journalist) return;

    journalist.status = newStatus;

    try {
      await fetch('/api/pr/journalists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journalist)
      });

      this.prAgent.showToast('Status updated', 'success');
    } catch (error) {
      console.error('Error updating journalist status:', error);
      this.prAgent.showToast('Failed to update status', 'error');
    }
  }

  async deleteJournalist(journalistId) {
    // Optimistic delete - remove immediately, no confirmation
    this.journalists = this.journalists.filter(j => j.id !== journalistId);
    
    // Re-render track view immediately
    if (this.dom.trackView?.classList.contains('active')) {
      this.dom.pitchTracker.innerHTML = this.renderJournalistTable();
      this.setupJournalistTableListeners();
    }

    // Sync delete with API in background
    fetch(`/api/pr/journalists/${journalistId}`, {
      method: 'DELETE'
    }).catch(error => {
      console.error('Error deleting journalist:', error);
    });
  }

  viewJournalistDetails(journalistId) {
    const journalist = this.journalists.find(j => j.id === journalistId);
    if (!journalist) return;

    // Create modal with journalist details
    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${this.escapeHtml(journalist.name)}</h2>
          <button class="btn-icon modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="pr-journalist-details">
            <div class="pr-detail-row">
              <span class="pr-detail-label">Outlet:</span>
              <span class="pr-detail-value">${this.escapeHtml(journalist.outlet)}</span>
            </div>
            ${journalist.beat ? `
              <div class="pr-detail-row">
                <span class="pr-detail-label">Beat:</span>
                <span class="pr-detail-value">${this.escapeHtml(journalist.beat)}</span>
              </div>
            ` : ''}
            ${journalist.email ? `
              <div class="pr-detail-row">
                <span class="pr-detail-label">Email:</span>
                <span class="pr-detail-value">${this.escapeHtml(journalist.email)}</span>
              </div>
            ` : ''}
            ${journalist.twitter ? `
              <div class="pr-detail-row">
                <span class="pr-detail-label">Twitter:</span>
                <span class="pr-detail-value">@${this.escapeHtml(journalist.twitter)}</span>
              </div>
            ` : ''}
            ${journalist.linkedin ? `
              <div class="pr-detail-row">
                <span class="pr-detail-label">LinkedIn:</span>
                <a href="${journalist.linkedin}" target="_blank" class="pr-detail-value">${journalist.linkedin}</a>
              </div>
            ` : ''}
            ${journalist.notes ? `
              <div class="pr-detail-row">
                <span class="pr-detail-label">Notes:</span>
                <p class="pr-detail-value">${this.escapeHtml(journalist.notes)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// =========================================
// NEWS MONITOR
// =========================================

class NewsMonitor {
  constructor(prAgent) {
    this.prAgent = prAgent;
    this.newsHooks = [];
    this.displayedNewsCount = 10; // Show 10 news items initially
  }

  async init() {
    this.setupDOM();
    this.setupEventListeners();
    await this.loadCachedNews();
  }

  setupDOM() {
    this.dom = {
      fetchNewsBtn: document.getElementById('pr-fetch-news-btn'),
      newsHooksList: document.getElementById('pr-news-hooks-list')
    };
  }

  setupEventListeners() {
    this.dom.fetchNewsBtn?.addEventListener('click', () => this.refreshNews());
  }

  showMoreNews() {
    this.displayedNewsCount += 10;
    this.renderNews();
  }

  async loadCachedNews() {
    try {
      const response = await fetch('/api/pr/news-hooks');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.news && data.news.length > 0) {
        // Filter out news older than 30 days
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const filteredNews = data.news.filter(item => {
          const itemDate = new Date(item.date || item.fetched_at);
          return (now - itemDate.getTime()) < thirtyDaysMs;
        });
        
        // Check if filtered news is all stale (>7 days old)
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const hasRecentNews = filteredNews.some(item => {
          const itemDate = new Date(item.date || item.fetched_at);
          return (now - itemDate.getTime()) < sevenDaysMs;
        });
        
        this.newsHooks = filteredNews;
        this.renderNews();
        
        // Auto-refresh if no recent news (all cached news is >7 days old or empty)
        if (!hasRecentNews) {
          console.log('Cached news is stale, auto-refreshing...');
          setTimeout(() => this.refreshNews(), 1000);
        }
      } else {
        // No cached news, show empty state
        this.renderNews();
      }
    } catch (error) {
      console.error('Error loading cached news:', error);
      // Show empty state on error
      this.renderNews();
    }
  }

  async refreshNews() {
    // Show loading state
    if (this.dom.fetchNewsBtn) {
      this.dom.fetchNewsBtn.disabled = true;
      this.dom.fetchNewsBtn.classList.add('spinning');
    }
    
    if (this.dom.newsHooksList) {
      this.dom.newsHooksList.innerHTML = '<p class="pr-news-hooks-empty">Searching for relevant news...</p>';
    }

    try {
      const response = await fetch('/api/pr/news-hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      this.newsHooks = data.news || [];
      this.renderNews();
    } catch (error) {
      console.error('Error refreshing news:', error);
      if (this.dom.newsHooksList) {
        this.dom.newsHooksList.innerHTML = '<p class="pr-news-hooks-empty">Failed to load news. Try again.</p>';
      }
    } finally {
      if (this.dom.fetchNewsBtn) {
        this.dom.fetchNewsBtn.disabled = false;
        this.dom.fetchNewsBtn.classList.remove('spinning');
      }
    }
  }

  renderNews() {
    if (!this.dom.newsHooksList) return;

    if (this.newsHooks.length === 0) {
      this.dom.newsHooksList.innerHTML = '<p class="pr-news-hooks-empty">No recent news found. Click refresh to search.</p>';
      return;
    }

    // Slice to show only displayed count
    const displayedItems = this.newsHooks.slice(0, this.displayedNewsCount);
    const remainingCount = this.newsHooks.length - this.displayedNewsCount;
    
    let html = '<div class="pr-news-items">';
    
    displayedItems.forEach((item, displayIndex) => {
      // Use actual index from full array for proper data binding
      const actualIndex = this.newsHooks.indexOf(item);
      const date = new Date(item.date || item.fetched_at);
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      const isStale = daysAgo > 7;
      
      html += `
        <div class="pr-news-item ${isStale ? 'stale' : ''}">
          <div class="pr-news-header">
            <a href="${item.url}" target="_blank" class="pr-news-headline">${this.escapeHtml(item.headline)}</a>
            ${isStale ? '<span class="pr-news-stale-badge">Old</span>' : ''}
          </div>
          <div class="pr-news-meta">
            <span class="pr-news-outlet">${this.escapeHtml(item.outlet)}</span>
            <span class="pr-news-date">${daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}</span>
          </div>
          <p class="pr-news-summary">${this.escapeHtml(item.summary)}</p>
          <div class="pr-news-relevance">
            <span class="pr-relevance-label">How Glossi ties in:</span>
            <p class="pr-relevance-text">${this.escapeHtml(item.relevance)}</p>
          </div>
          <button class="btn btn-sm pr-use-hook-btn" data-news-index="${actualIndex}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Use as Hook
          </button>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Add "Show More" button if there are more items
    if (remainingCount > 0) {
      html += `
        <div class="pr-news-show-more">
          <button class="btn btn-secondary pr-show-more-news-btn">
            Show More (${remainingCount} remaining)
          </button>
        </div>
      `;
    }
    
    this.dom.newsHooksList.innerHTML = html;
    this.attachNewsEventListenersToContainer(this.dom.newsHooksList);
    
    // Attach Show More button listener
    const showMoreBtn = this.dom.newsHooksList.querySelector('.pr-show-more-news-btn');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => this.showMoreNews());
    }
  }

  attachNewsEventListenersToContainer(container) {
    container.querySelectorAll('.pr-use-hook-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.newsIndex);
        
        // Immediate visual feedback
        btn.disabled = true;
        btn.innerHTML = `
          <svg class="spinning" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
            <path d="M12 2 A10 10 0 0 1 22 12" opacity="0.75"></path>
          </svg>
          Adding...
        `;
        
        this.useAsHook(this.newsHooks[index], btn);
      });
    });
  }

  attachNewsEventListeners() {
    // Deprecated - kept for compatibility
  }

  async useAsHook(newsItem, btn) {
    // 1. IMMEDIATELY switch to Sources tab (instant navigation)
    const sourcesTab = document.querySelector('.pr-left-tab[data-left-tab="sources"]');
    if (sourcesTab) sourcesTab.click();
    
    // 2. Build source object
    const sourceContent = `
NEWS HOOK: ${newsItem.headline}

OUTLET: ${newsItem.outlet}
DATE: ${newsItem.date}
URL: ${newsItem.url}

SUMMARY:
${newsItem.summary}

RELEVANCE TO GLOSSI:
${newsItem.relevance}
    `.trim();

    const source = {
      id: 'src_news_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: `News Hook: ${newsItem.headline}`,
      type: 'text',
      content: sourceContent,
      url: newsItem.url,
      createdAt: new Date().toISOString(),
      selected: true,
      loading: true
    };

    // 3. Add to sources IMMEDIATELY (optimistic update)
    this.prAgent.sources.unshift(source);
    this.prAgent.renderSources();
    this.prAgent.updateGenerateButton();

    // 4. Sync with API in background (non-blocking)
    fetch('/api/pr/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    })
    .then(() => {
      // Mark as successfully saved
      delete source.loading;
      this.prAgent.renderSources();
    })
    .catch(error => {
      console.error('Error saving news hook as source:', error);
      // Remove from UI on error
      this.prAgent.sources = this.prAgent.sources.filter(s => s.id !== source.id);
      this.prAgent.renderSources();
      this.prAgent.updateGenerateButton();
    })
    .finally(() => {
      // Re-enable button
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Use as Hook
        `;
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// =========================================
// CALENDAR MANAGER
// =========================================

class CalendarManager {
  constructor(prAgent) {
    this.prAgent = prAgent;
    this.calendarItems = [];
  }

  async init() {
    this.setupDOM();
    this.setupEventListeners();
    await this.loadCalendarItems();
    this.renderCalendar();
  }

  setupDOM() {
    this.dom = {
      timeline: document.getElementById('pr-calendar-timeline'),
      addBtn: document.getElementById('pr-add-calendar-item')
    };
  }

  setupEventListeners() {
    this.dom.addBtn?.addEventListener('click', () => this.showAddItemModal());
  }

  async loadCalendarItems() {
    try {
      const response = await fetch('/api/pr/calendar');
      const data = await response.json();
      if (data.success) {
        this.calendarItems = data.items;
      }
    } catch (error) {
      console.error('Error loading calendar items:', error);
    }
  }

  renderCalendar() {
    if (!this.dom.timeline) return;

    if (this.calendarItems.length === 0) {
      this.dom.timeline.innerHTML = `
        <div class="pr-calendar-empty">
          <p>No items scheduled</p>
          <p class="pr-empty-hint">Add content to your calendar</p>
        </div>
      `;
      return;
    }

    // Group items by week
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(thisWeekStart.getDate() + 7);

    const thisWeek = [];
    const nextWeek = [];
    const later = [];

    this.calendarItems.forEach(item => {
      const itemDate = new Date(item.date);
      if (itemDate < nextWeekStart) {
        if (itemDate >= thisWeekStart) {
          thisWeek.push(item);
        } else {
          // Past items go in "this week" for now
          thisWeek.push(item);
        }
      } else if (itemDate < new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        nextWeek.push(item);
      } else {
        later.push(item);
      }
    });

    let html = '';

    if (thisWeek.length > 0) {
      html += '<div class="pr-calendar-week"><h4 class="pr-calendar-week-title">This Week</h4>';
      thisWeek.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
        html += this.renderCalendarItem(item);
      });
      html += '</div>';
    }

    if (nextWeek.length > 0) {
      html += '<div class="pr-calendar-week"><h4 class="pr-calendar-week-title">Next Week</h4>';
      nextWeek.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
        html += this.renderCalendarItem(item);
      });
      html += '</div>';
    }

    if (later.length > 0) {
      html += '<div class="pr-calendar-week"><h4 class="pr-calendar-week-title">Later</h4>';
      later.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
        html += this.renderCalendarItem(item);
      });
      html += '</div>';
    }

    this.dom.timeline.innerHTML = html;

    // Add event listeners
    this.dom.timeline.querySelectorAll('.pr-calendar-item').forEach(el => {
      el.addEventListener('click', () => {
        const itemId = el.dataset.itemId;
        this.openCalendarItem(itemId);
      });
    });

    this.dom.timeline.querySelectorAll('.pr-calendar-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        await this.deleteCalendarItem(itemId);
      });
    });
  }

  renderCalendarItem(item) {
    const date = new Date(item.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const statusClasses = {
      'not_started': 'pr-status-not-started',
      'draft_ready': 'pr-status-draft',
      'sent': 'pr-status-sent',
      'published': 'pr-status-published'
    };

    const statusLabels = {
      'not_started': 'Not Started',
      'draft_ready': 'Draft Ready',
      'sent': 'Sent',
      'published': 'Published'
    };

    const typeIcons = {
      'linkedin_post': '💼',
      'tweet_thread': '𝕏',
      'blog_post': '📝',
      'press_release': '📰',
      'media_pitch': '📧',
      'pitch': '📧',
      'custom': '📌'
    };

    return `
      <div class="pr-calendar-item ${statusClasses[item.status] || ''}" data-item-id="${item.id}">
        <div class="pr-calendar-item-date">
          <span class="pr-calendar-day">${dayName}</span>
          <span class="pr-calendar-date-num">${dateStr}</span>
        </div>
        <div class="pr-calendar-item-content">
          <div class="pr-calendar-item-header">
            <span class="pr-calendar-type-icon">${typeIcons[item.type] || '📌'}</span>
            <span class="pr-calendar-item-title">${this.escapeHtml(item.title)}</span>
          </div>
          <span class="pr-calendar-status-badge">${statusLabels[item.status] || item.status}</span>
        </div>
        <button class="pr-calendar-delete" data-item-id="${item.id}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }

  showAddItemModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>Add Calendar Item</h2>
          <button class="btn-icon modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="notes-input-section">
            <label for="cal-item-date">Date</label>
            <input type="date" id="cal-item-date" class="input" required>
          </div>
          <div class="notes-input-section">
            <label for="cal-item-type">Type</label>
            <select id="cal-item-type" class="input">
              <option value="linkedin_post">LinkedIn Post</option>
              <option value="tweet_thread">Tweet Thread</option>
              <option value="blog_post">Blog Post</option>
              <option value="press_release">Press Release</option>
              <option value="media_pitch">Media Pitch</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div class="notes-input-section">
            <label for="cal-item-title">Title</label>
            <input type="text" id="cal-item-title" class="input" placeholder="e.g., LinkedIn post - Why AI Wrappers Will Lose" required>
          </div>
          <div class="notes-input-section">
            <label for="cal-item-notes">Notes (optional)</label>
            <textarea id="cal-item-notes" class="input textarea" rows="3" placeholder="Additional notes..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cal-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="cal-modal-save">Add to Calendar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Set default date to today
    document.getElementById('cal-item-date').valueAsDate = new Date();

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cal-modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelector('#cal-modal-save').addEventListener('click', async () => {
      const date = document.getElementById('cal-item-date').value;
      const type = document.getElementById('cal-item-type').value;
      const title = document.getElementById('cal-item-title').value.trim();
      const notes = document.getElementById('cal-item-notes').value.trim();

      if (!date || !title) {
        this.prAgent.showToast('Date and title are required', 'error');
        return;
      }

      const item = {
        id: 'cal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date,
        type,
        title,
        content_id: null,
        pitch_id: null,
        status: 'not_started',
        notes
      };

      try {
        await fetch('/api/pr/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });

        this.calendarItems.push(item);
        this.renderCalendar();
        modal.remove();
        this.prAgent.showToast('Calendar item added', 'success');
      } catch (error) {
        console.error('Error adding calendar item:', error);
        this.prAgent.showToast('Failed to add calendar item', 'error');
      }
    });
  }

  async deleteCalendarItem(itemId) {
    // Optimistic delete - remove immediately, no confirmation
    this.calendarItems = this.calendarItems.filter(i => i.id !== itemId);
    this.renderCalendar();
    
    // Sync delete with API in background
    fetch(`/api/pr/calendar/${itemId}`, {
      method: 'DELETE'
    }).catch(error => {
      console.error('Error deleting calendar item:', error);
    });
  }

  openCalendarItem(itemId) {
    const item = this.calendarItems.find(i => i.id === itemId);
    if (!item) return;

    // If linked to content, open workspace
    if (item.content_id) {
      const output = this.prAgent.outputs.find(o => o.id === item.content_id);
      if (output) {
        this.prAgent.loadOutput(output.id);
        // Switch to workspace tab on mobile
        const workspaceTab = document.querySelector('.pr-mobile-tab[data-tab="workspace"]');
        if (workspaceTab) workspaceTab.click();
      }
    }
    // Otherwise show edit modal (simplified for now)
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export { PRAgent, CONTENT_TYPES, WizardManager, MediaManager, NewsMonitor, CalendarManager };
