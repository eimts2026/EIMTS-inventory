import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurationError =
  !url || !key
    ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the project environment."
    : "";

// Only the public project key belongs in a Vite bundle. RLS authorizes the user.
export const supabase = configurationError
  ? null
  : createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
