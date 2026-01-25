// Slack Context Extractor
// Extracts recent messages from Slack conversations for context-aware suggestions

(function() {
  'use strict';

  const MAX_MESSAGES = 10;

  // Check if current page is Slack
  function isSlack() {
    return window.location.hostname.includes('slack.com') || 
           window.location.hostname.includes('app.slack.com');
  }

  // Slack message selectors (multiple fallbacks for stability)
  const SELECTORS = {
    // Message container/block
    messageBlock: [
      '[data-qa="message_container"]',
      '.c-message_kit__message',
      '.c-message',
      '[class*="c-message_kit__message"]',
      '.p-rich_text_section',
    ],
    // Message text content
    messageText: [
      '.c-message_kit__text',
      '.c-message__body',
      '[data-qa="message-text"]',
      '.p-rich_text_section',
      '[class*="c-message_kit__text"]',
      '.c-message_kit__blocks',
    ],
    // Message list container
    messageList: [
      '.c-virtual_list__scroll_container',
      '[data-qa="message_list"]',
      '.c-message_list',
      '[class*="c-virtual_list"]',
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
        console.log('[TabTab Slack] Selector failed:', selector, e.message);
      }
    }
    return [];
  }

  // Extract text content from a message element
  function extractMessageText(element) {
    // Try to get the message text specifically
    const textElements = queryWithFallbacks(SELECTORS.messageText, element);
    
    if (textElements.length > 0) {
      const text = textElements[0].textContent || '';
      return text.trim();
    }
    
    // Fallback: try to get text from rich text sections
    const richTextSections = element.querySelectorAll('.p-rich_text_section');
    if (richTextSections.length > 0) {
      const text = Array.from(richTextSections)
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0)
        .join(' ');
      return text;
    }
    
    // Last fallback: get text from the element itself
    const text = element.textContent || '';
    return text.trim();
  }

  // Main function to extract Slack conversation context
  function extractSlackContext() {
    if (!isSlack()) {
      return [];
    }

    console.log('[TabTab Slack] Extracting context...');

    try {
      // First try to find message blocks
      const messageBlocks = queryWithFallbacks(SELECTORS.messageBlock);
      
      if (messageBlocks.length > 0) {
        console.log('[TabTab Slack] Found', messageBlocks.length, 'message blocks');
        const messages = [];
        
        // Get last N messages
        const startIndex = Math.max(0, messageBlocks.length - MAX_MESSAGES);
        for (let i = startIndex; i < messageBlocks.length; i++) {
          const text = extractMessageText(messageBlocks[i]);
          // Filter out very short messages (likely reactions or system messages)
          if (text && text.length > 2) {
            messages.push(text);
          }
        }
        
        console.log('[TabTab Slack] Extracted', messages.length, 'messages');
        return messages;
      }

      // Try finding message text elements directly
      const messageTexts = queryWithFallbacks(SELECTORS.messageText);
      
      if (messageTexts.length > 0) {
        console.log('[TabTab Slack] Found', messageTexts.length, 'message text elements');
        const messages = [];
        
        const startIndex = Math.max(0, messageTexts.length - MAX_MESSAGES);
        for (let i = startIndex; i < messageTexts.length; i++) {
          const text = (messageTexts[i].textContent || '').trim();
          if (text && text.length > 2) {
            messages.push(text);
          }
        }
        
        console.log('[TabTab Slack] Extracted', messages.length, 'messages');
        return messages;
      }

      console.log('[TabTab Slack] No messages found');
      return [];

    } catch (error) {
      console.error('[TabTab Slack] Error extracting context:', error);
      return [];
    }
  }

  // Expose functions globally for use by content.js
  window.TabTabSlack = {
    isSlack,
    extractContext: extractSlackContext,
  };

  console.log('[TabTab Slack] Extractor loaded');
})();
