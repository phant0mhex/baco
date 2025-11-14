// js/modules/search.js
import { supabaseClient } from '../core/auth.js';

let globalSearchTimer;
let globalSearchModal;
let globalSearchInput;
let globalSearchResults;
let globalSearchSpinner;
let globalSearchSelectedIndex = -1;

function createSearchModal() {
  const style = document.createElement('style');
  style.innerHTML = `
    #global-search-modal { z-index: 1050; }
    #global-search-modal-panel { max-height: 80vh; }
    .search-result-item:hover, .search-result-item.selected { background-color: #374151; }
kbd { font-family: 'Geist Mono', monospace; font-size: 0.75rem; background-color: #374151; border: 1px solid #4B5563; border-radius: 4px; padding: 2px 5px; color: #E5E7EB; }  `;
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
      results[globalSearchSelectedIndex].click(); 
    }
  } else if (e.key === 'Escape') {
    hideGlobalSearch();
  }
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
// Exposer showGlobalSearch à la fenêtre pour le `onclick` dans _nav.html
window.showGlobalSearch = showGlobalSearch;

function hideGlobalSearch() {
  if (globalSearchModal) globalSearchModal.style.display = 'none';
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
  if ((e.shiftKey && e.key === 'K') || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
    e.preventDefault();
    modalVisible ? hideGlobalSearch() : showGlobalSearch();
  }
}

/**
 * Initialise toute la fonctionnalité de recherche globale
 */
export function initGlobalSearch() {
  createSearchModal();
  window.addEventListener('keydown', globalKeyListener);
}