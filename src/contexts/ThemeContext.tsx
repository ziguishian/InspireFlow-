import React, { createContext, useContext, useEffect, ReactNode } from 'react';

/** 固定深色主题 + 青色强调，无切换 */
const ThemeContext = createContext<{
  theme: 'dark';
  accent: 'cyan';
  setTheme: (theme: 'dark') => void;
  setAccent: (accent: 'cyan') => void;
}>(undefined as any);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-accent', 'cyan');
    document.documentElement.style.setProperty('--accent-primary', '6, 182, 212');
    document.documentElement.style.setProperty('--accent-glow', 'rgba(6, 182, 212, 0.4)');
  }, []);

  const value = {
    theme: 'dark' as const,
    accent: 'cyan' as const,
    setTheme: () => {},
    setAccent: () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
