# Extension AGENTS.md

## Overview

Chrome extension (Manifest V3) that provides AI-powered text autocomplete for any text input on any website. Shows suggestions in a popup above the input field.

## Architecture

```
extension/
├── manifest.json           # Chrome MV3 configuration
├── background/
│   └── service-worker.js   # Handles API calls to backend
├── content/
│   ├── content.js          # Main logic: detection, popup, keyboard handling
│   └── styles.css          # Style overrides for popup
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Toggle enable/disable logic
│   └── popup.css           # Popup styling
├── icons/                  # Extension icons (16/48/128px PNG)
├── generate-icons.js       # Script to regenerate icons
└── README.md               # User-facing documentation
```

## Key Components

### manifest.json
- Manifest V3 format (required for Chrome Web Store)
- Permissions: `storage`, `activeTab`
- Host permissions: `http://localhost:3000/*` (update for production)
- Content scripts injected on all URLs

### background/service-worker.js
- Receives messages from content script
- Makes API calls to `/api/suggest` endpoint
- Handles enable/disable state via Chrome storage
- Message types: `GET_SUGGESTION`, `GET_ENABLED_STATE`, `SET_ENABLED_STATE`

### content/content.js
Core functionality:
- **Input Detection**: Finds `<textarea>`, `<input type="text">`, and `contenteditable` elements
- **MutationObserver**: Watches for dynamically added inputs (SPAs)
- **Debouncing**: 300ms delay before fetching suggestions
- **Popup Display**: Shows styled popup above input with suggestion
- **Keyboard Handling**: Tab to accept, Escape to dismiss

Key functions:
- `createPopup()` - Creates and styles the suggestion popup
- `showPopup(inputEl, suggestion)` - Positions popup above input
- `handleInput(e)` - Debounced input handler
- `handleKeyDown(e)` - Tab/Escape key handling
- `insertTextAtCursor(el, text, inputType)` - Inserts accepted suggestion (uses execCommand for rich editors)
- `attachListeners(input)` - Attaches event listeners to inputs
- `handleContentEditableChange(el)` - MutationObserver handler for rich text editors
- `tryExecCommand(el, text)` - Attempts execCommand insertion for better editor compatibility
- `isCursorAtEnd(el, inputType)` - Multi-method cursor position detection for complex DOM structures
- `dispatchInputEvents(el, text)` - Dispatches multiple event types for different editor frameworks

### popup/
Simple UI with:
- Enable/disable toggle
- Status indicator (Active/Disabled)
- Usage instructions

## Suggestion Flow

```
User types in input
        ↓
Content script detects input event
        ↓
300ms debounce timer starts
        ↓
Check: cursor at end? text > 10 chars?
        ↓
Send message to service worker
        ↓
Service worker calls hosted API
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
| `<textarea>` | ✅ Full |
| `<input type="text">` | ✅ Full |
| `<input type="search">` | ✅ Full |
| `<input type="email">` | ✅ Full |
| `<input type="url">` | ✅ Full |
| `contenteditable` | ✅ Full |
| Rich text editors | ✅ Full |
| Password fields | ❌ Excluded |
| Read-only fields | ❌ Excluded |

### Rich Text Editor Support

The extension includes enhanced support for complex contenteditable elements used by modern web apps:

| Platform/Editor | Support |
|-----------------|---------|
| LinkedIn Messages | ✅ |
| Discord | ✅ |
| Slack | ✅ |
| Quill Editor | ✅ |
| ProseMirror | ✅ |
| Draft.js | ✅ |
| Slate.js | ✅ |
| Tiptap | ✅ |

Detection methods:
- `role="textbox"` attribute
- `aria-multiline="true"` attribute
- `aria-label` containing "message", "write", "compose", etc.
- Common editor class patterns (msg-form, editor, compose, etc.)
- MutationObserver for DOM-based text changes
- Multiple event listeners (input, keyup, mutations)

## Configuration

### API URL
In `background/service-worker.js`:
```javascript
const API_URL = 'http://localhost:3000/api/suggest';
```
Update this for production deployment.

### Debounce Timing
In `content/content.js`:
```javascript
const DEBOUNCE_MS = 300;
const MIN_TEXT_LENGTH = 10;
```

## Development

### Testing Locally
1. Start the Next.js API server: `npm run dev`
2. Load extension in Chrome: `chrome://extensions/` → Load unpacked
3. Test on any website with text inputs

### Regenerating Icons
```bash
cd extension
node generate-icons.js
```

### Debugging
- Content script logs: Open DevTools on any page, check Console for `[TabTab]` logs
- Service worker logs: `chrome://extensions/` → TabTab → "Service worker" link

## Known Limitations

- Requires hosted API server running
- Some sites with Shadow DOM may not work (e.g., Notion)
- Suggestion only triggers when cursor is at end of text
- Some highly custom editors may need additional integration
