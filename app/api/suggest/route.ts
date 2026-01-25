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

// Build system prompt based on app context
function buildSystemPrompt(app: string | null, context: string[]): string {
  const baseRules = `Rules:
- Output ONLY the continuation text, nothing else
- Keep it brief 1-2 sentences or a few words 
- If the input does not end with a space and your continuation starts with a new word, begin your output with a space
- Use correct punctuation and capitalization
- Match the style and tone of the existing text
- Do not repeat any part of the input text
- Do not add explanations or meta-commentary
- If the text ends mid-sentence, complete that sentence first
- Be natural and contextually appropriate`;

  // If we have app-specific context, include it
  if (context && context.length > 0) {
    const conversationContext = context.map((msg) => `- ${msg}`).join('\n');
    
    if (app === 'discord') {
      return `You are a text completion assistant helping someone write a Discord message. Your task is to continue their text naturally based on the conversation context.

Recent conversation:
${conversationContext}

The user is now typing their response. Continue their text naturally, considering the conversation above.

${baseRules}`;
    }
    
    if (app === 'linkedin') {
      return `You are a text completion assistant helping someone write a LinkedIn message. Your task is to continue their text naturally based on the conversation context. Keep the tone professional yet friendly, appropriate for LinkedIn networking.

Recent conversation:
${conversationContext}

The user is now typing their response. Continue their text naturally, considering the conversation above.

${baseRules}`;
    }
  }

  // Default prompt without context
  return `You are a text completion assistant. Your task is to continue the user's text naturally.

${baseRules}`;
}

export async function POST(request: NextRequest) {
  try {
    const { text, context = [], app = null } = await request.json();
    
    console.log('[TabTab API] Received request, text length:', text?.length, 'context:', context?.length, 'app:', app);

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Skip if text is too short
    if (text.length < 10) {
      return NextResponse.json({ suggestion: '' }, { headers: corsHeaders });
    }

    const systemPrompt = buildSystemPrompt(app, context);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
      max_tokens: 50,
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
