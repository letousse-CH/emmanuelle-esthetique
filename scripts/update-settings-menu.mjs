import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NAV_MENU = [
  { name: "Accueil", path: "/" },
  { name: "Vos Besoins", path: "/#besoins" },
  { name: "Commandes Vocales", path: "/#commandes-vocales" },
  { name: "Outils Admin", path: "/#maquettes" },
  { name: "Avantages", path: "/#avantages" },
  { name: "Offre Clé en Main", path: "/#offre" },
  { name: "FAQ", path: "/#faq" },
  { name: "Contact", path: "/contact" }
];

async function main() {
  console.log("Updating navigation_menu in settings...");
  const { error } = await supabase.from('settings').upsert({
    key: 'navigation_menu',
    value: JSON.stringify(NAV_MENU)
  });

  if (error) {
    console.error("Error updating navigation_menu:", error);
  } else {
    console.log("Successfully updated navigation_menu setting!");
  }
}

main();
