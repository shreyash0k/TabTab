# Background Service Worker

## Purpose

Handles all network requests and state management for the TabTab extension. Runs as a Manifest V3 service worker (not a persistent background page).

## File: service-worker.js

### API Configuration

```javascript
const API_URL = 'http://localhost:3000/api/suggest';
```

Update this URL when deploying to production.

### Message Handlers

| Message Type | Description | Response |
|--------------|-------------|----------|
| `GET_SUGGESTION` | Fetch AI suggestion for text | `{ suggestion: string }` |
| `GET_ENABLED_STATE` | Check if extension is enabled | `{ enabled: boolean }` |
| `SET_ENABLED_STATE` | Enable/disable extension | `{ success: boolean }` |

### Key Function: handleGetSuggestion(text)

1. Validates text length (minimum 10 characters)
2. Makes POST request to API with `{ text }`
3. Returns suggestion or empty string on error
4. Logs requests for debugging

### State Management

Uses `chrome.storage.sync` for:
- `enabled` - Whether extension is active (default: true)

### Error Handling

- Network errors return empty suggestion (graceful degradation)
- Logs errors to service worker console
- Never throws to content script

## Debugging

1. Go to `chrome://extensions/`
2. Find TabTab extension
3. Click "Service worker" link under "Inspect views"
4. Check Console for `[TabTab SW]` logs
