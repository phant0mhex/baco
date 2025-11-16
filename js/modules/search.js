// js/modules/search.js
import { supabaseClient } from '../core/auth.js';

let globalSearchTimer;
let globalSearchModal;
let globalSearchInput;
let globalSearchResults;
let globalSearchSpinner;
let globalSearchSelectedIndex = -1;
let onResultSelectCallback = null; // Variable d'état pour le callback

function createSearchModal() {
  const style = document.createElement('style');
  style.innerHTML = `
    #global-search-modal { z-index: 1050; }
    #global-search-modal-panel { max-height: 80vh; }
    .search-result-item:hover, .search-result-item.selected { background-color: #374151; }
    kbd { font-family: 'Geist Mono', monospace; font-size: 0.75rem; background-color: #374151; border: 1px solid #4B5563; border-radius: 4px; padding: 2px 5px; color: #E5E7EB; }
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
    if (e.target.id === 'global-search-modal') hideGlobalSearch();
  });
  globalSearchInput.addEventListener('keydown', handleSearchKeyDown);
  globalSearchInput.addEventListener('keyup', (e) => {
    const navKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
    if (!navKeys.includes(e.key)) debounceSearch();
  });
}

/**
 * Gère la navigation au clavier dans le modal de recherche
 */
function handleSearchKeyDown(e) {
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
      // Appelle la fonction de clic générique
      handleResultClick(results[globalSearchSelectedIndex]);
    }
  } else if (e.key === 'Escape') {
    hideGlobalSearch();
  }
}

/**
 * Accepte un callback pour le mode "sélection"
 */
window.showGlobalSearch = (callback = null) => {
  onResultSelectCallback = callback; // Stocker le callback

  if (globalSearchModal) {
    globalSearchModal.style.display = 'flex';
    lucide.createIcons();
    globalSearchInput.value = '';
    globalSearchInput.focus();

    // Changer le placeholder si on est en mode "sélection"
    if (callback) {
      globalSearchInput.placeholder = "Chercher un contenu à lier...";
    } else {
      globalSearchInput.placeholder = "Chercher partout...";
    }

    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Commencez à taper pour rechercher...</p>';
  }
}

function hideGlobalSearch() {
  if (globalSearchModal) globalSearchModal.style.display = 'none';
  onResultSelectCallback = null; // Réinitialiser le callback à la fermeture
}

function debounceSearch() {
  clearTimeout(globalSearchTimer);
  globalSearchTimer = setTimeout(executeSearch, 300);
}

async function executeSearch() {
  const searchTerm = globalSearchInput.value;
  if (searchTerm.length < 2) {
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Tapez au moins 2 caractères...</p>';
    return;
  }
  globalSearchSpinner.style.display = 'block';
  try {
    // Appelle la RPC (qui inclut maintenant les documents)
    const { data, error } = await supabaseClient.rpc('global_search', { search_term: searchTerm });
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
    item.classList.toggle('selected', index === globalSearchSelectedIndex);
    if (index === globalSearchSelectedIndex) item.scrollIntoView({ block: 'nearest' });
  });
}

/**
 * Fonction centrale pour gérer un clic ou "Entrée"
 */
function handleResultClick(element) {
  // Récupérer l'objet de données stocké
  const result = JSON.parse(element.dataset.result);

  if (onResultSelectCallback) {
    // Mode "Liaison" : Appeler le callback avec l'objet résultat
    onResultSelectCallback(result);
    hideGlobalSearch();
  } else {
    // Mode "Navigation" (défaut) : Aller à l'URL
    
    // Si c'est un document, ouvrir dans un nouvel onglet
    if (result.type === 'document') {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = result.url;
    }
    hideGlobalSearch();
  }
}
// Exposer la fonction de clic pour les `onclick`
window.handleResultClick = handleResultClick;


/**
 * Affiche les résultats et stocke les données
 */
function renderSearchResults(results) {
  globalSearchSelectedIndex = -1;
  if (!results || results.length === 0) {
    globalSearchResults.innerHTML = '<p class="text-center text-gray-500 p-6">Aucun résultat trouvé.</p>';
    return;
  }
  
  const iconMap = {
    'contact_repertoire': 'book-user',
    'procedure': 'shield',
    'client_pmr': 'users',
    'ptcar': 'tag',
    'taxi': 'car',
    'bus': 'bus',
    'document': 'file-text'
    //... (ajoutez d'autres clés si nécessaire)
  };

  globalSearchResults.innerHTML = results.map(r => {
    // Préparer l'objet de données à passer au callback
    const resultObject = {
      id: r.result_id,
      type: r.result_type_key, // La clé (ex: 'client_pmr')
      title: r.title,
      snippet: r.snippet,
      icon: iconMap[r.result_type_key] || 'file',
      url: r.url // Garder l'URL pour la navigation
    };
    
    const iconName = iconMap[r.result_type_key] || 'file';

    // MODIFIÉ : Utiliser <button> et stocker l'objet JSON dans data-result
    // C'EST LE CHANGEMENT CLÉ QUI CORRIGE VOTRE BUG
    return `
    <button 
      type="button"
      onclick="handleResultClick(this)"
      data-result='${JSON.stringify(resultObject)}'
      class="search-result-item w-full flex items-center justify-between gap-4 p-3 rounded-md cursor-pointer text-left">
      
      <div class="flex items-center gap-4 overflow-hidden">
        <i data-lucide="${iconName}" class="w-5 h-5 text-gray-400 flex-shrink-0"></i>
        <div class="overflow-hidden">
          <p class="text-base text-white font-medium truncate">${r.title}</p>
          <p class="text-sm text-gray-400 truncate">${r.snippet}</p>
        </div>
      </div>
      <span class="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">${r.result_type}</span>
    </button>
    `;
  }).join('');
  lucide.createIcons();
}

function globalKeyListener(e) {
  const modalVisible = (globalSearchModal && globalSearchModal.style.display === 'flex');
  if ((e.shiftKey && e.key === 'K') || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
    e.preventDefault();
    modalVisible ? hideGlobalSearch() : window.showGlobalSearch(); // Utiliser window.show
  }
}

export function initGlobalSearch() {
  createSearchModal();
  window.addEventListener('keydown', globalKeyListener);
}