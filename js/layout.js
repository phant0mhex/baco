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
      // Pour le dropdown PMR, on active les liens enfants si la page est l'une des deux
      const pmrLink = navLinksContainer.querySelector(`a[href="pmr.html"]`);
      const clientsPmrLink = navLinksContainer.querySelector(`a[href="clients_pmr.html"]`);

      if (pmrLink && clientsPmrLink) {
        if (currentPage === 'pmr.html' || currentPage === 'clients_pmr.html') {
          // On highlight le bouton du dropdown PMR s'il existe
          const pmrButton = document.getElementById('pmr-toggle-button');
          if (pmrButton) {
            pmrButton.classList.add('bg-gray-700', 'font-bold');
          }
          // On gère l'highlight des liens à l'intérieur du dropdown plus tard/avec d'autres scripts.
        }
      }
      
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
// ==              SECTION CALENDRIER PERSONNALISÉ              ==
// ===============================================================

/**
 * Injecte les styles CSS personnalisés pour Flatpickr (thème "BACO")
 * Version finale, corrigée pour l'alignement de la grille.
 */
function injectCalendarStyles() {
  const style = document.createElement('style');
  // Couleurs basées sur _nav.html: 
  // bg-gray-800 (#1F2937), border-gray-700 (#374151), hover:bg-gray-700 (#374151)
  // text-gray-100 (#F9FAFB), text-gray-300 (#D1D5DB), accent-blue-600 (#2563EB)
  style.innerHTML = `
    .flatpickr-calendar.baco-theme {
      background: #1F2937 !important; /* bg-gray-800 */
      border: 1px solid #374151 !important; /* border-gray-700 */
      border-radius: 0.5rem !important; /* rounded-lg */
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; /* shadow-xl */
      width: auto !important;
      min-width: 340px !important; /* Largeur fixe pour un look propre */
      padding: 0.75rem !important; /* p-3 */
      color: #D1D5DB !important; /* text-gray-300 */
    }

    /* === En-tête (Mois, Année) === */
    .baco-theme .flatpickr-months {
      background: transparent !important;
      padding: 0.25rem !important; /* p-1 */
      border-bottom: 1px solid #374151 !important; /* border-gray-700 */
      margin-bottom: 0.75rem !important; /* mb-3 */
    }
    .baco-theme .flatpickr-months .flatpickr-month {
      height: 2.5rem !important; /* h-10 */
    }
    
    /* Style des flèches */
    .baco-theme .flatpickr-months .flatpickr-prev-month,
    .baco-theme .flatpickr-months .flatpickr-next-month {
      fill: #D1D5DB !important; /* text-gray-300 */
      padding: 0.5rem !important; /* p-2 */
      border-radius: 0.375rem !important; /* rounded-md */
      top: 0.5rem !important;
    }
    .baco-theme .flatpickr-months .flatpickr-prev-month svg,
    .baco-theme .flatpickr-months .flatpickr-next-month svg {
       fill: #D1D5DB !important; /* text-gray-300 */
    }
    .baco-theme .flatpickr-months .flatpickr-prev-month:hover,
    .baco-theme .flatpickr-months .flatpickr-next-month:hover {
      background: #374151 !important; /* hover:bg-gray-700 */
    }
    .baco-theme .flatpickr-months .flatpickr-prev-month:hover svg,
    .baco-theme .flatpickr-months .flatpickr-next-month:hover svg {
      fill: #F9FAFB !important; /* text-gray-100 */
    }
    
    /* Style des menus déroulants (Mois & Année) */
    .baco-theme .flatpickr-current-month .flatpickr-monthDropdown-months,
    .baco-theme .flatpickr-current-month input.cur-year {
      font-size: 1.125rem !important; /* text-lg */
      font-weight: 600 !important; /* font-semibold */
      color: #F9FAFB !important; /* text-gray-100 */
      background: transparent !important;
      border: none !important;
      padding: 0 0.25rem !important;
      border-radius: 0.375rem !important; /* rounded-md */
      transition: background 0.1s ease !important;
    }
    .baco-theme .flatpickr-current-month .flatpickr-monthDropdown-months:hover,
    .baco-theme .flatpickr-current-month input.cur-year:hover {
      background: #374151 !important; /* hover:bg-gray-700 */
    }
    .baco-theme .numInputWrapper { /* Conteneur de l'année */
      width: 4rem !important; /* Assez large pour "2025" */
    }

    /* === Jours (Grille) === */
    .baco-theme .flatpickr-weekdaycontainer {
      padding: 0 0.5rem !important; /* px-2 */
    }
    .baco-theme .flatpickr-weekday {
      color: #9CA3AF !important; /* text-gray-400 */
      font-weight: 500 !important; /* font-medium */
      font-size: 0.75rem !important; /* text-xs */
      text-transform: uppercase !important;
      background: transparent !important;
      height: 2rem !important;
      line-height: 2rem !important;
    }
    
    /* Numéros de semaine (Sem) */
    .baco-theme .flatpickr-weekwrapper {
      border-right: 1px solid #374151 !important; /* border-gray-700 */
      margin-right: 0.5rem !important; /* mr-2 */
    }
    .baco-theme .flatpickr-weekwrapper .flatpickr-weeks {
      padding: 0 0.5rem !important; /* px-2 */
      box-shadow: none !important;
    }
    .baco-theme .flatpickr-weekwrapper .flatpickr-weeks span {
      color: #9CA3AF !important; /* text-gray-400 */
      font-size: 0.875rem !important; /* text-sm */
      font-weight: 500 !important;
      height: 2.25rem !important; /* h-9 (taille des jours) */
      line-height: 2.25rem !important;
    }
    
    /* === CORRECTION ALIGNEMENT JOURS === */
    .baco-theme .dayContainer {
        padding: 0 !important; /* On supprime le padding qui cassait la grille */
    }
    .baco-theme .flatpickr-day {
      color: #D1D5DB !important; /* text-gray-300 */
      border: 1px solid transparent !important;
      border-radius: 0.375rem !important; /* rounded-md */
      font-weight: 400 !important;
      height: 2.25rem !important; /* h-9 */
      line-height: 2.25rem !important; /* Centrage vertical */
      /* SUPPRESSION de max-width pour laisser flatpickr.min.css gérer la grille */
    }
    /* === FIN CORRECTION ALIGNEMENT === */
    
    .baco-theme .flatpickr-day:hover {
      background: #374151 !important; /* hover:bg-gray-700 */
      color: #F9FAFB !important;
      border-color: #374151 !important;
    }
    
    /* Aujourd'hui (cercle bleu) */
    .baco-theme .flatpickr-day.today {
      background: transparent !important;
      border: 1px solid #2563EB !important; /* Cercle bleu-600 */
      color: #F9FAFB !important; /* text-white */
    }
    .baco-theme .flatpickr-day.today:hover {
      background: #374151 !important; /* hover:bg-gray-700 */
      border-color: #374151 !important;
    }
    
    /* Jour sélectionné (fond bleu) */
    .baco-theme .flatpickr-day.selected, 
    .baco-theme .flatpickr-day.startRange, 
    .baco-theme .flatpickr-day.endRange {
      background: #2563EB !important; /* Le VRAI bleu du site (bg-blue-600) */
      border-color: #2563EB !important;
      color: #FFFFFF !important;
    }
    
    /* === CORRECTION CHIFFRES VISIBILITÉ === */
    .baco-theme .flatpickr-day.flatpickr-disabled, 
    .baco-theme .flatpickr-day.prevMonthDay, 
    .baco-theme .flatpickr-day.nextMonthDay {
      color: #4B5563 !important; /* text-gray-600 (plus visible que gray-500) */
      background: transparent !important;
      border-color: transparent !important;
    }
    .baco-theme .flatpickr-day.prevMonthDay:hover, 
    .baco-theme .flatpickr-day.nextMonthDay:hover {
      background: transparent !important;
      border-color: transparent !important;
      color: #4B5563 !important; /* Reste sombre au survol */
    }
  `;
  document.head.appendChild(style);
}



// ===============================================================
// ==              SECTION RECHERCHE GLOBALE (MISE À JOUR)      ==
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
    /* Style pour les tags KBD */
    kbd {
      font-family: 'Geist Mono', monospace;
      font-size: 0.75rem; /* text-xs */
      background-color: #374151; /* gray-700 */
      border: 1px solid #4B5563; /* gray-600 */
      border-radius: 4px;
      padding: 2px 5px;
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
                 placeholder="Chercher partout..." 
                 class="w-full bg-gray-800 border-0 text-lg text-white pl-10 pr-4 py-2 focus:outline-none placeholder-gray-500">
          <i data-lucide="loader-2" id="global-search-spinner" class="w-5 h-5 text-blue-500 animate-spin absolute right-7" style="display: none;"></i>
        </div>
        
        <div id="global-search-results" class="p-2 overflow-y-auto">
          <p class="text-center text-gray-500 p-6">Commencez à taper pour rechercher...</p>
        </div>
        
        <div class="p-2 text-xs text-center text-gray-500 border-t border-gray-700">
          Utilisez <kbd>Cmd+K</kbd> ou <kbd>Shift+K</kbd> pour ouvrir/fermer.
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
 * Affiche les résultats dans la modale (MISE À JOUR)
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

  // ======================= MODIFICATION : Ajout du badge de source =======================
  globalSearchResults.innerHTML = results.map(r => `
    <a href="${r.url}" onclick="hideGlobalSearch()" class="search-result-item flex items-center justify-between gap-4 p-3 rounded-md cursor-pointer">
      
      <div class="flex items-center gap-4 overflow-hidden">
        <i data-lucide="${iconMap[r.result_type] || 'file'}" class="w-5 h-5 text-gray-400 flex-shrink-0"></i>
        <div class="overflow-hidden">
          <p class="text-base text-white font-medium truncate">${r.title}</p>
          <p class="text-sm text-gray-400 truncate">${r.snippet}</p>
        </div>
      </div>
      
      <span class="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">${r.result_type}</span>
      
    </a>
  `).join('');
  // ===================================================================================
  
  lucide.createIcons(); // Redessiner les icônes
}

/**
 * Écouteur de touches global pour Cmd+K / Shift+K
 */
function globalKeyListener(e) {
  const modalVisible = globalSearchModal.style.display === 'flex';
  
  // Raccourci Shift + K
  if (e.shiftKey && e.key === 'K') {
    e.preventDefault();
    modalVisible ? hideGlobalSearch() : showGlobalSearch();
  }
  // Raccourci Cmd + K (Mac) ou Ctrl + K (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    modalVisible ? hideGlobalSearch() : showGlobalSearch();
  }
}

// ===============================================================
// ==                FIN DE LA SECTION RECHERCHE                ==
// ===============================================================

// ===============================================================
// ==              SECTION NOTIFICATIONS JOURNAL              ==
// ===============================================================

const JOURNAL_STORAGE_KEY = 'lastJournalVisit';

/**
 * Charge et affiche le nombre de messages du journal non lus.
 */
async function loadJournalNotificationCount() {
    const badgeElement = document.getElementById('journal-badge');
    if (!badgeElement) return;

    let lastVisit = localStorage.getItem(JOURNAL_STORAGE_KEY);

    // Si aucune date de dernière visite n'est trouvée (première exécution),
    // on utilise la date d'initialisation du système (Epoch) pour forcer le comptage.
    if (!lastVisit) {
        lastVisit = '1970-01-01T00:00:00.000Z';
    }
  

    // 2. Compter les messages créés après la dernière visite
    try {
        const { count, error } = await supabaseClient
            .from('main_courante')
            .select('id', { count: 'exact', head: true })
            .gt('created_at', lastVisit); // 'gt' for greater than

        if (error) {
             console.error("[Journal Badge] Erreur de comptage Supabase:", error.message);
             throw error;
        }
        
        const newMessagesCount = count;
        

        if (newMessagesCount > 0) {
            badgeElement.textContent = newMessagesCount;
            badgeElement.classList.remove('hidden'); 
        } else {
            badgeElement.classList.add('hidden');
            badgeElement.textContent = '';
        }

    } catch (error) {
        console.error("[Journal Badge] Erreur critique:", error.message);
        badgeElement.classList.add('hidden');
    }
}

// On expose la fonction pour qu'elle puisse être appelée depuis journal.html (markJournalAsRead)
window.loadJournalNotificationCount = loadJournalNotificationCount;


// --- Exécution principale au chargement du DOM ---

document.addEventListener('DOMContentLoaded', async () => {
  
  // NOUVEAU: Injection du style calendrier
  injectCalendarStyles();
  
  createSearchModal(); // Crée le HTML et le CSS de la modale
  window.addEventListener('keydown', globalKeyListener); // Attache l'écouteur de touches

  // Appliquer la sécurité admin immédiatement
  hideAdminElements();
  
  // Charger la navigation
  const navLoaded = await loadComponent('nav-placeholder', '_nav.html');
  if (navLoaded) {
    // Si la nav a chargé, exécuter tous les scripts qui en dépendent
    highlightActiveLink();
    loadNavAvatar();
    setupRealtimePresence(); 

    // --- NOUVEAU: Initialisation du Calendrier ---
    const calendarButton = document.getElementById('calendar-toggle-button');
    if (calendarButton) {
      // Vérifier si flatpickr et la traduction sont bien chargés
      if (typeof flatpickr !== 'undefined' && flatpickr.l10ns.fr) {
        flatpickr(calendarButton, {
          weekNumbers: true,  // On garde les numéros de semaine
          locale: "fr",       // On garde la traduction
          static: true,       // Fait apparaître le calendrier sous le bouton
          appendTo: document.body, // S'assure qu'il s'affiche par-dessus tout
         
          
          onReady: function(selectedDates, dateStr, instance) {
            // On ajoute la classe 'font-sans' de Tailwind au conteneur du calendrier
            instance.calendarContainer.classList.add('font-sans');
            instance.calendarContainer.classList.add('baco-theme'); // <-- ON AJOUTE LE THÈME ICI
          }
        });
      } else {
        console.warn('Flatpickr (ou sa traduction FR) n\'est pas chargé. Le calendrier de la nav ne s\'affichera pas.');
      }
    }
    // --- FIN NOUVEAU CALENDRIER ---

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
    
    // --- Définition des variables de dropdown ---
    const presenceContainer = document.getElementById('presence-container');
    const presenceDropdown = document.getElementById('presence-dropdown');
    const profileContainer = document.getElementById('profile-dropdown-container');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    // NOUVEAU: Logique du dropdown PMR
    const pmrContainer = document.getElementById('pmr-dropdown-container');
    const pmrButton = document.getElementById('pmr-toggle-button');
    const pmrDropdown = document.getElementById('pmr-dropdown');
    const pmrChevron = document.getElementById('pmr-chevron-icon');


// Logique du dropdown de présence
    const presenceButton = document.getElementById('presence-toggle-button');
    if (presenceContainer && presenceButton && presenceDropdown) {
        presenceButton.onclick = (e) => {
            e.stopPropagation(); 
            presenceDropdown.classList.toggle('hidden');
            // Fermer les autres dropdowns
            profileDropdown?.classList.add('hidden');
            pmrDropdown?.classList.add('hidden');
            pmrChevron?.setAttribute('data-lucide', 'chevron-down');
            lucide.createIcons();
        };
        // Empêche la fermeture du menu si on clique sur un élément à l'intérieur qui n'est pas le bouton
        presenceDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

// Logique du dropdown de profil
    const profileButton = document.getElementById('profile-toggle-button');
    if (profileContainer && profileButton && profileDropdown) {
        profileButton.onclick = (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
            // Fermer les autres dropdowns
            presenceDropdown?.classList.add('hidden');
            pmrDropdown?.classList.add('hidden');
            pmrChevron?.setAttribute('data-lucide', 'chevron-down');
            lucide.createIcons();
        };
        // Empêche la fermeture du menu si on clique sur un élément à l'intérieur
        profileDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

// NOUVEAU: Logique du dropdown PMR
    if (pmrContainer && pmrButton && pmrDropdown) {
        pmrButton.onclick = (e) => {
            e.stopPropagation();
            pmrDropdown.classList.toggle('hidden');
            pmrChevron.setAttribute('data-lucide', pmrDropdown.classList.contains('hidden') ? 'chevron-down' : 'chevron-up');
            // Fermer les autres dropdowns
            presenceDropdown?.classList.add('hidden');
            profileDropdown?.classList.add('hidden');
            lucide.createIcons();
        };
        // Empêche la fermeture du menu si on clique sur un lien à l'intérieur
        pmrDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }


// Logique de fermeture "Click-away"
    window.addEventListener('click', (e) => {
        // Fermer présence
        if (presenceContainer && !presenceContainer.contains(e.target)) {
            presenceDropdown?.classList.add('hidden');
        }
        // Fermer profil
        if (profileContainer && !profileContainer.contains(e.target)) {
            profileDropdown?.classList.add('hidden');
        }
        // Fermer PMR
        if (pmrContainer && !pmrContainer.contains(e.target)) {
            if (pmrDropdown && !pmrDropdown.classList.contains('hidden')) {
              pmrDropdown.classList.add('hidden');
              pmrChevron?.setAttribute('data-lucide', 'chevron-down');
              lucide.createIcons();
            }
        }
    });
  } // <-- Ferme le if (navLoaded)



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