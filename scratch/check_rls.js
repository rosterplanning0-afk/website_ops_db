const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'employee_counselling' }).catch(() => ({}));
    if (data) {
         console.log("Policies:", data);
    } else {
        // Run a raw SQL query
        const query = `
            SELECT pol.polname, pol.polcmd, pol.polqual::text, pol.polwithcheck::text
            FROM pg_policy pol
            JOIN pg_class tbl ON pol.polrelid = tbl.oid
            WHERE tbl.relname = 'employee_counselling'
        `;
        const res = await supabase.from('employee_counselling').select('*').limit(1); // just checking
        console.log("Try querying supabase executing raw SQL via mcp is better");
    }
}
check();
