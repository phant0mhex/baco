// js/pages/lignes.js

window.pageInit = () => {

  /**
   * Charge dynamiquement les filtres de ligne depuis toutes les tables.
   */
  async function loadLineFilters() {
    const container = document.getElementById('lineSelector');
    if (!container) return;
    
    container.innerHTML = '<p class="text-gray-500 text-sm">Chargement des filtres de ligne...</p>';

    try {
      // 1. Lancer les requêtes en parallèle pour trouver toutes les lignes
      const [pnLines, spiLines, garesLines] = await Promise.all([
        supabaseClient.from('pn_data').select('ligne_nom'),
        supabaseClient.from('spi_data').select('ligne_nom'),
        supabaseClient.from('ligne_data').select('ligne_nom')
      ]);

      if (pnLines.error) throw pnLines.error;
      if (spiLines.error) throw spiLines.error;
      if (garesLines.error) throw garesLines.error;

      // 2. Fusionner et dé-dupliquer les résultats
      const allLines = [
        ...pnLines.data.map(item => item.ligne_nom),
        ...spiLines.data.map(item => item.ligne_nom),
        ...garesLines.data.map(item => item.ligne_nom)
      ];

      const uniqueLines = [...new Set(allLines.filter(Boolean))];
      
      // 3. Trier les lignes (ex: L.75, L.75A, L.78, L.90...)
      uniqueLines.sort((a, b) => {
          // Extrait les nombres et gère les suffixes 'A', 'C'
          const numA = parseFloat(a.replace('L.', '').replace('A', '.1').replace('C', '.2'));
          const numB = parseFloat(b.replace('L.', '').replace('A', '.1').replace('C', '.2'));
          return numA - numB;
      });

      if (uniqueLines.length === 0) {
          container.innerHTML = '<p class="text-red-600 text-sm">Aucun filtre de ligne trouvé.</p>';
          return;
      }

      // 4. Générer le HTML
      container.innerHTML = uniqueLines.map(line => `
        <label class="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-full cursor-pointer hover:bg-gray-100 transition-all shadow-sm">
          <input type="checkbox" value="${line}" onchange="window.updateDisplay()" class="rounded text-blue-600 focus:ring-blue-500">
          <span class="font-medium text-gray-700">${line}</span>
        </label>
      `).join('');

    } catch (error) {
      console.error("Erreur chargement filtres de ligne:", error.message);
      container.innerHTML = `<p class="text-red-600 text-sm">Erreur: ${error.message}</p>`;
    }
  }

  // Fonction pour afficher/masquer les sous-catégories (attachée à window)
  window.updateSubCategories = function() {
    const selected = Array.from(document.querySelectorAll('#mainCategories input:checked')).map(cb => cb.value);
    const lineBox = document.getElementById('lineSelectorContainer');
    
    lineBox.style.display = selected.length > 0 ? 'block' : 'none';
    
    window.updateDisplay(); // Mettre à jour l'affichage
  }

  // Fonction principale d'affichage (attachée à window)
  window.updateDisplay = async function() {
    const selectedMain = Array.from(document.querySelectorAll('#mainCategories input:checked')).map(cb => cb.value);
    const selectedLines = Array.from(document.querySelectorAll('#lineSelector input:checked')).map(cb => cb.value);
    const selectedZones = Array.from(document.querySelectorAll('.spi-filter:checked')).map(cb => cb.value);
    const container = document.getElementById('resultDisplay');
    const zoneBox = document.getElementById('zoneFilterContainer');

    // Gérer l'affichage des filtres
    const zoneSelected = selectedMain.includes("Zone SPI");
    zoneBox.style.display = zoneSelected && selectedLines.length > 0 ? 'block' : 'none';

    // Gérer les états vides
    if (selectedLines.length === 0) {
        container.innerHTML = selectedMain.length > 0 
            ? '<p class="text-gray-600">Veuillez sélectionner au moins une ligne.</p>'
            : '<p class="text-gray-600">Veuillez sélectionner une catégorie et une ligne pour afficher les résultats.</p>';
        return;
    }

    container.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
  
    const results = {};
    selectedLines.forEach(line => {
      results[line] = { gares: [], pn: [], spi: [] };
    });

    const promises = [];

    if (selectedMain.includes("Lignes")) {
      promises.push(
        supabaseClient
          .from('ligne_data')
          .select('ligne_nom, gare')
          .in('ligne_nom', selectedLines)
          .order('ordre')
      );
    }
    if (selectedMain.includes("Adresse PN")) {
      promises.push(
        supabaseClient
          .from('pn_data')
          .select('*')
          .in('ligne_nom', selectedLines)
      );
    }
    if (selectedMain.includes("Zone SPI")) {
      let spiQuery = supabaseClient
        .from('spi_data')
        .select('*')
        .in('ligne_nom', selectedLines);
      
      if (selectedZones.length > 0) {
        spiQuery = spiQuery.in('zone', selectedZones);
      }
      promises.push(spiQuery);
    }

    const responses = await Promise.all(promises);

    for (const response of responses) {
      if (response.error) {
        container.innerHTML = `<p class='text-red-600'>Erreur: ${response.error.message}</p>`;
        return;
      }

      if (response.data && response.data.length > 0) {
        const firstItem = response.data[0];
        
        if (firstItem.hasOwnProperty('gare')) { // Données de Gares
          response.data.forEach(item => results[item.ligne_nom].gares.push(item));
        } else if (firstItem.hasOwnProperty('pn')) { // Données de PN
          response.data.forEach(item => results[item.ligne_nom].pn.push(item));
        } else if (firstItem.hasOwnProperty('lieu')) { // Données SPI
          response.data.forEach(item => results[item.ligne_nom].spi.push(item));
        }
      }
    }
    
    container.innerHTML = ''; // Vider le "Chargement..."

    selectedLines.forEach(line => {
      const data = results[line];
      let lineContent = '';

       // Section Gares
      if (selectedMain.includes("Lignes") && data.gares.length > 0) {
        lineContent += `<h3 class="text-xl font-semibold text-gray-700 mt-4 mb-3">Gares</h3><div class="flex flex-wrap gap-3">` +
          data.gares.map(e => 
            `<div class="bg-white p-3 rounded-lg border shadow-sm text-gray-800 font-medium">${e.gare}</div>`
          ).join('') +
          `</div>`;
      }

      // Section Adresse PN
      if (selectedMain.includes("Adresse PN") && data.pn.length > 0) {
        lineContent += `<h3 class="text-xl font-semibold text-gray-700 mt-4 mb-3">Adresse PN</h3><div class="flex flex-wrap gap-4">` +
          data.pn.map(e => 
            `<div class="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex-1 min-w-[250px] flex flex-col gap-2">
                <div class="flex justify-between items-center">
                    <span class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
                        <i data-lucide="train-track" class="w-4 h-4 text-gray-600"></i>
                        <span>${e.pn}</span>
                    </span>
                    <span class="flex items-center gap-1.5 text-sm font-semibold font-mono text-blue-500">
                        <i data-lucide="milestone" class="w-4 h-4"></i>
                        <span>${e.bk}</span>
                    </span>
                </div>
                <div class="flex items-start gap-2 text-sm text-gray-700 mt-1">
                    <i data-lucide="map-pin" class="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5"></i>
                    <span class="block">${e.adresse}</span>
                </div>
            </div>`
          ).join('') +
          `</div>`;
      }

      // Section Zone SPI
      if (selectedMain.includes("Zone SPI") && data.spi.length > 0) {
        lineContent += `<h3 class="text-xl font-semibold text-gray-700 mt-4 mb-3">Zone SPI</h3><div class="flex flex-wrap gap-4">` +
          data.spi.map(e => 
            `<div class="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex-1 min-w-[250px] flex flex-col gap-2">
                <div class="flex justify-between items-center">
                    <span class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
                        <i data-lucide="building-2" class="w-4 h-4 text-gray-600"></i>
                        <span>${e.lieu}</span>
                    </span>
                    <span class"flex items-center gap-1.5 text-sm font-semibold font-mono text-blue-500">
                        <i data-lucide="tag" class="w-4 h-4"></i>
                        <span>${e.zone}</span>
                    </span>
                </div>
                <div class="flex items-start gap-2 text-sm text-gray-700 mt-1">
                    <i data-lucide="map-pin" class="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5"></i>
                    <span class="block">${e.adresse}</span>
                </div>
                ${e.remarques ? 
                  `<div class="flex items-start gap-2 text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
                      <i data-lucide="info" class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"></i>
                      <span class="block italic">${e.remarques}</span>
                  </div>` 
                : ''}
                </div>`
          ).join('') +
          `</div>`;
      }
    
      if (lineContent) {
          container.innerHTML += `<div class="mb-8"><h2 class="text-3xl font-bold text-gray-900 border-b pb-2 mb-4">${line}</h2>${lineContent}</div>`;
      }
    });
    
    if (container.innerHTML === '') {
        container.innerHTML = '<p class="text-gray-600">Aucun résultat pour les filtres sélectionnés.</p>';
    }

    lucide.createIcons();
  }
  
  // --- Lancement initial ---
  loadLineFilters();

}; // Fin de window.pageInit