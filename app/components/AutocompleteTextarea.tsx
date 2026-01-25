'use client';

import { useRef, useEffect, KeyboardEvent, ChangeEvent, SyntheticEvent } from 'react';
import { useAutocomplete } from '../hooks/useAutocomplete';

interface AutocompleteTextareaProps {
  placeholder?: string;
  className?: string;
}

export function AutocompleteTextarea({
  placeholder = 'Start typing...',
  className = '',
}: AutocompleteTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const {
    text,
    suggestion,
    cursorPosition,
    setText,
    setCursorPosition,
    acceptSuggestion,
    dismissSuggestion,
    isLoading,
  } = useAutocomplete();

  // Sync scroll position between textarea and mirror
  useEffect(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;

    if (!textarea || !mirror) return;

    const handleScroll = () => {
      mirror.scrollTop = textarea.scrollTop;
      mirror.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener('scroll', handleScroll);
    return () => textarea.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newCursorPos = e.target.selectionStart ?? 0;
    setText(e.target.value, newCursorPos);
  };

  // Track cursor position on selection change (click, arrow keys, etc.)
  const handleSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const newCursorPos = target.selectionStart ?? 0;
    // Only update if cursor actually moved (not during typing which is handled by onChange)
    if (newCursorPos !== cursorPosition) {
      setCursorPosition(newCursorPos);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key accepts the suggestion
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      const newCursorPos = acceptSuggestion();
      // Restore cursor position after React re-renders
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
      return;
    }

    // Escape key dismisses the suggestion
    if (e.key === 'Escape' && suggestion) {
      e.preventDefault();
      dismissSuggestion();
      return;
    }
  };

  // Base styles that must be identical for textarea and mirror
  const sharedStyles = `
    w-full max-w-2xl h-64 p-4 
    font-sans text-base leading-relaxed
    whitespace-pre-wrap break-words
    overflow-auto
  `;

  return (
    <div className="relative w-full max-w-2xl">
      {/* Ghost text mirror layer - shows current text + suggestion */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className={`
          ${sharedStyles}
          absolute inset-0
          pointer-events-none
          border border-transparent
          rounded-lg
          bg-transparent
          ${className}
        `}
        style={{
          // Ensure exact same rendering as textarea
          wordSpacing: 'normal',
          letterSpacing: 'normal',
        }}
      >
        {/* Text before cursor (invisible - for positioning) */}
        <span className="invisible">{text.slice(0, cursorPosition)}</span>
        {/* Ghost suggestion text at cursor position */}
        {suggestion && (
          <span className="text-gray-400">{suggestion}</span>
        )}
        {/* Text after cursor (invisible) */}
        <span className="invisible">{text.slice(cursorPosition)}</span>
      </div>

      {/* Actual textarea layer */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onClick={handleSelect}
        placeholder={placeholder}
        data-tabtab-native="true"
        className={`
          ${sharedStyles}
          relative
          border border-gray-300 rounded-lg
          resize-none
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          bg-white
          caret-black
          ${className}
        `}
        style={{
          // Make textarea background transparent where ghost text shows
          background: 'transparent',
          caretColor: 'black',
        }}
        spellCheck={false}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-2 right-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
