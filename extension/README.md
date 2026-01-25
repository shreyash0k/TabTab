# TabTab Chrome Extension

AI-powered text autocomplete for any text field on any website.

## Installation (Developer Mode)

1. **Start the backend API server:**
   ```bash
   # From the project root directory
   npm run dev
   ```
   This starts the Next.js server at `http://localhost:3000`

2. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this `extension` folder

3. **The extension is now active!**

## How to Use

1. Navigate to any website with a text input or textarea
2. Start typing (minimum 10 characters)
3. Wait briefly for a gray suggestion to appear
4. Press **Tab** to accept the suggestion
5. Press **Escape** to dismiss it

## Files

```
extension/
├── manifest.json           # Chrome MV3 manifest
├── background/
│   └── service-worker.js   # Handles API calls to backend
├── content/
│   ├── content.js          # Detects inputs, shows ghost text
│   └── styles.css          # Ghost text overlay styling
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Toggle enable/disable
│   └── popup.css           # Popup styling
├── icons/                  # Extension icons
└── generate-icons.js       # Script to regenerate icons
```

## Configuration

The extension currently connects to `http://localhost:3000/api/suggest`. 

To use a deployed backend:
1. Edit `background/service-worker.js`
2. Change `API_URL` to your deployed URL
3. Update `host_permissions` in `manifest.json` to match

## Troubleshooting

- **No suggestions appearing:** Check that the backend server is running
- **Extension not working:** Check the browser console for errors
- **Tab not accepting:** Some sites override Tab key - try Escape and type more
