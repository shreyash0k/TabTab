// TabTab Background Service Worker
// Handles API calls to the hosted backend

const API_URL = 'http://localhost:3000/api/suggest';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SUGGESTION') {
    handleGetSuggestion(message.text, message.context, message.app)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error getting suggestion:', error);
        sendResponse({ suggestion: '', error: error.message });
      });
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (message.type === 'GET_ENABLED_STATE') {
    chrome.storage.sync.get(['enabled'], (result) => {
      sendResponse({ enabled: result.enabled !== false }); // Default to enabled
    });
    return true;
  }
  
  if (message.type === 'SET_ENABLED_STATE') {
    chrome.storage.sync.set({ enabled: message.enabled }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleGetSuggestion(text, context = [], app = null) {
  console.log('[TabTab SW] handleGetSuggestion called, text length:', text?.length, 'context:', context?.length, 'app:', app);
  
  // Don't fetch for short text
  if (!text || text.length < 10) {
    console.log('[TabTab SW] Text too short, skipping');
    return { suggestion: '' };
  }

  try {
    console.log('[TabTab SW] Fetching from:', API_URL);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, context, app }),
    });

    console.log('[TabTab SW] Response status:', response.status);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[TabTab SW] Got suggestion:', data.suggestion?.substring(0, 50));
    return { suggestion: data.suggestion || '' };
  } catch (error) {
    console.error('[TabTab SW] Failed to fetch suggestion:', error);
    return { suggestion: '', error: error.message };
  }
}

// Log when service worker starts
console.log('TabTab service worker initialized');
