// TabTab Content Script
// Detects text fields and shows suggestion popup

(function() {
  'use strict';

  const DEBOUNCE_MS = 300;
  const MIN_TEXT_LENGTH = 10;

  let currentInput = null;
  let currentInputType = null; // 'standard' or 'contenteditable'
  let currentSuggestion = '';
  let popupElement = null;
  let debounceTimer = null;
  let isEnabled = true;
  let isExtensionValid = true;

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      // This will throw if the extension context is invalidated
      return chrome.runtime && chrome.runtime.id && isExtensionValid;
    } catch (e) {
      isExtensionValid = false;
      return false;
    }
  }

  // Safe wrapper for chrome.runtime.sendMessage
  function safeSendMessage(message, callback) {
    if (!isExtensionContextValid()) {
      console.log('[TabTab] Extension context invalidated, skipping message');
      if (callback) callback(null);
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Check if it's an invalidated context error
          const errorMsg = chrome.runtime.lastError.message || '';
          if (errorMsg.includes('Extension context invalidated') || 
              errorMsg.includes('message port closed')) {
            console.log('[TabTab] Extension context invalidated');
            isExtensionValid = false;
            cleanup();
          }
          if (callback) callback(null);
        } else {
          if (callback) callback(response);
        }
      });
    } catch (e) {
      console.log('[TabTab] Error sending message:', e.message);
      isExtensionValid = false;
      if (callback) callback(null);
    }
  }

  // Cleanup function when extension is invalidated
  function cleanup() {
    hidePopup();
    currentSuggestion = '';
    currentInput = null;
    // Remove popup element if it exists
    if (popupElement && popupElement.parentNode) {
      popupElement.parentNode.removeChild(popupElement);
      popupElement = null;
    }
  }

  // Check if extension is enabled
  safeSendMessage({ type: 'GET_ENABLED_STATE' }, (response) => {
    if (response) {
      isEnabled = response.enabled;
    }
  });

  // Listen for enable/disable changes
  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (!isExtensionContextValid()) return;
      
      if (changes.enabled) {
        isEnabled = changes.enabled.newValue;
        if (!isEnabled) {
          hidePopup();
          currentSuggestion = '';
        }
      }
    });
  } catch (e) {
    console.log('[TabTab] Could not add storage listener:', e.message);
  }

  // Create the suggestion popup element
  function createPopup() {
    if (popupElement) return popupElement;
    
    popupElement = document.createElement('div');
    popupElement.id = 'tabtab-suggestion-popup';
    popupElement.setAttribute('aria-hidden', 'true');
    
    // Create inner structure
    popupElement.innerHTML = `
      <div class="tabtab-popup-header">
        <span class="tabtab-popup-icon">⌨️</span>
        <span class="tabtab-popup-title">TabTab Suggestion</span>
        <span class="tabtab-popup-hint">Tab ↹ to accept</span>
      </div>
      <div class="tabtab-popup-content"></div>
    `;
    
    document.body.appendChild(popupElement);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #tabtab-suggestion-popup {
        position: absolute;
        display: none;
        z-index: 2147483647;
        max-width: 500px;
        min-width: 250px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid #334155;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        overflow: hidden;
        animation: tabtab-slide-down 0.2s ease-out;
      }
      
      @keyframes tabtab-slide-down {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .tabtab-popup-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid #334155;
        color: #94a3b8;
        font-size: 12px;
      }
      
      .tabtab-popup-icon {
        font-size: 16px;
      }
      
      .tabtab-popup-title {
        font-weight: 600;
        color: #e2e8f0;
        letter-spacing: 0.01em;
      }
      
      .tabtab-popup-hint {
        margin-left: auto;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        color: #ffffff;
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
      }
      
      .tabtab-popup-content {
        padding: 14px;
        color: #f1f5f9;
        line-height: 1.6;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size: 14px;
      }
      
      /* Light mode styles */
      @media (prefers-color-scheme: light) {
        #tabtab-suggestion-popup {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-color: #e2e8f0;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.05);
        }
        
        .tabtab-popup-header {
          background: rgba(0, 0, 0, 0.02);
          border-bottom-color: #e2e8f0;
          color: #64748b;
        }
        
        .tabtab-popup-title {
          color: #1e293b;
        }
        
        .tabtab-popup-content {
          color: #334155;
        }
      }
    `;
    document.head.appendChild(style);
    
    return popupElement;
  }

  // Position and show the popup above the input
  function showPopup(inputEl, suggestion) {
    if (!suggestion || !inputEl) {
      hidePopup();
      return;
    }

    const popup = createPopup();
    const rect = inputEl.getBoundingClientRect();
    
    // Set the suggestion content
    const contentEl = popup.querySelector('.tabtab-popup-content');
    contentEl.textContent = suggestion;
    
    // Show popup temporarily to measure it
    popup.style.visibility = 'hidden';
    popup.style.display = 'block';
    const popupRect = popup.getBoundingClientRect();
    popup.style.visibility = 'visible';
    
    // Calculate position - ABOVE the input by default
    let left = rect.left + window.scrollX;
    let top = rect.top + window.scrollY - popupRect.height - 8;
    
    // Make sure popup doesn't go off-screen to the right
    const popupWidth = Math.min(500, Math.max(rect.width, 300));
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 20;
    }
    
    // If popup would go above viewport, show it below the input instead
    if (top < window.scrollY + 10) {
      top = rect.bottom + window.scrollY + 8;
    }
    
    popup.style.left = `${Math.max(10, left)}px`;
    popup.style.top = `${Math.max(10, top)}px`;
    popup.style.maxWidth = `${popupWidth}px`;
  }

  // Hide the popup
  function hidePopup() {
    if (popupElement) {
      popupElement.style.display = 'none';
      const contentEl = popupElement.querySelector('.tabtab-popup-content');
      if (contentEl) contentEl.textContent = '';
    }
  }

  // Get text from element based on type
  function getTextFromElement(el, inputType) {
    if (inputType === 'contenteditable') {
      // For complex rich text editors (LinkedIn, Discord, etc.), we need to
      // extract text more carefully to handle nested elements like <p>, <div>, <br>
      let text = '';
      
      // Try innerText first as it usually handles line breaks better
      text = el.innerText || '';
      
      // Clean up the text - remove excessive whitespace but keep intentional line breaks
      text = text.replace(/\n{3,}/g, '\n\n').trim();
      
      // If innerText is empty, try textContent as fallback
      if (!text) {
        text = el.textContent || '';
      }
      
      return text;
    }
    return el.value || '';
  }

  // Check if cursor is at end of text
  function isCursorAtEnd(el, inputType) {
    if (inputType === 'contenteditable') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      
      const range = selection.getRangeAt(0);
      
      // For complex editors (LinkedIn, Discord, etc.), we need a more robust approach
      // Check if cursor is at or near the end of the content
      
      // Method 1: Check if we're in the last text node and at its end
      const lastTextNode = getLastTextNode(el);
      if (lastTextNode) {
        if (range.endContainer === lastTextNode && range.endOffset === lastTextNode.length) {
          return true;
        }
        // Also check if range is after the last text node
        if (range.endContainer === lastTextNode.parentNode && 
            range.endOffset >= Array.from(lastTextNode.parentNode.childNodes).indexOf(lastTextNode)) {
          return true;
        }
      }
      
      // Method 2: Traditional range comparison
      try {
        const endRange = document.createRange();
        endRange.selectNodeContents(el);
        endRange.collapse(false);
        
        if (range.compareBoundaryPoints(Range.END_TO_END, endRange) >= 0) {
          return true;
        }
      } catch (e) {
        // Range comparison can fail with complex DOM structures
      }
      
      // Method 3: Check if cursor is in the last child element and at the end
      // This handles cases like <p>text</p><p><br></p> where cursor is in the last empty p
      const lastChild = getLastMeaningfulChild(el);
      if (lastChild) {
        if (range.endContainer === lastChild || el.contains(range.endContainer)) {
          // Check if there's any text after the cursor position
          const afterRange = document.createRange();
          afterRange.setStart(range.endContainer, range.endOffset);
          afterRange.setEndAfter(el.lastChild || el);
          const textAfter = afterRange.toString().trim();
          if (textAfter === '') {
            return true;
          }
        }
      }
      
      return false;
    }
    
    return el.selectionStart === el.value.length;
  }
  
  // Helper: Get the last text node in an element
  function getLastTextNode(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let lastTextNode = null;
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() !== '') {
        lastTextNode = node;
      }
    }
    // If no non-empty text node, return the last text node anyway
    if (!lastTextNode) {
      const allTextWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      while ((node = allTextWalker.nextNode())) {
        lastTextNode = node;
      }
    }
    return lastTextNode;
  }
  
  // Helper: Get the last meaningful child (non-empty or last child)
  function getLastMeaningfulChild(el) {
    const children = el.childNodes;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== '') {
        return child;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        return child;
      }
    }
    return el.lastChild;
  }

  // Insert text at cursor position
  function insertTextAtCursor(el, text, inputType) {
    if (inputType === 'contenteditable') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // Try using execCommand first as it works better with rich text editors
      // This is the most compatible approach for LinkedIn, Discord, Slack, etc.
      const useExecCommand = tryExecCommand(el, text);
      
      if (!useExecCommand) {
        // Fallback to manual insertion
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        // Check if we need to insert inside a specific element structure
        let insertTarget = range.endContainer;
        
        // If we're in a <br> element or empty element, find the parent
        if (insertTarget.nodeName === 'BR' || 
            (insertTarget.nodeType === Node.ELEMENT_NODE && insertTarget.childNodes.length === 0)) {
          insertTarget = insertTarget.parentNode;
        }
        
        // Create text node
        const textNode = document.createTextNode(text);
        
        // If the current container is a <p> or similar block element with just a <br>, replace the <br>
        if (insertTarget.nodeType === Node.ELEMENT_NODE) {
          const onlyChild = insertTarget.childNodes.length === 1 && 
                           insertTarget.firstChild.nodeName === 'BR';
          if (onlyChild) {
            insertTarget.removeChild(insertTarget.firstChild);
            insertTarget.appendChild(textNode);
          } else {
            range.insertNode(textNode);
          }
        } else {
          range.insertNode(textNode);
        }
        
        // Move cursor to end of inserted text
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      
      // Dispatch various input events to notify the app of changes
      // Different apps listen for different events
      dispatchInputEvents(el, text);
      
    } else {
      const cursorPos = el.selectionStart;
      el.value = el.value.slice(0, cursorPos) + text + el.value.slice(cursorPos);
      const newPos = cursorPos + text.length;
      el.setSelectionRange(newPos, newPos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  // Try to use execCommand for text insertion (better compatibility with rich editors)
  function tryExecCommand(el, text) {
    try {
      // Focus the element first
      el.focus();
      
      // Use insertText command - most compatible with modern editors
      const result = document.execCommand('insertText', false, text);
      
      if (result) {
        console.log('[TabTab] Used execCommand for text insertion');
        return true;
      }
    } catch (e) {
      console.log('[TabTab] execCommand failed:', e);
    }
    return false;
  }
  
  // Dispatch various input events to notify different types of editors
  function dispatchInputEvents(el, text) {
    // Standard input event
    el.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      cancelable: true,
      inputType: 'insertText', 
      data: text 
    }));
    
    // Some editors also listen for these events
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    // KeyboardEvent for editors that track keystrokes
    // This helps with editors that build their state from keyboard events
    try {
      el.dispatchEvent(new KeyboardEvent('keyup', { 
        bubbles: true, 
        cancelable: true,
        key: text.slice(-1) || ' '
      }));
    } catch (e) {
      // KeyboardEvent might not work in all contexts
    }
    
    // Composition events for editors that use IME-style input
    try {
      el.dispatchEvent(new CompositionEvent('compositionend', {
        bubbles: true,
        data: text
      }));
    } catch (e) {
      // CompositionEvent might not work in all contexts
    }
  }

  // Fetch suggestion from background script
  async function fetchSuggestion(text) {
    if (!isExtensionContextValid()) {
      return '';
    }
    
    console.log('[TabTab] Fetching suggestion for text length:', text.length);
    return new Promise((resolve) => {
      safeSendMessage(
        { type: 'GET_SUGGESTION', text },
        (response) => {
          console.log('[TabTab] Got response:', response);
          resolve(response?.suggestion || '');
        }
      );
    });
  }

  // Handle input events with debouncing
  function handleInput(e) {
    if (!isExtensionContextValid()) return;
    
    const el = e.target;
    const inputType = isContentEditable(el) ? 'contenteditable' : 'standard';
    
    console.log('[TabTab] Input event detected, enabled:', isEnabled, 'target:', el.tagName, 'type:', inputType);
    
    if (!isEnabled) return;
    
    // Clear existing suggestion and timer
    currentSuggestion = '';
    hidePopup();
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const text = getTextFromElement(el, inputType);
    
    // Only suggest when cursor is at end of text
    if (!isCursorAtEnd(el, inputType)) {
      console.log('[TabTab] Cursor not at end, skipping');
      return;
    }
    
    // Don't fetch for short text
    if (text.length < MIN_TEXT_LENGTH) {
      console.log('[TabTab] Text too short:', text.length);
      return;
    }
    
    console.log('[TabTab] Will fetch suggestion in', DEBOUNCE_MS, 'ms');
    
    debounceTimer = setTimeout(async () => {
      if (!isCursorAtEnd(el, inputType)) {
        return;
      }
      
      const currentText = getTextFromElement(el, inputType);
      const suggestion = await fetchSuggestion(currentText);
      
      if (document.activeElement === el && isCursorAtEnd(el, inputType) && suggestion) {
        currentSuggestion = suggestion;
        currentInput = el;
        currentInputType = inputType;
        console.log('[TabTab] Showing popup with suggestion:', suggestion);
        showPopup(el, suggestion);
      }
    }, DEBOUNCE_MS);
  }

  // Handle keydown for Tab/Escape
  function handleKeyDown(e) {
    if (!isExtensionContextValid()) return;
    if (!isEnabled || !currentSuggestion || !currentInput) return;
    
    // Tab accepts the suggestion
    if (e.key === 'Tab' && currentSuggestion) {
      e.preventDefault();
      e.stopPropagation();
      
      insertTextAtCursor(currentInput, currentSuggestion, currentInputType);
      
      currentSuggestion = '';
      hidePopup();
      return;
    }
    
    // Escape dismisses the suggestion
    if (e.key === 'Escape' && currentSuggestion) {
      e.preventDefault();
      currentSuggestion = '';
      hidePopup();
      return;
    }
  }

  // Handle focus out - clear suggestion
  function handleBlur(e) {
    setTimeout(() => {
      if (document.activeElement !== e.target) {
        currentSuggestion = '';
        currentInput = null;
        currentInputType = null;
        hidePopup();
      }
    }, 150);
  }

  // Handle scroll - reposition popup
  function handleScroll(e) {
    if (currentSuggestion && currentInput && e.target === currentInput) {
      showPopup(currentInput, currentSuggestion);
    }
  }

  // Check if element is contenteditable
  function isContentEditable(el) {
    if (!el) return false;
    return el.isContentEditable || el.contentEditable === 'true';
  }

  // Check if element is a valid standard text input (input/textarea)
  function isValidStandardInput(el) {
    if (!el) return false;
    
    if (el.dataset?.tabtabNative === 'true') {
      console.log('[TabTab] Skipping native TabTab input');
      return false;
    }
    
    if (el.tagName === 'TEXTAREA') {
      return !el.readOnly && !el.disabled;
    }
    
    if (el.tagName === 'INPUT') {
      const type = el.type?.toLowerCase() || 'text';
      const validTypes = ['text', 'search', 'email', 'url'];
      return validTypes.includes(type) && !el.readOnly && !el.disabled;
    }
    
    return false;
  }

  // Check if element is a valid contenteditable
  function isValidContentEditable(el) {
    if (!el) return false;
    if (el.dataset?.tabtabAttached === 'true') return false;
    if (el.dataset?.tabtabNative === 'true') return false;
    if (!isContentEditable(el)) return false;
    
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 20) return false;
    
    // Check for common rich text editor patterns
    // These are additional indicators that this is a real input field
    const role = el.getAttribute('role');
    const ariaLabel = el.getAttribute('aria-label');
    const ariaMultiline = el.getAttribute('aria-multiline');
    
    // LinkedIn, Discord, Slack, etc. often use role="textbox"
    if (role === 'textbox') {
      console.log('[TabTab] Found textbox role contenteditable:', el.className);
      return true;
    }
    
    // Check for common class patterns in rich text editors
    const className = el.className || '';
    const richEditorPatterns = [
      'msg-form', // LinkedIn
      'editor', // Generic
      'input', // Generic
      'compose', // Email clients
      'message', // Chat apps
      'textbox', // Generic
      'ql-editor', // Quill
      'ProseMirror', // ProseMirror
      'DraftEditor', // Draft.js
      'slate', // Slate.js
      'tiptap', // Tiptap
      'rich-text', // Generic
      'markup', // Discord
    ];
    
    const hasRichEditorClass = richEditorPatterns.some(pattern => 
      className.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (hasRichEditorClass) {
      console.log('[TabTab] Found rich editor contenteditable:', className);
      return true;
    }
    
    // If it has aria-label suggesting it's an input, include it
    if (ariaLabel && (ariaLabel.toLowerCase().includes('message') || 
                       ariaLabel.toLowerCase().includes('write') ||
                       ariaLabel.toLowerCase().includes('type') ||
                       ariaLabel.toLowerCase().includes('compose') ||
                       ariaLabel.toLowerCase().includes('reply'))) {
      console.log('[TabTab] Found aria-labeled contenteditable:', ariaLabel);
      return true;
    }
    
    // If it's multiline, it's likely a real text input
    if (ariaMultiline === 'true') {
      console.log('[TabTab] Found multiline contenteditable');
      return true;
    }
    
    return true;
  }

  // Attach listeners to a text input
  function attachListeners(input) {
    if (input.dataset?.tabtabAttached === 'true') return;
    
    const inputType = isContentEditable(input) ? 'contenteditable' : 'standard';
    console.log('[TabTab] Attaching listeners to:', input.tagName, inputType, input.id || input.className);
    
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeyDown, true);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('scroll', handleScroll);
    
    // For contenteditable elements, also listen for additional events
    // that rich text editors might use instead of standard input events
    if (inputType === 'contenteditable') {
      // Some editors use keyup instead of input
      input.addEventListener('keyup', handleContentEditableKeyup);
      
      // Some editors use custom events or MutationObserver-based detection
      // We'll use a subtree observer to catch any text changes
      const textObserver = new MutationObserver((mutations) => {
        // Check if extension is still valid
        if (!isExtensionContextValid()) {
          textObserver.disconnect();
          return;
        }
        
        // Debounce the mutation handling
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          if (!isExtensionContextValid()) return;
          if (document.activeElement === input || input.contains(document.activeElement)) {
            handleContentEditableChange(input);
          }
        }, DEBOUNCE_MS);
      });
      
      textObserver.observe(input, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Store observer reference for cleanup
      input._tabtabObserver = textObserver;
    }
    
    input.dataset.tabtabAttached = 'true';
  }
  
  // Handle keyup events for contenteditable (backup for apps that don't fire input events)
  function handleContentEditableKeyup(e) {
    if (!isExtensionContextValid()) return;
    
    // Only process if it's a character key or backspace/delete
    const isCharacterKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
    if (!isCharacterKey) return;
    
    // Don't process if Tab or Escape (handled elsewhere)
    if (e.key === 'Tab' || e.key === 'Escape') return;
    
    // Create a synthetic input-like event handling
    handleInput({ target: e.target });
  }
  
  // Handle contenteditable changes detected by MutationObserver
  function handleContentEditableChange(el) {
    if (!isExtensionContextValid()) return;
    if (!isEnabled) return;
    if (document.activeElement !== el && !el.contains(document.activeElement)) return;
    
    const inputType = 'contenteditable';
    const text = getTextFromElement(el, inputType);
    
    console.log('[TabTab] Content change detected, text length:', text.length);
    
    // Clear existing suggestion
    currentSuggestion = '';
    hidePopup();
    
    // Only suggest when cursor is at end of text
    if (!isCursorAtEnd(el, inputType)) {
      console.log('[TabTab] Cursor not at end, skipping');
      return;
    }
    
    // Don't fetch for short text
    if (text.length < MIN_TEXT_LENGTH) {
      console.log('[TabTab] Text too short:', text.length);
      return;
    }
    
    // Fetch suggestion
    fetchSuggestion(text).then((suggestion) => {
      if (document.activeElement === el || el.contains(document.activeElement)) {
        if (isCursorAtEnd(el, inputType) && suggestion) {
          currentSuggestion = suggestion;
          currentInput = el;
          currentInputType = inputType;
          console.log('[TabTab] Showing popup with suggestion:', suggestion);
          showPopup(el, suggestion);
        }
      }
    });
  }

  // Find and attach to contenteditable elements
  function findContentEditables(root = document) {
    // Standard contenteditable query
    const editables = root.querySelectorAll('[contenteditable="true"]');
    editables.forEach((el) => {
      if (isValidContentEditable(el)) {
        attachListeners(el);
      }
    });
    
    // Also check elements with role="textbox" (common in rich editors)
    const textboxes = root.querySelectorAll('[role="textbox"]');
    textboxes.forEach((el) => {
      if (isContentEditable(el) && isValidContentEditable(el)) {
        attachListeners(el);
      }
    });
    
    // Check for elements with aria-multiline (another pattern used by rich editors)
    const multilines = root.querySelectorAll('[aria-multiline="true"]');
    multilines.forEach((el) => {
      if (isContentEditable(el) && isValidContentEditable(el)) {
        attachListeners(el);
      }
    });
    
    // Check common rich text editor class patterns
    const richEditorSelectors = [
      '.ql-editor', // Quill
      '.ProseMirror', // ProseMirror
      '.DraftEditor-root', // Draft.js
      '[data-slate-editor]', // Slate.js
      '.tiptap', // Tiptap
      '[class*="msg-form"]', // LinkedIn
      '[class*="editor"]', // Generic
      '[class*="compose"]', // Email clients
      '[class*="message-input"]', // Chat apps
      '[class*="markup"]', // Discord
    ];
    
    richEditorSelectors.forEach((selector) => {
      try {
        const elements = root.querySelectorAll(selector);
        elements.forEach((el) => {
          if (isContentEditable(el) && isValidContentEditable(el)) {
            attachListeners(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    // Generic div, p, span check for any remaining contenteditables
    const allElements = root.querySelectorAll('div, p, span, section, article');
    allElements.forEach((el) => {
      if (isValidContentEditable(el)) {
        attachListeners(el);
      }
    });
  }

  // Initialize
  function initialize() {
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      if (isValidStandardInput(input)) {
        attachListeners(input);
      }
    });
    
    findContentEditables();
    
    console.log('[TabTab] Content script initialized (popup mode)');
  }

  // Watch for dynamically added inputs
  const observer = new MutationObserver((mutations) => {
    // Check if extension is still valid
    if (!isExtensionContextValid()) {
      observer.disconnect();
      return;
    }
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (isValidStandardInput(node)) {
            attachListeners(node);
          }
          if (isValidContentEditable(node)) {
            attachListeners(node);
          }
          
          const inputs = node.querySelectorAll?.('input, textarea');
          inputs?.forEach((input) => {
            if (isValidStandardInput(input)) {
              attachListeners(input);
            }
          });
          
          findContentEditables(node);
        }
      });
      
      if (mutation.type === 'attributes' && mutation.attributeName === 'contenteditable') {
        const el = mutation.target;
        if (isValidContentEditable(el)) {
          attachListeners(el);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable']
  });

  // Periodic check for new contenteditables
  const periodicCheckInterval = setInterval(() => {
    // Stop interval if extension is invalidated
    if (!isExtensionContextValid()) {
      clearInterval(periodicCheckInterval);
      return;
    }
    findContentEditables();
  }, 2000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
