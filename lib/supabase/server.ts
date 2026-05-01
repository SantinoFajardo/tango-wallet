import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Only called from Server Actions — SUPABASE_SERVICE_ROLE_KEY never reaches the browser.
export function createServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
