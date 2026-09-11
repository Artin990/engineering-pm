-- ============================================================
-- 13. Organization Invite Codes & Subordinate System
-- ============================================================

-- 1. Add invite_code column to workspaces if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'invite_code'
  ) THEN 
    ALTER TABLE public.workspaces ADD COLUMN invite_code varchar(32);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_invite_code_idx" ON public.workspaces (invite_code);

-- 2. Populate invite_code for existing workspaces if null
UPDATE public.workspaces
SET invite_code = UPPER('RC-' || SUBSTRING(COALESCE(slug, id::text) FROM 1 FOR 6) || SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 3))
WHERE invite_code IS NULL;

-- 3. Set standard code for primary admin if exists
UPDATE public.workspaces w
SET invite_code = 'RADAR-185'
FROM public.profiles p
WHERE w.owner_id = p.id 
  AND p.email ILIKE '%amiriartin185%'
  AND (w.invite_code IS NULL OR w.invite_code NOT LIKE 'RADAR-%');

-- 4. Enable RLS on workspaces & workspace_members
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read workspaces" ON public.workspaces;
CREATE POLICY "Allow authenticated read workspaces"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update workspaces" ON public.workspaces;
CREATE POLICY "Allow authenticated insert/update workspaces"
  ON public.workspaces FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read workspace_members" ON public.workspace_members;
CREATE POLICY "Allow authenticated read workspace_members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update workspace_members" ON public.workspace_members;
CREATE POLICY "Allow authenticated insert/update workspace_members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete workspace_members" ON public.workspace_members;
CREATE POLICY "Allow authenticated delete workspace_members"
  ON public.workspace_members FOR DELETE
  TO authenticated
  USING (true);
