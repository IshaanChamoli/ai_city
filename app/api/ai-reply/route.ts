import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenRouter client
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Model mapping for OpenRouter
const MODEL_MAP = {
  gpt: 'openai/gpt-4-turbo',
  claude: 'anthropic/claude-3.5-sonnet',
  gemini: 'google/gemini-pro-1.5',
};

export async function POST(request: NextRequest) {
  try {
    const { botId, channelId, messageContent, recentMessages } = await request.json();

    const supabase = await createClient();

    // Fetch bot details (system_prompt and model)
    const { data: botUser, error: botError } = await supabase
      .from('users')
      .select('name, system_prompt, model, is_bot')
      .eq('id', botId)
      .eq('is_bot', true)
      .single();

    if (botError || !botUser) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (!botUser.system_prompt || !botUser.model) {
      return NextResponse.json({ error: 'Bot not properly configured' }, { status: 400 });
    }

    // Get the OpenRouter model name
    const modelName = MODEL_MAP[botUser.model as keyof typeof MODEL_MAP];
    if (!modelName) {
      return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });
    }

    // Build conversation context from recent messages
    const conversationContext = recentMessages
      .map((msg: any) => `${msg.sender_name}: ${msg.content}`)
      .join('\n');

    const userPrompt = `Recent conversation:\n${conversationContext}\n\nUser message: ${messageContent}\n\nRespond naturally as part of this conversation.`;

    // Call OpenRouter API
    const completion = await openrouter.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: botUser.system_prompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Insert AI response as a message from the bot
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_id: botId,
        content: aiResponse,
      });

    if (insertError) {
      console.error('Error inserting AI message:', insertError);
      return NextResponse.json({ error: 'Failed to send AI response' }, { status: 500 });
    }

    return NextResponse.json({ success: true, response: aiResponse });
  } catch (error: any) {
    console.error('AI reply error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
