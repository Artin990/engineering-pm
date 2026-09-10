import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "",
  },
  // Run: npx drizzle-kit generate   → creates SQL migration files
  // Run: npx drizzle-kit migrate     → applies to DB (only when env vars are set)
  // Run: npx drizzle-kit studio      → visual DB browser (local)
});
