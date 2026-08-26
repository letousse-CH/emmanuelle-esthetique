import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('dynamic_pages').select('id, title, slug, published, updated_at');
  if (error) {
    console.error("Error fetching pages:", error);
  } else {
    console.log("Pages in Supabase:", data);
  }

  const { data: settings, error: sErr } = await supabase.from('settings').select('key, value');
  if (sErr) {
    console.error("Error fetching settings:", sErr);
  } else {
    console.log("Settings keys in Supabase:", settings?.map(s => s.key));
  }
}

main();
