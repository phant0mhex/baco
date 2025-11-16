// js/pages/ebp.js

window.pageInit = () => {
    
  // --- Variables ---
  let searchTimer;
  let currentPage = 1;
  const rowsPerPage = 15;
  
  // --- Références DOM (déclarées à l'intérieur de pageInit) ---
  const tbody = document.getElementById('ebp-result-tbody');
  const statusMsg = document.getElementById('status-message');
  const paginationContainer = document.getElementById('pagination-container');
  const searchBar = document.getElementById('search-bar'); // Référence à la barre de recherche

  // --- Fonctions ---
  
  const debounceEbpSearch = () => {
    clearTimeout(searchTimer);
    currentPage = 1;
    searchTimer = setTimeout(() => {
      loadData();
    }, 300);
  }
  
  // Attacher aux événements 'oninput' de l'HTML
  searchBar.addEventListener('input', debounceEbpSearch);
  
  const loadData = async () => {
    const searchTerm = searchBar.value.trim();

    tbody.innerHTML = '';
    statusMsg.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
    paginationContainer.innerHTML = '';
    lucide.createIcons();

    try {
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;

      // 1. Requête de COMPTAGE
      let countQuery = supabaseClient
        .from('ebp')
        .select('*', { count: 'exact', head: true });

      // 2. Requête de DONNÉES
      let dataQuery = supabaseClient
        .from('ebp')
        .select('Lignes, PtCar, Abbr, Vue_EBP')
        .order('PtCar', { ascending: true }) // Trier par nom de PtCar
        .range(from, to);

      // 3. Appliquer le filtre de recherche
      if (searchTerm) {
        const searchFilter = `Lignes.ilike.*${searchTerm}*,PtCar.ilike.*${searchTerm}*,Abbr.ilike.*${searchTerm}*,Vue_EBP.ilike.*${searchTerm}*`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }
      
      // 4. Exécuter les requêtes
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalPages = Math.ceil(count / rowsPerPage);

      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      // 5. Afficher les résultats
      statusMsg.innerHTML = '';

      if (data.length === 0) {
        const message = searchTerm
          ? `Aucune donnée ne correspond à "${searchTerm}".`
          : "Aucune donnée trouvée.";
          
        statusMsg.innerHTML = `
          <div class="col-span-full flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
            <i data-lucide="database" class="w-16 h-16 text-gray-300"></i>
            <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucun résultat</h3>
            <p class="mt-2 text-sm text-gray-500">${message}</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      tbody.innerHTML = data.map(row => `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${row.Lignes || 'N/A'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${row.PtCar || 'N/A'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">${row.Abbr || 'N/A'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${row.Vue_EBP || 'N/A'}</td>
        </tr>
      `).join('');
      
      renderPagination(totalPages, count, from, to);

    } catch (error) {
      statusMsg.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
    }
  }
  
  // Attacher à window pour les 'onclick' de la pagination
  window.changePage = (page) => {
    if (page === currentPage) return;
    currentPage = page;
    loadData();
  }
  
  const renderPagination = (totalPages, totalRows, from, to) => {
    const container = document.getElementById('pagination-container');
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    const toRow = Math.min(to + 1, totalRows);
    
    const infoHtml = `
      <p class="text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm px-3 py-1.5">
        Données <span class="font-bold text-gray-900">${from + 1}</span> à <span class="font-bold text-gray-900">${toRow}</span> sur
        <span class="font-bold text-gray-900">${totalRows}</span>
      </p>
    `;
    
    const prevDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;
    
    const buttonsHtml = `
      <div class="flex gap-2">
        <button 
          onclick="window.changePage(${currentPage - 1})" 
          ${prevDisabled ? 'disabled' : ''}
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm 
                 hover:bg-gray-50 
                 disabled:opacity-50 disabled:cursor-not-allowed">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Précédent</span>
        </button>
        
        <button 
          onclick="window.changePage(${currentPage + 1})" 
          ${nextDisabled ? 'disabled' : ''}
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm 
                 hover:bg-gray-50 
                 disabled:opacity-50 disabled:cursor-not-allowed">
          <span>Suivant</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    
    container.innerHTML = infoHtml + buttonsHtml;
    lucide.createIcons();
  }

  // --- Lancement initial ---
  loadData();
  
}; // Fin de window.pageInit