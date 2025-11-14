'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { getInitials } from '@/lib/utils';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  profile_picture: string | null;
}

interface Channel {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
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

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to load channels
  const loadChannels = async (userId: string) => {
    // First get channel IDs from channel_members
    const { data: memberships, error: memberError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userId);

    if (memberError || !memberships || memberships.length === 0) {
      setChannels([]);
      return;
    }

    // Then get the channel details
    const channelIds = memberships.map((m) => m.channel_id);

    const { data: channelsData } = await supabase
      .from('channels')
      .select('id, name, is_group, created_at')
      .in('id', channelIds)
      .order('created_at', { ascending: false });

    if (channelsData) {
      setChannels(channelsData);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      }

      // Fetch channel details
      const { data: channelData } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (channelData) {
        setChannel(channelData);
      }

      // Load channels
      await loadChannels(user.id);

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
        setMessages(messagesData as Message[]);
      }

      setLoading(false);
    };

    loadData();
  }, [channelId, router, supabase]);

  // Real-time subscription for channel list updates
  useEffect(() => {
    if (!userProfile) return;

    const channelSub = supabase
      .channel('channel_members_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${userProfile.id}`,
        },
        () => {
          loadChannels(userProfile.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [userProfile, supabase]);

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

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        channel_id: channelId,
        sender_id: userProfile.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    );
  }

  if (!userProfile || !channel) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        userName={userProfile.name}
        userProfilePicture={userProfile.profile_picture}
        onCreateChat={() => {}}
        channels={channels}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-white">
        {/* Channel Header */}
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {channel.name || 'Direct Message'}
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
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
      </main>
    </div>
  );
}
