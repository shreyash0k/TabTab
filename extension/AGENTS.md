# Extension AGENTS.md

## Overview

Chrome extension (Manifest V3) that provides AI-powered text autocomplete for any text input on any website. Shows suggestions in a popup above the input field. Includes app-specific context extraction for Discord, LinkedIn, Slack, and Twitter/X.

## Architecture

```
extension/
├── manifest.json              # Chrome MV3 configuration
├── config.js                  # Supabase URL and anon key
├── background/
│   └── service-worker.js      # API calls, state management, Supabase sync
├── content/
│   ├── content.js             # Main logic: detection, popup, keyboard handling
│   ├── styles.css             # Style overrides for popup
│   ├── discord-extractor.js   # Discord message context extraction
│   ├── linkedin-extractor.js  # LinkedIn message context extraction
│   ├── slack-extractor.js     # Slack message context extraction
│   └── twitter-extractor.js   # Twitter/X tweet context extraction
├── lib/
│   └── supabase.js            # Supabase client (anonymous auth, preference sync)
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Toggle, app context, tone editing, cloud sync
│   └── popup.css              # Popup styling
├── icons/                     # Extension icons (16/48/128px PNG)
├── generate-icons.js          # Script to regenerate icons
└── README.md                  # User-facing documentation
```

## Key Components

### manifest.json
- Manifest V3 format (required for Chrome Web Store)
- Permissions: `storage`, `activeTab`, `tabs`
- Host permissions: `http://localhost:3000/*`, Supabase URL
- Content scripts: Extractors loaded before main content.js

### config.js
```javascript
const SUPABASE_URL = 'https://...';
const SUPABASE_ANON_KEY = '...';
```
Supabase configuration for cloud sync.

### background/service-worker.js
- Imports `config.js` and `lib/supabase.js` via `importScripts`
- Makes API calls to `/api/suggest` endpoint with text, context, app, customTone, and suggestionLength
- Reads `suggestionLength` preference from storage before each API call
- Handles enable/disable state via Chrome storage
- Handles Supabase preference sync (includes suggestion_length)
- Message types: `GET_SUGGESTION`, `GET_ENABLED_STATE`, `SET_ENABLED_STATE`, `GET_CUSTOM_TONE`, `SUPABASE_GET_PREFERENCES`, `SUPABASE_SAVE_PREFERENCES`, `SUPABASE_SYNC`

### content/content.js
Core functionality:
- **Input Detection**: Finds `<textarea>`, `<input type="text">`, and `contenteditable` elements
- **MutationObserver**: Watches for dynamically added inputs (SPAs)
- **Debouncing**: 300ms delay before fetching suggestions
- **Context Extraction**: Detects current app and extracts conversation context via extractors
- **Custom Tone**: Retrieves per-app custom tone from storage
- **Popup Display**: Shows styled popup above input with suggestion
- **Keyboard Handling**: Tab to accept, Escape to dismiss

Key functions:
- `createPopup()` - Creates and styles the suggestion popup
- `showPopup(inputEl, suggestion)` - Positions popup above input
- `handleInput(e)` - Debounced input handler
- `handleKeyDown(e)` - Tab/Escape key handling
- `insertTextAtCursor(el, text, inputType)` - Inserts accepted suggestion
- `fetchSuggestion(text)` - Gets suggestion with app context and custom tone
- `getCustomTone(app)` - Retrieves custom tone for app
- `tryExecCommand(el, text)` - execCommand insertion for rich editors
- `isCursorAtEnd(el, inputType)` - Multi-method cursor position detection
- `dispatchInputEvents(el, text)` - Dispatches events for editor frameworks

### content/[app]-extractor.js
Each extractor exposes a global object (e.g., `window.TabTabDiscord`) with:
- `isAppName()` - Check if current page is the app
- `extractContext()` - Return array of recent messages/tweets

Supported apps:
- `discord-extractor.js` - Extracts up to 10 recent channel messages
- `linkedin-extractor.js` - Extracts up to 10 conversation messages
- `slack-extractor.js` - Extracts up to 10 channel messages
- `twitter-extractor.js` - Extracts up to 5 tweets for reply context

### lib/supabase.js
Supabase client for anonymous authentication and preference sync:
- `signInAnonymously()` - Creates anonymous user session
- `ensureSignedIn()` - Auto sign-in if not authenticated
- `getPreferences()` - Fetch preferences from Supabase
- `savePreferences(prefs)` - Upsert preferences to Supabase
- Session stored in `chrome.storage.local`

### popup/
UI features:
- Enable/disable toggle with status indicator
- Suggestion length toggle (Concise/Longer, default: Concise)
- App context detection (Discord, LinkedIn, Slack, Twitter, or generic)
- Custom tone editing per app
- Cloud sync badge showing sync status

## Suggestion Flow

```
User types in input
        ↓
Content script detects input event
        ↓
300ms debounce timer starts
        ↓
Check: cursor at end? text >= 5 chars?
        ↓
Detect app (Discord/LinkedIn/Slack/Twitter)
        ↓
Extract conversation context via extractor
        ↓
Get custom tone for app from storage
        ↓
Send message to service worker with text, context, app, customTone
        ↓
Service worker reads suggestionLength from storage
        ↓
Service worker calls hosted API with all params
        ↓
Response returned to content script
        ↓
Popup displayed above input
        ↓
Tab → insert text | Escape → dismiss
```

## Supported Input Types

| Type | Support |
|------|---------|
| `<textarea>` | Full |
| `<input type="text">` | Full |
| `<input type="search">` | Full |
| `<input type="email">` | Full |
| `<input type="url">` | Full |
| `contenteditable` | Full |
| Rich text editors | Full |
| Password fields | Excluded |
| Read-only fields | Excluded |

### Rich Text Editor Support

The extension includes enhanced support for complex contenteditable elements:

| Platform/Editor | Support |
|-----------------|---------|
| LinkedIn Messages | Full (with context) |
| Discord | Full (with context) |
| Slack | Full (with context) |
| Twitter/X | Full (with context) |
| Quill Editor | Full |
| ProseMirror | Full |
| Draft.js | Full |
| Slate.js | Full |
| Tiptap | Full |

## Suggestion Length

Users can choose between two suggestion lengths via the popup UI:

| Setting | Label | Description | Max Tokens |
|---------|-------|-------------|------------|
| `short` | Concise | Very brief, just a few words (5-15 words) | 25 |
| `normal` | Longer | 1-2 sentences or a short phrase | 50 |

Default is **Concise** (`short`). The setting is stored in `chrome.storage.sync` under `suggestionLength` and synced to Supabase as `suggestion_length`.

## Configuration

### API URL
In `background/service-worker.js`:
```javascript
const API_URL = 'http://localhost:3000/api/suggest';
```
Update this for production deployment.

### Supabase Configuration
In `config.js`:
```javascript
const SUPABASE_URL = 'https://...';
const SUPABASE_ANON_KEY = '...';
```

### Debounce Timing
In `content/content.js`:
```javascript
const DEBOUNCE_MS = 300;
const MIN_TEXT_LENGTH = 5;
const MUTATION_THROTTLE_MS = 500;
const PERIODIC_SCAN_MS = 10000;
```

## Development

### Testing Locally
1. Start the Next.js API server: `npm run dev`
2. Load extension in Chrome: `chrome://extensions/` → Load unpacked
3. Test on any website with text inputs
4. Test app-specific context on Discord, LinkedIn, Slack, Twitter

### Regenerating Icons
```bash
cd extension
node generate-icons.js
```

### Debugging
- Content script logs: Open DevTools on any page, check Console for `[TabTab]` logs
- Extractor logs: Look for `[TabTab Discord]`, `[TabTab LinkedIn]`, etc.
- Service worker logs: `chrome://extensions/` → TabTab → "Service worker" link
- Supabase logs: Look for `[TabTab Supabase]` in service worker console

## Known Limitations

- Requires hosted API server running
- Some sites with Shadow DOM may not work (e.g., Notion)
- Suggestion only triggers when cursor is at end of text
- Context extraction depends on stable DOM selectors (may break with app updates)
- Anonymous Supabase auth requires Supabase project with anonymous sign-in enabled
