// js/core/layout.js
import { supabaseClient } from './auth.js';
import { toggleFavorite } from '../modules/favorites.js';
import { 
  highlightActiveLink, hideAdminElements, loadNavAvatar, 
  injectAdminGlowStyles, applyAdminGlow, setupNavDropdowns, 
  setupLogout, setupMobileMenu 
} from '../modules/nav.js';
import { initGlobalSearch } from '../modules/search.js';
import { loadJournalNotificationCount, loadNotificationCount } from '../modules/notifications.js';
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


function setupRealtimeNotifications() {
  if (!currentUserId) return;

  const channel = supabaseClient.channel(`user-notifications:${currentUserId}`);
  
  channel.on(
    'postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'notifications', 
      filter: `user_id_target=eq.${currentUserId}` 
    }, 
    (payload) => {
      // Afficher un popup
      notyf.success(payload.new.message || "Nouvelle notification !");
      // Mettre à jour le badge
      loadNotificationCount();
    }
  ).subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connecté au canal temps réel des notifications.');
    }
  });
}


/**
 * Vérifie s'il y a de nouvelles entrées dans le journal
 */
async function pollJournalNotifications() {
  const badgeElement = document.getElementById('journal-badge');
  if (!badgeElement) return; // Pas sur une page avec la nav

  // On utilise la même clé que le module de notifications
  const JOURNAL_STORAGE_KEY = 'lastJournalVisit'; 
  let lastVisit = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!lastVisit) lastVisit = '1970-01-01T00:00:00.000Z';

  try {
    const { count, error } = await supabaseClient
      .from('main_courante')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastVisit); // Compte les messages plus récents que la dernière visite

    if (error) throw error;

    const oldBadgeCount = parseInt(badgeElement.textContent || '0', 10);

    // Si le compte de la BDD est supérieur à ce que le badge affiche
    if (count > 0 && count > oldBadgeCount) {
      badgeElement.textContent = count;
      badgeElement.classList.remove('hidden');

      // On affiche une notification seulement si le compte a changé
      if (oldBadgeCount === 0) { // N'affiche que la première fois
         notyf.success({
            message: "Nouveau message dans le journal !",
            onClick: () => { window.location.href = 'journal.html'; }
         });
      }
    } else if (count === 0) {
       badgeElement.classList.add('hidden');
       badgeElement.textContent = '';
    }
  } catch (error) {
    console.warn("[Journal Poll] Erreur:", error.message);
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
    loadNotificationCount(); // <-- NOUVEL APPEL
    setupRealtimeNotifications();
    updateUserHeartbeat();

    setInterval(pollJournalNotifications, 30000); // 30 secondes
  }

  // Charger le footer
  const footerLoaded = await loadComponent('footer-placeholder', '_footer.html');
  if (footerLoaded) {
    // Initialiser tout ce qui dépend du footer
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    loadLatestChangelog();
    setupGoToTop();
checkWhatIsNew();

  }

  // Appeler Lucide une fois que tout est chargé
  lucide.createIcons();
}


// 2. Ajoutez cette nouvelle fonction dans js/core/layout.js
async function checkWhatIsNew() {
  const STORAGE_KEY = 'baco-last-seen-changelog-id';
  try {
    // Récupérer le dernier changelog (vous avez déjà cette logique dans utils.js, 
    // mais nous avons besoin de l'ID ici)
    const { data, error } = await supabaseClient
      .from('changelog')
      .select('id, title, type')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    if (!data) return; // Pas de changelog

    const lastSeenId = localStorage.getItem(STORAGE_KEY);

    // Si l'ID du dernier changelog est différent de celui sauvegardé
    if (data.id.toString() !== lastSeenId) {

      let typeText = data.type === 'Nouveau' ? '[Nouveau]' : '[Mise à jour]';

      // Utiliser Notyf pour un popup cliquable
      notyf.success({
        message: `<strong>${typeText}</strong> ${data.title}`,
        duration: 10000, // 10 secondes
        icon: false,
        // Permet à l'utilisateur de cliquer sur la notif pour voir le changelog
        onClick: () => {
          window.location.href = 'changelog.html';
        }
      });

      // Mémoriser que l'utilisateur a vu cette mise à jour
      localStorage.setItem(STORAGE_KEY, data.id.toString());
    }

  } catch (error) {
    console.warn("Erreur 'Quoi de Neuf':", error.message);
  }
}

/**
 * Envoie un "heartbeat" pour marquer l'utilisateur comme actif.
 */
async function updateUserHeartbeat() {
  // currentUserId est défini dans le scope global de layout.js
  if (!currentUserId) return; 

  try {
    // Pas besoin de 'await', laissez-le s'exécuter en arrière-plan
    supabaseClient
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', currentUserId);
  } catch (error) {
    console.warn('Erreur heartbeat:', error.message);
  }
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