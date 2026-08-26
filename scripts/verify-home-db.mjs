import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('dynamic_pages')
    .select('*')
    .eq('slug', 'home')
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("PAGE TITLE:", data.title);
  console.log("SLUG:", data.slug);
  console.log("SECTIONS COUNT:", data.sections.length);
  console.log("SECTION TYPES:", data.sections.map(s => s.type));
}

main();
