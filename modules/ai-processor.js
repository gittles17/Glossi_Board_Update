/**
 * AI Processor Module
 * Handles Claude Opus API interactions for content analysis and meeting summarization
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

class AIProcessor {
  constructor() {
    this.apiKey = null;
  }

  /**
   * Set the API key
   */
  setApiKey(key) {
    this.apiKey = key && key.length > 0 ? key : null;
  }

  /**
   * Check if API is configured
   */
  isConfigured() {
    return this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Make a request to Claude Opus API
   */
  async callClaude(systemPrompt, userMessage, conversationHistory = []) {
    if (!this.isConfigured()) {
      throw new Error('API key not configured. Please add your Anthropic API key in Settings.');
    }

    try {
      const messages = [
        ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ];

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
          system: systemPrompt,
          messages
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process meeting notes and extract structured information
   */
  async processMeetingNotes(notes, meetingTitle, meetingDate) {
    const systemPrompt = `You are an assistant that processes meeting notes for a startup board. 
Your task is to analyze the meeting notes and extract structured information.

The company is Glossi - an AI-powered product visualization platform for enterprise brands.

Pipeline stages (in order of progression):
- discovery: Initial conversations, learning about their needs
- demo: Product demonstration scheduled or completed
- validation: Testing/evaluating the solution
- pilot: Paid pilot or trial in progress
- closed: Deal closed/won

You must respond with ONLY valid JSON in this exact format:
{
  "summary": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "todos": [
    {"text": "action item description", "owner": "person name or team"},
    {"text": "another action item", "owner": "person name"}
  ],
  "decisions": ["decision 1", "decision 2"],
  "pipelineUpdates": [
    {
      "company": "Company Name",
      "update": "what changed (e.g., 'moved to demo stage', 'increased deal size')",
      "previousStage": "discovery",
      "newStage": "demo",
      "newValue": "$50K",
      "isNewClient": false
    }
  ],
  "talkingPointSuggestions": [
    {"title": "Short Title", "content": "The key message"}
  ]
}

Guidelines:
- Summary should be 3-5 concise bullet points capturing the most important items
- Todos are ACTION ITEMS - tasks that need to be done in the future (e.g., "Follow up with MagnaFlow", "Schedule demo with prospect")
- Decisions are CHOICES THAT WERE MADE - strategic determinations, not future tasks. Examples:
  - "Decided to focus on enterprise clients over SMB"
  - "Agreed to delay launch until Q2"
  - "Chose to prioritize MagnaFlow deal over others"
  - "Set pricing at $50K minimum for pilots"
  - NOT a decision: "Need to follow up" (that's a todo)
  - NOT a decision: "Will schedule meeting" (that's a todo)
- Pipeline updates: Carefully identify any stage changes for existing clients or new clients added
  - Set previousStage to the stage before the change (null if new client)
  - Set newStage to the current/new stage
  - Set isNewClient to true if this is a brand new prospect
- Talking point suggestions are compelling narratives for investor pitches
- If a category has no relevant content, use an empty array []
- Keep all text concise and professional`;

    const userMessage = `Meeting Title: ${meetingTitle}
Date: ${meetingDate}

Meeting Notes:
${notes}

Please analyze these notes and extract the structured information as JSON.`;

    try {
      const response = await this.callClaude(systemPrompt, userMessage);
      
      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Failed to process meeting notes:', error);
      throw error;
    }
  }

  /**
   * Analyze dropped content and suggest cheat sheet updates
   */
  async analyzeContent(content, contentType) {
    const systemPrompt = `You are an assistant that analyzes content for a startup investor pitch cheat sheet.
The startup is Glossi - an AI-powered product visualization platform for enterprise brands.

Your task is to identify any relevant information that should be added or updated in the investor cheat sheet.

Respond with ONLY valid JSON in this format:
{
  "contentSummary": "Brief description of what this content contains",
  "relevance": "high" | "medium" | "low",
  "suggestedUpdates": [
    {
      "section": "pipeline" | "stats" | "talkingPoints" | "moat",
      "type": "add" | "update",
      "description": "What should be changed",
      "currentValue": "current value if updating",
      "newValue": "the new value or content",
      "reason": "Why this update is valuable"
    }
  ],
  "noUpdatesReason": "If no updates suggested, explain why"
}

Focus on:
- Pipeline/deal updates (new prospects, stage changes, deal values)
- Traction metrics (revenue, customers, usage stats)
- New talking points for investor conversations
- Competitive intelligence
- Customer testimonials or feedback
- Technical milestones`;

    const userMessage = `Content Type: ${contentType}

Content:
${content}

Please analyze this content and suggest any relevant updates to the investor cheat sheet.`;

    try {
      const response = await this.callClaude(systemPrompt, userMessage);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Failed to analyze content:', error);
      throw error;
    }
  }

  /**
   * Generate a weekly summary from multiple meetings
   */
  async generateWeeklySummary(meetings) {
    const systemPrompt = `You are an assistant creating a weekly summary for a startup board.
Synthesize the meeting information into a cohesive weekly overview.

Respond with ONLY valid JSON:
{
  "weekSummary": "2-3 sentence overview of the week",
  "keyWins": ["win 1", "win 2"],
  "challenges": ["challenge 1"],
  "openTodos": ["consolidated list of incomplete todos"],
  "nextWeekFocus": ["priority 1", "priority 2"]
}`;

    const meetingSummaries = meetings.map(m => 
      `Meeting: ${m.title} (${m.date})\nSummary: ${m.summary?.join(', ')}\nTodos: ${m.todos?.map(t => t.text).join(', ')}`
    ).join('\n\n');

    const userMessage = `Please create a weekly summary from these meetings:\n\n${meetingSummaries}`;

    try {
      const response = await this.callClaude(systemPrompt, userMessage);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Failed to generate weekly summary:', error);
      throw error;
    }
  }

  /**
   * Process weekly pipeline update text and extract stage changes
   */
  async processPipelineUpdate(updateText, currentClients) {
    const clientList = currentClients.map(c => `- ${c.name}: ${c.stage} (${c.value})`).join('\n');

    const systemPrompt = `You are an assistant that processes pipeline updates for a startup sales team.
Your task is to identify all client stage changes from the update text.

The company is Glossi - an AI-powered product visualization platform for enterprise brands.

Pipeline stages (in order of progression):
1. discovery - Initial conversations, learning about their needs
2. demo - Product demonstration scheduled or completed
3. validation - Testing/evaluating the solution
4. pilot - Paid pilot or trial in progress
5. closed - Deal closed/won

Current pipeline clients:
${clientList}

You must respond with ONLY valid JSON in this exact format:
{
  "pipelineChanges": [
    {
      "company": "Company Name",
      "previousStage": "discovery",
      "newStage": "demo",
      "value": "$50K",
      "isNewClient": false,
      "notes": "Brief note about the change"
    }
  ],
  "newClients": [
    {
      "company": "New Company Name",
      "stage": "discovery",
      "value": "$50K",
      "source": "How they found us or were introduced"
    }
  ],
  "lostClients": [
    {
      "company": "Lost Company",
      "reason": "Why they dropped out"
    }
  ],
  "summary": "Brief 1-2 sentence summary of overall pipeline movement"
}

Guidelines:
- Match company names to existing clients when possible (case-insensitive)
- Identify stage changes even if subtly mentioned
- Look for keywords like: moved, advanced, scheduled demo, started pilot, closed, won, lost, dropped
- If a client moved multiple stages, show the final stage
- Value should be in $XXK format
- If no changes detected in a category, use an empty array []`;

    const userMessage = `Weekly Pipeline Update:

${updateText}

Please analyze this update and identify all pipeline changes.`;

    try {
      const response = await this.callClaude(systemPrompt, userMessage);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Failed to process pipeline update:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.callClaude(
        'You are a helpful assistant.',
        'Please respond with the word "connected" to confirm the API is working.'
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * General chat method for Notebook
   */
  async chat(systemPrompt, userMessage, conversationHistory = []) {
    return await this.callClaude(systemPrompt, userMessage, conversationHistory);
  }

  /**
   * Send a simple message (alias for backward compatibility)
   */
  async sendMessage(message) {
    return await this.callClaude(
      'You are a helpful assistant for Glossi, a startup building AI-powered product visualization tools.',
      message
    );
  }

  /**
   * Analyze an image using Claude's vision capabilities
   */
  async analyzeImage(imageDataUrl, fileName) {
    if (!this.isConfigured()) {
      throw new Error('API key not configured');
    }

    // Extract base64 data and media type from data URL
    const matches = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image data URL');
    }

    const mediaType = matches[1];
    const base64Data = matches[2];

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
          max_tokens: 2048,
          messages: [
            {
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
                  text: `Analyze this image (${fileName}). Provide:
1. A brief description of what the image shows
2. Any text visible in the image
3. Key insights or data points
4. How this might be relevant for investor communications

Be concise but comprehensive.`
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      console.error('Image analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyze an image with a custom prompt using Claude's vision capabilities
   */
  async analyzeImageWithVision(base64Data, mediaType, prompt) {
    if (!this.isConfigured()) {
      throw new Error('API key not configured');
    }

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
          max_tokens: 4096,
          messages: [
            {
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
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      console.error('Image vision analysis error:', error);
      throw error;
    }
  }
}

// Export class and singleton instance
export { AIProcessor };
export const aiProcessor = new AIProcessor();
export default aiProcessor;
