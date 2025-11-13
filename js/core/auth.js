// js/core/auth.js

// 1. VOS CLÉS D'API
const SUPABASE_URL = 'https://baco-inky.vercel.app/api-proxy';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGphaGV5aW1penJ5ZGF6cnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTc1MDIsImV4cCI6MjA3NzQzMzUwMn0.nwMgm-ehAppq0WP-MK8459ZIvsWKjbJmsq6qL_t5sQo';

// 2. INITIALISATION ET EXPORTATION
const { createClient } = supabase;
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. NOUVEAU: Rendre global pour les scripts en ligne
// C'est la correction cruciale pour vos pages existantes.
window.supabaseClient = supabaseClient;

