// js/pages/taxi.js
import { ModalManager } from '../modules/utils.js';

// CORRECTION : Ajout de 'async' ici pour permettre l'utilisation de 'await' à la fin
window.pageInit = async function() {
    
  if (typeof notyf === 'undefined') { console.error('Notyf n\'est pas chargé !'); }

  // --- 1. Initialisation du Manager de Modale ---
  const taxiModal = new ModalManager({
    modalId: 'taxi-modal',
    formId: 'taxi-form',
    titleId: 'modal-title',
    submitBtnId: 'modal-submit-button'
  });

  // --- 2. Références DOM ---
  const taxiIdInput = document.getElementById('modal-taxi-id');
  const contentContainer = document.getElementById('content');
  const lieuCheckboxesContainer = document.getElementById('lieuCheckboxes');

  // --- 3. Exposer les fonctions globales ---
  window.updateTaxiDisplay = updateTaxiDisplay;
  
  // ============================================================
  // ==  NOUVELLE LOGIQUE MODALE (ModalManager)  ==
  // ============================================================

  window.showTaxiModal = (taxi = null) => {
    const isEdit = taxi !== null;
    
    taxiModal.open({
      title: isEdit ? 'Modifier le taxi' : 'Ajouter un taxi',
      onOpen: () => {
        const joinIfNotEmpty = (arr) => (arr && arr.length > 0 && arr[0] !== 'nihil') ? arr.join(', ') : '';
        
        if (isEdit) {
          taxiIdInput.value = taxi.id;
          document.getElementById('modal-nom').value = taxi.nom;
          document.getElementById('modal-lieux').value = joinIfNotEmpty(taxi.lieux);
          document.getElementById('modal-contacts').value = joinIfNotEmpty(taxi.contacts);
          document.getElementById('modal-mail').value = joinIfNotEmpty(taxi.mail);
          document.getElementById('modal-adresse').value = joinIfNotEmpty(taxi.adresse);
          document.getElementById('modal-remarques').value = joinIfNotEmpty(taxi.remarques);
        } else {
          taxiIdInput.value = ''; // Mode création
        }
      }
    });
  }

  window.hideTaxiModal = () => {
    taxiModal.close();
  }

  window.handleTaxiFormSubmit = async (event) => {
    event.preventDefault();
    
    const taxiId = taxiIdInput.value;
    const isEdit = taxiId !== '';
    
    const splitAndClean = (str) => {
      const arr = str.split(',').map(s => s.trim()).filter(Boolean);
      return arr.length > 0 ? arr : ['nihil'];
    };

    const taxiData = {
      nom: document.getElementById('modal-nom').value,
      lieux: splitAndClean(document.getElementById('modal-lieux').value),
      contacts: splitAndClean(document.getElementById('modal-contacts').value),
      mail: splitAndClean(document.getElementById('modal-mail').value),
      adresse: splitAndClean(document.getElementById('modal-adresse').value),
      remarques: splitAndClean(document.getElementById('modal-remarques').value)
    };

    taxiModal.startLoading(); // Spinner

    try {
      let error;
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

      if (error) throw error;

      notyf.success(isEdit ? "Taxi mis à jour !" : "Taxi ajouté !");
      taxiModal.close();
      await populateLieuFilters(); 
      updateTaxiDisplay();

    } catch (error) {
      notyf.error("Erreur: " + error.message);
    } finally {
      taxiModal.stopLoading();
    }
  }

  // ============================================================
  // ==  LOGIQUE METIER (Affichage, Filtres, Export)  ==
  // ============================================================

  async function populateLieuFilters() {
    lieuCheckboxesContainer.innerHTML = '<div class="flex justify-center items-center py-2"><i data-lucide="loader-2" class="w-6 h-6 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    
    const { data, error } = await supabaseClient.from('taxis').select('lieux');

    if (error) {
      lieuCheckboxesContainer.innerHTML = `<p class="text-red-600">Erreur filtres: ${error.message}</p>`;
      return;
    }

    const allLieux = data.flatMap(taxi => taxi.lieux);
    const uniqueLieux = [...new Set(allLieux)].filter(lieu => lieu !== 'nihil' && lieu).sort();
    
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

  async function updateTaxiDisplay() {
    const lieuxSelectionnes = Array.from(document.querySelectorAll('#lieuCheckboxes input:checked')).map(cb => cb.value);

    if (lieuxSelectionnes.length === 0) {
      contentContainer.innerHTML = '<p class="text-gray-600">Veuillez sélectionner un lieu pour voir les taxis.</p>';
      return;
    }

    contentContainer.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    
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
        </div>`;
      lucide.createIcons();
      return;
    }

    contentContainer.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">' +
      taxisAffiches.map(taxi => {
        const taxiJson = JSON.stringify(taxi).replace(/"/g, "&quot;");
        const lieuxHtml = taxi.lieux.map(lieu => `<span class="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">${lieu}</span>`).join('');

        const contactsHtml = (taxi.contacts.length === 0 || taxi.contacts[0] === 'nihil') ? '' :
          taxi.contacts.map(num => {
            const cleaned = window.cleanPhoneNumber(num);
            return `<a href="etrali:0${cleaned}" class="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
               <i data-lucide="phone" class="w-4 h-4 text-blue-700 flex-shrink-0"></i>
               <span class="font-mono text-sm font-medium text-blue-800">${window.formatPhoneNumber(cleaned)}</span>
             </a>`
          }).join('');

        const mailsHtml = (taxi.mail.length === 0 || taxi.mail[0] === 'nihil') ? '' :
          taxi.mail.map(email => `<a href="mailto:${email}" class="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"><i data-lucide="mail" class="w-4 h-4 text-gray-600 flex-shrink-0"></i><span class="text-sm font-medium text-gray-800 break-all">${email}</span></a>`).join('');

        const adresseHtml = (taxi.adresse.length === 0 || taxi.adresse[0] === 'nihil') ? '' :
          taxi.adresse.map(adr => `<div class="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"><i data-lucide="map-pin" class="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5"></i><span class="text-sm font-medium text-gray-800">${adr}</span></div>`).join('');
        
        const remarquesHtml = (taxi.remarques.length === 0 || taxi.remarques[0] === 'nihil') ? '' :
          '<div class="border-t pt-4 mt-4">' + taxi.remarques.map(rem => `<div class="flex items-start gap-2.5 text-sm p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><i data-lucide="info" class="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5"></i><span class="text-yellow-900">${rem}</span></div>`).join('') + '</div>';
        
        return `<div class="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <div class="p-5 flex-grow">
                    <h3 class="text-xl font-semibold text-gray-900 flex items-center gap-2.5">
                      <i data-lucide="taxi" class="w-5 h-5 text-blue-600"></i>
                      <span>${taxi.nom}</span>
                    </h3>
                    <div class="flex flex-wrap gap-2 border-t pt-4 mt-4">${lieuxHtml}</div>
                    <div class="flex flex-col gap-3 mt-4">${contactsHtml}${mailsHtml}${adresseHtml}</div>
                    ${remarquesHtml}
                  </div>
                  <div class="p-3 bg-gray-50 border-t flex justify-end gap-1">
                    <div class="admin-only flex gap-2">
                      <button onclick='window.showTaxiModal(${taxiJson})' class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200">
                        <i data-lucide="pencil" class="w-3 h-3"></i> Modifier
                      </button>
                      <button onclick="window.deleteTaxi(${taxi.id}, '${taxi.nom}')" class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> Supprimer
                      </button>
                    </div>
                  </div>
                </div>`;
      }).join('') + '</div>';

    lucide.createIcons();
    if (window.hideAdminElements) window.hideAdminElements();
  }

  window.deleteTaxi = async (id, nom) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le taxi "${nom}" ?`)) return;
    
    const { error } = await supabaseClient.from('taxis').delete().eq('id', id);
      
    if (error) notyf.error("Erreur: " + error.message);
    else {
      notyf.success("Taxi supprimé !");
      await populateLieuFilters();
      updateTaxiDisplay();
    }
  }

  window.exportTaxiData = async (format) => {
    const lieuxSelectionnes = Array.from(document.querySelectorAll('#lieuCheckboxes input:checked')).map(cb => cb.value);
    if (lieuxSelectionnes.length === 0) { notyf.error("Veuillez sélectionner au moins un lieu."); return; }
    notyf.success("Génération en cours...");

    try {
      const { data: taxis, error } = await supabaseClient
        .from('taxis')
        .select('nom, lieux, contacts, mail, adresse, remarques')
        .overlaps('lieux', lieuxSelectionnes).order('nom');

      if (error) throw error;
      if (!taxis || taxis.length === 0) { notyf.error("Aucune donnée trouvée."); return; }

      const exportData = [];
      taxis.forEach(t => {
        const lieuxAffiches = (t.lieux || []).filter(l => lieuxSelectionnes.includes(l));
        if (lieuxAffiches.length > 0) {
            const formattedContacts = (t.contacts || []).filter(c => c !== 'nihil').map(c => window.formatPhoneNumber(window.cleanPhoneNumber(c))).join('\n');
            exportData.push({
                "Lieux": lieuxAffiches.join(', '),
                "Société": t.nom,
                "Téléphones": formattedContacts,
                "Emails": (t.mail || []).filter(m => m !== 'nihil').join('\n'),
                "Adresses": (t.adresse || []).filter(a => a !== 'nihil').join('\n'),
                "Remarques": (t.remarques || []).filter(r => r !== 'nihil').join('\n')
            });
        }
      });

      const dateStr = new Date().toISOString().split('T')[0];
      if (format === 'xlsx') window.exportToXLSX(exportData, `Taxis_${dateStr}.xlsx`);
      else if (format === 'pdf') window.exportToPDF(exportData, `Taxis_${dateStr}.pdf`, `Taxis - Lieux : ${lieuxSelectionnes.join(', ')}`);

    } catch (error) { notyf.error("Erreur export."); }
  };

  // --- Lancement ---
  // On utilise 'await' ici car la fonction est maintenant marquée comme 'async'
  await populateLieuFilters();
  updateTaxiDisplay();

};