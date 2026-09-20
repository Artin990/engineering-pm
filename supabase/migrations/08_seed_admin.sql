-- ============================================================
-- 08. Seed Demo & Admin Setup (Optional)
-- ============================================================

-- ساخت یا همگام‌سازی ورک‌اسپیس و پروژه پیش‌فرض
DO $$
DECLARE
  v_user_id uuid;
  v_workspace_id uuid;
  v_project_id uuid;
BEGIN
  -- یافتن اولین کاربر ثبت‌نام شده در auth.users
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- ایجاد یا آپدیت پروفایل
    INSERT INTO public.profiles (id, display_name, email)
    SELECT id, COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)), email
    FROM auth.users
    WHERE id = v_user_id
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      email = EXCLUDED.email;

    -- بررسی وجود ورک‌اسپیس
    SELECT id INTO v_workspace_id FROM public.workspaces WHERE owner_id = v_user_id LIMIT 1;

    IF v_workspace_id IS NULL THEN
      INSERT INTO public.workspaces (name, slug, owner_id)
      VALUES ('ورک‌اسپیس مهندسی RadarCheck', 'engineering-workspace', v_user_id)
      RETURNING id INTO v_workspace_id;

      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (v_workspace_id, v_user_id, 'owner')
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
    END IF;

    -- بررسی وجود پروژه نمونه PM
    SELECT id INTO v_project_id FROM public.projects WHERE workspace_id = v_workspace_id AND key = 'PM' LIMIT 1;

    IF v_project_id IS NULL THEN
      INSERT INTO public.projects (workspace_id, key, name, description, status, health, owner_id)
      VALUES (v_workspace_id, 'PM', 'سامانه مدیریت مهندسی RadarCheck', 'پروژه اصلی مدیریت و هوش مهندسی تیم', 'active', 'on_track', v_user_id)
      RETURNING id INTO v_project_id;

      INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (v_project_id, v_user_id, 'lead')
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
    END IF;
  END IF;
END $$;
