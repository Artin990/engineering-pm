import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "";

// postgres.js — pooling via Supabase Transaction mode (port 6543) or direct (5432)
const client = postgres(connectionString, {
  max: 10,
  prepare: false, // required for Supabase Transaction mode
});

export const db = drizzle(client, { schema });
