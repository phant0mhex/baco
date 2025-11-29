
    // On attend que TOUT le HTML soit chargé (y compris le modal à la fin)
    document.addEventListener('DOMContentLoaded', async () => {

      // const notyf = (typeof Notyf !== 'undefined') 
      //   ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
      //   : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

      // --- Déclaration des variables ---
      const modal = document.getElementById('taxi-modal');
      const modalTitle = document.getElementById('modal-title');
      const taxiForm = document.getElementById('taxi-form');
      const taxiIdInput = document.getElementById('modal-taxi-id');
      const contentContainer = document.getElementById('content');
      const lieuCheckboxesContainer = document.getElementById('lieuCheckboxes');
      
      
    

      // On attache les événements aux fonctions globales
      window.updateTaxiDisplay = updateTaxiDisplay;
      window.showTaxiModal = showTaxiModal;
      window.hideTaxiModal = hideTaxiModal;
      window.handleTaxiFormSubmit = handleTaxiFormSubmit;
      window.deleteTaxi = deleteTaxi;
      
      
      async function populateLieuFilters() {
        lieuCheckboxesContainer.innerHTML = '<div class="flex justify-center items-center py-2"><i data-lucide="loader-2" class="w-6 h-6 text-blue-600 animate-spin"></i></div>';
        lucide.createIcons();
        
        const { data, error } = await supabaseClient
          .from('taxis')
          .select('lieux');

        if (error) {
          lieuCheckboxesContainer.innerHTML = `<p class="text-red-600">Erreur filtres: ${error.message}</p>`;
          return;
        }

        const allLieux = data.flatMap(taxi => taxi.lieux);
        
        const uniqueLieux = [...new Set(allLieux)]
          .filter(lieu => lieu !== 'nihil' && lieu)
          .sort();
        
        if (uniqueLieux.length === 0) {
           lieuCheckboxesContainer.innerHTML = '<p class="text-gray-600">Aucun lieu trouvé.</p>';
           return;
        }

        lieuCheckboxesContainer.innerHTML = uniqueLieux.map(lieu => `
          <label class="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-full cursor-pointer hover:bg-gray-100 transition-all shadow-sm">
            <input type="checkbox" value="${lieu}" onchange="updateTaxiDisplay()" class="rounded text-blue-600 focus:ring-blue-500">
            <span class="font-medium text-gray-700">${lieu}</span>
          </label>
        `).join('');
      }

      await populateLieuFilters();
      updateTaxiDisplay();


      async function updateTaxiDisplay() {
        const lieuxSelectionnes = Array.from(document.querySelectorAll('#lieuCheckboxes input:checked'))
          .map(cb => cb.value);

        if (lieuxSelectionnes.length === 0) {
          contentContainer.innerHTML = '<p class="text-gray-600">Veuillez sélectionner un lieu pour voir les taxis.</p>';
          return;
        }

        contentContainer.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
        lucide.createIcons();
        
        try {
          if (!currentUserId) {
            const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
            if (authError || !user) throw new Error("Utilisateur non connecté");
            currentUserId = user.id;
          }
          
          
        
         
          
        } catch (error) {
          contentContainer.innerHTML = `<p class='text-red-600'>Erreur (auth/favs): ${error.message}</p>`;
          return;
        }
        
        const { data: taxisAffiches, error } = await supabaseClient
          .from('taxis')
          .select('id, nom, lieux, contacts, mail, adresse, remarques')
          .overlaps('lieux', lieuxSelectionnes);

        if (error) {
          contentContainer.innerHTML = `<p class='text-red-600'>Erreur: ${error.message}</p>`;
          return;
        }
        
      if (taxisAffiches.length === 0) {
          contentContainer.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
              <i data-lucide="car" class="w-16 h-16 text-gray-300"></i>
              <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucun taxi trouvé</h3>
              <p class="mt-2 text-sm text-gray-500">Aucune société de taxi ne correspond aux lieux sélectionnés.</p>
            </div>
          `;
          lucide.createIcons();
          return;
        }

        contentContainer.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">' +
          taxisAffiches.map(taxi => {
            
            const taxiJson = JSON.stringify(taxi).replace(/"/g, "&quot;");

            const lieuxHtml = taxi.lieux.map(lieu =>
              `<span class="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">${lieu}</span>`
            ).join('');

          const contactsHtml = (taxi.contacts.length === 0 || taxi.contacts[0] === 'nihil') ? '' :
              taxi.contacts.map(num => {
                // --- MODIFIÉ ICI ---
                const cleanedPhoneTaxi = window.cleanPhoneNumber(num);
                const formattedPhoneTaxi = window.formatPhoneNumber(cleanedPhoneTaxi);
                // --- FIN MODIFICATION ---
                return `<a href="etrali:0${cleanedPhoneTaxi}" class="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                   <i data-lucide="phone" class="w-4 h-4 text-blue-700 flex-shrink-0"></i>
                   <span class="font-mono text-sm font-medium text-blue-800">${formattedPhoneTaxi}</span>
                 </a>`
              }).join('');

            const mailsHtml = (taxi.mail.length === 0 || taxi.mail[0] === 'nihil') ? '' :
              taxi.mail.map(email =>
                `<a href="mailto:${email}" class="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                   <i data-lucide="mail" class="w-4 h-4 text-gray-600 flex-shrink-0"></i>
                   <span class="text-sm font-medium text-gray-800 break-all">${email}</span>
                 </a>`
              ).join('');

            const adresseHtml = (taxi.adresse.length === 0 || taxi.adresse[0] === 'nihil') ? '' :
              taxi.adresse.map(adr =>
                `<div class="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                   <i data-lucide="map-pin" class="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5"></i>
                   <span class="text-sm font-medium text-gray-800">${adr}</span>
                 </div>`
              ).join('');
            
            const remarquesHtml = (taxi.remarques.length === 0 || taxi.remarques[0] === 'nihil') ? '' :
              '<div class="border-t pt-4 mt-4">' +
              taxi.remarques.map(rem =>
                `<div class="flex items-start gap-2.5 text-sm p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                   <i data-lucide="info" class="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5"></i>
                   <span class="text-yellow-900">${rem}</span>
                 </div>`
              ).join('') + '</div>';


              
            
            return `<div class="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                      <div class="p-5 flex-grow">
                        <h3 class="text-xl font-semibold text-gray-900 flex items-center gap-2.5">
                          <i data-lucide="taxi" class="w-5 h-5 text-blue-600"></i>
                          <span>${taxi.nom}</span>
                        </h3>
                        <div class="flex flex-wrap gap-2 border-t pt-4 mt-4">
                          ${lieuxHtml}
                        </div>
                        <div class="flex flex-col gap-3 mt-4">
                          ${contactsHtml}
                          ${mailsHtml}
                          ${adresseHtml}
                        </div>
                        ${remarquesHtml}
                      </div>
                      <div class="p-3 bg-gray-50 border-t flex justify-end gap-1">

                        <div class="admin-only flex gap-2">
                          <button onclick='showTaxiModal(${taxiJson})' class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200">
                            <i data-lucide="pencil" class="w-3 h-3"></i> Modifier
                          </button>
                          <button onclick="deleteTaxi(${taxi.id}, '${taxi.nom}')" class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200">
                            <i data-lucide="trash-2" class="w-3 h-3"></i> Supprimer
                          </button>
                        </div>
                      </div>
                    </div>`;
          }).join('') +
          '</div>';

        lucide.createIcons();
      }
      
      // --- NOUVELLE FONCTION D'EXPORT ---
      window.exportTaxiData = async (format) => {
        const lieuxSelectionnes = Array.from(document.querySelectorAll('#lieuCheckboxes input:checked'))
          .map(cb => cb.value);

        if (lieuxSelectionnes.length === 0) {
          notyf.error("Veuillez sélectionner au moins un lieu.");
          return;
        }

        notyf.success("Génération en cours...");

        try {
          // 1. Récupérer les taxis correspondant aux lieux sélectionnés
          const { data: taxis, error } = await supabaseClient
            .from('taxis')
            .select('nom, lieux, contacts, mail, adresse, remarques')
            .overlaps('lieux', lieuxSelectionnes) // Filtre SQL
            .order('nom');

          if (error) throw error;

          if (!taxis || taxis.length === 0) {
            notyf.error("Aucune donnée trouvée.");
            return;
          }

          // 2. Formatage des données
          const exportData = [];

          taxis.forEach(t => {
            // FILTRE VISUEL : On ne garde dans la colonne "Lieux" que ceux qui sont cochés
            const lieuxAffiches = (t.lieux || []).filter(l => lieuxSelectionnes.includes(l));

            // Si le taxi a des lieux correspondants (normalement oui grâce au .overlaps)
            if (lieuxAffiches.length > 0) {
                
                // Formatage des numéros de téléphone
                const formattedContacts = (t.contacts || [])
                    .filter(c => c !== 'nihil')
                    .map(c => window.formatPhoneNumber(window.cleanPhoneNumber(c)))
                    .join('\n'); // Saut de ligne pour Excel/PDF

                exportData.push({
                    "Lieux": lieuxAffiches.join(', '), // En-tête (colonne A)
                    "Société": t.nom,
                    "Téléphones": formattedContacts,
                    "Emails": (t.mail || []).filter(m => m !== 'nihil').join('\n'),
                    "Adresses": (t.adresse || []).filter(a => a !== 'nihil').join('\n'),
                    "Remarques": (t.remarques || []).filter(r => r !== 'nihil').join('\n')
                });
            }
          });

          const dateStr = new Date().toISOString().split('T')[0];
          const filename = `Taxis_Export_${dateStr}`;

          // 3. Export
          if (format === 'xlsx') {
            window.exportToXLSX(exportData, `${filename}.xlsx`);
          } else if (format === 'pdf') {
            window.exportToPDF(exportData, `${filename}.pdf`, `Taxis - Lieux : ${lieuxSelectionnes.join(', ')}`);
          }

        } catch (error) {
          console.error(error);
          notyf.error("Erreur lors de l'export.");
        }
      };
      
      // --- FONCTIONS D'ÉDITION ---
      function showTaxiModal(taxi = null) {
        const isEdit = taxi !== null;
        taxiForm.reset();
        
        const joinIfNotEmpty = (arr) => (arr && arr.length > 0 && arr[0] !== 'nihil') ? arr.join(', ') : '';
        
        if (isEdit) {
          modalTitle.textContent = 'Modifier le taxi';
          taxiIdInput.value = taxi.id;
          document.getElementById('modal-nom').value = taxi.nom;
          document.getElementById('modal-lieux').value = joinIfNotEmpty(taxi.lieux);
          document.getElementById('modal-contacts').value = joinIfNotEmpty(taxi.contacts);
          document.getElementById('modal-mail').value = joinIfNotEmpty(taxi.mail);
          document.getElementById('modal-adresse').value = joinIfNotEmpty(taxi.adresse);
          document.getElementById('modal-remarques').value = joinIfNotEmpty(taxi.remarques);
        } else {
          modalTitle.textContent = 'Ajouter un taxi';
          taxiIdInput.value = '';
        }
        modal.style.display = 'flex';
        lucide.createIcons();
      }

      function hideTaxiModal() {
        modal.style.display = 'none';
      }

      async function handleTaxiFormSubmit(event) {
        event.preventDefault();
        
        const taxiId = taxiIdInput.value;
        const isEdit = taxiId !== '';
        
        const splitAndClean = (str) => {
          const arr = str.split(',').map(s => s.trim()).filter(Boolean);
          return arr.length > 0 ? arr : ['nihil'];
        };

        const cleanNom = document.getElementById('modal-nom').value;
        const cleanLieux = splitAndClean(document.getElementById('modal-lieux').value);
        const cleanContacts = splitAndClean(document.getElementById('modal-contacts').value);
        const cleanMail = splitAndClean(document.getElementById('modal-mail').value);
        const cleanAdresse = splitAndClean(document.getElementById('modal-adresse').value);
        const cleanRemarques = splitAndClean(document.getElementById('modal-remarques').value);

        const taxiData = {
          nom: cleanNom,
          lieux: cleanLieux.length > 0 ? cleanLieux : ['nihil'],
          contacts: cleanContacts.length > 0 ? cleanContacts : ['nihil'],
          mail: cleanMail.length > 0 ? cleanMail : ['nihil'],
          adresse: cleanAdresse.length > 0 ? cleanAdresse : ['nihil'],
          remarques: cleanRemarques.length > 0 ? cleanRemarques : ['nihil']
        };

        let error;
        const submitButton = document.getElementById('modal-submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Enregistrement...';

        if (isEdit) {
          const { error: updateError } = await supabaseClient
            .from('taxis')
            .update(taxiData)
            .eq('id', taxiId);
          error = updateError;
        } else {
          const { error: insertError } = await supabaseClient
            .from('taxis')
            .insert([taxiData]);
          error = insertError;
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Enregistrer';

        if (error) {
          notyf.error("Erreur: " + error.message);
        } else {
          notyf.success(isEdit ? "Taxi mis à jour !" : "Taxi ajouté !");
          hideTaxiModal();
          await populateLieuFilters();
          updateTaxiDisplay();
        }
      }

      async function deleteTaxi(id, nom) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le taxi "${nom}" ?`)) {
          return;
        }
        
        
        
        
        const { error } = await supabaseClient
          .from('taxis')
          .delete()
          .eq('id', id);
          
        if (error) {
          notyf.error("Erreur: " + error.message);
        } else {
          notyf.success("Taxi supprimé !");
          await populateLieuFilters();
          updateTaxiDisplay();
        }
      }

    }); // Fin de l'écouteur DOMContentLoaded