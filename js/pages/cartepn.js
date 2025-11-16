window.pageInit = () => {
    
      // Appel initial pour les icônes de la page (loupe, etc.)
      lucide.createIcons();

      const notyf = (typeof Notyf !== 'undefined') 
        ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
        : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

      const filterContainer = document.getElementById('filter-container');
      const pnListContainer = document.getElementById('pn-list');
      const searchBar = document.getElementById('search-bar');
      
      let allPnData = [];
      let map;
      let markersLayer; 
      let zoneBoundariesLayer; 
      
      const zonePolygons = {
        'FTY': {
          coordinates: [
            [50.7610, 3.2240],  // L75 (Nord-Ouest)
            [50.7166, 3.2403],  // L75A (Ouest)
            [50.4569, 3.7785],  // L78 (Sud)
            [50.7460, 3.8508],  // L90 (Est)
            [50.7211, 4.1717]   // L94 (Nord-Est)
          ],
          color: '#3b82f6', // blue-500
          name: "Zone FTY"
        },
        'FMS': {
          coordinates: [
            [50.4102, 3.6856],  // L97 (Point Ouest)
            [50.4569, 3.7785],  // L78
            [50.6145, 3.7998],  // L90C
            [50.6055, 4.1379],  // L116
            [50.7069, 4.2124],  // L96 (Point Nord)
            [50.5064, 4.2342],  // L116
            [50.4603, 4.2441],  // L112 (Point Est)
            [50.404955, 4.174978],  // L108
            [50.4512, 3.9391],  // L118
            [50.4720, 3.9574],  // L97
            [50.3291, 3.9083]   // L96 (Point Sud)
          ],
          color: '#eab308', // yellow-500
          name: "Zone FMS"
        },
        'FCR': {
          coordinates: [
            [50.7302, 4.3785],  // L124 (Nord)
            [50.5048, 4.3876],  // L117
            [50.4863, 4.5478],  // L140 (Est)
            [50.4457, 4.6463],  // L130 (Sud-Est)
            [50.0566, 4.4920],  // L132 (Sud)
            [50.3033, 4.1110],  // L130A (Ouest)
            [50.4603, 4.2441],  // L112 (Nord-Ouest)
            [50.5035, 4.2399]   // L117 (Nord-Ouest)
          ],
          color: '#ef4444', // red-500
          name: "Zone FCR"
        }
      };
      
      const tileLayers = {
        'Plan': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 22,
          attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }),
        'Hybride (Google)': L.tileLayer('http://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
          maxZoom: 22, 
          subdomains:['mt0','mt1','mt2','mt3'],
          attribution: 'Map data &copy;2025 Google'
        }),
        'Satellite': L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
          maxZoom: 22,
          subdomains:['mt0','mt1','mt2','mt3'],
          attribution: 'Map data &copy;2025 Google'
        })
      };
      
      /**
       * Initialise la carte Leaflet
       */
      function initMap() {
        try {
          map = L.map('map', {
              maxZoom: 22,
              fullscreenControl: true
          }).setView([50.63, 4.47], 9); 

          tileLayers['Satellite'].addTo(map);
          
          if (document.documentElement.classList.contains('dark')) {
             map.getContainer().style.backgroundColor = '#1f2937'; 
          }

          // Initialiser les couches de données
          markersLayer = L.layerGroup().addTo(map);
          zoneBoundariesLayer = L.layerGroup().addTo(map); 

          // Ajouter le contrôle des couches
          const baseMaps = {
            'Satellite': tileLayers['Satellite'],
            'Plan': tileLayers['Plan'],
            'Hybride': tileLayers['Hybride (Google)']
          };
          const overlayMaps = {
            "Zones SPI": zoneBoundariesLayer,
            "Passages à Niveau (PN)": markersLayer
          };
          L.control.layers(baseMaps, overlayMaps).addTo(map);

          // Initialiser la légende
          initLegend();

        } catch(e) {
          notyf.error("Erreur lors de l'initialisation de la carte.");
          document.getElementById('map-container').innerHTML = 
            '<p class="p-8 text-center text-red-600">Erreur: Impossible de charger la carte. Vérifiez votre connexion.</p>';
        }
      }

      /**
       * Ajoute la légende des zones à la carte
       */
      function initLegend() {
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend leaflet-legend');
            div.innerHTML += '<h4>Légende des Zones</h4>';
            
            Object.values(zonePolygons).forEach(zone => {
                div.innerHTML += `
                    <div class="leaflet-legend-item">
                        <div class="leaflet-legend-color" style="background-color: ${zone.color}"></div>
                        <span class="leaflet-legend-text">${zone.name}</span>
                    </div>
                `;
            });
            return div;
        };
        legend.addTo(map);
      }

      /**
       * Dessine les polygones de zone
       */
      function drawZoneBoundaries() {
        if (!map || !zoneBoundariesLayer) return;
        zoneBoundariesLayer.clearLayers();

        Object.values(zonePolygons).forEach(zone => {
          const polygon = L.polygon(zone.coordinates, { 
            color: zone.color,
            weight: 3,
            opacity: 0.8,
            fillOpacity: 0.1 
          }).bindPopup(`<h4>${zone.name}</h4>`);
          
          zoneBoundariesLayer.addLayer(polygon);
        });
      }

      /**
       * Charge les filtres de lignes
       */
      async function loadLineFilters() {
        filterContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Chargement...</p>';
        try {
          // On garde la logique de jointure pour avoir toutes les lignes
          const [pnLines, spiLines] = await Promise.all([
            supabaseClient.from('pn_data').select('ligne_nom'),
            supabaseClient.from('spi_data').select('ligne_nom')
          ]);

          if (pnLines.error) throw pnLines.error;
          if (spiLines.error) throw spiLines.error;

          const allLines = [
            ...pnLines.data.map(item => item.ligne_nom),
            ...spiLines.data.map(item => item.ligne_nom)
          ];
          
          const lignes = [...new Set(allLines.filter(Boolean))].sort();
          
          filterContainer.innerHTML = `
            <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" value="all" checked 
                     class="filter-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500">
              <span class="font-bold text-sm text-gray-700 dark:text-gray-200">Afficher toutes les lignes</span>
            </label>
            ${lignes.map(ligne => `
            <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" value="${ligne}" checked 
                     class="filter-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500">
              <span class="text-sm text-gray-700 dark:text-gray-300">${ligne}</span>
            </label>
            `).join('')}
          `;

        } catch (error) {
          filterContainer.innerHTML = '<p class="text-sm text-red-600">Erreur chargement filtres.</p>';
        }
      }

      /**
       * Charge toutes les données PN depuis Supabase
       */
      async function loadAllPnData() {
        try {
          const { data, error } = await supabaseClient
            .from('pn_data')
            .select('ligne_nom, pn, bk, adresse, geo')
            .not('geo', 'is', null); 
            
          if (error) throw error;
          allPnData = data;
        } catch (error) {
          notyf.error('Erreur chargement données PN: ' + error.message);
        }
      }

      /**
       * Fonction principale pour filtrer et afficher les données
       * (Corrigé pour supprimer la "race condition")
       */
      function filterAndDisplayData() {
        // === CORRECTION 1: Suppression du garde-fou ===
        // if (allPnData.length === 0) return; // SUPPRIMÉ
        
        const checkedBoxes = filterContainer.querySelectorAll('.filter-checkbox:checked');
        
        // === CORRECTION 2: Logique de 'selectedLignes' simplifiée ===
        // On prend juste les lignes cochées, sans 'all'
        const selectedLignes = Array.from(checkedBoxes)
                                    .map(cb => cb.value)
                                    .filter(val => val !== 'all');
        
        const searchTerm = searchBar.value.toLowerCase().trim();

        // Le filtrage se fait sur 'allPnData', qui peut être vide au début
        const filteredPnData = allPnData.filter(pn => {
          const ligneMatch = selectedLignes.includes(pn.ligne_nom);
          const searchMatch = !searchTerm || 
                              (pn.pn && pn.pn.toLowerCase().includes(searchTerm)) ||
                              (pn.bk && pn.bk.toLowerCase().includes(searchTerm));
          return ligneMatch && searchMatch;
        });

        updateMap(filteredPnData);
        updateList(filteredPnData);
      }
      
      /**
       * Met à jour la carte Leaflet avec les données filtrées
       */
      function updateMap(pnData) {
        if (!map || !markersLayer) return;
        
        markersLayer.clearLayers();
        const markers = [];
        
        // Ajouter les marqueurs PN
        pnData.forEach(pn => {
          if (!pn.geo) return;
          const coords = pn.geo.split(',');
          const lat = parseFloat(coords[0]);
          const lon = parseFloat(coords[1]);
          
          if (!isNaN(lat) && !isNaN(lon)) {
            const popupContent = `
              <h4>${pn.pn || 'N/A'} - Ligne ${pn.ligne_nom || 'N/A'}</h4>
              <p><strong>BK:</strong> ${pn.bk || 'N/A'}</p>
              <p><strong>Adresse:</strong> ${pn.adresse || 'N/A'}</p>
            `;
            const marker = L.marker([lat, lon]).bindPopup(popupContent);
            markers.push(marker);
            markersLayer.addLayer(marker);
          }
        });
        
        // Ajuster le zoom de la carte
        if (markers.length > 0) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
        }
      }

      /**
       * Met à jour la liste HTML avec les données filtrées
       * (Corrigé pour gérer l'état de chargement)
       */
      function updateList(pnData) {
        
        // === CORRECTION 3: Logique d'affichage de la liste ===
        if (pnData.length === 0) {
          // Si 'allPnData' est encore vide, c'est qu'on charge
          if (allPnData.length === 0) {
            pnListContainer.innerHTML = ''; // Ne rien afficher pendant le chargement
          } else {
            // Si 'allPnData' est plein, mais 'pnData' est vide, c'est qu'il n'y a pas de résultat
            pnListContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center">Aucun PN ne correspond aux filtres.</p>';
          }
          return;
        }
        
        const pnHtml = pnData.map(pn => `
          <div class="bg-white p-4 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-bold text-blue-700 dark:text-blue-400">${pn.pn || 'N/A'}</h3>
              <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">${pn.ligne_nom || 'N/A'}</span>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300 mt-2"><strong>BK:</strong> ${pn.bk || 'N/A'}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1"><strong>Adresse:</strong> ${pn.adresse || 'N/A'}</p>
          </div>
        `).join('');

        pnListContainer.innerHTML = pnHtml;
      }

      // --- Écouteurs d'événements ---
      
      // === CORRECTION 4: Logique d'écouteur "intelligente" ===
      filterContainer.addEventListener('change', (e) => {
          const target = e.target;
          if (!target.classList.contains('filter-checkbox')) return;

          const allCheckbox = filterContainer.querySelector('.filter-checkbox[value="all"]');
          
          // Cas 1: L'utilisateur clique sur "Afficher tout"
          if (target.value === 'all') {
              const isChecked = target.checked;
              // Coche/décoche toutes les autres cases
              filterContainer.querySelectorAll('.filter-checkbox').forEach(cb => {
                  cb.checked = isChecked;
              });
          } 
          // Cas 2: L'utilisateur clique sur une autre case
          else {
              if (!target.checked) {
                  // Si on décoche une ligne, on décoche "Afficher tout"
                  allCheckbox.checked = false;
              } else {
                  // Si on coche une ligne, on vérifie si toutes les autres sont cochées
                  let allAreChecked = true;
                  filterContainer.querySelectorAll('.filter-checkbox').forEach(cb => {
                      if (cb.value !== 'all' && !cb.checked) {
                          allAreChecked = false;
                      }
                  });
                  allCheckbox.checked = allAreChecked;
              }
          }
          
          // Dans tous les cas, on lance le filtre
          filterAndDisplayData();
      });
      
      searchBar.addEventListener('input', filterAndDisplayData);
      
      // --- Lancement Initial ---
      initMap();
      drawZoneBoundaries(); // Dessiner les polygones
      loadLineFilters();
      
      loadAllPnData().then(() => {
        // Une fois les données chargées, on lance un premier filtre
        filterAndDisplayData();
      });
      
    }; // Fin de window.pageInit