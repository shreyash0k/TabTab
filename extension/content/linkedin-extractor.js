// LinkedIn Context Extractor
// Extracts recent messages from LinkedIn messaging for context-aware suggestions

(function() {
  'use strict';

  const MAX_MESSAGES = 10;

  // Check if current page is LinkedIn
  function isLinkedIn() {
    return window.location.hostname.includes('linkedin.com');
  }

  // LinkedIn message selectors (multiple fallbacks for stability)
  const SELECTORS = {
    // Message event items in the conversation
    messageItem: [
      '.msg-s-event-listitem',
      '.msg-s-message-list__event',
      '[class*="msg-s-event-listitem"]',
      '.message-event',
    ],
    // Message body/content within an item
    messageBody: [
      '.msg-s-event-listitem__body',
      '.msg-s-event__content',
      '[class*="msg-s-event-listitem__body"]',
      '.message-body',
      'p.msg-s-event-listitem__body',
    ],
    // Message list container
    messageList: [
      '.msg-s-message-list-content',
      '.msg-s-message-list',
      '[class*="msg-s-message-list"]',
      '.messages-container',
    ],
  };

  // Try multiple selectors until one works
  function queryWithFallbacks(selectors, context = document) {
    for (const selector of selectors) {
      try {
        const elements = context.querySelectorAll(selector);
        if (elements.length > 0) {
          return elements;
        }
      } catch (e) {
        console.log('[TabTab LinkedIn] Selector failed:', selector, e.message);
      }
    }
    return [];
  }

  // Extract text content from a message element
  function extractMessageText(element) {
    // Try to get the message body specifically
    const bodyElements = queryWithFallbacks(SELECTORS.messageBody, element);
    
    if (bodyElements.length > 0) {
      const text = bodyElements[0].textContent || '';
      return text.trim();
    }
    
    // Fallback: get text from the element, filtering out common metadata
    let text = element.textContent || '';
    
    // LinkedIn messages often have sender names and timestamps mixed in
    // Try to clean up by getting only paragraph content
    const paragraphs = element.querySelectorAll('p');
    if (paragraphs.length > 0) {
      text = Array.from(paragraphs)
        .map(p => p.textContent?.trim())
        .filter(t => t && t.length > 0)
        .join(' ');
    }
    
    return text.trim();
  }

  // Main function to extract LinkedIn conversation context
  function extractLinkedInContext() {
    if (!isLinkedIn()) {
      return [];
    }

    console.log('[TabTab LinkedIn] Extracting context...');

    try {
      // First try to find message items directly
      const messageItems = queryWithFallbacks(SELECTORS.messageItem);
      
      if (messageItems.length > 0) {
        console.log('[TabTab LinkedIn] Found', messageItems.length, 'message items');
        const messages = [];
        
        // Get last N messages
        const startIndex = Math.max(0, messageItems.length - MAX_MESSAGES);
        for (let i = startIndex; i < messageItems.length; i++) {
          const text = extractMessageText(messageItems[i]);
          if (text && text.length > 0) {
            messages.push(text);
          }
        }
        
        console.log('[TabTab LinkedIn] Extracted', messages.length, 'messages');
        return messages;
      }

      // Try finding message bodies directly
      const messageBodies = queryWithFallbacks(SELECTORS.messageBody);
      
      if (messageBodies.length > 0) {
        console.log('[TabTab LinkedIn] Found', messageBodies.length, 'message bodies');
        const messages = [];
        
        const startIndex = Math.max(0, messageBodies.length - MAX_MESSAGES);
        for (let i = startIndex; i < messageBodies.length; i++) {
          const text = (messageBodies[i].textContent || '').trim();
          if (text && text.length > 0) {
            messages.push(text);
          }
        }
        
        console.log('[TabTab LinkedIn] Extracted', messages.length, 'messages');
        return messages;
      }

      console.log('[TabTab LinkedIn] No messages found');
      return [];

    } catch (error) {
      console.error('[TabTab LinkedIn] Error extracting context:', error);
      return [];
    }
  }

  // Expose functions globally for use by content.js
  window.TabTabLinkedIn = {
    isLinkedIn,
    extractContext: extractLinkedInContext,
  };

  console.log('[TabTab LinkedIn] Extractor loaded');
})();
