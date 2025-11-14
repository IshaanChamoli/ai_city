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

interface CreateDMModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onDMCreated: (channelId: string) => void;
}

export function CreateDMModal({ isOpen, onClose, currentUserId, onDMCreated }: CreateDMModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      // Load all users except current user
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, profile_picture, is_bot')
        .neq('id', currentUserId)
        .order('is_bot', { ascending: true })
        .order('name');

      if (usersError) throw usersError;

      setUsers(usersData || []);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDM = async (otherUserId: string) => {
    setCreating(true);
    setError('');

    try {
      // Check if DM already exists between these two users
      const { data: existingChannels } = await supabase
        .from('channel_members')
        .select(`
          channel_id,
          channels:channel_id (
            id,
            is_group
          )
        `)
        .eq('user_id', currentUserId);

      if (existingChannels) {
        // Find if there's already a DM with this user
        for (const membership of existingChannels) {
          const channel = membership.channels as any;
          if (!channel || channel.is_group) continue;

          // Check if the other user is also in this channel
          const { data: otherMembership } = await supabase
            .from('channel_members')
            .select('id')
            .eq('channel_id', channel.id)
            .eq('user_id', otherUserId)
            .single();

          if (otherMembership) {
            // DM already exists, navigate to it
            onDMCreated(channel.id);
            onClose();
            setCreating(false);
            return;
          }
        }
      }

      // Create new DM channel
      const { data: newChannel, error: channelError } = await supabase
        .from('channels')
        .insert({
          is_group: false,
          name: null,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (channelError) throw channelError;

      // Add both users as members
      const { error: membersError } = await supabase
        .from('channel_members')
        .insert([
          { channel_id: newChannel.id, user_id: currentUserId },
          { channel_id: newChannel.id, user_id: otherUserId },
        ]);

      if (membersError) throw membersError;

      // Navigate to new DM
      onDMCreated(newChannel.id);
      onClose();
    } catch (err: any) {
      console.error('Error creating DM:', err);
      setError('Failed to create direct message');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-95">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Start Direct Message
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading users...</div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleCreateDM(user.id)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
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
                          AI Bot
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
