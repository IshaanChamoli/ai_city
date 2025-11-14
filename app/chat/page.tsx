'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { CreateChatModal } from '@/components/chat/CreateChatModal';
import { CreateAIModal } from '@/components/chat/CreateAIModal';
import { CreateDMModal } from '@/components/chat/CreateDMModal';
import { useChatContext } from '@/contexts/ChatContext';

export default function ChatPage() {
  const router = useRouter();
  const { userProfile, channels, loading } = useChatContext();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateAIModalOpen, setIsCreateAIModalOpen] = useState(false);
  const [isCreateDMModalOpen, setIsCreateDMModalOpen] = useState(false);

  const handleChannelCreated = (channelId: string) => {
    // Navigate to the newly created channel
    router.push(`/chat/${channelId}`);
  };

  const handleAICreated = (aiUserId: string) => {
    console.log('AI bot created:', aiUserId);
    // Just close modal, user can now add this AI to channels
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
        onCreateAI={() => setIsCreateAIModalOpen(true)}
        onCreateDM={() => setIsCreateDMModalOpen(true)}
        channels={channels}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex items-center justify-center relative">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome, {userProfile.name}!
          </h2>
          <p className="text-gray-600 mb-4">
            Click "Direct Messages" or "Create Group Chat" to start a conversation
          </p>
        </div>

        {/* Create DM Modal */}
        <CreateDMModal
          isOpen={isCreateDMModalOpen}
          onClose={() => setIsCreateDMModalOpen(false)}
          currentUserId={userProfile.id}
          onDMCreated={handleChannelCreated}
        />

        {/* Create Chat Modal - positioned relative to main area */}
        <CreateChatModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUserId={userProfile.id}
          onChannelCreated={handleChannelCreated}
        />

        {/* Create AI Modal */}
        <CreateAIModal
          isOpen={isCreateAIModalOpen}
          onClose={() => setIsCreateAIModalOpen(false)}
          currentUserId={userProfile.id}
          onAICreated={handleAICreated}
        />
      </main>
    </div>
  );
}
