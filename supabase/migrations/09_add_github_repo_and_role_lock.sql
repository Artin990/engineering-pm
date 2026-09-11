-- ============================================================
-- 09. Add github_repo to projects and Auto-Provision Profile & Member Role
-- ============================================================

-- ۱. اضافه کردن فیلد اتصال مخزن گیت‌هاب به جدول پروژه‌ها
ALTER TABLE "public"."projects" 
ADD COLUMN IF NOT EXISTS "github_repo" varchar(255);

-- ۲. تریگر خودکار برای ساخت پروفایل و تخصیص نقش به محض ثبت‌نام کاربر جدید در Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_is_admin boolean := false;
  v_user_email text;
  v_display_name text;
  v_avatar_url text;
  v_github_login text;
BEGIN
  v_user_email := LOWER(COALESCE(NEW.email, ''));
  
  -- بررسی لیست سفید مدیران
  IF v_user_email IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com') THEN
    v_is_admin := true;
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    split_part(NEW.email, '@', 1),
    'کاربر جدید'
  );

  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  v_github_login := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'github_login',
    NULL
  );

  -- ساخت یا آپدیت سطر در public.profiles
  INSERT INTO public.profiles (id, display_name, avatar_url, github_login, email)
  VALUES (NEW.id, v_display_name, v_avatar_url, v_github_login, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    github_login = COALESCE(EXCLUDED.github_login, public.profiles.github_login),
    email = EXCLUDED.email,
    updated_at = now();

  -- دریافت ورک‌اسپیس پیش‌فرض یا ایجاد آن
  SELECT id INTO v_workspace_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    -- افزودن کاربر به ورک‌اسپیس (ادمین‌ها در نقش admin و سایرین در نقش member)
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (
      v_workspace_id, 
      NEW.id, 
      CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
      role = CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END;
  END IF;

  RETURN NEW;
END;
$$;

-- اتصال تریگر به auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_registration();

-- همگام‌سازی مستقیم کاربران فعلی موجود در auth.users
DO $$
DECLARE
  v_workspace_id uuid;
  u RECORD;
  v_is_admin boolean;
  v_display_name text;
  v_avatar_url text;
  v_github_login text;
BEGIN
  SELECT id INTO v_workspace_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;

  FOR u IN SELECT * FROM auth.users LOOP
    v_is_admin := LOWER(COALESCE(u.email, '')) IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com');
    
    v_display_name := COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'user_name',
      split_part(u.email, '@', 1),
      'کاربر'
    );

    v_avatar_url := COALESCE(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'picture',
      NULL
    );

    v_github_login := COALESCE(
      u.raw_user_meta_data->>'user_name',
      u.raw_user_meta_data->>'github_login',
      NULL
    );

    INSERT INTO public.profiles (id, display_name, avatar_url, github_login, email)
    VALUES (u.id, v_display_name, v_avatar_url, v_github_login, u.email)
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      github_login = COALESCE(EXCLUDED.github_login, public.profiles.github_login),
      email = EXCLUDED.email,
      updated_at = now();

    IF v_workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (
        v_workspace_id, 
        u.id, 
        CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END
      )
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        role = CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END;
    END IF;
  END LOOP;
END $$;
