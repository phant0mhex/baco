// js/pages/clientspmr.js

let searchTimer;
let currentPage = 1;
const rowsPerPage = 12;

window.pageInit = () => {

  // --- DÉCLARATIONS DÉPLACÉES À L'INTÉRIEUR ---
  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const resultDisplay = document.getElementById('result-display');
  const statusMsg = document.getElementById('status-message');
  const searchBar = document.getElementById('search-bar');
  const paginationContainer = document.getElementById('pagination-container');
  const modal = document.getElementById('client-modal');
  const modalForm = document.getElementById('client-form');
  const modalTitle = document.getElementById('modal-title');
  const modalClientId = document.getElementById('modal-client-id');
  const modalSubmitButton = document.getElementById('modal-submit-button');
  const viewToggleGrid = document.getElementById('view-toggle-grid');
  const viewToggleList = document.getElementById('view-toggle-list');
  const resultGrid = document.getElementById('result-grid');
  const resultTableContainer = document.getElementById('result-table-container');
  const resultTableBody = document.getElementById('result-table-body');
  const viewPreferenceKey = 'baco-client-view';
  let currentView = localStorage.getItem(viewPreferenceKey) || 'grid';

  // --- FONCTIONS INTERNES (const) ---

  const formatTraceabilityDate = (dateString) => {
    return window.formatDate(dateString, 'short'); // Utilise la fonction globale
  }

  const renderClientRow = (client, searchTerm) => {
    const clientJson = JSON.stringify(client).replace(/"/g, "&quot;");
    const displayName = window.highlightText(`${client.prenom || ''} ${client.nom}`, searchTerm);
    const displayType = window.highlightText(client.type, searchTerm);
    const cleanedPhone = window.cleanPhoneNumber(client.telephone);
    const formattedPhone = client.telephone ? window.formatPhoneNumber(cleanedPhone) : null;
    const displayTel = window.highlightText(formattedPhone, searchTerm);

    let typeClass = 'bg-gray-100 text-gray-800';
    if (client.type === 'CRP' || client.type === 'CRF') typeClass = 'bg-red-100 text-red-800';
    else if (client.type === 'CRE') typeClass = 'bg-yellow-100 text-yellow-800';

    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">${displayName}</div>
        </td>
       <td class="px-6 py-4 whitespace-nowrap">
          ${client.telephone ? `<a href="etrali:0${cleanedPhone}" class="text-sm text-blue-600 hover:text-blue-800">${displayTel}</a>` : `<span class="text-sm text-gray-400">N/A</span>`}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${client.type ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${displayType}</span>` : ''}
        </td>
        <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${client.remarques || ''}">
          ${client.remarques || ''}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
          <button onclick="window.showPmrClientModal(${clientJson})" class="p-1 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>
          <button onclick="window.deletePmrClient(${client.id}, '${client.prenom} ${client.nom}')" class="admin-only p-1 text-red-600 rounded-full hover:bg-red-100" title="Supprimer">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }

  const renderClientCard = (client, searchTerm) => {
    const clientJson = JSON.stringify(client).replace(/"/g, "&quot;");
    let typeClass = 'bg-gray-100 text-gray-800';
    if (client.type === 'CRP' || client.type === 'CRF') {
      typeClass = 'bg-red-100 text-red-800';
    } else if (client.type === 'CRE') {
      typeClass = 'bg-yellow-100 text-yellow-800';
    }
    const hasRemarques = client.remarques && client.remarques.trim() !== '';
    const displayName = window.highlightText(`${client.prenom || ''} ${client.nom}`, searchTerm);
    const displayType = window.highlightText(client.type, searchTerm);
    const cleanedPhoneCard = window.cleanPhoneNumber(client.telephone);
    const formattedPhoneCard = client.telephone ? window.formatPhoneNumber(cleanedPhoneCard) : null;
    const displayTelCard = window.highlightText(formattedPhoneCard, searchTerm);
    let traceabilityHtml = '';
    if (client.updated_at && client.profiles) {
      const date = formatTraceabilityDate(client.updated_at);
      const name = client.profiles.full_name || 'un utilisateur';
      traceabilityHtml = `
        <div class="px-4 pt-3 pb-2 border-t border-gray-100">
          <p class="text-xs text-gray-500 italic">
            Modifié par ${name} ${date}
          </p>
        </div>
      `;
    } else if (client.updated_at) {
      const date = formatTraceabilityDate(client.updated_at);
      traceabilityHtml = `
        <div class="px-4 pt-3 pb-2 border-t border-gray-100">
          <p class="text-xs text-gray-500 italic">
            Modifié ${date}
          </p>
        </div>
      `;
    }
    return `
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
        <div class="flex justify-between items-start p-4 border-b">
          <div>
            <h3 class="text-xl font-bold text-blue-700">${displayName}</h3>
            ${client.type ? `<span class="mt-1 inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${typeClass}">${displayType}</span>` : ''}
          </div>
          <div class="flex items-center flex-shrink-0 gap-0">
            <button onclick="window.showPmrClientModal(${clientJson})" class="p-2 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="window.deletePmrClient(${client.id}, '${client.prenom} ${client.nom}')" class="admin-only p-2 text-red-600 rounded-full hover:bg-red-100" title="Supprimer">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <div class="p-4 space-y-3">
          ${client.telephone ? `
          <a href="etrali:0${cleanedPhoneCard}" class="flex items-center gap-3">
            <i data-lucide="phone" class="w-4 h-4 text-gray-500 flex-shrink-0"></i>
            <span class="text-sm font-medium text-gray-800 hover:text-blue-600">${displayTelCard}</span>
          </a>` : ''}
          ${hasRemarques ? `
          <div class="flex items-start gap-3 pt-3 border-t border-gray-100">
            <i data-lucide="info" class="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5"></i>
            <p class="text-sm text-gray-700">${client.remarques}</p>
          </div>` : ''}
        </div>
        ${traceabilityHtml}
      </div>
    `;
  }

  const updateViewToggleUI = () => {
    if (currentView === 'list') {
      viewToggleList.classList.add('bg-gray-100', 'text-blue-600');
      viewToggleGrid.classList.remove('bg-gray-100', 'text-blue-600');
      resultGrid.classList.add('hidden');
      resultTableContainer.classList.remove('hidden');
    } else {
      viewToggleGrid.classList.add('bg-gray-100', 'text-blue-600');
      viewToggleList.classList.remove('bg-gray-100', 'text-blue-600');
      resultTableContainer.classList.add('hidden');
      resultGrid.classList.remove('hidden');
    }
  }

  const setView = (view) => {
    if (view === currentView) return;
    currentView = view;
    localStorage.setItem(viewPreferenceKey, currentView);
    loadData();
  }

  const loadData = async () => {
    resultGrid.innerHTML = '';
    resultTableBody.innerHTML = '';
    statusMsg.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    paginationContainer.innerHTML = '';
    lucide.createIcons();
    updateViewToggleUI();

    const searchTerm = searchBar.value.trim();
    const from = (currentPage - 1) * rowsPerPage;
    const to = from + rowsPerPage - 1;

    try {
      const searchFilter = `nom.ilike.*${searchTerm}*,prenom.ilike.*${searchTerm}*,telephone.ilike.*${searchTerm}*,type.ilike.*${searchTerm}*`;

      let countQuery = supabaseClient
        .from('pmr_clients')
        .select('*', { count: 'exact', head: true });
      if (searchTerm) {
        countQuery = countQuery.or(searchFilter);
      }
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      const totalPages = Math.ceil(count / rowsPerPage);

      let dataQuery = supabaseClient
        .from('pmr_clients')
        .select(`*, updated_at, profiles ( full_name )`)
        .order('nom', { ascending: true })
        .range(from, to);
      if (searchTerm) {
        dataQuery = dataQuery.or(searchFilter);
      }
      const { data, error } = await dataQuery;
      if (error) throw error;

      statusMsg.innerHTML = '';

      if (data.length === 0) {
        statusMsg.innerHTML = `
          <div class="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
            <i data-lucide="user-x" class="w-16 h-16 text-gray-300"></i>
            <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucun client trouvé</h3>
            <p class="mt-2 text-sm text-gray-500">Aucun client ne correspond à votre recherche.</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      if (currentView === 'list') {
        resultTableBody.innerHTML = data.map(client => renderClientRow(client, searchTerm)).join('');
      } else {
        resultGrid.innerHTML = data.map(client => renderClientCard(client, searchTerm)).join('');
      }
      renderPagination(totalPages, count, from, to);
      lucide.createIcons();
      if (window.hideAdminElements) window.hideAdminElements();

    } catch (error) {
      statusMsg.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
      notyf.error('Erreur lors du chargement des clients.');
    }
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
        Clients <span class="font-bold text-gray-900">${from + 1}</span> à <span class="font-bold text-gray-900">${toRow}</span> sur
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

  // --- ATTACHER LES FONCTIONS À WINDOW ---

  window.debouncePmrSearch = () => {
    clearTimeout(searchTimer);
    currentPage = 1;
    searchTimer = setTimeout(() => {
      loadData();
    }, 300);
  }

  window.changePage = (page) => {
    if (page === currentPage) return;
    currentPage = page;
    loadData();
    resultDisplay.scrollIntoView({ behavior: 'smooth' });
  }

  window.handleFormSubmit = async (event) => {
    event.preventDefault();
    const clientId = modalClientId.value;
    const isEdit = clientId !== '';
    const entryData = {
      prenom: document.getElementById('modal-prenom').value || null,
      nom: document.getElementById('modal-nom').value,
      telephone: document.getElementById('modal-telephone').value || null,
      type: document.getElementById('modal-type').value || null,
      remarques: document.getElementById('modal-remarques').value || null,
    };
    modalSubmitButton.disabled = true;
    modalSubmitButton.textContent = 'Enregistrement...';
    try {
      let error;
      if (isEdit) {
        const { error: updateError } = await supabaseClient
          .from('pmr_clients')
          .update(entryData)
          .eq('id', clientId);
        error = updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('pmr_clients')
          .insert([entryData]);
        error = insertError;
      }
      if (error) throw error;
      notyf.success(isEdit ? "Client mis à jour !" : "Client ajouté !");
      window.hidePmrClientModal(); // Utiliser window.
      loadData();
    } catch (error) {
      notyf.error("Erreur: " + error.message);
    } finally {
      modalSubmitButton.disabled = false;
      modalSubmitButton.textContent = 'Enregistrer';
    }
  }

  window.deletePmrClient = async (id, nom) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le client "${nom}" ?`)) {
      return;
    }
    try {
      // (Vous n'aviez pas de logique de suppression, je l'ajoute)
      const { error } = await supabaseClient
        .from('pmr_clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      notyf.success("Client supprimé !");
      loadData();
    } catch (error) {
       notyf.error("Erreur: " + error.message);
    }
  }

  window.showPmrClientModal = (client = null) => {
    modalForm.reset();
    const isEdit = client !== null;
    modalTitle.textContent = isEdit ? `Modifier: ${client.prenom || ''} ${client.nom}` : 'Ajouter un client';
    modalClientId.value = isEdit ? client.id : '';
    document.getElementById('modal-prenom').value = isEdit ? client.prenom : '';
    document.getElementById('modal-nom').value = isEdit ? client.nom : '';
    document.getElementById('modal-telephone').value = isEdit ? client.telephone : '';
    document.getElementById('modal-type').value = isEdit ? client.type : '';
    document.getElementById('modal-remarques').value = isEdit ? client.remarques : '';
    modal.style.display = 'flex';
    lucide.createIcons();
  }
  
  window.hidePmrClientModal = () => {
    modal.style.display = 'none';
  }

  // --- Lancement ---
  loadData();

  viewToggleGrid.addEventListener('click', () => setView('grid'));
  viewToggleList.addEventListener('click', () => setView('list'));

}; // Fin de window.pageInit