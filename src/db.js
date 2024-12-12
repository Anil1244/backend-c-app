require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We use the service role key for admin-level access (to insert/update/delete).
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

module.exports = { supabaseAdmin };
