// js/layout.js

// ==========================================================
// == VARIABLES GLOBALES
// ==========================================================
let currentUserId = null;
let notyf;

/**
 * Gère l'ajout ou la suppression d'un favori (VERSION GLOBALE)
 * @param {HTMLElement} element - Le bouton sur lequel on a cliqué
 * @param {string} type - Le type de contenu (ex: 'client_pmr', 'taxi', 'bus_contact', 'repertoire')
 * @param {string|number} id - L'ID du contenu à (dé)favoriser
 * @param {boolean} isFavorited - L'état actuel (true si déjà en favori)
 */
window.toggleFavorite = async function(element, type, id, isFavorited) {
  // S'assure que notyf est initialisé
  if (typeof notyf === 'undefined') {
      console.error('Notyf not initialized!');
      notyf = { success: (msg) => console.log(msg), error: (msg) => console.error(msg) };
  }
  
  // S'assure que currentUserId est chargé
  if (!currentUserId) {
    notyf.error("Erreur: Utilisateur non identifié. Veuillez rafraîchir.");
    return;
  }
  
  element.disabled = true;
  element.classList.add('opacity-50', 'cursor-wait');
  const icon = element.querySelector('i[data-lucide="star"]');

  try {
    if (isFavorited) {
      // --- Supprimer le favori ---
      const { error } = await supabaseClient.from('favoris').delete()
        .match({ user_id: currentUserId, id_contenu: id.toString(), type_contenu: type });
      if (error) throw error;
      
      // Mettre à jour l'UI
      const favCard = element.closest('.favorite-card');
      if (favCard) {
        // Si on est dans le widget d'accueil, supprimer la carte
        favCard.remove();
        checkIfFavoritesEmpty(); // Vérifier si le conteneur est vide
      } else {
        // Sinon, on est sur une page de liste, on met à jour l'icône
        if (icon) {
          icon.classList.remove('fill-yellow-400', 'text-yellow-400');
          icon.classList.add('text-gray-400');
        }
        element.setAttribute('onclick', `window.toggleFavorite(this, '${type}', '${id}', false)`);
      }
      
    } else {
      // --- Ajouter le favori ---
      const { error } = await supabaseClient.from('favoris')
        .insert({ user_id: currentUserId, id_contenu: id.toString(), type_contenu: type });
      if (error) throw error;
      
      // Mettre à jour l'UI (icône et prochain clic)
      if (icon) {
        icon.classList.add('fill-yellow-400', 'text-yellow-400');
        icon.classList.remove('text-gray-400');
      }
      element.setAttribute('onclick', `window.toggleFavorite(this, '${type}', '${id}', true)`);
    }
  } catch (error) {
    console.error("Erreur toggleFavorite:", error.message);
    if (error.message.includes('duplicate key')) {
        notyf.error("Erreur : Ce favori existe déjà.");
        // Force la synchronisation de l'UI
        if (icon) {
            icon.classList.add('fill-yellow-400', 'text-yellow-400');
            icon.classList.remove('text-gray-400');
        }
        element.setAttribute('onclick', `window.toggleFavorite(this, '${type}', '${id}', true)`);
    } else {
        notyf.error("Erreur: " + error.message);
    }
  } finally {
    element.disabled = false;
    element.classList.remove('opacity-50', 'cursor-wait');
  }
}

/**
 * (Fonction utilitaire pour le widget)
 * Vérifie si le conteneur de favoris est vide et affiche un message.
 */
function checkIfFavoritesEmpty() {
    const list = document.getElementById('favorites-list');
    if (list && list.children.length === 0) {
        list.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-400 col-span-full text-center">Vous n'avez pas encore de favoris.</p>`;
    }
}


// ==========================================================
// == CODE D'ORIGINE RESTAURÉ (fonctions, etc.)
// ==========================================================

/**
 * Charge un composant HTML (comme _nav.html ou _footer.html) dans un placeholder
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

// --- Fonctions utilitaires ---
function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage) {
    const navLinksContainer = document.getElementById('nav-links');
    if (navLinksContainer) {
      // Pour le dropdown PMR
      const pmrLink = navLinksContainer.querySelector(`a[href="pmr.html"]`);
      const clientsPmrLink = navLinksContainer.querySelector(`a[href="clients_pmr.html"]`);

      if (pmrLink && clientsPmrLink) {
        if (currentPage === 'pmr.html' || currentPage === 'clients_pmr.html') {
          const pmrButton = document.getElementById('pmr-toggle-button');
          if (pmrButton) {
            pmrButton.classList.add('bg-gray-700', 'font-bold');
          }
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

/**
 * Charge l'avatar et DÉFINIT L'ID UTILISATEUR GLOBAL
 */
async function loadNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  if (!navAvatar) return; 
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
        // Si personne n'est connecté, on arrête (le gardien auth.js s'en chargera)
        return;
    }
    
    currentUserId = user.id; // Définit l'ID global
    
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
  // S'assurer que currentUserId a été défini avant de continuer
  if (!currentUserId) {
    console.warn("Présence non activée: utilisateur non identifié.");
    return;
  }
  
  let userProfile;
  try {
    userProfile = {
      id: currentUserId,
      full_name: 'Utilisateur', // Nom par défaut
      avatar_url: 'https://via.placeholder.com/40'
    };
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', currentUserId)
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
      updateOnlineAvatars(presenceState, currentUserId); // Utiliser currentUserId
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
      .select('title, type') 
      .order('created_at', { ascending: false })
      .limit(1) 
      .single(); 
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

function injectCalendarStyles() {
  const style = document.createElement('style');
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
    .baco-theme .flatpickr-months { background: transparent !important; padding: 0.25rem !important; border-bottom: 1px solid #374151 !important; margin-bottom: 0.75rem !important; }
    .baco-theme .flatpickr-months .flatpickr-month { height: 2.5rem !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month, .baco-theme .flatpickr-months .flatpickr-next-month { fill: #D1D5DB !important; padding: 0.5rem !important; border-radius: 0.375rem !important; top: 0.5rem !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month svg, .baco-theme .flatpickr-months .flatpickr-next-month svg { fill: #D1D5DB !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month:hover, .baco-theme .flatpickr-months .flatpickr-next-month:hover { background: #374151 !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month:hover svg, .baco-theme .flatpickr-months .flatpickr-next-month:hover svg { fill: #F9FAFB !important; }
    .baco-theme .flatpickr-current-month .flatpickr-monthDropdown-months, .baco-theme .flatpickr-current-month input.cur-year { font-size: 1.125rem !important; font-weight: 600 !important; color: #F9FAFB !important; background: transparent !important; border: none !important; padding: 0 0.25rem !important; border-radius: 0.375rem !important; transition: background 0.1s ease !important; }
    .baco-theme .flatpickr-current-month .flatpickr-monthDropdown-months:hover, .baco-theme .flatpickr-current-month input.cur-year:hover { background: #374151 !important; }
    .baco-theme .numInputWrapper { width: 4rem !important; }
    .baco-theme .flatpickr-weekdaycontainer { padding: 0 0.5rem !important; }
    .baco-theme .flatpickr-weekday { color: #9CA3AF !important; font-weight: 500 !important; font-size: 0.75rem !important; text-transform: uppercase !important; background: transparent !important; height: 2rem !important; line-height: 2rem !important; }
    .baco-theme .flatpickr-weekwrapper { border-right: 1px solid #374151 !important; margin-right: 0.5rem !important; }
    .baco-theme .flatpickr-weekwrapper .flatpickr-weeks { padding: 0 0.5rem !important; box-shadow: none !important; }
    .baco-theme .flatpickr-weekwrapper .flatpickr-weeks span { color: #9CA3AF !important; font-size: 0.875rem !important; font-weight: 500 !important; height: 2.25rem !important; line-height: 2.25rem !important; }
    .baco-theme .dayContainer { padding: 0 !important; }
    .baco-theme .flatpickr-day { color: #D1D5DB !important; border: 1px solid transparent !important; border-radius: 0.375rem !important; font-weight: 400 !important; height: 2.25rem !important; line-height: 2.25rem !important; }
    .baco-theme .flatpickr-day:hover { background: #374151 !important; color: #F9FAFB !important; border-color: #374151 !important; }
    .baco-theme .flatpickr-day.today { background: transparent !important; border: 1px solid #2563EB !important; color: #F9FAFB !important; }
    .baco-theme .flatpickr-day.today:hover { background: #374151 !important; border-color: #374151 !important; }
    .baco-theme .flatpickr-day.selected, .baco-theme .flatpickr-day.startRange, .baco-theme .flatpickr-day.endRange { background: #2563EB !important; border-color: #2563EB !important; color: #FFFFFF !important; }
    .baco-theme .flatpickr-day.flatpickr-disabled, .baco-theme .flatpickr-day.prevMonthDay, .baco-theme .flatpickr-day.nextMonthDay { color: #4B5563 !important; background: transparent !important; border-color: transparent !important; }
    .baco-theme .flatpickr-day.prevMonthDay:hover, .baco-theme .flatpickr-day.nextMonthDay:hover { background: transparent !important; border-color: transparent !important; color: #4B5563 !important; }
  `;
  document.head.appendChild(style);
}

// ===============================================================
// ==              SECTION RECHERCHE GLOBALE
// ===============================================================

let globalSearchTimer;
let globalSearchModal;
let globalSearchInput;
let globalSearchResults;
let globalSearchSpinner;
let globalSearchSelectedIndex = -1;

function createSearchModal() {
  const style = document.createElement('style');
  style.innerHTML = `
    #global-search-modal { z-index: 100; }
    #global-search-modal-panel { max-height: 80vh; }
    .search-result-item:hover, .search-result-item.selected { background-color: #374151; }
    kbd { font-family: 'Geist Mono', monospace; font-size: 0.75rem; background-color: #374151; border: 1px solid #4B5563; border-radius: 4px; padding: 2px 5px; }
  `;
  document.head.appendChild(style);
  const modalHtml = `
    <div id="global-search-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-start justify-center p-4 pt-[20vh]" style="display: none;">
      <div id="global-search-modal-panel" class="bg-gray-800 text-gray-200 rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden">
        <div class="relative flex items-center p-4 border-b border-gray-700">
          <i data-lucide="search" class="w-5 h-5 text-gray-400 absolute left-7"></i>
          <input type="text" id="global-search-input" placeholder="Chercher partout..." class="w-full bg-gray-800 border-0 text-lg text-white pl-10 pr-4 py-2 focus:outline-none placeholder-gray-500">
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
  globalSearchModal = document.getElementById('global-search-modal');
  globalSearchInput = document.getElementById('global-search-input');
  globalSearchResults = document.getElementById('global-search-results');
  globalSearchSpinner = document.getElementById('global-search-spinner');
  globalSearchModal.addEventListener('click', (e) => {
    if (e.target.id === 'global-search-modal') {
      hideGlobalSearch();
    }
  });
  globalSearchInput.addEventListener('keydown', (e) => {
    const results = globalSearchResults.querySelectorAll('.search-result-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault(); 
      if (results.length > 0) {
        globalSearchSelectedIndex = (globalSearchSelectedIndex + 1) % results.length;
        updateSelectedResult(results);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); 
      if (results.length > 0) {
        globalSearchSelectedIndex = (globalSearchSelectedIndex - 1 + results.length) % results.length;
        updateSelectedResult(results);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (globalSearchSelectedIndex > -1 && results[globalSearchSelectedIndex]) {
        results[globalSearchSelectedIndex].click(); 
      }
    } else if (e.key === 'Escape') {
      hideGlobalSearch();
    }
  });
  globalSearchInput.addEventListener('keyup', (e) => {
    const navKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
    if (!navKeys.includes(e.key)) {
      debounceSearch();
    }
  });
}
function showGlobalSearch() {
  if (globalSearchModal) {
    globalSearchModal.style.display = 'flex';
    lucide.createIcons(); 
    globalSearchInput.value = '';
    globalSearchInput.focus();
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Commencez à taper pour rechercher...</p>';
  }
}
function hideGlobalSearch() {
  if (globalSearchModal) {
    globalSearchModal.style.display = 'none';
  }
}
function debounceSearch() {
  clearTimeout(globalSearchTimer);
  globalSearchTimer = setTimeout(() => {
    executeSearch();
  }, 300); 
}
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
function updateSelectedResult(results) {
  results = results || globalSearchResults.querySelectorAll('.search-result-item');
  results.forEach((item, index) => {
    if (index === globalSearchSelectedIndex) {
      item.classList.add('selected'); 
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}
function renderSearchResults(results) {
  globalSearchSelectedIndex = -1; 
  if (!results || results.length === 0) {
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Aucun résultat trouvé.</p>';
    return;
  }
  const iconMap = {
    'Contact': 'book-user', 'Procédure': 'shield', 'Client PMR': 'users', 'PtCar': 'tag',
    'Taxi': 'car', 'Bus (Société)': 'bus', 'Bus (Chauffeur)': 'user-check', 'Contact Bus': 'user-check'
  };
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
  lucide.createIcons();
}
function globalKeyListener(e) {
  const modalVisible = (globalSearchModal && globalSearchModal.style.display === 'flex');
  if (e.shiftKey && e.key === 'K') {
    e.preventDefault();
    modalVisible ? hideGlobalSearch() : showGlobalSearch();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    modalVisible ? hideGlobalSearch() : showGlobalSearch();
  }
}

// ===============================================================
// ==              SECTION NOTIFICATIONS JOURNAL              ==
// ===============================================================

const JOURNAL_STORAGE_KEY = 'lastJournalVisit';

async function loadJournalNotificationCount() {
    const badgeElement = document.getElementById('journal-badge');
    if (!badgeElement) return;
    let lastVisit = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!lastVisit) {
        lastVisit = '1970-01-01T00:00:00.000Z';
    }
    try {
        const { count, error } = await supabaseClient
            .from('main_courante')
            .select('id', { count: 'exact', head: true })
            .gt('created_at', lastVisit);
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
window.loadJournalNotificationCount = loadJournalNotificationCount;

// ===============================================================
// ==              SECTION LIGHT/DARK MODE TOGGLE               ==
// ===============================================================

function setupThemeToggle() {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const themeStorageKey = 'baco-theme'; 

    if (!themeToggleButton || !themeToggleIcon) {
        return;
    }

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            themeToggleIcon.setAttribute('data-lucide', 'moon');
        } else {
            document.documentElement.classList.remove('dark');
            themeToggleIcon.setAttribute('data-lucide', 'sun');
        }
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    };

    let savedTheme = localStorage.getItem(themeStorageKey);
    if (!savedTheme) {
        savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    applyTheme(savedTheme);

    themeToggleButton.addEventListener('click', () => {
        let newTheme;
        if (document.documentElement.classList.contains('dark')) {
            newTheme = 'light';
        } else {
            newTheme = 'dark';
        }
        applyTheme(newTheme);
        localStorage.setItem(themeStorageKey, newTheme);
    });
}


// --- Exécution principale au chargement du DOM ---

document.addEventListener('DOMContentLoaded', async () => {
  
  // --- INITIALISATION GLOBALE DE NOTYF ---
  if (typeof Notyf !== 'undefined') {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' },
      dismissible: true
    });
  } else {
    // Fallback au cas où Notyf n'est pas chargé (ex: _nav.html manquant)
    console.error("Notyf n'est pas chargé !");
    notyf = { success: (msg) => alert(msg), error: (msg) => alert(msg) };
  }
  
  injectCalendarStyles();
  createSearchModal();
  window.addEventListener('keydown', globalKeyListener);
  hideAdminElements();
  
  // Charger la navigation
  const navLoaded = await loadComponent('nav-placeholder', '_nav.html');
  if (navLoaded) {
    // Si la nav a chargé, exécuter tous les scripts qui en dépendent
    highlightActiveLink();
    await loadNavAvatar(); // <-- ATTENDRE que l'ID utilisateur soit défini
    setupRealtimePresence(); 
    setupThemeToggle();

    // --- Initialisation du Calendrier ---
    const calendarButton = document.getElementById('calendar-toggle-button');
    if (calendarButton) {
      if (typeof flatpickr !== 'undefined' && flatpickr.l10ns.fr) {
        flatpickr(calendarButton, {
          weekNumbers: true,
          locale: "fr",
          position: 'auto right',
          appendTo: document.body, 
          onReady: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add('font-sans');
            instance.calendarContainer.classList.add('baco-theme');
          }
        });
      } else {
        console.warn('Flatpickr (ou sa traduction FR) n\'est pas chargé.');
      }
    }

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
            profileDropdown?.classList.add('hidden');
            pmrDropdown?.classList.add('hidden');
            pmrChevron?.setAttribute('data-lucide', 'chevron-down');
            lucide.createIcons();
        };
        presenceDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    // Logique du dropdown de profil
    const profileButton = document.getElementById('profile-toggle-button');
    if (profileContainer && profileButton && profileDropdown) {
        profileButton.onclick = (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
            presenceDropdown?.classList.add('hidden');
            pmrDropdown?.classList.add('hidden');
            pmrChevron?.setAttribute('data-lucide', 'chevron-down');
            lucide.createIcons();
        };
        profileDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    // Logique du dropdown PMR
    if (pmrContainer && pmrButton && pmrDropdown) {
        pmrButton.onclick = (e) => {
            e.stopPropagation();
            pmrDropdown.classList.toggle('hidden');
            pmrChevron.setAttribute('data-lucide', pmrDropdown.classList.contains('hidden') ? 'chevron-down' : 'chevron-up');
            presenceDropdown?.classList.add('hidden');
            profileDropdown?.classList.add('hidden');
            lucide.createIcons();
        };
        pmrDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    // Logique de fermeture "Click-away"
    window.addEventListener('click', (e) => {
        if (presenceContainer && !presenceContainer.contains(e.target)) {
            presenceDropdown?.classList.add('hidden');
        }
        if (profileContainer && !profileContainer.contains(e.target)) {
            profileDropdown?.classList.add('hidden');
        }
        if (pmrContainer && !pmrContainer.contains(e.target)) {
            if (pmrDropdown && !pmrDropdown.classList.contains('hidden')) {
              pmrDropdown.classList.add('hidden');
              pmrChevron?.setAttribute('data-lucide', 'chevron-down');
              lucide.createIcons();
            }
        }
    });

    // ==========================================================
    // == CORRECTION : APPEL DE pageInit()
    // ==========================================================
    // Une fois la nav et l'utilisateur chargés, on démarre le script de la page
    if (typeof window.pageInit === 'function') {
      window.pageInit();
    }
    
  } // <-- Ferme le if (navLoaded)

  // Charger le footer
  const footerLoaded = await loadComponent('footer-placeholder', '_footer.html');
  if (footerLoaded) {
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
    
    loadLatestChangelog(); // Charger la version

    // Logique "GO TO TOP"
    const goToTopButton = document.getElementById('go-to-top-button');
    if (goToTopButton) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 200) { // S'affiche après 200px de scroll
          goToTopButton.classList.remove('hidden', 'opacity-0');
        } else {
          goToTopButton.classList.add('opacity-0');
          setTimeout(() => {
             if (window.scrollY <= 200) { // Revérifier au cas où l'utilisateur scrolle à nouveau
                goToTopButton.classList.add('hidden');
             }
          }, 300); // 300ms = duration-300
        }
      });
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