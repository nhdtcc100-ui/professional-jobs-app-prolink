import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwqeadonwddzvlyooeee.supabase.co';
const supabaseAnonKey = 'sb_publishable_wTlOrKPwifHxBk_53Bk0BA__P6bJCPi';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    try {
        console.log("Testing join query with explicit FK name...");
        const { data: join, error: jError } = await supabase.from('group_members').select('*, profiles!user_id(*)').limit(1);
        if (jError) console.error("Explicit join query failed:", JSON.stringify(jError, null, 2));
        else console.log("Explicit join query success!");
    } catch (e) {
        console.error("Script error:", e);
    }
}

checkSchema();
