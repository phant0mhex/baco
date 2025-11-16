  // Fonctions globales
    let showPmrClientModal;
    let hidePmrClientModal;
    let handleFormSubmit;
    let deletePmrClient;
    let debouncePmrSearch;
    let changePage; // Rendre global
    
    let searchTimer;
   
    
    // --- NOUVELLES VARIABLES D'ÉTAT POUR LA PAGINATION ---
    let currentPage = 1;
    const rowsPerPage = 12; // 12 cartes par page (s'aligne bien sur la grille de 3)
    // ----------------------------------------------------

   window.pageInit = () => {
    
      // const notyf = (typeof Notyf !== 'undefined') 
      //   ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
      //   : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

      const resultDisplay = document.getElementById('result-display');
      const statusMsg = document.getElementById('status-message');
      const searchBar = document.getElementById('search-bar');
      const paginationContainer = document.getElementById('pagination-container');
      
      const modal = document.getElementById('client-modal');
      const modalForm = document.getElementById('client-form');
      const modalTitle = document.getElementById('modal-title');
      const modalClientId = document.getElementById('modal-client-id');
      const modalSubmitButton = document.getElementById('modal-submit-button');
      
      // NOUVELLES VARIABLES
  const viewToggleGrid = document.getElementById('view-toggle-grid');
  const viewToggleList = document.getElementById('view-toggle-list');
  const resultGrid = document.getElementById('result-grid');
  const resultTableContainer = document.getElementById('result-table-container');
  const resultTableBody = document.getElementById('result-table-body');

  const viewPreferenceKey = 'baco-client-view'; // Clé localStorage
  let currentView = localStorage.getItem(viewPreferenceKey) || 'grid'; // 'grid' ou 'list'

    
      
      /**
       * Formate la date de traçabilité
       */
      function formatTraceabilityDate(dateString) {
        // ... (votre fonction formatTraceabilityDate existante, inchangée)
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }).replace('.', '');
      }
      
      /**
       * Attend 300ms après la dernière frappe avant de lancer la recherche
       */
      debouncePmrSearch = () => {
        clearTimeout(searchTimer);
        currentPage = 1; // --- MODIFIÉ: Réinitialiser à la page 1
        searchTimer = setTimeout(() => {
          loadData();
        }, 300);
      }
      

/**
 * Génère le HTML pour une ligne de tableau client (NOUVELLE FONCTION)
 */
function renderClientRow(client, searchTerm) {
  const clientJson = JSON.stringify(client).replace(/"/g, "&quot;");

  const displayName = window.highlightText(`${client.prenom || ''} ${client.nom}`, searchTerm);
  const displayType = window.highlightText(client.type, searchTerm);

const rawPhone = client.telephone;
  const cleanedPhone = window.cleanPhoneNumber(rawPhone);
  const formattedPhone = client.telephone ? window.formatPhoneNumber(cleanedPhone) : null;
  const displayTel = window.highlightText(formattedPhone, searchTerm);


  // Classes pour le type
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
        <button onclick="showPmrClientModal(${clientJson})" class="p-1 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button onclick="deletePmrClient(${client.id}, '${client.prenom} ${client.nom}')" class="admin-only p-1 text-red-600 rounded-full hover:bg-red-100" title="Supprimer">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `;
}


/**
 * Met à jour l'UI (boutons, conteneurs) pour correspondre à currentView (NOUVELLE FONCTION)
 */
function updateViewToggleUI() {
  if (currentView === 'list') {
    // Vue Liste active
    viewToggleList.classList.add('bg-gray-100', 'text-blue-600');
    viewToggleGrid.classList.remove('bg-gray-100', 'text-blue-600');
    resultGrid.classList.add('hidden');
    resultTableContainer.classList.remove('hidden');
  } else {
    // Vue Grille active (par défaut)
    viewToggleGrid.classList.add('bg-gray-100', 'text-blue-600');
    viewToggleList.classList.remove('bg-gray-100', 'text-blue-600');
    resultTableContainer.classList.add('hidden');
    resultGrid.classList.remove('hidden');
  }
}

/**
 * Change la vue, sauvegarde la préférence et recharge les données (NOUVELLE FONCTION)
 */
function setView(view) {
  if (view === currentView) return;
  currentView = view;
  localStorage.setItem(viewPreferenceKey, currentView);
  // Re-lance loadData pour appliquer la nouvelle vue et le rendu
  loadData(); 
}




      /**
       * Charge les données depuis Supabase (MODIFIÉ POUR PAGINATION)
       */
      async function loadData() {
        resultGrid.innerHTML = '';
  resultTableBody.innerHTML = '';

  statusMsg.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
  paginationContainer.innerHTML = ''; // Vider la pagination
  lucide.createIcons();

// NOUVEAU: Appliquer la vue correcte avant de charger
  updateViewToggleUI();

        try {
          // MODIFICATION : Le 'if (!currentUserId)' est supprimé.
          // currentUserId est GARANTI d'exister ici.
          
          
          
         
          
        } catch (error) {
          statusMsg.innerHTML = `<p class="text-red-600 text-center">Erreur (auth/favs): ${error.message}</p>`;
          return;
        }
        
        const searchTerm = searchBar.value.trim();
        const from = (currentPage - 1) * rowsPerPage;
        const to = from + rowsPerPage - 1;

        try {
          // 1. Construire le filtre de recherche
          const searchFilter = `nom.ilike.*${searchTerm}*,prenom.ilike.*${searchTerm}*,telephone.ilike.*${searchTerm}*,type.ilike.*${searchTerm}*`;

          // 2. Requête de COMPTAGE
          let countQuery = supabaseClient
            .from('pmr_clients')
            .select('*', { count: 'exact', head: true });

          if (searchTerm) {
            countQuery = countQuery.or(searchFilter);
          }
          
          const { count, error: countError } = await countQuery;
          if (countError) throw countError;
          
          const totalPages = Math.ceil(count / rowsPerPage);

          // 3. Requête de DONNÉES (paginée)
          let dataQuery = supabaseClient
            .from('pmr_clients')
            .select(`
              *,
              updated_at,
              profiles ( full_name )
            `)
            .order('nom', { ascending: true })
            .range(from, to); // <-- La pagination est appliquée ici

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

         // 4. Rendu des données (MODIFIÉ POUR ÊTRE CONDITIONNEL)
  if (currentView === 'list') {
    resultTableBody.innerHTML = data.map(client => renderClientRow(client, searchTerm)).join('');
  } else {
    resultGrid.innerHTML = data.map(client => renderClientCard(client, searchTerm)).join('');
  }
          // 5. Rendu de la pagination
          renderPagination(totalPages, count, from, to);
          
          lucide.createIcons();
          if (window.hideAdminElements) window.hideAdminElements();
          
        } catch (error) {
          statusMsg.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
          notyf.error('Erreur lors du chargement des clients.');
        }
      }
      
      /**
       * Génère le HTML pour une carte client
       */
      function renderClientCard(client, searchTerm) {
        // ... (votre fonction renderClientCard existante, inchangée)
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

        const rawPhoneCard = client.telephone;
  const cleanedPhoneCard = window.cleanPhoneNumber(rawPhoneCard);
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
                <button onclick="showPmrClientModal(${clientJson})" class="p-2 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button onclick="deletePmrClient(${client.id}, '${client.prenom} ${client.nom}')" class="admin-only p-2 text-red-600 rounded-full hover:bg-red-100" title="Supprimer">
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
      
      /**
       * Gère la soumission du formulaire (Ajout/Modification)
       */
      handleFormSubmit = async (event) => {
        // ... (votre fonction handleFormSubmit existante, inchangée)
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
          hidePmrClientModal();
          loadData();
        } catch (error) {
          notyf.error("Erreur: " + error.message);
        } finally {
          modalSubmitButton.disabled = false;
          modalSubmitButton.textContent = 'Enregistrer';
        }
      }
      
      /**
       * Supprime un client
       */
      deletePmrClient = async (id, nom) => {
        // ... (votre fonction deletePmrClient existante, inchangée)
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le client "${nom}" ?`)) {
          return;
        }
        try {
         
        } catch (error) {
           notyf.error("Erreur: " + error.message);
        }
      }
      
      /**
       * Fonctions du Modal
       */
      showPmrClientModal = (client = null) => {
        // ... (votre fonction showPmrClientModal existante, inchangée)
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
      
      hidePmrClientModal = () => {
        // ... (votre fonction hidePmrClientModal existante, inchangée)
        modal.style.display = 'none';
      }

      // --- NOUVELLES FONCTIONS DE PAGINATION (copiées de changelog.html) ---

      /**
       * Change la page actuelle et recharge les données
       */
      changePage = (page) => { // Assignée à la variable globale
        if (page === currentPage) return;
        currentPage = page;
        loadData();
        // Fait remonter l'utilisateur en haut du feed
        resultDisplay.scrollIntoView({ behavior: 'smooth' });
      }
      
      /**
       * Construit les contrôles de pagination
       */
      function renderPagination(totalPages, totalRows, from, to) {
        const container = document.getElementById('pagination-container');
        
        if (totalPages <= 1) {
          container.innerHTML = ''; // Pas de pagination
          return;
        }
        
        const toRow = Math.min(to + 1, totalRows);
        
        // Info "Résultats X à Y sur Z"
        const infoHtml = `
          <p class="text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm px-3 py-1.5">
            Clients <span class="font-bold text-gray-900">${from + 1}</span> à <span class="font-bold text-gray-900">${toRow}</span> sur
            <span class="font-bold text-gray-900">${totalRows}</span>
          </p>
        `;
        
        // Boutons "Précédent" et "Suivant"
        const prevDisabled = currentPage === 1;
        const nextDisabled = currentPage === totalPages;
        
        const buttonsHtml = `
          <div class="flex gap-2">
            <button 
              onclick="changePage(${currentPage - 1})" 
              ${prevDisabled ? 'disabled' : ''}
              class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm 
                     hover:bg-gray-50 
                     disabled:opacity-50 disabled:cursor-not-allowed">
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
              <span>Précédent</span>
            </button>
            
            <button 
              onclick="changePage(${currentPage + 1})" 
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
      // --- FIN DES NOUVELLES FONCTIONS ---

      // --- Lancement ---
      loadData();

      // NOUVEAU: Écouteurs pour le sélecteur de vue
viewToggleGrid.addEventListener('click', () => setView('grid'));
viewToggleList.addEventListener('click', () => setView('list'));

    }; // Fin de DOMContentLoaded