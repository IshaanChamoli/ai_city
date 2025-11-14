'use client';

import { useRouter, useParams } from 'next/navigation';

interface Channel {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  other_user_name?: string;
}

interface ChannelListProps {
  channels: Channel[];
}

export function ChannelList({ channels }: ChannelListProps) {
  const router = useRouter();
  const params = useParams();
  const currentChannelId = params?.channelId as string | undefined;

  const handleChannelClick = (channelId: string) => {
    router.push(`/chat/${channelId}`);
  };

  if (channels.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No channels yet. Create one to get started!
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {channels.map((channel) => {
        const isActive = channel.id === currentChannelId;

        return (
          <button
            key={channel.id}
            onClick={() => handleChannelClick(channel.id)}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
              isActive
                ? 'border-blue-600 bg-blue-50'
                : 'border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Channel Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isActive ? 'bg-blue-600' : 'bg-gray-200'
              }`}>
                <svg
                  className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {channel.is_group ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  )}
                </svg>
              </div>

              {/* Channel Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  isActive ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {channel.name || (channel.other_user_name ? `${channel.other_user_name}` : 'Direct Chat')}
                </p>
                <p className="text-xs text-gray-500">
                  {channel.is_group ? 'Group' : 'Direct'}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
