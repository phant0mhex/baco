// js/modules/notifications.js
import { supabaseClient } from '../core/auth.js';

const JOURNAL_STORAGE_KEY = 'lastJournalVisit';

/**
 * Charge le nombre de nouveaux messages du journal et met à jour le badge
 */
export async function loadJournalNotificationCount() {
  const badgeElement = document.getElementById('journal-badge');
  if (!badgeElement) return;

  let lastVisit = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!lastVisit) lastVisit = '1970-01-01T00:00:00.000Z';

  try {
    const { count, error } = await supabaseClient
      .from('main_courante')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastVisit);
      
    if (error) throw error;
    
    if (count > 0) {
      badgeElement.textContent = count;
      badgeElement.classList.remove('hidden'); 
    } else {
      badgeElement.classList.add('hidden');
      badgeElement.textContent = '';
    }
  } catch (error) {
    console.error("[Journal Badge] Erreur:", error.message);
    badgeElement.classList.add('hidden');
  }
}

// Exposer à la fenêtre pour que journal.html puisse l'appeler
window.loadJournalNotificationCount = loadJournalNotificationCount;


// --- NOUVELLES FONCTIONS POUR LA CLOCHE ---

/**
 * NOUVEAU: Récupère le COMPTE des notifications non lues
 */
export async function loadNotificationCount() {
  const badge = document.getElementById('notifications-badge');
  if (!badge || !currentUserId) return;

  try {
    const { count, error } = await supabaseClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id_target', currentUserId)
      .eq('is_read', false);

    if (error) throw error;

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (error) {
    console.error("[Notif Badge] Erreur:", error.message);
  }
}

/**
 * NOUVEAU: Charge le contenu du dropdown des notifications
 */
export async function loadNotificationDropdown() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Chargement...</p>';

  try {
    const { data, error } = await supabaseClient
      .from('notifications')
      .select('id, message, link_url, created_at')
      .eq('user_id_target', currentUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (data.length === 0) {
      list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Aucune nouvelle notification.</p>';
    } else {
      list.innerHTML = data.map(notif => `
        <a href="${notif.link_url || '#'}" class="block p-3 rounded-md hover:bg-gray-700">
          <p class="text-sm text-gray-100">${notif.message}</p>
          <span class="text-xs text-blue-400">${new Date(notif.created_at).toLocaleString('fr-FR')}</span>
        </a>
      `).join('');
    }
    
    // Une fois qu'on a cliqué sur la cloche, on marque tout comme lu
    markNotificationsAsRead();

  } catch (error) {
    console.error("[Notif Dropdown] Erreur:", error.message);
    list.innerHTML = '<p class="p-3 text-sm text-center text-red-400">Erreur de chargement.</p>';
  }
}

/**
 * NOUVEAU: Marque toutes les notifications comme lues
 */
async function markNotificationsAsRead() {
  try {
    const { error } = await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id_target', currentUserId)
      .eq('is_read', false);
      
    if (error) throw error;
    
    // Cacher le badge visuellement
    const badge = document.getElementById('notifications-badge');
    if (badge) badge.classList.add('hidden');
    
  } catch (error) {
    console.error("[Notif Mark Read] Erreur:", error.message);
  }
}