# Background Service Worker

## Purpose

Handles all network requests, state management, and Supabase sync for the TabTab extension. Runs as a Manifest V3 service worker (not a persistent background page).

## File: service-worker.js

### Imports

```javascript
importScripts('../config.js');    // SUPABASE_URL, SUPABASE_ANON_KEY
importScripts('../lib/supabase.js'); // SupabaseClient
```

### API Configuration

```javascript
const API_URL = 'http://localhost:3000/api/suggest';
```

Update this URL when deploying to production.

### Message Handlers

| Message Type | Description | Response |
|--------------|-------------|----------|
| `GET_SUGGESTION` | Fetch AI suggestion with context | `{ suggestion: string }` |
| `GET_ENABLED_STATE` | Check if extension is enabled | `{ enabled: boolean }` |
| `SET_ENABLED_STATE` | Enable/disable extension | `{ success: boolean }` |
| `GET_CUSTOM_TONE` | Get custom tone for specific app | `{ customTone: string \| null }` |
| `SUPABASE_GET_PREFERENCES` | Fetch preferences from Supabase | `{ preferences: object \| null }` |
| `SUPABASE_SAVE_PREFERENCES` | Save preferences to Supabase | `{ error?: string }` |
| `SUPABASE_SYNC` | Sync local preferences to cloud | `{ error?: string }` |

### Key Function: handleGetSuggestion(text, context, app, customTone)

1. Validates text length (minimum 5 characters)
2. Makes POST request to API with `{ text, context, app, customTone }`
3. Returns suggestion or empty string on error
4. Logs requests for debugging

Parameters:
- `text` - The text to get suggestions for
- `context` - Array of recent messages (from extractors)
- `app` - App identifier ('discord', 'linkedin', 'slack', 'twitter', or null)
- `customTone` - Custom tone string (e.g., "Professional, polished")

### State Management

Uses `chrome.storage.sync` for:
- `enabled` - Whether extension is active (default: true)
- `customTones` - Object mapping app names to custom tone strings

### Supabase Integration

On startup, the service worker:
1. Calls `SupabaseClient.ensureSignedIn()` to auto-authenticate
2. Uses anonymous authentication for preference sync

Functions:
- `syncToSupabase()` - Syncs local preferences (enabled, customTones) to Supabase

### Error Handling

- Network errors return empty suggestion (graceful degradation)
- Logs errors to service worker console with `[TabTab SW]` prefix
- Never throws to content script
- Returns `{ error: message }` for Supabase errors

## Debugging

1. Go to `chrome://extensions/`
2. Find TabTab extension
3. Click "Service worker" link under "Inspect views"
4. Check Console for `[TabTab SW]` and `[TabTab Supabase]` logs
