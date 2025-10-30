document.addEventListener('DOMContentLoaded', () => {
  // 1. Trouver l'élément "placeholder" pour la navigation
  const navPlaceholder = document.getElementById('nav-placeholder');
  
  if (navPlaceholder) {
    // 2. Charger le contenu de _nav.html
    fetch('_nav.html')
      .then(response => {
        if (!response.ok) throw new Error('Erreur de chargement du layout');
        return response.text();
      })
      .then(html => {
        // 3. Injecter le HTML de la nav
        navPlaceholder.innerHTML = html;
        
        // 4. Mettre en surbrillance le lien de la page active
        highlightActiveLink();
        
        // 5. NOUVELLE LIGNE : Activer les icônes Lucide injectées
        lucide.createIcons();
      })
      .catch(error => {
        console.error('Impossible de charger la navigation:', error);
        navPlaceholder.innerHTML = '<p class="text-center text-red-500">Erreur de chargement du menu.</p>';
      });
  }
});

function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop();
  
  if (currentPage) {
    const navLinksContainer = document.getElementById('nav-links');
    if (navLinksContainer) {
      const activeLink = navLinksContainer.querySelector(`a[href="${currentPage}"]`);
      
      if (activeLink) {
        activeLink.classList.add('bg-gray-700', 'font-bold');
      }
    }
  }
}