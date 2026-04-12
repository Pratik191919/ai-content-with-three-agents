require('dotenv').config({ path: '../frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchLogs() {
    const { data, error } = await supabase
        .from('agent_logs')
        .select('*')
        .eq('agent_name', 'Writer (Agent 02)')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching logs:", error);
    } else {
        console.log("Latest Writer (Agent 02) Logs:");
        data.forEach(log => {
            console.log(`[${log.created_at}] [${log.event_type}]: ${log.message}`);
        });
    }
}

fetchLogs();
