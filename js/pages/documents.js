   window.pageInit = () => {
    
      const notyf = (typeof Notyf !== 'undefined') 
        ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
        : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

      const documentsContainer = document.getElementById('documents-list-container');
      const categoriesList = document.getElementById('categories-list');
      const fileUploadInput = document.getElementById('file-upload');
      const uploadStatus = document.getElementById('upload-status');
      const searchInput = document.getElementById('search-bar');
      
      let currentUserId = null;
      let selectedCategory = 'all'; // État du filtre
      
      // On expose les fonctions nécessaires au scope global pour les 'onclick'
      window.loadDocuments = loadDocuments;
      window.deleteDocument = deleteDocument;
      window.filterByCategory = filterByCategory;

      /**
       * Charge les catégories uniques depuis la nouvelle table
       */
      async function loadCategories() {
        categoriesList.innerHTML = '<p class="text-sm text-gray-500">Chargement...</p>';
        try {
          const { data, error } = await supabaseClient
            .from('document_metadata')
            .select('categorie');
            
          if (error) throw error;
          
          const categories = [...new Set(data.map(p => p.categorie))].sort();
          
          categoriesList.innerHTML = `
            <button onclick="filterByCategory('all', this)" class="w-full text-left px-3 py-2 rounded-md font-medium text-sm bg-blue-100 text-blue-700">
              Toutes les catégories
            </button>
            ${categories.map(cat => `
              <button onclick="filterByCategory('${cat}', this)" class="w-full text-left px-3 py-2 rounded-md font-medium text-sm text-gray-600 hover:bg-gray-200">
                ${cat}
              </button>
            `).join('')}
          `;
          
        } catch (error) {
          categoriesList.innerHTML = `<p class="text-sm text-red-600">Erreur chargement catégories</p>`;
        }
      }

      /**
       * Gère le clic sur un bouton de catégorie
       */
      function filterByCategory(category, element) {
        selectedCategory = category;
        // Met à jour l'UI des boutons
        document.querySelectorAll('#categories-list button').forEach(btn => {
          btn.classList.remove('bg-blue-100', 'text-blue-700');
          btn.classList.add('text-gray-600', 'hover:bg-gray-200');
        });
        element.classList.add('bg-blue-100', 'text-blue-700');
        element.classList.remove('text-gray-600', 'hover:bg-gray-200');
        
        loadDocuments(); // Recharger les documents
      }

      /**
       * Charge et affiche les documents en fonction des filtres
       */
      async function loadDocuments() {
        documentsContainer.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
        lucide.createIcons();

        try {
          let query = supabaseClient
            .from('document_metadata')
            .select('file_name, categorie')
            .order('file_name', { ascending: true });

          // 1. Appliquer le filtre de catégorie
          if (selectedCategory !== 'all') {
            query = query.eq('categorie', selectedCategory);
          }
          
          // 2. Appliquer le filtre de recherche
          const searchTerm = searchInput.value.trim();
          if (searchTerm) {
            query = query.ilike('file_name', `%${searchTerm}%`);
          }
          
          const { data, error } = await query;
          if (error) throw error;

          if (data.length === 0) {
            documentsContainer.innerHTML = `
              <div class="col-span-full flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
                <i data-lucide="file-x-2" class="w-16 h-16 text-gray-300"></i>
                <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucun document</h3>
                <p class="mt-2 text-sm text-gray-500">Aucun document ne correspond à vos filtres.</p>
              </div>`;
            lucide.createIcons();
            return;
          }

          // 3. Générer les URL publiques et afficher la liste
          const fileHtml = data.map(file => {
            const { data: urlData } = supabaseClient
              .storage
              .from('documents')
              .getPublicUrl(file.file_name);
            
            const publicURL = urlData ? urlData.publicUrl : '#';

            return `
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-between p-4 gap-3">
                <div class="flex items-center gap-3 overflow-hidden">
                  <i data-lucide="file-text" class="w-5 h-5 text-blue-600 flex-shrink-0"></i>
                  <span class="font-medium text-gray-800 truncate" title="${file.file_name}">
                    ${file.file_name}
                  </span>
                </div>
                
                <div class="flex items-center flex-shrink-0 gap-2">
                  <button 
                    onclick="deleteDocument('${file.file_name}')"
                    class="admin-only p-2 text-red-600 rounded-full hover:bg-red-100" 
                    title="Supprimer">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                  
                 <a 
                    href="${publicURL}" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="p-2 text-gray-700 rounded-full hover:bg-gray-100" 
                    title="Ouvrir dans un nouvel onglet">
                    <i data-lucide="download" class="w-4 h-4"></i>
                  </a>
                </div>
              </div>
            `;
          }).join('');
          
          documentsContainer.innerHTML = `<div class="space-y-4">${fileHtml}</div>`;

          lucide.createIcons();
          if (window.hideAdminElements) window.hideAdminElements();

        } catch (error) {
          documentsContainer.innerHTML = `<p class="col-span-full text-red-600">Erreur: ${error.message}</p>`;
          notyf.error('Erreur lors du chargement des documents.');
        }
      }

      /**
       * Gère le téléversement d'un nouveau document (MODIFIÉ)
       */
      async function handleUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 1. Demander la catégorie
        const categorie = prompt(`Veuillez entrer une catégorie pour le fichier "${file.name}" :`, "Procédures");
        if (!categorie) {
          notyf.error("Upload annulé : une catégorie est requise.");
          event.target.value = null; // Réinitialiser l'input
          return;
        }

        uploadStatus.textContent = `Téléversement de "${file.name}"...`;
        
        try {
          if (!currentUserId) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) currentUserId = user.id;
          }

          // 2. Upload vers Storage
          const { error: uploadError } = await supabaseClient
            .storage
            .from('documents')
            .upload(file.name, file, { upsert: true }); 
            
          if (uploadError) throw uploadError;

          // 3. Insert/Upsert dans la table des métadonnées
          const { error: metadataError } = await supabaseClient
            .from('document_metadata')
            .upsert({ 
              file_name: file.name, 
              categorie: categorie,
              uploaded_by: currentUserId 
            }, { 
              onConflict: 'file_name' // Si le fichier existe, met à jour sa catégorie
            });

          if (metadataError) throw metadataError;

          notyf.success(`"${file.name}" a été téléversé dans "${categorie}".`);
          uploadStatus.textContent = '';
          loadCategories(); // Recharger les catégories (au cas où c'est une nouvelle)
          loadDocuments(); // Rafraîchir la liste

        } catch (error) {
          notyf.error(`Échec du téléversement : ${error.message}`);
          uploadStatus.textContent = `Échec de l'upload.`;
        } finally {
          event.target.value = null;
        }
      }

      /**
       * Supprime un document (MODIFIÉ)
       */
      async function deleteDocument(fileName) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer "${fileName}" ?`)) {
          return;
        }
        
        try {
          // 1. Supprimer l'entrée dans les métadonnées
          const { error: metadataError } = await supabaseClient
            .from('document_metadata')
            .delete()
            .eq('file_name', fileName);
            
          if (metadataError) throw metadataError;
            
          // 2. Supprimer le fichier du Storage
          const { error: storageError } = await supabaseClient
            .storage
            .from('documents')
            .remove([fileName]);

          if (storageError) throw storageError;

          notyf.success(`"${fileName}" a été supprimé.`);
          loadCategories(); // Recharger les catégories (au cas où c'était la dernière)
          loadDocuments(); // Rafraîchir la liste

        } catch (error) {
          notyf.error(`Échec de la suppression : ${error.message}`);
        }
      }
      
      // --- Écouteurs ---
      fileUploadInput.addEventListener('change', handleUpload);
      
      // --- Lancement initial ---
      (async () => {
        await loadCategories();
        await loadDocuments();
      })();

    }; // Fin de DOMContentLoaded