'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const DEBOUNCE_MS = 300;
const MIN_TEXT_LENGTH = 10;

interface UseAutocompleteReturn {
  text: string;
  suggestion: string;
  setText: (text: string) => void;
  acceptSuggestion: () => void;
  dismissSuggestion: () => void;
  isLoading: boolean;
}

export function useAutocomplete(): UseAutocompleteReturn {
  const [text, setTextState] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Refs for managing async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestedTextRef = useRef<string>('');

  // Fetch suggestion from API
  const fetchSuggestion = useCallback(async (inputText: string) => {
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

      // Only set suggestion if the text hasn't changed since we made the request
      if (lastRequestedTextRef.current === inputText) {
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

  // Set text with debounced suggestion fetching
  const setText = useCallback(
    (newText: string) => {
      setTextState(newText);

      // Clear existing suggestion when text changes
      setSuggestion('');

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestion(newText);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestion]
  );

  // Accept the current suggestion
  const acceptSuggestion = useCallback(() => {
    if (suggestion) {
      setTextState((prev) => prev + suggestion);
      setSuggestion('');
    }
  }, [suggestion]);

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
    setText,
    acceptSuggestion,
    dismissSuggestion,
    isLoading,
  };
}
