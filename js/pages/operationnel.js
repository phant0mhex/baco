// js/pages/operationnel.js

window.pageInit = () => {

  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const proceduresList = document.getElementById('procedures-list');
  const categoriesList = document.getElementById('categories-list');
  const searchInput = document.getElementById('search-bar');
  
  const modal = document.getElementById('procedure-modal');
  const modalPanel = document.getElementById('procedure-modal-panel');
  const modalTitle = document.getElementById('modal-title');
  const procedureForm = document.getElementById('procedure-form');
  const procedureIdInput = document.getElementById('modal-procedure-id');
  const submitButton = document.getElementById('modal-submit-button');
  
  // NOUVEAUX ÉLÉMENTS DU MODAL
  const addLinkButton = document.getElementById('add-link-button');
  const modalLinksList = document.getElementById('modal-links-list');

  const proceduresChannel = supabaseClient.channel('baco-procedures');

  let selectedCategory = 'all';
  let easyMDE;
  
  // NOUVELLES VARIABLES D'ÉTAT POUR LES LIENS
  let currentLinks = []; // Contient les liens existants + nouveaux
  let currentProcedureId = null; // ID de la procédure en cours d'édition

  try {
    easyMDE = new EasyMDE({
      element: document.getElementById('modal-contenu'),
      spellChecker: false,
      status: false,
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "|", "preview", "side-by-side", "fullscreen", "|", "guide"],
      minHeight: "150px"
    });
  } catch (e) {
    console.error("Erreur initialisation EasyMDE:", e);
    notyf.error("Erreur: L'éditeur de texte n'a pas pu charger.");
  }

  // --- Fonctions Utilitaires ---
  function formatTraceabilityDate(dateString) {
    return window.formatDate(dateString, 'short'); // Utilise la fonction globale
  }

  // --- Fonctions de Données ---
  async function loadCategories() {
    try {
      const { data, error } = await supabaseClient.from('procedures').select('categorie');
      if (error) throw error;
      const categories = [...new Set(data.map(p => p.categorie))].sort();
      categoriesList.innerHTML = `
        <button onclick="window.filterByCategory('all', this)" class="w-full text-left px-3 py-2 rounded-md font-medium text-sm bg-blue-100 text-blue-700">
          Toutes les catégories
        </button>
        ${categories.map(cat => `
          <button onclick="window.filterByCategory('${cat}', this)" class="w-full text-left px-3 py-2 rounded-md font-medium text-sm text-gray-600 hover:bg-gray-200">
            ${cat}
          </button>
        `).join('')}
      `;
    } catch (error) {
      categoriesList.innerHTML = `<p class="text-sm text-red-600">Erreur chargement catégories</p>`;
    }
  }

  window.filterByCategory = (category, element) => {
    selectedCategory = category;
    document.querySelectorAll('#categories-list button').forEach(btn => {
      btn.classList.remove('bg-blue-100', 'text-blue-700');
      btn.classList.add('text-gray-600', 'hover:bg-gray-200');
    });
    element.classList.add('bg-blue-100', 'text-blue-700');
    element.classList.remove('text-gray-600', 'hover:bg-gray-200');
    loadProcedures();
  }

  const loadProcedures = async () => {
    proceduresList.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    
    try {
      let query = supabaseClient.from('procedures')
        .select(`*, updated_at, profiles ( full_name )`)
        .order('titre', { ascending: true });

      if (selectedCategory !== 'all') {
        query = query.eq('categorie', selectedCategory);
      }
      
      const searchTerm = searchInput.value.trim();
      if (searchTerm) {
        query = query.or(`titre.ilike.*${searchTerm}*,contenu.ilike.*${searchTerm}*`);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      if (data.length === 0) {
        proceduresList.innerHTML = `... (votre HTML d'état vide) ...`;
        lucide.createIcons();
        return;
      }

      proceduresList.innerHTML = data.map(entry => renderProcedureCard(entry)).join('');
      
      // Charger les liens pour les cartes (phase de lecture)
      data.forEach(entry => {
        loadLinkedContent(entry.id, `links-for-${entry.id}`);
      });
      
      lucide.createIcons();
      if (window.hideAdminElements) window.hideAdminElements();

    } catch (error) {
      proceduresList.innerHTML = `<p class="col-span-full text-red-600 text-center">Erreur: ${error.message}</p>`;
      notyf.error('Erreur lors du chargement des procédures.');
    }
  }
  window.loadProcedures = loadProcedures;

  // --- Fonctions de Rendu ---
  
  function renderProcedureCard(entry) {
    const entryJson = JSON.stringify(entry).replace(/"/g, "&quot;");
    const contentHtml = window.marked.parse(entry.contenu || '');
    const searchTerm = searchInput.value.trim();
    const displayTitle = window.highlightText(entry.titre, searchTerm);
    const displayCategory = window.highlightText(entry.categorie, searchTerm);
    
    let traceabilityHtml = '';
    if (entry.updated_at && entry.profiles) {
      const date = formatTraceabilityDate(entry.updated_at);
      const name = entry.profiles.full_name || 'un utilisateur';
      traceabilityHtml = `
        <div class="p-4 border-t border-gray-100">
          <p class="text-xs text-gray-500 italic">
            Dernière modification par ${name} ${date}
          </p>
        </div>`;
    }
    
    return `
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <div>
            <h3 class="text-xl font-bold text-blue-700">${displayTitle}</h3>
            <span class="text-sm font-medium text-gray-500">${displayCategory}</span>
          </div>
          <div class="admin-only flex items-center flex-shrink-0 gap-2">
            <button onclick="deleteProcedure(${entry.id}, '${entry.titre}')" class="p-2 text-red-600 rounded-full hover:bg-red-100" title="Supprimer">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
            <button onclick="showProcedureModal(${entryJson})" class="p-2 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <div class="p-4 prose prose-sm max-w-none">${contentHtml}</div>
        
        <div id="links-for-${entry.id}" class="p-4 border-t border-gray-100 space-y-2"></div>
        
        ${traceabilityHtml}
      </div>
    `;
  }

  // --- NOUVELLES FONCTIONS DE LIAISON ---

  /**
   * Charge les liens (pour une carte ou pour le modal)
   */
  async function loadLinkedContent(procedureId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p class="text-xs text-gray-400 italic">Chargement des liens...</p>';
    
    try {
      const { data: links, error } = await supabaseClient.rpc('get_linked_content', {
        p_source_type: 'procedure',
        p_source_id: procedureId.toString()
      });

      if (error) throw error;
      
      // Si c'est le modal, on stocke les liens pour l'édition
      if (containerId === 'modal-links-list') {
        currentLinks = links || [];
      }
      
      renderLinks(container, links || []);

    } catch (error) {
      container.innerHTML = `<p class="text-xs text-red-500">Erreur chargement liens.</p>`;
    }
  }
  
  /**
   * Affiche les liens dans un conteneur (carte ou modal)
   */
  function renderLinks(container, links) {
    if (!links || links.length === 0) {
      if (container.id === 'modal-links-list') {
        container.innerHTML = '<p id="modal-links-placeholder" class="text-sm text-gray-400 text-center p-2">Aucun lien.</p>';
      } else {
        container.innerHTML = ''; // Ne rien afficher sur la carte
      }
      return;
    }
    
    const isModal = (container.id === 'modal-links-list');
    
    container.innerHTML = `
      ${isModal ? '' : '<h4 class="text-sm font-semibold text-gray-700 mb-2">Contenus Liés :</h4>'}
      <div class="flex flex-wrap gap-2">
        ${links.map((link, index) => `
          <div class="flex items-center gap-2 text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full"
             title="${link.snippet}">
            <i data-lucide="${link.icon}" class="w-3 h-3"></i>
            <span>${link.title}</span>
            ${isModal ? `
            <button type="button" onclick="window.removeLinkFromModal(${index})" class="p-0.5 rounded-full text-red-500 hover:bg-red-100">
               <i data-lucide="x" class="w-3 h-3"></i>
            </button>
            ` : `
            <a href="${link.url}" ${link.type === 'document' ? 'target="_blank" rel="noopener noreferrer"' : ''} class="p-0.5 rounded-full text-gray-500 hover:bg-gray-200" title="Voir le détail">
               <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
            </a>
            `}
          </div>
        `).join('')}
      </div>
    `;
    lucide.createIcons();
  }
  
  /**
   * Gère le clic sur "Ajouter un lien" dans le modal
   */
  addLinkButton.addEventListener('click', () => {
    // Ouvre la recherche globale avec notre fonction de callback
    window.showGlobalSearch((result) => {
      // 'result' est l'objet {id, type, title, ...}
      
      // Vérifier les doublons
      const alreadyExists = currentLinks.some(link => link.id === result.id && link.type === result.type);
      if (alreadyExists) {
        notyf.error("Ce lien existe déjà.");
        return;
      }
      
      // Ajouter à la liste temporaire
      currentLinks.push(result);
      
      // Rafraîchir l'affichage des liens dans le modal
      renderLinks(modalLinksList, currentLinks);
    });
  });
  
  /**
   * Supprime un lien de la liste temporaire du modal
   */
  window.removeLinkFromModal = (index) => {
    currentLinks.splice(index, 1); // Supprimer l'élément
    renderLinks(modalLinksList, currentLinks); // Rafraîchir
  }

  // --- Fonctions Modales (MODIFIÉES) ---
  
  showProcedureModal = async (entry = null) => {
    procedureForm.reset();
    const isEdit = entry !== null;
    
    modalTitle.textContent = isEdit ? `Modifier: ${entry.titre}` : 'Ajouter une procédure';
    procedureIdInput.value = isEdit ? entry.id : '';
    
    currentProcedureId = isEdit ? entry.id.toString() : null; 
    
    document.getElementById('modal-titre').value = isEdit ? entry.titre : '';
    document.getElementById('modal-categorie').value = isEdit ? entry.categorie : '';
    
    if (easyMDE) easyMDE.value(isEdit ? entry.contenu : '');
    
    // Charger les liens existants
    if (isEdit) {
      await loadLinkedContent(entry.id, 'modal-links-list');
    } else {
      currentLinks = []; // Vider la liste pour une nouvelle procédure
      renderLinks(modalLinksList, currentLinks);
    }
    
    modal.classList.remove('invisible', 'opacity-0');
    modalPanel.classList.remove('scale-95');
    
    lucide.createIcons();
  }
  window.showProcedureModal = showProcedureModal;

  hideProcedureModal = () => {
    modal.classList.add('opacity-0', 'invisible');
    modalPanel.classList.add('scale-95');
    currentProcedureId = null; 
    currentLinks = []; 
  }
  window.hideProcedureModal = hideProcedureModal;

  /**
   * Gère la soumission (MODIFIÉE pour les liens)
   */
  handleFormSubmit = async (event) => {
    event.preventDefault();
    
    const procedureId = procedureIdInput.value;
    const isEdit = procedureId !== '';
    
    const entryData = {
      titre: document.getElementById('modal-titre').value,
      categorie: document.getElementById('modal-categorie').value,
      contenu: easyMDE ? easyMDE.value() : document.getElementById('modal-contenu').value,
    };
    
    submitButton.disabled = true;
    submitButton.textContent = 'Enregistrement...';

    try {
      let savedProcedureId = procedureId;
      
      // 1. Sauvegarder la procédure
      if (isEdit) {
        const { error: updateError } = await supabaseClient.from('procedures').update(entryData).eq('id', procedureId);
        if (updateError) throw updateError;
      } else {
        // Obtenir le nouvel ID
        const { data: newData, error: insertError } = await supabaseClient.from('procedures').insert([entryData]).select('id').single();
        if (insertError) throw insertError;
        savedProcedureId = newData.id.toString();
      }
      
      // 2. Sauvegarder les liens (Logique de synchronisation)
      
      // D'abord, supprimer tous les anciens liens
      if (savedProcedureId) {
          const { error: deleteError } = await supabaseClient
              .from('liaisons_contenu')
              .delete()
              .eq('source_content_type', 'procedure')
              .eq('source_content_id', savedProcedureId);
          if (deleteError) throw deleteError;
      }
          
      // Ensuite, insérer les nouveaux liens
      if (currentLinks.length > 0) {
          const linksToInsert = currentLinks.map(link => ({
              source_content_type: 'procedure',
              source_content_id: savedProcedureId,
              target_content_type: link.type,
              target_content_id: link.id,
              created_by: window.currentUserId
          }));
          
          const { error: linksError } = await supabaseClient
              .from('liaisons_contenu')
              .insert(linksToInsert);
          if (linksError) throw linksError;
      }

      notyf.success(isEdit ? "Procédure mise à jour !" : "Procédure ajoutée !");
      hideProcedureModal();
      
      proceduresChannel.send({ type: 'broadcast', event: 'data-change' });
      
      loadCategories();
      loadProcedures();

    } catch (error) {
      notyf.error("Erreur: " + error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Enregistrer';
    }
  }
  window.handleFormSubmit = handleFormSubmit;
  
  deleteProcedure = async (id, titre) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la procédure "${titre}" ?`)) return;
    try {
      // 1. Supprimer les liens (la DB le fait en cascade, mais c'est plus propre)
      await supabaseClient.from('liaisons_contenu').delete().eq('source_content_id', id.toString());
      
      // 2. Supprimer la procédure
      const { error } = await supabaseClient.from('procedures').delete().eq('id', id);
      if (error) throw error;
      
      notyf.success("Procédure supprimée !");
      proceduresChannel.send({ type: 'broadcast', event: 'data-change' });
      loadCategories();
      loadProcedures();
      
    } catch (error) {
      notyf.error("Erreur: " + error.message);
    }
  }
  window.deleteProcedure = deleteProcedure;

  // --- Lancement et Abonnements ---
  
  // Configurer Marked.js
  if (window.marked) {
    try {
      const renderer = new window.marked.Renderer();
      renderer.link = (href, title, text) => `<a href="${href}" ${title ? `title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text || href}</a>`;
      window.marked.setOptions({ renderer: renderer });
    } catch (e) {
      console.error("Erreur configuration Marked.js:", e);
    }
  }

  loadCategories();
  loadProcedures();

  proceduresChannel
    .on('broadcast', { event: 'data-change' }, (payload) => {
      console.log('Changement détecté sur les procédures, rechargement...');
      notyf.success('Base de connaissances mise à jour...');
      loadCategories();
      loadProcedures();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Connecté au canal temps réel des procédures.');
      }
    });

}; // Fin de window.pageInit