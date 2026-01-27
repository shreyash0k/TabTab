# Popup UI

## Purpose

Provides an interface for users to enable/disable the TabTab extension, see the current app context, customize tones per app, and view cloud sync status.

## Files

### popup.html

HTML structure:
- Header with logo, title, and cloud sync badge
- Enable/disable toggle switch with status indicator
- App context card showing detected app and tone
- Tone editing row (hidden by default)
- Usage instructions

### popup.js

Handles:
1. **Load state**: Reads `enabled` and `customTones` from `chrome.storage.sync`
2. **Toggle change**: Saves enabled state and triggers cloud sync
3. **App detection**: Queries active tab URL to detect Discord/LinkedIn/Slack/Twitter
4. **Tone display**: Shows custom tone or default based on detected app
5. **Tone editing**: Save/cancel custom tone per app
6. **Cloud sync**: Syncs preferences to Supabase via service worker

Key functions:
- `updateStatusDisplay(isEnabled)` - Updates status indicator UI
- `detectCurrentApp()` - Queries active tab URL to determine app
- `updateAppDisplay()` - Updates app name, icon, and tone display
- `saveTone()` - Saves custom tone for current app
- `cancelEdit()` - Cancels tone editing
- `updateSyncBadge(status, message)` - Updates cloud sync badge
- `syncToCloud()` - Sends SUPABASE_SYNC message to service worker

App Configuration:
```javascript
const APP_CONFIG = {
  discord: { name: 'Discord', icon: '🎮', defaultTone: 'Casual, friendly' },
  linkedin: { name: 'LinkedIn', icon: '💼', defaultTone: 'Professional, polished' },
  slack: { name: 'Slack', icon: '💬', defaultTone: 'Casual, collaborative' },
  twitter: { name: 'Twitter/X', icon: '🐦', defaultTone: 'Concise, engaging' },
  none: { name: 'No app detected', icon: '🌐', defaultTone: 'Neutral' }
};
```

### popup.css

Styling for:
- Container layout (280px min-width)
- Header with logo and sync badge
- Toggle switch (iOS-style)
- Status indicator with colored dot
- App context card with app icon and tone
- Tone editing row with input and buttons
- Instructions section with keyboard hints

## State Management

Uses `chrome.storage.sync` which:
- Syncs across user's Chrome browsers
- Persists when extension is updated
- Keys: `enabled` (boolean, default true), `customTones` (object)

## UI Components

### Toggle Switch
- Custom CSS checkbox styled as toggle
- Blue when enabled, gray when disabled
- Smooth transition animation

### Status Indicator
- Green dot + "Active" when enabled
- Red dot + "Disabled" when disabled
- Pulsing animation when active

### App Context Card
- Shows detected app icon and name
- Displays current tone (custom or default)
- Edit button to modify tone

### Tone Editing
- Text input pre-filled with current tone
- Save (✓) and Cancel (✕) buttons
- Enter to save, Escape to cancel

### Cloud Sync Badge
- Shows "Synced", "Syncing...", or error state
- Cloud icon (☁️) or spinner icon (🔄)
- Positioned in header

## Design Notes

- Uses system font stack for native feel
- Dark/light backgrounds for sections
- Keyboard shortcuts displayed in `<kbd>` tags
- Responsive within popup constraints
- Emojis for app icons and sync status
