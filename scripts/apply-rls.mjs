import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const connectionString =
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres.soibfhobvyjcyzcgckae:Artin%40889400@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  onnotice: () => {}, // silence identifier truncation notices
});

async function main() {
  try {
    const rlsFile = path.resolve("./supabase/rls.sql");
    let rlsSql = fs.readFileSync(rlsFile, "utf-8");

    // Make policies idempotent by adding DROP POLICY IF EXISTS before each CREATE POLICY
    rlsSql = rlsSql.replace(
      /create\s+policy\s+("([^"]+)")\s+on\s+([^\s]+)/gi,
      'DROP POLICY IF EXISTS $1 ON $3;\nCREATE POLICY $1 ON $3'
    );

    console.log("🛡️ Applying complete idempotent RLS policies to Supabase...");
    await sql.unsafe(rlsSql);
    console.log("✅ All RLS policies and helper functions applied successfully!");

    // Verify all active policies in Supabase
    const policies = await sql`
      SELECT policyname, tablename 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname;
    `;
    console.log(`\n🎉 Total Active RLS Policies in Supabase: ${policies.length}`);
    for (const p of policies) {
      console.log(`  ✓ [${p.tablename}] ${p.policyname}`);
    }

  } catch (err) {
    console.error("❌ RLS execution error:", err);
  } finally {
    await sql.end();
  }
}

main();
