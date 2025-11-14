'use client';

import { getInitials } from '@/lib/utils';

interface UserProfileProps {
  name: string;
  profilePicture?: string | null;
}

export function UserProfile({ name, profilePicture }: UserProfileProps) {
  return (
    <div className="flex items-center justify-end p-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold overflow-hidden">
        {profilePicture ? (
          <img
            src={profilePicture}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm">{getInitials(name)}</span>
        )}
      </div>
    </div>
  );
}
