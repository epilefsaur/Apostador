// js/supabase.js
// Configuração do cliente Supabase.
// Substitua as constantes abaixo pelas do seu projeto (Settings > API).

const SUPABASE_URL  = 'https://dcpahhxwelxiijqydjzy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcGFoaHh3ZWx4aWlqcXlkanp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNTUyNTEsImV4cCI6MjEwOTYzMTI1MX0.9raQ8xPNEktBPQOSrmwVpSneM2BhzFFiubU58cSBGog';

// Carrega o SDK via CDN (script tag no index.html)
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});