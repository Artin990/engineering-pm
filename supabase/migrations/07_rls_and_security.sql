-- ============================================================
-- 07. Row Level Security (RLS) & Helper Functions
-- ============================================================

-- ---------- هلپر: عضویت workspace ----------
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(ws_id uuid, allowed workspace_role[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role = ANY (allowed)
  );
$$;

-- ---------- هلپر: عضویت project (مستقیم یا از طریق admin/owner ورک‌اسپیس) ----------
CREATE OR REPLACE FUNCTION public.is_project_member(prj_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = prj_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = prj_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.has_project_role(prj_id uuid, allowed project_role[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = prj_id AND user_id = auth.uid() AND role = ANY (allowed)
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = prj_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    );
$$;

-- ---------- profiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: خود یا عضو ورک‌اسپیس ببیند" ON public.profiles;
CREATE POLICY "profiles: خود یا عضو ورک‌اسپیس ببیند"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm2
    JOIN public.workspaces w ON w.id = wm2.workspace_id
    WHERE wm2.user_id = auth.uid()
      AND w.id IN (SELECT wm3.workspace_id FROM public.workspace_members wm3 WHERE wm3.user_id = profiles.id)
  )
);

DROP POLICY IF EXISTS "profiles: فقط خودم آپدیت کنم" ON public.profiles;
CREATE POLICY "profiles: فقط خودم آپدیت کنم"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles: خودکار هنگام ثبت‌نام ساخته شود" ON public.profiles;
CREATE POLICY "profiles: خودکار هنگام ثبت‌نام ساخته شود"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ---------- workspaces ----------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces: اعضا ببینند" ON public.workspaces;
CREATE POLICY "workspaces: اعضا ببینند"
ON public.workspaces FOR SELECT
TO authenticated
USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS "workspaces: owner/admin ویرایش کند" ON public.workspaces;
CREATE POLICY "workspaces: owner/admin ویرایش کند"
ON public.workspaces FOR UPDATE
TO authenticated
USING (public.has_workspace_role(id, array['owner','admin']::workspace_role[]))
WITH CHECK (public.has_workspace_role(id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "workspaces: کاربر احرازهویت‌شده بسازد" ON public.workspaces;
CREATE POLICY "workspaces: کاربر احرازهویت‌شده بسازد"
ON public.workspaces FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- ---------- workspace_members ----------
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members: اعضا لیست را ببینند" ON public.workspace_members;
CREATE POLICY "workspace_members: اعضا لیست را ببینند"
ON public.workspace_members FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_members: owner/admin مدیریت کند" ON public.workspace_members;
CREATE POLICY "workspace_members: owner/admin مدیریت کند"
ON public.workspace_members FOR ALL
TO authenticated
USING (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]))
WITH CHECK (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

-- ---------- teams / team_members ----------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams: اعضای ورک‌اسپیس ببینند" ON public.teams;
CREATE POLICY "teams: اعضای ورک‌اسپیس ببینند"
ON public.teams FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "teams: admin/owner بنویسد" ON public.teams;
CREATE POLICY "teams: admin/owner بنویسد"
ON public.teams FOR ALL
TO authenticated
USING (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]))
WITH CHECK (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "team_members: اعضای ورک‌اسپیس ببینند" ON public.team_members;
CREATE POLICY "team_members: اعضای ورک‌اسپیس ببینند"
ON public.team_members FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_members.team_id
    AND public.is_workspace_member(t.workspace_id)
));

DROP POLICY IF EXISTS "team_members: admin/owner بنویسد" ON public.team_members;
CREATE POLICY "team_members: admin/owner بنویسد"
ON public.team_members FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_members.team_id
    AND public.has_workspace_role(t.workspace_id, array['owner','admin']::workspace_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_members.team_id
    AND public.has_workspace_role(t.workspace_id, array['owner','admin']::workspace_role[])
));

-- ---------- projects & project_members ----------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects: اعضا ببینند" ON public.projects;
CREATE POLICY "projects: اعضا ببینند"
ON public.projects FOR SELECT
TO authenticated
USING (public.is_project_member(id));

DROP POLICY IF EXISTS "projects: lead/admin/owner بنویسد" ON public.projects;
CREATE POLICY "projects: lead/admin/owner بنویسد"
ON public.projects FOR ALL
TO authenticated
USING (public.has_project_role(id, array['lead']::project_role[])
       OR public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]))
WITH CHECK (public.has_project_role(id, array['lead']::project_role[])
       OR public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "project_members: اعضا ببینند" ON public.project_members;
CREATE POLICY "project_members: اعضا ببینند"
ON public.project_members FOR SELECT
TO authenticated
USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "project_members: lead/admin بنویسد" ON public.project_members;
CREATE POLICY "project_members: lead/admin بنویسد"
ON public.project_members FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead']::project_role[]));

-- ---------- milestones / modules / cycles / issues / labels ----------
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones: read members" ON public.milestones;
CREATE POLICY "milestones: read members" ON public.milestones FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "modules: read members" ON public.modules;
CREATE POLICY "modules: read members" ON public.modules FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "cycles: read members" ON public.cycles;
CREATE POLICY "cycles: read members" ON public.cycles FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "issues: read members" ON public.issues;
CREATE POLICY "issues: read members" ON public.issues FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "labels: read members" ON public.labels;
CREATE POLICY "labels: read members" ON public.labels FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "milestones: write leads" ON public.milestones;
CREATE POLICY "milestones: write leads" ON public.milestones FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "modules: write leads" ON public.modules;
CREATE POLICY "modules: write leads" ON public.modules FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "cycles: write leads" ON public.cycles;
CREATE POLICY "cycles: write leads" ON public.cycles FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "issues: write members" ON public.issues;
CREATE POLICY "issues: write members" ON public.issues FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "labels: write leads" ON public.labels;
CREATE POLICY "labels: write leads" ON public.labels FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead']::project_role[]));

DROP POLICY IF EXISTS "issue_dependencies: read" ON public.issue_dependencies;
CREATE POLICY "issue_dependencies: read" ON public.issue_dependencies FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_dependencies.issue_id
    AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_dependencies: write" ON public.issue_dependencies;
CREATE POLICY "issue_dependencies: write" ON public.issue_dependencies FOR ALL
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_dependencies.issue_id
    AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_dependencies.issue_id
    AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

DROP POLICY IF EXISTS "issue_comments: read" ON public.issue_comments;
CREATE POLICY "issue_comments: read" ON public.issue_comments FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_comments.issue_id
    AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_comments: author" ON public.issue_comments;
CREATE POLICY "issue_comments: author" ON public.issue_comments FOR ALL
TO authenticated USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "issue_labels: read" ON public.issue_labels;
CREATE POLICY "issue_labels: read" ON public.issue_labels FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_labels.issue_id
    AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_labels: write" ON public.issue_labels;
CREATE POLICY "issue_labels: write" ON public.issue_labels FOR ALL
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_labels.issue_id
    AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_labels.issue_id
    AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

DROP POLICY IF EXISTS "issue_assignees: read" ON public.issue_assignees;
CREATE POLICY "issue_assignees: read" ON public.issue_assignees FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_assignees.issue_id
    AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_assignees: write" ON public.issue_assignees;
CREATE POLICY "issue_assignees: write" ON public.issue_assignees FOR ALL
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_assignees.issue_id
    AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = issue_assignees.issue_id
    AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

-- ---------- GitHub ----------
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_issue_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "github_installations: read" ON public.github_installations;
CREATE POLICY "github_installations: read" ON public.github_installations FOR SELECT
TO authenticated USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "github_repositories: read" ON public.github_repositories;
CREATE POLICY "github_repositories: read" ON public.github_repositories FOR SELECT
TO authenticated USING (
  public.is_project_member(project_id)
  OR public.is_workspace_member((SELECT workspace_id FROM public.github_installations gi WHERE gi.id = github_repositories.installation_id LIMIT 1))
);

DROP POLICY IF EXISTS "github_branches: read" ON public.github_branches;
CREATE POLICY "github_branches: read" ON public.github_branches FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.github_repositories r WHERE r.id = github_branches.repo_id
    AND (public.is_project_member(r.project_id))));

DROP POLICY IF EXISTS "github_commits: read" ON public.github_commits;
CREATE POLICY "github_commits: read" ON public.github_commits FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.github_repositories r WHERE r.id = github_commits.repo_id
    AND public.is_project_member(r.project_id)));

DROP POLICY IF EXISTS "github_pull_requests: read" ON public.github_pull_requests;
CREATE POLICY "github_pull_requests: read" ON public.github_pull_requests FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.github_repositories r WHERE r.id = github_pull_requests.repo_id
    AND public.is_project_member(r.project_id)));

DROP POLICY IF EXISTS "github_reviews: read" ON public.github_reviews;
CREATE POLICY "github_reviews: read" ON public.github_reviews FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.github_pull_requests pr
  JOIN public.github_repositories r ON r.id = pr.repo_id
  WHERE pr.id = github_reviews.pull_request_id
    AND public.is_project_member(r.project_id)));

DROP POLICY IF EXISTS "github_issue_links: read" ON public.github_issue_links;
CREATE POLICY "github_issue_links: read" ON public.github_issue_links FOR SELECT
TO authenticated USING (EXISTS (
  SELECT 1 FROM public.issues i WHERE i.id = github_issue_links.issue_id
    AND public.is_project_member(i.project_id)));

-- ---------- activities / notifications / documents ----------
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities: read" ON public.activities;
CREATE POLICY "activities: read" ON public.activities FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "notifications: user read" ON public.notifications;
CREATE POLICY "notifications: user read" ON public.notifications FOR SELECT
TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: user update" ON public.notifications;
CREATE POLICY "notifications: user update" ON public.notifications FOR UPDATE
TO authenticated USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "documents: read" ON public.documents;
CREATE POLICY "documents: read" ON public.documents FOR SELECT
TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "documents: write" ON public.documents;
CREATE POLICY "documents: write" ON public.documents FOR ALL
TO authenticated
USING (public.has_project_role(project_id, array['lead','contributor']::project_role[]))
WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));
