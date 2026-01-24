import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Skip if text is too short
    if (text.length < 10) {
      return NextResponse.json({ suggestion: '' });
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

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    
    // Return empty suggestion on error to avoid breaking the UI
    return NextResponse.json({ suggestion: '' });
  }
}
