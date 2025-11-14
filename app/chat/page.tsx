'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { CreateChatModal } from '@/components/chat/CreateChatModal';

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

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Function to load channels
  const loadChannels = async (userId: string) => {
    console.log('Loading channels for user:', userId);

    // First get channel IDs from channel_members
    const { data: memberships, error: memberError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userId);

    console.log('Memberships:', { memberships, memberError });

    if (memberError) {
      console.error('Error loading memberships:', memberError);
      return;
    }

    if (!memberships || memberships.length === 0) {
      console.log('No memberships found');
      setChannels([]);
      return;
    }

    // Then get the channel details
    const channelIds = memberships.map((m) => m.channel_id);
    console.log('Channel IDs:', channelIds);

    const { data: channelsData, error: channelError } = await supabase
      .from('channels')
      .select('id, name, is_group, created_at')
      .in('id', channelIds)
      .order('created_at', { ascending: false });

    console.log('Channels data:', { channelsData, channelError });

    if (channelError) {
      console.error('Error loading channels:', channelError);
      return;
    }

    if (channelsData) {
      console.log('Setting channels:', channelsData);
      setChannels(channelsData);
    }
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      // Fetch user profile from public.users table
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      }

      // Load initial channels
      await loadChannels(user.id);

      setLoading(false);
    };

    loadUserProfile();
  }, [router, supabase]);

  // Real-time subscription for new channel memberships
  useEffect(() => {
    if (!userProfile) return;

    const channel = supabase
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
          // Reload channels when a new membership is added
          loadChannels(userProfile.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile, supabase]);

  const handleChannelCreated = (channelId: string) => {
    // Navigate to the newly created channel
    router.push(`/chat/${channelId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        userName={userProfile.name}
        userProfilePicture={userProfile.profile_picture}
        onCreateChat={() => setIsCreateModalOpen(true)}
        channels={channels}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex items-center justify-center relative">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome, {userProfile.name}!
          </h2>
          <p className="text-gray-600 mb-4">
            Click "Create Group Chat" to start a conversation
          </p>
        </div>

        {/* Create Chat Modal - positioned relative to main area */}
        <CreateChatModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUserId={userProfile.id}
          onChannelCreated={handleChannelCreated}
        />
      </main>
    </div>
  );
}
