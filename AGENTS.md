# AGENTS.md

## Project Overview

TabTab is an extension-first AI text autocomplete project. The Chrome extension provides inline ghost text suggestions, and a local Next.js API route powers completion generation.

## Tech Stack

- Next.js 14 (App Router)
- React 18 with TypeScript
- Groq SDK with Meta Llama 3.1 8B Instant for suggestions

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
└── api/suggest/route.ts          # POST endpoint for Groq completions

extension/
├── manifest.json                 # Chrome MV3 manifest
├── background/service-worker.js  # API calls, state management, Supabase sync
├── content/content.js            # Input detection and inline suggestions
├── popup/popup.js                # Extension controls
└── lib/supabase.js               # Cloud preference sync
```

## Key Implementation Details

### Suggestion Flow
1. User types in a supported editor on a supported site
2. Content script debounces input (300ms), extracts app context, and reads custom tone
3. Service worker calls `POST /api/suggest` with text, context, app, tone, and suggestion length
4. Groq returns completion and extension renders it as inline gray text
5. Tab accepts suggestion, Escape dismisses, typing clears

### API Configuration
- Provider: Groq
- Model: `llama-3.1-8b-instant`
- Max tokens: 25 (Concise) or 50 (Longer)
- Minimum input: 5 characters
- API accepts: `text`, `context` (array), `app` (platform), `customTone`, `suggestionLength`

### Suggestion Length
The extension popup allows users to choose between two suggestion lengths:
- **Concise** (default): Very brief completions (5-15 words, 25 tokens)
- **Longer**: Fuller completions (1-2 sentences, 50 tokens)

## Code Style

- TypeScript strict mode
- Plain JavaScript for extension runtime files

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
│   ├── content.js             # Text field detection, inline grey text suggestions
│   ├── styles.css             # Inline suggestion styling
│   ├── discord-extractor.js   # Discord context extraction
│   ├── linkedin-extractor.js  # LinkedIn context extraction
│   ├── slack-extractor.js     # Slack context extraction
│   └── twitter-extractor.js   # Twitter/X context extraction
├── lib/
│   └── supabase.js            # Supabase client for cloud sync
├── popup/
│   ├── popup.html/js/css      # Toggle UI, app context, tone settings
├── icons/                     # Extension icons (16/48/128px)
└── README.md                  # User-facing extension documentation
```

### How It Works
1. Content script detects `<textarea>`, `<input>`, and `contenteditable` elements
2. `isSupportedInlineSite(el)` gates suggestions to supported sites only (LinkedIn DM for now)
3. Site-specific extractors detect Discord/LinkedIn/Slack/Twitter and extract conversation context
4. On typing (300ms debounce), sends text + context to local API via service worker
5. Displays suggestion as inline grey text (Gmail-style) at cursor position
6. Tab accepts suggestion, Escape dismisses, typing clears

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
