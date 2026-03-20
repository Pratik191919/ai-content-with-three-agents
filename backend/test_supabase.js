require('dotenv').config({ path: '../frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkRows() {
    const { data, error } = await supabase
        .from('agent_logs')
        .select(`agent_name, message, created_at`)
        .eq('agent_name', 'Writer (Agent 02)')
        .order('created_at', { ascending: false })
        .limit(3);
        
    console.log("Recent Agent 02 Logs:", JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}

checkRows();
