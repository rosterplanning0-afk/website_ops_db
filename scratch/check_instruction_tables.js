const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.rpc('get_tables').catch(() => ({}));
    if (data) console.log(data);
    else {
        // use raw sql query
        const res = await supabase.from('instruction_assignments').select('*').limit(1).catch(() => ({}));
        console.log("Assignments schema:", res.data && res.data.length > 0 ? Object.keys(res.data[0]) : "No assignments table or empty");
        
        const res2 = await supabase.from('instruction_acknowledgements').select('*').limit(1).catch(() => ({}));
        console.log("Acknowledgements schema:", res2.data && res2.data.length > 0 ? Object.keys(res2.data[0]) : "No acks table or empty");
    }
}
check();
