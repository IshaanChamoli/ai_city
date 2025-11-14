'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { CreateAIModal } from '@/components/chat/CreateAIModal';
import { CreateChatModal } from '@/components/chat/CreateChatModal';
import { getInitials } from '@/lib/utils';
import { useChatContext } from '@/contexts/ChatContext';
import { MentionAutocomplete } from '@/components/chat/MentionAutocomplete';

interface Channel {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
}

interface Bot {
  id: string;
  name: string;
  profile_picture: string | null;
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
  const [channelBots, setChannelBots] = useState<Bot[]>([]);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [filteredBots, setFilteredBots] = useState<Bot[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

      // Fetch AI bots in this channel
      const { data: memberBots } = await supabase
        .from('channel_members')
        .select(`
          user_id,
          users:user_id (
            id,
            name,
            profile_picture,
            is_bot
          )
        `)
        .eq('channel_id', channelId);

      if (memberBots) {
        const bots = memberBots
          .map((m: any) => m.users)
          .filter((u: any) => u && u.is_bot)
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            profile_picture: u.profile_picture,
          }));
        setChannelBots(bots);
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

  // Handle input change and @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setNewMessage(value);
    setCursorPosition(cursorPos);

    // Check for @ mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const searchTerm = textBeforeCursor.slice(atIndex + 1).toLowerCase();
      setMentionSearch(searchTerm);

      const filtered = channelBots.filter(bot =>
        bot.name.toLowerCase().includes(searchTerm)
      );

      setFilteredBots(filtered);
      setShowMentionAutocomplete(filtered.length > 0);
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  // Handle bot selection from autocomplete
  const handleBotSelect = (bot: Bot) => {
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = newMessage.slice(cursorPosition);

    const newText = newMessage.slice(0, atIndex) + `@${bot.name} ` + textAfterCursor;
    setNewMessage(newText);
    setShowMentionAutocomplete(false);

    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Extract mentioned bot IDs from message
  const extractMentionedBots = (content: string): string[] => {
    const mentionedBotIds: string[] = [];

    channelBots.forEach(bot => {
      if (content.includes(`@${bot.name}`)) {
        mentionedBotIds.push(bot.id);
      }
    });

    return mentionedBotIds;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setShowMentionAutocomplete(false);

      // Check for mentioned bots
      const mentionedBotIds = extractMentionedBots(messageContent);

      if (mentionedBotIds.length > 0) {
        // Get recent messages for context
        const recentMessages = messages.slice(-10).map(msg => ({
          sender_name: msg.users.name,
          content: msg.content,
        }));

        // Trigger AI responses for each mentioned bot
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
            console.error('Error triggering AI bot:', aiError);
          }
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
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {channel.name || 'Direct Message'}
          </h2>
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
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4 relative">
          {showMentionAutocomplete && (
            <MentionAutocomplete
              bots={filteredBots}
              onSelect={handleBotSelect}
              position={{ top: 60, left: 16 }}
            />
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type a message... (use @ to mention AI bots)"
              disabled={sending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
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
    </div>
  );
}
