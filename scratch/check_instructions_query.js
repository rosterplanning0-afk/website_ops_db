const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let q = supabase
        .from('instructions')
        .select(`
            id, title, priority, created_at,
            instruction_designation_assignments!inner(designation)
        `)
        .eq('is_active', true)
        .in('instruction_designation_assignments.designation', ['All Staff', 'Train Operator'])
        .order('created_at', { ascending: false })
        .limit(5);
        
    const { data, error } = await q;
    console.log("Data:", JSON.stringify(data, null, 2));
    console.log("Error:", error);
}
check();
