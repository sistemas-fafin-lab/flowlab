import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

const THEME_STORAGE_KEY = 'flowlab-theme-preference';

interface ThemeContextType {
  theme: Theme;
  themePreference: ThemePreference;
  setTheme: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
  return stored ?? 'system';
}

function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => {
    const pref = getInitialPreference();
    return pref === 'system' ? getSystemTheme() : pref;
  });

  // Apply theme to document
  const applyTheme = useCallback((theme: Theme) => {
    applyThemeToDOM(theme);
    setResolvedTheme(theme);
  }, []);

  // Handle preference change
  const setTheme = useCallback((preference: ThemePreference) => {
    setThemePreference(preference);
    localStorage.setItem(THEME_STORAGE_KEY, preference);

    if (preference === 'system') {
      applyTheme(getSystemTheme());
    } else {
      applyTheme(preference);
    }
  }, [applyTheme]);

  // Toggle between light and dark (ignores system preference)
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Initialize theme on mount
  useEffect(() => {
    if (themePreference === 'system') {
      applyTheme(getSystemTheme());
    } else {
      applyTheme(themePreference);
    }
  }, [themePreference, applyTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (themePreference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference, applyTheme]);

  const value: ThemeContextType = {
    theme: resolvedTheme,
    themePreference,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
