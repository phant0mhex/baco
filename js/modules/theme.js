// js/modules/theme.js

export function setupThemeToggle() {
  const themeToggleButton = document.getElementById('theme-toggle-button');
  const themeToggleIcon = document.getElementById('theme-toggle-icon');
  const themeStorageKey = 'baco-theme'; 

  if (!themeToggleButton || !themeToggleIcon) return;

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      themeToggleIcon.setAttribute('data-lucide', 'moon');
    } else {
      document.documentElement.classList.remove('dark');
      themeToggleIcon.setAttribute('data-lucide', 'sun');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  let savedTheme = localStorage.getItem(themeStorageKey);
  if (!savedTheme) {
    savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  applyTheme(savedTheme);

  themeToggleButton.addEventListener('click', () => {
    const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem(themeStorageKey, newTheme);
  });
}