// TabTab Background Service Worker
// Handles API calls to the hosted backend and Supabase sync

importScripts('../config.js');
importScripts('../lib/supabase.js');

const API_URL = 'http://localhost:3000/api/suggest';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SUGGESTION') {
    handleGetSuggestion(message.text, message.context, message.app, message.customTone)
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
  
  if (message.type === 'GET_CUSTOM_TONE') {
    chrome.storage.sync.get(['customTones'], (result) => {
      const customTones = result.customTones || {};
      const tone = customTones[message.app] || null;
      sendResponse({ customTone: tone });
    });
    return true;
  }
  
  // Supabase sync handlers
  if (message.type === 'SUPABASE_GET_PREFERENCES') {
    SupabaseClient.getPreferences()
      .then(sendResponse)
      .catch((error) => {
        console.error('[TabTab SW] Get preferences error:', error);
        sendResponse({ preferences: null, error: error.message });
      });
    return true;
  }
  
  if (message.type === 'SUPABASE_SAVE_PREFERENCES') {
    SupabaseClient.savePreferences(message.preferences)
      .then(sendResponse)
      .catch((error) => {
        console.error('[TabTab SW] Save preferences error:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
  
  if (message.type === 'SUPABASE_SYNC') {
    // Sync local preferences to Supabase
    syncToSupabase()
      .then(sendResponse)
      .catch((error) => {
        console.error('[TabTab SW] Sync error:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

async function handleGetSuggestion(text, context = [], app = null, customTone = null) {
  console.log('[TabTab SW] handleGetSuggestion called, text length:', text?.length, 'context:', context?.length, 'app:', app, 'customTone:', customTone);
  
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
      body: JSON.stringify({ text, context, app, customTone }),
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

// Sync local preferences to Supabase
async function syncToSupabase() {
  // Get local preferences
  const localPrefs = await new Promise((resolve) => {
    chrome.storage.sync.get(['enabled', 'customTones'], resolve);
  });
  
  // Save to Supabase
  const result = await SupabaseClient.savePreferences({
    enabled: localPrefs.enabled !== false,
    custom_tones: localPrefs.customTones || {}
  });
  
  return result;
}

// Auto-sync when extension starts
SupabaseClient.ensureSignedIn().then(({ user, error }) => {
  if (user) {
    console.log('[TabTab SW] Signed in as:', user.id);
  } else if (error) {
    console.error('[TabTab SW] Auth error:', error);
  }
});

// Log when service worker starts
console.log('TabTab service worker initialized');
