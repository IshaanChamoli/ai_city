'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
  is_bot: boolean;
}

interface Member {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
  is_bot: boolean;
  membership_id: string;
}

interface EditMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string | null;
  currentUserId: string;
}

export function EditMembersModal({ isOpen, onClose, channelId, channelName, currentUserId }: EditMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, channelId]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load current members
      const { data: membersData, error: membersError } = await supabase
        .from('channel_members')
        .select(`
          id,
          user_id,
          users:user_id (
            id,
            name,
            email,
            profile_picture,
            is_bot
          )
        `)
        .eq('channel_id', channelId);

      if (membersError) throw membersError;

      const currentMembers = membersData?.map((m: any) => ({
        id: m.users.id,
        name: m.users.name,
        email: m.users.email,
        profile_picture: m.users.profile_picture,
        is_bot: m.users.is_bot,
        membership_id: m.id,
      })) || [];

      setMembers(currentMembers);

      // Load all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, profile_picture, is_bot')
        .order('is_bot', { ascending: true })
        .order('name');

      if (usersError) throw usersError;

      setAllUsers(usersData || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: userId,
        });

      if (error) throw error;

      // Reload data
      await loadData();
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError('Failed to add member');
    }
  };

  const handleRemoveMember = async (membershipId: string, userId: string) => {
    // Don't allow removing yourself
    if (userId === currentUserId) {
      setError('You cannot remove yourself from the channel');
      return;
    }

    try {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;

      // Reload data
      await loadData();
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError('Failed to remove member');
    }
  };

  const availableUsers = allUsers.filter(
    user => !members.some(m => m.id === user.id)
  );

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-95">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Members - {channelName || 'Channel'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Members */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Current Members ({members.length})
            </h3>
            {loading ? (
              <div className="text-center text-gray-500 py-4">Loading...</div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                        member.is_bot ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'
                      }`}>
                        {member.profile_picture ? (
                          <img
                            src={member.profile_picture}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm">{getInitials(member.name)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        {member.is_bot && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            AI
                          </span>
                        )}
                        {member.id === currentUserId && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                    {member.id !== currentUserId && (
                      <button
                        onClick={() => handleRemoveMember(member.membership_id, member.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Members */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Add Members
            </h3>
            {availableUsers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                All users are already members
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                        user.is_bot ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'
                      }`}>
                        {user.profile_picture ? (
                          <img
                            src={user.profile_picture}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm">{getInitials(user.name)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        {user.is_bot && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleAddMember(user.id)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
