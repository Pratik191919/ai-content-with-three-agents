require('dotenv').config({ path: '../frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkRows() {
    const { data, error } = await supabase
        .from('agent_logs')
        .select(`agent_name, event_type, message, created_at`)
        .eq('event_type', 'ERROR')
        .order('created_at', { ascending: false })
        .limit(10);
        
    console.log("Recent ERROR Logs:", JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}

checkRows();
