'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const DEBOUNCE_MS = 300;
const MIN_TEXT_LENGTH = 10;

interface UseAutocompleteReturn {
  text: string;
  suggestion: string;
  cursorPosition: number;
  setText: (text: string, cursorPos: number) => void;
  setCursorPosition: (pos: number) => void;
  acceptSuggestion: () => number; // Returns new cursor position
  dismissSuggestion: () => void;
  isLoading: boolean;
}

export function useAutocomplete(): UseAutocompleteReturn {
  const [text, setTextState] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [cursorPosition, setCursorPositionState] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for managing async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestedTextRef = useRef<string>('');
  const lastRequestedCursorRef = useRef<number>(0);

  // Fetch suggestion from API
  const fetchSuggestion = useCallback(async (inputText: string, cursorPos: number) => {
    // Only suggest when cursor is at the end of text (avoids ghost text overlap issues)
    if (cursorPos !== inputText.length) {
      setSuggestion('');
      return;
    }
    
    // Don't fetch for short text
    if (inputText.length < MIN_TEXT_LENGTH) {
      setSuggestion('');
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    lastRequestedTextRef.current = inputText;
    lastRequestedCursorRef.current = cursorPos;

    setIsLoading(true);

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestion');
      }

      const data = await response.json();

      // Only set suggestion if the text and cursor haven't changed since we made the request
      if (lastRequestedTextRef.current === inputText && lastRequestedCursorRef.current === cursorPos) {
        setSuggestion(data.suggestion || '');
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching suggestion:', error);
      setSuggestion('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update cursor position
  const setCursorPosition = useCallback((pos: number) => {
    setCursorPositionState(pos);
    // Clear suggestion when cursor moves (user might be navigating)
    setSuggestion('');
  }, []);

  // Set text with debounced suggestion fetching
  const setText = useCallback(
    (newText: string, cursorPos: number) => {
      setTextState(newText);
      setCursorPositionState(cursorPos);

      // Clear existing suggestion when text changes
      setSuggestion('');

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestion(newText, cursorPos);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestion]
  );

  // Accept the current suggestion - inserts at cursor position
  const acceptSuggestion = useCallback(() => {
    if (suggestion) {
      const newCursorPos = cursorPosition + suggestion.length;
      setTextState((prev) => 
        prev.slice(0, cursorPosition) + suggestion + prev.slice(cursorPosition)
      );
      setCursorPositionState(newCursorPos);
      setSuggestion('');
      return newCursorPos;
    }
    return cursorPosition;
  }, [suggestion, cursorPosition]);

  // Dismiss the current suggestion
  const dismissSuggestion = useCallback(() => {
    setSuggestion('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    text,
    suggestion,
    cursorPosition,
    setText,
    setCursorPosition,
    acceptSuggestion,
    dismissSuggestion,
    isLoading,
  };
}
