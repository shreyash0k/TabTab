# AGENTS.md

## Project Overview

TabTab is a GitHub Copilot-style text autocomplete web app. It shows inline ghost text suggestions as users type and accepts them with Tab.

## Tech Stack

- Next.js 14 (App Router)
- React 18 with TypeScript
- Tailwind CSS
- Groq API with Llama 3.1 8B for suggestions

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
```

## Environment Setup

Requires `.env.local` with:
```
GROQ_API_KEY=your_key_here
```

## Architecture

```
app/
├── api/suggest/route.ts       # POST endpoint for Groq completions
├── components/
│   └── AutocompleteTextarea.tsx  # Dual-layer ghost text component
├── hooks/
│   └── useAutocomplete.ts     # Debouncing, state, request management
└── page.tsx                   # Main page
```

## Key Implementation Details

### Ghost Text Overlay
Uses dual-layer technique: transparent textarea over a mirror div that renders suggestions in gray at the cursor position.

### Cursor Position Tracking
- Tracks cursor position via `onSelect` and `onClick` events
- Suggestions only appear when cursor is at end of text (avoids ghost text overlap)
- Accepting inserts at cursor position using `setSelectionRange`

### Suggestion Flow
1. User types → 300ms debounce → POST to `/api/suggest` with text before cursor
2. Groq returns completion → displayed as ghost text at cursor
3. Tab accepts (inserts at cursor), Escape dismisses, typing clears

### API Configuration
- Model: `llama-3.1-8b-instant`
- Max tokens: 50
- Minimum input: 10 characters

## Code Style

- Functional React components with hooks
- TypeScript strict mode
- Tailwind for styling
- Client components marked with `'use client'`
