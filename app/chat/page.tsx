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

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      setLoading(false);
    };

    loadUserProfile();
  }, [router, supabase]);

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
