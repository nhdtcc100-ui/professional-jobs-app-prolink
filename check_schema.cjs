import { createClient } from '@supabase/supabase-base-js';
import fs from 'fs';

// Try to extract supabase URL and Key from App.tsx
const appContent = fs.readFileSync('src/App.tsx', 'utf8');
const urlMatch = appContent.match(/const SUPABASE_URL = ['"]([^'"]+)['"]/);
const keyMatch = appContent.match(/const SUPABASE_ANON_KEY = ['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase credentials in App.tsx");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkSchema() {
    console.log("Checking profiles table...");
    const { data: profile, error: pError } = await supabase.from('profiles').select('*').limit(1);
    if (pError) console.error("Error fetching profile:", pError);
    else console.log("Profile columns:", Object.keys(profile[0] || {}));

    console.log("\nChecking group_members table...");
    const { data: member, error: mError } = await supabase.from('group_members').select('*').limit(1);
    if (mError) console.error("Error fetching group_member:", mError);
    else console.log("GroupMember columns:", Object.keys(member[0] || {}));
}

checkSchema();
