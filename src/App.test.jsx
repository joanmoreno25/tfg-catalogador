import React from 'react';
import { render, act } from '@testing-library/react';
import App from './App';

// MOCK GLOBAL DE FIREBASE PARA LA APP PRINCIPAL
jest.mock('./firebase-config', () => ({
  auth: {
    // Simulamos la verificación de sesión en tiempo real de Firebase
    onAuthStateChanged: jest.fn((callback) => {
      callback(null); // Simulamos que inicia como invitado (sin sesión)
      return jest.fn(); // Función de limpieza
    }) 
  },
  db: {}
}));

// MOCK GLOBAL DE TRADUCCIONES (Soluciona el error de "Suspended resource")
// Previene que la app intente descargar archivos JSON de idiomas de internet
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { 
      language: 'es',
      changeLanguage: jest.fn() 
    }
  })
}));

describe('Main App Component', () => {
  it('should render the entire application without crashing', async () => {
    
    // Al usar 'await act', el test pausará su ejecución y esperará a que 
    // todas las Promesas, Suspenses y useEffects iniciales de App.jsx terminen.
    await act(async () => {
      render(<App />);
    });
    
    // Si la aplicación se dibuja sin explotar la consola, este test pasará.
    expect(true).toBe(true);
  });
});