import postgres from "postgres";

const connectionString =
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres.soibfhobvyjcyzcgckae:Artin%40889400@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

const sql = postgres(connectionString, { max: 1, prepare: false });

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log("✅ Tables in Supabase (public):", tables.length);

  const policies = await sql`
    SELECT count(*)::int as count 
    FROM pg_policies 
    WHERE schemaname = 'public';
  `;
  console.log("✅ Active RLS Policies in Supabase:", policies[0].count);

  const functions = await sql`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public';
  `;
  console.log("✅ Helper Functions:", functions.map(f => f.routine_name).join(", "));

  await sql.end();
}

check();
