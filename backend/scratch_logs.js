require('dotenv').config({ path: '../frontend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkStatus() {
    console.log("--- LATEST BRIEFS ---");
    const { data: briefs } = await supabase.from('content_briefs').select('id, title, status').order('created_at', { ascending: false }).limit(3);
    console.log(briefs);

    console.log("\n--- LATEST CONTENT ---");
    const { data: contents } = await supabase.from('content').select('id, brief_id, title, status').order('created_at', { ascending: false }).limit(3);
    console.log(contents);

    console.log("\n--- LATEST LOGS ---");
    const { data: logs } = await supabase.from('agent_logs').select('agent_name, event_type, message, created_at').order('created_at', { ascending: false }).limit(10);
    logs.forEach(l => console.log(`[${l.agent_name}] [${l.event_type}]: ${l.message}`));
}
checkStatus();
