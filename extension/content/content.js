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

  // Check if extension is enabled
  chrome.runtime.sendMessage({ type: 'GET_ENABLED_STATE' }, (response) => {
    if (response) {
      isEnabled = response.enabled;
    }
  });

  // Listen for enable/disable changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue;
      if (!isEnabled) {
        hidePopup();
        currentSuggestion = '';
      }
    }
  });

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
      return el.innerText || el.textContent || '';
    }
    return el.value || '';
  }

  // Check if cursor is at end of text
  function isCursorAtEnd(el, inputType) {
    if (inputType === 'contenteditable') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      
      const range = selection.getRangeAt(0);
      const endRange = document.createRange();
      endRange.selectNodeContents(el);
      endRange.collapse(false);
      
      return range.compareBoundaryPoints(Range.END_TO_END, endRange) >= 0;
    }
    
    return el.selectionStart === el.value.length;
  }

  // Insert text at cursor position
  function insertTextAtCursor(el, text, inputType) {
    if (inputType === 'contenteditable') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    } else {
      const cursorPos = el.selectionStart;
      el.value = el.value.slice(0, cursorPos) + text + el.value.slice(cursorPos);
      const newPos = cursorPos + text.length;
      el.setSelectionRange(newPos, newPos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Fetch suggestion from background script
  async function fetchSuggestion(text) {
    console.log('[TabTab] Fetching suggestion for text length:', text.length);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_SUGGESTION', text },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TabTab] Error:', chrome.runtime.lastError);
            resolve('');
          } else {
            console.log('[TabTab] Got response:', response);
            resolve(response?.suggestion || '');
          }
        }
      );
    });
  }

  // Handle input events with debouncing
  function handleInput(e) {
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
    
    input.dataset.tabtabAttached = 'true';
  }

  // Find and attach to contenteditable elements
  function findContentEditables(root = document) {
    const editables = root.querySelectorAll('[contenteditable="true"]');
    editables.forEach((el) => {
      if (isValidContentEditable(el)) {
        attachListeners(el);
      }
    });
    
    const allDivs = root.querySelectorAll('div, p, span');
    allDivs.forEach((el) => {
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

  setInterval(() => {
    findContentEditables();
  }, 2000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
