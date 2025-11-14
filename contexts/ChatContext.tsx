'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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

interface ChatContextType {
  userProfile: UserProfile | null;
  channels: Channel[];
  loading: boolean;
  loadChannels: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Function to load channels - SINGLE SOURCE OF TRUTH
  const loadChannels = async () => {
    if (!userProfile) return;

    // First get channel IDs from channel_members
    const { data: memberships, error: memberError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userProfile.id);

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

  // Load user profile on mount - ONCE
  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      }

      setLoading(false);
    };

    loadUserProfile();
  }, [router, supabase]);

  // Load channels when user profile is available
  useEffect(() => {
    if (userProfile) {
      loadChannels();
    }
  }, [userProfile]);

  // Real-time subscription for new channel memberships - SINGLE SUBSCRIPTION
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
          loadChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [userProfile, supabase]);

  return (
    <ChatContext.Provider value={{ userProfile, channels, loading, loadChannels }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
