'use client';

import { UserProfile } from './UserProfile';

interface SidebarProps {
  userName: string;
  userProfilePicture?: string | null;
}

export function Sidebar({ userName, userProfilePicture }: SidebarProps) {
  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <p className="text-sm text-gray-500 mb-1">Welcome to</p>
        <h1 className="text-3xl font-bold text-gray-900">AI City</h1>
      </div>

      {/* Content Area (for future channels/conversations) */}
      <div className="flex-1 overflow-y-auto">
        {/* Placeholder for channels/conversations */}
      </div>

      {/* User Profile at bottom */}
      <div className="border-t border-gray-200">
        <UserProfile name={userName} profilePicture={userProfilePicture} />
      </div>
    </aside>
  );
}
