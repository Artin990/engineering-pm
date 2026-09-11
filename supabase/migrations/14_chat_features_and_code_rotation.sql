-- ============================================================
-- 14. Chat Features (Reply, Edit, Reactions) & Invite Code Rotation
-- Idempotent Migration Script for Supabase PostgreSQL
-- ============================================================

-- 1. Extend chat_messages table with reply, edit, and reactions columns
DO $$ 
BEGIN 
  -- reply_to (JSONB contains id, senderName, message)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'reply_to'
  ) THEN 
    ALTER TABLE public.chat_messages ADD COLUMN reply_to jsonb DEFAULT NULL;
  END IF;

  -- reactions (JSONB contains emoji -> string[] of names/emails)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'reactions'
  ) THEN 
    ALTER TABLE public.chat_messages ADD COLUMN reactions jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- is_edited (boolean flag)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'is_edited'
  ) THEN 
    ALTER TABLE public.chat_messages ADD COLUMN is_edited boolean DEFAULT false;
  END IF;

  -- updated_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'updated_at'
  ) THEN 
    ALTER TABLE public.chat_messages ADD COLUMN updated_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- 2. Extend workspaces table with 10-minute code rotation columns
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'invite_code_expires_at'
  ) THEN 
    ALTER TABLE public.workspaces ADD COLUMN invite_code_expires_at timestamptz DEFAULT (now() + interval '10 minutes');
  END IF;
END $$;

-- 3. Update RLS policies for chat_messages to permit UPDATE (for edits and reactions)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated update chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated update chat_messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated read chat_messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated insert chat_messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated delete chat_messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (true);

-- 4. Enable Supabase Realtime Publication for chat_messages if not already added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;
