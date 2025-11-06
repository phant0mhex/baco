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
// ... (Toutes vos fonctions existantes: highlightActiveLink, hideAdminElements, loadNavAvatar, etc.)
// ... (Laissez-les ici, elles ne sont pas affichées pour la clarté)
function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage) {
    const navLinksContainer = document.getElementById('nav-links');
    if (navLinksContainer) {
      const activeLink = navLinksContainer.querySelector(`a[href="${currentPage}"]`);
      if (activeLink) {
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
async function setupRealtimePresence() {
  let userProfile;
  let localUserId; 
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.warn("Présence non activée: utilisateur non connecté.");
      return; 
    }
    localUserId = user.id;
    userProfile = {
      id: user.id,
      full_name: user.email.split('@')[0], 
      avatar_url: 'https://via.placeholder.com/40'
    };
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Erreur chargement profil présence:", profileError.message);
    }
    if (profileData) {
      if (profileData.full_name) {
        userProfile.full_name = profileData.full_name;
      }
      if (profileData.avatar_url) {
        userProfile.avatar_url = profileData.avatar_url;
      }
    }
  } catch (e) { 
    console.error("Erreur critique setupRealtimePresence:", e);
    return;
  }
  const channel = supabaseClient.channel('baco-online-users', {
    config: {
      presence: {
        key: userProfile.id, 
      },
    },
  });
  channel
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      updateOnlineAvatars(presenceState, localUserId); 
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userProfile);
      }
    });
}
function updateOnlineAvatars(state, localUserId) {
  const counter = document.getElementById('presence-counter');
  const list = document.getElementById('presence-list');
  if (!counter || !list) return;
  let count = 0;
  let html = '';
  for (const key in state) {
    const user = state[key][0];
    if (user && user.id && user.id !== localUserId) { 
      count++;
      const displayName = user.full_name || 'Utilisateur'; 
      html += `
        <div class="flex items-center gap-3 p-2 rounded-md">
          <img src="${user.avatar_url || 'https://via.placeholder.com/40'}" alt="${displayName}" class="w-8 h-8 rounded-full object-cover">
          <span class="text-sm font-medium text-gray-300">${displayName}</span>
        </div>
      `;
    }
  }
  counter.textContent = count;
  counter.classList.toggle('hidden', count === 0);
  if (count === 0) {
    list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Vous êtes seul en ligne.</p>';
  } else {
    list.innerHTML = html;
  }
}
async function loadLatestChangelog() {
  const versionElement = document.getElementById('version-info');
  if (!versionElement) return;
  try {
    const { data, error } = await supabaseClient
      .from('changelog')
      .select('title, type') // Sélectionne le titre et le type
      .order('created_at', { ascending: false }) // La plus récente
      .limit(1) // Une seule
      .single(); // On s'attend à un seul objet
    if (error) throw error;
    if (data) {
      let typeText = '';
      if (data.type === 'Nouveau') typeText = '[Nouveau]';
      else if (data.type === 'Corrigé') typeText = '[Fix]';
      else if (data.type === 'Amélioré') typeText = '[MàJ]';
      versionElement.innerHTML = `
        <i data-lucide="list-checks" class="w-4 h-4"></i>
        <span>${typeText} ${data.title}</span>
      `;
      versionElement.classList.remove('text-gray-500');
      lucide.createIcons();
    } else {
      versionElement.innerHTML = '<span>v1.0.0</span>'; // Fallback
    }
  } catch (error) {
    console.error("Erreur chargement version changelog:", error.message);
    const spinner = versionElement.querySelector('i');
    const text = versionElement.querySelector('span');
    if (spinner) spinner.style.display = 'none';
    if (text) text.textContent = 'v1.0.0';
  }
}

// ===============================================================
// ==              DÉBUT DE LA NOUVELLE SECTION                 ==
// ===============================================================

let globalSearchTimer;
let globalSearchModal;
let globalSearchInput;
let globalSearchResults;
let globalSearchSpinner;

/**
 * Crée et injecte la modale de recherche globale et ses styles
 */
function createSearchModal() {
  // 1. Injecter les styles CSS
  const style = document.createElement('style');
  style.innerHTML = `
    #global-search-modal {
      z-index: 100;
    }
    #global-search-modal-panel {
      max-height: 80vh;
    }
    /* Style pour la surbrillance du résultat */
    .search-result-item:hover, .search-result-item.selected {
      background-color: #374151; /* gray-700 */
    }
  `;
  document.head.appendChild(style);

  // 2. Injecter le HTML de la modale
  const modalHtml = `
    <div id="global-search-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-start justify-center p-4 pt-[20vh]" style="display: none;">
      <div id="global-search-modal-panel" class="bg-gray-800 text-gray-200 rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden">
        
        <div class="relative flex items-center p-4 border-b border-gray-700">
          <i data-lucide="search" class="w-5 h-5 text-gray-400 absolute left-7"></i>
          <input type="text" id="global-search-input" 
                 placeholder="Chercher partout (Cmd+K / Shift+K)" 
                 class="w-full bg-gray-800 border-0 text-lg text-white pl-10 pr-4 py-2 focus:outline-none placeholder-gray-500">
          <i data-lucide="loader-2" id="global-search-spinner" class="w-5 h-5 text-blue-500 animate-spin absolute right-7" style="display: none;"></i>
        </div>
        
        <div id="global-search-results" class="p-2 overflow-y-auto">
          <p class="text-center text-gray-500 p-6">Commencez à taper pour rechercher...</p>
        </div>
        
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // 3. Stocker les références aux éléments
  globalSearchModal = document.getElementById('global-search-modal');
  globalSearchInput = document.getElementById('global-search-input');
  globalSearchResults = document.getElementById('global-search-results');
  globalSearchSpinner = document.getElementById('global-search-spinner');

  // 4. Attacher les écouteurs d'événements
  globalSearchModal.addEventListener('click', (e) => {
    if (e.target.id === 'global-search-modal') {
      hideGlobalSearch();
    }
  });
  globalSearchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
      hideGlobalSearch();
    } else {
      debounceSearch();
    }
  });
}

/**
 * Affiche la modale de recherche
 */
function showGlobalSearch() {
  if (globalSearchModal) {
    globalSearchModal.style.display = 'flex';
    lucide.createIcons(); // S'assurer que les icônes sont là
    globalSearchInput.value = '';
    globalSearchInput.focus();
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Commencez à taper pour rechercher...</p>';
  }
}

/**
 * Cache la modale de recherche
 */
function hideGlobalSearch() {
  if (globalSearchModal) {
    globalSearchModal.style.display = 'none';
  }
}

/**
 * Gère le debounce pour la recherche
 */
function debounceSearch() {
  clearTimeout(globalSearchTimer);
  globalSearchTimer = setTimeout(() => {
    executeSearch();
  }, 300); // 300ms de délai
}

/**
 * Appelle la fonction RPC de Supabase
 */
async function executeSearch() {
  const searchTerm = globalSearchInput.value;
  if (searchTerm.length < 2) {
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Tapez au moins 2 caractères...</p>';
    return;
  }
  
  globalSearchSpinner.style.display = 'block';

  try {
    const { data, error } = await supabaseClient.rpc('global_search', {
      search_term: searchTerm
    });

    if (error) throw error;
    
    renderSearchResults(data);

  } catch (error) {
    console.error('Erreur de recherche globale:', error);
    globalSearchResults.innerHTML = `<p class="text-center text-red-400 p-6">Erreur: ${error.message}</p>`;
  } finally {
    globalSearchSpinner.style.display = 'none';
  }
}

/**
 * Affiche les résultats dans la modale
 */
function renderSearchResults(results) {
  if (!results || results.length === 0) {
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Aucun résultat trouvé.</p>';
    return;
  }

  // Mapper les types à des icônes
  const iconMap = {
    'Contact': 'book-user',
    'Procédure': 'shield',
    'Client PMR': 'users',
    'PtCar': 'tag',
    'Taxi': 'car',
    'Bus (Société)': 'bus',
    'Bus (Chauffeur)': 'user-check'
  };

  globalSearchResults.innerHTML = results.map(r => `
    <a href="${r.url}" onclick="hideGlobalSearch()" class="search-result-item flex items-center gap-4 p-3 rounded-md cursor-pointer">
      <i data-lucide="${iconMap[r.result_type] || 'file'}" class="w-5 h-5 text-gray-400 flex-shrink-0"></i>
      <div class="overflow-hidden">
        <p class="text-base text-white font-medium truncate">${r.title}</p>
        <p class="text-sm text-gray-400 truncate">${r.snippet}</p>
      </div>
    </a>
  `).join('');
  
  lucide.createIcons(); // Redessiner les icônes
}

/**
 * Écouteur de touches global pour Cmd+K / Shift+K
 */
function globalKeyListener(e) {
  // Raccourci Shift + K
  if (e.shiftKey && e.key === 'K') {
    e.preventDefault();
    showGlobalSearch();
  }
  // Raccourci Cmd + K (Mac) ou Ctrl + K (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    showGlobalSearch();
  }
}

// ===============================================================
// ==                FIN DE LA NOUVELLE SECTION                 ==
// ===============================================================



// --- Exécution principale au chargement du DOM ---

document.addEventListener('DOMContentLoaded', async () => {
  
  // ===================== NOUVEAUX AJOUTS =====================
  createSearchModal(); // Crée le HTML et le CSS de la modale
  window.addEventListener('keydown', globalKeyListener); // Attache l'écouteur de touches
  // =========================================================

  // Appliquer la sécurité admin immédiatement
  hideAdminElements();
  
  // Charger la navigation
  const navLoaded = await loadComponent('nav-placeholder', '_nav.html');
  if (navLoaded) {
    // Si la nav a chargé, exécuter tous les scripts qui en dépendent
    highlightActiveLink();
    loadNavAvatar();
    setupRealtimePresence(); 

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
    
    loadLatestChangelog(); // Charger la version

    // Logique "GO TO TOP"
    const goToTopButton = document.getElementById('go-to-top-button');

    if (goToTopButton) {
      // 1. Afficher/Cacher le bouton au scroll
      window.addEventListener('scroll', () => {
        if (window.scrollY > 200) { // S'affiche après 200px de scroll
          goToTopButton.classList.remove('hidden', 'opacity-0');
        } else {
          goToTopButton.classList.add('opacity-0');
          // Attendre la fin de la transition pour le cacher
          setTimeout(() => {
             if (window.scrollY <= 200) { // Revérifier au cas où l'utilisateur scrolle à nouveau
                goToTopButton.classList.add('hidden');
             }
          }, 300); // 300ms = duration-300
        }
      });

      // 2. Gérer le clic
      goToTopButton.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth' // Défilement fluide
        });
      });
    }
  }
  
  // Appeler Lucide une fois que tout est chargé (nav, footer, et contenu de la page)
  lucide.createIcons();
});