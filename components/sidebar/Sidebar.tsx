'use client';

import { UserProfile } from './UserProfile';
import { ChannelList } from './ChannelList';

interface Channel {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
}

interface SidebarProps {
  userName: string;
  userProfilePicture?: string | null;
  onCreateChat: () => void;
  channels?: Channel[];
}

export function Sidebar({ userName, userProfilePicture, onCreateChat, channels = [] }: SidebarProps) {
  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <p className="text-sm text-gray-500 mb-1">Welcome to</p>
        <h1 className="text-3xl font-bold text-gray-900">AI City</h1>
      </div>

      {/* Create Chat Button */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onCreateChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group Chat
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Channels
          </h3>
          <ChannelList channels={channels} />
        </div>
      </div>

      {/* User Profile at bottom */}
      <div className="border-t border-gray-200">
        <UserProfile name={userName} profilePicture={userProfilePicture} />
      </div>
    </aside>
  );
}
