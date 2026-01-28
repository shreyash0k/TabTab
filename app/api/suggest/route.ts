import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// App display names for prompts
const APP_NAMES: Record<string, string> = {
  discord: 'Discord',
  linkedin: 'LinkedIn',
  slack: 'Slack',
  twitter: 'Twitter/X',
};

// Build system prompt based on app context, custom tone, and suggestion length
function buildSystemPrompt(app: string | null, context: string[], customTone: string | null, suggestionLength: 'short' | 'normal' = 'short'): string {
  const lengthInstruction = suggestionLength === 'short' 
    ? '- Keep it VERY brief: just a few words to complete the current thought (5-15 words max)'
    : '- Keep it brief: 1-2 sentences or a short phrase';

  const baseRules = `Rules:
- Output ONLY the continuation text, nothing else
${lengthInstruction}
- If the input does not end with a space and your continuation starts with a new word, begin your output with a space
- Use correct punctuation and capitalization
- Match the style and tone of the existing text
- Do not repeat any part of the input text
- Do not add explanations or meta-commentary
- If the text ends mid-sentence, complete that sentence first
- Be natural and contextually appropriate
- IMPORTANT: If the user has written a question, do NOT answer it - they are asking someone else. Instead, suggest a follow-up thought or leave it as-is.`;

  // Build tone instruction
  const toneInstruction = customTone 
    ? `Use a ${customTone} tone in your response.`
    : '';

  // If we have app-specific context, include it
  if (context && context.length > 0) {
    const conversationContext = context.map((msg) => `- ${msg}`).join('\n');
    const appName = app ? APP_NAMES[app] || app : 'this app';
    
    if (app === 'twitter') {
      return `You are a text completion assistant helping someone write a ${appName} reply or comment. Your task is to continue their text naturally based on the tweet(s) they're replying to.${customTone ? ` ${toneInstruction}` : ' Keep it concise and engaging, appropriate for Twitter\'s format.'}

Tweet(s) being replied to:
${conversationContext}

The user is now typing their reply. Continue their text naturally, considering the tweet context above.

${baseRules}`;
    }
    
    // Generic app with context (Discord, LinkedIn, Slack, etc.)
    return `You are a text completion assistant helping someone write a ${appName} message. Your task is to continue their text naturally based on the conversation context.${customTone ? ` ${toneInstruction}` : ''}

Recent conversation:
${conversationContext}

The user is now typing their response. Continue their text naturally, considering the conversation above.

${baseRules}`;
  }

  // Default prompt without context
  return `You are a text completion assistant. Your task is to continue the user's text naturally.${customTone ? ` ${toneInstruction}` : ''}

${baseRules}`;
}

// Get max tokens based on suggestion length setting
function getMaxTokens(suggestionLength: 'short' | 'normal'): number {
  return suggestionLength === 'short' ? 25 : 50;
}

export async function POST(request: NextRequest) {
  try {
    const { text, context = [], app = null, customTone = null, suggestionLength = 'short' } = await request.json();
    
    console.log('[TabTab API] Received request, text length:', text?.length, 'context:', context?.length, 'app:', app, 'customTone:', customTone, 'suggestionLength:', suggestionLength);

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Skip if text is too short
    if (text.length < 5) {
      return NextResponse.json({ suggestion: '' }, { headers: corsHeaders });
    }

    const validSuggestionLength = suggestionLength === 'normal' ? 'normal' : 'short';
    const systemPrompt = buildSystemPrompt(app, context, customTone, validSuggestionLength);
    const maxTokens = getMaxTokens(validSuggestionLength);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      top_p: 0.9,
    });

    let suggestion = completion.choices[0]?.message?.content?.trimEnd() || '';
    
    // Post-process: ensure proper spacing between input and suggestion
    // If input doesn't end with whitespace and suggestion doesn't start with whitespace/punctuation
    if (suggestion && text.length > 0) {
      const lastChar = text[text.length - 1];
      const firstChar = suggestion[0];
      const needsSpace = !/\s/.test(lastChar) && /^[a-zA-Z0-9]/.test(firstChar);
      if (needsSpace) {
        suggestion = ' ' + suggestion;
      }
    }
    
    console.log('[TabTab API] Suggestion generated:', suggestion.substring(0, 50));

    return NextResponse.json({ suggestion }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    
    // Return empty suggestion on error to avoid breaking the UI
    return NextResponse.json({ suggestion: '' }, { headers: corsHeaders });
  }
}
