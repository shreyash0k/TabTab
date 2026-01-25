// Discord Context Extractor
// Extracts recent messages from Discord conversations for context-aware suggestions

(function() {
  'use strict';

  const MAX_MESSAGES = 10;

  // Check if current page is Discord
  function isDiscord() {
    return window.location.hostname.includes('discord.com');
  }

  // Discord message selectors (multiple fallbacks for stability)
  // Discord uses obfuscated class names, but some patterns are stable
  const SELECTORS = {
    // Message content - Discord uses id="message-content-{id}" pattern
    messageContent: [
      '[id^="message-content-"]',
      '[class*="messageContent-"]',
      '[class*="markup_"] > span',
    ],
    // Message list container
    messageList: [
      '[class*="messagesWrapper-"]',
      '[class*="scrollerInner-"]',
      'ol[class*="scrollerInner"]',
      '[data-list-id="chat-messages"]',
    ],
    // Individual message container
    messageContainer: [
      '[id^="chat-messages-"]',
      '[class*="message-"][class*="cozyMessage-"]',
      'li[class*="messageListItem-"]',
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
        // Invalid selector, try next
        console.log('[TabTab Discord] Selector failed:', selector, e.message);
      }
    }
    return [];
  }

  // Extract text content from a message element
  function extractMessageText(element) {
    // Try to get the message content specifically
    const contentElements = queryWithFallbacks(SELECTORS.messageContent, element);
    
    if (contentElements.length > 0) {
      // Get text from the first matching content element
      const text = contentElements[0].textContent || '';
      return text.trim();
    }
    
    // Fallback: get text from the element itself, but filter out metadata
    // Discord messages have usernames, timestamps, etc. that we want to skip
    const text = element.textContent || '';
    return text.trim();
  }

  // Main function to extract Discord conversation context
  function extractDiscordContext() {
    if (!isDiscord()) {
      return [];
    }

    console.log('[TabTab Discord] Extracting context...');

    try {
      // Find message content elements directly
      const messageContents = queryWithFallbacks(SELECTORS.messageContent);
      
      if (messageContents.length === 0) {
        console.log('[TabTab Discord] No messages found with primary selectors');
        
        // Try finding message containers and extracting text
        const containers = queryWithFallbacks(SELECTORS.messageContainer);
        if (containers.length > 0) {
          console.log('[TabTab Discord] Found', containers.length, 'message containers');
          const messages = [];
          
          // Get last N containers
          const startIndex = Math.max(0, containers.length - MAX_MESSAGES);
          for (let i = startIndex; i < containers.length; i++) {
            const text = extractMessageText(containers[i]);
            if (text && text.length > 0) {
              messages.push(text);
            }
          }
          
          console.log('[TabTab Discord] Extracted', messages.length, 'messages from containers');
          return messages;
        }
        
        return [];
      }

      console.log('[TabTab Discord] Found', messageContents.length, 'message content elements');

      // Extract text from the last N messages
      const messages = [];
      const startIndex = Math.max(0, messageContents.length - MAX_MESSAGES);
      
      for (let i = startIndex; i < messageContents.length; i++) {
        const text = (messageContents[i].textContent || '').trim();
        if (text && text.length > 0) {
          messages.push(text);
        }
      }

      console.log('[TabTab Discord] Extracted', messages.length, 'messages');
      return messages;

    } catch (error) {
      console.error('[TabTab Discord] Error extracting context:', error);
      return [];
    }
  }

  // Expose functions globally for use by content.js
  window.TabTabDiscord = {
    isDiscord,
    extractContext: extractDiscordContext,
  };

  console.log('[TabTab Discord] Extractor loaded');
})();
