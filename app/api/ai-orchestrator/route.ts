import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenRouter client
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

interface Bot {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
}

export async function POST(request: NextRequest) {
  try {
    const { channelId, newMessage, recentMessages } = await request.json();

    const supabase = await createClient();

    // Get all AI bots in this channel
    const { data: memberBots } = await supabase
      .from('channel_members')
      .select(`
        user_id,
        users:user_id (
          id,
          name,
          system_prompt,
          model,
          is_bot
        )
      `)
      .eq('channel_id', channelId);

    if (!memberBots || memberBots.length === 0) {
      return NextResponse.json({ shouldRespond: false });
    }

    const bots: Bot[] = memberBots
      .map((m: any) => m.users)
      .filter((u: any) => u && u.is_bot)
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        system_prompt: u.system_prompt,
        model: u.model,
      }));

    if (bots.length === 0) {
      return NextResponse.json({ shouldRespond: false });
    }

    // Build conversation history for context
    const conversationHistory = recentMessages
      .map((msg: any) => `${msg.sender_name}${msg.is_bot ? ' (AI Bot)' : ''}: ${msg.content}`)
      .join('\n');

    const newMessageText = `${newMessage.sender_name}: ${newMessage.content}`;

    // Create the orchestrator prompt
    const botList = bots.map(b => `- ${b.name}: ${b.system_prompt.slice(0, 100)}...`).join('\n');

    const orchestratorPrompt = `You are an AI conversation orchestrator. Your job is to analyze a chat conversation and decide which AI bot (if any) should respond to the latest message.

IMPORTANT: Be conservative - only trigger a bot when it clearly makes sense. NOT every message needs a bot response. Let humans talk naturally without AI interruption unless the AI is actually needed.

Available AI bots in this channel:
${botList}

Recent conversation history:
${conversationHistory}

Latest message:
${newMessageText}

Analyze the conversation and determine if ANY bot should respond. Only say yes if:
1. The message is a question or request that matches a bot's expertise
2. Someone is directly talking to/about a specific bot
3. The conversation thread is actively engaging with a bot
4. There's a clear need for AI assistance

DO NOT respond if:
- It's casual human-to-human conversation
- It's a greeting, acknowledgment, or social chat
- The message doesn't need AI input
- Humans are just talking normally

Respond with ONLY a JSON object in this exact format:
{
  "shouldRespond": true or false,
  "botName": "exact bot name" or null,
  "reasoning": "brief explanation"
}

If no bot should respond (which should be most of the time), use: {"shouldRespond": false, "botName": null, "reasoning": "explanation"}`;

    // Call the orchestrator AI (gpt-4o-mini)
    const completion = await openrouter.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a JSON-only response bot. Always respond with valid JSON only, no additional text.' },
        { role: 'user', content: orchestratorPrompt },
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse the orchestrator's decision
    let decision;
    try {
      decision = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse orchestrator response:', responseText);
      return NextResponse.json({ shouldRespond: false });
    }

    if (!decision.shouldRespond || !decision.botName) {
      return NextResponse.json({ shouldRespond: false });
    }

    // Find the bot that should respond
    const selectedBot = bots.find(b => b.name === decision.botName);
    if (!selectedBot) {
      console.error('Bot not found:', decision.botName);
      return NextResponse.json({ shouldRespond: false });
    }

    return NextResponse.json({
      shouldRespond: true,
      botId: selectedBot.id,
      botName: selectedBot.name,
      reasoning: decision.reasoning,
    });
  } catch (error: any) {
    console.error('Orchestrator error:', error);
    return NextResponse.json({ shouldRespond: false, error: error.message }, { status: 500 });
  }
}
