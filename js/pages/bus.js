// js/pages/bus.js
import { ModalManager } from '../modules/utils.js';

window.pageInit = function() {
    
  if (typeof notyf === 'undefined') { console.error('Notyf n\'est pas chargé !'); }

  // --- 1. Initialisation du Manager de Modale ---
  const busModal = new ModalManager({
    modalId: 'bus-modal',
    formId: 'bus-form',
    titleId: 'modal-title',
    submitBtnId: 'modal-submit-button'
  });

  // --- 2. Références DOM (Variables globales à la page) ---
  const busIdInput = document.getElementById('modal-bus-id');
  const contentContainer = document.getElementById('content'); // <-- C'est cette ligne qui manquait !

  // --- 3. Exposer les fonctions au scope global (pour les onclick HTML) ---
  window.updateSocieteDisplay = updateSocieteDisplay;
  window.updateChauffeursDisplay = updateChauffeursDisplay;
  
  // ============================================================
  // ==  FONCTIONS DE LA MODALE (Utilisant ModalManager)  ==
  // ============================================================

  window.showBusModal = async (societe = null) => {
    const isEdit = societe !== null;
    
    busModal.open({
      title: isEdit ? 'Modifier la société' : 'Ajouter une société',
      onOpen: async () => {
        if (isEdit) {
          busIdInput.value = societe.id;
          document.getElementById('modal-nom').value = societe.nom;

          // Charger les détails supplémentaires si c'est une édition
          const { data: details, error } = await supabaseClient
            .from('societes_bus')
            .select(`lignes_bus (ligne), contacts_bus (nom, tel), chauffeurs_bus (nom, tel)`)
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
          busIdInput.value = ''; // Mode création
        }
      }
    });
  }

  window.hideBusModal = () => {
    busModal.close();
  }

  function parseContactList(text) {
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

  window.handleBusFormSubmit = async (event) => {
    event.preventDefault();
    
    const busId = busIdInput.value ? parseInt(busIdInput.value, 10) : null;
    
    const societeData = {
      societe_id_to_update: busId,
      new_nom: document.getElementById('modal-nom').value,
      new_lignes: document.getElementById('modal-lignes').value.split(',').map(s => s.trim()).filter(Boolean),
      new_contacts: parseContactList(document.getElementById('modal-contacts').value),
      new_chauffeurs: parseContactList(document.getElementById('modal-chauffeurs').value)
    };

    busModal.startLoading(); // Active le spinner

    try {
        const { error } = await supabaseClient.rpc('upsert_societe_bus', societeData);
        if (error) throw error;

        notyf.success(busId ? "Société mise à jour !" : "Société ajoutée !");
        busModal.close();
        updateSocieteDisplay();
    } catch (error) {
        notyf.error("Erreur: " + error.message);
    } finally {
        busModal.stopLoading(); // Désactive le spinner
    }
  }

  // ============================================================
  // ==  FONCTIONS D'AFFICHAGE ET D'EXPORT  ==
  // ============================================================

  async function updateSocieteDisplay() {
    const lignesSelectionnees = Array.from(document.querySelectorAll('#ligneCheckboxes input:checked'))
      .map(cb => cb.value);

    contentContainer.innerHTML = ''; 

    if (lignesSelectionnees.length === 0) {
      contentContainer.innerHTML = '<p class="text-gray-600">Veuillez sélectionner au moins une ligne.</p>';
      return;
    }

    const { data: lignesData, error: lignesError } = await supabaseClient
      .from('lignes_bus')
      .select('societe_id')
      .in('ligne', lignesSelectionnees);

    if (lignesError) {
      contentContainer.innerHTML = `<p class='text-red-600'>Erreur: ${lignesError.message}</p>`;
      return;
    }

    const societeIds = [...new Set(lignesData.map(item => item.societe_id))];

    if (societeIds.length === 0) {
      contentContainer.innerHTML = '<p class="text-gray-600">Aucune société trouvée.</p>';
      return;
    }

    const { data: societesAffichees, error: societesError } = await supabaseClient
      .from('societes_bus')
      .select('id, nom')
      .in('id', societeIds)
      .order('nom');
      
    if (societesError) {
      contentContainer.innerHTML = `<p class='text-red-600'>Erreur: ${societesError.message}</p>`;
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
              <div class="flex items-center gap-1 flex-shrink-0 admin-only">
                  <button onclick='window.showBusModal(${societeJson})' class="p-1 text-blue-600 rounded-full hover:bg-blue-100">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>
                  <button onclick="window.deleteBus(${s.id}, '${s.nom}')" class="p-1 text-red-600 rounded-full hover:bg-red-100">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
              </div>
            </div>`;
          }).join('') +
        '</div>' +
        '<div id="contact" class="mt-6"></div>' +
        '<div id="chauffeurs" class="mt-6"></div>' +
      '</div>';
    
    lucide.createIcons();
    if (window.hideAdminElements) window.hideAdminElements();
  }

  async function updateChauffeursDisplay() {
    const societesSelectionneesIds = Array.from(document.querySelectorAll('#societeCheckboxes input:checked')).map(cb => cb.value);
    const chauffeursContainer = document.getElementById('chauffeurs');
    const contactsContainer = document.getElementById('contact');

    if (societesSelectionneesIds.length === 0) {
      chauffeursContainer.innerHTML = '';
      contactsContainer.innerHTML = '';
      return;
    }

    const { data: contactList } = await supabaseClient.from('contacts_bus').select('id, nom, tel, societes_bus ( nom )').in('societe_id', societesSelectionneesIds);
    const { data: chauffeursList } = await supabaseClient.from('chauffeurs_bus').select('id, nom, tel, societes_bus ( nom )').in('societe_id', societesSelectionneesIds);
      
    contactsContainer.innerHTML = contactList.length === 0 ? '' :
      '<h3 class="text-2xl font-semibold text-gray-800 mb-4">Contacts :</h3>' +
      '<ul class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      contactList.map(c => `
        <li class="bg-gray-50 rounded-lg border border-gray-200 p-3 flex justify-between">
          <span class="font-medium text-gray-900">${c.nom} <span class="text-gray-500 text-xs">(${c.societes_bus.nom})</span></span>
          <a href="etrali:0${window.cleanPhoneNumber(c.tel)}" class="text-blue-600 hover:underline font-mono">${window.formatPhoneNumber(window.cleanPhoneNumber(c.tel))}</a>
        </li>`).join('') + '</ul>';

    chauffeursContainer.innerHTML = chauffeursList.length === 0 ? '' :
      '<h3 class="text-2xl font-semibold text-gray-800 mb-4 mt-8">Chauffeurs :</h3>' +
      '<ul class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      chauffeursList.map(c => `
        <li class="bg-gray-50 rounded-lg border border-gray-200 p-3 flex justify-between">
          <span class="font-medium text-gray-900">${c.nom} <span class="text-gray-500 text-xs">(${c.societes_bus.nom})</span></span>
          <a href="etrali:0${window.cleanPhoneNumber(c.tel)}" class="text-blue-600 hover:underline font-mono">${window.formatPhoneNumber(window.cleanPhoneNumber(c.tel))}</a>
        </li>`).join('') + '</ul>';
      
    lucide.createIcons();
  }

  window.exportBusData = async (format) => {
    const lignesSelectionnees = Array.from(document.querySelectorAll('#ligneCheckboxes input:checked')).map(cb => cb.value);

    if (lignesSelectionnees.length === 0) {
      notyf.error("Sélectionnez au moins une ligne.");
      return;
    }

    notyf.success("Génération en cours...");

    try {
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

      const exportData = [];

      societes.forEach(s => {
        const toutesLesLignes = s.lignes_bus.map(l => l.ligne);
        const lignesAffichees = toutesLesLignes.filter(l => lignesSelectionnees.includes(l));

        if (lignesAffichees.length > 0) {
            exportData.push({
                "Ligne": lignesAffichees.join(', '),
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
        window.exportToPDF(exportData, `${filename}.pdf`, `Bus - Lignes : ${lignesSelectionnees.join(', ')}`);
      }

    } catch (error) {
      console.error(error);
      notyf.error("Erreur lors de l'export.");
    }
  };

  window.deleteBus = async (id, nom) => {
    if (!confirm(`Supprimer la société "${nom}" et TOUT son contenu ?`)) return;
    const { error } = await supabaseClient.rpc('delete_societe_bus', { societe_id_to_delete: id });
    if (error) notyf.error("Erreur: " + error.message);
    else { notyf.success("Société supprimée !"); updateSocieteDisplay(); }
  }

};