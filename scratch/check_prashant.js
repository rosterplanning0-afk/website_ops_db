const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('employees').select('*').ilike('name', '%Prashant%Dubey%');
    console.log("Employees:", data);

    if (data && data.length > 0) {
        const empId = data[0].employee_id;
        const { data: userData } = await supabase.from('users').select('*').eq('employee_id', empId);
        console.log("Users:", userData);
    }
}
check();
