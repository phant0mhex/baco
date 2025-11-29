// js/pages/operationnel.js

window.pageInit = () => {

  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  // --- LES CONST ---
  const proceduresList = document.getElementById('procedures-list');
  const categoriesList = document.getElementById('categories-list');
  const searchInput = document.getElementById('search-bar');
  const modal = document.getElementById('procedure-modal');
  const modalPanel = document.getElementById('procedure-modal-panel');
  const modalTitle = document.getElementById('modal-title');
  const procedureForm = document.getElementById('procedure-form');
  const procedureIdInput = document.getElementById('modal-procedure-id');
  const submitButton = document.getElementById('modal-submit-button');
  const addLinkButton = document.getElementById('add-link-button');
  const modalLinksList = document.getElementById('modal-links-list');
  const proceduresChannel = supabaseClient.channel('baco-procedures');
  
  let selectedCategory = 'all';
  let easyMDE;
  let currentLinks = [];
  let currentProcedureId = null;

  // Initialisation de l'éditeur
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
  }

  // --- Fonctions Utilitaires ---
  const formatTraceabilityDate = (dateString) => {
    return window.formatDate(dateString, 'short');
  }

  // --- Fonctions de Données ---
  const loadCategories = async () => {
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
        proceduresList.innerHTML = `
          <div class="col-span-full flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
            <i data-lucide="file-x-2" class="w-16 h-16 text-gray-300"></i>
            <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucune procédure trouvée</h3>
            <p class="mt-2 text-sm text-gray-500">Aucun document ne correspond à vos filtres.</p>
          </div>`;
        lucide.createIcons();
        return;
      }

      proceduresList.innerHTML = data.map(entry => renderProcedureCard(entry)).join('');
      
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
  
  const renderProcedureCard = (entry) => {
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
            <button onclick="window.deleteProcedure(${entry.id}, '${entry.titre}')" class="p-2 text-red-600 rounded-full hover:bg-red-100" title="Supprimer">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
            <button onclick="window.showProcedureModal(${entryJson})" class="p-2 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier">
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

  // --- Fonctions de Liaison ---

  const loadLinkedContent = async (procedureId, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p class="text-xs text-gray-400 italic">Chargement des liens...</p>';
    try {
      const { data: links, error } = await supabaseClient.rpc('get_linked_content', {
        p_source_type: 'procedure',
        p_source_id: procedureId.toString()
      });
      if (error) throw error;
      if (containerId === 'modal-links-list') {
        currentLinks = links || [];
      }
      renderLinks(container, links || []);
    } catch (error) {
      container.innerHTML = `<p class="text-xs text-red-500">Erreur chargement liens.</p>`;
    }
  }
  
  const renderLinks = (container, links) => {
    if (!links || links.length === 0) {
      container.innerHTML = (container.id === 'modal-links-list')
        ? '<p id="modal-links-placeholder" class="text-sm text-gray-400 text-center p-2">Aucun lien.</p>'
        : '';
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
  
  addLinkButton.addEventListener('click', () => {
    window.showGlobalSearch((result) => {
      const alreadyExists = currentLinks.some(link => link.id === result.id && link.type === result.type);
      if (alreadyExists) {
        notyf.error("Ce lien existe déjà.");
        return;
      }
      currentLinks.push(result);
      renderLinks(modalLinksList, currentLinks);
    });
  });
  
  window.removeLinkFromModal = (index) => {
    currentLinks.splice(index, 1);
    renderLinks(modalLinksList, currentLinks);
  }

  // --- GESTION DE L'HISTORIQUE (VERSIONING) - CORRIGÉ ---
  
  const loadHistory = async (procedureId) => {

    console.log("Tentative de chargement historique pour ID:", procedureId);
    console.log("Rôle actuel:", sessionStorage.getItem('userRole'));

    const container = document.getElementById('history-container');
    if (!container) return;
    
    // Vérification Admin (seuls les admins voient l'historique)
    if (sessionStorage.getItem('userRole') !== 'admin') {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    container.innerHTML = '<p class="text-xs text-gray-400">Chargement de l\'historique...</p>';

    try {
      const { data, error } = await supabaseClient
        .from('procedure_versions')
        .select(`*, profiles:modified_by ( full_name )`)
        .eq('procedure_id', procedureId)
        .order('archived_at', { ascending: false });

      if (error) throw error;

      if (data.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 italic">Aucune version antérieure.</p>';
        return;
      }

      container.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-700 mb-2 mt-4">Historique des modifications</h4>
        <div class="space-y-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
          ${data.map(v => {
            const date = window.formatDate(v.archived_at, 'admin');
            const author = v.profiles?.full_name || 'Inconnu';
            // Échapper les caractères spéciaux pour l'appel JS
            const safeContent = v.contenu ? v.contenu.replace(/"/g, '&quot;').replace(/`/g, '\\`').replace(/\n/g, '\\n') : '';
            
            return `
              <div class="flex justify-between items-center text-xs p-2 bg-white border rounded shadow-sm">
                <div>
                  <span class="font-medium">${date}</span>
                  <span class="text-gray-500"> par ${author}</span>
                </div>
                <button type="button" 
                        onclick="window.restoreVersion('${safeContent}')"
                        class="text-blue-600 hover:text-blue-800 underline font-medium">
                  Restaurer
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (error) {
      console.error("Erreur historique:", error);
      container.innerHTML = '';
    }
  };

  window.restoreVersion = (content) => {
    if(!confirm("Attention : Le contenu actuel de l'éditeur sera remplacé. Continuer ?")) return;
    
    if (easyMDE) {
      easyMDE.value(content);
    } else {
      document.getElementById('modal-contenu').value = content;
    }
    notyf.success("Version restaurée (pensez à enregistrer).");
  };

  // --- Fonctions Modales ---
  
  window.showProcedureModal = async (entry = null) => {
    procedureForm.reset();
    const isEdit = entry !== null;
    modalTitle.textContent = isEdit ? `Modifier: ${entry.titre}` : 'Ajouter une procédure';
    procedureIdInput.value = isEdit ? entry.id : '';
    currentProcedureId = isEdit ? entry.id.toString() : null; 
    
    document.getElementById('modal-titre').value = isEdit ? entry.titre : '';
    document.getElementById('modal-categorie').value = isEdit ? entry.categorie : '';
    
    if (easyMDE) easyMDE.value(isEdit ? entry.contenu : '');
    else document.getElementById('modal-contenu').value = isEdit ? entry.contenu : '';

    // AJOUT : Gestion du conteneur d'historique dans le DOM
    let historyDiv = document.getElementById('history-container');
    
    if (!historyDiv) {
        historyDiv = document.createElement('div');
        historyDiv.id = 'history-container';
        historyDiv.className = 'mt-8 pt-4 border-t border-gray-100 hidden';
        
        // MODIFICATION : On cible le conteneur de scroll
        const scrollContainer = document.getElementById('modal-scroll-container');


        // Insertion avant le footer (boutons Annuler/Enregistrer)
        const modalPanel = document.getElementById('procedure-modal-panel');
        const footer = document.getElementById('modal-footer');
        
        if(scrollContainer) {
            scrollContainer.appendChild(historyDiv);
        } else {
             // Fallback au cas où l'ID n'est pas trouvé
             procedureForm.appendChild(historyDiv);
        }
    }

    if (isEdit) {
      await loadLinkedContent(entry.id, 'modal-links-list');
      loadHistory(entry.id); // Charger l'historique pour cet ID
    } else {
      currentLinks = [];
      renderLinks(modalLinksList, currentLinks);
      if (historyDiv) {
          historyDiv.innerHTML = '';
          historyDiv.style.display = 'none';
      }
    }

    modal.classList.remove('invisible', 'opacity-0');
    modalPanel.classList.remove('scale-95');
    lucide.createIcons();
  }

  window.hideProcedureModal = () => {
    modal.classList.add('opacity-0', 'invisible');
    modalPanel.classList.add('scale-95');
    currentProcedureId = null; 
    currentLinks = []; 
  }

  window.handleFormSubmit = async (event) => {
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
      if (isEdit) {
        const { error: updateError } = await supabaseClient.from('procedures').update(entryData).eq('id', procedureId);
        if (updateError) throw updateError;
      } else {
        const { data: newData, error: insertError } = await supabaseClient.from('procedures').insert([entryData]).select('id').single();
        if (insertError) throw insertError;
        savedProcedureId = newData.id.toString();
      }
      
      // Gestion des liens (inchangée)
      if (savedProcedureId) {
          const { error: deleteError } = await supabaseClient
              .from('liaisons_contenu')
              .delete()
              .eq('source_content_type', 'procedure')
              .eq('source_content_id', savedProcedureId);
          if (deleteError) throw deleteError;
      }
          
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
  
  window.deleteProcedure = async (id, titre) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la procédure "${titre}" ?`)) return;
    try {
      await supabaseClient.from('liaisons_contenu').delete().eq('source_content_id', id.toString());
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

  // --- Lancement et Abonnements ---
  if (window.marked) {
    try {
      const renderer = new window.marked.Renderer();
      renderer.link = (href, title, text) => `<a href="${href}" ${title ? `title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text || href}</a>`;
      window.marked.setOptions({ renderer: renderer });
    } catch (e) { console.error("Erreur configuration Marked.js:", e); }
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