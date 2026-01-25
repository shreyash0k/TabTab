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

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    console.log('[TabTab API] Received request, text length:', text?.length);

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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a text completion assistant. Your task is to continue the user's text naturally.
Rules:
- Output ONLY the continuation text, nothing else
- Keep it brief: 1-2 short sentences or a few words maximum
- Match the style and tone of the existing text
- Do not repeat any part of the input text
- Do not add explanations or meta-commentary
- If the text ends mid-sentence, complete that sentence first
- Be natural and contextually appropriate`,
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

    const suggestion = completion.choices[0]?.message?.content?.trim() || '';
    
    console.log('[TabTab API] Suggestion generated:', suggestion.substring(0, 50));

    return NextResponse.json({ suggestion }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    
    // Return empty suggestion on error to avoid breaking the UI
    return NextResponse.json({ suggestion: '' }, { headers: corsHeaders });
  }
}
