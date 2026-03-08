# Content Script

## Purpose

Injected into every webpage to detect text inputs, show inline grey text suggestions (Gmail-style) on supported sites, and handle user interactions (Tab to accept, Escape to dismiss).

**Supported sites for inline suggestions:** LinkedIn DM only (more to be added).

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
- `debounceTimer` - Timer for debouncing input
- `isEnabled` - Whether extension is enabled
- `isExtensionValid` - Whether extension context is still valid
- `mutationThrottleTimer` - Timer for throttling mutation processing
- `pendingMutations` - Flag for pending mutation processing
- `processedElements` - WeakSet tracking already-processed elements
- `inlineSuggestionSpan` - Reference to the current inline suggestion `<span>` in the DOM
- `isManipulatingSuggestion` - Guard flag to prevent MutationObserver re-triggers when inserting/removing the suggestion span

#### Key Functions

| Function | Purpose |
|----------|---------|
| `isSupportedInlineSite(el)` | Gates suggestions to supported site+element combos (LinkedIn DM only for now) |
| `showInlineSuggestion(el, suggestion)` | Inserts grey `<span>` at cursor position in contenteditable |
| `removeInlineSuggestion()` | Removes the inline suggestion span from the DOM |
| `acceptInlineSuggestion(el)` | Converts suggestion span text to real content |
| `handleInput(e)` | Debounced handler for input events |
| `handleKeyDown(e)` | Handles Tab (accept) and Escape (dismiss) |
| `handleBlur(e)` | Clears suggestion when input loses focus |
| `insertTextAtCursor(el, text, inputType)` | Inserts text at cursor position |
| `fetchSuggestion(text)` | Fetches suggestion with app context and custom tone |
| `getCustomTone(app)` | Retrieves custom tone for app from storage |
| `getTextFromElement(el, inputType)` | Extracts text, excluding inline suggestion span |
| `isCursorAtEnd(el, inputType)` | Multi-method cursor position detection (accounts for inline span) |
| `attachListeners(input)` | Attaches all event listeners to an input |
| `isValidStandardInput(el)` | Checks if element is a valid input/textarea |
| `isValidContentEditable(el)` | Checks if element is valid contenteditable |
| `findContentEditables(root)` | Scans for contenteditable elements |
| `tryExecCommand(el, text)` | Attempts execCommand for editor compatibility |
| `dispatchInputEvents(el, text)` | Dispatches events for different frameworks |
| `getLastTextNode(el)` | Helper: gets last text node, skipping inline suggestion |
| `getLastMeaningfulChild(el)` | Helper: gets last meaningful child, skipping inline suggestion |
| `isExtensionContextValid()` | Checks if extension context is still valid |
| `safeSendMessage(message, callback)` | Safe wrapper for chrome.runtime.sendMessage |
| `cleanup()` | Cleanup when extension is invalidated |

#### Inline Suggestion Display

Suggestions are shown as inline grey text (Gmail-style) by inserting a `<span data-tabtab-inline="true" contenteditable="false">` at the cursor position inside the contenteditable element. Key behaviors:

- The span has `contentEditable="false"` so it acts as a non-editable island
- Cursor is positioned before the span so typing continues normally
- `getTextFromElement()` clones the element and strips the span to get clean text
- `isCursorAtEnd()` treats "cursor before suggestion span with nothing after" as "at end"
- `getLastTextNode()` and `getLastMeaningfulChild()` skip nodes inside the span
- `isManipulatingSuggestion` flag prevents MutationObserver from re-triggering during DOM changes

#### Site Gating

`isSupportedInlineSite(el)` controls which inputs get suggestions:
```javascript
function isSupportedInlineSite(el) {
  if (!isContentEditable(el)) return false;
  if (window.TabTabLinkedIn?.isLinkedIn()) return true; // LinkedIn DM
  return false;
}
```
To add a new site, add another condition here.

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

**Standard inputs**: `<textarea>`, `<input type="text|search|email|url">` (listeners attached but no suggestions shown unless site is supported)

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

Uses throttling (500ms) to avoid performance issues. Skips mutations when `isManipulatingSuggestion` is true.

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

CSS for the inline suggestion `<span>`:
- Grey color (`#999`)
- Inherits font properties from parent (size, family, weight, line-height)
- Non-interactive (`pointer-events: none`, `user-select: none`)
- Resets background, border, padding, margin to blend in

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
- Inline suggestion display/accept/remove events
- Error states
