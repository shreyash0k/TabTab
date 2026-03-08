// TabTab Content Script
// Detects text fields and shows inline grey text suggestions (Gmail-style)
// Supported: LinkedIn DM (DOM insertion), Slack (overlay mode for Quill editor)

(function() {
  'use strict';

  const DEBOUNCE_MS = 300;
  const MIN_TEXT_LENGTH = 5;
  const MUTATION_THROTTLE_MS = 500;
  const PERIODIC_SCAN_MS = 10000;

  let currentInput = null;
  let currentInputType = null; // 'standard' or 'contenteditable'
  let currentSuggestion = '';
  let debounceTimer = null;
  let isEnabled = true;
  let isExtensionValid = true;
  let mutationThrottleTimer = null;
  let pendingMutations = false;
  let processedElements = new WeakSet();
  let inlineSuggestionSpan = null;
  let overlayElement = null;
  let isManipulatingSuggestion = false;

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
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
    removeInlineSuggestion();
    currentSuggestion = '';
    currentInput = null;
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
          removeInlineSuggestion();
          currentSuggestion = '';
        }
      }
    });
  } catch (e) {
    console.log('[TabTab] Could not add storage listener:', e.message);
  }

  // ─── Element type checks ───────────────────────────────────────────

  function isContentEditable(el) {
    if (!el) return false;
    return el.isContentEditable || el.contentEditable === 'true';
  }

  // Gate: only show inline suggestions on supported site+element combos.
  // Add more sites by adding conditions below.
  function isSupportedInlineSite(el) {
    if (!isContentEditable(el)) return false;

    const className = (el.className || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const role = el.getAttribute('role');

    // LinkedIn DM
    if (window.TabTabLinkedIn?.isLinkedIn()) {
      if (className.includes('msg-form') ||
          role === 'textbox' ||
          ariaLabel.includes('message')) {
        return true;
      }
    }

    // Slack message input
    if (window.TabTabSlack?.isSlack()) {
      if (role === 'textbox' ||
          className.includes('ql-editor') ||
          ariaLabel.includes('message')) {
        return true;
      }
    }

    return false;
  }

  // Editors like Quill (Slack) normalize their DOM, stripping foreign nodes.
  // For these, we render the suggestion as an overlay outside the editor.
  function useOverlayMode(el) {
    if (window.TabTabSlack?.isSlack()) return true;
    const className = (el.className || '').toLowerCase();
    if (className.includes('ql-editor')) return true;
    return false;
  }

  // ─── Inline suggestion functions ───────────────────────────────────

  // Defer resetting the manipulation flag so that async observers/event
  // handlers that fire from our DOM changes still see it as true.
  function endManipulation() {
    setTimeout(() => { isManipulatingSuggestion = false; }, 0);
  }

  function removeInlineSuggestion() {
    // Remove overlay element (used for Quill/Slack)
    if (overlayElement) {
      if (overlayElement.parentNode) {
        overlayElement.parentNode.removeChild(overlayElement);
      }
      overlayElement = null;
    }

    // Remove DOM-inserted span (used for LinkedIn etc.)
    if (inlineSuggestionSpan) {
      isManipulatingSuggestion = true;
      try {
        if (inlineSuggestionSpan.parentNode) {
          inlineSuggestionSpan.parentNode.removeChild(inlineSuggestionSpan);
        }
      } catch (e) {
        console.log('[TabTab] Error removing inline suggestion:', e);
      }
      inlineSuggestionSpan = null;
      endManipulation();
      return;
    }

    // Fallback: remove any orphaned spans in the DOM
    const orphans = document.querySelectorAll('[data-tabtab-inline]');
    if (orphans.length > 0) {
      isManipulatingSuggestion = true;
      orphans.forEach(span => span.remove());
      endManipulation();
    }
  }

  function showInlineSuggestion(el, suggestion) {
    if (!suggestion || !el) {
      removeInlineSuggestion();
      return;
    }

    removeInlineSuggestion();

    if (useOverlayMode(el)) {
      showTooltipSuggestion(el, suggestion);
    } else {
      showDomSuggestion(el, suggestion);
    }
  }

  // Tooltip mode: render suggestion as a small tooltip bubble near the cursor.
  // Used for Quill-based editors (Slack) that normalize their DOM.
  function showTooltipSuggestion(el, suggestion) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(false);
    const cursorRect = range.getBoundingClientRect();

    if (!cursorRect || (cursorRect.width === 0 && cursorRect.height === 0 &&
                        cursorRect.top === 0 && cursorRect.left === 0)) {
      return;
    }

    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-tabtab-overlay', 'true');
    tooltip.innerHTML = `<span class="tabtab-tooltip-text"></span><span class="tabtab-tooltip-hint">Tab</span>`;
    tooltip.querySelector('.tabtab-tooltip-text').textContent = suggestion;

    document.body.appendChild(tooltip);

    // Measure tooltip to position correctly
    const tooltipRect = tooltip.getBoundingClientRect();

    // Default: show above the cursor
    let top = cursorRect.top - tooltipRect.height - 6;
    let left = cursorRect.left;

    // If it would go above the viewport, show below instead
    if (top < 4) {
      top = cursorRect.bottom + 6;
    }

    // Keep within viewport horizontally
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    if (left < 4) left = 4;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    overlayElement = tooltip;
  }

  // DOM mode: insert a grey <span> directly into the contenteditable.
  // Used for editors that don't normalize DOM (LinkedIn).
  function showDomSuggestion(el, suggestion) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    const span = document.createElement('span');
    span.setAttribute('data-tabtab-inline', 'true');
    span.contentEditable = 'false';
    span.textContent = suggestion;

    isManipulatingSuggestion = true;
    try {
      range.collapse(false);
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.setStartBefore(span);
      newRange.setEndBefore(span);
      selection.removeAllRanges();
      selection.addRange(newRange);

      inlineSuggestionSpan = span;
    } catch (e) {
      console.log('[TabTab] Error inserting inline suggestion:', e);
      if (span.parentNode) span.parentNode.removeChild(span);
    }
    endManipulation();
  }

  function acceptInlineSuggestion(el) {
    // Overlay mode (Slack/Quill) -- use currentSuggestion rather than
    // reading from the tooltip DOM which includes the "Tab" hint text.
    if (overlayElement) {
      const text = currentSuggestion;
      removeInlineSuggestion();
      insertTextAtCursor(el, text, 'contenteditable');
      return;
    }

    // DOM mode (LinkedIn)
    if (!inlineSuggestionSpan) return;

    const text = inlineSuggestionSpan.textContent;

    isManipulatingSuggestion = true;
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStartBefore(inlineSuggestionSpan);
      range.setEndBefore(inlineSuggestionSpan);
      selection.removeAllRanges();
      selection.addRange(range);

      if (inlineSuggestionSpan.parentNode) {
        inlineSuggestionSpan.parentNode.removeChild(inlineSuggestionSpan);
      }
      inlineSuggestionSpan = null;
    } catch (e) {
      console.log('[TabTab] Error removing span during accept:', e);
      inlineSuggestionSpan = null;
    }
    endManipulation();

    insertTextAtCursor(el, text, 'contenteditable');
  }

  // ─── Text extraction & cursor helpers ──────────────────────────────

  function getTextFromElement(el, inputType) {
    if (inputType === 'contenteditable') {
      // Clone the element and strip the suggestion span so its text
      // is never sent to the API.
      const clone = el.cloneNode(true);
      clone.querySelectorAll('[data-tabtab-inline]').forEach(s => s.remove());

      let text = clone.innerText || '';
      text = text.replace(/\n{3,}/g, '\n\n').trim();
      if (!text) {
        text = clone.textContent || '';
      }
      return text;
    }
    return el.value || '';
  }

  function isCursorAtEnd(el, inputType) {
    if (inputType === 'contenteditable') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;

      const range = selection.getRangeAt(0);

      // When an inline suggestion span is present the cursor sits right
      // before it. Check whether the only content after the cursor is the
      // suggestion span (i.e. no real user text after cursor).
      if (inlineSuggestionSpan && el.contains(inlineSuggestionSpan)) {
        try {
          const afterRange = document.createRange();
          afterRange.setStart(range.endContainer, range.endOffset);
          afterRange.setEndAfter(el.lastChild || el);

          const fragment = afterRange.cloneContents();
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(fragment);
          tempDiv.querySelectorAll('[data-tabtab-inline]').forEach(s => s.remove());

          if (tempDiv.textContent.trim() === '') {
            return true;
          }
        } catch (e) {
          // fall through to standard checks
        }
      }

      // Method 1: last text node check
      const lastTextNode = getLastTextNode(el);
      if (lastTextNode) {
        if (range.endContainer === lastTextNode && range.endOffset === lastTextNode.length) {
          return true;
        }
        if (range.endContainer === lastTextNode.parentNode && 
            range.endOffset >= Array.from(lastTextNode.parentNode.childNodes).indexOf(lastTextNode)) {
          return true;
        }
      }

      // Method 2: range comparison
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

      // Method 3: last meaningful child
      const lastChild = getLastMeaningfulChild(el);
      if (lastChild) {
        if (range.endContainer === lastChild || el.contains(range.endContainer)) {
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

  // Helper: last text node, skipping the inline suggestion span
  function getLastTextNode(el) {
    const filter = {
      acceptNode(node) {
        if (node.parentElement?.hasAttribute('data-tabtab-inline')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    };

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, filter);
    let lastTextNode = null;
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() !== '') {
        lastTextNode = node;
      }
    }
    if (!lastTextNode) {
      const fallback = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, filter);
      while ((node = fallback.nextNode())) {
        lastTextNode = node;
      }
    }
    return lastTextNode;
  }

  // Helper: last meaningful child, skipping the inline suggestion span
  function getLastMeaningfulChild(el) {
    const children = el.childNodes;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child.nodeType === Node.ELEMENT_NODE && child.hasAttribute('data-tabtab-inline')) {
        continue;
      }
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== '') {
        return child;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        return child;
      }
    }
    return el.lastChild;
  }

  // ─── Text insertion ────────────────────────────────────────────────

  function insertTextAtCursor(el, text, inputType) {
    if (inputType === 'contenteditable') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const useExecCommand = tryExecCommand(el, text);

      if (!useExecCommand) {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        let insertTarget = range.endContainer;

        if (insertTarget.nodeName === 'BR' || 
            (insertTarget.nodeType === Node.ELEMENT_NODE && insertTarget.childNodes.length === 0)) {
          insertTarget = insertTarget.parentNode;
        }

        const textNode = document.createTextNode(text);

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

        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }

      dispatchInputEvents(el, text);

    } else {
      const cursorPos = el.selectionStart;
      el.value = el.value.slice(0, cursorPos) + text + el.value.slice(cursorPos);
      const newPos = cursorPos + text.length;
      el.setSelectionRange(newPos, newPos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function tryExecCommand(el, text) {
    try {
      el.focus();
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

  function dispatchInputEvents(el, text) {
    el.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      cancelable: true,
      inputType: 'insertText', 
      data: text 
    }));

    el.dispatchEvent(new Event('change', { bubbles: true }));

    try {
      el.dispatchEvent(new KeyboardEvent('keyup', { 
        bubbles: true, 
        cancelable: true,
        key: text.slice(-1) || ' '
      }));
    } catch (e) {}

    try {
      el.dispatchEvent(new CompositionEvent('compositionend', {
        bubbles: true,
        data: text
      }));
    } catch (e) {}
  }

  // ─── Custom tone & suggestion fetching ─────────────────────────────

  function getCustomTone(app) {
    return new Promise((resolve) => {
      if (!app || !isExtensionContextValid()) {
        resolve(null);
        return;
      }
      safeSendMessage(
        { type: 'GET_CUSTOM_TONE', app },
        (response) => {
          resolve(response?.customTone || null);
        }
      );
    });
  }

  async function fetchSuggestion(text) {
    if (!isExtensionContextValid()) {
      return '';
    }

    console.log('[TabTab] Fetching suggestion for text length:', text.length);

    let context = [];
    let app = null;

    if (window.TabTabDiscord && window.TabTabDiscord.isDiscord()) {
      app = 'discord';
      context = window.TabTabDiscord.extractContext();
      console.log('[TabTab] Discord context extracted:', context.length, 'messages');
    } else if (window.TabTabLinkedIn && window.TabTabLinkedIn.isLinkedIn()) {
      app = 'linkedin';
      context = window.TabTabLinkedIn.extractContext();
      console.log('[TabTab] LinkedIn context extracted:', context.length, 'messages');
    } else if (window.TabTabSlack && window.TabTabSlack.isSlack()) {
      app = 'slack';
      context = window.TabTabSlack.extractContext();
      console.log('[TabTab] Slack context extracted:', context.length, 'messages');
    } else if (window.TabTabTwitter && window.TabTabTwitter.isTwitter()) {
      app = 'twitter';
      context = window.TabTabTwitter.extractContext();
      console.log('[TabTab] Twitter context extracted:', context.length, 'tweets');
    }

    const customTone = await getCustomTone(app);
    if (customTone) {
      console.log('[TabTab] Using custom tone:', customTone);
    }

    return new Promise((resolve) => {
      safeSendMessage(
        { type: 'GET_SUGGESTION', text, context, app, customTone },
        (response) => {
          console.log('[TabTab] Got response:', response);
          resolve(response?.suggestion || '');
        }
      );
    });
  }

  // ─── Event handlers ────────────────────────────────────────────────

  function handleInput(e) {
    if (!isExtensionContextValid()) return;
    if (isManipulatingSuggestion) return;

    const el = e.target;
    const inputType = isContentEditable(el) ? 'contenteditable' : 'standard';

    console.log('[TabTab] Input event detected, enabled:', isEnabled, 'target:', el.tagName, 'type:', inputType);

    if (!isEnabled) return;
    if (!isSupportedInlineSite(el)) return;

    currentSuggestion = '';
    removeInlineSuggestion();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const text = getTextFromElement(el, inputType);

    if (!isCursorAtEnd(el, inputType)) {
      console.log('[TabTab] Cursor not at end, skipping');
      return;
    }

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
        console.log('[TabTab] Showing inline suggestion:', suggestion);
        showInlineSuggestion(el, suggestion);
      }
    }, DEBOUNCE_MS);
  }

  function handleKeyDown(e) {
    if (!isExtensionContextValid()) return;
    if (!isEnabled || !currentSuggestion || !currentInput) return;

    if (e.key === 'Tab' && currentSuggestion) {
      e.preventDefault();
      e.stopPropagation();

      acceptInlineSuggestion(currentInput);
      currentSuggestion = '';
      return;
    }

    if (e.key === 'Escape' && currentSuggestion) {
      e.preventDefault();
      currentSuggestion = '';
      removeInlineSuggestion();
      return;
    }
  }

  function handleBlur(e) {
    setTimeout(() => {
      if (document.activeElement !== e.target) {
        currentSuggestion = '';
        currentInput = null;
        currentInputType = null;
        removeInlineSuggestion();
      }
    }, 150);
  }

  // Dismiss overlay on any scroll (it uses fixed positioning so it won't follow)
  function handleScroll() {
    if (overlayElement && currentSuggestion) {
      currentSuggestion = '';
      removeInlineSuggestion();
    }
  }

  // ─── Input detection & listener attachment ─────────────────────────

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

  function isValidContentEditable(el) {
    if (!el) return false;
    if (el.dataset?.tabtabAttached === 'true') return false;
    if (el.dataset?.tabtabNative === 'true') return false;
    if (!isContentEditable(el)) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 20) return false;

    const role = el.getAttribute('role');
    const ariaLabel = el.getAttribute('aria-label');
    const ariaMultiline = el.getAttribute('aria-multiline');

    if (role === 'textbox') {
      console.log('[TabTab] Found textbox role contenteditable:', el.className);
      return true;
    }

    const className = el.className || '';
    const richEditorPatterns = [
      'msg-form', 'editor', 'input', 'compose', 'message', 'textbox',
      'ql-editor', 'ProseMirror', 'DraftEditor', 'slate', 'tiptap',
      'rich-text', 'markup',
    ];

    const hasRichEditorClass = richEditorPatterns.some(pattern => 
      className.toLowerCase().includes(pattern.toLowerCase())
    );

    if (hasRichEditorClass) {
      console.log('[TabTab] Found rich editor contenteditable:', className);
      return true;
    }

    if (ariaLabel && (ariaLabel.toLowerCase().includes('message') || 
                       ariaLabel.toLowerCase().includes('write') ||
                       ariaLabel.toLowerCase().includes('type') ||
                       ariaLabel.toLowerCase().includes('compose') ||
                       ariaLabel.toLowerCase().includes('reply'))) {
      console.log('[TabTab] Found aria-labeled contenteditable:', ariaLabel);
      return true;
    }

    if (ariaMultiline === 'true') {
      console.log('[TabTab] Found multiline contenteditable');
      return true;
    }

    return true;
  }

  function attachListeners(input) {
    if (input.dataset?.tabtabAttached === 'true') return;

    const inputType = isContentEditable(input) ? 'contenteditable' : 'standard';
    console.log('[TabTab] Attaching listeners to:', input.tagName, inputType, input.id || input.className);

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeyDown, true);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('scroll', handleScroll);

    if (inputType === 'contenteditable') {
      input.addEventListener('keyup', handleContentEditableKeyup);

      let textObserver = null;
      let observerDebounceTimer = null;

      const startObserving = () => {
        if (textObserver || !isExtensionContextValid()) return;

        textObserver = new MutationObserver((mutations) => {
          if (!isExtensionContextValid()) {
            textObserver.disconnect();
            textObserver = null;
            return;
          }

          if (isManipulatingSuggestion) return;

          // Skip mutations that only involve our inline suggestion span
          const hasRealChange = mutations.some(m => {
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-tabtab-inline')) continue;
              return true;
            }
            for (const node of m.removedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-tabtab-inline')) continue;
              return true;
            }
            if (m.type === 'characterData') {
              return !m.target.parentElement?.hasAttribute('data-tabtab-inline');
            }
            return false;
          });
          if (!hasRealChange) return;

          if (observerDebounceTimer) {
            clearTimeout(observerDebounceTimer);
          }
          observerDebounceTimer = setTimeout(() => {
            if (!isExtensionContextValid()) return;
            if (isManipulatingSuggestion) return;
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
      };

      const stopObserving = () => {
        if (textObserver) {
          textObserver.disconnect();
          textObserver = null;
        }
        if (observerDebounceTimer) {
          clearTimeout(observerDebounceTimer);
          observerDebounceTimer = null;
        }
      };

      input.addEventListener('focus', startObserving);
      input.addEventListener('blur', () => {
        setTimeout(stopObserving, 200);
      });

      if (document.activeElement === input || input.contains(document.activeElement)) {
        startObserving();
      }

      input._tabtabCleanup = stopObserving;
    }

    input.dataset.tabtabAttached = 'true';
  }

  function handleContentEditableKeyup(e) {
    if (!isExtensionContextValid()) return;
    if (isManipulatingSuggestion) return;

    const isCharacterKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
    if (!isCharacterKey) return;
    if (e.key === 'Tab' || e.key === 'Escape') return;

    handleInput({ target: e.target });
  }

  // Route MutationObserver changes through the shared handleInput debounce
  // to avoid duplicate API calls from parallel event sources.
  function handleContentEditableChange(el) {
    if (!isExtensionContextValid()) return;
    if (isManipulatingSuggestion) return;
    handleInput({ target: el });
  }

  // ─── Element discovery ─────────────────────────────────────────────

  function findContentEditables(root = document) {
    const combinedSelector = [
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[aria-multiline="true"]',
      '.ql-editor',
      '.ProseMirror',
      '.DraftEditor-root',
      '[data-slate-editor]',
      '.tiptap'
    ].join(', ');

    try {
      const elements = root.querySelectorAll(combinedSelector);
      elements.forEach((el) => {
        if (processedElements.has(el)) return;
        processedElements.add(el);

        if (isContentEditable(el) && isValidContentEditable(el)) {
          attachListeners(el);
        }
      });
    } catch (e) {
      console.log('[TabTab] Error querying contenteditables:', e);
    }
  }

  function initialize() {
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      if (processedElements.has(input)) return;
      processedElements.add(input);
      if (isValidStandardInput(input)) {
        attachListeners(input);
      }
    });

    findContentEditables();

    console.log('[TabTab] Content script initialized (inline suggestion mode)');
  }

  // ─── Mutation observer for dynamic content ─────────────────────────

  function processPendingMutations() {
    if (!isExtensionContextValid()) return;

    pendingMutations = false;
    mutationThrottleTimer = null;

    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      if (processedElements.has(input)) return;
      processedElements.add(input);
      if (isValidStandardInput(input)) {
        attachListeners(input);
      }
    });

    findContentEditables();
  }

  const observer = new MutationObserver((mutations) => {
    if (!isExtensionContextValid()) {
      observer.disconnect();
      return;
    }

    let hasRelevantChanges = false;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'contenteditable') {
        hasRelevantChanges = true;
        break;
      }
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' ||
                node.hasAttribute?.('contenteditable') ||
                node.querySelector?.('input, textarea, [contenteditable]')) {
              hasRelevantChanges = true;
              break;
            }
          }
        }
      }
      if (hasRelevantChanges) break;
    }

    if (!hasRelevantChanges) return;

    pendingMutations = true;
    if (!mutationThrottleTimer) {
      mutationThrottleTimer = setTimeout(processPendingMutations, MUTATION_THROTTLE_MS);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable']
  });

  const periodicCheckInterval = setInterval(() => {
    if (!isExtensionContextValid()) {
      clearInterval(periodicCheckInterval);
      return;
    }
    if (document.hasFocus()) {
      findContentEditables();
    }
  }, PERIODIC_SCAN_MS);

  // ─── Deferred initialization ───────────────────────────────────────

  function deferredInit() {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        initialize();
      }, { timeout: 2000 });
    } else {
      setTimeout(initialize, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', deferredInit);
  } else {
    deferredInit();
  }
})();
