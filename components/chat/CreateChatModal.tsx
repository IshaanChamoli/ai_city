'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserSelector } from './UserSelector';

interface User {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onChannelCreated: (channelId: string) => void;
}

export function CreateChatModal({ isOpen, onClose, currentUserId, onChannelCreated }: CreateChatModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  // Load all users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, profile_picture')
      .eq('is_bot', false)
      .order('name');

    if (data) {
      setUsers(data);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    if (selectedUserIds.length === 0) {
      setError('Please select at least one member');
      return;
    }

    setLoading(true);

    try {
      // 1. Create channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: groupName.trim(),
          is_group: true,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (channelError) {
        console.error('Channel creation error:', channelError);
        throw channelError;
      }

      console.log('Channel created successfully:', channel);

      // 2. Add current user + selected users as members
      const memberIds = [currentUserId, ...selectedUserIds];
      console.log('Adding members:', memberIds);

      const { data: membersData, error: membersError } = await supabase
        .from('channel_members')
        .insert(
          memberIds.map(userId => ({
            channel_id: channel.id,
            user_id: userId,
          }))
        )
        .select();

      if (membersError) {
        console.error('Members insertion error:', membersError);
        throw membersError;
      }

      console.log('Members added successfully:', membersData);

      // Success!
      onChannelCreated(channel.id);
      handleClose();
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setError(err.message || 'Failed to create group chat');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedUserIds([]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-95">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Group Chat</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Group Name Input */}
          <div>
            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
              Group Chat Name
            </label>
            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Team Discussion"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* User Selector */}
          <UserSelector
            users={users}
            selectedUserIds={selectedUserIds}
            onToggleUser={handleToggleUser}
            currentUserId={currentUserId}
          />

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
