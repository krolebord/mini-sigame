import { createEffect, createRoot, onCleanup } from 'solid-js';
import { usePreferences } from './use-preferences';

export function syncTheme() {
  createRoot(() => {
    const [preferences] = usePreferences();

    createEffect(() => {
      if (preferences.theme === 'system') {
        setSystemTheme();
      } else {
        toggleTheme(preferences.theme === 'dark');
      }
    });
  });
}

function toggleTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function setSystemTheme() {
  const prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)');

  const handleColorSchemeChange = ({ matches }: { matches: boolean }) => {
    toggleTheme(matches);
  };

  handleColorSchemeChange(prefersColorScheme);

  prefersColorScheme.addEventListener('change', handleColorSchemeChange);
  onCleanup(() => {
    prefersColorScheme.removeEventListener('change', handleColorSchemeChange);
  });
}
