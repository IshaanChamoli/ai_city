-- AI Bot Setup: Add system_prompt and model columns to users table

-- STEP 1: Drop foreign key constraint (allows AI bots without auth.users entries)
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

-- STEP 2: Add system_prompt column (only for AI bots)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS system_prompt text;

-- STEP 3: Add model column (only for AI bots: 'gpt', 'claude', or 'gemini')
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS model text;

-- STEP 4: Create a check constraint to ensure model is one of the three options
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS check_model_type;

ALTER TABLE public.users
ADD CONSTRAINT check_model_type
CHECK (model IS NULL OR model IN ('gpt', 'claude', 'gemini'));

-- STEP 5: Index for faster bot queries
CREATE INDEX IF NOT EXISTS idx_users_is_bot ON public.users(is_bot);

-- STEP 6: Comments for documentation
COMMENT ON COLUMN public.users.system_prompt IS 'AI bot system prompt (null for human users)';
COMMENT ON COLUMN public.users.model IS 'AI model: gpt, claude, or gemini (null for human users)';

-- IMPORTANT: After removing the foreign key, make sure your application handles:
-- 1. Human users: Created via auth trigger (id matches auth.users.id)
-- 2. AI bots: Created directly in users table (id is random UUID, not in auth.users)
