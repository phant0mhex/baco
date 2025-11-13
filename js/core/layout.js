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

// --- VARIABLES GLOBALES EXPORTÉES ---
// Initialise Notyf et l'exporte
export let notyf;
if (typeof Notyf !== 'undefined') {
  notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    dismissible: true
  });
} else {
  console.error("Notyf n'est pas chargé !");
  notyf = { success: (msg) => alert(msg), error: (msg) => alert(msg) };
}

// Récupère l'ID utilisateur et l'exporte
export let currentUserId = null;
const { data: { user } } = await supabaseClient.auth.getUser();
if (user) {
  currentUserId = user.id;
}
// ------------------------------------

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
 * Fonction d'initialisation principale
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
    await loadNavAvatar();
    setupThemeToggle();
    applyAdminGlow();
    initNavCalendar();
    setupMobileMenu();
    setupLogout();
    setupNavDropdowns();
    loadJournalNotificationCount(); // Charger le badge
    // setupRealtimePresence(); // (Fonctionnalité commentée)
  }

  // Charger le footer
  const footerLoaded = await loadComponent('footer-placeholder', '_footer.html');
  if (footerLoaded) {
    // Initialiser tout ce qui dépend du footer
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    loadLatestChangelog(); // Doit passer le client
    setupGoToTop();
  }

  // Appeler Lucide une fois que tout est chargé
  lucide.createIcons();

  // Démarrer le script spécifique à la page (si `pageInit` est défini)
  if (typeof window.pageInit === 'function') {
    window.pageInit();
  }
}

// Lancer l'initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', initLayout);