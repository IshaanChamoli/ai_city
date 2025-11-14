'use client';

import { getInitials } from '@/lib/utils';
import { useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
}

interface UserSelectorProps {
  users: User[];
  selectedUserIds: string[];
  onToggleUser: (userId: string) => void;
  currentUserId: string;
}

export function UserSelector({ users, selectedUserIds, onToggleUser, currentUserId }: UserSelectorProps) {
  // Filter out current user
  const availableUsers = users.filter(u => u.id !== currentUserId);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Members
      </label>
      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
        {availableUsers.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 text-center">No other users available</p>
        ) : (
          availableUsers.map((user) => {
            const isSelected = selectedUserIds.includes(user.id);
            return (
              <UserRow
                key={user.id}
                user={user}
                isSelected={isSelected}
                onToggle={() => onToggleUser(user.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function UserRow({ user, isSelected, onToggle }: { user: User; isSelected: boolean; onToggle: () => void }) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 hover:bg-blue-100' : ''
      }`}
    >
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold overflow-hidden">
          {user.profile_picture && !imageError ? (
            <img
              src={user.profile_picture}
              alt={user.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-sm">{getInitials(user.name)}</span>
          )}
        </div>
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs text-gray-500">{user.email}</p>
      </div>
      <div className="flex-shrink-0">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            isSelected
              ? 'bg-blue-600 border-blue-600'
              : 'border-gray-300 bg-white'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
