import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://soibfhobvyjcyzcgckae.supabase.co";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvaWJmaG9idnlqY3l6Y2dja2FlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA3NTMwNSwiZXhwIjoyMTA0NjUxMzA1fQ.j7wPODI9KB3REFWy3JxBf0qGjAUhQqC4Zi8lrgToR0c";
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres.soibfhobvyjcyzcgckae:Artin%40889400@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function seedAdmin() {
  const email = "artinamiri185@gmail.com";
  const password = "Artin@8894";
  const name = "آرتین امیری";

  console.log(`👤 Provisioning admin account for: ${email}...`);

  try {
    // 1. Create or get user in Supabase Auth
    let userId;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);

    if (existing) {
      console.log(`ℹ️ User already exists with ID: ${existing.id}. Updating password...`);
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
        user_metadata: { name },
      });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError) {
        throw createError;
      }
      userId = newUser.user.id;
      console.log(`✅ Created auth user with ID: ${userId}`);
    }

    // 2. Ensure profile exists in public.profiles
    console.log("📝 Upserting public profile...");
    await sql`
      INSERT INTO public.profiles (id, email, display_name, avatar_url, updated_at)
      VALUES (${userId}, ${email}, ${name}, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', now())
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        updated_at = now();
    `;

    // 3. Ensure a default workspace exists for this owner
    console.log("🏢 Checking default workspace...");
    const existingWorkspaces = await sql`
      SELECT id FROM public.workspaces WHERE owner_id = ${userId} LIMIT 1;
    `;

    let workspaceId;
    if (existingWorkspaces.length > 0) {
      workspaceId = existingWorkspaces[0].id;
      console.log(`ℹ️ Found existing workspace ID: ${workspaceId}`);
    } else {
      const [newWs] = await sql`
        INSERT INTO public.workspaces (name, slug, owner_id)
        VALUES ('ورک‌اسپیس مهندسی', 'engineering-workspace', ${userId})
        RETURNING id;
      `;
      workspaceId = newWs.id;
      console.log(`✅ Created workspace ID: ${workspaceId}`);
    }

    // 4. Ensure owner is member of workspace
    await sql`
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (${workspaceId}, ${userId}, 'owner')
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
    `;

    console.log(`🎉 Admin user successfully provisioned!`);
    console.log(`   - Email: ${email}`);
    console.log(`   - Password: ${password}`);
    console.log(`   - Role: owner / admin`);
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    await sql.end();
  }
}

seedAdmin();
