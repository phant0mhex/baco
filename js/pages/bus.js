   // Déclarer les fonctions modales globalement pour les 'onclick'
    let showBusModal;
    let hideBusModal;
    let handleBusFormSubmit;
    let deleteBus;

    // La page attend que layout.js appelle window.pageInit()
    window.pageInit = function() {
    
      // On n'initialise PAS notyf, on l'utilise (il est global)
      if (typeof notyf === 'undefined') {
        console.error('Notyf n\'est pas chargé !');
      }

      // --- Références aux éléments du DOM ---
      const modal = document.getElementById('bus-modal');
      const modalTitle = document.getElementById('modal-title');
      const busForm = document.getElementById('bus-form');
      const busIdInput = document.getElementById('modal-bus-id');
      const contentContainer = document.getElementById('content');
      

      // Exposer les fonctions à 'onclick'
      window.updateSocieteDisplay = updateSocieteDisplay;
      window.updateChauffeursDisplay = updateChauffeursDisplay;
      

// --- NOUVELLE FONCTION D'EXPORT FILTRÉE ---
  window.exportBusData = async (format) => {
    const lignesSelectionnees = Array.from(document.querySelectorAll('#ligneCheckboxes input:checked'))
      .map(cb => cb.value);

    if (lignesSelectionnees.length === 0) {
      notyf.error("Sélectionnez au moins une ligne.");
      return;
    }

    notyf.success("Génération en cours...");

    try {
      // 1. Trouver les sociétés qui opèrent sur ces lignes
      const { data: lignesData, error: lErr } = await supabaseClient
        .from('lignes_bus')
        .select('societe_id')
        .in('ligne', lignesSelectionnees);
        
      if (lErr) throw lErr;
      
      const societeIds = [...new Set(lignesData.map(i => i.societe_id))];
      
      if (societeIds.length === 0) { 
          notyf.error("Aucune société trouvée."); 
          return; 
      }

      // 2. Récupérer les infos complètes
      const { data: societes, error: sErr } = await supabaseClient
        .from('societes_bus')
        .select(`
          nom, 
          lignes_bus(ligne), 
          contacts_bus(nom, tel), 
          chauffeurs_bus(nom, tel)
        `)
        .in('id', societeIds)
        .order('nom');
        
      if (sErr) throw sErr;

      // 3. Formatage avec FILTRAGE STRICT des lignes
      const exportData = [];

      societes.forEach(s => {
        // Récupérer toutes les lignes de cette société
        const toutesLesLignes = s.lignes_bus.map(l => l.ligne);
        
        // NE GARDER QUE celles qui sont cochées par l'utilisateur
        const lignesAffichees = toutesLesLignes.filter(l => lignesSelectionnees.includes(l));

        if (lignesAffichees.length > 0) {
            exportData.push({
                "Ligne": lignesAffichees.join(', '), // La ligne est ajoutée en "en-tête" (première colonne)
                "Société": s.nom,
                "Contacts": s.contacts_bus.map(c => `${c.nom} (${window.formatPhoneNumber(window.cleanPhoneNumber(c.tel))})`).join('\n'),
                "Chauffeurs": s.chauffeurs_bus.map(c => `${c.nom} (${window.formatPhoneNumber(window.cleanPhoneNumber(c.tel))})`).join('\n')
            });
        }
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Bus_Export_${dateStr}`;

      if (format === 'xlsx') {
        window.exportToXLSX(exportData, `${filename}.xlsx`);
      } else if (format === 'pdf') {
        // On passe les lignes sélectionnées dans le titre du PDF
        window.exportToPDF(exportData, `${filename}.pdf`, `Bus - Lignes : ${lignesSelectionnees.join(', ')}`);
      }

    } catch (error) {
      console.error(error);
      notyf.error("Erreur lors de l'export.");
    }
  };

      // --- FONCTION 1 : AFFICHER LES SOCIÉTÉS ---
      async function updateSocieteDisplay() {
        const lignesSelectionnees = Array.from(document.querySelectorAll('#ligneCheckboxes input:checked'))
          .map(cb => cb.value);

        contentContainer.innerHTML = ''; // Vider

        if (lignesSelectionnees.length === 0) {
          contentContainer.innerHTML = '<p class="text-gray-600">Veuillez sélectionner au moins une ligne.</p>';
          return;
        }

        try {
          // currentUserId est maintenant défini globalement par layout.js
         
          
        } catch (error) {
          contentContainer.innerHTML = `<p class='text-red-600'>Erreur (auth/favs): ${error.message}</p>`;
          return;
        }

        const { data: lignesData, error: lignesError } = await supabaseClient
          .from('lignes_bus')
          .select('societe_id')
          .in('ligne', lignesSelectionnees);

        if (lignesError) {
          contentContainer.innerHTML = `<p class='text-red-600'>Erreur Etape 1: ${lignesError.message}</p>`;
          return;
        }

        const societeIds = [...new Set(lignesData.map(item => item.societe_id))];

        if (societeIds.length === 0) {
          contentContainer.innerHTML = '<p class="text-gray-600">Aucune société trouvée pour les lignes sélectionnées.</p>';
          return;
        }

        const { data: societesAffichees, error: societesError } = await supabaseClient
          .from('societes_bus')
          .select('id, nom')
          .in('id', societeIds)
          .order('nom');
          
        if (societesError) {
          contentContainer.innerHTML = `<p class='text-red-600'>Erreur Etape 2: ${societesError.message}</p>`;
          return;
        }

        contentContainer.innerHTML = '<div>' +
            '<h3 class="text-2xl font-semibold text-gray-800 mb-4">Sociétés concernées :</h3>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8" id="societeCheckboxes">' +
              societesAffichees.map(s => {
                const societeJson = JSON.stringify(s).replace(/"/g, "&quot;");
                
                return `
                <div class="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm">
                  <label class="flex items-center space-x-2 cursor-pointer grow mr-2">
                    <input type="checkbox" value="${s.id}" onchange="updateChauffeursDisplay()" class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="font-medium text-gray-700">${s.nom}</span>
                  </label>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <div class="flex items-center gap-2 admin-only">
                      <button onclick='showBusModal(${societeJson})' class="p-1 text-blue-600 rounded-full hover:bg-blue-100" title="Modifier ${s.nom}">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                      </button>
                      <button onclick="deleteBus(${s.id}, '${s.nom}')" class="p-1 text-red-600 rounded-full hover:bg-red-100" title="Supprimer ${s.nom}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                </div>`;
              }).join('') +
            '</div>' +
            '<div id="contact" class="mt-6"></div>' +
            '<div id="chauffeurs" class="mt-6"></div>' +
          '</div>';
        
        lucide.createIcons();
        if (window.hideAdminElements) window.hideAdminElements(); // Ré-appliquer les droits
      }

      // --- FONCTION 2 : AFFICHER CONTACTS/CHAUFFEURS ---
      async function updateChauffeursDisplay() {
        const societesSelectionneesIds = Array.from(document.querySelectorAll('#societeCheckboxes input:checked'))
          .map(cb => cb.value);

        const chauffeursContainer = document.getElementById('chauffeurs');
        const contactsContainer = document.getElementById('contact');

        if (societesSelectionneesIds.length === 0) {
          chauffeursContainer.innerHTML = '';
          contactsContainer.innerHTML = '';
          return;
        }

        const { data: contactList, error: contactError } = await supabaseClient
          .from('contacts_bus')
          .select('id, nom, tel, societes_bus ( nom )')
          .in('societe_id', societesSelectionneesIds);

        const { data: chauffeursList, error: chauffeursError } = await supabaseClient
          .from('chauffeurs_bus')
          .select('id, nom, tel, societes_bus ( nom )')
          .in('societe_id', societesSelectionneesIds);
          
        if (contactError || chauffeursError) {
          contactsContainer.innerHTML = `<p class='text-red-600'>Erreur chargement contacts: ${contactError?.message || chauffeursError?.message}</p>`;
          return;
        }
        
        contactsContainer.innerHTML = contactList.length === 0 ? '' :
          '<h3 class="text-2xl font-semibold text-gray-800 mb-4">Contacts de la société :</h3>' +
          '<ul class="list-none p-0 grid grid-cols-1 md:grid-cols-2 gap-3">' +
          contactList.map(c => {
            const cleanedPhoneContact = window.cleanPhoneNumber(c.tel);
            const formattedPhoneContact = window.formatPhoneNumber(cleanedPhoneContact);
           
            
            return `<li class="bg-gray-50 rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <span class="flex items-center gap-2 text-sm font-medium text-gray-900">
                <i data-lucide="user-check" class="w-4 h-4 text-gray-500"></i>
                ${c.nom} <span class="font-normal text-gray-500">(${c.societes_bus.nom})</span>
              </span>
              <div class="flex items-center gap-2">
                <a href="etrali:0${cleanedPhoneContact}" class="flex items-center gap-2 text-sm font-mono text-blue-600 hover:text-blue-800">
                  <i data-lucide="phone" class="w-4 h-4"></i>
                  <span>${formattedPhoneContact}</span>
                </a>
               
              </div>
            </li>`
          }).join('') + '</ul>';

        chauffeursContainer.innerHTML = chauffeursList.length === 0 ? '' :
          '<h3 class="text-2xl font-semibold text-gray-800 mb-4 mt-8">Chauffeurs à contacter :</h3>' +
          '<ul class="list-none p-0 grid grid-cols-1 md:grid-cols-2 gap-3">' +
          chauffeursList.map(c => {
           
            // --- MODIFIÉ ICI ---
            const cleanedPhoneChauffeur = window.cleanPhoneNumber(c.tel);
            const formattedPhoneChauffeur = window.formatPhoneNumber(cleanedPhoneChauffeur);
            // --- FIN MODIFICATION ---


            return `<li class="bg-gray-50 rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <span class="flex items-center gap-2 text-sm font-medium text-gray-900">
                <i data-lucide="user" class="w-4 h-4 text-gray-500"></i>
                ${c.nom} <span class="font-normal text-gray-500">(${c.societes_bus.nom})</span>
              </span>
              <div class="flex items-center gap-2">
                <a href="etrali:0${cleanedPhoneChauffeur}" class="flex items-center gap-2 text-sm font-mono text-blue-600 hover:text-blue-800">
                  <i data-lucide="phone" class="w-4 h-4"></i>
                  <span>${formattedPhoneChauffeur}</span>
                </a>
              </div>
            </li>`
          }).join('') + '</ul>';
          
        lucide.createIcons();
      }

      // --- FONCTIONS DU MODAL ---
      showBusModal = async (societe = null) => {
        // ... (votre fonction showBusModal reste inchangée)
        const isEdit = societe !== null;
        busForm.reset();
        
        if (isEdit) {
          modalTitle.textContent = 'Modifier la société';
          busIdInput.value = societe.id;
          document.getElementById('modal-nom').value = societe.nom;

          const { data: details, error } = await supabaseClient
            .from('societes_bus')
            .select(`
              lignes_bus (ligne),
              contacts_bus (nom, tel),
              chauffeurs_bus (nom, tel)
            `)
            .eq('id', societe.id)
            .single();

          if (error) {
            notyf.error("Erreur chargement détails: " + error.message);
            return;
          }

          document.getElementById('modal-lignes').value = details.lignes_bus.map(l => l.ligne).join(', ');
          document.getElementById('modal-contacts').value = details.contacts_bus.map(c => `${c.nom}, ${c.tel}`).join('\n');
          document.getElementById('modal-chauffeurs').value = details.chauffeurs_bus.map(c => `${c.nom}, ${c.tel}`).join('\n');

        } else {
          modalTitle.textContent = 'Ajouter une société';
          busIdInput.value = '';
        }
        modal.style.display = 'flex';
        lucide.createIcons();
      }

      hideBusModal = () => {
        modal.style.display = 'none';
      }

      function parseContactList(text) {
        // ... (votre fonction parseContactList reste inchangée)
        return text.split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const parts = line.split(',');
            const nom = parts.shift()?.trim();
            const tel = parts.join(',').trim();
            return { nom, tel };
          });
      }

      handleBusFormSubmit = async (event) => {
        // ... (votre fonction handleBusFormSubmit reste inchangée)
        event.preventDefault();
        
        const busId = busIdInput.value ? parseInt(busIdInput.value, 10) : null;
        
        const societeData = {
          societe_id_to_update: busId,
          new_nom: document.getElementById('modal-nom').value,
          new_lignes: document.getElementById('modal-lignes').value.split(',').map(s => s.trim()).filter(Boolean),
          new_contacts: parseContactList(document.getElementById('modal-contacts').value),
          new_chauffeurs: parseContactList(document.getElementById('modal-chauffeurs').value)
        };

        const submitButton = document.getElementById('modal-submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Enregistrement...';

        const { error } = await supabaseClient.rpc('upsert_societe_bus', societeData);

        submitButton.disabled = false;
        submitButton.textContent = 'Enregistrer';

        if (error) {
          notyf.error("Erreur: " + error.message);
        } else {
          notyf.success(busId ? "Société mise à jour !" : "Société ajoutée !");
          hideBusModal();
          updateSocieteDisplay();
        }
      }

      deleteBus = async (id, nom) => {
        // ... (votre fonction deleteBus reste inchangée)
        if (!confirm(`Êtes-vous sûr de vouloir supprimer la société "${nom}" et TOUS ses chauffeurs, contacts et lignes ?`)) {
          return;
        }

        try {
          const { data: contacts, error: c_err } = await supabaseClient
            .from('contacts_bus').select('id').eq('societe_id', id);
          const { data: chauffeurs, error: ch_err } = await supabaseClient
            .from('chauffeurs_bus').select('id').eq('societe_id', id);

          if (c_err || ch_err) throw c_err || ch_err;

          const contactIds = contacts.map(c => c.id.toString());
          const chauffeurIds = chauffeurs.map(ch => ch.id.toString());
          const allIds = [...contactIds, ...chauffeurIds];
          
          if (allIds.length > 0) {
          
          }
          
        } catch (allIds) {
          

        }

        const { error } = await supabaseClient.rpc('delete_societe_bus', { societe_id_to_delete: id });
        
        if (error) {
          notyf.error("Erreur: " + error.message);
        } else {
          notyf.success("Société supprimée !");
          updateSocieteDisplay();
        }
      }

    }; // Fin de window.pageInit