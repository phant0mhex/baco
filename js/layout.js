// js/layout.js

/**
 * Charge un composant HTML (comme _nav.html ou _footer.html) dans un placeholder
 * @param {string} placeholderId L'ID du div où injecter le HTML
 * @param {string} htmlFilePath Le chemin vers le fichier HTML à charger
 * @returns {Promise<boolean>} Vrai si le chargement a réussi, faux sinon
 */
async function loadComponent(placeholderId, htmlFilePath) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) {
    return false;
  }
  
  try {
    const response = await fetch(htmlFilePath);
    if (!response.ok) {
      throw new Error(`Fichier non trouvé: ${htmlFilePath} (Statut: ${response.status})`);
    }
    const html = await response.text();
    placeholder.outerHTML = html; // Remplace le placeholder lui-même
    return true;
  } catch (error) {
    console.error(`Erreur lors du chargement de ${placeholderId}:`, error);
    placeholder.innerHTML = `<p class="text-center text-red-500">Erreur chargement ${placeholderId}</p>`;
    return false;
  }
}

// --- Fonctions utilitaires (au niveau global) ---

function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage) {
    const navLinksContainer = document.getElementById('nav-links');
    if (navLinksContainer) {
      const activeLink = navLinksContainer.querySelector(`a[href="${currentPage}"]`);
      if (activeLink) {
        // Style pour la nav sombre
        activeLink.classList.add('bg-gray-700', 'font-bold');
      }
    }
  }
}

function hideAdminElements() {
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    const style = document.createElement('style');
    style.innerHTML = '.admin-only { display: none !important; }';
    document.head.appendChild(style);
  }
}

async function loadNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  if (!navAvatar) return; 
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return;
    const { data, error } = await supabaseClient.from('profiles').select('avatar_url').eq('id', user.id).single();
    if (error) throw error;
    if (data && data.avatar_url) {
      navAvatar.src = data.avatar_url;
    }
  } catch (error) {
    console.error("Impossible de charger l'avatar de la nav:", error.message);
  }
}

/**
 * =================================================================
 * ==                FONCTION 'setupRealtimePresence' CORRIGÉE                ==
 * =================================================================
 */
async function setupRealtimePresence() {
  let userProfile; // Sera défini ci-dessous
  let localUserId; // L'ID unique de l'utilisateur actuel

  try {
    // 1. Obtenir l'utilisateur authentifié
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.warn("Présence non activée: utilisateur non connecté.");
      return; // Ne pas continuer si personne n'est connecté
    }
    
    localUserId = user.id; // <-- C'est la clé unique OBLIGATOIRE
    
    // 2. Créer un profil par défaut (fallback)
    //    Il utilise le VRAI ID de l'utilisateur, garantissant l'unicité.
    userProfile = {
      id: user.id,
      full_name: user.email.split('@')[0], // Nom par défaut
      avatar_url: 'https://via.placeholder.com/40' // Avatar par défaut
    };

    // 3. Tenter de récupérer le vrai profil depuis la DB
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = "La ligne n'a pas été trouvée", ce qui est normal si le profil n'est pas encore créé.
      // On logue les *autres* erreurs (ex: RLS)
      console.error("Erreur de chargement du profil pour la présence:", profileError.message);
    }

    if (profileData) {
      // Si on trouve un profil, on fusionne les données
      userProfile = { ...userProfile, ...profileData };
    }
    
  } catch (e) { 
    console.error("Erreur critique setupRealtimePresence:", e);
    return; // Ne peut pas continuer
  }

  // 4. Créer le canal en utilisant la clé unique garantie
  const channel = supabaseClient.channel('baco-online-users', {
    config: {
      presence: {
        key: userProfile.id, // <-- Utilise maintenant l'ID réel (ex: 'xxxx-xxxx-xxxx')
      },
    },
  });

  // 5. S'abonner aux événements
  channel
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      // On passe l'ID réel pour que la fonction sache qui "filtrer"
      updateOnlineAvatars(presenceState, localUserId); 
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Annoncer sa présence avec le profil complet
        await channel.track(userProfile);
      }
    });
}
/**
 * =================================================================
 * ==          FIN DE LA SECTION CORRIGÉE          ==
 * =================================================================
 */

function updateOnlineAvatars(state, localUserId) {
  const counter = document.getElementById('presence-counter');
  const list = document.getElementById('presence-list');
  if (!counter || !list) return;

  let count = 0;
  let html = '';
  
  for (const key in state) {
    const user = state[key][0]; // [0] car c'est le premier état tracké
    
    // La vérification (inchangée) fonctionnera maintenant car localUserId est correct
    if (user && user.id && user.id !== localUserId) { 
      count++;
      html += `
        <div class="flex items-center gap-3 p-2 rounded-md">
          <img src="${user.avatar_url || 'https://via.placeholder.com/40'}" alt="${user.full_name}" class="w-8 h-8 rounded-full object-cover">
          <span class="text-sm font-medium text-gray-300">${user.full_name}</span>
        </div>
      `;
    }
  }
  
  counter.textContent = count;
  counter.classList.toggle('hidden', count === 0); // Cache le compteur s'il n'y a personne

  if (count === 0) {
    list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Vous êtes seul en ligne.</p>';
  } else {
    list.innerHTML = html;
  }
}

// --- Exécution principale au chargement du DOM ---

document.addEventListener('DOMContentLoaded', async () => {
  
  // Appliquer la sécurité admin immédiatement
  hideAdminElements();
  
  // Charger la navigation
  const navLoaded = await loadComponent('nav-placeholder', '_nav.html');
  if (navLoaded) {
    // Si la nav a chargé, exécuter tous les scripts qui en dépendent
    highlightActiveLink();
    loadNavAvatar();
    setupRealtimePresence(); // <- Appel de la fonction corrigée

    // Logique du menu burger
    const menuButton = document.getElementById('mobile-menu-button');
    const menuContent = document.getElementById('nav-content');
    const menuIcon = document.getElementById('mobile-menu-icon');
    if (menuButton && menuContent && menuIcon) {
      menuButton.onclick = () => {
        menuContent.classList.toggle('hidden');
        const isHidden = menuContent.classList.contains('hidden');
        menuIcon.setAttribute('data-lucide', isHidden ? 'menu' : 'x');
        lucide.createIcons();
      };
    }

    // Logique de déconnexion
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.onclick = async () => {
        sessionStorage.removeItem('userRole');
        const { error } = await supabaseClient.auth.signOut();
        if (error) console.error('Erreur de déconnexion:', error);
        else window.location.href = 'index.html';
      };
    }

    // Logique du dropdown de présence
    const presenceContainer = document.getElementById('presence-container');
    const presenceButton = document.getElementById('presence-toggle-button');
    const presenceDropdown = document.getElementById('presence-dropdown');
    if (presenceContainer && presenceButton && presenceDropdown) {
        presenceButton.onclick = (e) => {
            e.stopPropagation(); 
            presenceDropdown.classList.toggle('hidden');
            document.getElementById('profile-dropdown')?.classList.add('hidden');
        };
    }

    // Logique du dropdown de profil
    const profileContainer = document.getElementById('profile-dropdown-container');
    const profileButton = document.getElementById('profile-toggle-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileContainer && profileButton && profileDropdown) {
        profileButton.onclick = (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
            document.getElementById('presence-dropdown')?.classList.add('hidden');
        };
    }

    // Logique de fermeture "Click-away"
    window.addEventListener('click', (e) => {
        if (presenceContainer && !presenceContainer.contains(e.target)) {
            presenceDropdown?.classList.add('hidden');
        }
        if (profileContainer && !profileContainer.contains(e.target)) {
            profileDropdown?.classList.add('hidden');
        }
    });
  }

  // Charger le footer
  const footerLoaded = await loadComponent('footer-placeholder', '_footer.html');
  if (footerLoaded) {
    // Si le footer a chargé, exécuter les scripts qui en dépendent
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  }
  
  // Appeler Lucide une fois que tout est chargé (nav, footer, et contenu de la page)
  lucide.createIcons();
});