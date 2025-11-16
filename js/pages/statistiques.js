// js/pages/statistiques.js

window.pageInit = () => {
    
  // --- GARDE DE SÉCURITÉ (Maintenant à l'intérieur de pageInit) ---
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    alert("Accès refusé. Vous devez être administrateur pour voir cette page.");
    window.location.replace('accueil.html');
    return; // Arrêter l'exécution de pageInit
  }
  // --------------------------

  const notyf = (typeof Notyf !== 'undefined') 
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  /**
   * Charge les statistiques des rampes PMR
   */
  async function loadPmrStats() {
    const ctx = document.getElementById('pmrStatusChart');
    if (!ctx) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('pmr_data')
        .select('etat_rampe');
        
      if (error) throw error;

      const counts = { 'OK': 0, 'HS': 0, 'En attente': 0 };
      let hsCount = 0;

      data.forEach(item => {
        if (item.etat_rampe in counts) {
          counts[item.etat_rampe]++;
          if (item.etat_rampe === 'HS') {
            hsCount++;
          }
        }
      });
      
      // Mettre à jour la carte "Rampes HS"
      document.getElementById('total-rampes-hs').textContent = hsCount;
      
      // Rendu du graphique
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['OK', 'HS', 'En attente'],
          datasets: [{
            label: 'État des Rampes',
            data: [counts['OK'], counts['HS'], counts['En attente']],
            backgroundColor: [
              'rgb(34, 197, 94)', // green-500
              'rgb(239, 68, 68)', // red-500
              'rgb(234, 179, 8)'   // yellow-500
            ],
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
        }
      });
      
    } catch (error) {
      notyf.error("Erreur chargement stats PMR: " + error.message);
    }
  }

  /**
   * Charge les statistiques du journal (30 derniers jours)
   */
  async function loadJournalStats() {
    const ctx = document.getElementById('journalActivityChart');
    if (!ctx) return;

    // Calcule la date d'il y a 30 jours
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

    try {
      const { data, error } = await supabaseClient
        .from('main_courante')
        .select('created_at')
        .gte('created_at', date30DaysAgo.toISOString()); // Ne prend que les 30 derniers jours
        
      if (error) throw error;
      
      // Compter les entrées des 7 derniers jours pour la carte
      const date7DaysAgo = new Date();
      date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
      const entriesLast7Days = data.filter(e => new Date(e.created_at) > date7DaysAgo).length;
      document.getElementById('total-journal-7d').textContent = entriesLast7Days;

      // Agréger les données par jour pour le graphique
      const activity = {};
      const labels = [];
      
      // Initialiser les 30 derniers jours à 0
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        labels.push(label);
        activity[label] = 0;
      }
      
      data.forEach(entry => {
        const label = new Date(entry.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        if (label in activity) {
          activity[label]++;
        }
      });

      // Rendu du graphique
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Entrées du journal',
            data: Object.values(activity),
            fill: false,
            borderColor: 'rgb(59, 130, 246)', // blue-500
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                // S'assurer que l'axe Y n'affiche que des entiers
                stepSize: 1 
              }
            }
          }
        }
      });

    } catch (error) {
      notyf.error("Erreur chargement stats Journal: " + error.message);
    }
  }

  /**
   * Charge les compteurs simples (Utilisateurs, Clients PMR)
   */
  async function loadTotalCounts() {
    try {
      // Compter les utilisateurs
      const { count: userCount, error: userError } = await supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (userError) throw userError;
      document.getElementById('total-users').textContent = userCount;
      
      // Compter les clients PMR
      const { count: clientCount, error: clientError } = await supabaseClient
        .from('pmr_clients')
        .select('*', { count: 'exact', head: true });
      if (clientError) throw clientError;
      document.getElementById('total-clients-pmr').textContent = clientCount;

    } catch (error) {
       notyf.error("Erreur chargement compteurs: " + error.message);
    }
  }

  // --- Lancement ---
  // La garde de sécurité (au début de pageInit) est déjà passée
  loadPmrStats();
  loadJournalStats();
  loadTotalCounts();
  
}; // Fin de window.pageInit