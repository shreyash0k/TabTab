# Popup UI

## Purpose

Provides a simple interface for users to enable/disable the TabTab extension and see its current status.

## Files

### popup.html

Simple HTML structure:
- Header with logo and title
- Enable/disable toggle switch
- Status indicator (Active/Disabled)
- Usage instructions

### popup.js

Handles:
1. **Load state**: Reads `enabled` from `chrome.storage.sync` on popup open
2. **Toggle change**: Saves new state when user toggles
3. **Status display**: Updates visual indicator based on state

Key functions:
- `updateStatusDisplay(isEnabled)` - Updates status indicator UI

### popup.css

Styling for:
- Container layout (280px min-width)
- Header with logo
- Toggle switch (iOS-style)
- Status indicator with colored dot
- Instructions section with keyboard hints

## State Management

Uses `chrome.storage.sync` which:
- Syncs across user's Chrome browsers
- Persists when extension is updated
- Default value: `enabled = true`

## UI Components

### Toggle Switch
- Custom CSS checkbox styled as toggle
- Blue when enabled, gray when disabled
- Smooth transition animation

### Status Indicator
- Green dot + "Active" when enabled
- Red dot + "Disabled" when disabled
- Pulsing animation when active

## Design Notes

- Uses system font stack for native feel
- Dark/light backgrounds for sections
- Keyboard shortcuts displayed in `<kbd>` tags
- Responsive within popup constraints
