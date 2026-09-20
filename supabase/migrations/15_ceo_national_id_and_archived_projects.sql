-- ============================================================
-- 15. CEO National ID Verification & Archived Projects
-- ============================================================

-- 1. Add national_id and verification_status to profiles
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'national_id'
  ) THEN 
    ALTER TABLE public.profiles ADD COLUMN national_id varchar(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'verification_status'
  ) THEN 
    ALTER TABLE public.profiles ADD COLUMN verification_status varchar(20) NOT NULL DEFAULT 'verified';
  END IF;
END $$;

-- 2. Add archived_at, approved_by, and success_rate to projects
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'archived_at'
  ) THEN 
    ALTER TABLE public.projects ADD COLUMN archived_at timestamp with time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'approved_by'
  ) THEN 
    ALTER TABLE public.projects ADD COLUMN approved_by uuid REFERENCES public.profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'success_rate'
  ) THEN 
    ALTER TABLE public.projects ADD COLUMN success_rate integer DEFAULT 100;
  END IF;
END $$;

-- 3. Update existing admins to verified status
UPDATE public.profiles
SET verification_status = 'verified'
WHERE email ILIKE '%amiriartin185%' OR email ILIKE '%artinamiri185%';
