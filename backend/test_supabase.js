require('dotenv').config({ path: '../frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkRows() {
    const { data, error } = await supabase
        .from('content')
        .select(`title, live_url, featured_image_url, content_image, created_at`)
        .order('created_at', { ascending: false })
        .limit(3);
        
    console.log("Recent Content Rows:", JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}

checkRows();
