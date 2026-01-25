// Twitter/X Context Extractor
// Extracts tweet content when replying to posts for context-aware suggestions

(function() {
  'use strict';

  const MAX_TWEETS = 5; // Get the original tweet + a few replies in thread

  // Check if current page is Twitter/X
  function isTwitter() {
    return window.location.hostname.includes('twitter.com') || 
           window.location.hostname.includes('x.com');
  }

  // Twitter selectors (multiple fallbacks for stability)
  // Twitter/X uses data-testid attributes which are relatively stable
  const SELECTORS = {
    // Tweet text content
    tweetText: [
      '[data-testid="tweetText"]',
      '[class*="css-"] > span', // Twitter uses generated CSS class names
      'article [lang]', // Tweet text usually has a lang attribute
    ],
    // Tweet article container
    tweetArticle: [
      'article[data-testid="tweet"]',
      'article[role="article"]',
      '[data-testid="tweet"]',
    ],
    // Reply composer area (to identify we're in reply mode)
    replyComposer: [
      '[data-testid="reply"]',
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][data-testid]',
    ],
    // The tweet being replied to (usually the first tweet in the thread view)
    originalTweet: [
      '[data-testid="tweet"]',
      'article[role="article"]',
    ],
    // Thread container
    threadContainer: [
      '[data-testid="cellInnerDiv"]',
      'section[role="region"]',
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
        console.log('[TabTab Twitter] Selector failed:', selector, e.message);
      }
    }
    return [];
  }

  // Extract text from a tweet element
  function extractTweetText(tweetElement) {
    // Try to get tweet text specifically
    const textElements = queryWithFallbacks(SELECTORS.tweetText, tweetElement);
    
    if (textElements.length > 0) {
      // Combine all text spans (tweets can have multiple text nodes)
      const texts = Array.from(textElements)
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0);
      return texts.join(' ');
    }
    
    // Fallback: get text content, filtering out metadata
    const text = tweetElement.textContent || '';
    return text.trim();
  }

  // Main function to extract Twitter context (tweet being replied to)
  function extractTwitterContext() {
    if (!isTwitter()) {
      return [];
    }

    console.log('[TabTab Twitter] Extracting context...');

    try {
      const tweets = [];
      
      // Find all tweet articles on the page
      const tweetArticles = queryWithFallbacks(SELECTORS.tweetArticle);
      
      if (tweetArticles.length > 0) {
        console.log('[TabTab Twitter] Found', tweetArticles.length, 'tweets');
        
        // Get the first few tweets (original + thread context)
        const count = Math.min(tweetArticles.length, MAX_TWEETS);
        for (let i = 0; i < count; i++) {
          const text = extractTweetText(tweetArticles[i]);
          // Filter out very short content (might be metadata)
          if (text && text.length > 10) {
            tweets.push(text);
          }
        }
        
        console.log('[TabTab Twitter] Extracted', tweets.length, 'tweets for context');
        return tweets;
      }

      // Fallback: try to find tweet text directly
      const tweetTexts = queryWithFallbacks(SELECTORS.tweetText);
      
      if (tweetTexts.length > 0) {
        console.log('[TabTab Twitter] Found', tweetTexts.length, 'tweet text elements');
        
        const count = Math.min(tweetTexts.length, MAX_TWEETS);
        for (let i = 0; i < count; i++) {
          const text = (tweetTexts[i].textContent || '').trim();
          if (text && text.length > 10) {
            tweets.push(text);
          }
        }
        
        console.log('[TabTab Twitter] Extracted', tweets.length, 'tweets for context');
        return tweets;
      }

      console.log('[TabTab Twitter] No tweets found');
      return [];

    } catch (error) {
      console.error('[TabTab Twitter] Error extracting context:', error);
      return [];
    }
  }

  // Expose functions globally for use by content.js
  window.TabTabTwitter = {
    isTwitter,
    extractContext: extractTwitterContext,
  };

  console.log('[TabTab Twitter] Extractor loaded');
})();
