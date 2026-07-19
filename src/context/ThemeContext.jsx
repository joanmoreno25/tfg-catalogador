import React, { createContext, useState, useEffect, useContext } from 'react';

/**
 * Theme context to manage global dark/light mode state.
 */
const ThemeContext = createContext();

/**
 * Custom hook to consume the theme context.
 * 
 * @returns {Object} The current theme context value, including state and toggle function.
 */
export const useTheme = () => useContext(ThemeContext);

/**
 * Theme provider component.
 * Initializes the theme based on local storage or system preferences and provides the toggle functionality.
 * 
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} props.children - Child components to render.
 * @returns {JSX.Element} The rendered provider component.
 */
export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  /**
   * Toggles the current theme between dark and light modes,
   * updating both the DOM class and local storage.
   */
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};