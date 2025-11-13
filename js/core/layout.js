// js/core/layout.js
import { supabaseClient } from './auth.js';
import { toggleFavorite } from '../modules/favorites.js';
import { 
  highlightActiveLink, hideAdminElements, loadNavAvatar, 
  injectAdminGlowStyles, applyAdminGlow, setupNavDropdowns, 
  setupLogout, setupMobileMenu 
} from '../modules/nav.js';
import { initGlobalSearch } from '../modules/search.js';
import { loadJournalNotificationCount } from '../modules/notifications.js';
import { setupThemeToggle } from '../modules/theme.js';
import { loadComponent, loadLatestChangelog, injectCalendarStyles, setupGoToTop } from '../modules/utils.js';

// --- EXPORTS GLOBAUX ---
// (Ces exports sont utilisés par les autres modules)

export let notyf;
if (typeof Notyf !== 'undefined') {
  notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    dismissible: true
  });
  window.notyf = notyf; // Rendre notyf global également
} else {
  console.error("Notyf n'est pas chargé !");
  notyf = { success: (msg) => alert(msg), error: (msg) => alert(msg) };
  window.notyf = notyf;
}

export let currentUserId = null;
// -------------------------

/**
 * Initialise le calendrier Flatpickr sur le bouton de la nav
 */
function initNavCalendar() {
  const calendarButton = document.getElementById('calendar-toggle-button');
  if (calendarButton && typeof flatpickr !== 'undefined' && flatpickr.l10ns.fr) {
    flatpickr(calendarButton, {
      weekNumbers: true,
      locale: "fr",
      position: 'auto right',
      appendTo: document.body, 
      onReady: (selectedDates, dateStr, instance) => {
        instance.calendarContainer.classList.add('font-sans', 'baco-theme');
      }
    });
  }
}

/**
 * Fonction interne pour charger les composants de layout
 */
async function initLayout() {
  // Injecter les styles globaux
  injectCalendarStyles();
  injectAdminGlowStyles();
  
  // Mettre en place les fonctionnalités de base
  initGlobalSearch();
  hideAdminElements();

  // Charger la navigation
  const navLoaded = await loadComponent('nav-placeholder', '_nav.html');
  if (navLoaded) {
    // Initialiser tout ce qui dépend de la nav
    highlightActiveLink();
    await loadNavAvatar(); // Doit être 'await'
    setupThemeToggle();
    applyAdminGlow();
    initNavCalendar();
    setupMobileMenu();
    setupLogout();
    setupNavDropdowns();
    loadJournalNotificationCount(); // Charger le badge
  }

  // Charger le footer
  const footerLoaded = await loadComponent('footer-placeholder', '_footer.html');
  if (footerLoaded) {
    // Initialiser tout ce qui dépend du footer
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    loadLatestChangelog();
    setupGoToTop();
  }

  // Appeler Lucide une fois que tout est chargé
  lucide.createIcons();
}

/**
 * Fonction de DÉMARRAGE PRINCIPALE
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Exécuter le gardien d'authentification
  const { data: { session } } = await supabaseClient.auth.getSession();
  const currentPage = window.location.pathname.split('/').pop();

  if (!session) {
    sessionStorage.removeItem('userRole');
    if (currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
      window.location.href = 'index.html';
      return; // Arrêter l'exécution
    }
  } else {
    // Utilisateur connecté
    const userRole = session.user.user_metadata?.role || 'user';
    sessionStorage.setItem('userRole', userRole);
    
    // 2. Définir l'ID utilisateur global
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      currentUserId = user.id;
      window.currentUserId = currentUserId; // Rendre global
    }
  }
  
  // 3. Si on est sur index ou reset, ne pas charger le layout (nav/footer)
  if (currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
    // 4. Lancer l'initialisation du layout (nav/footer)
    await initLayout();
  }

  // 5. Révéler le corps
  document.body.style.visibility = 'visible';
  
  // 6. Démarrer le script spécifique à la page
  // (uniquement si ce n'est pas index/reset ET que la page a un script d'init)
  if (typeof window.pageInit === 'function' && currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
    window.pageInit();
  }
});