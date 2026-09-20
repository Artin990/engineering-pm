-- ============================================================
-- 16. Project Invitations & Member Auto-Claim
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  role public.project_role NOT NULL DEFAULT 'contributor',
  invited_by uuid REFERENCES public.profiles(id),
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS project_invitations_project_email_idx 
  ON public.project_invitations (project_id, lower(email));

CREATE INDEX IF NOT EXISTS project_invitations_email_idx 
  ON public.project_invitations (lower(email));

CREATE INDEX IF NOT EXISTS project_invitations_project_idx 
  ON public.project_invitations (project_id);

-- Enable RLS
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view invitations for their email or projects they lead
CREATE POLICY "Users can view relevant project invitations"
  ON public.project_invitations FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt()->>'email')
    OR invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = project_invitations.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role = 'lead'
    )
  );

-- Allow project leads and admins to manage invitations
CREATE POLICY "Project leads can manage project invitations"
  ON public.project_invitations FOR ALL
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = project_invitations.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role = 'lead'
    )
  );
