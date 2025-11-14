'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Bot {
  id: string;
  name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  channelId: string;
}

export function MentionInput({ value, onChange, onSubmit, disabled, channelId }: MentionInputProps) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredBots, setFilteredBots] = useState<Bot[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Load bots in this channel
  useEffect(() => {
    const loadBots = async () => {
      const { data: memberBots } = await supabase
        .from('channel_members')
        .select(`
          user_id,
          users:user_id (
            id,
            name,
            is_bot
          )
        `)
        .eq('channel_id', channelId);

      if (memberBots) {
        const botList = memberBots
          .map((m: any) => m.users)
          .filter((u: any) => u && u.is_bot)
          .map((u: any) => ({ id: u.id, name: u.name }));
        setBots(botList);
      }
    };

    loadBots();
  }, [channelId, supabase]);

  // Handle input change and detect @ mentions
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    onChange(newValue);

    // Find @ symbol before cursor
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if there's a space after @ (which would end the mention)
      if (!textAfterAt.includes(' ')) {
        // Show autocomplete
        const searchTerm = textAfterAt.toLowerCase();
        const matches = bots.filter(bot =>
          bot.name.toLowerCase().startsWith(searchTerm)
        );

        if (matches.length > 0) {
          setFilteredBots(matches);
          setShowAutocomplete(true);
          setMentionStart(lastAtIndex);
          setSelectedIndex(0);
          return;
        }
      }
    }

    // Hide autocomplete if no valid mention context
    setShowAutocomplete(false);
  };

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredBots.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredBots.length) % filteredBots.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredBots[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Insert selected mention
  const insertMention = (bot: Bot) => {
    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(inputRef.current?.selectionStart || value.length);
    const newValue = `${beforeMention}@${bot.name} ${afterMention}`;

    onChange(newValue);
    setShowAutocomplete(false);

    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = mentionStart + bot.name.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };


  return (
    <div className="relative flex-1">
      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (use @ to mention AI bots)"
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
        autoComplete="off"
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && filteredBots.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filteredBots.map((bot, index) => (
            <button
              key={bot.id}
              type="button"
              onClick={() => insertMention(bot)}
              className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-purple-50 text-purple-900'
                  : 'hover:bg-gray-50 text-gray-900'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-semibold">
                {bot.name[0].toUpperCase()}
              </div>
              <span className="font-medium">{bot.name}</span>
              <span className="ml-auto text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                AI
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
