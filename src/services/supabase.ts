import { createClient } from "@supabase/supabase-js";

export const Supabase = createClient(
  process.env.SUPABASE_DATABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
