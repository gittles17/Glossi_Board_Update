import { startLoaderStatus, stopLoaderStatus } from './loader-status.js';

/**
 * PR Agent Module
 * Handles PR content generation, source management, and strategy recommendations
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const MODEL_FOR_TYPE = {
  tweet: 'claude-sonnet-4-20250514',
  linkedin_post: 'claude-opus-4-6',
  blog_post: 'claude-opus-4-6',
  email_blast: 'claude-opus-4-6',
  product_announcement: 'claude-opus-4-6',
  talking_points: 'claude-opus-4-6',
  investor_snippet: 'claude-opus-4-6',
  custom: 'claude-opus-4-6'
};

const PR_SYSTEM_PROMPT = `You are Glossi's communications strategist. You write like the teams at Linear and Cursor communicate. Study how they work:

⚠️ CRITICAL: The company name is "Glossi" (with an "i"). NEVER spell it as "Glossy". This is a common error - always use "Glossi".

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
- Company name: "Glossi" (always with an "i", never "Glossy")
- First AI-native 3D product visualization platform
- Core architecture: compositing, not generation. The product 3D asset stays untouched. AI generates scenes around it.
- Analogy: green screen for products. The product is the actor. Sacred. Untouchable.
- Built on Unreal Engine 5, runs in browser. No plugins, no installs.
- World models (emerging in 2026) validate Glossi's architectural decisions. Legacy tools will retrofit. Glossi is ready.
- Target customers: enterprise brands, e-commerce, CPG, fashion, beauty
- Traction: 50+ brands, $200K pipeline, 80% photo cost reduction
- Company has features rolling out continuously. Communicate through momentum, not proclamation.

CONTENT TYPE GUIDANCE:

Product Announcement: Changelog style. What shipped. What it does. One sentence on why it matters. Move on.

LinkedIn Post: Perspective piece energy. Share a take. Back it with what you've built. No hashtag spam. One or two max.

Blog Post: Write like Linear's "Now" blog. First-person where appropriate. Opinionated. Substantive. Not content marketing. Real thinking about real problems in the space. This covers op-eds, press releases, and bylined articles too. Adjust formality based on the description provided.

Tweet (for X): Study how Cursor and Linear use X. They mix formats. Not every post is text. The feed has rhythm: a sharp take, then a product screenshot, then a blog link, then an infographic. Match that energy.

IMPORTANT: For tweets, you MUST include "tweet_format" in your JSON response. It goes alongside "content", "citations", and "strategy" in the same response object.

TWEET FORMATS (you MUST pick one, default to VISUAL when the topic involves data, a comparison, or a claim worth illustrating):
- TEXT: One single tweet, no line breaks. HARD LIMIT: 280 characters. Count every character. If your draft exceeds 280, rewrite shorter. Punchy, opinionated, shareable. One sharp observation that makes people stop scrolling. No hashtags.
- VISUAL: Short text (1-2 sentences) paired with an infographic. HARD LIMIT: 280 characters. The visual carries the argument. The text sets it up. The infographic will be auto-generated by AI based on the tweet text.
- LINK: 1-2 sentence hook that teases the linked content. HARD LIMIT: 257 characters (the attached URL will consume 23 characters via t.co shortening). Not "check out our latest post." More "We wrote about why X matters." The user will attach the URL separately.

CRITICAL RULES FOR TWEETS:
- ABSOLUTE CHARACTER LIMIT: No tweet may exceed 280 characters. This is a hard platform constraint. Count your output before returning it. If it is over 280 characters, you MUST rewrite it shorter. There are no exceptions.
- All formats must be a SINGLE tweet. No paragraph breaks. No multiple tweets.
- "tweet_format" is REQUIRED in the response JSON for all tweet content.
- Default to VISUAL when the topic has data, numbers, a comparison, or a claim that could be illustrated.

Email: For subscriber blasts AND journalist pitches. Adjust tone based on audience. For press: open with why this matters to their beat, get to the angle in the first sentence, keep it under 150 words. For subscribers: key insight distilled, one clear takeaway, link to deeper content.

Talking Points: Bullet format. Each point is self-contained. Ordered by importance. Also covers briefing docs and internal prep material.

When generating content, first analyze the provided sources, then produce the requested content type with proper citations. After generating, provide distribution strategy recommendations.

RESPONSE FORMAT:
Return your response in this exact JSON structure:
{
  "content": "The generated PR content with [Source X] citations inline",
  "tweet_format": "(REQUIRED for tweets) text|visual|link",
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

function glossiLoaderSVG(extraClass = '') {
  const cls = extraClass ? `glossi-loader ${extraClass}` : 'glossi-loader';
  const count = 24;
  const ticks = Array.from({length: count}, (_, i) => {
    const angle = (i / count) * 360;
    const rad = angle * Math.PI / 180;
    const x1 = (50 + 40 * Math.cos(rad)).toFixed(1);
    const y1 = (50 + 40 * Math.sin(rad)).toFixed(1);
    const x2 = (50 + 48 * Math.cos(rad)).toFixed(1);
    const y2 = (50 + 48 * Math.sin(rad)).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1" stroke-linecap="round" class="gl-tick gl-tick-${i}"/>`;
  }).join('');
  return `<div class="${cls}"><svg class="glossi-loader-dots" viewBox="0 0 100 100">${ticks}</svg></div>`;
}

const CONTENT_TYPES = [
  { id: 'tweet', label: 'Tweet' },
  { id: 'linkedin_post', label: 'LinkedIn Post' },
  { id: 'blog_post', label: 'Blog Post' },
  { id: 'email_blast', label: 'Email' },
  { id: 'product_announcement', label: 'Product Announcement' },
  { id: 'talking_points', label: 'Talking Points' },
  { id: 'investor_snippet', label: 'Investor Update Snippet' },
  { id: 'custom', label: 'Custom' }
];

function normalizeContentType(type) {
  if (type === 'tweet_thread' || type === 'twitter_thread') return 'tweet';
  return type;
}

class PRAgent {
  constructor() {
    this.sources = [];
    this.outputs = [];
    this.settings = {};
    this.currentOutput = null;
    this._viewingDraftIndex = 0;
    this._editSaveDebounce = null;
    this.isGenerating = false;
    this.apiKey = null;
    this.openaiApiKey = null;
    this.folders = [];
    this.expandedFolders = {};
    this.isDraggingSource = false;
    this.phaseFilter = 'edit';
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

  async streamContent({ model, max_tokens, system, messages, onChunk, onDone, onError }) {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens, system, messages })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Stream request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();

        if (payload === '[DONE]') {
          if (onDone) onDone(accumulated);
          return accumulated;
        }

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            if (onError) onError(new Error(parsed.error));
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            accumulated += parsed.text;
            if (onChunk) onChunk(parsed.text, accumulated);
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
    }

    if (onDone) onDone(accumulated);
    return accumulated;
  }

  async init() {
    await this.loadData();
    this.setupDOM();
    this.setupEventListeners();
    this.renderSources();
    this.updateGenerateButton();
    
    // Initialize wizard
    this.wizard = new WizardManager(this);
    await this.wizard.init();
    
    // Initialize news monitor FIRST (faster, more relevant content)
    this.newsMonitor = new NewsMonitor(this);
    await this.newsMonitor.init();
    
    // Restore stories from saved outputs (rebuild tabs from persisted content)
    this.newsMonitor.restoreStoriesFromOutputs(this.outputs);
    
    // Initialize media manager
    this.mediaManager = new MediaManager(this);
    await this.mediaManager.init();
    
    // Initialize calendar manager
    this.calendarManager = new CalendarManager(this);
    await this.calendarManager.init();
    
    // Initialize angle manager
    this.angleManager = new AngleManager(this);
    await this.angleManager.init();
    
    // Initialize distribute manager
    this.distributeManager = new DistributeManager(this);
    await this.distributeManager.init();
    
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
        <i class="ph-light ph-pencil-simple"></i>
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
      <i class="ph-light ph-check"></i>
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
    // Clear previous interval if re-initialized
    if (this._apiKeyInterval) clearInterval(this._apiKeyInterval);
    // Check server for API key updates every 10 seconds
    this._apiKeyInterval = setInterval(async () => {
      const previousKey = this.apiKey;
      
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const serverSettings = await response.json();
          if (serverSettings.hasAnthropicKey) {
            this.apiKey = this.apiKey || 'env';
          }
          if (serverSettings.hasOpenAIKey) {
            this.openaiApiKey = this.openaiApiKey || 'env';
          }
          // If key status changed, update UI
          if ((previousKey === null && this.apiKey) || (previousKey && !this.apiKey)) {
            this.updateGenerateButton();
          }
        }
      } catch (e) {
        // Ignore network errors during polling
      }
    }, 10000);
  }

  async loadData() {
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
      this.sources = [];
    }

    // Clean up auto-added news hook sources (one-time migration)
    const beforeCount = this.sources.length;
    this.sources = this.sources.filter(s => !s.id || !s.id.startsWith('src_news_'));

    // Migrate ungrouped sources to Content Sources folder
    let needsSave = this.sources.length < beforeCount;
    this.sources.forEach(s => {
      if (!s.folder || (s.folder !== 'About Glossi' && s.folder !== 'Content Sources')) {
        // Legacy sources without a system folder get moved to Content Sources
        if (!s.folder) {
          s.folder = 'Content Sources';
          needsSave = true;
        }
      }
    });
    if (needsSave) {
      this.saveSources();
    }
    
    // Load outputs from API
    try {
      const response = await fetch('/api/pr/outputs');
      const data = await response.json();
      if (data.success) {
        this.outputs = data.outputs.map(o => {
          if (o.content_type) o.content_type = normalizeContentType(o.content_type);
          return o;
        });
      } else {
        this.outputs = [];
      }
    } catch (e) {
      console.error('Error loading outputs from API:', e);
      this.outputs = [];
    }
    
    // Load PR settings from API
    try {
      const response = await fetch('/api/pr/settings');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.settings) {
          this.settings = result.settings;
          this.folders = result.settings.folders || [];
          this.expandedFolders = result.settings.expandedFolders || {};
        } else {
          this.settings = {};
          this.folders = [];
          this.expandedFolders = {};
        }
      } else {
        this.settings = {};
        this.folders = [];
        this.expandedFolders = {};
      }
    } catch (e) {
      this.settings = {};
      this.folders = [];
      this.expandedFolders = {};
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
    
    // If no environment keys, settings will be loaded from server via storage module
    // (no localStorage fallback)
    
    this.isGenerating = false;
    
    // Force button state update after API key is loaded
    if (this.dom && this.dom.generateBtn) {
      this.updateGenerateButton();
    }
  }

  async saveSources() {
    // Save folder settings to API
    try {
      this.settings.folders = this.folders;
      this.settings.expandedFolders = this.expandedFolders;
      
      await fetch('/api/pr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: this.settings })
      });
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
      await fetch('/api/pr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: this.settings })
      });
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
      generateBtnMobile: document.getElementById('pr-generate-btn-mobile'),
      regenerateBtn: document.getElementById('pr-regenerate-btn'),
      workspace: document.getElementById('pr-workspace-content'),
      workspaceEmpty: document.getElementById('pr-workspace-empty'),
      workspaceGenerated: document.getElementById('pr-workspace-generated'),
      generatedContent: document.getElementById('pr-generated-content'),
      loadingState: document.getElementById('pr-loading-state'),
      workspaceChat: document.getElementById('pr-workspace-chat'),
      toneBtn: document.getElementById('pr-tone-btn'),
      copyBtn: document.getElementById('pr-copy-btn'),
      exportBtn: document.getElementById('pr-export-btn'),
      exportMenu: document.getElementById('pr-export-menu'),
      strategyPanel: document.getElementById('pr-right-panel-content'),
      strategyEmpty: document.getElementById('pr-strategy-empty'),
      contentList: document.getElementById('pr-content-list'),
      contentEmpty: document.getElementById('pr-content-empty'),
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

    // Folder selector in Add Source modal
    document.querySelectorAll('.pr-source-folder-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.pr-source-folder-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
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
    
    // Phase filter button
    const phaseFilterBtn = document.getElementById('pr-phase-filter-btn');
    const phaseFilterMenu = document.getElementById('pr-phase-filter-menu');
    const phaseFilterText = document.getElementById('pr-phase-filter-text');
    
    if (phaseFilterBtn && phaseFilterMenu) {
      phaseFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = phaseFilterMenu.style.display === 'block';
        phaseFilterMenu.style.display = isVisible ? 'none' : 'block';
      });
      
      phaseFilterMenu.querySelectorAll('.pr-phase-filter-option').forEach(option => {
        option.addEventListener('click', () => {
          this.phaseFilter = option.dataset.phase;
          const labels = { all: 'All Phases', edit: 'Edit', review: 'Review', publish: 'Publish' };
          phaseFilterText.textContent = labels[this.phaseFilter];
          phaseFilterMenu.style.display = 'none';
          if (this.angleManager) this.angleManager.renderContentSection();
        });
      });
      
      // Close menu on outside click
      document.addEventListener('click', () => {
        phaseFilterMenu.style.display = 'none';
      });
    }

    // Generate buttons (desktop and mobile)
    this.dom.generateBtn?.addEventListener('click', () => this.generateContent());
    this.dom.generateBtnMobile?.addEventListener('click', () => this.generateContent());

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

    // Tone button
    this.dom.toneBtn?.addEventListener('click', () => this.openToneModal());

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
    document.getElementById('pr-export-pdf')?.addEventListener('click', () => this.exportAs('pdf'));

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

    // Version pill toggle
    const versionPill = document.getElementById('pr-version-pill');
    const versionMenu = document.getElementById('pr-version-menu');
    if (versionPill && versionMenu) {
      versionPill.addEventListener('click', (e) => {
        e.stopPropagation();
        versionMenu.style.display = versionMenu.style.display === 'none' ? 'block' : 'none';
      });

      versionMenu.addEventListener('click', (e) => {
        // Clear old drafts
        const clearBtn = e.target.closest('.pr-version-menu-clear');
        if (clearBtn) {
          e.stopPropagation();
          this.clearOldDrafts();
          versionMenu.style.display = 'none';
          return;
        }
        // Switch version
        const item = e.target.closest('.pr-version-menu-item');
        if (item && this.currentOutput) {
          // Save current edits before switching
          this.saveCurrentEdits();
          this.saveOutputs();

          const version = parseInt(item.dataset.version);
          const draftIndex = this.currentOutput.drafts.findIndex(d => d.version === version);
          const draft = draftIndex >= 0 ? this.currentOutput.drafts[draftIndex] : null;
          if (draft && this.dom.generatedContent) {
            this._viewingDraftIndex = draftIndex;
            this.dom.generatedContent.innerHTML = `<div class="pr-draft-content">${this.formatContent(draft.content, this.currentOutput.citations)}</div>`;
            versionMenu.querySelectorAll('.pr-version-menu-item').forEach(v => v.classList.remove('active'));
            item.classList.add('active');
            const pillLabel = document.getElementById('pr-version-pill-label');
            if (pillLabel) pillLabel.textContent = item.querySelector('.pr-version-menu-label')?.textContent || `v${version}`;
          }
          versionMenu.style.display = 'none';
        }
      });

      // Close on outside click
      document.addEventListener('click', () => {
        versionMenu.style.display = 'none';
      });
    }

    // Left panel chat input
    const chatInput = document.getElementById('pr-chat-input');
    const sendBtn = document.getElementById('pr-send-btn');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sendChatMessage();
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendChatMessage());
    }

    // Autosave edits in contenteditable area (debounced)
    if (this.dom.generatedContent) {
      this.dom.generatedContent.addEventListener('input', () => {
        clearTimeout(this._editSaveDebounce);
        this._editSaveDebounce = setTimeout(async () => {
          this.saveCurrentEdits();

          if (this.currentOutput?.content_type === 'tweet' && !this._isShorteningTweet) {
            const draft = this.currentOutput.drafts?.[this._viewingDraftIndex || 0];
            if (draft?.content) {
              const maxChars = this.currentOutput.tweet_format === 'link' ? 257 : 280;
              if (draft.content.length > maxChars) {
                this._isShorteningTweet = true;
                const shortened = await this.enforceTweetLimit(draft.content, this.currentOutput.tweet_format);
                draft.content = shortened;
                this.currentOutput.content = shortened;
                const el = this.dom.generatedContent.querySelector('.pr-draft-content');
                if (el) el.innerText = shortened;
                this._isShorteningTweet = false;
              }
            }
          }

          this.saveOutputs();
        }, 2000);
      });
    }

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
    this._editingSourceId = null;
    const modalTitle = document.getElementById('pr-source-modal-title');
    if (modalTitle) modalTitle.textContent = 'Add Source';
    const saveBtn = document.getElementById('pr-source-save');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ph-light ph-plus"></i> Add Source';
    }
    this.dom.sourceModal?.classList.add('visible');
    setTimeout(() => {
      document.getElementById('pr-source-title')?.focus();
    }, 100);
  }

  closeSourceModal() {
    this._editingSourceId = null;
    const modalTitle = document.getElementById('pr-source-modal-title');
    if (modalTitle) modalTitle.textContent = 'Add Source';
    const saveBtn = document.getElementById('pr-source-save');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ph-light ph-plus"></i> Add Source';
    }
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
    this.switchSourceTab('file');
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
    // Reset folder selector to Content Sources
    const folderOptions = document.querySelectorAll('.pr-source-folder-option');
    folderOptions.forEach(opt => {
      const radio = opt.querySelector('input[type="radio"]');
      const isContent = opt.dataset.folder === 'content';
      opt.classList.toggle('selected', isContent);
      if (radio) radio.checked = isContent;
    });
  }

  editSource(id) {
    const source = this.sources.find(s => s.id === id);
    if (!source) return;

    this.resetSourceModal();
    this._editingSourceId = id;

    // Map source type to the correct tab
    const tabType = source.type || 'text';
    const tabMap = { text: 'text', url: 'url', file: 'text', audio: 'text' };
    const activeTab = tabMap[tabType] || 'text';
    this.switchSourceTab(activeTab);

    if (activeTab === 'text') {
      const titleInput = document.getElementById('pr-source-title');
      const textInput = document.getElementById('pr-source-text');
      if (titleInput) titleInput.value = source.title || '';
      if (textInput) textInput.value = source.content || '';
    } else if (activeTab === 'url') {
      const titleInput = document.getElementById('pr-source-title-url');
      const urlInput = document.getElementById('pr-source-url');
      if (titleInput) titleInput.value = source.title || '';
      if (urlInput) urlInput.value = source.url || '';
    }

    // Set correct folder radio
    const folderValue = source.folder === 'About Glossi' ? 'glossi' : 'content';
    document.querySelectorAll('.pr-source-folder-option').forEach(opt => {
      const radio = opt.querySelector('input[type="radio"]');
      const isMatch = opt.dataset.folder === folderValue;
      opt.classList.toggle('selected', isMatch);
      if (radio) radio.checked = isMatch;
    });

    // Update modal title and save button text
    const modalTitle = document.getElementById('pr-source-modal-title');
    if (modalTitle) modalTitle.textContent = 'Edit Source';
    const saveBtn = document.getElementById('pr-source-save');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ph-light ph-check"></i> Save Changes';
    }

    this.dom.sourceModal?.classList.add('visible');
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

    // Edit mode: update existing source
    if (this._editingSourceId) {
      const existing = this.sources.find(s => s.id === this._editingSourceId);
      if (existing) {
        existing.title = autoTitle;
        existing.content = content;
        if (url) existing.url = url;
        if (fileName) existing.fileName = fileName;
        // Update folder from radio
        const editFolderRadio = document.querySelector('input[name="pr-source-folder"]:checked');
        const editFolderValue = editFolderRadio?.value || 'content';
        existing.folder = editFolderValue === 'glossi' ? 'About Glossi' : 'Content Sources';

        try {
          await fetch('/api/pr/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existing)
          });
        } catch (error) {
          // silent
        }

        this._editingSourceId = null;
        this.saveSources();
        this.renderSources();
        this.updateGenerateButton();
        this.closeSourceModal();
        return;
      }
    }

    // Determine which folder based on the radio selection
    const folderRadio = document.querySelector('input[name="pr-source-folder"]:checked');
    const folderValue = folderRadio?.value || 'content';
    const folder = folderValue === 'glossi' ? 'About Glossi' : 'Content Sources';

    const source = {
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: autoTitle,
      type,
      content,
      url: url || undefined,
      fileName: fileName || undefined,
      folder,
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
      // silent
    }
    
    this.saveSources();
    this.renderSources();
    this.updateGenerateButton();
    this.closeSourceModal();

    // Clean up pending data
    this._pendingFileContent = null;
    this._pendingFileName = null;
    this._pendingTranscription = null;

    // Auto-trigger angle analysis if source was added from Custom tab flow
    if (folder === 'Content Sources' && this.newsMonitor && this.newsMonitor._customSourceFlow) {
      this.newsMonitor._customSourceFlow = false;
      this.newsMonitor.triggerAngleAnalysis(source);
    }
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
    const saveBtn = document.getElementById('pr-source-save');
    const originalHTML = saveBtn?.innerHTML;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="ph-light ph-spinner"></i> Fetching...';
    }

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
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
          this.showToast('Could not fetch content from that URL.', 'error');
          return;
        }
      }
      if (!content || content.length < 10) {
        this.showToast('No usable content found at that URL.', 'error');
        return;
      }

      const folderRadio = document.querySelector('input[name="pr-source-folder"]:checked');
      const folderValue = folderRadio?.value || 'content';
      const folder = folderValue === 'glossi' ? 'About Glossi' : 'Content Sources';

      const autoTitle = title || new URL(url).hostname;
      const source = {
        id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        title: autoTitle,
        type: 'url',
        content: content.substring(0, 50000),
        url,
        folder,
        createdAt: new Date().toISOString(),
        selected: true
      };

      this.sources.push(source);

      try {
        await fetch('/api/pr/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(source)
        });
      } catch (error) {
        // silent
      }

      this.saveSources();
      this.renderSources();
      this.updateGenerateButton();
      this.closeSourceModal();

      if (folder === 'Content Sources' && this.newsMonitor && this.newsMonitor._customSourceFlow) {
        this.newsMonitor._customSourceFlow = false;
        this.newsMonitor.triggerAngleAnalysis(source);
      }
    } catch (err) {
      this.showToast('Failed to fetch URL content. Please try again.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML || '<i class="ph-light ph-plus"></i> Add Source';
      }
    }
  }

  async deleteSource(id) {
    // Optimistic delete - remove immediately
    const removedSource = this.sources.find(s => s.id === id);
    this.sources = this.sources.filter(s => s.id !== id);
    this.renderSources();
    this.updateGenerateButton();
    
    // Sync delete with API in background, restore on failure
    try {
      const response = await fetch(`/api/pr/sources/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Server delete failed');
    } catch (error) {
      if (removedSource) {
        this.sources.push(removedSource);
        this.renderSources();
        this.updateGenerateButton();
      }
    }
    
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
      } catch (error) { /* silent */ }
      
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
        <i class="ph-light ph-pencil-simple"></i>
        Rename
      </button>
      <button class="pr-context-menu-item" data-action="delete">
        <i class="ph-light ph-trash"></i>
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
    if (this.newsMonitor) this.newsMonitor.updateSourcesCount();

    if (this.sources.length === 0) {
      this.dom.sourcesList.innerHTML = '';
      if (this.dom.sourcesEmpty) this.dom.sourcesEmpty.style.display = 'block';
      return;
    }

    if (this.dom.sourcesEmpty) this.dom.sourcesEmpty.style.display = 'none';

    const typeIcons = {
      text: '<i class="ph-light ph-file-text"></i>',
      url: '<i class="ph-light ph-link"></i>',
      file: '<i class="ph-light ph-file"></i>',
      audio: '<i class="ph-light ph-microphone"></i>'
    };

    const renderSourceItem = (source, isBackground = false) => {
      const rawDate = source.createdAt || source.created_at || source.addedAt;
      const parsed = rawDate ? new Date(rawDate) : null;
      const date = parsed && !isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const loadingClass = source.loading ? 'loading' : '';
      const loadingIndicator = source.loading ? `
        <div class="pr-source-loading-overlay">
          ${glossiLoaderSVG('glossi-loader-xs')}
          <span>Saving...</span>
        </div>
      ` : '';
      return `
        <div class="pr-source-item ${loadingClass}" data-source-id="${source.id}" draggable="true">
          ${loadingIndicator}
          <div class="pr-source-info" data-action="edit-source" data-id="${source.id}">
            <div class="pr-source-header">
              <span class="pr-source-type-icon">${typeIcons[source.type] || typeIcons.text}</span>
              <span class="pr-source-title">${this.escapeHtml(source.title)}</span>
            </div>
            ${date ? `<div class="pr-source-meta"><span class="pr-source-date">${date}</span></div>` : ''}
          </div>
          <button class="pr-source-delete" data-action="delete" data-id="${source.id}" title="Delete source" ${source.loading ? 'disabled' : ''}>
            <i class="ph-light ph-x"></i>
          </button>
        </div>`;
    };

    // Separate sources into system folders
    const glossiSources = this.sources.filter(s => s.folder === 'About Glossi');
    const contentSources = this.sources.filter(s => s.folder === 'Content Sources');
    const otherSources = this.sources.filter(s => s.folder && s.folder !== 'About Glossi' && s.folder !== 'Content Sources');
    const ungrouped = this.sources.filter(s => !s.folder);

    const isGlossiExpanded = this.expandedFolders['About Glossi'] !== false;
    const isContentExpanded = this.expandedFolders['Content Sources'] !== false;

    let html = '';

    // About Glossi folder (always first)
    html += `
      <div class="pr-folder pr-system-folder ${isGlossiExpanded ? 'expanded' : ''}" data-folder="About Glossi">
        <div class="pr-folder-header">
          <i class="ph-light ph-caret-right pr-folder-chevron"></i>
          <i class="ph-light ph-buildings pr-folder-icon"></i>
          <span class="pr-folder-name">About Glossi</span>
          <span class="pr-folder-count">${glossiSources.length}</span>
        </div>
        <div class="pr-folder-contents">
          ${glossiSources.map(s => renderSourceItem(s, true)).join('')}
          ${glossiSources.length === 0 ? '<p class="pr-folder-empty-hint">Add company info, pitch decks, product details</p>' : ''}
        </div>
      </div>
    `;

    // Content Sources folder (always second)
    html += `
      <div class="pr-folder pr-system-folder ${isContentExpanded ? 'expanded' : ''}" data-folder="Content Sources">
        <div class="pr-folder-header">
          <i class="ph-light ph-caret-right pr-folder-chevron"></i>
          <i class="ph-light ph-file-text pr-folder-icon"></i>
          <span class="pr-folder-name">Content Sources</span>
          <span class="pr-folder-count">${contentSources.length}</span>
        </div>
        <div class="pr-folder-contents">
          ${contentSources.map(s => renderSourceItem(s)).join('')}
          ${contentSources.length === 0 ? '<p class="pr-folder-empty-hint">Add source material to generate content from</p>' : ''}
        </div>
      </div>
    `;

    // Other user-created folders (legacy compat)
    const otherFolders = {};
    otherSources.forEach(s => {
      if (!otherFolders[s.folder]) otherFolders[s.folder] = [];
      otherFolders[s.folder].push(s);
    });
    Object.keys(otherFolders).sort().forEach(folderName => {
      const folderSources = otherFolders[folderName];
      const isExpanded = this.expandedFolders[folderName];
      html += `
        <div class="pr-folder ${isExpanded ? 'expanded' : ''}" data-folder="${this.escapeHtml(folderName)}">
          <div class="pr-folder-header">
            <i class="ph-light ph-caret-right pr-folder-chevron"></i>
            <i class="ph-light ph-folder pr-folder-icon"></i>
            <span class="pr-folder-name">${this.escapeHtml(folderName)}</span>
            <span class="pr-folder-count">${folderSources.length}</span>
          </div>
          <div class="pr-folder-contents">
            ${folderSources.map(s => renderSourceItem(s)).join('')}
          </div>
        </div>
      `;
    });

    // Ungrouped sources (migrate to Content Sources on next save)
    html += ungrouped.map(s => renderSourceItem(s)).join('');

    const dropIndicator = '<div class="pr-drop-indicator" id="pr-drop-indicator"><i class="ph-light ph-upload-simple"></i><span>Drop files here</span></div>';
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
      if (action === 'delete') {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteSource(el.dataset.id);
        });
      } else if (action === 'edit-source') {
        el.addEventListener('click', () => {
          this.editSource(el.dataset.id);
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

    // Filter outputs by phase
    const filtered = this.phaseFilter === 'all' 
      ? this.outputs 
      : this.outputs.filter(o => (o.phase || 'edit') === this.phaseFilter);

    // Group outputs by angleId
    const groups = new Map();
    const ungrouped = [];
    filtered.forEach(output => {
      if (output.angleId) {
        if (!groups.has(output.angleId)) {
          groups.set(output.angleId, { angleId: output.angleId, outputs: [], title: null, latestDate: 0 });
        }
        const group = groups.get(output.angleId);
        group.outputs.push(output);
        // Use angleTitle from output, or look up from angle manager
        if (!group.title) {
          group.title = output.angleTitle || this.getAngleTitle(output.angleId) || output.title;
        }
        const created = new Date(output.createdAt).getTime() || 0;
        if (created > group.latestDate) group.latestDate = created;
      } else {
        ungrouped.push(output);
      }
    });

    // Combine groups and ungrouped, sort by most recent
    const allEntries = [];
    groups.forEach(group => allEntries.push({ type: 'angle', ...group }));
    ungrouped.forEach(output => allEntries.push({ 
      type: 'single', 
      output, 
      latestDate: new Date(output.createdAt).getTime() || 0 
    }));
    allEntries.sort((a, b) => b.latestDate - a.latestDate);

    // Update count badge (number of angle groups + ungrouped items)
    const countBadge = document.getElementById('pr-history-count');
    if (countBadge) {
      countBadge.textContent = allEntries.length;
      countBadge.style.display = allEntries.length > 0 ? 'inline-flex' : 'none';
    }

    if (allEntries.length === 0) {
      this.dom.historyList.innerHTML = '';
      if (this.dom.historyEmpty) this.dom.historyEmpty.style.display = 'block';
      // Reset workspace when no history remains
      if (this.angleManager) this.angleManager.resetWorkspace();
      return;
    }

    if (this.dom.historyEmpty) this.dom.historyEmpty.style.display = 'none';

    this.dom.historyList.innerHTML = allEntries.map(entry => {
      if (entry.type === 'angle') {
        const pieceCount = entry.outputs.length;
        const pieceTypes = entry.outputs.map(o => {
          const label = CONTENT_TYPES.find(t => t.id === o.content_type)?.label || o.content_type;
          return label;
        }).join(', ');
        const dateText = this.formatHistoryDate(entry.latestDate);
        return `
          <div class="pr-history-item pr-history-angle-group" data-angle-id="${entry.angleId}">
            <div class="pr-history-info">
              <span class="pr-history-title">${this.escapeHtml(entry.title || 'Untitled Angle')}</span>
              <span class="pr-history-meta">
                <span class="pr-history-pieces">${pieceCount} piece${pieceCount !== 1 ? 's' : ''}</span>
                <span class="pr-history-date">${dateText}</span>
              </span>
              <span class="pr-history-piece-types">${this.escapeHtml(pieceTypes)}</span>
            </div>
            <button class="pr-history-delete" data-angle-delete="${entry.angleId}" title="Delete all pieces">
              <i class="ph-light ph-x"></i>
            </button>
          </div>`;
      } else {
        const output = entry.output;
        const typeLabel = CONTENT_TYPES.find(t => t.id === output.content_type)?.label || output.content_type;
        const dateText = this.formatHistoryDate(entry.latestDate);
        return `
          <div class="pr-history-item" data-output-id="${output.id}">
            <div class="pr-history-info">
              <span class="pr-history-title">${this.escapeHtml(output.title || 'Untitled')}</span>
              <span class="pr-history-meta">
                <span class="pr-history-type">${typeLabel}</span>
                <span class="pr-history-date">${dateText}</span>
              </span>
            </div>
            <button class="pr-history-delete" data-history-delete="${output.id}" title="Delete">
              <i class="ph-light ph-x"></i>
            </button>
          </div>`;
      }
    }).join('');

    // Click handlers for angle groups (restore all tabs)
    this.dom.historyList.querySelectorAll('.pr-history-angle-group').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-angle-delete]')) return;
        const angleId = item.dataset.angleId;
        const group = groups.get(angleId);
        if (group && this.angleManager) {
          this.angleManager.restoreAngleFromHistory(angleId, group.outputs);
        }
      });
    });

    // Click handlers for single (ungrouped) items
    this.dom.historyList.querySelectorAll('.pr-history-item:not(.pr-history-angle-group)').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-history-delete]')) return;
        const outputId = item.dataset.outputId;
        if (outputId) this.loadOutput(outputId);
      });
    });

    // Delete handlers for angle groups (delete all outputs for that angle)
    this.dom.historyList.querySelectorAll('[data-angle-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const angleId = btn.dataset.angleDelete;
        const toDelete = this.outputs.filter(o => o.angleId === angleId);
        this.outputs = this.outputs.filter(o => o.angleId !== angleId);
        this.renderHistory();

        // If the active angle is the one being deleted, reset
        if (this.angleManager && this.angleManager.activeAngle && this.angleManager.activeAngle.id === angleId) {
          this.angleManager.resetWorkspace();
        }

        // Sync deletes with API
        toDelete.forEach(output => {
          fetch(`/api/pr/outputs/${output.id}`, { method: 'DELETE' }).catch(() => {});
        });
        this.saveOutputs();
      });
    });

    // Delete handlers for single items
    this.dom.historyList.querySelectorAll('[data-history-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const outputId = btn.dataset.historyDelete;
        if (!outputId) return;
        this.outputs = this.outputs.filter(o => o.id !== outputId);
        this.renderHistory();
        fetch(`/api/pr/outputs/${outputId}`, { method: 'DELETE' }).catch(() => {});
        this.saveOutputs();
      });
    });
  }

  getAngleTitle(angleId) {
    if (!this.angleManager) return null;
    const angle = this.angleManager.angles.find(a => a.id === angleId) ||
                  this.angleManager.defaultAngles.find(a => a.id === angleId);
    return angle ? angle.title : null;
  }

  formatHistoryDate(timestamp) {
    if (!timestamp) return 'Recently';
    try {
      const now = Date.now();
      const diffMs = now - timestamp;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  }
  
  getPhaseConfig(phase) {
    const configs = {
      edit: {
        label: 'Edit',
        icon: '<i class="ph-light ph-pencil-simple"></i>',
        color: '#f59e0b'
      },
      review: {
        label: 'Review',
        icon: '<i class="ph-light ph-eye"></i>',
        color: '#3b82f6'
      },
      publish: {
        label: 'Publish',
        icon: '<i class="ph-light ph-check"></i>',
        color: '#10b981'
      }
    };
    return configs[phase] || configs.edit;
  }
  
  showPhaseMenu(outputId, badge) {
    const existingMenu = document.querySelector('.pr-phase-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'pr-phase-menu';
    menu.innerHTML = `
      <button class="pr-phase-menu-item" data-phase="edit">
        ${this.getPhaseConfig('edit').icon} Edit
      </button>
      <button class="pr-phase-menu-item" data-phase="review">
        ${this.getPhaseConfig('review').icon} Review
      </button>
      <button class="pr-phase-menu-item" data-phase="publish">
        ${this.getPhaseConfig('publish').icon} Publish
      </button>
    `;
    
    const rect = badge.getBoundingClientRect();
    menu.style.top = rect.bottom + 5 + 'px';
    menu.style.left = rect.left + 'px';
    document.body.appendChild(menu);
    
    menu.querySelectorAll('.pr-phase-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.changePhase(outputId, item.dataset.phase);
        menu.remove();
      });
    });
    
    // Close menu on outside click
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  }
  
  async changePhase(outputId, newPhase) {
    const output = this.outputs.find(o => o.id === outputId);
    if (!output) return;
    
    output.phase = newPhase;
    if (this.angleManager) this.angleManager.renderContentSection();
    
    // Save to API
    try {
      await fetch('/api/pr/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(output)
      });
    } catch (error) {
      console.error('Error updating phase:', error);
    }
    
    this.saveOutputs();
  }

  loadOutput(id) {
    const output = this.outputs.find(o => o.id === id);
    if (!output) return;

    this.currentOutput = output;
    if (this.dom.contentType) {
      this.dom.contentType.value = output.content_type;
      const isCustom = output.content_type === 'custom';
      if (this.dom.customPromptWrap) {
        this.dom.customPromptWrap.style.display = isCustom ? 'block' : 'none';
      }
    }

    // Update active tab content if angle tabs are open
    if (this.angleManager && this.angleManager.activeTabId) {
      this.angleManager.tabContent.set(this.angleManager.activeTabId, { loading: false, output });
    }

    // If the output was generated from an angle, update the active angle display
    if (output.angleId && this.angleManager) {
      const angle = this.angleManager.angles.find(a => a.id === output.angleId) ||
                    this.angleManager.defaultAngles.find(a => a.id === output.angleId);
      if (angle) {
        this.angleManager.activeAngle = angle;
        localStorage.setItem('pr_active_angle', JSON.stringify(angle));
        this.angleManager.renderContentSection();
        // Select the angle card
        document.querySelectorAll('.pr-angle-card').forEach(card => {
          card.classList.toggle('selected', card.dataset.angleId === angle.id);
        });
        // Show content section
        if (this.angleManager.collapseSection) {
          this.angleManager.collapseSection('pr-content-body', false);
        }
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

    // Update desktop button
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

    // Update mobile button
    if (this.dom.generateBtnMobile) {
      this.dom.generateBtnMobile.disabled = isDisabled;

      if (!hasApiKey) {
        this.dom.generateBtnMobile.title = 'Configure your Anthropic API key in Settings first';
      } else if (selectedSources.length === 0) {
        this.dom.generateBtnMobile.title = 'Select at least one source to generate content';
      } else {
        this.dom.generateBtnMobile.title = '';
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

    const contentType = this.dom.contentType?.value || 'tweet';
    const typeLabel = CONTENT_TYPES.find(t => t.id === contentType)?.label || contentType;
    const customPrompt = contentType === 'custom' ? (this.dom.customPrompt?.value.trim() || '') : '';

    if (contentType === 'custom' && !customPrompt) {
      return;
    }

    this.isGenerating = true;
    this.updateGenerateButton();
    
    // Switch to workspace tab immediately
    const workspaceTab = document.querySelector('[data-workspace-tab="content"]');
    if (workspaceTab) {
      workspaceTab.click();
    }
    // Also handle mobile tab switch
    const mobileWorkspaceTab = document.querySelector('.pr-mobile-tab[data-tab="workspace"]');
    if (mobileWorkspaceTab) {
      mobileWorkspaceTab.click();
    }
    
    const loaderContext = { tweet: 'tweet', linkedin_post: 'linkedin', blog_post: 'blog', email_blast: 'email', product_announcement: 'product', talking_points: 'talking_points', investor_snippet: 'investor' }[contentType] || 'general';
    this.showLoading(loaderContext);

    const sourcesContext = selectedSources.map((s, i) => {
      return `[Source ${i + 1}] (ID: ${s.id})\nTitle: ${s.title}\nType: ${s.type}\nContent:\n${s.content}\n---`;
    }).join('\n\n');

    let userMessage = `Generate a ${typeLabel} based on the following sources.\n\n`;
    
    if (this.angleContext) {
      userMessage += `STORY ANGLE (use this as your narrative framework):\n${this.angleContext.narrative}\n\n`;
      if (this.angleContext.target) {
        userMessage += `Target: ${this.angleContext.target}\n\n`;
      }
    }
    
    if (customPrompt) {
      userMessage += `Custom instructions: ${customPrompt}\n\n`;
    }
    userMessage += `SOURCES:\n${sourcesContext}`;

    const isTweet = contentType === 'tweet';
    const selectedModel = MODEL_FOR_TYPE[contentType] || 'claude-opus-4-6';
    let streamStarted = false;

    try {
      const rawText = await this.streamContent({
        model: selectedModel,
        max_tokens: isTweet ? 1024 : 8192,
        system: PR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: isTweet ? userMessage + '\n\nREMINDER: The tweet MUST be under 280 characters. Count carefully. This is a hard platform limit.' : userMessage }],
        onChunk: (_chunk, accumulated) => {
          if (!streamStarted) {
            streamStarted = true;
            this.showStreamingWorkspace();
          }
          this.updateStreamingText(accumulated);
        }
      });

      this.finishStreamingWorkspace();

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

      let extractedTitle, strippedContent;
      if (contentType === 'tweet') {
        extractedTitle = typeLabel;
        strippedContent = (parsed.content || '').trim();
      } else {
        extractedTitle = this.extractTitle(parsed.content, typeLabel);
        strippedContent = this._stripTitleFromPlainText(parsed.content, extractedTitle);
      }

      const output = {
        id: 'out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        content_type: contentType,
        title: extractedTitle,
        content: strippedContent,
        sources: selectedSources.map(s => s.id),
        citations: parsed.citations || [],
        strategy: parsed.strategy || null,
        status: 'draft',
        phase: 'edit'
      };

      if (contentType === 'tweet') {
        output.tweet_format = parsed.tweet_format || 'text';
        output.content = await this.enforceTweetLimit(output.content, output.tweet_format);
      }

      this.currentOutput = output;
      this.outputs.push(output);
      
      try {
        await fetch('/api/pr/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(output)
        });
      } catch (error) { /* silent */ }
      
      this.saveOutputs();

      this.renderGeneratedContent(output);
      this.renderStrategy(output.strategy);
      if (this.angleManager) this.angleManager.renderContentSection();
      this.showWorkspace();
      
      if (this.angleManager && this.angleContext) {
        this.angleManager.trackContentCreation(contentType);
      }
      
      this.showSaveConfirmation();

    } catch (err) {
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

  showLoading(context = 'general') {
    if (this.dom.workspaceEmpty) this.dom.workspaceEmpty.style.display = 'none';
    if (this.dom.workspaceGenerated) this.dom.workspaceGenerated.style.display = 'none';
    if (this.dom.loadingState) this.dom.loadingState.style.display = 'flex';
    this._contentLoaderId = startLoaderStatus(this.dom.loadingState, context);
    this.startProgressBar();
  }

  hideLoading() {
    if (this.dom.loadingState) this.dom.loadingState.style.display = 'none';
    stopLoaderStatus(this._contentLoaderId);
    this._contentLoaderId = null;
    this.stopProgressBar();
  }
  
  startProgressBar() {}
  
  stopProgressBar() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  showWorkspace(skipSuggestions = false) {
    this.hideLoading();
    if (this.dom.workspaceEmpty) this.dom.workspaceEmpty.style.display = 'none';
    if (this.dom.workspaceGenerated) this.dom.workspaceGenerated.style.display = 'block';
    if (this.dom.regenerateBtn) this.dom.regenerateBtn.style.display = 'inline-flex';
    if (this.dom.workspaceChat) this.dom.workspaceChat.style.display = 'flex';
    
    // Show workspace actions (version pill, copy, export)
    const actionsEl = document.getElementById('pr-workspace-actions');
    if (actionsEl) actionsEl.style.display = 'flex';
    this.renderVersionPill();
    
    // Switch to workspace tab after generation
    const workspaceTab = document.querySelector('[data-workspace-tab="content"]');
    if (workspaceTab) {
      workspaceTab.click();
    }

    // Generate suggestions for the content area (skip when switching tabs with stored suggestions)
    if (!skipSuggestions) {
      this.generateSuggestions();
    }
  }

  showStreamingWorkspace() {
    this.hideLoading();
    if (this.dom.workspaceEmpty) this.dom.workspaceEmpty.style.display = 'none';
    if (this.dom.workspaceGenerated) this.dom.workspaceGenerated.style.display = 'block';
    if (this.dom.generatedContent) {
      this.dom.generatedContent.innerHTML = '<div class="pr-draft-content pr-streaming-content"></div>';
      this.dom.generatedContent.contentEditable = 'false';
    }
    const actionsEl = document.getElementById('pr-workspace-actions');
    if (actionsEl) actionsEl.style.display = 'none';
    if (this.dom.regenerateBtn) this.dom.regenerateBtn.style.display = 'none';
    if (this.dom.workspaceChat) this.dom.workspaceChat.style.display = 'none';
  }

  updateStreamingText(accumulated) {
    const el = this.dom.generatedContent?.querySelector('.pr-streaming-content');
    if (!el) return;
    const contentMatch = accumulated.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
    if (contentMatch) {
      let text = contentMatch[1];
      try { text = JSON.parse('"' + text + '"'); } catch { /* use raw */ }
      el.textContent = text;
    } else {
      el.textContent = accumulated;
    }
  }

  finishStreamingWorkspace() {
    if (this.dom.generatedContent) {
      this.dom.generatedContent.contentEditable = 'true';
      const streamEl = this.dom.generatedContent.querySelector('.pr-streaming-content');
      if (streamEl) streamEl.classList.remove('pr-streaming-content');
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

  }

  saveCurrentEdits() {
    if (!this.currentOutput?.drafts || this._viewingDraftIndex == null) return;
    const draft = this.currentOutput.drafts[this._viewingDraftIndex];
    if (!draft || !this.dom.generatedContent) return;
    const el = this.dom.generatedContent.querySelector('.pr-draft-content');
    if (el) {
      const edited = el.innerText.trim();
      if (edited && edited !== draft.content) {
        draft.content = edited;
      }
    }
  }

  renderDrafts() {
    if (!this.currentOutput || !this.currentOutput.drafts) return;
    
    const container = this.dom.generatedContent;
    const drafts = this.currentOutput.drafts;
    
    // Always show latest draft and reset viewing index
    this._viewingDraftIndex = 0;
    const latest = drafts[0];
    if (latest) {
      container.innerHTML = `<div class="pr-draft-content">${this.formatContent(latest.content, this.currentOutput.citations)}</div>`;
    }

    // Update version pill in workspace actions
    this.renderVersionPill();

    // Update version history in left panel if available
    if (this.newsMonitor && this.newsMonitor.renderVersionHistory) {
      this.newsMonitor.renderVersionHistory(this.currentOutput);
    }
  }

  async enforceTweetLimit(content, tweetFormat) {
    const maxChars = tweetFormat === 'link' ? 257 : 280;
    let text = (content || '').trim();
    if (text.length <= maxChars) return text;

    for (let i = 0; i < 10; i++) {
      if (text.length <= maxChars) break;
      try {
        const res = await fetch('/api/pr/shorten-tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text, max_chars: maxChars, tweet_format: tweetFormat || 'text' })
        });
        const data = await res.json();
        if (data.success && data.content && data.content.length < text.length) {
          text = data.content.trim();
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    if (text.length > maxChars) {
      const truncated = text.substring(0, maxChars - 1);
      const lastSpace = truncated.lastIndexOf(' ');
      text = lastSpace > maxChars * 0.6 ? truncated.substring(0, lastSpace) + '.' : truncated + '.';
    }

    return text;
  }

  renderVersionPill() {
    const pill = document.getElementById('pr-version-pill');
    const pillLabel = document.getElementById('pr-version-pill-label');
    const menu = document.getElementById('pr-version-menu');
    if (!pill || !menu) return;

    const output = this.currentOutput;
    if (!output || !output.drafts || output.drafts.length === 0) {
      pill.style.display = 'none';
      return;
    }

    pill.style.display = 'inline-flex';
    const drafts = output.drafts;
    pillLabel.textContent = `v${drafts[0].version}`;

    menu.innerHTML = drafts.map((draft, index) => {
      const isLatest = index === 0;
      const timeAgo = this.formatTimeAgo(draft.timestamp);
      const label = isLatest ? 'Latest' : `v${draft.version}`;
      const prompt = draft.prompt ? ` "${this.escapeHtml(draft.prompt)}"` : '';
      return `
        <div class="pr-version-menu-item ${isLatest ? 'active' : ''}" data-version="${draft.version}">
          <span class="pr-version-menu-label">${label}</span>
          <span class="pr-version-menu-time">${timeAgo}</span>
          ${prompt ? `<span class="pr-version-menu-prompt">${prompt}</span>` : ''}
        </div>
      `;
    }).join('') + (drafts.length > 1 ? `
      <div class="pr-version-menu-divider"></div>
      <div class="pr-version-menu-clear" id="pr-version-menu-clear">
        <i class="ph-light ph-trash"></i> Clear old drafts
      </div>
    ` : '');
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

  // =========================================
  // STRATEGY PANEL
  // =========================================

  renderStrategy(strategy) {
    if (!this.dom.strategyPanel) return;

    const distributionSection = document.getElementById('pr-distribution-section');
    
    if (!strategy && !this.angleManager?.activeAngle) {
      this.dom.strategyPanel.innerHTML = `
        <div class="pr-empty-state">
          <div class="pr-empty-icon">🎯</div>
          <h4>No Active Angle Yet</h4>
          <p>Select a story angle from the Strategy tab (left panel) and click "Create Content →" to see your progress here.</p>
        </div>
      `;
      if (distributionSection) distributionSection.style.display = 'block';
      return;
    }

    if (distributionSection) distributionSection.style.display = 'block';

    let html = '';
    
    // Active Angle Tracker (appears when angle is active)
    if (this.angleManager?.activeAngle) {
      const angle = this.angleManager.activeAngle;
      const completedCount = angle.content_plan.filter(item => item.completed).length;
      const totalCount = angle.content_plan.length;
      
      html += `
        <div class="pr-active-angle-display">
          <h4 class="pr-section-subtitle">Active Angle</h4>
          <div class="pr-angle-progress-card">
            <h3 class="pr-angle-progress-title">📋 ${this.escapeHtml(angle.title)}</h3>
            <div class="pr-angle-progress-bar-wrap">
              <div class="pr-angle-progress-bar" style="width: ${(completedCount / totalCount) * 100}%"></div>
            </div>
            <div class="pr-plan-checklist">
              ${angle.content_plan.map(item => `
                <div class="pr-plan-check ${item.completed ? 'done' : ''}">
                  <span class="pr-plan-icon">${item.completed ? '✅' : item.priority === 1 ? '➡️' : '⬜'}</span>
                  <span class="pr-plan-text">${this.angleManager.formatContentType(item.type)}${item.audience ? ` <span class="pr-audience-badge pr-audience-${item.audience}">${item.audience}</span>` : ''} ${this.escapeHtml(item.description)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // Distribution Strategy
    if (strategy && strategy.outlets && strategy.outlets.length > 0) {
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

    // Timing & Hooks (only if strategy exists)
    if (strategy && (strategy.timing || (strategy.hooks && strategy.hooks.length > 0))) {
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

    // Journalist Targets (only if strategy exists)
    if (strategy && strategy.journalistBeats && strategy.journalistBeats.length > 0) {
      html += `<div class="pr-strategy-section">
        <h4 class="pr-strategy-heading">Journalist Targets</h4>
        <p class="pr-strategy-subtext">Look for reporters covering:</p>
        <ul class="pr-strategy-list">
          ${strategy.journalistBeats.map(b => `<li>${this.escapeHtml(b)}</li>`).join('')}
        </ul>
      </div>`;
    }

    // Amplification Playbook (only if strategy exists)
    if (strategy && strategy.amplification) {
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

  openToneModal() {
    const currentTone = this.settings?.['wizard-tone'] || 'understated';
    const toneOptions = [
      { value: 'understated', label: 'Understated and confident (like Linear)' },
      { value: 'technical', label: 'Technical and precise (like Cursor)' },
      { value: 'bold', label: 'Bold and direct (like a founder who knows they\'re right)' },
      { value: 'all', label: 'All of the above' }
    ];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
      <div class="modal" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Tone</h2>
          <button class="btn-icon modal-close"><i class="ph-light ph-x"></i></button>
        </div>
        <div class="modal-body" style="padding: var(--space-5) var(--space-6);">
          <div class="wizard-radio-group">
            ${toneOptions.map(opt => `
              <label class="wizard-radio">
                <input type="radio" name="tone-modal-choice" value="${opt.value}" ${opt.value === currentTone ? 'checked' : ''}>
                <span>${opt.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer" style="padding: var(--space-4) var(--space-6); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: var(--space-2);">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="tone-modal-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#tone-modal-save').addEventListener('click', async () => {
      const selected = modal.querySelector('input[name="tone-modal-choice"]:checked');
      if (!selected) return;

      const newTone = selected.value;
      const oldTone = currentTone;
      const toneChanged = newTone !== oldTone;

      // Collect generated tabs from the current story
      const generatedTabs = this.getGeneratedTabsForToneChange();

      if (toneChanged && generatedTabs.length > 0) {
        modal.remove();
        this.showToneChangeConfirmation(oldTone, newTone, generatedTabs, toneOptions);
      } else {
        await this.applyToneChange(newTone);
        modal.remove();
      }
    });
  }

  async applyToneChange(newTone) {
    if (!this.settings) this.settings = {};
    this.settings['wizard-tone'] = newTone;

    try {
      await fetch('/api/pr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.settings)
      });
    } catch (e) { /* silent */ }

    const voiceSource = this.sources.find(s => s.title === 'Founder Voice & Messaging');
    if (voiceSource && voiceSource.content) {
      voiceSource.content = voiceSource.content.replace(
        /TONE PREFERENCE:\n.+/,
        `TONE PREFERENCE:\n${newTone}`
      );
      this.saveSources();
    }
  }

  getGeneratedTabsForToneChange() {
    const tabs = [];
    const nm = this.newsMonitor;
    if (nm && nm._tabContent && nm._activeContentPlan) {
      for (const [tabId, entry] of nm._tabContent.entries()) {
        if (entry && entry.output && !entry.loading) {
          const planIndex = parseInt(tabId.replace('plan_', ''), 10);
          const planItem = nm._activeContentPlan[planIndex];
          if (planItem) {
            const normalizedType = normalizeContentType(planItem.type);
            const label = CONTENT_TYPES.find(t => t.id === normalizedType)?.label || normalizedType;
            tabs.push({ tabId, entry, planItem, planIndex, label, newsItem: nm._activeNewsItem });
          }
        }
      }
    }
    return tabs;
  }

  showToneChangeConfirmation(oldTone, newTone, generatedTabs, toneOptions) {
    const oldLabel = toneOptions.find(t => t.value === oldTone)?.label || oldTone;
    const newLabel = toneOptions.find(t => t.value === newTone)?.label || newTone;

    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal-overlay visible';
    confirmModal.innerHTML = `
      <div class="modal" style="max-width: 460px;">
        <div class="modal-header">
          <h2>Regenerate in new tone?</h2>
          <button class="btn-icon modal-close"><i class="ph-light ph-x"></i></button>
        </div>
        <div class="modal-body" style="padding: var(--space-5) var(--space-6);">
          <p class="pr-tone-confirm-change">${this.escapeHtml(oldLabel)} <i class="ph-light ph-arrow-right"></i> ${this.escapeHtml(newLabel)}</p>
          <p class="pr-tone-confirm-desc">${generatedTabs.length} piece${generatedTabs.length > 1 ? 's' : ''} will be regenerated. Each saves as a new draft.</p>
          <ul class="pr-tone-confirm-list">
            ${generatedTabs.map(t => `<li><span class="pr-tone-confirm-type">${this.escapeHtml(t.label)}</span></li>`).join('')}
          </ul>
        </div>
        <div class="modal-footer" style="padding: var(--space-4) var(--space-6); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: var(--space-2);">
          <button class="btn btn-secondary" id="tone-confirm-cancel">Cancel</button>
          <button class="btn btn-secondary" id="tone-confirm-save-only">Just Save Tone</button>
          <button class="btn btn-primary" id="tone-confirm-regen">Regenerate All</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmModal);

    const close = () => confirmModal.remove();
    confirmModal.querySelector('.modal-close').addEventListener('click', close);
    confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) close(); });
    confirmModal.querySelector('#tone-confirm-cancel').addEventListener('click', close);

    confirmModal.querySelector('#tone-confirm-save-only').addEventListener('click', async () => {
      await this.applyToneChange(newTone);
      this.showToast('Tone updated (existing content unchanged)', 'success');
      close();
    });

    confirmModal.querySelector('#tone-confirm-regen').addEventListener('click', async () => {
      close();
      await this.applyToneChange(newTone);
      await this.regenerateAllInTone(newTone, generatedTabs);
    });
  }

  async regenerateAllInTone(newTone, generatedTabs) {
    const total = generatedTabs.length;
    let completed = 0;

    const nm = this.newsMonitor;

    // Show refining overlay so user sees activity
    this.showRefiningOverlay();
    this.showToast(`Regenerating 0/${total} in new tone...`, 'success');

    // Use selected sources, or fall back to all sources if none selected
    let useSources = this.sources.filter(s => s.selected);
    if (useSources.length === 0) useSources = this.sources;
    if (useSources.length === 0) {
      this.hideRefiningOverlay();
      this.showToast('No sources available for regeneration', 'error');
      return;
    }

    const sourcesContext = useSources.map((s, i) => {
      return `[Source ${i + 1}] (ID: ${s.id})\nTitle: ${s.title}\nType: ${s.type}\nContent:\n${s.content}\n---`;
    }).join('\n\n');

    const promises = generatedTabs.map(async ({ tabId, planItem, label, newsItem }) => {
      try {
        // Re-fetch entry from the Map (not the captured reference) for freshness
        const liveEntry = nm?._tabContent?.get(tabId);
        if (!liveEntry || !liveEntry.output) {
          return { tabId, success: false, error: 'No output found for tab' };
        }

        const typeLabel = label;
        let userMessage = `Generate a ${typeLabel} based on the following sources.\n\n`;
        const angleNarrative = newsItem?.angle_narrative || newsItem?.relevance || newsItem?.summary || '';
        if (angleNarrative) {
          userMessage += `STORY ANGLE (use this as your narrative framework):\n${angleNarrative}\n\n`;
        }
        if (planItem.description) {
          userMessage += `Brief: ${planItem.description}\n\n`;
        }
        if (planItem.target) {
          userMessage += `Target: ${planItem.target}\n\n`;
        }
        userMessage += `SOURCES:\n${sourcesContext}`;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-opus-4-6',
            max_tokens: 8192,
            system: PR_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }]
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `API request failed (${response.status})`);
        }

        const data = await response.json();
        const rawText = data.content?.[0]?.text || '';

        let parsed;
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch { parsed = null; }
        if (!parsed) parsed = { content: rawText, citations: [], strategy: null };

        if (parsed.citations) {
          parsed.citations = parsed.citations.map((c, i) => {
            const srcIndex = c.index || (i + 1);
            const matchedSource = useSources[srcIndex - 1];
            return { ...c, index: srcIndex, sourceId: matchedSource?.id || null, verified: c.sourceId !== null && c.verified !== false };
          });
        }

        const output = liveEntry.output;
        if (!output.drafts) this.migrateContentToDrafts(output);

        const isTweetContent = output.content_type === 'tweet';
        let newTitle, strippedContent;
        if (isTweetContent) {
          newTitle = typeLabel;
          strippedContent = (parsed.content || '').trim();
        } else {
          newTitle = this.extractTitle(parsed.content, typeLabel);
          strippedContent = this._stripTitleFromPlainText(parsed.content, newTitle);
        }

        const newVersion = output.drafts.length + 1;
        output.drafts.unshift({
          content: strippedContent,
          version: newVersion,
          timestamp: Date.now(),
          prompt: `Tone change: ${newTone}`
        });
        if (output.drafts.length > 10) output.drafts = output.drafts.slice(0, 10);

        output.content = strippedContent;
        output.citations = parsed.citations || output.citations;
        output.title = newTitle;

        liveEntry.output = output;

        try {
          await fetch('/api/pr/outputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(output) });
        } catch (e) { /* silent */ }

        completed++;
        this.showToast(`Regenerating ${completed}/${total} in new tone...`, 'success');

        return { tabId, success: true };
      } catch (err) {
        completed++;
        this.showToast(`Regenerating ${completed}/${total} in new tone...`, 'success');
        return { tabId, success: false, error: err.message };
      }
    });

    const results = await Promise.all(promises);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Re-render the currently active tab with fresh content
    this.hideRefiningOverlay();
    if (nm) {
      const activeEntry = nm._tabContent.get(nm._activeTabId);
      if (activeEntry && activeEntry.output) {
        this.currentOutput = activeEntry.output;
        this._viewingDraftIndex = 0;
        this.renderGeneratedContent(activeEntry.output);
        this.renderVersionPill();
        this.showWorkspace();
      }
    }

    await this.saveOutputs();

    if (failCount === 0) {
      this.showToast(`All ${successCount} pieces regenerated in new tone`, 'success');
    } else {
      this.showToast(`${successCount} regenerated, ${failCount} failed`, 'error');
    }
  }

  copyContent() {
    if (!this.dom.generatedContent) return;
    const text = this.getCleanText();
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  _getExportTitle() {
    const output = this.currentOutput;
    return output?.title || output?.news_headline || 'Glossi Content';
  }

  _getExportTypeLabel() {
    const output = this.currentOutput;
    if (!output?.content_type) return '';
    return CONTENT_TYPES.find(t => t.id === output.content_type)?.label || output.content_type;
  }

  _sanitizeFilename(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80) || 'glossi-content';
  }

  _getGlossiWordmarkSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="51" height="15" viewBox="58.11 148.29 190.58 56.11"><g fill="#171717"><path transform="matrix(1,0,0,-1,60.1131,177.542)" d="M0 0C0 14.242 8.697 24.58 23.281 24.58 35.47 24.58 43.892 17.186 45.878 5.409H39.921C38.141 14.173 32.046 19.309 23.281 19.309 12.668 19.309 6.026 11.981 6.026 0 6.026-12.121 12.806-19.584 22.665-19.584 31.635-19.584 37.318-13.49 37.318-4.795H21.159V.135H38.003C43.002 .135 45.672-2.398 45.672-7.053V-24.104H40.537V-7.738H40.399C39.509-18.283 33.278-24.857 22.665-24.857 9.45-24.857 0-15.133 0 0"/><path transform="matrix(1,0,0,-1,0,352.69)" d="M115.161 202.399H120.844V151.044H115.161Z"/><path transform="matrix(1,0,0,-1,158.2982,183.159)" d="M0 0C0 8.148-4.725 13.697-11.983 13.697-19.242 13.697-23.966 8.148-23.966 0-23.966-9.312-18.557-14.311-11.983-14.311-4.246-14.311 0-7.874 0 0M-29.786 0C-29.786 12.121-21.843 18.626-11.983 18.626-.411 18.626 5.82 10.272 5.82 0 5.82-12.531-1.78-19.24-11.983-19.24-23.624-19.24-29.786-10.955-29.786 0"/><path transform="matrix(1,0,0,-1,169.6596,190.2101)" d="M0 0H5.547C5.957-4.726 10.271-7.328 15.749-7.328 20.885-7.328 23.35-5.342 23.35-1.713 23.35 1.711 20.679 2.465 16.913 3.766L11.641 5.546C6.3 7.326 .959 8.969 .959 15.543 .959 21.705 5.752 25.678 13.694 25.678 21.706 25.678 27.253 21.364 28.143 13.284H22.596C21.98 18.349 18.419 20.814 13.489 20.814 9.038 20.814 6.437 18.83 6.437 15.681 6.437 11.914 10.408 11.161 13.421 10.134L18.352 8.49C24.993 6.3 28.965 4.039 28.965-1.986 28.965-8.355 24.309-12.189 15.475-12.189 6.847-12.189 .48-7.67 0 0"/><path transform="matrix(1,0,0,-1,203.6884,190.2101)" d="M0 0H5.547C5.957-4.726 10.271-7.328 15.749-7.328 20.885-7.328 23.35-5.342 23.35-1.713 23.35 1.711 20.679 2.465 16.913 3.766L11.641 5.546C6.3 7.326 .959 8.969 .959 15.543 .959 21.705 5.752 25.678 13.696 25.678 21.706 25.678 27.253 21.364 28.143 13.284H22.596C21.98 18.349 18.419 20.814 13.489 20.814 9.038 20.814 6.437 18.83 6.437 15.681 6.437 11.914 10.408 11.161 13.421 10.134L18.352 8.49C24.993 6.3 28.965 4.039 28.965-1.986 28.965-8.355 24.309-12.189 15.475-12.189 6.847-12.189 .48-7.67 0 0"/><path transform="matrix(1,0,0,-1,0,352.69)" d="M239.634 187.335H245.317V151.044H239.634ZM238.265 197.676C238.265 200.072 240.113 201.852 242.51 201.852 244.906 201.852 246.687 200.072 246.687 197.676 246.687 195.277 244.906 193.429 242.51 193.429 240.113 193.429 238.265 195.277 238.265 197.676"/></g></svg>`;
  }

  _getGlossiLogoMarkSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="29" viewBox="0 0 306.8 352.69"><path d="m306.8,166.33v73.65c0,8.39-6.83,15.11-15.22,15.11h-80.59c-7.05,0-13.43,1.23-17.91,3.81-4.25,2.35-6.49,5.6-6.49,10.52v68.28c0,8.28-6.72,15-15,15H14.66c-8.06,0-14.66-6.72-14.66-14.77V54.17c0-8.39,6.72-15.22,15.11-15.22h35.59c7.05,0,13.43-1.12,17.91-3.58,4.14-2.24,6.49-5.37,6.49-10.3v-9.96c0-8.39,6.83-15.11,15.11-15.11h126.26c8.39,0,15.11,6.72,15.11,15.11v15.11c0,8.39-6.72,15.11-15.11,15.11h-124.58c-5.37.11-10.75.56-14.66,2.46-1.79.89-3.13,2.13-4.14,3.69-1.01,1.68-1.79,4.03-1.79,7.72v185.58c0,2.24,1.79,3.92,3.92,3.92h95.7c5.26,0,10.3-.56,13.88-2.35,1.68-.9,2.91-2.01,3.81-3.58,1.01-1.57,1.68-3.81,1.68-7.28v-69.17c0-8.39,6.83-15.11,15.22-15.11h86.07c8.39,0,15.22,6.72,15.22,15.11Z" fill="#EC5F3F"/></svg>`;
  }

  _deduplicateTitleFromContent(contentHTML, title) {
    if (!title || !contentHTML) return contentHTML;
    const container = document.createElement('div');
    container.innerHTML = contentHTML;

    let titleNorm = title.trim().toLowerCase().replace(/\.{3}$/, '').trim();
    if (titleNorm.length < 5) return contentHTML;

    let root = container;
    const firstChild = root.firstElementChild;
    if (firstChild && firstChild.classList.contains('pr-draft-content')) {
      root = firstChild;
    }

    const candidates = Array.from(root.children).slice(0, 3);

    for (const candidate of candidates) {
      const tag = candidate.tagName.toLowerCase();
      const isHeadingOrPara = ['h1','h2','h3','h4','h5','h6','p','strong','b'].includes(tag);
      const isParaWithStrong = tag === 'p' && candidate.children.length === 1 &&
        ['strong','b'].includes(candidate.children[0]?.tagName?.toLowerCase() || '');

      if (!isHeadingOrPara && !isParaWithStrong) continue;

      const textToCheck = (isParaWithStrong
        ? candidate.children[0].textContent
        : candidate.textContent
      ).trim().toLowerCase().replace(/\.{3}$/, '').trim();

      if (textToCheck.length < 5) continue;

      if (textToCheck === titleNorm ||
          textToCheck.startsWith(titleNorm) ||
          titleNorm.startsWith(textToCheck) ||
          textToCheck.includes(titleNorm) ||
          titleNorm.includes(textToCheck)) {
        candidate.remove();
        break;
      }
    }

    return container.innerHTML;
  }

  _stripTitleFromPlainText(content, title) {
    if (!title || !content) return content;
    const titleClean = title.trim().replace(/\.{3}$/, '').trim().toLowerCase();
    if (titleClean.length < 5) return content;

    const lines = content.split('\n');
    const firstNonEmpty = lines.findIndex(l => l.trim().length > 0);
    if (firstNonEmpty === -1) return content;

    const firstLine = lines[firstNonEmpty].replace(/^#+\s*/, '').replace(/\*+/g, '').trim().toLowerCase();
    if (firstLine === titleClean ||
        firstLine.startsWith(titleClean) ||
        titleClean.startsWith(firstLine) ||
        (firstLine.length > 10 && titleClean.includes(firstLine)) ||
        (titleClean.length > 10 && firstLine.includes(titleClean))) {
      lines.splice(firstNonEmpty, 1);
      const result = lines.join('\n').replace(/^\n+/, '');
      return result;
    }
    return content;
  }

  _buildBrandedHTML(title, typeLabel, dateStr, contentHTML, sourceInfo) {
    const logoMark = this._getGlossiLogoMarkSVG();
    const wordmark = this._getGlossiWordmarkSVG();
    const metaParts = [dateStr, typeLabel].filter(Boolean);
    const metaLine = metaParts.map(p => `<span>${this.escapeHtml(p)}</span>`).join('<span class="meta-sep">/</span>');
    const cleanContent = this._deduplicateTitleFromContent(contentHTML, title);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${this.escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:#171717;font-family:'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;font-feature-settings:'cv02','cv03','cv04','cv11';line-height:1.6;font-size:15px;letter-spacing:-0.01em}
.export-nav{height:60px;display:flex;align-items:center;padding:0 24px;border-bottom:1px solid rgba(0,0,0,0.06)}
.export-nav-logo{display:flex;align-items:center;gap:11px;text-decoration:none}
.export-wrap{max-width:680px;margin:0 auto;padding:48px 24px 48px}
.export-header{padding-bottom:48px;margin-bottom:48px;border-bottom:1px solid rgba(0,0,0,0.06)}
.export-meta{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#EC5F3F;margin-bottom:20px}
.meta-sep{opacity:0.5}
.export-title{font-weight:600;font-size:clamp(32px,6vw,42px);line-height:1.1;letter-spacing:-0.03em;color:#171717;margin:0}
.export-content h1{font-weight:600;font-size:clamp(32px,6vw,42px);line-height:1.1;letter-spacing:-0.03em;color:#171717;margin:0 0 24px}
.export-content h2{font-weight:600;font-size:24px;line-height:1.3;letter-spacing:-0.02em;color:#171717;margin:64px 0 20px;padding-top:64px;border-top:1px solid rgba(0,0,0,0.06)}
.export-content h2:first-child{border-top:none;padding-top:0;margin-top:0}
.export-content h3{font-weight:600;font-size:17px;color:#171717;margin:40px 0 12px}
.export-content h4{font-weight:600;font-size:15px;color:#171717;margin:0 0 6px}
.export-content p{font-size:17px;line-height:1.75;color:#525252;margin-bottom:24px}
.export-content ul,.export-content ol{padding-left:20px;margin-bottom:24px}
.export-content li{font-size:17px;line-height:1.75;color:#525252;margin-bottom:6px}
.export-content strong{color:#171717;font-weight:600}
.export-content em{font-style:italic}
.export-content blockquote{margin:40px 0;padding:0 0 0 24px;border-left:2px solid rgba(0,0,0,0.12);font-size:18px;line-height:1.6;color:#171717}
.export-content blockquote p{font-size:18px;color:#171717;margin-bottom:0}
.export-content a{color:#171717;text-decoration:underline;text-underline-offset:2px}
.export-content pre,.export-content code{font-family:'IBM Plex Mono',monospace;font-size:13px;background:#f5f5f5;border-radius:4px;padding:2px 6px}
.export-content pre{padding:16px;overflow-x:auto;margin-bottom:24px}
.export-content hr{border:none;height:1px;background:rgba(0,0,0,0.06);margin:64px 0}
.export-content img{max-width:100%;height:auto;border-radius:8px;margin:24px 0}
.export-source-cite{margin-top:48px;padding:20px 24px;background:#fafafa;border:1px solid rgba(0,0,0,0.06);border-radius:10px;font-size:14px;line-height:1.5;color:#525252}
.export-source-cite .source-label{font-weight:600;color:#171717;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
.export-source-cite a{color:#171717;text-decoration:underline;text-underline-offset:2px}
.export-source-cite .source-outlet{color:#737373;font-style:italic}
.export-source-cite .source-outlet::before{content:'\\2014 ';color:#a3a3a3}
.export-footer{text-align:center;margin-top:80px;padding-top:28px;border-top:1px solid rgba(0,0,0,0.06)}
.export-footer-logo{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px}
.export-footer-logo svg:first-child{height:20px;width:auto}
.export-footer-logo svg:last-child{height:10px;width:auto}
.export-footer-links{font-size:13px;color:#a3a3a3;letter-spacing:0.01em}
.export-footer-links a{color:#a3a3a3;text-decoration:none}
.export-footer-links a:hover{color:#171717}
.export-footer-sep{opacity:0.4;margin:0 8px}
.pr-draft-content{all:unset;display:block}
@media(max-width:768px){
.export-title,.export-content h1{font-size:26px}
.export-content h2{font-size:21px}
.export-content p,.export-content li{font-size:16px}
.export-content blockquote{font-size:16px;padding-left:20px}
.export-content blockquote p{font-size:16px}
}
</style>
</head>
<body>
<nav class="export-nav">
  <a class="export-nav-logo" href="https://www.glossi.io">
    ${logoMark}
    ${wordmark}
  </a>
</nav>
<div class="export-wrap">
  <header class="export-header">
    <div class="export-meta">${metaLine}</div>
    <h1 class="export-title">${this.escapeHtml(title)}</h1>
  </header>
  <article class="export-content">
    ${cleanContent}
  </article>
  ${sourceInfo ? `<div class="export-source-cite">
    <span class="source-label">Source:</span> <a href="${this.escapeHtml(sourceInfo.url)}">${this.escapeHtml(sourceInfo.headline)}</a>${sourceInfo.outlet ? ` <span class="source-outlet">${this.escapeHtml(sourceInfo.outlet)}</span>` : ''}
  </div>` : ''}
  <footer class="export-footer">
    <div class="export-footer-logo">${logoMark}${wordmark}</div>
    <div class="export-footer-links">
      <a href="https://www.glossi.io">glossi.io</a>
      <span class="export-footer-sep">|</span>
      <a href="mailto:will.erwin@glossi.io">will.erwin@glossi.io</a>
    </div>
  </footer>
</div>
</body>
</html>`;
  }

  exportAs(format) {
    this.dom.exportMenu?.classList.remove('active');

    const title = this._getExportTitle();
    const typeLabel = this._getExportTypeLabel();
    const filename = this._sanitizeFilename(title);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const sourceInfo = this._getExportSourceInfo();

    if (format === 'text') {
      const body = this.getCleanText(sourceInfo);
      const divider = String.fromCharCode(9472).repeat(40);
      const parts = [
        'GLOSSI',
        divider,
        '',
        title,
        [typeLabel, dateStr].filter(Boolean).join('  |  '),
        '',
        divider,
        '',
        body
      ];
      if (sourceInfo) {
        parts.push('', divider);
        parts.push(`Source: "${sourceInfo.headline}"${sourceInfo.outlet ? ` - ${sourceInfo.outlet}` : ''}`);
        if (sourceInfo.url) parts.push(sourceInfo.url);
      }
      parts.push('', divider, 'glossi.io | will.erwin@glossi.io');
      this.downloadFile(parts.join('\n'), `${filename}.txt`, 'text/plain');

    } else if (format === 'html') {
      const contentHTML = this._getCleanContentHTML(sourceInfo);
      const html = this._buildBrandedHTML(title, typeLabel, dateStr, contentHTML, sourceInfo);
      this.downloadFile(html, `${filename}.html`, 'text/html');

    } else if (format === 'pdf') {
      this._exportPDF(title, typeLabel, dateStr, filename, sourceInfo);
    }
  }

  _getExportSourceInfo() {
    const nm = this.newsMonitor;
    if (!nm || !nm._activeStoryKey) return null;
    const story = nm._stories.get(nm._activeStoryKey);
    if (!story || !story.newsItem) return null;
    const item = story.newsItem;
    if (!item.url || !item.headline || item._customCard) return null;
    return {
      headline: item.headline,
      outlet: item.outlet || '',
      url: item.url
    };
  }

  _stripSourceReferences(text, sourceInfo) {
    let result = text;
    if (sourceInfo && sourceInfo.outlet) {
      const outletRef = `(${sourceInfo.outlet})`;
      let firstReplaced = false;
      result = result.replace(/\[Source\s+\d+(?:\s*,\s*Source\s+\d+)*\]/gi, (match) => {
        if (!firstReplaced) {
          firstReplaced = true;
          return outletRef;
        }
        return '';
      });
    } else {
      result = result.replace(/\[Source\s+\d+(?:\s*,\s*Source\s+\d+)*\]/gi, '');
    }
    return result
      .replace(/\[NEEDS\s+SOURCE\]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1');
  }

  _getCleanContentHTML(sourceInfo) {
    if (!this.dom.generatedContent) return '';
    const clone = this.dom.generatedContent.cloneNode(true);
    clone.querySelectorAll('.pr-citation, .pr-needs-source, .pr-citation-approved').forEach(el => el.remove());
    let html = clone.innerHTML;
    html = this._stripSourceReferences(html, sourceInfo);
    return html;
  }

  async _exportPDF(title, typeLabel, dateStr, filename, sourceInfo) {
    if (typeof html2pdf === 'undefined') {
      this.showToast?.('PDF export library not loaded. Please try again.', 'error');
      return;
    }

    const contentHTML = this._getCleanContentHTML(sourceInfo);
    const html = this._buildBrandedHTML(title, typeLabel, dateStr, contentHTML, sourceInfo);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.innerHTML = html;
    document.body.appendChild(container);

    const target = container.querySelector('.export-wrap') || container;

    try {
      await html2pdf().set({
        margin: 0,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(target).save();
    } catch (e) {
      this.showToast?.('Failed to generate PDF. Please try again.', 'error');
    } finally {
      document.body.removeChild(container);
    }
  }

  getCleanText(sourceInfo) {
    if (!this.dom.generatedContent) return '';
    const clone = this.dom.generatedContent.cloneNode(true);
    clone.querySelectorAll('.pr-citation, .pr-needs-source, .pr-citation-approved').forEach(el => el.remove());
    let text = clone.innerText.trim();
    text = this._stripSourceReferences(text, sourceInfo);
    return text;
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
    if (type !== 'error' || !this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // =========================================
  // CHAT FUNCTIONALITY
  // =========================================

  async sendChatMessage() {
    const input = document.getElementById('pr-chat-input');
    const message = input?.value?.trim();
    if (!message || !this.currentOutput) return;

    // Capture target output and tab at the START so tab switching mid-flight is safe
    const targetOutput = this.currentOutput;
    const nm = this.newsMonitor;
    const targetTabId = nm?._activeTabId;

    // Clear input
    input.value = '';
    input.disabled = true;
    
    const sendBtn = document.getElementById('pr-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    // Mark tab as refining in _tabContent and show indicator on the tab button
    if (nm && targetTabId) {
      const entry = nm._tabContent.get(targetTabId);
      if (entry) entry.refining = true;
      nm.updateTabIndicator(targetTabId, true);
    }
    
    // Show refining overlay only if this tab is currently active
    if (!nm || nm._activeTabId === targetTabId) {
      this.showRefiningOverlay();
    }

    try {
      // Build context from the captured target output (not this.currentOutput)
      const context = this.buildChatContext(targetOutput);
      
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
          model: 'claude-opus-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }]
        })
      });

      const refinedContent = response.content[0].text.trim();

      // Migrate to drafts if needed (operate on targetOutput, not this.currentOutput)
      if (!targetOutput.drafts) {
        this.migrateContentToDrafts(targetOutput);
      }

      // Create new draft version
      const newVersion = targetOutput.drafts.length + 1;
      targetOutput.drafts.unshift({
        content: refinedContent,
        version: newVersion,
        timestamp: Date.now(),
        prompt: message
      });

      // Keep only the latest 10 drafts
      if (targetOutput.drafts.length > 10) {
        targetOutput.drafts = targetOutput.drafts.slice(0, 10);
      }

      // Update the _tabContent entry with the refined output
      if (nm && targetTabId) {
        const entry = nm._tabContent.get(targetTabId);
        if (entry) {
          entry.output = targetOutput;
          entry.refining = false;
        }
        nm.updateTabIndicator(targetTabId, false);
      }

      // Only update DOM if the user is still viewing the refined tab
      const stillActive = !nm || nm._activeTabId === targetTabId;
      if (stillActive) {
        this.currentOutput = targetOutput;
        this.renderDrafts();
        this.hideRefiningOverlay();
        await this.saveOutputs();
        await this.generateSuggestions();
      } else {
        // Tab switched away; save silently, suggestions will generate on re-visit
        await this.saveOutputs();
        this.hideRefiningOverlay();
      }

    } catch (error) {
      // Clear refining state on the target tab
      if (nm && targetTabId) {
        const entry = nm._tabContent.get(targetTabId);
        if (entry) entry.refining = false;
        nm.updateTabIndicator(targetTabId, false);
      }
      if (!nm || nm._activeTabId === targetTabId) {
        this.showRefiningError('Refinement failed. Please try again.');
        setTimeout(() => this.hideRefiningOverlay(), 2000);
      }
      return;
    } finally {
      if (!nm || nm._activeTabId === targetTabId) {
        this.hideRefiningOverlay();
      }
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
          model: 'claude-opus-4-6',
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
      // Fallback to default suggestions
      container.innerHTML = `
        <button class="pr-suggestion-btn" data-suggestion="Make more direct">Make more direct</button>
        <button class="pr-suggestion-btn" data-suggestion="Shorten by 20%">Shorten by 20%</button>
        <button class="pr-suggestion-btn" data-suggestion="Add specific metrics">Add specific metrics</button>
      `;
    }

    // Store suggestions in the active tab's _tabContent entry
    const nm = this.newsMonitor;
    if (nm) {
      const activeEntry = nm._tabContent?.get(nm._activeTabId);
      if (activeEntry) activeEntry.suggestionsHTML = container.innerHTML;
    }
    
  }
  
  async applySuggestion(suggestion) {
    const chatInput = document.getElementById('pr-chat-input');
    if (chatInput) chatInput.value = suggestion;
    await this.sendChatMessage();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  buildChatContext(output) {
    const target = output || this.currentOutput;
    const parts = [];

    // Current content - include all drafts
    if (target) {
      parts.push(`CONTENT TYPE: ${target.content_type}`);
      
      if (target.drafts && target.drafts.length > 0) {
        parts.push(`\nDRAFT VERSIONS (${target.drafts.length} total):`);
        target.drafts.forEach((draft, i) => {
          const label = i === 0 ? 'LATEST DRAFT' : `VERSION ${draft.version}`;
          const promptInfo = draft.prompt ? ` (refined with: "${draft.prompt}")` : '';
          parts.push(`\n${label}${promptInfo}:\n${draft.content}`);
        });
      } else if (target.content) {
        // Backward compatibility
        parts.push(`\nCURRENT CONTENT:\n${target.content}`);
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
    if (target?.strategy) {
      parts.push('\n\nSTRATEGY RECOMMENDATIONS:\n' + JSON.stringify(target.strategy, null, 2));
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
    const container = document.getElementById('pr-refining-content');
    if (container) {
      this._refineLoaderId = startLoaderStatus(container, 'refine');
    }
  }

  hideRefiningOverlay() {
    const overlay = document.getElementById('pr-refining-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    stopLoaderStatus(this._refineLoaderId);
    this._refineLoaderId = null;
  }

  showRefiningError() {
    this.hideRefiningOverlay();
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
    
    // Helper to find or create source ID
    const getSourceId = (prefix) => {
      if (this.isEditing) {
        // Find existing source with this prefix
        const existing = this.prAgent.sources.find(s => s.id.startsWith(prefix));
        if (existing) return existing.id;
      }
      return prefix + Date.now();
    };
    
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
      id: getSourceId('src_wizard_facts_'),
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
      id: getSourceId('src_wizard_problem_'),
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
      id: getSourceId('src_wizard_solution_'),
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
      id: getSourceId('src_wizard_timing_'),
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
    `.trim();
    
    sources.push({
      id: getSourceId('src_wizard_voice_'),
      title: 'Founder Voice & Messaging',
      type: 'text',
      content: voiceContent,
      createdAt: new Date().toISOString(),
      selected: true
    });
    
    // Add or update sources
    if (this.isEditing) {
      // Update existing sources
      sources.forEach(newSource => {
        const existingIndex = this.prAgent.sources.findIndex(s => s.id === newSource.id);
        if (existingIndex >= 0) {
          // Update existing source
          this.prAgent.sources[existingIndex] = { 
            ...this.prAgent.sources[existingIndex], 
            ...newSource 
          };
        } else {
          // Add if somehow missing
          this.prAgent.sources.push(newSource);
        }
      });
    } else {
      // Add new sources for first-time setup
      this.prAgent.sources.push(...sources);
    }
    
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
                  <i class="ph-light ph-arrow-square-out"></i>
                </a>
              </div>
            </div>
            <div class="pr-outlet-beats">
              ${outlet.beats.map(beat => `<span class="pr-beat-tag">${beat}</span>`).join('')}
            </div>
            <p class="pr-outlet-notes">${this.escapeHtml(outlet.notes)}</p>
            <button class="btn btn-sm btn-primary pr-find-journalists-btn" data-outlet="${this.escapeHtml(outlet.name)}" data-url="${outlet.url}">
              <i class="ph-light ph-magnifying-glass"></i>
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
    const loadingModal = this.showLoadingModal('Discovering journalists...', 'journalists');

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

      stopLoaderStatus(loadingModal._loaderId);
      loadingModal.remove();
      
      if (data.journalists.length === 0) {
        this.prAgent.showToast('No journalists found for this outlet', 'info');
        return;
      }

      this.showJournalistResults(data.journalists, outletName);
    } catch (error) {
      stopLoaderStatus(loadingModal._loaderId);
      loadingModal.remove();
      console.error('Error discovering journalists:', error);
      this.prAgent.showToast('Failed to discover journalists. ' + error.message, 'error');
    }
  }

  showLoadingModal(message, loaderContext = 'general') {
    const modal = document.createElement('div');
    modal.className = 'pr-loading-modal';
    modal.innerHTML = `
      <div class="pr-loading-modal-content">
        ${glossiLoaderSVG('glossi-loader-sm')}
        <p class="glossi-loader-status"></p>
      </div>
    `;
    document.body.appendChild(modal);
    const container = modal.querySelector('.pr-loading-modal-content');
    modal._loaderId = startLoaderStatus(container, loaderContext);
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
            <i class="ph-light ph-x"></i>
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
                  <i class="ph-light ph-floppy-disk"></i>
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
        let journalist;
        try { journalist = JSON.parse(btn.dataset.journalist.replace(/&apos;/g, "'")); } catch (e) { journalist = null; }
        if (!journalist) return;
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
                <i class="ph-light ph-eye"></i>
              </button>
              <button class="btn-icon" data-action="delete" data-journalist-id="${journalist.id}" title="Delete">
                <i class="ph-light ph-trash"></i>
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
            <i class="ph-light ph-x"></i>
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
    this.displayedNewsCount = 8; // Show 8 news items initially (4 rows of 2)
    this.searchQuery = '';
    this._searchDebounce = null;
    
    // Filter state
    this.filters = {
      dateRange: 60, // Default: last 60 days
      outlets: [] // Empty = all outlets
    };

    // Multi-story workspace state
    this._stories = new Map();
    this._activeStoryKey = null;

    // Archive state
    this._selectMode = false;
    this._selectedStoryKeys = new Set();
    this._archivedExpanded = false;

    // Custom source cards (persisted to localStorage)
    this._customCards = [];
    this._customSourceFlow = false;
    this._pendingAngleSource = null;

    // News card archive state (persisted to localStorage)
    this._archivedNewsIds = new Set();
    this._newsArchivedExpanded = false;
    this._customArchivedExpanded = false;

    // Favorites state (persisted to PostgreSQL)
    this._favoriteIds = new Set();
    this._favoritesFilter = 'all';
  }

  async init() {
    this.setupDOM();
    this.setupEventListeners();
    this.setupFileTree();
    this.setupPanelResize();
    this.loadCustomCards();
    this.loadArchivedNewsIds();
    await this.loadFavorites();
    this.setupFavoritesFilter();
    await this.loadCachedNews();
  }

  restoreStoriesFromOutputs(outputs) {
    if (!outputs || outputs.length === 0) return;

    // Group outputs by story_key
    const grouped = {};
    outputs.forEach(output => {
      const key = output.story_key;
      if (!key) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(output);
    });

    const storyKeys = Object.keys(grouped);
    if (storyKeys.length === 0) return;

    storyKeys.forEach(key => {
      const storyOutputs = grouped[key];
      storyOutputs.sort((a, b) => (a.content_plan_index || 0) - (b.content_plan_index || 0));

      // Detect if this is a custom story (key starts with custom_ or any output has is_custom)
      const isCustom = key.startsWith('custom_') || storyOutputs.some(o => o.is_custom === true);
      const angleTitle = storyOutputs.find(o => o.angle_title)?.angle_title || '';
      const angleNarrative = storyOutputs.find(o => o.angle_narrative)?.angle_narrative || '';

      const headline = storyOutputs[0].news_headline || 'Untitled';

      const newsItem = {
        headline,
        url: key,
        content_plan: storyOutputs.map(o => ({
          type: o.content_type,
          description: o.title || '',
          priority: (o.content_plan_index || 0) + 1
        }))
      };

      // Try to find the real news hook for richer data (articles only)
      if (!isCustom) {
        const realHook = this.newsHooks.find(h => (h.url || h.headline) === key);
        if (realHook) {
          Object.assign(newsItem, realHook);
        }
      }

      const contentPlan = newsItem.content_plan || storyOutputs.map(o => ({
        type: o.content_type,
        description: o.title || '',
        priority: (o.content_plan_index || 0) + 1
      }));

      // Enrich existing plans with standard types if missing
      const standardTypes = [
        { type: 'linkedin_post', description: 'Key insight as a founder perspective post', audience: 'brands' },
        { type: 'blog_post', description: 'In-depth analysis with product angle', audience: 'brands' },
        { type: 'tweet', description: 'One sharp, punchy tweet (280 chars max)', audience: 'builders' },
        { type: 'email_blast', description: 'Signal boost to subscriber list', audience: 'brands' }
      ];
      const existingTypes = new Set(contentPlan.map(p => p.type));
      let nextPriority = contentPlan.length + 1;
      for (const std of standardTypes) {
        if (!existingTypes.has(std.type)) {
          contentPlan.push({ ...std, priority: nextPriority++ });
        }
      }

      const tabContent = new Map();
      const usedOutputIds = new Set();

      contentPlan.forEach((planItem, index) => {
        planItem.type = normalizeContentType(planItem.type);
        const tabId = `plan_${index}`;
        const match = storyOutputs.find(o => o.content_type === planItem.type && !usedOutputIds.has(o.id));
        if (match) {
          usedOutputIds.add(match.id);
          let drafts = match.drafts;
          if (typeof drafts === 'string') {
            try { drafts = JSON.parse(drafts); } catch (e) { drafts = null; }
          }
          if (!drafts && match.content) {
            drafts = [{ content: match.content, version: 1, timestamp: Date.now(), prompt: null }];
          }
          match.content_plan_index = index;
          tabContent.set(tabId, {
            loading: false,
            output: { ...match, content_plan_index: index, drafts: drafts || [] },
            refining: false,
            suggestionsHTML: ''
          });
        }
      });

      storyOutputs.forEach(output => {
        if (usedOutputIds.has(output.id)) return;
        const idx = output.content_plan_index || 0;
        const tabId = `plan_${idx}`;
        if (!tabContent.has(tabId)) {
          let drafts = output.drafts;
          if (typeof drafts === 'string') {
            try { drafts = JSON.parse(drafts); } catch (e) { drafts = null; }
          }
          if (!drafts && output.content) {
            drafts = [{ content: output.content, version: 1, timestamp: Date.now(), prompt: null }];
          }
          tabContent.set(tabId, {
            loading: false,
            output: { ...output, drafts: drafts || [] },
            refining: false,
            suggestionsHTML: ''
          });
        }
      });

      const isArchived = storyOutputs.some(o => o.archived === true);

      // Collect source IDs from outputs for custom stories
      // The primary source ID is the first element of the sources array
      let sourceIds = null;
      let primarySourceId = null;
      if (isCustom) {
        const allSrcIds = storyOutputs.flatMap(o => {
          let s = o.sources;
          if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
          return Array.isArray(s) ? s : [];
        });
        // The first source ID from the first output is the primary
        if (allSrcIds.length > 0) primarySourceId = allSrcIds[0];
        sourceIds = [...new Set(allSrcIds)];
      }

      this._stories.set(key, {
        newsItem,
        contentPlan,
        tabContent,
        activeTabId: 'plan_0',
        currentOutput: storyOutputs[0] || null,
        chatHTML: '',
        suggestionsHTML: '',
        archived: isArchived,
        custom: isCustom,
        customTitle: isCustom ? headline : undefined,
        angleTitle: isCustom ? angleTitle : undefined,
        angleNarrative: isCustom ? angleNarrative : undefined,
        sourceIds: sourceIds,
        primarySourceId: primarySourceId
      });
    });

    // Restore the first non-archived story
    const firstKey = storyKeys.find(k => !this._stories.get(k)?.archived) || storyKeys[0];
    this._activeStoryKey = firstKey;
    this._activeNewsItem = this._stories.get(firstKey).newsItem;
    this._activeContentPlan = this._stories.get(firstKey).contentPlan;
    this._tabContent = this._stories.get(firstKey).tabContent;
    this._activeTabId = 'plan_0';

    // Render the restored state
    this.renderStorySelector();
    this.renderContentPlanTabs(this._activeContentPlan);
    this.renderFileTree();

    // Restore the first tab content
    const firstEntry = this._tabContent.get('plan_0');
    if (firstEntry && firstEntry.output) {
      this.prAgent.currentOutput = firstEntry.output;
      this.prAgent.renderGeneratedContent(firstEntry.output);
      this.prAgent.showWorkspace();
      this.prAgent.hideLoading();
    }

    // Populate left panel with news item
    this.populateLeftPanel(this._activeNewsItem);
  }

  setupDOM() {
    this.dom = {
      fetchNewsBtn: document.getElementById('pr-fetch-news-btn'),
      regeneratePlansBtn: document.getElementById('pr-regenerate-plans-btn'),
      newsHooksList: document.getElementById('pr-news-hooks-list'),
      sourcesDrawer: document.getElementById('pr-sources-drawer'),
      sourcesBackdrop: document.getElementById('pr-sources-backdrop'),
      sourcesToggleBtn: document.getElementById('pr-nav-sources-btn'),
      sourcesDrawerClose: document.getElementById('pr-sources-drawer-close'),
      sourcesToggleCount: document.getElementById('pr-nav-sources-badge'),
      searchToggle: document.getElementById('pr-search-toggle'),
      searchExpandable: document.getElementById('pr-search-expandable'),
      searchInput: document.getElementById('pr-news-search'),
      searchClear: document.getElementById('pr-news-search-clear'),
      addUrlBtn: document.getElementById('pr-add-url-btn'),
      addUrlWrap: document.getElementById('pr-add-url-input-wrap'),
      addUrlInput: document.getElementById('pr-add-url-input'),
      addUrlSubmit: document.getElementById('pr-add-url-submit'),
      addUrlClear: document.getElementById('pr-add-url-clear'),
      filterToggle: document.getElementById('pr-filter-toggle'),
      filterDropdown: document.getElementById('pr-filter-dropdown'),
      filterOutletList: document.getElementById('pr-filter-outlet-list'),
      filterActiveDot: document.getElementById('pr-filter-active-dot'),
      filterClearAll: document.getElementById('pr-filter-clear-all'),
      customCardsList: document.getElementById('pr-custom-cards-list'),
      customAddSourceBtn: document.getElementById('pr-custom-add-source-btn'),
      angleSelectModal: document.getElementById('pr-angle-select-modal'),
      angleSelectCards: document.getElementById('pr-angle-select-cards'),
      angleSelectClose: document.getElementById('pr-angle-select-close')
    };
  }

  setupEventListeners() {
    this.dom.fetchNewsBtn?.addEventListener('click', () => this.refreshNews());
    this.dom.regeneratePlansBtn?.addEventListener('click', () => this.regenerateContentPlans());

    // Strategy sub-tab switching
    const addSourceBtn = this.dom.customAddSourceBtn;
    document.querySelectorAll('.pr-strategy-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.pr-strategy-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.pr-strategy-panel').forEach(p => {
          p.classList.toggle('active', p.dataset.strategyTab === tab.dataset.strategyTab);
        });
        if (addSourceBtn) addSourceBtn.style.display = tab.dataset.strategyTab === 'custom' ? '' : 'none';
      });
    });

    // Custom tab: Add Source button
    this.dom.customAddSourceBtn?.addEventListener('click', () => {
      this._customSourceFlow = true;
      this.prAgent.openSourceModal();
    });

    // Angle selection modal close
    this.dom.angleSelectClose?.addEventListener('click', () => this.closeAngleSelectModal());

    // Sources drawer toggle
    this.dom.sourcesToggleBtn?.addEventListener('click', () => this.toggleSourcesDrawer());
    this.dom.sourcesDrawerClose?.addEventListener('click', () => this.closeSourcesDrawer());
    this.dom.sourcesBackdrop?.addEventListener('click', () => this.closeSourcesDrawer());

    // Expandable search (stopPropagation so outside-click handler doesn't close immediately)
    this.dom.searchToggle?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleSearch(); });

    this.dom.searchInput?.addEventListener('input', () => {
      clearTimeout(this._searchDebounce);
      this._searchDebounce = setTimeout(() => {
        this.searchQuery = (this.dom.searchInput.value || '').trim().toLowerCase();
        if (this.dom.searchClear) this.dom.searchClear.style.display = this.searchQuery ? 'flex' : 'none';
        this.renderNews();
        this.updateFilterIndicator();
      }, 300);
    });

    this.dom.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.collapseSearch();
    });

    this.dom.searchClear?.addEventListener('click', () => {
      this.searchQuery = '';
      if (this.dom.searchInput) this.dom.searchInput.value = '';
      if (this.dom.searchClear) this.dom.searchClear.style.display = 'none';
      this.renderNews();
      this.updateFilterIndicator();
    });

    // Unified filter dropdown
    this.dom.filterToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFilterDropdown();
    });

    this.dom.filterDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Date radios inside filter dropdown
    this.dom.filterDropdown?.querySelectorAll('input[name="pr-date-range"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.filters.dateRange = radio.value === 'all' ? 'all' : parseInt(radio.value);
        this.renderNews();
        this.updateFilterIndicator();
      });
    });

    // Clear all filters
    this.dom.filterClearAll?.addEventListener('click', () => {
      this.clearFilters();
      this.closeFilterDropdown();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (this.dom.filterDropdown && this.dom.filterDropdown.style.display !== 'none') {
        if (!e.target.closest('.pr-filter-wrap')) {
          this.closeFilterDropdown();
        }
      }
      if (this.dom.searchExpandable && this.dom.searchExpandable.style.display !== 'none') {
        if (!e.target.closest('.pr-search-expandable-wrap')) {
          this.collapseSearch();
        }
      }
      if (this.dom.addUrlWrap && this.dom.addUrlWrap.style.display !== 'none') {
        if (!e.target.closest('.pr-add-url-wrap-outer')) {
          this.hideAddUrlInput();
        }
      }
    });

    // Add URL: toggle input (stopPropagation so outside-click handler doesn't close immediately)
    this.dom.addUrlBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.showAddUrlInput(); });
    this.dom.addUrlSubmit?.addEventListener('click', () => this.submitUrl());
    this.dom.addUrlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitUrl();
      if (e.key === 'Escape') this.hideAddUrlInput();
    });
    this.dom.addUrlInput?.addEventListener('input', () => {
      if (this.dom.addUrlClear) {
        this.dom.addUrlClear.style.display = this.dom.addUrlInput.value.trim() ? 'flex' : 'none';
      }
    });
    this.dom.addUrlClear?.addEventListener('click', () => {
      if (this.dom.addUrlInput) this.dom.addUrlInput.value = '';
      if (this.dom.addUrlClear) this.dom.addUrlClear.style.display = 'none';
      this.dom.addUrlInput?.focus();
    });
  }

  showAddUrlInput() {
    if (this.dom.addUrlWrap) {
      this.collapseSearch();
      this.closeFilterDropdown();
      this.dom.addUrlWrap.style.display = 'flex';
      this.dom.addUrlInput?.focus();
    }
  }

  hideAddUrlInput() {
    if (this.dom.addUrlWrap) this.dom.addUrlWrap.style.display = 'none';
    if (this.dom.addUrlInput) this.dom.addUrlInput.value = '';
    if (this.dom.addUrlClear) this.dom.addUrlClear.style.display = 'none';
  }

  async submitUrl() {
    const url = this.dom.addUrlInput?.value?.trim();
    if (!url) return;

    // Basic URL validation
    try { new URL(url); } catch {
      this.prAgent.showToast('Please enter a valid URL', 'error');
      return;
    }

    // Show loading state
    if (this.dom.addUrlSubmit) {
      this.dom.addUrlSubmit.disabled = true;
      this.dom.addUrlSubmit.innerHTML = glossiLoaderSVG('glossi-loader-xs');
    }
    if (this.dom.addUrlInput) this.dom.addUrlInput.disabled = true;

    try {
      const response = await fetch('/api/pr/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze article');
      }

      // Add to news hooks and re-render
      this.newsHooks.unshift(data.article);
      this.renderNews();
      this.hideAddUrlInput();
      this.prAgent.showToast('Article added successfully', 'success');
    } catch (error) {
      this.prAgent.showToast(error.message || 'Failed to add article', 'error');
    } finally {
      if (this.dom.addUrlSubmit) {
        this.dom.addUrlSubmit.disabled = false;
        this.dom.addUrlSubmit.innerHTML = '<i class="ph-light ph-paper-plane-tilt"></i>';
      }
      if (this.dom.addUrlInput) this.dom.addUrlInput.disabled = false;
    }
  }

  toggleSourcesDrawer() {
    if (this.dom.sourcesDrawer) {
      const isOpen = this.dom.sourcesDrawer.classList.contains('open');
      if (isOpen) {
        this.closeSourcesDrawer();
      } else {
        this.dom.sourcesDrawer.classList.add('open');
        if (this.dom.sourcesBackdrop) this.dom.sourcesBackdrop.classList.add('visible');
      }
    }
  }

  closeSourcesDrawer() {
    if (this.dom.sourcesDrawer) this.dom.sourcesDrawer.classList.remove('open');
    if (this.dom.sourcesBackdrop) this.dom.sourcesBackdrop.classList.remove('visible');
  }

  updateSourcesCount() {
    if (this.dom.sourcesToggleCount) {
      const count = this.prAgent.sources ? this.prAgent.sources.length : 0;
      this.dom.sourcesToggleCount.textContent = count > 0 ? count : '';
      this.dom.sourcesToggleCount.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  showMoreNews() {
    this.displayedNewsCount += 8; // Load 8 more items (4 rows of 2)
    this.renderNews();
  }
  
  clearFilters() {
    this.filters.dateRange = 60;
    this.filters.outlets = [];
    this.searchQuery = '';
    if (this.dom.searchInput) this.dom.searchInput.value = '';
    if (this.dom.searchClear) this.dom.searchClear.style.display = 'none';
    // Reset date radios
    const radio60 = this.dom.filterDropdown?.querySelector('input[name="pr-date-range"][value="60"]');
    if (radio60) radio60.checked = true;
    // Uncheck outlet checkboxes
    this.dom.filterDropdown?.querySelectorAll('.pr-filter-checkbox input').forEach(cb => { cb.checked = false; });
    this.renderNews();
    this.updateFilterIndicator();
  }

  updateFilterIndicator() {
    const hasFilters = this.filters.dateRange !== 60 || this.filters.outlets.length > 0 || this.searchQuery;
    if (this.dom.filterActiveDot) {
      this.dom.filterActiveDot.style.display = hasFilters ? 'block' : 'none';
    }
  }

  toggleSearch() {
    if (!this.dom.searchExpandable) return;
    const isOpen = this.dom.searchExpandable.style.display !== 'none';
    if (isOpen) {
      this.collapseSearch();
    } else {
      this.hideAddUrlInput();
      this.closeFilterDropdown();
      this.dom.searchExpandable.style.display = 'flex';
      this.dom.searchInput?.focus();
    }
  }

  collapseSearch() {
    if (!this.dom.searchExpandable) return;
    if (this.searchQuery) return;
    this.dom.searchExpandable.style.display = 'none';
  }

  toggleFilterDropdown() {
    if (!this.dom.filterDropdown) return;
    const isOpen = this.dom.filterDropdown.style.display !== 'none';
    if (isOpen) {
      this.closeFilterDropdown();
    } else {
      this.populateOutletCheckboxes();
      this.dom.filterDropdown.style.display = 'block';
    }
  }

  closeFilterDropdown() {
    if (this.dom.filterDropdown) this.dom.filterDropdown.style.display = 'none';
  }

  populateOutletCheckboxes() {
    if (!this.dom.filterOutletList) return;
    const availableOutlets = [...new Set(this.newsHooks.map(item => item.outlet))].sort();
    const allPossibleOutlets = [
      'TechCrunch', 'The Verge', 'WIRED', 'VentureBeat',
      'MIT Technology Review', 'Ars Technica', 'Fast Company',
      'Business Insider', 'Forbes', 'CNBC', 'Reuters', 'Bloomberg',
      'TLDR', 'Business of Fashion', 'The Interline'
    ];
    const outlets = [...new Set([...availableOutlets, ...allPossibleOutlets])].sort();

    this.dom.filterOutletList.innerHTML = outlets.map(outlet => {
      const isAvailable = availableOutlets.includes(outlet);
      const count = isAvailable ? this.newsHooks.filter(item => item.outlet === outlet).length : 0;
      return `
        <label class="pr-filter-checkbox ${!isAvailable ? 'disabled' : ''}">
          <input type="checkbox" value="${this.escapeHtml(outlet)}" ${this.filters.outlets.includes(outlet) ? 'checked' : ''} ${!isAvailable ? 'disabled' : ''}>
          <span>${this.escapeHtml(outlet)}</span>
          ${isAvailable ? `<span class="pr-filter-outlet-count">${count}</span>` : ''}
        </label>
      `;
    }).join('');

    this.dom.filterOutletList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = this.dom.filterOutletList.querySelectorAll('input[type="checkbox"]:checked');
        this.filters.outlets = Array.from(checked).map(c => c.value);
        this.renderNews();
        this.updateFilterIndicator();
      });
    });
  }
  
  getFilteredNews() {
    let filtered = [...this.newsHooks];
    
    // Apply search filter
    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter(item => {
        const fields = [
          item.headline || '',
          item.summary || '',
          item.angle_title || '',
          item.angle_narrative || '',
          item.relevance || '',
          item.outlet || ''
        ].join(' ').toLowerCase();
        return fields.includes(q);
      });
    }
    
    // Apply date filter
    if (this.filters.dateRange !== 'all') {
      const now = Date.now();
      const daysMs = this.filters.dateRange * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date || item.fetched_at);
        return (now - itemDate.getTime()) < daysMs;
      });
    }
    
    // Apply outlet filter
    if (this.filters.outlets.length > 0) {
      filtered = filtered.filter(item => this.filters.outlets.includes(item.outlet));
    }
    
    return filtered;
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
        this.normalizeNewsContentTypes();
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
      this.dom.newsHooksList.innerHTML = '';
    }
    this._newsLoaderId = startLoaderStatus(this.dom.newsHooksList, 'news');

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
      this.normalizeNewsContentTypes();
      this.renderNews();
    } catch (error) {
      console.error('Error refreshing news:', error);
      if (this.dom.newsHooksList) {
        this.dom.newsHooksList.innerHTML = '<p class="pr-news-hooks-empty">Failed to load news. Try again.</p>';
      }
    } finally {
      stopLoaderStatus(this._newsLoaderId);
      this._newsLoaderId = null;
      if (this.dom.fetchNewsBtn) {
        this.dom.fetchNewsBtn.disabled = false;
        this.dom.fetchNewsBtn.classList.remove('spinning');
      }
    }
  }

  normalizeNewsContentTypes() {
    for (const hook of this.newsHooks) {
      if (Array.isArray(hook.content_plan)) {
        for (const item of hook.content_plan) {
          if (item.type) item.type = normalizeContentType(item.type);
        }
      }
    }
  }

  async regenerateContentPlans() {
    if (this.dom.regeneratePlansBtn) {
      this.dom.regeneratePlansBtn.disabled = true;
      this.dom.regeneratePlansBtn.classList.add('spinning');
    }
    this._plansLoaderId = startLoaderStatus(this.dom.newsHooksList, 'plans');

    try {
      const allArticles = this.newsHooks || [];
      const articles = allArticles.filter(item => !this._archivedNewsIds.has(item.url || item.headline));

      if (articles.length === 0) {
        return;
      }

      const payload = articles.map(a => ({
        headline: a.headline,
        outlet: a.outlet,
        date: a.date,
        summary: a.summary,
        url: a.url
      }));

      const response = await fetch('/api/pr/regenerate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: payload })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to regenerate plans');

      const plans = data.plans || [];
      if (plans.length === 0) throw new Error('No plans returned');

      const plansByUrl = new Map();
      for (const plan of plans) {
        if (plan.url) plansByUrl.set(plan.url, plan);
      }

      let updated = 0;
      for (const item of this.newsHooks) {
        const match = plansByUrl.get(item.url);
        if (match) {
          item.content_plan = match.content_plan;
          if (match.angle_title) item.angle_title = match.angle_title;
          if (match.angle_narrative) item.angle_narrative = match.angle_narrative;
          updated++;
        }
      }

      this.normalizeNewsContentTypes();
      this.renderNews();
    } catch (error) {
      console.error('Error regenerating content plans:', error);
    } finally {
      stopLoaderStatus(this._plansLoaderId);
      this._plansLoaderId = null;
      if (this.dom.regeneratePlansBtn) {
        this.dom.regeneratePlansBtn.disabled = false;
        this.dom.regeneratePlansBtn.classList.remove('spinning');
      }
    }
  }

  renderNews() {
    if (!this.dom.newsHooksList) return;

    // Apply filters
    const filteredNews = this.getFilteredNews();

    // Separate active vs archived
    let activeNews = filteredNews.filter(item => !this._archivedNewsIds.has(item.url || item.headline));
    const archivedNews = filteredNews.filter(item => this._archivedNewsIds.has(item.url || item.headline));

    // Apply favorites filter
    if (this._favoritesFilter === 'favorites') {
      activeNews = activeNews.filter(item => this._favoriteIds.has(item.url || item.headline));
    }

    if (activeNews.length === 0 && archivedNews.length === 0) {
      if (this._favoritesFilter === 'favorites') {
        this.dom.newsHooksList.innerHTML = `
          <p class="pr-news-hooks-empty">No favorite articles yet. Click the heart icon on a card to add it.</p>
        `;
      } else if (this.newsHooks.length === 0) {
        this.dom.newsHooksList.innerHTML = `
          <p class="pr-news-hooks-empty">No news hooks yet. Click Refresh to search.</p>
        `;
      } else if (this.searchQuery) {
        this.dom.newsHooksList.innerHTML = `
          <p class="pr-news-hooks-empty">No articles match "${this.escapeHtml(this.searchQuery)}". Try a different search.</p>
        `;
      } else {
        this.dom.newsHooksList.innerHTML = `
          <p class="pr-news-hooks-empty">No news matches your filters. Try adjusting above.</p>
        `;
      }
      return;
    }

    // Slice to show only displayed count
    const displayedItems = activeNews.slice(0, this.displayedNewsCount);
    const remainingCount = activeNews.length - this.displayedNewsCount;
    
    let html = '<div class="pr-news-items">';
    
    displayedItems.forEach((item, displayIndex) => {
      // Use actual index from full array for proper data binding
      const actualIndex = this.newsHooks.indexOf(item);
      const date = new Date(item.date || item.fetched_at);
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      const isStale = daysAgo > 7;
      
      // Build angle display with fallback chain
      const angleTitle = item.angle_title || '';
      const angleNarrative = item.angle_narrative || '';
      const hasAngle = angleTitle || angleNarrative;
      const isFallback = !angleTitle && !angleNarrative && item.relevance;
      const displayAngleTitle = angleTitle || (isFallback ? 'Glossi tie-in' : '');
      const displayAngleNarrative = angleNarrative || (isFallback ? item.relevance : '');
      const showAngleRow = displayAngleTitle || displayAngleNarrative;
      
      const newsId = item.url || item.headline;
      const inWorkspace = this._stories.has(newsId);
      const isFavorited = this._favoriteIds.has(newsId);
      html += `
        <div class="pr-news-item ${isStale ? 'stale' : ''} ${inWorkspace ? 'in-workspace' : ''} ${isFavorited ? 'favorited' : ''}" data-news-id="${this.escapeHtml(newsId)}">
          ${inWorkspace ? '<span class="pr-card-status-badge">In Progress</span>' : ''}
          <button class="pr-news-card-favorite ${isFavorited ? 'active' : ''}" data-favorite-id="${this.escapeHtml(newsId)}" data-favorite-type="news" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}"><i class="${isFavorited ? 'ph-fill' : 'ph-light'} ph-heart"></i></button>
          <button class="pr-news-card-archive" data-archive-news-id="${this.escapeHtml(newsId)}" title="Archive"><i class="ph-light ph-archive"></i></button>
          <a href="${item.url}" target="_blank" class="pr-news-headline">${this.escapeHtml(item.headline)}</a>
          <div class="pr-news-meta">
            <span class="pr-news-outlet">${this.escapeHtml(item.outlet)}</span>
            <span class="pr-news-date">${daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}</span>
          </div>
          <p class="pr-news-summary">${this.escapeHtml(item.summary)}</p>
          ${showAngleRow ? `
          <div class="pr-news-angle">
            <div class="pr-news-angle-row">
              <i class="ph-light ph-caret-right pr-angle-chevron"></i>
              <span class="pr-news-angle-title">${this.escapeHtml(displayAngleTitle)}</span>
              <button class="pr-create-content-btn" data-news-index="${actualIndex}">
                <i class="ph-light ph-lightning"></i>
              </button>
            </div>
            ${displayAngleNarrative ? `
            <div class="pr-news-angle-body">
              <p class="pr-news-angle-narrative">${this.escapeHtml(displayAngleNarrative)}</p>
              ${(() => {
                let cp = item.content_plan;
                if (typeof cp === 'string') { try { cp = JSON.parse(cp); } catch (e) { cp = null; } }
                if (!cp || !Array.isArray(cp) || cp.length === 0) return '';
                return `<div class="pr-news-plan-list">${cp.map((p, pi) => {
                  const label = CONTENT_TYPES.find(t => t.id === normalizeContentType(p.type))?.label || normalizeContentType(p.type);
                  const audienceBadge = p.audience ? `<span class="pr-audience-badge pr-audience-${p.audience}">${p.audience}</span>` : '';
                  return `
                    <div class="pr-news-plan-item" data-plan-index="${pi}">
                      <div class="pr-news-plan-header">
                        <i class="ph-light ph-caret-right pr-plan-item-chevron"></i>
                        <span class="pr-news-plan-label">${this.escapeHtml(label)}</span>
                        ${audienceBadge}
                      </div>
                      ${p.description ? `<div class="pr-news-plan-desc"><p>${this.escapeHtml(p.description)}</p></div>` : ''}
                    </div>`;
                }).join('')}</div>`;
              })()}
            </div>
            ` : ''}
          </div>
          ` : `
          <div class="pr-news-angle-row pr-news-angle-row-noangle">
            <button class="pr-create-content-btn" data-news-index="${actualIndex}">
              <i class="ph-light ph-lightning"></i>
            </button>
          </div>
          `}
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
    
    // Archived news section
    if (archivedNews.length > 0) {
      html += `<div class="pr-news-archived-section ${this._newsArchivedExpanded ? 'expanded' : ''}">
        <div class="pr-news-archived-header" data-toggle="news-archived">
          <i class="ph-light ph-caret-right"></i>
          <span>Archived (${archivedNews.length})</span>
        </div>
        <div class="pr-news-archived-list">
          ${archivedNews.map(item => {
            const nid = item.url || item.headline;
            return `<div class="pr-news-archived-item">
              <span class="pr-news-archived-item-title" title="${this.escapeHtml(item.headline)}">${this.escapeHtml(item.headline)}</span>
              <button class="pr-news-unarchive-btn" data-unarchive-news-id="${this.escapeHtml(nid)}" title="Restore"><i class="ph-light ph-arrow-counter-clockwise"></i></button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    this.dom.newsHooksList.innerHTML = html;
    this.attachNewsEventListenersToContainer(this.dom.newsHooksList);
    
    // Attach Show More button listener
    const showMoreBtn = this.dom.newsHooksList.querySelector('.pr-show-more-news-btn');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => this.showMoreNews());
    }

    // Attach news archive/unarchive listeners
    this.dom.newsHooksList.querySelectorAll('[data-archive-news-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.archiveNewsCard(btn.dataset.archiveNewsId);
      });
    });
    this.dom.newsHooksList.querySelectorAll('[data-unarchive-news-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.unarchiveNewsCard(btn.dataset.unarchiveNewsId);
      });
    });

    // Attach favorite toggle listeners
    this.dom.newsHooksList.querySelectorAll('[data-favorite-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(btn.dataset.favoriteId, btn.dataset.favoriteType);
      });
    });
    const newsArchivedHeader = this.dom.newsHooksList.querySelector('[data-toggle="news-archived"]');
    if (newsArchivedHeader) {
      newsArchivedHeader.addEventListener('click', () => {
        this._newsArchivedExpanded = !this._newsArchivedExpanded;
        const section = newsArchivedHeader.closest('.pr-news-archived-section');
        if (section) section.classList.toggle('expanded', this._newsArchivedExpanded);
      });
    }
  }

  attachNewsEventListenersToContainer(container) {
    // Angle row expand/collapse toggle
    container.querySelectorAll('.pr-news-angle-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't toggle when clicking the Create button
        if (e.target.closest('.pr-create-content-btn')) return;
        const card = row.closest('.pr-news-item');
        if (card) card.classList.toggle('expanded');
      });
    });

    // Content plan item expand/collapse
    container.querySelectorAll('.pr-news-plan-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = header.closest('.pr-news-plan-item');
        if (item) item.classList.toggle('expanded');
      });
    });

    // Create Content button
    container.querySelectorAll('.pr-create-content-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.newsIndex);
        const newsItem = this.newsHooks[index];
        if (!newsItem) return;

        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = glossiLoaderSVG('glossi-loader-xs');

        await this.launchCreateWorkspace(newsItem);

        btn.disabled = false;
        btn.innerHTML = originalHTML;
      });
    });
  }

  // =========================================
  // NEWS CARD ARCHIVE
  // =========================================

  loadArchivedNewsIds() {
    try {
      const saved = localStorage.getItem('pr_archived_news_ids');
      if (saved) this._archivedNewsIds = new Set(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }

  saveArchivedNewsIds() {
    try {
      localStorage.setItem('pr_archived_news_ids', JSON.stringify([...this._archivedNewsIds]));
    } catch (e) { /* ignore */ }
  }

  archiveNewsCard(newsId) {
    this._archivedNewsIds.add(newsId);
    this.saveArchivedNewsIds();
    this.renderNews();
  }

  unarchiveNewsCard(newsId) {
    this._archivedNewsIds.delete(newsId);
    this.saveArchivedNewsIds();
    this.renderNews();
  }

  // =========================================
  // FAVORITES
  // =========================================

  async loadFavorites() {
    try {
      const res = await fetch('/api/pr/favorites');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.favorites)) {
        this._favoriteIds = new Set(data.favorites.map(f => f.item_id));
      }
    } catch (e) { /* silent */ }
  }

  async toggleFavorite(itemId, itemType) {
    const isFav = this._favoriteIds.has(itemId);
    if (isFav) {
      this._favoriteIds.delete(itemId);
      try { await fetch(`/api/pr/favorites/${encodeURIComponent(itemId)}`, { method: 'DELETE' }); } catch (e) { /* silent */ }
    } else {
      this._favoriteIds.add(itemId);
      try {
        await fetch('/api/pr/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, item_type: itemType || 'news' })
        });
      } catch (e) { /* silent */ }
    }
    this.renderNews();
    this.renderCustomCards();
  }

  setupFavoritesFilter() {
    const filterWrap = document.getElementById('pr-favorites-filter');
    if (!filterWrap) return;
    filterWrap.querySelectorAll('.pr-favorites-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        filterWrap.querySelectorAll('.pr-favorites-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this._favoritesFilter = pill.dataset.favoritesFilter;
        this.renderNews();
        this.renderCustomCards();
      });
    });
  }

  // =========================================
  // MULTI-STORY WORKSPACE
  // =========================================

  getStoryKey(newsItem) {
    return newsItem.url || newsItem.headline || `story_${Date.now()}`;
  }

  saveCurrentStoryState() {
    if (!this._activeStoryKey || !this._stories.has(this._activeStoryKey)) return;
    // Persist any in-progress text edits before saving story state
    this.prAgent.saveCurrentEdits();
    // Save current tab's suggestions into its per-tab entry
    const suggestionsEl = document.getElementById('pr-suggestions');
    if (this._activeTabId && this._tabContent) {
      const activeEntry = this._tabContent.get(this._activeTabId);
      if (activeEntry && suggestionsEl) activeEntry.suggestionsHTML = suggestionsEl.innerHTML;
    }
    const story = this._stories.get(this._activeStoryKey);
    story.tabContent = this._tabContent ? new Map(this._tabContent) : new Map();
    story.activeTabId = this._activeTabId;
    story.currentOutput = this.prAgent.currentOutput;
    // Also save at story level for backward compatibility
    if (suggestionsEl) story.suggestionsHTML = suggestionsEl.innerHTML;
  }

  restoreStoryState(key) {
    const story = this._stories.get(key);
    if (!story) return;

    this._activeStoryKey = key;
    this._activeNewsItem = story.newsItem;
    this._activeContentPlan = story.contentPlan;
    this._tabContent = story.tabContent || new Map();
    this._activeTabId = story.activeTabId;

    // Restore left panel
    this.populateLeftPanel(story.newsItem);

    // Restore content plan tabs
    this.renderContentPlanTabs(story.contentPlan);

    // Restore active tab content via switchContentTab (handles visuals + content)
    if (story.activeTabId) {
      this.switchContentTab(story.activeTabId);
    } else if (story.currentOutput) {
      this.prAgent.currentOutput = story.currentOutput;
      this.prAgent.renderGeneratedContent(story.currentOutput);
      this.prAgent.showWorkspace();
    }

    // Restore suggestions
    const suggestionsEl = document.getElementById('pr-suggestions');
    if (suggestionsEl && story.suggestionsHTML) suggestionsEl.innerHTML = story.suggestionsHTML;
    // Show left panel chat if content exists
    if (this.prAgent.dom.workspaceChat && story.currentOutput) {
      this.prAgent.dom.workspaceChat.style.display = 'flex';
    }

    // Set angle context
    if (story.custom) {
      this.prAgent.angleContext = {
        narrative: story.newsItem?.summary || '',
        target: story.contentPlan[0]?.target || '',
        description: story.contentPlan[0]?.description || ''
      };
    } else {
      this.prAgent.angleContext = {
        narrative: story.newsItem?.angle_narrative || story.newsItem?.relevance || story.newsItem?.summary || '',
        target: story.contentPlan[0]?.target || '',
        description: story.contentPlan[0]?.description || ''
      };
    }
  }

  switchToStory(key) {
    if (key === this._activeStoryKey) return;
    this.saveCurrentStoryState();
    this.restoreStoryState(key);
  }

  closeStory(key) {
    this._stories.delete(key);

    // Delete all outputs for this story from the database
    try {
      fetch(`/api/pr/outputs/story/${encodeURIComponent(key)}`, { method: 'DELETE' });
    } catch (e) { /* silent */ }

    if (this._activeStoryKey === key) {
      // Switch to next available story or show empty
      const keys = [...this._stories.keys()];
      if (keys.length > 0) {
        this.restoreStoryState(keys[0]);
      } else {
        this._activeStoryKey = null;
        this._activeNewsItem = null;
        this._tabContent = new Map();
        this._activeTabId = null;
        this.prAgent.currentOutput = null;
        // Reset UI to empty state
        const tabsEl = document.getElementById('pr-content-tabs');
        if (tabsEl) { tabsEl.style.display = 'none'; tabsEl.querySelectorAll('.pr-content-tab').forEach(t => t.remove()); }
        if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
        if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
        if (this.prAgent.dom.workspaceChat) this.prAgent.dom.workspaceChat.style.display = 'none';
        this.renderStorySelector();
      }
    } else {
      this.renderStorySelector();
    }

    // Update strategy cards to remove in-workspace status
    this.renderNews();
    this.renderCustomCards();
  }

  deleteContentPiece(storyKey, planIndex) {
    const story = this._stories.get(storyKey);
    if (!story || !story.contentPlan || planIndex >= story.contentPlan.length) return;

    const isActive = storyKey === this._activeStoryKey;
    const oldLength = story.contentPlan.length;

    // Delete the specific output from the database if it exists
    const oldTabContent = isActive ? this._tabContent : (story.tabContent || new Map());
    const deletedEntry = oldTabContent.get(`plan_${planIndex}`);
    if (deletedEntry?.output?.id) {
      try {
        fetch(`/api/pr/outputs/${encodeURIComponent(deletedEntry.output.id)}`, { method: 'DELETE' });
      } catch (e) { /* silent */ }
    }

    // Rebuild tabContent map with shifted indices (remove deleted, shift later ones down)
    const newTabContent = new Map();
    for (let i = 0; i < oldLength; i++) {
      if (i === planIndex) continue;
      const entry = oldTabContent.get(`plan_${i}`);
      const newIdx = i < planIndex ? i : i - 1;
      if (entry) newTabContent.set(`plan_${newIdx}`, entry);
    }

    // Remove from content plan
    story.contentPlan.splice(planIndex, 1);
    story.tabContent = newTabContent;

    if (isActive) {
      this._tabContent = newTabContent;
      this._activeContentPlan = story.contentPlan;
    }

    // If no pieces remain, close the story
    if (story.contentPlan.length === 0) {
      this.closeStory(storyKey);
      return;
    }

    // If this is the active story, update tabs and switch if needed
    if (isActive) {
      const newTabId = 'plan_0';
      this._activeTabId = newTabId;
      story.activeTabId = newTabId;
      this.renderContentPlanTabs(story.contentPlan);
      this.switchContentTab(newTabId);
    }

    this.renderFileTree();
  }

  showAddPieceDropdown(storyKey, container) {
    const story = this._stories.get(storyKey);
    if (!story) return;

    const existingTypes = new Set(story.contentPlan.map(p => p.type));
    const available = CONTENT_TYPES.filter(t => t.id !== 'custom' && !existingTypes.has(t.id));

    if (available.length === 0) {
      this.prAgent.showToast('All content types already in plan', 'info');
      return;
    }

    container.innerHTML = `
      <div class="pr-add-piece-dropdown">
        ${available.map(t => `<button class="pr-add-piece-option" data-add-type="${t.id}">${this.escapeHtml(t.label)}</button>`).join('')}
      </div>`;
    container.dataset.storyKey = storyKey;

    const dismiss = (e) => {
      if (!container.contains(e.target)) {
        this.renderFileTree();
        document.removeEventListener('click', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  showAddPieceBrief(type, container) {
    const typeLabel = CONTENT_TYPES.find(t => t.id === type)?.label || type;
    container.dataset.addType = type;
    container.innerHTML = `
      <span class="pr-add-piece-type-label">${this.escapeHtml(typeLabel)}</span>
      <input class="pr-add-piece-brief-input" type="text" placeholder="Brief (optional)" autofocus />
      <button class="pr-add-piece-confirm" title="Add"><i class="ph-light ph-check"></i></button>`;

    const input = container.querySelector('.pr-add-piece-brief-input');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmAddPiece(input.value.trim(), type);
        } else if (e.key === 'Escape') {
          this.renderFileTree();
        }
      });
    }
  }

  confirmAddPiece(brief, type) {
    const story = this._stories.get(this._activeStoryKey);
    if (!story) return;

    const newItem = {
      type,
      description: brief || '',
      priority: story.contentPlan.length + 1,
      audience: 'brands'
    };

    story.contentPlan.push(newItem);
    this._activeContentPlan = story.contentPlan;

    const newTabId = `plan_${story.contentPlan.length - 1}`;
    this._tabContent.set(newTabId, { loading: false, output: null, refining: false, suggestionsHTML: '' });
    story.tabContent = this._tabContent;

    this.renderContentPlanTabs(story.contentPlan);
    this.renderFileTree();
    this.switchContentTab(newTabId);
  }

  async archiveStory(key) {
    const story = this._stories.get(key);
    if (!story) return;
    story.archived = true;

    // If archiving the active story, switch to next non-archived one
    if (this._activeStoryKey === key) {
      const nextKey = [...this._stories.keys()].find(k => k !== key && !this._stories.get(k)?.archived);
      if (nextKey) {
        this.restoreStoryState(nextKey);
      } else {
        this._activeStoryKey = null;
        this._activeNewsItem = null;
        this._tabContent = new Map();
        this._activeTabId = null;
        this.prAgent.currentOutput = null;
        const tabsEl = document.getElementById('pr-content-tabs');
        if (tabsEl) { tabsEl.style.display = 'none'; tabsEl.querySelectorAll('.pr-content-tab').forEach(t => t.remove()); }
        if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
        if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
        if (this.prAgent.dom.workspaceChat) this.prAgent.dom.workspaceChat.style.display = 'none';
      }
    }

    this.renderFileTree();

    try {
      await fetch('/api/pr/outputs/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_key: key, archived: true })
      });
    } catch (e) { /* silent */ }
  }

  async unarchiveStory(key) {
    const story = this._stories.get(key);
    if (!story) return;
    story.archived = false;
    this.renderFileTree();

    try {
      await fetch('/api/pr/outputs/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_key: key, archived: false })
      });
    } catch (e) { /* silent */ }
  }

  async archiveSelectedStories() {
    const keys = [...this._selectedStoryKeys];
    if (keys.length === 0) return;

    keys.forEach(key => {
      const story = this._stories.get(key);
      if (story) story.archived = true;
    });

    // If active story was among selected, switch away
    if (this._selectedStoryKeys.has(this._activeStoryKey)) {
      const nextKey = [...this._stories.keys()].find(k => !this._stories.get(k)?.archived);
      if (nextKey) {
        this.restoreStoryState(nextKey);
      } else {
        this._activeStoryKey = null;
        this._activeNewsItem = null;
        this._tabContent = new Map();
        this._activeTabId = null;
        this.prAgent.currentOutput = null;
        const tabsEl = document.getElementById('pr-content-tabs');
        if (tabsEl) { tabsEl.style.display = 'none'; tabsEl.querySelectorAll('.pr-content-tab').forEach(t => t.remove()); }
        if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
        if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
        if (this.prAgent.dom.workspaceChat) this.prAgent.dom.workspaceChat.style.display = 'none';
      }
    }

    this._selectedStoryKeys.clear();
    this._selectMode = false;
    this.renderFileTree();

    try {
      await fetch('/api/pr/outputs/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_keys: keys, archived: true })
      });
    } catch (e) { /* silent */ }
  }

  toggleSelectMode() {
    this._selectMode = !this._selectMode;
    if (!this._selectMode) this._selectedStoryKeys.clear();
    this.renderFileTree();
  }

  toggleStorySelection(key) {
    if (this._selectedStoryKeys.has(key)) {
      this._selectedStoryKeys.delete(key);
    } else {
      this._selectedStoryKeys.add(key);
    }
    this.renderFileTree();
  }

  renderFileTree() {
    const container = document.getElementById('pr-file-tree');

    // Separate stories into articles vs custom, then active vs archived
    const articleActive = [];
    const articleArchived = [];
    const customActive = [];
    const customArchived = [];
    for (const [key, story] of this._stories) {
      const isCustom = story.custom === true;
      if (story.archived) {
        (isCustom ? customArchived : articleArchived).push([key, story]);
      } else {
        (isCustom ? customActive : articleActive).push([key, story]);
      }
    }

    if (!container) return;

    const hasCustom = customActive.length > 0 || customArchived.length > 0;
    const activeStories = articleActive;
    const archivedStories = articleArchived;

    if (this._stories.size === 0 || (activeStories.length === 0 && archivedStories.length === 0 && !hasCustom)) {
      container.innerHTML = `<div class="pr-file-tree-empty"><p>Click "Create Content" on a news card to get started.</p></div>`;
      return;
    }

    let html = '';

    // Select mode toolbar
    if (this._selectMode && activeStories.length > 0) {
      const count = this._selectedStoryKeys.size;
      html += `
        <div class="pr-file-tree-bulk-bar">
          <button class="pr-file-tree-bulk-archive" ${count === 0 ? 'disabled' : ''}>
            <i class="ph-light ph-archive"></i> Archive${count > 0 ? ` (${count})` : ''}
          </button>
          <button class="pr-file-tree-bulk-cancel">Cancel</button>
        </div>
      `;
    }

    // Render active stories
    for (const [key, story] of activeStories) {
      html += this._renderStoryNode(key, story);
    }

    // Empty state if no active stories
    if (activeStories.length === 0 && archivedStories.length > 0) {
      html += `<div class="pr-file-tree-empty"><p>All articles archived.</p></div>`;
    } else if (activeStories.length === 0) {
      html += `<div class="pr-file-tree-empty"><p>Click "Create Content" on a news card to get started.</p></div>`;
    }

    // Archived section
    if (archivedStories.length > 0) {
      html += this._renderArchivedSection(archivedStories);
    }

    // Custom section (below articles, same container)
    if (hasCustom) {
      html += `<div class="pr-panel-label-row pr-custom-label-row"><span class="pr-panel-label">Custom</span></div>`;
      for (const [key, story] of customActive) {
        html += this._renderStoryNode(key, story);
      }
      if (customArchived.length > 0) {
        html += this._renderArchivedSection(customArchived);
      }
    }

    container.innerHTML = html;
  }

  _renderArchivedSection(archivedStories) {
    return `
      <div class="pr-file-tree-archived-section ${this._archivedExpanded ? 'expanded' : ''}">
        <div class="pr-file-tree-archived-header">
          <i class="ph-light ph-caret-right pr-file-tree-archived-chevron"></i>
          <span class="pr-file-tree-archived-label">Archived</span>
          <span class="pr-file-tree-archived-count">${archivedStories.length}</span>
        </div>
        <div class="pr-file-tree-archived-list">
          ${archivedStories.map(([key, story]) => {
            const headline = (story.custom ? story.customTitle : story.newsItem?.headline) || 'Untitled';
            return `
              <div class="pr-file-tree-archived-node" data-story-key="${this.escapeHtml(key)}">
                <span class="pr-file-tree-archived-node-label" title="${this.escapeHtml(headline)}">${this.escapeHtml(headline)}</span>
                <button class="pr-file-tree-unarchive" data-unarchive-key="${this.escapeHtml(key)}" title="Restore">
                  <i class="ph-light ph-arrow-counter-clockwise"></i>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  _renderStoryNode(key, story) {
    const isActiveStory = key === this._activeStoryKey;
    const headline = story.custom ? (story.customTitle || 'Untitled') : (story.newsItem?.headline || 'Untitled');
    const contentPlan = story.contentPlan || [];

    const childrenHTML = contentPlan.map((item, i) => {
      const tabId = `plan_${i}`;
      const typeLabel = CONTENT_TYPES.find(t => t.id === item.type)?.label || item.type;
      const isActiveLeaf = isActiveStory && this._activeTabId === tabId;
      return `
        <div class="pr-file-tree-leaf ${isActiveLeaf ? 'active' : ''}" data-story-key="${this.escapeHtml(key)}" data-tab-id="${tabId}">
          <span class="pr-file-tree-leaf-label">${this.escapeHtml(typeLabel)}</span>
          <button class="pr-file-tree-leaf-delete" data-delete-story="${this.escapeHtml(key)}" data-delete-plan-index="${i}" title="Remove piece">
            <i class="ph-light ph-x"></i>
          </button>
        </div>
      `;
    }).join('');

    const addPieceHTML = isActiveStory ? `
      <div class="pr-add-piece" data-story-key="${this.escapeHtml(key)}">
        <i class="ph-light ph-plus"></i><span>Add channel</span>
      </div>` : '';

    // Inline angle block (skip for custom stories)
    const angleTitle = story.custom ? '' : (story.newsItem?.angle_title || '');
    const angleNarrative = story.custom ? '' : (story.newsItem?.angle_narrative || story.newsItem?.relevance || '');
    let angleHTML = '';
    if (angleTitle || angleNarrative) {
      angleHTML = `
        <div class="pr-tree-angle">
          <div class="pr-tree-angle-header">
            <i class="ph-light ph-lightbulb pr-tree-angle-icon"></i>
            <span class="pr-tree-angle-title">${this.escapeHtml(angleTitle)}</span>
          </div>
          ${angleNarrative ? `
          <div class="pr-tree-angle-narrative">${this.escapeHtml(angleNarrative)}</div>
          <span class="pr-tree-angle-readmore pr-tree-angle-toggle">read more</span>
          <span class="pr-tree-angle-less pr-tree-angle-toggle">less</span>
          ` : ''}
        </div>
      `;
    }

    const isSelected = this._selectMode && this._selectedStoryKeys.has(key);
    const checkboxHTML = this._selectMode ? `
      <label class="pr-file-tree-select-checkbox" data-select-key="${this.escapeHtml(key)}">
        <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1">
      </label>
    ` : '';

    return `
      <div class="pr-file-tree-node ${isActiveStory ? 'expanded' : ''}" data-story-key="${this.escapeHtml(key)}">
        <div class="pr-file-tree-header ${isActiveStory ? 'active' : ''}">
          ${checkboxHTML}
          <i class="ph-light ph-caret-right pr-file-tree-chevron"></i>
          <span class="pr-file-tree-label" title="${this.escapeHtml(headline)}">${this.escapeHtml(headline)}</span>
          <button class="pr-file-tree-archive-btn" data-archive-key="${this.escapeHtml(key)}" title="Archive article">
            <i class="ph-light ph-archive"></i>
          </button>
          <button class="pr-file-tree-close" data-tree-close="${this.escapeHtml(key)}" title="Close story">
            <i class="ph-light ph-x"></i>
          </button>
        </div>
        <div class="pr-file-tree-children">${childrenHTML}${addPieceHTML}${angleHTML}</div>
      </div>
    `;
  }

  // Kept for backward compat (called from restoreStoryState references)
  renderStorySelector() {
    this.renderFileTree();
  }

  setupFileTree() {
    const container = document.getElementById('pr-file-tree');

    // Select mode toggle button
    const selectToggle = document.getElementById('pr-select-toggle');
    if (selectToggle) {
      selectToggle.addEventListener('click', () => this.toggleSelectMode());
    }

    // Shared click handler for both article and custom file trees
    const handleTreeClick = (e) => {
      const bulkArchive = e.target.closest('.pr-file-tree-bulk-archive');
      if (bulkArchive && !bulkArchive.disabled) {
        e.stopPropagation();
        this.archiveSelectedStories();
        return;
      }

      const bulkCancel = e.target.closest('.pr-file-tree-bulk-cancel');
      if (bulkCancel) {
        e.stopPropagation();
        this.toggleSelectMode();
        return;
      }

      const archiveBtn = e.target.closest('[data-archive-key]');
      if (archiveBtn) {
        e.stopPropagation();
        this.archiveStory(archiveBtn.dataset.archiveKey);
        return;
      }

      const unarchiveBtn = e.target.closest('[data-unarchive-key]');
      if (unarchiveBtn) {
        e.stopPropagation();
        this.unarchiveStory(unarchiveBtn.dataset.unarchiveKey);
        return;
      }

      const archivedHeader = e.target.closest('.pr-file-tree-archived-header');
      if (archivedHeader) {
        this._archivedExpanded = !this._archivedExpanded;
        const section = archivedHeader.closest('.pr-file-tree-archived-section');
        if (section) section.classList.toggle('expanded', this._archivedExpanded);
        return;
      }

      const checkbox = e.target.closest('.pr-file-tree-select-checkbox');
      if (checkbox) {
        e.stopPropagation();
        const key = checkbox.dataset.selectKey;
        if (key) this.toggleStorySelection(key);
        return;
      }

      const closeBtn = e.target.closest('[data-tree-close]');
      if (closeBtn) {
        e.stopPropagation();
        this.closeStory(closeBtn.dataset.treeClose);
        return;
      }

      const angleToggle = e.target.closest('.pr-tree-angle-toggle');
      if (angleToggle) {
        const angle = angleToggle.closest('.pr-tree-angle');
        if (angle) angle.classList.toggle('expanded');
        return;
      }

      const addPieceBtn = e.target.closest('.pr-add-piece');
      if (addPieceBtn) {
        e.stopPropagation();
        this.showAddPieceDropdown(addPieceBtn.dataset.storyKey, addPieceBtn);
        return;
      }

      const addPieceType = e.target.closest('[data-add-type]');
      if (addPieceType) {
        e.stopPropagation();
        this.showAddPieceBrief(addPieceType.dataset.addType, addPieceType.closest('.pr-add-piece'));
        return;
      }

      const addPieceConfirm = e.target.closest('.pr-add-piece-confirm');
      if (addPieceConfirm) {
        e.stopPropagation();
        const container = addPieceConfirm.closest('.pr-add-piece');
        const input = container?.querySelector('.pr-add-piece-brief-input');
        if (input) this.confirmAddPiece(input.value.trim(), container.dataset.addType);
        return;
      }

      const deleteBtn = e.target.closest('.pr-file-tree-leaf-delete');
      if (deleteBtn) {
        e.stopPropagation();
        const storyKey = deleteBtn.dataset.deleteStory;
        const planIndex = parseInt(deleteBtn.dataset.deletePlanIndex, 10);
        this.deleteContentPiece(storyKey, planIndex);
        return;
      }

      const leaf = e.target.closest('.pr-file-tree-leaf');
      if (leaf) {
        const storyKey = leaf.dataset.storyKey;
        const tabId = leaf.dataset.tabId;
        if (storyKey !== this._activeStoryKey) {
          this.switchToStory(storyKey);
        }
        if (tabId) {
          this.switchContentTab(tabId);
          // Auto-generate if tab has no content yet
          const entry = this._tabContent.get(tabId);
          if (!entry || (!entry.loading && !entry.output)) {
            const planIndex = parseInt(tabId.replace('plan_', ''), 10);
            if (this._activeContentPlan && this._activeContentPlan[planIndex] && this._activeNewsItem) {
              this.generateTabContent(tabId, this._activeContentPlan[planIndex], this._activeNewsItem);
            }
          }
          this.renderFileTree();
        }
        return;
      }

      const header = e.target.closest('.pr-file-tree-header');
      if (header) {
        const node = header.closest('.pr-file-tree-node');
        if (!node) return;
        const storyKey = node.dataset.storyKey;

        if (storyKey === this._activeStoryKey) {
          node.classList.toggle('expanded');
        } else {
          this.switchToStory(storyKey);
        }
        return;
      }
    };

    if (container) container.addEventListener('click', handleTreeClick);
  }

  populateLeftPanel(newsItem) {
    this.renderFileTree();
  }

  async triggerAngleAnalysis(source) {
    // Gather background context from About Glossi folder
    const glossiSources = this.prAgent.sources.filter(s => s.folder === 'About Glossi');

    const customTitle = source.title || 'Untitled';

    const defaultPlan = [
      { type: 'blog_post', description: 'In-depth analysis with product angle', priority: 1, audience: 'brands' },
      { type: 'linkedin_post', description: 'Key insight as a founder perspective post', priority: 2, audience: 'brands' },
      { type: 'tweet', description: 'One sharp, punchy tweet (280 chars max)', priority: 3, audience: 'builders' },
      { type: 'email_blast', description: 'Signal boost to subscriber list', priority: 4, audience: 'brands' }
    ];

    const primaryContext = `PRIMARY SOURCE (this is the main material to create content from):\nTitle: ${source.title}\nType: ${source.type}\nContent:\n${(source.content || '').substring(0, 5000)}`;

    let bgContext = '';
    if (glossiSources.length > 0) {
      bgContext = '\n\nBACKGROUND CONTEXT (company knowledge for additional detail, NOT the main focus):\n' +
        glossiSources.map((s, i) => {
          return `[Context ${i + 1}] Title: ${s.title}\nContent:\n${(s.content || '').substring(0, 1500)}`;
        }).join('\n---\n');
    }

    let angles = [{ angleTitle: 'Content from ' + customTitle, angleNarrative: '', contentPlan: defaultPlan }];

    // Store context for regeneration via feedback
    this._pendingAngleSource = source;
    this._pendingPrimaryContext = primaryContext;
    this._pendingBgContext = bgContext;
    this._pendingDefaultPlan = defaultPlan;
    this._pendingCustomTitle = customTitle;

    // Show modal with loading state
    this.showAngleSelectModal(angles, true);

    try {
      const result = await this._fetchAngleAnalysis(primaryContext, bgContext);
      if (result.angles && result.angles.length > 0) {
        angles = result.angles.map(a => ({
          angleTitle: a.angleTitle || 'Content from ' + customTitle,
          angleNarrative: a.angleNarrative || '',
          contentPlan: a.contentPlan || defaultPlan
        }));
      }
    } catch (e) { /* fall back to defaults */ }

    angles.forEach(a => {
      if (a.contentPlan) a.contentPlan.sort((x, y) => (x.priority || 99) - (y.priority || 99));
    });

    // Re-render modal with actual angles
    this.showAngleSelectModal(angles, false);
  }

  async regenerateAnglesWithFeedback(feedback) {
    if (!this._pendingPrimaryContext) return;

    this.showAngleSelectModal([], true);

    try {
      const result = await this._fetchAngleAnalysis(this._pendingPrimaryContext, this._pendingBgContext, feedback);
      let angles = [];
      if (result.angles && result.angles.length > 0) {
        angles = result.angles.map(a => ({
          angleTitle: a.angleTitle || 'Content from ' + (this._pendingCustomTitle || 'source'),
          angleNarrative: a.angleNarrative || '',
          contentPlan: a.contentPlan || this._pendingDefaultPlan
        }));
      }
      angles.forEach(a => {
        if (a.contentPlan) a.contentPlan.sort((x, y) => (x.priority || 99) - (y.priority || 99));
      });
      this.showAngleSelectModal(angles, false);
    } catch (e) {
      this.showAngleSelectModal([{ angleTitle: 'Fallback angle', angleNarrative: 'Could not regenerate. Try again.', contentPlan: this._pendingDefaultPlan }], false);
    }
  }

  async _fetchAngleAnalysis(primaryContext, bgContext, feedback) {
    const feedbackClause = feedback
      ? `\n\nUSER FEEDBACK on a previous angle proposal (incorporate this into all 3 new angles):\n${feedback}`
      : '';

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'You are a content strategist. Analyze the PRIMARY SOURCE material and propose 3 distinct angles for content creation. The background context is only for company knowledge. Return ONLY valid JSON.',
        messages: [{
          role: 'user',
          content: `Analyze the PRIMARY SOURCE below and propose 3 DISTINCT angles for content creation. Each angle should take a meaningfully different strategic approach to the same source material.

For each angle, provide:
1. An ANGLE TITLE (3-8 words) that captures the strategic narrative lens. Examples: "Customer Proof Points as Growth Engine", "Enterprise Validation Through Real Usage Data", "Founder Contrarian Take on Industry Shift".
2. An ANGLE NARRATIVE (2-3 sentences) explaining how this angle approaches the source material, what story threads it pulls, and how the content will be positioned.
3. A content plan with 4-5 content types specifically appropriate for THIS angle.

Each content plan item should have: type (one of: tweet, linkedin_post, blog_post, email_blast, product_announcement, talking_points, investor_snippet), description (specific to the angle), priority (1-5), audience (brands/builders/press/internal).

Return JSON: { "angles": [{ "angleTitle": "...", "angleNarrative": "...", "contentPlan": [...] }, ...] }
${feedbackClause}
${primaryContext}${bgContext}`
        }]
      })
    });

    if (!response.ok) return { angles: [] };
    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { angles: [] };
    const parsed = JSON.parse(jsonMatch[0]);

    // Support both formats: { angles: [...] } and legacy { angleTitle, angleNarrative, contentPlan }
    if (parsed.angles && Array.isArray(parsed.angles) && parsed.angles.length > 0) {
      return {
        angles: parsed.angles.map(a => ({
          angleTitle: a.angleTitle || '',
          angleNarrative: a.angleNarrative || '',
          contentPlan: (a.contentPlan && Array.isArray(a.contentPlan) && a.contentPlan.length > 0) ? a.contentPlan : null
        }))
      };
    }
    // Fallback: single angle response
    return {
      angles: [{
        angleTitle: parsed.angleTitle || '',
        angleNarrative: parsed.angleNarrative || '',
        contentPlan: (parsed.contentPlan && Array.isArray(parsed.contentPlan) && parsed.contentPlan.length > 0) ? parsed.contentPlan : null
      }]
    };
  }

  // =========================================
  // ANGLE SELECTION MODAL
  // =========================================

  showAngleSelectModal(angles, loading) {
    const container = this.dom.angleSelectCards;
    if (!container) return;

    const feedbackRow = document.getElementById('pr-angle-feedback-row');
    const feedbackInput = document.getElementById('pr-angle-feedback-input');
    const feedbackSubmit = document.getElementById('pr-angle-feedback-submit');

    if (loading) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:var(--space-6);">' + glossiLoaderSVG('glossi-loader-sm') + '</div>';
      if (feedbackRow) feedbackRow.style.display = 'none';
      this.dom.angleSelectModal?.classList.add('visible');
      return;
    }

    const iconMap = {
      linkedin_post: 'ph-linkedin-logo',
      blog_post: 'ph-article',
      email_blast: 'ph-envelope',
      tweet: 'ph-x-logo',
      talking_points: 'ph-list-bullets',
      media_pitch: 'ph-envelope',
      press_release: 'ph-article',
      founder_quote: 'ph-article',
      op_ed: 'ph-article',
      briefing_doc: 'ph-list-bullets'
    };

    this._pendingAngles = angles;

    container.innerHTML = angles.map((angle, i) => {
      const typeIcons = (angle.contentPlan || []).slice(0, 6).map(item => {
        const icon = iconMap[item.type] || 'ph-file-text';
        return `<i class="ph-light ${icon}"></i>`;
      }).join('');

      return `
        <div class="pr-angle-select-card" data-angle-index="${i}">
          <div class="pr-angle-select-card-title">${this.escapeHtml(angle.angleTitle)}</div>
          <div class="pr-angle-select-card-narrative">${this.escapeHtml(angle.angleNarrative)}</div>
          <div class="pr-angle-select-card-types">${typeIcons}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.pr-angle-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.angleIndex);
        this.acceptCustomAngle(idx);
      });
    });

    // Show feedback row and wire up regenerate
    if (feedbackRow) {
      feedbackRow.style.display = 'flex';
      if (feedbackInput) feedbackInput.value = '';
      const newSubmit = feedbackSubmit?.cloneNode(true);
      if (feedbackSubmit && newSubmit) {
        feedbackSubmit.parentNode.replaceChild(newSubmit, feedbackSubmit);
        newSubmit.addEventListener('click', () => {
          const text = feedbackInput?.value?.trim();
          if (!text) return;
          this.regenerateAnglesWithFeedback(text);
        });
      }
    }

    this.dom.angleSelectModal?.classList.add('visible');
  }

  closeAngleSelectModal() {
    this.dom.angleSelectModal?.classList.remove('visible');
    this._pendingAngleSource = null;
    this._pendingAngles = null;
  }

  acceptCustomAngle(angleIndex) {
    const source = this._pendingAngleSource;
    const angles = this._pendingAngles;
    if (!source || !angles) return;

    const selectedAngle = angles[angleIndex] || angles[0] || {};

    // Build custom card entry
    const card = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      sourceId: source.id,
      sourceTitle: source.title || 'Untitled',
      sourceContent: (source.content || '').substring(0, 2000),
      angleTitle: selectedAngle.angleTitle || '',
      angleNarrative: selectedAngle.angleNarrative || '',
      contentPlan: selectedAngle.contentPlan || [],
      createdAt: new Date().toISOString()
    };

    this._customCards.push(card);
    this.saveCustomCards();
    this.renderCustomCards();
    this.closeAngleSelectModal();
  }

  // =========================================
  // CUSTOM CARDS (Strategy > Custom tab)
  // =========================================

  loadCustomCards() {
    try {
      const saved = localStorage.getItem('pr_custom_cards');
      if (saved) this._customCards = JSON.parse(saved);
    } catch (e) { /* ignore */ }
    this.renderCustomCards();
  }

  saveCustomCards() {
    try {
      localStorage.setItem('pr_custom_cards', JSON.stringify(this._customCards));
    } catch (e) { /* ignore */ }
  }

  archiveCustomCard(index) {
    const card = this._customCards[index];
    if (!card) return;
    card.archived = true;
    this.saveCustomCards();
    this.renderCustomCards();

    // Auto-delete the associated source
    if (card.sourceId) {
      try {
        fetch(`/api/pr/sources/${encodeURIComponent(card.sourceId)}`, { method: 'DELETE' });
        this.prAgent.sources = this.prAgent.sources.filter(s => s.id !== card.sourceId);
        this.prAgent.renderSources();
      } catch (e) { /* silent */ }
    }
  }

  unarchiveCustomCard(index) {
    const card = this._customCards[index];
    if (!card) return;
    card.archived = false;
    this.saveCustomCards();
    this.renderCustomCards();

    // Re-add the source if it was removed
    if (card.sourceId && card.sourceTitle) {
      const existing = this.prAgent.sources.find(s => s.id === card.sourceId);
      if (!existing) {
        const restoredSource = {
          id: card.sourceId,
          title: card.sourceTitle,
          content: card.sourceContent || '',
          type: 'text',
          folder: 'Content Sources'
        };
        this.prAgent.sources.push(restoredSource);
        this.prAgent.renderSources();
        try {
          fetch('/api/pr/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restoredSource)
          });
        } catch (e) { /* silent */ }
      }
    }
  }

  renderCustomCards() {
    const container = this.dom.customCardsList;
    if (!container) return;

    const activeCards = this._customCards.filter(c => !c.archived);
    const archivedCards = this._customCards.filter(c => c.archived);

    if (activeCards.length === 0 && archivedCards.length === 0) {
      container.innerHTML = '<p class="pr-news-hooks-empty">No custom sources yet. Click + to add one.</p>';
      return;
    }

    let cardsToRender = activeCards;
    if (this._favoritesFilter === 'favorites') {
      cardsToRender = activeCards.filter(c => this._favoriteIds.has(c.id));
    }

    if (cardsToRender.length === 0 && archivedCards.length === 0) {
      if (this._favoritesFilter === 'favorites') {
        container.innerHTML = '<p class="pr-news-hooks-empty">No favorite custom sources yet. Click the heart icon on a card to add it.</p>';
      } else {
        container.innerHTML = '<p class="pr-news-hooks-empty">No custom sources yet. Click + to add one.</p>';
      }
      return;
    }

    let html = '<div class="pr-news-items">';
    cardsToRender.forEach((card) => {
      const i = this._customCards.indexOf(card);
      const showAngleRow = card.angleTitle || card.angleNarrative;

      const inWorkspace = this._stories.has(card.id);
      const isFavorited = this._favoriteIds.has(card.id);
      html += `
        <div class="pr-news-item ${inWorkspace ? 'in-workspace' : ''} ${isFavorited ? 'favorited' : ''}" data-custom-index="${i}">
          ${inWorkspace ? '<span class="pr-card-status-badge">In Progress</span>' : ''}
          <button class="pr-news-card-favorite ${isFavorited ? 'active' : ''}" data-favorite-id="${this.escapeHtml(card.id)}" data-favorite-type="custom" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}"><i class="${isFavorited ? 'ph-fill' : 'ph-light'} ph-heart"></i></button>
          <button class="pr-news-card-archive" data-archive-custom-index="${i}" title="Archive"><i class="ph-light ph-archive"></i></button>
          <span class="pr-news-headline">${this.escapeHtml(card.angleTitle || card.sourceTitle)}</span>
          <div class="pr-news-meta">
            <span class="pr-news-outlet">${this.escapeHtml(card.sourceTitle)}</span>
          </div>
          <p class="pr-news-summary">${this.escapeHtml(card.angleNarrative)}</p>
          ${showAngleRow ? `
          <div class="pr-news-angle">
            <div class="pr-news-angle-row">
              <i class="ph-light ph-caret-right pr-angle-chevron"></i>
              <span class="pr-news-angle-title">Content plan</span>
              <button class="pr-create-content-btn" data-custom-index="${i}">
                <i class="ph-light ph-lightning"></i>
              </button>
            </div>
            <div class="pr-news-angle-body">
              ${(() => {
                const cp = card.contentPlan;
                if (!cp || !Array.isArray(cp) || cp.length === 0) return '';
                return '<div class="pr-news-plan-list">' + cp.map((p, pi) => {
                  const label = CONTENT_TYPES.find(t => t.id === normalizeContentType(p.type))?.label || normalizeContentType(p.type);
                  const audienceBadge = p.audience ? '<span class="pr-audience-badge pr-audience-' + p.audience + '">' + p.audience + '</span>' : '';
                  return '<div class="pr-news-plan-item" data-plan-index="' + pi + '">' +
                    '<div class="pr-news-plan-header">' +
                    '<i class="ph-light ph-caret-right pr-plan-item-chevron"></i>' +
                    '<span class="pr-news-plan-label">' + this.escapeHtml(label) + '</span>' +
                    audienceBadge +
                    '</div>' +
                    (p.description ? '<div class="pr-news-plan-desc"><p>' + this.escapeHtml(p.description) + '</p></div>' : '') +
                    '</div>';
                }).join('') + '</div>';
              })()}
            </div>
          </div>
          ` : `
          <div class="pr-news-angle-row pr-news-angle-row-noangle">
            <button class="pr-create-content-btn" data-custom-index="${i}">
              <i class="ph-light ph-lightning"></i>
            </button>
          </div>
          `}
        </div>`;
    });
    html += '</div>';

    // Archived custom cards section
    if (archivedCards.length > 0) {
      html += `<div class="pr-news-archived-section ${this._customArchivedExpanded ? 'expanded' : ''}">
        <div class="pr-news-archived-header" data-toggle="custom-archived">
          <i class="ph-light ph-caret-right"></i>
          <span>Archived (${archivedCards.length})</span>
        </div>
        <div class="pr-news-archived-list">
          ${archivedCards.map(card => {
            const idx = this._customCards.indexOf(card);
            return `<div class="pr-news-archived-item">
              <span class="pr-news-archived-item-title" title="${this.escapeHtml(card.angleTitle || card.sourceTitle)}">${this.escapeHtml(card.angleTitle || card.sourceTitle)}</span>
              <button class="pr-news-unarchive-btn" data-unarchive-custom-index="${idx}" title="Restore"><i class="ph-light ph-arrow-counter-clockwise"></i></button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    if (activeCards.length === 0 && archivedCards.length > 0) {
      html = '<p class="pr-news-hooks-empty">All custom sources archived.</p>' + html;
    }

    container.innerHTML = html;

    // Attach event listeners
    this.attachCustomCardListeners(container);

    // Archive/unarchive listeners for custom cards
    container.querySelectorAll('[data-archive-custom-index]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.archiveCustomCard(parseInt(btn.dataset.archiveCustomIndex));
      });
    });
    container.querySelectorAll('[data-unarchive-custom-index]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.unarchiveCustomCard(parseInt(btn.dataset.unarchiveCustomIndex));
      });
    });

    // Attach favorite toggle listeners for custom cards
    container.querySelectorAll('[data-favorite-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(btn.dataset.favoriteId, btn.dataset.favoriteType);
      });
    });

    const customArchivedHeader = container.querySelector('[data-toggle="custom-archived"]');
    if (customArchivedHeader) {
      customArchivedHeader.addEventListener('click', () => {
        this._customArchivedExpanded = !this._customArchivedExpanded;
        const section = customArchivedHeader.closest('.pr-news-archived-section');
        if (section) section.classList.toggle('expanded', this._customArchivedExpanded);
      });
    }
  }

  attachCustomCardListeners(container) {
    // Angle row expand/collapse toggle
    container.querySelectorAll('.pr-news-angle-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.pr-create-content-btn')) return;
        const card = row.closest('.pr-news-item');
        if (card) card.classList.toggle('expanded');
      });
    });

    // Plan item expand/collapse
    container.querySelectorAll('.pr-news-plan-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = header.closest('.pr-news-plan-item');
        if (item) item.classList.toggle('expanded');
      });
    });

    // Create Content button
    container.querySelectorAll('.pr-create-content-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.customIndex);
        const card = this._customCards[index];
        if (!card) return;

        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = glossiLoaderSVG('glossi-loader-xs');

        // Build pseudo news item from custom card
        const pseudoNewsItem = {
          headline: card.angleTitle || card.sourceTitle,
          url: card.id,
          content_plan: card.contentPlan,
          summary: card.sourceContent,
          angle_title: card.angleTitle,
          angle_narrative: card.angleNarrative,
          _customCard: card
        };

        await this.launchCreateWorkspace(pseudoNewsItem);

        btn.disabled = false;
        btn.innerHTML = originalHTML;
      });
    });
  }

  setupLeftPanelToggles() {
    // No longer needed (file tree replaced collapsible sections)
  }

  setupPanelResize() {
    const panel = document.getElementById('pr-create-left');
    const divider = document.getElementById('pr-panel-divider');
    const toggle = document.getElementById('pr-panel-toggle');
    if (!panel || !divider || !toggle) return;

    let savedWidth = panel.offsetWidth;

    // Toggle collapse/expand
    toggle.addEventListener('click', () => {
      if (panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        panel.style.width = savedWidth + 'px';
        divider.style.display = '';
      } else {
        savedWidth = panel.offsetWidth;
        panel.classList.add('collapsed');
        divider.style.display = 'none';
      }
    });

    // Drag to resize
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    divider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      const newWidth = Math.max(160, Math.min(400, startWidth + delta));
      panel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      savedWidth = panel.offsetWidth;
    });
  }

  async launchCreateWorkspace(newsItem) {
    const key = this.getStoryKey(newsItem);

    // If story already exists, just switch to it
    if (this._stories.has(key)) {
      const createTab = document.querySelector('.pr-nav-item[data-stage="create"]');
      if (createTab) createTab.click();
      await new Promise(resolve => setTimeout(resolve, 150));
      this.switchToStory(key);
      return;
    }

    // Save current story state before switching
    this.saveCurrentStoryState();

    // Switch to Create tab
    const createTab = document.querySelector('.pr-nav-item[data-stage="create"]');
    if (createTab) {
      createTab.click();
    }

    // Wait for tab switch
    await new Promise(resolve => setTimeout(resolve, 150));

    // Populate left panel
    this.populateLeftPanel(newsItem);

    // Build content plan tabs
    let contentPlan = newsItem.content_plan;
    if (typeof contentPlan === 'string') {
      try { contentPlan = JSON.parse(contentPlan); } catch (e) { contentPlan = null; }
    }
    if (!contentPlan || !Array.isArray(contentPlan) || contentPlan.length === 0) {
      const angleTitle = (newsItem.angle_title || '').toLowerCase();
      const isUrgent = newsItem.urgency === 'high';
      const isCompetitor = /compet|versus|vs\b|rival|alternative|launches|raises/.test(angleTitle);
      const isTrend = /trend|shift|future|landscape|wave|era/.test(angleTitle);
      contentPlan = isUrgent
        ? [
            { type: 'tweet', description: 'Quick, opinionated reaction while the news is fresh', priority: 1, audience: 'builders' },
            { type: 'email_blast', description: 'Pitch to relevant reporters with Glossi angle', priority: 2, audience: 'press' },
            { type: 'linkedin_post', description: 'Signal boost with founder perspective', priority: 3, audience: 'brands' }
          ]
        : isCompetitor
        ? [
            { type: 'blog_post', description: 'Bylined take on what competitors miss', priority: 1, audience: 'builders' },
            { type: 'tweet', description: 'One sharp, punchy tweet on the competitive move (280 chars max)', priority: 2, audience: 'builders' },
            { type: 'linkedin_post', description: 'Founder perspective on the market move', priority: 3, audience: 'brands' }
          ]
        : isTrend
        ? [
            { type: 'blog_post', description: 'Opinionated perspective on this trend', priority: 1, audience: 'builders' },
            { type: 'linkedin_post', description: 'Founder POV distilled to one key insight', priority: 2, audience: 'brands' },
            { type: 'tweet', description: 'One sharp, punchy tweet on the trend (280 chars max)', priority: 3, audience: 'builders' }
          ]
        : [
            { type: 'blog_post', description: 'In-depth analysis with product angle', priority: 1, audience: 'brands' },
            { type: 'linkedin_post', description: 'Key insight as a founder perspective post', priority: 2, audience: 'brands' },
            { type: 'tweet', description: 'One sharp, punchy tweet (280 chars max)', priority: 3, audience: 'builders' }
          ];
    }

    // Sort by priority
    contentPlan.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    // Store the active news item and content plan on the workspace manager
    this._activeNewsItem = newsItem;
    this._activeContentPlan = contentPlan;
    this._tabContent = new Map();
    this._activeTabId = null;
    this._activeStoryKey = key;

    // Detect custom stories (from custom cards)
    const isCustom = key.startsWith('custom_') || !!newsItem._customCard;

    // Create the story entry
    this._stories.set(key, {
      newsItem,
      contentPlan,
      tabContent: new Map(),
      activeTabId: null,
      currentOutput: null,
      chatHTML: '',
      suggestionsHTML: '',
      archived: false,
      custom: isCustom,
      customTitle: isCustom ? (newsItem.headline || 'Untitled') : undefined,
      angleTitle: isCustom ? (newsItem.angle_title || '') : undefined,
      angleNarrative: isCustom ? (newsItem.angle_narrative || '') : undefined
    });

    // Render story selector and content plan tabs
    this.renderStorySelector();
    this.renderContentPlanTabs(contentPlan);

    // Set angle context on PRAgent for content generation
    this.prAgent.angleContext = {
      narrative: newsItem.angle_narrative || newsItem.relevance || newsItem.summary || '',
      target: contentPlan[0]?.target || '',
      description: contentPlan[0]?.description || ''
    };

    // Auto-generate all content plan tabs sequentially to avoid concurrent API overload
    // Mark all tabs as loading first so switchContentTab shows the correct state
    const loaderContextMap = { tweet: 'tweet', linkedin_post: 'linkedin', blog_post: 'blog', email_blast: 'email', product_announcement: 'product', talking_points: 'talking_points', investor_snippet: 'investor' };
    contentPlan.forEach((item, i) => {
      const tabId = `plan_${i}`;
      this._tabContent.set(tabId, { loading: true, output: null, refining: false, suggestionsHTML: '', loaderContext: loaderContextMap[item.type] || 'general' });
    });
    const firstTabId = `plan_0`;
    this.switchContentTab(firstTabId);

    // Generate tabs sequentially (first tab starts immediately, rest wait for previous to finish)
    (async () => {
      for (let i = 0; i < contentPlan.length; i++) {
        const tabId = `plan_${i}`;
        await this.generateTabContent(tabId, contentPlan[i], newsItem);
      }
    })();

    // Update strategy cards to reflect in-workspace status
    this.renderNews();
    this.renderCustomCards();
  }

  renderContentPlanTabs(contentPlan) {
    const tabsContainer = document.getElementById('pr-content-tabs');
    const scrollContainer = document.getElementById('pr-content-tabs-scroll');
    if (!tabsContainer) return;

    tabsContainer.style.display = 'flex';
    const target = scrollContainer || tabsContainer;
    target.querySelectorAll('.pr-content-tab').forEach(t => t.remove());

    contentPlan.forEach((item, index) => {
      const tabId = `plan_${index}`;
      const label = this.formatContentType(item.type);
      const tab = document.createElement('button');
      tab.className = `pr-content-tab ${index === 0 ? 'active' : ''}`;
      tab.dataset.tabId = tabId;
      tab.dataset.planIndex = index;
      tab.innerHTML = `<span>${label}</span><button class="pr-tab-close" title="Close tab" aria-label="Close tab">&times;</button>`;
      
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.pr-tab-close')) return;
        this.switchContentTab(tabId);
        
        // Generate if not already generated or if previous generation failed
        const entry = this._tabContent.get(tabId);
        if (!entry || (!entry.loading && !entry.output)) {
          this.generateTabContent(tabId, this._activeContentPlan[index], this._activeNewsItem);
        }
      });

      tab.querySelector('.pr-tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeContentTab(tabId);
      });

      target.appendChild(tab);
    });
  }

  formatContentType(type) {
    const normalized = type === 'tweet_thread' ? 'tweet' : type;
    const labels = {
      'tweet': 'Tweet',
      'linkedin_post': 'LinkedIn Post',
      'blog_post': 'Blog Post',
      'email_blast': 'Email',
      'product_announcement': 'Product Announcement',
      'talking_points': 'Talking Points',
      'investor_snippet': 'Investor Snippet',
      'press_release': 'Blog Post',
      'media_pitch': 'Email',
      'founder_quote': 'Blog Post',
      'op_ed': 'Blog Post',
      'briefing_doc': 'Talking Points',
      'custom': 'Custom'
    };
    return labels[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  switchContentTab(tabId) {
    const tabsContainer = document.getElementById('pr-content-tabs');
    if (!tabsContainer) return;

    // Save state of the tab we are leaving
    const prevTabId = this._activeTabId;
    if (prevTabId && prevTabId !== tabId) {
      const prevEntry = this._tabContent.get(prevTabId);
      if (prevEntry) {
        // Preserve inline edits
        this.prAgent.saveCurrentEdits();
        // Preserve suggestions HTML
        const sugEl = document.getElementById('pr-suggestions');
        if (sugEl) prevEntry.suggestionsHTML = sugEl.innerHTML;
      }
    }

    // Update active tab visuals
    tabsContainer.querySelectorAll('.pr-content-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tabId === tabId);
    });

    this._activeTabId = tabId;

    // Update file tree active leaf
    const treeContainer = document.getElementById('pr-file-tree');
    if (treeContainer) {
      treeContainer.querySelectorAll('.pr-file-tree-leaf').forEach(leaf => {
        const isActive = leaf.dataset.storyKey === this._activeStoryKey && leaf.dataset.tabId === tabId;
        leaf.classList.toggle('active', isActive);
      });
    }

    // Show content for this tab
    const entry = this._tabContent.get(tabId);
    if (entry) {
      if (entry.loading) {
        this.prAgent.showLoading(entry.loaderContext || 'general');
        this.prAgent.hideRefiningOverlay();
      } else if (entry.output) {
        this.prAgent.currentOutput = entry.output;
        this.prAgent.renderGeneratedContent(entry.output);
        const hasSavedSuggestions = !!(entry.suggestionsHTML);
        this.prAgent.showWorkspace(hasSavedSuggestions);
        this.prAgent.hideLoading();
        this.renderVersionHistory(entry.output);
      } else {
        if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
        if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
        if (this.prAgent.dom.workspaceChat) this.prAgent.dom.workspaceChat.style.display = 'none';
        this.prAgent.hideLoading();
        this.prAgent.hideRefiningOverlay();
        const actionsEl = document.getElementById('pr-workspace-actions');
        if (actionsEl) actionsEl.style.display = 'none';
        if (entry.error) {
          this.prAgent.showToast(entry.error, 'error');
        }
      }

      // Restore per-tab suggestions
      const sugEl = document.getElementById('pr-suggestions');
      if (sugEl) sugEl.innerHTML = entry.suggestionsHTML || '';

      // Show or hide the refining overlay based on this tab's state
      if (entry.refining) {
        this.prAgent.showRefiningOverlay();
      } else {
        this.prAgent.hideRefiningOverlay();
      }
    } else {
      // No content yet - show empty state with generate prompt
      if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
      if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
      if (this.prAgent.dom.workspaceChat) this.prAgent.dom.workspaceChat.style.display = 'none';
      this.prAgent.hideLoading();
      this.prAgent.hideRefiningOverlay();
      const sugEl = document.getElementById('pr-suggestions');
      if (sugEl) sugEl.innerHTML = '';
      const actionsEl = document.getElementById('pr-workspace-actions');
      if (actionsEl) actionsEl.style.display = 'none';
    }
  }

  updateTabIndicator(tabId, isRefining) {
    const tabEl = document.querySelector(`.pr-content-tab[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.classList.toggle('refining', isRefining);
  }

  closeContentTab(tabId) {
    const tabsContainer = document.getElementById('pr-content-tabs');
    if (!tabsContainer) return;

    const allTabs = Array.from(tabsContainer.querySelectorAll('.pr-content-tab'));
    const tabEl = allTabs.find(t => t.dataset.tabId === tabId);
    if (!tabEl) return;

    const wasActive = tabEl.classList.contains('active');
    const tabIndex = allTabs.indexOf(tabEl);

    tabEl.remove();

    if (wasActive) {
      const remainingTabs = Array.from(tabsContainer.querySelectorAll('.pr-content-tab'));
      if (remainingTabs.length > 0) {
        const nextTab = remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)];
        this.switchContentTab(nextTab.dataset.tabId);
      } else {
        this._activeTabId = null;
        if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
        if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
        this.prAgent.hideLoading();
      }
    }
  }

  async generateTabContent(tabId, planItem, newsItem) {
    // Determine if this is a custom story
    const activeStory = this._activeStoryKey ? this._stories.get(this._activeStoryKey) : null;
    const isCustom = activeStory?.custom === true;

    // For custom stories, use the story's source IDs; otherwise use globally selected sources
    let selectedSources;
    if (isCustom && activeStory.sourceIds) {
      selectedSources = this.prAgent.sources.filter(s => activeStory.sourceIds.includes(s.id));
    } else {
      selectedSources = this.prAgent.sources.filter(s => s.selected);
    }
    if (!this.prAgent.apiKey) {
      this.prAgent.showToast('API key not configured. Check Settings.', 'error');
      return;
    }

    planItem.type = normalizeContentType(planItem.type);
    const typeLabel = CONTENT_TYPES.find(t => t.id === planItem.type)?.label || planItem.type;
    const loaderContext = { tweet: 'tweet', linkedin_post: 'linkedin', blog_post: 'blog', email_blast: 'email', product_announcement: 'product', talking_points: 'talking_points', investor_snippet: 'investor' }[planItem.type] || 'general';

    // Mark tab as loading (preserve existing refining/suggestionsHTML if re-generating)
    const prevEntry = this._tabContent.get(tabId);
    this._tabContent.set(tabId, { loading: true, output: null, refining: prevEntry?.refining || false, suggestionsHTML: prevEntry?.suggestionsHTML || '', loaderContext });
    if (this._activeTabId === tabId) {
      this.prAgent.showLoading(loaderContext);
    }

    // Update content type dropdown (hidden but used by existing logic)
    const dropdown = document.getElementById('pr-content-type');
    if (dropdown) dropdown.value = planItem.type;

    // Build prompt with primary/context separation for custom stories
    let userMessage = `Generate a ${typeLabel} based on the following sources.\n\n`;

    if (isCustom && activeStory.primarySourceId) {
      // Separate primary source from background context
      const primarySource = selectedSources.find(s => s.id === activeStory.primarySourceId);
      const contextSources = selectedSources.filter(s => s.id !== activeStory.primarySourceId);

      // Angle context (approved by user)
      if (activeStory.angleTitle || activeStory.angleNarrative) {
        userMessage += `ANGLE: ${activeStory.angleTitle || ''}\n${activeStory.angleNarrative || ''}\nUse this angle as your narrative framework for all content.\n\n`;
      }

      if (planItem.description) {
        userMessage += `Brief: ${planItem.description}\n\n`;
      }
      if (planItem.target) {
        userMessage += `Target: ${planItem.target}\n\n`;
      }

      userMessage += `IMPORTANT: The content MUST be primarily built from the PRIMARY SOURCE below. Use the background context only for company positioning and additional detail. The primary source material should drive the narrative, structure, and key points.\n\n`;

      if (primarySource) {
        userMessage += `PRIMARY SOURCE (build the content from this):\nTitle: ${primarySource.title}\nType: ${primarySource.type}\nContent:\n${primarySource.content}\n---\n\n`;
      }

      if (contextSources.length > 0) {
        userMessage += `BACKGROUND CONTEXT (for company knowledge only, NOT the main focus):\n`;
        userMessage += contextSources.map((s, i) => {
          const preview = (s.content || '').substring(0, 2000);
          return `[Context ${i + 1}] (ID: ${s.id})\nTitle: ${s.title}\nContent:\n${preview}\n---`;
        }).join('\n\n');
      }
    } else {
      // Non-custom stories or no primary source: original flat behavior
      const sourcesContext = selectedSources.map((s, i) => {
        return `[Source ${i + 1}] (ID: ${s.id})\nTitle: ${s.title}\nType: ${s.type}\nContent:\n${s.content}\n---`;
      }).join('\n\n');

      if (isCustom && (activeStory.angleTitle || activeStory.angleNarrative)) {
        userMessage += `ANGLE: ${activeStory.angleTitle || ''}\n${activeStory.angleNarrative || ''}\nUse this angle as your narrative framework for all content.\n\n`;
      } else {
        const angleNarrative = newsItem.angle_narrative || newsItem.relevance || newsItem.summary || '';
        if (angleNarrative) {
          userMessage += `STORY ANGLE (use this as your narrative framework):\n${angleNarrative}\n\n`;
        }
      }

      if (planItem.description) {
        userMessage += `Brief: ${planItem.description}\n\n`;
      }
      if (planItem.target) {
        userMessage += `Target: ${planItem.target}\n\n`;
      }
      userMessage += `SOURCES:\n${sourcesContext}`;
    }

    const isTweetType = planItem.type === 'tweet';
    if (isTweetType) {
      userMessage += '\n\nREMINDER: The tweet MUST be under 280 characters. Count carefully. This is a hard platform limit.';
    }

    const selectedModel = MODEL_FOR_TYPE[planItem.type] || 'claude-opus-4-6';
    let streamStarted = false;
    let shouldStream = this._activeTabId === tabId;

    try {
      const rawText = await this.prAgent.streamContent({
        model: selectedModel,
        max_tokens: isTweetType ? 1024 : 8192,
        system: PR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        onChunk: (_chunk, accumulated) => {
          if (!shouldStream || this._activeTabId !== tabId) {
            shouldStream = false;
            return;
          }
          if (!streamStarted) {
            streamStarted = true;
            this.prAgent.showStreamingWorkspace();
          }
          this.prAgent.updateStreamingText(accumulated);
        }
      });

      if (streamStarted && this._activeTabId === tabId) {
        this.prAgent.finishStreamingWorkspace();
      }

      let parsed;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch { parsed = null; }

      if (!parsed) {
        parsed = { content: rawText, citations: [], strategy: null };
      }

      if (parsed.citations) {
        parsed.citations = parsed.citations.map((c, i) => {
          const srcIndex = c.index || (i + 1);
          const matchedSource = selectedSources[srcIndex - 1];
          return { ...c, index: srcIndex, sourceId: matchedSource?.id || null, verified: c.sourceId !== null && c.verified !== false };
        });
      }

      const planIndex = parseInt(tabId.replace('plan_', ''), 10);

      let sourceIds = selectedSources.map(s => s.id);
      if (isCustom && activeStory.primarySourceId) {
        sourceIds = [activeStory.primarySourceId, ...sourceIds.filter(id => id !== activeStory.primarySourceId)];
      }

      const isTweet = isTweetType;
      let extractedTitle, strippedContent;
      if (isTweet) {
        extractedTitle = typeLabel;
        strippedContent = (parsed.content || '').trim();
      } else {
        extractedTitle = this.prAgent.extractTitle(parsed.content, typeLabel);
        strippedContent = this.prAgent._stripTitleFromPlainText(parsed.content, extractedTitle);
      }

      const output = {
        id: 'out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        content_type: planItem.type,
        title: extractedTitle,
        content: strippedContent,
        sources: sourceIds,
        citations: parsed.citations || [],
        strategy: parsed.strategy || null,
        status: 'draft',
        phase: 'edit',
        drafts: [{ content: strippedContent, version: 1, timestamp: Date.now(), prompt: null }],
        story_key: this._activeStoryKey || null,
        news_headline: newsItem.headline || null,
        content_plan_index: planIndex,
        is_custom: isCustom || false,
        angle_title: isCustom ? (activeStory.angleTitle || null) : null,
        angle_narrative: isCustom ? (activeStory.angleNarrative || null) : null
      };

      if (isTweet) {
        output.tweet_format = parsed.tweet_format || 'text';
        output.content = await this.prAgent.enforceTweetLimit(output.content, output.tweet_format);
        output.drafts[0].content = output.content;
      }

      const prevEntryDone = this._tabContent.get(tabId);
      this._tabContent.set(tabId, { loading: false, output, refining: prevEntryDone?.refining || false, suggestionsHTML: prevEntryDone?.suggestionsHTML || '' });

      this.prAgent.outputs.push(output);
      this.prAgent.saveOutputs();
      try {
        await fetch('/api/pr/outputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(output) });
      } catch (e) { /* silent */ }

      if (this._activeTabId === tabId) {
        this.prAgent.currentOutput = output;
        this.prAgent.renderGeneratedContent(output);
        this.prAgent.renderStrategy(output.strategy);
        this.prAgent.showWorkspace();
        this.prAgent.hideLoading();
        this.renderVersionHistory(output);
      }

    } catch (err) {
      const prevEntryErr = this._tabContent.get(tabId);
      this._tabContent.set(tabId, { loading: false, output: null, error: err.message, refining: prevEntryErr?.refining || false, suggestionsHTML: prevEntryErr?.suggestionsHTML || '' });
      if (this._activeTabId === tabId) {
        this.prAgent.hideLoading();
        this.prAgent.showToast(err.message || 'Generation failed', 'error');
      }
    }
  }

  renderVersionHistory(output) {
    // Version history is now handled by the version pill in workspace actions
    if (this.prAgent) {
      this.prAgent.renderVersionPill();
    }
  }

  async buildAngleFromHook(newsItem) {
    // Legacy method - redirects to new flow
    await this.launchCreateWorkspace(newsItem);
  }

  attachNewsEventListeners() {
    // Deprecated - kept for compatibility
  }

  async useAsHook(newsItem, btn) {
    // 1. IMMEDIATELY switch to Sources tab (instant navigation)
    const sourcesTab = document.querySelector('.pr-panel-tab[data-panel-tab="sources"]');
    if (sourcesTab) sourcesTab.click();
    
    // 2. Build source object
    const angleInfo = newsItem.angle_title ? `\nSTORY ANGLE: ${newsItem.angle_title}\n${newsItem.angle_narrative || ''}` : '';
    const sourceContent = `
NEWS HOOK: ${newsItem.headline}

OUTLET: ${newsItem.outlet}
DATE: ${newsItem.date}
URL: ${newsItem.url}

SUMMARY:
${newsItem.summary}
${angleInfo}
RELEVANCE TO GLOSSI:
${newsItem.angle_narrative || newsItem.relevance || ''}
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
          <i class="ph-light ph-plus"></i>
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
      'tweet': '𝕏',
      'blog_post': '📝',
      'email_blast': '📧',
      'press_release': '📝',
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
          <i class="ph-light ph-x"></i>
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
            <i class="ph-light ph-x"></i>
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
              <option value="tweet">Tweet</option>
              <option value="blog_post">Blog Post</option>
              <option value="email_blast">Email</option>
              <option value="product_announcement">Product Announcement</option>
              <option value="talking_points">Talking Points</option>
              <option value="investor_snippet">Investor Snippet</option>
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

/**
 * AngleManager
 * Manages strategic story angles and tracks content creation progress
 */
class AngleManager {
  constructor(prAgent) {
    this.prAgent = prAgent;
    this.angles = [];
    this.activeAngle = null;
    this.defaultAngles = this.getDefaultAngles();
    this.tabContent = new Map();
    this.activeTabId = null;
  }

  getDefaultAngles() {
    return [
      {
        id: 'default_brand_decay',
        title: 'Brand Decay at Scale',
        narrative: 'AI image generators are destroying brand consistency. Colors shift, logos warp, products distort. Glossi fixes this with compositing, not generation.',
        tied_to_hook: null,
        urgency: 'low',
        why_now: 'Persistent problem, always relevant',
        content_plan: [
          { type: 'blog_post', description: 'Why every AI-generated product image is slowly eroding your brand (and what to do about it)', target: 'Company blog', priority: 1, audience: 'brands', completed: false },
          { type: 'tweet', description: 'One punchy tweet: the visual quality gap brands keep ignoring.', target: 'Twitter/X', priority: 2, audience: 'builders', completed: false },
          { type: 'email_blast', description: 'The brand consistency problem nobody talks about, with a Glossi angle', target: 'Email list', priority: 3, audience: 'brands', completed: false }
        ],
        isDefault: true,
        generatedAt: new Date().toISOString()
      },
      {
        id: 'default_world_models',
        title: 'World Models Validate Our Bet',
        narrative: 'Google Genie 3, World Labs Marble, NVIDIA Cosmos. The world model wave proves the market Glossi has been building for. Our compositing architecture was designed for this moment.',
        tied_to_hook: null,
        urgency: 'high',
        why_now: 'World model announcements and funding rounds happening now',
        content_plan: [
          { type: 'tweet', description: 'Everyone is excited about world models. Here is what they are missing: the product still needs to be real.', target: 'Twitter/X', priority: 1, audience: 'builders', completed: false },
          { type: 'blog_post', description: 'Deep dive: how Glossi\'s compositing-first architecture was built for the world model era', target: 'Company blog', priority: 2, audience: 'brands', completed: false },
          { type: 'email_blast', description: 'Pitch to AI reporters: the startup that built for world models before they arrived', target: 'TechCrunch / VentureBeat', priority: 3, audience: 'press', completed: false },
          { type: 'investor_snippet', description: 'World model validation proof point for investor updates', target: 'Investor comms', priority: 4, audience: 'investors', completed: false }
        ],
        isDefault: true,
        generatedAt: new Date().toISOString()
      },
      {
        id: 'default_green_screen',
        title: 'Green Screen for Products',
        narrative: 'A simple analogy that explains everything. The product is the actor. Sacred. Untouchable. Everything around it is where AI plays.',
        tied_to_hook: null,
        urgency: 'low',
        why_now: 'Evergreen explainer angle',
        content_plan: [
          { type: 'linkedin_post', description: 'The green screen analogy, explained in one post. Your product is the actor. AI builds the set.', target: 'LinkedIn', priority: 1, audience: 'brands', completed: false },
          { type: 'tweet', description: 'Punchy soundbite version of the green screen analogy for X', target: 'Twitter/X', priority: 2, audience: 'builders', completed: false },
          { type: 'talking_points', description: 'Elevator pitch script built around the green screen frame', target: 'Internal', priority: 3, audience: 'internal', completed: false }
        ],
        isDefault: true,
        generatedAt: new Date().toISOString()
      }
    ];
  }

  async init() {
    this.setupDOM();
    this.setupEventListeners();
    await this.loadCachedAngles();
    this.renderAngles();
    this.renderContentSection();
    this.setupCollapsibleSections();
  }

  setupDOM() {
    this.dom = {
      generateAnglesBtn: document.getElementById('pr-generate-angles-btn'),
      anglesList: document.getElementById('pr-angles-list'),
      contentList: document.getElementById('pr-content-list'),
      contentEmpty: document.getElementById('pr-content-empty')
    };
  }

  setupEventListeners() {
    this.dom.generateAnglesBtn?.addEventListener('click', () => this.generateAngles());
    
    // EVENT DELEGATION: Handle all angle card button clicks
    this.dom.anglesList?.addEventListener('click', (e) => {
      // Expand/collapse button
      const expandBtn = e.target.closest('.pr-angle-expand-btn');
      if (expandBtn) {
        e.stopPropagation();
        const angleId = expandBtn.dataset.angleId;
        this.toggleAngleExpand(angleId);
        return;
      }
      
      // Generate single piece button
      const pieceBtn = e.target.closest('.pr-generate-piece-btn');
      if (pieceBtn) {
        e.stopPropagation();
        const angleId = pieceBtn.dataset.angleId;
        const planIndex = parseInt(pieceBtn.dataset.planIndex, 10);
        this.generateSinglePiece(angleId, planIndex);
        return;
      }

      // Generate All button
      const allBtn = e.target.closest('.pr-generate-all-btn');
      if (allBtn) {
        e.stopPropagation();
        const angleId = allBtn.dataset.angleId;
        this.generateAllPieces(angleId);
        return;
      }
      
      // Delete button
      const deleteBtn = e.target.closest('.pr-delete-angle-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const angleId = deleteBtn.dataset.angleId;
        this.deleteAngle(angleId);
        return;
      }

      // Clicking on the angle card itself - select and expand, not generate
      const angleCard = e.target.closest('.pr-angle-card');
      if (angleCard) {
        const angleId = angleCard.dataset.angleId;
        if (angleId) {
          this.selectAngle(angleId);
        }
      }
    });
  }

  async loadCachedAngles() {
    try {
      const response = await fetch('/api/pr/angles');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.angles && data.angles.length > 0) {
          this.angles = data.angles;
        } else {
          this.angles = this.prAgent.sources.length > 0 ? [] : this.defaultAngles;
        }
      } else {
        this.angles = this.prAgent.sources.length > 0 ? [] : this.defaultAngles;
      }
    } catch (error) {
      console.error('Error loading cached angles:', error);
      this.angles = this.prAgent.sources.length > 0 ? [] : this.defaultAngles;
    }

    const savedActiveAngle = localStorage.getItem('pr_active_angle');
    if (savedActiveAngle) {
      try {
        this.activeAngle = JSON.parse(savedActiveAngle);
      } catch (e) {}
    }
  }

  async generateAngles(triggeredByNewsHook = null) {
    if (!this.dom.generateAnglesBtn) return;

    this.dom.generateAnglesBtn.disabled = true;
    this.dom.generateAnglesBtn.classList.add('spinning');
    this._anglesLoaderId = startLoaderStatus(this.dom.anglesList, 'angles');
    
    if (this.dom.anglesList) {
      const hookText = triggeredByNewsHook ? ` based on "${triggeredByNewsHook.headline}"` : '';
      this.dom.anglesList.innerHTML = `<p class="pr-angles-empty">Generating strategic angles${hookText}...</p>`;
    }

    try {
      const sources = this.prAgent.sources.filter(s => s.selected).map(s => ({
        title: s.title,
        content: s.content
      }));

      const newsHooks = this.prAgent.newsMonitor?.newsHooks || [];
      
      if (triggeredByNewsHook) {
        const hookIndex = newsHooks.findIndex(h => h.headline === triggeredByNewsHook.headline);
        if (hookIndex !== -1) {
          newsHooks.splice(hookIndex, 1);
          newsHooks.unshift(triggeredByNewsHook);
        } else {
          newsHooks.unshift(triggeredByNewsHook);
        }
      }

      const pastOutputs = this.prAgent.outputs.map(o => ({
        title: o.title || o.contentType,
        contentType: o.contentType
      }));

      const response = await fetch('/api/pr/angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sources, 
          newsHooks: newsHooks.slice(0, 5),
          pastOutputs,
          highlightedHook: triggeredByNewsHook ? triggeredByNewsHook.headline : null
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate angles');
      }

      this.angles = data.angles || [];
      await this.saveAngles();
      this.renderAngles();
      this.prAgent.showToast('Story angles generated', 'success');
    } catch (error) {
      console.error('Error generating angles:', error);
      if (this.dom.anglesList) {
        this.dom.anglesList.innerHTML = '<p class="pr-angles-empty">Failed to generate angles. Try again.</p>';
      }
      this.prAgent.showToast(error.message || 'Failed to generate angles', 'error');
    } finally {
      stopLoaderStatus(this._anglesLoaderId);
      this._anglesLoaderId = null;
      if (this.dom.generateAnglesBtn) {
        this.dom.generateAnglesBtn.disabled = false;
        this.dom.generateAnglesBtn.classList.remove('spinning');
      }
    }
  }

  async saveAngles() {
    try {
      await fetch('/api/pr/angles/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angles: this.angles })
      });
    } catch (error) {
      console.error('Error saving angles:', error);
    }
  }

  renderAngles() {
    if (!this.dom.anglesList) return;

    const anglesToShow = this.angles.length > 0 ? this.angles : (this.prAgent.sources.length === 0 ? this.defaultAngles : []);

    if (anglesToShow.length === 0) {
      this.dom.anglesList.innerHTML = `
        <div class="pr-empty-state">
          <div class="pr-empty-icon">💡</div>
          <h4>Generate Custom Angles</h4>
          <p>Add sources in the Sources tab, then click "Generate Angles" above to get personalized story recommendations based on your company context.</p>
          <p class="pr-empty-hint">⬆️ Three default angles are shown above to get you started.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="pr-angles-items">';
    
    anglesToShow.forEach(angle => {
      const urgencyClass = angle.urgency === 'high' ? 'high' : angle.urgency === 'medium' ? 'medium' : 'low';
      const urgencyIcon = angle.urgency === 'high' ? '🔴' : angle.urgency === 'medium' ? '🟡' : '🟢';
      const expandedClass = this.isAngleExpanded(angle.id) ? 'expanded' : '';
      
      html += `
        <div class="pr-angle-card ${expandedClass}" data-angle-id="${angle.id}">
          <div class="pr-angle-header">
            <h3 class="pr-angle-title">${this.escapeHtml(angle.title)}</h3>
            <span class="pr-angle-urgency ${urgencyClass}">${urgencyIcon} ${angle.urgency.toUpperCase()}</span>
          </div>
          ${angle.tied_to_hook ? `<div class="pr-angle-hook">Tied to: ${this.escapeHtml(angle.tied_to_hook)}</div>` : ''}
          <p class="pr-angle-narrative">${this.escapeHtml(angle.narrative)}</p>
          <p class="pr-angle-why-now"><strong>Why now:</strong> ${this.escapeHtml(angle.why_now)}</p>
          
          <button class="pr-angle-expand-btn" data-angle-id="${angle.id}">
            <i class="ph-light ph-caret-down"></i>
            Content Plan (${angle.content_plan.length} pieces)
          </button>
          
          <div class="pr-angle-content-plan">
            <ul class="pr-content-plan-list">
              ${angle.content_plan.map((item, idx) => `
                <li class="${item.completed ? 'completed' : ''}">
                  <div class="pr-plan-item-row">
                    <div class="pr-plan-item-info">
                      ${item.completed ? '✅' : `${item.priority}.`} <strong>${this.formatContentType(item.type)}</strong>${item.audience ? ` <span class="pr-audience-badge pr-audience-${item.audience}">${item.audience}</span>` : ''} ${this.escapeHtml(item.description)}
                      ${item.target ? `<span class="pr-plan-target">Target: ${this.escapeHtml(item.target)}</span>` : ''}
                    </div>
                    <button class="btn btn-sm pr-generate-piece-btn" data-angle-id="${angle.id}" data-plan-index="${idx}">
                      Generate
                    </button>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
          
          <button class="btn btn-primary pr-generate-all-btn" data-angle-id="${angle.id}">
            Generate All (${angle.content_plan.length} pieces)
          </button>
          
          ${!angle.isDefault ? `
            <button class="btn-icon pr-delete-angle-btn" data-angle-id="${angle.id}" title="Delete angle">
              <i class="ph-light ph-trash"></i>
            </button>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div>';
    this.dom.anglesList.innerHTML = html;
    this.attachAngleEventListeners();
  }

  attachAngleEventListeners() {
    // Event listeners now handled by delegation in setupEventListeners()
    // This method is no longer needed but kept to avoid breaking calls
  }

  isAngleExpanded(angleId) {
    const expanded = localStorage.getItem('pr_expanded_angles');
    if (!expanded) return false;
    try {
      const expandedIds = JSON.parse(expanded);
      return expandedIds.includes(angleId);
    } catch (e) {
      return false;
    }
  }

  toggleAngleExpand(angleId) {
    const card = document.querySelector(`.pr-angle-card[data-angle-id="${angleId}"]`);
    if (!card) return;

    let expandedIds = [];
    try {
      const stored = localStorage.getItem('pr_expanded_angles');
      if (stored) expandedIds = JSON.parse(stored);
    } catch (e) {}

    if (expandedIds.includes(angleId)) {
      expandedIds = expandedIds.filter(id => id !== angleId);
      card.classList.remove('expanded');
    } else {
      expandedIds.push(angleId);
      card.classList.add('expanded');
    }

    localStorage.setItem('pr_expanded_angles', JSON.stringify(expandedIds));
  }

  selectAngle(angleId) {
    const angle = this.angles.find(a => a.id === angleId) || this.defaultAngles.find(a => a.id === angleId);
    if (!angle) return;

    this.activeAngle = angle;
    localStorage.setItem('pr_active_angle', JSON.stringify(angle));

    // Mark angle as selected in left panel
    document.querySelectorAll('.pr-angle-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.angleId === angleId);
    });

    // Expand the content plan so pieces are visible
    if (!this.isAngleExpanded(angleId)) {
      this.toggleAngleExpand(angleId);
    }

    this.renderContentSection();
  }

  generateSinglePiece(angleId, planIndex) {
    const angle = this.angles.find(a => a.id === angleId) || this.defaultAngles.find(a => a.id === angleId);
    if (!angle || !angle.content_plan || !angle.content_plan[planIndex]) return;

    const planItem = angle.content_plan[planIndex];
    this.activeAngle = angle;
    localStorage.setItem('pr_active_angle', JSON.stringify(angle));

    // Select the angle card
    document.querySelectorAll('.pr-angle-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.angleId === angleId);
    });

    // Open a tab named after the content type
    const tabLabel = this.formatContentType(planItem.type);
    this.openAngleTab(angle, planIndex, tabLabel);

    const tabId = `${angle.id}_${planIndex}`;
    this.renderContentSection();

    // Auto-collapse Story Angles, expand Content
    this.collapseSection('pr-angles-body', true);
    this.collapseSection('pr-content-body', false);

    // Generate content directly for this tab
    this.generatePieceContent(angle, planItem, tabId);
    this.prAgent.showToast(`Generating: ${tabLabel}`, 'success');
  }

  async generateAllPieces(angleId) {
    const angle = this.angles.find(a => a.id === angleId) || this.defaultAngles.find(a => a.id === angleId);
    if (!angle || !angle.content_plan || angle.content_plan.length === 0) return;

    this.activeAngle = angle;
    localStorage.setItem('pr_active_angle', JSON.stringify(angle));

    // Select the angle card
    document.querySelectorAll('.pr-angle-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.angleId === angleId);
    });

    this.renderContentSection();

    // Auto-collapse Story Angles, expand Content
    this.collapseSection('pr-angles-body', true);
    this.collapseSection('pr-content-body', false);

    const pieceCount = angle.content_plan.length;
    this.prAgent.showToast(`Generating all ${pieceCount} pieces in parallel...`, 'success');

    // Open all tabs first
    const tabIds = [];
    angle.content_plan.forEach((planItem, i) => {
      const tabLabel = this.formatContentType(planItem.type);
      this.openAngleTab(angle, i, tabLabel);
      tabIds.push(`${angle.id}_${i}`);
    });

    // Fire all generations in parallel
    const promises = angle.content_plan.map((planItem, i) => {
      return this.generatePieceContent(angle, planItem, tabIds[i]);
    });

    await Promise.all(promises);
  }

  async generatePieceContent(angle, planItem, tabId) {
    planItem.type = normalizeContentType(planItem.type);
    const selectedSources = this.prAgent.sources.filter(s => s.selected);
    if (!this.prAgent.apiKey) {
      this.prAgent.showToast('API key not configured. Check Settings.', 'error');
      return;
    }

    const typeLabel = CONTENT_TYPES.find(t => t.id === planItem.type)?.label || planItem.type;
    const loaderContext = { tweet: 'tweet', linkedin_post: 'linkedin', blog_post: 'blog', email_blast: 'email', product_announcement: 'product', talking_points: 'talking_points', investor_snippet: 'investor' }[planItem.type] || 'general';

    // Mark tab as loading
    this.tabContent.set(tabId, { loading: true, output: null, loaderContext });

    // Show loading if this is the active tab
    if (this.activeTabId === tabId) {
      this.prAgent.showLoading(loaderContext);
    }

    // Build the prompt (same format as generateContent)
    const sourcesContext = selectedSources.map((s, i) => {
      return `[Source ${i + 1}] (ID: ${s.id})\nTitle: ${s.title}\nType: ${s.type}\nContent:\n${s.content}\n---`;
    }).join('\n\n');

    let userMessage = `Generate a ${typeLabel} based on the following sources.\n\n`;
    userMessage += `STORY ANGLE (use this as your narrative framework):\n${angle.narrative}\n\n`;
    if (planItem.target) {
      userMessage += `Target: ${planItem.target}\n\n`;
    }
    if (planItem.description) {
      userMessage += `Brief: ${planItem.description}\n\n`;
    }
    userMessage += `SOURCES:\n${sourcesContext}`;

    const isTweetADK = planItem.type === 'tweet';
    const selectedModel = MODEL_FOR_TYPE[planItem.type] || 'claude-opus-4-6';
    let streamStarted = false;
    let shouldStream = this.activeTabId === tabId;

    try {
      const rawText = await this.prAgent.streamContent({
        model: selectedModel,
        max_tokens: isTweetADK ? 1024 : 8192,
        system: PR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        onChunk: (_chunk, accumulated) => {
          if (!shouldStream || this.activeTabId !== tabId) {
            shouldStream = false;
            return;
          }
          if (!streamStarted) {
            streamStarted = true;
            this.prAgent.showStreamingWorkspace();
          }
          this.prAgent.updateStreamingText(accumulated);
        }
      });

      if (streamStarted && this.activeTabId === tabId) {
        this.prAgent.finishStreamingWorkspace();
      }

      let parsed;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch { parsed = null; }

      if (!parsed) {
        parsed = { content: rawText, citations: [], strategy: null };
      }

      if (parsed.citations) {
        parsed.citations = parsed.citations.map((c, i) => {
          const srcIndex = c.index || (i + 1);
          const matchedSource = selectedSources[srcIndex - 1];
          return { ...c, index: srcIndex, sourceId: matchedSource?.id || null, verified: c.sourceId !== null && c.verified !== false };
        });
      }

      let extractedTitle, strippedContent;
      if (isTweetADK) {
        extractedTitle = typeLabel;
        strippedContent = (parsed.content || '').trim();
      } else {
        extractedTitle = this.prAgent.extractTitle(parsed.content, typeLabel);
        strippedContent = this.prAgent._stripTitleFromPlainText(parsed.content, extractedTitle);
      }

      const output = {
        id: 'out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        content_type: planItem.type,
        title: extractedTitle,
        content: strippedContent,
        sources: selectedSources.map(s => s.id),
        citations: parsed.citations || [],
        strategy: parsed.strategy || null,
        status: 'draft',
        phase: 'edit',
        angleId: angle.id,
        angleTitle: angle.title,
        drafts: [{ content: strippedContent, version: 1, timestamp: Date.now(), prompt: null }]
      };

      if (isTweetADK) {
        output.tweet_format = parsed.tweet_format || 'text';
        output.content = await this.prAgent.enforceTweetLimit(output.content, output.tweet_format);
        output.drafts[0].content = output.content;
      }

      this.tabContent.set(tabId, { loading: false, output });

      this.prAgent.outputs.push(output);
      this.prAgent.saveOutputs();
      try {
        await fetch('/api/pr/outputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(output) });
      } catch (e) { /* silent */ }

      if (this.activeTabId === tabId) {
        this.prAgent.currentOutput = output;
        this.prAgent.renderGeneratedContent(output);
        this.prAgent.renderStrategy(output.strategy);
        this.prAgent.showWorkspace();
        this.prAgent.hideLoading();
      }

      this.trackContentCreation(planItem.type);
      this.renderContentSection();

      this.collapseSection('pr-content-body', false);

    } catch (err) {
      this.tabContent.set(tabId, { loading: false, output: null, error: err.message });
      if (this.activeTabId === tabId) {
        this.prAgent.hideLoading();
        this.prAgent.showToast(err.message || 'Generation failed', 'error');
      }
    }
  }

  openAngleTab(angle, planIndex = 0, label = null) {
    const tabsContainer = document.getElementById('pr-angle-tabs');
    if (!tabsContainer) return;

    tabsContainer.style.display = 'flex';

    const tabId = `${angle.id}_${planIndex}`;
    const displayLabel = label || angle.title;
    const shortLabel = displayLabel.length > 25 ? displayLabel.substring(0, 25) + '...' : displayLabel;

    // Check if tab already exists
    const existingTab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (existingTab) {
      this.switchAngleTab(tabId);
      return;
    }

    // Create new tab
    const tab = document.createElement('button');
    tab.className = 'pr-angle-tab active';
    tab.dataset.tabId = tabId;
    tab.dataset.angleId = angle.id;
    tab.dataset.planIndex = planIndex;
    tab.innerHTML = `<span>${shortLabel}</span><span class="pr-angle-tab-close" data-tab-id="${tabId}">&times;</span>`;

    // Deactivate other tabs
    tabsContainer.querySelectorAll('.pr-angle-tab').forEach(t => t.classList.remove('active'));

    // Set this as active tab
    this.activeTabId = tabId;

    tabsContainer.appendChild(tab);

    // Tab click handler
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.pr-angle-tab-close')) {
        this.closeAngleTab(tabId);
        return;
      }
      this.switchAngleTab(tabId);
    });
  }

  switchAngleTab(tabId) {
    const tabsContainer = document.getElementById('pr-angle-tabs');
    if (!tabsContainer) return;

    // Save current tab's workspace content before switching
    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentEntry = this.tabContent.get(this.activeTabId);
      if (currentEntry && !currentEntry.loading && this.prAgent.currentOutput) {
        currentEntry.output = this.prAgent.currentOutput;
      }
    }

    // Update tab active states
    tabsContainer.querySelectorAll('.pr-angle-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tabId === tabId);
    });

    this.activeTabId = tabId;

    // Get the angle from the tab
    const activeTab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!activeTab) return;

    const angleId = activeTab.dataset.angleId;
    const planIndex = parseInt(activeTab.dataset.planIndex, 10);

    // Update angle card selection in left panel
    document.querySelectorAll('.pr-angle-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.angleId === angleId);
    });

    // Set active angle context
    const angle = this.angles.find(a => a.id === angleId) || this.defaultAngles.find(a => a.id === angleId);
    if (angle) {
      this.activeAngle = angle;
      localStorage.setItem('pr_active_angle', JSON.stringify(angle));

      const planItem = angle.content_plan?.[planIndex];
      this.prAgent.angleContext = {
        narrative: angle.narrative,
        target: planItem?.target || '',
        description: planItem?.description || ''
      };

      if (planItem) {
        const contentTypeDropdown = document.getElementById('pr-content-type');
        if (contentTypeDropdown) {
          contentTypeDropdown.value = planItem.type;
          contentTypeDropdown.dispatchEvent(new Event('change'));
        }
      }

      this.renderContentSection();
    }

    // Restore this tab's content
    const tabEntry = this.tabContent.get(tabId);
    if (tabEntry) {
      if (tabEntry.loading) {
        this.prAgent.showLoading(tabEntry.loaderContext || 'general');
      } else if (tabEntry.output) {
        this.prAgent.currentOutput = tabEntry.output;
        this.prAgent.renderGeneratedContent(tabEntry.output);
        this.prAgent.renderStrategy(tabEntry.output.strategy);
        this.prAgent.showWorkspace();
        this.prAgent.hideLoading();
      } else {
        // Error or empty
        this.prAgent.hideLoading();
        if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
        if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
      }
    } else {
      // No content yet for this tab
      if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
      if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
      this.prAgent.hideLoading();
    }
  }

  closeAngleTab(tabId) {
    const tabsContainer = document.getElementById('pr-angle-tabs');
    if (!tabsContainer) return;

    const tab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tab) return;

    const wasActive = tab.classList.contains('active');
    const angleId = tab.dataset.angleId;
    tab.remove();

    // Clean up stored content
    this.tabContent.delete(tabId);

    if (wasActive) {
      const remaining = tabsContainer.querySelectorAll('.pr-angle-tab');
      if (remaining.length > 0) {
        const nextTab = remaining[remaining.length - 1];
        this.switchAngleTab(nextTab.dataset.tabId);
      } else {
        tabsContainer.style.display = 'none';
        this.activeAngle = null;
        this.activeTabId = null;
      }
    }

    const remainingForAngle = tabsContainer.querySelectorAll(`[data-angle-id="${angleId}"]`);
    if (remainingForAngle.length === 0) {
      const card = document.querySelector(`.pr-angle-card[data-angle-id="${angleId}"]`);
      if (card) card.classList.remove('selected');
    }
  }

  trackContentCreation(contentType) {
    if (!this.activeAngle) return;

    const matchingItem = this.activeAngle.content_plan.find(
      item => item.type === contentType && !item.completed
    );

    if (matchingItem) {
      matchingItem.completed = true;
      
      const angleInList = this.angles.find(a => a.id === this.activeAngle.id);
      if (angleInList) {
        const itemInList = angleInList.content_plan.find(i => i.type === contentType);
        if (itemInList) itemInList.completed = true;
      }

      this.saveAngles();
      this.renderAngles();
      this.renderContentSection();
      
      this.prAgent.renderStrategy(null);

      const allCompleted = this.activeAngle.content_plan.every(item => item.completed);
      if (allCompleted) {
        this.prAgent.showToast('Angle content plan completed!', 'success');
        this.activeAngle = null;
        localStorage.removeItem('pr_active_angle');
        this.renderContentSection();
        this.prAgent.renderStrategy(null);
      }
    }
  }

  renderContentSection() {
    if (!this.dom.contentList) return;

    const outputs = this.prAgent.outputs || [];
    const hasActive = !!this.activeAngle;

    // Group past outputs by angleId (exclude active angle's outputs from "past" if still active)
    const groups = new Map();
    const ungrouped = [];
    outputs.forEach(output => {
      if (output.angleId) {
        // Skip outputs belonging to the currently active angle
        if (hasActive && output.angleId === this.activeAngle.id) return;
        if (!groups.has(output.angleId)) {
          groups.set(output.angleId, { angleId: output.angleId, outputs: [], title: null, latestDate: 0 });
        }
        const group = groups.get(output.angleId);
        group.outputs.push(output);
        if (!group.title) {
          group.title = output.angleTitle || this.prAgent.getAngleTitle(output.angleId) || output.title;
        }
        const created = new Date(output.createdAt).getTime() || 0;
        if (created > group.latestDate) group.latestDate = created;
      } else {
        ungrouped.push(output);
      }
    });

    // Build past entries sorted by most recent
    const pastEntries = [];
    groups.forEach(group => pastEntries.push({ type: 'angle', ...group }));
    ungrouped.forEach(output => pastEntries.push({
      type: 'single',
      output,
      latestDate: new Date(output.createdAt).getTime() || 0
    }));
    pastEntries.sort((a, b) => b.latestDate - a.latestDate);

    // Determine if we have anything to show
    if (!hasActive && pastEntries.length === 0) {
      this.dom.contentList.innerHTML = '';
      if (this.dom.contentEmpty) this.dom.contentEmpty.style.display = 'block';
      return;
    }

    if (this.dom.contentEmpty) this.dom.contentEmpty.style.display = 'none';

    let html = '';

    // Active angle (expanded, pinned to top)
    if (hasActive) {
      const completedCount = this.activeAngle.content_plan.filter(item => item.completed).length;
      const totalCount = this.activeAngle.content_plan.length;
      html += `
        <div class="pr-content-active-angle">
          <div class="pr-content-angle-header">
            <span class="pr-content-angle-title">${this.escapeHtml(this.activeAngle.title)}</span>
            <span class="pr-content-angle-progress">${completedCount} of ${totalCount} completed</span>
          </div>
          <ul class="pr-content-checklist">
            ${this.activeAngle.content_plan.map(item => `
              <li class="pr-content-check-item ${item.completed ? 'completed' : ''}">
                <span class="pr-content-checkbox">${item.completed ? '✅' : '⬜'}</span>
                <span class="pr-content-check-text">${this.formatContentType(item.type)} - ${this.escapeHtml(item.description)}</span>
              </li>
            `).join('')}
          </ul>
        </div>`;
    }

    // Past angles (collapsed, compact)
    html += pastEntries.map(entry => {
      if (entry.type === 'angle') {
        const pieceCount = entry.outputs.length;
        const pieceTypes = entry.outputs.map(o => {
          const label = CONTENT_TYPES.find(t => t.id === o.content_type)?.label || o.content_type;
          return label;
        }).join(', ');
        const dateText = this.prAgent.formatHistoryDate(entry.latestDate);
        return `
          <div class="pr-content-past-angle" data-angle-id="${entry.angleId}">
            <div class="pr-content-past-info">
              <span class="pr-content-past-title">${this.escapeHtml(entry.title || 'Untitled Angle')}</span>
              <span class="pr-content-past-meta">
                <span class="pr-content-past-pieces">${pieceCount} piece${pieceCount !== 1 ? 's' : ''}</span>
                <span class="pr-content-past-date">${dateText}</span>
              </span>
            </div>
            <button class="pr-content-past-delete" data-angle-delete="${entry.angleId}" title="Delete all pieces">
              <i class="ph-light ph-x"></i>
            </button>
          </div>`;
      } else {
        const output = entry.output;
        const typeLabel = CONTENT_TYPES.find(t => t.id === output.content_type)?.label || output.content_type;
        const dateText = this.prAgent.formatHistoryDate(entry.latestDate);
        return `
          <div class="pr-content-past-angle pr-content-past-single" data-output-id="${output.id}">
            <div class="pr-content-past-info">
              <span class="pr-content-past-title">${this.escapeHtml(output.title || 'Untitled')}</span>
              <span class="pr-content-past-meta">
                <span class="pr-content-past-pieces">${typeLabel}</span>
                <span class="pr-content-past-date">${dateText}</span>
              </span>
            </div>
            <button class="pr-content-past-delete" data-history-delete="${output.id}" title="Delete">
              <i class="ph-light ph-x"></i>
            </button>
          </div>`;
      }
    }).join('');

    this.dom.contentList.innerHTML = html;

    // Click handlers for past angle groups (restore all tabs)
    this.dom.contentList.querySelectorAll('.pr-content-past-angle[data-angle-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-angle-delete]')) return;
        const angleId = item.dataset.angleId;
        const group = groups.get(angleId);
        if (group) {
          this.restoreAngleFromHistory(angleId, group.outputs);
        }
      });
    });

    // Click handlers for single (ungrouped) items
    this.dom.contentList.querySelectorAll('.pr-content-past-single[data-output-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-history-delete]')) return;
        const outputId = item.dataset.outputId;
        if (outputId) this.prAgent.loadOutput(outputId);
      });
    });

    // Delete handlers for angle groups
    this.dom.contentList.querySelectorAll('[data-angle-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const angleId = btn.dataset.angleDelete;
        const toDelete = this.prAgent.outputs.filter(o => o.angleId === angleId);
        this.prAgent.outputs = this.prAgent.outputs.filter(o => o.angleId !== angleId);

        if (this.activeAngle && this.activeAngle.id === angleId) {
          this.resetWorkspace();
        }

        this.renderContentSection();
        toDelete.forEach(output => {
          fetch(`/api/pr/outputs/${output.id}`, { method: 'DELETE' }).catch(() => {});
        });
        this.prAgent.saveOutputs();
      });
    });

    // Delete handlers for single items
    this.dom.contentList.querySelectorAll('[data-history-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const outputId = btn.dataset.historyDelete;
        if (!outputId) return;
        this.prAgent.outputs = this.prAgent.outputs.filter(o => o.id !== outputId);
        this.renderContentSection();
        fetch(`/api/pr/outputs/${outputId}`, { method: 'DELETE' }).catch(() => {});
        this.prAgent.saveOutputs();

        if (this.prAgent.outputs.length === 0 && !this.activeAngle) {
          this.resetWorkspace();
        }
      });
    });
  }

  async deleteAngle(angleId) {
    try {
      const response = await fetch(`/api/pr/angles/${angleId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        this.angles = this.angles.filter(a => a.id !== angleId);
        
        if (this.activeAngle && this.activeAngle.id === angleId) {
          this.activeAngle = null;
          localStorage.removeItem('pr_active_angle');
        }
        
        this.renderAngles();
        this.renderContentSection();
        this.prAgent.showToast('Angle deleted', 'success');
      }
    } catch (error) {
      console.error('Error deleting angle:', error);
      this.prAgent.showToast('Failed to delete angle', 'error');
    }
  }

  formatContentType(type) {
    const normalized = type === 'tweet_thread' ? 'tweet' : type;
    const typeMap = {
      'tweet': 'Tweet',
      'linkedin_post': 'LinkedIn Post',
      'blog_post': 'Blog Post',
      'email_blast': 'Email',
      'product_announcement': 'Product Announcement',
      'talking_points': 'Talking Points',
      'investor_snippet': 'Investor Snippet',
      'press_release': 'Blog Post',
      'media_pitch': 'Email',
      'founder_quote': 'Blog Post',
      'op_ed': 'Blog Post',
      'briefing_doc': 'Talking Points'
    };
    return typeMap[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  resetWorkspace() {
    // Close all tabs
    const tabsContainer = document.getElementById('pr-angle-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      tabsContainer.style.display = 'none';
    }

    // Clear stored content
    this.tabContent.clear();
    this.activeTabId = null;
    this.activeAngle = null;
    localStorage.removeItem('pr_active_angle');

    // Re-render content section
    this.renderContentSection();

    // Deselect all angle cards
    document.querySelectorAll('.pr-angle-card').forEach(card => card.classList.remove('selected'));

    // Reset workspace to empty state
    if (this.prAgent.dom.workspaceEmpty) this.prAgent.dom.workspaceEmpty.style.display = 'flex';
    if (this.prAgent.dom.workspaceGenerated) this.prAgent.dom.workspaceGenerated.style.display = 'none';
    this.prAgent.hideLoading();
    this.prAgent.currentOutput = null;

    // Re-expand Story Angles, collapse Content
    this.collapseSection('pr-angles-body', false);
    this.collapseSection('pr-content-body', true);
  }

  restoreAngleFromHistory(angleId, outputs) {
    // Reset current workspace first
    this.resetWorkspace();

    // Find the angle
    const angle = this.angles.find(a => a.id === angleId) || this.defaultAngles.find(a => a.id === angleId);
    if (!angle) return;

    this.activeAngle = angle;
    localStorage.setItem('pr_active_angle', JSON.stringify(angle));

    // Select the angle card
    document.querySelectorAll('.pr-angle-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.angleId === angleId);
    });

    // Open tabs for each output and store content
    outputs.forEach((output, i) => {
      const planIndex = angle.content_plan
        ? angle.content_plan.findIndex(p => p.type === output.content_type)
        : i;
      const idx = planIndex >= 0 ? planIndex : i;
      const tabLabel = CONTENT_TYPES.find(t => t.id === output.content_type)?.label || output.content_type;
      const tabId = `${angle.id}_${idx}`;

      this.openAngleTab(angle, idx, tabLabel);
      this.tabContent.set(tabId, { loading: false, output });
    });

    // Switch to first tab and render its content
    const firstOutput = outputs[0];
    if (firstOutput) {
      const firstPlanIndex = angle.content_plan
        ? angle.content_plan.findIndex(p => p.type === firstOutput.content_type)
        : 0;
      const firstTabId = `${angle.id}_${firstPlanIndex >= 0 ? firstPlanIndex : 0}`;
      this.switchAngleTab(firstTabId);
    }

    this.renderContentSection();
    this.collapseSection('pr-angles-body', true);
    this.collapseSection('pr-content-body', false);
  }

  collapseSection(sectionId, collapsed) {
    const body = document.getElementById(sectionId);
    if (!body) return;
    const header = body.previousElementSibling;
    if (collapsed) {
      body.classList.add('collapsed');
      if (header) header.classList.add('collapsed');
    } else {
      body.classList.remove('collapsed');
      if (header) header.classList.remove('collapsed');
    }
    // Persist state
    try {
      const states = JSON.parse(localStorage.getItem('pr_collapse_states') || '{}');
      states[sectionId] = collapsed;
      localStorage.setItem('pr_collapse_states', JSON.stringify(states));
    } catch (e) { /* silent */ }
  }

  setupCollapsibleSections() {
    document.querySelectorAll('.pr-collapsible-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't collapse if clicking a button inside the header
        if (e.target.closest('button') || e.target.closest('select')) return;
        const targetId = header.dataset.collapseTarget;
        const body = document.getElementById(targetId);
        if (!body) return;
        const isCollapsed = body.classList.contains('collapsed');
        this.collapseSection(targetId, !isCollapsed);
      });
    });

    // Restore saved states, with defaults: angles expanded, content collapsed
    try {
      const states = JSON.parse(localStorage.getItem('pr_collapse_states') || '{}');
      const defaults = { 'pr-angles-body': false, 'pr-content-body': true };
      const merged = { ...defaults, ...states };
      Object.entries(merged).forEach(([id, collapsed]) => {
        this.collapseSection(id, collapsed);
      });
    } catch (e) { /* silent */ }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================
// DISTRIBUTE MANAGER
// ============================================

const LINKEDIN_PUBLISHABLE_TYPES = ['linkedin_post', 'blog_post'];
const X_PUBLISHABLE_TYPES = ['tweet'];

class DistributeManager {
  constructor(prAgent) {
    this.prAgent = prAgent;
    this.settings = {
      linkedin: { name: 'Glossi', headline: 'A real-time content creation platform that brings products to life.', photoUrl: 'assets/glossi-logo.svg' }
    };
    this.scheduledPosts = [];
    this.activeReviewItem = null;
    this.activeChannel = null;
    this._mediaUrlMode = null;
    this.linkedInConnected = false;
    this.linkedInOrgName = null;
    this.xConnected = false;
    this.xUsername = null;
  }

  async init() {
    await this.loadSettings();
    await this.loadScheduledPosts();
    this.setupEventListeners();
    this.render();
    this.checkLinkedInStatus();
    this.checkXStatus();
  }

  async loadSettings() {
    try {
      const res = await this.prAgent.apiCall('/api/pr/distribution-settings');
      if (res.success && res.settings) {
        this.settings = { ...this.settings, ...res.settings };
      }
    } catch (e) { /* use defaults */ }
  }

  async saveSettings() {
    try {
      await this.prAgent.apiCall('/api/pr/distribution-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: this.settings })
      });
    } catch (e) { /* silent */ }
  }

  async loadScheduledPosts() {
    try {
      const res = await this.prAgent.apiCall('/api/pr/scheduled');
      if (res.success && res.posts) {
        this.scheduledPosts = res.posts;
      }
    } catch (e) { /* silent */ }
  }

  setupEventListeners() {
    // Settings panel open/close
    const settingsBtn = document.getElementById('pr-distribute-settings-btn');
    const settingsPanel = document.getElementById('pr-distribute-settings-panel');
    const settingsClose = document.getElementById('pr-distribute-settings-close');
    const settingsSave = document.getElementById('pr-distribute-settings-save');

    settingsBtn?.addEventListener('click', () => {
      this.populateSettingsForm();
      if (settingsPanel) settingsPanel.style.display = 'flex';
    });

    settingsClose?.addEventListener('click', () => {
      if (settingsPanel) settingsPanel.style.display = 'none';
    });

    settingsSave?.addEventListener('click', () => {
      this.saveSettingsFromForm();
      if (settingsPanel) settingsPanel.style.display = 'none';
    });

    // Photo URL preview
    const photoInput = document.getElementById('pr-linkedin-photo');
    photoInput?.addEventListener('input', () => {
      this.updatePhotoPreview(photoInput.value);
    });

    // Published section toggle
    const publishedToggle = document.getElementById('pr-distribute-published-toggle');
    publishedToggle?.addEventListener('click', () => {
      const list = document.getElementById('pr-distribute-published-list');
      const isExpanded = publishedToggle.classList.toggle('expanded');
      if (list) list.style.display = isExpanded ? 'block' : 'none';
    });

    // Back to Edit
    document.getElementById('pr-distribute-back-btn')?.addEventListener('click', () => {
      this.backToEdit();
    });

    // Publish Now
    document.getElementById('pr-distribute-publish-btn')?.addEventListener('click', () => {
      this.publishNow();
    });

    // Download for Blog
    document.getElementById('pr-distribute-download-blog-btn')?.addEventListener('click', () => {
      this.downloadBlogMarkdown();
    });

    // Blog slug input
    document.getElementById('pr-blog-slug-input')?.addEventListener('input', (e) => {
      const raw = e.target.value;
      e.target.value = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    });

    // Tweet format picker
    document.getElementById('pr-twitter-format-bar')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.pr-twitter-format-pill');
      if (!pill || !this.activeReviewItem) return;
      const newFormat = pill.dataset.format;
      if (newFormat === this.activeReviewItem.tweet_format) return;
      this.activeReviewItem.tweet_format = newFormat;
      this.persistOutput(this.activeReviewItem);
      this.renderTwitterPreview(this.activeReviewItem);
      if (newFormat === 'visual' && !this.activeReviewItem.media_attachments?.some(m => m.type === 'image')) {
        this.autoGenerateVisual(this.activeReviewItem);
      }
    });

    // Schedule
    document.getElementById('pr-distribute-schedule-btn')?.addEventListener('click', () => {
      this.openScheduleModal();
    });

    // Schedule modal
    const scheduleModal = document.getElementById('pr-schedule-modal');
    const scheduleClose = document.getElementById('pr-schedule-modal-close');
    const scheduleCancel = document.getElementById('pr-schedule-cancel');
    const scheduleConfirm = document.getElementById('pr-schedule-confirm');

    scheduleClose?.addEventListener('click', () => {
      scheduleModal?.classList.remove('visible');
    });

    scheduleCancel?.addEventListener('click', () => {
      scheduleModal?.classList.remove('visible');
    });

    scheduleModal?.addEventListener('click', (e) => {
      if (e.target === scheduleModal) scheduleModal.classList.remove('visible');
    });

    scheduleConfirm?.addEventListener('click', () => {
      this.confirmSchedule();
    });

    // Send to Review button (in Create stage)
    document.getElementById('pr-send-to-review-btn')?.addEventListener('click', () => {
      this.sendCurrentToReview();
    });

    // Media attachment buttons
    document.getElementById('pr-media-upload-btn')?.addEventListener('click', () => {
      document.getElementById('pr-media-file-input')?.click();
    });

    document.getElementById('pr-media-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.uploadMediaFile(file);
      e.target.value = '';
    });

    document.getElementById('pr-media-url-btn')?.addEventListener('click', () => {
      this._mediaUrlMode = 'image';
      this.showMediaUrlInput('Paste image URL...');
    });

    document.getElementById('pr-media-video-btn')?.addEventListener('click', () => {
      this._mediaUrlMode = 'video';
      this.showMediaUrlInput('Paste video URL...');
    });

    document.getElementById('pr-media-link-btn')?.addEventListener('click', () => {
      this._mediaUrlMode = 'link';
      this.showMediaUrlInput('Paste link URL...');
    });

    document.getElementById('pr-media-url-confirm')?.addEventListener('click', () => {
      this.confirmMediaUrl();
    });

    document.getElementById('pr-media-url-cancel')?.addEventListener('click', () => {
      this.hideMediaUrlInput();
    });

    document.getElementById('pr-media-url-value')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.confirmMediaUrl();
      if (e.key === 'Escape') this.hideMediaUrlInput();
    });

    // Hashtag add button
    document.getElementById('pr-distribute-hashtag-add')?.addEventListener('click', () => {
      this.addHashtagPrompt();
    });

    // Channel switching (LinkedIn / Blog / Email / Twitter)
    document.querySelectorAll('.pr-distribute-channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const channel = btn.dataset.channel;
        if (!channel) return;
        this.setActiveChannel(channel);
      });
    });

    // LinkedIn connect/disconnect
    document.getElementById('pr-linkedin-connect-btn')?.addEventListener('click', () => {
      window.location.href = '/api/linkedin/connect';
    });

    document.getElementById('pr-linkedin-disconnect-btn')?.addEventListener('click', async () => {
      try {
        await this.prAgent.apiCall('/api/linkedin/disconnect', { method: 'POST' });
        this.linkedInConnected = false;
        this.updateLinkedInStatusUI(false);
      } catch (e) { /* silent */ }
    });

    // Review queue click delegation
    const reviewList = document.getElementById('pr-distribute-review-list');
    const scheduledList = document.getElementById('pr-distribute-scheduled-list');
    const publishedList = document.getElementById('pr-distribute-published-list');

    [reviewList, scheduledList, publishedList].forEach(list => {
      list?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.pr-distribute-queue-remove');
        if (removeBtn) {
          e.stopPropagation();
          const removeId = removeBtn.dataset.removeId;
          if (removeId) this.removeFromReview(removeId);
          return;
        }
        const item = e.target.closest('.pr-distribute-queue-item');
        if (item) {
          const outputId = item.dataset.outputId;
          if (outputId) this.selectReviewItem(outputId);
        }
      });
    });
  }

  populateSettingsForm() {
    const li = this.settings.linkedin || {};
    const nameInput = document.getElementById('pr-linkedin-name');
    const headlineInput = document.getElementById('pr-linkedin-headline');
    const photoInput = document.getElementById('pr-linkedin-photo');
    if (nameInput) nameInput.value = li.name || '';
    if (headlineInput) headlineInput.value = li.headline || '';
    if (photoInput) photoInput.value = li.photoUrl || '';
    this.updatePhotoPreview(li.photoUrl || '');
  }

  saveSettingsFromForm() {
    this.settings.linkedin = {
      name: document.getElementById('pr-linkedin-name')?.value?.trim() || '',
      headline: document.getElementById('pr-linkedin-headline')?.value?.trim() || '',
      photoUrl: document.getElementById('pr-linkedin-photo')?.value?.trim() || ''
    };
    this.saveSettings();
    if (this.activeReviewItem) {
      this.renderLinkedInPreview(this.activeReviewItem);
    }
  }

  updatePhotoPreview(url) {
    const container = document.getElementById('pr-linkedin-photo-preview');
    if (!container) return;
    if (url && (url.startsWith('http') || url.startsWith('assets/'))) {
      container.innerHTML = `<img src="${this.escapeHtml(url)}" alt="Profile photo preview">`;
      container.classList.add('has-photo');
    } else {
      container.innerHTML = '';
      container.classList.remove('has-photo');
    }
  }

  // Send current content from Create stage to Review
  async sendCurrentToReview() {
    // Flush any pending contenteditable edits before reading output
    clearTimeout(this.prAgent._editSaveDebounce);
    this.prAgent.saveCurrentEdits();

    // Sync output.content from the current draft (edits go to draft.content, not output.content)
    const currentOutput = this.prAgent.currentOutput;
    if (currentOutput?.drafts?.length) {
      const draftIdx = this.prAgent._viewingDraftIndex || 0;
      const activeDraft = currentOutput.drafts[draftIdx];
      if (activeDraft?.content) {
        currentOutput.content = activeDraft.content;
      }
    }

    const nm = this.prAgent.newsMonitor;
    if (!nm || !nm._activeStoryKey || nm._activeTabId == null) return;

    const story = nm._stories.get(nm._activeStoryKey);
    if (!story) return;

    const tabId = nm._activeTabId;
    const planIndex = parseInt(String(tabId).replace('plan_', ''), 10);
    const planItem = story.contentPlan?.[planIndex];
    if (!planItem) return;

    // Find the matching output using multiple strategies
    const tabEntry = nm._tabContent?.get(tabId);
    let output = tabEntry?.output;

    // Fallback: use the currently displayed output if it belongs to this story
    if (!output && this.prAgent.currentOutput?.story_key === nm._activeStoryKey) {
      output = this.prAgent.currentOutput;
    }

    // Fallback: search outputs by story_key + content_plan_index (strict)
    if (!output) {
      output = this.prAgent.outputs.find(o =>
        o.story_key === nm._activeStoryKey && o.content_plan_index === planIndex
      );
    }

    // Fallback: search outputs by story_key + content_plan_index (string coercion)
    if (!output) {
      output = this.prAgent.outputs.find(o =>
        o.story_key === nm._activeStoryKey && String(o.content_plan_index) === String(planIndex)
      );
    }

    // Fallback: search by story_key + content_type matching the plan item
    if (!output) {
      output = this.prAgent.outputs.find(o =>
        o.story_key === nm._activeStoryKey && o.content_type === planItem.type && o.phase !== 'distribute'
      );
    }

    if (!output || !output.content) return;

    // Ensure output is in the outputs array (might not be if found via currentOutput)
    if (!this.prAgent.outputs.includes(output)) {
      this.prAgent.outputs.push(output);
    }

    // Sync content_type and content_plan_index with the plan item
    if (planItem.type && output.content_type !== planItem.type) {
      output.content_type = planItem.type;
    }
    output.content_plan_index = planIndex;

    // Update phase and status
    output.phase = 'distribute';
    output.status = 'review';

    // Clean citations from content before review
    output.content = await this.cleanCitationsForReview(output);

    // Extract URLs from content and move to first comment
    const extractedLink = this.extractFirstLink(output.content);
    if (extractedLink) {
      output.first_comment = extractedLink;
      output.content = output.content.replace(extractedLink, '').trim();
    }

    // Initialize media_attachments if not present
    if (!output.media_attachments) output.media_attachments = [];

    // Fetch OG data for link if present
    if (extractedLink) {
      try {
        const ogRes = await this.prAgent.apiCall('/api/pr/og-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: extractedLink })
        });
        if (ogRes.success && ogRes.og) {
          output.og_data = ogRes.og;
        }
      } catch (e) { /* silent */ }
    }

    // AI-suggest hashtags
    this.generateHashtags(output);

    // Persist
    try {
      await this.prAgent.apiCall('/api/pr/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(output)
      });
    } catch (e) { /* silent */ }

    this.prAgent.saveOutputs();

    // Pre-set the channel for this content type
    this.activeChannel = this.getChannelForContentType(output.content_type);

    // Switch to Distribute tab
    const distributeNav = document.querySelector('.pr-nav-item[data-stage="distribute"]');
    if (distributeNav) distributeNav.click();

    // Select this item in the review queue
    this.render();
    this.selectReviewItem(output.id);
  }

  extractFirstLink(text) {
    if (!text) return null;
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  }

  async generateHashtags(output) {
    if (!output.content) return;
    try {
      const res = await this.prAgent.apiCall('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          system: 'You suggest LinkedIn hashtags. Return ONLY a JSON array of 2-3 hashtags (without the # symbol). Example: ["AI","ProductVisualization","Ecommerce"]. No explanation.',
          messages: [{ role: 'user', content: `Suggest 2-3 LinkedIn hashtags for this post:\n\n${output.content.substring(0, 500)}` }]
        })
      });
      const text = res.content?.[0]?.text || '[]';
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        output.hashtags = JSON.parse(jsonMatch[0]).map(h => h.replace(/^#/, ''));
        this.renderHashtags(output);
        this.persistOutput(output);
      }
    } catch (e) { /* silent, hashtags are optional */ }
  }

  async cleanCitationsForReview(output) {
    if (!output.content || !/\[Source\s*\d+\]/i.test(output.content)) {
      return output.content || '';
    }

    if (output.content_type === 'tweet') {
      return output.content.replace(/\s*\[Source\s*\d+\]/gi, '').trim();
    }

    const sourceMatches = output.content.match(/\[Source\s*(\d+)\]/gi) || [];
    const sourceIndices = [...new Set(sourceMatches.map(m => parseInt(m.match(/\d+/)[0])))];

    const citationDetails = sourceIndices.map(idx => {
      const citation = output.citations?.find(c => c.index === idx);
      const source = citation?.sourceId
        ? this.prAgent.sources.find(s => s.id === citation.sourceId)
        : null;
      return {
        index: idx,
        title: source?.title || `Source ${idx}`,
        url: source?.url || null,
        type: source?.type || 'unknown',
        folder: source?.folder || 'unknown'
      };
    });

    try {
      const res = await this.prAgent.apiCall('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 4096,
          system: [
            'You clean source citations from content before it gets published.',
            'Rules:',
            '- Remove ALL [Source N] markers that reference internal company knowledge, internal docs, or sources without credible external URLs.',
            '- KEEP only citations that reference credible, well-known external publications (e.g. TechCrunch, Bloomberg, The Verge, WSJ, NYT, Reuters, etc.) that validate a claim in the content.',
            '- For KEPT citations, replace [Source N] with a natural inline markdown hyperlink: [publication name](url). Weave it into the sentence naturally (e.g. "according to [TechCrunch](https://...)").',
            '- Do NOT add new attribution where there was none. Only convert existing [Source N] markers.',
            '- Clean up double spaces or awkward punctuation left after removing citations.',
            '- Return ONLY the cleaned content text. No commentary, no explanation.'
          ].join('\n'),
          messages: [{
            role: 'user',
            content: `Source details:\n${JSON.stringify(citationDetails, null, 2)}\n\nContent to clean:\n${output.content}`
          }]
        })
      });

      const cleaned = res.content?.[0]?.text;
      if (cleaned && cleaned.trim().length > 50) {
        return cleaned.trim();
      }
    } catch (e) { /* fall through to simple strip */ }

    return output.content
      .replace(/\s*\[Source\s*\d+\]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();
  }

  selectReviewItem(outputId) {
    const output = this.prAgent.outputs.find(o => o.id === outputId);
    if (!output) return;
    this.activeReviewItem = output;

    // Reset blog slug for the new item
    const slugInput = document.getElementById('pr-blog-slug-input');
    if (slugInput) slugInput.value = '';

    // Show preview, hide empty state
    const emptyState = document.getElementById('pr-distribute-empty-state');
    const previewContent = document.getElementById('pr-distribute-preview-content');
    if (emptyState) emptyState.style.display = 'none';
    if (previewContent) previewContent.style.display = 'block';

    // Highlight active queue item
    document.querySelectorAll('.pr-distribute-queue-item').forEach(el => {
      el.classList.toggle('active', el.dataset.outputId === outputId);
    });

    // Show/hide action buttons based on status
    const backBtn = document.getElementById('pr-distribute-back-btn');
    const publishBtn = document.getElementById('pr-distribute-publish-btn');
    const scheduleBtn = document.getElementById('pr-distribute-schedule-btn');
    const downloadBlogBtn = document.getElementById('pr-distribute-download-blog-btn');

    const isXPublished = output.status === 'published' && output.published_channel === 'twitter';
    if (output.status === 'review') {
      if (backBtn) backBtn.style.display = '';
      if (publishBtn) {
        publishBtn.style.display = '';
        publishBtn.disabled = false;
        publishBtn.classList.remove('pr-publish-btn-published');
        publishBtn.innerHTML = '<i class="ph-light ph-paper-plane-tilt"></i> Publish Now';
      }
      if (scheduleBtn) scheduleBtn.style.display = '';
      if (downloadBlogBtn) downloadBlogBtn.style.display = '';
    } else if (isXPublished) {
      if (backBtn) backBtn.style.display = 'none';
      if (publishBtn) {
        publishBtn.style.display = '';
        publishBtn.disabled = true;
        publishBtn.classList.add('pr-publish-btn-published');
        publishBtn.innerHTML = '<i class="ph-light ph-check-circle"></i> Published';
      }
      if (scheduleBtn) scheduleBtn.style.display = 'none';
      if (downloadBlogBtn) downloadBlogBtn.style.display = 'none';
    } else {
      if (backBtn) backBtn.style.display = output.status === 'published' ? 'none' : '';
      if (publishBtn) publishBtn.style.display = 'none';
      if (scheduleBtn) scheduleBtn.style.display = 'none';
      if (downloadBlogBtn) downloadBlogBtn.style.display = 'none';
    }

    // Re-fetch OG data if output has a first_comment link but no og_data (e.g. older outputs)
    if (output.first_comment && !output.og_data) {
      this.prAgent.apiCall('/api/pr/og-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: output.first_comment })
      }).then(ogRes => {
        if (ogRes.success && ogRes.og) {
          output.og_data = ogRes.og;
          this.persistOutput(output);
          this.renderFirstComment(output);
        }
      }).catch(() => {});
    }

    // Render all previews (isolated so one failure doesn't break the rest)
    const previews = [
      () => this.renderLinkedInPreview(output),
      () => this.renderBlogPreview(output),
      () => this.renderEmailPreview(output),
      () => isXPublished ? this.renderTwitterPublishedState(output) : this.renderTwitterPreview(output),
      () => this.renderHashtags(output),
      () => this.renderFirstComment(output),
      () => this.renderCharCount(output)
    ];
    for (const fn of previews) {
      try { fn(); } catch (_) { /* isolate preview errors */ }
    }

    // Auto-select the best channel for this content type
    const bestChannel = isXPublished ? 'twitter' : this.getChannelForContentType(output.content_type);
    this.setActiveChannel(bestChannel);
  }

  renderLinkedInPreview(output) {
    const container = document.getElementById('pr-linkedin-preview');
    if (!container) return;

    const li = this.settings.linkedin || {};
    const name = li.name || 'Glossi';
    const headline = li.headline || 'A real-time content creation platform that brings products to life.';
    const photoUrl = li.photoUrl || 'assets/glossi-logo.svg';
    const rawContent = output.content || '';
    const content = this.prAgent._stripTitleFromPlainText(rawContent, output.title);
    const hashtags = output.hashtags || [];
    const media = output.media_attachments || [];

    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    const avatarHtml = photoUrl
      ? `<img src="${this.escapeHtml(photoUrl)}" alt="">`
      : `<span class="pr-li-avatar-placeholder">${initials}</span>`;

    // Build post body with hashtags appended
    let fullText = content;
    if (hashtags.length > 0) {
      fullText += '\n\n' + hashtags.map(h => '#' + h).join(' ');
    }

    // Determine if truncation is needed (LinkedIn: 3-line preview on desktop)
    const lines = fullText.split('\n');
    // Handle blank-line edge case like LinkedIn: if line 3 is blank, treat as 2-line cutoff
    let effectiveLineCount = lines.length;
    if (lines.length >= 3 && lines[2].trim() === '') effectiveLineCount = Math.max(effectiveLineCount, 4);
    const isLong = effectiveLineCount > 3 || fullText.length > 210;

    // Format the full body text (always render full content in DOM)
    const formattedBody = this.formatLinkedInBody(fullText);

    // Build media HTML
    let mediaHtml = '';
    const canRemove = output.status === 'review';
    const removeBtn = canRemove ? `<button class="pr-li-media-remove" data-action="remove-media" title="Remove"><i class="ph-light ph-x"></i></button>` : '';

    if (media.length > 0) {
      const attachment = media[0];
      if (attachment.type === 'image') {
        mediaHtml = `<div class="pr-li-media">${removeBtn}<img src="${this.escapeHtml(attachment.url)}" alt=""></div>`;
      } else if (attachment.type === 'video') {
        const thumb = attachment.thumbnail || '';
        mediaHtml = `<div class="pr-li-media"><div class="pr-li-media-video">${removeBtn}${thumb ? `<img src="${this.escapeHtml(thumb)}" alt="">` : ''}<div class="pr-li-video-play"><i class="ph-light ph-play-fill"></i></div></div></div>`;
      }
    }

    container.innerHTML = `
      <div class="pr-li-header">
        <div class="pr-li-avatar">${avatarHtml}</div>
        <div class="pr-li-identity">
          <div class="pr-li-name">${this.escapeHtml(name)}</div>
          <div class="pr-li-headline">${this.escapeHtml(headline)}</div>
          <div class="pr-li-timestamp">
            1h
            <svg class="pr-li-globe" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.2A5.8 5.8 0 002.2 8 5.8 5.8 0 008 13.8 5.8 5.8 0 0013.8 8 5.8 5.8 0 008 2.2zm-.6 1.02V5.6H5.3a6.5 6.5 0 012.1-2.38zM8.6 3.22A6.5 6.5 0 0110.7 5.6H8.6V3.22zM4.84 6.8h2.56v2.4H5.1a6.7 6.7 0 01-.26-2.4zm3.76 0h2.56a6.7 6.7 0 01-.26 2.4H8.6V6.8zM5.3 10.4h2.1v2.38A6.5 6.5 0 015.3 10.4zm3.3 2.38V10.4h2.1a6.5 6.5 0 01-2.1 2.38z"/></svg>
          </div>
        </div>
      </div>
      <div class="pr-li-body ${isLong ? 'pr-li-body-truncated' : ''}">${formattedBody}</div>
      ${isLong ? '<div class="pr-li-see-more-wrap"><span class="pr-li-see-more" data-action="see-more">...more</span></div>' : ''}
      ${mediaHtml}
      <div class="pr-li-engagement">
        <div class="pr-li-action"><i class="ph-light ph-thumbs-up"></i> Like</div>
        <div class="pr-li-action"><i class="ph-light ph-chat-teardrop"></i> Comment</div>
        <div class="pr-li-action"><i class="ph-light ph-repeat"></i> Repost</div>
        <div class="pr-li-action"><i class="ph-light ph-paper-plane-tilt"></i> Send</div>
      </div>
    `;

    // Wire up see more / show less toggle
    const seeMoreBtn = container.querySelector('[data-action="see-more"]');
    if (seeMoreBtn) {
      seeMoreBtn.addEventListener('click', () => {
        const body = container.querySelector('.pr-li-body');
        const isExpanded = !body.classList.contains('pr-li-body-truncated');
        if (isExpanded) {
          body.classList.add('pr-li-body-truncated');
          seeMoreBtn.textContent = '...more';
        } else {
          body.classList.remove('pr-li-body-truncated');
          seeMoreBtn.textContent = 'Show less';
        }
      });
    }

    // Wire up media remove button
    container.querySelector('[data-action="remove-media"]')?.addEventListener('click', () => {
      if (this.activeReviewItem) {
        this.activeReviewItem.media_attachments = [];
        this.persistOutput(this.activeReviewItem);
        this.renderLinkedInPreview(this.activeReviewItem);
      }
    });
  }

  formatLinkedInBody(text) {
    // Escape HTML first, then apply formatting
    let html = this.escapeHtml(text);
    // Hashtags: #word -> blue
    html = html.replace(/#(\w+)/g, '<span class="pr-li-hashtag">#$1</span>');
    // URLs: make blue
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<span class="pr-li-link">$1</span>');
    return html;
  }

  renderCharCount(output) {
    const el = document.getElementById('pr-distribute-char-count');
    if (!el || !output) return;
    const content = output.content || '';
    const isTwitter = this.activeChannel === 'twitter';
    const limit = isTwitter ? 280 : 3000;
    if (isTwitter) {
      const tcoLength = 23;
      const urlPattern = /https?:\/\/[^\s]+/g;
      const len = content.replace(urlPattern, 'x'.repeat(tcoLength)).length;
      el.textContent = `${len.toLocaleString()} / ${limit.toLocaleString()} characters`;
      el.classList.toggle('over-limit', len > limit);
    } else {
      const hashtags = output.hashtags || [];
      const hashtagText = hashtags.length > 0 ? '\n\n' + hashtags.map(h => '#' + h).join(' ') : '';
      const len = (content + hashtagText).length;
      el.textContent = `${len.toLocaleString()} / ${limit.toLocaleString()} characters`;
      el.classList.toggle('over-limit', len > limit);
    }
  }

  getChannelForContentType(contentType) {
    const map = {
      'linkedin_post': 'linkedin',
      'blog_post': 'blog',
      'email_blast': 'email',
      'tweet': 'twitter',
      'media_pitch': 'email',
      'pitch': 'email',
      'press_release': 'blog',
      'op_ed': 'blog',
      'founder_quote': 'linkedin'
    };
    return map[contentType] || 'blog';
  }

  setActiveChannel(channel) {
    this.activeChannel = channel;
    document.querySelectorAll('.pr-distribute-channel-btn').forEach(b => {
      const matches = b.dataset.channel === channel;
      b.classList.toggle('active', matches);
      b.style.display = matches ? '' : 'none';
    });
    this.updateChannelVisibility(channel);
  }

  updateChannelVisibility(channel) {
    const wraps = {
      linkedin: document.getElementById('pr-linkedin-preview-wrap'),
      blog: document.getElementById('pr-blog-preview-wrap'),
      email: document.getElementById('pr-email-preview-wrap'),
      twitter: document.getElementById('pr-twitter-preview-wrap')
    };
    const firstCommentWrap = document.getElementById('pr-li-first-comment-wrap');
    const hashtagsWrap = document.getElementById('pr-distribute-hashtags');
    const charCount = document.getElementById('pr-distribute-char-count');
    const mediaBar = document.getElementById('pr-distribute-media-bar');
    const mediaUrlInput = document.getElementById('pr-distribute-media-url-input');

    // Hide all preview wraps, then show the active one
    Object.values(wraps).forEach(w => { if (w) w.style.display = 'none'; });
    if (wraps[channel]) wraps[channel].style.display = '';

    const isLinkedin = channel === 'linkedin';
    const isTwitter = channel === 'twitter';
    const isBlog = channel === 'blog';
    const isPublishable = isLinkedin || isTwitter;
    if (firstCommentWrap) firstCommentWrap.style.display = isLinkedin && this.activeReviewItem?.first_comment ? '' : 'none';
    if (hashtagsWrap) hashtagsWrap.style.display = (isLinkedin || isTwitter) && this.activeReviewItem?.hashtags?.length ? '' : 'none';
    if (charCount) charCount.style.display = (isLinkedin || isTwitter) ? '' : 'none';
    if (mediaBar) mediaBar.style.display = isPublishable && this.activeReviewItem?.status === 'review' ? 'flex' : 'none';
    if (!isPublishable && mediaUrlInput) mediaUrlInput.style.display = 'none';

    // Toggle publish vs download button based on channel (skip for published items)
    const isPublishedItem = this.activeReviewItem?.status === 'published';
    const publishBtn = document.getElementById('pr-distribute-publish-btn');
    const downloadBlogBtn = document.getElementById('pr-distribute-download-blog-btn');
    const scheduleBtn = document.getElementById('pr-distribute-schedule-btn');
    if (!isPublishedItem) {
      if (publishBtn) publishBtn.style.display = isBlog ? 'none' : '';
      if (downloadBlogBtn) downloadBlogBtn.style.display = isBlog ? '' : 'none';
      if (scheduleBtn) scheduleBtn.style.display = isBlog ? 'none' : '';
    }

    // Blog slug field
    const slugField = document.getElementById('pr-blog-slug-field');
    if (slugField) slugField.style.display = isBlog ? '' : 'none';
  }

  renderBlogPreview(output) {
    const container = document.getElementById('pr-blog-preview');
    if (!container) return;

    const title = output.title || output.news_headline || 'Untitled Post';
    const content = output.content || '';
    const media = output.media_attachments || [];
    const createdAt = output.created_at ? new Date(output.created_at) : new Date();

    const dateStr = createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const featuredImage = media.length > 0 && media[0].type === 'image' ? media[0].url : null;
    const featuredImageHtml = featuredImage
      ? `<div class="pr-blog-featured-img"><img src="${this.escapeHtml(featuredImage)}" alt=""></div>`
      : '';

    const bodyHtml = this.prAgent._deduplicateTitleFromContent(this.markdownToBlogHtml(content), title);

    container.innerHTML = `
      <div class="pr-blog-nav">
        <div class="pr-blog-nav-logo">
          <img src="assets/glossi-logo.svg" alt="" class="pr-blog-nav-mark">
          <img src="assets/glossi-wordmark.svg" alt="Glossi" class="pr-blog-nav-wordmark">
        </div>
        <div class="pr-blog-nav-links">
          <span class="pr-blog-nav-link">Product</span>
          <span class="pr-blog-nav-link">Blog</span>
          <span class="pr-blog-nav-link">About</span>
        </div>
      </div>
      <div class="pr-blog-header">
        <div class="pr-blog-meta">
          <span>${this.escapeHtml(dateStr)}</span>
          <span class="pr-blog-meta-separator">/</span>
          <span>Glossi</span>
        </div>
        <h1 class="pr-blog-title">${this.escapeHtml(title)}</h1>
      </div>
      ${featuredImageHtml}
      <div class="pr-blog-body">${bodyHtml}</div>
      <div class="pr-blog-cta">
        <h3>Protect your product. Protect your brand.</h3>
        <p>Glossi is the visual production platform that safeguards the integrity of your product and brand identity across every asset, at any scale.</p>
        <span class="pr-blog-cta-btn">Start rendering</span>
      </div>
      <div class="pr-blog-footer">
        <div class="pr-blog-footer-logo">
          <img src="assets/glossi-logo.svg" alt="" class="pr-blog-footer-mark">
          <img src="assets/glossi-wordmark.svg" alt="Glossi" class="pr-blog-footer-wordmark">
        </div>
      </div>
    `;

    const slugInput = document.getElementById('pr-blog-slug-input');
    if (slugInput && !slugInput.value) {
      slugInput.value = this.generateSlug(title);
    }
  }

  markdownToBlogHtml(text) {
    if (!text) return '<p></p>';

    const escaped = this.escapeHtml(text);
    const lines = escaped.split('\n');
    const blocks = [];
    let currentBlock = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        continue;
      }

      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        blocks.push('---');
        continue;
      }

      currentBlock.push(line);
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    let html = '';

    for (const block of blocks) {
      const trimmedBlock = block.trim();

      if (trimmedBlock === '---') {
        html += '<hr>';
        continue;
      }

      if (trimmedBlock.startsWith('### ')) {
        html += `<h3>${this.applyInlineFormatting(trimmedBlock.slice(4))}</h3>`;
        continue;
      }

      if (trimmedBlock.startsWith('## ')) {
        html += `<h2>${this.applyInlineFormatting(trimmedBlock.slice(3))}</h2>`;
        continue;
      }

      if (trimmedBlock.startsWith('# ')) {
        html += `<h2>${this.applyInlineFormatting(trimmedBlock.slice(2))}</h2>`;
        continue;
      }

      if (trimmedBlock.startsWith('&gt; ')) {
        const quoteText = trimmedBlock.split('\n').map(l => l.replace(/^&gt;\s?/, '')).join(' ');
        html += `<blockquote><p>${this.applyInlineFormatting(quoteText)}</p></blockquote>`;
        continue;
      }

      const listLines = trimmedBlock.split('\n');
      const isBulletList = listLines.every(l => /^\s*[-*]\s/.test(l));
      const isNumberedList = listLines.every(l => /^\s*\d+[.)]\s/.test(l));

      if (isBulletList) {
        const items = listLines.map(l => `<li>${this.applyInlineFormatting(l.replace(/^\s*[-*]\s/, ''))}</li>`).join('');
        html += `<ul>${items}</ul>`;
        continue;
      }

      if (isNumberedList) {
        const items = listLines.map(l => `<li>${this.applyInlineFormatting(l.replace(/^\s*\d+[.)]\s/, ''))}</li>`).join('');
        html += `<ol>${items}</ol>`;
        continue;
      }

      const paragraphLines = trimmedBlock.split('\n');
      let paraHtml = '';
      for (const pLine of paragraphLines) {
        const pTrimmed = pLine.trim();
        if (pTrimmed.startsWith('### ')) {
          if (paraHtml) { html += `<p>${this.applyInlineFormatting(paraHtml)}</p>`; paraHtml = ''; }
          html += `<h3>${this.applyInlineFormatting(pTrimmed.slice(4))}</h3>`;
        } else if (pTrimmed.startsWith('## ')) {
          if (paraHtml) { html += `<p>${this.applyInlineFormatting(paraHtml)}</p>`; paraHtml = ''; }
          html += `<h2>${this.applyInlineFormatting(pTrimmed.slice(3))}</h2>`;
        } else {
          paraHtml += (paraHtml ? ' ' : '') + pTrimmed;
        }
      }
      if (paraHtml) {
        html += `<p>${this.applyInlineFormatting(paraHtml)}</p>`;
      }
    }

    return html || '<p></p>';
  }

  applyInlineFormatting(text) {
    let result = text;
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');
    result = result.replace(/(https?:\/\/[^\s<]+)/g, '<a style="color: #EC5F3F; text-decoration: none;">$1</a>');
    return result;
  }

  renderEmailPreview(output) {
    const container = document.getElementById('pr-email-preview');
    if (!container) return;

    const title = output.title || output.news_headline || 'Untitled';
    const content = output.content || '';
    const createdAt = output.created_at ? new Date(output.created_at) : new Date();
    const dateStr = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ', ' + createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const isMediaPitch = output.content_type === 'media_pitch' || output.content_type === 'pitch';
    const toLabel = isMediaPitch ? 'journalist@publication.com' : 'recipient@company.com';

    // Parse subject from title or first line
    let subject = title;
    if (subject.toLowerCase().startsWith('subject:')) {
      subject = subject.replace(/^subject:\s*/i, '');
    }

    // Strip "Subject:" line from body content (already shown in header)
    let bodyContent = content;
    const subjectLinePattern = /^subject:\s*.+/i;
    const contentLines = bodyContent.split('\n');
    while (contentLines.length > 0 && (contentLines[0].trim() === '' || subjectLinePattern.test(contentLines[0].trim()))) {
      contentLines.shift();
    }
    bodyContent = contentLines.join('\n').trim();

    // Convert content to paragraphs and deduplicate title
    const paragraphs = bodyContent.split(/\n\n+/).filter(p => p.trim());
    const rawBodyHtml = paragraphs.map(p => {
      const escaped = this.escapeHtml(p.trim());
      return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    const bodyHtml = this.prAgent._deduplicateTitleFromContent(rawBodyHtml, subject);

    container.innerHTML = `
      <div class="pr-email-toolbar">
        <span class="pr-email-toolbar-btn"><i class="ph-light ph-arrow-left"></i></span>
        <span class="pr-email-toolbar-btn"><i class="ph-light ph-archive-box"></i></span>
        <span class="pr-email-toolbar-btn"><i class="ph-light ph-trash"></i></span>
        <span class="pr-email-toolbar-btn"><i class="ph-light ph-envelope-open"></i></span>
        <span style="flex:1"></span>
        <span class="pr-email-toolbar-btn"><i class="ph-light ph-arrow-bend-up-left"></i></span>
        <span class="pr-email-toolbar-btn"><i class="ph-light ph-dots-three"></i></span>
      </div>
      <div class="pr-email-header">
        <div class="pr-email-subject">${this.escapeHtml(subject)}</div>
        <div class="pr-email-meta">
          <div class="pr-email-avatar"><span>G</span></div>
          <div class="pr-email-meta-details">
            <div class="pr-email-from">
              Glossi
              <span class="pr-email-from-addr">&lt;hello@glossi.io&gt;</span>
            </div>
            <div class="pr-email-to">to ${this.escapeHtml(toLabel)}</div>
          </div>
          <div class="pr-email-date">${dateStr}</div>
        </div>
      </div>
      <div class="pr-email-body">${bodyHtml}</div>
      <div class="pr-email-signature">
        <div class="pr-email-sig-name">Will Erwin</div>
        <div class="pr-email-sig-title">CEO</div>
        <div class="pr-email-sig-company">Glossi</div>
        <div class="pr-email-sig-links">
          <a href="https://www.glossi.io">glossi.io</a>
          <span class="pr-email-sig-sep">|</span>
          <a href="mailto:will.erwin@glossi.io">will.erwin@glossi.io</a>
        </div>
      </div>
    `;
  }

  renderTwitterPreview(output) {
    const container = document.getElementById('pr-twitter-preview');
    if (!container) return;

    const content = output.content || '';
    const createdAt = output.created_at ? new Date(output.created_at) : new Date();
    const timeStr = createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const tweetFormat = output.tweet_format || 'text';
    const media = output.media_attachments || [];
    const hasImage = media.some(m => m.type === 'image');

    const formatBar = document.getElementById('pr-twitter-format-bar');
    if (formatBar) {
      formatBar.querySelectorAll('.pr-twitter-format-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.format === tweetFormat);
      });
    }

    const tweet = content.trim();
    const tcoLength = 23;
    const urlPattern = /https?:\/\/[^\s]+/g;
    const charCount = tweet.replace(urlPattern, 'x'.repeat(tcoLength)).length;
    const isOver = charCount > 280;

    let mediaHtml = '';

    if (tweetFormat === 'visual') {
      if (hasImage) {
        const img = media.find(m => m.type === 'image');
        mediaHtml = `
          <div class="pr-twitter-image-card">
            <img src="${this.escapeHtml(img.url)}" alt="">
            <button class="pr-twitter-image-remove" data-action="remove-twitter-image" title="Remove image">
              <i class="ph-light ph-x"></i>
            </button>
          </div>
          <div class="pr-twitter-visual-feedback">
            <div class="pr-twitter-visual-feedback-row">
              <input type="text" class="pr-twitter-visual-feedback-input" data-action="visual-feedback" placeholder="Describe adjustments (e.g. make the stat larger, change layout)">
              <button class="pr-twitter-visual-feedback-btn" data-action="submit-feedback">Refine</button>
            </div>
          </div>`;
      } else if (output._visualGenerating) {
        mediaHtml = `
          <div class="pr-twitter-visual-loading">
            ${glossiLoaderSVG('glossi-loader-sm')}
            <span>Generating infographic...</span>
          </div>`;
      } else {
        mediaHtml = `
          <div class="pr-twitter-generate-visual">
            <div class="pr-twitter-generate-visual-hint">
              <i class="ph-light ph-image"></i>
              <span>Click to generate an AI infographic</span>
            </div>
            <button class="pr-twitter-generate-visual-btn" data-action="generate-visual">
              <i class="ph-light ph-magic-wand"></i> Generate Infographic
            </button>
          </div>`;
      }
    } else if (tweetFormat === 'link') {
      const linkUrl = output.link_url || '';
      const domain = linkUrl ? (() => { try { return new URL(linkUrl).hostname.replace('www.', ''); } catch { return ''; } })() : '';
      const ogImage = output.og_image || '';
      const ogGenerating = output._ogGenerating || false;

      let ogImageHtml = '';
      if (ogImage) {
        ogImageHtml = `<div class="pr-twitter-link-card-image"><img src="${this.escapeHtml(ogImage)}" alt=""><button class="pr-twitter-link-card-image-remove" data-action="remove-og-image" title="Remove"><i class="ph-light ph-x"></i></button></div>`;
      } else if (ogGenerating) {
        ogImageHtml = `<div class="pr-twitter-link-card-image-loading"><svg class="glossi-loader-sm" viewBox="0 0 306.8 352.69"><path d="m306.8,166.33v73.65c0,8.39-6.83,15.11-15.22,15.11h-80.59c-7.05,0-13.43,1.23-17.91,3.81-4.25,2.35-6.49,5.6-6.49,10.52v68.28c0,8.28-6.72,15-15,15H14.66c-8.06,0-14.66-6.72-14.66-14.77V54.17c0-8.39,6.72-15.22,15.11-15.22h35.59c7.05,0,13.43-1.12,17.91-3.58,4.14-2.24,6.49-5.37,6.49-10.3v-9.96c0-8.39,6.83-15.11,15.11-15.11h126.26c8.39,0,15.11,6.72,15.11,15.11v15.11c0,8.39-6.72,15.11-15.11,15.11h-124.58c-5.37.11-10.75.56-14.66,2.46-1.79.89-3.13,2.13-4.14,3.69-1.01,1.68-1.79,4.03-1.79,7.72v185.58c0,2.24,1.79,3.92,3.92,3.92h95.7c5.26,0,10.3-.56,13.88-2.35,1.68-.9,2.91-2.01,3.81-3.58,1.01-1.57,1.68-3.81,1.68-7.28v-69.17c0-8.39,6.83-15.11,15.22-15.11h86.07c8.39,0,15.22,6.72,15.22,15.11Z" fill="#EC5F3F"/></svg><span>Generating preview...</span></div>`;
      } else {
        ogImageHtml = `<div class="pr-twitter-link-card-generate"><button data-action="generate-og-image"><i class="ph-light ph-image"></i> Generate Link Preview</button></div>`;
      }

      mediaHtml = `
        <div class="pr-twitter-link-input-wrap">
          <div class="pr-twitter-link-input-label">
            <i class="ph-light ph-link"></i>
            <span>Link URL</span>
          </div>
          <input type="url" class="pr-twitter-link-url-input" data-action="edit-link-url" placeholder="https://glossi.io/blog/..." value="${this.escapeHtml(linkUrl)}">
        </div>
        <div class="pr-twitter-link-input-wrap">
          <div class="pr-twitter-link-input-label">
            <i class="ph-light ph-text-aa"></i>
            <span>Link Title</span>
          </div>
          <input type="text" class="pr-twitter-link-url-input" data-action="edit-link-title" placeholder="Blog post title for the preview card" value="${this.escapeHtml(output.link_title || '')}">
        </div>
        <div class="pr-twitter-link-card">
          ${ogImageHtml}
          <div class="pr-twitter-link-card-body">
            <div class="pr-twitter-link-card-domain">${this.escapeHtml(domain || 'glossi.io')}</div>
            <div class="pr-twitter-link-card-title">${this.escapeHtml(output.link_title || domain || 'Link Preview')}</div>
            <div class="pr-twitter-link-card-desc">${this.escapeHtml(output.link_desc || 'Preview will update when URL is added')}</div>
          </div>
        </div>`;
    }

    const tweetHtml = `
      <div class="pr-twitter-tweet">
        <div class="pr-twitter-tweet-left">
          <div class="pr-twitter-avatar">
            <img src="assets/glossi-logo.svg" alt="">
          </div>
        </div>
        <div class="pr-twitter-tweet-body">
          <div class="pr-twitter-tweet-header">
            <span class="pr-twitter-name">Glossi</span>
            <span class="pr-twitter-handle">@glossimade</span>
            <span class="pr-twitter-time">${timeStr}</span>
          </div>
          <div class="pr-twitter-text">${this.escapeHtml(tweet)}</div>
          ${mediaHtml}
          <div class="pr-twitter-char-count ${isOver ? 'over' : ''}">${charCount}/280</div>
          <div class="pr-twitter-engagement">
            <span class="pr-twitter-action"><i class="ph-light ph-chat-circle"></i> </span>
            <span class="pr-twitter-action"><i class="ph-light ph-repeat"></i> </span>
            <span class="pr-twitter-action"><i class="ph-light ph-heart"></i> </span>
            <span class="pr-twitter-action"><i class="ph-light ph-chart-bar"></i> </span>
            <span class="pr-twitter-action"><i class="ph-light ph-export"></i></span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = tweetHtml || '<div style="padding: 24px; color: #71767b; text-align: center;">No content to preview</div>';

    container.querySelectorAll('[data-action="generate-visual"]').forEach(btn => {
      btn.addEventListener('click', () => this.autoGenerateVisual(output));
    });
    container.querySelectorAll('[data-action="remove-twitter-image"]').forEach(btn => {
      btn.addEventListener('click', () => {
        output.media_attachments = (output.media_attachments || []).filter(m => m.type !== 'image');
        output.visual_prompt = '';
        this.persistOutput(output);
        this.renderTwitterPreview(output);
      });
    });
    container.querySelectorAll('[data-action="submit-feedback"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = container.querySelector('[data-action="visual-feedback"]');
        const feedback = input?.value?.trim();
        if (feedback) {
          this.refineVisual(output, feedback);
        }
      });
    });
    container.querySelectorAll('[data-action="visual-feedback"]').forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const feedback = el.value.trim();
          if (feedback) {
            this.refineVisual(output, feedback);
          }
        }
      });
    });
    container.querySelectorAll('[data-action="edit-link-url"]').forEach(el => {
      let debounceTimer;
      el.addEventListener('input', () => {
        output.link_url = el.value.trim();
        this.persistOutput(output);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.renderTwitterPreview(output);
          if (output.link_url) {
            this.fetchLinkMetadata(output);
          }
        }, 500);
      });
    });
    container.querySelectorAll('[data-action="edit-link-title"]').forEach(el => {
      el.addEventListener('input', () => {
        output.link_title = el.value.trim();
        this.persistOutput(output);
      });
    });
    container.querySelectorAll('[data-action="generate-og-image"]').forEach(btn => {
      btn.addEventListener('click', () => this.generateOgImage(output));
    });
    container.querySelectorAll('[data-action="remove-og-image"]').forEach(btn => {
      btn.addEventListener('click', () => {
        output.og_image = '';
        this.persistOutput(output);
        this.renderTwitterPreview(output);
      });
    });
  }

  async autoGenerateVisual(output) {
    const tweetText = output.content || '';
    if (!tweetText.trim()) return;

    output._visualGenerating = true;
    this.renderTwitterPreview(output);

    try {
      const promptRes = await this.prAgent.apiCall('/api/pr/generate-visual-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweet_text: tweetText })
      });

      if (!promptRes.success || !promptRes.prompt) {
        output._visualGenerating = false;
        this.renderTwitterPreview(output);
        await this.prAgent.showConfirm(promptRes.error || 'Failed to generate visual prompt', 'Visual Generation Error');
        return;
      }

      output.visual_prompt = promptRes.prompt;

      const imageRes = await this.prAgent.apiCall('/api/pr/generate-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptRes.prompt })
      });

      output._visualGenerating = false;

      if (imageRes.success && imageRes.image) {
        if (!output.media_attachments) output.media_attachments = [];
        output.media_attachments = output.media_attachments.filter(m => m.type !== 'image');
        output.media_attachments.unshift({ type: 'image', url: imageRes.image });
        this.persistOutput(output);
        this.renderTwitterPreview(output);
      } else {
        this.renderTwitterPreview(output);
        await this.prAgent.showConfirm(imageRes.error || 'Image generation failed', 'Visual Generation Error');
      }
    } catch (e) {
      output._visualGenerating = false;
      this.renderTwitterPreview(output);
      await this.prAgent.showConfirm(e.message || 'Network error', 'Visual Generation Error');
    }
  }

  async refineVisual(output, feedback) {
    const tweetText = output.content || '';
    if (!tweetText.trim()) return;

    output._visualGenerating = true;
    output.media_attachments = (output.media_attachments || []).filter(m => m.type !== 'image');
    this.renderTwitterPreview(output);

    try {
      const payload = { tweet_text: tweetText, feedback: feedback };
      if (output.visual_prompt) payload.previous_prompt = output.visual_prompt;
      const promptRes = await this.prAgent.apiCall('/api/pr/generate-visual-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!promptRes.success || !promptRes.prompt) {
        output._visualGenerating = false;
        this.renderTwitterPreview(output);
        await this.prAgent.showConfirm(promptRes.error || 'Failed to refine prompt', 'Visual Refinement Error');
        return;
      }

      output.visual_prompt = promptRes.prompt;

      const imageRes = await this.prAgent.apiCall('/api/pr/generate-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptRes.prompt })
      });

      output._visualGenerating = false;

      if (imageRes.success && imageRes.image) {
        if (!output.media_attachments) output.media_attachments = [];
        output.media_attachments = output.media_attachments.filter(m => m.type !== 'image');
        output.media_attachments.unshift({ type: 'image', url: imageRes.image });
        this.persistOutput(output);
        this.renderTwitterPreview(output);
      } else {
        this.renderTwitterPreview(output);
        await this.prAgent.showConfirm(imageRes.error || 'Image generation failed', 'Visual Refinement Error');
      }
    } catch (e) {
      output._visualGenerating = false;
      this.renderTwitterPreview(output);
      await this.prAgent.showConfirm(e.message || 'Network error', 'Visual Refinement Error');
    }
  }

  async generateOgImage(output) {
    const title = output.link_title || output.title || '';
    if (!title.trim()) return;

    output._ogGenerating = true;
    this.renderTwitterPreview(output);

    try {
      const res = await this.prAgent.apiCall('/api/pr/generate-og-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });

      output._ogGenerating = false;

      if (res.success && res.image) {
        output.og_image = res.image;
        this.persistOutput(output);
        this.renderTwitterPreview(output);
      } else {
        this.renderTwitterPreview(output);
        await this.prAgent.showConfirm(res.error || 'OG image generation failed', 'Link Preview Error');
      }
    } catch (e) {
      output._ogGenerating = false;
      this.renderTwitterPreview(output);
      await this.prAgent.showConfirm(e.message || 'Network error', 'Link Preview Error');
    }
  }

  async fetchLinkMetadata(output) {
    if (!output.link_url) return;
    try {
      const res = await this.prAgent.apiCall('/api/pr/og-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: output.link_url })
      });
      if (res.success) {
        output.link_title = res.title || '';
        output.link_desc = res.description || '';
        this.persistOutput(output);
        this.renderTwitterPreview(output);
      }
    } catch {
      // Silently fail for metadata fetch
    }
  }

  // Media handling
  showMediaUrlInput(placeholder) {
    const wrap = document.getElementById('pr-distribute-media-url-input');
    const input = document.getElementById('pr-media-url-value');
    if (wrap) wrap.style.display = 'flex';
    if (input) {
      input.placeholder = placeholder;
      input.value = '';
      input.focus();
    }
  }

  hideMediaUrlInput() {
    const wrap = document.getElementById('pr-distribute-media-url-input');
    if (wrap) wrap.style.display = 'none';
    this._mediaUrlMode = null;
  }

  confirmMediaUrl() {
    const input = document.getElementById('pr-media-url-value');
    const url = input?.value?.trim();
    if (!url) return;

    if (this._mediaUrlMode === 'link') {
      this.addFirstCommentLink(url);
    } else if (this._mediaUrlMode === 'video') {
      this.addMedia({ type: 'video', url, thumbnail: this.getVideoThumbnail(url) });
    } else {
      this.addMedia({ type: 'image', url });
    }
    this.hideMediaUrlInput();
  }

  async addFirstCommentLink(url) {
    if (!this.activeReviewItem) return;

    this.activeReviewItem.first_comment = url;

    try {
      const ogRes = await this.prAgent.apiCall('/api/pr/og-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (ogRes.success && ogRes.og) {
        this.activeReviewItem.og_data = ogRes.og;
      }
    } catch (e) { /* silent */ }

    this.persistOutput(this.activeReviewItem);
    this.renderFirstComment(this.activeReviewItem);
  }

  removeFirstCommentLink() {
    if (!this.activeReviewItem) return;
    this.activeReviewItem.first_comment = null;
    this.activeReviewItem.og_data = null;
    this.persistOutput(this.activeReviewItem);
    this.renderFirstComment(this.activeReviewItem);
  }

  getVideoThumbnail(url) {
    // Extract YouTube thumbnail
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return '';
  }

  async uploadMediaFile(file) {
    if (!this.activeReviewItem) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/pr/upload-media', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        this.addMedia({ type: 'image', url: data.url, filename: data.filename });
      }
    } catch (e) { /* silent */ }
  }

  addMedia(attachment) {
    if (!this.activeReviewItem) return;
    if (!this.activeReviewItem.media_attachments) this.activeReviewItem.media_attachments = [];
    // Replace existing (LinkedIn single image/video)
    this.activeReviewItem.media_attachments = [attachment];
    this.persistOutput(this.activeReviewItem);
    this.renderLinkedInPreview(this.activeReviewItem);
    this.renderCharCount(this.activeReviewItem);
  }

  // Hashtag rendering
  renderHashtags(output) {
    const wrap = document.getElementById('pr-distribute-hashtags');
    const list = document.getElementById('pr-distribute-hashtags-list');
    if (!wrap || !list) return;

    const hashtags = output.hashtags || [];
    if (hashtags.length === 0 && output.status !== 'review') {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'flex';

    const addBtn = document.getElementById('pr-distribute-hashtag-add');
    if (addBtn) addBtn.style.display = output.status === 'review' ? '' : 'none';

    list.innerHTML = hashtags.map((h, i) => `
      <span class="pr-distribute-hashtag-pill" data-index="${i}">
        #${this.escapeHtml(h)}
        ${output.status === 'review' ? `<button class="pr-distribute-hashtag-remove" data-index="${i}" title="Remove"><i class="ph-light ph-x"></i></button>` : ''}
      </span>
    `).join('');

    // Wire up remove buttons
    list.querySelectorAll('.pr-distribute-hashtag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (!isNaN(idx) && this.activeReviewItem?.hashtags) {
          this.activeReviewItem.hashtags.splice(idx, 1);
          this.persistOutput(this.activeReviewItem);
          this.renderHashtags(this.activeReviewItem);
          if (this.activeChannel === 'twitter') {
            this.renderTwitterPreview(this.activeReviewItem);
          } else {
            this.renderLinkedInPreview(this.activeReviewItem);
          }
          this.renderCharCount(this.activeReviewItem);
        }
      });
    });
  }

  addHashtagPrompt() {
    if (!this.activeReviewItem) return;
    const tag = prompt('Enter hashtag (without #):');
    if (!tag || !tag.trim()) return;
    const cleaned = tag.trim().replace(/^#/, '').replace(/\s+/g, '');
    if (!cleaned) return;
    if (!this.activeReviewItem.hashtags) this.activeReviewItem.hashtags = [];
    this.activeReviewItem.hashtags.push(cleaned);
    this.persistOutput(this.activeReviewItem);
    this.renderHashtags(this.activeReviewItem);
    if (this.activeChannel === 'twitter') {
      this.renderTwitterPreview(this.activeReviewItem);
    } else {
      this.renderLinkedInPreview(this.activeReviewItem);
    }
    this.renderCharCount(this.activeReviewItem);
  }

  // First comment rendering
  renderFirstComment(output) {
    const wrap = document.getElementById('pr-li-first-comment-wrap');
    const container = document.getElementById('pr-li-first-comment');
    if (!wrap || !container) return;

    const comment = output.first_comment;
    if (!comment) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';

    const li = this.settings.linkedin || {};
    const name = li.name || 'Glossi';
    const photoUrl = li.photoUrl || 'assets/glossi-logo.svg';
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    const avatarHtml = photoUrl
      ? `<img src="${this.escapeHtml(photoUrl)}" alt="">`
      : `<span class="pr-li-comment-avatar-placeholder">${initials}</span>`;

    // Build link preview inside comment if OG data
    let commentLinkPreview = '';
    if (output.og_data) {
      const og = output.og_data;
      commentLinkPreview = `
        <div class="pr-li-link-preview" style="margin-top: 8px; border-radius: 6px; overflow: hidden; border: 1px solid #383838;">
          ${og.image ? `<div class="pr-li-link-preview-image"><img src="${this.escapeHtml(og.image)}" alt=""></div>` : ''}
          <div class="pr-li-link-preview-body">
            <div class="pr-li-link-preview-domain">${this.escapeHtml(og.domain || '')}</div>
            <div class="pr-li-link-preview-title">${this.escapeHtml(og.title || '')}</div>
          </div>
        </div>
      `;
    }

    const canRemove = output.status === 'review';
    const removeLinkBtn = canRemove
      ? `<button class="pr-li-comment-remove" data-action="remove-link" title="Remove link"><i class="ph-light ph-x"></i></button>`
      : '';

    container.innerHTML = `
      <div class="pr-li-comment-header">
        <div class="pr-li-comment-avatar">${avatarHtml}</div>
        <div class="pr-li-comment-name">${this.escapeHtml(name)}</div>
        ${removeLinkBtn}
      </div>
      <div class="pr-li-comment-text">${this.escapeHtml(comment)}</div>
      ${commentLinkPreview}
    `;

    container.querySelector('[data-action="remove-link"]')?.addEventListener('click', () => {
      this.removeFirstCommentLink();
    });
  }

  async persistOutput(output) {
    try {
      await this.prAgent.apiCall('/api/pr/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(output)
      });
    } catch (e) { /* silent */ }
    this.prAgent.saveOutputs();
  }

  async backToEdit() {
    if (!this.activeReviewItem) return;

    this.activeReviewItem.phase = 'edit';
    this.activeReviewItem.status = 'draft';

    try {
      await this.prAgent.apiCall('/api/pr/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.activeReviewItem)
      });
    } catch (e) { /* silent */ }

    this.prAgent.saveOutputs();
    this.activeReviewItem = null;

    // Reset preview
    const emptyState = document.getElementById('pr-distribute-empty-state');
    const previewContent = document.getElementById('pr-distribute-preview-content');
    if (emptyState) emptyState.style.display = '';
    if (previewContent) previewContent.style.display = 'none';

    this.render();

    // Switch to Create tab
    const createNav = document.querySelector('.pr-nav-item[data-stage="create"]');
    if (createNav) createNav.click();
  }

  async removeFromReview(outputId) {
    const output = this.prAgent.outputs.find(o => o.id === outputId);
    if (!output) return;
    if (output.status === 'published') return;

    output.phase = 'edit';
    output.status = 'draft';

    // Immediately remove the queue item from the DOM
    const itemEl = document.querySelector(`.pr-distribute-queue-item[data-output-id="${outputId}"]`);
    if (itemEl) itemEl.remove();

    // Show empty state if no review items remain in DOM
    const reviewList = document.getElementById('pr-distribute-review-list');
    if (reviewList && !reviewList.querySelector('.pr-distribute-queue-item')) {
      reviewList.innerHTML = '<div class="pr-distribute-queue-empty">No items in review</div>';
    }

    if (this.activeReviewItem?.id === outputId) {
      this.activeReviewItem = null;
      const emptyState = document.getElementById('pr-distribute-empty-state');
      const previewContent = document.getElementById('pr-distribute-preview-content');
      if (emptyState) emptyState.style.display = '';
      if (previewContent) previewContent.style.display = 'none';
    }

    this.render();

    try {
      await this.prAgent.apiCall('/api/pr/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(output)
      });
    } catch (e) { /* silent */ }
  }

  async checkLinkedInStatus() {
    try {
      const res = await this.prAgent.apiCall('/api/linkedin/status');
      this.linkedInConnected = res.connected || false;
      this.linkedInOrgName = res.org_name || null;
      this.updateLinkedInStatusUI(this.linkedInConnected);
    } catch (e) {
      this.linkedInConnected = false;
      this.updateLinkedInStatusUI(false);
    }
  }

  updateLinkedInStatusUI(connected) {
    const dot = document.querySelector('.pr-linkedin-status-dot');
    const text = document.querySelector('.pr-linkedin-status-text');
    const connectBtn = document.getElementById('pr-linkedin-connect-btn');
    const disconnectBtn = document.getElementById('pr-linkedin-disconnect-btn');

    if (dot) {
      dot.classList.toggle('connected', connected);
      dot.classList.toggle('disconnected', !connected);
    }
    if (text) {
      text.textContent = connected
        ? `Connected${this.linkedInOrgName ? ' to ' + this.linkedInOrgName : ''}`
        : 'Not connected';
    }
    if (connectBtn) connectBtn.style.display = connected ? 'none' : '';
    if (disconnectBtn) disconnectBtn.style.display = connected ? '' : 'none';
  }

  async checkXStatus() {
    try {
      const res = await this.prAgent.apiCall('/api/x/status');
      this.xConnected = res.connected || false;
      this.xUsername = res.username || null;
      this.updateXStatusUI(this.xConnected);
    } catch (e) {
      this.xConnected = false;
      this.updateXStatusUI(false);
    }
  }

  updateXStatusUI(connected) {
    const dot = document.querySelector('.pr-x-status-dot');
    const text = document.querySelector('.pr-x-status-text');
    if (dot) {
      dot.classList.toggle('connected', connected);
      dot.classList.toggle('disconnected', !connected);
    }
    if (text) {
      text.textContent = connected
        ? `Connected${this.xUsername ? ' as @' + this.xUsername : ''}`
        : 'Not connected';
    }
  }

  async publishNow() {
    if (!this.activeReviewItem) return;

    const channel = this.activeChannel;

    if (channel === 'twitter') {
      return this.publishToX();
    }

    if (!this.linkedInConnected) {
      const connect = await this.prAgent.showConfirm(
        'Your LinkedIn account is not connected. Would you like to connect it now?',
        'LinkedIn Not Connected'
      );
      if (connect) window.location.href = '/api/linkedin/connect';
      return;
    }

    const confirmed = await this.prAgent.showConfirm(
      'This will publish the post to your LinkedIn company page.',
      'Publish to LinkedIn'
    );
    if (!confirmed) return;

    const publishBtn = document.getElementById('pr-distribute-publish-btn');
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = glossiLoaderSVG('glossi-loader-xs') + ' Publishing...';
    }

    try {
      const result = await this.prAgent.apiCall('/api/linkedin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: this.activeReviewItem.content,
          hashtags: this.activeReviewItem.hashtags || [],
          first_comment: this.activeReviewItem.first_comment || null
        })
      });

      if (result.success) {
        this.activeReviewItem.status = 'published';
        this.activeReviewItem.phase = 'distribute';

        try {
          await this.prAgent.apiCall('/api/pr/outputs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.activeReviewItem)
          });
        } catch (e) { /* silent */ }

        this.prAgent.saveOutputs();
        this.render();
        this.selectReviewItem(this.activeReviewItem.id);
      } else {
        await this.prAgent.showConfirm(
          `Publishing failed: ${result.error || 'Unknown error'}. Please try again.`,
          'Publish Error'
        );
      }
    } catch (e) {
      await this.prAgent.showConfirm(
        `Publishing failed: ${e.message || 'Network error'}. Please try again.`,
        'Publish Error'
      );
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="ph-light ph-paper-plane-tilt"></i> Publish Now';
      }
    }
  }

  async publishToX() {
    if (!this.activeReviewItem) return;

    if (!this.xConnected) {
      await this.prAgent.showConfirm(
        'X is not connected. Add your X API credentials (X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET) to your environment variables, then restart the server.',
        'X Not Connected'
      );
      return;
    }

    const content = (this.activeReviewItem.content || '').trim();
    const threadParts = this.splitIntoThread(content);
    const isThread = threadParts.length > 1;

    const confirmMsg = isThread
      ? `This will publish a ${threadParts.length}-part thread to X.`
      : 'This will publish this tweet to X.';

    const confirmed = await this.prAgent.showConfirm(confirmMsg, 'Publish to X');
    if (!confirmed) return;

    const publishBtn = document.getElementById('pr-distribute-publish-btn');
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = glossiLoaderSVG('glossi-loader-xs') + ' Publishing...';
    }

    try {
      const tweetFormat = this.activeReviewItem.tweet_format || 'text';
      const media = tweetFormat === 'visual' ? (this.activeReviewItem.media_attachments || []) : [];
      const imageAttachment = media.find(m => m.type === 'image');
      const payload = {
        content: isThread ? threadParts[0] : content,
        thread_parts: isThread ? threadParts : null,
        media_url: imageAttachment?.url || null
      };

      const result = await this.prAgent.apiCall('/api/x/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (result.success) {
        const publishedId = this.activeReviewItem.id;

        this.activeReviewItem.status = 'published';
        this.activeReviewItem.phase = 'distribute';
        this.activeReviewItem.published_channel = 'twitter';
        this.activeReviewItem.tweet_url = result.tweet_url || null;
        this.activeReviewItem.tweet_id = result.tweet_id || null;
        this.activeReviewItem.tweet_ids = result.tweet_ids || [];
        this.activeReviewItem.published_at = new Date().toISOString();
        this.activeReviewItem.published_snapshot = {
          content: content,
          tweet_format: tweetFormat,
          media_url: imageAttachment?.url || null,
          thread_parts: isThread ? threadParts : null
        };

        const kept = this.activeReviewItem;
        this.prAgent.outputs = this.prAgent.outputs.filter(o => o.id !== publishedId);
        this.prAgent.outputs.push(kept);

        try {
          await this.prAgent.apiCall('/api/pr/outputs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(kept)
          });
        } catch (e) { /* silent */ }

        this.prAgent.saveOutputs();
        this.render();
        this.selectReviewItem(publishedId);
      } else {
        await this.prAgent.showConfirm(
          `Publishing failed: ${result.error || 'Unknown error'}. Please try again.`,
          'Publish Error'
        );
      }
    } catch (e) {
      await this.prAgent.showConfirm(
        `Publishing failed: ${e.message || 'Network error'}. Please try again.`,
        'Publish Error'
      );
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="ph-light ph-paper-plane-tilt"></i> Publish Now';
      }
    }
  }

  splitIntoThread(text) {
    const parts = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return [text];
    const merged = [];
    let current = '';
    for (const part of parts) {
      const candidate = current ? current + '\n\n' + part : part;
      if (candidate.length <= 280) {
        current = candidate;
      } else {
        if (current) merged.push(current);
        current = part;
      }
    }
    if (current) merged.push(current);
    return merged.length > 0 ? merged : [text];
  }

  renderTwitterPublishedState(output) {
    const container = document.getElementById('pr-twitter-preview');
    if (!container) return;

    const formatBar = document.getElementById('pr-twitter-format-bar');
    if (formatBar) formatBar.style.display = 'none';

    const snapshot = output.published_snapshot || {};
    const content = snapshot.content || output.content || '';
    const mediaUrl = snapshot.media_url || null;
    const publishedAt = output.published_at ? new Date(output.published_at) : null;
    const dateStr = publishedAt
      ? publishedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' at ' + publishedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
    const tweetUrl = output.tweet_url || '';

    let mediaHtml = '';
    if (mediaUrl) {
      mediaHtml = `<div class="pr-x-published-image"><img src="${this.escapeHtml(mediaUrl)}" alt=""></div>`;
    }

    container.innerHTML = `
      <div class="pr-x-published-state">
        <div class="pr-x-published-header">
          <i class="ph-light ph-check-circle"></i>
          <span>Published to X</span>
        </div>
        <div class="pr-x-published-meta">${this.escapeHtml(dateStr)}</div>
        <div class="pr-x-published-content">${this.escapeHtml(content)}</div>
        ${mediaHtml}
        <div class="pr-x-published-actions">
          ${tweetUrl ? `<a href="${this.escapeHtml(tweetUrl)}" target="_blank" rel="noopener" class="pr-x-published-view-btn"><i class="ph-light ph-arrow-square-out"></i> View on X</a>` : ''}
        </div>
      </div>
    `;
  }

  openScheduleModal() {
    if (!this.activeReviewItem) return;

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('pr-schedule-date');
    if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];

    const modal = document.getElementById('pr-schedule-modal');
    modal?.classList.add('visible');
  }

  async confirmSchedule() {
    if (!this.activeReviewItem) return;

    const dateVal = document.getElementById('pr-schedule-date')?.value;
    const timeVal = document.getElementById('pr-schedule-time')?.value || '09:00';

    if (!dateVal) return;

    const scheduledAt = new Date(`${dateVal}T${timeVal}`);
    if (isNaN(scheduledAt.getTime())) return;

    // Create scheduled post record
    const scheduleId = 'sched_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    try {
      await this.prAgent.apiCall('/api/pr/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduleId,
          output_id: this.activeReviewItem.id,
          channel: this.activeChannel || 'linkedin',
          scheduled_at: scheduledAt.toISOString()
        })
      });
    } catch (e) { /* silent */ }

    // Update output status
    this.activeReviewItem.status = 'scheduled';
    this.activeReviewItem.phase = 'distribute';

    try {
      await this.prAgent.apiCall('/api/pr/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.activeReviewItem)
      });
    } catch (e) { /* silent */ }

    this.prAgent.saveOutputs();

    // Close modal
    document.getElementById('pr-schedule-modal')?.classList.remove('visible');

    // Reload scheduled posts
    await this.loadScheduledPosts();
    this.render();
    this.selectReviewItem(this.activeReviewItem.id);
  }

  // Render the full review queue
  render() {
    this.renderQueueSection('review');
    this.renderQueueSection('scheduled');
    this.renderQueueSection('published');

    // Update published count
    const publishedCount = this.prAgent.outputs.filter(o => o.status === 'published').length;
    const countBadge = document.getElementById('pr-distribute-published-count');
    if (countBadge) countBadge.textContent = publishedCount;
  }

  renderQueueSection(status) {
    const listId = {
      review: 'pr-distribute-review-list',
      scheduled: 'pr-distribute-scheduled-list',
      published: 'pr-distribute-published-list'
    }[status];

    const container = document.getElementById(listId);
    if (!container) return;

    const items = this.prAgent.outputs.filter(o => o.status === status);

    if (items.length === 0) {
      const emptyMsg = {
        review: 'No items in review',
        scheduled: 'No scheduled posts',
        published: 'No published posts'
      }[status];
      container.innerHTML = `<div class="pr-distribute-queue-empty">${emptyMsg}</div>`;
      return;
    }

    container.innerHTML = items.map(output => {
      const typeLabel = CONTENT_TYPES.find(t => t.id === output.content_type)?.label || output.content_type;
      const title = output.news_headline || output.title || 'Untitled';
      const isActive = this.activeReviewItem?.id === output.id;

      const iconMap = {
        tweet: 'ph-x-logo',
        linkedin_post: 'ph-linkedin-logo',
        blog_post: 'ph-article',
        email_blast: 'ph-envelope',
        product_announcement: 'ph-megaphone',
        talking_points: 'ph-list-bullets',
        investor_snippet: 'ph-chart-line-up',
        custom: 'ph-file-text',
        media_pitch: 'ph-envelope',
        press_release: 'ph-article',
        founder_quote: 'ph-article',
        op_ed: 'ph-article',
        briefing_doc: 'ph-list-bullets'
      };
      const iconClass = iconMap[output.content_type] || 'ph-file-text';

      let metaText = '';
      if (status === 'scheduled') {
        const scheduled = this.scheduledPosts.find(p => p.output_id === output.id);
        if (scheduled) {
          const d = new Date(scheduled.scheduled_at);
          metaText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' +
                     d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
      } else if (output.created_at || output.createdAt) {
        const d = new Date(output.created_at || output.createdAt);
        metaText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      const removeBtn = status === 'review'
        ? `<button class="pr-distribute-queue-remove" data-remove-id="${this.escapeHtml(output.id)}" title="Remove from review"><i class="ph-light ph-x"></i></button>`
        : '';

      const isXPub = output.published_channel === 'twitter' && status === 'published';
      const publishedBadge = isXPub ? '<span class="pr-distribute-queue-item-badge">Posted to X</span>' : '';

      return `
        <div class="pr-distribute-queue-item ${isActive ? 'active' : ''}" data-output-id="${this.escapeHtml(output.id)}">
          <div class="pr-distribute-queue-item-icon">
            <i class="ph-light ${iconClass}"></i>
          </div>
          <div class="pr-distribute-queue-item-body">
            <div class="pr-distribute-queue-item-title" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</div>
            <div class="pr-distribute-queue-item-meta">
              <span class="pr-distribute-queue-item-type">${this.escapeHtml(typeLabel)}</span>
              ${publishedBadge}
              ${metaText ? `<span>${metaText}</span>` : ''}
            </div>
          </div>
          ${removeBtn}
        </div>
      `;
    }).join('');
  }

  generateSlug(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);
  }

  downloadBlogMarkdown() {
    if (!this.activeReviewItem) return;

    const output = this.activeReviewItem;
    const title = output.title || output.news_headline || 'Untitled Post';
    const content = output.content || '';
    const createdAt = output.created_at ? new Date(output.created_at) : new Date();
    const dateStr = createdAt.toISOString().split('T')[0];
    const media = output.media_attachments || [];
    const featuredImage = media.length > 0 && media[0].type === 'image' ? media[0].url : '';

    const slugInput = document.getElementById('pr-blog-slug-input');
    const slug = slugInput?.value?.trim() || this.generateSlug(title);

    const subtitleMatch = content.match(/^([^\n#].{20,})/);
    const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';

    const ogImage = output.og_image || '';

    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      subtitle ? `subtitle: "${subtitle.replace(/"/g, '\\"')}"` : null,
      `slug: "${slug}"`,
      `date: "${dateStr}"`,
      `author: "Glossi"`,
      featuredImage ? `featured_image: "${featuredImage}"` : null,
      ogImage ? `og_image: "${ogImage.startsWith('data:') ? 'og-' + slug + '.png' : ogImage}"` : null,
      `meta_description: "${(subtitle || title).replace(/"/g, '\\"').substring(0, 160)}"`,
      '---'
    ].filter(Boolean).join('\n');

    const markdown = frontmatter + '\n\n' + content;

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export { PRAgent, CONTENT_TYPES, WizardManager, MediaManager, NewsMonitor, CalendarManager, AngleManager, DistributeManager };
