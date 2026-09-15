import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const connectionString =
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres.soibfhobvyjcyzcgckae:Artin%40889400@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

console.log("🚀 Connecting to Supabase Postgres...");

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
});

async function executeStatements(fileContent, label) {
  const statements = fileContent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`\n📋 Running ${statements.length} statements for ${label}...`);

  let success = 0;
  let skipped = 0;

  for (const statement of statements) {
    // Skip creating auth.users if it's in the script because Supabase manages auth.users
    if (statement.includes('CREATE TABLE "auth"."users"')) {
      skipped++;
      continue;
    }

    try {
      await sql.unsafe(statement);
      success++;
    } catch (err) {
      // 42710 = duplicate type
      // 42P07 = duplicate table
      // 42701 = duplicate column
      // 42P01 = undefined table (if dropping)
      if (
        err.code === "42710" ||
        err.code === "42P07" ||
        err.code === "42701" ||
        err.message.includes("already exists")
      ) {
        skipped++;
      } else {
        console.warn(`⚠️ Statement warning: ${err.message}`);
        // If it's a critical error, log snippet
      }
    }
  }

  console.log(`✅ ${label}: ${success} executed, ${skipped} already existing/skipped.`);
}

async function main() {
  try {
    const testRes = await sql`SELECT version();`;
    console.log("✅ Successfully connected to Supabase:", testRes[0].version);

    // 1. Run all drizzle migrations in order
    const drizzleDir = path.resolve("./drizzle");
    if (fs.existsSync(drizzleDir)) {
      const sqlFiles = fs
        .readdirSync(drizzleDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of sqlFiles) {
        const schemaFile = path.join(drizzleDir, file);
        const schemaSql = fs.readFileSync(schemaFile, "utf-8");
        await executeStatements(schemaSql, `Drizzle Migration (${file})`);
      }
    }

    // 2. Run RLS script
    const rlsFile = path.resolve("./supabase/rls.sql");
    if (fs.existsSync(rlsFile)) {
      console.log("\n🛡️ Applying Row-Level Security (RLS) policies...");
      const rlsSql = fs.readFileSync(rlsFile, "utf-8");
      try {
        await sql.unsafe(rlsSql);
        console.log("✅ RLS policies and helper functions applied successfully!");
      } catch {
        console.log("Applying RLS block by block...");
        // If whole block has minor conflicts, execute block
        await executeStatements(rlsSql.replace(/;\s*$/gm, ";--> statement-breakpoint"), "RLS Policies");
      }
    }

    // 3. Verify tables in database
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log(`\n🎉 Total public tables in Supabase: ${tables.length}`);
    console.log("Tables:", tables.map((t) => t.table_name).join(", "));

  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
