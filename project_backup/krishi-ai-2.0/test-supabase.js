
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv() {
    try {
        const content = fs.readFileSync('.env', 'utf-8');
        const lines = content.split('\n');
        const env = {};
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                if (key && value) {
                    env[key.trim()] = value;
                }
            }
        }
        return env;
    } catch (e) {
        return {};
    }
}

async function testSupabase() {
    const env = loadEnv();
    const supabaseUrl = env.VITE_SUPABASE_URL || 'https://nmngzjrrysjzuxfcklrk.supabase.co';
    const supabaseKey = env.VITE_SUPABASE_KEY;

    if (!supabaseKey) {
        console.error("❌ VITE_SUPABASE_KEY not found in .env");
        return;
    }

    console.log("Testing Supabase Connection...");
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
            console.error("❌ Supabase Error:", error.message);
        } else {
            console.log("✅ Supabase functional. User count accessible.");
        }
    } catch (e) {
        console.error("❌ Exception connecting to Supabase:", e.message);
    }
}

testSupabase();
