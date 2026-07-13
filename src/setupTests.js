import '@testing-library/jest-dom';

// 1. PARCHE GLOBAL PARA FIREBASE
// Evita el crasheo de "crypto is not defined" inyectando un generador falso de UUIDs.
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2)
  }
});

// 2. PARCHE GLOBAL PARA JSDOM
// Soluciona el error de "IntersectionObserver" para todas tus páginas actuales y futuras.
class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver;
global.IntersectionObserver = MockIntersectionObserver;