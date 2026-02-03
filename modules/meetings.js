/**
 * Meetings Module
 * Handles meeting notes, todos, and archive functionality
 */

class MeetingsManager {
  constructor() {
    this.currentMeeting = null;
    this.storage = null;
    this.onUpdate = null;
  }

  /**
   * Initialize with storage reference
   */
  init(storage, onUpdate) {
    this.storage = storage;
    this.onUpdate = onUpdate;
  }

  /**
   * Get the current/latest meeting
   */
  getCurrentMeeting() {
    if (this.currentMeeting) {
      return this.currentMeeting;
    }
    return this.storage.getLatestMeeting();
  }

  /**
   * Set current meeting by ID
   */
  setCurrentMeeting(meetingId) {
    this.currentMeeting = this.storage.getMeetingById(meetingId);
    return this.currentMeeting;
  }

  /**
   * Get all meetings for archive
   */
  getAllMeetings() {
    return this.storage.getMeetings();
  }

  /**
   * Create a new meeting from processed AI data
   */
  createMeeting(title, date, rawNotes, aiProcessedData) {
    
    const meeting = {
      id: `meeting-${Date.now()}`,
      title: title,
      date: date,
      rawNotes: rawNotes,
      summary: aiProcessedData.summary || [],
      todos: (aiProcessedData.todos || []).map((todo, index) => ({
        id: `todo-${Date.now()}-${index}`,
        text: todo.text,
        owner: todo.owner || 'Unassigned',
        completed: false
      })),
      decisions: aiProcessedData.decisions || [],
      pipelineUpdates: aiProcessedData.pipelineUpdates || [],
      talkingPointSuggestions: aiProcessedData.talkingPointSuggestions || [],
      createdAt: new Date().toISOString()
    };

    
    const savedMeeting = this.storage.saveMeeting(meeting);
    
    this.currentMeeting = meeting;
    
    if (this.onUpdate) {
      this.onUpdate(meeting);
    }

    return meeting;
  }

  /**
   * Toggle a todo item
   */
  toggleTodo(meetingId, todoId) {
    const meeting = this.storage.getMeetingById(meetingId);
    if (!meeting) return null;

    const todo = meeting.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      this.storage.saveMeeting(meeting);
      
      if (this.onUpdate) {
        this.onUpdate(meeting);
      }
    }

    return meeting;
  }

  /**
   * Get todo completion progress
   */
  getTodoProgress(meeting) {
    if (!meeting || !meeting.todos || meeting.todos.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = meeting.todos.filter(t => t.completed).length;
    const total = meeting.todos.length;
    const percentage = Math.round((completed / total) * 100);

    return { completed, total, percentage };
  }

  /**
   * Format meeting date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Get meetings by date range
   */
  getMeetingsByDateRange(startDate, endDate) {
    const meetings = this.storage.getMeetings();
    return meetings.filter(m => {
      const date = new Date(m.date);
      return date >= startDate && date <= endDate;
    });
  }

  /**
   * Get meetings from current week
   */
  getCurrentWeekMeetings() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return this.getMeetingsByDateRange(startOfWeek, endOfWeek);
  }

  /**
   * Get a meeting by ID
   */
  getMeeting(meetingId) {
    return this.storage.getMeetingById(meetingId);
  }

  /**
   * Update a meeting
   */
  updateMeeting(meeting) {
    this.storage.saveMeeting(meeting);
    
    // Update current meeting if it's the one being edited
    if (this.currentMeeting?.id === meeting.id) {
      this.currentMeeting = meeting;
    }
    
    return meeting;
  }

  /**
   * Delete a meeting
   */
  deleteMeeting(meetingId) {
    const meetings = this.storage.getMeetings();
    const index = meetings.findIndex(m => m.id === meetingId);
    
    if (index !== -1) {
      meetings.splice(index, 1);
      this.storage.meetings = meetings;
      this.storage.scheduleSave();
      
      if (this.currentMeeting?.id === meetingId) {
        this.currentMeeting = null;
      }
    }
  }

  /**
   * Export meeting as markdown
   */
  exportMeetingAsMarkdown(meeting) {
    let md = `# ${meeting.title}\n`;
    md += `**Date:** ${this.formatDate(meeting.date)}\n\n`;

    if (meeting.summary?.length > 0) {
      md += `## Summary\n`;
      meeting.summary.forEach(item => {
        md += `- ${item}\n`;
      });
      md += '\n';
    }

    if (meeting.todos?.length > 0) {
      md += `## Action Items\n`;
      meeting.todos.forEach(todo => {
        const checkbox = todo.completed ? '[x]' : '[ ]';
        md += `- ${checkbox} ${todo.text} (${todo.owner})\n`;
      });
      md += '\n';
    }

    if (meeting.decisions?.length > 0) {
      md += `## Key Decisions\n`;
      meeting.decisions.forEach(decision => {
        md += `- ${decision}\n`;
      });
      md += '\n';
    }

    if (meeting.rawNotes) {
      md += `## Raw Notes\n`;
      md += meeting.rawNotes;
    }

    return md;
  }
}

// Export singleton instance
export const meetingsManager = new MeetingsManager();
export default meetingsManager;
