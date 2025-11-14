'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { CreateAIModal } from '@/components/chat/CreateAIModal';
import { CreateChatModal } from '@/components/chat/CreateChatModal';
import { CreateDMModal } from '@/components/chat/CreateDMModal';
import { EditMembersModal } from '@/components/chat/EditMembersModal';
import { MentionInput } from '@/components/chat/MentionInput';
import { getInitials } from '@/lib/utils';
import { useChatContext } from '@/contexts/ChatContext';

interface Channel {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  other_user_name?: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  users: {
    name: string;
    profile_picture: string | null;
    is_bot: boolean;
  };
}

export default function ChannelPage() {
  const router = useRouter();
  const params = useParams();
  const channelId = params.channelId as string;
  const supabase = createClient();
  const { userProfile, channels, loading: contextLoading } = useChatContext();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isCreateAIModalOpen, setIsCreateAIModalOpen] = useState(false);
  const [isCreateChatModalOpen, setIsCreateChatModalOpen] = useState(false);
  const [isCreateDMModalOpen, setIsCreateDMModalOpen] = useState(false);
  const [isEditMembersModalOpen, setIsEditMembersModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for @ mentions in message
  const checkForMentions = async (content: string): Promise<string[]> => {
    // Get all AI bots in this channel
    const { data: memberBots } = await supabase
      .from('channel_members')
      .select(`
        user_id,
        users:user_id (
          id,
          name,
          is_bot
        )
      `)
      .eq('channel_id', channelId);

    if (!memberBots) return [];

    const bots = memberBots
      .map((m: any) => m.users)
      .filter((u: any) => u && u.is_bot);

    // Check which bots are mentioned with @
    const mentionedBotIds: string[] = [];
    bots.forEach((bot: any) => {
      if (content.includes(`@${bot.name}`)) {
        mentionedBotIds.push(bot.id);
      }
    });

    return mentionedBotIds;
  };

  // Load channel-specific data when channelId changes
  useEffect(() => {
    if (!userProfile) return;

    const loadChannelData = async () => {
      // Optimistic update: Find channel from sidebar data
      const optimisticChannel = channels.find(c => c.id === channelId);
      if (optimisticChannel) {
        setChannel(optimisticChannel);
      }

      // Check if user is a member of this channel (security check)
      const { data: membership } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', channelId)
        .eq('user_id', userProfile.id)
        .single();

      if (!membership) {
        // User is not a member, redirect to main chat
        console.error('Unauthorized access to channel');
        router.push('/chat');
        return;
      }

      // Fetch full channel details (in case sidebar data was stale)
      const { data: channelData } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (channelData) {
        // If it's a DM, fetch the other user's name
        if (!channelData.is_group) {
          const { data: members } = await supabase
            .from('channel_members')
            .select(`
              user_id,
              users:user_id (
                name
              )
            `)
            .eq('channel_id', channelId);

          if (members) {
            const otherMember = members.find((m: any) => m.user_id !== userProfile.id);
            if (otherMember && otherMember.users) {
              setChannel({
                ...channelData,
                other_user_name: (otherMember.users as any).name,
              });
              return;
            }
          }
        }

        setChannel(channelData);
      }

      // Fetch messages with sender info
      const { data: messagesData } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          users:sender_id (
            name,
            profile_picture,
            is_bot
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (messagesData) {
        setMessages(messagesData as any);
      }

    };

    loadChannelData();
  }, [channelId, userProfile, channels, router, supabase]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch the sender info for the new message
          const { data: senderData } = await supabase
            .from('users')
            .select('name, profile_picture, is_bot')
            .eq('id', payload.new.sender_id)
            .single();

          if (senderData) {
            const newMsg: Message = {
              id: payload.new.id,
              content: payload.new.content,
              created_at: payload.new.created_at,
              sender_id: payload.new.sender_id,
              users: senderData,
            };
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile || sending) return;

    await sendMessage();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !userProfile || sending) return;

    setSending(true);
    try {
      // Security check: verify user is still a member before sending
      const { data: membership } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', channelId)
        .eq('user_id', userProfile.id)
        .single();

      if (!membership) {
        throw new Error('You are not authorized to send messages in this channel');
      }

      const messageContent = newMessage.trim();

      // Insert user message
      const { error } = await supabase.from('messages').insert({
        channel_id: channelId,
        sender_id: userProfile.id,
        content: messageContent,
      });

      if (error) throw error;

      setNewMessage('');

      // Get recent messages for context (including the new message we just sent)
      const recentMessages = [
        ...messages.slice(-10).map(msg => ({
          sender_name: msg.users.name,
          content: msg.content,
          is_bot: msg.users.is_bot,
        })),
        {
          sender_name: userProfile.name,
          content: messageContent,
          is_bot: false,
        }
      ];

      // Check if this is a DM (not a group chat)
      if (channel && !channel.is_group) {
        // In DMs, check if the other user is a bot
        const { data: members } = await supabase
          .from('channel_members')
          .select(`
            user_id,
            users:user_id (
              id,
              is_bot
            )
          `)
          .eq('channel_id', channelId);

        if (members) {
          const otherMember = members.find((m: any) => m.user_id !== userProfile.id);
          if (otherMember && otherMember.users && (otherMember.users as any).is_bot) {
            // This is a DM with a bot - bot always responds
            try {
              await fetch('/api/ai-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  botId: otherMember.user_id,
                  channelId,
                  messageContent,
                  recentMessages,
                }),
              });
            } catch (aiError) {
              console.error('Error triggering bot in DM:', aiError);
            }
            return; // Exit early, no need for orchestrator in DMs
          }
        }
      }

      // For group chats, use the normal flow
      // Check for explicit @ mentions
      const mentionedBotIds = await checkForMentions(messageContent);

      if (mentionedBotIds.length > 0) {
        // User explicitly tagged bot(s), trigger them directly
        for (const botId of mentionedBotIds) {
          try {
            await fetch('/api/ai-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                botId,
                channelId,
                messageContent,
                recentMessages,
              }),
            });
          } catch (aiError) {
            console.error('Error triggering mentioned bot:', aiError);
          }
        }
      } else {
        // No explicit mention, ask the orchestrator if any AI should respond
        try {
          const orchestratorResponse = await fetch('/api/ai-orchestrator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId,
              newMessage: {
                sender_name: userProfile.name,
                content: messageContent,
              },
              recentMessages,
            }),
          });

          const orchestratorData = await orchestratorResponse.json();

          if (orchestratorData.shouldRespond && orchestratorData.botId) {
            // Trigger the selected AI bot to respond
            await fetch('/api/ai-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                botId: orchestratorData.botId,
                channelId,
                messageContent,
                recentMessages,
              }),
            });
          }
        } catch (aiError) {
          console.error('Error with AI orchestration:', aiError);
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      if (err.message.includes('not authorized')) {
        router.push('/chat');
      }
    } finally {
      setSending(false);
    }
  };

  const handleAICreated = (aiUserId: string) => {
    console.log('AI bot created:', aiUserId);
    // Just close modal, user can now add this AI to channels
  };

  const handleChannelCreated = (channelId: string) => {
    // Navigate to the newly created channel
    router.push(`/chat/${channelId}`);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - rendered from context */}
      {userProfile && !contextLoading ? (
        <Sidebar
          userName={userProfile.name}
          userProfilePicture={userProfile.profile_picture}
          onCreateChat={() => setIsCreateChatModalOpen(true)}
          onCreateAI={() => setIsCreateAIModalOpen(true)}
          onCreateDM={() => setIsCreateDMModalOpen(true)}
          channels={channels}
        />
      ) : (
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        </aside>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-white">
        {!channel ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">Loading channel...</div>
          </div>
        ) : (
          <>
        {/* Channel Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {channel.name || (channel.other_user_name || 'Direct Chat')}
          </h2>
          {channel.is_group && (
            <button
              onClick={() => setIsEditMembersModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Edit Members
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
              const isOwnMessage = message.sender_id === userProfile?.id;
              const isBot = message.users.is_bot;

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                      isBot ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'
                    }`}>
                      {message.users.profile_picture ? (
                        <img
                          src={message.users.profile_picture}
                          alt={message.users.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm">{getInitials(message.users.name)}</span>
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-sm font-medium ${isOwnMessage ? 'text-blue-600' : 'text-gray-900'}`}>
                        {isOwnMessage ? 'You' : message.users.name}
                      </span>
                      {isBot && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                          Bot
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={`px-4 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content.split(/(@\w+)/g).map((part, i) => {
                          if (part.startsWith('@')) {
                            return (
                              <span
                                key={i}
                                className={`font-semibold ${
                                  isOwnMessage
                                    ? 'text-purple-200'
                                    : 'text-purple-600'
                                }`}
                              >
                                {part}
                              </span>
                            );
                          }
                          return part;
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <MentionInput
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={sendMessage}
              disabled={sending}
              channelId={channelId}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
        </>
        )}
      </main>

      {/* Create DM Modal */}
      <CreateDMModal
        isOpen={isCreateDMModalOpen}
        onClose={() => setIsCreateDMModalOpen(false)}
        currentUserId={userProfile?.id || ''}
        onDMCreated={handleChannelCreated}
      />

      {/* Create Chat Modal */}
      <CreateChatModal
        isOpen={isCreateChatModalOpen}
        onClose={() => setIsCreateChatModalOpen(false)}
        currentUserId={userProfile?.id || ''}
        onChannelCreated={handleChannelCreated}
      />

      {/* Create AI Modal */}
      <CreateAIModal
        isOpen={isCreateAIModalOpen}
        onClose={() => setIsCreateAIModalOpen(false)}
        currentUserId={userProfile?.id || ''}
        onAICreated={handleAICreated}
      />

      {/* Edit Members Modal */}
      {channel && (
        <EditMembersModal
          isOpen={isEditMembersModalOpen}
          onClose={() => setIsEditMembersModalOpen(false)}
          channelId={channelId}
          channelName={channel.name}
          currentUserId={userProfile?.id || ''}
        />
      )}
    </div>
  );
}
