# AGENTS.md

## Project Overview

TabTab is a GitHub Copilot-style text autocomplete web app. It shows inline ghost text suggestions as users type and accepts them with Tab.

## Tech Stack

- Next.js 14 (App Router)
- React 18 with TypeScript
- Tailwind CSS
- Groq API with Llama 3.1 8B for suggestions

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
```

## Environment Setup

Requires `.env.local` with:
```
GROQ_API_KEY=your_key_here
```

## Architecture

```
app/
├── api/suggest/route.ts       # POST endpoint for Groq completions
├── components/
│   └── AutocompleteTextarea.tsx  # Dual-layer ghost text component
├── hooks/
│   └── useAutocomplete.ts     # Debouncing, state, request management
└── page.tsx                   # Main page
```

## Key Implementation Details

### Ghost Text Overlay
Uses dual-layer technique: transparent textarea over a mirror div that renders suggestions in gray at the cursor position.

### Cursor Position Tracking
- Tracks cursor position via `onSelect` and `onClick` events
- Suggestions only appear when cursor is at end of text (avoids ghost text overlap)
- Accepting inserts at cursor position using `setSelectionRange`

### Suggestion Flow
1. User types → 150ms debounce → POST to `/api/suggest` with text before cursor
2. Groq returns completion → displayed as ghost text at cursor
3. Tab accepts (inserts at cursor), Escape dismisses, typing clears

### API Configuration
- Model: `llama-3.1-8b-instant`
- Max tokens: 25 (Concise) or 50 (Longer)
- Minimum input: 5 characters

### Suggestion Length
Users can choose between two suggestion lengths via the extension popup:
- **Concise** (default): Very brief completions (5-15 words, 25 tokens)
- **Longer**: Fuller completions (1-2 sentences, 50 tokens)

## Code Style

- Functional React components with hooks
- TypeScript strict mode
- Tailwind for styling
- Client components marked with `'use client'`

## Chrome Extension

The `extension/` folder contains a Chrome extension (Manifest V3) that provides TabTab autocomplete for any text field on any website.

### Extension Structure
```
extension/
├── manifest.json              # Chrome MV3 manifest
├── config.js                  # Supabase configuration
├── background/
│   └── service-worker.js      # API calls, Supabase sync
├── content/
│   ├── content.js             # Text field detection, popup suggestions
│   ├── styles.css             # Popup styling overrides
│   ├── discord-extractor.js   # Discord context extraction
│   ├── linkedin-extractor.js  # LinkedIn context extraction
│   ├── slack-extractor.js     # Slack context extraction
│   └── twitter-extractor.js   # Twitter/X context extraction
├── lib/
│   └── supabase.js            # Supabase client for cloud sync
├── popup/
│   ├── popup.html/js/css      # Toggle UI, app context, tone settings
└── icons/                     # Extension icons (16/48/128px)
```

### How It Works
1. Content script detects `<textarea>`, `<input>`, and `contenteditable` elements
2. Site-specific extractors detect Discord/LinkedIn/Slack/Twitter and extract conversation context
3. On typing (150ms debounce), sends text + context to hosted API via service worker
4. Displays suggestion in a popup above the input field
5. Tab accepts suggestion, Escape dismisses

### App-Specific Context
The extension extracts recent messages/tweets for context-aware suggestions:
- **Discord**: Recent channel messages
- **LinkedIn**: Conversation messages
- **Slack**: Channel messages
- **Twitter/X**: Tweet thread for replies

### Custom Tones
Users can set per-app custom tones (e.g., "Professional" for LinkedIn, "Casual" for Discord) via the popup UI.

### Cloud Sync
Preferences (enabled state, custom tones, suggestion length) sync to Supabase with anonymous authentication.

### Loading the Extension
1. Run `npm run dev` to start the API server
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `extension/` folder

See `extension/AGENTS.md` for detailed extension documentation.
