# Content Script

## Purpose

Injected into every webpage to detect text inputs, show suggestion popups, and handle user interactions (Tab to accept, Escape to dismiss).

## Files

### content.js

Main script with all functionality in an IIFE to avoid polluting global scope.

#### Constants
```javascript
const DEBOUNCE_MS = 300;      // Wait before fetching suggestion
const MIN_TEXT_LENGTH = 10;   // Minimum chars to trigger suggestion
```

#### State Variables
- `currentInput` - Currently focused input element
- `currentInputType` - 'standard' or 'contenteditable'
- `currentSuggestion` - Active suggestion text
- `popupElement` - The suggestion popup DOM element
- `debounceTimer` - Timer for debouncing input
- `isEnabled` - Whether extension is enabled

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
| `attachListeners(input)` | Attaches all event listeners to an input |
| `isValidStandardInput(el)` | Checks if element is a valid input/textarea |
| `isValidContentEditable(el)` | Checks if element is valid contenteditable |
| `findContentEditables(root)` | Scans for contenteditable elements |

#### Input Detection

**Standard inputs**: `<textarea>`, `<input type="text|search|email|url">`

**Contenteditable**: Elements with `contenteditable="true"` attribute

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

Also runs periodic scan every 2 seconds for contenteditable elements.

### styles.css

Minimal CSS overrides to ensure popup displays correctly on all sites:
- Forces high z-index
- Resets box-sizing
- Prevents site styles from affecting popup

## Popup Design

The popup appears ABOVE the input field with:
- Dark gradient background (adapts to light mode)
- Header with "TabTab Suggestion" title
- Blue "Tab to accept" button
- Smooth slide-down animation
- Max width of 500px

## Communication

Uses `chrome.runtime.sendMessage()` to communicate with service worker:
```javascript
chrome.runtime.sendMessage(
  { type: 'GET_SUGGESTION', text },
  (response) => { /* handle response */ }
);
```

## Debugging

Open DevTools on any webpage and filter console by `[TabTab]` to see:
- Input detection logs
- Suggestion fetch logs
- Popup display logs
