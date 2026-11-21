import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/theme-store';

/**
 * Resolves the theme preference ('system' | 'light' | 'dark') to the concrete
 * color scheme the app should render. Components that call this hook update
 * immediately when the preference changes in Settings.
 */
export function useColorScheme(): 'light' | 'dark' {
  const systemScheme = useSystemColorScheme();
  const mode = useThemeStore((state) => state.mode);

  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }

  return mode;
}
