-- ============================================================
-- 11. Project Deletion (Admin / CEO Only)
-- ============================================================

-- تابع امن با سطح دسترسی DEFINER برای حذف کامل پروژه توسط مدیرعامل
CREATE OR REPLACE FUNCTION public.delete_project_by_key_or_id(
  p_project_key text DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
  v_is_caller_admin boolean := false;
  v_project_id uuid;
  v_project_key text;
  v_project_name text;
BEGIN
  -- بررسی هویت فراخوان‌کننده
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'کاربر احراز هویت نشده است.';
  END IF;

  -- بررسی اینکه آیا فراخوان‌کننده مدیرعامل / ادمین ارشد است یا خیر
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF LOWER(COALESCE(v_caller_email, '')) IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com') THEN
    v_is_caller_admin := true;
  END IF;

  IF NOT v_is_caller_admin THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: تنها مدیرعامل و ادمین ارشد سامانه مجاز به حذف پروژه می‌باشند.';
  END IF;

  -- یافتن شناسه و کلید پروژه
  IF p_project_id IS NOT NULL THEN
    SELECT id, key, name INTO v_project_id, v_project_key, v_project_name
    FROM public.projects
    WHERE id = p_project_id;
  ELSIF p_project_key IS NOT NULL THEN
    SELECT id, key, name INTO v_project_id, v_project_key, v_project_name
    FROM public.projects
    WHERE UPPER(key) = UPPER(p_project_key);
  ELSE
    RAISE EXCEPTION 'شناسه یا کلید پروژه مشخص نشده است.';
  END IF;

  IF v_project_id IS NULL THEN
    RETURN json_build_object('success', true, 'message', 'پروژه در دیتابیس یافت نشد یا قبلاً حذف شده است.');
  END IF;

  -- ۱. حذف وابستگی‌های ایشوها و نظرات مربوط به ایشوهای این پروژه
  DELETE FROM public.issue_comments WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issue_dependencies WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id)
    OR depends_on_issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issue_labels WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issue_assignees WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.github_issue_links WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);

  -- ۲. حذف ایشوهای پروژه
  DELETE FROM public.issues WHERE project_id = v_project_id;

  -- ۳. حذف سایکل‌ها، مایلستون‌ها و ماژول‌ها
  DELETE FROM public.cycles WHERE project_id = v_project_id;
  DELETE FROM public.milestones WHERE project_id = v_project_id;
  DELETE FROM public.modules WHERE project_id = v_project_id;

  -- ۴. حذف اعضای پروژه، فعالیت‌ها، مستندات و گیت‌هاب
  DELETE FROM public.project_members WHERE project_id = v_project_id;
  DELETE FROM public.activities WHERE project_id = v_project_id;
  DELETE FROM public.documents WHERE project_id = v_project_id;
  DELETE FROM public.github_repositories WHERE project_id = v_project_id;

  -- ۵. حذف نهایی از جدول پروژه‌ها
  DELETE FROM public.projects WHERE id = v_project_id;

  RETURN json_build_object(
    'success', true,
    'deletedProjectId', v_project_id,
    'deletedProjectKey', v_project_key,
    'deletedProjectName', v_project_name
  );
END;
$$;

-- اعطای مجوز فراخوانی به کاربران احراز هویت شده
GRANT EXECUTE ON FUNCTION public.delete_project_by_key_or_id(text, uuid) TO authenticated;
