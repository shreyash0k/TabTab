# Content Script

## Purpose

Injected into every webpage to detect text inputs, extract app-specific context, show suggestion popups, and handle user interactions (Tab to accept, Escape to dismiss).

## Files

### content.js

Main script with all functionality in an IIFE to avoid polluting global scope.

#### Constants
```javascript
const DEBOUNCE_MS = 300;           // Wait before fetching suggestion
const MIN_TEXT_LENGTH = 5;         // Minimum chars to trigger suggestion
const MUTATION_THROTTLE_MS = 500;  // Throttle mutation observer processing
const PERIODIC_SCAN_MS = 10000;    // Periodic contenteditable scan interval
```

#### State Variables
- `currentInput` - Currently focused input element
- `currentInputType` - 'standard' or 'contenteditable'
- `currentSuggestion` - Active suggestion text
- `popupElement` - The suggestion popup DOM element
- `debounceTimer` - Timer for debouncing input
- `isEnabled` - Whether extension is enabled
- `isExtensionValid` - Whether extension context is still valid
- `mutationThrottleTimer` - Timer for throttling mutation processing
- `pendingMutations` - Flag for pending mutation processing
- `processedElements` - WeakSet tracking already-processed elements

#### Key Functions

| Function | Purpose |
|----------|---------|
| `createPopup()` | Creates styled suggestion popup element |
| `showPopup(inputEl, suggestion)` | Positions and displays popup above input |
| `hidePopup()` | Hides the popup |
| `handleInput(e)` | Debounced handler for input events |
| `handleKeyDown(e)` | Handles Tab (accept) and Escape (dismiss) |
| `handleBlur(e)` | Clears suggestion when input loses focus |
| `insertTextAtCursor(el, text, inputType)` | Inserts suggestion text |
| `fetchSuggestion(text)` | Fetches suggestion with app context and custom tone |
| `getCustomTone(app)` | Retrieves custom tone for app from storage |
| `attachListeners(input)` | Attaches all event listeners to an input |
| `isValidStandardInput(el)` | Checks if element is a valid input/textarea |
| `isValidContentEditable(el)` | Checks if element is valid contenteditable |
| `findContentEditables(root)` | Scans for contenteditable elements |
| `tryExecCommand(el, text)` | Attempts execCommand for editor compatibility |
| `dispatchInputEvents(el, text)` | Dispatches events for different frameworks |
| `isCursorAtEnd(el, inputType)` | Multi-method cursor position detection |
| `getLastTextNode(el)` | Helper: gets last text node in element |
| `getLastMeaningfulChild(el)` | Helper: gets last meaningful child node |
| `isExtensionContextValid()` | Checks if extension context is still valid |
| `safeSendMessage(message, callback)` | Safe wrapper for chrome.runtime.sendMessage |
| `cleanup()` | Cleanup when extension is invalidated |

#### App Context Integration

The `fetchSuggestion()` function detects the current app and extracts context:

```javascript
if (window.TabTabDiscord && window.TabTabDiscord.isDiscord()) {
  app = 'discord';
  context = window.TabTabDiscord.extractContext();
} else if (window.TabTabLinkedIn && window.TabTabLinkedIn.isLinkedIn()) {
  // ... similar for LinkedIn, Slack, Twitter
}
```

Then retrieves custom tone and sends to service worker:
```javascript
const customTone = await getCustomTone(app);
safeSendMessage({ type: 'GET_SUGGESTION', text, context, app, customTone }, ...);
```

#### Input Detection

**Standard inputs**: `<textarea>`, `<input type="text|search|email|url">`

**Contenteditable**: Elements with `contenteditable="true"`, `role="textbox"`, `aria-multiline="true"`, or common editor classes

**Exclusions**:
- Password fields
- Read-only/disabled fields
- Elements with `data-tabtab-native="true"` (TabTab web app)
- Very small elements (< 50px width or < 20px height)

#### MutationObserver

Watches for:
- New input elements added to DOM
- Contenteditable attribute changes
- Dynamically loaded content (SPAs)

Uses throttling (500ms) to avoid performance issues.

#### Periodic Scan

Runs every 10 seconds (when page has focus) to catch contenteditable elements that may have been missed.

### [app]-extractor.js Files

Site-specific context extractors loaded before content.js:

#### discord-extractor.js
- Exposes: `window.TabTabDiscord`
- `isDiscord()` - Checks if on discord.com
- `extractContext()` - Returns up to 10 recent channel messages
- Uses multiple CSS selector fallbacks for stability

#### linkedin-extractor.js
- Exposes: `window.TabTabLinkedIn`
- `isLinkedIn()` - Checks if on linkedin.com
- `extractContext()` - Returns up to 10 conversation messages
- Targets `.msg-s-event-listitem` and related selectors

#### slack-extractor.js
- Exposes: `window.TabTabSlack`
- `isSlack()` - Checks if on slack.com or app.slack.com
- `extractContext()` - Returns up to 10 channel messages
- Uses `[data-qa="message_container"]` and related selectors

#### twitter-extractor.js
- Exposes: `window.TabTabTwitter`
- `isTwitter()` - Checks if on twitter.com or x.com
- `extractContext()` - Returns up to 5 tweets for reply context
- Uses `[data-testid="tweetText"]` and related selectors

### styles.css

Minimal CSS overrides to ensure popup displays correctly on all sites:
- Forces high z-index
- Resets box-sizing
- Prevents site styles from affecting popup

## Popup Design

The popup appears ABOVE the input field with:
- Dark gradient background (adapts to light mode via media query)
- Header with "TabTab Suggestion" title and keyboard icon
- Blue "Tab to accept" button
- Smooth slide-down animation
- Max width of 500px, min width of 250px

## Communication

Uses `safeSendMessage()` wrapper for `chrome.runtime.sendMessage()`:
```javascript
safeSendMessage(
  { type: 'GET_SUGGESTION', text, context, app, customTone },
  (response) => { /* handle response */ }
);
```

The wrapper handles:
- Extension context invalidation (e.g., after update)
- Chrome runtime errors
- Graceful cleanup

## Debugging

Open DevTools on any webpage and filter console by prefix:
- `[TabTab]` - Main content script logs
- `[TabTab Discord]` - Discord extractor logs
- `[TabTab LinkedIn]` - LinkedIn extractor logs
- `[TabTab Slack]` - Slack extractor logs
- `[TabTab Twitter]` - Twitter extractor logs

Logs include:
- Input detection events
- Suggestion fetch requests
- Context extraction results
- Popup display events
- Error states
