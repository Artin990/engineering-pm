-- ============================================================
-- 10. User Deletion & Self-Account Removal
-- ============================================================

-- تابع امن با سطح دسترسی DEFINER برای حذف کاربر و پاک‌سازی کامل داده‌ها
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_caller_admin boolean := false;
  v_caller_email text;
BEGIN
  -- بررسی هویت فراخوان‌کننده
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'کاربر احراز هویت نشده است.';
  END IF;

  -- بررسی اینکه آیا فراخوان‌کننده ادمین است یا خود کاربر
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF LOWER(COALESCE(v_caller_email, '')) IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com') THEN
    v_is_caller_admin := true;
  END IF;

  -- کاربر فقط می‌تواند اکانت خودش را حذف کند مگر اینکه ادمین کل باشد
  IF v_caller_id <> target_user_id AND NOT v_is_caller_admin THEN
    RAISE EXCEPTION 'شما اجازه حذف حساب سایر کاربران را ندارید.';
  END IF;

  -- ۱. حذف عضویت‌ها در پروژه‌ها و ورک‌اسپیس‌ها
  DELETE FROM public.project_members WHERE user_id = target_user_id;
  DELETE FROM public.workspace_members WHERE user_id = target_user_id;
  DELETE FROM public.team_members WHERE user_id = target_user_id;

  -- ۲. حذف نوتیفیکیشن‌ها و تسک‌های مربوطه
  DELETE FROM public.notifications WHERE user_id = target_user_id;

  -- ۳. حذف پروفایل عمومی
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- ۴. حذف نهایی از جدول احراز هویت auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- اعطای مجوز فراخوانی به کاربران احراز هویت شده
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;
