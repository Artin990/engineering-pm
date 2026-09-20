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

-- ============================================================
-- Auto-Claim Trigger & Function for Pending Project Invitations
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_project_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- بررسی و تبدیل تمام دعوت‌نامه‌های معلق برای ایمیل ثبت‌نام شده
  FOR v_inv IN
    SELECT pi.id, pi.project_id, pi.role, p.workspace_id
    FROM public.project_invitations pi
    JOIN public.projects p ON p.id = pi.project_id
    WHERE LOWER(pi.email) = LOWER(NEW.email)
      AND pi.accepted_at IS NULL
  LOOP
    -- ۱. افزودن کاربر به ورک‌اسپیس پروژه در صورت عدم عضویت
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_inv.workspace_id, NEW.id, 'member'::public.workspace_role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    -- ۲. افزودن به اعضای پروژه با نقش مشخص‌شده در دعوت‌نامه
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_inv.project_id, NEW.id, v_inv.role)
    ON CONFLICT (project_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

    -- ۳. به‌روزرسانی وضعیت دعوت‌نامه به پذیرفته‌شده
    UPDATE public.project_invitations
    SET status = 'accepted',
        accepted_at = now()
    WHERE id = v_inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- اتصال تریگر خودکار به جدول profiles
DROP TRIGGER IF EXISTS on_profile_claim_project_invitations ON public.profiles;
CREATE TRIGGER on_profile_claim_project_invitations
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_project_invitations();

