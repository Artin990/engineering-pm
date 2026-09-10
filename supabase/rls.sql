-- ============================================================
-- Engineering PM — Row Level Security (Supabase Postgres)
-- اجرا در SQL Editor سوپابیس (یا psql) بعد از مایگریشن Drizzle.
--
-- اصل: هرگز فقط به فرانت اعتماد نکن (RLS + چک سمت سرور).
-- auth.uid() شناسه کاربر سوپابیس است که با profiles.id یکی است.
-- ============================================================

-- ---------- هلپر: عضویت workspace ----------
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(ws_id uuid, allowed workspace_role[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role = any (allowed)
  );
$$;

-- ---------- هلپر: عضویت project (مستقیم یا از طریق admin/owner ورک‌اسپیس) ----------
create or replace function public.is_project_member(prj_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
      select 1 from public.project_members
      where project_id = prj_id and user_id = auth.uid()
    )
    or exists (
      select 1
      from public.projects p
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = prj_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    );
$$;

create or replace function public.has_project_role(prj_id uuid, allowed project_role[])
returns boolean
language sql
stable
as $$
  select exists (
      select 1 from public.project_members
      where project_id = prj_id and user_id = auth.uid() and role = any (allowed)
    )
    or exists (
      select 1
      from public.projects p
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = prj_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    );
$$;

-- ---------- profiles ----------
alter table public.profiles enable row level security;

create policy "profiles: خود یا عضو ورک‌اسپیس ببیند"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.workspace_members wm2
    join public.workspaces w on w.id = wm2.workspace_id
    where wm2.user_id = auth.uid()
      and w.id in (select wm3.workspace_id from public.workspace_members wm3 where wm3.user_id = profiles.id)
  )
);

create policy "profiles: فقط خودم آپدیت کنم"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles: خودکار هنگام ثبت‌نام ساخته شود"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

-- ---------- workspaces ----------
alter table public.workspaces enable row level security;

create policy "workspaces: اعضا ببینند"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy "workspaces: owner/admin ویرایش کند"
on public.workspaces for update
to authenticated
using (public.has_workspace_role(id, array['owner','admin']::workspace_role[]))
with check (public.has_workspace_role(id, array['owner','admin']::workspace_role[]));

create policy "workspaces: کاربر احرازهویت‌شده بسازد (owner خودش)"
on public.workspaces for insert
to authenticated
with check (owner_id = auth.uid());

-- ---------- workspace_members ----------
alter table public.workspace_members enable row level security;

create policy "workspace_members: اعضا لیست را ببینند"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "workspace_members: owner/admin مدیریت کند"
on public.workspace_members for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

-- ---------- teams / team_members ----------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "teams: اعضای ورک‌اسپیس ببینند"
on public.teams for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "teams: admin/owner بنویسد"
on public.teams for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

create policy "team_members: اعضای ورک‌اسپیس ببینند"
on public.team_members for select
to authenticated
using (exists (
  select 1 from public.teams t
  where t.id = team_members.team_id
    and public.is_workspace_member(t.workspace_id)
));

create policy "team_members: admin/owner بنویسد"
on public.team_members for all
to authenticated
using (exists (
  select 1 from public.teams t
  where t.id = team_members.team_id
    and public.has_workspace_role(t.workspace_id, array['owner','admin']::workspace_role[])
))
with check (exists (
  select 1 from public.teams t
  where t.id = team_members.team_id
    and public.has_workspace_role(t.workspace_id, array['owner','admin']::workspace_role[])
));

-- ---------- projects ----------
alter table public.projects enable row level security;

create policy "projects: اعضا (مستقیم یا ورک‌اسپیس) ببینند"
on public.projects for select
to authenticated
using (public.is_project_member(id));

create policy "projects: lead/admin/owner بنویسد"
on public.projects for all
to authenticated
using (public.has_project_role(id, array['lead']::project_role[])
       or public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]))
with check (public.has_project_role(id, array['lead']::project_role[])
       or public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

-- ---------- project_members ----------
alter table public.project_members enable row level security;

create policy "project_members: اعضا ببینند"
on public.project_members for select
to authenticated
using (public.is_project_member(project_id));

create policy "project_members: lead/admin بنویسد"
on public.project_members for all
to authenticated
using (public.has_project_role(project_id, array['lead']::project_role[]))
with check (public.has_project_role(project_id, array['lead']::project_role[]));

-- ---------- milestones / modules / cycles / issues / labels ----------
alter table public.milestones enable row level security;
alter table public.modules enable row level security;
alter table public.cycles enable row level security;
alter table public.issues enable row level security;
alter table public.labels enable row level security;
alter table public.issue_dependencies enable row level security;
alter table public.issue_comments enable row level security;
alter table public.issue_labels enable row level security;
alter table public.issue_assignees enable row level security;

-- خواندن: هر عضو پروژه
create policy "milestones: read members" on public.milestones for select
to authenticated using (public.is_project_member(project_id));
create policy "modules: read members" on public.modules for select
to authenticated using (public.is_project_member(project_id));
create policy "cycles: read members" on public.cycles for select
to authenticated using (public.is_project_member(project_id));
create policy "issues: read members" on public.issues for select
to authenticated using (public.is_project_member(project_id));
create policy "labels: read members" on public.labels for select
to authenticated using (public.is_project_member(project_id));

-- نوشتن: contributor به‌بالا (lead یا contributor یا admin/owner ورک‌اسپیس)
create policy "milestones: write leads" on public.milestones for all
to authenticated
using (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
with check (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

create policy "modules: write leads" on public.modules for all
to authenticated
using (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
with check (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

create policy "cycles: write leads" on public.cycles for all
to authenticated
using (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
with check (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

create policy "issues: write members" on public.issues for all
to authenticated
using (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
with check (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

create policy "labels: write leads" on public.labels for all
to authenticated
using (public.has_project_role(project_id, array['lead']::project_role[]))
with check (public.has_project_role(project_id, array['lead']::project_role[]));

-- جداول وابسته به ایشو — از طریق پروژه‌ی ایشو
create policy "issue_dependencies: read" on public.issue_dependencies for select
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_dependencies.issue_id
    and public.is_project_member(i.project_id)));

create policy "issue_dependencies: write" on public.issue_dependencies for all
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_dependencies.issue_id
    and public.has_project_role(i.project_id, array['lead','contributor']::project_role[])))
with check (exists (
  select 1 from public.issues i where i.id = issue_dependencies.issue_id
    and public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

create policy "issue_comments: read" on public.issue_comments for select
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_comments.issue_id
    and public.is_project_member(i.project_id)));

create policy "issue_comments: خودم بنویسم/ویرایش کنم" on public.issue_comments for all
to authenticated using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "issue_labels: read" on public.issue_labels for select
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_labels.issue_id
    and public.is_project_member(i.project_id)));

create policy "issue_labels: write" on public.issue_labels for all
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_labels.issue_id
    and public.has_project_role(i.project_id, array['lead','contributor']::project_role[])))
with check (exists (
  select 1 from public.issues i where i.id = issue_labels.issue_id
    and public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

create policy "issue_assignees: read" on public.issue_assignees for select
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_assignees.issue_id
    and public.is_project_member(i.project_id)));

create policy "issue_assignees: write" on public.issue_assignees for all
to authenticated using (exists (
  select 1 from public.issues i where i.id = issue_assignees.issue_id
    and public.has_project_role(i.project_id, array['lead','contributor']::project_role[])))
with check (exists (
  select 1 from public.issues i where i.id = issue_assignees.issue_id
    and public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

-- ---------- GitHub ----------
-- جدول‌های github_* فقط سمت سرور (service-role) نوشته می‌شوند؛
-- کاربر فقط می‌خواند (اعضای پروژه/ورک‌اسپیس).
alter table public.github_installations enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_branches enable row level security;
alter table public.github_commits enable row level security;
alter table public.github_pull_requests enable row level security;
alter table public.github_reviews enable row level security;
alter table public.github_issue_links enable row level security;
alter table public.github_events enable row level security;

create policy "github_installations: اعضا ببینند" on public.github_installations for select
to authenticated using (public.is_workspace_member(workspace_id));

create policy "github_repositories: اعضای پروژه/ورک‌اسپیس ببینند" on public.github_repositories for select
to authenticated using (
  public.is_project_member(project_id)
  or public.is_workspace_member((select installation_id from public.github_installations gi where gi.id = github_repositories.installation_id limit 1))
);

create policy "github_branches: read via repo" on public.github_branches for select
to authenticated using (exists (
  select 1 from public.github_repositories r where r.id = github_branches.repo_id
    and (public.is_project_member(r.project_id))));

create policy "github_commits: read via repo" on public.github_commits for select
to authenticated using (exists (
  select 1 from public.github_repositories r where r.id = github_commits.repo_id
    and public.is_project_member(r.project_id)));

create policy "github_pull_requests: read via repo" on public.github_pull_requests for select
to authenticated using (exists (
  select 1 from public.github_repositories r where r.id = github_pull_requests.repo_id
    and public.is_project_member(r.project_id)));

create policy "github_reviews: read via pr" on public.github_reviews for select
to authenticated using (exists (
  select 1 from public.github_pull_requests pr
  join public.github_repositories r on r.id = pr.repo_id
  where pr.id = github_reviews.pull_request_id
    and public.is_project_member(r.project_id)));

create policy "github_issue_links: read via issue" on public.github_issue_links for select
to authenticated using (exists (
  select 1 from public.issues i where i.id = github_issue_links.issue_id
    and public.is_project_member(i.project_id)));

-- github_events: هیچ دسترسی مستقیمی به کاربر داده نمی‌شود (فقط service-role).
-- (پالیسی‌ای نمی‌سازیم → RLS پیش‌فرض deny-all.)

-- ---------- activities / notifications / documents ----------
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;

create policy "activities: read via project" on public.activities for select
to authenticated using (public.is_project_member(project_id));

-- نوشتن activities فقط سمت سرور (service-role) — پالیسی insert ندارد.

create policy "notifications: فقط خودم" on public.notifications for select
to authenticated using (user_id = auth.uid());

create policy "notifications: فقط خودم علامت بزنم" on public.notifications for update
to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "documents: read via project" on public.documents for select
to authenticated using (public.is_project_member(project_id));

create policy "documents: write via project" on public.documents for all
to authenticated
using (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
with check (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

-- ---------- اعلان‌های Realtime (اختیاری — Supabase Realtime) ----------
-- publish = supabase_realtime برای جدول activities:
-- alter publication supabase_realtime add table public.activities;
