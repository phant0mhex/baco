// js/modules/favorites.js
import { supabaseClient } from '../core/auth.js';
import { currentUserId, notyf } from '../core/layout.js';

/**
 * Gère l'ajout ou la suppression d'un favori (VERSION GLOBALE)
 * @param {HTMLElement} element - Le bouton sur lequel on a cliqué
 * @param {string} type - Le type de contenu (ex: 'client_pmr', 'taxi')
 * @param {string|number} id - L'ID du contenu à (dé)favoriser
 * @param {boolean} isFavorited - L'état actuel (true si déjà en favori)
 */
export async function toggleFavorite(element, type, id, isFavorited) {
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
      
      const favCard = element.closest('.favorite-card');
      if (favCard) {
        favCard.remove();
        checkIfFavoritesEmpty(); 
      } else {
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
      
      if (icon) {
        icon.classList.add('fill-yellow-400', 'text-yellow-400');
        icon.classList.remove('text-gray-400');
      }
      element.setAttribute('onclick', `window.toggleFavorite(this, '${type}', '${id}', true)`);
    }
  } catch (error) {
    console.error("Erreur toggleFavorite:", error.message);
    notyf.error("Erreur: " + error.message);
  } finally {
    element.disabled = false;
    element.classList.remove('opacity-50', 'cursor-wait');
  }
}

/**
 * (Fonction utilitaire pour le widget)
 * Vérifie si le conteneur de favoris est vide et affiche un message.
 */
export function checkIfFavoritesEmpty() {
    const list = document.getElementById('favorites-list');
    if (list && list.children.length === 0) {
        list.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-400 col-span-full text-center">Vous n'avez pas encore de favoris.</p>`;
    }
}

// Exposer la fonction à la fenêtre globale pour les `onclick`
window.toggleFavorite = toggleFavorite;