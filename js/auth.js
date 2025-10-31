// js/auth.js

// 1. VOS CLÉS D'API
    const SUPABASE_URL = 'https://mgljaheyimizrydazrxh.supabase.co';       // Collez votre URL ici
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGphaGV5aW1penJ5ZGF6cnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTc1MDIsImV4cCI6MjA3NzQzMzUwMn0.nwMgm-ehAppq0WP-MK8459ZIvsWKjbJmsq6qL_t5sQo';   // Collez votre clé ici


// 2. INITIALISATION
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. LE GARDIEN
(async () => {
  // On vérifie si on a une session active
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    // PAS DE SESSION = PAS CONNECTÉ
    // On redirige vers la page de connexion
    alert("Vous n'êtes pas connecté. Redirection vers la page de connexion.");
    window.location.href = 'index.html';
  } else {
    // L'utilisateur est bien connecté, on ne fait rien
    console.log("Session utilisateur trouvée.", session.user.email);
  }
})();