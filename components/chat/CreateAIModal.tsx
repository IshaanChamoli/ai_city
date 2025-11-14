'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CreateAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onAICreated: (userId: string) => void;
}

const AI_MODELS = [
  { value: 'gpt', label: 'GPT-4' },
  { value: 'claude', label: 'Claude Sonnet' },
  { value: 'gemini', label: 'Gemini' },
];

export function CreateAIModal({ isOpen, onClose, currentUserId, onAICreated }: CreateAIModalProps) {
  const [aiName, setAiName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!aiName.trim()) {
      setError('Please enter an AI name');
      return;
    }

    if (!systemPrompt.trim()) {
      setError('Please enter a system prompt');
      return;
    }

    setLoading(true);

    try {
      // Enhance system prompt with response length guidance
      const enhancedPrompt = `${systemPrompt.trim()}\n\nIMPORTANT: Keep responses slightly short, one sentence max like someone would in a casual chat, unless you clearly need to write more (such as when a long answer is required to explain something properly or when explicitly asked for details).`;

      // Create AI user in users table
      const { data: aiUser, error: aiError } = await supabase
        .from('users')
        .insert({
          name: aiName.trim(),
          email: `${aiName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}@ai.bot`,
          is_bot: true,
          system_prompt: enhancedPrompt,
          model: selectedModel,
          profile_picture: null,
        })
        .select()
        .single();

      if (aiError) {
        console.error('AI creation error:', aiError);
        throw aiError;
      }

      console.log('AI bot created successfully:', aiUser);

      // Success!
      onAICreated(aiUser.id);
      handleClose();
    } catch (err: any) {
      console.error('Error creating AI bot:', err);
      setError(err.message || 'Failed to create AI bot');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAiName('');
    setSystemPrompt('');
    setSelectedModel('claude');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-95">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create AI Bot</h2>
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
          {/* AI Name Input */}
          <div>
            <label htmlFor="aiName" className="block text-sm font-medium text-gray-700 mb-2">
              AI Bot Name
            </label>
            <input
              id="aiName"
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="e.g., Research Assistant"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Model Dropdown */}
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
              AI Model
            </label>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
            >
              {AI_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* System Prompt Textarea */}
          <div>
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-2">
              System Prompt
            </label>
            <textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant that..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
            />
          </div>

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
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create AI Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
