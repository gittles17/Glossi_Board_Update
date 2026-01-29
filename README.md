# Glossi Board Dashboard

A dynamic dashboard for board members pitching Glossi to seed investors. Features AI-powered content analysis, meeting minutes with checkable to-dos, and drag-and-drop updates.

## Quick Start

1. **Open the Dashboard**: Open `index.html` in your browser
2. **Configure API Key**: Click Settings (gear icon) and add your Anthropic API key
3. **Add Meeting Notes**: Click "Add Meeting Notes" and paste your notes - Claude Opus will generate a summary and extract action items
4. **Drag and Drop**: Open Settings and drag images, PDFs, or text files onto the drop zone to analyze content and suggest cheat sheet updates

## File Structure

```
Glossi_Invest_CheatSheet/
├── index.html          # Main dashboard (start here)
├── dashboard.css       # Dashboard styles (Auris design system)
├── app.js              # Main application logic
├── modules/
│   ├── storage.js      # Data persistence (localStorage)
│   ├── ai-processor.js # Claude Opus API integration
│   └── meetings.js     # Meeting minutes manager
├── Asset 3.svg         # Glossi logo
├── data.json           # Raw cheat sheet data
├── settings.json       # API key and preferences
└── README.md           # This file
```

## Key Features

### 1. AI-Powered Meeting Minutes

1. Click "Add Meeting Notes" button
2. Paste your raw meeting notes
3. Claude Opus analyzes and extracts:
   - Executive summary (3-5 bullets)
   - Action items with owners (checkable)
   - Key decisions made
   - Pipeline updates detected
   - Suggested talking points
4. Review the AI suggestions before accepting

### 2. Drag-and-Drop Content Updates

Click the "Drop Zone" button (bottom right) or drag files directly:

- **PDFs**: Text is extracted and analyzed for relevant updates
- **Text files**: Analyzed for pipeline, traction, or talking point updates
- **Images**: Stored for reference (describe for best results)

All suggested changes are shown in a review modal - nothing updates until you approve.

### 3. Weekly Meeting Archive

- Latest meeting always visible on dashboard
- Dropdown to browse past meetings by date
- Checkable to-dos persist across sessions
- Progress indicator shows completion status

### 4. Export Weekly Recap

Click "Export Recap" to generate a PDF with:
- Key metrics with week-over-week trends
- Last week at a glance (meeting summary + action items)
- Pipeline highlights (top 3 deals)
- Key talking points

## How to Update Content

### Method 1: Drag and Drop (Recommended)

1. Open the dashboard
2. Drag any file (PDF, TXT, MD) onto the drop zone
3. Claude Opus analyzes the content
4. Review and approve suggested changes

### Method 2: Meeting Notes

1. Click "Add Meeting Notes"
2. Paste notes from your weekly sync
3. Claude extracts action items and updates
4. Checkmark items as you complete them

### Method 3: Edit data.json Directly

For precise control, edit `data.json`:

```json
{
  "pipeline": {
    "closestToClose": [
      { "name": "Company", "value": "$50K", "stage": "pilot", "timing": "Q1" }
    ]
  }
}
```

## Sections Included

1. **Hero** - Company tagline and demo link
2. **Timeline** - Where Glossi is in its journey
3. **Problem** - Why current AI tools fail for brands
4. **Solution** - How Glossi is different (3D as source of truth)
5. **Traction** - Full pipeline breakdown ($1.2M+)
6. **Defensibility** - The moat (3D integration, relationships, trust)
7. **Technical Barrier** - Stanford student test
8. **Key Stats** - Quick numbers at a glance
9. **Talking Points** - Board member quick reference

## Design System

Styled with the Auris Visual Design System:
- Dark background (#0a0d12)
- Inter font for UI, JetBrains Mono for data
- Accent colors: Green (success), Blue (info), Purple (premium), Orange (warning)
- Clean borders and subtle shadows

## Printing

The cheat sheet is print-optimized. Each major section starts on a new page. Use browser print (Cmd+P / Ctrl+P) to generate a PDF.

## For Board Members

### Before Investor Meetings

1. Review the Talking Points section (quick reference)
2. Know the Pipeline numbers cold ($1.2M+, 10+ prospects)
3. Understand the moat (3D, relationships, trust)
4. Watch the 2-min demo if you haven't recently

### Key Messages to Land

1. **Problem is real** - AI tools rebuild products, materials drift
2. **Our approach works** - 3D as source of truth, product never generated
3. **We have traction** - $1.2M+ pipeline in 3 months
4. **Moat is deep** - Technical + relationship + trust barriers
5. **Why now** - 2 years R&D complete, sales motion just started

### Objection Handling

**"Can't AI tools like Midjourney do this?"**
> "They rebuild the product every time. Materials drift, proportions shift. Enterprise brands can't accept that variability. We treat 3D as the source of truth - the product is composited in, never generated."

**"What's stopping Stanford students from copying this?"**
> "They could build a demo. They can't build enterprise trust, 3D pipeline integrations, relationships with procurement teams, or the track record that satisfies brand risk committees."

**"Why haven't bigger players done this?"**
> "The intersection of real-time 3D engines, AI systems, and enterprise production workflows is narrow and deep. We've spent 2 years building this with Crate & Barrel, HOKA, and other major brands. That's the moat."

---

*Last updated: January 2026*
