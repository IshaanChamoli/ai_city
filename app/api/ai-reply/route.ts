import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

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

    // Build conversation context from recent messages
    const conversationContext = recentMessages
      .map((msg: any) => `${msg.sender_name}: ${msg.content}`)
      .join('\n');

    const userPrompt = `Recent conversation:\n${conversationContext}\n\nUser message: ${messageContent}\n\nRespond naturally as part of this conversation.`;

    let aiResponse = '';

    // Call the appropriate AI model
    if (botUser.model === 'gpt') {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: botUser.system_prompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });
      aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    } else if (botUser.model === 'claude') {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: botUser.system_prompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      });
      aiResponse = message.content[0].type === 'text' ? message.content[0].text : 'Sorry, I could not generate a response.';
    } else if (botUser.model === 'gemini') {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const prompt = `${botUser.system_prompt}\n\n${userPrompt}`;
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text() || 'Sorry, I could not generate a response.';
    } else {
      return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });
    }

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
