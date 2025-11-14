'use client';

import { getInitials } from '@/lib/utils';

interface Bot {
  id: string;
  name: string;
  profile_picture: string | null;
}

interface MentionAutocompleteProps {
  bots: Bot[];
  onSelect: (bot: Bot) => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({ bots, onSelect, position }: MentionAutocompleteProps) {
  if (bots.length === 0) return null;

  return (
    <div
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      style={{
        bottom: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '250px'
      }}
    >
      <div className="p-2 text-xs text-gray-500 font-medium border-b border-gray-100">
        Mention AI Bot
      </div>
      {bots.map((bot) => (
        <button
          key={bot.id}
          type="button"
          onClick={() => onSelect(bot)}
          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600">
              {bot.profile_picture ? (
                <img
                  src={bot.profile_picture}
                  alt={bot.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs">{getInitials(bot.name)}</span>
              )}
            </div>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">{bot.name}</p>
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                AI
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
