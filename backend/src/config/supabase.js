import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`
            }
        }
    }
);

export default supabase;